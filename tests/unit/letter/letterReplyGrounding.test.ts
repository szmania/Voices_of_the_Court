/**
 * §12.3: LetterReplyGenerator.buildLetterGrounding must read conversation
 * summaries through the campaign-scoped union read (campaign store when a v2
 * identity is available + legacy player store, dedup by summary id) so
 * campaign-scoped summaries (incoming letters F21, npcltr M4) reach the letter
 * reply prompt. Legacy-only data must keep working without an identity.
 *
 * buildLetterGrounding is driven directly with a minimal GameData shape; the
 * pListLetter description and memory paths run as-is (empty characters produce
 * empty strings, which is fine for the assertions).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const userData = () => path.join(os.tmpdir(), 'votc-letter-reply-grounding');

jest.mock('electron', () => ({
    app: { getPath: jest.fn(() => userData()) },
    BrowserWindow: { getAllWindows: jest.fn(() => []) }
}));

// The character-description script is irrelevant to the summary union read and
// needs a full GameData; stub it so the test drives only the summary path.
// (Same resolved path as the require() inside LetterReplyGenerator.)
jest.mock('../../../default_userdata/scripts/prompts/description/standard/pListLetter.js', () => () => 'CHARACTER_DESCRIPTION');

jest.mock('../../../src/shared/apiConnection', () => ({
    ApiConnection: jest.fn().mockImplementation(() => ({
        complete: jest.fn().mockResolvedValue('LLM_REPLY_BODY'),
        calculateTokensFromText: jest.fn(() => 1)
    }))
}));

import { LetterReplyGenerator } from '../../../src/main/letter/LetterReplyGenerator';
import { Config } from '../../../src/shared/Config';
import { Character } from '../../../src/shared/gameData/Character';
import { conversationSummariesDir } from '../../../src/main/campaignDataPaths';
import type { CampaignPlayerIdentity } from '../../../src/shared/gameData/CampaignIdentity';

const PLAYER_ID = 1001;
const AI_ID = 2002;
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
            source: 'init' as const,
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

function makeCharacter(id: number, name: string): Character {
    return {
        id,
        firstName: name,
        shortName: name,
        fullName: name + ' of Test',
        faith: 'Catholic',
        culture: 'French',
        age: 30,
        gold: 100,
        prowess: 10,
        traits: [],
        relationsToPlayer: [],
        relationsToCharacters: [],
        opinionOfPlayer: 0,
        opinionBreakdownToPlayer: [],
        sheHe: 'she',
        greed: 0,
        memories: [],
        secrets: [],
        opinions: [],
        relatives: [],
        laws: [],
        modifiers: [],
        maaRegiments: [],
        domainLevyHoldings: [],
        knownSecrets: []
    } as unknown as Character;
}

function makeGameData(options: { withIdentity: boolean }) {
    return {
        playerID: PLAYER_ID,
        aiID: AI_ID,
        votcCheckpointEpoch: 42,
        date: '1066.9.25',
        totalDays: 389340,
        characters: new Map<number, Character>([
            [PLAYER_ID, makeCharacter(PLAYER_ID, 'Alice')],
            [AI_ID, makeCharacter(AI_ID, 'Bob')]
        ]),
        votcTimelineNodeA: 11,
        votcTimelineNodeB: 22,
        votcTimelineParentA: 5,
        votcTimelineParentB: 6,
        timelineSnapshotResult: options.withIdentity ? v2TimelineSnapshotResult() : undefined
    } as any;
}

function makeGenerator(): LetterReplyGenerator {
    const config = {
        textGenerationApiConnectionConfig: { connection: {}, parameters: { temperature: 0.7 } },
        actionsApiConnectionConfig: { connection: {}, parameters: {} },
        actionsUseTextGenApi: true,
        language: 'en',
        summaries_insert_depth: 3
    } as unknown as Config;
    // Mirror main.ts: the generator receives the <userData>/votc_data root.
    return new LetterReplyGenerator(config, path.join(userData(), 'votc_data'), null);
}

function campaignSummaryFile(): string {
    return path.join(conversationSummariesDir(userData(), identity), AI_ID + '.json');
}

function legacySummaryFile(): string {
    return path.join(userData(), 'votc_data', 'conversation_summaries', String(PLAYER_ID), AI_ID + '.json');
}

function writeSummaryFile(filePath: string, summaries: any[]): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(summaries, null, 2), 'utf8');
}

beforeEach(() => {
    fs.rmSync(userData(), { recursive: true, force: true });
});

afterAll(() => {
    fs.rmSync(userData(), { recursive: true, force: true });
});

describe('§12.3 letter reply grounding: campaign-scoped summary union read', () => {
    it('includes a campaign-scoped summary for the recipient character in the grounding', async () => {
        writeSummaryFile(campaignSummaryFile(), [
            {
                id: 'campaign-summary-1',
                characterId: String(AI_ID),
                characterName: 'Bob',
                date: '1066.9.20',
                content: 'CAMPAIGN_SCOPED_SUMMARY_CONTENT',
                votcCheckpointEpoch: 42,
                votcCampaignId: CAMPAIGN_ID
            }
        ]);

        const generator = makeGenerator();
        const gameData = makeGameData({ withIdentity: true });
        const player = gameData.characters.get(PLAYER_ID);
        const ai = gameData.characters.get(AI_ID);

        const grounding = await (generator as any).buildLetterGrounding(gameData, player, ai);

        expect(grounding.conversationSummary).toContain('CAMPAIGN_SCOPED_SUMMARY_CONTENT');
        expect(grounding.conversationSummary).toContain('1066.9.20');
    });

    it('keeps legacy-only data working when no campaign identity is present', async () => {
        writeSummaryFile(legacySummaryFile(), [
            {
                id: 'legacy-summary-1',
                characterId: String(AI_ID),
                characterName: 'Bob',
                date: '1066.9.10',
                content: 'LEGACY_STORE_SUMMARY_CONTENT',
                votcCheckpointEpoch: 42
            }
        ]);

        const generator = makeGenerator();
        const gameData = makeGameData({ withIdentity: false });
        const player = gameData.characters.get(PLAYER_ID);
        const ai = gameData.characters.get(AI_ID);

        const grounding = await (generator as any).buildLetterGrounding(gameData, player, ai);

        expect(grounding.conversationSummary).toContain('LEGACY_STORE_SUMMARY_CONTENT');
        expect(grounding.conversationSummary).toContain('1066.9.10');
    });

    it('does not double-count a summary present in both stores', async () => {
        // Same business record in both layouts: readSummaryFile dedups by its own
        // identity key, and the §12.3 id-based dedup is the second layer. Either
        // way the record must appear exactly once in the grounding.
        const shared = {
            id: 'shared-summary-1',
            characterId: String(AI_ID),
            characterName: 'Bob',
            date: '1066.9.15',
            content: 'SHARED_SUMMARY_CONTENT',
            votcCheckpointEpoch: 42
        };
        writeSummaryFile(campaignSummaryFile(), [shared]);
        writeSummaryFile(legacySummaryFile(), [shared]);

        const generator = makeGenerator();
        const gameData = makeGameData({ withIdentity: true });
        const player = gameData.characters.get(PLAYER_ID);
        const ai = gameData.characters.get(AI_ID);

        const grounding = await (generator as any).buildLetterGrounding(gameData, player, ai);

        expect(grounding.conversationSummary).toContain('SHARED_SUMMARY_CONTENT');
        const occurrences = grounding.conversationSummary.split('SHARED_SUMMARY_CONTENT').length - 1;
        expect(occurrences).toBe(1);
    });

    it('keeps distinct campaign and legacy summaries both visible', async () => {
        writeSummaryFile(campaignSummaryFile(), [
            {
                id: 'campaign-summary-1',
                characterId: String(AI_ID),
                characterName: 'Bob',
                date: '1066.9.20',
                content: 'CAMPAIGN_SCOPED_SUMMARY_CONTENT',
                votcCheckpointEpoch: 42,
                votcCampaignId: CAMPAIGN_ID
            }
        ]);
        writeSummaryFile(legacySummaryFile(), [
            {
                id: 'legacy-summary-1',
                characterId: String(AI_ID),
                characterName: 'Bob',
                date: '1066.9.10',
                content: 'LEGACY_STORE_SUMMARY_CONTENT',
                votcCheckpointEpoch: 42
            }
        ]);

        const generator = makeGenerator();
        const gameData = makeGameData({ withIdentity: true });
        const player = gameData.characters.get(PLAYER_ID);
        const ai = gameData.characters.get(AI_ID);

        const grounding = await (generator as any).buildLetterGrounding(gameData, player, ai);

        expect(grounding.conversationSummary).toContain('CAMPAIGN_SCOPED_SUMMARY_CONTENT');
        expect(grounding.conversationSummary).toContain('LEGACY_STORE_SUMMARY_CONTENT');
    });

});