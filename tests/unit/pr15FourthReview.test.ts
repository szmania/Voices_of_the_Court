import fs from 'fs';
import path from 'path';
import os from 'os';
import { app, BrowserWindow } from 'electron';
import { LetterReplyGenerator } from '../../src/main/letter/LetterReplyGenerator';
import { LetterManager } from '../../src/main/letter/LetterManager';

jest.mock('../../src/shared/apiConnection', () => ({ApiConnection: jest.fn()}));
jest.mock('../../src/main/summaryManager', () => ({}));
jest.mock('../../src/main/conversation/promptBuilder', () => ({}));
jest.mock('../../src/main/timelineRegistryRecovery', () => ({
    reportCampaignIdentityUnavailable: jest.fn(), reportCorruptTimelineRegistry: jest.fn(),
    reportTimelineParentNotFound: jest.fn(), reportUnsupportedTimelineSchema: jest.fn()
}));

describe('PR15 fourth review', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr15-round4-'));
        (app.getPath as jest.Mock).mockReturnValue(root);
        (BrowserWindow as any).getAllWindows = () => [];
        (LetterManager as any).instance = undefined;
    });
    afterEach(() => {
        const target = path.resolve(root);
        if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith('pr15-round4-')) throw new Error('unsafe cleanup');
        fs.rmSync(target, {recursive: true, force: true});
    });

    function setup() {
        const player = {id: 1001, fullName: 'Player'}, ai = {id: 1002, fullName: 'Other'};
        const gameData: any = {playerID: 1001, aiID: 1002, date: '1066.1.1', votcCheckpointEpoch: 5,
            characters: new Map([[1001, player], [1002, ai]]),
            timelineSnapshotResult: {status: 'valid', snapshot: {
                playerId: '1001', source: 'init', epoch: 5,
                protocol: {protocolSchema: 2, campaignSchema: 1,
                    campaignIdA: 1, campaignIdB: 2, campaignIdC: 3, campaignIdD: 4,
                    campaignBootstrapKind: 1, playerTimelineSchema: 1}
            }}};
        const config: any = {userFolderPath: path.join(root, 'ck3'), language: 'en', maxTokens: 100,
            textGenerationApiConnectionConfig: {connection: {}, parameters: {temperature: 0.5}}};
        const original: any = {id: 'original', subject: 'letter_1', totalDays: 389000, delay: 9,
            content: 'Hello', sender: player, recipient: ai, timestamp: new Date('1066-01-01T12:00:00Z')};
        const generator: any = new LetterReplyGenerator(config, path.join(root, 'votc_data'), null);
        generator.apiConnection = {complete: jest.fn().mockResolvedValue('Greetings')};
        generator.buildLetterPrompt = jest.fn().mockResolvedValue('prompt');
        generator.generateAndSaveLetterSummary = jest.fn().mockResolvedValue(undefined);
        return {gameData, config, original, generator};
    }

    // The round-7 fallback gate re-parses the freshest init from debug.log and
    // refuses when the context cannot be confirmed; without this log the
    // fallback would (correctly) never queue.
    function writeIdentityLog(config: any) {
        const logs = path.join(config.userFolderPath, 'logs');
        fs.mkdirSync(logs, {recursive: true});
        fs.writeFileSync(path.join(logs, 'debug.log'),
            '[12:00:00][D][jomini_effect_impl.cpp:450]: VOTC:IN/;/init/;/1001/;/Player/;/1002/;/Other/;/1066.1.1/;/talk_scene_test/;/Paris/;/Player/;/5/;/0/;/0/;/0/;/0/;/0/;/0/;/2/;/1/;/1/;/2/;/3/;/4/;/1/;/1\r\n');
    }

    it('saveLetterHistory failure still delivers the fallback to the CK3 channel', async () => {
        const {gameData, config, original, generator} = setup();
        writeIdentityLog(config);
        // LLM succeeds, but persisting the reply fails (returns null instead of throwing).
        generator.saveLetterHistory = jest.fn().mockResolvedValue(null);
        expect(await generator.generateLetterReply(gameData, original)).toBeNull();
        // The null-return path reaches the same queued fallback handoff as
        // the empty-response and exception paths, so the thread is cleaned up
        // once the channel is idle.
        expect(LetterManager.getInstance().hasPendingLetterFallbacks()).toBe(true);
        LetterManager.getInstance().flushNextLetterFallback(config);
        expect(fs.existsSync(path.join(config.userFolderPath, 'run', 'letters.txt'))).toBe(true);
    });

    // Round 7 reversed the round-4 "accepted limitation": letters.txt is one
    // shared whole-file-overwrite channel polled every ~2s, so a
    // generation-failure fallback must not clobber a success delivery that is
    // still awaiting game consumption — that reply has already left the
    // pending queue and the loss would be permanent. The fallback now queues
    // and is flushed one per delivery pass once the channel is idle.
    it('a queued fallback does not clobber a success delivery awaiting game consumption', async () => {
        const {gameData, config, original, generator} = setup();
        writeIdentityLog(config);
        const reply = await generator.generateLetterReply(gameData, original);
        LetterManager.getInstance().deliverLetter(
            {letter: reply, originalLetter: original, expectedDeliveryDay: 389009}, config, '1066.1.10');
        const delivered = fs.readFileSync(path.join(config.userFolderPath, 'run', 'letters.txt'), 'utf8');
        expect(delivered).toContain('create_artifact');
        // A second letter's generation failure queues its fallback instead of
        // overwriting the file that still holds the unconfirmed reply.
        const other: any = {...original, id: 'other', subject: 'letter_2'};
        generator.apiConnection.complete.mockRejectedValue(new Error('API request failed'));
        expect(await generator.generateLetterReply(gameData, other)).toBeNull();
        expect(fs.readFileSync(path.join(config.userFolderPath, 'run', 'letters.txt'), 'utf8')).toContain('create_artifact');
        expect(LetterManager.getInstance().hasPendingLetterFallbacks()).toBe(true);
        // Once the channel is idle, the next delivery pass writes the fallback.
        LetterManager.getInstance().flushNextLetterFallback(config);
        const flushed = fs.readFileSync(path.join(config.userFolderPath, 'run', 'letters.txt'), 'utf8');
        expect(flushed).not.toContain('create_artifact');
        expect(flushed).toContain('votc_letter_2');
    });
});
