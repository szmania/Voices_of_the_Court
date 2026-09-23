import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import { checkAndDeliverLetters, _private_getStoredLetters, _private_setConfig, _private_setCurrentTotalDays, _private_setLastLetterSentToGame } from '../../src/main/main';
import { observeCampaignLoadLine, _resetCampaignLoadObserver } from '../../src/main/campaignLoadObserver';
import { clearCachedGameData, setCachedGameData } from '../../src/main/gameDataCache';
import { LetterManager } from '../../src/main/letter/LetterManager';
import { LetterReplyGenerator } from '../../src/main/letter/LetterReplyGenerator';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import { runConversationTimelineTransition, runLetterReplyTimelineTransition } from '../../src/main/timelineBusinessWire';
import { parseLog } from '../../src/shared/gameData/parseLog';

jest.mock('../../src/main/userDataCheck', () => ({checkUserData: jest.fn()}));
jest.mock('../../src/shared/apiConnection', () => ({ApiConnection: jest.fn()}));

const identityA = buildIdentityFromParts({a: 1, b: 2, c: 3, d: 4}, '1001');
const identityB = buildIdentityFromParts({a: 7, b: 8, c: 9, d: 10}, '1001');
const prefix = '[12:00:00][D][jomini_effect_impl.cpp:450]: ';
const initFields = ['1001', 'Player', '1002', 'Duke', '1066.1.1', 'talk_scene_test', 'Paris', 'Player', '5', '0', '0', '0', '0', '0', '0', '2', '1', '1', '2', '3', '4', '1', '1'];
const initLine = prefix + 'VOTC:IN/;/init/;/' + initFields.join('/;/');
const loadA = prefix + 'VOTC:CAMPAIGN/;/loaded/;/1001/;/1/;/1/;/2/;/3/;/4/;/1/;/5';
const loadB = prefix + 'VOTC:CAMPAIGN/;/loaded/;/1001/;/1/;/7/;/8/;/9/;/10/;/1/;/5';
let root: string;
let config: any;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr15-current-review-'));
    (app.getPath as jest.Mock).mockReturnValue(root);
    config = {userFolderPath: root};
    fs.mkdirSync(path.join(root, 'logs'));
    _resetCampaignLoadObserver();
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
    if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith('pr15-current-review-')) throw new Error('unsafe cleanup');
    fs.rmSync(target, {recursive: true, force: true});
});

function writeLog(...lines: string[]) {
    fs.writeFileSync(path.join(root, 'logs', 'debug.log'), lines.join('\r\n') + '\r\n');
}
function queue(campaignId: string) {
    _private_getStoredLetters().set('original', {
        letter: {id: 'reply', recipient: {id: 1001}, timelineCampaignId: campaignId} as any,
        originalLetter: {id: 'original', totalDays: 389000, delay: 1} as any,
        expectedDeliveryDay: 389001
    });
}

test('a load-only real log should permit a due reply for the observed campaign', async () => {
    // Same-campaign snapshot was cached before the log was cleared/recreated.
    // The existing pre-PR delivery flow could use its date fallback here.
    writeLog(initLine);
    setCachedGameData((await parseLog(path.join(root, 'logs', 'debug.log')))!);
    writeLog(loadA, prefix + 'VOTC:DATE/;/389100');
    observeCampaignLoadLine(loadA);
    queue(identityA.campaignId);
    const deliver = jest.spyOn(LetterManager.getInstance(), 'deliverLetter').mockImplementation(() => {});
    await checkAndDeliverLetters();
    expect(deliver).toHaveBeenCalledTimes(1);
});

test('a newer campaign load must invalidate an older init block for delivery', async () => {
    writeLog(initLine, loadB, prefix + 'VOTC:DATE/;/389100');
    observeCampaignLoadLine(loadB);
    queue(identityA.campaignId);
    const deliver = jest.spyOn(LetterManager.getInstance(), 'deliverLetter').mockImplementation(() => {});
    await checkAndDeliverLetters();
    expect(deliver).not.toHaveBeenCalled();
});

test('reloading an existing sibling branch must prevent applying the latest allocated letter node', async () => {
    writeLog(initLine);
    const initial: any = await parseLog(path.join(root, 'logs', 'debug.log'));
    const parent = await runConversationTimelineTransition({userDataDir: root, identity: identityA, gameData: initial,
        requestKey: 'parent', eventSignature: 'parent', targetEpoch: 6, scopeVar: 'talk_first_scope'});
    const atParent: any = {...initial, votcCheckpointEpoch: 6, votcTimelineNodeA: Number(parent.targetNodeId.split('-')[0]),
        votcTimelineNodeB: Number(parent.targetNodeId.split('-')[1]),
        timelineSnapshotResult: {status: 'valid', snapshot: {...initial.timelineSnapshotResult.snapshot, epoch: 6,
            nodeA: Number(parent.targetNodeId.split('-')[0]), nodeB: Number(parent.targetNodeId.split('-')[1])}}};
    const sibling = await runConversationTimelineTransition({userDataDir: root, identity: identityA, gameData: atParent,
        requestKey: 'sibling', eventSignature: 'sibling', targetEpoch: 7, scopeVar: 'talk_first_scope'});
    // Roll back to parent, then allocate a reply on another branch.
    const pending = await runLetterReplyTimelineTransition({userDataDir: root, identity: identityA, gameData: atParent,
        slotId: 'letter_1', letterDeliveryId: 389000, eventSignature: 'reply-branch', targetEpoch: 7, scopeVar: 'global_var:message_first_scope'});
    // Reload the already existing sibling save, without creating another app node.
    const currentFields = [...initFields];
    currentFields[8] = '7';
    [currentFields[9], currentFields[10]] = sibling.targetNodeId.split('-');
    [currentFields[11], currentFields[12]] = parent.targetNodeId.split('-');
    writeLog(prefix + 'VOTC:IN/;/init/;/' + currentFields.join('/;/'), loadA);
    observeCampaignLoadLine(loadA);
    _private_getStoredLetters().set('original', {
        letter: {id: 'reply', subject: 'Re: letter_1', content: 'Reply from abandoned branch', sender: {id: 1002}, recipient: {id: 1001},
            timelineCampaignId: identityA.campaignId, timelinePlayerId: '1001', timelineNodeId: pending.targetNodeId,
            timelineScript: pending.script, timelineEpoch: 7} as any,
        originalLetter: {id: 'original', subject: 'letter_1', totalDays: 389000, delay: 1} as any,
        expectedDeliveryDay: 389001
    });
    await checkAndDeliverLetters();
    const file = path.join(root, 'run', 'letters.txt');
    const payload = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    expect(payload).not.toContain(pending.script);
});

test('a due reply still applies its checkpoint script when the save sits on the branch point', async () => {
    // Normal path: no rollback, the save still sits on the node the reply was
    // allocated from (the reply node's parent), so the checkpoint script must
    // ride along with the delivery.
    writeLog(initLine);
    const initial: any = await parseLog(path.join(root, 'logs', 'debug.log'));
    const parent = await runConversationTimelineTransition({userDataDir: root, identity: identityA, gameData: initial,
        requestKey: 'parent', eventSignature: 'parent', targetEpoch: 6, scopeVar: 'talk_first_scope'});
    const atParent: any = {...initial, votcCheckpointEpoch: 6, votcTimelineNodeA: Number(parent.targetNodeId.split('-')[0]),
        votcTimelineNodeB: Number(parent.targetNodeId.split('-')[1]),
        timelineSnapshotResult: {status: 'valid', snapshot: {...initial.timelineSnapshotResult.snapshot, epoch: 6,
            nodeA: Number(parent.targetNodeId.split('-')[0]), nodeB: Number(parent.targetNodeId.split('-')[1])}}};
    const pending = await runLetterReplyTimelineTransition({userDataDir: root, identity: identityA, gameData: atParent,
        slotId: 'letter_1', letterDeliveryId: 389000, eventSignature: 'reply-normal', targetEpoch: 7, scopeVar: 'global_var:message_first_scope'});
    // The save's own init line still reports the branch point (epoch 6).
    const currentFields = [...initFields];
    currentFields[8] = '6';
    [currentFields[9], currentFields[10]] = parent.targetNodeId.split('-');
    currentFields[11] = '0';
    currentFields[12] = '0';
    writeLog(prefix + 'VOTC:IN/;/init/;/' + currentFields.join('/;/'));
    _private_getStoredLetters().set('original', {
        letter: {id: 'reply', subject: 'Re: letter_1', content: 'Reply from the branch point', sender: {id: 1002}, recipient: {id: 1001},
            timelineCampaignId: identityA.campaignId, timelinePlayerId: '1001', timelineNodeId: pending.targetNodeId,
            timelineScript: pending.script, timelineEpoch: 7} as any,
        originalLetter: {id: 'original', subject: 'letter_1', totalDays: 389000, delay: 1} as any,
        expectedDeliveryDay: 389001
    });
    await checkAndDeliverLetters();
    const file = path.join(root, 'run', 'letters.txt');
    const payload = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    expect(payload).toContain(pending.script);
});

test('a generation failure after campaign switch must not clear the new campaign letter slot', async () => {
    writeLog(initLine);
    observeCampaignLoadLine(loadA);
    const gameData: any = await parseLog(path.join(root, 'logs', 'debug.log'));
    const player = {id: 1001, fullName: 'Player'};
    const ai = {id: 1002, fullName: 'Duke'};
    gameData.characters = new Map([[1001, player], [1002, ai]]);
    config.language = 'en';
    config.textGenerationApiConnectionConfig = {connection: {}, parameters: {temperature: 0.5}};
    const original: any = {id: 'original', subject: 'letter_1', totalDays: 389000, delay: 9,
        content: 'Hello from A', sender: player, recipient: ai, timestamp: new Date('1066-01-01T12:00:00Z')};
    const generator: any = new LetterReplyGenerator(config, path.join(root, 'votc_data'), null);
    generator.buildLetterPrompt = jest.fn().mockResolvedValue('prompt');
    generator.apiConnection = {complete: async () => {
        writeLog(loadB, prefix + 'VOTC:DATE/;/389100');
        observeCampaignLoadLine(loadB);
        throw new Error('LLM timed out after the player loaded campaign B');
    }};
    expect(await generator.generateLetterReply(gameData, original)).toBeNull();
    const file = path.join(root, 'run', 'letters.txt');
    const payload = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    expect(payload).not.toContain('remove_global_variable ?= votc_letter_1');
});
