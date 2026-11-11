import { ChronicleMemoryStore } from '../../src/main/chronicle/ChronicleMemoryStore';
import {
    ChronicleStoreError
} from '../../src/main/chronicle/chronicleAtomicJson';
import type {
    ChronicleMemoryObservationInput,
    ChronicleMemoryStoreFile
} from '../../src/main/chronicle/chronicleTypes';
import {
    computeIdentityAnchor,
    computeMemoryKey,
    computeRenderedDescriptionHash,
    resolveFirstVisibleTimelineAnchor
} from '../../src/main/chronicle/chronicleMemoryIdentity';
import {
    chronicleMemoryStorePath,
    chronicleMemoryBackupPath
} from '../../src/main/campaignDataPaths';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import type { Ck3GameDate } from '../../src/shared/gameData/gameDate';
import type { TimelineRegistry } from '../../src/main/timelineManager';
import fs from 'fs';
import path from 'path';
import os from 'os';

const IDENTITY = buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, 'player-1001');
const OTHER_IDENTITY = buildIdentityFromParts({ a: 9, b: 8, c: 7, d: 6 }, 'player-2002');

function makeTmpUserData(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'votc-memstore-'));
}

function gameDate(year: number, month: number, day: number, totalDays: number): Ck3GameDate {
    return { totalDays, year, month, day, display: `${year}.${month}.${day}` };
}

function baseInput(overrides: Partial<ChronicleMemoryObservationInput> = {}): ChronicleMemoryObservationInput {
    return {
        ownerId: '121441',
        ownerName: '李某',
        memoryTypeToken: '姑姨死亡',
        memoryTypeTokenSource: 'localized_name',
        memoryName: '姑姨死亡',
        description: '唐皇帝李某，王佑峻的父亲...',
        creationDate: gameDate(1000, 1, 1, 365859),
        creationDateDisplay: '1000.1.1',
        relevanceWeight: 80,
        participantIds: [99247],
        snapshotOrdinal: 1,
        observedGameDate: gameDate(1000, 1, 1, 365859),
        observationSource: 'game_data',
        observedAt: '2026-07-22T00:00:00Z',
        votcCheckpointEpoch: 1,
        votcTimelineNodeId: '1-1',
        votcTimelineParentId: undefined,
        ...overrides
    };
}

/**
 * Minimal TimelineRegistry mock that satisfies the isRecordVisibleForContext
 * contract. It tracks a parent->child graph so ancestor checks are realistic:
 * a record captured at node X is visible from node Y only if X is Y or X is an
 * ancestor of Y (i.e. X is on Y's ancestor chain). Sibling nodes do not see
 * each other's records.
 *
 * `currentNodeId` is echoed back so existing call sites that destructure it
 * keep working.
 */
function makeRegistryMock(currentNodeId?: string): {
    registry: TimelineRegistry;
    currentNodeId?: string;
    registerParentChild(parentId: string, childId: string): void;
} {
    const parents = new Map<string, string>(); // childId -> parentId
    const registry = {
        isRecordVisible(recordNodeId: string | undefined, cur: string | undefined): boolean {
            if (!recordNodeId || !cur) return true;
            if (recordNodeId === cur) return true;
            // Walk up from cur to see if recordNodeId is an ancestor.
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

function readStoreFile(userData: string): ChronicleMemoryStoreFile {
    const raw = fs.readFileSync(chronicleMemoryStorePath(userData, IDENTITY), 'utf8');
    return JSON.parse(raw);
}

describe('ChronicleMemoryStore core freeze regression (Task 5 Step 9 - mandatory)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('freezes first-observed description; later dynamic text does NOT overwrite', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        // 1000-01-01 first observation: "唐皇帝李某……"
        await store.observeGameData(
            [baseInput({
                description: '唐皇帝李某，王佑峻的父亲...',
                observedAt: '2026-07-22T00:00:00Z'
            })],
            { registry, currentNodeId }
        );

        // 1001-01-01 same owner/date/type/participants: "乡绅李某……"
        await store.observeGameData(
            [baseInput({
                description: '乡绅李某，王佑峻的父亲...',
                observedAt: '2026-07-23T00:00:00Z'
            })],
            { registry, currentNodeId }
        );

        const file = readStoreFile(userData);
        expect(file.records.length).toBe(1);
        expect(file.records[0].frozen.description).toBe('唐皇帝李某，王佑峻的父亲...');
        expect(file.records[0].observations.length).toBeGreaterThanOrEqual(1);
        // observationCount increased (the second observation merged).
        const totalObservations = file.records[0].observations.reduce((s, o) => s + o.observationCount, 0);
        expect(totalObservations).toBe(2);
        // The second observation's render hash reflects the new dynamic text.
        const newHash = computeRenderedDescriptionHash('乡绅李某，王佑峻的父亲...');
        expect(file.records[0].observations.some(o => o.renderedDescriptionHash === newHash)).toBe(true);
        // memoryKey unchanged.
        const anchor = computeIdentityAnchor({
            ownerId: '121441',
            creationTotalDays: 365859,
            tokenSource: 'localized_name',
            memoryTypeToken: '姑姨死亡',
            participantIds: [99247]
        });
        const expectedKey = computeMemoryKey(anchor, resolveFirstVisibleTimelineAnchor({
            timelineNodeId: '1-1',
            checkpointEpoch: 1
        }), 0);
        expect(file.records[0].memoryKey).toBe(expectedKey);
    });
});

describe('ChronicleMemoryStore observeGameData basic (Task 5 Steps 3-6)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('creates a new frozen record on first observation', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const result = await store.observeGameData([baseInput()], { registry, currentNodeId });

        expect(result.recordCount).toBe(1);
        expect(result.createdCount).toBe(1);
        expect(result.observedCount).toBe(0);

        const file = readStoreFile(userData);
        expect(file.schemaVersion).toBe(1);
        expect(file.campaignId).toBe(IDENTITY.campaignId);
        expect(file.playerId).toBe(IDENTITY.playerId);
        expect(file.records[0].frozen.description).toBe('唐皇帝李某，王佑峻的父亲...');
        expect(file.records[0].frozen.ownerName).toBe('李某');
        expect(file.records[0].frozen.captureSource).toBe('game_data');
        expect(file.records[0].observations[0].observationCount).toBe(1);
    });

    it('merges observation instead of creating a duplicate on repeat observation', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        await store.observeGameData([baseInput()], { registry, currentNodeId });
        await store.observeGameData([baseInput()], { registry, currentNodeId });

        const file = readStoreFile(userData);
        expect(file.records.length).toBe(1);
        expect(file.records[0].observations.length).toBe(1);
        expect(file.records[0].observations[0].observationCount).toBe(2);
    });

    it('persists to disk and reloads on restart (write-through)', async () => {
        const store1 = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        await store1.observeGameData([baseInput()], { registry, currentNodeId });

        // Simulate restart: new store instance, same identity.
        const store2 = new ChronicleMemoryStore(userData, IDENTITY);
        const count = store2.getRecordCount();
        expect(count).toBe(1);

        // Query visible memories after restart.
        const visible = store2.queryVisibleMemories({
            registry,
            currentNodeId,
            checkpointEpoch: 1
        });
        expect(visible.length).toBe(1);
        expect(visible[0].frozen.description).toBe('唐皇帝李某，王佑峻的父亲...');
    });

    it('does not delete a record when a later snapshot no longer contains it', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        await store.observeGameData([baseInput()], { registry, currentNodeId });

        // A later snapshot with an empty memory list.
        await store.observeGameData([], { registry, currentNodeId });

        const file = readStoreFile(userData);
        expect(file.records.length).toBe(1);
    });

    it('ignores inputs with empty ownerId or empty description', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        const result = await store.observeGameData([
            { ...baseInput(), ownerId: '' },
            { ...baseInput(), description: '' },
            baseInput()
        ], { registry, currentNodeId });

        expect(result.recordCount).toBe(1);
        expect(result.createdCount).toBe(1);
    });
});

describe('ChronicleMemoryStore branch visibility (Task 5 Step 7)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('ancestor-node frozen record is reused by a descendant node', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, registerParentChild } = makeRegistryMock();
        // 1-1 is the parent of 1-2, so a record captured at 1-1 is visible
        // from 1-2.
        registerParentChild('1-1', '1-2');

        // First observe at node 1-1.
        await store.observeGameData(
            [baseInput({ votcTimelineNodeId: '1-1' })],
            { registry, currentNodeId: '1-1' }
        );

        // Descendant node 1-2 observes the same memory.
        const before = store.getRecordCount();
        await store.observeGameData(
            [baseInput({ votcTimelineNodeId: '1-2' })],
            { registry, currentNodeId: '1-2' }
        );
        const after = store.getRecordCount();

        // No new record created: the ancestor's frozen record is reused.
        expect(after).toBe(before);
    });

    it('sibling-branch records are not reused by the other sibling', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry } = makeRegistryMock();

        // Sibling A at node 1-1 observes a memory with dynamic text variant A.
        await store.observeGameData(
            [baseInput({
                description: '兄弟A看到的描述',
                votcTimelineNodeId: '1-1'
            })],
            { registry, currentNodeId: '1-1' }
        );

        // Sibling B at node 2-1: 1-1 is NOT an ancestor of 2-1.
        // The registry mock returns false for isRecordVisible('1-1','2-1').
        const before = store.getRecordCount();
        await store.observeGameData(
            [baseInput({
                description: '兄弟B看到的描述',
                votcTimelineNodeId: '2-1'
            })],
            { registry, currentNodeId: '2-1' }
        );
        const after = store.getRecordCount();

        // A new record was created for sibling B; A's frozen text is intact.
        expect(after).toBe(before + 1);
        const file = readStoreFile(userData);
        expect(file.records.some(r => r.frozen.description === '兄弟A看到的描述')).toBe(true);
        expect(file.records.some(r => r.frozen.description === '兄弟B看到的描述')).toBe(true);
    });

    it('queryVisibleMemories excludes sibling-branch records', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry } = makeRegistryMock();
        await store.observeGameData(
            [baseInput({ votcTimelineNodeId: '1-1' })],
            { registry, currentNodeId: '1-1' }
        );
        await store.observeGameData(
            [baseInput({ votcTimelineNodeId: '2-1' })],
            { registry, currentNodeId: '2-1' }
        );

        // Querying from 1-1 should NOT see the 2-1 record.
        const visible = store.queryVisibleMemories({
            registry,
            currentNodeId: '1-1',
            checkpointEpoch: 1
        });
        expect(visible.length).toBe(1);
        expect(visible.every(r => r.frozen.capturedTimelineNodeId === '1-1')).toBe(true);
    });
});

describe('ChronicleMemoryStore collision (Task 5 Step 4 - same owner/date/type)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('same owner/date/type but different participants produce distinct records (distinct anchors)', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        // Two memories: same owner, same creation date, same type token, but
        // different participants. Because participantIds are part of the
        // identityAnchor, these get distinct anchors -> distinct records, each
        // with collisionSlot 0 (collision slots are scoped per-anchor).
        await store.observeGameData(
            [
                baseInput({
                    participantIds: [111],
                    description: '参与者111的记忆',
                    snapshotOrdinal: 1
                }),
                baseInput({
                    participantIds: [222],
                    description: '参与者222的记忆',
                    snapshotOrdinal: 2
                })
            ],
            { registry, currentNodeId }
        );

        const file = readStoreFile(userData);
        expect(file.records.length).toBe(2);
        // Each record is the first in its own anchor group -> slot 0.
        expect(file.records.every(r => r.collisionSlot === 0)).toBe(true);
        // They have distinct identityAnchors (participants differ).
        const anchors = new Set(file.records.map(r => r.identityAnchor));
        expect(anchors.size).toBe(2);
    });

    it('same identity in one snapshot with distinct snapshotOrdinals creates distinct collision slots', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        // One snapshot emits two memories with the SAME identity fields
        // (owner/date/type/participants) but different snapshotOrdinals and
        // different descriptions. These are genuine collisions within the same
        // anchor group: each gets its own collision slot rather than being
        // merged (they are distinct underlying memories that share identity
        // fields because CK3 has no stable per-memory ID).
        await store.observeGameData(
            [
                baseInput({ description: '碰撞A', snapshotOrdinal: 1 }),
                baseInput({ description: '碰撞B', snapshotOrdinal: 2 })
            ],
            { registry, currentNodeId }
        );

        const file = readStoreFile(userData);
        expect(file.records.length).toBe(2);
        const slots = file.records.map(r => r.collisionSlot).sort();
        expect(slots).toEqual([0, 1]);
        // Same anchor.
        const anchors = new Set(file.records.map(r => r.identityAnchor));
        expect(anchors.size).toBe(1);
        // Both frozen descriptions preserved.
        expect(file.records.some(r => r.frozen.description === '碰撞A')).toBe(true);
        expect(file.records.some(r => r.frozen.description === '碰撞B')).toBe(true);
    });

    it('same owner/date/type/participants on repeat observation reuses the same slot', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        await store.observeGameData([baseInput()], { registry, currentNodeId });
        await store.observeGameData([baseInput()], { registry, currentNodeId });

        const file = readStoreFile(userData);
        expect(file.records.length).toBe(1);
        expect(file.records[0].collisionSlot).toBe(0);
    });

    it('group shrinks: does not delete old collision slots', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        // First snapshot: two distinct memories.
        await store.observeGameData(
            [
                baseInput({ participantIds: [111], description: 'A', snapshotOrdinal: 1 }),
                baseInput({ participantIds: [222], description: 'B', snapshotOrdinal: 2 })
            ],
            { registry, currentNodeId }
        );

        // Second snapshot: only one of them appears.
        await store.observeGameData(
            [baseInput({ participantIds: [111], description: 'A', snapshotOrdinal: 1 })],
            { registry, currentNodeId }
        );

        const file = readStoreFile(userData);
        // Both records still exist; the absent one was not pruned.
        expect(file.records.length).toBe(2);
    });
});

describe('ChronicleMemoryStore file corruption recovery (Task 5 + Task 4 Step 4)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('recovers from corrupt primary using .bak', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        await store.observeGameData([baseInput()], { registry, currentNodeId });

        const primaryPath = chronicleMemoryStorePath(userData, IDENTITY);
        const backupPath = chronicleMemoryBackupPath(userData, IDENTITY);

        // Rotate a valid backup, then corrupt the primary.
        const primaryContent = fs.readFileSync(primaryPath, 'utf8');
        fs.writeFileSync(backupPath, primaryContent, 'utf8');
        fs.writeFileSync(primaryPath, '{corrupt', 'utf8');

        // A new store instance should recover from the backup.
        const recovered = new ChronicleMemoryStore(userData, IDENTITY);
        expect(recovered.getRecordCount()).toBe(1);

        // The corrupt primary should have been quarantined.
        expect(fs.existsSync(primaryPath)).toBe(true); // rewritten from backup
        const newContent = fs.readFileSync(primaryPath, 'utf8');
        expect(newContent).toBe(primaryContent);
    });

    it('fails closed (chronicle_corrupt) when both primary and backup are corrupt', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        await store.observeGameData([baseInput()], { registry, currentNodeId });

        const primaryPath = chronicleMemoryStorePath(userData, IDENTITY);
        const backupPath = chronicleMemoryBackupPath(userData, IDENTITY);

        fs.writeFileSync(backupPath, '{also corrupt', 'utf8');
        fs.writeFileSync(primaryPath, '{corrupt', 'utf8');

        const recovered = new ChronicleMemoryStore(userData, IDENTITY);
        let thrown: unknown;
        try {
            recovered.getRecordCount();
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_corrupt');

        // Both files quarantined.
        expect(fs.existsSync(primaryPath)).toBe(false);
        expect(fs.existsSync(backupPath)).toBe(false);
    });

    it('does not silently create an empty store over corrupt evidence', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        await store.observeGameData([baseInput()], { registry, currentNodeId });

        const primaryPath = chronicleMemoryStorePath(userData, IDENTITY);
        const backupPath = chronicleMemoryBackupPath(userData, IDENTITY);

        // Corrupt the primary, no backup present.
        fs.writeFileSync(primaryPath, '{corrupt', 'utf8');

        const recovered = new ChronicleMemoryStore(userData, IDENTITY);
        let thrown: unknown;
        try {
            recovered.getRecordCount();
        } catch (error) {
            thrown = error;
        }
        // A corrupt primary with no backup must fail closed rather than
        // silently mask data loss as an empty store (design §"文件损坏与恢复").
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_corrupt');

        // The corrupt primary was quarantined (not overwritten in place).
        const dir = path.dirname(primaryPath);
        const quarantineFiles = fs.readdirSync(dir).filter(f => f.includes('.corrupt.'));
        expect(quarantineFiles.length).toBeGreaterThanOrEqual(1);
        // No primary left (it was quarantined; nothing was rewritten).
        expect(fs.existsSync(primaryPath)).toBe(false);
        expect(fs.existsSync(backupPath)).toBe(false);
    });
});

describe('ChronicleMemoryStore isolation (Task 5 Step 8 - campaign/player)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('writes for one identity never touch another identity store', async () => {
        const store = new ChronicleMemoryStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        await store.observeGameData([baseInput()], { registry, currentNodeId });

        const ownPath = chronicleMemoryStorePath(userData, IDENTITY);
        const otherPath = chronicleMemoryStorePath(userData, OTHER_IDENTITY);

        expect(fs.existsSync(ownPath)).toBe(true);
        expect(fs.existsSync(otherPath)).toBe(false);

        // Observing under the other identity creates a separate file.
        const otherStore = new ChronicleMemoryStore(userData, OTHER_IDENTITY);
        await otherStore.observeGameData([baseInput()], { registry, currentNodeId });
        expect(fs.existsSync(otherPath)).toBe(true);

        // The other store has its own record; the first store is untouched.
        const ownFile = JSON.parse(fs.readFileSync(ownPath, 'utf8'));
        const otherFile = JSON.parse(fs.readFileSync(otherPath, 'utf8'));
        expect(ownFile.playerId).toBe(IDENTITY.playerId);
        expect(otherFile.playerId).toBe(OTHER_IDENTITY.playerId);
        expect(ownFile.records.length).toBe(1);
        expect(otherFile.records.length).toBe(1);
    });
});
