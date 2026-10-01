import {
    TimelineRegistry,
    TimelineContext,
    resolveTimelineContext,
    buildContextFromGameData
} from '../../src/main/timelineManager';
import {
    resolveTimelineStrict,
    type StrictResolverInput
} from '../../src/main/timelineResolver';
import {
    TransitionJournalStore,
    TimelineNodeV2,
    TransitionJournalEntry
} from '../../src/main/timelineTransitionJournal';
import type { MigrationManifest } from '../../src/main/campaignMigration';

const NOW = '2026-07-21T00:00:00Z';

function makeContext(overrides: Partial<TimelineContext> = {}): TimelineContext {
    return {
        playerId: '123',
        checkpointEpoch: 5,
        timelineNodeId: '101-202',
        timelineParentId: '303-404',
        checkpointToken: 111111111,
        ...overrides
    };
}

function makeManifest(overrides: Partial<MigrationManifest> = {}): MigrationManifest {
    return {
        version: 1,
        status: 'imported',
        decision: 'current-branch-only',
        campaignId: 'camp-1',
        playerId: '123',
        sourceNodeId: '101-202',
        importedNodeCount: 1,
        importedRecordCount: 0,
        quarantinedLegacyRecordCount: 0,
        completedAt: NOW,
        ...overrides
    };
}

function makeV2Node(overrides: Partial<TimelineNodeV2> = {}): TimelineNodeV2 {
    return {
        parentId: '303-404',
        epoch: 5,
        source: 'conversation',
        transitionAttemptId: 'att-1',
        requestKey: 'req-1',
        createdAt: NOW,
        ...overrides
    };
}

function makeEntry(overrides: Partial<TransitionJournalEntry> = {}): TransitionJournalEntry {
    return {
        transitionAttemptId: 'att-1',
        source: 'conversation',
        requestKey: 'req-1',
        observedEpoch: 5,
        observedCk3NodeId: '101-202',
        graphParentNodeId: '303-404',
        targetNodeId: '101-202',
        targetEpoch: 5,
        commitMode: 'atomic-advance',
        recordIds: [],
        phase: 'store-committed',
        commitResults: [],
        startedAt: NOW,
        updatedAt: NOW,
        ...overrides
    };
}

describe('resolveTimelineStrict - evidence 1: CK3 node self-consistent', () => {
    it('resolves when node exists, epoch matches, and parent is undefined in context', () => {
        const reg = new TimelineRegistry('123');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 5, NOW, 111111111);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: nodeId,
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx });
        expect(result.status).toBe('resolved');
        if (result.status !== 'resolved') return;
        expect(result.evidence.kind).toBe('ck3-node-self-consistent');
        expect(result.evidence.nodeId).toBe(nodeId);
        expect(result.context.timelineNodeId).toBe(nodeId);
    });

    it('does not apply evidence 1 when node exists but epoch mismatches (token bridge resolves instead)', () => {
        const reg = new TimelineRegistry('123');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 4, NOW, 111111111);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 99,
            timelineNodeId: nodeId,
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx });
        // Evidence 1 fails (epoch 4 vs 99); evidence 2 skipped (no store);
        // token bridge finds the unique node carrying token 111111111.
        expect(result.status).toBe('resolved');
        if (result.status !== 'resolved') return;
        expect(result.evidence.kind).toBe('token-bridge');
        expect(result.evidence.nodeId).toBe(nodeId);
    });

    it('does not resolve when node is not in registry', () => {
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: '999999-999999',
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: new TimelineRegistry('123'), context: ctx });
        expect(result.status).toBe('missing-node');
    });

    it('resolves when node exists and epoch matches with node.epoch undefined (epoch-agnostic)', () => {
        // Directly insert a node with undefined epoch for this test
        const reg2 = new TimelineRegistry('123', {
            version: 1,
            playerId: '123',
            nodes: {
                '101-202': {
                    parentId: null,
                    epoch: undefined,
                    source: 'conversation',
                    eventKey: 'conv:root',
                    createdAt: NOW,
                    checkpointToken: 111111111
                }
            }
        });
        const ctx: TimelineContext = {
            playerId: '123',
            // No checkpoint epoch -> epoch-agnostic check passes
            timelineNodeId: '101-202',
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: reg2, context: ctx });
        expect(result.status).toBe('resolved');
        if (result.status !== 'resolved') return;
        expect(result.evidence.kind).toBe('ck3-node-self-consistent');
    });
});

describe('resolveTimelineStrict - evidence 2: v2 transitionAttemptId', () => {
    it('resolves when v2 store has node with attemptId and journal entry exists', () => {
        const reg = new TimelineRegistry('123');
        // v1 node does NOT match epoch (so evidence 1 fails)
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 4, NOW, 111111111);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 99,
            timelineNodeId: nodeId,
            checkpointToken: 111111111
        };
        const store = new TransitionJournalStore();
        store.upsertNode(nodeId, makeV2Node({ parentId: null, epoch: 4 }));
        store.upsertEntry(makeEntry({ observedCk3NodeId: nodeId, targetNodeId: nodeId }));
        const result = resolveTimelineStrict({ registry: reg, context: ctx, store });
        expect(result.status).toBe('resolved');
        if (result.status !== 'resolved') return;
        expect(result.evidence.kind).toBe('registry-node-has-attempt');
    });

    it('returns registry-corrupt when v2 node has attemptId but journal entry is missing', () => {
        const reg = new TimelineRegistry('123');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 4, NOW, 111111111);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 99,
            timelineNodeId: nodeId,
            checkpointToken: 111111111
        };
        const store = new TransitionJournalStore();
        store.upsertNode(nodeId, makeV2Node({ parentId: null, epoch: 4, transitionAttemptId: 'ghost-att' }));
        // No entry for 'ghost-att'
        const result = resolveTimelineStrict({ registry: reg, context: ctx, store });
        expect(result.status).toBe('registry-corrupt');
    });

    it('returns registry-corrupt when v2 node attempt targets a different node (targetNodeId mismatch)', () => {
        const reg = new TimelineRegistry('123');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 4, NOW, 111111111);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 99,
            timelineNodeId: nodeId,
            checkpointToken: 111111111
        };
        const store = new TransitionJournalStore();
        // The v2 node points to attempt 'att-1', but the journal entry's
        // targetNodeId points to a *different* node (corruption: repointed attempt).
        store.upsertNode(nodeId, makeV2Node({ parentId: null, epoch: 4, transitionAttemptId: 'att-1' }));
        store.upsertEntry(makeEntry({
            transitionAttemptId: 'att-1',
            targetNodeId: '505-606',
            observedCk3NodeId: nodeId
        }));
        const result = resolveTimelineStrict({ registry: reg, context: ctx, store });
        expect(result.status).toBe('registry-corrupt');
        if (result.status !== 'registry-corrupt') return;
        expect(result.reason).toContain('505-606');
        expect(result.reason).toContain('att-1');
    });

    it('skips evidence 2 when no v2 store provided (falls through to token bridge)', () => {
        const reg = new TimelineRegistry('123');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 4, NOW, 111111111);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 99,
            timelineNodeId: nodeId,
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx });
        // Evidence 2 is skipped (no store); token bridge finds the unique node
        // carrying the same checkpoint token.
        expect(result.status).toBe('resolved');
        if (result.status !== 'resolved') return;
        expect(result.evidence.kind).toBe('token-bridge');
        expect(result.evidence.nodeId).toBe(nodeId);
    });
});

describe('resolveTimelineStrict - token short window', () => {
    it('resolves via token bridge when snapshot reports no node (commit short window)', () => {
        const reg = new TimelineRegistry('123');
        // Node exists but at a different epoch (evidence 1 fails - no snapshot node)
        const staleId = reg.getOrCreateChild(null, 'conversation', 'conv:stale', 4, NOW, 111111111);
        // The token bridge should find the unique node with token 111111111
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx });
        expect(result.status).toBe('resolved');
        if (result.status !== 'resolved') return;
        expect(result.evidence.kind).toBe('token-bridge');
        expect(result.evidence.nodeId).toBe(staleId);
    });

    it('returns ambiguous when multiple nodes share the same token', () => {
        const reg = new TimelineRegistry('123');
        reg.getOrCreateChild(null, 'conversation', 'conv:a', 5, NOW, 111111111);
        reg.getOrCreateChild(null, 'conversation', 'conv:b', 5, NOW, 111111111);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx });
        expect(result.status).toBe('ambiguous');
    });

    it('does not epoch fallback after token ambiguity', () => {
        const reg = new TimelineRegistry('123');
        // Two nodes with token 111111111, but one matches epoch 5
        reg.getOrCreateChild(null, 'conversation', 'conv:a', 5, NOW, 111111111);
        reg.getOrCreateChild(null, 'conversation', 'conv:b', 99, NOW, 111111111);
        // Another node at epoch 5 without the token (epoch heuristic would pick this)
        reg.getOrCreateChild(null, 'conversation', 'conv:c', 5, NOW, 222222222);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx });
        expect(result.status).toBe('ambiguous');
    });

    it('continues to next evidence when token matches 0 nodes', () => {
        const reg = new TimelineRegistry('123');
        reg.getOrCreateChild(null, 'conversation', 'conv:root', 5, NOW, 222222222);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx });
        expect(result.status).not.toBe('resolved');
    });
});

describe('resolveTimelineStrict - evidence 3: live journal attempt', () => {
    it('resolves when live attempt matches requestKey and observed state', () => {
        const reg = new TimelineRegistry('123');
        // The target node must exist in the registry for the resolver to return it
        const targetNodeId = reg.getOrCreateChild(null, 'conversation', 'conv:target', 6, NOW);
        const store = new TransitionJournalStore();
        const entry = makeEntry({
            transitionAttemptId: 'att-live',
            source: 'conversation',
            requestKey: 'req-live',
            observedEpoch: 5,
            observedCk3NodeId: '101-202',
            targetNodeId,
            targetEpoch: 6,
            phase: 'store-committed',
            terminalEvidence: undefined
        });
        store.upsertEntry(entry);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: '101-202',
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({
            registry: reg,
            context: ctx,
            store,
            requestKey: 'req-live',
            source: 'conversation'
        });
        expect(result.status).toBe('resolved');
        if (result.status !== 'resolved') return;
        expect(result.evidence.kind).toBe('live-attempt-unique-match');
    });

    it('does not resolve when attempt has terminalEvidence', () => {
        const reg = new TimelineRegistry('123');
        const store = new TransitionJournalStore();
        const entry = makeEntry({
            transitionAttemptId: 'att-done',
            source: 'conversation',
            requestKey: 'req-done',
            observedEpoch: 5,
            observedCk3NodeId: '101-202',
            phase: 'artifact-written',
            terminalEvidence: {
                resultId: 'r1',
                attemptId: 'att-done',
                status: 'applied',
                observed: { epoch: 5 },
                recordedAt: NOW
            }
        } as TransitionJournalEntry);
        store.upsertEntry(entry);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: '101-202',
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({
            registry: reg,
            context: ctx,
            store,
            requestKey: 'req-done',
            source: 'conversation'
        });
        expect(result.status).not.toBe('resolved');
    });

    it('does not resolve when observed state differs from the live attempt', () => {
        const reg = new TimelineRegistry('123');
        const store = new TransitionJournalStore();
        const entry = makeEntry({
            transitionAttemptId: 'att-mismatch',
            source: 'conversation',
            requestKey: 'req-mismatch',
            observedEpoch: 99,
            observedCk3NodeId: '888-999',
            phase: 'store-committed'
        });
        store.upsertEntry(entry);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: '101-202',
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({
            registry: reg,
            context: ctx,
            store,
            requestKey: 'req-mismatch',
            source: 'conversation'
        });
        expect(result.status).not.toBe('resolved');
    });

    it('skips evidence 3 when no store or no requestKey provided', () => {
        const reg = new TimelineRegistry('123');
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: '999999-999999'
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx });
        expect(result.status).toBe('missing-node');
    });

    it('returns registry-corrupt when live attempt targetNodeId is missing from registry', () => {
        const reg = new TimelineRegistry('123');
        // registry is empty: the live attempt's targetNodeId does not exist.
        const store = new TransitionJournalStore();
        store.upsertEntry(makeEntry({
            transitionAttemptId: 'att-orphan',
            source: 'conversation',
            requestKey: 'req-orphan',
            observedEpoch: 5,
            observedCk3NodeId: '101-202',
            targetNodeId: '505-606',
            phase: 'store-committed'
        }));
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: '101-202'
        };
        const result = resolveTimelineStrict({
            registry: reg,
            context: ctx,
            store,
            requestKey: 'req-orphan',
            source: 'conversation'
        });
        expect(result.status).toBe('registry-corrupt');
        if (result.status !== 'registry-corrupt') return;
        expect(result.reason).toContain('505-606');
    });
});

describe('resolveTimelineStrict - evidence 4: migration manifest', () => {
    it('resolves when manifest is imported and sourceNodeId is in registry', () => {
        const reg = new TimelineRegistry('123');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 5, NOW, 111111111);
        const manifest = makeManifest({ sourceNodeId: nodeId });
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx, migrationManifest: manifest });
        expect(result.status).toBe('resolved');
        if (result.status !== 'resolved') return;
        expect(result.evidence.kind).toBe('migration-manifest');
        expect(result.evidence.sourceNodeId).toBe(nodeId);
    });

    it('does not resolve when manifest status is skipped', () => {
        const reg = new TimelineRegistry('123');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 5, NOW, 111111111);
        const manifest = makeManifest({ status: 'skipped', sourceNodeId: nodeId });
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx, migrationManifest: manifest });
        expect(result.status).not.toBe('resolved');
    });

    it('does not resolve when sourceNodeId is not in registry', () => {
        const reg = new TimelineRegistry('123');
        const manifest = makeManifest({ sourceNodeId: '999999-999999' });
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx, migrationManifest: manifest });
        expect(result.status).not.toBe('resolved');
    });
});

describe('resolveTimelineStrict - evidence 5: ambiguous/missing/legacy', () => {
    it('returns missing-node when CK3 reports a node not in registry', () => {
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: '999999-999999'
        };
        const result = resolveTimelineStrict({ registry: new TimelineRegistry('123'), context: ctx });
        expect(result.status).toBe('missing-node');
    });

    it('returns ambiguous when epoch present but no evidence matches', () => {
        const reg = new TimelineRegistry('123');
        reg.getOrCreateChild(null, 'conversation', 'conv:a', 5, NOW, 222222222);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            checkpointToken: 111111111
        };
        const result = resolveTimelineStrict({ registry: reg, context: ctx });
        expect(result.status).toBe('ambiguous');
    });

    it('returns legacy-unresolved when no epoch and no nodeId', () => {
        const ctx: TimelineContext = {
            playerId: '123'
        };
        const result = resolveTimelineStrict({ registry: new TimelineRegistry('123'), context: ctx });
        expect(result.status).toBe('legacy-unresolved');
    });
});

describe('resolveTimelineContext (production) delegates to strict resolver', () => {
    it('resolves a self-consistent node via evidence 1', () => {
        const reg = new TimelineRegistry('123');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 5, NOW, 111111111);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: nodeId,
            checkpointToken: 111111111
        };
        const resolved = resolveTimelineContext(reg, ctx);
        expect(resolved.timelineNodeId).toBe(nodeId);
    });

    it('resolves via token bridge', () => {
        const reg = new TimelineRegistry('123');
        const left = reg.getOrCreateChild(null, 'conversation', 'conv:left', 5, NOW, 111111111);
        const right = reg.getOrCreateChild(null, 'conversation', 'conv:right', 5, NOW, 234567891);
        const ctx = buildContextFromGameData({
            playerID: 123,
            votcCheckpointEpoch: 5,
            votcTimelineNodeA: 0,
            votcTimelineNodeB: 0,
            votcCheckpointToken: 234567891
        });
        const resolved = resolveTimelineContext(reg, ctx);
        expect(resolved.timelineNodeId).toBe(right);
        expect(resolved.timelineNodeId).not.toBe(left);
    });

    it('returns original context when token is ambiguous (no epoch fallback)', () => {
        const reg = new TimelineRegistry('123');
        reg.getOrCreateChild(null, 'conversation', 'conv:a', 5, NOW, 111111111);
        reg.getOrCreateChild(null, 'conversation', 'conv:b', 5, NOW, 111111111);
        // Another node at epoch 5 with a different token (epoch heuristic would pick this)
        reg.getOrCreateChild(null, 'conversation', 'conv:c', 5, NOW, 222222222);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            checkpointToken: 111111111
        };
        const resolved = resolveTimelineContext(reg, ctx);
        // Should NOT resolve to conv:c via epoch fallback
        expect(resolved.timelineNodeId).toBeUndefined();
    });

    it('returns original context for legacy snapshot without nodeId (no epoch heuristic)', () => {
        const reg = new TimelineRegistry('123');
        const legacyRoot = reg.getOrCreateChild(null, 'letter_reply', 'letter_reply:legacy_root', 0, NOW);
        const reply = reg.getOrCreateChild(legacyRoot, 'letter_reply', 'letter:letter_1', 1, NOW);
        const ctx = buildContextFromGameData({ playerID: 123, votcCheckpointEpoch: 1 });
        const resolved = resolveTimelineContext(reg, ctx);
        // Strict resolver does NOT use epoch heuristic to find the unique node
        expect(resolved.timelineNodeId).toBeUndefined();
    });

    it('keeps a valid checkpoint node when the active token is stale', () => {
        const reg = new TimelineRegistry('123');
        const root = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW, 111111111);
        const current = reg.getOrCreateChild(root, 'conversation', 'conv:current', 2, NOW, 222222222);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 2,
            checkpointToken: 111111111,
            timelineNodeId: current,
            timelineParentId: root
        };
        const resolved = resolveTimelineContext(reg, ctx);
        expect(resolved.timelineNodeId).toBe(current);
    });

    it('ignores a token match from a different checkpoint epoch', () => {
        const reg = new TimelineRegistry('123');
        const stale = reg.getOrCreateChild(null, 'conversation', 'conv:stale', 1, NOW, 111111111);
        const current = reg.getOrCreateChild(stale, 'conversation', 'conv:current', 2, NOW);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 2,
            checkpointToken: 111111111,
            timelineNodeId: current,
            timelineParentId: stale
        };
        const resolved = resolveTimelineContext(reg, ctx);
        expect(resolved.timelineNodeId).toBe(current);
    });
});

describe('production resolver does not call epoch heuristics', () => {
    it('resolveTimelineContext does not call repairLegacyContinuity', () => {
        const reg = new TimelineRegistry('123');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 5, NOW, 111111111);
        const ctx: TimelineContext = {
            playerId: '123',
            checkpointEpoch: 5,
            timelineNodeId: nodeId
        };
        const spy = jest.spyOn(TimelineRegistry.prototype, 'repairLegacyContinuity');
        try {
            resolveTimelineContext(reg, ctx);
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});
