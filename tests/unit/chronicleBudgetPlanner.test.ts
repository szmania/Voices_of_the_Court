jest.mock('electron', () => ({
    app: { getPath: jest.fn() }
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import {
    selectChronicleRepresentations,
    visibleCharCount,
    fits,
    loadOrGenerateDigest,
    DIGEST_PROMPT_VERSION,
    DIGEST_CHUNK_CHAR_SIZE,
    type ChroniclePlannerApi
} from '../../src/main/chronicle/ChronicleBudgetPlanner';
import { chronicleSourceDigestsPath } from '../../src/main/campaignDataPaths';
import type {
    ChronicleBudget,
    ChronicleSourceRecord,
    ChronicleDigestCacheFile
} from '../../src/main/chronicle/chronicleTypes';
import type { Ck3GameDate } from '../../src/shared/gameData/gameDate';

const IDENTITY = buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, 'player-1001');

function makeTmpUserData(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'votc-budget-planner-'));
}

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
        gameDate: gameDate(1066, 1, 1, 388798),
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
        gameDate: gameDate(1066, 1, 1, 388798),
        legacyUndated: false,
        title: `Letter ${id}`,
        participants: [{ id: '1001', name: 'Player' }],
        rawText,
        ...overrides
    };
}

function makeBudget(overrides: Partial<ChronicleBudget> = {}): ChronicleBudget {
    return {
        rawSourceCharLimit: 30000,
        contextSafetyRatio: 0.70,
        contextTokens: 8192,
        outputMaxTokens: 1024,
        ...overrides
    };
}

interface FakeApiOptions {
    tokenRatio?: number;
    context?: number;
    digestFn?: (rawText: string) => string;
    throwOnDigest?: boolean;
}

function makeFakeApi(options: FakeApiOptions = {}): ChroniclePlannerApi {
    const tokenRatio = options.tokenRatio ?? 4;
    const context = options.context ?? 8192;
    const digestFn =
        options.digestFn ??
        ((rawText: string) => `[digest of ${rawText.slice(0, 20)}...]`);

    const api: ChroniclePlannerApi = {
        context,
        calculateTokensFromText(text: string): number {
            return Math.ceil(text.length / tokenRatio);
        },
        isChat(): boolean {
            return true;
        },
        async complete(
            prompt: string | Array<{ role: string; content: string }>,
            _stream: boolean,
            _otherArgs: object
        ): Promise<string> {
            if (options.throwOnDigest) {
                throw new Error('fake digest failure');
            }
            let rawText: string;
            if (typeof prompt === 'string') {
                const match = prompt.match(/---\n([\s\S]*)$/);
                rawText = match ? match[1] : prompt;
            } else {
                const userMsg = prompt.find(m => m.role === 'user');
                rawText = userMsg ? userMsg.content : prompt.map(m => m.content).join('\n');
            }
            return digestFn(rawText);
        }
    };
    return api;
}

describe('ChronicleBudgetPlanner - visibleCharCount', () => {
    it('counts Unicode characters (not UTF-16 code units)', () => {
        expect(visibleCharCount('hello')).toBe(5);
        expect(visibleCharCount('你好世界')).toBe(4);
        expect(visibleCharCount('a😀b')).toBe(3);
    });

    it('trims whitespace and normalizes newlines', () => {
        expect(visibleCharCount('  hello  ')).toBe(5);
        expect(visibleCharCount('hello\r\nworld')).toBe(11);
        expect(visibleCharCount('hello\rworld')).toBe(11);
    });
});

describe('ChronicleBudgetPlanner - fits', () => {
    it('returns true when under both char and token limits', () => {
        const api = makeFakeApi({ context: 8192 });
        const budget = makeBudget({ rawSourceCharLimit: 1000, contextTokens: 8192 });
        const records = [makeConversationRecord('c1', 'hello world')];
        const selected = records.map(r => ({
            record: r,
            mode: 'raw' as const,
            text: r.rawText,
            manifestItem: {
                sourceId: r.id,
                kind: r.kind,
                title: r.title,
                representation: 'raw' as const,
                rawCharCount: visibleCharCount(r.rawText),
                selectedCharCount: visibleCharCount(r.rawText),
                rawHash: '',
                selectedTextHash: ''
            }
        }));
        expect(fits(selected, budget, api, '')).toBe(true);
    });

    it('returns false when char limit exceeded', () => {
        const api = makeFakeApi({ context: 100000 });
        const budget = makeBudget({ rawSourceCharLimit: 5, contextTokens: 100000 });
        const records = [makeConversationRecord('c1', 'hello world this is long')];
        const selected = records.map(r => ({
            record: r,
            mode: 'raw' as const,
            text: r.rawText,
            manifestItem: {
                sourceId: r.id,
                kind: r.kind,
                title: r.title,
                representation: 'raw' as const,
                rawCharCount: visibleCharCount(r.rawText),
                selectedCharCount: visibleCharCount(r.rawText),
                rawHash: '',
                selectedTextHash: ''
            }
        }));
        expect(fits(selected, budget, api, '')).toBe(false);
    });

    it('returns false when token limit exceeded but char limit not', () => {
        const api = makeFakeApi({ tokenRatio: 1, context: 100 });
        const budget = makeBudget({
            rawSourceCharLimit: 100000,
            contextTokens: 100
        });
        const longText = 'x'.repeat(80);
        const records = [makeConversationRecord('c1', longText)];
        const selected = records.map(r => ({
            record: r,
            mode: 'raw' as const,
            text: r.rawText,
            manifestItem: {
                sourceId: r.id,
                kind: r.kind,
                title: r.title,
                representation: 'raw' as const,
                rawCharCount: visibleCharCount(r.rawText),
                selectedCharCount: visibleCharCount(r.rawText),
                rawHash: '',
                selectedTextHash: ''
            }
        }));
        expect(fits(selected, budget, api, '')).toBe(false);
    });

    it('subtracts outputMaxTokens from the token budget', () => {
        const api = makeFakeApi({ tokenRatio: 1, context: 1000 });
        const text = 'x'.repeat(650);
        const records = [makeConversationRecord('c1', text)];
        const selected = records.map(r => ({
            record: r,
            mode: 'raw' as const,
            text: r.rawText,
            manifestItem: {
                sourceId: r.id,
                kind: r.kind,
                title: r.title,
                representation: 'raw' as const,
                rawCharCount: visibleCharCount(r.rawText),
                selectedCharCount: visibleCharCount(r.rawText),
                rawHash: '',
                selectedTextHash: ''
            }
        }));
        const baseBudget = makeBudget({
            rawSourceCharLimit: 100000,
            contextTokens: 1000,
            outputMaxTokens: 0
        });
        expect(fits(selected, baseBudget, api, '')).toBe(true);

        const budgetWithOutput = makeBudget({
            rawSourceCharLimit: 100000,
            contextTokens: 1000,
            outputMaxTokens: 100
        });
        expect(fits(selected, budgetWithOutput, api, '')).toBe(false);
    });
});

describe('ChronicleBudgetPlanner - Step 7 test scenarios', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
    });

    it('1. 30,000 chars or fewer: all conversation raw', async () => {
        const records = [
            makeConversationRecord('c1', 'A'.repeat(10000)),
            makeConversationRecord('c2', 'B'.repeat(10000)),
            makeConversationRecord('c3', 'C'.repeat(5000))
        ];
        const api = makeFakeApi({ context: 1000000 });
        const budget = makeBudget({
            rawSourceCharLimit: 30000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        expect(result.length).toBe(3);
        expect(result.every(s => s.mode === 'raw')).toBe(true);
        expect(result.map(s => s.record.id)).toEqual(['c1', 'c2', 'c3']);
    });

    it('2. over limit: only replaces necessary longest items', async () => {
        const records = [
            makeConversationRecord('short', 'short text'),
            makeConversationRecord('long1', 'L'.repeat(20000)),
            makeConversationRecord('long2', 'M'.repeat(20000))
        ];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => `[digest:${raw.slice(0, 10)}]`
        });
        const budget = makeBudget({
            rawSourceCharLimit: 25000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        expect(result.length).toBe(3);
        const shortItem = result.find(s => s.record.id === 'short');
        expect(shortItem!.mode).toBe('raw');

        const long1 = result.find(s => s.record.id === 'long1');
        const long2 = result.find(s => s.record.id === 'long2');
        const degraded = [long1, long2].filter(s => s!.mode !== 'raw');
        expect(degraded.length).toBeGreaterThanOrEqual(1);
        expect(degraded.every(s => s!.mode === 'generated_digest')).toBe(true);
    });

    it('3. token over limit but char not over limit', async () => {
        const records = [
            makeConversationRecord('c1', 'x'.repeat(1000)),
            makeConversationRecord('c2', 'y'.repeat(1000))
        ];
        const api = makeFakeApi({
            tokenRatio: 1,
            context: 100
        });
        const budget = makeBudget({
            rawSourceCharLimit: 100000,
            contextTokens: 120,
            outputMaxTokens: 0
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        expect(result.length).toBe(2);
        const digests = result.filter(s => s.mode === 'generated_digest' || s.mode === 'chunk_digest');
        expect(digests.length).toBeGreaterThan(0);
    });

    it('4. memory not compressed before all conversations summarized', async () => {
        const records = [
            makeConversationRecord('conv1', 'C'.repeat(20000)),
            makeMemoryRecord('mem1', 'M'.repeat(100))
        ];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => `[D:${raw.slice(0, 5)}]`
        });
        const budget = makeBudget({
            rawSourceCharLimit: 20000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const conv = result.find(s => s.record.id === 'conv1');
        const mem = result.find(s => s.record.id === 'mem1');
        expect(conv!.mode).toBe('generated_digest');
        expect(mem!.mode).toBe('raw');
    });

    it('5. frozen memory latest dynamic text does not enter digest', async () => {
        const records = [
            makeConversationRecord('conv1', 'C'.repeat(20000)),
            makeMemoryRecord('mem1', 'frozen description text', {
                memoryTextFrozen: true
            })
        ];
        let digestInputRaw = '';
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => {
                digestInputRaw = raw;
                return `[D:${raw.slice(0, 5)}]`;
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 20000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const mem = result.find(s => s.record.id === 'mem1');
        expect(mem!.mode).toBe('raw');
        expect(mem!.text).toBe('frozen description text');

        const conv = result.find(s => s.record.id === 'conv1');
        expect(conv!.mode).toBe('generated_digest');
        expect(digestInputRaw).toContain('C'.repeat(5));
        expect(digestInputRaw).not.toContain('frozen description');
    });

    it('6. single oversized source + digest failure = entire attempt fails', async () => {
        const hugeText = 'Z'.repeat(10000);
        const records = [
            makeConversationRecord('huge', hugeText)
        ];
        const api = makeFakeApi({
            tokenRatio: 1,
            context: 100,
            throwOnDigest: true
        });
        const budget = makeBudget({
            rawSourceCharLimit: 5,
            contextTokens: 100
        });

        await expect(
            selectChronicleRepresentations(
                records,
                budget,
                api,
                { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
            )
        ).rejects.toThrow();
    });

    it('8. non-oversized digest failure surfaces degradationFailed and continues', async () => {
        const failText = 'F'.repeat(50);
        const okText = 'O'.repeat(50);
        const records = [
            makeConversationRecord('small_fail', failText),
            makeConversationRecord('small_ok', okText)
        ];
        const api = makeFakeApi({
            tokenRatio: 4,
            context: 8192,
            digestFn: (raw) => {
                if (raw.includes('F'.repeat(5))) {
                    throw new Error('simulated digest failure');
                }
                return '[D:ok]';
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 60,
            contextTokens: 8192
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const failedItem = result.find(s => s.record.id === 'small_fail');
        expect(failedItem).toBeDefined();
        expect(failedItem!.mode).toBe('raw');
        expect(failedItem!.degradationFailed).toBe(true);
        expect(failedItem!.degradationError).toContain('simulated digest failure');
        expect(failedItem!.manifestItem.degradationFailed).toBe(true);
        expect(failedItem!.manifestItem.degradationError).toContain('simulated digest failure');
    });

    it('rejects when aggregate input remains over token budget after multiple digest failures', async () => {
        const records = [
            makeConversationRecord('small_fail_1', 'F'.repeat(45)),
            makeConversationRecord('small_fail_2', 'G'.repeat(45))
        ];
        const api = makeFakeApi({
            tokenRatio: 1,
            context: 100,
            throwOnDigest: true
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 100,
            outputMaxTokens: 0
        });

        await expect(
            selectChronicleRepresentations(
                records,
                budget,
                api,
                { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
            )
        ).rejects.toThrow('selected sources remain over budget');
    });

    it('7. same input produces stable selection result', async () => {
        const records = [
            makeConversationRecord('c1', 'A'.repeat(20000)),
            makeConversationRecord('c2', 'B'.repeat(20000)),
            makeConversationRecord('c3', 'C'.repeat(500))
        ];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => `[D:${raw.slice(0, 5)}]`
        });
        const budget = makeBudget({
            rawSourceCharLimit: 21000,
            contextTokens: 1000000
        });

        const result1 = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );
        const result2 = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const modes1 = result1.map(s => ({ id: s.record.id, mode: s.mode }));
        const modes2 = result2.map(s => ({ id: s.record.id, mode: s.mode }));
        expect(modes1).toEqual(modes2);

        const texts1 = result1.map(s => s.text);
        const texts2 = result2.map(s => s.text);
        expect(texts1).toEqual(texts2);
    });
});

describe('ChronicleBudgetPlanner - degradation order', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
    });

    it('replaces conversations by raw length desc, then date asc', async () => {
        const early = gameDate(1066, 1, 1, 388798);
        const late = gameDate(1066, 6, 1, 388980);
        const records = [
            makeConversationRecord('short_early', 'S', { gameDate: early }),
            makeConversationRecord('long_late', 'L'.repeat(20000), { gameDate: late }),
            makeConversationRecord('long_early', 'L'.repeat(20000), { gameDate: early })
        ];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => `[D:${raw.slice(0, 3)}]`
        });
        const budget = makeBudget({
            rawSourceCharLimit: 21000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const shortEarly = result.find(s => s.record.id === 'short_early');
        expect(shortEarly!.mode).toBe('raw');
    });

    it('uses existing_summary before generating digest', async () => {
        const records = [
            makeConversationRecord('c1', 'A'.repeat(20000), {
                existingSummary: 'pre-existing summary'
            })
        ];
        let digestCalled = false;
        const api = makeFakeApi({
            context: 1000000,
            digestFn: () => {
                digestCalled = true;
                return 'generated';
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const item = result.find(s => s.record.id === 'c1');
        expect(item!.mode).toBe('existing_summary');
        expect(item!.text).toBe('pre-existing summary');
        expect(digestCalled).toBe(false);
    });

    it('processes memories by owner then date', async () => {
        const records = [
            makeMemoryRecord('mem_a_early', 'A'.repeat(15000), {
                memoryOwnerId: 'ownerA',
                gameDate: gameDate(1066, 1, 1, 388798)
            }),
            makeMemoryRecord('mem_b_late', 'B'.repeat(15000), {
                memoryOwnerId: 'ownerB',
                gameDate: gameDate(1066, 6, 1, 388980)
            })
        ];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => `[D:${raw.slice(0, 3)}]`
        });
        const budget = makeBudget({
            rawSourceCharLimit: 16000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const ownerA = result.find(s => s.record.id === 'mem_a_early');
        const ownerB = result.find(s => s.record.id === 'mem_b_late');
        expect(ownerA!.mode).toBe('generated_digest');
        expect(ownerB!.mode).toBe('raw');
    });

    it('letters and battles come after memories', async () => {
        const records = [
            makeMemoryRecord('mem1', 'M'.repeat(15000)),
            makeLetterRecord('letter1', 'L'.repeat(15000))
        ];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => `[D:${raw.slice(0, 3)}]`
        });
        const budget = makeBudget({
            rawSourceCharLimit: 16000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const mem = result.find(s => s.record.id === 'mem1');
        const letter = result.find(s => s.record.id === 'letter1');
        expect(mem!.mode).toBe('generated_digest');
        expect(letter!.mode).toBe('raw');
    });

    it('does not delete any source ID (all sources appear in result)', async () => {
        const records = [
            makeConversationRecord('c1', 'A'.repeat(20000)),
            makeMemoryRecord('m1', 'M'.repeat(200)),
            makeLetterRecord('l1', 'L'.repeat(200)),
            makeConversationRecord('c2', 'B'.repeat(200))
        ];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => `[D:${raw.slice(0, 3)}]`
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const resultIds = result.map(s => s.record.id).sort();
        const inputIds = records.map(r => r.id).sort();
        expect(resultIds).toEqual(inputIds);
    });
});

describe('ChronicleBudgetPlanner - digest cache', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
    });

    it('writes generated digests to cache file', async () => {
        const records = [
            makeConversationRecord('c1', 'A'.repeat(20000), {
                existingSummary: undefined
            })
        ];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => `[D:${raw.slice(0, 5)}]`
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });

        await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test-model' }
        );

        const cachePath = chronicleSourceDigestsPath(userData, IDENTITY);
        expect(fs.existsSync(cachePath)).toBe(true);
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as ChronicleDigestCacheFile;
        expect(Object.keys(cache.entries).length).toBeGreaterThan(0);

        const entry = Object.values(cache.entries)[0];
        expect(entry.modelCategory).toBe('test-model');
        expect(entry.digestPromptVersion).toBe(DIGEST_PROMPT_VERSION);
        expect(entry.sourceKind).toBe('conversation');
        expect(entry.digestText).toContain('[D:');
    });

    it('reuses cached digest on second call (no new API call)', async () => {
        const records = [makeConversationRecord('c1', 'A'.repeat(20000))];
        let callCount = 0;
        const api = makeFakeApi({
            context: 1000000,
            digestFn: () => {
                callCount++;
                return `[digest call ${callCount}]`;
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });
        const opts = {
            userDataDir: userData,
            identity: IDENTITY,
            modelCategory: 'test'
        };

        await selectChronicleRepresentations(records, budget, api, opts);
        const firstCount = callCount;
        await selectChronicleRepresentations(records, budget, api, opts);
        expect(callCount).toBe(firstCount);
    });

    it('cache key includes model category (different category = new digest)', async () => {
        const records = [makeConversationRecord('c1', 'A'.repeat(20000))];
        let callCount = 0;
        const api = makeFakeApi({
            context: 1000000,
            digestFn: () => {
                callCount++;
                return `[digest ${callCount}]`;
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });

        await selectChronicleRepresentations(records, budget, api, {
            userDataDir: userData, identity: IDENTITY, modelCategory: 'cat-a'
        });
        await selectChronicleRepresentations(records, budget, api, {
            userDataDir: userData, identity: IDENTITY, modelCategory: 'cat-b'
        });
        expect(callCount).toBe(2);
    });

    it('cache key includes digest prompt version', async () => {
        const records = [makeConversationRecord('c1', 'A'.repeat(20000))];
        let callCount = 0;
        const api = makeFakeApi({
            context: 1000000,
            digestFn: () => {
                callCount++;
                return `[digest ${callCount}]`;
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });
        const baseOpts = {
            userDataDir: userData,
            identity: IDENTITY,
            modelCategory: 'test'
        };

        await selectChronicleRepresentations(records, budget, api, {
            ...baseOpts,
            digestPromptVersion: 1
        });
        await selectChronicleRepresentations(records, budget, api, {
            ...baseOpts,
            digestPromptVersion: 2
        });
        expect(callCount).toBe(2);
    });

    it('cache key includes source kind', async () => {
        const sameRawText = 'X'.repeat(20000);
        const records = [
            makeConversationRecord('c1', sameRawText),
            makeMemoryRecord('m1', sameRawText)
        ];
        let callCount = 0;
        const api = makeFakeApi({
            context: 1000000,
            digestFn: () => {
                callCount++;
                return `[digest ${callCount}]`;
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });

        await selectChronicleRepresentations(records, budget, api, {
            userDataDir: userData, identity: IDENTITY, modelCategory: 'test'
        });
        expect(callCount).toBe(2);
    });

    it('does not use file mtime (same content = cache hit regardless of time)', async () => {
        const records = [makeConversationRecord('c1', 'A'.repeat(20000))];
        let callCount = 0;
        const api = makeFakeApi({
            context: 1000000,
            digestFn: () => {
                callCount++;
                return `[digest ${callCount}]`;
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });
        const opts = {
            userDataDir: userData,
            identity: IDENTITY,
            modelCategory: 'test'
        };

        await selectChronicleRepresentations(records, budget, api, opts);
        await new Promise(resolve => setTimeout(resolve, 50));
        await selectChronicleRepresentations(records, budget, api, opts);
        expect(callCount).toBe(1);
    });
});

describe('ChronicleBudgetPlanner - chunk digest', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
    });

    it('uses chunk_digest for oversized single source', async () => {
        const hugeRaw = 'Z'.repeat(DIGEST_CHUNK_CHAR_SIZE * 3 + 100);
        const records = [makeConversationRecord('huge', hugeRaw)];
        let callCount = 0;
        const api = makeFakeApi({
            tokenRatio: 1,
            context: 10000,
            digestFn: () => {
                callCount++;
                return `chunk-digest-${callCount}`;
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const item = result.find(s => s.record.id === 'huge');
        expect(item!.mode).toBe('chunk_digest');
        expect(callCount).toBeGreaterThan(1);
        expect(item!.text).toContain('chunk-digest-');
    });

    it('chunk digest does not cross source boundary', async () => {
        const hugeRaw1 = 'A'.repeat(DIGEST_CHUNK_CHAR_SIZE * 2);
        const hugeRaw2 = 'B'.repeat(DIGEST_CHUNK_CHAR_SIZE * 2);
        const records = [
            makeConversationRecord('huge1', hugeRaw1),
            makeConversationRecord('huge2', hugeRaw2)
        ];
        const seenTexts: string[] = [];
        const api = makeFakeApi({
            tokenRatio: 1,
            context: 10000,
            digestFn: (raw) => {
                seenTexts.push(raw);
                return `[D:${raw.slice(0, 1)}]`;
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 1000,
            contextTokens: 1000000
        });

        await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        for (const text of seenTexts) {
            const firstChar = text.slice(0, 1);
            expect(['A', 'B']).toContain(firstChar);
            const uniqueChars = new Set(text.split(''));
            expect(uniqueChars.size).toBe(1);
        }
    });
});

describe('ChronicleBudgetPlanner - manifest', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
    });

    it('generates manifest items with correct hashes and counts', async () => {
        const records = [
            makeConversationRecord('c1', 'hello world'),
            makeMemoryRecord('m1', 'frozen text')
        ];
        const api = makeFakeApi({ context: 1000000 });
        const budget = makeBudget({
            rawSourceCharLimit: 100000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        for (const item of result) {
            expect(item.manifestItem.sourceId).toBe(item.record.id);
            expect(item.manifestItem.kind).toBe(item.record.kind);
            expect(item.manifestItem.title).toBe(item.record.title);
            expect(item.manifestItem.content).toBe(item.record.rawText);
            expect(item.manifestItem.representation).toBe(item.mode);
            expect(item.manifestItem.rawCharCount).toBe(
                visibleCharCount(item.record.rawText)
            );
            expect(item.manifestItem.selectedCharCount).toBe(
                visibleCharCount(item.text)
            );
            expect(item.manifestItem.rawHash).toMatch(/^[a-f0-9]{64}$/);
            expect(item.manifestItem.selectedTextHash).toMatch(/^[a-f0-9]{64}$/);
        }
    });

    it('preserves checkpoint and timeline node in manifest', async () => {
        const records = [
            makeConversationRecord('c1', 'hello', {
                votcCheckpointEpoch: 42,
                votcTimelineNodeId: '5-3'
            })
        ];
        const api = makeFakeApi({ context: 1000000 });
        const budget = makeBudget({
            rawSourceCharLimit: 100000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const item = result[0];
        expect(item.manifestItem.votcCheckpointEpoch).toBe(42);
        expect(item.manifestItem.votcTimelineNodeId).toBe('5-3');
    });
});

describe('ChronicleBudgetPlanner - loadOrGenerateDigest', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
    });

    it('returns cached digest without API call when cache has matching entry', async () => {
        const record = makeConversationRecord('c1', 'A'.repeat(20000));
        let callCount = 0;
        const api = makeFakeApi({
            context: 1000000,
            digestFn: () => {
                callCount++;
                return `fresh digest ${callCount}`;
            }
        });
        const cache: ChronicleDigestCacheFile = {
            schemaVersion: 1,
            entries: {}
        };
        const opts = { modelCategory: 'test', digestPromptVersion: DIGEST_PROMPT_VERSION };

        const result1 = await loadOrGenerateDigest(record, api, cache, opts);
        expect(result1.mode).toBe('generated_digest');
        expect(callCount).toBe(1);

        const result2 = await loadOrGenerateDigest(record, api, cache, opts);
        expect(result2.text).toBe(result1.text);
        expect(callCount).toBe(1);
    });

    it('relevanceWeight does not delete low-weight memory from digest input', async () => {
        const lowWeightRecord = makeMemoryRecord('mem_low', 'low weight content', {
            relevanceWeight: 1
        });
        const highWeightRecord = makeMemoryRecord('mem_high', 'high weight content', {
            relevanceWeight: 100
        });
        const seenInputs: string[] = [];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => {
                seenInputs.push(raw);
                return `[D:${raw.slice(0, 5)}]`;
            }
        });
        const cache: ChronicleDigestCacheFile = {
            schemaVersion: 1,
            entries: {}
        };
        const opts = { modelCategory: 'test', digestPromptVersion: DIGEST_PROMPT_VERSION };

        await loadOrGenerateDigest(lowWeightRecord, api, cache, opts);
        await loadOrGenerateDigest(highWeightRecord, api, cache, opts);

        expect(seenInputs.some(t => t.includes('low weight content'))).toBe(true);
        expect(seenInputs.some(t => t.includes('high weight content'))).toBe(true);
    });
});

describe('ChronicleBudgetPlanner - same-length tie-breaking', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
    });

    it('same raw length: older conversation replaced first', async () => {
        const early = gameDate(1066, 1, 1, 388798);
        const late = gameDate(1066, 6, 1, 388980);
        const sameLength = 'L'.repeat(20000);
        const records = [
            makeConversationRecord('late_conv', sameLength, { gameDate: late }),
            makeConversationRecord('early_conv', sameLength, { gameDate: early })
        ];
        let digestInputs: string[] = [];
        const api = makeFakeApi({
            context: 1000000,
            digestFn: (raw) => {
                digestInputs.push(raw);
                return `[D]`;
            }
        });
        const budget = makeBudget({
            rawSourceCharLimit: 21000,
            contextTokens: 1000000
        });

        const result = await selectChronicleRepresentations(
            records,
            budget,
            api,
            { userDataDir: userData, identity: IDENTITY, modelCategory: 'test' }
        );

        const earlyItem = result.find(s => s.record.id === 'early_conv');
        const lateItem = result.find(s => s.record.id === 'late_conv');
        expect(earlyItem!.mode).toBe('generated_digest');
        expect(lateItem!.mode).toBe('raw');
    });
});
