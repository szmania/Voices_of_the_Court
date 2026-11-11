import fs from 'fs';
import path from 'path';
import { campaignPlayerDir } from '../campaignDataPaths.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';

/**
 * Atomic, durable JSON read/write helpers for the chronicle subsystem.
 *
 * Design (per plan Task 4):
 *  1. Write the payload to a sibling `.tmp` file.
 *  2. `fsyncSync` the tmp file so the bytes hit disk before rename.
 *  3. Atomically rename tmp -> target.
 *  4. Best-effort `fsyncSync` of the parent directory so the rename is durable.
 *  5. Before writing, verify the resolved absolute target path still lives
 *     inside the current player's chronicle directory (defense-in-depth against
 *     path traversal / identity mix-up).
 *  6. On any failure, clean up the tmp file created this call; never delete the
 *     existing primary file.
 */

/** Typed error for chronicle store failures. */
export class ChronicleStoreError extends Error {
    readonly code: ChronicleStoreErrorCode;

    constructor(code: ChronicleStoreErrorCode, message: string) {
        super(message);
        this.name = 'ChronicleStoreError';
        this.code = code;
    }
}

export type ChronicleStoreErrorCode =
    | 'chronicle_path_invalid'
    | 'chronicle_tmp_write_failed'
    | 'chronicle_fsync_failed'
    | 'chronicle_rename_failed'
    | 'chronicle_parent_fsync_failed'
    | 'chronicle_parse_failed'
    | 'chronicle_schema_invalid'
    | 'chronicle_corrupt'
    | 'chronicle_io_failed'
    | 'chronicle_invalid_state'
    | 'chronicle_attempt_not_found'
    | 'chronicle_entry_not_found';

/**
 * Read and parse a JSON file. Returns `undefined` when the file does not exist.
 * Throws {@link ChronicleStoreError} on read or parse failure.
 */
export function readChronicleJson(filePath: string): unknown {
    if (!fs.existsSync(filePath)) return undefined;
    let raw: string;
    try {
        raw = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        throw new ChronicleStoreError(
            'chronicle_io_failed',
            `cannot read chronicle file ${filePath}: ${String(error)}`
        );
    }
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new ChronicleStoreError(
            'chronicle_parse_failed',
            `cannot parse chronicle file ${filePath}: ${String(error)}`
        );
    }
}

/**
 * Validate that `targetPath` resolves to a location inside the chronicle
 * directory for the given identity. Prevents cross-player / cross-campaign
 * writes even if a caller hands in an unexpected path.
 */
export function assertPathInsideChronicle(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    targetPath: string,
    label: string
): void {
    const chronicleBase = path.resolve(chronicleDirFromIdentity(userDataDir, identity));
    const resolved = path.resolve(targetPath);
    const rel = path.relative(chronicleBase, resolved);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new ChronicleStoreError(
            'chronicle_path_invalid',
            `${label} must resolve inside the chronicle directory (${chronicleBase}); got ${resolved}`
        );
    }
}

function chronicleDirFromIdentity(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'chronicle');
}

/**
 * Atomically write `value` to `targetPath` using a sibling tmp file.
 *
 * Steps:
 *  1. Ensure the parent directory exists.
 *  2. Validate the resolved target is inside the identity's chronicle dir.
 *  3. Write `<target>.tmp`.
 *  4. `fsyncSync` the tmp fd.
 *  5. `renameSync` tmp -> target.
 *  6. Best-effort `fsyncSync` the parent directory.
 *
 * On any failure, the tmp file created by this call is removed. The existing
 * primary file is never deleted by this helper.
 */
export function writeChronicleJsonAtomic(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    targetPath: string,
    value: unknown,
    options: { indent?: string } = {}
): void {
    const indent = options.indent ?? '\t';
    assertPathInsideChronicle(userDataDir, identity, targetPath, 'writeChronicleJsonAtomic target');

    const dir = path.dirname(targetPath);
    fs.mkdirSync(dir, { recursive: true });

    const payload = JSON.stringify(value, null, indent);
    const tmpPath = `${targetPath}.tmp`;

    // Step 1: write tmp.
    let fd: number | undefined;
    try {
        fd = fs.openSync(tmpPath, 'w');
        fs.writeFileSync(fd, payload, 'utf8');
    } catch (error) {
        closeAndDeleteTmp(fd, tmpPath);
        throw new ChronicleStoreError(
            'chronicle_tmp_write_failed',
            `cannot write chronicle tmp ${tmpPath}: ${String(error)}`
        );
    }

    // Step 2: fsync the tmp file before rename so the bytes are durable.
    try {
        fs.fsyncSync(fd);
    } catch (error) {
        closeAndDeleteTmp(fd, tmpPath);
        throw new ChronicleStoreError(
            'chronicle_fsync_failed',
            `cannot fsync chronicle tmp ${tmpPath}: ${String(error)}`
        );
    }

    // Close the tmp fd before rename (Windows refuses rename of an open file).
    try {
        fs.closeSync(fd);
    } catch {
        // Non-fatal: the OS may have already closed it on some platforms.
    }
    fd = undefined;

    // Step 3: atomic rename.
    try {
        fs.renameSync(tmpPath, targetPath);
    } catch (error) {
        closeAndDeleteTmp(undefined, tmpPath);
        throw new ChronicleStoreError(
            'chronicle_rename_failed',
            `cannot rename chronicle tmp ${tmpPath} -> ${targetPath}: ${String(error)}`
        );
    }

    // Step 4: best-effort fsync of the parent directory so the rename is durable.
    // Failure here is non-fatal: the rename already happened; we only lose the
    // durability guarantee for the directory entry, not the file contents.
    try {
        const dirFd = fs.openSync(dir, 'r');
        try {
            fs.fsyncSync(dirFd);
        } finally {
            try { fs.closeSync(dirFd); } catch { /* ignore */ }
        }
    } catch {
        // Some platforms / configurations cannot open directories for fsync.
        // This is best-effort and must not fail the write.
    }
}

/**
 * Rotate the current primary file to `.bak` before a new primary is committed.
 *
 * Rules:
 *  - If the primary does not exist, do nothing.
 *  - If a `.bak` already exists, it is overwritten atomically (the most recent
 *    successful primary always wins as the backup).
 *  - Uses atomic tmp+rename so the backup is never half-written.
 *  - Never deletes the primary; the caller renames the new tmp over the
 *    primary after this rotation.
 */
export function rotatePrimaryToBackup(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    primaryPath: string,
    backupPath: string
): void {
    assertPathInsideChronicle(userDataDir, identity, primaryPath, 'rotatePrimaryToBackup primary');
    assertPathInsideChronicle(userDataDir, identity, backupPath, 'rotatePrimaryToBackup backup');

    if (!fs.existsSync(primaryPath)) return;

    // Copy primary -> backup via atomic write so the backup is durable and
    // never half-written. We read the raw bytes to preserve exact content
    // (including any formatting) without re-serializing.
    let raw: string;
    try {
        raw = fs.readFileSync(primaryPath, 'utf8');
    } catch (error) {
        throw new ChronicleStoreError(
            'chronicle_io_failed',
            `cannot read primary ${primaryPath} for backup rotation: ${String(error)}`
        );
    }

    const dir = path.dirname(backupPath);
    fs.mkdirSync(dir, { recursive: true });

    const tmpBackup = `${backupPath}.tmp`;
    let fd: number | undefined;
    try {
        fd = fs.openSync(tmpBackup, 'w');
        fs.writeFileSync(fd, raw, 'utf8');
        try { fs.fsyncSync(fd); } catch { /* best-effort */ }
        try { fs.closeSync(fd); } catch { /* ignore */ }
        fd = undefined;
        fs.renameSync(tmpBackup, backupPath);
    } catch (error) {
        closeAndDeleteTmp(fd, tmpBackup);
        throw new ChronicleStoreError(
            'chronicle_rename_failed',
            `cannot rotate primary backup ${backupPath}: ${String(error)}`
        );
    }
}

/**
 * Quarantine a corrupt chronicle file by moving it to a timestamped
 * `.corrupt.<UTC timestamp>` sibling. The original path is removed so a
 * subsequent write can create a fresh file, but the corrupt content is
 * preserved for diagnosis.
 *
 * Returns the quarantine path, or `undefined` if the source file did not exist.
 */
export function quarantineCorruptChronicleFile(
    filePath: string,
    rawContent?: string
): string | undefined {
    if (!fs.existsSync(filePath) && rawContent === undefined) return undefined;

    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    fs.mkdirSync(dir, { recursive: true });

    const quarantinePath = uniqueQuarantinePath(dir, base, timestamp);

    const content = rawContent ?? safeReadForQuarantine(filePath);
    try {
        fs.writeFileSync(quarantinePath, content ?? '', 'utf8');
    } catch {
        // Best-effort: if we cannot quarantine, leave the original in place.
        return undefined;
    }

    // Remove the original so a fresh file can be created later.
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {
        // Non-fatal: the corrupt file remains but the quarantine copy exists.
    }

    return quarantinePath;
}

function uniqueQuarantinePath(dir: string, base: string, timestamp: string): string {
    let candidate = path.join(dir, `${base}.corrupt.${timestamp}`);
    let suffix = 1;
    while (fs.existsSync(candidate)) {
        candidate = path.join(dir, `${base}.corrupt.${timestamp}.${suffix}`);
        suffix++;
    }
    return candidate;
}

function safeReadForQuarantine(filePath: string): string | undefined {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return undefined;
    }
}

function closeAndDeleteTmp(fd: number | undefined, tmpPath: string): void {
    if (fd !== undefined) {
        try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    try {
        if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
        }
    } catch {
        // Best-effort cleanup; an orphan tmp is harmless and will be overwritten
        // on the next write or quarantined on load.
    }
}
