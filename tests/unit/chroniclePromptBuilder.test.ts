jest.mock('electron', () => ({
    app: { getPath: jest.fn() }
}));

import {
    escapeXml,
    formatChronicleSourceTag,
    formatCharacterMemoriesSection,
    buildChroniclePrompt,
    DEFAULT_CHRONICLE_PROMPT,
    type BuildChroniclePromptParams
} from '../../src/main/chronicle/ChroniclePromptBuilder';
import {
    validateChronicleOutput,
    type ChronicleGeneratorApi,
    type ChronicleGeneratorConfig,
    createChronicleSummarizationConnection,
    generateChronicle
} from '../../src/main/chronicle/ChronicleGenerator';
import type { ApiConnection } from '../../src/shared/apiConnection';
import type {
    ChronicleSelectedSource,
    ChronicleSourceRecord
} from '../../src/main/chronicle/chronicleTypes';
import type { Ck3GameDate } from '../../src/shared/gameData/gameDate';

function gameDate(year: number, month: number, day: number, totalDays: number): Ck3GameDate {
    return { totalDays, year, month, day, display: `${year}.${month}.${day}` };
}

function makeConversationRecord(
    id: string,
    rawText: string,
    overrides: Partial<ChronicleSourceRecord> = {}
): ChronicleSourceRecord {
    return {
        id,
        kind: 'conversation',
        gameDate: gameDate(1066, 9, 20, 388950),
        legacyUndated: false,
        title: `Conversation ${id}`,
        participants: [{ id: '1001', name: 'Player' }],
        rawText,
        ...overrides
    };
}

function makeMemoryRecord(
    id: string,
    rawText: string,
    overrides: Partial<ChronicleSourceRecord> = {}
): ChronicleSourceRecord {
    return {
        id,
        kind: 'character_memory',
        gameDate: gameDate(1066, 1, 1, 388798),
        legacyUndated: false,
        title: `Memory ${id}`,
        participants: [{ id: '1001', name: 'Player' }],
        rawText,
        memoryKey: id,
        memoryOwnerId: '1001',
        memoryTextFrozen: true,
        relevanceWeight: 80,
        ...overrides
    };
}

function makeLetterRecord(
    id: string,
    rawText: string,
    overrides: Partial<ChronicleSourceRecord> = {}
): ChronicleSourceRecord {
    return {
        id,
        kind: 'outgoing_letter',
        gameDate: gameDate(1066, 5, 10, 388880),
        legacyUndated: false,
        title: `Letter ${id}`,
        participants: [{ id: '1001', name: 'Player' }],
        rawText,
        ...overrides
    };
}

function makeSelected(
    record: ChronicleSourceRecord,
    mode: 'raw' | 'existing_summary' | 'generated_digest' | 'chunk_digest' = 'raw',
    text?: string
): ChronicleSelectedSource {
    const selectedText = text ?? record.rawText;
    return {
        record,
        mode,
        text: selectedText,
        manifestItem: {
            sourceId: record.id,
            kind: record.kind,
            title: record.title,
            gameDate: record.gameDate,
            representation: mode,
            rawCharCount: record.rawText.length,
            selectedCharCount: selectedText.length,
            rawHash: 'abc123',
            selectedTextHash: 'def456',
            votcCheckpointEpoch: record.votcCheckpointEpoch,
            votcTimelineNodeId: record.votcTimelineNodeId
        }
    };
}

function makeParams(
    overrides: Partial<BuildChroniclePromptParams> = {}
): BuildChroniclePromptParams {
    return {
        promptTemplate: DEFAULT_CHRONICLE_PROMPT,
        playerName: '阿尔弗雷德',
        periodStart: gameDate(1066, 1, 1, 388798),
        periodEnd: gameDate(1066, 12, 31, 389158),
        sources: [],
        ...overrides
    };
}

describe('escapeXml', () => {
    test('escapes ampersand', () => {
        expect(escapeXml('a & b')).toBe('a &amp; b');
    });

    test('escapes less-than', () => {
        expect(escapeXml('a < b')).toBe('a &lt; b');
    });

    test('escapes greater-than', () => {
        expect(escapeXml('a > b')).toBe('a &gt; b');
    });

    test('escapes double quotes', () => {
        expect(escapeXml('say "hi"')).toBe('say &quot;hi&quot;');
    });

    test('escapes all special characters together', () => {
        expect(escapeXml('<tag attr="x">&</tag>')).toBe(
            '&lt;tag attr=&quot;x&quot;&gt;&amp;&lt;/tag&gt;'
        );
    });

    test('leaves plain text unchanged', () => {
        expect(escapeXml('hello world')).toBe('hello world');
    });
});

describe('formatChronicleSourceTag', () => {
    test('builds correct XML tag with kind and date attributes', () => {
        const record = makeConversationRecord('conv-1', 'Hello world');
        const source = makeSelected(record, 'raw');
        const tag = formatChronicleSourceTag(source);
        expect(tag).toContain('<chronicle_source');
        expect(tag).toContain('kind="conversation"');
        expect(tag).toContain('date="1066.9.20"');
        expect(tag).toContain('Hello world');
        expect(tag).toContain('</chronicle_source>');
    });

    test('does not expose debug-only id or representation attributes', () => {
        const record = makeConversationRecord('conv-debug', 'Hello world');
        const source = makeSelected(record, 'raw');
        const tag = formatChronicleSourceTag(source);
        expect(tag).not.toContain('id="conv-debug"');
        expect(tag).not.toContain('representation=');
    });

    test('uses selected text, not rawText, when mode is existing_summary', () => {
        const record = makeConversationRecord('conv-2', 'FULL RAW TEXT HERE');
        const source = makeSelected(record, 'existing_summary', 'SHORT SUMMARY');
        const tag = formatChronicleSourceTag(source);
        expect(tag).toContain('SHORT SUMMARY');
        expect(tag).not.toContain('FULL RAW TEXT HERE');
    });

    test('escapes pseudo-XML tags in source content', () => {
        const record = makeConversationRecord('conv-3', 'He said <evil> & "done"');
        const source = makeSelected(record, 'raw');
        const tag = formatChronicleSourceTag(source);
        expect(tag).toContain('&lt;evil&gt;');
        expect(tag).toContain('&amp;');
        expect(tag).toContain('&quot;done&quot;');
        expect(tag).not.toContain('<evil>');
    });
});

describe('formatCharacterMemoriesSection', () => {
    test('builds section with period attribute', () => {
        const record = makeMemoryRecord('mem-1', '某年某月发生的事');
        const source = makeSelected(record);
        const section = formatCharacterMemoriesSection(
            [source],
            gameDate(1066, 1, 1, 388798),
            gameDate(1066, 12, 31, 389158)
        );
        expect(section).toContain('<character_memories');
        expect(section).toContain('period="1066.1.1--1066.12.31"');
        expect(section).toContain('</character_memories>');
    });

    test('includes memory entries with date but no debug attributes', () => {
        const record = makeMemoryRecord('mem-2', '记得那次宴会');
        const source = makeSelected(record);
        const section = formatCharacterMemoriesSection(
            [source],
            gameDate(1066, 1, 1, 388798),
            gameDate(1066, 12, 31, 389158)
        );
        expect(section).toContain('<memory');
        expect(section).toContain('date="1066.1.1"');
        expect(section).toContain('记得那次宴会');
        expect(section).not.toContain('owner=');
        expect(section).not.toContain('relevance=');
    });

    test('escapes memory text content', () => {
        const record = makeMemoryRecord('mem-3', 'secret <plot> & "plan"');
        const source = makeSelected(record);
        const section = formatCharacterMemoriesSection(
            [source],
            gameDate(1066, 1, 1, 388798),
            gameDate(1066, 12, 31, 389158)
        );
        expect(section).toContain('&lt;plot&gt;');
        expect(section).toContain('&amp;');
        expect(section).toContain('&quot;plan&quot;');
    });

    test('handles empty memory list', () => {
        const section = formatCharacterMemoriesSection(
            [],
            gameDate(1066, 1, 1, 388798),
            gameDate(1066, 12, 31, 389158)
        );
        expect(section).toContain('<character_memories');
        expect(section).toContain('</character_memories>');
    });
});

describe('buildChroniclePrompt', () => {
    test('replaces template variables playerName, periodStart, periodEnd', () => {
        const prompt = buildChroniclePrompt(makeParams({
            playerName: '查理曼',
            periodStart: gameDate(1066, 3, 1, 388840),
            periodEnd: gameDate(1066, 6, 30, 388950)
        }));
        expect(prompt).toContain('查理曼');
        expect(prompt).toContain('1066.3.1');
        expect(prompt).toContain('1066.6.30');
        expect(prompt).not.toContain('{{playerName}}');
        expect(prompt).not.toContain('{{periodStart}}');
        expect(prompt).not.toContain('{{periodEnd}}');
    });

    test('includes full conversation raw text verbatim', () => {
        const conversationText = '这是完整的对话原文，包含所有细节和对话内容。角色A说了什么，角色B回应了什么。';
        const record = makeConversationRecord('conv-full', conversationText);
        const source = makeSelected(record, 'raw');
        const prompt = buildChroniclePrompt(makeParams({
            sources: [source]
        }));
        expect(prompt).toContain(conversationText);
    });

    test('includes only summary when source is degraded to existing_summary', () => {
        const record = makeConversationRecord('conv-deg', 'VERY LONG RAW CONVERSATION TEXT');
        const source = makeSelected(record, 'existing_summary', 'Previously summarized outcome.');
        const prompt = buildChroniclePrompt(makeParams({
            sources: [source]
        }));
        expect(prompt).toContain('Previously summarized outcome.');
        expect(prompt).not.toContain('VERY LONG RAW CONVERSATION TEXT');
    });

    test('uses frozen text for memory sources', () => {
        const frozenText = '乡绅李某曾于1066年在集市与人争执';
        const record = makeMemoryRecord('mem-frozen', frozenText);
        const source = makeSelected(record, 'raw');
        const prompt = buildChroniclePrompt(makeParams({
            sources: [source]
        }));
        expect(prompt).toContain(frozenText);
    });

    test('newer variant of frozen memory text does not appear', () => {
        const frozenText = '乡绅李某曾于1066年在集市与人争执';
        const record = makeMemoryRecord('mem-frozen', frozenText);
        const source = makeSelected(record, 'raw');
        const prompt = buildChroniclePrompt(makeParams({
            sources: [source]
        }));
        const newerVariant = '乡绅李某最近又与人争执';
        expect(prompt).not.toContain(newerVariant);
        expect(prompt).toContain(frozenText);
    });

    test('throws when memory source is not frozen (fail closed)', () => {
        const record = makeMemoryRecord('mem-unfrozen', 'some memory text', {
            memoryTextFrozen: false
        });
        const source = makeSelected(record, 'raw');
        expect(() => buildChroniclePrompt(makeParams({
            sources: [source]
        }))).toThrow();
    });

    test('throws when memory source has memoryTextFrozen undefined', () => {
        const record = makeMemoryRecord('mem-undef', 'some memory text');
        delete (record as any).memoryTextFrozen;
        const source = makeSelected(record, 'raw');
        expect(() => buildChroniclePrompt(makeParams({
            sources: [source]
        }))).toThrow();
    });

    test('includes private memory rule from default template', () => {
        const prompt = buildChroniclePrompt(makeParams());
        expect(prompt).toContain('私密记忆');
    });

    test('escapes pseudo-XML tags in source content', () => {
        const record = makeConversationRecord('conv-xml', 'Text with <script>alert(1)</script> & ampersand');
        const source = makeSelected(record, 'raw');
        const prompt = buildChroniclePrompt(makeParams({
            sources: [source]
        }));
        expect(prompt).toContain('&lt;script&gt;');
        expect(prompt).toContain('&amp; ampersand');
        expect(prompt).not.toContain('<script>alert(1)</script>');
    });

    test('includes letter sources as chronicle_source tags', () => {
        const record = makeLetterRecord('letter-1', '致友人书');
        const source = makeSelected(record, 'raw');
        const prompt = buildChroniclePrompt(makeParams({
            sources: [source]
        }));
        expect(prompt).toContain('kind="outgoing_letter"');
        expect(prompt).toContain('致友人书');
    });

    test('includes recent chronicles section when entries provided', () => {
        const prevContent = '这是上一期编年史的内容，作为风格参考。';
        const prompt = buildChroniclePrompt(makeParams({
            previousChronicleEntries: [
                {
                    periodStart: gameDate(1065, 1, 1, 388433),
                    periodEnd: gameDate(1065, 12, 31, 388797),
                    content: prevContent
                }
            ]
        }));
        expect(prompt).toContain(prevContent);
        expect(prompt).toContain('<recent_chronicles>');
        expect(prompt).toContain('〔1065.1.1 至 1065.12.31〕');
    });

    test('caps recent chronicles reference at 3000 chars', () => {
        const longContent = 'X'.repeat(3000);
        const prompt = buildChroniclePrompt(makeParams({
            previousChronicleEntries: [
                {
                    periodStart: gameDate(1065, 1, 1, 388433),
                    periodEnd: gameDate(1065, 12, 31, 388797),
                    content: longContent + 'Y'.repeat(500)
                }
            ]
        }));
        const xCount = (prompt.match(/X/g) || []).length;
        const yCount = (prompt.match(/Y/g) || []).length;
        expect(xCount).toBeLessThanOrEqual(3000);
        expect(yCount).toBe(0);
    });

    test('joins multiple recent chronicle entries by period descending', () => {
        const older = '上一期编年史内容。';
        const newest = '最近一期编年史内容。';
        const prompt = buildChroniclePrompt(makeParams({
            previousChronicleEntries: [
                {
                    periodStart: gameDate(1064, 1, 1, 388068),
                    periodEnd: gameDate(1064, 12, 31, 388432),
                    content: older
                },
                {
                    periodStart: gameDate(1065, 1, 1, 388433),
                    periodEnd: gameDate(1065, 12, 31, 388797),
                    content: newest
                }
            ]
        }));
        const olderIdx = prompt.indexOf(older);
        const newestIdx = prompt.indexOf(newest);
        expect(olderIdx).toBeGreaterThan(-1);
        expect(newestIdx).toBeGreaterThan(-1);
        expect(newestIdx).toBeLessThan(olderIdx);
    });

    test('does not include recent chronicles section when not provided', () => {
        const prompt = buildChroniclePrompt(makeParams());
        expect(prompt).not.toContain('recent_chronicles');
    });

    test('separates memory sources into character_memories section', () => {
        const convRecord = makeConversationRecord('conv-1', '对话内容');
        const memRecord = makeMemoryRecord('mem-1', '记忆内容');
        const prompt = buildChroniclePrompt(makeParams({
            sources: [
                makeSelected(convRecord, 'raw'),
                makeSelected(memRecord, 'raw')
            ]
        }));
        expect(prompt).toContain('<character_memories');
        expect(prompt).toContain('记忆内容');
        expect(prompt).toContain('对话内容');
        expect(prompt).toContain('<chronicle_source');
    });
});

describe('validateChronicleOutput', () => {
    test('accepts valid narrative content', () => {
        const content = '是年，国王于宫中召见群臣，议定边防之事。';
        const result = validateChronicleOutput(content, 10000);
        expect(result.valid).toBe(true);
    });

    test('rejects empty string', () => {
        const result = validateChronicleOutput('', 10000);
        expect(result.valid).toBe(false);
    });

    test('rejects whitespace-only string', () => {
        const result = validateChronicleOutput('   \n\n  \t  ', 10000);
        expect(result.valid).toBe(false);
    });

    test('rejects JSON error object', () => {
        const result = validateChronicleOutput(
            '{"error": {"message": "rate limit exceeded", "type": "rate_limit_error"}}',
            10000
        );
        expect(result.valid).toBe(false);
    });

    test('rejects oversized response', () => {
        const content = 'A'.repeat(20001);
        const result = validateChronicleOutput(content, 20000);
        expect(result.valid).toBe(false);
    });

    test('does not truncate to fake success', () => {
        const content = 'A'.repeat(20001);
        const result = validateChronicleOutput(content, 20000);
        expect(result.valid).toBe(false);
        expect(result.content).toBeUndefined();
    });
});

describe('generateChronicle', () => {
    function makeMockApi(response: string): ChronicleGeneratorApi {
        return {
            complete: jest.fn().mockResolvedValue(response)
        } as unknown as ChronicleGeneratorApi;
    }

    function makeGenConfig(overrides: Partial<ChronicleGeneratorConfig> = {}): ChronicleGeneratorConfig {
        return {
            chroniclePrompt: DEFAULT_CHRONICLE_PROMPT,
            chronicleOutputMaxTokens: 2048,
            summarizationParameters: { enableTemperature: true, temperature: 0.3, enableFrequencyPenalty: true, frequency_penalty: 0, enablePresencePenalty: true, presence_penalty: 0, enableTopP: true, top_p: 1 } as any,
            ...overrides
        };
    }

    test('calls complete with stream=false and max_tokens', async () => {
        const api = makeMockApi('是年，国王召见群臣。');
        const record = makeConversationRecord('conv-1', '对话内容');
        const sources = [makeSelected(record, 'raw')];

        await generateChronicle({
            sources,
            generatorConfig: makeGenConfig(),
            api,
            requestKey: 'req-001',
            playerName: '测试国王',
            periodStart: gameDate(1066, 1, 1, 388798),
            periodEnd: gameDate(1066, 12, 31, 389158)
        });

        const mock = api.complete as jest.Mock;
        expect(mock).toHaveBeenCalledTimes(1);
        const [, stream, otherArgs] = mock.mock.calls[0];
        expect(stream).toBe(false);
        expect(otherArgs).toHaveProperty('max_tokens');
        expect(otherArgs.max_tokens).toBe(2048);
    });

    test('uses temperature from summarization parameters', async () => {
        const api = makeMockApi('是年，国王召见群臣。');
        const record = makeConversationRecord('conv-1', '对话内容');
        const sources = [makeSelected(record, 'raw')];

        await generateChronicle({
            sources,
            generatorConfig: makeGenConfig({
                summarizationParameters: { temperature: 0.7, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
            }),
            api,
            requestKey: 'req-002',
            playerName: '测试国王',
            periodStart: gameDate(1066, 1, 1, 388798),
            periodEnd: gameDate(1066, 12, 31, 389158)
        });

        const mock = api.complete as jest.Mock;
        const otherArgs = mock.mock.calls[0][2];
        expect(otherArgs.temperature).toBe(0.7);
    });

    test('returns validated content on success', async () => {
        const content = '是年春，国王于大殿召集群臣，商议国事。群臣皆至，共议边防之策。';
        const api = makeMockApi(content);
        const record = makeConversationRecord('conv-1', '对话内容');
        const sources = [makeSelected(record, 'raw')];

        const result = await generateChronicle({
            sources,
            generatorConfig: makeGenConfig(),
            api,
            requestKey: 'req-003',
            playerName: '测试国王',
            periodStart: gameDate(1066, 1, 1, 388798),
            periodEnd: gameDate(1066, 12, 31, 389158)
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.content).toBe(content);
        }
    });

    test('fails on empty response', async () => {
        const api = makeMockApi('');
        const record = makeConversationRecord('conv-1', '对话内容');
        const sources = [makeSelected(record, 'raw')];

        const result = await generateChronicle({
            sources,
            generatorConfig: makeGenConfig(),
            api,
            requestKey: 'req-004',
            playerName: '测试国王',
            periodStart: gameDate(1066, 1, 1, 388798),
            periodEnd: gameDate(1066, 12, 31, 389158)
        });

        expect(result.ok).toBe(false);
    });

    test('fails on JSON error response', async () => {
        const api = makeMockApi('{"error":{"message":"rate limit"}}');
        const record = makeConversationRecord('conv-1', '对话内容');
        const sources = [makeSelected(record, 'raw')];

        const result = await generateChronicle({
            sources,
            generatorConfig: makeGenConfig(),
            api,
            requestKey: 'req-005',
            playerName: '测试国王',
            periodStart: gameDate(1066, 1, 1, 388798),
            periodEnd: gameDate(1066, 12, 31, 389158)
        });

        expect(result.ok).toBe(false);
    });

    test('does not log full prompt to console', async () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

        const api = makeMockApi('是年，国王召见群臣。');
        const record = makeConversationRecord('conv-1', 'SECRET对话内容不应对外泄露');
        const sources = [makeSelected(record, 'raw')];

        await generateChronicle({
            sources,
            generatorConfig: makeGenConfig(),
            api,
            requestKey: 'req-006',
            playerName: '测试国王',
            periodStart: gameDate(1066, 1, 1, 388798),
            periodEnd: gameDate(1066, 12, 31, 389158)
        });

        const allCalls = [
            ...debugSpy.mock.calls,
            ...logSpy.mock.calls,
            ...infoSpy.mock.calls
        ];
        for (const call of allCalls) {
            const arg = String(call[0] ?? '');
            expect(arg).not.toContain('SECRET对话内容不应对外泄露');
        }

        debugSpy.mockRestore();
        logSpy.mockRestore();
        infoSpy.mockRestore();
    });

    test('logs safe metadata without prompt content', async () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        const api = makeMockApi('是年，国王召见群臣。');
        const record = makeConversationRecord('conv-1', '对话内容');
        const sources = [makeSelected(record, 'raw')];

        await generateChronicle({
            sources,
            generatorConfig: makeGenConfig(),
            api,
            requestKey: 'req-safe-001',
            playerName: '测试国王',
            periodStart: gameDate(1066, 1, 1, 388798),
            periodEnd: gameDate(1066, 12, 31, 389158)
        });

        const allOutput = debugSpy.mock.calls.map(c => String(c[0] ?? '')).join('\n');
        expect(allOutput).toContain('req-safe-001');
        expect(allOutput).toMatch(/source/i);

        debugSpy.mockRestore();
    });

    test('sanitizes error message when api.complete rejects with API key and URL', async () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        const api = makeMockApi('');
        (api.complete as jest.Mock).mockRejectedValueOnce(
            new Error('request to https://api.example.com/v1/chat failed\nkey=sk-ant-1234567890abcdef1234567890abcdef bearer Bearer abcdefghijklmnopqrstuvwxyz123456')
        );
        const record = makeConversationRecord('conv-1', '对话内容');
        const sources = [makeSelected(record, 'raw')];

        const result = await generateChronicle({
            sources,
            generatorConfig: makeGenConfig(),
            api,
            requestKey: 'req-throw-001',
            playerName: '测试国王',
            periodStart: gameDate(1066, 1, 1, 388798),
            periodEnd: gameDate(1066, 12, 31, 389158)
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errorCode).toBe('api_request_failed');
            expect(result.errorMessage).toBe('chronicle generator: API request failed');
            expect(result.errorMessage).not.toContain('sk-ant-1234567890abcdef1234567890abcdef');
            expect(result.errorMessage).not.toContain('Bearer abcdefghijklmnopqrstuvwxyz123456');
            expect(result.errorMessage).not.toContain('https://api.example.com');
            expect(result.errorMessage).not.toContain('\n');
        }
        const debugOutput = debugSpy.mock.calls.flat().join('\n');
        expect(debugOutput).not.toContain('sk-ant-1234567890abcdef1234567890abcdef');
        expect(debugOutput).not.toContain('Bearer abcdefghijklmnopqrstuvwxyz123456');
        expect(debugOutput).not.toContain('https://api.example.com');
        debugSpy.mockRestore();
    });

    test('truncates very long error messages', async () => {
        const api = makeMockApi('');
        const longMsg = 'x'.repeat(2000);
        (api.complete as jest.Mock).mockRejectedValueOnce(new Error(longMsg));
        const record = makeConversationRecord('conv-1', '对话内容');
        const sources = [makeSelected(record, 'raw')];

        const result = await generateChronicle({
            sources,
            generatorConfig: makeGenConfig(),
            api,
            requestKey: 'req-throw-002',
            playerName: '测试国王',
            periodStart: gameDate(1066, 1, 1, 388798),
            periodEnd: gameDate(1066, 12, 31, 389158)
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errorMessage.length).toBeLessThanOrEqual(600);
        }
    });
});

describe('createChronicleSummarizationConnection', () => {
    test('uses text-gen connection when summarizationUseTextGenApi is true', () => {
        const config: ChronicleGeneratorConfig = {
            chroniclePrompt: DEFAULT_CHRONICLE_PROMPT,
            chronicleOutputMaxTokens: 2048,
            summarizationUseTextGenApi: true,
            summarizationParameters: { enableTemperature: true, temperature: 0.3, enableFrequencyPenalty: true, frequency_penalty: 0, enablePresencePenalty: true, presence_penalty: 0, enableTopP: true, top_p: 1 } as any,
            textGenerationApiConnectionConfig: {
                connection: {
                    type: 'openai',
                    baseUrl: 'https://textgen.example.com',
                    key: 'textgen-key',
                    model: 'textgen-model',
                    forceInstruct: false,
                    overwriteContext: false,
                    customContext: 8000,
                },
                parameters: { temperature: 0.5, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
            },
            summarizationApiConnectionConfig: {
                connection: {
                    type: 'openai',
                    baseUrl: 'https://summ.example.com',
                    key: 'summ-key',
                    model: 'summ-model',
                    forceInstruct: false,
                    overwriteContext: false,
                    customContext: 4000,
                },
                parameters: { enableTemperature: true, temperature: 0.3, enableFrequencyPenalty: true, frequency_penalty: 0, enablePresencePenalty: true, presence_penalty: 0, enableTopP: true, top_p: 1 } as any,
            }
        };

        const conn = createChronicleSummarizationConnection(config);
        expect(conn.model).toBe('textgen-model');
        expect(conn.parameters.temperature).toBe(0.3);
    });

    test('uses dedicated summarization connection when summarizationUseTextGenApi is false', () => {
        const config: ChronicleGeneratorConfig = {
            chroniclePrompt: DEFAULT_CHRONICLE_PROMPT,
            chronicleOutputMaxTokens: 2048,
            summarizationUseTextGenApi: false,
            summarizationParameters: { enableTemperature: true, temperature: 0.3, enableFrequencyPenalty: true, frequency_penalty: 0, enablePresencePenalty: true, presence_penalty: 0, enableTopP: true, top_p: 1 } as any,
            textGenerationApiConnectionConfig: {
                connection: {
                    type: 'openai',
                    baseUrl: 'https://textgen.example.com',
                    key: 'textgen-key',
                    model: 'textgen-model',
                    forceInstruct: false,
                    overwriteContext: false,
                    customContext: 8000,
                },
                parameters: { temperature: 0.5, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
            },
            summarizationApiConnectionConfig: {
                connection: {
                    type: 'openai',
                    baseUrl: 'https://summ.example.com',
                    key: 'summ-key',
                    model: 'summ-model',
                    forceInstruct: false,
                    overwriteContext: false,
                    customContext: 4000,
                },
                parameters: { enableTemperature: true, temperature: 0.3, enableFrequencyPenalty: true, frequency_penalty: 0, enablePresencePenalty: true, presence_penalty: 0, enableTopP: true, top_p: 1 } as any,
            }
        };

        const conn = createChronicleSummarizationConnection(config);
        expect(conn.model).toBe('summ-model');
    });
});
