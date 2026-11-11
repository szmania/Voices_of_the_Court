jest.mock('electron', () => ({
    app: { getPath: jest.fn() }
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import { collectChronicleSources } from '../../src/main/chronicle/ChronicleSourceCollector';
import { ChronicleMemoryStore } from '../../src/main/chronicle/ChronicleMemoryStore';
import {
    conversationHistoryDir,
    conversationSummariesDir,
    letterHistoryDir,
    battleReportHistoryPath
} from '../../src/main/campaignDataPaths';
import { buildConversationHistoryHeader } from '../../src/main/conversation/conversationHistoryHeader';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import type { Ck3GameDate } from '../../src/shared/gameData/gameDate';
import type { TimelineRegistry } from '../../src/main/timelineManager';
import type { ChronicleMemoryObservationInput } from '../../src/main/chronicle/chronicleTypes';

const IDENTITY = buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, 'player-1001');

function makeTmpUserData(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'votc-src-collector-'));
}

function gameDate(year: number, month: number, day: number, totalDays: number): Ck3GameDate {
    return { totalDays, year, month, day, display: `${year}.${month}.${day}` };
}

const PERIOD_START = gameDate(1065, 1, 1, 388432);
const PERIOD_END = gameDate(1067, 1, 1, 389163);

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

function writeSummaryFile(
    userData: string,
    identity: typeof IDENTITY,
    characterId: string,
    summaries: any[]
): void {
    const dir = conversationSummariesDir(userData, identity);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${characterId}.json`), JSON.stringify(summaries, null, 2), 'utf8');
}

function writeLetterHistoryFile(
    userData: string,
    identity: typeof IDENTITY,
    characterId: string,
    records: any[]
): void {
    const dir = letterHistoryDir(userData, identity);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `character_${characterId}.json`), JSON.stringify(records, null, 2), 'utf8');
}

function writeBattleReportFile(
    userData: string,
    identity: typeof IDENTITY,
    records: any[]
): void {
    const file = battleReportHistoryPath(userData, identity);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(records, null, 2), 'utf8');
}

function baseMemoryInput(overrides: Partial<ChronicleMemoryObservationInput> = {}): ChronicleMemoryObservationInput {
    return {
        ownerId: '2002',
        ownerName: '李某',
        memoryTypeToken: 'friendship',
        memoryTypeTokenSource: 'localized_name',
        memoryName: '友谊',
        description: '某人与某人成为朋友',
        creationDate: gameDate(1066, 1, 1, 388798),
        creationDateDisplay: '1066.1.1',
        relevanceWeight: 50,
        participantIds: [1001],
        snapshotOrdinal: 1,
        observedGameDate: gameDate(1066, 1, 1, 388798),
        observationSource: 'game_data',
        observedAt: '2026-07-22T00:00:00Z',
        votcCheckpointEpoch: 1,
        votcTimelineNodeId: '1-1',
        votcTimelineParentId: undefined,
        ...overrides
    };
}

describe('ChronicleSourceCollector - conversation sources (Step 2-4)', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('links conversation raw text with its summary by sourceRecordId', () => {
        const sourceRecordId = randomUUID();
        const gd = gameDate(1066, 1, 1, 388798);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId,
            gameDate: gd,
            displayDate: '1066.1.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });
        writeSummaryFile(userData, IDENTITY, '2002', [
            {
                date: '1066.1.1',
                content: 'conversation about greetings',
                votcCheckpointEpoch: 1,
                votcTimelineNodeId: '1-1',
                sourceType: 'conversation',
                sourceRecordId,
                gameDate: gd,
                id: 'summary_1-1_1',
                characterName: 'AI'
            }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData,
            identity: IDENTITY,
            playerId: '1001',
            registry,
            currentNodeId,
            checkpointEpoch: 1,
            periodStart: PERIOD_START,
            periodEnd: PERIOD_END,
            firstBackfill: false
        });

        const conv = sources.find(s => s.kind === 'conversation');
        expect(conv).toBeDefined();
        expect(conv!.rawText).toContain('Player: hello');
        expect(conv!.rawText).toContain('AI: hi');
        expect(conv!.existingSummary).toBe('conversation about greetings');
        expect(conv!.existingSummaryId).toBe('summary_1-1_1');
        expect(conv!.gameDate).toEqual(gd);
        expect(conv!.votcTimelineNodeId).toBe('1-1');
        expect(conv!.votcCheckpointEpoch).toBe(1);
        expect(conv!.legacyUndated).toBe(false);
    });

    it('deduplicates summaries with the same sourceRecordId across multiple character files (Step 4)', () => {
        const sourceRecordId = randomUUID();
        const gd = gameDate(1066, 1, 1, 388798);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId,
            gameDate: gd,
            displayDate: '1066.1.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });
        // Same sourceRecordId in two different character summary files.
        writeSummaryFile(userData, IDENTITY, '2002', [
            { date: '1066.1.1', content: 'char A summary', votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1', sourceType: 'conversation', sourceRecordId, gameDate: gd, id: 'sum-a' }
        ]);
        writeSummaryFile(userData, IDENTITY, '3003', [
            { date: '1066.1.1', content: 'char B summary', votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1', sourceType: 'conversation', sourceRecordId, gameDate: gd, id: 'sum-b' }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const conv = sources.filter(s => s.kind === 'conversation');
        expect(conv.length).toBe(1);
        // Only one summary linked (the first encountered).
        expect(conv[0].existingSummary).toBeDefined();
    });

    it('does not match summary by text similarity when sourceRecordId differs (Step 3)', () => {
        const convSourceId = randomUUID();
        const otherSourceId = randomUUID();
        const gd = gameDate(1066, 1, 1, 388798);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: convSourceId,
            gameDate: gd,
            displayDate: '1066.1.1',
            checkpointEpoch: 1,
            timelineNodeId: '1-1',
            timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });
        // Different sourceRecordId, same content text.
        writeSummaryFile(userData, IDENTITY, '2002', [
            { date: '1066.1.1', content: 'similar text', votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1', sourceType: 'conversation', sourceRecordId: otherSourceId, gameDate: gd, id: 'sum-other' }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const conv = sources.find(s => s.kind === 'conversation');
        expect(conv).toBeDefined();
        expect(conv!.existingSummary).toBeUndefined();
    });

    it('parses legacy file without VOTC header using filename timeline and checkpoint (Step 2 fallback)', () => {
        const dir = conversationHistoryDir(userData, IDENTITY);
        fs.mkdirSync(dir, { recursive: true });
        // Old file: no VOTC header lines, just display date and body.
        const oldContent = '日期: 1066.1.1\n\nPlayer: hello\nAI: hi\n';
        const fileName = '1001_2002_tl_1-1_ckpt1_1700000000000.txt';
        fs.writeFileSync(path.join(dir, fileName), oldContent, 'utf8');

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const conv = sources.find(s => s.kind === 'conversation');
        expect(conv).toBeDefined();
        expect(conv!.votcTimelineNodeId).toBe('1-1');
        expect(conv!.votcCheckpointEpoch).toBe(1);
        expect(conv!.gameDate).toBeDefined();
        expect(conv!.gameDate!.year).toBe(1066);
        expect(conv!.legacyUndated).toBe(false);
    });

    it('includes undated legacy files only during first backfill', () => {
        const dir = conversationHistoryDir(userData, IDENTITY);
        fs.mkdirSync(dir, { recursive: true });
        // No date info at all: no header, no display date.
        const oldContent = 'Player: hello\nAI: hi\n';
        const fileName = '1001_2002_tl_1-1_ckpt1_1700000000000.txt';
        fs.writeFileSync(path.join(dir, fileName), oldContent, 'utf8');

        const { registry, currentNodeId } = makeRegistryMock('1-1');

        const sourcesBackfill = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: true
        });
        expect(sourcesBackfill.some(s => s.kind === 'conversation')).toBe(true);
        expect(sourcesBackfill.find(s => s.kind === 'conversation')!.legacyUndated).toBe(true);

        const sourcesNormal = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });
        expect(sourcesNormal.some(s => s.kind === 'conversation')).toBe(false);
    });

    it('matches legacy summary by timeline node + checkpoint when no sourceRecordId (Step 3)', () => {
        const dir = conversationHistoryDir(userData, IDENTITY);
        fs.mkdirSync(dir, { recursive: true });
        // Legacy conversation file with display date but no sourceRecordId.
        const oldContent = 'VOTC source record id: \nVOTC game date total days: \nVOTC game date: \n日期: 1066.1.1\nVOTC checkpoint: 1\nVOTC timeline node: 1-1\nVOTC timeline parent: null\n\nPlayer: hello\nAI: hi\n';
        const fileName = '1001_2002_tl_1-1_ckpt1_1700000000000.txt';
        fs.writeFileSync(path.join(dir, fileName), oldContent, 'utf8');

        // Legacy summary without sourceRecordId but with matching timeline + checkpoint.
        writeSummaryFile(userData, IDENTITY, '2002', [
            { date: '1066.1.1', content: 'legacy summary', votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1', id: 'legacy-sum-1' }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const conv = sources.find(s => s.kind === 'conversation');
        expect(conv).toBeDefined();
        expect(conv!.existingSummary).toBe('legacy summary');
        expect(conv!.existingSummaryId).toBe('legacy-sum-1');
    });

    it('uses participants to disambiguate legacy summaries when multiple match (Step 3)', () => {
        const dir = conversationHistoryDir(userData, IDENTITY);
        fs.mkdirSync(dir, { recursive: true });
        // Legacy conversation file: no sourceRecordId, matches timeline/checkpoint/date.
        const oldContent = 'VOTC source record id: \nVOTC game date total days: \nVOTC game date: \n日期: 1066.1.1\nVOTC checkpoint: 1\nVOTC timeline node: 1-1\nVOTC timeline parent: null\n\nAlice: hello\nBob: hi\n';
        const fileName = '1001_2002_tl_1-1_ckpt1_1700000000000.txt';
        fs.writeFileSync(path.join(dir, fileName), oldContent, 'utf8');

        // Two legacy summaries with same timeline/checkpoint/date but different characters.
        // Alice's summary (character file 2002) and Bob's summary (character file 3003).
        // The conversation participants are Alice and Bob (no ids, just names).
        writeSummaryFile(userData, IDENTITY, '2002', [
            { date: '1066.1.1', content: 'alice summary', votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1', id: 'sum-alice', characterName: 'Alice' }
        ]);
        writeSummaryFile(userData, IDENTITY, '3003', [
            { date: '1066.1.1', content: 'bob summary', votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1', id: 'sum-bob', characterName: 'Bob' }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const conv = sources.find(s => s.kind === 'conversation');
        expect(conv).toBeDefined();
        // With participants disambiguation, the unique candidate constraint still
        // requires exactly one match. Two candidates with different characters both
        // match participants (Alice and Bob both participate), so no unique match.
        // However, if only one summary's character matches a participant, it wins.
        // Here both Alice and Bob participate, so both match -> no unique candidate.
        expect(conv!.existingSummary).toBeUndefined();
    });

    it('matches legacy summary by participant name when only one candidate matches (Step 3)', () => {
        const dir = conversationHistoryDir(userData, IDENTITY);
        fs.mkdirSync(dir, { recursive: true });
        // Legacy conversation: Alice participates (Bob does not appear in body).
        const oldContent = 'VOTC source record id: \nVOTC game date total days: \nVOTC game date: \n日期: 1066.1.1\nVOTC checkpoint: 1\nVOTC timeline node: 1-1\nVOTC timeline parent: null\n\nAlice: hello\nCharlie: hey\n';
        const fileName = '1001_2002_tl_1-1_ckpt1_1700000000000.txt';
        fs.writeFileSync(path.join(dir, fileName), oldContent, 'utf8');

        // Two legacy summaries: Alice (matches participant) and Dave (does not).
        writeSummaryFile(userData, IDENTITY, '2002', [
            { date: '1066.1.1', content: 'alice summary', votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1', id: 'sum-alice', characterName: 'Alice' }
        ]);
        writeSummaryFile(userData, IDENTITY, '3003', [
            { date: '1066.1.1', content: 'dave summary', votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1', id: 'sum-dave', characterName: 'Dave' }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const conv = sources.find(s => s.kind === 'conversation');
        expect(conv).toBeDefined();
        expect(conv!.existingSummary).toBe('alice summary');
        expect(conv!.existingSummaryId).toBe('sum-alice');
    });
});

describe('ChronicleSourceCollector - sibling branch and date filtering (Step 7)', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('excludes conversation from a sibling timeline branch', () => {
        const gd = gameDate(1066, 1, 1, 388798);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: gd, displayDate: '1066.1.1',
            checkpointEpoch: 1, timelineNodeId: '2-1', timelineParentId: null,
            body: 'Player: branch b\n'
        });

        const { registry, registerParentChild } = makeRegistryMock();
        registerParentChild('1-1', '1-2');
        // 2-1 is NOT an ancestor of 1-2.

        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId: '1-2', checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        expect(sources.filter(s => s.kind === 'conversation').length).toBe(0);
    });

    it('excludes sources outside the period (future date)', () => {
        const futureDate = gameDate(1070, 1, 1, 390629);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: futureDate, displayDate: '1070.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: future\n'
        });

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        expect(sources.filter(s => s.kind === 'conversation').length).toBe(0);
    });

    it('includes sources on the period end boundary (inclusive)', () => {
        const boundaryDate = PERIOD_END;
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(),
            gameDate: boundaryDate, displayDate: '1067.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: boundary\n'
        });

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        expect(sources.filter(s => s.kind === 'conversation').length).toBe(1);
    });
});

describe('ChronicleSourceCollector - memory sources (Step 5-6)', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('projects frozen memory description as rawText and marks memoryTextFrozen', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const gd = gameDate(1066, 1, 1, 388798);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(), gameDate: gd, displayDate: '1066.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });
        await store.observeGameData([baseMemoryInput()], { registry, currentNodeId });

        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const mem = sources.find(s => s.kind === 'character_memory');
        expect(mem).toBeDefined();
        expect(mem!.rawText).toBe('某人与某人成为朋友');
        expect(mem!.memoryTextFrozen).toBe(true);
        expect(mem!.memoryKey).toBeDefined();
        expect(mem!.memoryOwnerId).toBe('2002');
        expect(mem!.title).toBe('友谊');
    });

    it('does not re-read current character name; uses frozen ownerName', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const gd = gameDate(1066, 1, 1, 388798);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(), gameDate: gd, displayDate: '1066.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });
        await store.observeGameData([
            baseMemoryInput({ ownerName: '原始名', description: '原始描述' })
        ], { registry, currentNodeId });

        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const mem = sources.find(s => s.kind === 'character_memory');
        expect(mem).toBeDefined();
        // Title comes from frozen memoryName, not a re-read.
        expect(mem!.title).toBe('友谊');
        // rawText is frozen description.
        expect(mem!.rawText).toBe('原始描述');
    });

    it('includes late-arriving memory whose creation date falls in period', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const gd = gameDate(1066, 1, 1, 388798);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(), gameDate: gd, displayDate: '1066.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });
        // Memory created at an earlier game date but observed later.
        await store.observeGameData([
            baseMemoryInput({
                creationDate: gameDate(1066, 6, 1, 388980),
                creationDateDisplay: '1066.6.1',
                observedGameDate: gameDate(1066, 6, 1, 388980),
                description: '迟到记忆'
            })
        ], { registry, currentNodeId });

        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const mem = sources.find(s => s.kind === 'character_memory');
        expect(mem).toBeDefined();
        expect(mem!.rawText).toBe('迟到记忆');
    });

    it('filters out memories whose owner is not in the relevant set', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        // Memory owned by an unrelated character (9999) with no conversation/letter/battle referencing them.
        await store.observeGameData([
            baseMemoryInput({
                ownerId: '9999',
                ownerName: '陌生人',
                description: '陌生人的记忆',
                participantIds: [8888]
            })
        ], { registry, currentNodeId });

        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const mem = sources.find(s => s.kind === 'character_memory' && s.memoryOwnerId === '9999');
        expect(mem).toBeUndefined();
    });
});

describe('ChronicleSourceCollector - letter sources', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('collects outgoing letter reply records with gameDate', () => {
        const sourceRecordId = randomUUID();
        const gd = gameDate(1066, 1, 1, 388798);
        writeLetterHistoryFile(userData, IDENTITY, '2002', [
            {
                playerName: 'Player', aiName: 'AI',
                playerLetter: 'hello', aiReply: 'hi',
                createdAt: '2026-07-22T00:00:00Z',
                votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1',
                sourceRecordId, sourceType: 'letter', gameDate: gd,
                senderId: '1001', receiverId: '2002'
            }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const letter = sources.find(s => s.kind === 'outgoing_letter');
        expect(letter).toBeDefined();
        expect(letter!.rawText).toContain('hello');
        expect(letter!.rawText).toContain('hi');
        expect(letter!.gameDate).toEqual(gd);
        expect(letter!.participants.length).toBe(2);
    });

    it('collects incoming letter records separately from outgoing', () => {
        const sourceRecordId = randomUUID();
        const gd = gameDate(1066, 1, 1, 388798);
        writeLetterHistoryFile(userData, IDENTITY, '2002', [
            {
                id: 'incoming-1',
                direction: 'incoming',
                sourceType: 'travel_tales',
                chronicleSourceKind: 'incoming_letter',
                senderId: '2002', receiverId: '1001',
                senderName: 'Sender', receiverName: 'Player',
                content: 'a letter from afar',
                createdAt: '2026-07-22T00:00:00Z',
                votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1',
                sourceRecordId, gameDate: gd
            }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const incoming = sources.find(s => s.kind === 'incoming_letter');
        expect(incoming).toBeDefined();
        expect(incoming!.rawText).toBe('a letter from afar');
        expect(incoming!.title).toBe('Sender');

        const outgoing = sources.find(s => s.kind === 'outgoing_letter');
        expect(outgoing).toBeUndefined();
    });

    it('deduplicates outgoing letters with the same sourceRecordId across files', () => {
        const sourceRecordId = randomUUID();
        const gd = gameDate(1066, 1, 1, 388798);
        // Same sourceRecordId appears in two different character files.
        writeLetterHistoryFile(userData, IDENTITY, '2002', [
            {
                playerName: 'Player', aiName: 'AI A',
                playerLetter: 'hello', aiReply: 'hi A',
                createdAt: '2026-07-22T00:00:00Z',
                votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1',
                sourceRecordId, sourceType: 'letter', gameDate: gd,
                senderId: '1001', receiverId: '2002'
            }
        ]);
        writeLetterHistoryFile(userData, IDENTITY, '3003', [
            {
                playerName: 'Player', aiName: 'AI B',
                playerLetter: 'hello', aiReply: 'hi B',
                createdAt: '2026-07-22T00:00:00Z',
                votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1',
                sourceRecordId, sourceType: 'letter', gameDate: gd,
                senderId: '1001', receiverId: '3003'
            }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const outgoing = sources.filter(s => s.kind === 'outgoing_letter');
        expect(outgoing.length).toBe(1);
    });
});

describe('ChronicleSourceCollector - battle report sources', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('collects battle report records with sourceRecordId and gameDate', () => {
        const sourceRecordId = randomUUID();
        const gd = gameDate(1066, 1, 1, 388798);
        writeBattleReportFile(userData, IDENTITY, [
            {
                id: 'battle-1', dedupKey: 'battle-1@1-1',
                createdAt: '2026-07-22T00:00:00Z',
                votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1',
                date: '1066.1.1', location: 'London',
                winnerName: 'Winner', loserName: 'Loser', result: 'victory',
                content: 'a great battle',
                sourceRecordId, sourceType: 'battle_report', gameDate: gd
            }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const battle = sources.find(s => s.kind === 'battle_report');
        expect(battle).toBeDefined();
        expect(battle!.rawText).toBe('a great battle');
        expect(battle!.title).toBe('London');
        expect(battle!.gameDate).toEqual(gd);
    });

    it('repairs a stale structured snapshot date from the battle display date', () => {
        const sourceRecordId = randomUUID();
        const staleSnapshotDate = gameDate(1068, 1, 1, 389528);
        writeBattleReportFile(userData, IDENTITY, [
            {
                id: 'battle-stale-date', dedupKey: 'battle-stale-date@1-1',
                createdAt: '2026-07-22T00:00:00Z',
                votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1',
                date: '1066.1.1', location: 'London',
                winnerName: 'Winner', loserName: 'Loser', result: 'victory',
                content: 'battle with stale snapshot metadata',
                sourceRecordId, sourceType: 'battle_report', gameDate: staleSnapshotDate
            }
        ]);

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const battle = sources.find(s => s.id === sourceRecordId);
        expect(battle).toBeDefined();
        expect(battle!.gameDate).toMatchObject({
            totalDays: 388798,
            year: 1066,
            month: 1,
            day: 1,
            display: '1066.1.1'
        });
    });

    it('extracts battle report winnerId/loserId into the relevant owner set (Step 5)', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const gd = gameDate(1066, 1, 1, 388798);
        // Need a conversation so the period is non-empty and firstBackfill=false works.
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(), gameDate: gd, displayDate: '1066.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });
        writeBattleReportFile(userData, IDENTITY, [
            {
                id: 'battle-1', dedupKey: 'battle-1@1-1',
                createdAt: '2026-07-22T00:00:00Z',
                votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1',
                date: '1066.1.1', location: 'London',
                winnerName: 'Winner', loserName: 'Loser',
                winnerId: '5005', loserId: '6006',
                result: 'victory',
                content: 'a great battle',
                sourceRecordId: randomUUID(), sourceType: 'battle_report', gameDate: gd
            }
        ]);

        // Memory owned by the battle winner (5005) - only relevant if battle report contributes the ID.
        await store.observeGameData([
            baseMemoryInput({
                ownerId: '5005',
                ownerName: 'Winner',
                description: 'winner memory',
                participantIds: [1001]
            })
        ], { registry, currentNodeId });

        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const mem = sources.find(s => s.kind === 'character_memory' && s.memoryOwnerId === '5005');
        expect(mem).toBeDefined();
        expect(mem!.rawText).toBe('winner memory');
    });
});

describe('ChronicleSourceCollector - stable sorting (Step 8)', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('sorts sources by gameDate.totalDays ascending', () => {
        const earlyDate = gameDate(1066, 1, 1, 388798);
        const lateDate = gameDate(1066, 6, 1, 388980);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(), gameDate: lateDate, displayDate: '1066.6.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: late\n', timestamp: 1700000000001
        });
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(), gameDate: earlyDate, displayDate: '1066.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: early\n', timestamp: 1700000000002
        });

        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const conv = sources.filter(s => s.kind === 'conversation');
        expect(conv.length).toBe(2);
        expect(conv[0].gameDate!.totalDays).toBeLessThanOrEqual(conv[1].gameDate!.totalDays);
        expect(conv[0].rawText).toContain('early');
        expect(conv[1].rawText).toContain('late');
    });
});

describe('ChronicleSourceCollector - relevant owner set (Step 5)', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('includes memory owned by a character referenced in a conversation', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');

        const gd = gameDate(1066, 1, 1, 388798);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(), gameDate: gd, displayDate: '1066.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });

        // Memory owned by player 1001 (always in the relevant set).
        await store.observeGameData([
            baseMemoryInput({
                ownerId: '1001',
                ownerName: 'Player',
                description: 'player memory',
                participantIds: [2002]
            })
        ], { registry, currentNodeId });

        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const mem = sources.find(s => s.kind === 'character_memory' && s.memoryOwnerId === '1001');
        expect(mem).toBeDefined();
    });
});

describe('ChronicleSourceCollector - dynamic frozen memory (Step 6)', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('preserves frozen description across dynamic re-renders', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const gd = gameDate(1066, 1, 1, 388798);
        writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(), gameDate: gd, displayDate: '1066.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });
        await store.observeGameData([
            baseMemoryInput({ description: '原始描述' })
        ], { registry, currentNodeId });

        // Second snapshot with dynamic text change.
        await store.observeGameData([
            baseMemoryInput({ description: '动态新描述' })
        ], { registry, currentNodeId });

        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const mem = sources.find(s => s.kind === 'character_memory');
        expect(mem).toBeDefined();
        expect(mem!.rawText).toBe('原始描述');
        expect(mem!.memoryTextFrozen).toBe(true);
    });
});

describe('ChronicleSourceCollector - relevant owner set derivation (C1 fix)', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('reads each conversation file exactly once (no doubled I/O for relevant owner set)', () => {
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const gd = gameDate(1066, 1, 1, 388798);
        const fileName = writeConversationFile(userData, IDENTITY, {
            sourceRecordId: randomUUID(), gameDate: gd, displayDate: '1066.1.1',
            checkpointEpoch: 1, timelineNodeId: '1-1', timelineParentId: null,
            body: 'Player: hello\nAI: hi\n'
        });

        const originalReadFileSync = fs.readFileSync;
        const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(function (this: unknown, ...args: any[]) {
            return (originalReadFileSync as any).apply(this, args);
        });
        let conversationReads: any[] = [];
        try {
            const sources = collectChronicleSources({
                userDataDir: userData, identity: IDENTITY, playerId: '1001',
                registry, currentNodeId, checkpointEpoch: 1,
                periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
            });
            expect(sources.filter(s => s.kind === 'conversation').length).toBeGreaterThan(0);
            conversationReads = readSpy.mock.calls.filter(call => {
                const p = call[0];
                return typeof p === 'string' && p.includes(fileName);
            });
        } finally {
            readSpy.mockRestore();
        }

        // Before the C1 fix, the relevant-owner-set derivation re-scanned
        // conversation files, causing 2 reads per file. After the fix, each
        // conversation file is read exactly once.
        expect(conversationReads.length).toBe(1);
    });

    it('includes letter sender/receiver ids in the relevant owner set', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const gd = gameDate(1066, 1, 1, 388798);
        // Letter references character 7007 (receiver).
        writeLetterHistoryFile(userData, IDENTITY, '7007', [
            {
                playerName: 'Player', aiName: 'AI',
                playerLetter: 'hello', aiReply: 'hi',
                createdAt: '2026-07-22T00:00:00Z',
                votcCheckpointEpoch: 1, votcTimelineNodeId: '1-1',
                sourceRecordId: randomUUID(), sourceType: 'letter', gameDate: gd,
                senderId: '1001', receiverId: '7007'
            }
        ]);

        // Memory owned by 7007 (letter receiver). Only relevant if letter
        // participant ids are derived from the collected source records.
        await store.observeGameData([
            baseMemoryInput({
                ownerId: '7007',
                ownerName: 'LetterRecipient',
                description: 'recipient memory',
                participantIds: [1001]
            })
        ], { registry, currentNodeId });

        const sources = collectChronicleSources({
            userDataDir: userData, identity: IDENTITY, playerId: '1001',
            registry, currentNodeId, checkpointEpoch: 1,
            periodStart: PERIOD_START, periodEnd: PERIOD_END, firstBackfill: false
        });

        const mem = sources.find(s => s.kind === 'character_memory' && s.memoryOwnerId === '7007');
        expect(mem).toBeDefined();
        expect(mem!.rawText).toBe('recipient memory');
    });
});
