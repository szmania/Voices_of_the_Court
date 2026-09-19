import fs from 'fs';
import path from 'path';
import os from 'os';
import vm from 'vm';
import ts from 'typescript';
import { app, BrowserWindow } from 'electron';
import { LetterReplyGenerator } from '../../src/main/letter/LetterReplyGenerator';
import { LetterManager } from '../../src/main/letter/LetterManager';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import { conversationHistoryDir } from '../../src/main/campaignDataPaths';
import { runConversationTimelineTransition } from '../../src/main/timelineBusinessWire';
import { getConversationHistoryFiles, readConversationHistoryFile } from '../../src/main/conversationHistory';

jest.mock('../../src/shared/apiConnection', () => ({ApiConnection: jest.fn()}));
jest.mock('../../src/main/summaryManager', () => ({}));
jest.mock('../../src/main/conversation/promptBuilder', () => ({}));
jest.mock('../../src/main/timelineRegistryRecovery', () => ({
    reportCampaignIdentityUnavailable: jest.fn(), reportCorruptTimelineRegistry: jest.fn(),
    reportTimelineParentNotFound: jest.fn(), reportUnsupportedTimelineSchema: jest.fn()
}));

describe('PR15 second review integration reproductions', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'pr15-round2-'));
        (app.getPath as jest.Mock).mockReturnValue(root);
        (BrowserWindow as any).getAllWindows = () => [];
        (LetterManager as any).instance = undefined;
    });
    afterEach(() => {
        const target = path.resolve(root);
        if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith('pr15-round2-')) throw new Error('unsafe cleanup');
        fs.rmSync(target, {recursive: true, force: true});
    });

    async function generateRealSavedReply() {
        const player = {id: 1001, fullName: 'Player'};
        const ai = {id: 1002, fullName: 'Other'};
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
        // Keep the real saveLetterHistory and updateLetterStatus paths.
        const reply = await generator.generateLetterReply(gameData, original);
        expect(reply?.timelineScript).toContain('votc_timeline_node_a');
        return {reply, original, config, gameData};
    }

    it('persists the timeline script for replies rehydrated after restart', async () => {
        const {reply} = await generateRealSavedReply();
        (LetterManager as any).instance = undefined;
        const restored = LetterManager.getInstance().getLetters('1001', '1002').find(l => l.id === reply.id);
        expect(restored?.timelineScript).toBe(reply.timelineScript);
    });

    it('delayed delivery does not unconditionally write the old sending checkpoint', async () => {
        const {reply, original, config, gameData} = await generateRealSavedReply();
        const identity = buildIdentityFromParts({a: 1, b: 2, c: 3, d: 4}, '1001');
        // Two real conversation transitions happen while the letter is in transit.
        let previousNode: string | undefined;
        for (const epoch of [6, 7]) {
            const [nodeA, nodeB] = previousNode ? previousNode.split('-').map(Number) : [];
            const laterSnapshot = {...gameData, votcCheckpointEpoch: epoch,
                timelineSnapshotResult: {status: 'valid', snapshot: {
                    ...gameData.timelineSnapshotResult.snapshot, epoch, nodeA, nodeB
                }}};
            const transition = await runConversationTimelineTransition({
                userDataDir: root, identity, gameData: laterSnapshot,
                requestKey: `later-conversation-${epoch}`, eventSignature: `later-${epoch}`,
                targetEpoch: epoch + 1, scopeVar: 'talk_first_scope'
            });
            previousNode = transition.targetNodeId;
            expect(transition.context.checkpointEpoch).toBe(epoch + 1);
        }
        LetterManager.getInstance().deliverLetter({letter: reply, originalLetter: original, expectedDeliveryDay: 389009}, config, '1066.1.10');
        const delivered = fs.readFileSync(path.join(config.userFolderPath, 'run', 'letters.txt'), 'utf8');
        const appendedTimeline = delivered.slice(delivered.lastIndexOf('global_var:message_first_scope = {'));
        // CK3 is now on the second conversation's epoch 8. Inspect the emitted script:
        // its unconditional top-level scope must not restore sending-time epoch 6.
        expect(appendedTimeline).not.toMatch(/set_variable\s*=\s*\{\s*name\s*=\s*votc_checkpoint_epoch\s+value\s*=\s*6\s*\}/);
    });

    it.each([
        ['POSIX', path.posix, '/home/alice/.config/votc'],
        ['UNC', path.win32, '\\\\server\\share\\votc']
    ] as const)('preserves absolute %s campaign roots', (_name, platformPath, userData) => {
        const source = fs.readFileSync(path.join(__dirname, '../../src/main/campaignDataPaths.ts'), 'utf8');
        const js = ts.transpileModule(source, {compilerOptions: {
            target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true
        }}).outputText;
        const exports: any = {};
        vm.runInNewContext(js, {exports, require: (name: string) => {
            if (name === 'path') return platformPath;
            throw new Error(`Unexpected module: ${name}`);
        }});
        const identity = buildIdentityFromParts({a: 1, b: 2, c: 3, d: 4}, '1001');
        expect(exports.campaignRoot(userData, identity)).toBe(platformPath.join(userData, 'votc_data', 'campaigns', identity.campaignId));
    });

    it('does not show a known campaign A transcript in campaign B with the same player ID', async () => {
        const a = buildIdentityFromParts({a: 1, b: 2, c: 3, d: 4}, '1001');
        const b = buildIdentityFromParts({a: 5, b: 6, c: 7, d: 8}, '1001');
        const fileName = '1001_1002_1770000000000.txt';
        // Match the current writer: identical copies in legacy and campaign A.
        for (const dir of [path.join(root, 'votc_data', 'conversation_history', '1001'), conversationHistoryDir(root, a)]) {
            fs.mkdirSync(dir, {recursive: true});
            fs.writeFileSync(path.join(dir, fileName), 'Date: 1066.1.1\nPlayer: Campaign A only');
        }
        const wrongCampaignFiles = await getConversationHistoryFiles('1001', 0, undefined, undefined, b);
        const wrongCampaignText = await readConversationHistoryFile('1001', fileName, 0, undefined, undefined, b);
        expect({count: wrongCampaignFiles.length, text: wrongCampaignText}).toEqual({count: 0, text: ''});
    });
});
