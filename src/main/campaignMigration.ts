import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { CampaignPlayerIdentity } from '../shared/gameData/CampaignIdentity.js';
import { isCampaignPlayerIdentity } from '../shared/gameData/CampaignIdentity.js';
import {
    timelineRegistryPath as campaignRegistryPath,
    migrationManifestPath
} from './campaignDataPaths.js';
import {
    type TimelineStoreEnvelope,
    type TimelineStoreEnvelopeIdentity,
    type TimelineStoreEnvelopePlayer,
    type TimelineRegistryData,
    type TimelineNode,
    type TimelineContext,
    TimelineRegistry,
    resolveTimelineContextLegacy
} from './timelineManager.js';
import { validateV1RegistryData } from './registryValidator.js';

export interface ObservedTimelineState {
    playerId: string;
    epoch?: number;
    timelineNodeId?: string;
    checkpointToken?: number;
}

export interface MigrationPreviewEvidence {
    kind:
        | 'snapshot-self-consistent'
        | 'token-bridge'
        | 'epoch-heuristic-unique-descendant'
        | 'epoch-heuristic-unique'
        | 'epoch-heuristic-latest-known'
        | 'unresolved';
    proven: boolean;
    reason: string;
    warning?: string;
}

export interface MigrationStageOptions {
    observedState?: ObservedTimelineState;
    backupDir?: string;
}

export type MigrationStatus = 'imported' | 'skipped';
export type MigrationDecision =
    | 'no-legacy-data'
    | 'current-branch-only'
    | 'ambiguous'
    | 'already-staged';

export interface MigrationManifest {
    version: 1;
    status: MigrationStatus;
    decision: MigrationDecision;
    campaignId: string;
    playerId: string;
    sourceRegistry?: string;
    backupPath?: string;
    sourceNodeId?: string;
    importedNodeCount: number;
    importedRecordCount: number;
    quarantinedLegacyRecordCount: number;
    completedAt: string;
}

export interface MigrationStageResult {
    status: MigrationStatus;
    decision: MigrationDecision;
    sourceRegistryPath?: string;
    backupPath?: string;
    sourceNodeId?: string;
    importedNodeCount: number;
    importedRecordCount: number;
    quarantinedLegacyRecordCount: number;
}

function legacyRegistryPath(userDataDir: string, playerId: string): string {
    return path.join(userDataDir, 'votc_data', 'timeline_registry', `player_${playerId}.json`);
}

function legacyNestedRegistryPath(userDataDir: string, playerId: string): string {
    return path.join(userDataDir, 'votc_data', 'votc_data', 'timeline_registry', `player_${playerId}.json`);
}

interface ParsedLegacyFile {
    revision: number;
    transactionId: string;
    store: TimelineRegistryData;
}

function parseLegacyFile(raw: string): ParsedLegacyFile | { error: string } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return { error: `invalid JSON: ${error}` };
    }
    if (parsed === null || typeof parsed !== 'object') {
        return { error: 'root is not an object' };
    }
    const root = parsed as Record<string, unknown>;
    if ('store' in root && root.store !== null && typeof root.store === 'object') {
        if (typeof root.revision !== 'number' || !Number.isFinite(root.revision) || root.revision < 0) {
            return { error: 'envelope missing or invalid revision' };
        }
        return {
            revision: root.revision as number,
            transactionId: typeof root.transactionId === 'string' ? root.transactionId : '',
            store: root.store as TimelineRegistryData
        };
    }
    return {
        revision: 0,
        transactionId: '',
        store: parsed as TimelineRegistryData
    };
}

function isExactCandidate(
    parsed: ParsedLegacyFile,
    observed: ObservedTimelineState
): { exact: boolean; sourceNodeId?: string } {
    const store = parsed.store;
    if (typeof store.playerId !== 'string' || store.playerId !== observed.playerId) {
        return { exact: false };
    }
    const errors = validateV1RegistryData(store);
    if (errors.length > 0) {
        return { exact: false };
    }
    if (observed.timelineNodeId === undefined) {
        // No node id evidence -> ambiguous (epoch-only is forbidden).
        return { exact: false };
    }
    if (!Object.prototype.hasOwnProperty.call(store.nodes, observed.timelineNodeId)) {
        return { exact: false };
    }
    const node = store.nodes[observed.timelineNodeId];
    if (observed.epoch !== undefined && node.epoch !== undefined && node.epoch !== observed.epoch) {
        return { exact: false };
    }
    // §8.3 condition #4: "CK3 current token 非零时，registry node token 必须相等".
    // A tokenless legacy node cannot prove it matches an observed state that
    // carries a token; conservative default = no proof = not an exact
    // candidate. The reverse (observed has no token, node has one) is allowed:
    // CK3 may legitimately report no token and we fall back to node+epoch
    // proof. If both sides carry a token they must be strictly equal.
    if (observed.checkpointToken !== undefined) {
        if (node.checkpointToken === undefined
            || node.checkpointToken !== observed.checkpointToken) {
            return { exact: false };
        }
    }
    return { exact: true, sourceNodeId: observed.timelineNodeId };
}

function ancestorSubgraph(
    store: TimelineRegistryData,
    nodeId: string
): { included: Set<string>; excluded: Set<string> } {
    const included = new Set<string>();
    let current: string | null = nodeId;
    while (current !== null && Object.prototype.hasOwnProperty.call(store.nodes, current) && !included.has(current)) {
        included.add(current);
        current = store.nodes[current].parentId;
    }
    const excluded = new Set<string>();
    for (const id of Object.keys(store.nodes)) {
        if (!included.has(id)) {
            excluded.add(id);
        }
    }
    return { included, excluded };
}

function copyFile(src: string, dest: string): void {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function backupLegacyRegistry(
    userDataDir: string,
    sourcePath: string,
    identity: CampaignPlayerIdentity
): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDirRoot = path.join(userDataDir, 'votc_data', 'legacy_backups', stamp);
    const rel = path.relative(path.join(userDataDir, 'votc_data'), sourcePath);
    const dest = path.join(backupDirRoot, rel);
    copyFile(sourcePath, dest);
    return backupDirRoot;
}

function writeStagingStore(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    importedStore: TimelineRegistryData,
    sourceNodeId: string | undefined
): { stagingPath: string; revision: number } {
    const stagingPath = campaignRegistryPath(userDataDir, identity);
    fs.mkdirSync(path.dirname(stagingPath), { recursive: true });

    // Staging writes a fresh envelope at revision 1 with the identity header
    // stamped on it. This is deliberately independent of the production
    // FsTimelinePersistence.saveStoreWithIdentity path: staging is a one-shot
    // bootstrap into an empty campaign/player directory, and Phase 5 will
    // take over production writes via the identity-aware save path. No swap
    // manifest or backup rotation is needed for the initial staging write
    // because there is no prior primary to recover.
    const envelope: TimelineStoreEnvelope = {
        revision: 1,
        transactionId: randomUUID(),
        store: importedStore,
        campaign: {
            campaignId: identity.campaignId,
            campaignSchema: identity.campaignSchema,
            protocolSchema: identity.protocolSchema
        } as TimelineStoreEnvelopeIdentity,
        player: { playerId: identity.playerId } as TimelineStoreEnvelopePlayer
    };

    const payload = JSON.stringify(envelope, null, '\t');
    const tmpPath = `${stagingPath}.tmp`;
    fs.writeFileSync(tmpPath, payload, 'utf8');
    fs.renameSync(tmpPath, stagingPath);

    // The sourceNodeId is recorded on the migration manifest for diagnosis,
    // not on the store envelope (the store's nodes carry their own IDs).
    void sourceNodeId;

    return { stagingPath, revision: 1 };
}

function writeManifest(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    manifest: MigrationManifest
): string {
    const manifestPath = migrationManifestPath(userDataDir, identity);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t'), 'utf8');
    return manifestPath;
}

/**
 * Stage the campaign/player migration (§8). This is a read-only operation
 * with respect to legacy data: it copies the legacy registry into a backup
 * directory and writes a fresh staging envelope at the campaign player path.
 * It does NOT delete or modify the legacy file. It does NOT switch the
 * production FsTimelinePersistence save path; that switch is Phase 5.
 *
 * Behavior:
 *   - No legacy registry at the player path -> `skipped` / `no-legacy-data`.
 *     A manifest is written so subsequent operations don't re-scan.
 *   - Legacy registry present but not an ExactCandidate -> `skipped` /
 *     `ambiguous`. Legacy data is left untouched.
 *   - Legacy registry is an ExactCandidate -> `imported` /
 *     `current-branch-only`. A backup is created, the current-branch
 *     ancestor subgraph is copied into the staging envelope, and unrelated
 *     roots go into quarantine (counted but not imported).
 *   - An existing migration manifest with status=imported -> `skipped` /
 *     `already-staged`.
 */
export function stageCampaignMigration(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    options: MigrationStageOptions
): MigrationStageResult {
    if (!isCampaignPlayerIdentity(identity)) {
        throw new Error('campaignMigration: invalid CampaignPlayerIdentity');
    }

    const existing = loadMigrationManifest(userDataDir, identity);
    if (existing && existing.status === 'imported') {
        return {
            status: 'skipped',
            decision: 'already-staged',
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: 0
        };
    }

    const observed = options.observedState;
    const playerId = identity.playerId;

    const primaryLegacy = legacyRegistryPath(userDataDir, playerId);
    const nestedLegacy = legacyNestedRegistryPath(userDataDir, playerId);
    const legacyPath = fs.existsSync(primaryLegacy)
        ? primaryLegacy
        : (fs.existsSync(nestedLegacy) ? nestedLegacy : undefined);

    if (!legacyPath) {
        const manifest: MigrationManifest = {
            version: 1,
            status: 'skipped',
            decision: 'no-legacy-data',
            campaignId: identity.campaignId,
            playerId,
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: 0,
            completedAt: new Date().toISOString()
        };
        writeManifest(userDataDir, identity, manifest);
        return {
            status: 'skipped',
            decision: 'no-legacy-data',
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: 0
        };
    }

    let raw: string;
    try {
        raw = fs.readFileSync(legacyPath, 'utf8');
    } catch (error) {
        const manifest: MigrationManifest = {
            version: 1,
            status: 'skipped',
            decision: 'ambiguous',
            campaignId: identity.campaignId,
            playerId,
            sourceRegistry: legacyPath,
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: 0,
            completedAt: new Date().toISOString()
        };
        writeManifest(userDataDir, identity, manifest);
        return {
            status: 'skipped',
            decision: 'ambiguous',
            sourceRegistryPath: legacyPath,
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: 0
        };
    }

    const parsed = parseLegacyFile(raw);
    if ('error' in parsed) {
        const manifest: MigrationManifest = {
            version: 1,
            status: 'skipped',
            decision: 'ambiguous',
            campaignId: identity.campaignId,
            playerId,
            sourceRegistry: legacyPath,
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: 0,
            completedAt: new Date().toISOString()
        };
        writeManifest(userDataDir, identity, manifest);
        return {
            status: 'skipped',
            decision: 'ambiguous',
            sourceRegistryPath: legacyPath,
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: 0
        };
    }

    const candidate = observed ? isExactCandidate(parsed, observed) : { exact: false };
    if (!candidate.exact) {
        const quarantinedCount = Object.keys(parsed.store.nodes).length;
        const manifest: MigrationManifest = {
            version: 1,
            status: 'skipped',
            decision: 'ambiguous',
            campaignId: identity.campaignId,
            playerId,
            sourceRegistry: legacyPath,
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: quarantinedCount,
            completedAt: new Date().toISOString()
        };
        writeManifest(userDataDir, identity, manifest);
        return {
            status: 'skipped',
            decision: 'ambiguous',
            sourceRegistryPath: legacyPath,
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: quarantinedCount
        };
    }

    // ExactCandidate: back up, then stage the ancestor subgraph.
    const backupPath = backupLegacyRegistry(userDataDir, legacyPath, identity);

    const sourceNodeId = candidate.sourceNodeId!;
    const { included, excluded } = ancestorSubgraph(parsed.store, sourceNodeId);

    const importedNodes: Record<string, TimelineNode> = {};
    for (const id of included) {
        importedNodes[id] = parsed.store.nodes[id];
    }
    const importedStore: TimelineRegistryData = {
        version: parsed.store.version,
        playerId,
        nodes: importedNodes
    };

    const validationErrors = validateV1RegistryData(importedStore, { campaignIdentity: identity });
    if (validationErrors.length > 0) {
        // Quarantine the entire staging set rather than emitting a half-built store.
        const manifest: MigrationManifest = {
            version: 1,
            status: 'skipped',
            decision: 'ambiguous',
            campaignId: identity.campaignId,
            playerId,
            sourceRegistry: legacyPath,
            backupPath,
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: excluded.size,
            completedAt: new Date().toISOString()
        };
        writeManifest(userDataDir, identity, manifest);
        return {
            status: 'skipped',
            decision: 'ambiguous',
            sourceRegistryPath: legacyPath,
            backupPath,
            importedNodeCount: 0,
            importedRecordCount: 0,
            quarantinedLegacyRecordCount: excluded.size
        };
    }

    writeStagingStore(userDataDir, identity, importedStore, sourceNodeId);

    // Phase 4 defers copying business records (summaries, conversations,
    // letters, battle reports) into the campaign directory; that is §8.4
    // step 6, which belongs to the Phase 5 production switch. importedNodeCount
    // reflects the ancestor subgraph we just staged, but importedRecordCount
    // stays 0 until Phase 5/7 copies and rewrites the business records with
    // campaign/player provenance.
    const manifest: MigrationManifest = {
        version: 1,
        status: 'imported',
        decision: 'current-branch-only',
        campaignId: identity.campaignId,
        playerId,
        sourceRegistry: legacyPath,
        backupPath,
        sourceNodeId,
        importedNodeCount: included.size,
        importedRecordCount: 0,
        quarantinedLegacyRecordCount: excluded.size,
        completedAt: new Date().toISOString()
    };
    writeManifest(userDataDir, identity, manifest);

    return {
        status: 'imported',
        decision: 'current-branch-only',
        sourceRegistryPath: legacyPath,
        backupPath,
        sourceNodeId,
        importedNodeCount: included.size,
        importedRecordCount: 0,
        quarantinedLegacyRecordCount: excluded.size
    };
}

export function loadMigrationManifest(
    userDataDir: string,
    identity: CampaignPlayerIdentity
): MigrationManifest | undefined {
    const manifestPath = migrationManifestPath(userDataDir, identity);
    if (!fs.existsSync(manifestPath)) return undefined;
    try {
        const raw = fs.readFileSync(manifestPath, 'utf8');
        const parsed = JSON.parse(raw) as MigrationManifest;
        if (parsed && typeof parsed.status === 'string' && typeof parsed.campaignId === 'string'
            && typeof parsed.playerId === 'string') {
            return parsed;
        }
        return undefined;
    } catch {
        return undefined;
    }
}

/**
 * §9.5 migration preview: resolve a timeline context for the migration
 * preview flow using the LEGACY epoch-heuristic resolver
 * (resolveTimelineContextLegacy). The strict resolver (resolveTimelineStrict)
 * is the production path; the migration preview is the only remaining
 * caller allowed to use epoch heuristics, because it must show the user
 * what the pre-strict-resolver behavior would have produced so they can
 * decide whether to accept the staged import.
 *
 * Returns the resolved context (with timelineNodeId filled in when the
 * legacy resolver found a unique candidate), the registry used for
 * resolution (unchanged), and evidence describing how the result was
 * obtained. Proven evidence kinds (snapshot-self-consistent, token-bridge)
 * match the strict resolver's evidence order; all epoch-heuristic kinds
 * are unproven and preview-only. Callers must NOT use the returned registry
 * for writes.
 */
export function resolveMigrationPreviewContext(
    registry: TimelineRegistry,
    context: TimelineContext
): { context: TimelineContext; registry: TimelineRegistry; evidence: MigrationPreviewEvidence } {
    const resolved = resolveTimelineContextLegacy(registry, context);

    const snapshotEvidence = classifySnapshotSelfConsistent(registry, context);
    if (snapshotEvidence) {
        return { context: resolved, registry, evidence: snapshotEvidence };
    }

    const tokenEvidence = classifyTokenBridge(registry, context, resolved);
    if (tokenEvidence) {
        return { context: resolved, registry, evidence: tokenEvidence };
    }

    if (resolved.timelineNodeId === undefined || resolved.timelineNodeId === context.timelineNodeId) {
        return {
            context: resolved,
            registry,
            evidence: {
                kind: 'unresolved',
                proven: false,
                reason: 'legacy resolver did not identify a candidate node'
            }
        };
    }

    const descendantEvidence = classifyUniqueDescendant(registry, context, resolved);
    if (descendantEvidence) {
        return { context: resolved, registry, evidence: descendantEvidence };
    }

    const uniqueEpochEvidence = classifyUniqueEpochNode(registry, context, resolved);
    if (uniqueEpochEvidence) {
        return { context: resolved, registry, evidence: uniqueEpochEvidence };
    }

    const latestKnownEvidence = classifyLatestKnownNode(registry, context, resolved);
    if (latestKnownEvidence) {
        return { context: resolved, registry, evidence: latestKnownEvidence };
    }

    return {
        context: resolved,
        registry,
        evidence: {
            kind: 'unresolved',
            proven: false,
            reason: 'legacy resolver matched a node but no evidence classification applies'
        }
    };
}

function isValidCheckpointToken(token: number | undefined): token is number {
    return typeof token === 'number' && Number.isInteger(token) && token > 0;
}

function classifySnapshotSelfConsistent(
    registry: TimelineRegistry,
    context: TimelineContext
): MigrationPreviewEvidence | undefined {
    const snapshotNodeId = context.timelineNodeId;
    if (snapshotNodeId === undefined || !registry.hasNode(snapshotNodeId)) {
        return undefined;
    }
    const node = registry.getNode(snapshotNodeId)!;
    if (context.checkpointEpoch !== undefined
        && node.epoch !== undefined
        && node.epoch !== context.checkpointEpoch) {
        return undefined;
    }
    return {
        kind: 'snapshot-self-consistent',
        proven: true,
        reason: `snapshot node ${snapshotNodeId} exists in registry and matches the observed epoch`
    };
}

function classifyTokenBridge(
    registry: TimelineRegistry,
    context: TimelineContext,
    resolved: TimelineContext
): MigrationPreviewEvidence | undefined {
    if (!isValidCheckpointToken(context.checkpointToken) || context.checkpointEpoch === undefined) {
        return undefined;
    }
    const matches = registry.getNodeEntries().filter(([, node]) =>
        node.checkpointToken === context.checkpointToken
        && node.epoch === context.checkpointEpoch
    );
    if (matches.length !== 1) {
        return undefined;
    }
    const [nodeId] = matches[0];
    if (resolved.timelineNodeId !== nodeId) {
        return undefined;
    }
    return {
        kind: 'token-bridge',
        proven: true,
        reason: `checkpoint token ${context.checkpointToken} uniquely matched node ${nodeId}`
    };
}

function classifyUniqueDescendant(
    registry: TimelineRegistry,
    context: TimelineContext,
    resolved: TimelineContext
): MigrationPreviewEvidence | undefined {
    const snapshotNodeId = context.timelineNodeId;
    const checkpointEpoch = context.checkpointEpoch;
    if (snapshotNodeId === undefined || checkpointEpoch === undefined || !registry.hasNode(snapshotNodeId)) {
        return undefined;
    }
    const descendants = registry.getNodeEntries().filter(([nodeId, node]) =>
        nodeId !== snapshotNodeId
        && node.epoch === checkpointEpoch
        && registry.getAncestorSet(nodeId).has(snapshotNodeId)
    );
    if (descendants.length !== 1) {
        return undefined;
    }
    const [nodeId, node] = descendants[0];
    if (resolved.timelineNodeId !== nodeId) {
        return undefined;
    }
    return {
        kind: 'epoch-heuristic-unique-descendant',
        proven: false,
        reason: `CK3 reported parent ${snapshotNodeId} and registry has a unique descendant at epoch ${checkpointEpoch} (${nodeId})`,
        warning: 'CK3 at parent with a descendant at the checkpoint epoch is NOT proof of a reload-redo; terminalEvidence or a target snapshot is required'
    };
}

function classifyUniqueEpochNode(
    registry: TimelineRegistry,
    context: TimelineContext,
    resolved: TimelineContext
): MigrationPreviewEvidence | undefined {
    if (context.checkpointEpoch === undefined) {
        return undefined;
    }
    const matches = registry.getNodeEntries().filter(([, node]) => node.epoch === context.checkpointEpoch);
    if (matches.length !== 1) {
        return undefined;
    }
    const [nodeId] = matches[0];
    if (resolved.timelineNodeId !== nodeId) {
        return undefined;
    }
    return {
        kind: 'epoch-heuristic-unique',
        proven: false,
        reason: `a unique registry node (${nodeId}) exists at the checkpoint epoch ${context.checkpointEpoch}`
    };
}

function classifyLatestKnownNode(
    registry: TimelineRegistry,
    context: TimelineContext,
    resolved: TimelineContext
): MigrationPreviewEvidence | undefined {
    if (context.checkpointEpoch === undefined) {
        return undefined;
    }
    const knownEpochs = [...new Set(
        registry.getNodeEntries()
            .map(([, node]) => node.epoch)
            .filter((epoch): epoch is number => typeof epoch === 'number' && Number.isFinite(epoch) && epoch <= context.checkpointEpoch!)
    )].sort((a, b) => b - a);
    for (const epoch of knownEpochs) {
        const matches = registry.getNodeEntries().filter(([, node]) => node.epoch === epoch);
        if (matches.length !== 1) {
            continue;
        }
        const [nodeId] = matches[0];
        if (resolved.timelineNodeId !== nodeId) {
            return undefined;
        }
        if (context.checkpointEpoch - epoch > 5) {
            return {
                kind: 'unresolved',
                proven: false,
                reason: `latest known registry node ${nodeId} is at epoch ${epoch}, far behind the checkpoint epoch ${context.checkpointEpoch}`
            };
        }
        return {
            kind: 'epoch-heuristic-latest-known',
            proven: false,
            reason: `fell back to the latest known registry node ${nodeId} at epoch ${epoch}`
        };
    }
    return undefined;
}
