import {
    TimelineNodeV2,
    TransitionJournalEntry,
    TimelineCommitResult,
    TerminalCommitResult,
    TimelineCommitResultStatus,
    TransitionJournalStore,
    validateNodeV2,
    validateJournalEntry,
    validateJournalConsistency,
    isTerminalResult,
    isLegalPhaseTransition,
    classifyReconciliation,
    computeV2ResultId,
    LEGAL_TERMINAL_STATUSES
} from '../../src/main/timelineTransitionJournal';
import {
    FsTimelinePersistence,
    TimelineRegistry,
    isRecordVisibleForContext,
    resolveTimelineContext
} from '../../src/main/timelineManager';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import fs from 'fs';
import path from 'path';
import os from 'os';

const NOW = '2026-07-21T00:00:00Z';
const LATER = '2026-07-21T01:00:00Z';

function makeV2Node(overrides: Partial<TimelineNodeV2> = {}): TimelineNodeV2 {
    return {
        parentId: null,
        epoch: 1,
        source: 'conversation',
        transitionAttemptId: 'att-001',
        createdAt: NOW,
        ...overrides
    };
}

function makeJournalEntry(overrides: Partial<TransitionJournalEntry> = {}): TransitionJournalEntry {
    return {
        transitionAttemptId: 'att-001',
        source: 'conversation',
        requestKey: 'req-key-1',
        observedEpoch: 1,
        graphParentNodeId: null,
        targetNodeId: '101-202',
        targetEpoch: 2,
        commitMode: 'atomic-advance',
        recordIds: [],
        phase: 'preparing',
        commitResults: [],
        startedAt: NOW,
        updatedAt: NOW,
        ...overrides
    };
}

function makeResult(status: TimelineCommitResultStatus, attemptId = 'att-001', observed: Record<string, unknown> = {}): TimelineCommitResult {
    return {
        resultId: computeV2ResultId(attemptId, status, observed),
        attemptId,
        status,
        observed,
        recordedAt: NOW
    } as TimelineCommitResult;
}

describe('TimelineNodeV2 type', () => {
    it('has required fields: parentId, epoch, source, transitionAttemptId, createdAt', () => {
        const node = makeV2Node();
        expect(node.parentId).toBeNull();
        expect(node.epoch).toBe(1);
        expect(node.source).toBe('conversation');
        expect(node.transitionAttemptId).toBe('att-001');
        expect(typeof node.createdAt).toBe('string');
    });

    it('does not use eventKey; uses eventSignature (optional) instead', () => {
        const node = makeV2Node({ eventSignature: 'conv:sig-1' });
        expect((node as unknown as Record<string, unknown>).eventKey).toBeUndefined();
        expect(node.eventSignature).toBe('conv:sig-1');
    });

    it('has optional requestKey, checkpointCorrelationToken, committedAt', () => {
        const node = makeV2Node({
            requestKey: 'req-1',
            checkpointCorrelationToken: 42,
            committedAt: LATER
        });
        expect(node.requestKey).toBe('req-1');
        expect(node.checkpointCorrelationToken).toBe(42);
        expect(node.committedAt).toBe(LATER);
    });
});

describe('TransitionJournalEntry type', () => {
    it('has all required fields per §9.2', () => {
        const entry = makeJournalEntry();
        expect(entry.transitionAttemptId).toBe('att-001');
        expect(entry.source).toBe('conversation');
        expect(entry.requestKey).toBe('req-key-1');
        expect(entry.observedEpoch).toBe(1);
        expect(entry.graphParentNodeId).toBeNull();
        expect(entry.targetNodeId).toBe('101-202');
        expect(entry.targetEpoch).toBe(2);
        expect(entry.commitMode).toBe('atomic-advance');
        expect(entry.recordIds).toEqual([]);
        expect(entry.phase).toBe('preparing');
        expect(entry.commitResults).toEqual([]);
        expect(typeof entry.startedAt).toBe('string');
        expect(typeof entry.updatedAt).toBe('string');
    });

    it('commitResults is an array of TimelineCommitResult', () => {
        const result = makeResult('applied');
        const entry = makeJournalEntry({ commitResults: [result] });
        expect(entry.commitResults.length).toBe(1);
        expect(entry.commitResults[0].status).toBe('applied');
    });

    it('terminalEvidence is optional and holds a TerminalCommitResult', () => {
        const terminal = makeResult('applied') as TerminalCommitResult;
        const entry = makeJournalEntry({ terminalEvidence: terminal });
        expect(entry.terminalEvidence?.status).toBe('applied');
    });

    it('commitMode accepts both atomic-advance and post-bump-node-only', () => {
        const e1 = makeJournalEntry({ commitMode: 'atomic-advance' });
        const e2 = makeJournalEntry({ commitMode: 'post-bump-node-only' });
        expect(e1.commitMode).toBe('atomic-advance');
        expect(e2.commitMode).toBe('post-bump-node-only');
    });
});

describe('TimelineCommitResult and terminal statuses', () => {
    it('isTerminalResult returns true for applied, already-applied, skipped-advanced', () => {
        expect(isTerminalResult(makeResult('applied'))).toBe(true);
        expect(isTerminalResult(makeResult('already-applied'))).toBe(true);
        expect(isTerminalResult(makeResult('skipped-advanced'))).toBe(true);
    });

    it('isTerminalResult returns false for non-terminal statuses', () => {
        expect(isTerminalResult(makeResult('skipped-delivery-mismatch'))).toBe(false);
        expect(isTerminalResult(makeResult('ambiguous-node'))).toBe(false);
        expect(isTerminalResult(makeResult('ambiguous-state'))).toBe(false);
    });

    it('LEGAL_TERMINAL_STATUSES lists the three qualifying statuses', () => {
        expect(LEGAL_TERMINAL_STATUSES).toEqual(['applied', 'already-applied', 'skipped-advanced']);
    });
});

describe('TransitionJournalStore.appendCommitResult (§9.2 rule 7)', () => {
    it('appends a new resultId to commitResults', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        const result = makeResult('applied');
        const outcome = store.appendCommitResult('att-001', result);
        expect(outcome.added).toBe(true);
        expect(outcome.conflict).toBe(false);
        const entry = store.getEntry('att-001')!;
        expect(entry.commitResults.length).toBe(1);
        expect(entry.commitResults[0].resultId).toBe(result.resultId);
    });

    it('idempotent: appending the same resultId is a no-op', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        const result = makeResult('applied');
        store.appendCommitResult('att-001', result);
        const outcome = store.appendCommitResult('att-001', result);
        expect(outcome.added).toBe(false);
        expect(outcome.conflict).toBe(false);
        expect(store.getEntry('att-001')!.commitResults.length).toBe(1);
    });

    it('conflict: same resultId with different status is a conflict', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        const r1 = makeResult('applied');
        // Same resultId computation but we force a different status by using
        // a different observed state so resultId differs. For same-resultId
        // conflict test, we manually craft two results with the same resultId.
        const r2: TimelineCommitResult = {
            ...r1,
            status: 'ambiguous-state'
        } as TimelineCommitResult;
        store.appendCommitResult('att-001', r1);
        const outcome = store.appendCommitResult('att-001', r2);
        expect(outcome.conflict).toBe(true);
    });

    it('first qualifying (terminal) result sets terminalEvidence', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        const result = makeResult('applied') as TerminalCommitResult;
        const outcome = store.appendCommitResult('att-001', result);
        expect(outcome.terminalEvidenceSet).toBe(true);
        expect(store.getEntry('att-001')!.terminalEvidence?.status).toBe('applied');
    });

    it('non-qualifying result does not set terminalEvidence', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        const result = makeResult('ambiguous-node');
        const outcome = store.appendCommitResult('att-001', result);
        expect(outcome.terminalEvidenceSet).toBe(false);
        expect(store.getEntry('att-001')!.terminalEvidence).toBeUndefined();
    });

    it('terminalEvidence is immutable: a subsequent non-qualifying result does not clear it', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        store.appendCommitResult('att-001', makeResult('applied') as TerminalCommitResult);
        const outcome = store.appendCommitResult('att-001', makeResult('ambiguous-node'));
        expect(outcome.terminalEvidenceSet).toBe(false);
        expect(store.getEntry('att-001')!.terminalEvidence?.status).toBe('applied');
    });

    it('terminalEvidence is immutable: a subsequent qualifying result with same status+observed is idempotent', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        const terminal = makeResult('applied') as TerminalCommitResult;
        store.appendCommitResult('att-001', terminal);
        const outcome = store.appendCommitResult('att-001', terminal);
        expect(outcome.conflict).toBe(false);
        expect(store.getEntry('att-001')!.terminalEvidence?.status).toBe('applied');
    });

    it('conflicting qualifying result (different status) is a conflict', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        store.appendCommitResult('att-001', makeResult('applied') as TerminalCommitResult);
        // Different terminal status with a different observed to get a different resultId
        const conflicting = makeResult('already-applied', 'att-001', { epoch: 99 });
        const outcome = store.appendCommitResult('att-001', conflicting);
        expect(outcome.conflict).toBe(true);
    });

    it('append-only: commitResults array only grows, never shrinks', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        store.appendCommitResult('att-001', makeResult('ambiguous-node'));
        store.appendCommitResult('att-001', makeResult('applied') as TerminalCommitResult);
        store.appendCommitResult('att-001', makeResult('ambiguous-state', 'att-001', { epoch: 5 }));
        const entry = store.getEntry('att-001')!;
        expect(entry.commitResults.length).toBe(3);
    });

    it('throws when attemptId does not exist', () => {
        const store = new TransitionJournalStore();
        expect(() => store.appendCommitResult('missing', makeResult('applied'))).toThrow();
    });

    it('non-synthetic terminal result sets updatedAt from recordedAt', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry({ updatedAt: NOW }));
        const terminal = makeResult('applied') as TerminalCommitResult;
        terminal.recordedAt = LATER;
        store.appendCommitResult('att-001', terminal);
        expect(store.getEntry('att-001')!.updatedAt).toBe(LATER);
    });

    it('synthetic terminal result does NOT poison updatedAt (keeps prior clean ISO timestamp)', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry({ updatedAt: NOW }));
        const synthetic = makeResult('already-applied') as TimelineCommitResult;
        synthetic.synthetic = true;
        synthetic.recordedAt = LATER;
        store.appendCommitResult('att-001', synthetic);
        const entry = store.getEntry('att-001')!;
        expect(entry.terminalEvidence?.synthetic).toBe(true);
        // updatedAt must not be overwritten by the synthetic result.
        expect(entry.updatedAt).toBe(NOW);
    });

    it('synthetic non-terminal result does NOT poison updatedAt', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry({ updatedAt: NOW }));
        const synthetic = makeResult('ambiguous-node') as TimelineCommitResult;
        synthetic.synthetic = true;
        synthetic.recordedAt = LATER;
        store.appendCommitResult('att-001', synthetic);
        const entry = store.getEntry('att-001')!;
        expect(entry.updatedAt).toBe(NOW);
    });
});

describe('phase transitions', () => {
    it('preparing -> store-committed is legal', () => {
        expect(isLegalPhaseTransition('preparing', 'store-committed')).toBe(true);
    });

    it('store-committed -> business-committed is legal', () => {
        expect(isLegalPhaseTransition('store-committed', 'business-committed')).toBe(true);
    });

    it('business-committed -> artifact-written is legal', () => {
        expect(isLegalPhaseTransition('business-committed', 'artifact-written')).toBe(true);
    });

    it('any non-terminal phase -> aborted is legal', () => {
        expect(isLegalPhaseTransition('preparing', 'aborted')).toBe(true);
        expect(isLegalPhaseTransition('store-committed', 'aborted')).toBe(true);
        expect(isLegalPhaseTransition('business-committed', 'aborted')).toBe(true);
        expect(isLegalPhaseTransition('artifact-written', 'aborted')).toBe(true);
    });

    it('backwards transitions are illegal', () => {
        expect(isLegalPhaseTransition('store-committed', 'preparing')).toBe(false);
        expect(isLegalPhaseTransition('business-committed', 'store-committed')).toBe(false);
        expect(isLegalPhaseTransition('artifact-written', 'business-committed')).toBe(false);
    });

    it('aborted is terminal: no transition out is legal', () => {
        expect(isLegalPhaseTransition('aborted', 'preparing')).toBe(false);
        expect(isLegalPhaseTransition('aborted', 'store-committed')).toBe(false);
        expect(isLegalPhaseTransition('aborted', 'aborted')).toBe(false);
    });

    it('same-phase is a no-op (legal, idempotent)', () => {
        expect(isLegalPhaseTransition('preparing', 'preparing')).toBe(true);
        expect(isLegalPhaseTransition('store-committed', 'store-committed')).toBe(true);
        expect(isLegalPhaseTransition('artifact-written', 'artifact-written')).toBe(true);
    });
});

describe('validateNodeV2', () => {
    it('accepts a valid v2 node', () => {
        const errors = validateNodeV2(makeV2Node(), '101-202');
        expect(errors).toEqual([]);
    });

    it('rejects a missing transitionAttemptId', () => {
        const node = makeV2Node();
        delete (node as Partial<TimelineNodeV2>).transitionAttemptId;
        const errors = validateNodeV2(node, '101-202');
        expect(errors.map(e => e.code)).toContain('node_field_missing');
    });

    it('rejects a non-integer epoch', () => {
        const errors = validateNodeV2(makeV2Node({ epoch: 1.5 }), '101-202');
        expect(errors.map(e => e.code)).toContain('epoch_not_integer');
    });

    it('rejects an unknown source', () => {
        const errors = validateNodeV2(makeV2Node({ source: 'unknown' as any }), '101-202');
        expect(errors.map(e => e.code)).toContain('source_unknown');
    });

    it('rejects an invalid node id', () => {
        const errors = validateNodeV2(makeV2Node(), 'not-a-node');
        expect(errors.map(e => e.code)).toContain('node_id_invalid');
    });
});

describe('validateJournalEntry', () => {
    it('accepts a valid entry', () => {
        const errors = validateJournalEntry(makeJournalEntry());
        expect(errors).toEqual([]);
    });

    it('rejects a missing transitionAttemptId', () => {
        const entry = makeJournalEntry();
        delete (entry as Partial<TransitionJournalEntry>).transitionAttemptId;
        expect(validateJournalEntry(entry).map(e => e.code)).toContain('entry_field_missing');
    });

    it('rejects a missing requestKey', () => {
        const entry = makeJournalEntry();
        delete (entry as Partial<TransitionJournalEntry>).requestKey;
        expect(validateJournalEntry(entry).map(e => e.code)).toContain('entry_field_missing');
    });

    it('rejects an unknown phase', () => {
        const entry = makeJournalEntry({ phase: 'unknown' as any });
        expect(validateJournalEntry(entry).map(e => e.code)).toContain('phase_invalid');
    });

    it('rejects an unknown commitMode', () => {
        const entry = makeJournalEntry({ commitMode: 'unknown' as any });
        expect(validateJournalEntry(entry).map(e => e.code)).toContain('commit_mode_invalid');
    });

    it('rejects terminalEvidence that is not present in commitResults', () => {
        const terminal = makeResult('applied') as TerminalCommitResult;
        const entry = makeJournalEntry({
            commitResults: [],
            terminalEvidence: terminal
        });
        expect(validateJournalEntry(entry).map(e => e.code)).toContain('terminal_evidence_not_in_results');
    });

    it('accepts terminalEvidence that matches a commitResult by resultId', () => {
        const terminal = makeResult('applied') as TerminalCommitResult;
        const entry = makeJournalEntry({
            commitResults: [terminal],
            terminalEvidence: terminal
        });
        expect(validateJournalEntry(entry)).toEqual([]);
    });

    it('rejects duplicate recordIds within an entry', () => {
        const entry = makeJournalEntry({ recordIds: ['rec-1', 'rec-1'] });
        expect(validateJournalEntry(entry).map(e => e.code)).toContain('record_id_duplicate');
    });

    it('rejects an artifact with missing sha256', () => {
        const entry = makeJournalEntry({
            artifact: { path: '/some/path', sha256: '' }
        });
        expect(validateJournalEntry(entry).map(e => e.code)).toContain('artifact_invalid');
    });

    it('rejects commitResults entries that are not objects', () => {
        const entry = makeJournalEntry({
            commitResults: ['not-an-object' as unknown as TimelineCommitResult]
        });
        expect(validateJournalEntry(entry).map(e => e.code)).toContain('entry_field_type');
    });

    it('rejects a commitResult with a missing resultId', () => {
        const result = makeResult('applied');
        delete (result as Partial<TimelineCommitResult>).resultId;
        const entry = makeJournalEntry({ commitResults: [result] });
        const codes = validateJournalEntry(entry).map(e => e.code);
        expect(codes).toContain('entry_field_missing');
    });

    it('rejects a commitResult with an empty resultId', () => {
        const result: TimelineCommitResult = { ...makeResult('applied'), resultId: '' };
        const entry = makeJournalEntry({ commitResults: [result] });
        const codes = validateJournalEntry(entry).map(e => e.code);
        expect(codes).toContain('entry_field_type');
    });

    it('rejects a commitResult with a missing attemptId', () => {
        const result = makeResult('applied');
        delete (result as Partial<TimelineCommitResult>).attemptId;
        const entry = makeJournalEntry({ commitResults: [result] });
        const codes = validateJournalEntry(entry).map(e => e.code);
        expect(codes).toContain('entry_field_missing');
    });

    it('rejects a commitResult with a bogus status', () => {
        const result: TimelineCommitResult = {
            ...makeResult('applied'),
            status: 'bogus' as unknown as TimelineCommitResultStatus
        };
        const entry = makeJournalEntry({ commitResults: [result] });
        const codes = validateJournalEntry(entry).map(e => e.code);
        expect(codes).toContain('entry_field_type');
    });

    it('rejects a commitResult with observed that is not an object', () => {
        const result: TimelineCommitResult = {
            ...makeResult('applied'),
            observed: 'not-an-object' as unknown as Record<string, unknown>
        };
        const entry = makeJournalEntry({ commitResults: [result] });
        const codes = validateJournalEntry(entry).map(e => e.code);
        expect(codes).toContain('entry_field_type');
    });

    it('rejects a commitResult with a missing recordedAt', () => {
        const result = makeResult('applied');
        delete (result as Partial<TimelineCommitResult>).recordedAt;
        const entry = makeJournalEntry({ commitResults: [result] });
        const codes = validateJournalEntry(entry).map(e => e.code);
        expect(codes).toContain('entry_field_missing');
    });

    it('accepts a commitResult with synthetic: true (optional structured flag)', () => {
        const result = makeResult('applied') as TimelineCommitResult;
        result.synthetic = true;
        const entry = makeJournalEntry({ commitResults: [result] });
        expect(validateJournalEntry(entry)).toEqual([]);
    });

    it('accepts a commitResult without the synthetic field (optional)', () => {
        const result = makeResult('applied') as TimelineCommitResult;
        delete (result as Partial<TimelineCommitResult>).synthetic;
        const entry = makeJournalEntry({ commitResults: [result] });
        expect(validateJournalEntry(entry)).toEqual([]);
    });

    it('rejects a commitResult with a non-boolean synthetic field', () => {
        const result = makeResult('applied') as TimelineCommitResult;
        (result as Partial<TimelineCommitResult>).synthetic = 'true' as unknown as boolean;
        const entry = makeJournalEntry({ commitResults: [result] });
        const codes = validateJournalEntry(entry).map(e => e.code);
        expect(codes).toContain('entry_field_type');
    });

    it('accepts well-formed commitResults entries', () => {
        const terminal = makeResult('applied') as TerminalCommitResult;
        const entry = makeJournalEntry({ commitResults: [terminal] });
        expect(validateJournalEntry(entry)).toEqual([]);
    });
});

describe('validateJournalConsistency (cross-entry)', () => {
    it('accepts a consistent set of entries and nodes', () => {
        const node = makeV2Node({ transitionAttemptId: 'att-001' });
        const entry = makeJournalEntry({
            transitionAttemptId: 'att-001',
            targetNodeId: '101-202',
            phase: 'store-committed',
            commitResults: [],
            terminalEvidence: undefined
        });
        const errors = validateJournalConsistency([entry], { '101-202': node });
        expect(errors).toEqual([]);
    });

    it('rejects duplicate transitionAttemptId across entries', () => {
        const entry1 = makeJournalEntry({ transitionAttemptId: 'att-001' });
        const entry2 = makeJournalEntry({ transitionAttemptId: 'att-001' });
        const errors = validateJournalConsistency([entry1, entry2], {});
        expect(errors.map(e => e.code)).toContain('duplicate_attempt_id');
    });

    it('rejects an entry whose targetNodeId does not exist in nodes', () => {
        const entry = makeJournalEntry({ targetNodeId: '999-999' });
        const errors = validateJournalConsistency([entry], {});
        expect(errors.map(e => e.code)).toContain('target_node_missing');
    });

    it('rejects conflicting terminalEvidence (terminal set but not in commitResults)', () => {
        const terminal = makeResult('applied') as TerminalCommitResult;
        const entry = makeJournalEntry({
            commitResults: [],
            terminalEvidence: terminal
        });
        const errors = validateJournalEntry(entry);
        expect(errors.map(e => e.code)).toContain('terminal_evidence_not_in_results');
    });

    it('rejects terminalEvidence whose status is non-terminal', () => {
        const nonTerminal = makeResult('ambiguous-node');
        const entry = makeJournalEntry({
            commitResults: [nonTerminal],
            terminalEvidence: nonTerminal as unknown as TerminalCommitResult
        });
        const codes = validateJournalEntry(entry).map(e => e.code);
        expect(codes).toContain('terminal_evidence_not_terminal');
    });

    it('rejects terminalEvidence with status ambiguous-state even if in commitResults', () => {
        const nonTerminal = makeResult('ambiguous-state');
        const entry = makeJournalEntry({
            commitResults: [nonTerminal],
            terminalEvidence: nonTerminal as unknown as TerminalCommitResult
        });
        const codes = validateJournalEntry(entry).map(e => e.code);
        expect(codes).toContain('terminal_evidence_not_terminal');
    });
});

describe('classifyReconciliation (§9.2 rules 1-6, 8)', () => {
    it('rule 1: same requestKey, no terminalEvidence, same observed state -> reuse', () => {
        const existing = makeJournalEntry({
            requestKey: 'req-1',
            source: 'conversation',
            observedEpoch: 5,
            observedCk3NodeId: '11-22',
            observedCk3ParentId: '33-44',
            observedCurrentToken: 100,
            phase: 'store-committed',
            terminalEvidence: undefined,
            commitResults: []
        });
        const snapshot = {
            epoch: 5,
            nodeA: 11,
            nodeB: 22,
            parentA: 33,
            parentB: 44,
            checkpointToken: 100
        };
        const decision = classifyReconciliation({
            existing,
            snapshot,
            requestKey: 'req-1',
            source: 'conversation'
        });
        expect(decision.action).toBe('reuse');
    });

    it('rule 1: different requestKey -> new-attempt (no existing to reuse)', () => {
        const decision = classifyReconciliation({
            existing: undefined,
            snapshot: { epoch: 5 },
            requestKey: 'req-2',
            source: 'conversation'
        });
        expect(decision.action).toBe('new-attempt');
    });

    it('rule 2: terminalEvidence present, CK3 node == target -> idempotent-update', () => {
        const existing = makeJournalEntry({
            requestKey: 'req-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            observedEpoch: 5,
            terminalEvidence: makeResult('applied') as TerminalCommitResult,
            phase: 'artifact-written'
        });
        const snapshot = {
            epoch: 6,
            nodeA: 101,
            nodeB: 202
        };
        const decision = classifyReconciliation({
            existing,
            snapshot,
            requestKey: 'req-1',
            source: 'conversation'
        });
        expect(decision.action).toBe('idempotent-update');
    });

    it('rule 3: terminalEvidence present, CK3 == observed (not target) -> new-attempt (save reload)', () => {
        const existing = makeJournalEntry({
            requestKey: 'req-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            observedEpoch: 5,
            observedCk3NodeId: '33-44',
            terminalEvidence: makeResult('applied') as TerminalCommitResult,
            phase: 'artifact-written'
        });
        const snapshot = {
            epoch: 5,
            nodeA: 33,
            nodeB: 44
        };
        const decision = classifyReconciliation({
            existing,
            snapshot,
            requestKey: 'req-1',
            source: 'conversation'
        });
        expect(decision.action).toBe('new-attempt');
    });

    it('rule 4: no terminalEvidence, phase=artifact-written, CK3 == observed -> replay-artifact', () => {
        const existing = makeJournalEntry({
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '33-44',
            targetNodeId: '101-202',
            targetEpoch: 6,
            phase: 'artifact-written',
            terminalEvidence: undefined,
            commitResults: []
        });
        const snapshot = {
            epoch: 5,
            nodeA: 33,
            nodeB: 44
        };
        const decision = classifyReconciliation({
            existing,
            snapshot,
            requestKey: 'req-1',
            source: 'conversation'
        });
        expect(decision.action).toBe('replay-artifact');
    });

    it('rule 5: same requestKey, different observed, no terminalEvidence -> ambiguous', () => {
        const existing = makeJournalEntry({
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '33-44',
            phase: 'store-committed',
            terminalEvidence: undefined,
            commitResults: []
        });
        const snapshot = {
            epoch: 99,
            nodeA: 88,
            nodeB: 77
        };
        const decision = classifyReconciliation({
            existing,
            snapshot,
            requestKey: 'req-1',
            source: 'conversation'
        });
        expect(decision.action).toBe('ambiguous');
    });

    it('rule 5b: same requestKey, different observed, has terminalEvidence -> new-attempt', () => {
        const existing = makeJournalEntry({
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '33-44',
            targetNodeId: '101-202',
            targetEpoch: 6,
            phase: 'artifact-written',
            terminalEvidence: makeResult('applied') as TerminalCommitResult
        });
        const snapshot = {
            epoch: 99,
            nodeA: 88,
            nodeB: 77
        };
        const decision = classifyReconciliation({
            existing,
            snapshot,
            requestKey: 'req-1',
            source: 'conversation'
        });
        expect(decision.action).toBe('new-attempt');
    });

    it('rule 8: journal contradicts CK3 (target node unreachable from observed) -> ambiguous', () => {
        const existing = makeJournalEntry({
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '33-44',
            targetNodeId: '101-202',
            targetEpoch: 6,
            phase: 'store-committed',
            terminalEvidence: undefined,
            commitResults: []
        });
        // CK3 is at an epoch that can't reach the target
        const snapshot = {
            epoch: 1,
            nodeA: 55,
            nodeB: 66
        };
        const decision = classifyReconciliation({
            existing,
            snapshot,
            requestKey: 'req-1',
            source: 'conversation'
        });
        expect(decision.action).toBe('ambiguous');
    });

    it('aborted existing entry is never reused, even with matching observed state', () => {
        const existing = makeJournalEntry({
            requestKey: 'req-1',
            source: 'conversation',
            observedEpoch: 5,
            observedCk3NodeId: '11-22',
            observedCk3ParentId: '33-44',
            observedCurrentToken: 100,
            phase: 'aborted',
            terminalEvidence: undefined,
            commitResults: []
        });
        const snapshot = {
            epoch: 5,
            nodeA: 11,
            nodeB: 22,
            parentA: 33,
            parentB: 44,
            checkpointToken: 100
        };
        const decision = classifyReconciliation({
            existing,
            snapshot,
            requestKey: 'req-1',
            source: 'conversation'
        });
        expect(decision.action).toBe('new-attempt');
        expect(decision.reason).toMatch(/aborted/);
    });
});

describe('TransitionJournalStore serialization', () => {
    it('serialize/deserialize round-trips nodes and entries', () => {
        const store = new TransitionJournalStore();
        const node = makeV2Node({ transitionAttemptId: 'att-001' });
        const entry = makeJournalEntry({
            transitionAttemptId: 'att-001',
            targetNodeId: '101-202',
            phase: 'store-committed'
        });
        store.upsertNode('101-202', node);
        store.upsertEntry(entry);

        const serialized = store.serialize();
        const restored = new TransitionJournalStore(serialized);
        expect(restored.getNode('101-202')?.transitionAttemptId).toBe('att-001');
        expect(restored.getEntry('att-001')?.phase).toBe('store-committed');
    });

    it('deserialize from empty data produces an empty store', () => {
        const store = new TransitionJournalStore({ nodes: {}, transitions: [] });
        expect(store.getAllNodes()).toEqual([]);
        expect(store.getAllEntries()).toEqual([]);
    });

    it('findLiveAttemptByRequestKey finds matching non-terminal entry', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry({
            transitionAttemptId: 'att-live',
            requestKey: 'req-1',
            source: 'conversation',
            phase: 'store-committed'
        }));
        store.upsertEntry(makeJournalEntry({
            transitionAttemptId: 'att-done',
            requestKey: 'req-2',
            source: 'conversation',
            phase: 'aborted'
        }));
        const found = store.findLiveAttemptByRequestKey('conversation', 'req-1');
        expect(found?.transitionAttemptId).toBe('att-live');
    });

    it('findLiveAttemptByRequestKey skips aborted entries', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry({
            transitionAttemptId: 'att-aborted',
            requestKey: 'req-1',
            source: 'conversation',
            phase: 'aborted'
        }));
        const found = store.findLiveAttemptByRequestKey('conversation', 'req-1');
        expect(found).toBeUndefined();
    });
});

describe('v2 envelope serialization (FsTimelinePersistence)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-v2-envelope-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function makeIdentity() {
        return buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, 'player1');
    }

    function makeDirtyRegistry() {
        const reg = new TimelineRegistry('player1');
        reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        return reg;
    }

    it('saveStoreWithIdentity with v2 data writes nodes+transitions in the envelope', () => {
        const identity = makeIdentity();
        const reg = makeDirtyRegistry();
        const p = new FsTimelinePersistence(tmpDir);
        const v2 = {
            nodes: { '101-202': makeV2Node({ transitionAttemptId: 'att-001' }) },
            transitions: [makeJournalEntry({ transitionAttemptId: 'att-001' })]
        };
        p.saveStoreWithIdentity(identity, reg, v2);

        const campaignPath = path.join(
            tmpDir, 'votc_data', 'campaigns', identity.campaignId, 'players', identity.playerId, 'timeline_registry.json'
        );
        const env = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
        expect(env.nodes).toBeDefined();
        expect(typeof env.nodes).toBe('object');
        expect(Object.keys(env.nodes).length).toBe(1);
        expect(env.nodes['101-202'].transitionAttemptId).toBe('att-001');
        expect(env.transitions).toBeDefined();
        expect(env.transitions.length).toBe(1);
    });

    it('loadStoreWithIdentity reads v2 data when present', () => {
        const identity = makeIdentity();
        const reg = makeDirtyRegistry();
        const p = new FsTimelinePersistence(tmpDir);
        const v2 = {
            nodes: { '101-202': makeV2Node({ transitionAttemptId: 'att-001' }) },
            transitions: [makeJournalEntry({ transitionAttemptId: 'att-001', phase: 'store-committed' })]
        };
        p.saveStoreWithIdentity(identity, reg, v2);

        const result = p.loadStoreWithIdentity(identity);
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.v2).toBeDefined();
        expect(Object.keys(result.v2!.nodes).length).toBe(1);
        expect(result.v2!.nodes['101-202'].transitionAttemptId).toBe('att-001');
        expect(result.v2!.transitions.length).toBe(1);
        expect(result.v2!.transitions[0].phase).toBe('store-committed');
    });

    it('projects v2 nodes into the registry used by timeline visibility readers', () => {
        const identity = makeIdentity();
        const p = new FsTimelinePersistence(tmpDir);
        const v2 = {
            nodes: {
                '101-202': makeV2Node({
                    epoch: 1,
                    transitionAttemptId: 'att-root',
                    eventSignature: 'conv:root',
                    checkpointCorrelationToken: 11
                }),
                '303-404': makeV2Node({
                    parentId: '101-202',
                    epoch: 2,
                    source: 'incoming_letter',
                    transitionAttemptId: 'att-child',
                    eventSignature: 'incoming:child',
                    checkpointCorrelationToken: 22
                })
            },
            transitions: [
                makeJournalEntry({
                    transitionAttemptId: 'att-root',
                    targetNodeId: '101-202',
                    targetEpoch: 1,
                    observedEpoch: 0
                }),
                makeJournalEntry({
                    transitionAttemptId: 'att-child',
                    source: 'incoming_letter',
                    targetNodeId: '303-404',
                    targetEpoch: 2,
                    observedEpoch: 1,
                    graphParentNodeId: '101-202'
                })
            ]
        };
        p.saveStoreWithIdentity(identity, new TimelineRegistry(identity.playerId), v2);

        const result = p.loadStoreWithIdentity(identity);
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.store.getNode('303-404')).toEqual(expect.objectContaining({
            parentId: '101-202',
            checkpointToken: 22,
            eventKey: 'incoming:child'
        }));
        expect(result.store.isRecordVisible('101-202', '303-404')).toBe(true);
    });

    it('keeps sequential token handoffs while hiding a rollback sibling rooted at the same external CK3 node', () => {
        const identity = makeIdentity();
        const p = new FsTimelinePersistence(tmpDir);
        const v2 = {
            nodes: {
                '303-404': makeV2Node({
                    parentId: '101-202',
                    epoch: 4,
                    source: 'incoming_letter',
                    transitionAttemptId: 'att-before-rollback',
                    eventSignature: 'incoming:before-rollback',
                    checkpointCorrelationToken: 111
                }),
                '505-606': makeV2Node({
                    parentId: '101-202',
                    epoch: 5,
                    source: 'incoming_letter',
                    transitionAttemptId: 'att-sequential',
                    eventSignature: 'incoming:sequential',
                    checkpointCorrelationToken: 222
                }),
                '707-808': makeV2Node({
                    parentId: '101-202',
                    epoch: 4,
                    source: 'incoming_letter',
                    transitionAttemptId: 'att-after-rollback',
                    eventSignature: 'incoming:after-rollback',
                    checkpointCorrelationToken: 333
                })
            },
            transitions: [
                makeJournalEntry({
                    transitionAttemptId: 'att-before-rollback',
                    source: 'incoming_letter',
                    graphParentNodeId: '101-202',
                    targetNodeId: '303-404',
                    targetEpoch: 4,
                    observedEpoch: 3,
                    observedCurrentToken: 99
                }),
                makeJournalEntry({
                    transitionAttemptId: 'att-sequential',
                    source: 'incoming_letter',
                    graphParentNodeId: '101-202',
                    targetNodeId: '505-606',
                    targetEpoch: 5,
                    observedEpoch: 4,
                    observedCurrentToken: 111
                }),
                makeJournalEntry({
                    transitionAttemptId: 'att-after-rollback',
                    source: 'incoming_letter',
                    graphParentNodeId: '101-202',
                    targetNodeId: '707-808',
                    targetEpoch: 4,
                    observedEpoch: 3,
                    observedCurrentToken: 99
                })
            ]
        };
        p.saveStoreWithIdentity(identity, new TimelineRegistry(identity.playerId), v2);

        const result = p.loadStoreWithIdentity(identity);
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;

        // The external CK3 parent stays out of the writable compatibility
        // store. A unique token handoff chains sequential events, while a
        // replay from the older token remains a sibling after rollback.
        expect(result.store.hasNode('303-404')).toBe(false);
        expect(result.store.hasNode('505-606')).toBe(false);
        expect(result.store.hasNode('707-808')).toBe(false);

        const sequentialContext = resolveTimelineContext(result.store, {
            playerId: identity.playerId,
            checkpointEpoch: 5,
            checkpointToken: 222,
            timelineNodeId: '101-202'
        });
        expect(sequentialContext.timelineNodeId).toBe('505-606');
        expect(isRecordVisibleForContext(
            result.store,
            sequentialContext.timelineNodeId,
            { votcTimelineNodeId: '303-404' },
            5
        )).toBe(true);
        expect(isRecordVisibleForContext(
            result.store,
            sequentialContext.timelineNodeId,
            { votcTimelineNodeId: '505-606' },
            5
        )).toBe(true);
        expect(isRecordVisibleForContext(
            result.store,
            sequentialContext.timelineNodeId,
            { votcTimelineNodeId: '707-808' },
            5
        )).toBe(false);

        const afterRollbackContext = resolveTimelineContext(result.store, {
            playerId: identity.playerId,
            checkpointEpoch: 4,
            checkpointToken: 333,
            timelineNodeId: '101-202'
        });
        expect(afterRollbackContext.timelineNodeId).toBe('707-808');
        expect(isRecordVisibleForContext(
            result.store,
            afterRollbackContext.timelineNodeId,
            { votcTimelineNodeId: '707-808' },
            4
        )).toBe(true);
        expect(isRecordVisibleForContext(
            result.store,
            afterRollbackContext.timelineNodeId,
            { votcTimelineNodeId: '303-404' },
            4
        )).toBe(false);

        // An external parent with no unique token bridge must stay fail-closed
        // rather than showing both sibling branches.
        expect(isRecordVisibleForContext(
            result.store,
            '101-202',
            { votcTimelineNodeId: '303-404' },
            4
        )).toBe(false);
    });

    it('loadStoreWithIdentity returns v2=undefined for a v1-only envelope (legacy compat)', () => {
        const identity = makeIdentity();
        const reg = makeDirtyRegistry();
        const p = new FsTimelinePersistence(tmpDir);
        // Save without v2 data (v1 only)
        p.saveStoreWithIdentity(identity, reg);

        const result = p.loadStoreWithIdentity(identity);
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.v2).toBeUndefined();
    });

    it('corrupt v2 fields (invalid phase) produce a corrupt load result', () => {
        const identity = makeIdentity();
        const reg = makeDirtyRegistry();
        const p = new FsTimelinePersistence(tmpDir);
        // First write a valid envelope to create the campaign-scoped path.
        p.saveStoreWithIdentity(identity, reg);

        // Now manually inject corrupt v2 fields into the on-disk envelope.
        const campaignPath = path.join(
            tmpDir, 'votc_data', 'campaigns', identity.campaignId, 'players', identity.playerId, 'timeline_registry.json'
        );
        const env = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
        env.nodes = { '101-202': makeV2Node() };
        env.transitions = [makeJournalEntry({ phase: 'invalid-phase' as any })];
        fs.writeFileSync(campaignPath, JSON.stringify(env, null, '\t'), 'utf8');

        const result = p.loadStoreWithIdentity(identity);
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('corrupt v2 nodes (missing transitionAttemptId) produce a corrupt load result', () => {
        const identity = makeIdentity();
        const reg = makeDirtyRegistry();
        const p = new FsTimelinePersistence(tmpDir);
        p.saveStoreWithIdentity(identity, reg);

        const campaignPath = path.join(
            tmpDir, 'votc_data', 'campaigns', identity.campaignId, 'players', identity.playerId, 'timeline_registry.json'
        );
        const env = JSON.parse(fs.readFileSync(campaignPath, 'utf8'));
        const badNode = makeV2Node();
        delete (badNode as Partial<TimelineNodeV2>).transitionAttemptId;
        env.nodes = { '101-202': badNode };
        env.transitions = [];
        fs.writeFileSync(campaignPath, JSON.stringify(env, null, '\t'), 'utf8');

        const result = p.loadStoreWithIdentity(identity);
        expect(result.status).toBe('corrupt');
    });
});

describe('computeV2ResultId', () => {
    it('produces a stable 16-char hex id from attemptId+status+observed', () => {
        const id = computeV2ResultId('att-1', 'applied', { epoch: 1, nodeA: 101, nodeB: 202 });
        expect(typeof id).toBe('string');
        expect(id.length).toBe(16);
        expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
    });

    it('changes when status changes', () => {
        const id1 = computeV2ResultId('att-1', 'applied', { epoch: 1 });
        const id2 = computeV2ResultId('att-1', 'already-applied', { epoch: 1 });
        expect(id1).not.toBe(id2);
    });

    it('changes when observed state changes', () => {
        const id1 = computeV2ResultId('att-1', 'applied', { epoch: 1 });
        const id2 = computeV2ResultId('att-1', 'applied', { epoch: 2 });
        expect(id1).not.toBe(id2);
    });

    it('is idempotent for the same inputs', () => {
        const id1 = computeV2ResultId('att-1', 'applied', { epoch: 1 });
        const id2 = computeV2ResultId('att-1', 'applied', { epoch: 1 });
        expect(id1).toBe(id2);
    });

    it('changes when only pendingCheckpointToken changes', () => {
        const id1 = computeV2ResultId('att-1', 'applied', { epoch: 1, pendingCheckpointToken: 100 });
        const id2 = computeV2ResultId('att-1', 'applied', { epoch: 1, pendingCheckpointToken: 101 });
        expect(id1).not.toBe(id2);
    });
});

describe('appendCommitResult pendingCheckpointToken idempotency (§9.3 atomic-advance guard)', () => {
    it('two terminal results differing only in pendingCheckpointToken are NOT idempotent (conflict)', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        const r1 = makeResult('applied', 'att-001', { epoch: 1, pendingCheckpointToken: 100 }) as TerminalCommitResult;
        const r2 = makeResult('applied', 'att-001', { epoch: 1, pendingCheckpointToken: 101 }) as TerminalCommitResult;
        expect(r1.resultId).not.toBe(r2.resultId);

        const out1 = store.appendCommitResult('att-001', r1);
        expect(out1.terminalEvidenceSet).toBe(true);
        const out2 = store.appendCommitResult('att-001', r2);
        expect(out2.added).toBe(true);
        expect(out2.conflict).toBe(true);
        expect(out2.terminalEvidenceSet).toBe(false);
    });

    it('appending the same terminal result (same pendingCheckpointToken) is idempotent', () => {
        const store = new TransitionJournalStore();
        store.upsertEntry(makeJournalEntry());
        const r = makeResult('applied', 'att-001', { epoch: 1, pendingCheckpointToken: 100 }) as TerminalCommitResult;
        store.appendCommitResult('att-001', r);
        const out = store.appendCommitResult('att-001', r);
        expect(out.added).toBe(false);
        expect(out.conflict).toBe(false);
    });
});
