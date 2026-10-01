/**
 * F21: IncomingLetterGenerator.saveSummary must route the incoming-letter
 * summary into the CAMPAIGN-scoped conversation_summaries directory (with a
 * votcCampaignId lineage stamp) whenever the parsed snapshot carries a v2
 * campaign identity, and into the legacy flat store when it does not.
 *
 * saveSummary is driven directly: unlike the full-pipeline budget test it does
 * not need a debug.log fixture, only the parsed GameData shape the generator
 * consumes.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const userData = () => path.join(os.tmpdir(), 'votc-incoming-summary-f21');

jest.mock('electron', () => ({
    app: { getPath: jest.fn(() => userData()) }
}));

jest.mock('../../../src/shared/apiConnection', () => ({
    ApiConnection: jest.fn().mockImplementation(() => ({
        complete: jest.fn().mockResolvedValue('LLM_REPLY_BODY'),
        calculateTokensFromText: jest.fn(() => 1)
    }))
}));

import { IncomingLetterGenerator } from '../../../src/main/letter/IncomingLetterGenerator';
import { Config } from '../../../src/shared/Config';
import { Character } from '../../../src/shared/gameData/Character';
import { conversationSummariesDir } from '../../../src/main/campaignDataPaths';
import type { CampaignPlayerIdentity } from '../../../src/shared/gameData/CampaignIdentity';

/** Mirrors the private IncomingLetterContext shape (saveSummary only needs these fields). */
interface IncomingLetterContext {
    slotId: string;
    type: string;
    sentDate: string;
    senderId: number;
    deliveryId: number;
    facts: Record<string, string>;
    snapshotStartOffset: number;
    snapshotEndOffset: number;
}

const PLAYER_ID = 1001;
const SENDER_ID = 2002;
const CAMPAIGN_ID = '111111111-222222222-333333333-444444444';
const identity: CampaignPlayerIdentity = {
    protocolSchema: 2,
    campaignSchema: 1,
    campaignId: CAMPAIGN_ID,
    campaignParts: { a: 111111111, b: 222222222, c: 333333333, d: 444444444 },
    playerId: String(PLAYER_ID)
};

function v2TimelineSnapshotResult() {
    return {
        status: 'valid' as const,
        snapshot: {
            playerId: String(PLAYER_ID),
            source: 'manager' as const,
            epoch: 42,
            nodeA: 11,
            nodeB: 22,
            parentA: 5,
            parentB: 6,
            protocol: {
                protocolSchema: 2,
                campaignSchema: 1,
                campaignIdA: 111111111,
                campaignIdB: 222222222,
                campaignIdC: 333333333,
                campaignIdD: 444444444,
                campaignBootstrapKind: 0,
                playerTimelineSchema: 1
            }
        }
    };
}

function makeGameData(options: { withIdentity: boolean }) {
    const sender = { id: SENDER_ID, fullName: 'Sender Person', shortName: 'Sender' } as unknown as Character;
    return {
        playerID: PLAYER_ID,
        votcCheckpointEpoch: 42,
        date: '1066.9.25',
        characters: new Map<number, Character>([[SENDER_ID, sender]]),
        votcTimelineNodeA: 11,
        votcTimelineNodeB: 22,
        votcTimelineParentA: 5,
        votcTimelineParentB: 6,
        timelineSnapshotResult: options.withIdentity ? v2TimelineSnapshotResult() : undefined
    };
}

function makeContext(): IncomingLetterContext {
    return {
        slotId: 'incoming_letter_1',
        type: 'family_letter',
        sentDate: '1066.9.25',
        senderId: SENDER_ID,
        deliveryId: 389340,
        facts: {},
        snapshotStartOffset: 0,
        snapshotEndOffset: 1
    };
}

function makeTimeline() {
    return {
        nodeId: '11-23',
        parentId: '11-22',
        script: 'debug_log = "VOTC:CHECKPOINT"',
        context: { timelineNodeId: '11-23', timelineParentId: '11-22', checkpointEpoch: 43 } as any,
        createdNewRoot: false
    };
}

function makeGenerator(): IncomingLetterGenerator {
    const config = {
        textGenerationApiConnectionConfig: { connection: {}, parameters: { temperature: 0.7 } },
        language: '中文'
    } as unknown as Config;
    // Mirror main.ts: the generator receives the <userData>/votc_data root.
    return new IncomingLetterGenerator(config, path.join(userData(), 'votc_data'), null);
}

function campaignSummaryFile(): string {
    return path.join(conversationSummariesDir(userData(), identity), `${SENDER_ID}.json`);
}

function legacySummaryFile(): string {
    return path.join(userData(), 'votc_data', 'conversation_summaries', String(PLAYER_ID), `${SENDER_ID}.json`);
}

beforeEach(() => {
    fs.rmSync(userData(), { recursive: true, force: true });
});

afterAll(() => {
    fs.rmSync(userData(), { recursive: true, force: true });
});

describe('F21 incoming-letter summary campaign routing', () => {
    it('stores the summary in the campaign namespace with campaignId + node stamps', async () => {
        const generator = makeGenerator();
        await (generator as any).saveSummary(
            makeGameData({ withIdentity: true }),
            makeContext(),
            'dearest friend, greetings from afar',
            makeTimeline(),
            'source-record-1',
            { totalDays: 389357, year: 1066, month: 9, day: 25, display: '1066.09.25' }
        );

        const raw = JSON.parse(fs.readFileSync(campaignSummaryFile(), 'utf8'));
        expect(raw).toHaveLength(1);
        expect(raw[0].votcCampaignId).toBe(CAMPAIGN_ID);
        expect(raw[0].votcTimelineNodeId).toBe('11-23');
        expect(raw[0].votcTimelineParentId).toBe('11-22');
        expect(raw[0].votcCheckpointEpoch).toBe(43);
        expect(raw[0].votcTimelineNodeId).toBe('11-23');
        expect(raw[0].sourceType).toBe('incoming_letter');
        // The legacy flat store is not written anymore.
        expect(fs.existsSync(legacySummaryFile())).toBe(false);
    });

    it('keeps the legacy flat store for snapshots without a campaign identity', async () => {
        const generator = makeGenerator();
        await (generator as any).saveSummary(
            makeGameData({ withIdentity: false }),
            makeContext(),
            'dearest friend, greetings from afar',
            makeTimeline(),
            'source-record-2',
            undefined
        );

        const raw = JSON.parse(fs.readFileSync(legacySummaryFile(), 'utf8'));
        expect(raw).toHaveLength(1);
        expect(raw[0].votcCampaignId).toBeUndefined();
        expect(fs.existsSync(path.join(userData(), 'votc_data', 'campaigns'))).toBe(false);
    });
});
