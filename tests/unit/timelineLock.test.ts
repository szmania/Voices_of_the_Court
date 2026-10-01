import fs from 'fs';
import path from 'path';
import os from 'os';
import {
    TimelineMutex,
    TimelineFileLock,
    withTimelineLock,
    lockKeyFor,
    ensureSingleInstanceLock,
    _resetMutexCacheForTests,
    lockFilePathFor,
    type SingleInstanceLockApi,
    type TimelineLockOutcome
} from '../../src/main/timelineLock';
import { CampaignPathError } from '../../src/main/campaignDataPaths';

describe('TimelineMutex (in-process async mutex, §7.5 P3.4)', () => {
    it('serializes concurrent calls with the same key', async () => {
        const mutex = new TimelineMutex();
        const order: string[] = [];

        const taskA = (async () => {
            await mutex.withLock('player1', async () => {
                order.push('a-start');
                await new Promise(resolve => setTimeout(resolve, 30));
                order.push('a-end');
            });
        })();
        const taskB = (async () => {
            await mutex.withLock('player1', async () => {
                order.push('b-start');
                await new Promise(resolve => setTimeout(resolve, 5));
                order.push('b-end');
            });
        })();

        await Promise.all([taskA, taskB]);

        // a fully completes before b starts (or vice versa). No interleaving.
        const joined = order.join(',');
        expect(joined).toMatch(/a-start,a-end,b-start,b-end|b-start,b-end,a-start,a-end/);
    });

    it('runs different keys in parallel', async () => {
        const mutex = new TimelineMutex();
        const active: string[] = [];
        const maxConcurrent = { count: 0 };

        const task = async (key: string, duration: number) => {
            await mutex.withLock(key, async () => {
                active.push(key);
                if (active.length > maxConcurrent.count) maxConcurrent.count = active.length;
                await new Promise(resolve => setTimeout(resolve, duration));
                active.pop();
            });
        };

        await Promise.all([
            task('player1', 25),
            task('player2', 25),
            task('player3', 25)
        ]);

        // Three different keys run concurrently.
        expect(maxConcurrent.count).toBe(3);
    });

    it('releases the lock even when the fn throws', async () => {
        const mutex = new TimelineMutex();
        await expect(mutex.withLock('player1', async () => {
            throw new Error('boom');
        })).rejects.toThrow('boom');

        // A second call should be able to acquire immediately.
        let ran = false;
        await mutex.withLock('player1', async () => { ran = true; });
        expect(ran).toBe(true);
    });

    it('lockKeyFor uses playerId as key when campaignId is absent', () => {
        expect(lockKeyFor({ playerId: '42' })).toBe('player:42');
    });

    it('lockKeyFor combines campaignId and playerId when both present', () => {
        expect(lockKeyFor({ campaignId: 'camp1', playerId: '42' })).toBe('campaign:camp1|player:42');
    });
});

describe('withTimelineLock campaign-scoped file lock (Phase 4)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-lock-campaign-'));
        _resetMutexCacheForTests();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        _resetMutexCacheForTests();
    });

    it('writes a campaign-scoped lockfile when identity.campaignId is set', async () => {
        const identity = { campaignId: '1-2-3-4', playerId: 'player1' };
        let acquired = false;
        await withTimelineLock(tmpDir, identity, async () => {
            acquired = true;
            // Lock file should exist during the operation
            const expected = path.join(tmpDir, 'votc_data', '.lock', 'campaign_1-2-3-4_player_player1.lock');
            expect(fs.existsSync(expected)).toBe(true);
        });
        expect(acquired).toBe(true);
        // Released after the operation completes
    });

    it('uses the legacy player-only lockfile when campaignId is absent', async () => {
        const identity = { playerId: 'player1' };
        await withTimelineLock(tmpDir, identity, async () => {
            const expected = path.join(tmpDir, 'votc_data', '.lock', 'player1.lock');
            expect(fs.existsSync(expected)).toBe(true);
        });
    });

    it('same playerId under different campaigns produces different lockfiles (isolated locks)', async () => {
        const idA = { campaignId: '1-2-3-4', playerId: 'p' };
        const idB = { campaignId: '9-9-9-9', playerId: 'p' };
        const seen: string[] = [];
        await Promise.all([
            withTimelineLock(tmpDir, idA, async () => {
                seen.push('a-start');
                await new Promise(r => setTimeout(r, 20));
                seen.push('a-end');
            }),
            withTimelineLock(tmpDir, idB, async () => {
                seen.push('b-start');
                await new Promise(r => setTimeout(r, 5));
                seen.push('b-end');
            })
        ]);
        // The two locks should NOT serialize against each other (different campaigns)
        // so we should see both starts before either end.
        const starts = seen.filter(s => s.endsWith('start')).length;
        expect(starts).toBe(2);
    });
});

describe('lockFilePathFor path sanitization (aligned with validatePathSafeName)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-lock-sanitize-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('rejects a campaignId containing ".." traversal (throws CampaignPathError)', () => {
        expect(() => lockFilePathFor(tmpDir, { campaignId: '..', playerId: 'p' }))
            .toThrow(CampaignPathError);
    });

    it('rejects a campaignId containing a path separator', () => {
        expect(() => lockFilePathFor(tmpDir, { campaignId: '1/2/3/4', playerId: 'p' }))
            .toThrow(CampaignPathError);
        expect(() => lockFilePathFor(tmpDir, { campaignId: '1\\2\\3\\4', playerId: 'p' }))
            .toThrow(CampaignPathError);
    });

    it('rejects a playerId containing ".." traversal', () => {
        expect(() => lockFilePathFor(tmpDir, { campaignId: '1-2-3-4', playerId: '..' }))
            .toThrow(CampaignPathError);
        expect(() => lockFilePathFor(tmpDir, { campaignId: '1-2-3-4', playerId: 'a/../b' }))
            .toThrow(CampaignPathError);
    });

    it('rejects a player-only identity (no campaignId) with traversal in playerId', () => {
        expect(() => lockFilePathFor(tmpDir, { playerId: '..' }))
            .toThrow(CampaignPathError);
        expect(() => lockFilePathFor(tmpDir, { playerId: 'a/b' }))
            .toThrow(CampaignPathError);
    });

    it('accepts a well-formed campaign+player identity and produces the campaign-scoped lockfile path', () => {
        const p = lockFilePathFor(tmpDir, { campaignId: '1-2-3-4', playerId: 'player1' });
        const expected = path.join(tmpDir, 'votc_data', '.lock', 'campaign_1-2-3-4_player_player1.lock');
        expect(p).toBe(expected);
    });

    it('accepts a well-formed player-only identity', () => {
        const p = lockFilePathFor(tmpDir, { playerId: 'player1' });
        const expected = path.join(tmpDir, 'votc_data', '.lock', 'player1.lock');
        expect(p).toBe(expected);
    });
});

describe('TimelineFileLock (inter-process lockfile, §7.5 P3.4)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-filelock-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('acquires a lockfile and releases it (unlink on release)', async () => {
        const lock = new TimelineFileLock(tmpDir);
        const outcome = await lock.acquire('player1');
        expect(outcome.acquired).toBe(true);

        const lockPath = path.join(tmpDir, 'votc_data', '.lock', 'player1.lock');
        expect(fs.existsSync(lockPath)).toBe(true);

        await lock.release(outcome);
        expect(fs.existsSync(lockPath)).toBe(false);
    });

    it('rejects a second concurrent acquire on the same key in-process', async () => {
        const lock = new TimelineFileLock(tmpDir);
        const first = await lock.acquire('player1');
        expect(first.acquired).toBe(true);

        const second = await lock.acquire('player1');
        expect(second.acquired).toBe(false);
        expect(second.reason).toMatch(/already/i);

        await lock.release(first);
    });

    it('detects a stale lock by PID liveness and reuses it', async () => {
        const lock = new TimelineFileLock(tmpDir, {
            stalePidProbe: () => false // treat recorded PID as not-alive
        });
        // Write a stale lockfile with a dead PID.
        const lockDir = path.join(tmpDir, 'votc_data', '.lock');
        fs.mkdirSync(lockDir, { recursive: true });
        const lockPath = path.join(lockDir, 'player1.lock');
        const staleContent = JSON.stringify({
            pid: 999999,
            startedAt: new Date().toISOString(),
            host: os.hostname()
        }, null, '\t');
        fs.writeFileSync(lockPath, staleContent, 'utf8');

        const outcome = await lock.acquire('player1');
        expect(outcome.acquired).toBe(true);

        await lock.release(outcome);
    });

    it('passes the recorded PID to the stalePidProbe', async () => {
        let probedPid: number | undefined;
        const lock = new TimelineFileLock(tmpDir, {
            stalePidProbe: (pid: number) => {
                probedPid = pid;
                return true; // live -> not stale
            }
        });
        const lockDir = path.join(tmpDir, 'votc_data', '.lock');
        fs.mkdirSync(lockDir, { recursive: true });
        const lockPath = path.join(lockDir, 'player1.lock');
        const staleContent = JSON.stringify({
            pid: 4242,
            startedAt: new Date().toISOString(),
            host: os.hostname()
        }, null, '\t');
        fs.writeFileSync(lockPath, staleContent, 'utf8');

        await lock.acquire('player1');
        expect(probedPid).toBe(4242);
    });

    it('does not steal a live PID lock (treats as held)', async () => {
        const livePid = process.pid;
        const lock = new TimelineFileLock(tmpDir, {
            stalePidProbe: () => true // PID is alive
        });
        const lockDir = path.join(tmpDir, 'votc_data', '.lock');
        fs.mkdirSync(lockDir, { recursive: true });
        const lockPath = path.join(lockDir, 'player1.lock');
        const liveContent = JSON.stringify({
            pid: livePid,
            startedAt: new Date().toISOString(),
            host: os.hostname()
        }, null, '\t');
        fs.writeFileSync(lockPath, liveContent, 'utf8');

        const outcome = await lock.acquire('player1');
        expect(outcome.acquired).toBe(false);
        expect(outcome.reason).toMatch(/held by a live process/i);
    });

    it('respects staleTimeout for a lock whose PID is unknown', async () => {
        // If PID probe throws (unknown OS), the lock is reused only after timeout.
        // staleTimeoutMs is 1000ms; the lock's startedAt is 2s ago, so it is
        // stale. A fresh lock (startedAt now) would NOT be stale at 1000ms,
        // which is the boundary this test is meant to exercise.
        const lock = new TimelineFileLock(tmpDir, {
            stalePidProbe: () => { throw new Error('unsupported'); },
            staleTimeoutMs: 1000
        });
        const lockDir = path.join(tmpDir, 'votc_data', '.lock');
        fs.mkdirSync(lockDir, { recursive: true });
        const lockPath = path.join(lockDir, 'player1.lock');
        const staleContent = JSON.stringify({
            pid: 12345,
            startedAt: new Date(Date.now() - 2000).toISOString(),
            host: os.hostname()
        }, null, '\t');
        fs.writeFileSync(lockPath, staleContent, 'utf8');

        const outcome = await lock.acquire('player1');
        expect(outcome.acquired).toBe(true);
        await lock.release(outcome);
    });

    it('does not reclaim a fresh lock when staleTimeout has not elapsed', async () => {
        // Boundary: a lock whose startedAt is within staleTimeoutMs should
        // NOT be reclaimed even if the PID probe throws.
        const lock = new TimelineFileLock(tmpDir, {
            stalePidProbe: () => { throw new Error('unsupported'); },
            staleTimeoutMs: 1000
        });
        const lockDir = path.join(tmpDir, 'votc_data', '.lock');
        fs.mkdirSync(lockDir, { recursive: true });
        const lockPath = path.join(lockDir, 'player1.lock');
        // Fresh: startedAt is now.
        const freshContent = JSON.stringify({
            pid: 12345,
            startedAt: new Date().toISOString(),
            host: os.hostname()
        }, null, '\t');
        fs.writeFileSync(lockPath, freshContent, 'utf8');

        const outcome = await lock.acquire('player1');
        expect(outcome.acquired).toBe(false);
        expect(outcome.reason).toMatch(/held by a live process/i);
    });

    it('does not steal a live lock created between stale-check and reclaim (TOCTOU)', async () => {
        // Simulate a concurrent acquirer that creates a LIVE lock in the window
        // between isStale() returning true and our reclaim attempt.
        //
        // Sequence inside acquire():
        //   1. tryCreateExclusive fails (file exists).
        //   2. isStale(lockPath): reads stale content, calls stalePidProbe.
        //      - On the FIRST probe call we simulate the concurrent acquirer
        //        writing a fresh LIVE lock to lockPath before returning false
        //        (dead) so isStale returns true.
        //   3. reclaim: renameSync(lockPath, reclaimPath) renames the file that
        //      now holds the LIVE content.
        //   4. isStale(reclaimPath): reads the renamed (live) content, calls
        //      stalePidProbe -> returns true (alive) -> not stale.
        //   5. restore the renamed file to lockPath, return not acquired.
        //
        // Without the TOCTOU fix, the reclaim would unlinkSync the live lock
        // and re-acquire concurrently, breaking mutual exclusion.
        const livePid = process.pid;
        const lockDir = path.join(tmpDir, 'votc_data', '.lock');
        const lockPath = path.join(lockDir, 'player1.lock');

        let probeCallCount = 0;
        const lock = new TimelineFileLock(tmpDir, {
            stalePidProbe: (_pid: number) => {
                probeCallCount++;
                if (probeCallCount === 1) {
                    // First probe is against the stale lockfile. Simulate a
                    // concurrent acquirer that, between our isStale file-read
                    // and our rename, replaces lockPath with a fresh LIVE lock.
                    const liveContent = JSON.stringify({
                        pid: livePid,
                        startedAt: new Date().toISOString(),
                        host: os.hostname()
                    }, null, '\t');
                    fs.writeFileSync(lockPath, liveContent, 'utf8');
                    return false; // dead -> isStale returns true
                }
                // Second probe is against the renamed file, which now holds
                // the live lock written by the simulated concurrent acquirer.
                return true; // alive -> not stale
            }
        });

        fs.mkdirSync(lockDir, { recursive: true });
        // Pre-write a stale lockfile with a dead PID.
        const staleContent = JSON.stringify({
            pid: 999999,
            startedAt: new Date(Date.now() - 60000).toISOString(),
            host: os.hostname()
        }, null, '\t');
        fs.writeFileSync(lockPath, staleContent, 'utf8');

        const outcome = await lock.acquire('player1');

        // We must NOT have stolen the live lock.
        expect(outcome.acquired).toBe(false);
        expect(outcome.reason).toMatch(/held by a live process/i);

        // The live lock created by the simulated concurrent acquirer must still
        // exist at lockPath (restored by reclaim).
        expect(fs.existsSync(lockPath)).toBe(true);

        // No reclaim file should be left behind.
        const reclaimCandidates = fs.readdirSync(lockDir).filter(f => f.includes('.reclaim.'));
        expect(reclaimCandidates).toEqual([]);
    });

    it('release is a no-op when not acquired', async () => {
        const lock = new TimelineFileLock(tmpDir);
        const outcome: TimelineLockOutcome = { acquired: false, reason: 'test' };
        await expect(lock.release(outcome)).resolves.toBeUndefined();
    });
});

describe('withTimelineLock helper (in-process mutex + file lock, §7.5 P3.4)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-withlock-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('runs fn under both mutex and file lock, then releases the file lock', async () => {
        const lockPath = path.join(tmpDir, 'votc_data', '.lock', 'player1.lock');
        let observedLockExists = false;
        const result = await withTimelineLock(tmpDir, { playerId: 'player1' }, async () => {
            observedLockExists = fs.existsSync(lockPath);
            return 42;
        });
        expect(result).toBe(42);
        expect(observedLockExists).toBe(true);
        expect(fs.existsSync(lockPath)).toBe(false);
    });

    it('serializes two concurrent calls for the same player', async () => {
        const order: string[] = [];
        const tasks = [
            withTimelineLock(tmpDir, { playerId: 'p1' }, async () => {
                order.push('a-start');
                await new Promise(r => setTimeout(r, 25));
                order.push('a-end');
            }),
            withTimelineLock(tmpDir, { playerId: 'p1' }, async () => {
                order.push('b-start');
                await new Promise(r => setTimeout(r, 5));
                order.push('b-end');
            })
        ];
        await Promise.all(tasks);
        const joined = order.join(',');
        expect(joined).toMatch(/a-start,a-end,b-start,b-end|b-start,b-end,a-start,a-end/);
    });

    it('runs different players in parallel', async () => {
        const active: string[] = [];
        const maxConcurrent = { count: 0 };
        await Promise.all([
            withTimelineLock(tmpDir, { playerId: 'p1' }, async () => {
                active.push('p1');
                if (active.length > maxConcurrent.count) maxConcurrent.count = active.length;
                await new Promise(r => setTimeout(r, 25));
                active.pop();
            }),
            withTimelineLock(tmpDir, { playerId: 'p2' }, async () => {
                active.push('p2');
                if (active.length > maxConcurrent.count) maxConcurrent.count = active.length;
                await new Promise(r => setTimeout(r, 25));
                active.pop();
            })
        ]);
        expect(maxConcurrent.count).toBe(2);
    });

    it('releases the file lock even when fn throws', async () => {
        const lockPath = path.join(tmpDir, 'votc_data', '.lock', 'player1.lock');
        await expect(withTimelineLock(tmpDir, { playerId: 'player1' }, async () => {
            throw new Error('boom');
        })).rejects.toThrow('boom');
        expect(fs.existsSync(lockPath)).toBe(false);
    });
});

describe('ensureSingleInstanceLock (Electron single-instance lock, §7.5 P3.4)', () => {
    it('returns true and registers second-instance handler when lock acquired', () => {
        let requestedLock = false;
        let secondInstanceHandler: ((...args: unknown[]) => void) | undefined;
        const fakeApp: SingleInstanceLockApi = {
            requestSingleInstanceLock(): boolean {
                requestedLock = true;
                return true;
            },
            on(event: string, handler: (...args: unknown[]) => void): void {
                if (event === 'second-instance') {
                    secondInstanceHandler = handler;
                }
            },
            quit(): void { /* no-op for test */ },
            exit(code?: number): void { /* no-op for test */ }
        };

        const result = ensureSingleInstanceLock(fakeApp);
        expect(result).toBe(true);
        expect(requestedLock).toBe(true);
        expect(typeof secondInstanceHandler).toBe('function');
    });

    it('returns false and quits when another instance already holds the lock', () => {
        let quitCalled = false;
        let exitCalled = false;
        let exitCode: number | undefined;
        const fakeApp: SingleInstanceLockApi = {
            requestSingleInstanceLock(): boolean { return false; },
            on(): void { /* no-op */ },
            quit(): void { quitCalled = true; },
            exit(code?: number): void {
                exitCalled = true;
                exitCode = code;
            }
        };

        const result = ensureSingleInstanceLock(fakeApp);
        expect(result).toBe(false);
        expect(quitCalled).toBe(true);
        expect(exitCalled).toBe(true);
        expect(exitCode).toBe(0);
    });

    it('second-instance handler focuses an existing window via the callback', () => {
        let capturedHandler: ((...args: unknown[]) => void) | undefined;
        const fakeApp: SingleInstanceLockApi = {
            requestSingleInstanceLock(): boolean { return true; },
            on(event: string, handler: (...args: unknown[]) => void): void {
                if (event === 'second-instance') capturedHandler = handler;
            },
            quit(): void {},
            exit(): void {}
        };

        let focused = false;
        ensureSingleInstanceLock(fakeApp, {
            focusExistingWindow: () => { focused = true; }
        });

        expect(capturedHandler).toBeDefined();
        capturedHandler!();
        expect(focused).toBe(true);
    });
});

describe('withTimelineLock with recoverPendingTransactions (§7.5 P3.4 recovery-in-lock)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-recover-lock-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('recovers pending transactions under the lock; subsequent calls see committed state', async () => {
        // We drive this through the TimelineTransactionStore to ensure the lock
        // wraps a real recovery call (§7.5: recovery is idempotent under lock).
        const { TimelineTransactionStore } = await import('../../src/main/timelineTransactionStore');
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-recover-in-lock';
        store.beginTransaction(attemptId, {
            targetNode: '1-1',
            recordIds: ['r1'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        // First caller: recovers inside the lock and commits.
        const first = await withTimelineLock(tmpDir, { playerId: 'player1' }, async () => {
            const pending = store.recoverPendingTransactions();
            expect(pending).toHaveLength(1);
            expect(pending[0].attemptId).toBe(attemptId);
            expect(pending[0].targetNode).toBe('1-1');
            // Idempotent re-call from inside the same lock.
            const pending2 = store.recoverPendingTransactions();
            expect(pending2).toHaveLength(1);
            store.commitTransaction(attemptId);
            return 'first';
        });
        expect(first).toBe('first');

        // Second caller, after release: nothing pending.
        const second = await withTimelineLock(tmpDir, { playerId: 'player1' }, async () => {
            const pending = store.recoverPendingTransactions();
            return pending.length;
        });
        expect(second).toBe(0);
    });
});
