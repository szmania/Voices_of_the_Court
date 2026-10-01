import {
    TransitionJournalStore,
    TimelineCommitResult,
    TerminalCommitResult,
    TimelineCommitResultStatus,
    TransitionPhase,
    TransitionJournalEntry,
    TimelineNodeV2,
    ObservedSnapshot,
    ReconciliationDecision,
    computeV2ResultId,
    isLegalPhaseTransition
} from '../../src/main/timelineTransitionJournal';
import {
    TransitionJournalApi,
    BeginTransitionInput,
    AttemptTransitionHandle,
    SyntheticProofOutcome,
    JournalApiError
} from '../../src/main/timelineJournalApi';
import {
    FsTimelinePersistence,
    TimelineRegistry
} from '../../src/main/timelineManager';
import { buildIdentityFromParts, CampaignPlayerIdentity } from '../../src/shared/gameData/CampaignIdentity';
import fs from 'fs';
import path from 'path';
import os from 'os';

const NOW = '2026-07-21T00:00:00Z';
const LATER = '2026-07-21T01:00:00Z';

function makeIdentity(): CampaignPlayerIdentity {
    return buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, 'player1');
}

function makeSnapshot(overrides: Partial<ObservedSnapshot> = {}): ObservedSnapshot {
    return {
        epoch: 5,
        nodeA: 11,
        nodeB: 22,
        parentA: 33,
        parentB: 44,
        checkpointToken: 100,
        ...overrides
    };
}

function makeResult(
    status: TimelineCommitResultStatus,
    attemptId: string,
    observed: ObservedSnapshot = makeSnapshot(),
    recordedAt: string = NOW
): TimelineCommitResult {
    return {
        resultId: computeV2ResultId(attemptId, status, observed),
        attemptId,
        status,
        observed,
        recordedAt
    } as TimelineCommitResult;
}

function setupApi(tmpDir: string, opts?: { seedEntries?: TransitionJournalEntry[]; seedNodes?: Record<string, TimelineNodeV2> }) {
    const identity = makeIdentity();
    const persistence = new FsTimelinePersistence(tmpDir);
    // Seed a v1 registry node so saveStoreWithIdentity has something dirty to write.
    const registry = new TimelineRegistry(identity.playerId);
    registry.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
    // Persist once so the campaign-scoped envelope exists.
    persistence.saveStoreWithIdentity(identity, registry);

    const store = new TransitionJournalStore();
    if (opts?.seedNodes) {
        for (const [id, node] of Object.entries(opts.seedNodes)) {
            store.upsertNode(id, node);
        }
    }
    if (opts?.seedEntries) {
        for (const entry of opts.seedEntries) {
            store.upsertEntry(entry);
        }
    }
    const api = new TransitionJournalApi({
        store,
        persistence,
        identity,
        registry,
        now: () => NOW
    });
    return { api, store, persistence, identity, registry };
}

describe('TransitionJournalApi.beginTransition', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-jrnapi-'));
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates a new entry (phase=preparing) and target node when no existing attempt matches', () => {
        const { api, store } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot,
            source: 'conversation',
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            graphParentNodeId: '11-22'
        });

        expect(attempt.attemptId).toBeTruthy();
        expect(attempt.phase).toBe('preparing');
        const entry = store.getEntry(attempt.attemptId);
        expect(entry).toBeDefined();
        expect(entry!.phase).toBe('preparing');
        expect(entry!.source).toBe('conversation');
        expect(entry!.requestKey).toBe('req-1');
        expect(entry!.observedEpoch).toBe(5);
        expect(entry!.observedCk3NodeId).toBe('11-22');
        expect(entry!.observedCk3ParentId).toBe('33-44');
        expect(entry!.targetNodeId).toBe('101-202');
        expect(entry!.targetEpoch).toBe(6);
        expect(entry!.commitMode).toBe('atomic-advance');
        expect(entry!.graphParentNodeId).toBe('11-22');
        expect(entry!.recordIds).toEqual([]);
        expect(entry!.commitResults).toEqual([]);

        const node = store.getNode('101-202');
        expect(node).toBeDefined();
        expect(node!.transitionAttemptId).toBe(attempt.attemptId);
        expect(node!.source).toBe('conversation');
        expect(node!.epoch).toBe(6);
        expect(node!.parentId).toBe('11-22');
        expect(node!.requestKey).toBe('req-1');
        expect(node!.eventSignature).toBe('conv:sig-1');
    });

    it('rule 1: reuses an existing live attempt with same requestKey and matching observed state', () => {
        const existingAttemptId = 'att-existing';
        const existingEntry: TransitionJournalEntry = {
            transitionAttemptId: existingAttemptId,
            source: 'conversation',
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '11-22',
            observedCk3ParentId: '33-44',
            observedCurrentToken: 100,
            graphParentNodeId: '11-22',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            recordIds: [],
            phase: 'store-committed',
            commitResults: [],
            startedAt: NOW,
            updatedAt: NOW
        };
        const existingNode: TimelineNodeV2 = {
            parentId: '11-22',
            epoch: 6,
            source: 'conversation',
            transitionAttemptId: existingAttemptId,
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            createdAt: NOW
        };
        const { api, store } = setupApi(tmpDir, {
            seedEntries: [existingEntry],
            seedNodes: { '101-202': existingNode }
        });
        const snapshot = makeSnapshot(); // matches observedEpoch=5, nodeA=11, nodeB=22
        const attempt = api.beginTransition({
            snapshot,
            source: 'conversation',
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            graphParentNodeId: '11-22'
        });

        expect(attempt.attemptId).toBe(existingAttemptId);
        expect(attempt.reused).toBe(true);
        expect(attempt.phase).toBe('store-committed');
        // Should NOT have created a new node
        expect(store.getAllNodes().length).toBe(1);
        expect(store.getAllEntries().length).toBe(1);
    });

    it('rule 5/8: same requestKey but different observed state without terminalEvidence -> ambiguous (throws)', () => {
        const existingAttemptId = 'att-existing';
        const existingEntry: TransitionJournalEntry = {
            transitionAttemptId: existingAttemptId,
            source: 'conversation',
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '11-22',
            graphParentNodeId: '11-22',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            recordIds: [],
            phase: 'store-committed',
            commitResults: [],
            startedAt: NOW,
            updatedAt: NOW
        };
        const { api } = setupApi(tmpDir, { seedEntries: [existingEntry] });
        // Different observed (epoch 99)
        const snapshot = makeSnapshot({ epoch: 99, nodeA: 88, nodeB: 77 });
        expect(() => api.beginTransition({
            snapshot,
            source: 'conversation',
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            graphParentNodeId: '11-22'
        })).toThrow(JournalApiError);
    });

    it('rule 2: terminalEvidence present and CK3 == target -> idempotent-update (reuses, no new node)', () => {
        const existingAttemptId = 'att-existing';
        const terminal = makeResult('applied', existingAttemptId, { epoch: 6, nodeA: 101, nodeB: 202 }) as TerminalCommitResult;
        const existingEntry: TransitionJournalEntry = {
            transitionAttemptId: existingAttemptId,
            source: 'conversation',
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '11-22',
            graphParentNodeId: '11-22',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            recordIds: [],
            phase: 'artifact-written',
            commitResults: [terminal],
            terminalEvidence: terminal,
            startedAt: NOW,
            updatedAt: NOW
        };
        const { api, store } = setupApi(tmpDir, { seedEntries: [existingEntry] });
        // CK3 snapshot == target (epoch 6, node 101-202)
        const snapshot = makeSnapshot({ epoch: 6, nodeA: 101, nodeB: 202 });
        const attempt = api.beginTransition({
            snapshot,
            source: 'conversation',
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            graphParentNodeId: '11-22'
        });
        expect(attempt.attemptId).toBe(existingAttemptId);
        expect(attempt.reused).toBe(true);
        expect(attempt.decision.action).toBe('idempotent-update');
        expect(store.getAllEntries().length).toBe(1);
    });

    it('rule 3: terminalEvidence present and CK3 == observed (not target) -> new attempt', () => {
        const existingAttemptId = 'att-existing';
        const terminal = makeResult('applied', existingAttemptId, { epoch: 6, nodeA: 101, nodeB: 202 }) as TerminalCommitResult;
        const existingEntry: TransitionJournalEntry = {
            transitionAttemptId: existingAttemptId,
            source: 'conversation',
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '33-44',
            graphParentNodeId: '11-22',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            recordIds: [],
            phase: 'artifact-written',
            commitResults: [terminal],
            terminalEvidence: terminal,
            startedAt: NOW,
            updatedAt: NOW
        };
        const existingNode: TimelineNodeV2 = {
            parentId: '11-22',
            epoch: 6,
            source: 'conversation',
            transitionAttemptId: existingAttemptId,
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            createdAt: NOW
        };
        const { api, store } = setupApi(tmpDir, {
            seedEntries: [existingEntry],
            seedNodes: { '101-202': existingNode }
        });
        // CK3 at observed (epoch 5, node 33-44)
        const snapshot = makeSnapshot({ epoch: 5, nodeA: 33, nodeB: 44 });
        const attempt = api.beginTransition({
            snapshot,
            source: 'conversation',
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            targetNodeId: '404-505',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            graphParentNodeId: '33-44'
        });
        expect(attempt.attemptId).not.toBe(existingAttemptId);
        expect(attempt.reused).toBe(false);
        expect(attempt.decision.action).toBe('new-attempt');
        expect(store.getAllEntries().length).toBe(2);
    });

    it('rule 4: no terminalEvidence, phase=artifact-written, CK3==observed -> replay-artifact (reuses, no new node)', () => {
        const existingAttemptId = 'att-existing';
        const existingEntry: TransitionJournalEntry = {
            transitionAttemptId: existingAttemptId,
            source: 'conversation',
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '33-44',
            graphParentNodeId: '11-22',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            recordIds: [],
            phase: 'artifact-written',
            commitResults: [],
            startedAt: NOW,
            updatedAt: NOW
        };
        const { api, store } = setupApi(tmpDir, { seedEntries: [existingEntry] });
        const snapshot = makeSnapshot({ epoch: 5, nodeA: 33, nodeB: 44 });
        const attempt = api.beginTransition({
            snapshot,
            source: 'conversation',
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            graphParentNodeId: '11-22'
        });
        expect(attempt.attemptId).toBe(existingAttemptId);
        expect(attempt.reused).toBe(true);
        expect(attempt.decision.action).toBe('replay-artifact');
        expect(store.getAllEntries().length).toBe(1);
    });

    it('does not reuse an aborted attempt (creates new)', () => {
        const existingAttemptId = 'att-aborted';
        const existingEntry: TransitionJournalEntry = {
            transitionAttemptId: existingAttemptId,
            source: 'conversation',
            requestKey: 'req-1',
            observedEpoch: 5,
            observedCk3NodeId: '11-22',
            graphParentNodeId: '11-22',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            recordIds: [],
            phase: 'aborted',
            commitResults: [],
            startedAt: NOW,
            updatedAt: NOW
        };
        const { api, store } = setupApi(tmpDir, { seedEntries: [existingEntry] });
        const snapshot = makeSnapshot({ epoch: 5, nodeA: 11, nodeB: 22 });
        const attempt = api.beginTransition({
            snapshot,
            source: 'conversation',
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            graphParentNodeId: '11-22'
        });
        expect(attempt.attemptId).not.toBe(existingAttemptId);
        expect(store.getAllEntries().length).toBe(2);
    });

    it('scopes requestKey lookup by source (different source = new attempt even with same requestKey)', () => {
        const existingAttemptId = 'att-letter';
        const existingEntry: TransitionJournalEntry = {
            transitionAttemptId: existingAttemptId,
            source: 'letter_reply',
            requestKey: 'req-shared',
            observedEpoch: 5,
            observedCk3NodeId: '11-22',
            graphParentNodeId: '11-22',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            recordIds: [],
            phase: 'store-committed',
            commitResults: [],
            startedAt: NOW,
            updatedAt: NOW
        };
        const { api, store } = setupApi(tmpDir, { seedEntries: [existingEntry] });
        const snapshot = makeSnapshot({ epoch: 5, nodeA: 11, nodeB: 22 });
        const attempt = api.beginTransition({
            snapshot,
            source: 'conversation', // different source
            requestKey: 'req-shared',
            eventSignature: 'conv:sig-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            graphParentNodeId: '11-22'
        });
        expect(attempt.attemptId).not.toBe(existingAttemptId);
        expect(store.getAllEntries().length).toBe(2);
    });

    it('persists the v2 envelope atomically on success', () => {
        const { api, identity } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        api.beginTransition({
            snapshot,
            source: 'conversation',
            requestKey: 'req-1',
            eventSignature: 'conv:sig-1',
            targetNodeId: '101-202',
            targetEpoch: 6,
            commitMode: 'atomic-advance',
            graphParentNodeId: '11-22'
        });
        // Reload from disk: the new entry+node should be present.
        const result = api.getStore().serialize();
        const persistence = new FsTimelinePersistence(tmpDir);
        const loaded = persistence.loadStoreWithIdentity(identity);
        expect(loaded.status).toBe('found');
        if (loaded.status !== 'found') return;
        expect(loaded.v2).toBeDefined();
        expect(loaded.v2!.nodes['101-202']).toBeDefined();
        expect(loaded.v2!.transitions.length).toBe(1);
        expect(loaded.v2!.transitions[0].requestKey).toBe('req-1');
    });
});

describe('TransitionJournalApi.commitTimelineStoreAttempt', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-jrnapi-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('moves phase preparing -> store-committed', () => {
        const { api, store } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.commitTimelineStoreAttempt(attempt);
        expect(store.getEntry(attempt.attemptId)!.phase).toBe('store-committed');
        expect(attempt.phase).toBe('store-committed');
    });

    it('throws on illegal phase transition (e.g. store-committed -> store-committed after advancing to business-committed)', () => {
        const { api } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.commitTimelineStoreAttempt(attempt);
        api.stageBusinessTransaction(attempt, ['rec-1'], { 'rec-1': { x: 1 } });
        // Now entry is at business-committed; commitTimelineStoreAttempt (-> store-committed) is illegal
        expect(() => api.commitTimelineStoreAttempt(attempt)).toThrow(JournalApiError);
    });

    it('is idempotent: calling commit on an already-store-committed attempt still persists', () => {
        const { api, store, identity } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.commitTimelineStoreAttempt(attempt);
        // Reload from disk: phase must already be persisted as store-committed.
        let loaded = new FsTimelinePersistence(tmpDir).loadStoreWithIdentity(identity);
        expect(loaded.status).toBe('found');
        if (loaded.status !== 'found') return;
        expect(loaded.v2!.transitions[0].phase).toBe('store-committed');

        // Second (idempotent) commit must also persist (durability symmetry).
        api.commitTimelineStoreAttempt(attempt);
        expect(store.getEntry(attempt.attemptId)!.phase).toBe('store-committed');
        loaded = new FsTimelinePersistence(tmpDir).loadStoreWithIdentity(identity);
        expect(loaded.status).toBe('found');
        if (loaded.status !== 'found') return;
        expect(loaded.v2!.transitions[0].phase).toBe('store-committed');
    });
});

describe('TransitionJournalApi.stageBusinessTransaction', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-jrnapi-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('records recordIds and moves phase store-committed -> business-committed', () => {
        const { api, store } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.commitTimelineStoreAttempt(attempt);
        api.stageBusinessTransaction(attempt, ['rec-1', 'rec-2'], { 'rec-1': { x: 1 }, 'rec-2': { y: 2 } });
        const entry = store.getEntry(attempt.attemptId)!;
        expect(entry.phase).toBe('business-committed');
        expect(entry.recordIds).toEqual(['rec-1', 'rec-2']);
        expect(attempt.recordIds).toEqual(['rec-1', 'rec-2']);
    });

    it('throws if attempt is not in store-committed phase', () => {
        const { api } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        // still preparing
        expect(() => api.stageBusinessTransaction(attempt, ['rec-1'], { 'rec-1': { x: 1 } })).toThrow(JournalApiError);
    });

    it('rejects duplicate recordIds', () => {
        const { api } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.commitTimelineStoreAttempt(attempt);
        expect(() => api.stageBusinessTransaction(attempt, ['rec-1', 'rec-1'], { 'rec-1': { x: 1 } })).toThrow(JournalApiError);
    });
});

describe('TransitionJournalApi.markArtifactWritten', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-jrnapi-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('records artifact path+sha256 and moves phase business-committed -> artifact-written', () => {
        const { api, store } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.commitTimelineStoreAttempt(attempt);
        api.stageBusinessTransaction(attempt, ['rec-1'], { 'rec-1': { x: 1 } });
        api.markArtifactWritten(attempt, '/path/to/artifact.json', 'abc123');
        const entry = store.getEntry(attempt.attemptId)!;
        expect(entry.phase).toBe('artifact-written');
        expect(entry.artifact).toEqual({ path: '/path/to/artifact.json', sha256: 'abc123' });
    });

    it('throws if attempt is not in business-committed phase', () => {
        const { api } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.commitTimelineStoreAttempt(attempt);
        // still store-committed
        expect(() => api.markArtifactWritten(attempt, '/p', 'h')).toThrow(JournalApiError);
    });

    it('rejects empty path or sha256', () => {
        const { api } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.commitTimelineStoreAttempt(attempt);
        api.stageBusinessTransaction(attempt, ['rec-1'], { 'rec-1': { x: 1 } });
        expect(() => api.markArtifactWritten(attempt, '', 'abc')).toThrow(JournalApiError);
        expect(() => api.markArtifactWritten(attempt, '/p', '')).toThrow(JournalApiError);
    });
});

describe('TransitionJournalApi.applyCommitResult (rule 7)', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-jrnapi-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('appends a new result and sets terminalEvidence for the first qualifying result', () => {
        const { api, store } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        const terminal = makeResult('applied', attempt.attemptId, snapshot) as TerminalCommitResult;
        const outcome = api.applyCommitResult(attempt.attemptId, terminal);
        expect(outcome.added).toBe(true);
        expect(outcome.terminalEvidenceSet).toBe(true);
        const entry = store.getEntry(attempt.attemptId)!;
        expect(entry.terminalEvidence?.status).toBe('applied');
    });

    it('idempotent: same resultId appended twice is a no-op', () => {
        const { api } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        const terminal = makeResult('applied', attempt.attemptId, snapshot) as TerminalCommitResult;
        api.applyCommitResult(attempt.attemptId, terminal);
        const outcome = api.applyCommitResult(attempt.attemptId, terminal);
        expect(outcome.added).toBe(false);
        expect(outcome.conflict).toBe(false);
    });

    it('conflict: qualifying result with different status/observed is a conflict, does not overwrite terminalEvidence', () => {
        const { api, store } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        const terminal1 = makeResult('applied', attempt.attemptId, snapshot) as TerminalCommitResult;
        api.applyCommitResult(attempt.attemptId, terminal1);
        const conflicting = makeResult('already-applied', attempt.attemptId, { epoch: 99 }) as TerminalCommitResult;
        const outcome = api.applyCommitResult(attempt.attemptId, conflicting);
        expect(outcome.conflict).toBe(true);
        expect(store.getEntry(attempt.attemptId)!.terminalEvidence?.status).toBe('applied');
    });

    it('throws when attemptId is unknown', () => {
        const { api } = setupApi(tmpDir);
        const result = makeResult('applied', 'unknown');
        expect(() => api.applyCommitResult('unknown', result)).toThrow(JournalApiError);
    });
});

describe('TransitionJournalApi.reconcileAttemptFromSnapshot (rule 6 + rule 3 detection)', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-jrnapi-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    function setupCommittedAttempt(opts?: { withTerminal?: boolean }) {
        const { api, store } = setupApi(tmpDir);
        const observedSnapshot = makeSnapshot({ epoch: 5, nodeA: 11, nodeB: 22 });
        const attempt = api.beginTransition({
            snapshot: observedSnapshot,
            source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.commitTimelineStoreAttempt(attempt);
        api.stageBusinessTransaction(attempt, ['rec-1'], { 'rec-1': { x: 1 } });
        api.markArtifactWritten(attempt, '/p', 'h');
        if (opts?.withTerminal) {
            // Apply a real terminal result first
            const terminal = makeResult('applied', attempt.attemptId, { epoch: 6, nodeA: 101, nodeB: 202 }) as TerminalCommitResult;
            api.applyCommitResult(attempt.attemptId, terminal);
        }
        return { api, store, attempt };
    }

    it('rule 6: result log lost but snapshot precisely equals target -> synthetic already-applied is appended', () => {
        const { api, store, attempt } = setupCommittedAttempt();
        // No terminalEvidence yet. Now a snapshot arrives that == target (epoch 6, node 101-202).
        const targetSnapshot = makeSnapshot({ epoch: 6, nodeA: 101, nodeB: 202 });
        const outcome = api.reconcileAttemptFromSnapshot(attempt.attemptId, targetSnapshot);
        expect(outcome.syntheticProofAdded).toBe(true);
        const entry = store.getEntry(attempt.attemptId)!;
        expect(entry.terminalEvidence).toBeDefined();
        expect(entry.terminalEvidence!.status).toBe('already-applied');
        // Synthetic proof must be auditable via the structured flag, not via a
        // non-ISO suffix on recordedAt (which would poison updatedAt).
        expect(outcome.synthetic).toBe(true);
        expect(entry.terminalEvidence!.synthetic).toBe(true);
        expect(entry.terminalEvidence!.recordedAt).toBe(NOW);
        expect(entry.terminalEvidence!.recordedAt).not.toMatch(/\|synthetic$/);
        // updatedAt must remain a clean ISO timestamp.
        expect(entry.updatedAt).toBe(NOW);
        expect(entry.updatedAt).not.toMatch(/\|synthetic$/);
        expect(entry.commitResults.some(r => r === entry.terminalEvidence)).toBe(true);
    });

    it('rule 6: snapshot != target -> no synthetic proof added', () => {
        const { api, store, attempt } = setupCommittedAttempt();
        const unrelatedSnapshot = makeSnapshot({ epoch: 7, nodeA: 999, nodeB: 888 });
        const outcome = api.reconcileAttemptFromSnapshot(attempt.attemptId, unrelatedSnapshot);
        expect(outcome.syntheticProofAdded).toBe(false);
        expect(store.getEntry(attempt.attemptId)!.terminalEvidence).toBeUndefined();
    });

    it('rule 6: does not overwrite an existing real terminalEvidence with a synthetic proof', () => {
        const { api, store, attempt } = setupCommittedAttempt({ withTerminal: true });
        const realTerminal = store.getEntry(attempt.attemptId)!.terminalEvidence!;
        // snapshot == target -> would synthesize already-applied, but real terminalEvidence exists
        const targetSnapshot = makeSnapshot({ epoch: 6, nodeA: 101, nodeB: 202 });
        const outcome = api.reconcileAttemptFromSnapshot(attempt.attemptId, targetSnapshot);
        expect(outcome.syntheticProofAdded).toBe(false);
        expect(store.getEntry(attempt.attemptId)!.terminalEvidence).toEqual(realTerminal);
    });

    it('rule 6: snapshot equals target but identity (epoch) self-inconsistent -> no synthetic proof', () => {
        const { api, store, attempt } = setupCommittedAttempt();
        // Target epoch is 6 but snapshot.epoch is 5 (self-inconsistent with nodeA/B == target)
        // Actually the rule says snapshot must "precisely equal target". If epoch mismatches target
        // while node matches, it's not a precise match.
        const inconsistentSnapshot = makeSnapshot({ epoch: 5, nodeA: 101, nodeB: 202 });
        const outcome = api.reconcileAttemptFromSnapshot(attempt.attemptId, inconsistentSnapshot);
        expect(outcome.syntheticProofAdded).toBe(false);
    });

    it('rule 3 detection: snapshot == observed (not target) after terminalEvidence -> flagged as reload-redo (caller decides new attempt)', () => {
        const { api, attempt } = setupCommittedAttempt({ withTerminal: true });
        // observed was epoch 5, node 11-22
        const observedSnapshot = makeSnapshot({ epoch: 5, nodeA: 11, nodeB: 22 });
        const outcome = api.reconcileAttemptFromSnapshot(attempt.attemptId, observedSnapshot);
        expect(outcome.reloadRedoDetected).toBe(true);
        expect(outcome.syntheticProofAdded).toBe(false);
    });

    it('throws on unknown attemptId', () => {
        const { api } = setupApi(tmpDir);
        expect(() => api.reconcileAttemptFromSnapshot('unknown', makeSnapshot())).toThrow(JournalApiError);
    });
});

describe('TransitionJournalApi.abortTransition', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-jrnapi-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('moves phase to aborted and records the reason', () => {
        const { api, store } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.abortTransition(attempt, 'user cancelled');
        const entry = store.getEntry(attempt.attemptId)!;
        expect(entry.phase).toBe('aborted');
        expect(entry.abortReason).toBe('user cancelled');
    });

    it('a reused (aborted) attempt is not reused again by beginTransition', () => {
        const { api } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.abortTransition(attempt, 'reason');
        // Same requestKey + observed -> should NOT reuse the aborted attempt
        const attempt2 = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        expect(attempt2.attemptId).not.toBe(attempt.attemptId);
    });

    it('cannot abort an already-aborted attempt', () => {
        const { api } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api.abortTransition(attempt, 'r1');
        expect(() => api.abortTransition(attempt, 'r2')).toThrow(JournalApiError);
    });
});

describe('TransitionJournalApi persistence round-trip', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-jrnapi-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('survives reload: an attempt created on one api instance is visible on a fresh instance loaded from disk', () => {
        const identity = makeIdentity();
        const persistence = new FsTimelinePersistence(tmpDir);
        const registry = new TimelineRegistry(identity.playerId);
        registry.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        persistence.saveStoreWithIdentity(identity, registry);

        const store1 = new TransitionJournalStore();
        const api1 = new TransitionJournalApi({ store: store1, persistence, identity, registry, now: () => NOW });
        const snapshot = makeSnapshot();
        const attempt = api1.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        api1.commitTimelineStoreAttempt(attempt);

        // Reload from disk into a fresh store
        const loaded = persistence.loadStoreWithIdentity(identity);
        expect(loaded.status).toBe('found');
        if (loaded.status !== 'found') return;
        const store2 = new TransitionJournalStore(loaded.v2);
        const api2 = new TransitionJournalApi({ store: store2, persistence, identity, registry, now: () => NOW });
        const entry = api2.getStore().getEntry(attempt.attemptId);
        expect(entry).toBeDefined();
        expect(entry!.phase).toBe('store-committed');
    });
});

describe('TransitionJournalApi concurrent beginTransition same requestKey', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-jrnapi-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('two concurrent beginTransition calls with same requestKey + observed state reuse the same attempt', () => {
        const { api, store } = setupApi(tmpDir);
        const snapshot = makeSnapshot();
        const attempt1 = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        // Second beginTransition with same requestKey + matching observed state -> reuses attempt1
        const attempt2 = api.beginTransition({
            snapshot, source: 'conversation', requestKey: 'req-1', eventSignature: 'sig',
            targetNodeId: '101-202', targetEpoch: 6, commitMode: 'atomic-advance', graphParentNodeId: '11-22'
        });
        expect(attempt2.attemptId).toBe(attempt1.attemptId);
        expect(store.getAllEntries().length).toBe(1);
        expect(store.getAllNodes().length).toBe(1);
    });
});
