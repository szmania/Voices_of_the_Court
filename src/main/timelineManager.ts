import fs from 'fs';
import path from 'path';
import { createHash, randomInt, randomUUID } from 'crypto';
import {
    MAX_NODE_COMPONENT,
    UnsupportedTimelineSchemaError,
    type ObservedTimelineState,
    type TimelineParseResult
} from '../shared/gameData/timelineProtocol.js';
import {
    RegistryValidationError,
    type RegistryValidationErrorCode,
    validateV1RegistryData,
    summarizeRegistryErrors
} from './registryValidator.js';
import {
    JournalValidationError,
    SerializedJournalStore,
    TransitionJournalEntry,
    TimelineNodeV2,
    validateNodeV2,
    validateJournalEntry,
    validateJournalConsistency
} from './timelineTransitionJournal.js';
import {
    buildIdentityFromParts,
    buildIdentityFromSnapshot,
    isCampaignPlayerIdentity,
    type CampaignPlayerIdentity
} from '../shared/gameData/CampaignIdentity.js';
import {
    campaignPlayerDir,
    timelineRegistryPath as campaignRegistryPath,
    timelineRegistryTmpPath as campaignRegistryTmpPath,
    timelineRegistrySwapManifestPath as campaignRegistrySwapPath,
    timelineRegistryBackupPath as campaignRegistryBackupPathOf
} from './campaignDataPaths.js';
import { resolveTimelineStrict } from './timelineResolver.js';

const SCHEMA_VERSION = 1;

export interface TimelineNodeId {
    a: number;
    b: number;
}

export interface TimelineNode {
    parentId: string | null;
    epoch: number | undefined;
    /**
     * CK3-side random correlation token. Used as a correlation hint in the
     * node-commit short window; not a unique branch identifier.
     */
    checkpointToken?: number;
    source: string;
    eventKey: string;
    createdAt: string;
}

export interface TimelineRegistryData {
    version: number;
    playerId: string;
    nodes: Record<string, TimelineNode>;
}

export interface TimelineContext {
    playerId: string;
    checkpointEpoch?: number;
    /** Token active in the CK3 snapshot's current checkpoint. */
    checkpointToken?: number;
    /** Token preallocated by CK3 for the checkpoint that will be advanced next. */
    pendingCheckpointToken?: number;
    timelineNodeId?: string;
    timelineParentId?: string;
    playerName?: string;
    /**
     * §4.1: captured immutable campaign/player identity for the operation.
     * Undefined in Phase 3 and for legacy v1 paths; Phase 4 callers that have
     * a v2 snapshot should set this so business functions can route writes
     * through the campaign-scoped path. P4.3 will switch the production
     * writers to use this field instead of bare `playerId` for pathing.
     */
    identity?: CampaignPlayerIdentity;
}

export type SourceKind = 'conversation' | 'letter_reply' | 'incoming_letter' | 'battle' | 'summary_manual';

function formatNodeId(node: TimelineNodeId): string {
    return `${node.a}-${node.b}`;
}

function parseNodeId(id: string | undefined): TimelineNodeId | undefined {
    if (!id) return undefined;
    const dashIndex = id.indexOf('-');
    if (dashIndex <= 0 || dashIndex >= id.length - 1) return undefined;
    const a = Number(id.slice(0, dashIndex));
    const b = Number(id.slice(dashIndex + 1));
    if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0 || a > MAX_NODE_COMPONENT || b > MAX_NODE_COMPONENT) {
        return undefined;
    }
    return { a, b };
}

function isValidNodeId(id: string | undefined): boolean {
    return parseNodeId(id) !== undefined;
}

function isValidCheckpointToken(token: number | undefined): token is number {
    return typeof token === 'number'
        && Number.isInteger(token)
        && token > 0
        && token <= MAX_NODE_COMPONENT;
}

function generateNodeId(): TimelineNodeId {
    return {
        a: randomInt(1, MAX_NODE_COMPONENT + 1),
        b: randomInt(1, MAX_NODE_COMPONENT + 1)
    };
}

function dedupKey(parentId: string | null, source: string, eventKey: string): string {
    return `${parentId ?? 'root'}\u001f${source}\u001f${eventKey}`;
}

function isLegacyRootNode(node: TimelineNode): boolean {
    return node.parentId === null && node.eventKey === `${node.source}:legacy_root`;
}

function isEpochRegression(parentEpoch: number | undefined, childEpoch: number | undefined): boolean {
    return typeof parentEpoch === 'number'
        && Number.isFinite(parentEpoch)
        && typeof childEpoch === 'number'
        && Number.isFinite(childEpoch)
        && childEpoch < parentEpoch;
}

function emptyRegistry(playerId: string): TimelineRegistryData {
    return { version: SCHEMA_VERSION, playerId, nodes: {} };
}

/**
 * v2 journals hold the authoritative graph for campaign-scoped data, while
 * `store` is retained for legacy compatibility. Project v2 nodes that are
 * already connected to the legacy graph; these nodes may safely be included
 * in a later legacy-compatible write.
 */
function projectV2NodesIntoRegistryData(
    store: TimelineRegistryData,
    v2: TimelineStoreV2Payload | undefined
): TimelineRegistryData {
    if (v2 === undefined || Object.keys(v2.nodes).length === 0) {
        return store;
    }

    const nodes: Record<string, TimelineNode> = {};
    for (const [nodeId, node] of Object.entries(store.nodes)) {
        nodes[nodeId] = { ...node };
    }

    // Only project a connected graph. A journal node can temporarily refer to
    // a CK3 node not yet persisted locally; exposing that orphan through the
    // v1 compatibility store would make its next atomic rewrite invalid.
    const pending = new Map(Object.entries(v2.nodes));
    let projectedInPass = true;
    while (pending.size > 0 && projectedInPass) {
        projectedInPass = false;
        for (const [nodeId, node] of pending) {
            if (node.parentId !== null && !Object.prototype.hasOwnProperty.call(nodes, node.parentId)) {
                continue;
            }
            const parent = node.parentId === null ? undefined : nodes[node.parentId];
            if (parent && isEpochRegression(parent.epoch, node.epoch)) {
                // A save rollback can make CK3 reuse an older observed node id
                // after the App has already recorded a newer node under that
                // id. Keep the rollback node in the v2 journal, but do not
                // project its backwards edge into the writable v1 graph. Its
                // descendants remain external too because this node is never
                // added to `nodes`.
                pending.delete(nodeId);
                continue;
            }
            nodes[nodeId] = {
                parentId: node.parentId,
                epoch: node.epoch,
                checkpointToken: node.checkpointCorrelationToken,
                source: node.source,
                eventKey: node.eventSignature ?? `${node.source}:${node.transitionAttemptId}`,
                createdAt: node.createdAt
            };
            pending.delete(nodeId);
            projectedInPass = true;
        }
    }

    return {
        version: store.version,
        playerId: store.playerId,
        nodes
    };
}

interface V2VisibilityGraph {
    nodes: Record<string, TimelineNode>;
    v2NodeIds: Set<string>;
}

/**
 * Build a read-only graph for visibility decisions. Unlike the legacy
 * compatibility projection above, this includes journal nodes whose parent
 * is an observed CK3 node that has never been persisted locally. Keeping it
 * separate prevents a read path from accidentally writing such an external
 * parent into the v1 store.
 */
function buildV2VisibilityGraph(
    store: TimelineRegistryData,
    v2: TimelineStoreV2Payload | undefined
): V2VisibilityGraph | undefined {
    if (v2 === undefined || Object.keys(v2.nodes).length === 0) {
        return undefined;
    }

    const nodes: Record<string, TimelineNode> = {};
    for (const [nodeId, node] of Object.entries(store.nodes)) {
        nodes[nodeId] = { ...node };
    }
    const v2NodeIds = new Set<string>();
    for (const [nodeId, node] of Object.entries(v2.nodes)) {
        const parent = node.parentId === null
            ? undefined
            : (v2.nodes[node.parentId] ?? store.nodes[node.parentId]);
        const visibleParentId = parent && isEpochRegression(parent.epoch, node.epoch)
            ? null
            : node.parentId;
        nodes[nodeId] = {
            // A rollback edge must not expose records from the abandoned
            // future branch. The journal remains unchanged on disk; only this
            // read-only visibility graph treats the rollback node as a root.
            parentId: visibleParentId,
            epoch: node.epoch,
            checkpointToken: node.checkpointCorrelationToken,
            source: node.source,
            eventKey: node.eventSignature ?? `${node.source}:${node.transitionAttemptId}`,
            createdAt: node.createdAt
        };
        v2NodeIds.add(nodeId);
    }

    // Some CK3 flows retain the observed CK3 node id while advancing the
    // checkpoint token. Recover that missing parent link only when the
    // journal proves a unique token handoff: B observed A's token and then
    // created B. On a rollback, the new sibling observes the older token, so
    // it remains detached and cannot inherit records from the abandoned
    // branch. This graph is read-only and never changes the persisted v1
    // compatibility store.
    const nodesByCheckpointToken = new Map<number, string[]>();
    for (const [nodeId, node] of Object.entries(v2.nodes)) {
        if (!isValidCheckpointToken(node.checkpointCorrelationToken)) continue;
        const nodeIds = nodesByCheckpointToken.get(node.checkpointCorrelationToken) ?? [];
        nodeIds.push(nodeId);
        nodesByCheckpointToken.set(node.checkpointCorrelationToken, nodeIds);
    }
    const transitionByTargetNode = new Map<string, TransitionJournalEntry>();
    for (const transition of v2.transitions) {
        transitionByTargetNode.set(transition.targetNodeId, transition);
    }
    for (const [nodeId, node] of Object.entries(v2.nodes)) {
        if (node.parentId === null || Object.prototype.hasOwnProperty.call(v2.nodes, node.parentId)) {
            continue;
        }
        const transition = transitionByTargetNode.get(nodeId);
        if (!transition || !isValidCheckpointToken(transition.observedCurrentToken)) {
            continue;
        }
        const candidates = nodesByCheckpointToken.get(transition.observedCurrentToken) ?? [];
        if (candidates.length !== 1) {
            continue;
        }
        const candidateId = candidates[0];
        const candidate = v2.nodes[candidateId];
        if (candidate.epoch !== transition.observedEpoch) {
            continue;
        }
        nodes[nodeId] = { ...nodes[nodeId], parentId: candidateId };
    }
    return { nodes, v2NodeIds };
}

export class TimelineRegistry {
    private data: TimelineRegistryData;
    private dedupIndex: Map<string, string>;
    private dirty = false;
    private currentRevision = 0;
    private readonly v2VisibilityGraph?: V2VisibilityGraph;

    constructor(playerId: string, data?: TimelineRegistryData, revision?: number, v2VisibilityGraph?: V2VisibilityGraph) {
        if (data) {
            this.data = data;
        } else {
            this.data = emptyRegistry(playerId);
        }
        this.currentRevision = typeof revision === 'number' && revision >= 0 ? revision : 0;
        this.v2VisibilityGraph = v2VisibilityGraph;
        this.dedupIndex = new Map();
        for (const [id, node] of Object.entries(this.data.nodes)) {
            this.dedupIndex.set(dedupKey(node.parentId, node.source, node.eventKey), id);
        }
    }

    get playerId(): string {
        return this.data.playerId;
    }

    hasNode(id: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.data.nodes, id);
    }

    getNode(id: string): TimelineNode | undefined {
        return this.data.nodes[id];
    }

    getAllNodes(): TimelineNode[] {
        return Object.values(this.data.nodes);
    }

    getNodeEntries(): Array<[string, TimelineNode]> {
        return Object.entries(this.data.nodes);
    }

    /**
     * Read-only union used by strict resolution. It includes v2 journal nodes
     * whose CK3 parent has not been persisted in the writable v1 store.
     */
    getVisibilityNodeEntries(): Array<[string, TimelineNode]> {
        return this.v2VisibilityGraph
            ? Object.entries(this.v2VisibilityGraph.nodes)
            : this.getNodeEntries();
    }

    isDirty(): boolean {
        return this.dirty;
    }

    markClean(): void {
        this.dirty = false;
    }

    /**
     * In-memory revision number. Loaded from the on-disk envelope (or 0 for
     * legacy v1 files without one) and bumped by FsTimelinePersistence.saveRegistry
     * before a write. Phase 3 uses this for backup rotation and tmp promotion
     * continuity checks; it is not part of the v1 file's `version` field.
     */
    getRevision(): number {
        return this.currentRevision;
    }

    setRevision(revision: number): void {
        if (typeof revision !== 'number' || !Number.isFinite(revision) || revision < 0) {
            throw new Error(`timelineManager: invalid revision ${String(revision)}`);
        }
        this.currentRevision = revision;
    }

    /**
     * Public serialization entry point. Returns a plain, deep-copied
     * TimelineRegistryData representation suitable for JSON.stringify or
     * validation. Replaces the previous `(registry as any).data` private
     * access in saveRegistry (§7.3 "公开 snapshot").
     *
     * The returned object is a fresh copy: mutating it does not affect the
     * registry, and registry mutations after snapshot() do not leak in.
     */
    snapshot(): TimelineRegistryData {
        const nodes: Record<string, TimelineNode> = {};
        for (const [id, node] of Object.entries(this.data.nodes)) {
            nodes[id] = { ...node };
        }
        return {
            version: this.data.version,
            playerId: this.data.playerId,
            nodes
        };
    }

    /**
     * Repair links produced while CK3 had advanced the checkpoint but had not
     * yet applied the generated run script. Only an artificial legacy root or
     * an epoch gap is repaired, and only to one earlier, non-legacy candidate.
     * Deliberate branches whose parent is at the expected epoch are untouched.
     *
     * Phase 5 (§9.5): this method is no longer called from production write or
     * load paths. It is retained for the explicit migration preview flow only
     * (campaignMigration). Do not add new call sites in production code.
     */
    repairLegacyContinuity(): number {
        let repairedCount = 0;
        const orderedNodes = this.getNodeEntries().sort(([, a], [, b]) => {
            const epochA = a.epoch ?? Number.NEGATIVE_INFINITY;
            const epochB = b.epoch ?? Number.NEGATIVE_INFINITY;
            if (epochA !== epochB) return epochA - epochB;
            return a.createdAt.localeCompare(b.createdAt);
        });

        for (const [nodeId, node] of orderedNodes) {
            if (typeof node.epoch !== 'number' || node.epoch <= 0 || node.parentId === null) {
                continue;
            }

            const parent = this.getNode(node.parentId);
            const parentIsLegacyRoot = parent !== undefined && isLegacyRootNode(parent);
            const parentEpoch = parent?.epoch;
            const hasEpochGap = typeof parentEpoch !== 'number' || parentEpoch < node.epoch - 1;
            if (!parentIsLegacyRoot && !hasEpochGap) {
                continue;
            }

            const candidates = this.getNodeEntries().filter(([candidateId, candidate]) =>
                candidateId !== nodeId
                && candidate.epoch === node.epoch! - 1
                && !isLegacyRootNode(candidate)
                && candidate.createdAt < node.createdAt
            );
            if (candidates.length !== 1) {
                continue;
            }

            node.parentId = candidates[0][0];
            repairedCount++;
        }

        if (repairedCount > 0) {
            this.dedupIndex.clear();
            for (const [id, node] of this.getNodeEntries()) {
                this.dedupIndex.set(dedupKey(node.parentId, node.source, node.eventKey), id);
            }
            this.dirty = true;
        }
        return repairedCount;
    }

    /**
     * @deprecated §9.3 P5.4: this v1 eventKey-dedup path is no longer the
     * production write path for NEW timeline records. Business sources
     * (conversation/letter_reply/incoming_letter/battle) now route through
     * TransitionJournalApi.beginTransition, which creates TimelineNodeV2
     * entries with transitionAttemptId linkage. This method is retained
     * for legacy read paths (loading existing v1 nodes that have
     * eventKey) and for migration staging. New production code MUST NOT
     * call this method to create records.
     */
    getOrCreateChild(
        parentId: string | null,
        source: SourceKind,
        eventKey: string,
        epoch: number | undefined,
        createdAt: string,
        checkpointToken?: number
    ): string {
        const key = dedupKey(parentId, source, eventKey);
        const existing = this.dedupIndex.get(key);
        if (existing) {
            const existingNode = this.getNode(existing);
            // A re-run after upgrading from a version without tokens may be able to
            // enrich its already-deduplicated node. Never overwrite a real token.
            if (existingNode && existingNode.checkpointToken === undefined && isValidCheckpointToken(checkpointToken)) {
                existingNode.checkpointToken = checkpointToken;
                this.dirty = true;
            }
            return existing;
        }

        if (parentId !== null && !this.hasNode(parentId)) {
            throw new TimelineParentNotFoundError(parentId);
        }

        let childId: string;
        let attempts = 0;
        do {
            childId = formatNodeId(generateNodeId());
            attempts++;
            if (attempts > 100) {
                throw new Error(`timelineManager: failed to generate unique node id after 100 attempts`);
            }
        } while (this.hasNode(childId));

        const node: TimelineNode = {
            parentId,
            epoch,
            checkpointToken: isValidCheckpointToken(checkpointToken) ? checkpointToken : undefined,
            source,
            eventKey,
            createdAt
        };
        this.data.nodes[childId] = node;
        this.dedupIndex.set(key, childId);
        this.dirty = true;
        return childId;
    }

    getAncestors(nodeId: string): string[] {
        const result: string[] = [];
        let current: string | null = nodeId;
        const visited = new Set<string>();
        while (current && this.hasNode(current) && !visited.has(current)) {
            visited.add(current);
            result.push(current);
            current = this.data.nodes[current].parentId;
        }
        return result;
    }

    getAncestorSet(nodeId: string): Set<string> {
        return new Set(this.getAncestors(nodeId));
    }

    isRecordVisible(recordNodeId: string | undefined, currentNodeId: string | undefined): boolean {
        if (recordNodeId === undefined || recordNodeId === null || recordNodeId === '') {
            return true;
        }
        if (currentNodeId === undefined || !isValidNodeId(currentNodeId)) {
            return true;
        }
        if (!isValidNodeId(recordNodeId)) {
            return true;
        }
        if (!this.hasNode(currentNodeId)) {
            return false;
        }
        return this.getAncestorSet(currentNodeId).has(recordNodeId);
    }

    /**
     * Read-only visibility check after strict resolution selected a v2 node.
     * An unpersisted CK3 parent is not itself sufficient evidence: multiple
     * sibling branches may share it after a rollback, so callers must first
     * resolve the current node using a unique checkpoint token.
     */
    isV2RecordVisibleFromObservedContext(
        recordNodeId: string | undefined,
        currentNodeId: string | undefined,
        checkpointEpoch: number | undefined
    ): boolean {
        if (!recordNodeId || !currentNodeId || !isValidNodeId(recordNodeId) || !isValidNodeId(currentNodeId)) {
            return false;
        }
        const observedEpoch = Number(checkpointEpoch);
        if (!Number.isFinite(observedEpoch)) {
            return false;
        }

        const graph = this.v2VisibilityGraph;
        if (!graph || !graph.v2NodeIds.has(recordNodeId) || !graph.nodes[currentNodeId]) {
            return false;
        }

        const recordNode = graph.nodes[recordNodeId];
        let current: string | null = currentNodeId;
        const visited = new Set<string>();
        while (current !== null && !visited.has(current)) {
            visited.add(current);
            const node: TimelineNode | undefined = graph.nodes[current];
            if (!node) {
                return false;
            }
            if (current === recordNodeId) {
                return typeof recordNode.epoch === 'number' && recordNode.epoch <= observedEpoch;
            }
            current = node.parentId;
        }
        return false;
    }
}

function registryPathForPlayer(userDataDir: string, playerId: string): string {
    return path.join(userDataDir, 'votc_data', 'timeline_registry', `player_${playerId}.json`);
}

/**
 * The store type returned by load operations. P3.1 aliases the current
 * `TimelineRegistry`; P3.2/P5 will refine this to the registry v2 shape
 * (campaign/player namespaces, transition journal, etc.) without changing
 * the `TimelineStoreLoadResult` contract.
 */
export type TimelineStore = TimelineRegistry;

/**
 * Load result per remediation plan §7.1. P3.1 only produces `found` from the
 * primary path with `revision: 0` (v1 files lack a revision field);
 * `promotable-tmp`/`backup` promotion and real revision are added by P3.2's
 * atomic-write machinery.
 */
export type TimelineStoreLoadResult =
    | { status: 'found'; store: TimelineStore; source: 'primary' | 'promotable-tmp' | 'backup'; revision: number; v2?: TimelineStoreV2Payload }
    | { status: 'missing' }
    | { status: 'corrupt'; filePath: string; errors: RegistryValidationError[]; quarantinePath?: string };

export class TimelineRegistryCorruptError extends Error {
    readonly code = 'TIMELINE_REGISTRY_CORRUPT';
    readonly errors: RegistryValidationError[];

    constructor(
        readonly filePath: string,
        readonly detail: string,
        readonly quarantinePath?: string,
        errors: RegistryValidationError[] = []
    ) {
        super(`Timeline registry is corrupt and will not be written: ${filePath} (${detail})`);
        this.name = 'TimelineRegistryCorruptError';
        this.errors = errors;
    }
}

export class TimelineParentNotFoundError extends Error {
    readonly code = 'TIMELINE_PARENT_NOT_FOUND';

    constructor(readonly parentId: string) {
        super(`Timeline parent node does not exist in the registry: ${parentId}`);
        this.name = 'TimelineParentNotFoundError';
    }
}

export interface TimelinePersistence {
    loadRegistry(playerId: string): TimelineRegistry | null;
    saveRegistry(registry: TimelineRegistry): void;
}

/**
 * On-disk envelope for the timeline registry (§7.3). Phase 3 wraps the v1
 * registry in this envelope at write time so that load/recovery can use
 * `revision` and `transactionId` to decide if a `.tmp` is promotable and
 * to keep the backup chain monotonic. `store` is the legacy v1 registry
 * representation.
 *
 * Phase 4 adds the real identity header (`campaign`/`player`) alongside
 * the v1 `store`. The v1 store still carries its own `playerId` field;
 * the identity header is authoritative for campaign scoping, and
 * `validateStoreWithIdentity` enforces they match.
 */
export interface TimelineStoreEnvelopeIdentity {
    campaignId: string;
    campaignSchema: number;
    protocolSchema: number;
}

export interface TimelineStoreEnvelopePlayer {
    playerId: string;
}

export interface TimelineStoreEnvelope {
    revision: number;
    transactionId: string;
    store: TimelineRegistryData;
    /** Phase 4 identity header. Present when the store was written by `saveStoreWithIdentity`. */
    campaign?: TimelineStoreEnvelopeIdentity;
    /** Phase 4 identity header. Present when the store was written by `saveStoreWithIdentity`. */
    player?: TimelineStoreEnvelopePlayer;
    /**
     * Phase 5 v2 timeline nodes keyed by node id. When present, the envelope
     * carries the v2 store alongside the v1 `store` (kept for migration
     * continuity). Production v2 writes populate this field; v1-only loads
     * leave it undefined so legacy callers continue to work.
     */
    nodes?: Record<string, TimelineNodeV2>;
    /**
     * Phase 5 transition journal entries. When present, each entry references
     * a node in `nodes` by `targetNodeId`. Append-only per §9.2 rule 7.
     */
    transitions?: TransitionJournalEntry[];
}

/**
 * Phase 5 v2 store payload. Carries the new nodes/journal alongside the
 * legacy v1 registry for migration. `saveStoreWithIdentity` accepts this
 * optional argument; `loadStoreWithIdentity` returns it via `result.v2`.
 */
export interface TimelineStoreV2Payload {
    nodes: Record<string, TimelineNodeV2>;
    transitions: TransitionJournalEntry[];
}

/**
 * Swap manifest written alongside the `.tmp` file (§7.3). Its presence after
 * a crash signals that the tmp has already been validated and is awaiting
 * rename to primary. Recovery only promotes a tmp when the manifest exists
 * AND revision is continuous AND transactionId matches AND the tmp re-validates.
 */
export interface TimelineSwapManifest {
    transactionId: string;
    revision: number;
    sourcePath: string;
    targetPath: string;
    sha256: string;
    createdAt: string;
}

const MAX_BACKUPS = 3;

function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

function sha256Hex(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}

function parseEnvelopeOrLegacy(raw: string): { revision: number; store: TimelineRegistryData; v2?: TimelineStoreV2Payload } | { error: string; code: 'json_invalid' | 'root_not_object' } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return { error: `invalid JSON: ${error}`, code: 'json_invalid' };
    }
    if (!isObject(parsed)) {
        return { error: 'root is not an object', code: 'root_not_object' };
    }
    const root = parsed as Record<string, unknown>;
    // Envelope shape: { revision, transactionId, store: { version, playerId, nodes } }
    if ('store' in root && isObject(root.store)) {
        if (!('revision' in root) || typeof root.revision !== 'number' || !Number.isFinite(root.revision) || root.revision < 0) {
            return { error: 'envelope missing or invalid revision', code: 'json_invalid' };
        }
        const store = root.store as unknown;
        const result: { revision: number; store: TimelineRegistryData; v2?: TimelineStoreV2Payload } = {
            revision: root.revision as number,
            store: store as TimelineRegistryData
        };
        if ('nodes' in root && isObject(root.nodes)) {
            result.v2 = {
                nodes: root.nodes as Record<string, TimelineNodeV2>,
                transitions: Array.isArray(root.transitions) ? root.transitions as TransitionJournalEntry[] : []
            };
        }
        return result;
    }
    // Legacy v1 file: no envelope, revision is 0.
    return { revision: 0, store: parsed as TimelineRegistryData };
}

function serializeEnvelope(envelope: TimelineStoreEnvelope): string {
    const payload: Record<string, unknown> = {
        revision: envelope.revision,
        transactionId: envelope.transactionId,
        store: envelope.store
    };
    if (envelope.campaign !== undefined) {
        payload.campaign = envelope.campaign;
    }
    if (envelope.player !== undefined) {
        payload.player = envelope.player;
    }
    if (envelope.nodes !== undefined) {
        payload.nodes = envelope.nodes;
    }
    if (envelope.transitions !== undefined) {
        payload.transitions = envelope.transitions;
    }
    return JSON.stringify(payload, null, '\t');
}

function readIdentityHeader(envelope: unknown): {
    campaign?: TimelineStoreEnvelopeIdentity;
    player?: TimelineStoreEnvelopePlayer;
} {
    if (!isObject(envelope)) return {};
    const root = envelope as Record<string, unknown>;
    const result: { campaign?: TimelineStoreEnvelopeIdentity; player?: TimelineStoreEnvelopePlayer } = {};
    if (isObject(root.campaign)) {
        const c = root.campaign as Record<string, unknown>;
        if (typeof c.campaignId === 'string' && typeof c.campaignSchema === 'number' && typeof c.protocolSchema === 'number') {
            result.campaign = {
                campaignId: c.campaignId,
                campaignSchema: c.campaignSchema,
                protocolSchema: c.protocolSchema
            };
        }
    }
    if (isObject(root.player)) {
        const p = root.player as Record<string, unknown>;
        if (typeof p.playerId === 'string') {
            result.player = { playerId: p.playerId };
        }
    }
    return result;
}

export class FsTimelinePersistence implements TimelinePersistence {
    constructor(private userDataDir: string) {}

    private resolvePath(playerId: string): string {
        return registryPathForPlayer(this.userDataDir, playerId);
    }

    private resolveLegacyNestedPath(playerId: string): string {
        return path.join(this.userDataDir, 'votc_data', 'votc_data', 'timeline_registry', `player_${playerId}.json`);
    }

    private tmpPathFor(primaryPath: string): string {
        return `${primaryPath}.tmp`;
    }

    private swapManifestPathFor(primaryPath: string): string {
        return `${primaryPath}.swap.json`;
    }

    private backupPathFor(primaryPath: string, index: number): string {
        return `${primaryPath}.bak.${index}`;
    }

    loadRegistry(playerId: string): TimelineRegistry | null {
        const result = this.loadStore(playerId);
        return result.status === 'found' ? result.store : null;
    }

    loadStore(playerId: string): TimelineStoreLoadResult {
        const primaryPath = this.resolvePath(playerId);
        const legacyPath = this.resolveLegacyNestedPath(playerId);
        const tmpPath = this.tmpPathFor(primaryPath);
        const swapPath = this.swapManifestPathFor(primaryPath);

        const primaryExists = fs.existsSync(primaryPath);
        const tmpExists = fs.existsSync(tmpPath);
        const legacyExists = !primaryExists && fs.existsSync(legacyPath);
        const anyExisted = primaryExists || tmpExists || legacyExists || this.anyBackupExists(primaryPath);

        // Case 1: primary exists -> it is the only normal commit point.
        //   - If valid: use it, quarantine any orphan tmp.
        //   - If corrupt: remember for fallback; continue to tmp/backup recovery.
        let primaryCorrupt: TimelineStoreLoadResult | undefined;
        if (primaryExists) {
            const result = this.tryLoadPrimary(primaryPath, playerId);
            if (result.status === 'found') {
                // An orphan tmp (primary exists) is never auto-promoted. It is
                // a leftover from an uncommitted transaction; quarantine it so
                // it cannot be mistaken for a commit point later.
                this.quarantineOrphanTmp(tmpPath, swapPath);
                return result;
            }
            // result.status === 'corrupt': primary exists but is invalid.
            // Per recovery rules, "primary 缺失或无效时" we may try tmp/backup.
            primaryCorrupt = result;
        }

        // Case 2: primary missing OR primary corrupt -> try promotable-tmp.
        // Only legal when there is no valid primary to commit from.
        const promoted = this.tryPromoteTmp(primaryPath, tmpPath, swapPath, playerId);
        if (promoted.status === 'found') {
            return promoted;
        }
        // tmp promotion failed (or no tmp): fall through to legacy/backup.

        // Case 2b: legacy nested path migration (primary absent).
        if (!primaryExists && legacyExists) {
            const legacyResult = this.tryLoadPrimary(legacyPath, playerId);
            if (legacyResult.status === 'found') {
                return legacyResult;
            }
            if (legacyResult.status === 'corrupt') {
                primaryCorrupt = primaryCorrupt ?? legacyResult;
            }
        }

        // Case 3: no usable primary/tmp -> try newest valid backup.
        const backupResult = this.tryLoadNewestBackup(primaryPath, playerId);
        if (backupResult.status === 'found') {
            return backupResult;
        }

        // Case 4: nothing worked. If primary was corrupt, surface that.
        // Otherwise, if something existed on disk, surface corrupt so writes
        // are blocked rather than silently starting fresh. Only return missing
        // when no file ever existed for this player.
        if (primaryCorrupt) {
            return primaryCorrupt;
        }
        if (anyExisted) {
            const existingPath = primaryExists ? primaryPath : (legacyExists ? legacyPath : tmpPath);
            return this.corruptResult(existingPath, 'no recoverable primary/tmp/backup', undefined, [
                new RegistryValidationError('registry_build_failed', 'no recoverable primary/tmp/backup', { path: existingPath })
            ]);
        }
        return { status: 'missing' };
    }

    private tryLoadPrimary(filePath: string, playerId: string): TimelineStoreLoadResult {
        let raw: string;
        try {
            raw = fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            return this.corruptResult(filePath, `unreadable: ${error}`, undefined, [
                new RegistryValidationError('file_unreadable', `unreadable file: ${error}`, { path: filePath })
            ]);
        }

        const parsed = parseEnvelopeOrLegacy(raw);
        if ('error' in parsed) {
            return this.corruptResult(filePath, parsed.error, raw, [
                new RegistryValidationError(parsed.code, parsed.error, { path: filePath })
            ]);
        }

        const errors = validateV1RegistryData(parsed.store);
        if (errors.length > 0) {
            return this.corruptResult(filePath, summarizeRegistryErrors(errors), raw, errors);
        }

        try {
            const registry = new TimelineRegistry(playerId, parsed.store, parsed.revision);
            return { status: 'found', store: registry, source: 'primary', revision: parsed.revision };
        } catch (error) {
            const loadErrors = [
                new RegistryValidationError('registry_build_failed', `load failed: ${error}`, { path: filePath })
            ];
            return this.corruptResult(filePath, `load failed: ${error}`, raw, loadErrors);
        }
    }

    /**
     * Attempt to promote a `.tmp` to primary. Only allowed when:
     * - primary is missing or invalid (caller's responsibility),
     * - a swap manifest exists at `<primary>.swap.json` (tmp was validated pre-rename),
     * - the manifest's revision is continuous with the prior primary's revision
     *   (manifest.revision === lastKnownRevision + 1, or 1 if no prior revision),
     * - the manifest's transactionId matches the tmp envelope's transactionId,
     * - the tmp re-validates with the full validator.
     * Returns `found` with `source: 'promotable-tmp'` on success.
     * Returns `missing` on any failure (so the caller can try backup next).
     * Side effect: quarantines the tmp + manifest on any failure.
     */
    private tryPromoteTmp(primaryPath: string, tmpPath: string, swapPath: string, playerId: string): TimelineStoreLoadResult {
        if (!fs.existsSync(tmpPath)) {
            return { status: 'missing' };
        }

        let manifest: TimelineSwapManifest | undefined;
        try {
            const manifestRaw = fs.readFileSync(swapPath, 'utf8');
            const parsed = JSON.parse(manifestRaw) as TimelineSwapManifest;
            if (parsed && typeof parsed.transactionId === 'string' && typeof parsed.revision === 'number'
                && typeof parsed.sourcePath === 'string' && typeof parsed.targetPath === 'string'
                && typeof parsed.sha256 === 'string' && typeof parsed.createdAt === 'string') {
                manifest = parsed;
            }
        } catch {
            // No manifest or manifest unreadable: cannot promote.
        }

        if (!manifest) {
            // Tmp exists without manifest -> not yet validated; quarantine it.
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        // source/target paths in the manifest must match this primary path.
        if (manifest.targetPath !== primaryPath || manifest.sourcePath !== tmpPath) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        // Read and fully validate the tmp as if it were primary.
        let tmpRaw: string;
        try {
            tmpRaw = fs.readFileSync(tmpPath, 'utf8');
        } catch {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        // SHA-256 must match the manifest (defends against partial tmp after manifest write).
        if (sha256Hex(tmpRaw) !== manifest.sha256) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        const parsed = parseEnvelopeOrLegacy(tmpRaw);
        if ('error' in parsed) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        if (parsed.revision !== manifest.revision) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        const errors = validateV1RegistryData(parsed.store);
        if (errors.length > 0) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        // transactionId in the envelope must match the manifest.
        const envelope = JSON.parse(tmpRaw) as { transactionId?: unknown };
        if (typeof envelope.transactionId !== 'string' || envelope.transactionId !== manifest.transactionId) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        // Revision continuity: the tmp's revision must be strictly greater than
        // the last known good primary revision. We read the last backup's
        // revision (if any) as the baseline; if no backup exists, tmp.revision
        // must be >= 1 (a real envelope revision, never 0 for a fresh envelope write).
        const baselineRevision = this.readNewestBackupRevision(primaryPath);
        if (parsed.revision <= baselineRevision) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        // All checks passed: promote tmp to primary.
        try {
            fs.renameSync(tmpPath, primaryPath);
        } catch {
            return { status: 'missing' };
        }
        // Clean up the swap manifest - the tmp is now the primary.
        try {
            fs.unlinkSync(swapPath);
        } catch {
            // Best effort; stale manifest is harmless after a successful rename.
        }

        try {
            const registry = new TimelineRegistry(playerId, parsed.store, parsed.revision);
            return { status: 'found', store: registry, source: 'promotable-tmp', revision: parsed.revision };
        } catch {
            return { status: 'missing' };
        }
    }

    private readNewestBackupRevision(primaryPath: string): number {
        // Scan all MAX_BACKUPS entries and return the highest parseable revision.
        // Returning the first parseable revision would let a stale tmp slip past
        // continuity checks if .bak.1 is corrupted but a lower-revision .bak.2
        // parses (the tmp's revision could be <= the corrupted .bak.1's revision).
        let maxRevision = 0;
        for (let i = 1; i <= MAX_BACKUPS; i++) {
            const bakPath = this.backupPathFor(primaryPath, i);
            if (!fs.existsSync(bakPath)) continue;
            try {
                const raw = fs.readFileSync(bakPath, 'utf8');
                const parsed = parseEnvelopeOrLegacy(raw);
                if (!('error' in parsed) && parsed.revision > maxRevision) {
                    maxRevision = parsed.revision;
                }
            } catch {
                // ignore unreadable backups
            }
        }
        return maxRevision;
    }

    private tryLoadNewestBackup(primaryPath: string, playerId: string): TimelineStoreLoadResult {
        for (let i = 1; i <= MAX_BACKUPS; i++) {
            const bakPath = this.backupPathFor(primaryPath, i);
            if (!fs.existsSync(bakPath)) continue;
            let raw: string;
            try {
                raw = fs.readFileSync(bakPath, 'utf8');
            } catch (error) {
                continue;
            }
            const parsed = parseEnvelopeOrLegacy(raw);
            if ('error' in parsed) continue;
            const errors = validateV1RegistryData(parsed.store);
            if (errors.length > 0) continue;
            try {
                const registry = new TimelineRegistry(playerId, parsed.store, parsed.revision);
                return { status: 'found', store: registry, source: 'backup', revision: parsed.revision };
            } catch {
                continue;
            }
        }
        return { status: 'missing' };
    }

    private anyBackupExists(primaryPath: string): boolean {
        for (let i = 1; i <= MAX_BACKUPS; i++) {
            if (fs.existsSync(this.backupPathFor(primaryPath, i))) return true;
        }
        return false;
    }

    private quarantineOrphanTmp(tmpPath: string, swapPath: string): void {
        if (fs.existsSync(tmpPath)) {
            const quarantineDir = path.join(path.dirname(tmpPath), 'quarantine');
            try {
                fs.mkdirSync(quarantineDir, { recursive: true });
                const base = path.basename(tmpPath, '.json.tmp') + '.orphan-tmp';
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                let dest = path.join(quarantineDir, `${base}.${timestamp}.json`);
                let suffix = 0;
                while (fs.existsSync(dest)) {
                    suffix++;
                    dest = path.join(quarantineDir, `${base}.${timestamp}.${suffix}.json`);
                }
                fs.copyFileSync(tmpPath, dest);
                console.warn(`[timelineManager] Quarantined orphan tmp ${tmpPath} -> ${dest}`);
            } catch (error) {
                console.warn(`[timelineManager] Failed to quarantine orphan tmp ${tmpPath}: ${error}`);
            }
            try {
                fs.unlinkSync(tmpPath);
            } catch {
                // best effort
            }
        }
        if (fs.existsSync(swapPath)) {
            try {
                fs.unlinkSync(swapPath);
            } catch {
                // best effort
            }
        }
    }

    private corruptResult(
        filePath: string,
        detail: string,
        raw: string | undefined,
        errors: RegistryValidationError[] = []
    ): TimelineStoreLoadResult {
        console.error(`[timelineManager] Corrupt timeline registry at ${filePath}: ${detail}. Timeline writes are blocked until the file is restored or removed.`);
        const quarantinePath = this.quarantineCorruptFile(filePath, raw);
        return { status: 'corrupt', filePath, errors, quarantinePath };
    }

    private quarantineCorruptFile(filePath: string, raw: string | undefined): string | undefined {
        try {
            const quarantineDir = path.join(path.dirname(filePath), 'quarantine');
            fs.mkdirSync(quarantineDir, { recursive: true });
            const base = path.basename(filePath, '.json');
            let content: string;
            if (raw !== undefined) {
                content = raw;
            } else if (fs.existsSync(filePath)) {
                content = fs.readFileSync(filePath, 'utf8');
            } else {
                // File was already removed (e.g. by orphan-tmp quarantine). Nothing
                // to copy; return undefined so the caller reports no quarantine copy.
                return undefined;
            }
            for (const entry of fs.readdirSync(quarantineDir)) {
                if (!entry.startsWith(`${base}.corrupt.`) || !entry.endsWith('.json')) continue;
                const candidate = path.join(quarantineDir, entry);
                try {
                    if (fs.readFileSync(candidate, 'utf8') === content) {
                        return candidate;
                    }
                } catch {
                }
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let dest = path.join(quarantineDir, `${base}.corrupt.${timestamp}.json`);
            let suffix = 0;
            while (fs.existsSync(dest)) {
                suffix++;
                dest = path.join(quarantineDir, `${base}.corrupt.${timestamp}.${suffix}.json`);
            }
            // The file may not exist at filePath if it was already quarantined
            // (e.g. an orphan tmp). Write the captured content directly.
            fs.writeFileSync(dest, content, 'utf8');
            console.log(`[timelineManager] Quarantined corrupt registry copy at ${dest}`);
            return dest;
        } catch (error) {
            console.warn(`[timelineManager] Failed to quarantine corrupt registry ${filePath}: ${error}`);
            return undefined;
        }
    }

    saveRegistry(registry: TimelineRegistry): void {
        if (!registry.isDirty()) return;
        const primaryPath = this.resolvePath(registry.playerId);

        // §4.2 invariant: "App 不允许用 player-only 路径创建任何新 timeline 记录".
        // Phase 4 activated the campaign-scoped path (saveStoreWithIdentity) as
        // the production write target for new timeline records. This legacy
        // `saveRegistry` path MUST NOT create new timeline records; it may only
        // repair/rewrite existing player-only files. New code MUST NOT add new
        // `saveRegistry` call sites; use `saveStoreWithIdentity` with a captured
        // `CampaignPlayerIdentity`. Callers that still use saveRegistry must
        // guard against creating new files (e.g., archive readopt in Phase 7).
        if (!fs.existsSync(primaryPath)) {
            throw new Error(
                `timelineManager: §4.2 invariant violated - refusing to create a new player-only registry at ${primaryPath}. ` +
                'Use saveStoreWithIdentity with a captured CampaignPlayerIdentity.'
            );
        }

        const dir = path.dirname(primaryPath);
        fs.mkdirSync(dir, { recursive: true });

        const nextRevision = registry.getRevision() + 1;
        const transactionId = randomUUID();
        const snapshot = registry.snapshot();
        const envelope: TimelineStoreEnvelope = {
            revision: nextRevision,
            transactionId,
            store: snapshot
        };
        const payload = serializeEnvelope(envelope);

        const tmpPath = this.tmpPathFor(primaryPath);
        const swapPath = this.swapManifestPathFor(primaryPath);

        // Step 1: validate the snapshot before touching disk.
        const validationErrors = validateV1RegistryData(snapshot);
        if (validationErrors.length > 0) {
            const detail = summarizeRegistryErrors(validationErrors);
            console.error(`[timelineManager] Refusing to write registry that fails validation: ${detail}`);
            throw new Error(`timelineManager: refusing to write registry that fails validation: ${detail}`);
        }

        // Step 2: write the tmp (full payload, single file).
        fs.writeFileSync(tmpPath, payload, 'utf8');

        // Step 3: re-read the tmp, re-validate, and verify SHA-256 for the swap manifest.
        const tmpRaw = fs.readFileSync(tmpPath, 'utf8');
        const reparsed = parseEnvelopeOrLegacy(tmpRaw);
        if ('error' in reparsed) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            throw new Error(`timelineManager: tmp failed to re-parse after write: ${reparsed.error}`);
        }
        const revalidateErrors = validateV1RegistryData(reparsed.store);
        if (revalidateErrors.length > 0) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            throw new Error(`timelineManager: tmp failed re-validation: ${summarizeRegistryErrors(revalidateErrors)}`);
        }
        if (reparsed.revision !== nextRevision) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            throw new Error(`timelineManager: tmp revision mismatch after write (expected ${nextRevision}, got ${reparsed.revision})`);
        }

        // Step 4: write the swap manifest. Its presence after a crash signals
        // that the tmp has been validated and is ready for rename.
        const manifest: TimelineSwapManifest = {
            transactionId,
            revision: nextRevision,
            sourcePath: tmpPath,
            targetPath: primaryPath,
            sha256: sha256Hex(tmpRaw),
            createdAt: new Date().toISOString()
        };
        fs.writeFileSync(swapPath, JSON.stringify(manifest, null, '\t'), 'utf8');

        // Step 5: rotate backups (primary -> .bak.1, .bak.1 -> .bak.2, ...).
        this.rotateBackups(primaryPath);

        // Step 6: rename tmp -> primary (atomic on most filesystems).
        fs.renameSync(tmpPath, primaryPath);

        // Step 7: re-validate the new primary, then commit (delete swap manifest).
        const committedRaw = fs.readFileSync(primaryPath, 'utf8');
        const committed = parseEnvelopeOrLegacy(committedRaw);
        if ('error' in committed) {
            // Primary is corrupt after rename: keep the swap manifest for diagnosis.
            // The most recent backup is still intact from rotation. Throw the typed
            // error so existing error-handling paths (reportCorruptTimelineRegistry)
            // apply, with the captured raw content for quarantine.
            throw new TimelineRegistryCorruptError(
                primaryPath,
                `primary failed to re-parse after rename: ${committed.error}`,
                undefined,
                [new RegistryValidationError(committed.code, committed.error, { path: primaryPath })]
            );
        }
        const committedErrors = validateV1RegistryData(committed.store);
        if (committedErrors.length > 0) {
            throw new TimelineRegistryCorruptError(
                primaryPath,
                `primary failed re-validation after rename: ${summarizeRegistryErrors(committedErrors)}`,
                undefined,
                committedErrors
            );
        }

        // Commit: delete the swap manifest, advance the in-memory revision, mark clean.
        try {
            fs.unlinkSync(swapPath);
        } catch {
            // best effort
        }
        registry.setRevision(nextRevision);
        registry.markClean();
    }

    private rotateBackups(primaryPath: string): void {
        // Roll existing backups outward (.bak.2 -> .bak.3, .bak.1 -> .bak.2)
        // before writing the new .bak.1. If primary doesn't exist yet, there's
        // nothing to rotate (first write for this player).
        if (!fs.existsSync(primaryPath)) return;

        // Walk from the highest index down so we don't overwrite an existing
        // .bak.N+1 with .bak.N before the latter is moved.
        for (let i = MAX_BACKUPS; i >= 2; i--) {
            const src = this.backupPathFor(primaryPath, i - 1);
            const dst = this.backupPathFor(primaryPath, i);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dst);
            }
        }

        // .bak.1 is a copy of the pre-write primary (primary itself is about
        // to be overwritten by the rename).
        fs.copyFileSync(primaryPath, this.backupPathFor(primaryPath, 1));
    }

    private migrationMarkerPath(playerId: string): string {
        return path.join(this.userDataDir, 'votc_data', 'timeline_registry', `player_${playerId}.migrated`);
    }

    private createFirstMigrationBackup(playerId: string): void {
        const marker = this.migrationMarkerPath(playerId);
        if (fs.existsSync(marker)) {
            return;
        }
        const votcDataDir = path.join(this.userDataDir, 'votc_data');
        const backupDir = path.join(votcDataDir, 'timeline_registry', 'pre_migration_backup', `player_${playerId}_${Date.now()}`);
        const dirsToBackup = ['conversation_summaries', 'letter_history', 'battle_report_history'];
        let backedUp = false;
        for (const sub of dirsToBackup) {
            const srcDir = path.join(votcDataDir, sub);
            if (!fs.existsSync(srcDir)) continue;
            // Only back up the player-specific subfolder where applicable.
            const playerSubDirs = [
                path.join(srcDir, playerId),
                path.join(srcDir, `player_${playerId}.json`),
                path.join(srcDir, `player_${playerId}`)
            ];
            for (const candidate of playerSubDirs) {
                if (fs.existsSync(candidate)) {
                    const rel = path.relative(votcDataDir, candidate);
                    const dest = path.join(backupDir, rel);
                    fs.mkdirSync(path.dirname(dest), { recursive: true });
                    const stat = fs.statSync(candidate);
                    if (stat.isDirectory()) {
                        this.copyDirRecursive(candidate, dest);
                    } else {
                        fs.copyFileSync(candidate, dest);
                    }
                    backedUp = true;
                }
            }
        }
        if (backedUp) {
            fs.mkdirSync(path.dirname(marker), { recursive: true });
            fs.writeFileSync(marker, new Date().toISOString(), 'utf8');
            console.log(`[timelineManager] Created pre-migration backup for player ${playerId} at ${backupDir}`);
        }
    }

    private copyDirRecursive(src: string, dest: string): void {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                this.copyDirRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Phase 4: campaign/player identity-aware load and save.
    //
    // These methods write to and read from the campaign-scoped path
    // `votc_data/campaigns/<campaignId>/players/<playerId>/timeline_registry.json`
    // and stamp the envelope with the real `campaign`/`player` identity header.
    //
    // The legacy `loadStore(playerId)` / `saveRegistry(registry)` paths remain
    // for backward compatibility until Phase 5 fully switches the production
    // writers (Conversation, LetterReply, IncomingLetter, BattleReport) over.
    // §4.2 invariant "App 不允许用 player-only 路径创建新 timeline 记录" is
    // satisfied because the legacy `saveRegistry` path is no longer the path
    // used to *create* new timeline records once a campaign identity is
    // available; callers with an identity use `saveStoreWithIdentity`.
    // ───────────────────────────────────────────────────────────────────────

    loadStoreWithIdentity(identity: CampaignPlayerIdentity): TimelineStoreLoadResult {
        if (!isCampaignPlayerIdentity(identity)) {
            return this.corruptResult(
                campaignRegistryPath(this.userDataDir, identity),
                'invalid campaign/player identity passed to loadStoreWithIdentity',
                undefined,
                [new RegistryValidationError('campaign_identity_invalid', 'invalid CampaignPlayerIdentity', {})]
            );
        }
        return this.loadStoreAtIdentityPath(identity);
    }

    private loadStoreAtIdentityPath(identity: CampaignPlayerIdentity): TimelineStoreLoadResult {
        const primaryPath = campaignRegistryPath(this.userDataDir, identity);
        const tmpPath = campaignRegistryTmpPath(this.userDataDir, identity);
        const swapPath = campaignRegistrySwapPath(this.userDataDir, identity);

        const primaryExists = fs.existsSync(primaryPath);
        const tmpExists = fs.existsSync(tmpPath);
        const anyExisted = primaryExists || tmpExists || this.anyBackupExists(primaryPath);

        let primaryCorrupt: TimelineStoreLoadResult | undefined;
        if (primaryExists) {
            const result = this.tryLoadPrimaryWithIdentity(primaryPath, identity);
            if (result.status === 'found') {
                this.quarantineOrphanTmp(tmpPath, swapPath);
                return result;
            }
            primaryCorrupt = result;
        }

        const promoted = this.tryPromoteTmpWithIdentity(primaryPath, tmpPath, swapPath, identity);
        if (promoted.status === 'found') {
            return promoted;
        }

        const backupResult = this.tryLoadNewestBackupWithIdentity(primaryPath, identity);
        if (backupResult.status === 'found') {
            return backupResult;
        }

        if (primaryCorrupt) {
            return primaryCorrupt;
        }
        if (anyExisted) {
            const existingPath = primaryExists ? primaryPath : tmpPath;
            return this.corruptResult(existingPath, 'no recoverable primary/tmp/backup', undefined, [
                new RegistryValidationError('registry_build_failed', 'no recoverable primary/tmp/backup', { path: existingPath })
            ]);
        }
        return { status: 'missing' };
    }

    /**
     * Validate the Phase 5 v2 fields (nodes + transitions) of a parsed
     * envelope. Returns an array of RegistryValidationError (wrapped from
     * JournalValidationError) so the existing corrupt-result path can surface
     * them uniformly. Returns an empty array when v2 fields are absent (a
     * v1-only envelope is still valid).
     */
    private validateV2Payload(v2: TimelineStoreV2Payload | undefined): RegistryValidationError[] {
        if (v2 === undefined) return [];
        const errors: RegistryValidationError[] = [];
        for (const [id, node] of Object.entries(v2.nodes ?? {})) {
            const nodeErrors = validateNodeV2(node, id);
            for (const e of nodeErrors) {
                errors.push(new RegistryValidationError(
                    e.code as RegistryValidationErrorCode,
                    e.message,
                    { nodeId: e.nodeId, path: e.path }
                ));
            }
        }
        for (const entry of v2.transitions ?? []) {
            const entryErrors = validateJournalEntry(entry);
            for (const e of entryErrors) {
                errors.push(new RegistryValidationError(
                    e.code as RegistryValidationErrorCode,
                    e.message,
                    { nodeId: e.attemptId, path: e.path }
                ));
            }
        }
        const consistencyErrors = validateJournalConsistency(v2.transitions ?? [], v2.nodes ?? {});
        for (const e of consistencyErrors) {
            errors.push(new RegistryValidationError(
                e.code as RegistryValidationErrorCode,
                e.message,
                { nodeId: e.attemptId ?? e.nodeId, path: e.path }
            ));
        }
        return errors;
    }

    private tryLoadPrimaryWithIdentity(filePath: string, identity: CampaignPlayerIdentity): TimelineStoreLoadResult {
        let raw: string;
        try {
            raw = fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            return this.corruptResult(filePath, `unreadable: ${error}`, undefined, [
                new RegistryValidationError('file_unreadable', `unreadable file: ${error}`, { path: filePath })
            ]);
        }

        const parsed = parseEnvelopeOrLegacy(raw);
        if ('error' in parsed) {
            return this.corruptResult(filePath, parsed.error, raw, [
                new RegistryValidationError(parsed.code, parsed.error, { path: filePath })
            ]);
        }

        const errors = validateV1RegistryData(parsed.store, { campaignIdentity: identity });
        if (errors.length > 0) {
            return this.corruptResult(filePath, summarizeRegistryErrors(errors), raw, errors);
        }

        // Phase 5: validate the v2 fields (nodes/transitions) if present.
        const v2Errors = this.validateV2Payload(parsed.v2);
        if (v2Errors.length > 0) {
            return this.corruptResult(filePath, summarizeRegistryErrors(v2Errors), raw, v2Errors);
        }

        // Identity header (if present on disk) must match the requested identity.
        const header = readIdentityHeader(JSON.parse(raw));
        if (header.campaign && header.campaign.campaignId !== identity.campaignId) {
            return this.corruptResult(
                filePath,
                `envelope campaign "${header.campaign.campaignId}" does not match requested "${identity.campaignId}"`,
                raw,
                [new RegistryValidationError('identity_mismatch', 'campaignId mismatch', { path: 'campaign' })]
            );
        }
        if (header.player && header.player.playerId !== identity.playerId) {
            return this.corruptResult(
                filePath,
                `envelope player "${header.player.playerId}" does not match requested "${identity.playerId}"`,
                raw,
                [new RegistryValidationError('identity_mismatch', 'playerId mismatch', { path: 'player' })]
            );
        }

        try {
            const registry = new TimelineRegistry(
                identity.playerId,
                projectV2NodesIntoRegistryData(parsed.store, parsed.v2),
                parsed.revision,
                buildV2VisibilityGraph(parsed.store, parsed.v2)
            );
            return { status: 'found', store: registry, source: 'primary', revision: parsed.revision, v2: parsed.v2 };
        } catch (error) {
            const loadErrors = [
                new RegistryValidationError('registry_build_failed', `load failed: ${error}`, { path: filePath })
            ];
            return this.corruptResult(filePath, `load failed: ${error}`, raw, loadErrors);
        }
    }

    private tryPromoteTmpWithIdentity(
        primaryPath: string,
        tmpPath: string,
        swapPath: string,
        identity: CampaignPlayerIdentity
    ): TimelineStoreLoadResult {
        if (!fs.existsSync(tmpPath)) {
            return { status: 'missing' };
        }

        let manifest: TimelineSwapManifest | undefined;
        try {
            const manifestRaw = fs.readFileSync(swapPath, 'utf8');
            const parsed = JSON.parse(manifestRaw) as TimelineSwapManifest;
            if (parsed && typeof parsed.transactionId === 'string' && typeof parsed.revision === 'number'
                && typeof parsed.sourcePath === 'string' && typeof parsed.targetPath === 'string'
                && typeof parsed.sha256 === 'string' && typeof parsed.createdAt === 'string') {
                manifest = parsed;
            }
        } catch {
            // No manifest or manifest unreadable: cannot promote.
        }

        if (!manifest) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        if (manifest.targetPath !== primaryPath || manifest.sourcePath !== tmpPath) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        let tmpRaw: string;
        try {
            tmpRaw = fs.readFileSync(tmpPath, 'utf8');
        } catch {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        if (sha256Hex(tmpRaw) !== manifest.sha256) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        const parsed = parseEnvelopeOrLegacy(tmpRaw);
        if ('error' in parsed) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        if (parsed.revision !== manifest.revision) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        const errors = validateV1RegistryData(parsed.store, { campaignIdentity: identity });
        if (errors.length > 0) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        // Phase 5: validate v2 fields too when promoting a tmp.
        const v2Errors = this.validateV2Payload(parsed.v2);
        if (v2Errors.length > 0) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        const envelope = JSON.parse(tmpRaw) as { transactionId?: unknown };
        if (typeof envelope.transactionId !== 'string' || envelope.transactionId !== manifest.transactionId) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        const baselineRevision = this.readNewestBackupRevision(primaryPath);
        if (parsed.revision <= baselineRevision) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            return { status: 'missing' };
        }

        try {
            fs.renameSync(tmpPath, primaryPath);
        } catch {
            return { status: 'missing' };
        }
        try {
            fs.unlinkSync(swapPath);
        } catch {
            // best effort
        }

        try {
            const registry = new TimelineRegistry(
                identity.playerId,
                projectV2NodesIntoRegistryData(parsed.store, parsed.v2),
                parsed.revision,
                buildV2VisibilityGraph(parsed.store, parsed.v2)
            );
            return { status: 'found', store: registry, source: 'promotable-tmp', revision: parsed.revision, v2: parsed.v2 };
        } catch {
            return { status: 'missing' };
        }
    }

    private tryLoadNewestBackupWithIdentity(primaryPath: string, identity: CampaignPlayerIdentity): TimelineStoreLoadResult {
        for (let i = 1; i <= MAX_BACKUPS; i++) {
            const bakPath = campaignRegistryBackupPathOf(this.userDataDir, identity, i);
            if (!fs.existsSync(bakPath)) continue;
            let raw: string;
            try {
                raw = fs.readFileSync(bakPath, 'utf8');
            } catch {
                continue;
            }
            const parsed = parseEnvelopeOrLegacy(raw);
            if ('error' in parsed) continue;
            const errors = validateV1RegistryData(parsed.store, { campaignIdentity: identity });
            if (errors.length > 0) continue;
            // Phase 5: validate v2 fields too when loading from a backup.
            const v2Errors = this.validateV2Payload(parsed.v2);
            if (v2Errors.length > 0) continue;
            try {
                const registry = new TimelineRegistry(
                    identity.playerId,
                    projectV2NodesIntoRegistryData(parsed.store, parsed.v2),
                    parsed.revision,
                    buildV2VisibilityGraph(parsed.store, parsed.v2)
                );
                return { status: 'found', store: registry, source: 'backup', revision: parsed.revision, v2: parsed.v2 };
            } catch {
                continue;
            }
        }
        return { status: 'missing' };
    }

    /**
     * Save a timeline store at the campaign-scoped path. Validates the store
     * against the expected identity before touching disk, writes a `.tmp`,
     * a swap manifest, rotates backups, and atomically renames to primary.
     * The resulting envelope stamps both `campaign` and `player` identity
     * headers so a later load can verify the match.
     */
    saveStoreWithIdentity(identity: CampaignPlayerIdentity, registry: TimelineRegistry, v2?: TimelineStoreV2Payload): void {
        if (!isCampaignPlayerIdentity(identity)) {
            throw new Error('timelineManager: saveStoreWithIdentity requires a valid CampaignPlayerIdentity');
        }
        if (registry.playerId !== identity.playerId) {
            throw new Error(
                `timelineManager: registry playerId "${registry.playerId}" does not match identity playerId "${identity.playerId}"`
            );
        }
        if (!registry.isDirty() && v2 === undefined) return;

        const primaryPath = campaignRegistryPath(this.userDataDir, identity);
        const dir = path.dirname(primaryPath);
        fs.mkdirSync(dir, { recursive: true });

        const nextRevision = registry.getRevision() + 1;
        const transactionId = randomUUID();
        const snapshot = registry.snapshot();
        const envelope: TimelineStoreEnvelope = {
            revision: nextRevision,
            transactionId,
            store: snapshot,
            campaign: {
                campaignId: identity.campaignId,
                campaignSchema: identity.campaignSchema,
                protocolSchema: identity.protocolSchema
            },
            player: { playerId: identity.playerId }
        };
        if (v2 !== undefined) {
            envelope.nodes = v2.nodes;
            envelope.transitions = v2.transitions;
        }

        const validationErrors = validateV1RegistryData(snapshot, { campaignIdentity: identity });
        if (validationErrors.length > 0) {
            const detail = summarizeRegistryErrors(validationErrors);
            console.error(`[timelineManager] Refusing to write campaign store that fails validation: ${detail}`);
            throw new Error(`timelineManager: refusing to write campaign store that fails validation: ${detail}`);
        }

        // Phase 5: validate the v2 payload before touching disk (fail-closed).
        const v2Errors = this.validateV2Payload(v2);
        if (v2Errors.length > 0) {
            const detail = summarizeRegistryErrors(v2Errors);
            console.error(`[timelineManager] Refusing to write v2 store that fails validation: ${detail}`);
            throw new Error(`timelineManager: refusing to write v2 store that fails validation: ${detail}`);
        }

        const payload = serializeEnvelope(envelope);
        const tmpPath = campaignRegistryTmpPath(this.userDataDir, identity);
        const swapPath = campaignRegistrySwapPath(this.userDataDir, identity);

        fs.writeFileSync(tmpPath, payload, 'utf8');

        const tmpRaw = fs.readFileSync(tmpPath, 'utf8');
        const reparsed = parseEnvelopeOrLegacy(tmpRaw);
        if ('error' in reparsed) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            throw new Error(`timelineManager: campaign tmp failed to re-parse after write: ${reparsed.error}`);
        }
        const revalidateErrors = validateV1RegistryData(reparsed.store, { campaignIdentity: identity });
        if (revalidateErrors.length > 0) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            throw new Error(`timelineManager: campaign tmp failed re-validation: ${summarizeRegistryErrors(revalidateErrors)}`);
        }
        const revalidateV2Errors = this.validateV2Payload(reparsed.v2);
        if (revalidateV2Errors.length > 0) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            throw new Error(`timelineManager: campaign tmp failed v2 re-validation: ${summarizeRegistryErrors(revalidateV2Errors)}`);
        }
        if (reparsed.revision !== nextRevision) {
            this.quarantineOrphanTmp(tmpPath, swapPath);
            throw new Error(`timelineManager: campaign tmp revision mismatch after write (expected ${nextRevision}, got ${reparsed.revision})`);
        }

        const manifest: TimelineSwapManifest = {
            transactionId,
            revision: nextRevision,
            sourcePath: tmpPath,
            targetPath: primaryPath,
            sha256: sha256Hex(tmpRaw),
            createdAt: new Date().toISOString()
        };
        fs.writeFileSync(swapPath, JSON.stringify(manifest, null, '\t'), 'utf8');

        this.rotateBackups(primaryPath);

        fs.renameSync(tmpPath, primaryPath);

        const committedRaw = fs.readFileSync(primaryPath, 'utf8');
        const committed = parseEnvelopeOrLegacy(committedRaw);
        if ('error' in committed) {
            throw new TimelineRegistryCorruptError(
                primaryPath,
                `campaign primary failed to re-parse after rename: ${committed.error}`,
                undefined,
                [new RegistryValidationError(committed.code, committed.error, { path: primaryPath })]
            );
        }
        const committedErrors = validateV1RegistryData(committed.store, { campaignIdentity: identity });
        if (committedErrors.length > 0) {
            throw new TimelineRegistryCorruptError(
                primaryPath,
                `campaign primary failed re-validation after rename: ${summarizeRegistryErrors(committedErrors)}`,
                undefined,
                committedErrors
            );
        }
        const committedV2Errors = this.validateV2Payload(committed.v2);
        if (committedV2Errors.length > 0) {
            throw new TimelineRegistryCorruptError(
                primaryPath,
                `campaign primary failed v2 re-validation after rename: ${summarizeRegistryErrors(committedV2Errors)}`,
                undefined,
                committedV2Errors
            );
        }

        try {
            fs.unlinkSync(swapPath);
        } catch {
            // best effort
        }
        registry.setRevision(nextRevision);
        registry.markClean();
    }
}

export interface TimelineInitSnapshot {
    nodeId?: string;
    parentId?: string;
    epoch?: number;
    schema?: number;
    isLegacy: boolean;
}

export function parseTimelineInit(
    nodeA?: string,
    nodeB?: string,
    parentA?: string,
    parentB?: string,
    epoch?: number
): TimelineInitSnapshot {
    const nodeA_num = nodeA !== undefined ? Number(nodeA) : NaN;
    const nodeB_num = nodeB !== undefined ? Number(nodeB) : NaN;
    const parentA_num = parentA !== undefined ? Number(parentA) : NaN;
    const parentB_num = parentB !== undefined ? Number(parentB) : NaN;

    // CK3 persists zeroes for uninitialized node/parent variables. They are
    // sentinels, never timeline node IDs.
    const hasNode = Number.isFinite(nodeA_num) && Number.isFinite(nodeB_num) && nodeA_num > 0 && nodeB_num > 0;
    const hasParent = Number.isFinite(parentA_num) && Number.isFinite(parentB_num) && parentA_num > 0 && parentB_num > 0;

    if (!hasNode) {
        return { epoch, isLegacy: true };
    }

    const nodeId = `${nodeA_num}-${nodeB_num}`;
    if (!isValidNodeId(nodeId)) {
        return { epoch, isLegacy: true };
    }

    const parentId = hasParent ? `${parentA_num}-${parentB_num}` : undefined;
    if (parentId !== undefined && !isValidNodeId(parentId)) {
        return { epoch, isLegacy: true };
    }

    return {
        nodeId,
        parentId,
        epoch,
        schema: SCHEMA_VERSION,
        isLegacy: false
    };
}

export function buildCheckpointSetEffect(
    nodeId: string,
    parentId: string | null,
    epoch: number | undefined,
    scopeVar: string,
    checkpointToken?: number
): string {
    const parsed = parseNodeId(nodeId);
    if (!parsed) {
        throw new Error(`timelineManager: invalid node id for set_variable effect: ${nodeId}`);
    }
    const parent = parentId ? parseNodeId(parentId) : null;
    const parentA = parent ? parent.a : 0;
    const parentB = parent ? parent.b : 0;

    // Most callers use a saved event target (`scope:...`).  Letter delivery
    // runs are executed later and must target their persisted global scope
    // instead (`global_var:...`), so preserve an explicit scope expression.
    const scopeExpression = scopeVar.startsWith('global_var:')
        ? scopeVar
        : `scope:${scopeVar}`;
    const lines: string[] = [
        `${scopeExpression} = {`
    ];
    if (epoch !== undefined) {
        lines.push(`    set_variable = { name = votc_checkpoint_epoch value = ${epoch} }`);
    }
    if (isValidCheckpointToken(checkpointToken)) {
        lines.push(`    set_variable = { name = votc_checkpoint_token value = ${checkpointToken} }`);
        lines.push(`    remove_variable ?= votc_checkpoint_pending_token`);
    }
    lines.push(`    set_variable = { name = votc_timeline_node_a value = ${parsed.a} }`);
    lines.push(`    set_variable = { name = votc_timeline_node_b value = ${parsed.b} }`);
    lines.push(`    set_variable = { name = votc_timeline_parent_a value = ${parentA} }`);
    lines.push(`    set_variable = { name = votc_timeline_parent_b value = ${parentB} }`);
    lines.push(`    set_variable = { name = votc_timeline_schema value = ${SCHEMA_VERSION} }`);
    lines.push(`    debug_log = "VOTC:CHECKPOINT/;/set/;/[GetPlayer.GetID]/;/${epoch ?? ''}/;/${parsed.a}/;/${parsed.b}/;/${parentA}/;/${parentB}"`);
    lines.push(`}`);
    return lines.join('\n');
}

export function isLegacyContext(ctx: TimelineContext | undefined): boolean {
    return !ctx || ctx.timelineNodeId === undefined || !isValidNodeId(ctx.timelineNodeId);
}

export function buildTimelineContextFromParts(
    playerId: string,
    nodeA?: number,
    nodeB?: number,
    parentA?: number,
    parentB?: number,
    checkpointEpoch?: number,
    checkpointToken?: number,
    pendingCheckpointToken?: number
): TimelineContext {
    const tokenContext = {
        checkpointToken: isValidCheckpointToken(checkpointToken) ? checkpointToken : undefined,
        pendingCheckpointToken: isValidCheckpointToken(pendingCheckpointToken) ? pendingCheckpointToken : undefined
    };
    if (nodeA === undefined || nodeB === undefined || nodeA <= 0 || nodeB <= 0) {
        return { playerId, checkpointEpoch, ...tokenContext };
    }
    const nodeId = `${nodeA}-${nodeB}`;
    if (!isValidNodeId(nodeId)) {
        return { playerId, checkpointEpoch, ...tokenContext };
    }
    const parentId = (parentA !== undefined && parentB !== undefined && parentA > 0 && parentB > 0)
        ? `${parentA}-${parentB}`
        : undefined;
    if (parentId !== undefined && !isValidNodeId(parentId)) {
        return { playerId, checkpointEpoch, ...tokenContext };
    }
    return {
        playerId,
        checkpointEpoch,
        ...tokenContext,
        timelineNodeId: nodeId,
        timelineParentId: parentId
    };
}

export function loadRegistryOrThrow(persistence: FsTimelinePersistence, playerId: string): TimelineRegistry {
    const result = persistence.loadStore(playerId);
    if (result.status === 'corrupt') {
        const detail = result.errors.length > 0
            ? summarizeRegistryErrors(result.errors)
            : `corrupt registry at ${result.filePath}`;
        throw new TimelineRegistryCorruptError(result.filePath, detail, result.quarantinePath, result.errors);
    }
    return result.status === 'found' ? result.store : new TimelineRegistry(playerId);
}

export function loadRegistryForContext(userDataDir: string, ctx: TimelineContext): TimelineRegistry {
    const persistence = new FsTimelinePersistence(userDataDir);
    return loadRegistryOrThrow(persistence, ctx.playerId);
}

export function isRecordVisibleForContext(
    registry: TimelineRegistry | undefined,
    currentNodeId: string | undefined,
    record: { votcTimelineNodeId?: string; votcCheckpointEpoch?: number },
    checkpointEpoch?: number
): boolean {
    const recordNodeId = record?.votcTimelineNodeId;
    if (recordNodeId !== undefined && recordNodeId !== null && recordNodeId !== '') {
        if (!registry || currentNodeId === undefined) {
            return false;
        }
        return registry.isRecordVisible(recordNodeId, currentNodeId)
            || registry.isV2RecordVisibleFromObservedContext(recordNodeId, currentNodeId, checkpointEpoch);
    }
    if (checkpointEpoch === undefined) {
        return true;
    }
    const recordEpoch = Number(record?.votcCheckpointEpoch);
    return !Number.isFinite(recordEpoch) || recordEpoch <= checkpointEpoch;
}

export function deriveLegacyRootContext(playerId: string, epoch?: number): TimelineContext {
    return { playerId, checkpointEpoch: epoch };
}

export interface GameDataLike {
    playerID: number;
    votcCheckpointEpoch: number;
    votcTimelineNodeA?: number;
    votcTimelineNodeB?: number;
    votcTimelineParentA?: number;
    votcTimelineParentB?: number;
    votcCheckpointToken?: number;
    votcPendingCheckpointToken?: number;
    timelineSnapshotResult?: TimelineParseResult;
}

export function buildContextFromSnapshot(
    playerId: string,
    snapshot: ObservedTimelineState,
    epochFallback?: number
): TimelineContext {
    return buildTimelineContextFromParts(
        playerId,
        snapshot.nodeA,
        snapshot.nodeB,
        snapshot.parentA,
        snapshot.parentB,
        snapshot.epoch ?? epochFallback,
        snapshot.checkpointToken,
        snapshot.pendingCheckpointToken
    );
}

export function buildContextFromGameData(gameData: GameDataLike): TimelineContext {
    const parsed = gameData.timelineSnapshotResult;
    if (parsed !== undefined) {
        if (parsed.status === 'unsupported-schema') {
            throw new UnsupportedTimelineSchemaError(parsed.schema);
        }
        if (parsed.status === 'valid' || parsed.status === 'legacy') {
            const ctx = buildContextFromSnapshot(String(gameData.playerID), parsed.snapshot, gameData.votcCheckpointEpoch);
            // §4.1: capture immutable identity at business-operation start. Only
            // a 'valid' v2 snapshot carries a campaign id; legacy snapshots have
            // no protocol tail and identity remains undefined so business entry
            // points can fail closed (§9) rather than silently use player-only.
            if (parsed.status === 'valid') {
                try {
                    const identity = buildIdentityFromSnapshot(parsed.snapshot, String(gameData.playerID));
                    (ctx as TimelineContext).identity = identity;
                } catch (error) {
                    // If the tail claims v2 but the campaign id is malformed, do
                    // not silently fall back; the business entry's fail-closed
                    // check will see identity === undefined and refuse to write.
                    console.warn(`[timelineManager] Snapshot reported v2 protocol but identity construction failed: ${error}`);
                }
            }
            return ctx;
        }
        console.warn(`[timelineManager] Timeline snapshot is ${parsed.status}; falling back to an epoch-only context.`);
        return { playerId: String(gameData.playerID), checkpointEpoch: gameData.votcCheckpointEpoch };
    }
    const baseContext: TimelineContext = {
        playerId: String(gameData.playerID),
        checkpointEpoch: gameData.votcCheckpointEpoch,
        checkpointToken: isValidCheckpointToken(gameData.votcCheckpointToken) ? gameData.votcCheckpointToken : undefined,
        pendingCheckpointToken: isValidCheckpointToken(gameData.votcPendingCheckpointToken) ? gameData.votcPendingCheckpointToken : undefined
    };
    const hasNode = gameData.votcTimelineNodeA !== undefined
        && gameData.votcTimelineNodeB !== undefined
        && gameData.votcTimelineNodeA > 0
        && gameData.votcTimelineNodeB > 0;
    const hasParent = gameData.votcTimelineParentA !== undefined
        && gameData.votcTimelineParentB !== undefined
        && gameData.votcTimelineParentA > 0
        && gameData.votcTimelineParentB > 0;
    if (!hasNode) {
        return baseContext;
    }
    const nodeId = `${gameData.votcTimelineNodeA}-${gameData.votcTimelineNodeB}`;
    if (!isValidNodeId(nodeId)) {
        return baseContext;
    }
    const parentId = hasParent
        ? `${gameData.votcTimelineParentA}-${gameData.votcTimelineParentB}`
        : undefined;
    if (parentId !== undefined && !isValidNodeId(parentId)) {
        return baseContext;
    }
    return {
        ...baseContext,
        timelineNodeId: nodeId,
        timelineParentId: parentId
    };
}

/**
 * Battle checkpoints are captured at the battle's own save point. A usable
 * checkpoint is the only acceptable evidence: it must not inherit node/token
 * fields from the last unrelated VOTC:IN block, and a present-but-corrupt
 * checkpoint must degrade to an epoch-only context rather than fall back to
 * those unrelated fields. Only a fully absent checkpoint may fall back to
 * GameData (the battle predates checkpoint emission).
 */
export function buildContextFromBattleCheckpoint(
    playerId: string,
    checkpoint: TimelineParseResult | undefined,
    gameData?: GameDataLike
): TimelineContext {
    if (checkpoint?.status === 'unsupported-schema') {
        throw new UnsupportedTimelineSchemaError(checkpoint.schema);
    }
    if (checkpoint !== undefined && checkpoint.status !== 'valid' && checkpoint.status !== 'legacy') {
        return { playerId, checkpointEpoch: gameData?.votcCheckpointEpoch };
    }
    const observed = checkpoint?.snapshot;
    const hasBattleSnapshot = observed !== undefined
        && (observed.epoch !== undefined || observed.nodeA !== undefined || observed.nodeB !== undefined);
    if (!hasBattleSnapshot && gameData && String(gameData.playerID) === playerId) {
        return buildContextFromGameData(gameData);
    }
    if (!observed) {
        return { playerId };
    }
    return buildContextFromSnapshot(playerId, observed);
}

function contextForRegistryNode(base: TimelineContext, nodeId: string, node: TimelineNode): TimelineContext {
    return {
        ...base,
        timelineNodeId: nodeId,
        timelineParentId: node.parentId ?? undefined
    };
}

function findNodesAtEpoch(
    registry: TimelineRegistry,
    epoch: number,
    descendantOf?: string
): Array<[string, TimelineNode]> {
    return registry.getNodeEntries().filter(([nodeId, node]) => {
        if (node.epoch !== epoch) return false;
        return descendantOf === undefined
            || (nodeId !== descendantOf && registry.getAncestorSet(nodeId).has(descendantOf));
    });
}

function findUniqueNodeAtEpoch(
    registry: TimelineRegistry,
    epoch: number,
    descendantOf?: string
): [string, TimelineNode] | undefined {
    const candidates = findNodesAtEpoch(registry, epoch, descendantOf);
    return candidates.length === 1 ? candidates[0] : undefined;
}

function findNodesWithToken(registry: TimelineRegistry, checkpointToken: number): Array<[string, TimelineNode]> {
    return registry.getNodeEntries().filter(([, node]) => node.checkpointToken === checkpointToken);
}

/**
 * §9.5 production resolver. Delegates to resolveTimelineStrict (evidence order
 * 1-5). Never falls back to epoch heuristics or token-conflict resolution.
 * Callers that need the legacy epoch-heuristic behavior (migration preview
 * only) must use resolveTimelineContextLegacy.
 *
 * Note: this wrapper flattens the TimelineResolution union back into a single
 * TimelineContext (non-resolved statuses return the input context unchanged).
 * P5.4+ callers that need to distinguish resolved/ambiguous/missing/corrupt
 * should call resolveTimelineStrict directly and inspect the returned status.
 */
export function resolveTimelineContext(registry: TimelineRegistry, context: TimelineContext): TimelineContext {
    const resolution = resolveTimelineStrict({ registry, context });
    if (resolution.status === 'resolved') {
        return resolution.context;
    }
    return context;
}

/**
 * Legacy epoch-heuristic resolver. Retained for migration preview use only
 * (campaignMigration). Must NOT be called from production write paths.
 * Phase 5 switched production to resolveTimelineStrict (resolveTimelineContext
 * above); this function preserves the prior epoch-fallback behavior for the
 * explicit migration preview flow described in §9.5.
 */
export function resolveTimelineContextLegacy(registry: TimelineRegistry, context: TimelineContext): TimelineContext {
    const checkpointEpoch = context.checkpointEpoch;
    const hasCheckpointEpoch = checkpointEpoch !== undefined && Number.isFinite(checkpointEpoch);
    const snapshotNodeId = context.timelineNodeId;
    const snapshotNode = snapshotNodeId !== undefined && registry.hasNode(snapshotNodeId)
        ? registry.getNode(snapshotNodeId)
        : undefined;

    if (snapshotNode && (!hasCheckpointEpoch || snapshotNode.epoch === checkpointEpoch)) {
        return context;
    }

    if (isValidCheckpointToken(context.checkpointToken)) {
        const tokenMatches = findNodesWithToken(registry, context.checkpointToken)
            .filter(([, node]) => !hasCheckpointEpoch || node.epoch === checkpointEpoch);
        if (tokenMatches.length === 1) {
            return contextForRegistryNode(context, tokenMatches[0][0], tokenMatches[0][1]);
        }
    }

    if (!hasCheckpointEpoch) {
        return context;
    }

    if (snapshotNodeId !== undefined && snapshotNode) {
        const matchingDescendants = findNodesAtEpoch(registry, checkpointEpoch, snapshotNodeId);
        const matchingDescendant = matchingDescendants.length === 1 ? matchingDescendants[0] : undefined;
        if (matchingDescendant) {
            return contextForRegistryNode(context, matchingDescendant[0], matchingDescendant[1]);
        }
        if (matchingDescendants.length > 1) {
            return context;
        }
    }

    const matchingEpochNodes = findNodesAtEpoch(registry, checkpointEpoch);
    const matchingEpochNode = matchingEpochNodes.length === 1 ? matchingEpochNodes[0] : undefined;
    if (matchingEpochNode) {
        return contextForRegistryNode(context, matchingEpochNode[0], matchingEpochNode[1]);
    }
    if (matchingEpochNodes.length > 1) {
        return context;
    }

    const knownEpochs = [...new Set(
        registry.getNodeEntries()
            .map(([, node]) => node.epoch)
            .filter((epoch): epoch is number => typeof epoch === 'number' && Number.isFinite(epoch) && epoch <= checkpointEpoch)
    )].sort((a, b) => b - a);
    for (const epoch of knownEpochs) {
        const latestKnownNode = findUniqueNodeAtEpoch(registry, epoch);
        if (latestKnownNode) {
            return contextForRegistryNode(context, latestKnownNode[0], latestKnownNode[1]);
        }
    }

    return context;
}

export interface CreateChildNodeResult {
    nodeId: string;
    parentId: string | null;
    script: string;
    context: TimelineContext;
    createdNewRoot: boolean;
}

/**
 * @deprecated §9.3 P5.4: this v1 helper is no longer the production write
 * path for NEW timeline records. Business sources now route through
 * timelineBusinessWire.run*TimelineTransition, which uses
 * TransitionJournalApi.beginTransition + buildCheckpointSetEffect.
 * Retained for legacy read paths and migration staging only.
 */
export function createChildNodeAndScript(
    registry: TimelineRegistry,
    parentContext: TimelineContext,
    source: SourceKind,
    eventKey: string,
    nextEpoch: number | undefined,
    scopeVar: string,
    createdAt: string = new Date().toISOString()
): CreateChildNodeResult {
    const parentIsLegacy = isLegacyContext(parentContext);
    let parentId: string | null;

    if (parentIsLegacy) {
        const rootId = registry.getOrCreateChild(null, source, `${source}:legacy_root`, parentContext.checkpointEpoch, createdAt);
        parentId = rootId;
    } else {
        parentId = parentContext.timelineNodeId!;
    }

    const nextCheckpointToken = isValidCheckpointToken(parentContext.pendingCheckpointToken)
        ? parentContext.pendingCheckpointToken
        : undefined;
    const childId = registry.getOrCreateChild(parentId, source, eventKey, nextEpoch, createdAt, nextCheckpointToken);
    const script = buildCheckpointSetEffect(childId, parentId, nextEpoch, scopeVar, nextCheckpointToken);
    const childContext: TimelineContext = {
        playerId: parentContext.playerId,
        checkpointEpoch: nextEpoch,
        checkpointToken: nextCheckpointToken,
        timelineNodeId: childId,
        timelineParentId: parentId
    };
    return {
        nodeId: childId,
        parentId,
        script,
        context: childContext,
        createdNewRoot: parentIsLegacy
    };
}

export {
    SCHEMA_VERSION,
    MAX_NODE_COMPONENT,
    parseNodeId,
    isValidNodeId,
    formatNodeId,
    generateNodeId
};
