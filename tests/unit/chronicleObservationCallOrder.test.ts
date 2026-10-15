/**
 * Spec Task 6 Step 4: verify that `observeParsedGameDataForChronicle` is
 * called AFTER parseLog completes and BEFORE the downstream business
 * generator (LLM call) for the letter_reply and incoming_letter paths.
 *
 * The conversation and battle_report paths in main.ts depend on Electron
 * IPC/clipboard/windows and are not unit-testable in isolation; their
 * call-order is verified by hook placement (code review) and by the
 * direct observeParsedGameDataForChronicle integration tests in
 * chronicleObservation.test.ts. This file covers the two generator paths
 * that ARE testable as classes.
 *
 * F12: the LetterReplyGenerator block is behavior-level again (ported from
 * 1.x chronicleObservationCallOrder.test.ts:213-301). 2CE's
 * generateLetterReply(gameData, letter) takes a pre-parsed snapshot, so the
 * log is parsed with parseLog here and handed to the generator; the observe
 * call order is asserted against jest invocationCallOrder (runtime behavior,
 * not source text).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('electron', () => ({
    app: { getPath: jest.fn(() => '/tmp/votc-chronicle-callorder-userdata') },
    BrowserWindow: { getAllWindows: jest.fn(() => []) }
}));

jest.mock('../../src/shared/apiConnection', () => ({
    ApiConnection: jest.fn().mockImplementation(() => ({
        complete: jest.fn().mockResolvedValue('LLM_REPLY_BODY'),
        calculateTokensFromText: jest.fn(() => 1),
        context: 4096,
        model: 'test-model',
        overwriteWarning: false,
        thinkingEnabled: false,
        config: { type: 'openrouter' } as any,
        parameters: { temperature: 0.7, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
    }))
}));

jest.mock('../../src/main/timelineBusinessWire', () => {
    const actual = jest.requireActual('../../src/main/timelineBusinessWire') as typeof import('../../src/main/timelineBusinessWire');
    const fakeTransition = async (): Promise<import('../../src/main/timelineBusinessWire').SourceTransitionResult> => ({
        attemptId: 'attempt-test',
        source: 'letter_reply' as any,
        requestKey: 'rk-test',
        commitMode: 'post-bump-node-only',
        targetNodeId: '11-22',
        reused: false,
        phase: 'committed',
        script: 'debug_log = "VOTC:CHECKPOINT"',
        context: {
            timelineNodeId: '11-22',
            timelineParentId: null,
            checkpointEpoch: 2,
            checkpointToken: undefined
        } as any
    });
    return {
        ...actual,
        runLetterReplyTimelineTransition: jest.fn(fakeTransition),
        runIncomingLetterTimelineTransition: jest.fn(fakeTransition)
    };
});

import { app } from 'electron';
import { LetterManager } from '../../src/main/letter/LetterManager';
import { LetterReplyGenerator } from '../../src/main/letter/LetterReplyGenerator';
import { IncomingLetterGenerator } from '../../src/main/letter/IncomingLetterGenerator';
import { Config } from '../../src/shared/Config';
import { chronicleMemoryStorePath } from '../../src/main/campaignDataPaths';
import { parseLog } from '../../src/shared/gameData/parseLog';
import type { GameData } from '../../src/shared/gameData/GameData';
import { Letter as ILetter, LetterType } from '../../src/main/letter/letterInterfaces';
import {
    TIMELINE_PROTOCOL_SCHEMA,
    TIMELINE_CAMPAIGN_SCHEMA
} from '../../src/shared/gameData/timelineProtocol';
jest.mock('../../src/main/chronicle/chronicleObservation', () => {
    const actual = jest.requireActual('../../src/main/chronicle/chronicleObservation') as typeof import('../../src/main/chronicle/chronicleObservation');
    return {
        ...actual,
        observeParsedGameDataForChronicle: jest.fn(actual.observeParsedGameDataForChronicle)
    };
});

import * as chronicleObservation from '../../src/main/chronicle/chronicleObservation';

const IDENTITY_A = 1;
const IDENTITY_B = 2;
const IDENTITY_C = 3;
const IDENTITY_D = 4;
const PLAYER_ID = 1001;
const AI_ID = 2002;

function v2InitLine(): string {
    const fields = [
        String(PLAYER_ID), 'PlayerName', String(AI_ID), 'AiName',
        '1066.1.1', 'scene_talk_court', 'Paris', 'ControllerName',
        '1',
        '11', '22',
        '5', '6',
        '42', '0',
        String(TIMELINE_PROTOCOL_SCHEMA),
        String(TIMELINE_CAMPAIGN_SCHEMA),
        String(IDENTITY_A), String(IDENTITY_B), String(IDENTITY_C), String(IDENTITY_D),
        '1', '1', '389091', '1066', '1', '1', '1066.1.1'
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

function makeLetterReplyLog(): string {
    const slotId = 'letter_1';
    const deliveryId = 7;
    return [
        `VOTC:LETTER/;/snapshot_begin/;/${slotId}/;/${deliveryId}`,
        v2InitLine(),
        characterLine(PLAYER_ID, 'Player', 'Player FullName'),
        characterLine(AI_ID, 'AI', 'AI FullName'),
        `VOTC:LETTER/;/slot_metadata/;/${slotId}/;/${deliveryId}/;/${AI_ID}`,
        `VOTC:LETTER/;/中文/;/letter-body-text/;/${slotId}/`,
        `VOTC:LETTER/;/snapshot_end/;/${slotId}/;/${deliveryId}`
    ].join('\n');
}

function makeIncomingLetterLog(): string {
    const slotId = 'incoming_letter_7';
    const deliveryId = 9;
    const senderId = AI_ID;
    return [
        v2InitLine(),
        characterLine(PLAYER_ID, 'Player', 'Player FullName'),
        characterLine(senderId, 'Sender', 'Sender FullName'),
        `VOTC:INCOMING_LETTER/;/context/;/${slotId}/;/family_letter/;/1066.1.1/;/${senderId}/;/${deliveryId}/;/sender_location=Somewhere`
    ].join('\n');
}

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'votc-chronicle-callorder-'));
}

function writeDebugLog(dir: string, content: string): string {
    fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
    const logPath = path.join(dir, 'logs', 'debug.log');
    fs.writeFileSync(logPath, content, 'utf8');
    return logPath;
}

function makeMinimalConfig(): Config {
    return {
        userFolderPath: '',
        language: '中文',
        stream: false,
        maxTokens: 100,
        maxMemoryTokens: 1000,
        percentOfContextToSummarize: 50,
        selectedDescScript: '',
        selectedExMsgScript: '',
        selectedBookmarkScript: '',
        inputSequence: '',
        outputSequence: '',
        textGenerationApiConnectionConfig: {
            connection: { type: 'openrouter', baseUrl: '', key: '', model: 'm', forceInstruct: false, overwriteContext: false, customContext: 0, thinkingEnabled: false },
            parameters: { temperature: 0.7, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
        },
        summarizationApiConnectionConfig: {
            connection: { type: 'openrouter', baseUrl: '', key: '', model: 'm', forceInstruct: false, overwriteContext: false, customContext: 0, thinkingEnabled: false },
            parameters: { temperature: 0.7, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
        },
        actionsApiConnectionConfig: {
            connection: { type: 'openrouter', baseUrl: '', key: '', model: 'm', forceInstruct: false, overwriteContext: false, customContext: 0, thinkingEnabled: false },
            parameters: { temperature: 0.7, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
        },
        summarizationUseTextGenApi: true,
        actionsUseTextGenApi: true,
        actionsEnableAll: false,
        narrativeEnable: false,
        disabledActions: [],
        actionApprovalMode: 'none',
        pauseOnActionApproval: false,
        destructiveActionOverrides: {},
        cleanMessages: false,
        debugMode: false,
        checkForUpdatesOnStartup: false,
        shuffleCharacterOrder: false,
        dynamicCharacterSelection: false,
        validateCharacterIdentity: false,
        aiStartConversationChance: 0,
        aiToAiChatChance: 0,
        nonTargetedCharacterResponseChance: 0,
        repetitionDetectionEnabled: false,
        repetitionThreshold: 0,
        showSuggestionsButton: false,
        generateSceneDescription: false,
        autoGenerateSuggestions: false,
        autoSendSuggestion: false,
        summariesInsertDepth: 0,
        memoriesInsertDepth: 0,
        descInsertDepth: 0,
        mainPrompt: '',
        summarizePrompt: '',
        memoriesPrompt: '',
        suffixPrompt: '',
        enableSuffixPrompt: false,
        selfTalkPrompt: '',
        selectedSelfTalkExMsgScript: '',
        selfTalkSummarizePrompt: '',
        narrativePrompt: '',
        sceneDescriptionPrompt: '',
        battleReportPrompt: '',
        letterPrompt: 'Reply to the letter in {{letterLanguage}}.',
        incomingLetterPrompt: 'Write a letter.'
    } as unknown as Config;
}

describe('chronicle observe call-order: LetterReplyGenerator', () => {
    let tmpDir: string;
    let userDataDir: string;

    beforeEach(() => {
        tmpDir = makeTmpDir();
        userDataDir = makeTmpDir();
        (app.getPath as jest.Mock).mockReturnValue(userDataDir);
        (chronicleObservation.observeParsedGameDataForChronicle as jest.Mock).mockClear();
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    // 2CE's generateLetterReply(gameData, letter) takes a pre-parsed
    // snapshot, so the snapshot log is parsed here and handed to the
    // generator (1.x passed logPath + slot + deliveryId instead).
    // main.ts passes <userData>/votc_data as the generator's userDataPath,
    // so mirror that layout and seed the minimal prompt config the prompt
    // builder loads from it.
    const generatorUserDataPath = () => path.join(userDataDir, 'votc_data');

    function seedPromptConfig(): void {
        const promptsDir = path.join(generatorUserDataPath(), 'configs', 'prompts');
        fs.mkdirSync(promptsDir, { recursive: true });
        fs.writeFileSync(
            path.join(promptsDir, 'en.json'),
            JSON.stringify({
                prompts: {
                    letterPrompt: 'Reply to the letter in {{letterLanguage}}: {{letterContent}}',
                    letterSummaryPrompt: 'Summarize: {{playerLetterContent}} / {{aiReplyContent}}',
                    memoriesPrompt: 'Memories:'
                },
                mod_prompt_sets: {}
            }),
            'utf8'
        );
    }

    async function parseLetterGameData(logPath: string): Promise<GameData> {
        const gameData = await parseLog(logPath);
        expect(gameData).toBeDefined();
        return gameData!;
    }

    function makeLetter(gameData: GameData, overrides: Partial<ILetter> = {}): ILetter {
        return {
            id: 'letter-test-original',
            sender: gameData.characters.get(PLAYER_ID)!,
            recipient: gameData.characters.get(AI_ID)!,
            subject: 'letter_1',
            content: 'letter-body-text',
            timestamp: new Date('1066-01-01T00:00:00Z'),
            creationTimestamp: new Date('1066-01-01T00:00:00Z'),
            isRead: false,
            letterType: LetterType.PERSONAL,
            delay: 10,
            totalDays: 7,
            status: 'generating',
            triggeredActions: [],
            ...overrides
        };
    }

    function latestCompleteMock(): jest.Mock {
        const apiModule = jest.requireMock('../../src/shared/apiConnection') as { ApiConnection: jest.Mock };
        const results = apiModule.ApiConnection.mock.results;
        return results[results.length - 2].value.complete;
    }

    it('calls observeParsedGameDataForChronicle after parseLog and before the LLM complete call', async () => {
        const logContent = makeLetterReplyLog();
        const logPath = writeDebugLog(tmpDir, logContent);
        const gameData = await parseLetterGameData(logPath);
        seedPromptConfig();

        const observeMock = chronicleObservation.observeParsedGameDataForChronicle as jest.Mock;
        const generator = new LetterReplyGenerator(makeMinimalConfig(), generatorUserDataPath(), null);

        const result = await generator.generateLetterReply(gameData, makeLetter(gameData));

        expect(result).not.toBeNull();
        expect(observeMock).toHaveBeenCalledTimes(1);
        const [calledUserDataDir, , source, language] = observeMock.mock.calls[0];
        expect(calledUserDataDir).toBe(userDataDir);
        expect(source).toBe('letter');
        expect(language).toBe('中文');

        // Runtime behavior, not source text: the chronicle observation must
        // have been invoked before the LLM request.
        const complete = latestCompleteMock();
        expect(complete).toHaveBeenCalled();
        expect(observeMock.mock.invocationCallOrder[0]).toBeLessThan(complete.mock.invocationCallOrder[0]);
    });

    it('writes the chronicle memory store file during the observe step (write-through before business)', async () => {
        const slotId = 'letter_1';
        const deliveryId = 8;
        const logContent = [
            `VOTC:LETTER/;/snapshot_begin/;/${slotId}/;/${deliveryId}`,
            v2InitLine(),
            characterLine(PLAYER_ID, 'Player', 'Player FullName'),
            characterLine(AI_ID, 'AI', 'AI FullName'),
            `VOTC:LETTER/;/slot_metadata/;/${slotId}/;/${deliveryId}/;/${AI_ID}`,
            `VOTC:LETTER/;/中文/;/letter-body-text-2/;/${slotId}/`,
            `VOTC:LETTER/;/snapshot_end/;/${slotId}/;/${deliveryId}`
        ].join('\n');
        const logPath = writeDebugLog(tmpDir, logContent);
        const gameData = await parseLetterGameData(logPath);
        seedPromptConfig();

        const generator = new LetterReplyGenerator(makeMinimalConfig(), generatorUserDataPath(), null);
        await generator.generateLetterReply(gameData, makeLetter(gameData, { totalDays: deliveryId }));

        const expectedIdentity = {
            campaignId: '1-2-3-4',
            playerId: String(PLAYER_ID)
        };
        const storePath = chronicleMemoryStorePath(userDataDir, expectedIdentity as any);
        expect(fs.existsSync(storePath)).toBe(true);
    });

    it('writes a delivery-guarded fallback payload to letters.txt when reply generation fails', async () => {
        const apiModule = jest.requireMock('../../src/shared/apiConnection') as { ApiConnection: jest.Mock };
        const originalImplementation = apiModule.ApiConnection.getMockImplementation();
        const complete = jest.fn().mockRejectedValue(new Error('Connection error.'));
        apiModule.ApiConnection.mockImplementation(() => ({
            complete,
            calculateTokensFromText: jest.fn(() => 1),
            context: 4096,
            model: 'test-model',
            overwriteWarning: false,
            thinkingEnabled: false,
            config: { type: 'openrouter' },
            parameters: { temperature: 0.7, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
        }));

        try {
            // config.userFolderPath is the CK3 user folder the letters.txt
            // channel lives in; point it at the tmp dir for this test.
            const config = makeMinimalConfig();
            config.userFolderPath = tmpDir;
            const logPath = writeDebugLog(tmpDir, makeLetterReplyLog());
            const gameData = await parseLetterGameData(logPath);
            seedPromptConfig();
            const generator = new LetterReplyGenerator(config, generatorUserDataPath(), null);

            await expect(
                generator.generateLetterReply(gameData, makeLetter(gameData, { subject: 'letter_2' }))
            ).resolves.toBeNull();

            expect(LetterManager.getInstance().hasPendingLetterFallbacks()).toBe(true);
            LetterManager.getInstance().flushNextLetterFallback(config);
            const runFile = path.join(tmpDir, 'run', 'letters.txt');
            const script = fs.readFileSync(runFile, 'utf8');
            expect(script).toContain('desc = votc_letter_reply_fallback_desc');
            expect(script).toContain('/letter_2/;/7');
            expect(script).not.toContain('LLM_REPLY_BODY');
            expect(complete).toHaveBeenCalledTimes(1);
        } finally {
            apiModule.ApiConnection.mockImplementation(originalImplementation);
        }
    });
});

describe('chronicle observe call-order: IncomingLetterGenerator', () => {
    let tmpDir: string;
    let userDataDir: string;

    beforeEach(() => {
        tmpDir = makeTmpDir();
        userDataDir = makeTmpDir();
        (app.getPath as jest.Mock).mockReturnValue(userDataDir);
        (chronicleObservation.observeParsedGameDataForChronicle as jest.Mock).mockClear();
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    it('calls observeParsedGameDataForChronicle after parseLog and before the LLM complete call', async () => {
        const logContent = makeIncomingLetterLog();
        const logPath = writeDebugLog(tmpDir, logContent);

        const observeMock = chronicleObservation.observeParsedGameDataForChronicle as jest.Mock;
        const generator = new IncomingLetterGenerator(makeMinimalConfig(), path.join(userDataDir, 'votc_data'), null);

        await generator.generateIncomingLetter(logPath, tmpDir, 'incoming_letter_7', 'family_letter', 9);

        expect(observeMock).toHaveBeenCalledTimes(1);
        const [calledUserDataDir, , source, language] = observeMock.mock.calls[0];
        expect(calledUserDataDir).toBe(userDataDir);
        expect(source).toBe('incoming_letter');
        expect(language).toBe('中文');
    });

    it('writes the chronicle memory store file during the observe step (write-through before business)', async () => {
        const slotId = 'incoming_letter_7';
        const deliveryId = 10;
        const senderId = AI_ID;
        const logContent = [
            v2InitLine(),
            characterLine(PLAYER_ID, 'Player', 'Player FullName'),
            characterLine(senderId, 'Sender', 'Sender FullName'),
            `VOTC:INCOMING_LETTER/;/context/;/${slotId}/;/family_letter/;/1066.1.1/;/${senderId}/;/${deliveryId}/;/sender_location=Somewhere`
        ].join('\n');
        const logPath = writeDebugLog(tmpDir, logContent);

        const generator = new IncomingLetterGenerator(makeMinimalConfig(), path.join(userDataDir, 'votc_data'), null);
        await generator.generateIncomingLetter(logPath, tmpDir, slotId, 'family_letter', deliveryId);

        const expectedIdentity = {
            campaignId: '1-2-3-4',
            playerId: String(PLAYER_ID)
        };
        const storePath = chronicleMemoryStorePath(userDataDir, expectedIdentity as any);
        expect(fs.existsSync(storePath)).toBe(true);
    });

    it('accepts the dedicated poetry slot and generates its run file', async () => {
        const slotId = 'incoming_letter_8';
        const deliveryId = 11;
        const senderId = AI_ID;
        const logContent = [
            v2InitLine(),
            characterLine(PLAYER_ID, 'Player', 'Player FullName'),
            characterLine(senderId, 'Poet', 'Poet FullName'),
            `VOTC:INCOMING_LETTER/;/context/;/${slotId}/;/poetry_letter/;/1066.1.1/;/${senderId}/;/${deliveryId}/;/sender_location=Somewhere/;/poetry_sender_source=court_poet`
        ].join('\n');
        const logPath = writeDebugLog(tmpDir, logContent);

        const generator = new IncomingLetterGenerator(makeMinimalConfig(), path.join(userDataDir, 'votc_data'), null);
        await generator.generateIncomingLetter(logPath, tmpDir, slotId, 'poetry_letter', deliveryId);

        const runFile = path.join(tmpDir, 'run', 'incomingletter_v2_8.txt');
        expect(fs.existsSync(runFile)).toBe(true);
        expect(fs.readFileSync(runFile, 'utf8')).toContain('LLM_REPLY_BODY');

        const apiModule = jest.requireMock('../../src/shared/apiConnection') as { ApiConnection: jest.Mock };
        const latestApi = apiModule.ApiConnection.mock.results[apiModule.ApiConnection.mock.results.length - 1].value;
        const messages = latestApi.complete.mock.calls[0][0] as Array<{ content: string }>;
        expect(messages[messages.length - 1].content).toContain('正文主体必须是一首原创诗');
        expect(messages[messages.length - 1].content).toContain('不得复述、改写或生成与此前作品近似、雷同的内容');
    });
});
