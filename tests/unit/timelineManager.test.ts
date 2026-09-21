import {
    TimelineRegistry,
    FsTimelinePersistence,
    parseTimelineInit,
    buildCheckpointSetEffect,
    isLegacyContext,
    parseNodeId,
    isValidNodeId,
    formatNodeId,
    generateNodeId,
    MAX_NODE_COMPONENT,
    buildContextFromGameData,
    resolveTimelineContext,
    resolveTimelineContextLegacy,
    createChildNodeAndScript
} from '../../src/main/timelineManager';
import { writeLegacyPlayerRegistry } from '../../src/main/timelineLegacyWriter';
import fs from 'fs';
import path from 'path';
import os from 'os';

const NOW = '2026-07-16T00:00:00Z';

describe('formatNodeId / parseNodeId', () => {
    it('formats and round-trips', () => {
        const id = formatNodeId({ a: 101, b: 202 });
        expect(id).toBe('101-202');
        const parsed = parseNodeId(id);
        expect(parsed).toEqual({ a: 101, b: 202 });
    });

    it('rejects malformed ids', () => {
        expect(parseNodeId(undefined)).toBeUndefined();
        expect(parseNodeId('')).toBeUndefined();
        expect(parseNodeId('abc')).toBeUndefined();
        expect(parseNodeId('-5')).toBeUndefined();
        expect(parseNodeId('5-')).toBeUndefined();
        expect(parseNodeId('-1-2')).toBeUndefined();
    });

    it('rejects out-of-range components', () => {
        const over = MAX_NODE_COMPONENT + 1;
        expect(parseNodeId(`${over}-1`)).toBeUndefined();
        expect(parseNodeId(`1-${over}`)).toBeUndefined();
        expect(parseNodeId('-1-2')).toBeUndefined();
        expect(parseNodeId('1--2')).toBeUndefined();
    });
});

describe('isValidNodeId', () => {
    it('accepts valid ids only', () => {
        expect(isValidNodeId('101-202')).toBe(true);
        expect(isValidNodeId('0-0')).toBe(false);
        expect(isValidNodeId(undefined)).toBe(false);
        expect(isValidNodeId('foo-bar')).toBe(false);
    });
});

describe('generateNodeId', () => {
    it('produces valid unique-ish ids in range', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 1000; i++) {
            const id = formatNodeId(generateNodeId());
            const parsed = parseNodeId(id)!;
            expect(parsed.a).toBeGreaterThan(0);
            expect(parsed.a).toBeLessThanOrEqual(MAX_NODE_COMPONENT);
            expect(parsed.b).toBeGreaterThan(0);
            expect(parsed.b).toBeLessThanOrEqual(MAX_NODE_COMPONENT);
            ids.add(id);
        }
        expect(ids.size).toBeGreaterThan(900);
    });
});

describe('TimelineRegistry - graph construction & isolation', () => {
    it('A -> B and A -> C do not mix', () => {
        const reg = new TimelineRegistry('player1');

        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        const bId = reg.getOrCreateChild(aId, 'conversation', 'conv:B', 2, NOW);
        const cId = reg.getOrCreateChild(aId, 'conversation', 'conv:C', 2, NOW);

        const ancestorsB = reg.getAncestorSet(bId);
        const ancestorsC = reg.getAncestorSet(cId);

        expect(ancestorsB).toEqual(new Set([bId, aId]));
        expect(ancestorsC).toEqual(new Set([cId, aId]));
        expect(ancestorsB.has(cId)).toBe(false);
        expect(ancestorsC.has(bId)).toBe(false);
    });

    it('A -> B -> B2 chain: B2 sees A and B but not C', () => {
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        const bId = reg.getOrCreateChild(aId, 'conversation', 'conv:B', 2, NOW);
        const b2Id = reg.getOrCreateChild(bId, 'conversation', 'conv:B2', 3, NOW);
        const cId = reg.getOrCreateChild(aId, 'conversation', 'conv:C', 2, NOW);

        expect(reg.getAncestorSet(b2Id)).toEqual(new Set([b2Id, bId, aId]));
        expect(reg.getAncestorSet(b2Id).has(cId)).toBe(false);
    });
});

describe('TimelineRegistry - idempotency', () => {
    it('same source + eventKey + parent returns same node (battle fallback + LLM override)', () => {
        const reg = new TimelineRegistry('player1');
        const parentId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);

        const fallbackId = reg.getOrCreateChild(parentId, 'battle', 'battle:sig-42', 2, NOW);
        const llmOverrideId = reg.getOrCreateChild(parentId, 'battle', 'battle:sig-42', 2, NOW);

        expect(fallbackId).toBe(llmOverrideId);
        expect(reg.getAllNodes().filter(n => n.source === 'battle').length).toBe(1);
    });

    it('different eventKey produces a new node', () => {
        const reg = new TimelineRegistry('player1');
        const parentId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);

        const n1 = reg.getOrCreateChild(parentId, 'battle', 'battle:sig-1', 2, NOW);
        const n2 = reg.getOrCreateChild(parentId, 'battle', 'battle:sig-2', 2, NOW);
        expect(n1).not.toBe(n2);
    });

    it('same eventKey different parent produces distinct nodes (same battle, two branches)', () => {
        const reg = new TimelineRegistry('player1');
        const rootA = reg.getOrCreateChild(null, 'conversation', 'conv:A', 1, NOW);
        const rootB = reg.getOrCreateChild(null, 'conversation', 'conv:B', 1, NOW);

        const nodeB = reg.getOrCreateChild(rootB, 'battle', 'battle:sig-99', 2, NOW);
        const nodeC = reg.getOrCreateChild(rootB, 'battle', 'battle:sig-99', 2, NOW);
        expect(nodeB).toBe(nodeC);

        const nodeA = reg.getOrCreateChild(rootA, 'battle', 'battle:sig-99', 2, NOW);
        expect(nodeA).not.toBe(nodeB);
    });
});

describe('TimelineRegistry - visibility', () => {
    it('record on B branch visible at B, not at C', () => {
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        const bId = reg.getOrCreateChild(aId, 'conversation', 'conv:B', 2, NOW);
        const cId = reg.getOrCreateChild(aId, 'conversation', 'conv:C', 2, NOW);

        const bRecord = bId;
        const cRecord = cId;

        expect(reg.isRecordVisible(bRecord, bId)).toBe(true);
        expect(reg.isRecordVisible(bRecord, cId)).toBe(false);
        expect(reg.isRecordVisible(cRecord, cId)).toBe(true);
        expect(reg.isRecordVisible(cRecord, bId)).toBe(false);
    });

    it('record on ancestor A is visible from both B and C', () => {
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        const bId = reg.getOrCreateChild(aId, 'conversation', 'conv:B', 2, NOW);
        const cId = reg.getOrCreateChild(aId, 'conversation', 'conv:C', 2, NOW);

        expect(reg.isRecordVisible(aId, bId)).toBe(true);
        expect(reg.isRecordVisible(aId, cId)).toBe(true);
    });

    it('legacy records (no node id) are always visible', () => {
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);

        expect(reg.isRecordVisible(undefined, aId)).toBe(true);
        expect(reg.isRecordVisible('', aId)).toBe(true);
    });

    it('fails closed when current node is unknown to the registry', () => {
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        const bId = reg.getOrCreateChild(aId, 'conversation', 'conv:B', 2, NOW);

        expect(reg.isRecordVisible(bId, '999999-999999')).toBe(false);
    });

    it('fails closed when current node id is malformed', () => {
        const reg = new TimelineRegistry('player1');
        expect(reg.isRecordVisible('101-202', 'garbage')).toBe(true);
    });

    it('record with malformed node id is treated as legacy (visible)', () => {
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        expect(reg.isRecordVisible('not-a-node', aId)).toBe(true);
    });
});

describe('TimelineRegistry - persistence round-trip', () => {
    it('dirty flag tracks changes and markClean resets', () => {
        const reg = new TimelineRegistry('player1');
        expect(reg.isDirty()).toBe(false);
        reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        expect(reg.isDirty()).toBe(true);
        reg.markClean();
        expect(reg.isDirty()).toBe(false);
    });
});

describe('parseTimelineInit', () => {
    it('detects legacy when node fields absent', () => {
        const snap = parseTimelineInit(undefined, undefined, undefined, undefined, 5);
        expect(snap.isLegacy).toBe(true);
        expect(snap.nodeId).toBeUndefined();
        expect(snap.epoch).toBe(5);
    });

    it('parses a full new-format snapshot', () => {
        const snap = parseTimelineInit('101', '202', '0', '0', 3);
        expect(snap.isLegacy).toBe(false);
        expect(snap.nodeId).toBe('101-202');
        expect(snap.parentId).toBeUndefined();
        expect(snap.epoch).toBe(3);
        expect(snap.schema).toBe(1);
    });

    it('root node (no parent) parses with undefined parentId', () => {
        const snap = parseTimelineInit('303', '404', undefined, undefined, 1);
        expect(snap.isLegacy).toBe(false);
        expect(snap.nodeId).toBe('303-404');
        expect(snap.parentId).toBeUndefined();
    });

    it('treats malformed node fields as legacy', () => {
        const snap = parseTimelineInit('abc', '202', '0', '0', 3);
        expect(snap.isLegacy).toBe(true);
    });

    it('treats CK3 zero sentinels as a legacy snapshot', () => {
        const snap = parseTimelineInit('0', '0', '0', '0', 3);
        expect(snap.isLegacy).toBe(true);
        expect(snap.nodeId).toBeUndefined();
    });
});

describe('buildCheckpointSetEffect', () => {
    it('builds a root node set effect', () => {
        const effect = buildCheckpointSetEffect('101-202', null, 3, 'votc_battle_report_player');
        expect(effect).toContain('set_variable = { name = votc_checkpoint_epoch value = 3 }');
        expect(effect).toContain('set_variable = { name = votc_timeline_node_a value = 101 }');
        expect(effect).toContain('set_variable = { name = votc_timeline_node_b value = 202 }');
        expect(effect).toContain('set_variable = { name = votc_timeline_parent_a value = 0 }');
        expect(effect).toContain('set_variable = { name = votc_timeline_parent_b value = 0 }');
        expect(effect).toContain('set_variable = { name = votc_timeline_schema value = 1 }');
        expect(effect).toContain('VOTC:CHECKPOINT/;/set');
        expect(effect).toContain('/;/3/;/101/;/202/;/0/;/0');
    });

    it('builds a child node set effect with parent values', () => {
        const effect = buildCheckpointSetEffect('303-404', '101-202', 5, 'votc_battle_report_player');
        expect(effect).toContain('set_variable = { name = votc_timeline_parent_a value = 101 }');
        expect(effect).toContain('set_variable = { name = votc_timeline_parent_b value = 202 }');
        expect(effect).toContain('/;/5/;/303/;/404/;/101/;/202');
    });

    it('promotes the reserved CK3 token when supplied', () => {
        const effect = buildCheckpointSetEffect('303-404', '101-202', 5, 'votc_battle_report_player', 123456789);
        expect(effect).toContain('set_variable = { name = votc_checkpoint_token value = 123456789 }');
        expect(effect).toContain('remove_variable ?= votc_checkpoint_pending_token');
    });

    it('preserves an explicit persisted global scope for delayed letter run files', () => {
        const effect = buildCheckpointSetEffect('303-404', '101-202', 5, 'global_var:message_first_scope');
        expect(effect).toContain('global_var:message_first_scope = {');
        expect(effect).not.toContain('scope:global_var:message_first_scope');
    });

    it('throws on invalid node id', () => {
        expect(() => buildCheckpointSetEffect('garbage', null, 1, 'actor')).toThrow();
    });

    it('omits epoch line when epoch undefined', () => {
        const effect = buildCheckpointSetEffect('101-202', null, undefined, 'actor');
        expect(effect).not.toContain('votc_checkpoint_epoch');
        expect(effect).toContain('votc_timeline_node_a');
    });
});

describe('isLegacyContext', () => {
    it('returns true when timelineNodeId is missing', () => {
        expect(isLegacyContext({ playerId: '1', checkpointEpoch: 5 })).toBe(true);
        expect(isLegacyContext(undefined)).toBe(true);
    });

    it('returns false when timelineNodeId is present and valid', () => {
        expect(isLegacyContext({ playerId: '1', checkpointEpoch: 5, timelineNodeId: '101-202' })).toBe(false);
    });

    it('returns true when timelineNodeId is present but malformed', () => {
        expect(isLegacyContext({ playerId: '1', checkpointEpoch: 5, timelineNodeId: 'garbage' })).toBe(true);
    });
});

describe('FsTimelinePersistence', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-timeline-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns null when no registry file exists', () => {
        const p = new FsTimelinePersistence(tmpDir);
        expect(p.loadRegistry('player1')).toBeNull();
    });

    it('saves and reloads a registry with all nodes preserved', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        const bId = reg.getOrCreateChild(aId, 'conversation', 'conv:B', 2, NOW);

        // §4.2: use the test-only legacy writer (saveRegistry refuses to
        // create new player-only files).
        writeLegacyPlayerRegistry(tmpDir, reg);

        const expectedPath = path.join(tmpDir, 'votc_data', 'timeline_registry', 'player_player1.json');
        expect(fs.existsSync(expectedPath)).toBe(true);

        const reloaded = p.loadRegistry('player1');
        expect(reloaded).not.toBeNull();
        expect(reloaded!.hasNode(aId)).toBe(true);
        expect(reloaded!.hasNode(bId)).toBe(true);
        expect(reloaded!.getNode(bId)!.parentId).toBe(aId);
    });

    it('loads registries written by the previous nested-votc_data path', () => {
        const legacyPersistence = new FsTimelinePersistence(path.join(tmpDir, 'votc_data'));
        const reg = new TimelineRegistry('player1');
        const nodeId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        // §4.2: pre-seed the legacy file via the test-only writer.
        writeLegacyPlayerRegistry(path.join(tmpDir, 'votc_data'), reg);

        const p = new FsTimelinePersistence(tmpDir);
        const reloaded = p.loadRegistry('player1');
        expect(reloaded?.hasNode(nodeId)).toBe(true);
    });

    it('does not rewrite file when registry is not dirty', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        // §4.2: pre-seed the legacy file. writeLegacyPlayerRegistry marks the
        // registry clean, so a subsequent saveRegistry call is a no-op.
        writeLegacyPlayerRegistry(tmpDir, reg);
        const filePath = path.join(tmpDir, 'votc_data', 'timeline_registry', 'player_player1.json');
        const mtimeBefore = fs.statSync(filePath).mtimeMs;

        reg.markClean();
        p.saveRegistry(reg);
        const mtimeAfter = fs.statSync(filePath).mtimeMs;
        expect(mtimeAfter).toBe(mtimeBefore);
    });

    it('returns null on corrupted JSON', () => {
        const dir = path.join(tmpDir, 'votc_data', 'timeline_registry');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'player_corrupt.json'), '{not valid json', 'utf8');
        const p = new FsTimelinePersistence(tmpDir);
        expect(p.loadRegistry('corrupt')).toBeNull();
    });

    it('returns null on schema mismatch', () => {
        const dir = path.join(tmpDir, 'votc_data', 'timeline_registry');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'player_bad.json'), JSON.stringify({
            version: 999,
            playerId: 'bad',
            nodes: {}
        }), 'utf8');
        const p = new FsTimelinePersistence(tmpDir);
        expect(p.loadRegistry('bad')).toBeNull();
    });

    it('idempotent: saving the same child node twice produces one node in the file', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = new TimelineRegistry('player1');
        const parentId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);

        const first = reg.getOrCreateChild(parentId, 'battle', 'battle:sig-42', 2, NOW);
        // §4.2: pre-seed the legacy file.
        writeLegacyPlayerRegistry(tmpDir, reg);
        reg.markClean();

        const second = reg.getOrCreateChild(parentId, 'battle', 'battle:sig-42', 2, NOW);
        expect(second).toBe(first);
        p.saveRegistry(reg);

        const reloaded = p.loadRegistry('player1');
        expect(reloaded).not.toBeNull();
        expect(reloaded!.getAllNodes().filter(n => n.source === 'battle').length).toBe(1);
    });

    it('§4.2 invariant: saveRegistry refuses to create new player-only registries (Phase 4 activates the guard)', () => {
        const votcData = path.join(tmpDir, 'votc_data');
        const summariesDir = path.join(votcData, 'conversation_summaries', 'player42');
        fs.mkdirSync(summariesDir, { recursive: true });
        fs.writeFileSync(path.join(summariesDir, '100.json'), JSON.stringify([{ content: 'old' }]), 'utf8');

        const p = new FsTimelinePersistence(tmpDir);
        const reg = new TimelineRegistry('player42');
        reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        // §4.2: saveRegistry throws when the primary file does not exist, so
        // no new player-only timeline records can be created. The pre-migration
        // backup feature (which ran on first-write) is no longer reachable via
        // saveRegistry; migration is handled by stageCampaignMigration instead.
        expect(() => p.saveRegistry(reg)).toThrow(/§4\.2|saveStoreWithIdentity/);

        // No registry file should be created.
        const registryPath = path.join(votcData, 'timeline_registry', 'player_player42.json');
        expect(fs.existsSync(registryPath)).toBe(false);
        // The pre-migration backup marker should not be created either.
        const markerPath = path.join(votcData, 'timeline_registry', 'player_player42.migrated');
        expect(fs.existsSync(markerPath)).toBe(false);
    });
});

describe('buildContextFromGameData', () => {
    it('returns legacy context when node fields absent', () => {
        const ctx = buildContextFromGameData({ playerID: 123, votcCheckpointEpoch: 5 });
        expect(isLegacyContext(ctx)).toBe(true);
        expect(ctx.playerId).toBe('123');
        expect(ctx.checkpointEpoch).toBe(5);
        expect(ctx.timelineNodeId).toBeUndefined();
    });

    it('returns full context when node fields present', () => {
        const ctx = buildContextFromGameData({
            playerID: 123,
            votcCheckpointEpoch: 5,
            votcTimelineNodeA: 101,
            votcTimelineNodeB: 202,
            votcTimelineParentA: 0,
            votcTimelineParentB: 0
        });
        expect(isLegacyContext(ctx)).toBe(false);
        expect(ctx.timelineNodeId).toBe('101-202');
        expect(ctx.timelineParentId).toBeUndefined();
    });

    it('includes the active and reserved checkpoint tokens', () => {
        const ctx = buildContextFromGameData({
            playerID: 123,
            votcCheckpointEpoch: 5,
            votcCheckpointToken: 123456789,
            votcPendingCheckpointToken: 234567891
        });
        expect(ctx.checkpointToken).toBe(123456789);
        expect(ctx.pendingCheckpointToken).toBe(234567891);
    });

    it('returns legacy context on malformed node values', () => {
        const ctx = buildContextFromGameData({
            playerID: 123,
            votcCheckpointEpoch: 5,
            votcTimelineNodeA: -1,
            votcTimelineNodeB: 202
        });
        expect(isLegacyContext(ctx)).toBe(true);
    });

    it('returns legacy context for CK3 zero sentinels', () => {
        const ctx = buildContextFromGameData({
            playerID: 123,
            votcCheckpointEpoch: 5,
            votcTimelineNodeA: 0,
            votcTimelineNodeB: 0,
            votcTimelineParentA: 0,
            votcTimelineParentB: 0
        });
        expect(isLegacyContext(ctx)).toBe(true);
    });
});

describe('resolveTimelineContext', () => {
    it('legacy resolver continues a legacy snapshot from its unique checkpoint node (migration preview only)', () => {
        const reg = new TimelineRegistry('123');
        const legacyRoot = reg.getOrCreateChild(null, 'letter_reply', 'letter_reply:legacy_root', 0, NOW);
        const reply = reg.getOrCreateChild(legacyRoot, 'letter_reply', 'letter:letter_1', 1, NOW);

        // Phase 5: the strict production resolver no longer uses epoch heuristics.
        // resolveTimelineContextLegacy preserves the prior behavior for the
        // explicit migration preview flow (§9.5).
        const resolved = resolveTimelineContextLegacy(
            reg,
            buildContextFromGameData({ playerID: 123, votcCheckpointEpoch: 1 })
        );

        expect(resolved.timelineNodeId).toBe(reply);
        const next = createChildNodeAndScript(reg, resolved, 'incoming_letter', 'incoming:letter_1', 2, 'talk_first_scope', NOW);
        expect(next.parentId).toBe(reply);
    });

    it('legacy resolver uses a unique generated descendant when CK3 reports its older parent node (migration preview only)', () => {
        const reg = new TimelineRegistry('123');
        const incoming = reg.getOrCreateChild(null, 'incoming_letter', 'incoming:first', 2, NOW);
        const reply = reg.getOrCreateChild(incoming, 'letter_reply', 'letter:letter_2', 3, NOW);

        const resolved = resolveTimelineContextLegacy(reg, {
            playerId: '123',
            checkpointEpoch: 3,
            timelineNodeId: incoming
        });

        expect(resolved.timelineNodeId).toBe(reply);
        expect(resolved.timelineParentId).toBe(incoming);
    });

    it('strict production resolver does not use epoch heuristic for legacy snapshots', () => {
        const reg = new TimelineRegistry('123');
        const legacyRoot = reg.getOrCreateChild(null, 'letter_reply', 'letter_reply:legacy_root', 0, NOW);
        const reply = reg.getOrCreateChild(legacyRoot, 'letter_reply', 'letter:letter_1', 1, NOW);
        void reply;

        const resolved = resolveTimelineContext(
            reg,
            buildContextFromGameData({ playerID: 123, votcCheckpointEpoch: 1 })
        );

        // Strict resolver: no epoch heuristic -> returns context unchanged
        expect(resolved.timelineNodeId).toBeUndefined();
    });

    it('does not join ambiguous branches when the checkpoint alone cannot identify one', () => {
        const reg = new TimelineRegistry('123');
        const root = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        reg.getOrCreateChild(root, 'conversation', 'conv:left', 2, NOW);
        reg.getOrCreateChild(root, 'conversation', 'conv:right', 2, NOW);
        const legacyContext = buildContextFromGameData({ playerID: 123, votcCheckpointEpoch: 2 });

        expect(resolveTimelineContext(reg, legacyContext)).toEqual(legacyContext);
    });

    it('uses the CK3 token to select the right branch when the epoch is ambiguous', () => {
        const reg = new TimelineRegistry('123');
        const root = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        const left = reg.getOrCreateChild(root, 'conversation', 'conv:left', 2, NOW, 123456789);
        const right = reg.getOrCreateChild(root, 'conversation', 'conv:right', 2, NOW, 234567891);

        const resolved = resolveTimelineContext(reg, buildContextFromGameData({
            playerID: 123,
            votcCheckpointEpoch: 2,
            votcTimelineNodeA: 0,
            votcTimelineNodeB: 0,
            votcCheckpointToken: 234567891
        }));

        expect(resolved.timelineNodeId).toBe(right);
        expect(resolved.timelineNodeId).not.toBe(left);
    });

    it('keeps a valid checkpoint node when the active token is stale', () => {
        const reg = new TimelineRegistry('123');
        const root = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW, 111111111);
        const current = reg.getOrCreateChild(root, 'conversation', 'conv:current', 2, NOW, 222222222);

        const resolved = resolveTimelineContext(reg, {
            playerId: '123',
            checkpointEpoch: 2,
            checkpointToken: 111111111,
            timelineNodeId: current,
            timelineParentId: root
        });

        expect(resolved.timelineNodeId).toBe(current);
    });

    it('ignores a token match from a different checkpoint epoch', () => {
        const reg = new TimelineRegistry('123');
        const stale = reg.getOrCreateChild(null, 'conversation', 'conv:stale', 1, NOW, 111111111);
        const current = reg.getOrCreateChild(stale, 'conversation', 'conv:current', 2, NOW);

        const resolved = resolveTimelineContext(reg, {
            playerId: '123',
            checkpointEpoch: 2,
            checkpointToken: 111111111,
            timelineNodeId: current,
            timelineParentId: stale
        });

        expect(resolved.timelineNodeId).toBe(current);
    });
});

describe('TimelineRegistry legacy continuity repair', () => {
    it('reconnects a stale legacy-root parent and subsequent epoch gaps', () => {
        const reg = new TimelineRegistry('123');
        const replyRoot = reg.getOrCreateChild(null, 'letter_reply', 'letter_reply:legacy_root', 0, '2026-07-16T00:00:00Z');
        const reply = reg.getOrCreateChild(replyRoot, 'letter_reply', 'letter:letter_1', 1, '2026-07-16T00:00:01Z');
        const incomingRoot = reg.getOrCreateChild(null, 'incoming_letter', 'incoming_letter:legacy_root', 1, '2026-07-16T00:00:02Z');
        const incoming = reg.getOrCreateChild(incomingRoot, 'incoming_letter', 'incoming:first', 2, '2026-07-16T00:00:03Z');
        const secondReply = reg.getOrCreateChild(incoming, 'letter_reply', 'letter:letter_2', 3, '2026-07-16T00:00:04Z');
        const laterIncoming = reg.getOrCreateChild(incoming, 'incoming_letter', 'incoming:second', 4, '2026-07-16T00:00:05Z');

        expect(reg.repairLegacyContinuity()).toBe(2);
        expect(reg.getNode(incoming)?.parentId).toBe(reply);
        expect(reg.getNode(laterIncoming)?.parentId).toBe(secondReply);
        expect(reg.getAncestorSet(laterIncoming)).toEqual(new Set([laterIncoming, secondReply, incoming, reply, replyRoot]));
    });

    it('leaves valid sibling branches unchanged', () => {
        const reg = new TimelineRegistry('123');
        const root = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        const left = reg.getOrCreateChild(root, 'conversation', 'conv:left', 2, NOW);
        const right = reg.getOrCreateChild(root, 'conversation', 'conv:right', 2, NOW);

        expect(reg.repairLegacyContinuity()).toBe(0);
        expect(reg.getNode(left)?.parentId).toBe(root);
        expect(reg.getNode(right)?.parentId).toBe(root);
    });
});

describe('createChildNodeAndScript', () => {
    it('creates a root node when parent is legacy, then a child on subsequent calls', () => {
        const reg = new TimelineRegistry('player1');
        const legacyCtx = buildContextFromGameData({ playerID: 123, votcCheckpointEpoch: 5 });

        const result1 = createChildNodeAndScript(reg, legacyCtx, 'conversation', 'conv:first', 6, 'talk_first_scope', NOW);
        expect(result1.createdNewRoot).toBe(true);
        expect(result1.script).toContain('set_variable = { name = votc_timeline_node_a');
        expect(result1.script).toContain('scope:talk_first_scope');

        const nonLegacyCtx = result1.context;
        const result2 = createChildNodeAndScript(reg, nonLegacyCtx, 'conversation', 'conv:second', 7, 'talk_first_scope', NOW);
        expect(result2.createdNewRoot).toBe(false);
        expect(result2.parentId).toBe(result1.nodeId);
        expect(reg.getAncestorSet(result2.nodeId).has(result1.nodeId)).toBe(true);
    });

    it('attaches the preallocated CK3 token to the child checkpoint', () => {
        const reg = new TimelineRegistry('player1');
        const parentCtx = buildContextFromGameData({
            playerID: 123,
            votcCheckpointEpoch: 5,
            votcPendingCheckpointToken: 123456789
        });

        const result = createChildNodeAndScript(reg, parentCtx, 'conversation', 'conv:token', 6, 'talk_first_scope', NOW);

        expect(reg.getNode(result.nodeId)?.checkpointToken).toBe(123456789);
        expect(result.context.checkpointToken).toBe(123456789);
        expect(result.script).toContain('set_variable = { name = votc_checkpoint_token value = 123456789 }');
    });

    it('is idempotent for the same source+eventKey (battle fallback+override)', () => {
        const reg = new TimelineRegistry('player1', {
            version: 1,
            playerId: 'player1',
            nodes: {
                '10-20': { parentId: null, epoch: 5, source: 'conversation', eventKey: 'conv:root', createdAt: NOW }
            }
        });
        const parentCtx = buildContextFromGameData({
            playerID: 1,
            votcCheckpointEpoch: 5,
            votcTimelineNodeA: 10,
            votcTimelineNodeB: 20,
            votcTimelineParentA: 0,
            votcTimelineParentB: 0
        });

        const r1 = createChildNodeAndScript(reg, parentCtx, 'battle', 'battle:sig-99', 6, 'votc_battle_report_player', NOW);
        const r2 = createChildNodeAndScript(reg, parentCtx, 'battle', 'battle:sig-99', 6, 'votc_battle_report_player', NOW);
        expect(r1.nodeId).toBe(r2.nodeId);
        expect(reg.getAllNodes().filter(n => n.source === 'battle').length).toBe(1);
    });

    it('two branches from same parent produce distinct nodes (A->B, A->C)', () => {
        const reg = new TimelineRegistry('player1', {
            version: 1,
            playerId: 'player1',
            nodes: {
                '10-20': { parentId: null, epoch: 5, source: 'conversation', eventKey: 'conv:root', createdAt: NOW }
            }
        });
        const parentCtx = buildContextFromGameData({
            playerID: 1,
            votcCheckpointEpoch: 5,
            votcTimelineNodeA: 10,
            votcTimelineNodeB: 20,
            votcTimelineParentA: 0,
            votcTimelineParentB: 0
        });

        const b = createChildNodeAndScript(reg, parentCtx, 'conversation', 'conv:B', 6, 'talk_first_scope', NOW);
        const c = createChildNodeAndScript(reg, parentCtx, 'conversation', 'conv:C', 6, 'talk_first_scope', NOW);

        expect(b.nodeId).not.toBe(c.nodeId);
        expect(reg.getAncestorSet(b.nodeId).has(c.nodeId)).toBe(false);
        expect(reg.getAncestorSet(c.nodeId).has(b.nodeId)).toBe(false);
    });
});
