import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import {
    TIMELINE_DIAGNOSTIC_MARKER,
    escapeTimelineField,
    unescapeTimelineField
} from './timelineCommitResult.js';

/**
 * Phase 3 transaction manifest (§7.4). Records the business-transaction
 * state for one attempt: target node, record IDs, staged payloads, artifact
 * path + SHA-256, and the ordered list of completed steps. Crash recovery
 * reads the completedSteps field (not "does the business file exist") to
 * decide which steps remain to replay or whether to roll back.
 *
 * Phase 5 will add the transition-journal entry into the journal field and
 * reuse the same manifest mechanism; Phase 3 leaves it undefined.
 */
export interface TransactionManifest {
    attemptId: string;
    targetNode: string;
    recordIds: string[];
    artifactPath: string;
    status: 'in_progress' | 'committed' | 'aborted';
    stagedRecords: Record<string, StagedRecord>;
    artifact?: ArtifactRef;
    completedSteps: string[];
    abortReason?: string;
    createdAt: string;
    updatedAt: string;
    /**
     * Phase 5 placeholder. Undefined in Phase 3. When the transition
     * journal is added, this holds the journal entry reference; it must
     * not be populated with fake placeholder objects in Phase 3.
     */
    journal?: unknown;
}

export interface StagedRecord {
    recordId: string;
    path?: string;
    payload: unknown;
    sha256: string;
}

export interface ArtifactRef {
    path: string;
    tmpPath: string;
    sha256: string;
}

export type TransactionStatus = TransactionManifest['status'];

export interface TransactionState {
    attemptId: string;
    targetNode: string;
    recordIds: string[];
    artifactPath: string;
    status: TransactionStatus;
    stagedRecords: Record<string, StagedRecord>;
    artifact?: ArtifactRef;
    completedSteps: string[];
    abortReason?: string;
}

export interface PendingStagedRecord {
    path?: string;
    sha256: string;
}

export interface PendingTransaction {
    attemptId: string;
    targetNode: string;
    recordIds: string[];
    artifactPath: string;
    completedSteps: string[];
    stagedRecordIds: string[];
    stagedRecords: Record<string, PendingStagedRecord>;
    artifactWritten: boolean;
}

export interface BeginTransactionOptions {
    targetNode: string;
    recordIds: string[];
    artifactPath: string;
}

/**
 * Thrown when a caller mixes stageRecordPayload and upsertRecord on the same
 * recordId in a way that would desync the manifest from the on-disk file
 * (I-1). Staging-in-manifest and business-file-upsert are distinct operations;
 * once a record has a path (from upsertRecord), stageRecordPayload with a
 * different payload is rejected, and vice versa.
 */
export class TransactionRecordConflictError extends Error {
    readonly code = 'TIMELINE_TRANSACTION_RECORD_CONFLICT';

    constructor(
        readonly attemptId: string,
        readonly recordId: string,
        readonly detail: string
    ) {
        super(`timelineTransactionStore: record conflict for ${attemptId}/${recordId}: ${detail}`);
        this.name = 'TransactionRecordConflictError';
    }
}

const STEP_WRITE_ARTIFACT = 'write_artifact';
const STEP_COMMIT = 'commit';
const RECORD_STEP_PREFIX = 'record:';

function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

function sha256Hex(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}

function serializeJson(value: unknown): string {
    return JSON.stringify(value, null, '\t');
}

function serializePayload(payload: unknown): { content: string; sha256: string } {
    const content = serializeJson(payload);
    return { content, sha256: sha256Hex(content) };
}

function transactionsRoot(userDataDir: string): string {
    return path.join(userDataDir, 'votc_data', 'transactions');
}

function manifestPathFor(userDataDir: string, attemptId: string): string {
    return path.join(transactionsRoot(userDataDir), attemptId, 'manifest.json');
}

function tmpArtifactPathFor(artifactPath: string): string {
    return `${artifactPath}.tmp`;
}

function formatTransactionDiagnosticLine(type: string, ...fields: readonly (string | number | undefined)[]): string {
    const suffix = fields.map(escapeTimelineField).join('/;/');
    return `${TIMELINE_DIAGNOSTIC_MARKER}transaction/;/${escapeTimelineField(type)}${suffix ? `/;/${suffix}` : ''}`;
}

/**
 * Atomic write with fsync (I-2). Writes content to a tmp file, fsyncs the
 * file fd (so the data reaches durable storage before the rename), renames
 * tmp -> target, then best-effort fsyncs the parent directory (the WAL
 * pattern; on Windows dir fsync is a no-op but harmless). If the dir fsync
 * fails (unsupported platform / read-only dir), the rename has already
 * committed the file content, so the error is swallowed.
 */
function atomicWriteFileWithFsync(targetPath: string, content: string): void {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const tmpPath = `${targetPath}.tmp`;
    const fd = fs.openSync(tmpPath, 'w');
    try {
        fs.writeFileSync(fd, content, 'utf8');
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, targetPath);
    // Best-effort parent directory fsync. Errors here are non-fatal: the
    // file content is already durable via the tmp fsync + rename.
    try {
        const dirFd = fs.openSync(path.dirname(targetPath), 'r');
        try {
            fs.fsyncSync(dirFd);
        } finally {
            fs.closeSync(dirFd);
        }
    } catch {
        // Some platforms / filesystems do not support directory fsync.
        // The rename has already committed the file; ignore.
    }
}

function parseTransactionManifest(raw: string): TransactionManifest | undefined {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return undefined;
    }
    if (!isObject(parsed)) return undefined;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.attemptId !== 'string' || typeof obj.targetNode !== 'string'
        || !Array.isArray(obj.recordIds) || typeof obj.artifactPath !== 'string'
        || typeof obj.status !== 'string' || !isObject(obj.stagedRecords)
        || !Array.isArray(obj.completedSteps)
        || typeof obj.createdAt !== 'string' || typeof obj.updatedAt !== 'string') {
        return undefined;
    }
    return obj as unknown as TransactionManifest;
}

/**
 * Recoverable business-transaction store (§7.4 P3.3).
 *
 * Each transaction is persisted at
 *   <userData>/votc_data/transactions/<attemptId>/manifest.json
 * The manifest is the single source of truth for recovery: it records which
 * steps have completed, so a crash-recovery scan does not need to guess
 * state from the presence or absence of business files on disk.
 */
export class TimelineTransactionStore {
    constructor(private readonly userDataDir: string) {}

    beginTransaction(attemptId: string, options: BeginTransactionOptions): void {
        const existing = this.readManifest(attemptId);
        if (existing) {
            if (existing.status === 'committed' || existing.status === 'aborted') {
                throw new Error(
                    `timelineTransactionStore: cannot begin transaction ${attemptId}: `
                    + `already in terminal status '${existing.status}'`
                );
            }
            // Idempotent re-begin: an in-progress transaction is left intact.
            return;
        }
        const now = new Date().toISOString();
        const manifest: TransactionManifest = {
            attemptId,
            targetNode: options.targetNode,
            recordIds: [...options.recordIds],
            artifactPath: options.artifactPath,
            status: 'in_progress',
            stagedRecords: {},
            completedSteps: [],
            createdAt: now,
            updatedAt: now
        };
        this.writeManifest(manifest);
    }

    stageRecordPayload(attemptId: string, recordId: string, payload: unknown): void {
        const manifest = this.requireInProgress(attemptId);
        const { sha256 } = serializePayload(payload);
        const existing = manifest.stagedRecords[recordId];
        if (existing && existing.sha256 === sha256) {
            return; // idempotent
        }
        // I-1: reject cross-use that would desync the manifest from the
        // on-disk file. If this record already has a path (from a prior
        // upsertRecord), staging a DIFFERENT payload would drop the path
        // and leave completedSteps claiming the record is written while
        // the manifest's staged payload disagrees with the on-disk file.
        if (existing && existing.path !== undefined && existing.sha256 !== sha256) {
            throw new TransactionRecordConflictError(
                attemptId,
                recordId,
                'record was already upserted to a file; cannot stage a different payload '
                + '(would drop the path and desync manifest from on-disk file)'
            );
        }
        manifest.stagedRecords[recordId] = {
            recordId,
            // Preserve an existing path if the payload is the same (no-op
            // case is handled above; this guards the same-payload re-stage
            // after an upsert).
            path: existing?.path,
            payload,
            sha256
        };
        manifest.updatedAt = new Date().toISOString();
        this.writeManifest(manifest);
    }

    markStepCompleted(attemptId: string, step: string): void {
        const manifest = this.requireInProgress(attemptId);
        if (manifest.completedSteps.includes(step)) {
            return; // idempotent
        }
        manifest.completedSteps.push(step);
        manifest.updatedAt = new Date().toISOString();
        this.writeManifest(manifest);
    }

    upsertRecord(attemptId: string, recordId: string, recordPath: string, payload: unknown): void {
        const manifest = this.requireInProgress(attemptId);
        const { content, sha256 } = serializePayload(payload);

        // I-1: reject cross-use that would desync the manifest from the
        // on-disk file. If this record was already STAGED (no path) with a
        // DIFFERENT payload, upserting a different payload to disk would
        // create an on-disk file whose content disagrees with the staged
        // payload recorded earlier.
        const existing = manifest.stagedRecords[recordId];
        if (existing && existing.path === undefined && existing.sha256 !== sha256) {
            throw new TransactionRecordConflictError(
                attemptId,
                recordId,
                'record was already staged with a different payload; cannot upsert a '
                + 'different payload to disk (would desync on-disk file from staged manifest)'
            );
        }

        const alreadyWritten = manifest.completedSteps.includes(`${RECORD_STEP_PREFIX}${recordId}`);
        if (alreadyWritten) {
            const staged = manifest.stagedRecords[recordId];
            // If the staged hash matches AND the on-disk file already matches,
            // skip the write entirely (crash-recovery idempotence). Otherwise
            // overwrite (at-least-once).
            if (staged && staged.sha256 === sha256 && staged.path === recordPath) {
                let onDiskMatches = false;
                try {
                    const existingContent = fs.readFileSync(recordPath, 'utf8');
                    onDiskMatches = existingContent === content;
                } catch {
                    onDiskMatches = false;
                }
                if (onDiskMatches) {
                    return; // no rewrite needed
                }
            }
        }

        atomicWriteFileWithFsync(recordPath, content);

        manifest.stagedRecords[recordId] = { recordId, path: recordPath, payload, sha256 };
        const step = `${RECORD_STEP_PREFIX}${recordId}`;
        if (!manifest.completedSteps.includes(step)) {
            manifest.completedSteps.push(step);
        }
        manifest.updatedAt = new Date().toISOString();
        this.writeManifest(manifest);
    }

    writeArtifactAtomic(attemptId: string, artifactPath: string, content: string): void {
        const manifest = this.requireInProgress(attemptId);
        const sha256 = sha256Hex(content);

        // Idempotent: if the manifest already has an artifact entry with the
        // same path and hash, and the on-disk file matches, skip the write.
        if (manifest.artifact && manifest.artifact.path === artifactPath && manifest.artifact.sha256 === sha256) {
            let onDiskMatches = false;
            try {
                const existing = fs.readFileSync(artifactPath, 'utf8');
                onDiskMatches = existing === content;
            } catch {
                onDiskMatches = false;
            }
            if (onDiskMatches) {
                return;
            }
        }

        atomicWriteFileWithFsync(artifactPath, content);

        manifest.artifact = { path: artifactPath, tmpPath: tmpArtifactPathFor(artifactPath), sha256 };
        if (!manifest.completedSteps.includes(STEP_WRITE_ARTIFACT)) {
            manifest.completedSteps.push(STEP_WRITE_ARTIFACT);
        }
        manifest.updatedAt = new Date().toISOString();
        this.writeManifest(manifest);
    }

    commitTransaction(attemptId: string): void {
        const manifest = this.requireInProgress(attemptId);
        if (!manifest.completedSteps.includes(STEP_COMMIT)) {
            manifest.completedSteps.push(STEP_COMMIT);
        }
        manifest.status = 'committed';
        manifest.updatedAt = new Date().toISOString();
        this.writeManifest(manifest);
    }

    abortTransaction(attemptId: string, reason: string): void {
        const manifest = this.readManifest(attemptId);
        if (!manifest) {
            // No manifest to abort; record a minimal aborted manifest so the
            // attempt is not re-discovered by recovery as in-progress.
            const now = new Date().toISOString();
            this.writeManifest({
                attemptId,
                targetNode: '',
                recordIds: [],
                artifactPath: '',
                status: 'aborted',
                stagedRecords: {},
                completedSteps: [],
                abortReason: reason,
                createdAt: now,
                updatedAt: now
            });
            this.emitAbortDiagnostic(attemptId, reason, 0, 0, false);
            return;
        }
        if (manifest.status === 'committed') {
            throw new Error(
                `timelineTransactionStore: cannot abort transaction ${attemptId}: already committed`
            );
        }
        manifest.status = 'aborted';
        manifest.abortReason = reason;
        manifest.updatedAt = new Date().toISOString();
        this.writeManifest(manifest);

        const stagedCount = Object.keys(manifest.stagedRecords).length;
        const artifactWritten = manifest.completedSteps.includes(STEP_WRITE_ARTIFACT);
        this.emitAbortDiagnostic(
            attemptId,
            reason,
            stagedCount,
            manifest.completedSteps.length,
            artifactWritten
        );
    }

    getTransactionState(attemptId: string): TransactionState | undefined {
        const manifest = this.readManifest(attemptId);
        if (!manifest) return undefined;
        return {
            attemptId: manifest.attemptId,
            targetNode: manifest.targetNode,
            recordIds: manifest.recordIds,
            artifactPath: manifest.artifactPath,
            status: manifest.status,
            stagedRecords: manifest.stagedRecords,
            artifact: manifest.artifact,
            completedSteps: manifest.completedSteps,
            abortReason: manifest.abortReason
        };
    }

    /**
     * Scan the transactions directory for manifest.json files whose status is
     * still 'in_progress'. Returns their state so the caller can replay
     * remaining steps or roll back. Only the manifest's completedSteps are
     * used to decide what remains; this method does NOT stat business files
     * to infer state.
     *
     * Orphan manifest tmp files (left over from a crashed writeManifest) are
     * quarantined so they cannot be mistaken for a real manifest on a later
     * scan.
     */
    recoverPendingTransactions(): PendingTransaction[] {
        const root = transactionsRoot(this.userDataDir);
        let attemptDirs: string[];
        try {
            attemptDirs = fs.readdirSync(root, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name);
        } catch {
            return [];
        }

        const pending: PendingTransaction[] = [];
        for (const attemptId of attemptDirs) {
            const manifestPath = manifestPathFor(this.userDataDir, attemptId);

            // Always check for an orphan manifest tmp (left over from a
            // crashed writeManifest). Whether or not manifest.json is
            // readable, the orphan tmp must not linger across recoveries.
            this.quarantineOrphanManifestTmp(manifestPath);

            let raw: string;
            try {
                raw = fs.readFileSync(manifestPath, 'utf8');
            } catch {
                continue;
            }
            const manifest = parseTransactionManifest(raw);
            if (!manifest) {
                // Corrupt/garbage manifest: skip it (don't crash recovery).
                continue;
            }
            if (manifest.status !== 'in_progress') continue;

            // Build the staged records snapshot (path + sha256 only, no
            // payload content) so Phase 6 replay knows where to write and
            // can verify the on-disk file matches.
            const stagedRecords: Record<string, PendingStagedRecord> = {};
            for (const [recordId, staged] of Object.entries(manifest.stagedRecords)) {
                stagedRecords[recordId] = {
                    path: staged.path,
                    sha256: staged.sha256
                };
            }

            pending.push({
                attemptId: manifest.attemptId,
                targetNode: manifest.targetNode,
                recordIds: manifest.recordIds,
                artifactPath: manifest.artifactPath,
                completedSteps: [...manifest.completedSteps],
                stagedRecordIds: Object.keys(manifest.stagedRecords),
                stagedRecords,
                artifactWritten: manifest.completedSteps.includes(STEP_WRITE_ARTIFACT)
            });
        }
        return pending;
    }

    private quarantineOrphanManifestTmp(manifestPath: string): void {
        const tmpPath = `${manifestPath}.tmp`;
        if (!fs.existsSync(tmpPath)) return;
        try {
            const quarantineDir = path.join(path.dirname(manifestPath), 'quarantine');
            fs.mkdirSync(quarantineDir, { recursive: true });
            const base = path.basename(manifestPath, '.json');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let dest = path.join(quarantineDir, `${base}.orphan-manifest-tmp.${timestamp}.json`);
            let suffix = 0;
            while (fs.existsSync(dest)) {
                suffix++;
                dest = path.join(quarantineDir, `${base}.orphan-manifest-tmp.${timestamp}.${suffix}.json`);
            }
            fs.copyFileSync(tmpPath, dest);
            console.warn(`[timelineTransactionStore] Quarantined orphan manifest tmp ${tmpPath} -> ${dest}`);
        } catch (error) {
            console.warn(`[timelineTransactionStore] Failed to quarantine orphan manifest tmp ${tmpPath}: ${error}`);
        }
        try {
            fs.unlinkSync(tmpPath);
        } catch {
            // best effort
        }
    }

    private requireInProgress(attemptId: string): TransactionManifest {
        const manifest = this.readManifest(attemptId);
        if (!manifest) {
            throw new Error(`timelineTransactionStore: no transaction in progress for attemptId=${attemptId}`);
        }
        if (manifest.status === 'committed') {
            throw new Error(
                `timelineTransactionStore: transaction ${attemptId} is committed; cannot mutate`
            );
        }
        if (manifest.status === 'aborted') {
            throw new Error(
                `timelineTransactionStore: transaction ${attemptId} is aborted; cannot mutate`
            );
        }
        return manifest;
    }

    private readManifest(attemptId: string): TransactionManifest | undefined {
        const manifestPath = manifestPathFor(this.userDataDir, attemptId);
        let raw: string;
        try {
            raw = fs.readFileSync(manifestPath, 'utf8');
        } catch {
            return undefined;
        }
        return parseTransactionManifest(raw);
    }

    private writeManifest(manifest: TransactionManifest): void {
        const manifestPath = manifestPathFor(this.userDataDir, manifest.attemptId);
        const payload = serializeJson(manifest);
        atomicWriteFileWithFsync(manifestPath, payload);
    }

    private emitAbortDiagnostic(
        attemptId: string,
        reason: string,
        stagedRecordCount: number,
        completedStepCount: number,
        artifactWritten: boolean
    ): void {
        // Structured diagnostic: metadata only. Never emit the payload content
        // or artifact content from the manifest.
        const line = formatTransactionDiagnosticLine(
            'abort',
            attemptId,
            reason,
            stagedRecordCount,
            completedStepCount,
            artifactWritten ? '1' : '0'
        );
        console.warn(line);
    }
}

/**
 * Reserved for Phase 5: parse a structured transaction diagnostic line back
 * into its fields. Exposed now so Phase 5's journal consumer can reuse the
 * same parsing path without duplicating the format. The format is:
 *   VOTC:TIMELINE/;/transaction/;/<subtype>/;/<field1>/;/...
 * Returns { type: 'transaction/<subtype>', fields: [...] } or null if the
 * line is not a transaction diagnostic.
 */
export function parseTransactionDiagnosticLine(line: string): {
    type: string;
    fields: string[];
} | null {
    const markerIndex = line.indexOf(TIMELINE_DIAGNOSTIC_MARKER);
    if (markerIndex === -1) return null;
    const parts = line
        .substring(markerIndex + TIMELINE_DIAGNOSTIC_MARKER.length)
        .split('/;/')
        .map(part => part.trim());
    if (parts[0] !== 'transaction') return null;
    const subtype = parts[1] ?? '';
    return {
        type: subtype ? `transaction/${subtype}` : 'transaction',
        fields: parts.slice(2).map(unescapeTimelineField)
    };
}

// Re-exported for tests and Phase 5/6/7 integration.
export {
    STEP_WRITE_ARTIFACT,
    STEP_COMMIT,
    RECORD_STEP_PREFIX,
    transactionsRoot as _transactionsRoot,
    manifestPathFor as _manifestPathFor,
    serializePayload as _serializePayload,
    atomicWriteFileWithFsync as _atomicWriteFileWithFsync,
    formatTransactionDiagnosticLine as _formatTransactionDiagnosticLine
};
