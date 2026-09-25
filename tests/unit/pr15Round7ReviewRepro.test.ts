import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import { checkAndDeliverLetters, _private_getStoredLetters, _private_setConfig, _private_setCurrentTotalDays, _private_setLastLetterSentToGame } from '../../src/main/main';
import { observeCampaignLoadLine, _resetCampaignLoadObserver } from '../../src/main/campaignLoadObserver';
import { clearCachedGameData } from '../../src/main/gameDataCache';
import { LetterManager } from '../../src/main/letter/LetterManager';
import { LetterReplyGenerator } from '../../src/main/letter/LetterReplyGenerator';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import { runConversationTimelineTransition } from '../../src/main/timelineBusinessWire';
import { parseLog } from '../../src/shared/gameData/parseLog';
import { resolveTimelineWindowRequest, _private_resetLegacyWindowContext } from '../../src/main/ipc/timelineIpc';
import { getConversationHistoryFiles } from '../../src/main/conversationHistory';

jest.mock('../../src/main/userDataCheck', () => ({checkUserData: jest.fn()}));
jest.mock('../../src/shared/apiConnection', () => ({ApiConnection: jest.fn()}));

const identity = buildIdentityFromParts({a: 1, b: 2, c: 3, d: 4}, '1001');
const prefix = '[12:00:00][D][jomini_effect_impl.cpp:450]: ';
const fields = ['1001', 'Player', '1002', 'Duke', '1066.1.1', 'talk_scene_test', 'Paris', 'Player', '5', '0', '0', '0', '0', '0', '0', '2', '1', '1', '2', '3', '4', '1', '1'];
const loadA = prefix + 'VOTC:CAMPAIGN/;/loaded/;/1001/;/1/;/1/;/2/;/3/;/4/;/1/;/5/;/0/;/0';
const loadB = prefix + 'VOTC:CAMPAIGN/;/loaded/;/1001/;/1/;/7/;/8/;/9/;/10/;/1/;/5/;/0/;/0';
let root: string;
let config: any;
const logPath = () => path.join(root, 'logs', 'debug.log');
function writeLog(...lines: string[]) { fs.writeFileSync(logPath(), lines.join('\r\n') + '\r\n'); }
function init(values = fields) { return prefix + 'VOTC:IN/;/init/;/' + values.join('/;/'); }
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-pr15-round7-'));
    (app.getPath as jest.Mock).mockReturnValue(root);
    config = {userFolderPath: root, language: 'en', textGenerationApiConnectionConfig: {connection: {}, parameters: {temperature: 0.5}}};
    fs.mkdirSync(path.join(root, 'logs'));
    _resetCampaignLoadObserver();
    _private_resetLegacyWindowContext();
    clearCachedGameData();
    _private_getStoredLetters().clear();
    _private_setLastLetterSentToGame(null);
    _private_setCurrentTotalDays(389100);
    _private_setConfig(config);
    (LetterManager as any).instance = undefined;
});
afterEach(() => {
    jest.restoreAllMocks();
    const target = path.resolve(root);
    if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith('votc-pr15-round7-')) throw new Error('unsafe cleanup');
    fs.rmSync(target, {recursive: true, force: true});
});

test('rollback to a save before the first node must hide the later transcript', async () => {
    writeLog(init());
    const initial = (await parseLog(logPath()))!;
    const close = await runConversationTimelineTransition({userDataDir: root, identity, gameData: initial,
        requestKey: 'close', eventSignature: 'close', targetEpoch: 6, scopeVar: 'talk_first_scope'});
    const filename = `1001_1002_tl_${close.targetNodeId}_1800000000000.txt`;
    const dir = path.join(root, 'votc_data', 'campaigns', identity.campaignId, 'players', '1001', 'conversation_history');
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, filename), 'Date: 1066.1.1\nPlayer: Future conversation');
    writeLog(init(), loadA, prefix + 'VOTC:conversation_history/;/1001/;/5');
    const resolved = await resolveTimelineWindowRequest(undefined, '1001', 5, logPath());
    const files = await getConversationHistoryFiles('1001', 5, resolved.registry, resolved.context.timelineNodeId, resolved.identity);
    expect(files.map(file => file.fileName)).not.toContain(filename);
});

test('generation failure after another campaign emits its own init must not clear its slot', async () => {
    writeLog(init());
    observeCampaignLoadLine(loadA);
    const gameData: any = await parseLog(logPath());
    const player = {id: 1001, fullName: 'Player'};
    const ai = {id: 1002, fullName: 'Duke'};
    gameData.characters = new Map([[1001, player], [1002, ai]]);
    const original: any = {id: 'original', subject: 'letter_1', totalDays: 389000, delay: 9,
        content: 'Hello from A', sender: player, recipient: ai, timestamp: new Date('1066-01-01T12:00:00Z')};
    const generator: any = new LetterReplyGenerator(config, path.join(root, 'votc_data'), null);
    generator.buildLetterPrompt = jest.fn().mockResolvedValue('prompt');
    generator.apiConnection = {complete: async () => {
        const fieldsB = [...fields];
        fieldsB.splice(17, 4, '7', '8', '9', '10');
        writeLog(init(), loadB, init(fieldsB), prefix + 'VOTC:DATE/;/389100');
        observeCampaignLoadLine(loadB);
        throw new Error('LLM failed after B started a conversation');
    }};
    expect(await generator.generateLetterReply(gameData, original)).toBeNull();
    const file = path.join(root, 'run', 'letters.txt');
    const payload = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    expect(payload).not.toContain('remove_global_variable ?= votc_letter_1');
});

test('generation failure must not overwrite another reply awaiting game consumption', async () => {
    writeLog(init());
    const gameData: any = await parseLog(logPath());
    const player = {id: 1001, fullName: 'Player'};
    const ai = {id: 1002, fullName: 'Duke'};
    gameData.characters = new Map([[1001, player], [1002, ai]]);
    const original: any = {id: 'failure', subject: 'letter_1', totalDays: 389000, delay: 9,
        content: 'First letter', sender: player, recipient: ai, timestamp: new Date('1066-01-01T12:00:00Z')};
    const generator: any = new LetterReplyGenerator(config, path.join(root, 'votc_data'), null);
    generator.buildLetterPrompt = jest.fn().mockResolvedValue('prompt');
    generator.apiConnection = {complete: async () => {
        _private_getStoredLetters().set('successful', {
            letter: {id: 'reply', content: 'SUCCESSFUL_REPLY', sender: ai, recipient: player, timelineCampaignId: identity.campaignId} as any,
            originalLetter: {id: 'successful', subject: 'letter_2', totalDays: 389000, delay: 1} as any,
            expectedDeliveryDay: 389001
        });
        await checkAndDeliverLetters();
        expect(fs.readFileSync(path.join(root, 'run', 'letters.txt'), 'utf8')).toContain('SUCCESSFUL_REPLY');
        throw new Error('Another request failed before the game consumed the successful reply');
    }};
    expect(await generator.generateLetterReply(gameData, original)).toBeNull();
    expect(fs.readFileSync(path.join(root, 'run', 'letters.txt'), 'utf8')).toContain('SUCCESSFUL_REPLY');
});
