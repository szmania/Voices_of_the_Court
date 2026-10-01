import {
    parseTimelineSnapshot,
    TIMELINE_PROTOCOL_SCHEMA,
    TIMELINE_CAMPAIGN_SCHEMA,
    PROTOCOL_TAIL_FIELD_COUNT,
    UnsupportedTimelineSchemaError,
    type TimelineSnapshot,
    type LegacyTimelineSnapshot
} from '../../src/shared/gameData/timelineProtocol';
import { GameData } from '../../src/shared/gameData/GameData';
import {
    TimelineRegistry,
    buildContextFromBattleCheckpoint,
    buildContextFromGameData,
    buildContextFromSnapshot,
    resolveTimelineContext
} from '../../src/main/timelineManager';
import {
    parseManagerClipboardPayload,
    decideManagerWindowContext
} from '../../src/main/managerClipboardPayload';

const NOW = '2026-07-20T00:00:00Z';

const INIT_BASE = ['123', 'Player Name', '456', 'AI Name', '1066.1.1', 'scene:test', 'Location', 'Controller', '7', '11', '22', '33', '44', '555', '666'];
const VALID_TAIL = ['2', '1', '101', '202', '303', '404', '1', '1'];
const MANAGER_BASE = ['123', '7', 'Some Name', '11', '22', '33', '44', '555', '666'];
const BATTLE_BASE = ['7', '11', '22', '33', '44', '555', '666'];

function initFields(tail?: string[]): string[] {
    return tail ? [...INIT_BASE, ...tail] : [...INIT_BASE];
}

describe('parseTimelineSnapshot - init source', () => {
    it('parses a valid v2 init line with the full protocol tail', () => {
        const result = parseTimelineSnapshot(initFields(VALID_TAIL), 'init');
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        const s = result.snapshot;
        expect(s.source).toBe('init');
        expect(s.playerId).toBe('123');
        expect(s.epoch).toBe(7);
        expect(s.nodeA).toBe(11);
        expect(s.nodeB).toBe(22);
        expect(s.parentA).toBe(33);
        expect(s.parentB).toBe(44);
        expect(s.checkpointToken).toBe(555);
        expect(s.pendingCheckpointToken).toBe(666);
        expect(s.protocol).toEqual({
            protocolSchema: TIMELINE_PROTOCOL_SCHEMA,
            campaignSchema: TIMELINE_CAMPAIGN_SCHEMA,
            campaignIdA: 101,
            campaignIdB: 202,
            campaignIdC: 303,
            campaignIdD: 404,
            campaignBootstrapKind: 1,
            playerTimelineSchema: 1
        });
    });

    it('does not guess a transition attempt id from init fields', () => {
        const result = parseTimelineSnapshot(initFields(VALID_TAIL), 'init');
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect('attemptId' in result.snapshot).toBe(false);
        expect('transitionAttemptId' in result.snapshot).toBe(false);
    });

    it('routes a v1 init line without a tail through the explicit legacy path', () => {
        const result = parseTimelineSnapshot(initFields(), 'init');
        expect(result.status).toBe('legacy');
        if (result.status !== 'legacy') return;
        expect(result.snapshot.epoch).toBe(7);
        expect(result.snapshot.nodeA).toBe(11);
        expect(result.snapshot.nodeB).toBe(22);
        expect(result.snapshot.parentA).toBe(33);
        expect(result.snapshot.parentB).toBe(44);
        expect(result.snapshot.checkpointToken).toBe(555);
        expect(result.snapshot.pendingCheckpointToken).toBe(666);
        expect('protocol' in result.snapshot).toBe(false);
    });

    it('treats an all-empty tail as legacy', () => {
        const result = parseTimelineSnapshot(initFields(['', '', '', '', '', '', '', '']), 'init');
        expect(result.status).toBe('legacy');
    });

    it('rejects an unsupported protocol schema', () => {
        const tail = ['3', ...VALID_TAIL.slice(1)];
        const result = parseTimelineSnapshot(initFields(tail), 'init');
        expect(result).toEqual({ status: 'unsupported-schema', schema: 3 });
    });

    it('rejects an explicit protocol schema 1 as unsupported', () => {
        const tail = ['1', ...VALID_TAIL.slice(1)];
        const result = parseTimelineSnapshot(initFields(tail), 'init');
        expect(result).toEqual({ status: 'unsupported-schema', schema: 1 });
    });

    it('rejects a non-integer protocol schema as invalid', () => {
        const tail = ['abc', ...VALID_TAIL.slice(1)];
        const result = parseTimelineSnapshot(initFields(tail), 'init');
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('protocol schema');
    });

    it('rejects an unsupported campaign schema', () => {
        const tail = ['2', '9', ...VALID_TAIL.slice(2)];
        const result = parseTimelineSnapshot(initFields(tail), 'init');
        expect(result).toEqual({ status: 'unsupported-schema', schema: 9 });
    });

    it('rejects a truncated tail', () => {
        const result = parseTimelineSnapshot(initFields(VALID_TAIL.slice(0, 3)), 'init');
        expect(result).toEqual({ status: 'truncated', expected: INIT_BASE.length + PROTOCOL_TAIL_FIELD_COUNT, actual: INIT_BASE.length + 3 });
    });

    it('rejects a campaign id with a zero component as invalid-campaign', () => {
        const tail = ['2', '1', '101', '0', '303', '404', '1', '1'];
        const result = parseTimelineSnapshot(initFields(tail), 'init');
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('campaign');
    });

    it('rejects a non-integer campaign id component', () => {
        const tail = ['2', '1', '101', 'x', '303', '404', '1', '1'];
        const result = parseTimelineSnapshot(initFields(tail), 'init');
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('campaign');
    });

    it('treats an empty bootstrap kind and player timeline schema as unknown', () => {
        const tail = ['2', '1', '101', '202', '303', '404', '', ''];
        const result = parseTimelineSnapshot(initFields(tail), 'init');
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect(result.snapshot.protocol.campaignBootstrapKind).toBe(0);
        expect(result.snapshot.protocol.playerTimelineSchema).toBe(0);
    });

    it('rejects an incomplete timeline node pair', () => {
        const fields = initFields();
        fields[10] = '0';
        const result = parseTimelineSnapshot(fields, 'init');
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('timeline node pair');
    });

    it('normalizes zero node, parent and token sentinels to undefined', () => {
        const fields = initFields();
        fields[9] = '0';
        fields[10] = '0';
        fields[11] = '0';
        fields[12] = '0';
        fields[13] = '0';
        fields[14] = '0';
        const result = parseTimelineSnapshot(fields, 'init');
        expect(result.status).toBe('legacy');
        if (result.status !== 'legacy') return;
        expect(result.snapshot.nodeA).toBeUndefined();
        expect(result.snapshot.nodeB).toBeUndefined();
        expect(result.snapshot.parentA).toBeUndefined();
        expect(result.snapshot.parentB).toBeUndefined();
        expect(result.snapshot.checkpointToken).toBeUndefined();
        expect(result.snapshot.pendingCheckpointToken).toBeUndefined();
    });

    it('tolerates a non-numeric init epoch as unknown', () => {
        const fields = initFields();
        fields[8] = 'ERROR';
        const result = parseTimelineSnapshot(fields, 'init');
        expect(result.status).toBe('legacy');
        if (result.status !== 'legacy') return;
        expect(result.snapshot.epoch).toBeUndefined();
    });
});

describe('parseTimelineSnapshot - manager source', () => {
    it('parses a v2 manager clipboard tail', () => {
        const result = parseTimelineSnapshot([...MANAGER_BASE, ...VALID_TAIL], 'manager');
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect(result.snapshot.playerId).toBe('123');
        expect(result.snapshot.playerName).toBe('Some Name');
        expect(result.snapshot.epoch).toBe(7);
        expect(result.snapshot.protocol.campaignIdA).toBe(101);
        expect(result.snapshot.protocol.campaignIdD).toBe(404);
    });

    it('returns truncated when the core payload is short', () => {
        const result = parseTimelineSnapshot(MANAGER_BASE.slice(0, 7), 'manager');
        expect(result).toEqual({ status: 'truncated', expected: 9, actual: 7 });
    });

    it('returns truncated when the manager tail is partial', () => {
        const result = parseTimelineSnapshot([...MANAGER_BASE, '2', '1'], 'manager');
        expect(result).toEqual({ status: 'truncated', expected: 9 + PROTOCOL_TAIL_FIELD_COUNT, actual: 11 });
    });

    it('rejects an unsupported manager protocol schema', () => {
        const result = parseTimelineSnapshot([...MANAGER_BASE, '4', ...VALID_TAIL.slice(1)], 'manager');
        expect(result).toEqual({ status: 'unsupported-schema', schema: 4 });
    });
});

describe('parseTimelineSnapshot - battle source', () => {
    it('parses a legacy battle checkpoint line', () => {
        const result = parseTimelineSnapshot(BATTLE_BASE, 'battle');
        expect(result.status).toBe('legacy');
        if (result.status !== 'legacy') return;
        expect(result.snapshot.epoch).toBe(7);
        expect(result.snapshot.nodeA).toBe(11);
        expect(result.snapshot.nodeB).toBe(22);
        expect(result.snapshot.parentA).toBe(33);
        expect(result.snapshot.parentB).toBe(44);
        expect(result.snapshot.checkpointToken).toBe(555);
        expect(result.snapshot.pendingCheckpointToken).toBe(666);
        expect(result.snapshot.playerId).toBeUndefined();
    });

    it('parses a v2 battle checkpoint line with tail', () => {
        const result = parseTimelineSnapshot([...BATTLE_BASE, ...VALID_TAIL], 'battle');
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect(result.snapshot.protocol.protocolSchema).toBe(TIMELINE_PROTOCOL_SCHEMA);
    });

    it('rejects an unsupported battle protocol schema', () => {
        const result = parseTimelineSnapshot([...BATTLE_BASE, '7', ...VALID_TAIL.slice(1)], 'battle');
        expect(result).toEqual({ status: 'unsupported-schema', schema: 7 });
    });
});

describe('manager clipboard v2 tail', () => {
    it('parses the v2 tail into the payload protocol', () => {
        const result = parseManagerClipboardPayload([...MANAGER_BASE, ...VALID_TAIL]);
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect(result.payload.protocol).toEqual({
            protocolSchema: TIMELINE_PROTOCOL_SCHEMA,
            campaignSchema: TIMELINE_CAMPAIGN_SCHEMA,
            campaignIdA: 101,
            campaignIdB: 202,
            campaignIdC: 303,
            campaignIdD: 404,
            campaignBootstrapKind: 1,
            playerTimelineSchema: 1
        });
        expect(result.payload.extraFields).toEqual(VALID_TAIL);
    });

    it('keeps a tail-less payload on the legacy path', () => {
        const result = parseManagerClipboardPayload(MANAGER_BASE);
        expect(result.status).toBe('valid');
        if (result.status !== 'valid') return;
        expect(result.payload.protocol).toBeUndefined();
    });

    it('surfaces an unsupported schema instead of a window context', () => {
        const fields = [...MANAGER_BASE, '5', ...VALID_TAIL.slice(1)];
        const result = parseManagerClipboardPayload(fields);
        expect(result).toEqual({ status: 'unsupported-schema', schema: 5 });

        const decision = decideManagerWindowContext('Summary manager', fields);
        expect(decision.status).toBe('error');
        if (decision.status !== 'error') return;
        expect(decision.unsupportedSchema).toBe(5);
        expect(decision.message).toContain('5');
    });
});

describe('GameData protocol fields', () => {
    it('parses protocol, campaign and player timeline schema from a v2 init line', () => {
        const gameData = new GameData(initFields(VALID_TAIL));
        expect(gameData.votcProtocolSchema).toBe(TIMELINE_PROTOCOL_SCHEMA);
        expect(gameData.votcCampaignSchema).toBe(TIMELINE_CAMPAIGN_SCHEMA);
        expect(gameData.votcCampaignIdA).toBe(101);
        expect(gameData.votcCampaignIdB).toBe(202);
        expect(gameData.votcCampaignIdC).toBe(303);
        expect(gameData.votcCampaignIdD).toBe(404);
        expect(gameData.votcCampaignBootstrapKind).toBe(1);
        expect(gameData.votcPlayerTimelineSchema).toBe(1);
        expect(gameData.timelineSnapshotResult?.status).toBe('valid');
        expect(gameData.votcTimelineNodeA).toBe(11);
        expect(gameData.votcCheckpointToken).toBe(555);
    });

    it('parses real Phase 4 campaign id values sourced from CK3 globals', () => {
        // Real campaign id segments are 29-bit non-zero values with the leading
        // bit set: [2^28, 2^29 - 1] = [268435456, 536870911]. Bootstrap kind 2
        // means old checkpoint evidence was detected at creation time; player
        // timeline schema 0 means votc_timeline_schema was unset on the player.
        const realTail = [
            String(TIMELINE_PROTOCOL_SCHEMA),
            String(TIMELINE_CAMPAIGN_SCHEMA),
            '268435457',
            '402653184',
            '536870911',
            '314159265',
            '2',
            '0'
        ];
        const gameData = new GameData(initFields(realTail));
        expect(gameData.timelineSnapshotResult?.status).toBe('valid');
        expect(gameData.votcCampaignIdA).toBe(268435457);
        expect(gameData.votcCampaignIdB).toBe(402653184);
        expect(gameData.votcCampaignIdC).toBe(536870911);
        expect(gameData.votcCampaignIdD).toBe(314159265);
        expect(gameData.votcCampaignBootstrapKind).toBe(2);
        expect(gameData.votcPlayerTimelineSchema).toBe(0);
    });

    it('rejects a real-sized campaign id with a zero segment as invalid', () => {
        const realTail = [
            String(TIMELINE_PROTOCOL_SCHEMA),
            String(TIMELINE_CAMPAIGN_SCHEMA),
            '268435457',
            '0',
            '536870911',
            '314159265',
            '1',
            '0'
        ];
        const result = parseTimelineSnapshot(initFields(realTail), 'init');
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('campaign id');
    });

    it('leaves v2 fields undefined for a legacy v1 init line', () => {
        const gameData = new GameData(initFields());
        expect(gameData.votcProtocolSchema).toBeUndefined();
        expect(gameData.votcCampaignSchema).toBeUndefined();
        expect(gameData.votcCampaignIdA).toBeUndefined();
        expect(gameData.votcCampaignBootstrapKind).toBeUndefined();
        expect(gameData.votcPlayerTimelineSchema).toBeUndefined();
        expect(gameData.timelineSnapshotResult?.status).toBe('legacy');
        expect(gameData.votcTimelineNodeA).toBe(11);
        expect(gameData.votcCheckpointToken).toBe(555);
    });

    it('blocks context building for an unsupported schema', () => {
        const gameData = new GameData(initFields(['3', ...VALID_TAIL.slice(1)]));
        expect(gameData.timelineSnapshotResult?.status).toBe('unsupported-schema');
        expect(gameData.votcTimelineNodeA).toBeUndefined();
        expect(() => buildContextFromGameData(gameData)).toThrow(UnsupportedTimelineSchemaError);
    });

    it('builds the same context from a parsed v2 snapshot as from v1 fields', () => {
        const v2 = new GameData(initFields(VALID_TAIL));
        const context = buildContextFromGameData(v2);
        expect(context.playerId).toBe('123');
        expect(context.checkpointEpoch).toBe(7);
        expect(context.timelineNodeId).toBe('11-22');
        expect(context.timelineParentId).toBe('33-44');
        expect(context.checkpointToken).toBe(555);
        expect(context.pendingCheckpointToken).toBe(666);
    });
});

describe('buildContextFromSnapshot - observed vs graph parent', () => {
    it('keeps the observed CK3 node in the snapshot while the resolver returns the graph node', () => {
        const registry = new TimelineRegistry('123');
        const root = registry.getOrCreateChild(null, 'conversation', 'root', 6, NOW);
        const child = registry.getOrCreateChild(root, 'conversation', 'evt-1', 7, NOW, 555);

        const parsed = parseTimelineSnapshot(initFields(), 'init');
        expect(parsed.status).toBe('legacy');
        if (parsed.status !== 'legacy') return;
        const observed = parsed.snapshot;

        const context = buildContextFromSnapshot('123', observed);
        expect(context.timelineNodeId).toBe('11-22');
        expect(context.timelineParentId).toBe('33-44');

        const resolved = resolveTimelineContext(registry, context);
        expect(resolved.timelineNodeId).toBe(child);
        expect(resolved.timelineParentId).toBe(root);
        expect(observed.nodeA).toBe(11);
        expect(observed.nodeB).toBe(22);
    });
});

describe('buildContextFromBattleCheckpoint', () => {
    const gameDataLike = {
        playerID: 123,
        votcCheckpointEpoch: 9,
        votcTimelineNodeA: 51,
        votcTimelineNodeB: 52,
        votcTimelineParentA: 41,
        votcTimelineParentB: 42,
        votcCheckpointToken: 901,
        votcPendingCheckpointToken: 902
    };

    it('falls back to the GameData context when the battle has no checkpoint line', () => {
        const context = buildContextFromBattleCheckpoint('123', undefined, gameDataLike);
        expect(context.timelineNodeId).toBe('51-52');
        expect(context.timelineParentId).toBe('41-42');
        expect(context.checkpointToken).toBe(901);
        expect(context.checkpointEpoch).toBe(9);
    });

    it('yields an epoch-only context when the checkpoint line is present but invalid', () => {
        const corrupt = parseTimelineSnapshot(['7', '11', '0', '33', '44', '555', '666'], 'battle');
        expect(corrupt.status).toBe('invalid');
        const context = buildContextFromBattleCheckpoint('123', corrupt, gameDataLike);
        expect(context.timelineNodeId).toBeUndefined();
        expect(context.timelineParentId).toBeUndefined();
        expect(context.checkpointToken).toBeUndefined();
        expect(context.pendingCheckpointToken).toBeUndefined();
        expect(context.checkpointEpoch).toBe(9);
    });

    it('yields an epoch-only context when the checkpoint line is present but truncated', () => {
        const corrupt = parseTimelineSnapshot(['7', '11', '22', '33', '44', '555', '666', '2', '1'], 'battle');
        expect(corrupt.status).toBe('truncated');
        const context = buildContextFromBattleCheckpoint('123', corrupt, gameDataLike);
        expect(context.timelineNodeId).toBeUndefined();
        expect(context.checkpointToken).toBeUndefined();
        expect(context.checkpointEpoch).toBe(9);
    });

    it('uses the battle checkpoint instead of GameData when the snapshot is usable', () => {
        const parsed = parseTimelineSnapshot(BATTLE_BASE, 'battle');
        const context = buildContextFromBattleCheckpoint('123', parsed, gameDataLike);
        expect(context.timelineNodeId).toBe('11-22');
        expect(context.timelineParentId).toBe('33-44');
        expect(context.checkpointToken).toBe(555);
        expect(context.checkpointEpoch).toBe(7);
    });

    it('throws for an unsupported battle checkpoint schema', () => {
        const unsupported = parseTimelineSnapshot([...BATTLE_BASE, '7', ...VALID_TAIL.slice(1)], 'battle');
        expect(unsupported.status).toBe('unsupported-schema');
        expect(() => buildContextFromBattleCheckpoint('123', unsupported, gameDataLike)).toThrow(UnsupportedTimelineSchemaError);
    });
});
