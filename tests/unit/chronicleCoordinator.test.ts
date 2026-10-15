jest.mock('electron', () => ({
    app: { getPath: jest.fn() }
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import {
    ChronicleCoordinator,
    computeSourceDigest
} from '../../src/main/chronicle/ChronicleCoordinator';
import {
    resetChronicleHealthForTests,
    markChronicleUnhealthy
} from '../../src/main/chronicle/chronicleHealth';
import { ChronicleMemoryStore } from '../../src/main/chronicle/ChronicleMemoryStore';
import {
    conversationHistoryDir,
    chronicleEntriesPath
} from '../../src/main/campaignDataPaths';
import { buildConversationHistoryHeader } from '../../src/main/conversation/conversationHistoryHeader';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import type { Ck3GameDate } from '../../src/shared/gameData/gameDate';
import type { TimelineRegistry } from '../../src/main/timelineManager';
import type {
    ChronicleCoordinatorConfig,
    ChronicleSignal
} from '../../src/main/chronicle/chronicleTypes';
import type { ChronicleEntriesFile } from '../../src/main/chronicle/chronicleTypes';

const IDENTITY = buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, 'player-1001');

function makeTmpUserData(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'votc-coordinator-'));
}

function gameDate(year: number, month: number, day: number, totalDays: number): Ck3GameDate {
    return { totalDays, year, month, day, display: `${year}.${month}.${day}` };
}

const EARLIEST_SOURCE_DATE = gameDate(1066, 3, 1, 388858);
const QUARTER_END = gameDate(1066, 6, 1, 388980);
const YEAR_END = gameDate(1067, 1, 1, 389163);
const FAR_LATER = gameDate(1100, 1, 1, 401234);

function makeRegistryMock(currentNodeId?: string): {
    registry: TimelineRegistry;
    currentNodeId?: string;
    registerParentChild(parentId: string, childId: string): void;
} {
    const parents = new Map<string, string>();
    const registry = {
        isRecordVisible(recordNodeId: string | undefined, cur: string | undefined): boolean {
            if (!recordNodeId || !cur) return true;
            if (recordNodeId === cur) return true;
            let node: string | undefined = cur;
            const visited = new Set<string>();
            while (node && !visited.has(node)) {
                visited.add(node);
                const parent = parents.get(node);
                if (parent === recordNodeId) return true;
                node = parent;
            }
            return false;
        },
        isV2RecordVisibleFromObservedContext(): boolean {
            return false;
        }
    } as unknown as TimelineRegistry;
    const registerParentChild = (parentId: string, childId: string) => {
        parents.set(childId, parentId);
    };
    return { registry, currentNodeId, registerParentChild };
}

function writeConversationFile(
    userData: string,
    identity: typeof IDENTITY,
    params: {
        sourceRecordId: string;
        gameDate?: Ck3GameDate;
        displayDate: string;
        checkpointEpoch: number;
        timelineNodeId: string;
        timelineParentId?: string | null;
        body: string;
        timestamp?: number;
    }
): string {
    const dir = conversationHistoryDir(userData, identity);
    fs.mkdirSync(dir, { recursive: true });
    const header = buildConversationHistoryHeader({
        sourceRecordId: params.sourceRecordId,
        gameDate: params.gameDate,
        displayDate: params.displayDate,
        checkpointEpoch: params.checkpointEpoch,
        timeline: { nodeId: params.timelineNodeId, parentId: params.timelineParentId ?? null } as any,
        datePrefix: '日期'
    });
    const ts = params.timestamp ?? Date.now();
    const fileName = `1001_2002_tl_${params.timelineNodeId}_ckpt${params.checkpointEpoch}_${ts}.txt`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, header + params.body, 'utf8');
    return fileName;
}

function makeConfig(overrides: Partial<ChronicleCoordinatorConfig> = {}): ChronicleCoordinatorConfig {
    return {
        frequency: 'quarterly',
        rawSourceCharLimit: 30000,
        outputMaxTokens: 2048,
        chroniclePrompt: '你是宫廷史官，正在为{{playerName}}撰写{{periodStart}}至{{periodEnd}}的编年史。',
        summarizationUseTextGenApi: true,
        textGenerationApiConnectionConfig: {
            connection: {
                type: 'openai',
                baseUrl: 'https://textgen.example.com',
                key: 'textgen-key',
                model: 'textgen-model',
                forceInstruct: false,
                overwriteContext: true,
                customContext: 32000,
            },
            parameters: { temperature: 0.3, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
        },
        summarizationApiConnectionConfig: {
            connection: {
                type: 'openai',
                baseUrl: 'https://summ.example.com',
                key: 'summ-key',
                model: 'summ-model',
                forceInstruct: false,
                overwriteContext: true,
                customContext: 16000,
            },
            parameters: { temperature: 0.3, frequency_penalty: 0, presence_penalty: 0, top_p: 1 }
        },
        language: 'zh',
        ...overrides
    };
}

interface FakeApiOptions {
    chronicleResponse?: string;
    digestResponse?: string;
    throwOnChronicle?: boolean;
    throwOnDigest?: boolean;
    context?: number;
}

function makeFakeApiProvider(options: FakeApiOptions = {}) {
    const chronicleResponse = options.chronicleResponse ?? '是年春，王即位，群臣朝贺。';
    const digestResponse = options.digestResponse ?? '[digest]';
    const context = options.context ?? 32000;

    const chronicleApi = {
        complete: jest.fn(async () => {
            if (options.throwOnChronicle) throw new Error('fake chronicle failure');
            return chronicleResponse;
        })
    };
    const plannerApi = {
        context,
        calculateTokensFromText(text: string): number {
            return Math.ceil(text.length / 4);
        },
        isChat(): boolean {
            return true;
        },
        complete: jest.fn(async () => {
            if (options.throwOnDigest) throw new Error('fake digest failure');
            return digestResponse;
        })
    };
    return { chronicleApi, plannerApi };
}

function makeSignal(params: {
    kind: ChronicleSignal['kind'];
    gameDate: Ck3GameDate;
    timeline?: { registry?: TimelineRegistry; currentNodeId?: string; checkpointEpoch?: number };
}): ChronicleSignal {
    const mock = makeRegistryMock('1-1');
    const registry = params.timeline?.registry ?? mock.registry;
    const currentNodeId = params.timeline?.currentNodeId ?? mock.currentNodeId;
    const checkpointEpoch = params.timeline?.checkpointEpoch ?? 1;
    return {
        kind: params.kind,
        gameDate: params.gameDate,
        playerId: IDENTITY.playerId,
        playerName: '测试国王',
        playerTitle: '国王',
        identity: IDENTITY,
        timeline: { registry, currentNodeId, checkpointEpoch }
    };
}

function readEntriesFile(userData: string): ChronicleEntriesFile | undefined {
    const p = chronicleEntriesPath(userData, IDENTITY);
    if (!fs.existsSync(p)) return undefined;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('computeSourceDigest', () => {
    it('changes when equal-length source content changes', () => {
        const base = {
            id: 'source-1',
            kind: 'conversation' as const,
            legacyUndated: false,
            title: 'Conversation',
            participants: [],
            rawText: 'alpha'
        };
        expect(computeSourceDigest([base])).not.toBe(
            computeSourceDigest([{ ...base, rawText: 'bravo' }])
        );
    });
});

describe('ChronicleCoordinator - first backfill (Step 3)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('first backfill: no existing entries -> periodStart = day before earliest source, reason=backfill', async () => {
        const sourceDate = EARLIEST_SOURCE_DATE;
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: sourceDate,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });

        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData,
            () => makeConfig(),
            () => chronicleApi,
            () => plannerApi
        );

        const result = await coordinator.handleSignal(makeSignal({
            kind: 'manual',
            gameDate: QUARTER_END
        }));

        expect(result.outcome).toBe('generated');
        expect(result.reason).toBe('backfill');
        expect(result.periodStart).toBeDefined();
        expect(result.periodStart!.totalDays).toBe(sourceDate.totalDays - 1);
        expect(result.periodEnd).toEqual(QUARTER_END);
        expect(result.entryId).toBeDefined();
        expect(chronicleApi.complete).toHaveBeenCalledTimes(1);
    });
});

describe('ChronicleCoordinator - frequency filter (Step 2)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('quarterly signal with quarterly config generates', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig({ frequency: 'quarterly' }),
            () => chronicleApi, () => plannerApi
        );
        const result = await coordinator.handleSignal(makeSignal({
            kind: 'quarterly', gameDate: QUARTER_END
        }));
        expect(result.outcome).toBe('generated');
    });

    it('yearly signal with yearly config generates', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig({ frequency: 'yearly' }),
            () => chronicleApi, () => plannerApi
        );
        const result = await coordinator.handleSignal(makeSignal({
            kind: 'yearly', gameDate: YEAR_END
        }));
        expect(result.outcome).toBe('generated');
    });

    it('yearly signal under quarterly config is processed as compensation', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig({ frequency: 'quarterly' }),
            () => chronicleApi, () => plannerApi
        );

        const first = await coordinator.handleSignal(makeSignal({
            kind: 'quarterly', gameDate: QUARTER_END
        }));
        expect(first.outcome).toBe('generated');

        const result = await coordinator.handleSignal(makeSignal({
            kind: 'yearly', gameDate: YEAR_END
        }));
        expect(result.outcome).not.toBe('ignored_frequency');
        expect(result.reason).toBe('catch_up');
    });

    it('quarterly signal ignored when config is yearly', async () => {
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig({ frequency: 'yearly' }),
            () => chronicleApi, () => plannerApi
        );
        const result = await coordinator.handleSignal(makeSignal({
            kind: 'quarterly', gameDate: QUARTER_END
        }));
        expect(result.outcome).toBe('ignored_frequency');
        expect(chronicleApi.complete).not.toHaveBeenCalled();
    });

    it('disabled config ignores both quarterly and yearly signals', async () => {
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig({ frequency: 'disabled' }),
            () => chronicleApi, () => plannerApi
        );
        const r1 = await coordinator.handleSignal(makeSignal({ kind: 'quarterly', gameDate: QUARTER_END }));
        const r2 = await coordinator.handleSignal(makeSignal({ kind: 'yearly', gameDate: YEAR_END }));
        expect(r1.outcome).toBe('ignored_frequency');
        expect(r2.outcome).toBe('ignored_frequency');
    });

    it('manual signal always generates regardless of frequency config', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig({ frequency: 'disabled' }),
            () => chronicleApi, () => plannerApi
        );
        const result = await coordinator.handleSignal(makeSignal({
            kind: 'manual', gameDate: QUARTER_END
        }));
        expect(result.outcome).toBe('generated');
    });
});

describe('ChronicleCoordinator - catch-up (Step 3)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('catch-up: gap > 1 period -> reason=catch_up', async () => {
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig({ frequency: 'yearly' }),
            () => chronicleApi, () => plannerApi
        );

        const firstSignal = makeSignal({
            kind: 'yearly', gameDate: YEAR_END
        });
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: first\n'
        });
        await coordinator.handleSignal(firstSignal);

        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: FAR_LATER,
            displayDate: '1100.1.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: later\n'
        });

        const result = await coordinator.handleSignal(makeSignal({
            kind: 'yearly', gameDate: FAR_LATER
        }));

        expect(result.outcome).toBe('generated');
        expect(result.reason).toBe('catch_up');
    });
});

describe('ChronicleCoordinator - empty period (Step 5)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('empty period: no sources -> status=empty, no API call, coverage advances', async () => {
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig(),
            () => chronicleApi, () => plannerApi
        );

        const result = await coordinator.handleSignal(makeSignal({
            kind: 'quarterly', gameDate: QUARTER_END
        }));

        expect(result.outcome).toBe('empty');
        expect(result.entryId).toBeDefined();
        expect(chronicleApi.complete).not.toHaveBeenCalled();

        const file = readEntriesFile(userData);
        expect(file).toBeDefined();
        const entry = file!.entries.find(e => e.id === result.entryId);
        expect(entry).toBeDefined();
        expect(entry!.status).toBe('empty');
    });
});

describe('ChronicleCoordinator - idempotency (Step 4)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('duplicate pulse: same requestKey already running -> skipped_already_running', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });
        const { chronicleApi, plannerApi } = makeFakeApiProvider({
            chronicleResponse: '第一版编年史正文。'
        });
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig(),
            () => chronicleApi, () => plannerApi
        );

        const signal = makeSignal({ kind: 'quarterly', gameDate: QUARTER_END });
        const firstPromise = coordinator.handleSignal(signal);
        const secondResult = await coordinator.handleSignal(signal);
        await firstPromise;

        expect(secondResult.outcome).toBe('skipped_already_running');
    });

    it('committed + same digest: second pulse with same sources returns skipped_idempotent', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: second conversation\n',
            timestamp: 1700000000001
        });
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig({ frequency: 'yearly' }),
            () => chronicleApi, () => plannerApi
        );

        const signal = makeSignal({ kind: 'manual', gameDate: YEAR_END });
        const first = await coordinator.handleSignal(signal);
        expect(first.outcome).toBe('generated');

        const second = await coordinator.handleSignal(signal);
        expect(second.outcome).toBe('skipped_idempotent');
        expect(second.entryId).toBe(first.entryId);
    });
});

describe('ChronicleCoordinator - failed retry (Step 4)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('failed attempt can be retried and succeeds on second attempt', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });

        let callCount = 0;
        const chronicleApi = {
            complete: jest.fn(async () => {
                callCount++;
                if (callCount === 1) throw new Error('transient failure');
                return '重试后的正文。';
            })
        };
        const plannerApi = {
            context: 32000,
            calculateTokensFromText: (t: string) => Math.ceil(t.length / 4),
            isChat: () => true,
            complete: jest.fn(async () => '[digest]')
        };

        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig(),
            () => chronicleApi, () => plannerApi
        );

        const signal = makeSignal({ kind: 'quarterly', gameDate: QUARTER_END });
        const first = await coordinator.handleSignal(signal);
        expect(first.outcome).toBe('failed');

        const second = await coordinator.retryAttempt(signal, first.requestKey!);
        expect(second.outcome).toBe('generated');
        expect(second.entryId).toBeDefined();
    });
});

describe('ChronicleCoordinator - explicit regeneration', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('regenerates the same entry id and increments its revision', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig(),
            () => chronicleApi, () => plannerApi
        );
        const signal = makeSignal({ kind: 'manual', gameDate: QUARTER_END });
        const first = await coordinator.handleSignal(signal);
        expect(first.outcome).toBe('generated');

        chronicleApi.complete.mockResolvedValueOnce('修订后的正文。');
        const second = await coordinator.regenerateEntry(signal, first.entryId!);

        expect(second.outcome).toBe('generated');
        expect(second.entryId).toBe(first.entryId);
        const entry = readEntriesFile(userData)?.entries.find(item => item.id === first.entryId);
        expect(entry?.revision).toBe(1);
        expect(entry?.content).toBe('修订后的正文。');
        const calls = (chronicleApi.complete as jest.Mock).mock.calls;
        expect(String(calls[1][0])).toContain('Player: hi');
    });

    it('retrying a failed regeneration updates the original entry', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig(),
            () => chronicleApi, () => plannerApi
        );
        const signal = makeSignal({ kind: 'manual', gameDate: QUARTER_END });
        const first = await coordinator.handleSignal(signal);
        expect(first.outcome).toBe('generated');

        chronicleApi.complete.mockRejectedValueOnce(new Error('transient regeneration failure'));
        const failed = await coordinator.regenerateEntry(signal, first.entryId!);
        expect(failed.outcome).toBe('failed');

        chronicleApi.complete.mockResolvedValueOnce('重试后的修订正文。');
        const retried = await coordinator.retryAttempt(signal, failed.requestKey!);

        expect(retried.outcome).toBe('generated');
        expect(retried.entryId).toBe(first.entryId);
        const entries = readEntriesFile(userData)?.entries ?? [];
        expect(entries).toHaveLength(1);
        expect(entries[0].revision).toBe(1);
        expect(entries[0].content).toBe('重试后的修订正文。');
    });
});

describe('ChronicleCoordinator - concurrent manual (Step 4)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('second manual signal while first is running is rejected', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });

        let resolveFirst: (v: string) => void = () => {};
        const firstPromise = new Promise<string>(resolve => { resolveFirst = resolve; });
        const chronicleApi = {
            complete: jest.fn(async () => firstPromise)
        };
        const plannerApi = {
            context: 32000,
            calculateTokensFromText: (t: string) => Math.ceil(t.length / 4),
            isChat: () => true,
            complete: jest.fn(async () => '[digest]')
        };

        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig(),
            () => chronicleApi, () => plannerApi
        );

        const signal = makeSignal({ kind: 'manual', gameDate: QUARTER_END });
        const firstHandle = coordinator.handleSignal(signal);
        const second = await coordinator.handleSignal(signal);
        expect(second.outcome).toBe('skipped_already_running');

        resolveFirst('正文内容');
        const first = await firstHandle;
        expect(first.outcome).toBe('generated');
    });
});

describe('ChronicleCoordinator - late memory (Step 6)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('late source material never blocks generation of the newest period', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\nAI: hello\n'
        });

        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig({ frequency: 'yearly' }),
            () => chronicleApi, () => plannerApi
        );

        const firstSignal = makeSignal({ kind: 'yearly', gameDate: QUARTER_END });
        const first = await coordinator.handleSignal(firstSignal);
        expect(first.outcome).toBe('generated');

        const memoryStore = new ChronicleMemoryStore(userData, IDENTITY);
        await memoryStore.observeGameData([
            {
                ownerId: '2002',
                ownerName: '某臣',
                memoryTypeToken: 'friendship',
                memoryTypeTokenSource: 'localized_name',
                memoryName: '友谊',
                description: '迟到的记忆',
                creationDate: EARLIEST_SOURCE_DATE,
                creationDateDisplay: '1066.3.1',
                relevanceWeight: 50,
                participantIds: [1001],
                snapshotOrdinal: 1,
                observedGameDate: EARLIEST_SOURCE_DATE,
                observationSource: 'game_data',
                observedAt: new Date().toISOString(),
                votcCheckpointEpoch: 1,
                votcTimelineNodeId: '1-1'
            }
        ], { registry: firstSignal.timeline.registry, currentNodeId: firstSignal.timeline.currentNodeId });

        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: gameDate(1066, 9, 1, 389072),
            displayDate: '1066.9.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: later conversation\n',
            timestamp: Date.now() + 1
        });

        const secondSignal = makeSignal({ kind: 'yearly', gameDate: YEAR_END });
        const second = await coordinator.handleSignal(secondSignal);
        expect(second.outcome).toBe('generated');
        expect(second.entryId).not.toBe(first.entryId);

        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: gameDate(1067, 6, 1, 389314),
            displayDate: '1067.6.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: newest conversation\n',
            timestamp: Date.now() + 2
        });

        const manualSignal = makeSignal({ kind: 'manual', gameDate: FAR_LATER });
        const manual = await coordinator.handleSignal(manualSignal);
        expect(manual.outcome).toBe('generated');
        expect(manual.entryId).not.toBe(first.entryId);
        expect(manual.entryId).not.toBe(second.entryId);

        const entries = readEntriesFile(userData)?.entries ?? [];
        expect(entries).toHaveLength(3);
        expect(entries.find(entry => entry.id === first.entryId)?.revision).toBe(0);
    });
});

describe('ChronicleCoordinator - sibling branch (Step 3)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('entries from a sibling branch are not used as coverage start', async () => {
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig(),
            () => chronicleApi, () => plannerApi
        );

        const { registry, registerParentChild } = makeRegistryMock();
        registerParentChild('1-1', '1-2');

        const siblingSignal: ChronicleSignal = {
            kind: 'quarterly',
            gameDate: QUARTER_END,
            playerId: IDENTITY.playerId,
            playerName: '测试国王',
            identity: IDENTITY,
            timeline: { registry, currentNodeId: '2-1', checkpointEpoch: 1 }
        };
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '2-1',
            timelineParentId: null,
            body: 'Player: sibling\n'
        });
        await coordinator.handleSignal(siblingSignal);

        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-2',
            timelineParentId: '1-1',
            body: 'Player: current branch\n'
        });

        const currentSignal: ChronicleSignal = {
            kind: 'quarterly',
            gameDate: QUARTER_END,
            playerId: IDENTITY.playerId,
            playerName: '测试国王',
            identity: IDENTITY,
            timeline: { registry, currentNodeId: '1-2', checkpointEpoch: 1 }
        };
        const result = await coordinator.handleSignal(currentSignal);

        expect(result.outcome).toBe('generated');
        expect(result.reason).toBe('backfill');
    });
});

describe('ChronicleCoordinator - health fail-closed (error handling)', () => {
    let userData: string;
    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
        resetChronicleHealthForTests();
    });
    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
        resetChronicleHealthForTests();
    });

    it('unhealthy identity fails closed', async () => {
        const { chronicleApi, plannerApi } = makeFakeApiProvider();
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig(),
            () => chronicleApi, () => plannerApi
        );
        markChronicleUnhealthy(IDENTITY);

        const result = await coordinator.handleSignal(makeSignal({
            kind: 'quarterly', gameDate: QUARTER_END
        }));
        expect(result.outcome).toBe('ignored_unhealthy');
        expect(chronicleApi.complete).not.toHaveBeenCalled();
    });

    it('generation failure fails the attempt with sanitized error', async () => {
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: EARLIEST_SOURCE_DATE,
            displayDate: '1066.3.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hi\n'
        });
        const { chronicleApi, plannerApi } = makeFakeApiProvider({ throwOnChronicle: true });
        const coordinator = new ChronicleCoordinator(
            userData, () => makeConfig(),
            () => chronicleApi, () => plannerApi
        );

        const result = await coordinator.handleSignal(makeSignal({
            kind: 'quarterly', gameDate: QUARTER_END
        }));
        expect(result.outcome).toBe('failed');
        expect(result.errorCode).toBeDefined();
    });
});
