import { randomUUID } from 'crypto';
import {
    TransitionJournalStore,
    TransitionJournalEntry,
    TimelineNodeV2,
    TimelineCommitResult,
    TerminalCommitResult,
    TransitionPhase,
    TransitionCommitMode,
    ObservedSnapshot,
    SourceKind,
    ReconciliationDecision,
    classifyReconciliation,
    isLegalPhaseTransition,
    isTerminalResult,
    computeV2ResultId,
    AppendCommitResultOutcome
} from './timelineTransitionJournal.js';
import {
    FsTimelinePersistence,
    TimelineRegistry,
    TimelineStoreV2Payload
} from './timelineManager.js';
import type { CampaignPlayerIdentity } from '../shared/gameData/CampaignIdentity.js';

export interface BeginTransitionInput {
    snapshot: ObservedSnapshot;
    source: SourceKind;
    requestKey: string;
    eventSignature?: string;
    targetNodeId: string;
    targetEpoch: number;
    commitMode: TransitionCommitMode;
    graphParentNodeId: string | null;
    targetCorrelationToken?: number;
}

export interface AttemptTransitionHandle {
    attemptId: string;
    phase: TransitionPhase;
    recordIds: string[];
    reused: boolean;
    decision: ReconciliationDecision;
}

export interface SyntheticProofOutcome {
    syntheticProofAdded: boolean;
    synthetic: boolean;
    reloadRedoDetected: boolean;
    reason: string;
}

export interface JournalApiOptions {
    store: TransitionJournalStore;
    persistence: FsTimelinePersistence;
    identity: CampaignPlayerIdentity;
    registry: TimelineRegistry;
    now?: () => string;
    uuid?: () => string;
}

export type JournalApiErrorCode =
    | 'ambiguous_reconciliation'
    | 'illegal_phase_transition'
    | 'invalid_record_id'
    | 'duplicate_record_id'
    | 'missing_payload'
    | 'invalid_artifact'
    | 'attempt_id_mismatch'
    | 'attempt_not_found';

export class JournalApiError extends Error {
    readonly code: JournalApiErrorCode;

    constructor(code: JournalApiErrorCode, message: string) {
        super(message);
        this.name = 'JournalApiError';
        this.code = code;
    }
}

function formatCk3NodeId(snapshot: ObservedSnapshot): string | undefined {
    if (snapshot.nodeA !== undefined && snapshot.nodeB !== undefined && snapshot.nodeA > 0 && snapshot.nodeB > 0) {
        return `${snapshot.nodeA}-${snapshot.nodeB}`;
    }
    return undefined;
}

function formatCk3ParentId(snapshot: ObservedSnapshot): string | undefined {
    if (snapshot.parentA !== undefined && snapshot.parentB !== undefined && snapshot.parentA > 0 && snapshot.parentB > 0) {
        return `${snapshot.parentA}-${snapshot.parentB}`;
    }
    return undefined;
}

function observedEqualsTarget(entry: TransitionJournalEntry, snapshot: ObservedSnapshot): boolean {
    if (entry.targetEpoch !== snapshot.epoch) return false;
    const targetA = entry.targetNodeId.split('-')[0];
    const targetB = entry.targetNodeId.split('-')[1];
    if (snapshot.nodeA !== undefined && snapshot.nodeA > 0 && String(snapshot.nodeA) !== targetA) return false;
    if (snapshot.nodeB !== undefined && snapshot.nodeB > 0 && String(snapshot.nodeB) !== targetB) return false;
    return true;
}

function observedEqualsObserved(entry: TransitionJournalEntry, snapshot: ObservedSnapshot): boolean {
    if (entry.observedEpoch !== snapshot.epoch) return false;
    const entryNodeA = entry.observedCk3NodeId?.split('-')[0];
    const entryNodeB = entry.observedCk3NodeId?.split('-')[1];
    if (snapshot.nodeA !== undefined && snapshot.nodeA > 0) {
        if (entryNodeA !== undefined && entryNodeA !== String(snapshot.nodeA)) return false;
    }
    if (snapshot.nodeB !== undefined && snapshot.nodeB > 0) {
        if (entryNodeB !== undefined && entryNodeB !== String(snapshot.nodeB)) return false;
    }
    return true;
}

/**
 * Transition Journal API (§9.2 P5.2). Drives the attempt lifecycle via 7
 * functions backed by an in-memory TransitionJournalStore + atomic v2
 * envelope persistence.
 *
 * Persistence strategy: each state-changing API call persists the v2
 * envelope atomically (node+entry together) via saveStoreWithIdentity so
 * a crash never leaves the in-memory store ahead of durable storage.
 * saveStoreWithIdentity only early-returns when the registry is clean
 * *and* no v2 payload is supplied; since persist() always supplies a v2
 * payload, the envelope is rewritten on every call.
 */
export class TransitionJournalApi {
    private readonly store: TransitionJournalStore;
    private readonly persistence: FsTimelinePersistence;
    private readonly identity: CampaignPlayerIdentity;
    private readonly registry: TimelineRegistry;
    private readonly now: () => string;
    private readonly uuid: () => string;

    constructor(opts: JournalApiOptions) {
        this.store = opts.store;
        this.persistence = opts.persistence;
        this.identity = opts.identity;
        this.registry = opts.registry;
        this.now = opts.now ?? (() => new Date().toISOString());
        this.uuid = opts.uuid ?? (() => randomUUID());
    }

    getStore(): TransitionJournalStore {
        return this.store;
    }

    beginTransition(input: BeginTransitionInput): AttemptTransitionHandle {
        const existing = this.store.findLiveAttemptByRequestKey(input.source, input.requestKey);
        const decision = classifyReconciliation({
            existing,
            snapshot: input.snapshot,
            requestKey: input.requestKey,
            source: input.source
        });

        switch (decision.action) {
            case 'reuse':
            case 'replay-artifact':
            case 'idempotent-update': {
                const entry = this.store.getEntry(existing!.transitionAttemptId)!;
                return {
                    attemptId: entry.transitionAttemptId,
                    phase: entry.phase,
                    recordIds: [...entry.recordIds],
                    reused: true,
                    decision
                };
            }
            case 'ambiguous': {
                throw new JournalApiError(
                    'ambiguous_reconciliation',
                    `beginTransition refused: ${decision.reason}`
                );
            }
            case 'new-attempt': {
                const attemptId = this.uuid();
                const now = this.now();
                const observedCk3NodeId = formatCk3NodeId(input.snapshot);
                const observedCk3ParentId = formatCk3ParentId(input.snapshot);
                const entry: TransitionJournalEntry = {
                    transitionAttemptId: attemptId,
                    source: input.source,
                    requestKey: input.requestKey,
                    observedEpoch: input.snapshot.epoch ?? 0,
                    observedCk3NodeId,
                    observedCk3ParentId,
                    observedCurrentToken: input.snapshot.checkpointToken,
                    observedPendingToken: input.snapshot.pendingCheckpointToken,
                    graphParentNodeId: input.graphParentNodeId,
                    targetNodeId: input.targetNodeId,
                    targetEpoch: input.targetEpoch,
                    targetCorrelationToken: input.targetCorrelationToken,
                    commitMode: input.commitMode,
                    recordIds: [],
                    phase: 'preparing',
                    commitResults: [],
                    startedAt: now,
                    updatedAt: now
                };
                const node: TimelineNodeV2 = {
                    parentId: input.graphParentNodeId,
                    epoch: input.targetEpoch,
                    source: input.source,
                    transitionAttemptId: attemptId,
                    requestKey: input.requestKey,
                    eventSignature: input.eventSignature,
                    checkpointCorrelationToken: input.targetCorrelationToken,
                    createdAt: now
                };
                this.store.upsertNode(input.targetNodeId, node);
                this.store.upsertEntry(entry);
                this.persist();
                return {
                    attemptId,
                    phase: 'preparing',
                    recordIds: [],
                    reused: false,
                    decision
                };
            }
        }
    }

    commitTimelineStoreAttempt(attempt: AttemptTransitionHandle): void {
        this.transitionPhase(attempt, 'store-committed');
    }

    stageBusinessTransaction(
        attempt: AttemptTransitionHandle,
        recordIds: string[],
        payloads: Record<string, unknown>
    ): void {
        const entry = this.requireEntry(attempt.attemptId);
        if (entry.phase !== 'store-committed') {
            throw new JournalApiError(
                'illegal_phase_transition',
                `stageBusinessTransaction requires phase 'store-committed', got '${entry.phase}'`
            );
        }
        const seen = new Set<string>();
        for (const rid of recordIds) {
            if (typeof rid !== 'string' || rid.length === 0) {
                throw new JournalApiError('invalid_record_id', `recordId must be a non-empty string, got ${String(rid)}`);
            }
            if (seen.has(rid)) {
                throw new JournalApiError('duplicate_record_id', `duplicate recordId "${rid}"`);
            }
            seen.add(rid);
        }
        for (const rid of recordIds) {
            if (!(rid in payloads)) {
                throw new JournalApiError(
                    'missing_payload',
                    `stageBusinessTransaction: recordId "${rid}" has no payload`
                );
            }
        }
        const updated: TransitionJournalEntry = {
            ...entry,
            recordIds: [...recordIds],
            phase: 'business-committed',
            updatedAt: this.now()
        };
        this.store.upsertEntry(updated);
        attempt.phase = 'business-committed';
        attempt.recordIds = [...recordIds];
        this.persist();
    }

    markArtifactWritten(
        attempt: AttemptTransitionHandle,
        artifactPath: string,
        sha256: string
    ): void {
        const entry = this.requireEntry(attempt.attemptId);
        if (entry.phase !== 'business-committed') {
            throw new JournalApiError(
                'illegal_phase_transition',
                `markArtifactWritten requires phase 'business-committed', got '${entry.phase}'`
            );
        }
        if (typeof artifactPath !== 'string' || artifactPath.length === 0) {
            throw new JournalApiError('invalid_artifact', 'artifact path must be a non-empty string');
        }
        if (typeof sha256 !== 'string' || sha256.length === 0) {
            throw new JournalApiError('invalid_artifact', 'artifact sha256 must be a non-empty string');
        }
        const updated: TransitionJournalEntry = {
            ...entry,
            artifact: { path: artifactPath, sha256 },
            phase: 'artifact-written',
            updatedAt: this.now()
        };
        this.store.upsertEntry(updated);
        attempt.phase = 'artifact-written';
        this.persist();
    }

    applyCommitResult(attemptId: string, result: TimelineCommitResult): AppendCommitResultOutcome {
        const entry = this.requireEntry(attemptId);
        if (result.attemptId !== attemptId) {
            throw new JournalApiError(
                'attempt_id_mismatch',
                `applyCommitResult: result.attemptId "${result.attemptId}" does not match attemptId "${attemptId}"`
            );
        }
        const outcome = this.store.appendCommitResult(attemptId, result);
        this.persist();
        return outcome;
    }

    /**
     * §9.2 rule 6 + rule 3 detection.
     *
     * Rule 6: when a result log line was lost but a later snapshot precisely
     * equals the attempt's target state, the journal may synthesize an
     * `already-applied` terminal result to repair the lost evidence. The
     * synthetic result is auditable (its `synthetic` flag is set to true)
     * and must never overwrite a real terminalEvidence.
     *
     * Rule 3 detection: when terminalEvidence is already present and a fresh
     * snapshot equals the attempt's *observed* (not target) state, the CK3
     * save was reloaded back to the pre-transition checkpoint - the caller
     * should start a new attempt rather than reuse this one.
     */
    reconcileAttemptFromSnapshot(attemptId: string, snapshot: ObservedSnapshot): SyntheticProofOutcome {
        const entry = this.requireEntry(attemptId);

        // Rule 3 detection: terminalEvidence present + CK3 == observed (not target)
        if (entry.terminalEvidence !== undefined) {
            const matchesObserved = observedEqualsObserved(entry, snapshot);
            const matchesTarget = observedEqualsTarget(entry, snapshot);
            if (matchesObserved && !matchesTarget) {
                return {
                    syntheticProofAdded: false,
                    synthetic: false,
                    reloadRedoDetected: true,
                    reason: '§9.2 rule 3: terminalEvidence present and CK3 returned to observed state (save reload)'
                };
            }
            // terminalEvidence already present and not a reload-redo: nothing to synthesize.
            return {
                syntheticProofAdded: false,
                synthetic: false,
                reloadRedoDetected: false,
                reason: 'terminalEvidence already present'
            };
        }

        // Rule 6: snapshot precisely equals target -> synthesize already-applied.
        if (!observedEqualsTarget(entry, snapshot)) {
            return {
                syntheticProofAdded: false,
                synthetic: false,
                reloadRedoDetected: false,
                reason: 'snapshot does not precisely equal target; cannot synthesize proof'
            };
        }

        const syntheticObserved: ObservedSnapshot = {
            epoch: entry.targetEpoch,
            nodeA: Number(entry.targetNodeId.split('-')[0]),
            nodeB: Number(entry.targetNodeId.split('-')[1]),
            checkpointToken: snapshot.checkpointToken ?? entry.targetCorrelationToken
        };
        const syntheticResult: TimelineCommitResult = {
            resultId: computeV2ResultId(attemptId, 'already-applied', syntheticObserved),
            attemptId,
            status: 'already-applied',
            observed: syntheticObserved,
            recordedAt: this.now(),
            synthetic: true
        };
        const outcome = this.store.appendCommitResult(attemptId, syntheticResult);
        this.persist();
        return {
            syntheticProofAdded: outcome.terminalEvidenceSet,
            synthetic: true,
            reloadRedoDetected: false,
            reason: outcome.reason
        };
    }

    abortTransition(attempt: AttemptTransitionHandle, reason: string): void {
        const entry = this.requireEntry(attempt.attemptId);
        if (entry.phase === 'aborted') {
            throw new JournalApiError(
                'illegal_phase_transition',
                `abortTransition: attempt is already aborted`
            );
        }
        if (!isLegalPhaseTransition(entry.phase, 'aborted')) {
            throw new JournalApiError(
                'illegal_phase_transition',
                `abortTransition: cannot abort from phase '${entry.phase}'`
            );
        }
        const updated: TransitionJournalEntry = {
            ...entry,
            phase: 'aborted',
            abortReason: reason,
            updatedAt: this.now()
        };
        this.store.upsertEntry(updated);
        attempt.phase = 'aborted';
        this.persist();
    }

    private requireEntry(attemptId: string): TransitionJournalEntry {
        const entry = this.store.getEntry(attemptId);
        if (!entry) {
            throw new JournalApiError('attempt_not_found', `attempt "${attemptId}" not found in journal store`);
        }
        return entry;
    }

    private transitionPhase(attempt: AttemptTransitionHandle, to: TransitionPhase): void {
        const entry = this.requireEntry(attempt.attemptId);
        if (entry.phase === to) {
            // Idempotent: mirror the handle's phase but still persist for
            // durability symmetry (one atomic envelope rewrite is cheap).
            attempt.phase = to;
            this.persist();
            return;
        }
        if (!isLegalPhaseTransition(entry.phase, to)) {
            throw new JournalApiError(
                'illegal_phase_transition',
                `illegal phase transition: '${entry.phase}' -> '${to}'`
            );
        }
        const updated: TransitionJournalEntry = {
            ...entry,
            phase: to,
            updatedAt: this.now()
        };
        this.store.upsertEntry(updated);
        attempt.phase = to;
        this.persist();
    }

    private persist(): void {
        const serialized = this.store.serialize();
        const v2: TimelineStoreV2Payload = {
            nodes: serialized.nodes,
            transitions: serialized.transitions
        };
        this.persistence.saveStoreWithIdentity(this.identity, this.registry, v2);
    }
}
