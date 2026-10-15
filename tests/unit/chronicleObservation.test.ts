import { observeParsedGameDataForChronicle } from '../../src/main/chronicle/chronicleObservation';
import { ChronicleStoreError } from '../../src/main/chronicle/chronicleAtomicJson';
import {
    markChronicleUnhealthy,
    isChronicleUnhealthy,
    getChronicleHealth,
    resetChronicleHealthForTests
} from '../../src/main/chronicle/chronicleHealth';
import { chronicleMemoryStorePath } from '../../src/main/campaignDataPaths';
import { GameData } from '../../src/shared/gameData/GameData';
import { Character } from '../../src/shared/gameData/Character';
import type { Memory } from '../../src/shared/gameData/GameData';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import {
    TIMELINE_PROTOCOL_SCHEMA,
    TIMELINE_CAMPAIGN_SCHEMA
} from '../../src/shared/gameData/timelineProtocol';
import fs from 'fs';
import path from 'path';
import os from 'os';

const IDENTITY = buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, '1001');

const INIT_BASE = ['1001', 'Player', '2002', 'AI', '1066.1.1', 'scene:test', 'Location', 'Controller', '1', '11', '22', '5', '6', '42', '0'];
const VALID_TAIL = [
    String(TIMELINE_PROTOCOL_SCHEMA),
    String(TIMELINE_CAMPAIGN_SCHEMA),
    '1', '2', '3', '4', '1', '1'
];

function makeTmpUserData(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'votc-chronicle-obs-'));
}

function makeGameData(opts?: { legacy?: boolean }): GameData {
    const fields = opts?.legacy
        ? [...INIT_BASE]
        : [...INIT_BASE, ...VALID_TAIL];
    const gameData = new GameData(fields);
    return gameData;
}

function makeCharacter(id: number, shortName: string, fullName?: string): Character {
    const data: string[] = new Array(27).fill('');
    data[0] = String(id);
    data[1] = shortName;
    data[2] = fullName ?? shortName;
    return new Character(data);
}

function makeMemory(overrides: Partial<Memory> = {}): Memory {
    return {
        type: 'friendship',
        creationDate: '1066.1.1',
        desc: '某人与某人成为朋友',
        relevanceWeight: 50,
        participantIds: [2002],
        identityComplete: true,
        ...overrides
    };
}

function addCharacterWithMemories(
    gameData: GameData,
    character: Character
): void {
    gameData.characters.set(character.id, character);
}

describe('observeParsedGameDataForChronicle - legacy compat boundary', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('returns a no-op result for legacy-mod without throwing', async () => {
        const gameData = makeGameData({ legacy: true });
        const result = await observeParsedGameDataForChronicle(userData, gameData, 'conversation') as any;

        expect(result.skipped).toBe(true);
        expect(result.reason).toBe('legacy-mod');
        expect(result.recordCount).toBe(0);
        expect(result.createdCount).toBe(0);
    });

    it('does not create any chronicle files for legacy-mod', async () => {
        const gameData = makeGameData({ legacy: true });
        await observeParsedGameDataForChronicle(userData, gameData, 'conversation');

        const storePath = chronicleMemoryStorePath(userData, IDENTITY);
        expect(fs.existsSync(storePath)).toBe(false);
    });
});

describe('observeParsedGameDataForChronicle - memory collection', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('collects memories from all characters where identityComplete is true', async () => {
        const gameData = makeGameData();
        const player = makeCharacter(1001, '主角', '主角全名');
        player.memories.push(makeMemory({ type: 'marriage', desc: '主角结婚了' }));
        const ai = makeCharacter(2002, '大臣', '大臣全名');
        ai.memories.push(makeMemory({ type: 'rivalry', desc: '大臣与主角结怨' }));

        addCharacterWithMemories(gameData, player);
        addCharacterWithMemories(gameData, ai);

        const result = await observeParsedGameDataForChronicle(userData, gameData, 'conversation') as any;

        expect(result.skipped).toBeUndefined();
        expect(result.createdCount).toBe(2);
        expect(result.recordCount).toBe(2);
    });

    it('filters out memories where identityComplete is false', async () => {
        const gameData = makeGameData();
        const player = makeCharacter(1001, '主角');
        player.memories.push(makeMemory({ type: 'complete', desc: '完整记忆', identityComplete: true }));
        player.memories.push(makeMemory({ type: 'incomplete', desc: '不完整记忆', identityComplete: false }));
        player.memories.push(makeMemory({ type: 'also-complete', desc: '另一个完整记忆', identityComplete: true }));

        addCharacterWithMemories(gameData, player);

        const result = await observeParsedGameDataForChronicle(userData, gameData, 'conversation');

        expect(result.createdCount).toBe(2);
        expect(result.recordCount).toBe(2);

        const storePath = chronicleMemoryStorePath(userData, IDENTITY);
        const file = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        const descs = file.records.map((r: any) => r.frozen.description).sort();
        expect(descs).toEqual(['另一个完整记忆', '完整记忆']);
    });

    it('maps memory fields correctly to observation inputs', async () => {
        const gameData = makeGameData();
        const player = makeCharacter(1001, '主角', '主角全名');
        player.memories.push(makeMemory({
            type: 'death',
            memoryTypeToken: '亲属死亡',
            memoryTypeTokenSource: 'localized_name',
            desc: '主角的父亲去世了',
            relevanceWeight: 80,
            participantIds: [3003, 4004],
            snapshotOrdinal: 3,
            creationGameDate: { totalDays: 365859, year: 1000, month: 1, day: 1, display: '1000.1.1' },
            creationDate: '1000.1.1',
            identityComplete: true
        }));

        addCharacterWithMemories(gameData, player);

        await observeParsedGameDataForChronicle(userData, gameData, 'conversation');

        const storePath = chronicleMemoryStorePath(userData, IDENTITY);
        const file = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        expect(file.records.length).toBe(1);

        const record = file.records[0];
        expect(record.ownerId).toBe('1001');
        expect(record.frozen.ownerName).toBe('主角');
        expect(record.memoryTypeToken).toBe('亲属死亡');
        expect(record.memoryTypeTokenSource).toBe('localized_name');
        expect(record.frozen.memoryName).toBe('亲属死亡');
        expect(record.frozen.description).toBe('主角的父亲去世了');
        expect(record.frozen.relevanceWeight).toBe(80);
        expect(record.participantIds).toEqual(['3003', '4004']);
        expect(record.frozen.captureSource).toBe('game_data');
        expect(record.frozen.capturedTimelineNodeId).toBe('11-22');
    });

    it('populates captureLanguage when language is passed', async () => {
        const gameData = makeGameData();
        const player = makeCharacter(1001, '主角');
        player.memories.push(makeMemory({ desc: '语言捕获测试' }));
        addCharacterWithMemories(gameData, player);

        await observeParsedGameDataForChronicle(userData, gameData, 'conversation', 'zh');

        const storePath = chronicleMemoryStorePath(userData, IDENTITY);
        const file = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        expect(file.records.length).toBe(1);
        expect(file.records[0].captureLanguage).toBe('zh');
    });

    it('leaves captureLanguage undefined when language is not passed', async () => {
        const gameData = makeGameData();
        const player = makeCharacter(1001, '主角');
        player.memories.push(makeMemory({ desc: '无语言测试' }));
        addCharacterWithMemories(gameData, player);

        await observeParsedGameDataForChronicle(userData, gameData, 'conversation');

        const storePath = chronicleMemoryStorePath(userData, IDENTITY);
        const file = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        expect(file.records.length).toBe(1);
        expect(file.records[0].captureLanguage).toBeUndefined();
    });

    it('persists to the memory store file (write-through)', async () => {
        const gameData = makeGameData();
        const player = makeCharacter(1001, '主角');
        player.memories.push(makeMemory({ desc: '持久化测试记忆' }));
        addCharacterWithMemories(gameData, player);

        await observeParsedGameDataForChronicle(userData, gameData, 'conversation');

        const storePath = chronicleMemoryStorePath(userData, IDENTITY);
        expect(fs.existsSync(storePath)).toBe(true);

        const file = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        expect(file.schemaVersion).toBe(1);
        expect(file.campaignId).toBe(IDENTITY.campaignId);
        expect(file.playerId).toBe(IDENTITY.playerId);
        expect(file.records.length).toBe(1);
        expect(file.records[0].frozen.description).toBe('持久化测试记忆');
    });
});

describe('observeParsedGameDataForChronicle - call-order contract', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('observe completes (write-through) before downstream business proceeds', async () => {
        const callOrder: string[] = [];

        // Simulate: parseLog completes -> observe -> business
        const gameData = makeGameData();
        const player = makeCharacter(1001, '主角');
        player.memories.push(makeMemory({ desc: '调用顺序测试' }));
        addCharacterWithMemories(gameData, player);

        callOrder.push('parse-complete');

        await observeParsedGameDataForChronicle(userData, gameData, 'conversation');
        callOrder.push('observe-complete');

        // Verify the store file was written (write-through) before business
        const storePath = chronicleMemoryStorePath(userData, IDENTITY);
        expect(fs.existsSync(storePath)).toBe(true);
        callOrder.push('business-started');

        expect(callOrder).toEqual(['parse-complete', 'observe-complete', 'business-started']);
    });
});

describe('observeParsedGameDataForChronicle - ChronicleStoreError propagation', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('propagates ChronicleStoreError instead of swallowing it', async () => {
        const gameData = makeGameData();
        const player = makeCharacter(1001, '主角');
        player.memories.push(makeMemory({ desc: '错误传播测试' }));
        addCharacterWithMemories(gameData, player);

        // Pre-corrupt the store so loading fails closed.
        const storePath = chronicleMemoryStorePath(userData, IDENTITY);
        fs.mkdirSync(path.dirname(storePath), { recursive: true });
        fs.writeFileSync(storePath, '{corrupt', 'utf8');
        const backupPath = `${storePath}.bak`;
        fs.writeFileSync(backupPath, '{also corrupt', 'utf8');

        let thrown: unknown;
        try {
            await observeParsedGameDataForChronicle(userData, gameData, 'conversation');
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_corrupt');
    });
});

describe('chronicleHealth tracker', () => {
    beforeEach(() => { resetChronicleHealthForTests(); });
    afterEach(() => { resetChronicleHealthForTests(); });

    it('marks a campaign/player unhealthy with an error code', () => {
        expect(isChronicleUnhealthy(IDENTITY)).toBe(false);

        markChronicleUnhealthy(IDENTITY, 'chronicle_corrupt');

        expect(isChronicleUnhealthy(IDENTITY)).toBe(true);
        const health = getChronicleHealth(IDENTITY);
        expect(health?.unhealthy).toBe(true);
        expect(health?.lastErrorCode).toBe('chronicle_corrupt');
        expect(health?.lastErrorAt).toBeDefined();
    });

    it('isolates health state by campaign/player', () => {
        const OTHER = buildIdentityFromParts({ a: 9, b: 8, c: 7, d: 6 }, '2002');

        markChronicleUnhealthy(IDENTITY, 'chronicle_io_failed');

        expect(isChronicleUnhealthy(IDENTITY)).toBe(true);
        expect(isChronicleUnhealthy(OTHER)).toBe(false);
    });

    it('simulates wrapper behavior: catch error, mark health, continue business', () => {
        // This simulates what main.ts / generators do: they catch the
        // ChronicleStoreError from observeParsedGameDataForChronicle and
        // mark health unhealthy, then continue with the business operation.
        const chronicleErr = new ChronicleStoreError('chronicle_corrupt', 'store is corrupt');

        try {
            throw chronicleErr;
        } catch (err) {
            const code = (err instanceof ChronicleStoreError) ? err.code : undefined;
            markChronicleUnhealthy(IDENTITY, code);
        }

        // Business continues; health is marked.
        expect(isChronicleUnhealthy(IDENTITY)).toBe(true);
        expect(getChronicleHealth(IDENTITY)?.lastErrorCode).toBe('chronicle_corrupt');
    });
});
