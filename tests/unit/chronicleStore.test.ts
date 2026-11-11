import { ChronicleStore } from '../../src/main/chronicle/ChronicleStore';
import {
    ChronicleStoreError
} from '../../src/main/chronicle/chronicleAtomicJson';
import type {
    ChronicleEntry,
    ChronicleEntriesFile,
    ChronicleAttemptsFile,
    ChronicleGenerationAttempt,
    ChronicleEntrySourceStats
} from '../../src/main/chronicle/chronicleTypes';
import {
    chronicleEntriesPath,
    chronicleAttemptsPath
} from '../../src/main/campaignDataPaths';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import type { Ck3GameDate } from '../../src/shared/gameData/gameDate';
import type { TimelineRegistry } from '../../src/main/timelineManager';
import fs from 'fs';
import path from 'path';
import os from 'os';

const IDENTITY = buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, 'player-1001');

function makeTmpUserData(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'votc-chronicle-store-'));
}

function gameDate(year: number, month: number, day: number, totalDays: number): Ck3GameDate {
    return { totalDays, year, month, day, display: `${year}.${month}.${day}` };
}

const PERIOD_START = gameDate(1065, 1, 1, 388432);
const PERIOD_END = gameDate(1067, 1, 1, 389163);
const FUTURE_END = gameDate(1100, 1, 1, 401234);
const CURRENT_DATE = gameDate(1080, 1, 1, 393920);

/**
 * Minimal TimelineRegistry mock (same shape as chronicleMemoryStore.test).
 * A record captured at node X is visible from node Y only if X is Y or X is an
 * ancestor of Y.
 */
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

function emptySourceStats(): ChronicleEntrySourceStats {
    return {
        total: 0,
        rawConversationCount: 0,
        summarizedConversationCount: 0,
        memoryCount: 0,
        digestedMemoryCount: 0,
        letterCount: 0,
        battleReportCount: 0,
        rawVisibleChars: 0,
        selectedVisibleChars: 0,
        promptInputTokens: 0
    };
}

function baseEntry(overrides: Partial<ChronicleEntry> = {}): ChronicleEntry {
    return {
        schemaVersion: 1,
        id: 'entry-001',
        status: 'ready',
        reason: 'quarterly',
        playerId: IDENTITY.playerId,
        playerName: '李某',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        title: '1065-1067 年记',
        content: '春正月，王即位。',
        sourceManifest: [],
        sourceDigest: 'abc123',
        promptVersion: 1,
        generatedAt: '2026-07-23T00:00:00Z',
        revision: 0,
        sourceStats: emptySourceStats(),
        votcCheckpointEpoch: 1,
        votcTimelineNodeId: '1-1',
        ...overrides
    };
}

function readEntriesFile(userData: string): ChronicleEntriesFile {
    const raw = fs.readFileSync(chronicleEntriesPath(userData, IDENTITY), 'utf8');
    return JSON.parse(raw);
}

function readAttemptsFile(userData: string): ChronicleAttemptsFile {
    const raw = fs.readFileSync(chronicleAttemptsPath(userData, IDENTITY), 'utf8');
    return JSON.parse(raw);
}

describe('ChronicleStore entry save/load (Task 10 Step 3)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('saves and reloads an entry across restart', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.saveEntry(baseEntry());

        const store2 = new ChronicleStore(userData, IDENTITY);
        const entry = store2.getEntry('entry-001');
        expect(entry).toBeDefined();
        expect(entry!.title).toBe('1065-1067 年记');
        expect(entry!.content).toBe('春正月，王即位。');
        expect(entry!.revision).toBe(0);
    });

    it('increments revision when re-editing the same entry ID', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.saveEntry(baseEntry({ content: '初版' }));
        store.saveEntry(baseEntry({ content: '修订版', generatedAt: '2026-07-24T00:00:00Z' }));

        const file = readEntriesFile(userData);
        expect(file.entries.length).toBe(1);
        expect(file.entries[0].revision).toBe(1);
        expect(file.entries[0].content).toBe('修订版');
    });

    it('preserves sibling-branch entries (does not delete on re-edit)', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.saveEntry(baseEntry({
            id: 'entry-A',
            content: '分支A正文',
            votcTimelineNodeId: '1-1'
        }));
        store.saveEntry(baseEntry({
            id: 'entry-B',
            content: '分支B正文',
            votcTimelineNodeId: '2-1'
        }));

        const file = readEntriesFile(userData);
        expect(file.entries.length).toBe(2);
        expect(file.entries.some(e => e.id === 'entry-A')).toBe(true);
        expect(file.entries.some(e => e.id === 'entry-B')).toBe(true);
    });

    it('write-through: file is durably persisted before saveEntry returns', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.saveEntry(baseEntry());
        expect(fs.existsSync(chronicleEntriesPath(userData, IDENTITY))).toBe(true);
        const file = readEntriesFile(userData);
        expect(file.schemaVersion).toBe(1);
        expect(file.campaignId).toBe(IDENTITY.campaignId);
        expect(file.playerId).toBe(IDENTITY.playerId);
    });
});

describe('ChronicleStore branch visibility (Task 10 Step 3)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('queryVisibleEntries excludes sibling-branch entries', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        store.saveEntry(baseEntry({
            id: 'entry-A',
            votcTimelineNodeId: '1-1'
        }));
        store.saveEntry(baseEntry({
            id: 'entry-B',
            votcTimelineNodeId: '2-1'
        }));

        const visible = store.queryVisibleEntries({
            registry,
            currentNodeId,
            currentGameDate: CURRENT_DATE
        });
        expect(visible.length).toBe(1);
        expect(visible[0].id).toBe('entry-A');
    });

    it('queryVisibleEntries includes ancestor-branch entries visible from descendant', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        const { registry, registerParentChild, currentNodeId } = makeRegistryMock('1-2');
        registerParentChild('1-1', '1-2');

        store.saveEntry(baseEntry({
            id: 'entry-ancestor',
            votcTimelineNodeId: '1-1'
        }));

        const visible = store.queryVisibleEntries({
            registry,
            currentNodeId,
            currentGameDate: CURRENT_DATE
        });
        expect(visible.length).toBe(1);
        expect(visible[0].id).toBe('entry-ancestor');
    });

    it('queryVisibleEntries excludes entries whose periodEnd is in the future', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        store.saveEntry(baseEntry({
            id: 'entry-past',
            periodEnd: PERIOD_END
        }));
        store.saveEntry(baseEntry({
            id: 'entry-future',
            periodEnd: FUTURE_END
        }));

        const visible = store.queryVisibleEntries({
            registry,
            currentNodeId,
            currentGameDate: CURRENT_DATE
        });
        expect(visible.length).toBe(1);
        expect(visible[0].id).toBe('entry-past');
    });

    it('queryVisibleEntries hides empty coverage by default but includes it when asked', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        const { registry, currentNodeId } = makeRegistryMock('1-1');
        store.saveEntry(baseEntry({
            id: 'entry-ready',
            status: 'ready',
            content: '有内容'
        }));
        store.saveEntry(baseEntry({
            id: 'entry-empty',
            status: 'empty',
            content: undefined
        }));

        const defaultVisible = store.queryVisibleEntries({
            registry,
            currentNodeId,
            currentGameDate: CURRENT_DATE
        });
        expect(defaultVisible.length).toBe(1);
        expect(defaultVisible[0].id).toBe('entry-ready');

        const withEmpty = store.queryVisibleEntries({
            registry,
            currentNodeId,
            currentGameDate: CURRENT_DATE,
            includeEmpty: true
        });
        expect(withEmpty.length).toBe(2);
    });
});

describe('ChronicleStore attempt state machine (Task 10 Step 4)', () => {
    let userData: string;
    const REQUEST_KEY = 'chronicle:1-2-3-4:player-1001:388432:389163:1-1:quarterly';

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('beginAttempt creates a running attempt and persists it', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        const attempt = store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');

        expect(attempt.status).toBe('running');
        expect(attempt.requestKey).toBe(REQUEST_KEY);
        expect(attempt.startedAt).toBeDefined();

        const file = readAttemptsFile(userData);
        expect(file.attempts.length).toBe(1);
        expect(file.attempts[0].status).toBe('running');
    });

    it('beginAttempt is idempotent: same requestKey with running status returns existing', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        const first = store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');
        const second = store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');

        expect(second).toEqual(first);
        const file = readAttemptsFile(userData);
        expect(file.attempts.length).toBe(1);
    });

    it('pending -> running -> committed (happy path)', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');
        store.saveEntry(baseEntry({ id: 'entry-001' }));

        store.completeAttempt(REQUEST_KEY, 'entry-001');

        const attempt = store.getAttempt(REQUEST_KEY);
        expect(attempt!.status).toBe('committed');
        expect(attempt!.entryId).toBe('entry-001');
        expect(attempt!.completedAt).toBeDefined();
    });

    it('pending -> running -> failed (error path)', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');

        store.failAttempt(REQUEST_KEY, 'API_TIMEOUT', 'model request timed out');

        const attempt = store.getAttempt(REQUEST_KEY);
        expect(attempt!.status).toBe('failed');
        expect(attempt!.sanitizedErrorCode).toBe('API_TIMEOUT');
        expect(attempt!.sanitizedErrorMessage).toBe('model request timed out');
    });

    it('failed -> running (retry)', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');
        store.failAttempt(REQUEST_KEY, 'API_TIMEOUT', 'timed out');

        store.retryAttempt(REQUEST_KEY);

        const attempt = store.getAttempt(REQUEST_KEY);
        expect(attempt!.status).toBe('running');
        expect(attempt!.sanitizedErrorCode).toBeUndefined();
    });

    it('committed + digest change -> running revision (beginRevision)', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'digest-v1');
        store.saveEntry(baseEntry({ id: 'entry-001', sourceDigest: 'digest-v1' }));
        store.completeAttempt(REQUEST_KEY, 'entry-001');

        store.beginRevision(REQUEST_KEY, 'digest-v2');

        const attempt = store.getAttempt(REQUEST_KEY);
        expect(attempt!.status).toBe('running');
        expect(attempt!.sourceDigest).toBe('digest-v2');
        expect(attempt!.entryId).toBeUndefined();
    });

    it('FORBIDDEN: completeAttempt without a written entry throws', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');

        expect(() => store.completeAttempt(REQUEST_KEY, 'entry-999')).toThrow();
        const attempt = store.getAttempt(REQUEST_KEY);
        expect(attempt!.status).toBe('running');
    });

    it('FORBIDDEN: completeAttempt with a non-existent entryId throws', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');
        store.saveEntry(baseEntry({ id: 'entry-real' }));

        expect(() => store.completeAttempt(REQUEST_KEY, 'entry-nonexistent')).toThrow();
        const attempt = store.getAttempt(REQUEST_KEY);
        expect(attempt!.status).toBe('running');
    });

    it('illegal transition: completeAttempt on a failed attempt throws', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');
        store.failAttempt(REQUEST_KEY, 'ERR', 'fail');

        expect(() => store.completeAttempt(REQUEST_KEY, 'entry-001')).toThrow();
    });

    it('illegal transition: failAttempt on a committed attempt throws', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');
        store.saveEntry(baseEntry({ id: 'entry-001' }));
        store.completeAttempt(REQUEST_KEY, 'entry-001');

        expect(() => store.failAttempt(REQUEST_KEY, 'ERR', 'fail')).toThrow();
    });

    it('illegal transition: retryAttempt on a committed attempt throws', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');
        store.saveEntry(baseEntry({ id: 'entry-001' }));
        store.completeAttempt(REQUEST_KEY, 'entry-001');

        expect(() => store.retryAttempt(REQUEST_KEY)).toThrow();
    });

    it('illegal transition: beginRevision on a running attempt throws', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');

        expect(() => store.beginRevision(REQUEST_KEY, 'digest-v2')).toThrow();
    });

    it('beginRevision with same digest is idempotent (returns committed attempt)', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'digest-v1');
        store.saveEntry(baseEntry({ id: 'entry-001', sourceDigest: 'digest-v1' }));
        store.completeAttempt(REQUEST_KEY, 'entry-001');

        const result = store.beginRevision(REQUEST_KEY, 'digest-v1');
        expect(result.status).toBe('committed');
        const file = readAttemptsFile(userData);
        expect(file.attempts.length).toBe(1);
    });

    it('beginRevision can force an explicit user regeneration with the same digest', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'digest-v1');
        store.saveEntry(baseEntry({ id: 'entry-001', sourceDigest: 'digest-v1' }));
        store.completeAttempt(REQUEST_KEY, 'entry-001');

        const result = store.beginRevision(REQUEST_KEY, 'digest-v1', true);
        expect(result.status).toBe('running');
        expect(result.entryId).toBeUndefined();
    });

    it('beginAttempt on a committed attempt with same digest returns existing', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'digest-v1');
        store.saveEntry(baseEntry({ id: 'entry-001', sourceDigest: 'digest-v1' }));
        store.completeAttempt(REQUEST_KEY, 'entry-001');

        const again = store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'digest-v1');
        expect(again.status).toBe('committed');
    });

    it('state-machine errors use chronicle_invalid_state, not chronicle_corrupt', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'digest-v1');
        store.saveEntry(baseEntry({ id: 'entry-001', sourceDigest: 'digest-v1' }));
        store.completeAttempt(REQUEST_KEY, 'entry-001');

        const expectCode = (fn: () => void, code: string) => {
            let thrown: unknown;
            try { fn(); } catch (error) { thrown = error; }
            expect(thrown).toBeInstanceOf(ChronicleStoreError);
            expect((thrown as ChronicleStoreError).code).toBe(code);
        };

        expectCode(
            () => store.completeAttempt(REQUEST_KEY, 'entry-001'),
            'chronicle_invalid_state'
        );
        expectCode(
            () => store.failAttempt(REQUEST_KEY, 'ERR', 'fail'),
            'chronicle_invalid_state'
        );
        expectCode(
            () => store.retryAttempt(REQUEST_KEY),
            'chronicle_invalid_state'
        );

        const store2 = new ChronicleStore(userData, IDENTITY);
        expectCode(
            () => store2.beginAttempt(REQUEST_KEY, 1, 10, 'changed-digest'),
            'chronicle_invalid_state'
        );
    });

    it('attempt-not-found errors use chronicle_attempt_not_found, not chronicle_corrupt', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        const expectCode = (fn: () => void, code: string) => {
            let thrown: unknown;
            try { fn(); } catch (error) { thrown = error; }
            expect(thrown).toBeInstanceOf(ChronicleStoreError);
            expect((thrown as ChronicleStoreError).code).toBe(code);
        };

        expectCode(() => store.completeAttempt('missing', 'entry-001'), 'chronicle_attempt_not_found');
        expectCode(() => store.failAttempt('missing', 'ERR', 'fail'), 'chronicle_attempt_not_found');
        expectCode(() => store.retryAttempt('missing'), 'chronicle_attempt_not_found');
        expectCode(() => store.beginRevision('missing', 'digest'), 'chronicle_attempt_not_found');
    });

    it('entry-not-found on completeAttempt uses chronicle_entry_not_found, not chronicle_corrupt', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');

        let thrown: unknown;
        try { store.completeAttempt(REQUEST_KEY, 'entry-missing'); } catch (error) { thrown = error; }
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_entry_not_found');
    });
});

describe('ChronicleStore attempt queries (Task 10)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('queryAttempts returns all attempts', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt('key-1', 1, 10, 'd1');
        store.beginAttempt('key-2', 11, 20, 'd2');

        const all = store.queryAttempts();
        expect(all.length).toBe(2);
    });

    it('findAttemptByPeriod finds an existing attempt by period days', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt('key-1', PERIOD_START.totalDays, PERIOD_END.totalDays, 'd1');

        const found = store.findAttemptByPeriod(PERIOD_START.totalDays, PERIOD_END.totalDays);
        expect(found).toBeDefined();
        expect(found!.requestKey).toBe('key-1');
    });

    it('findAttemptByPeriod returns undefined when no match', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt('key-1', PERIOD_START.totalDays, PERIOD_END.totalDays, 'd1');

        const found = store.findAttemptByPeriod(1, 5);
        expect(found).toBeUndefined();
    });
});

describe('ChronicleStore crash window recovery (Task 10 Step 5)', () => {
    let userData: string;
    const REQUEST_KEY = 'chronicle:1-2-3-4:player-1001:388432:389163:1-1:quarterly';

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('crash after attempt running -> restart recovers, same requestKey does not duplicate', () => {
        const store1 = new ChronicleStore(userData, IDENTITY);
        store1.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');

        const store2 = new ChronicleStore(userData, IDENTITY);
        const attempt = store2.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');

        expect(attempt.status).toBe('running');
        const file = readAttemptsFile(userData);
        expect(file.attempts.length).toBe(1);
    });

    it('crash after entry tmp written but before rename -> restart recovers valid state', () => {
        const store1 = new ChronicleStore(userData, IDENTITY);
        store1.saveEntry(baseEntry({ id: 'entry-001' }));

        const entriesPath = chronicleEntriesPath(userData, IDENTITY);
        const tmpPath = `${entriesPath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(baseEntry({ id: 'entry-001' })), 'utf8');

        const store2 = new ChronicleStore(userData, IDENTITY);
        const entry = store2.getEntry('entry-001');
        expect(entry).toBeDefined();
        expect(entry!.id).toBe('entry-001');
    });

    it('crash after entry committed but attempt not committed -> entry visible, attempt not committed', () => {
        const store1 = new ChronicleStore(userData, IDENTITY);
        store1.beginAttempt(REQUEST_KEY, PERIOD_START.totalDays, PERIOD_END.totalDays, 'abc123');
        store1.saveEntry(baseEntry({ id: 'entry-001' }));

        const store2 = new ChronicleStore(userData, IDENTITY);
        const entry = store2.getEntry('entry-001');
        expect(entry).toBeDefined();

        const attempt = store2.getAttempt(REQUEST_KEY);
        expect(attempt).toBeDefined();
        expect(attempt!.status).toBe('running');
    });
});

describe('ChronicleStore corruption recovery (Task 10 Step 2)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('recovers entries.json from .bak when primary is corrupt', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.saveEntry(baseEntry({ id: 'entry-001' }));

        const primaryPath = chronicleEntriesPath(userData, IDENTITY);
        const backupPath = `${primaryPath}.bak`;
        const primaryContent = fs.readFileSync(primaryPath, 'utf8');
        fs.writeFileSync(backupPath, primaryContent, 'utf8');
        fs.writeFileSync(primaryPath, '{corrupt', 'utf8');

        const recovered = new ChronicleStore(userData, IDENTITY);
        const entry = recovered.getEntry('entry-001');
        expect(entry).toBeDefined();
    });

    it('fails closed when entries primary and backup are both corrupt', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.saveEntry(baseEntry({ id: 'entry-001' }));

        const primaryPath = chronicleEntriesPath(userData, IDENTITY);
        const backupPath = `${primaryPath}.bak`;
        fs.writeFileSync(backupPath, '{also corrupt', 'utf8');
        fs.writeFileSync(primaryPath, '{corrupt', 'utf8');

        const recovered = new ChronicleStore(userData, IDENTITY);
        let thrown: unknown;
        try {
            recovered.getEntry('entry-001');
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_corrupt');
    });

    it('recovers attempts.json from .bak when primary is corrupt', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt('key-1', 1, 10, 'd1');

        const primaryPath = chronicleAttemptsPath(userData, IDENTITY);
        const backupPath = `${primaryPath}.bak`;
        const primaryContent = fs.readFileSync(primaryPath, 'utf8');
        fs.writeFileSync(backupPath, primaryContent, 'utf8');
        fs.writeFileSync(primaryPath, '{corrupt', 'utf8');

        const recovered = new ChronicleStore(userData, IDENTITY);
        const attempt = recovered.getAttempt('key-1');
        expect(attempt).toBeDefined();
    });

    it('rejects entries file with wrong schemaVersion', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.saveEntry(baseEntry({ id: 'entry-001' }));

        const primaryPath = chronicleEntriesPath(userData, IDENTITY);
        const content = JSON.parse(fs.readFileSync(primaryPath, 'utf8'));
        content.schemaVersion = 99;
        fs.writeFileSync(primaryPath, JSON.stringify(content), 'utf8');

        const recovered = new ChronicleStore(userData, IDENTITY);
        let thrown: unknown;
        try {
            recovered.getEntry('entry-001');
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_corrupt');
    });

    it('rejects entries file with mismatched playerId', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.saveEntry(baseEntry({ id: 'entry-001' }));

        const primaryPath = chronicleEntriesPath(userData, IDENTITY);
        const content = JSON.parse(fs.readFileSync(primaryPath, 'utf8'));
        content.playerId = 'someone-else';
        fs.writeFileSync(primaryPath, JSON.stringify(content), 'utf8');

        const recovered = new ChronicleStore(userData, IDENTITY);
        let thrown: unknown;
        try {
            recovered.getEntry('entry-001');
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
    });
});

describe('ChronicleStore error sanitization (Task 10 Step 4)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('failAttempt strips overly long error messages', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt('key-1', 1, 10, 'd1');

        const longMessage = 'x'.repeat(5000);
        store.failAttempt('key-1', 'ERR', longMessage);

        const attempt = store.getAttempt('key-1');
        expect(attempt!.sanitizedErrorMessage!.length).toBeLessThan(longMessage.length);
    });

    it('failAttempt does not store API keys passed as error messages', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt('key-1', 1, 10, 'd1');

        const keyLikeMessage = 'sk-abc123secretkey456789xyz';
        store.failAttempt('key-1', 'ERR', keyLikeMessage);

        const attempt = store.getAttempt('key-1');
        expect(attempt!.sanitizedErrorMessage).not.toContain('sk-abc123secretkey456789xyz');
    });

    it('failAttempt redacts Anthropic and Google API keys', () => {
        const store = new ChronicleStore(userData, IDENTITY);
        store.beginAttempt('key-1', 1, 10, 'd1');

        const anthropicKey = 'sk-ant-api03-1234567890abcdefghijklmnop';
        const googleKey = 'AIzaSyA1234567890abcdefghijklmnop';
        store.failAttempt('key-1', 'ERR', `err: ${anthropicKey} ${googleKey}`);

        const attempt = store.getAttempt('key-1');
        expect(attempt!.sanitizedErrorMessage).not.toContain(anthropicKey);
        expect(attempt!.sanitizedErrorMessage).not.toContain(googleKey);
        expect(attempt!.sanitizedErrorMessage).toContain('[REDACTED_KEY]');
    });
});
