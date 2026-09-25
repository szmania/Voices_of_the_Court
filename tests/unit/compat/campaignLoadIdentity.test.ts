/**
 * Save-load identity (mod relay -> app) acceptance.
 *
 * The mod reports the campaign a loaded save belongs to on `on_game_start_after_lobby`
 * (`VOTC:CAMPAIGN/;/loaded/;...`). These tests pin the app side of that contract:
 * the line is parsed tolerantly, a malformed or uncommitted identity is ignored
 * rather than trusted, an adopted save is announced once, and the identity is
 * usable by the delivery gate before the first conversation exists — which is the
 * case that otherwise strands a pending reply after loading a save.
 */
import { dialog } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseCampaignLoadedLine, readLastLogLineContaining } from '../../../src/shared/gameData/parseLog';
import {
    observeCampaignLoadLine,
    getObservedCampaignId,
    getObservedCampaignLoad,
    _resetCampaignLoadObserver
} from '../../../src/main/campaignLoadObserver';
import {
    checkAndDeliverLetters,
    _private_getStoredLetters,
    _private_setConfig,
    _private_setCurrentTotalDays,
    _private_setLastLetterSentToGame
} from '../../../src/main/main';
import * as parseLogModule from '../../../src/shared/gameData/parseLog';
import { LetterManager } from '../../../src/main/letter/LetterManager';
import { buildIdentityFromParts } from '../../../src/shared/gameData/CampaignIdentity';

jest.mock('../../../src/shared/gameData/parseLog', () => ({
    ...jest.requireActual('../../../src/shared/gameData/parseLog'),
    parseLog: jest.fn()
}));
jest.mock('../../../src/main/userDataCheck', () => ({checkUserData: jest.fn()}));
jest.mock('../../../src/main/letter/LetterManager', () => {
    const instance = {deliverLetter: jest.fn(), hasPendingLetterFallbacks: () => false, flushNextLetterFallback: jest.fn()};
    return {LetterManager: {getInstance: () => instance}};
});

const PLAYER_ID = '1001';
const IDENTITY = buildIdentityFromParts({a: 7, b: 8, c: 9, d: 10}, PLAYER_ID);
const OTHER_CAMPAIGN_ID = '11-12-13-14';

// Exactly what the mod writes: engine prefix, `/;/` separators, CRLF ending.
function loadedLine(parts: {a: number, b: number, c: number, d: number}, bootstrapKind: number, epoch = 3): string {
    return `[23:39:13][D][jomini_effect_impl.cpp:450]: VOTC:CAMPAIGN/;/loaded/;/1001/;/1/;/${parts.a}/;/${parts.b}/;/${parts.c}/;/${parts.d}/;/${bootstrapKind}/;/${epoch}\r\n`;
}

// No v2 protocol tail: the state a loaded save is in before any conversation.
const gameDataWithoutIdentity = {
    playerID: Number(PLAYER_ID),
    aiID: 1002,
    date: '1066.1.2',
    votcCheckpointEpoch: 3
};

function queueReply(id: string, stamp: string | undefined): void {
    _private_getStoredLetters().set(id, {
        letter: {id, recipient: {id: PLAYER_ID}, timelineCampaignId: stamp} as never,
        originalLetter: {id: `original-${id}`, totalDays: 100, delay: 0} as never,
        expectedDeliveryDay: 100
    });
}

describe('save-load campaign identity', () => {
    beforeEach(() => {
        _resetCampaignLoadObserver();
        _private_getStoredLetters().clear();
        _private_setLastLetterSentToGame(null);
        _private_setCurrentTotalDays(100);
        _private_setConfig({userFolderPath: process.cwd()} as never);
        (dialog.showMessageBox as jest.Mock).mockClear();
        (LetterManager as unknown as {getInstance: () => {deliverLetter: jest.Mock}}).getInstance().deliverLetter.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('line parsing', () => {
        it('reads the campaign, bootstrap kind and epoch out of a prefixed CRLF line', () => {
            const parsed = parseCampaignLoadedLine(loadedLine({a: 7, b: 8, c: 9, d: 10}, 3));

            expect(parsed).toEqual({
                playerId: PLAYER_ID,
                campaignSchema: 1,
                campaignParts: {a: 7, b: 8, c: 9, d: 10},
                bootstrapKind: 3,
                checkpointEpoch: 3
            });
        });

        it('ignores lines that are not a save-load identity', () => {
            expect(parseCampaignLoadedLine('[23:39:13][D]: VOTC:IN/;/init/;/1001')).toBeUndefined();
            expect(parseCampaignLoadedLine('[23:39:13][D]: VOTC:CAMPAIGN/;/created/;/1001/;/1/;/7/;/8/;/9/;/10/;/1')).toBeUndefined();
        });

        it('refuses a line whose campaign is not committed', () => {
            // The mod bootstraps before logging, so zeros mean the identity is
            // not usable; a wrong id would decide where replies may be written.
            expect(parseCampaignLoadedLine(loadedLine({a: 0, b: 0, c: 0, d: 0}, 1))).toBeUndefined();
        });

        it('finds the last identity line when the app starts after the save was loaded', async () => {
            const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-log-scan-'));
            const logPath = path.join(logDir, 'debug.log');
            fs.writeFileSync(logPath, [
                loadedLine({a: 1, b: 1, c: 1, d: 1}, 1, 1),
                '[23:40:00][D]: VOTC:DATE/;/389100',
                loadedLine({a: 7, b: 8, c: 9, d: 10}, 3, 4)
            ].join('\n'));

            const line = await readLastLogLineContaining(logPath, 'VOTC:CAMPAIGN/;/loaded/;/');
            expect(line).toBeDefined();
            expect(parseCampaignLoadedLine(line!)?.campaignParts).toEqual({a: 7, b: 8, c: 9, d: 10});

            fs.rmSync(logDir, {recursive: true, force: true});
        });

        it('reports nothing when the log has no identity line', async () => {
            const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-log-scan-'));
            const logPath = path.join(logDir, 'debug.log');
            fs.writeFileSync(logPath, '[23:40:00][D]: VOTC:IN/;/init/;/1001\n');

            expect(await readLastLogLineContaining(logPath, 'VOTC:CAMPAIGN/;/loaded/;/')).toBeUndefined();

            fs.rmSync(logDir, {recursive: true, force: true});
        });
    });

    describe('observation', () => {
        it('remembers the identity and stays quiet for a fresh campaign', () => {
            expect(observeCampaignLoadLine(loadedLine({a: 7, b: 8, c: 9, d: 10}, 1))).toBe(true);

            expect(getObservedCampaignId()).toBe(IDENTITY.campaignId);
            expect(getObservedCampaignLoad()?.bootstrapKind).toBe(1);
            expect(dialog.showMessageBox).not.toHaveBeenCalled();
        });

        it('announces an adopted save once per campaign', () => {
            expect(observeCampaignLoadLine(loadedLine({a: 7, b: 8, c: 9, d: 10}, 3))).toBe(true);
            expect(observeCampaignLoadLine(loadedLine({a: 7, b: 8, c: 9, d: 10}, 3))).toBe(true);

            expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
        });

        it('keeps the previous identity when a later line is malformed', () => {
            observeCampaignLoadLine(loadedLine({a: 7, b: 8, c: 9, d: 10}, 1));
            observeCampaignLoadLine('[23:39:13][D]: VOTC:CAMPAIGN/;/loaded/;/1001/;/1/;/0/;/0/;/0/;/0/;/1/;/0\r\n');

            expect(getObservedCampaignId()).toBe(IDENTITY.campaignId);
        });
    });

    describe('delivery before the first conversation', () => {
        it('delivers a reply stamped for the campaign the mod reported on load', async () => {
            (parseLogModule.parseLog as jest.Mock).mockResolvedValue(gameDataWithoutIdentity);
            observeCampaignLoadLine(loadedLine({a: 7, b: 8, c: 9, d: 10}, 1));
            queueReply('reply-mine', IDENTITY.campaignId);

            await checkAndDeliverLetters();

            expect(LetterManager.getInstance().deliverLetter).toHaveBeenCalledTimes(1);
            expect(_private_getStoredLetters().has('reply-mine')).toBe(false);
        });

        it('keeps a reply from another campaign pending', async () => {
            (parseLogModule.parseLog as jest.Mock).mockResolvedValue(gameDataWithoutIdentity);
            observeCampaignLoadLine(loadedLine({a: 7, b: 8, c: 9, d: 10}, 1));
            queueReply('reply-foreign', OTHER_CAMPAIGN_ID);

            await checkAndDeliverLetters();

            expect(LetterManager.getInstance().deliverLetter).not.toHaveBeenCalled();
            expect(_private_getStoredLetters().has('reply-foreign')).toBe(true);
        });

        it('defers a stamped reply when no identity was reported at all', async () => {
            (parseLogModule.parseLog as jest.Mock).mockResolvedValue(gameDataWithoutIdentity);
            queueReply('reply-unknown', IDENTITY.campaignId);

            await checkAndDeliverLetters();

            expect(LetterManager.getInstance().deliverLetter).not.toHaveBeenCalled();
            expect(_private_getStoredLetters().has('reply-unknown')).toBe(true);
        });
    });
});
