import fs from 'fs';
import path from 'path';
import os from 'os';
import vm from 'vm';
import ts from 'typescript';
import { app, BrowserWindow } from 'electron';
import { LetterReplyGenerator } from '../../src/main/letter/LetterReplyGenerator';
import { LetterManager } from '../../src/main/letter/LetterManager';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import { runConversationTimelineTransition } from '../../src/main/timelineBusinessWire';
import { listPromptTranscriptFiles } from '../../src/main/conversationHistory';

jest.mock('../../src/shared/apiConnection', () => ({ApiConnection: jest.fn()}));
jest.mock('../../src/main/summaryManager', () => ({}));
jest.mock('../../src/main/conversation/promptBuilder', () => ({}));
jest.mock('../../src/main/timelineRegistryRecovery', () => ({
    reportCampaignIdentityUnavailable: jest.fn(), reportCorruptTimelineRegistry: jest.fn(),
    reportTimelineParentNotFound: jest.fn(), reportUnsupportedTimelineSchema: jest.fn()
}));

describe('PR15 third review', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr15-round3-'));
        (app.getPath as jest.Mock).mockReturnValue(root);
        (BrowserWindow as any).getAllWindows = () => [];
        (LetterManager as any).instance = undefined;
    });
    afterEach(() => {
        const target = path.resolve(root);
        if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith('pr15-round3-')) throw new Error('unsafe cleanup');
        fs.rmSync(target, {recursive: true, force: true});
    });

    function setup() {
        const identity = buildIdentityFromParts({a: 1, b: 2, c: 3, d: 4}, '1001');
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
        return {identity, gameData, config, original, generator};
    }

    function deliver(config: any, original: any, reply: any): string {
        LetterManager.getInstance().deliverLetter({letter: reply, originalLetter: original, expectedDeliveryDay: 389009}, config, '1066.1.10');
        return fs.readFileSync(path.join(config.userFolderPath, 'run', 'letters.txt'), 'utf8');
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

    it('does not overwrite a different current node at the same epoch', async () => {
        const {identity, gameData, config, original, generator} = setup();
        const reply = await generator.generateLetterReply(gameData, original);
        expect(reply.timelineEpoch).toBe(6);
        // Another close at the same observed save allocates a sibling, also epoch 6.
        const current = await runConversationTimelineTransition({userDataDir: root, identity, gameData,
            requestKey: 'different-close', eventSignature: 'different-close', targetEpoch: 6, scopeVar: 'talk_first_scope'});
        expect(current.context.checkpointEpoch).toBe(reply.timelineEpoch);
        expect(reply.timelineScript).not.toContain(`votc_timeline_node_a value = ${current.targetNodeId.split('-')[0]}`);
        expect(deliver(config, original, reply)).not.toContain(reply.timelineScript);
    });

    it('allows the current branch even when an abandoned future branch has a larger epoch', async () => {
        const {identity, gameData, config, original, generator} = setup();
        const future = {...gameData, votcCheckpointEpoch: 99, timelineSnapshotResult: {
            status: 'valid', snapshot: {...gameData.timelineSnapshotResult.snapshot, epoch: 99}}};
        await runConversationTimelineTransition({userDataDir: root, identity, gameData: future,
            requestKey: 'future-branch', eventSignature: 'future-branch', targetEpoch: 100, scopeVar: 'talk_first_scope'});
        // Reload epoch 5, then generate a new reply on the current branch.
        const reply = await generator.generateLetterReply(gameData, original);
        expect(reply.timelineEpoch).toBe(6);
        expect(deliver(config, original, reply)).toContain(reply.timelineScript);
    });

    it('makes a failure fallback available to the actual CK3 letters runner', async () => {
        const {gameData, config, original, generator} = setup();
        writeIdentityLog(config);
        generator.apiConnection.complete.mockRejectedValue(new Error('API request failed'));
        expect(await generator.generateLetterReply(gameData, original)).toBeNull();
        expect(fs.existsSync(path.join(root, 'votc_data', 'run', 'letter1.txt'))).toBe(true);
        // Round 7: the fallback queues for the shared letters.txt channel and
        // is flushed once the channel is idle, instead of writing immediately.
        expect(LetterManager.getInstance().hasPendingLetterFallbacks()).toBe(true);
        LetterManager.getInstance().flushNextLetterFallback(config);
        expect(fs.existsSync(path.join(config.userFolderPath, 'run', 'letters.txt'))).toBe(true);
    });

    it('respects the independent history-window limit of 15 with prompt history limited to 5', async () => {
        const dir = path.join(root, 'votc_data', 'conversation_history', '1001');
        fs.mkdirSync(dir, {recursive: true});
        for (let i = 0; i < 15; i++) fs.writeFileSync(path.join(dir, `1001_1002_${1770000000000 + i}.txt`), 'Date: 1066.1.1\nPlayer: Hello');
        const source = ts.createSourceFile('Conversation.ts', fs.readFileSync(path.join(__dirname, '../../src/main/conversation/Conversation.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
        let method: ts.MethodDeclaration | undefined;
        const visit = (node: ts.Node) => {
            if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'loadHistory') method = node;
            ts.forEachChild(node, visit);
        };
        visit(source);
        const js = ts.transpileModule(`(async function() ${method!.body!.getText(source)})`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
        const queued: any[] = [];
        const receiver: any = {userDataPath: path.join(root, 'votc_data'),
            config: {showPreviousConversations: true, maxHistoricalConversations: 5, maxConversationsInHistoryWindow: 15},
            gameData: {playerID: 1001, votcCheckpointEpoch: 0, characters: new Map([[1001, {}], [1002, {}]])},
            campaignIdentity: undefined,
            resolveTimelineReadContext: () => null,
            chatWindow: {window: {webContents: {send: () => {}}}},
            _parseHistoryFile: async (file: any) => file,
            _loadRemainingHistory: (files: any[]) => queued.push(...files)};
        const load = vm.runInNewContext(js, {fs, path, console, listPromptTranscriptFiles, readCharacterMap: async () => new Map()});
        await load.call(receiver);
        expect(receiver.historicalConversations.length + queued.length).toBe(15);
    });
});
