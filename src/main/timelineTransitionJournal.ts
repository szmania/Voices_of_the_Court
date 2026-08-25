import { createHash } from 'crypto';
import { MAX_NODE_COMPONENT } from '../shared/gameData/timelineProtocol.js';
import type { SourceKind } from './timelineManager.js';

export type { SourceKind };

export const V2_SOURCES: readonly SourceKind[] = [
    'conversation',
    'letter_reply',
    'incoming_letter',
    'battle',
    'summary_manual'
] as const;

const V2_SOURCE_SET: ReadonlySet<string> = new Set(V2_SOURCES);

export const LEGAL_TERMINAL_STATUSES = ['applied', 'already-applied', 'skipped-advanced'] as const;

export type TerminalCommitResultStatus = typeof LEGAL_TERMINAL_STATUSES[number];

export type TimelineCommitResultStatus =
    | TerminalCommitResultStatus
    | 'skipped-delivery-mismatch'
    | 'ambiguous-node'
    | 'ambiguous-state';

export type TransitionCommitMode = 'atomic-advance' | 'post-bump-node-only';

export type TransitionPhase =
    | 'preparing'
    | 'store-committed'
    | 'business-committed'
    | 'artifact-written'
    | 'aborted';

const LEGAL_PHASES: ReadonlySet<TransitionPhase> = new Set<TransitionPhase>([
    'preparing',
    'store-committed',
    'business-committed',
    'artifact-written',
    'aborted'
]);

const LEGAL_COMMIT_MODES: ReadonlySet<TransitionCommitMode> = new Set<TransitionCommitMode>([
    'atomic-advance',
    'post-bump-node-only'
]);

const LEGAL_RESULT_STATUS_SET: ReadonlySet<string> = new Set<string>([
    'applied',
    'already-applied',
    'skipped-advanced',
    'skipped-delivery-mismatch',
    'ambiguous-node',
    'ambiguous-state'
]);

const LEGAL_TERMINAL_STATUS_SET: ReadonlySet<string> = new Set<string>(LEGAL_TERMINAL_STATUSES);

export interface ObservedSnapshot {
    epoch?: number;
    nodeA?: number;
    nodeB?: number;
    parentA?: number;
    parentB?: number;
    checkpointToken?: number;
    pendingCheckpointToken?: number;
}

export interface TimelineNodeV2 {
    parentId: string | null;
    epoch: number;
    source: SourceKind;
    transitionAttemptId: string;
    requestKey?: string;
    eventSignature?: string;
    checkpointCorrelationToken?: number;
    createdAt: string;
    committedAt?: string;
}

export interface TimelineCommitResult {
    resultId: string;
    attemptId: string;
    status: TimelineCommitResultStatus;
    observed: ObservedSnapshot;
    recordedAt: string;
    synthetic?: boolean;
}

export type TerminalCommitResult = TimelineCommitResult & {
    status: TerminalCommitResultStatus;
};

export interface TransitionArtifact {
    path: string;
    sha256: string;
}

export interface TransitionJournalEntry {
    transitionAttemptId: string;
    source: SourceKind;
    requestKey: string;
    observedCk3NodeId?: string;
    observedCk3ParentId?: string;
    observedEpoch: number;
    observedCurrentToken?: number;
    observedPendingToken?: number;
    graphParentNodeId: string | null;
    targetNodeId: string;
    targetEpoch: number;
    targetCorrelationToken?: number;
    commitMode: TransitionCommitMode;
    recordIds: string[];
    artifact?: TransitionArtifact;
    phase: TransitionPhase;
    commitResults: TimelineCommitResult[];
    terminalEvidence?: TerminalCommitResult;
    abortReason?: string;
    startedAt: string;
    updatedAt: string;
}

export interface SerializedJournalStore {
    nodes: Record<string, TimelineNodeV2>;
    transitions: TransitionJournalEntry[];
}

export type JournalValidationErrorCode =
    | 'node_field_missing'
    | 'node_field_type'
    | 'node_id_invalid'
    | 'epoch_not_integer'
    | 'epoch_negative'
    | 'token_invalid'
    | 'source_unknown'
    | 'entry_field_missing'
    | 'entry_field_type'
    | 'phase_invalid'
    | 'commit_mode_invalid'
    | 'record_id_duplicate'
    | 'artifact_invalid'
    | 'terminal_evidence_not_in_results'
    | 'terminal_evidence_not_terminal'
    | 'duplicate_attempt_id'
    | 'target_node_missing';

export class JournalValidationError extends Error {
    code: JournalValidationErrorCode;
    nodeId?: string;
    attemptId?: string;
    path?: string;

    constructor(
        code: JournalValidationErrorCode,
        message: string,
        init?: { nodeId?: string; attemptId?: string; path?: string }
    ) {
        super(message);
        this.name = 'JournalValidationError';
        this.code = code;
        if (init) {
            this.nodeId = init.nodeId;
            this.attemptId = init.attemptId;
            this.path = init.path;
        }
    }

    toString(): string {
        const loc = this.nodeId ?? this.attemptId ?? this.path ?? '';
        return loc ? `[${this.code}] @ ${loc}: ${this.message}` : `[${this.code}]: ${this.message}`;
    }
}

export function isTerminalResult(result: TimelineCommitResult): result is TerminalCommitResult {
    return (LEGAL_TERMINAL_STATUSES as readonly string[]).includes(result.status);
}

const LEGAL_FORWARD_TRANSITIONS: ReadonlyMap<TransitionPhase, ReadonlySet<TransitionPhase>> = new Map([
    ['preparing', new Set<TransitionPhase>(['preparing', 'store-committed', 'aborted'])],
    ['store-committed', new Set<TransitionPhase>(['store-committed', 'business-committed', 'aborted'])],
    ['business-committed', new Set<TransitionPhase>(['business-committed', 'artifact-written', 'aborted'])],
    ['artifact-written', new Set<TransitionPhase>(['artifact-written', 'aborted'])],
    ['aborted', new Set<TransitionPhase>()]
]);

export function isLegalPhaseTransition(from: TransitionPhase, to: TransitionPhase): boolean {
    const allowed = LEGAL_FORWARD_TRANSITIONS.get(from);
    return allowed !== undefined && allowed.has(to);
}

function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

function isValidNodeId(id: string | undefined): boolean {
    if (typeof id !== 'string' || id.length === 0) return false;
    const dashIndex = id.indexOf('-');
    if (dashIndex <= 0 || dashIndex >= id.length - 1) return false;
    const a = Number(id.slice(0, dashIndex));
    const b = Number(id.slice(dashIndex + 1));
    return Number.isInteger(a) && Number.isInteger(b) && a > 0 && b > 0 && a <= MAX_NODE_COMPONENT && b <= MAX_NODE_COMPONENT;
}

function isValidCheckpointToken(token: unknown): token is number {
    return typeof token === 'number'
        && Number.isInteger(token)
        && token > 0
        && token <= MAX_NODE_COMPONENT;
}

function canonicalObserved(observed: ObservedSnapshot): string {
    return [
        observed.epoch ?? '',
        observed.nodeA ?? '',
        observed.nodeB ?? '',
        observed.parentA ?? '',
        observed.parentB ?? '',
        observed.checkpointToken ?? '',
        observed.pendingCheckpointToken ?? ''
    ].join('|');
}

export function computeV2ResultId(
    attemptId: string,
    status: TimelineCommitResultStatus,
    observed: ObservedSnapshot
): string {
    return createHash('sha256')
        .update(`${attemptId}|${status}|${canonicalObserved(observed)}`)
        .digest('hex')
        .slice(0, 16);
}

export function validateNodeV2(node: unknown, id: string): JournalValidationError[] {
    const errors: JournalValidationError[] = [];
    if (!isObject(node)) {
        errors.push(new JournalValidationError('node_field_type', `node "${id}" is not an object`, { nodeId: id }));
        return errors;
    }
    const n = node as Record<string, unknown>;

    if (!isValidNodeId(id)) {
        errors.push(new JournalValidationError('node_id_invalid', `node id is not a valid a-b pair: "${id}"`, { nodeId: id }));
    }

    if (n.parentId !== null && typeof n.parentId !== 'string') {
        errors.push(new JournalValidationError('node_field_type', `node "${id}" field "parentId" must be a string or null, got ${typeof n.parentId}`, { nodeId: id, path: 'parentId' }));
    } else if (typeof n.parentId === 'string' && !isValidNodeId(n.parentId)) {
        errors.push(new JournalValidationError('node_id_invalid', `parent id is not a valid a-b pair: "${n.parentId}"`, { nodeId: id }));
    }

    if (typeof n.epoch !== 'number' || !Number.isFinite(n.epoch) || !Number.isInteger(n.epoch)) {
        errors.push(new JournalValidationError('epoch_not_integer', `node "${id}" epoch is not a finite integer: ${String(n.epoch)}`, { nodeId: id, path: 'epoch' }));
    } else if (n.epoch < 0) {
        errors.push(new JournalValidationError('epoch_negative', `node "${id}" epoch is negative: ${n.epoch}`, { nodeId: id, path: 'epoch' }));
    }

    if (typeof n.source !== 'string' || !V2_SOURCE_SET.has(n.source)) {
        errors.push(new JournalValidationError('source_unknown', `source is not a recognized v2 source: ${String(n.source)}`, { nodeId: id }));
    }

    if (typeof n.transitionAttemptId !== 'string' || n.transitionAttemptId.length === 0) {
        if (!('transitionAttemptId' in n)) {
            errors.push(new JournalValidationError('node_field_missing', `node "${id}" is missing required field "transitionAttemptId"`, { nodeId: id, path: 'transitionAttemptId' }));
        } else {
            errors.push(new JournalValidationError('node_field_type', `node "${id}" field "transitionAttemptId" must be a non-empty string, got ${typeof n.transitionAttemptId}`, { nodeId: id, path: 'transitionAttemptId' }));
        }
    }

    if ('checkpointCorrelationToken' in n && n.checkpointCorrelationToken !== undefined && !isValidCheckpointToken(n.checkpointCorrelationToken)) {
        errors.push(new JournalValidationError('token_invalid', `node "${id}" checkpoint correlation token is invalid: ${String(n.checkpointCorrelationToken)}`, { nodeId: id, path: 'checkpointCorrelationToken' }));
    }

    if (typeof n.createdAt !== 'string' || n.createdAt.length === 0) {
        if (!('createdAt' in n)) {
            errors.push(new JournalValidationError('node_field_missing', `node "${id}" is missing required field "createdAt"`, { nodeId: id, path: 'createdAt' }));
        } else {
            errors.push(new JournalValidationError('node_field_type', `node "${id}" field "createdAt" must be a non-empty string, got ${typeof n.createdAt}`, { nodeId: id, path: 'createdAt' }));
        }
    }

    return errors;
}

export function validateJournalEntry(entry: unknown): JournalValidationError[] {
    const errors: JournalValidationError[] = [];
    if (!isObject(entry)) {
        errors.push(new JournalValidationError('entry_field_type', `journal entry is not an object`, {}));
        return errors;
    }
    const e = entry as Record<string, unknown>;

    const requiredStrings: Array<keyof TransitionJournalEntry> = [
        'transitionAttemptId',
        'source',
        'requestKey',
        'targetNodeId',
        'startedAt',
        'updatedAt'
    ];
    for (const field of requiredStrings) {
        if (typeof e[field] !== 'string' || (e[field] as unknown as string).length === 0) {
            if (!(field in e)) {
                errors.push(new JournalValidationError('entry_field_missing', `entry is missing required field "${String(field)}"`, { attemptId: e.transitionAttemptId as string | undefined, path: String(field) }));
            } else {
                errors.push(new JournalValidationError('entry_field_type', `entry field "${String(field)}" must be a non-empty string, got ${typeof e[field]}`, { attemptId: e.transitionAttemptId as string | undefined, path: String(field) }));
            }
        }
    }

    if (typeof e.transitionAttemptId === 'string') {
        errors.forEach(err => { if (err.attemptId === undefined) err.attemptId = e.transitionAttemptId as string; });
    }

    if (typeof e.observedEpoch !== 'number' || !Number.isFinite(e.observedEpoch) || !Number.isInteger(e.observedEpoch) || e.observedEpoch < 0) {
        errors.push(new JournalValidationError('entry_field_type', `entry field "observedEpoch" must be a non-negative integer, got ${String(e.observedEpoch)}`, { path: 'observedEpoch' }));
    }

    if (typeof e.targetEpoch !== 'number' || !Number.isFinite(e.targetEpoch) || !Number.isInteger(e.targetEpoch) || e.targetEpoch < 0) {
        errors.push(new JournalValidationError('entry_field_type', `entry field "targetEpoch" must be a non-negative integer, got ${String(e.targetEpoch)}`, { path: 'targetEpoch' }));
    }

    if (typeof e.source !== 'string' || !V2_SOURCE_SET.has(e.source)) {
        errors.push(new JournalValidationError('source_unknown', `entry source is not a recognized v2 source: ${String(e.source)}`, { path: 'source' }));
    }

    if (typeof e.phase !== 'string' || !LEGAL_PHASES.has(e.phase as TransitionPhase)) {
        errors.push(new JournalValidationError('phase_invalid', `entry phase is not a legal transition phase: ${String(e.phase)}`, { path: 'phase' }));
    }

    if (typeof e.commitMode !== 'string' || !LEGAL_COMMIT_MODES.has(e.commitMode as TransitionCommitMode)) {
        errors.push(new JournalValidationError('commit_mode_invalid', `entry commitMode is not a legal commit mode: ${String(e.commitMode)}`, { path: 'commitMode' }));
    }

    if (e.graphParentNodeId !== null && typeof e.graphParentNodeId !== 'string') {
        errors.push(new JournalValidationError('entry_field_type', `entry field "graphParentNodeId" must be a string or null, got ${typeof e.graphParentNodeId}`, { path: 'graphParentNodeId' }));
    } else if (typeof e.graphParentNodeId === 'string' && !isValidNodeId(e.graphParentNodeId)) {
        errors.push(new JournalValidationError('node_id_invalid', `graph parent node id is not a valid a-b pair: "${e.graphParentNodeId}"`, { path: 'graphParentNodeId' }));
    }

    if (typeof e.targetNodeId !== 'string' || !isValidNodeId(e.targetNodeId)) {
        errors.push(new JournalValidationError('node_id_invalid', `target node id is not a valid a-b pair: "${String(e.targetNodeId)}"`, { path: 'targetNodeId' }));
    }

    if (!Array.isArray(e.recordIds)) {
        errors.push(new JournalValidationError('entry_field_type', `entry field "recordIds" must be an array`, { path: 'recordIds' }));
    } else {
        const seen = new Set<string>();
        for (const rid of e.recordIds) {
            if (typeof rid !== 'string' || rid.length === 0) {
                errors.push(new JournalValidationError('entry_field_type', `recordId must be a non-empty string, got ${typeof rid}`, { path: 'recordIds' }));
            } else if (seen.has(rid)) {
                errors.push(new JournalValidationError('record_id_duplicate', `duplicate recordId "${rid}" in entry`, { path: 'recordIds' }));
            } else {
                seen.add(rid);
            }
        }
    }

    if (!Array.isArray(e.commitResults)) {
        errors.push(new JournalValidationError('entry_field_type', `entry field "commitResults" must be an array`, { path: 'commitResults' }));
    } else {
        for (let i = 0; i < e.commitResults.length; i++) {
            const r = e.commitResults[i];
            const loc = `commitResults[${i}]`;
            if (!isObject(r)) {
                errors.push(new JournalValidationError('entry_field_type', `commitResult ${loc} must be an object`, { path: 'commitResults' }));
                continue;
            }
            const result = r as Record<string, unknown>;
            if (typeof result.resultId !== 'string' || result.resultId.length === 0) {
                if (!('resultId' in result)) {
                    errors.push(new JournalValidationError('entry_field_missing', `commitResult ${loc} is missing "resultId"`, { path: 'commitResults' }));
                } else {
                    errors.push(new JournalValidationError('entry_field_type', `commitResult ${loc} "resultId" must be a non-empty string, got ${typeof result.resultId}`, { path: 'commitResults' }));
                }
            }
            if (typeof result.attemptId !== 'string' || result.attemptId.length === 0) {
                if (!('attemptId' in result)) {
                    errors.push(new JournalValidationError('entry_field_missing', `commitResult ${loc} is missing "attemptId"`, { path: 'commitResults' }));
                } else {
                    errors.push(new JournalValidationError('entry_field_type', `commitResult ${loc} "attemptId" must be a non-empty string, got ${typeof result.attemptId}`, { path: 'commitResults' }));
                }
            }
            if (typeof result.status !== 'string' || !LEGAL_RESULT_STATUS_SET.has(result.status)) {
                errors.push(new JournalValidationError('entry_field_type', `commitResult ${loc} "status" is not a legal TimelineCommitResultStatus: ${String(result.status)}`, { path: 'commitResults' }));
            }
            if (!isObject(result.observed)) {
                errors.push(new JournalValidationError('entry_field_type', `commitResult ${loc} "observed" must be an object, got ${typeof result.observed}`, { path: 'commitResults' }));
            }
            if (typeof result.recordedAt !== 'string' || result.recordedAt.length === 0) {
                if (!('recordedAt' in result)) {
                    errors.push(new JournalValidationError('entry_field_missing', `commitResult ${loc} is missing "recordedAt"`, { path: 'commitResults' }));
                } else {
                    errors.push(new JournalValidationError('entry_field_type', `commitResult ${loc} "recordedAt" must be a non-empty string, got ${typeof result.recordedAt}`, { path: 'commitResults' }));
                }
            }
            if ('synthetic' in result && result.synthetic !== undefined && typeof result.synthetic !== 'boolean') {
                errors.push(new JournalValidationError('entry_field_type', `commitResult ${loc} "synthetic" must be a boolean, got ${typeof result.synthetic}`, { path: 'commitResults' }));
            }
        }
    }

    if (e.artifact !== undefined && e.artifact !== null) {
        if (!isObject(e.artifact)) {
            errors.push(new JournalValidationError('artifact_invalid', `entry artifact must be an object`, { path: 'artifact' }));
        } else {
            const a = e.artifact as Record<string, unknown>;
            if (typeof a.path !== 'string' || a.path.length === 0 || typeof a.sha256 !== 'string' || a.sha256.length === 0) {
                errors.push(new JournalValidationError('artifact_invalid', `entry artifact requires non-empty path and sha256`, { path: 'artifact' }));
            }
        }
    }

    if (e.terminalEvidence !== undefined && e.terminalEvidence !== null) {
        if (!isObject(e.terminalEvidence)) {
            errors.push(new JournalValidationError('entry_field_type', `terminalEvidence must be an object`, { path: 'terminalEvidence' }));
        } else if (Array.isArray(e.commitResults)) {
            const terminal = e.terminalEvidence as TimelineCommitResult;
            const found = e.commitResults.some((r: TimelineCommitResult) => r.resultId === terminal.resultId);
            if (!found) {
                errors.push(new JournalValidationError('terminal_evidence_not_in_results', `terminalEvidence resultId "${terminal.resultId}" is not present in commitResults`, { path: 'terminalEvidence' }));
            }
            if (typeof terminal.status !== 'string' || !LEGAL_TERMINAL_STATUS_SET.has(terminal.status)) {
                errors.push(new JournalValidationError('terminal_evidence_not_terminal', `terminalEvidence status "${String(terminal.status)}" is not a terminal status (must be one of ${LEGAL_TERMINAL_STATUSES.join(', ')})`, { path: 'terminalEvidence' }));
            }
        }
    }

    return errors;
}

export function validateJournalConsistency(
    entries: TransitionJournalEntry[],
    nodesById: Record<string, TimelineNodeV2>
): JournalValidationError[] {
    const errors: JournalValidationError[] = [];
    const seenAttemptIds = new Set<string>();
    const seenNodeIds = new Set<string>(Object.keys(nodesById));

    for (const entry of entries) {
        if (seenAttemptIds.has(entry.transitionAttemptId)) {
            errors.push(new JournalValidationError('duplicate_attempt_id', `duplicate transitionAttemptId "${entry.transitionAttemptId}"`, { attemptId: entry.transitionAttemptId }));
        } else {
            seenAttemptIds.add(entry.transitionAttemptId);
        }

        if (!seenNodeIds.has(entry.targetNodeId)) {
            errors.push(new JournalValidationError('target_node_missing', `entry "${entry.transitionAttemptId}" references missing targetNodeId "${entry.targetNodeId}"`, { attemptId: entry.transitionAttemptId, nodeId: entry.targetNodeId }));
        }
    }

    return errors;
}

export type ReconciliationAction =
    | 'reuse'
    | 'idempotent-update'
    | 'new-attempt'
    | 'replay-artifact'
    | 'ambiguous';

export interface ReconciliationInput {
    existing: TransitionJournalEntry | undefined;
    snapshot: ObservedSnapshot;
    requestKey: string;
    source: SourceKind;
}

export interface ReconciliationDecision {
    action: ReconciliationAction;
    reason: string;
}

function observedStateMatches(entry: TransitionJournalEntry, snapshot: ObservedSnapshot): boolean {
    if (entry.observedEpoch !== snapshot.epoch) return false;
    const entryNodeA = entry.observedCk3NodeId?.split('-')[0];
    const entryNodeB = entry.observedCk3NodeId?.split('-')[1];
    if (snapshot.nodeA !== undefined && snapshot.nodeA > 0) {
        if (entryNodeA !== undefined && entryNodeA !== String(snapshot.nodeA)) return false;
    }
    if (snapshot.nodeB !== undefined && snapshot.nodeB > 0) {
        if (entryNodeB !== undefined && entryNodeB !== String(snapshot.nodeB)) return false;
    }
    if (entry.observedCurrentToken !== undefined && snapshot.checkpointToken !== undefined) {
        if (entry.observedCurrentToken !== snapshot.checkpointToken) return false;
    }
    return true;
}

function targetStateMatches(entry: TransitionJournalEntry, snapshot: ObservedSnapshot): boolean {
    if (entry.targetEpoch !== snapshot.epoch) return false;
    const targetA = entry.targetNodeId.split('-')[0];
    const targetB = entry.targetNodeId.split('-')[1];
    if (snapshot.nodeA !== undefined && snapshot.nodeA > 0 && String(snapshot.nodeA) !== targetA) return false;
    if (snapshot.nodeB !== undefined && snapshot.nodeB > 0 && String(snapshot.nodeB) !== targetB) return false;
    return true;
}

export function classifyReconciliation(input: ReconciliationInput): ReconciliationDecision {
    const { existing, snapshot, requestKey, source } = input;

    if (existing === undefined) {
        return { action: 'new-attempt', reason: 'no existing attempt with this requestKey' };
    }

    if (existing.source !== source) {
        return { action: 'new-attempt', reason: 'source mismatch; not the same logical request' };
    }

    if (existing.phase === 'aborted') {
        return { action: 'new-attempt', reason: 'prior attempt aborted' };
    }

    const observedMatches = observedStateMatches(existing, snapshot);
    const targetMatches = targetStateMatches(existing, snapshot);

    if (existing.terminalEvidence !== undefined) {
        if (targetMatches) {
            return { action: 'idempotent-update', reason: '§9.2 rule 2: terminalEvidence present and CK3 node equals target' };
        }
        if (observedMatches) {
            return { action: 'new-attempt', reason: '§9.2 rule 3: terminalEvidence present, CK3 returned to observed state (save reload)' };
        }
        return { action: 'new-attempt', reason: '§9.2 rule 5b: requestKey matches, observed state differs, prior attempt has terminalEvidence' };
    }

    if (observedMatches) {
        if (existing.phase === 'artifact-written' || existing.phase === 'business-committed') {
            return { action: 'replay-artifact', reason: '§9.2 rule 4: no terminalEvidence, phase is artifact/business-committed, CK3 still at observed state' };
        }
        return { action: 'reuse', reason: '§9.2 rule 1: same requestKey, no terminalEvidence, observed state matches' };
    }

    return { action: 'ambiguous', reason: '§9.2 rule 5/8: same requestKey but observed state differs without terminalEvidence, or CK3 contradicts journal' };
}

export interface AppendCommitResultOutcome {
    added: boolean;
    conflict: boolean;
    terminalEvidenceSet: boolean;
    reason: string;
}

export class TransitionJournalStore {
    private readonly nodes: Map<string, TimelineNodeV2> = new Map();
    private readonly entries: Map<string, TransitionJournalEntry> = new Map();

    constructor(serialized?: SerializedJournalStore) {
        if (serialized) {
            if (serialized.nodes && typeof serialized.nodes === 'object') {
                for (const [id, node] of Object.entries(serialized.nodes)) {
                    if (node && typeof node === 'object') {
                        this.nodes.set(id, { ...node });
                    }
                }
            }
            if (Array.isArray(serialized.transitions)) {
                for (const entry of serialized.transitions) {
                    if (entry && typeof entry === 'object' && typeof entry.transitionAttemptId === 'string') {
                        this.entries.set(entry.transitionAttemptId, { ...entry });
                    }
                }
            }
        }
    }

    upsertNode(id: string, node: TimelineNodeV2): void {
        if (typeof id !== 'string' || id.length === 0) {
            throw new Error('TransitionJournalStore.upsertNode requires a non-empty node id');
        }
        this.nodes.set(id, { ...node });
    }

    upsertEntry(entry: TransitionJournalEntry): void {
        this.entries.set(entry.transitionAttemptId, { ...entry });
    }

    getNode(id: string): TimelineNodeV2 | undefined {
        const node = this.nodes.get(id);
        return node ? { ...node } : undefined;
    }

    getEntry(attemptId: string): TransitionJournalEntry | undefined {
        const entry = this.entries.get(attemptId);
        return entry ? { ...entry } : undefined;
    }

    getAllNodes(): TimelineNodeV2[] {
        return Array.from(this.nodes.values()).map(n => ({ ...n }));
    }

    getAllEntries(): TransitionJournalEntry[] {
        return Array.from(this.entries.values()).map(e => ({ ...e }));
    }

    findLiveAttemptByRequestKey(source: SourceKind, requestKey: string): TransitionJournalEntry | undefined {
        for (const entry of this.entries.values()) {
            if (entry.source === source && entry.requestKey === requestKey && entry.phase !== 'aborted') {
                return { ...entry };
            }
        }
        return undefined;
    }

    /**
     * Appends a TimelineCommitResult to the entry's commitResults array and,
     * if it is the first qualifying (terminal) result, sets terminalEvidence.
     *
     * Append-only asymmetry (§9.2 rule 7): commitResults only grows (we push
     * even on a conflict so the corrupting result is preserved for forensics),
     * whereas terminalEvidence is set-once-immutable (a second qualifying
     * result with different status/observed is recorded in commitResults but
     * never replaces terminalEvidence; it surfaces as a conflict instead).
     * Same-resultId replays are idempotent (no push) only when status+observed
     * match; otherwise they are conflicts without a push.
     */
    appendCommitResult(attemptId: string, result: TimelineCommitResult): AppendCommitResultOutcome {
        const entry = this.entries.get(attemptId);
        if (!entry) {
            throw new Error(`TransitionJournalStore.appendCommitResult: attempt "${attemptId}" not found`);
        }

        const existingSameId = entry.commitResults.find(r => r.resultId === result.resultId);
        if (existingSameId) {
            if (existingSameId.status !== result.status || canonicalObserved(existingSameId.observed) !== canonicalObserved(result.observed)) {
                return {
                    added: false,
                    conflict: true,
                    terminalEvidenceSet: false,
                    reason: '§9.2 rule 7: resultId collision with different status/observed -> store corrupt'
                };
            }
            return { added: false, conflict: false, terminalEvidenceSet: false, reason: 'idempotent: same resultId, same status, same observed' };
        }

        if (isTerminalResult(result)) {
            if (entry.terminalEvidence !== undefined) {
                if (entry.terminalEvidence.status !== result.status || canonicalObserved(entry.terminalEvidence.observed) !== canonicalObserved(result.observed)) {
                    entry.commitResults.push(result);
                    this.entries.set(attemptId, entry);
                    return {
                        added: true,
                        conflict: true,
                        terminalEvidenceSet: false,
                        reason: '§9.2 rule 7: conflicting qualifying result -> store corrupt'
                    };
                }
                entry.commitResults.push(result);
                this.entries.set(attemptId, entry);
                return { added: true, conflict: false, terminalEvidenceSet: false, reason: 'appended; terminalEvidence already set identically' };
            }
            entry.commitResults.push(result);
            entry.terminalEvidence = result as TerminalCommitResult;
            if (!result.synthetic) {
                entry.updatedAt = result.recordedAt;
            }
            this.entries.set(attemptId, entry);
            return { added: true, conflict: false, terminalEvidenceSet: true, reason: '§9.2 rule 7: first qualifying result set terminalEvidence' };
        }

        entry.commitResults.push(result);
        if (!result.synthetic) {
            entry.updatedAt = result.recordedAt;
        }
        this.entries.set(attemptId, entry);
        return { added: true, conflict: false, terminalEvidenceSet: false, reason: 'appended non-qualifying result' };
    }

    serialize(): SerializedJournalStore {
        const nodes: Record<string, TimelineNodeV2> = {};
        for (const [id, node] of this.nodes.entries()) {
            nodes[id] = { ...node };
        }
        return {
            nodes,
            transitions: Array.from(this.entries.values()).map(e => ({ ...e }))
        };
    }
}
