/**
 * F13 (P1-L1): the incoming-letter generator's chronological summary block
 * budget must come from `config.maxSummaryTokens` (falling back to 2000 for
 * configs without the key) instead of the previous hardcoded constant.
 *
 * These tests drive the real generateIncomingLetter pipeline (mocked LLM and
 * timeline transition only) and assert the budget argument the generator
 * actually passes into its bounded-summary builder.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('electron', () => ({
    app: { getPath: jest.fn(() => '/tmp/votc-incoming-budget-userdata') }
}));

jest.mock('../../../src/shared/apiConnection', () => ({
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

jest.mock('../../../src/main/timelineBusinessWire', () => {
    const actual = jest.requireActual('../../../src/main/timelineBusinessWire') as typeof import('../../../src/main/timelineBusinessWire');
    const fakeTransition = async (): Promise<import('../../../src/main/timelineBusinessWire').SourceTransitionResult> => ({
        attemptId: 'attempt-test',
        source: 'incoming_letter' as any,
        requestKey: 'rk-test',
        commitMode: 'post-bump-node-only',
        targetNodeId: '11-22',
        reused: false,
        phase: 'committed',
        script: 'debug_log = "VOTC:CHECKPOINT"',
        context: {
            timelineNodeId: '11-22',
            timelineParentId: null,
            checkpointEpoch: 43,
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
import { IncomingLetterGenerator } from '../../../src/main/letter/IncomingLetterGenerator';
import { Config } from '../../../src/shared/Config';

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
        '2', '1',
        '1', '2', '3', '4',
        '1', '1'
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

function makeIncomingLetterLog(deliveryId: number): string {
    const slotId = 'incoming_letter_7';
    return [
        v2InitLine(),
        characterLine(PLAYER_ID, 'Player', 'Player FullName'),
        characterLine(AI_ID, 'Sender', 'Sender FullName'),
        `VOTC:INCOMING_LETTER/;/context/;/${slotId}/;/family_letter/;/1066.1.1/;/${AI_ID}/;/${deliveryId}/;/sender_location=Somewhere`
    ].join('\n');
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
        letterPrompt: 'Reply to the letter.',
        incomingLetterPrompt: 'Write a letter.'
    } as unknown as Config;
}

describe('IncomingLetterGenerator summary token budget (F13)', () => {
    let tmpDir: string;
    let userDataDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-incoming-budget-'));
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-incoming-budget-ud-'));
        (app.getPath as jest.Mock).mockReturnValue(userDataDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        fs.rmSync(userDataDir, { recursive: true, force: true });
    });

    function seedSenderSummaries(): void {
        const summaryDir = path.join(userDataDir, 'votc_data', 'conversation_summaries', String(PLAYER_ID));
        fs.mkdirSync(summaryDir, { recursive: true });
        fs.writeFileSync(
            path.join(summaryDir, `${AI_ID}.json`),
            JSON.stringify([
                { date: '1066年1月1日', content: '与玩家此前的会话摘要一。' },
                { date: '1066年1月2日', content: '与玩家此前的会话摘要二。' }
            ]),
            'utf8'
        );
    }

    async function runGeneration(config: Config, deliveryId: number): Promise<jest.SpyInstance> {
        seedSenderSummaries();
        const logPath = path.join(tmpDir, 'debug.log');
        fs.writeFileSync(logPath, makeIncomingLetterLog(deliveryId), 'utf8');

        const generator = new IncomingLetterGenerator(config, path.join(userDataDir, 'votc_data'), null);
        const spy = jest.spyOn(generator as any, 'buildBoundedChronologicalBlock');
        await generator.generateIncomingLetter(logPath, tmpDir, 'incoming_letter_7', 'family_letter', deliveryId);
        return spy;
    }

    it('falls back to the 2000-token default when the config has no maxSummaryTokens', async () => {
        const spy = await runGeneration(makeMinimalConfig(), 9);

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][2]).toBe(2000);
    });

    it('honours a custom config.maxSummaryTokens value', async () => {
        const config = { ...makeMinimalConfig(), maxSummaryTokens: 3500 } as Config;

        const spy = await runGeneration(config, 12);

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][2]).toBe(3500);
    });
});
