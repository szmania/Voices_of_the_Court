/**
 * VOTC-194 hotfix section 8.2.2 (Fix B regression tests).
 *
 * The M1 Letters-tab projection (a display-only ILetter upserted into
 * LetterManager) used to run at the END of IncomingLetterGenerator.saveHistory,
 * after the campaign history record was built. A history-side failure (e.g. a
 * snapshot validation error) therefore threw before the projection ran and the
 * letter never appeared in the Letters tab. Fix B moves the projection ahead of
 * the history work and contains its own errors.
 *
 * These tests drive the real generateIncomingLetter pipeline (mocked LLM,
 * timeline transition and prompt builder only) and assert:
 *   (a) happy path - the projection lands and the UI broadcast fires;
 *   (b) independence - a throwing history builder no longer hides the letter.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('electron', () => ({
    app: { getPath: jest.fn(() => os.tmpdir()) },
    BrowserWindow: { getAllWindows: jest.fn(() => []) }
}));

jest.mock('../../../src/shared/apiConnection', () => ({
    ApiConnection: jest.fn().mockImplementation(() => ({
        complete: jest.fn().mockResolvedValue('A letter body from the sender.'),
        calculateTokensFromText: jest.fn(() => 1)
    }))
}));

jest.mock('../../../src/main/timelineBusinessWire', () => ({
    runIncomingLetterTimelineTransition: jest.fn().mockResolvedValue({
        targetNodeId: '11-23',
        context: { timelineNodeId: '11-23', timelineParentId: '11-22', checkpointEpoch: 43 },
        script: 'debug_log = "VOTC:CHECKPOINT"',
        attemptId: 'test-attempt',
        reused: false
    })
}));

import { BrowserWindow } from 'electron';
import { IncomingLetterGenerator } from '../../../src/main/letter/IncomingLetterGenerator';
import { LetterManager } from '../../../src/main/letter/LetterManager';
import type { Config } from '../../../src/shared/Config';

const PLAYER_ID = 1001;
const SENDER_ID = 2002;
const SLOT = 'incoming_letter_7';
const TOPIC = 'family_letter';
// Unique per test: the generator's module-level `completed` signature set
// persists across tests in this file, so each case needs its own delivery id.
let deliveryIdCounter = 0;

/**
 * v2 init line with the full 28-field layout: 15 core fields, the 8-field
 * protocol tail (protocolSchema=2, campaignSchema=1, campaign id 1-2-3-4) and
 * the 5 date extras (totalDays/year/month/day/display) so gameData.gameDate is
 * populated and saveHistory passes its structured-date fail-closed check.
 */
function initLine(): string {
    const fields = [
        String(PLAYER_ID), 'Player', String(SENDER_ID), 'Sender',
        '1066.1.1', 'scene_talk_court', 'Paris', 'Controller',
        '1',
        '11', '22', '5', '6', '42', '0',
        '2', '1', '1', '2', '3', '4', '1', '1',
        '430583', '1179', '9', '5', '1179.9.5'
    ];
    return `VOTC:IN/;/init/;/${fields.join('/;/')}`;
}

function characterLine(id: number, shortName: string, fullName: string): string {
    const fields: string[] = new Array(27).fill('');
    fields[0] = String(id);
    fields[1] = shortName;
    fields[2] = fullName;
    fields[4] = 'he';
    fields[5] = '30';
    return `VOTC:IN/;/character/;/${fields.join('/;/')}`;
}

/**
 * Memory line in the exact shape parseLog.parseMemory consumes:
 * rootID / type / creationDate / desc / relevanceWeight / creationTotalDays.
 * Neither participantIds nor identityComplete is emitted - the production
 * shape that used to fail snapshot validation.
 */
function memoryLine(characterId: number, desc: string): string {
    return `VOTC:IN/;/memory/;/${characterId}/;/relationship/;/1066.1.1/;/${desc}/;/5/;/0`;
}

function incomingLetterLog(deliveryId: number): string {
    return [
        'noise line',
        initLine(),
        characterLine(PLAYER_ID, 'Player', 'Player FullName'),
        memoryLine(PLAYER_ID, 'A memory of the player.'),
        characterLine(SENDER_ID, 'Sender', 'Sender FullName'),
        memoryLine(SENDER_ID, 'A memory of the sender.'),
        `VOTC:INCOMING_LETTER/;/context/;/${SLOT}/;/${TOPIC}/;/1066.1.1/;/${SENDER_ID}/;/${deliveryId}/;/sender_location=Paris`
    ].join('\r\n') + '\r\n';
}

function makeConfig(): Config {
    return {
        language: 'en',
        maxTokens: 100,
        maxSummaryTokens: 2000,
        textGenerationApiConnectionConfig: {
            connection: { type: 'openrouter', baseUrl: '', key: '', model: 'm' },
            parameters: { temperature: 0.7 }
        }
    } as unknown as Config;
}

describe('incoming letter Letters-tab projection (VOTC-194 hotfix 8.2.2)', () => {
    let root: string;
    let sendSpy: jest.Mock;
    let saveLetterSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-incoming-projection-'));
        sendSpy = jest.fn();
        (BrowserWindow as any).getAllWindows = jest.fn(() => [{ webContents: { send: sendSpy } }]);
        // Fresh singleton so the spy is attached to the instance the generator uses.
        (LetterManager as any).instance = undefined;
        saveLetterSpy = jest.spyOn(LetterManager.getInstance(), 'saveLetter').mockImplementation(() => undefined);
        errorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        errorSpy.mockRestore();
        fs.rmSync(root, { recursive: true, force: true });
    });

    async function run(): Promise<void> {
        deliveryIdCounter += 1;
        const deliveryId = deliveryIdCounter;
        const logPath = path.join(root, 'debug.log');
        fs.writeFileSync(logPath, incomingLetterLog(deliveryId), 'utf8');
        const generator = new IncomingLetterGenerator(makeConfig(), path.join(root, 'votc_data'), null);
        jest.spyOn(generator as any, 'buildMessages').mockResolvedValue([{ role: 'user', content: 'Write a letter.' }]);
        await generator.generateIncomingLetter(logPath, root, SLOT, TOPIC, deliveryId);
    }

    it('projects the incoming letter into LetterManager and broadcasts the UI refresh', async () => {
        await run();

        expect(saveLetterSpy).toHaveBeenCalledTimes(1);
        const [projection, playerId] = saveLetterSpy.mock.calls[0];
        expect(playerId).toBe(String(PLAYER_ID));
        expect(projection.subject).toBe(`incoming_${TOPIC}`);
        // isPlayerSender is re-hydrated by LetterManager.getLetters on read;
        // the raw projection carries the party ids instead.
        expect(projection.sender.id).toBe(SENDER_ID);
        expect(projection.recipient.id).toBe(PLAYER_ID);
        expect(projection.delivered).toBe(true);
        expect(projection.status).toBe('read');

        expect(sendSpy).toHaveBeenCalledWith('letter-status-changed');

        // The happy path must not report a history failure.
        const historyFailures = errorSpy.mock.calls.filter(args =>
            String(args[0]).includes('History save failed')
        );
        expect(historyFailures).toHaveLength(0);
    });

    it('still projects the letter when the campaign history builder throws (Fix B independence)', async () => {
        // Simulate the production failure: the history record builder throws
        // (e.g. a snapshot validation error) before any history write.
        const letterHistoryRecord = require('../../../src/main/letter/letterHistoryRecord');
        const builderSpy = jest.spyOn(letterHistoryRecord, 'buildIncomingLetterHistoryRecord')
            .mockImplementation(() => { throw new Error('snapshot validation failed'); });

        try {
            await run();
        } finally {
            builderSpy.mockRestore();
        }

        // The projection must have landed regardless of the history failure.
        expect(saveLetterSpy).toHaveBeenCalledTimes(1);
        const [projection] = saveLetterSpy.mock.calls[0];
        expect(projection.subject).toBe(`incoming_${TOPIC}`);
        expect(projection.delivered).toBe(true);
        expect(sendSpy).toHaveBeenCalledWith('letter-status-changed');

        // The history failure is still reported (additive, not swallowed silently).
        const historyFailures = errorSpy.mock.calls.filter(args =>
            String(args[0]).includes('History save failed')
        );
        expect(historyFailures.length).toBeGreaterThan(0);
    });
});