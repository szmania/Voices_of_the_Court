import fs from 'fs';
import path from 'path';
import os from 'os';
import { validatePathSafeName } from './campaignDataPaths.js';

/**
 * Concurrency control for the timeline save path (remediation plan §7.5 P3.4).
 *
 * Three layers:
 *   1. Electron single-instance lock (ensureSingleInstanceLock): prevents two
 *      App instances from running at all.
 *   2. Inter-process file lock (TimelineFileLock): a per-player lockfile at
 *      <userData>/votc_data/.lock/<playerId>.lock that prevents two processes
 *      (or two App instances if the single-instance lock is bypassed) from
 *      writing the same registry/transaction store simultaneously.
 *   3. In-process async mutex (TimelineMutex): serializes concurrent async
 *      operations within the same Node process by player/campaign key.
 *
 * `withTimelineLock` composes layers 2 and 3: it acquires the file lock, then
 * the in-process mutex, runs `fn`, and releases both. Phase 4 extends
 * `lockKeyFor` to include campaignId.
 */

export interface PlayerIdentity {
    /** Campaign ID (normalized "<a>-<b>-<c>-<d>"). When set, the lockfile is campaign-scoped. */
    campaignId?: string;
    playerId: string;
}

export function lockKeyFor(identity: PlayerIdentity): string {
    if (identity.campaignId !== undefined && identity.campaignId !== '') {
        return `campaign:${identity.campaignId}|player:${identity.playerId}`;
    }
    return `player:${identity.playerId}`;
}

function lockDirFor(userDataDir: string): string {
    return path.join(userDataDir, 'votc_data', '.lock');
}

/**
 * Resolve the lockfile path for a given identity. Path-safe validation is
 * applied to both campaignId and playerId via `validatePathSafeName` (the
 * same sanitizer used by campaignDataPaths), so the same traversal/charset
 * rules apply to lockfile path construction as to every other campaign-scoped
 * path. A malformed id throws CampaignPathError before it can reach the
 * filesystem.
 */
export function lockFilePathFor(userDataDir: string, identity: PlayerIdentity): string {
    // Validate playerId unconditionally (the player-only lockfile uses it
    // directly as the filename).
    validatePathSafeName(identity.playerId, 'playerId');
    if (identity.campaignId !== undefined && identity.campaignId !== '') {
        // Validate campaignId before interpolating it into the filename.
        validatePathSafeName(identity.campaignId, 'campaignId');
        return path.join(
            lockDirFor(userDataDir),
            `campaign_${identity.campaignId}_player_${identity.playerId}.lock`
        );
    }
    return path.join(lockDirFor(userDataDir), `${identity.playerId}.lock`);
}

interface LockFileContent {
    pid: number;
    startedAt: string;
    host: string;
}

function isProcessAlive(pid: number): boolean {
    if (pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // ESRCH: no such process (not alive). EPERM: process exists but no
        // permission to signal it (alive). Any other error: assume alive to
        // be safe (do not steal a potentially-held lock).
        if (code === 'ESRCH') return false;
        if (code === 'EPERM') return true;
        return true;
    }
}

export interface TimelineFileLockOptions {
    /**
     * Override the PID-liveness probe. Receives the PID recorded in the
     * lockfile; returns true if that PID is still alive. Used in tests to
     * simulate a dead or live process without spawning one. Throws to
     * simulate "unsupported on this OS".
     */
    stalePidProbe?: (pid: number) => boolean;
    /** Locks older than this are considered stale when the PID probe throws. */
    staleTimeoutMs?: number;
}

export interface TimelineLockOutcome {
    acquired: boolean;
    /** Path of the lockfile if acquired. */
    lockPath?: string;
    /** Reason the lock was not acquired. */
    reason?: string;
    /** True if this caller created the lockfile (release should unlink it). */
    owns?: boolean;
}

export class TimelineFileLock {
    private readonly stalePidProbe: (pid: number) => boolean;
    private readonly staleTimeoutMs: number;

    constructor(
        private readonly userDataDir: string,
        options: TimelineFileLockOptions = {}
    ) {
        this.stalePidProbe = options.stalePidProbe ?? ((pid: number) => isProcessAlive(pid));
        // Default 60s backstop for stuck locks. The primary defense against
        // concurrent writers is the Electron single-instance lock (layer 1);
        // this file-lock timeout is only a backstop if a process is stuck or
        // the single-instance lock is bypassed. Large battle-report batches
        // that hold the lock for longer than 60s should pass a larger
        // staleTimeoutMs at construction; we keep 60s as a conservative
        // default so a genuinely-stuck lock is reclaimed reasonably soon.
        this.staleTimeoutMs = options.staleTimeoutMs ?? 60_000;
    }

    async acquire(identity: PlayerIdentity | string): Promise<TimelineLockOutcome> {
        const dir = lockDirFor(this.userDataDir);
        const identityObj: PlayerIdentity = typeof identity === 'string'
            ? { playerId: identity }
            : identity;
        const lockPath = lockFilePathFor(this.userDataDir, identityObj);

        // First try O_EXCL: succeeds only if the file does not exist.
        const created = await this.tryCreateExclusive(lockPath, dir);
        if (created) {
            return { acquired: true, lockPath, owns: true };
        }

        // File exists. Inspect it: stale (dead PID or timed out) lets us reuse.
        if (this.isStale(lockPath)) {
            // Atomically claim the stale lockfile via rename before unlinking,
            // to avoid a TOCTOU race: between isStale() returning true and an
            // unlink, a legitimate holder could delete the stale file and
            // O_EXCL-create a new live lock; our unlink would then delete
            // their live lock and we'd re-acquire concurrently, breaking
            // mutual exclusion. Rename is atomic: if it fails (ENOENT - the
            // file was already reclaimed or released), fall through to retry.
            // If rename succeeds, the renamed file is re-validated below,
            // because a live lock created between our check and rename would
            // now be in the renamed file.
            const reclaimPath = `${lockPath}.reclaim.${process.pid}`;
            let reclaimed = false;
            try {
                fs.renameSync(lockPath, reclaimPath);
                reclaimed = true;
            } catch {
                // rename failed: lockfile was already reclaimed or released
                // between our isStale check and the rename.
            }

            if (reclaimed) {
                // We exclusively own reclaimPath. Re-validate staleness: if a
                // live lock was created between isStale and rename, the
                // renamed content is now live, and we must restore it rather
                // than steal it.
                if (!this.isStale(reclaimPath)) {
                    try {
                        fs.renameSync(reclaimPath, lockPath);
                    } catch {
                        // Restore failed (e.g., a new lock exists at lockPath);
                        // clean up the renamed file best-effort.
                        try { fs.unlinkSync(reclaimPath); } catch { /* best effort */ }
                    }
                    return {
                        acquired: false,
                        lockPath,
                        reason: 'lockfile already held by a live process'
                    };
                }
                // Re-confirmed stale. Safe to unlink.
                try {
                    fs.unlinkSync(reclaimPath);
                } catch {
                    // best effort: the renamed file may already be gone
                }
            }

            const retried = await this.tryCreateExclusive(lockPath, dir);
            if (retried) {
                return { acquired: true, lockPath, owns: true };
            }
            return {
                acquired: false,
                lockPath,
                reason: 'lockfile already held by another process'
            };
        }

        return {
            acquired: false,
            lockPath,
            reason: 'lockfile already held by a live process'
        };
    }

    async release(outcome: TimelineLockOutcome): Promise<void> {
        if (!outcome.acquired || !outcome.owns || !outcome.lockPath) return;
        try {
            fs.unlinkSync(outcome.lockPath);
        } catch {
            // best effort: the lockfile may already be gone
        }
    }

    private async tryCreateExclusive(lockPath: string, dir: string): Promise<boolean> {
        fs.mkdirSync(dir, { recursive: true });
        try {
            const fd = fs.openSync(lockPath, 'wx');
            const content: LockFileContent = {
                pid: process.pid,
                startedAt: new Date().toISOString(),
                host: os.hostname()
            };
            fs.writeFileSync(fd, JSON.stringify(content, null, '\t'), 'utf8');
            fs.closeSync(fd);
            return true;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code === 'EEXIST') return false;
            // Unexpected error (disk full, permission). Surface as not acquired
            // rather than crashing the caller; a follow-up save will retry.
            return false;
        }
    }

    private isStale(lockPath: string): boolean {
        let raw: string;
        try {
            raw = fs.readFileSync(lockPath, 'utf8');
        } catch {
            return false;
        }
        let parsed: LockFileContent;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // Garbage lockfile: treat as stale so we can reclaim it.
            return true;
        }
        if (!parsed || typeof parsed.pid !== 'number' || typeof parsed.startedAt !== 'string') {
            return true;
        }

        let alive: boolean;
        try {
            alive = this.stalePidProbe(parsed.pid);
        } catch {
            // PID probe unsupported (rare): fall back to timeout.
            alive = true;
        }

        if (!alive) return true;

        // PID is alive according to the probe, OR the probe threw. In the
        // latter case we additionally allow timeout-based staleness so a
        // permanently-stuck lock can eventually be reclaimed.
        const startedAt = Date.parse(parsed.startedAt);
        if (Number.isFinite(startedAt) && (Date.now() - startedAt) > this.staleTimeoutMs) {
            return true;
        }
        return false;
    }
}

interface MutexChain {
    promise: Promise<void>;
}

/**
 * In-process async mutex keyed by player/campaign. Two calls with the same
 * key run serially; calls with different keys run in parallel. This layer
 * alone does not prevent two App instances from writing the same store;
 * pair it with TimelineFileLock (or rely on the Electron single-instance
 * lock) for cross-process safety.
 */
export class TimelineMutex {
    private readonly chains = new Map<string, MutexChain>();

    async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const prev = this.chains.get(key)?.promise ?? Promise.resolve();
        let resolveNext!: () => void;
        const next = new Promise<void>(resolve => {
            resolveNext = resolve;
        });
        this.chains.set(key, { promise: next });

        try {
            await prev;
            return await fn();
        } finally {
            resolveNext();
            // Drop the chain entry if ours is still the latest, to avoid
            // unbounded Map growth for one-shot keys.
            if (this.chains.get(key)?.promise === next) {
                this.chains.delete(key);
            }
        }
    }
}

/**
 * Composed helper: acquires the in-process mutex, then the file lock, runs
 * `fn`, and releases both. The mutex serializes concurrent in-process
 * operations on the same player so that only one call at a time attempts
 * the file lock; the file lock prevents cross-process interleaving (two App
 * instances, if the single-instance lock is ever bypassed).
 *
 * Phase 4 extends the lock key to include campaignId.
 *
 * NOTE: not reentrant. Nesting withTimelineLock with the same identity
 * (same playerId/campaignId and userDataDir) deadlocks: the inner call
 * blocks on the in-process mutex still held by the outer call. No current
 * call site nests; future callers must not nest with the same identity.
 */
export async function withTimelineLock<T>(
    userDataDir: string,
    identity: PlayerIdentity,
    fn: () => Promise<T>
): Promise<T> {
    const fileLock = new TimelineFileLock(userDataDir);
    const playerId = identity.playerId;
    const mutexKey = lockKeyFor(identity);
    const mutex = getOrCreateMutexFor(userDataDir);

    return mutex.withLock(mutexKey, async () => {
        const outcome = await fileLock.acquire(identity);
        if (!outcome.acquired) {
            throw new Error(
                `timelineLock: could not acquire file lock for player ${playerId}: ${outcome.reason ?? 'unknown'}`
            );
        }
        try {
            return await fn();
        } finally {
            await fileLock.release(outcome);
        }
    });
}

// One in-process mutex per userDataDir so that concurrent calls in the same
// App instance are serialized. (A separate mutex per dir keeps tests that use
// distinct tmpDirs from sharing a global lock.)
const mutexByUserDataDir = new Map<string, TimelineMutex>();

function getOrCreateMutexFor(userDataDir: string): TimelineMutex {
    let m = mutexByUserDataDir.get(userDataDir);
    if (!m) {
        m = new TimelineMutex();
        mutexByUserDataDir.set(userDataDir, m);
    }
    return m;
}

/**
 * Test-only helper to reset the per-dir mutex map between tests.
 */
export function _resetMutexCacheForTests(): void {
    mutexByUserDataDir.clear();
}

export interface SingleInstanceLockApi {
    requestSingleInstanceLock(): boolean;
    on(event: string, listener: (...args: any[]) => void): void;
    quit(): void;
    exit(code?: number): void;
}

export interface SingleInstanceLockOptions {
    /**
     * Called when a second instance tries to start. Should focus an existing
     * window. If unset, the second-instance event is only logged.
     */
    focusExistingWindow?: () => void;
}

/**
 * Wraps `app.requestSingleInstanceLock()` per the remediation plan: the first
 * instance gets the lock and registers a second-instance handler; a second
 * instance quits and exits. Returns true if this instance should continue
 * running, false if it should terminate.
 */
export function ensureSingleInstanceLock(
    app: SingleInstanceLockApi,
    options: SingleInstanceLockOptions = {}
): boolean {
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
        console.log('Another instance of the application is already running. Quitting this instance.');
        app.quit();
        app.exit(0);
        return false;
    }

    app.on('second-instance', () => {
        console.log('Second instance detected. Focusing the existing window.');
        try {
            options.focusExistingWindow?.();
        } catch (error) {
            console.error('[timelineLock] second-instance focus handler failed:', error);
        }
    });
    return true;
}
