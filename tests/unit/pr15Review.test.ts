import fs from 'fs';
import path from 'path';
import os from 'os';
import vm from 'vm';
import ts from 'typescript';
import { execFileSync } from 'child_process';
import { app, BrowserWindow } from 'electron';
import { LetterReplyGenerator } from '../../src/main/letter/LetterReplyGenerator';
import { LetterManager } from '../../src/main/letter/LetterManager';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import { timelineRegistryPath } from '../../src/main/campaignDataPaths';
import { getConversationHistoryFiles } from '../../src/main/conversationHistory';

jest.mock('../../src/shared/apiConnection', () => ({ ApiConnection: jest.fn() }));
jest.mock('../../src/main/summaryManager', () => ({}));
jest.mock('../../src/main/conversation/promptBuilder', () => ({}));
jest.mock('../../src/main/timelineRegistryRecovery', () => ({
    reportCampaignIdentityUnavailable: jest.fn(), reportCorruptTimelineRegistry: jest.fn(),
    reportTimelineParentNotFound: jest.fn(), reportUnsupportedTimelineSchema: jest.fn()
}));

describe('PR 15 business integration reproductions', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr15-review-'));
        (app.getPath as jest.Mock).mockReturnValue(root);
        (BrowserWindow as any).getAllWindows = () => [];
    });
    afterEach(() => {
        const target = path.resolve(root);
        if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith('pr15-review-')) throw new Error('unsafe cleanup');
        fs.rmSync(target, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    async function generate() {
        const identity = buildIdentityFromParts({a: 1, b: 2, c: 3, d: 4}, '1001');
        const gameData: any = {
            playerID: 1001, aiID: 1002, date: '1066.1.1', votcCheckpointEpoch: 0,
            timelineSnapshotResult: { status: 'valid', snapshot: {
                playerId: '1001', source: 'init', epoch: 0,
                protocol: { protocolSchema: 2, campaignSchema: 1,
                    campaignIdA: 1, campaignIdB: 2, campaignIdC: 3, campaignIdD: 4,
                    campaignBootstrapKind: 1, playerTimelineSchema: 1 }
            }}
        };
        const config: any = {userFolderPath: path.join(root, 'ck3'), language: 'en', maxTokens: 100,
            textGenerationApiConnectionConfig: {connection: {}, parameters: {temperature: 0.5}}};
        const original: any = {id: 'original', subject: 'letter_1', totalDays: 389000,
            content: 'Hello', sender: {id: 1001}, recipient: {id: 1002}};
        const reply: any = {id: 'reply', content: 'Greetings'};
        const generator: any = new LetterReplyGenerator(config, path.join(root, 'votc_data'), null);
        generator.apiConnection = {complete: jest.fn().mockResolvedValue('Greetings')};
        generator.buildLetterPrompt = jest.fn().mockResolvedValue('prompt');
        generator.generateAndSaveLetterSummary = jest.fn().mockResolvedValue(undefined);
        generator.saveLetterHistory = jest.fn().mockResolvedValue(reply);
        jest.spyOn(LetterManager.getInstance(), 'updateLetterStatus').mockImplementation(() => {});
        expect(await generator.generateLetterReply(gameData, original)).toBe(reply);
        return {identity, config, original, reply};
    }

    it('reply transition uses the same campaign registry root as conversations', async () => {
        const {identity} = await generate();
        const wrongPath = timelineRegistryPath(path.join(root, 'votc_data'), identity);
        expect(fs.existsSync(wrongPath)).toBe(true);
        expect(fs.existsSync(timelineRegistryPath(root, identity))).toBe(true);
    });

    it('the actual reply delivery script applies the allocated timeline node', async () => {
        const {config, original, reply} = await generate();
        const fallback = fs.readFileSync(path.join(root, 'votc_data', 'run', 'letter1.txt'), 'utf8');
        expect(fallback).toContain('votc_timeline_node_a');
        LetterManager.getInstance().deliverLetter({letter: reply, originalLetter: original, expectedDeliveryDay: 389001}, config, '1066.1.2');
        const delivered = fs.readFileSync(path.join(config.userFolderPath, 'run', 'letters.txt'), 'utf8');
        expect(delivered).toContain('votc_timeline_node_a');
    });

    it('history viewer can see a new transcript written by the current conversation writer', async () => {
        const identity = buildIdentityFromParts({a: 1, b: 2, c: 3, d: 4}, '1001');
        const historyDir = path.join(root, 'votc_data', 'conversation_history', '1001');
        fs.mkdirSync(historyDir, {recursive: true});
        fs.writeFileSync(path.join(historyDir, '1001_1002_1770000000000.txt'), 'Date: 1066.1.1\nPlayer: Hello');
        expect(await getConversationHistoryFiles('1001')).toHaveLength(1);
        expect(await getConversationHistoryFiles('1001', 1, undefined, undefined, identity)).toHaveLength(1);
    });

    it('switching player clears pending letters before the new date can deliver them (base comparison)', async () => {
        async function runSetup(code: string) {
            const source = ts.createSourceFile('main.ts', code, ts.ScriptTarget.Latest, true);
            let callback: ts.Node | undefined;
            const visit = (node: ts.Node) => {
                if (ts.isCallExpression(node) && node.expression.getText(source) === 'ipcMain.once'
                    && node.arguments[0]?.getText(source) === "'chat-window-ready'") callback = node.arguments[1];
                ts.forEachChild(node, visit);
            };
            visit(source);
            if (!callback) throw new Error('handler not found');
            const data = {playerID: 2002, aiID: 3003, date: '1066.1.1', totalDays: 389000};
            const pending = new Map([['old-player-letter', {playerId: '1001'}]]);
            let countAtDateUpdate = -1;
            const sandbox: any = {
                console, path, config: {userFolderPath: root}, userDataPath: root, tiktokenEncoder: null,
                fs: {existsSync: () => false}, sleep: async () => {}, parseLog: async () => data,
                currentSessionPlayerId: '1001', storedLetters: pending, lastLetterSentToGame: {},
                setCachedGameData: () => {},
                updateCurrentDate: () => {countAtDateUpdate = pending.size;},
                chatWindow: {window: {webContents: {send: () => {}}}},
                pendingMessages: [], isConversationReady: false, conversation: null,
                Conversation: class {
                    gameData = data; actions = []; messages = [];
                    letterManager = {importLettersFromLog: async () => {}};
                    async loadHistory() {} async calculateBasePromptTokens() {return 0;} async initialize() {}
                }
            };
            const js = ts.transpileModule(`(${callback.getText(source)})`, {
                compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}
            }).outputText;
            await vm.runInNewContext(js, sandbox)();
            return countAtDateUpdate;
        }
        const base = execFileSync('git', ['show', '57716b6:src/main/main.ts'], {encoding: 'utf8'});
        expect(await runSetup(base)).toBe(0);
        expect(await runSetup(fs.readFileSync(path.join(__dirname, '../../src/main/main.ts'), 'utf8'))).toBe(0);
    });
});
