/** Acceptance review regressions for 70d1d0ae; production code is unchanged. */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import { buildIdentityFromParts } from '../../../src/shared/gameData/CampaignIdentity';
import { getLetterHistoryEntries, getBattleReportHistoryEntries } from '../../../src/main/conversationHistory';
import { readSummaryFile } from '../../../src/main/summaryManager';
import { TimelineRegistry } from '../../../src/main/timelineManager';
import { checkAndDeliverLetters, _private_getStoredLetters, _private_setConfig, _private_setCurrentTotalDays, _private_setLastLetterSentToGame } from '../../../src/main/main';
import * as parseLogModule from '../../../src/shared/gameData/parseLog';
import { LetterManager } from '../../../src/main/letter/LetterManager';

jest.mock('../../../src/shared/gameData/parseLog');
jest.mock('../../../src/main/userDataCheck', () => ({ checkUserData: jest.fn() }));
jest.mock('../../../src/main/letter/LetterManager', () => {
    const instance = { deliverLetter: jest.fn(), hasPendingLetterFallbacks: () => false, flushNextLetterFallback: jest.fn() };
    return { LetterManager: { getInstance: () => instance } };
});

const playerId = '1001';
const identity = buildIdentityFromParts({ a: 7, b: 8, c: 9, d: 10 }, playerId);
const otherIdentity = buildIdentityFromParts({ a: 11, b: 12, c: 13, d: 14 }, playerId);
let fixtureRoot: string;

function writeJson(relativePath: string, value: unknown): void {
    const file = path.join(fixtureRoot, 'votc_data', relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
}

beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-pr15-acceptance-'));
    (app.getPath as jest.Mock).mockReturnValue(fixtureRoot);
    _private_getStoredLetters().clear();
    _private_setLastLetterSentToGame(null);
    _private_setCurrentTotalDays(100);
    _private_setConfig({ userFolderPath: fixtureRoot } as never);
    jest.clearAllMocks();
});

afterEach(() => {
    const resolved = path.resolve(fixtureRoot);
    if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('votc-pr15-acceptance-')) {
        throw new Error('unsafe cleanup');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
    jest.restoreAllMocks();
});

test('distinct letter IDs and dates survive even when the body is identical', async () => {
    writeJson(`letter_history/player_${playerId}/character_1002.json`, [
        { id: 'one', direction: 'incoming', senderName: 'Duke', content: 'Thank you.', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'two', direction: 'incoming', senderName: 'Duke', content: 'Thank you.', createdAt: '2026-02-01T00:00:00Z' }
    ]);
    const records = await getLetterHistoryEntries(playerId);
    expect(records).toHaveLength(2);
});

test('a report already owned by campaign A stays out of campaign B', async () => {
    const report = { id: 'battle-owned-by-a', content: 'Battle A', location: 'Paris', createdAt: '2026-01-01T00:00:00Z' };
    writeJson(`battle_report_history/player_${playerId}.json`, [report]);
    writeJson(`campaigns/${otherIdentity.campaignId}/players/${playerId}/battle_report_history.json`, [report]);
    const records = await getBattleReportHistoryEntries(playerId, 5, undefined, undefined, identity);
    expect(records).toHaveLength(0);
});

test('equal summary text on sibling nodes keeps the summary from the visible node', async () => {
    const common = { date: '1066.1.1', content: 'They exchanged greetings.', votcCheckpointEpoch: 2 };
    writeJson(`conversation_summaries/${playerId}/1002.json`, [
        { ...common, votcTimelineNodeId: '10-21' },
        { ...common, votcTimelineNodeId: '10-22' }
    ]);
    const registry = new TimelineRegistry(playerId, {
        version: 1, playerId,
        nodes: {
            '10-20': { parentId: null, epoch: 1, source: 'conversation', eventKey: 'root', createdAt: '2026-01-01' },
            '10-21': { parentId: '10-20', epoch: 2, source: 'conversation', eventKey: 'a', createdAt: '2026-01-02' },
            '10-22': { parentId: '10-20', epoch: 2, source: 'conversation', eventKey: 'b', createdAt: '2026-01-03' }
        }
    });
    const records = await readSummaryFile(path.join(fixtureRoot, 'votc_data'), playerId, 2, registry, '10-22', identity);
    expect(records).toHaveLength(1);
    expect(records[0].votcTimelineNodeId).toBe('10-22');
});

test('losing the second log read does not bypass campaign delivery checks', async () => {
    const currentGameData = {
        playerID: 1001, aiID: 1002, date: '1066.1.2', votcCheckpointEpoch: 0,
        timelineSnapshotResult: {
            status: 'valid', snapshot: {
                playerId, source: 'init', epoch: 0,
                protocol: { protocolSchema: 2, campaignSchema: 1, campaignIdA: 7, campaignIdB: 8, campaignIdC: 9, campaignIdD: 10, campaignBootstrapKind: 1, playerTimelineSchema: 1 }
            }
        }
    };
    (parseLogModule.parseLog as jest.Mock).mockReset()
        .mockResolvedValueOnce(currentGameData)
        .mockResolvedValueOnce(undefined);
    _private_getStoredLetters().set('foreign', {
        letter: { id: 'foreign', recipient: { id: playerId }, timelineCampaignId: otherIdentity.campaignId } as never,
        originalLetter: { id: 'original', totalDays: 100, delay: 0 } as never,
        expectedDeliveryDay: 100
    });
    await checkAndDeliverLetters();
    expect(LetterManager.getInstance().deliverLetter).not.toHaveBeenCalled();
    expect(_private_getStoredLetters().has('foreign')).toBe(true);
});
