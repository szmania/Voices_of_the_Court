import fs from 'fs';
import path from 'path';
import { randomUUID, createHash } from 'crypto';

/**
 * Atomic, recoverable JSON persistence for versioned history records
 * (plan task T3).
 *
 * Protocol per write:
 *  1. Serialize the payload (2-space indent + trailing newline).
 *  2. Write a unique sibling tmp file via an open file handle, fsync it,
 *     close it.
 *  3. If the target already exists: write a swap manifest recording target,
 *     tmp, backup, payload hash and transaction id; rename the target to a
 *     unique backup; rename the tmp onto the target. On failure restore the
 *     backup. On success delete the backup and the manifest.
 *  4. If the target does not exist: rename the tmp onto the target.
 *  5. Best-effort fsync of the parent directory.
 *
 * Before any access to a target, `recoverPendingSwap` replays the swap
 * manifest left behind by a crashed process, so the target file always ends
 * up holding one complete version and no stray tmp/backup files remain.
 *
 * All writes for the same absolute path are serialized through an in-process
 * keyed promise queue. Cross-process locking is NOT provided.
 */

export class HistoryAtomicJsonError extends Error {
    readonly code:
        | 'history_io_failed'
        | 'history_parse_failed'
        | 'history_corrupt'
        | 'history_transaction_recover_failed';

    constructor(
        code: 'history_io_failed' | 'history_parse_failed' | 'history_corrupt' | 'history_transaction_recover_failed',
        message: string
    ) {
        super(message);
        this.name = 'HistoryAtomicJsonError';
        this.code = code;
    }
}

export interface HistorySwapManifest {
    transactionId: string;
    targetPath: string;
    tmpPath: string;
    backupPath: string | null;
    payloadSha256: string;
    phase: 'replacing_target';
    createdAt: string;
}

/** Injectable filesystem operations (fault injection in tests). */
export interface HistoryAtomicJsonDeps {
    renameSync?: (from: string, to: string) => void;
    unlinkSync?: (target: string) => void;
}

const SWAP_MANIFEST_SUFFIX = '.swap.json';

function sha256Hex(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function serializeHistoryJson(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// In-process keyed promise queue
// ---------------------------------------------------------------------------

const queues = new Map<string, Promise<unknown>>();

function enqueueExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const run = previous.then(task, task);
    const tracked = run.then(
        () => undefined,
        () => undefined
    );
    queues.set(key, tracked);
    void tracked.finally(() => {
        if (queues.get(key) === tracked) {
            queues.delete(key);
        }
    });
    return run;
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function fsyncDirBestEffort(dir: string): void {
    try {
        const dirFd = fs.openSync(dir, 'r');
        try {
            fs.fsyncSync(dirFd);
        } catch {
            // Some platforms cannot fsync a directory handle.
        }
        try {
            fs.closeSync(dirFd);
        } catch {
            // ignore
        }
    } catch {
        // Best-effort only.
    }
}

function writeSwapManifest(manifest: HistorySwapManifest): void {
    const manifestPath = `${manifest.targetPath}${SWAP_MANIFEST_SUFFIX}`;
    const content = serializeHistoryJson(manifest);
    const fd = fs.openSync(manifestPath, 'w');
    try {
        fs.writeFileSync(fd, content, 'utf8');
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
}

function readSwapManifest(targetPath: string): HistorySwapManifest | undefined {
    const manifestPath = `${targetPath}${SWAP_MANIFEST_SUFFIX}`;
    let raw: string;
    try {
        raw = fs.readFileSync(manifestPath, 'utf8');
    } catch {
        return undefined;
    }
    try {
        const parsed = JSON.parse(raw) as Partial<HistorySwapManifest>;
        if (
            typeof parsed.transactionId !== 'string' ||
            typeof parsed.targetPath !== 'string' ||
            typeof parsed.tmpPath !== 'string' ||
            typeof parsed.payloadSha256 !== 'string' ||
            parsed.phase !== 'replacing_target'
        ) {
            return undefined;
        }
        return parsed as HistorySwapManifest;
    } catch {
        return undefined;
    }
}

function deleteFileBestEffort(filePath: string, unlink: (p: string) => void): void {
    try {
        if (fs.existsSync(filePath)) {
            unlink(filePath);
        }
    } catch {
        // Best-effort cleanup.
    }
}

function quarantineManifest(targetPath: string): void {
    const manifestPath = `${targetPath}${SWAP_MANIFEST_SUFFIX}`;
    try {
        if (fs.existsSync(manifestPath)) {
            fs.renameSync(
                manifestPath,
                `${manifestPath}.corrupt.${Date.now()}-${randomUUID()}`
            );
        }
    } catch {
        // Best-effort.
    }
}

/**
 * Replays an unfinished swap transaction for `targetPath`, if any. Called at
 * the start of every queued operation on that target so a crash can never
 * leave the history file in an unrecoverable state.
 */
export function recoverPendingSwap(targetPath: string, deps: HistoryAtomicJsonDeps = {}): void {
    const rename = deps.renameSync ?? ((from: string, to: string) => fs.renameSync(from, to));
    const unlink = deps.unlinkSync ?? ((target: string) => fs.unlinkSync(target));

    const manifest = readSwapManifest(targetPath);
    if (!manifest) return;

    const resolvedTarget = path.resolve(manifest.targetPath);
    if (resolvedTarget !== path.resolve(targetPath)) {
        // Manifest does not belong to this target; treat as corrupt material.
        quarantineManifest(targetPath);
        return;
    }

    const manifestPath = `${targetPath}${SWAP_MANIFEST_SUFFIX}`;
    const targetExists = fs.existsSync(targetPath);
    const backupExists = manifest.backupPath !== null && fs.existsSync(manifest.backupPath);

    if (!targetExists && backupExists && manifest.backupPath !== null) {
        // Crash between "target -> backup" and "tmp -> target": restore.
        try {
            rename(manifest.backupPath, targetPath);
        } catch (error) {
            throw new HistoryAtomicJsonError(
                'history_transaction_recover_failed',
                `cannot restore backup ${manifest.backupPath} for ${targetPath}: ${String(error)}`
            );
        }
        deleteFileBestEffort(manifest.tmpPath, unlink);
        deleteFileBestEffort(manifestPath, unlink);
        return;
    }

    if (targetExists) {
        let onDiskSha256: string | null = null;
        try {
            onDiskSha256 = sha256Hex(fs.readFileSync(targetPath, 'utf8'));
        } catch {
            onDiskSha256 = null;
        }
        if (onDiskSha256 === manifest.payloadSha256) {
            // The replacement completed; finish cleaning up.
            if (backupExists && manifest.backupPath !== null) {
                deleteFileBestEffort(manifest.backupPath, unlink);
            }
            deleteFileBestEffort(manifest.tmpPath, unlink);
            deleteFileBestEffort(manifestPath, unlink);
            return;
        }
        if (backupExists && manifest.backupPath !== null) {
            // Target holds neither old nor new complete content we can trust:
            // roll back to the backup.
            try {
                rename(manifest.backupPath, targetPath);
            } catch (error) {
                throw new HistoryAtomicJsonError(
                    'history_transaction_recover_failed',
                    `cannot roll back to backup ${manifest.backupPath} for ${targetPath}: ${String(error)}`
                );
            }
            deleteFileBestEffort(manifest.tmpPath, unlink);
            deleteFileBestEffort(manifestPath, unlink);
            return;
        }
    }

    // No backup involved or nothing restorable: drop the orphan tmp and the
    // stale manifest.
    deleteFileBestEffort(manifest.tmpPath, unlink);
    deleteFileBestEffort(manifestPath, unlink);
}

// ---------------------------------------------------------------------------
// Public write API
// ---------------------------------------------------------------------------

async function performAtomicWrite(
    filePath: string,
    payload: string,
    deps: HistoryAtomicJsonDeps
): Promise<void> {
    const rename = deps.renameSync ?? ((from: string, to: string) => fs.renameSync(from, to));
    const unlink = deps.unlinkSync ?? ((target: string) => fs.unlinkSync(target));
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const transactionId = randomUUID();
    const tmpPath = path.join(dir, `.${base}.${transactionId}.tmp`);

    fs.mkdirSync(dir, { recursive: true });

    let fd: number | undefined;
    try {
        fd = fs.openSync(tmpPath, 'w');
        fs.writeFileSync(fd, payload, 'utf8');
        fs.fsyncSync(fd);
    } catch (error) {
        if (fd !== undefined) {
            try {
                fs.closeSync(fd);
            } catch {
                // ignore
            }
        }
        deleteFileBestEffort(tmpPath, unlink);
        throw new HistoryAtomicJsonError('history_io_failed', `cannot write tmp ${tmpPath}: ${String(error)}`);
    }
    try {
        fs.closeSync(fd);
    } catch {
        // Non-fatal.
    }
    fd = undefined;

    const targetExists = fs.existsSync(filePath);

    if (!targetExists) {
        try {
            rename(tmpPath, filePath);
        } catch (error) {
            deleteFileBestEffort(tmpPath, unlink);
            throw new HistoryAtomicJsonError(
                'history_io_failed',
                `cannot rename tmp ${tmpPath} -> ${filePath}: ${String(error)}`
            );
        }
        fsyncDirBestEffort(dir);
        return;
    }

    const backupPath = path.join(dir, `.${base}.${transactionId}.bak`);
    const manifest: HistorySwapManifest = {
        transactionId,
        targetPath: filePath,
        tmpPath,
        backupPath,
        payloadSha256: sha256Hex(payload),
        phase: 'replacing_target',
        createdAt: new Date().toISOString()
    };

    try {
        writeSwapManifest(manifest);
    } catch (error) {
        deleteFileBestEffort(tmpPath, unlink);
        throw new HistoryAtomicJsonError(
            'history_io_failed',
            `cannot write swap manifest for ${filePath}: ${String(error)}`
        );
    }

    try {
        rename(filePath, backupPath);
    } catch (error) {
        deleteFileBestEffort(tmpPath, unlink);
        deleteFileBestEffort(`${filePath}${SWAP_MANIFEST_SUFFIX}`, unlink);
        throw new HistoryAtomicJsonError(
            'history_io_failed',
            `cannot move existing target ${filePath} to backup: ${String(error)}`
        );
    }

    try {
        rename(tmpPath, filePath);
    } catch (error) {
        // Restore the previous content before reporting failure.
        try {
            rename(backupPath, filePath);
            deleteFileBestEffort(`${filePath}${SWAP_MANIFEST_SUFFIX}`, unlink);
        } catch {
            // Keep the manifest + backup as recovery material; do not delete
            // the last known-good copy.
        }
        deleteFileBestEffort(tmpPath, unlink);
        throw new HistoryAtomicJsonError(
            'history_io_failed',
            `cannot commit tmp ${tmpPath} -> ${filePath}: ${String(error)}`
        );
    }

    deleteFileBestEffort(backupPath, unlink);
    deleteFileBestEffort(`${filePath}${SWAP_MANIFEST_SUFFIX}`, unlink);
    fsyncDirBestEffort(dir);
}

/**
 * Atomically writes `value` as JSON to `filePath`. Concurrent calls for the
 * same path are serialized in-process.
 */
export function writeJsonAtomic(
    filePath: string,
    value: unknown,
    deps: HistoryAtomicJsonDeps = {}
): Promise<void> {
    const key = path.resolve(filePath);
    return enqueueExclusive(key, async () => {
        recoverPendingSwap(filePath, deps);
        await performAtomicWrite(filePath, serializeHistoryJson(value), deps);
    });
}

/**
 * Reads the JSON array at `filePath` (empty array when the file does not
 * exist), applies `update`, and writes the result back atomically.
 *
 * Fail-closed: when the file exists but cannot be parsed, or `read` rejects
 * the parsed value, the error is re-thrown and the file is left untouched —
 * a corrupt array is never silently replaced by a fresh one.
 */
export function updateJsonArrayAtomic<T>(
    filePath: string,
    read: (value: unknown) => T[],
    update: (records: T[]) => T[],
    deps: HistoryAtomicJsonDeps = {}
): Promise<void> {
    const key = path.resolve(filePath);
    return enqueueExclusive(key, async () => {
        recoverPendingSwap(filePath, deps);

        let records: T[];
        if (fs.existsSync(filePath)) {
            let raw: string;
            try {
                raw = fs.readFileSync(filePath, 'utf8');
            } catch (error) {
                throw new HistoryAtomicJsonError(
                    'history_io_failed',
                    `cannot read ${filePath}: ${String(error)}`
                );
            }
            let parsed: unknown;
            try {
                parsed = JSON.parse(raw);
            } catch (error) {
                throw new HistoryAtomicJsonError(
                    'history_corrupt',
                    `cannot parse existing array file ${filePath}: ${String(error)}`
                );
            }
            try {
                records = read(parsed);
            } catch (error) {
                throw new HistoryAtomicJsonError(
                    'history_corrupt',
                    `existing array file ${filePath} failed schema check: ${String(error)}`
                );
            }
        } else {
            records = [];
        }

        const updated = update(records);
        await performAtomicWrite(filePath, serializeHistoryJson(updated), deps);
    });
}
