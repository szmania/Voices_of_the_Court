/**
 * P5.4 §9.3 source request contract tests.
 *
 * Each business source (conversation/letter_reply/incoming_letter/battle/bookmark)
 * must be wired to TransitionJournalApi (beginTransition with source-specific
 * requestKey + commitMode) + resolveTimelineStrict + v2 store writes. v1
 * getOrCreateChild eventKey dedup is no longer used for NEW records.
 */
import {
    TransitionJournalStore,
    type TimelineNodeV2,
    type TransitionJournalEntry
} from '../../src/main/timelineTransitionJournal';
import {
    FsTimelinePersistence,
    TimelineRegistry,
    type GameDataLike,
    type TimelineContext
} from '../../src/main/timelineManager';
import {
    TransitionJournalApi
} from '../../src/main/timelineJournalApi';
import {
    runConversationTimelineTransition,
    runLetterReplyTimelineTransition,
    runIncomingLetterTimelineTransition,
    runBattleTimelineBatchTransition,
    recordBookmarkImport,
    resolveTimelineContextLegacy,
    type ConversationTransitionInput,
    type LetterReplyTransitionInput,
    type IncomingLetterTransitionInput,
    type BattleBatchTransitionEntry,
    type BookmarkImportInput
} from '../../src/main/timelineBusinessWire';
import {
    coordinateBattlesBySnapshot,
    type BattleCoordinatorEntry
} from '../../src/main/timelineCoordinator';
import {
    resolveTimelineStrict
} from '../../src/main/timelineResolver';
import { buildIdentityFromParts, type CampaignPlayerIdentity } from '../../src/shared/gameData/CampaignIdentity';
import {
    TIMELINE_PROTOCOL_SCHEMA,
    TIMELINE_CAMPAIGN_SCHEMA,
    type TimelineParseResult
} from '../../src/shared/gameData/timelineProtocol';
import fs from 'fs';
import path from 'path';
import os from 'os';

const NOW = '2026-07-21T00:00:00Z';

function makeIdentity(playerId = '1001'): CampaignPlayerIdentity {
    return buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, playerId);
}

function makeSnapshotResult(epoch: number, identity: CampaignPlayerIdentity, observedNode?: { a: number; b: number }, token = 42): TimelineParseResult {
    const snapshot: any = {
        playerId: identity.playerId,
        playerName: 'Test',
        source: 'init',
        epoch,
        checkpointToken: token
    };
    if (observedNode) {
        snapshot.nodeA = observedNode.a;
        snapshot.nodeB = observedNode.b;
    }
    return {
        status: 'valid',
        snapshot: {
            ...snapshot,
            protocol: {
                protocolSchema: TIMELINE_PROTOCOL_SCHEMA,
                campaignSchema: TIMELINE_CAMPAIGN_SCHEMA,
                campaignIdA: identity.campaignParts.a,
                campaignIdB: identity.campaignParts.b,
                campaignIdC: identity.campaignParts.c,
                campaignIdD: identity.campaignParts.d,
                campaignBootstrapKind: 1,
                playerTimelineSchema: 1
            }
        }
    };
}

function makeGameData(
    identity: CampaignPlayerIdentity,
    epoch: number,
    observedNode?: { a: number; b: number },
    token = 42
): GameDataLike {
    return {
        playerID: Number(identity.playerId),
        votcCheckpointEpoch: epoch,
        votcCheckpointToken: token,
        timelineSnapshotResult: makeSnapshotResult(epoch, identity, observedNode, token)
    };
}

function campaignRegistryPath(tmpDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(
        tmpDir, 'votc_data', 'campaigns', identity.campaignId, 'players', identity.playerId, 'timeline_registry.json'
    );
}

function freshEnv(tmpDir: string, identity: CampaignPlayerIdentity, opts?: { seedRegistry?: boolean }) {
    const persistence = new FsTimelinePersistence(tmpDir);
    // Seed a v1 legacy root so the registry has something to chain from.
    const registry = new TimelineRegistry(identity.playerId);
    const rootId = registry.getOrCreateChild(null, 'conversation', 'conversation:legacy_root', 1, NOW);
    if (opts?.seedRegistry !== false) {
        persistence.saveStoreWithIdentity(identity, registry);
    }
    return { persistence, registry };
}

describe('§9.3 P5.4 conversation source: atomic-advance + UUID requestKey', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-conv-wire-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('beginTransition uses source=conversation, commitMode=atomic-advance, UUID requestKey', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const input: ConversationTransitionInput = {
            userDataDir: tmpDir,
            gameData,
            identity,
            eventSignature: 'conv:sig-1',
            targetEpoch: 6,
            scopeVar: 'talk_first_scope',
            requestKey: 'conv-uuid-1'
        };
        const result = await runConversationTimelineTransition(input);
        expect(result.attemptId).toBeTruthy();
        expect(result.commitMode).toBe('atomic-advance');
        expect(result.source).toBe('conversation');
        expect(result.requestKey).toBe('conv-uuid-1');
        // Target node created with transitionAttemptId linkage
        expect(result.targetNodeId).toBeDefined();
        // Persisted to disk
        const p = new FsTimelinePersistence(tmpDir);
        const loaded = p.loadStoreWithIdentity(identity);
        expect(loaded.status).toBe('found');
        if (loaded.status !== 'found') return;
        expect(loaded.v2).toBeDefined();
        const entry = loaded.v2!.transitions.find(e => e.transitionAttemptId === result.attemptId);
        expect(entry).toBeDefined();
        expect(entry!.commitMode).toBe('atomic-advance');
        expect(entry!.source).toBe('conversation');
    });

    it('same close reuses the same attempt (rule 1 reuse)', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const input: ConversationTransitionInput = {
            userDataDir: tmpDir,
            gameData,
            identity,
            eventSignature: 'conv:sig-1',
            targetEpoch: 6,
            scopeVar: 'talk_first_scope',
            requestKey: 'conv-uuid-reuse'
        };
        const r1 = await runConversationTimelineTransition(input);
        const r2 = await runConversationTimelineTransition(input);
        expect(r2.attemptId).toBe(r1.attemptId);
        expect(r2.reused).toBe(true);
        // Only one entry persisted
        const p = new FsTimelinePersistence(tmpDir);
        const loaded = p.loadStoreWithIdentity(identity);
        if (loaded.status !== 'found') throw new Error('load failed');
        expect(loaded.v2!.transitions.filter(e => e.source === 'conversation').length).toBe(1);
    });

    it('new close after terminalEvidence -> new UUID (rule 3 reload-redo -> new attempt)', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const input: ConversationTransitionInput = {
            userDataDir: tmpDir,
            gameData,
            identity,
            eventSignature: 'conv:sig-1',
            targetEpoch: 6,
            scopeVar: 'talk_first_scope',
            requestKey: 'conv-uuid-rule3'
        };
        const firstAttempt = await runConversationTimelineTransition(input);
        // Reload the journal store from disk so we can apply a terminal result
        // before the next transition. The production applyCommitResult path
        // also reloads from disk per call (P5.2 rule 7).
        const p = new FsTimelinePersistence(tmpDir);
        const loaded = p.loadStoreWithIdentity(identity);
        if (loaded.status !== 'found') throw new Error('load failed');
        const reloadedStore = new TransitionJournalStore(loaded.v2);
        const reloadedRegistry = loaded.store;
        const api = new TransitionJournalApi({
            store: reloadedStore,
            persistence: p,
            identity,
            registry: reloadedRegistry,
            now: () => NOW
        });
        api.applyCommitResult(firstAttempt.attemptId, {
            resultId: 'r-applied',
            attemptId: firstAttempt.attemptId,
            status: 'applied',
            observed: { epoch: 6, nodeA: 101, nodeB: 202 },
            recordedAt: NOW
        });
        // Now CK3 returns to observed state (epoch 5, node 11-22) - reload-redo
        const reloadedData = makeGameData(identity, 5, { a: 11, b: 22 });
        const r2 = await runConversationTimelineTransition({
            ...input,
            gameData: reloadedData,
            requestKey: 'conv-uuid-rule3-second'
        });
        expect(r2.attemptId).not.toBe(firstAttempt.attemptId);
        expect(r2.reused).toBe(false);
    });

    it('keeps a rollback epoch-regression edge out of the writable graph and can close from that external branch', async () => {
        const identity = makeIdentity();
        const persistence = new FsTimelinePersistence(tmpDir);
        const registry = new TimelineRegistry(identity.playerId);
        const futureParentId = registry.getOrCreateChild(
            null,
            'conversation',
            'conv:future-parent',
            212,
            NOW,
            291048662
        );
        const rollbackNodeId = '1974891161-195722114';
        const rollbackAttemptId = 'rollback-attempt';
        const rollbackNode: TimelineNodeV2 = {
            parentId: futureParentId,
            epoch: 205,
            source: 'incoming_letter',
            transitionAttemptId: rollbackAttemptId,
            requestKey: 'incoming_letter_7|family_letter|204|rollback',
            eventSignature: 'incoming:rollback',
            checkpointCorrelationToken: 318613476,
            createdAt: NOW
        };
        const rollbackEntry: TransitionJournalEntry = {
            transitionAttemptId: rollbackAttemptId,
            source: 'incoming_letter',
            requestKey: 'incoming_letter_7|family_letter|204|rollback',
            observedEpoch: 204,
            observedCk3NodeId: futureParentId,
            observedCurrentToken: 445053510,
            observedPendingToken: 318613476,
            graphParentNodeId: futureParentId,
            targetNodeId: rollbackNodeId,
            targetEpoch: 205,
            targetCorrelationToken: 318613476,
            commitMode: 'post-bump-node-only',
            recordIds: [],
            phase: 'store-committed',
            commitResults: [],
            startedAt: NOW,
            updatedAt: NOW
        };
        persistence.saveStoreWithIdentity(identity, registry, {
            nodes: { [rollbackNodeId]: rollbackNode },
            transitions: [rollbackEntry]
        });

        const loaded = persistence.loadStoreWithIdentity(identity);
        expect(loaded.status).toBe('found');
        if (loaded.status !== 'found') return;
        // The journal remains available, but its backwards edge must not be
        // projected into the graph that will be validated and rewritten.
        expect(loaded.store.hasNode(futureParentId)).toBe(true);
        expect(loaded.store.hasNode(rollbackNodeId)).toBe(false);
        const visibleRollbackNode = loaded.store.getVisibilityNodeEntries()
            .find(([nodeId]) => nodeId === rollbackNodeId)?.[1];
        expect(visibleRollbackNode?.parentId).toBeNull();

        const gameData = makeGameData(
            identity,
            210,
            { a: 1974891161, b: 195722114 },
            525132637
        );
        gameData.votcPendingCheckpointToken = 435899615;
        if (gameData.timelineSnapshotResult?.status === 'valid') {
            gameData.timelineSnapshotResult.snapshot.pendingCheckpointToken = 435899615;
        }

        const result = await runConversationTimelineTransition({
            userDataDir: tmpDir,
            gameData,
            identity,
            eventSignature: 'conv:after-rollback',
            targetEpoch: 211,
            scopeVar: 'talk_first_scope',
            requestKey: 'conv:after-rollback-request'
        });
        expect(result.context.timelineParentId).toBe(rollbackNodeId);

        const reloaded = persistence.loadStoreWithIdentity(identity);
        expect(reloaded.status).toBe('found');
        if (reloaded.status !== 'found') return;
        expect(reloaded.store.hasNode(rollbackNodeId)).toBe(false);
        expect(reloaded.v2?.nodes[result.targetNodeId]).toBeDefined();
    });
});

describe('§9.3 P5.4 letter_reply source: post-bump-node-only + rollback-safe delivery requestKey', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-lr-wire-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('beginTransition uses source=letter_reply, commitMode=post-bump-node-only, and includes the occurrence signature', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const input: LetterReplyTransitionInput = {
            userDataDir: tmpDir,
            gameData,
            identity,
            slotId: 'incoming_letter_1',
            letterDeliveryId: 999,
            eventSignature: 'letter:delivery-999:date-4500',
            targetEpoch: 6,
            scopeVar: 'talk_first_scope'
        };
        const result = await runLetterReplyTimelineTransition(input);
        expect(result.attemptId).toBeTruthy();
        expect(result.commitMode).toBe('post-bump-node-only');
        expect(result.source).toBe('letter_reply');
        // requestKey format: slot|letterDeliveryId|signatureDigest. The last
        // component prevents a post-rollback delivery-id collision.
        expect(result.requestKey).toMatch(/^incoming_letter_1\|999\|[a-f0-9]{16}$/);
    });

    it('same delivery reuses the same attempt', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const input: LetterReplyTransitionInput = {
            userDataDir: tmpDir,
            gameData,
            identity,
            slotId: 'incoming_letter_2',
            letterDeliveryId: 888,
            eventSignature: 'letter:delivery-888',
            targetEpoch: 6,
            scopeVar: 'talk_first_scope'
        };
        const r1 = await runLetterReplyTimelineTransition(input);
        const r2 = await runLetterReplyTimelineTransition(input);
        expect(r2.attemptId).toBe(r1.attemptId);
        expect(r2.reused).toBe(true);
    });

    it('a rollback that reuses the same slot and delivery id but changes the letter creates a sibling attempt', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const common = {
            userDataDir: tmpDir,
            gameData,
            identity,
            slotId: 'letter_1',
            letterDeliveryId: 2,
            targetEpoch: 6,
            scopeVar: 'talk_first_scope'
        };

        const oldBranch = await runLetterReplyTimelineTransition({
            ...common,
            eventSignature: 'letter:letter_1:2:100:14323:867年2月27日:old-content'
        });
        const reloadedBranch = await runLetterReplyTimelineTransition({
            ...common,
            eventSignature: 'letter:letter_1:2:100:9866:867年2月25日:new-content'
        });

        expect(reloadedBranch.attemptId).not.toBe(oldBranch.attemptId);
        expect(reloadedBranch.targetNodeId).not.toBe(oldBranch.targetNodeId);
        expect(reloadedBranch.context.timelineParentId).toBe(oldBranch.context.timelineParentId);
    });

    it('different delivery on same slot -> new attempt', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const r1 = await runLetterReplyTimelineTransition({
            userDataDir: tmpDir, gameData, identity,
            slotId: 'incoming_letter_3', letterDeliveryId: 100,
            eventSignature: 'letter:100', targetEpoch: 6, scopeVar: 'talk_first_scope'
        });
        const r2 = await runLetterReplyTimelineTransition({
            userDataDir: tmpDir, gameData, identity,
            slotId: 'incoming_letter_3', letterDeliveryId: 101,
            eventSignature: 'letter:101', targetEpoch: 6, scopeVar: 'talk_first_scope'
        });
        expect(r2.attemptId).not.toBe(r1.attemptId);
    });

    it('§10.2 reload-redo: terminalEvidence present + CK3 returned to observed -> new attempt (not reuse)', async () => {
        // Scenario: a letter reply was sent and the mod confirmed it (applied).
        // The player then reloads the save back to the pre-reply checkpoint.
        // The same reply request comes in again. Per §10.2, since the old
        // attempt has terminalEvidence and CK3 == observed (not target), the
        // journal API must create a NEW attempt (rule 3 reload-redo), not
        // reuse the old one.
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const observedEpoch = 5;
        const observedNode = { a: 11, b: 22 };
        const gameData = makeGameData(identity, observedEpoch, observedNode);
        const input: LetterReplyTransitionInput = {
            userDataDir: tmpDir, gameData, identity,
            slotId: 'incoming_letter_4', letterDeliveryId: 2002,
            eventSignature: 'letter:2002', targetEpoch: 6, scopeVar: 'talk_first_scope'
        };
        const firstAttempt = await runLetterReplyTimelineTransition(input);
        // Apply a terminal 'applied' result (mod confirmed the reply).
        const p = new FsTimelinePersistence(tmpDir);
        const loaded = p.loadStoreWithIdentity(identity);
        if (loaded.status !== 'found') throw new Error('load failed');
        const reloadedStore = new TransitionJournalStore(loaded.v2);
        const reloadedRegistry = loaded.store;
        const api = new TransitionJournalApi({
            store: reloadedStore,
            persistence: p,
            identity,
            registry: reloadedRegistry,
            now: () => NOW
        });
        api.applyCommitResult(firstAttempt.attemptId, {
            resultId: 'r-applied-letter',
            attemptId: firstAttempt.attemptId,
            status: 'applied',
            observed: { epoch: 6, nodeA: 101, nodeB: 202 },
            recordedAt: NOW
        });
        // Now CK3 is back at the observed state (epoch 5, node 11-22) - reload.
        const reloadedData = makeGameData(identity, observedEpoch, observedNode);
        const r2 = await runLetterReplyTimelineTransition({
            ...input,
            gameData: reloadedData
        });
        expect(r2.attemptId).not.toBe(firstAttempt.attemptId);
        expect(r2.reused).toBe(false);
    });

    it('§10.2 ambiguous: same requestKey, no terminalEvidence, observed differs -> ambiguous (not reuse)', async () => {
        // Per §10.2: "未确认旧 attempt 复用或 ambiguous". When the old attempt
        // has NO terminalEvidence and the observed state differs, the journal
        // API must refuse (ambiguous) rather than silently reuse or create a
        // new attempt.
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const input: LetterReplyTransitionInput = {
            userDataDir: tmpDir, gameData, identity,
            slotId: 'incoming_letter_5', letterDeliveryId: 3003,
            eventSignature: 'letter:3003', targetEpoch: 6, scopeVar: 'talk_first_scope'
        };
        await runLetterReplyTimelineTransition(input);
        // Now the observed state changes (different node) - same requestKey.
        const changedData = makeGameData(identity, 5, { a: 99, b: 88 });
        await expect(runLetterReplyTimelineTransition({
            ...input,
            gameData: changedData
        })).rejects.toThrow(/rule 5\/8|ambiguous/);
    });
});

describe('§9.3 P5.4 incoming_letter source: post-bump-node-only + rollback-safe delivery requestKey', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-il-wire-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('beginTransition uses source=incoming_letter, commitMode=post-bump-node-only, and includes the occurrence signature', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const result = await runIncomingLetterTimelineTransition({
            userDataDir: tmpDir, gameData, identity,
            slotId: 'incoming_letter_1',
            type: 'vassal_memorial',
            deliveryId: 777,
            eventSignature: 'incoming:vassal_memorial:777',
            targetEpoch: 6,
            scopeVar: 'talk_first_scope'
        });
        expect(result.attemptId).toBeTruthy();
        expect(result.commitMode).toBe('post-bump-node-only');
        expect(result.source).toBe('incoming_letter');
        expect(result.requestKey).toMatch(/^incoming_letter_1\|vassal_memorial\|777\|[a-f0-9]{16}$/);
    });

    it('same delivery+type+slot reuses the same attempt', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const input: IncomingLetterTransitionInput = {
            userDataDir: tmpDir, gameData, identity,
            slotId: 'incoming_letter_2', type: 'siege_report', deliveryId: 555,
            eventSignature: 'incoming:siege:555', targetEpoch: 6, scopeVar: 'talk_first_scope'
        };
        const r1 = await runIncomingLetterTimelineTransition(input);
        const r2 = await runIncomingLetterTimelineTransition(input);
        expect(r2.attemptId).toBe(r1.attemptId);
        expect(r2.reused).toBe(true);
    });
});

describe('§9.3 P5.4 battle source: post-bump-node-only + slot+battleDeliveryId requestKey', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-battle-wire-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('beginTransition uses source=battle, commitMode=post-bump-node-only, requestKey=slot+battleDeliveryId (NOT facts signature)', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const battleContext = makeGameData(identity, 5, { a: 99, b: 88 }, 200);
        const entry: BattleBatchTransitionEntry = {
            eventSignature: 'battle|signature|facts',  // facts signature, NOT requestKey
            slotId: 'battle_report_1',
            battleDeliveryId: 'battle-delivery-42',
            context: {
                playerId: identity.playerId,
                checkpointEpoch: 5,
                timelineNodeId: '99-88',
                checkpointToken: 200
            },
            nextEpoch: 6
        };
        const result = await runBattleTimelineBatchTransition({
            userDataDir: tmpDir,
            gameData,
            identity,
            entries: [entry]
        });
        expect(result.timelines.size).toBe(1);
        const timeline = result.timelines.get('battle|signature|facts');
        expect(timeline).toBeDefined();
        expect(timeline!.attemptId).toBeTruthy();
        expect(timeline!.commitMode).toBe('post-bump-node-only');
        expect(timeline!.source).toBe('battle');
        // requestKey is slot|battleDeliveryId, NOT the facts signature
        expect(timeline!.requestKey).toBe('battle_report_1|battle-delivery-42');
        expect(timeline!.requestKey).not.toBe('battle|signature|facts');
    });

    it('same battleDeliveryId reuses the same attempt (fallback+final share node)', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const entry: BattleBatchTransitionEntry = {
            eventSignature: 'battle|sig-A',
            slotId: 'battle_report_2',
            battleDeliveryId: 'bd-100',
            context: {
                playerId: identity.playerId,
                checkpointEpoch: 5,
                timelineNodeId: '11-22',
                checkpointToken: 42
            },
            nextEpoch: 6
        };
        const r1 = await runBattleTimelineBatchTransition({
            userDataDir: tmpDir, gameData, identity, entries: [entry]
        });
        const r2 = await runBattleTimelineBatchTransition({
            userDataDir: tmpDir, gameData, identity, entries: [entry]
        });
        const t1 = r1.timelines.get('battle|sig-A')!;
        const t2 = r2.timelines.get('battle|sig-A')!;
        expect(t2.attemptId).toBe(t1.attemptId);
        expect(t2.reused).toBe(true);
    });

    it('two battles with the same snapshot produce chained epochs (second chains off first)', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        // Both battles observe the same snapshot (same node/epoch/token).
        const sharedContext = {
            playerId: identity.playerId,
            checkpointEpoch: 5,
            timelineNodeId: '11-22',
            checkpointToken: 42
        };
        const result = await runBattleTimelineBatchTransition({
            userDataDir: tmpDir, gameData, identity,
            entries: [
                {
                    eventSignature: 'battle|sig-chain-1',
                    slotId: 'battle_report_chain',
                    battleDeliveryId: 'bd-chain-1',
                    context: sharedContext,
                    nextEpoch: 6
                },
                {
                    eventSignature: 'battle|sig-chain-2',
                    slotId: 'battle_report_chain',
                    battleDeliveryId: 'bd-chain-2',
                    context: sharedContext,
                    nextEpoch: 6
                }
            ]
        });
        const t1 = result.timelines.get('battle|sig-chain-1')!;
        const t2 = result.timelines.get('battle|sig-chain-2')!;
        // Second battle chains off the first: its epoch is >= first epoch + 1
        expect(t2.context.checkpointEpoch as number).toBeGreaterThan(t1.context.checkpointEpoch as number);
        // Second battle's parent is the first battle's target node
        expect(t2.context.timelineParentId).toBe(t1.context.timelineNodeId);
    });

    it('two battles with different snapshots do NOT chain (independent epochs)', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const result = await runBattleTimelineBatchTransition({
            userDataDir: tmpDir, gameData, identity,
            entries: [
                {
                    eventSignature: 'battle|sig-indep-1',
                    slotId: 'battle_report_indep',
                    battleDeliveryId: 'bd-indep-1',
                    context: {
                        playerId: identity.playerId,
                        checkpointEpoch: 5,
                        timelineNodeId: '11-22',
                        checkpointToken: 42
                    },
                    nextEpoch: 6
                },
                {
                    eventSignature: 'battle|sig-indep-2',
                    slotId: 'battle_report_indep',
                    battleDeliveryId: 'bd-indep-2',
                    context: {
                        playerId: identity.playerId,
                        checkpointEpoch: 5,
                        timelineNodeId: '99-88',  // different snapshot node
                        checkpointToken: 200
                    },
                    nextEpoch: 6
                }
            ]
        });
        const t1 = result.timelines.get('battle|sig-indep-1')!;
        const t2 = result.timelines.get('battle|sig-indep-2')!;
        // Different snapshots: both use their own nextEpoch (6), no chaining.
        expect(t2.context.checkpointEpoch).toBe(6);
        expect(t2.context.timelineParentId).toBe('99-88');
        // The second battle's parent is NOT the first battle's target node
        expect(t2.context.timelineParentId).not.toBe(t1.context.timelineNodeId);
    });

    it('coordinator -> wire chaining agrees on raised caller floor for a non-head entry (no divergence)', async () => {
        // §10.1 M-3: confirm the coordinator's resolvedNextEpoch (which raises
        // the chained floor for non-head entries) and the wire's internal
        // chaining computation produce consistent epochs and never lose the
        // chain. The coordinator provides a floor; the wire may raise the
        // non-head epoch further (parentEpoch + 1) when the caller floor
        // dominates, but it must never regress below the coordinator's plan
        // and must never break the parent linkage (t2.parent == t1.target).
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const sharedContext = {
            playerId: identity.playerId,
            checkpointEpoch: 5,
            timelineNodeId: '11-22',
            checkpointToken: 42
        };
        // Caller raises the floor well above the chained floor: both entries
        // claim nextEpoch=20. The coordinator must keep the chain (second
        // entry's resolved epoch >= first + 1 is NOT required when the caller
        // floor dominates) and the wire must agree on the chain linkage.
        const coordinatorEntries: BattleCoordinatorEntry[] = [
            {
                eventSignature: 'battle|chain-floor-1',
                slotId: 'battle_report_chain_floor',
                battleDeliveryId: 'bd-chain-floor-1',
                context: sharedContext,
                nextEpoch: 20
            },
            {
                eventSignature: 'battle|chain-floor-2',
                slotId: 'battle_report_chain_floor',
                battleDeliveryId: 'bd-chain-floor-2',
                context: sharedContext,
                nextEpoch: 20
            }
        ];
        const coordination = coordinateBattlesBySnapshot(coordinatorEntries);
        expect(coordination.planned).toHaveLength(2);
        const [planned1, planned2] = coordination.planned;
        // Head: resolved = max(callerFloor=20, chainedFloor=epoch+1+0=6) = 20.
        expect(planned1.isChainHead).toBe(true);
        expect(planned1.resolvedNextEpoch).toBe(20);
        // Non-head: resolved = max(callerFloor=20, chainedFloor=epoch+1+1=7) = 20.
        expect(planned2.isChainHead).toBe(false);
        expect(planned2.resolvedNextEpoch).toBe(20);

        // Feed the coordinator's resolvedNextEpoch into the wire as nextEpoch
        // (mirrors BattleReportGenerator.ts:328-334).
        const result = await runBattleTimelineBatchTransition({
            userDataDir: tmpDir, gameData, identity,
            entries: coordination.planned.map(p => ({
                eventSignature: p.eventSignature,
                slotId: p.slotId,
                battleDeliveryId: p.battleDeliveryId,
                context: p.context,
                nextEpoch: p.resolvedNextEpoch
            }))
        });
        const t1 = result.timelines.get('battle|chain-floor-1')!;
        const t2 = result.timelines.get('battle|chain-floor-2')!;
        // Head epoch matches the coordinator plan exactly.
        expect(t1.context.checkpointEpoch).toBe(20);
        // Non-head: the wire raises the floor to parentEpoch + 1 = 21 (more
        // conservative than the coordinator's 20, because the wire's chaining
        // floor is parentEpoch + 1, not observedEpoch + 1 + i). This is
        // acceptable: the epoch never regresses below the coordinator's plan,
        // and the chain linkage is preserved (the actual concern of M-3).
        expect(t2.context.checkpointEpoch as number).toBeGreaterThanOrEqual(planned2.resolvedNextEpoch);
        expect(t2.context.checkpointEpoch as number).toBeGreaterThan(t1.context.checkpointEpoch as number);
        // Chain is preserved: t2's parent is t1's target node (not the snapshot).
        expect(t2.context.timelineParentId).toBe(t1.context.timelineNodeId);
        expect(t2.context.timelineParentId).not.toBe('11-22');
    });
});

describe('§9.3 P5.4 bookmark source: record-only (no checkpoint transition)', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-bm-wire-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('recordBookmarkImport writes an idempotent import record on the current node from strict resolver; no attempt created', async () => {
        const identity = makeIdentity();
        const { persistence, registry } = freshEnv(tmpDir, identity);
        // Seed a registry node for the bookmark to attach to.
        const observedNodeId = registry.getOrCreateChild(null, 'conversation', 'conversation:legacy_root', 5, NOW, 42);
        persistence.saveStoreWithIdentity(identity, registry);

        const gameData = makeGameData(identity, 5, parseNodeId(observedNodeId), 42);
        const input: BookmarkImportInput = {
            userDataDir: tmpDir,
            gameData,
            identity,
            importId: 'bookmark-import-001'
        };
        const result = await recordBookmarkImport(input);
        expect(result.currentNodeId).toBeDefined();
        expect(result.currentNodeId).toBe(observedNodeId);
        // No transition attempt should be created (record-only)
        const p = new FsTimelinePersistence(tmpDir);
        const loaded = p.loadStoreWithIdentity(identity);
        if (loaded.status !== 'found') throw new Error('load failed');
        expect(loaded.v2).toBeDefined();
        const importEntries = loaded.v2!.transitions.filter(e => e.source === 'summary_manual');
        // record-only: no new transition entry for the bookmark import
        expect(importEntries.length).toBe(0);
        // But there IS an import record keyed by importId on the node
        // (stored as a v2 node-attached record; implementation-specific)
        expect(result.recorded).toBe(true);
    });

    it('re-import with same importId is idempotent (no duplicate record)', async () => {
        const identity = makeIdentity();
        const { persistence, registry } = freshEnv(tmpDir, identity);
        const observedNodeId = registry.getOrCreateChild(null, 'conversation', 'conversation:legacy_root', 5, NOW, 42);
        persistence.saveStoreWithIdentity(identity, registry);
        const gameData = makeGameData(identity, 5, parseNodeId(observedNodeId), 42);
        const input: BookmarkImportInput = {
            userDataDir: tmpDir, gameData, identity,
            importId: 'bookmark-import-002'
        };
        const r1 = await recordBookmarkImport(input);
        const r2 = await recordBookmarkImport(input);
        expect(r1.recorded).toBe(true);
        // Idempotent: second import does not create a new record
        expect(r2.recorded).toBe(false);
    });

    function parseNodeId(id: string): { a: number; b: number } {
        const m = id.match(/^(\d+)-(\d+)$/);
        return { a: Number(m![1]), b: Number(m![2]) };
    }
});

describe('§9.3 P5.4 v1 eventKey dedup removal: NEW records use journal API + transitionAttemptId', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-v1removal-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('a v2 record created via journal API carries transitionAttemptId (not v1 eventKey dedup)', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const result = await runConversationTimelineTransition({
            userDataDir: tmpDir, gameData, identity,
            eventSignature: 'conv:unique-event',
            targetEpoch: 6,
            scopeVar: 'talk_first_scope',
            requestKey: 'conv-v2-uuid'
        });
        // The new v2 node should reference the attemptId
        const p = new FsTimelinePersistence(tmpDir);
        const loaded = p.loadStoreWithIdentity(identity);
        if (loaded.status !== 'found') throw new Error('load failed');
        const v2Node = loaded.v2!.nodes[result.targetNodeId];
        expect(v2Node).toBeDefined();
        expect(v2Node.transitionAttemptId).toBe(result.attemptId);
        expect(v2Node.requestKey).toBe('conv-v2-uuid');
        expect(v2Node.eventSignature).toBe('conv:unique-event');
    });

    it('calling the same operation twice with same requestKey reuses (NOT v1 eventKey dedup)', async () => {
        const identity = makeIdentity();
        freshEnv(tmpDir, identity);
        const gameData = makeGameData(identity, 5, { a: 11, b: 22 });
        const input = {
            userDataDir: tmpDir, gameData, identity,
            eventSignature: 'conv:dedup-test',
            targetEpoch: 6,
            scopeVar: 'talk_first_scope',
            requestKey: 'conv-dedup-uuid'
        };
        const r1 = await runConversationTimelineTransition(input);
        const r2 = await runConversationTimelineTransition(input);
        // Reuse via journal API (not v1 getOrCreateChild)
        expect(r2.attemptId).toBe(r1.attemptId);
        expect(r2.targetNodeId).toBe(r1.targetNodeId);
    });
});

describe('§9.3 P5.4 manager: read-only (uses strict resolver, no attempt)', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-mgr-ro-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('manager resolution uses resolveTimelineStrict and does not create a transition attempt', async () => {
        const identity = makeIdentity();
        const { persistence, registry } = freshEnv(tmpDir, identity);
        // Seed a node so strict resolver can find it
        const nodeId = registry.getOrCreateChild(null, 'conversation', 'conv:root', 5, NOW, 42);
        persistence.saveStoreWithIdentity(identity, registry);
        const ctx: TimelineContext = {
            playerId: identity.playerId,
            checkpointEpoch: 5,
            timelineNodeId: nodeId,
            checkpointToken: 42
        };
        const resolution = resolveTimelineStrict({ registry, context: ctx });
        expect(resolution.status).toBe('resolved');
        if (resolution.status !== 'resolved') return;
        expect(resolution.evidence.kind).toBe('ck3-node-self-consistent');
        // No new transition attempt was created
        const p = new FsTimelinePersistence(tmpDir);
        const loaded = p.loadStoreWithIdentity(identity);
        if (loaded.status !== 'found') throw new Error('load failed');
        // Initial seed had 0 v2 transitions; manager read does not create any.
        expect(loaded.v2).toBeUndefined();
    });
});

describe('§9.3 P5.4 migration preview: uses legacy resolver (epoch heuristics)', () => {
    let tmpDir: string;
    beforeEach(() => tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-mig-prev-')));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    it('resolveTimelineContextLegacy falls back to epoch heuristics when strict resolver would fail', () => {
        const identity = makeIdentity();
        const registry = new TimelineRegistry(identity.playerId);
        // Seed a node at epoch 3 with no token - strict resolver cannot use evidence 1-5
        // because context.checkpointEpoch doesn't match
        const olderId = registry.getOrCreateChild(null, 'conversation', 'conv:older', 3, NOW);
        const ctx: TimelineContext = {
            playerId: identity.playerId,
            checkpointEpoch: 5,  // newer than the known node
            // no timelineNodeId, no token
        };
        // Strict resolver: no node id, no token, no migration manifest -> ambiguous/legacy-unresolved
        const strict = resolveTimelineStrict({ registry, context: ctx });
        // Legacy resolver: finds the known epoch (3) and resolves to it (epoch heuristic)
        const legacy = resolveTimelineContextLegacy(registry, ctx);
        // Legacy should return a context pointing to the older node
        expect(legacy.timelineNodeId).toBe(olderId);
        // Strict should NOT use the epoch fallback
        expect(strict.status).not.toBe('resolved');
    });
});
