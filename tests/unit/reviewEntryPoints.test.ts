import fs from 'fs';
import os from 'os';
import path from 'path';
import { app, ipcMain } from 'electron';
import { checkAndDeliverLetters, _private_getStoredLetters, _private_setConfig, _private_setCurrentTotalDays, _private_setLastLetterSentToGame } from '../../src/main/main';
import { observeCampaignLoadLine, _resetCampaignLoadObserver } from '../../src/main/campaignLoadObserver';
import { clearCachedGameData } from '../../src/main/gameDataCache';
import { LetterManager } from '../../src/main/letter/LetterManager';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import { runConversationTimelineTransition, runLetterReplyTimelineTransition } from '../../src/main/timelineBusinessWire';
import { parseLog } from '../../src/shared/gameData/parseLog';
import { registerTimelineIpc, _private_resetLegacyWindowContext } from '../../src/main/ipc/timelineIpc';

jest.mock('../../src/main/userDataCheck', () => ({checkUserData: jest.fn()}));
jest.mock('../../src/shared/apiConnection', () => ({ApiConnection: jest.fn()}));

const identity = buildIdentityFromParts({a: 1, b: 2, c: 3, d: 4}, '1001');
const prefix = '[12:00:00][D][jomini_effect_impl.cpp:450]: ';
const fields = ['1001', 'Player', '1002', 'Duke', '1066.1.1', 'talk_scene_test', 'Paris', 'Player', '5', '0', '0', '0', '0', '0', '0', '2', '1', '1', '2', '3', '4', '1', '1'];
let root: string;
let config: any;
const logPath = () => path.join(root, 'logs', 'debug.log');
function writeLog(...lines: string[]) { fs.writeFileSync(logPath(), lines.join('\r\n') + '\r\n'); }
function init(values = fields) { return prefix + 'VOTC:IN/;/init/;/' + values.join('/;/'); }
function queue(transition?: any) {
    _private_getStoredLetters().set('original', {
        letter: {id: 'reply', content: 'Reply', sender: {id: 1002}, recipient: {id: 1001},
            timelineCampaignId: identity.campaignId, timelinePlayerId: '1001',
            timelineNodeId: transition?.targetNodeId, timelineScript: transition?.script} as any,
        originalLetter: {id: 'original', subject: 'letter_1', totalDays: 389000, delay: 1} as any,
        expectedDeliveryDay: 389001
    });
}
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-pr15-'));
    (app.getPath as jest.Mock).mockReturnValue(root);
    config = {userFolderPath: root};
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
afterEach(() => jest.restoreAllMocks());

// This also occurs on base 57716b6f; retained as documentation, not a PR finding.
test.skip('pre-existing: cold app start with load identity and heartbeat needs an init/cache before delivery', async () => {
    const loaded = prefix + 'VOTC:CAMPAIGN/;/loaded/;/1001/;/1/;/1/;/2/;/3/;/4/;/1/;/5/;/10/;/20';
    writeLog(loaded, prefix + 'VOTC:DATE/;/389100');
    observeCampaignLoadLine(loaded);
    queue();
    const deliver = jest.spyOn(LetterManager.getInstance(), 'deliverLetter').mockImplementation(() => {});
    await checkAndDeliverLetters();
    expect(deliver).toHaveBeenCalledTimes(1);
});

test('a fresh load line supplies the player as well as the campaign for a pending reply', async () => {
    const campaignB = buildIdentityFromParts({a: 7, b: 8, c: 9, d: 10}, '2001');
    const loaded = prefix + 'VOTC:CAMPAIGN/;/loaded/;/2001/;/1/;/7/;/8/;/9/;/10/;/1/;/5/;/10/;/20';
    writeLog(init(), loaded, prefix + 'VOTC:DATE/;/389100');
    observeCampaignLoadLine(loaded);
    queue();
    const reply = _private_getStoredLetters().get('original')!.letter;
    reply.timelineCampaignId = campaignB.campaignId;
    reply.recipient.id = 2001;
    const deliver = jest.spyOn(LetterManager.getInstance(), 'deliverLetter').mockImplementation(() => {});
    await checkAndDeliverLetters();
    expect(deliver).toHaveBeenCalledTimes(1);
});

test('a checkpoint receipt after the last init prevents a pending letter from replacing the completed conversation node', async () => {
    writeLog(init());
    const initial: any = await parseLog(logPath());
    const parent = await runConversationTimelineTransition({userDataDir: root, identity, gameData: initial,
        requestKey: 'parent', eventSignature: 'parent', targetEpoch: 6, scopeVar: 'talk_first_scope'});
    const currentFields = [...fields];
    currentFields[8] = '6';
    [currentFields[9], currentFields[10]] = parent.targetNodeId.split('-');
    writeLog(init(currentFields));
    const atParent = (await parseLog(logPath()))!;
    const pending = await runLetterReplyTimelineTransition({userDataDir: root, identity, gameData: atParent,
        slotId: 'letter_1', letterDeliveryId: 389000, eventSignature: 'pending-reply', targetEpoch: 7,
        scopeVar: 'global_var:message_first_scope'});
    const conversation = await runConversationTimelineTransition({userDataDir: root, identity, gameData: atParent,
        requestKey: 'conversation-close', eventSignature: 'conversation-close', targetEpoch: 7, scopeVar: 'talk_first_scope'});
    writeLog(init(currentFields), prefix + 'VOTC:CHECKPOINT/;/set/;/1001/;/7/;/'
        + conversation.targetNodeId.split('-').join('/;/') + '/;/' + parent.targetNodeId.split('-').join('/;/') + '/;/1066.1.2');
    queue(pending);
    await checkAndDeliverLetters();
    const payload = fs.readFileSync(path.join(root, 'run', 'letters.txt'), 'utf8');
    expect(payload).toContain('create_artifact');
    expect(payload).not.toContain(pending.script);
});

test('the actual no-payload history IPC entry point lists a newly stamped transcript', async () => {
    writeLog(init());
    const initial = (await parseLog(logPath()))!;
    const close = await runConversationTimelineTransition({userDataDir: root, identity, gameData: initial,
        requestKey: 'close', eventSignature: 'close', targetEpoch: 6, scopeVar: 'talk_first_scope'});
    const filename = `1001_1002_tl_${close.targetNodeId}_1800000000000.txt`;
    for (const dir of [path.join(root, 'votc_data', 'conversation_history', '1001'),
        path.join(root, 'votc_data', 'campaigns', identity.campaignId, 'players', '1001', 'conversation_history')]) {
        fs.mkdirSync(dir, {recursive: true});
        fs.writeFileSync(path.join(dir, filename), 'Date: 1066.1.1\nPlayer: Hello');
    }
    fs.appendFileSync(logPath(), prefix + 'VOTC:conversation_history/;/1001/;/6\r\n');
    registerTimelineIpc({getWindowContext: () => undefined, getDebugLogPath: logPath, onCloseRequested: () => {}});
    const handlers = new Map<string, (...args: any[]) => any>((ipcMain.handle as jest.Mock).mock.calls.map(([name, fn]) => [name, fn]));
    const context = await handlers.get('get-conversation-history-ids')!();
    const files = await handlers.get('get-conversation-history-files')!({}, context.playerId, context.checkpointEpoch);
    expect(files.map((file: any) => file.fileName)).toContain(filename);
});
