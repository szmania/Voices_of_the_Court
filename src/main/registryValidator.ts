import {
    MAX_NODE_COMPONENT
} from '../shared/gameData/timelineProtocol.js';
import { isCampaignPlayerIdentity, type CampaignPlayerIdentity } from '../shared/gameData/CampaignIdentity.js';
import type { TimelineNode, TimelineRegistryData, SourceKind } from './timelineManager.js';
import { isValidNodeId } from './timelineManager.js';

export const V1_REGISTRY_SOURCES: readonly SourceKind[] = [
    'conversation',
    'letter_reply',
    'incoming_letter',
    'battle',
    'summary_manual'
] as const;

const V1_SOURCE_SET: ReadonlySet<string> = new Set(V1_REGISTRY_SOURCES);

const V1_SCHEMA_VERSION = 1;

export type RegistryValidationErrorCode =
    | 'root_not_object'
    | 'file_unreadable'
    | 'json_invalid'
    | 'registry_build_failed'
    | 'version_missing'
    | 'version_unsupported'
    | 'player_id_not_string'
    | 'nodes_not_object'
    | 'node_not_object'
    | 'node_field_missing'
    | 'node_field_type'
    | 'node_id_invalid'
    | 'parent_id_invalid'
    | 'parent_missing'
    | 'self_parent'
    | 'cycle'
    | 'epoch_not_integer'
    | 'epoch_negative'
    | 'token_invalid'
    | 'source_unknown'
    | 'epoch_regression'
    | 'no_root'
    | 'identity_mismatch'
    | 'campaign_identity_invalid'
    // Phase 5 v2 journal validation codes (mapped from JournalValidationError).
    | 'phase_invalid'
    | 'commit_mode_invalid'
    | 'record_id_duplicate'
    | 'artifact_invalid'
    | 'terminal_evidence_not_in_results'
    | 'terminal_evidence_not_terminal'
    | 'duplicate_attempt_id'
    | 'target_node_missing'
    | 'entry_field_missing'
    | 'entry_field_type';

export interface RegistryValidationOptions {
    /**
     * When provided, the validator checks that the registry's playerId matches
     * the expected campaign/player identity (§4.2 invariant: "registry 的
     * campaign/player 必须与请求 identity 完全相等"). V1 registries do not
     * store campaignId, so only playerId is compared here; the campaignId
     * comparison happens at the path/envelope layer.
     *
     * Reserved for Phase 5 (transition/journal/result) validators.
     */
    readonly campaignIdentity?: CampaignPlayerIdentity;
    /**
     * Reserved for P5.2: v2 transition/journal/result payload validator.
     * Currently unread; v2 validation happens via JournalValidationError in
     * FsTimelinePersistence.validateV2Payload instead.
     */
    readonly transitionJournal?: unknown;
}

export interface RegistryValidationErrorInit {
    nodeId?: string;
    path?: string;
}

export class RegistryValidationError extends Error {
    readonly code: RegistryValidationErrorCode;
    readonly nodeId?: string;
    readonly path?: string;

    constructor(
        code: RegistryValidationErrorCode,
        message: string,
        init?: RegistryValidationErrorInit
    ) {
        super(message);
        this.name = 'RegistryValidationError';
        this.code = code;
        if (init) {
            this.nodeId = init.nodeId;
            this.path = init.path;
        }
    }

    toString(): string {
        const loc = this.nodeId ?? this.path ?? '';
        return loc ? `[${this.code}] @ ${loc}: ${this.message}` : `[${this.code}]: ${this.message}`;
    }
}

type NodeEntry = [string, TimelineNode];

function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

function isValidCheckpointToken(token: unknown): token is number {
    return typeof token === 'number'
        && Number.isInteger(token)
        && token > 0
        && token <= MAX_NODE_COMPONENT;
}

/**
 * Format-agnostic graph validator. Operates on an in-memory registry/nodes
 * collection; does not read files. Returns an empty array when valid.
 *
 * Checks (per plan §7.2):
 * - node/parent ID legal;
 * - epoch finite, non-negative;
 * - token legal or absent;
 * - source belongs to the v1 enum;
 * - parent exists;
 * - no self-parent, no cycle;
 * - child epoch >= parent epoch (minimal advancement rule; stricter
 *   source-specific rules are reserved for Phase 5 source contracts);
 * - root / legacy root sanity (each non-empty graph has at least one root,
 *   root.parentId === null).
 */
export function validateRegistryGraph(
    data: TimelineRegistryData,
    _options?: RegistryValidationOptions
): RegistryValidationError[] {
    const errors: RegistryValidationError[] = [];
    const nodes = data.nodes ?? {};
    const entries = Object.entries(nodes);

    if (_options?.campaignIdentity !== undefined) {
        if (!isCampaignPlayerIdentity(_options.campaignIdentity)) {
            errors.push(new RegistryValidationError(
                'campaign_identity_invalid',
                'campaignIdentity option is not a valid CampaignPlayerIdentity object',
                { path: 'campaignIdentity' }
            ));
        } else {
            const expectedPlayerId = _options.campaignIdentity.playerId;
            if (typeof data.playerId === 'string' && data.playerId !== expectedPlayerId) {
                errors.push(new RegistryValidationError(
                    'identity_mismatch',
                    `registry playerId "${data.playerId}" does not match expected playerId "${expectedPlayerId}"`,
                    { path: 'playerId' }
                ));
            }
        }
    }

    const knownIds = new Set<string>(entries.map(([id]) => id));

    for (const [id, node] of entries) {
        if (!isValidNodeId(id)) {
            errors.push(new RegistryValidationError(
                'node_id_invalid',
                `node id is not a valid a-b pair: "${id}"`,
                { nodeId: id }
            ));
        }

        if (typeof node.parentId === 'string') {
            if (!isValidNodeId(node.parentId)) {
                errors.push(new RegistryValidationError(
                    'parent_id_invalid',
                    `parent id is not a valid a-b pair: "${node.parentId}"`,
                    { nodeId: id }
                ));
            } else if (node.parentId === id) {
                errors.push(new RegistryValidationError(
                    'self_parent',
                    `node is its own parent: "${id}"`,
                    { nodeId: id }
                ));
            } else if (!knownIds.has(node.parentId)) {
                errors.push(new RegistryValidationError(
                    'parent_missing',
                    `parent "${node.parentId}" does not exist in the registry`,
                    { nodeId: id }
                ));
            }
        } else if (node.parentId !== null) {
            errors.push(new RegistryValidationError(
                'node_field_type',
                `parentId must be a string or null, got ${typeof node.parentId}`,
                { nodeId: id }
            ));
        }

        const epoch = node.epoch;
        if (epoch !== undefined) {
            if (typeof epoch !== 'number' || !Number.isFinite(epoch) || !Number.isInteger(epoch)) {
                errors.push(new RegistryValidationError(
                    'epoch_not_integer',
                    `epoch is not a finite integer: ${String(epoch)}`,
                    { nodeId: id }
                ));
            } else if (epoch < 0) {
                errors.push(new RegistryValidationError(
                    'epoch_negative',
                    `epoch is negative: ${epoch}`,
                    { nodeId: id }
                ));
            }
        }

        if (node.checkpointToken !== undefined && !isValidCheckpointToken(node.checkpointToken)) {
            errors.push(new RegistryValidationError(
                'token_invalid',
                `checkpoint token is invalid: ${String(node.checkpointToken)}`,
                { nodeId: id }
            ));
        }

        if (typeof node.source !== 'string' || !V1_SOURCE_SET.has(node.source)) {
            errors.push(new RegistryValidationError(
                'source_unknown',
                `source is not a recognized v1 source: ${String(node.source)}`,
                { nodeId: id }
            ));
        }
    }

    detectCycles(entries, knownIds, errors);

    for (const [id, node] of entries) {
        if (node.parentId === null) continue;
        const parent = nodes[node.parentId];
        if (!parent) continue;
        const childEpoch = node.epoch;
        const parentEpoch = parent.epoch;
        if (typeof childEpoch === 'number' && Number.isFinite(childEpoch)
            && typeof parentEpoch === 'number' && Number.isFinite(parentEpoch)
            && childEpoch < parentEpoch) {
            errors.push(new RegistryValidationError(
                'epoch_regression',
                `child epoch ${childEpoch} is less than parent epoch ${parentEpoch}`,
                { nodeId: id }
            ));
        }
    }

    if (entries.length > 0) {
        const hasRoot = entries.some(([, node]) => node.parentId === null);
        if (!hasRoot) {
            errors.push(new RegistryValidationError(
                'no_root',
                'registry has nodes but no root (every node has a non-null parent)',
                {}
            ));
        }
    }

    return errors;
}

function detectCycles(
    entries: NodeEntry[],
    knownIds: Set<string>,
    errors: RegistryValidationError[]
): void {
    const nodeById = new Map<string, TimelineNode>(entries);
    const visited = new Set<string>();
    const stack = new Set<string>();

    for (const [id] of entries) {
        if (visited.has(id)) continue;
        walkForCycle(id, nodeById, knownIds, visited, stack, errors);
    }
}

function walkForCycle(
    startId: string,
    nodeById: Map<string, TimelineNode>,
    knownIds: Set<string>,
    visited: Set<string>,
    stack: Set<string>,
    errors: RegistryValidationError[]
): void {
    let current: string | null = startId;
    const path: string[] = [];
    while (current !== null && current !== undefined) {
        if (visited.has(current)) break;
        if (stack.has(current)) {
            errors.push(new RegistryValidationError(
                'cycle',
                `cycle detected involving node "${current}"`,
                { nodeId: current }
            ));
            for (const id of path) {
                stack.delete(id);
                visited.add(id);
            }
            return;
        }
        stack.add(current);
        path.push(current);
        const node = nodeById.get(current);
        if (!node) break;
        const parentId = node.parentId;
        if (parentId === null || !knownIds.has(parentId) || parentId === current) {
            break;
        }
        current = parentId;
    }
    for (const id of path) {
        stack.delete(id);
        visited.add(id);
    }
}

/**
 * Strict read-only v1 registry validator. Validates the v1 file shape and
 * then runs the format-agnostic graph validator. Returns an empty array when
 * valid.
 *
 * Phase 4 activates the `campaignIdentity` option: when provided, the
 * store's playerId must match the expected identity (§4.2 invariant).
 * Phase 5 remains deferred: transition/journal/result completeness is
 * not validated here.
 */
export function validateV1RegistryData(
    parsed: unknown,
    options?: RegistryValidationOptions
): RegistryValidationError[] {
    const errors: RegistryValidationError[] = [];

    if (!isObject(parsed)) {
        errors.push(new RegistryValidationError(
            'root_not_object',
            'registry root is not an object',
            {}
        ));
        return errors;
    }

    const root = parsed as Record<string, unknown>;

    if (!('version' in root)) {
        errors.push(new RegistryValidationError(
            'version_missing',
            'schema version field is missing',
            { path: 'version' }
        ));
    } else if (root.version !== V1_SCHEMA_VERSION) {
        errors.push(new RegistryValidationError(
            'version_unsupported',
            `unsupported schema version: ${String(root.version)}`,
            { path: 'version' }
        ));
    }

    if (typeof root.playerId !== 'string') {
        errors.push(new RegistryValidationError(
            'player_id_not_string',
            'playerId is missing or not a string',
            { path: 'playerId' }
        ));
    }

    if (!isObject(root.nodes)) {
        errors.push(new RegistryValidationError(
            'nodes_not_object',
            'nodes is missing or not an object',
            { path: 'nodes' }
        ));
        return errors;
    }

    const nodes = root.nodes as Record<string, unknown>;
    for (const [id, rawNode] of Object.entries(nodes)) {
        if (!isObject(rawNode)) {
            errors.push(new RegistryValidationError(
                'node_not_object',
                `node entry is not an object: "${id}"`,
                { nodeId: id }
            ));
            continue;
        }
        const node = rawNode as Record<string, unknown>;
        const nodeErrors = collectNodeFieldErrors(id, node);
        errors.push(...nodeErrors);
    }

    if (errors.length > 0) {
        return errors;
    }

    const data = parsed as TimelineRegistryData;
    errors.push(...validateRegistryGraph(data, options));
    return errors;
}

function collectNodeFieldErrors(id: string, node: Record<string, unknown>): RegistryValidationError[] {
    const errors: RegistryValidationError[] = [];
    const requiredStringFields: Array<keyof TimelineNode> = ['source', 'eventKey', 'createdAt'];
    for (const field of requiredStringFields) {
        if (!(field in node)) {
            errors.push(new RegistryValidationError(
                'node_field_missing',
                `node "${id}" is missing required field "${field}"`,
                { nodeId: id, path: field }
            ));
        } else if (typeof node[field] !== 'string') {
            errors.push(new RegistryValidationError(
                'node_field_type',
                `node "${id}" field "${field}" must be a string, got ${typeof node[field]}`,
                { nodeId: id, path: field }
            ));
        }
    }

    if ('parentId' in node) {
        if (node.parentId !== null && typeof node.parentId !== 'string') {
            errors.push(new RegistryValidationError(
                'node_field_type',
                `node "${id}" field "parentId" must be a string or null, got ${typeof node.parentId}`,
                { nodeId: id, path: 'parentId' }
            ));
        }
    } else {
        errors.push(new RegistryValidationError(
            'node_field_missing',
            `node "${id}" is missing required field "parentId"`,
            { nodeId: id, path: 'parentId' }
        ));
    }

    if ('epoch' in node && node.epoch !== undefined) {
        if (typeof node.epoch !== 'number' || !Number.isFinite(node.epoch) || !Number.isInteger(node.epoch)) {
            errors.push(new RegistryValidationError(
                'epoch_not_integer',
                `node "${id}" epoch is not a finite integer: ${String(node.epoch)}`,
                { nodeId: id, path: 'epoch' }
            ));
        } else if (node.epoch < 0) {
            errors.push(new RegistryValidationError(
                'epoch_negative',
                `node "${id}" epoch is negative: ${node.epoch}`,
                { nodeId: id, path: 'epoch' }
            ));
        }
    }

    if ('checkpointToken' in node && node.checkpointToken !== undefined) {
        if (!isValidCheckpointToken(node.checkpointToken)) {
            errors.push(new RegistryValidationError(
                'token_invalid',
                `node "${id}" checkpoint token is invalid: ${String(node.checkpointToken)}`,
                { nodeId: id, path: 'checkpointToken' }
            ));
        }
    }

    return errors;
}

const SUMMARY_ERROR_CAP = 10;

export function summarizeRegistryErrors(errors: readonly RegistryValidationError[]): string {
    if (errors.length === 0) return '';
    const visible = errors.slice(0, SUMMARY_ERROR_CAP);
    const parts = visible.map(e => e.toString());
    if (errors.length > SUMMARY_ERROR_CAP) {
        parts.push(`...and ${errors.length - SUMMARY_ERROR_CAP} more`);
    }
    return parts.join('; ');
}
