import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import {
    chronicleEntriesPath,
    chronicleAttemptsPath
} from '../campaignDataPaths.js';
import { isRecordVisibleForContext, type TimelineRegistry } from '../timelineManager.js';
import {
    ChronicleStoreError,
    readChronicleJson,
    writeChronicleJsonAtomic,
    rotatePrimaryToBackup,
    quarantineCorruptChronicleFile
} from './chronicleAtomicJson.js';
import {
    CHRONICLE_ENTRIES_SCHEMA_VERSION,
    CHRONICLE_ATTEMPTS_SCHEMA_VERSION,
    type ChronicleEntry,
    type ChronicleEntriesFile,
    type ChronicleAttemptsFile,
    type ChronicleGenerationAttempt,
    type ChronicleAttemptStatus
} from './chronicleTypes.js';

/**
 * ChronicleStore
 *
 * Persists chronicle entries and generation attempts per campaign/player.
 * Two files on disk:
 *  - `entries.json`  - all narrative entries across all branches.
 *  - `attempts.json` - generation attempt state machine.
 *
 * Both follow the same load/validate/recover pattern as
 * {@link ChronicleMemoryStore}: try primary, try `.bak`, quarantine corrupt,
 * fail closed if both corrupt. Every mutation is write-through (atomic
 * tmp+fsync+rename) before returning.
 *
 * Core invariants:
 *  - Re-editing the same entry ID increments `revision` (Step 3).
 *  - Sibling-branch entries are never deleted; visibility is resolved at
 *    query time via {@link queryVisibleEntries} (Step 3).
 *  - Future `periodEnd` entries are not returned to the UI (Step 3).
 *  - Empty coverage entries are saved but hidden by default (Step 3).
 *  - Attempt state machine transitions are enforced (Step 4).
 *  - `committed` is forbidden until an entry has been written (Step 4).
 *  - Error messages are sanitized: no API keys, no full prompts, no player
 *    conversation text, capped to a reasonable length (Step 4).
 */
export class ChronicleStore {
    private entriesFile: ChronicleEntriesFile | undefined;
    private attemptsFile: ChronicleAttemptsFile | undefined;
    private readonly loadedIdentity: CampaignPlayerIdentity;
    private entriesLoadAttempted = false;
    private attemptsLoadAttempted = false;

    constructor(
        private readonly userDataDir: string,
        private readonly identity: CampaignPlayerIdentity
    ) {
        this.loadedIdentity = identity;
    }

    private loadEntries(): ChronicleEntriesFile {
        if (this.entriesFile !== undefined) return this.entriesFile;
        if (this.entriesLoadAttempted) {
            throw new ChronicleStoreError(
                'chronicle_corrupt',
                `entries store previously failed to load for ${this.loadedIdentity.campaignId}/${this.loadedIdentity.playerId}`
            );
        }
        this.entriesLoadAttempted = true;

        const primaryPath = chronicleEntriesPath(this.userDataDir, this.loadedIdentity);
        const backupPath = `${primaryPath}.bak`;

        const primaryResult = tryReadAndValidateEntries(primaryPath, this.loadedIdentity);
        if (primaryResult.status === 'valid') {
            this.entriesFile = primaryResult.file;
            return this.entriesFile;
        }

        const backupResult = tryReadAndValidateEntries(backupPath, this.loadedIdentity);
        if (backupResult.status === 'valid') {
            quarantineCorruptChronicleFile(primaryPath);
            this.entriesFile = backupResult.file;
            writeChronicleJsonAtomic(this.userDataDir, this.loadedIdentity, primaryPath, backupResult.file);
            return this.entriesFile;
        }

        if (primaryResult.status === 'corrupt' || backupResult.status === 'corrupt') {
            quarantineCorruptChronicleFile(primaryPath);
            quarantineCorruptChronicleFile(backupPath);
            throw new ChronicleStoreError(
                'chronicle_corrupt',
                `entries store and backup are both corrupt or missing schema for ${this.loadedIdentity.campaignId}/${this.loadedIdentity.playerId}; quarantined`
            );
        }

        this.entriesFile = createEmptyEntriesFile(this.loadedIdentity);
        return this.entriesFile;
    }

    private loadAttempts(): ChronicleAttemptsFile {
        if (this.attemptsFile !== undefined) return this.attemptsFile;
        if (this.attemptsLoadAttempted) {
            throw new ChronicleStoreError(
                'chronicle_corrupt',
                `attempts store previously failed to load for ${this.loadedIdentity.campaignId}/${this.loadedIdentity.playerId}`
            );
        }
        this.attemptsLoadAttempted = true;

        const primaryPath = chronicleAttemptsPath(this.userDataDir, this.loadedIdentity);
        const backupPath = `${primaryPath}.bak`;

        const primaryResult = tryReadAndValidateAttempts(primaryPath, this.loadedIdentity);
        if (primaryResult.status === 'valid') {
            this.attemptsFile = primaryResult.file;
            return this.attemptsFile;
        }

        const backupResult = tryReadAndValidateAttempts(backupPath, this.loadedIdentity);
        if (backupResult.status === 'valid') {
            quarantineCorruptChronicleFile(primaryPath);
            this.attemptsFile = backupResult.file;
            writeChronicleJsonAtomic(this.userDataDir, this.loadedIdentity, primaryPath, backupResult.file);
            return this.attemptsFile;
        }

        if (primaryResult.status === 'corrupt' || backupResult.status === 'corrupt') {
            quarantineCorruptChronicleFile(primaryPath);
            quarantineCorruptChronicleFile(backupPath);
            throw new ChronicleStoreError(
                'chronicle_corrupt',
                `attempts store and backup are both corrupt or missing schema for ${this.loadedIdentity.campaignId}/${this.loadedIdentity.playerId}; quarantined`
            );
        }

        this.attemptsFile = createEmptyAttemptsFile(this.loadedIdentity);
        return this.attemptsFile;
    }

    /**
     * Save an entry. If an entry with the same ID already exists, the revision
     * is incremented (Step 3). The entry is atomically persisted before
     * returning.
     */
    saveEntry(entry: ChronicleEntry): void {
        const store = this.loadEntries();
        const existingIndex = store.entries.findIndex(e => e.id === entry.id);
        if (existingIndex >= 0) {
            const existing = store.entries[existingIndex];
            const updated: ChronicleEntry = {
                ...entry,
                revision: existing.revision + 1,
                schemaVersion: CHRONICLE_ENTRIES_SCHEMA_VERSION
            };
            store.entries[existingIndex] = updated;
        } else {
            store.entries.push({
                ...entry,
                revision: 0,
                schemaVersion: CHRONICLE_ENTRIES_SCHEMA_VERSION
            });
        }
        store.updatedAt = new Date().toISOString();
        this.persistEntries();
    }

    /** Returns the entry with the given ID, or undefined. */
    getEntry(entryId: string): ChronicleEntry | undefined {
        const store = this.loadEntries();
        return store.entries.find(e => e.id === entryId);
    }

    /**
     * Query entries visible in the current branch, excluding future periodEnd
     * entries, and (by default) excluding empty coverage (Step 3).
     *
     * Visibility rules (design spec "史书可见性"):
     *  - entry's timeline node must be on the current node's ancestor chain
     *    (or have no timeline node -> legacy, visible by checkpoint epoch);
     *  - AND entry.periodEnd.totalDays <= currentGameDate.totalDays (future
     *    period end exclusion - cannot be omitted).
     */
    queryVisibleEntries(params: {
        registry?: TimelineRegistry;
        currentNodeId?: string;
        checkpointEpoch?: number;
        currentGameDate?: Ck3GameDate;
        includeEmpty?: boolean;
    }): ChronicleEntry[] {
        const store = this.loadEntries();
        return store.entries.filter(entry => {
            if (entry.status === 'empty' && !params.includeEmpty) {
                return false;
            }
            if (!isRecordVisibleForContext(
                params.registry,
                params.currentNodeId,
                {
                    votcTimelineNodeId: entry.votcTimelineNodeId,
                    votcCheckpointEpoch: entry.votcCheckpointEpoch
                },
                params.checkpointEpoch
            )) {
                return false;
            }
            if (params.currentGameDate !== undefined
                && entry.periodEnd.totalDays > params.currentGameDate.totalDays) {
                return false;
            }
            return true;
        });
    }

    /**
     * Begin a generation attempt. Idempotent by `requestKey` (Step 4):
     *  - `running` -> return existing (ignore duplicate trigger);
     *  - `committed` with same digest -> return existing (idempotent);
     *  - `committed` with changed digest -> caller should use {@link beginRevision};
     *    this method throws to surface the revision case explicitly;
     *  - `failed` -> caller should use {@link retryAttempt}; this method throws;
     *  - `pending` -> running;
     *  - none -> create and set to running.
     */
    beginAttempt(
        requestKey: string,
        periodStartDay: number,
        periodEndDay: number,
        sourceDigest?: string
    ): ChronicleGenerationAttempt {
        const store = this.loadAttempts();
        const existing = store.attempts.find(a => a.requestKey === requestKey);
        if (existing) {
            if (existing.status === 'running' || existing.status === 'pending') {
                if (existing.status === 'pending') {
                    existing.status = 'running';
                    existing.startedAt = new Date().toISOString();
                    this.persistAttempts();
                }
                return existing;
            }
            if (existing.status === 'committed') {
                if (sourceDigest === undefined || existing.sourceDigest === sourceDigest) {
                    return existing;
                }
                throw new ChronicleStoreError(
                    'chronicle_invalid_state',
                    `attempt ${requestKey} is committed with a different source digest; use beginRevision`
                );
            }
            if (existing.status === 'failed') {
                throw new ChronicleStoreError(
                    'chronicle_invalid_state',
                    `attempt ${requestKey} has failed; use retryAttempt`
                );
            }
        }
        const attempt: ChronicleGenerationAttempt = {
            requestKey,
            status: 'running',
            periodStartDay,
            periodEndDay,
            sourceDigest,
            startedAt: new Date().toISOString()
        };
        store.attempts.push(attempt);
        store.updatedAt = new Date().toISOString();
        this.persistAttempts();
        return attempt;
    }

    /**
     * Complete an attempt: running -> committed (Step 4). FORBIDDEN if no
     * entry has been written for this attempt (the entryId must exist in the
     * entries store).
     */
    completeAttempt(requestKey: string, entryId: string): ChronicleGenerationAttempt {
        const store = this.loadAttempts();
        const attempt = store.attempts.find(a => a.requestKey === requestKey);
        if (!attempt) {
            throw new ChronicleStoreError(
                'chronicle_attempt_not_found',
                `attempt ${requestKey} not found`
            );
        }
        if (attempt.status !== 'running') {
            throw new ChronicleStoreError(
                'chronicle_invalid_state',
                `attempt ${requestKey} cannot transition from ${attempt.status} to committed`
            );
        }
        const entry = this.getEntry(entryId);
        if (entry === undefined) {
            throw new ChronicleStoreError(
                'chronicle_entry_not_found',
                `cannot commit attempt ${requestKey}: entry ${entryId} has not been written`
            );
        }
        attempt.status = 'committed';
        attempt.entryId = entryId;
        attempt.completedAt = new Date().toISOString();
        attempt.sanitizedErrorCode = undefined;
        attempt.sanitizedErrorMessage = undefined;
        store.updatedAt = new Date().toISOString();
        this.persistAttempts();
        return attempt;
    }

    /**
     * Fail an attempt: running -> failed (Step 4). Error messages are
     * sanitized: no API keys, no full prompts, capped length.
     */
    failAttempt(requestKey: string, errorCode: string, errorMessage: string): ChronicleGenerationAttempt {
        const store = this.loadAttempts();
        const attempt = store.attempts.find(a => a.requestKey === requestKey);
        if (!attempt) {
            throw new ChronicleStoreError(
                'chronicle_attempt_not_found',
                `attempt ${requestKey} not found`
            );
        }
        if (attempt.status !== 'running') {
            throw new ChronicleStoreError(
                'chronicle_invalid_state',
                `attempt ${requestKey} cannot transition from ${attempt.status} to failed`
            );
        }
        attempt.status = 'failed';
        attempt.sanitizedErrorCode = sanitizeErrorCode(errorCode);
        attempt.sanitizedErrorMessage = sanitizeErrorMessage(errorMessage);
        store.updatedAt = new Date().toISOString();
        this.persistAttempts();
        return attempt;
    }

    /**
     * Retry a failed attempt: failed -> running (Step 4).
     */
    retryAttempt(requestKey: string): ChronicleGenerationAttempt {
        const store = this.loadAttempts();
        const attempt = store.attempts.find(a => a.requestKey === requestKey);
        if (!attempt) {
            throw new ChronicleStoreError(
                'chronicle_attempt_not_found',
                `attempt ${requestKey} not found`
            );
        }
        if (attempt.status !== 'failed') {
            throw new ChronicleStoreError(
                'chronicle_invalid_state',
                `attempt ${requestKey} cannot transition from ${attempt.status} to running (retry)`
            );
        }
        attempt.status = 'running';
        attempt.startedAt = new Date().toISOString();
        attempt.sanitizedErrorCode = undefined;
        attempt.sanitizedErrorMessage = undefined;
        store.updatedAt = new Date().toISOString();
        this.persistAttempts();
        return attempt;
    }

    /**
     * Begin a revision of a committed attempt: committed + digest changed ->
     * running (Step 4). Resets the entryId so a new entry must be written
     * before the next commit. If the digest is unchanged, the attempt is
     * returned as-is unless `force` is true (explicit user regeneration).
     */
    beginRevision(
        requestKey: string,
        newSourceDigest: string,
        force = false
    ): ChronicleGenerationAttempt {
        const store = this.loadAttempts();
        const attempt = store.attempts.find(a => a.requestKey === requestKey);
        if (!attempt) {
            throw new ChronicleStoreError(
                'chronicle_attempt_not_found',
                `attempt ${requestKey} not found`
            );
        }
        if (attempt.status !== 'committed') {
            throw new ChronicleStoreError(
                'chronicle_invalid_state',
                `attempt ${requestKey} cannot begin revision from ${attempt.status}`
            );
        }
        if (attempt.sourceDigest === newSourceDigest && !force) {
            return attempt;
        }
        attempt.status = 'running';
        attempt.sourceDigest = newSourceDigest;
        attempt.entryId = undefined;
        attempt.completedAt = undefined;
        attempt.sanitizedErrorCode = undefined;
        attempt.sanitizedErrorMessage = undefined;
        attempt.startedAt = new Date().toISOString();
        store.updatedAt = new Date().toISOString();
        this.persistAttempts();
        return attempt;
    }

    /** Returns the attempt with the given requestKey, or undefined. */
    getAttempt(requestKey: string): ChronicleGenerationAttempt | undefined {
        const store = this.loadAttempts();
        return store.attempts.find(a => a.requestKey === requestKey);
    }

    /**
     * Returns all attempts. ChronicleGenerationAttempt records do not carry
     * timeline node/checkpoint fields, so branch filtering is not applicable
     * here (unlike {@link queryVisibleEntries}).
     */
    queryAttempts(): ChronicleGenerationAttempt[] {
        const store = this.loadAttempts();
        return [...store.attempts];
    }

    /**
     * Find an existing attempt whose period matches the given start/end days.
     */
    findAttemptByPeriod(periodStartDay: number, periodEndDay: number): ChronicleGenerationAttempt | undefined {
        const store = this.loadAttempts();
        return store.attempts.find(a =>
            a.periodStartDay === periodStartDay && a.periodEndDay === periodEndDay
        );
    }

    private persistEntries(): void {
        if (this.entriesFile === undefined) return;
        const primaryPath = chronicleEntriesPath(this.userDataDir, this.loadedIdentity);
        const backupPath = `${primaryPath}.bak`;
        if (fs_exists(primaryPath)) {
            rotatePrimaryToBackup(this.userDataDir, this.loadedIdentity, primaryPath, backupPath);
        }
        writeChronicleJsonAtomic(this.userDataDir, this.loadedIdentity, primaryPath, this.entriesFile);
    }

    private persistAttempts(): void {
        if (this.attemptsFile === undefined) return;
        const primaryPath = chronicleAttemptsPath(this.userDataDir, this.loadedIdentity);
        const backupPath = `${primaryPath}.bak`;
        if (fs_exists(primaryPath)) {
            rotatePrimaryToBackup(this.userDataDir, this.loadedIdentity, primaryPath, backupPath);
        }
        writeChronicleJsonAtomic(this.userDataDir, this.loadedIdentity, primaryPath, this.attemptsFile);
    }
}

function createEmptyEntriesFile(identity: CampaignPlayerIdentity): ChronicleEntriesFile {
    return {
        schemaVersion: CHRONICLE_ENTRIES_SCHEMA_VERSION,
        campaignId: identity.campaignId,
        playerId: identity.playerId,
        updatedAt: new Date().toISOString(),
        entries: []
    };
}

function createEmptyAttemptsFile(identity: CampaignPlayerIdentity): ChronicleAttemptsFile {
    return {
        schemaVersion: CHRONICLE_ATTEMPTS_SCHEMA_VERSION,
        campaignId: identity.campaignId,
        playerId: identity.playerId,
        updatedAt: new Date().toISOString(),
        attempts: []
    };
}

type ReadResult<T> =
    | { status: 'valid'; file: T }
    | { status: 'missing' }
    | { status: 'corrupt' };

function tryReadAndValidateEntries(filePath: string, identity: CampaignPlayerIdentity): ReadResult<ChronicleEntriesFile> {
    if (!fs_exists(filePath)) return { status: 'missing' };
    let parsed: unknown;
    try {
        parsed = readChronicleJson(filePath);
    } catch {
        return { status: 'corrupt' };
    }
    if (parsed === undefined) return { status: 'missing' };
    const validated = validateEntriesFile(parsed, identity);
    if (validated === undefined) return { status: 'corrupt' };
    return { status: 'valid', file: validated };
}

function tryReadAndValidateAttempts(filePath: string, identity: CampaignPlayerIdentity): ReadResult<ChronicleAttemptsFile> {
    if (!fs_exists(filePath)) return { status: 'missing' };
    let parsed: unknown;
    try {
        parsed = readChronicleJson(filePath);
    } catch {
        return { status: 'corrupt' };
    }
    if (parsed === undefined) return { status: 'missing' };
    const validated = validateAttemptsFile(parsed, identity);
    if (validated === undefined) return { status: 'corrupt' };
    return { status: 'valid', file: validated };
}

function validateEntriesFile(parsed: unknown, identity: CampaignPlayerIdentity): ChronicleEntriesFile | undefined {
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const p = parsed as Record<string, unknown>;
    if (p.schemaVersion !== CHRONICLE_ENTRIES_SCHEMA_VERSION) return undefined;
    if (p.campaignId !== identity.campaignId) return undefined;
    if (p.playerId !== identity.playerId) return undefined;
    if (typeof p.updatedAt !== 'string') return undefined;
    if (!Array.isArray(p.entries)) return undefined;

    const entries: ChronicleEntry[] = [];
    for (const raw of p.entries) {
        const entry = validateEntry(raw);
        if (entry === undefined) return undefined;
        entries.push(entry);
    }

    return {
        schemaVersion: CHRONICLE_ENTRIES_SCHEMA_VERSION,
        campaignId: identity.campaignId,
        playerId: identity.playerId,
        updatedAt: p.updatedAt,
        entries
    };
}

function validateEntry(raw: unknown): ChronicleEntry | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const e = raw as Record<string, unknown>;
    if (e.schemaVersion !== CHRONICLE_ENTRIES_SCHEMA_VERSION) return undefined;
    if (typeof e.id !== 'string' || e.id.length === 0) return undefined;
    if (e.status !== 'ready' && e.status !== 'empty') return undefined;
    if (e.reason !== 'quarterly' && e.reason !== 'yearly' && e.reason !== 'manual'
        && e.reason !== 'backfill' && e.reason !== 'catch_up') return undefined;
    if (typeof e.playerId !== 'string' || e.playerId.length === 0) return undefined;
    if (typeof e.playerName !== 'string') return undefined;
    if (e.playerTitle !== undefined && typeof e.playerTitle !== 'string') return undefined;
    if (!isCk3GameDate(e.periodStart)) return undefined;
    if (!isCk3GameDate(e.periodEnd)) return undefined;
    if (typeof e.title !== 'string') return undefined;
    if (e.content !== undefined && typeof e.content !== 'string') return undefined;
    if (!Array.isArray(e.sourceManifest)) return undefined;
    if (typeof e.sourceDigest !== 'string') return undefined;
    if (typeof e.promptVersion !== 'number' || !Number.isInteger(e.promptVersion) || e.promptVersion < 0) return undefined;
    if (typeof e.generatedAt !== 'string') return undefined;
    if (typeof e.revision !== 'number' || !Number.isInteger(e.revision) || e.revision < 0) return undefined;
    if (typeof e.sourceStats !== 'object' || e.sourceStats === null) return undefined;
    if (!validateSourceStats(e.sourceStats)) return undefined;
    if (e.votcCheckpointEpoch !== undefined && (typeof e.votcCheckpointEpoch !== 'number' || !Number.isInteger(e.votcCheckpointEpoch))) return undefined;
    if (e.votcTimelineNodeId !== undefined && typeof e.votcTimelineNodeId !== 'string') return undefined;
    if (e.votcTimelineParentId !== undefined && typeof e.votcTimelineParentId !== 'string') return undefined;
    return e as unknown as ChronicleEntry;
}

function validateSourceStats(raw: unknown): boolean {
    if (typeof raw !== 'object' || raw === null) return false;
    const s = raw as Record<string, unknown>;
    const numericNonNeg = (v: unknown): boolean =>
        typeof v === 'number' && Number.isInteger(v) && v >= 0;
    return numericNonNeg(s.total)
        && numericNonNeg(s.rawConversationCount)
        && numericNonNeg(s.summarizedConversationCount)
        && numericNonNeg(s.memoryCount)
        && numericNonNeg(s.digestedMemoryCount)
        && numericNonNeg(s.letterCount)
        && numericNonNeg(s.battleReportCount)
        && numericNonNeg(s.rawVisibleChars)
        && numericNonNeg(s.selectedVisibleChars)
        && numericNonNeg(s.promptInputTokens);
}

function validateAttemptsFile(parsed: unknown, identity: CampaignPlayerIdentity): ChronicleAttemptsFile | undefined {
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const p = parsed as Record<string, unknown>;
    if (p.schemaVersion !== CHRONICLE_ATTEMPTS_SCHEMA_VERSION) return undefined;
    if (p.campaignId !== identity.campaignId) return undefined;
    if (p.playerId !== identity.playerId) return undefined;
    if (typeof p.updatedAt !== 'string') return undefined;
    if (!Array.isArray(p.attempts)) return undefined;

    const attempts: ChronicleGenerationAttempt[] = [];
    for (const raw of p.attempts) {
        const attempt = validateAttempt(raw);
        if (attempt === undefined) return undefined;
        attempts.push(attempt);
    }

    return {
        schemaVersion: CHRONICLE_ATTEMPTS_SCHEMA_VERSION,
        campaignId: identity.campaignId,
        playerId: identity.playerId,
        updatedAt: p.updatedAt,
        attempts
    };
}

function validateAttempt(raw: unknown): ChronicleGenerationAttempt | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const a = raw as Record<string, unknown>;
    if (typeof a.requestKey !== 'string' || a.requestKey.length === 0) return undefined;
    if (!isAttemptStatus(a.status)) return undefined;
    if (a.entryId !== undefined && typeof a.entryId !== 'string') return undefined;
    if (typeof a.periodStartDay !== 'number' || !Number.isInteger(a.periodStartDay)) return undefined;
    if (typeof a.periodEndDay !== 'number' || !Number.isInteger(a.periodEndDay)) return undefined;
    if (a.sourceDigest !== undefined && typeof a.sourceDigest !== 'string') return undefined;
    if (a.startedAt !== undefined && typeof a.startedAt !== 'string') return undefined;
    if (a.completedAt !== undefined && typeof a.completedAt !== 'string') return undefined;
    if (a.sanitizedErrorCode !== undefined && typeof a.sanitizedErrorCode !== 'string') return undefined;
    if (a.sanitizedErrorMessage !== undefined && typeof a.sanitizedErrorMessage !== 'string') return undefined;
    return a as unknown as ChronicleGenerationAttempt;
}

function isAttemptStatus(value: unknown): value is ChronicleAttemptStatus {
    return value === 'pending' || value === 'running' || value === 'failed' || value === 'committed';
}

function isCk3GameDate(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const d = value as Record<string, unknown>;
    return typeof d.totalDays === 'number' && Number.isInteger(d.totalDays) && d.totalDays > 0
        && typeof d.year === 'number' && Number.isInteger(d.year) && d.year > 0
        && typeof d.month === 'number' && Number.isInteger(d.month) && d.month >= 1 && d.month <= 12
        && typeof d.day === 'number' && Number.isInteger(d.day) && d.day >= 1 && d.day <= 31
        && typeof d.display === 'string';
}

const MAX_ERROR_MESSAGE_LENGTH = 500;
const API_KEY_PATTERN = /sk-[A-Za-z0-9_\-]{16,}/g;
const ANTHROPIC_KEY_PATTERN = /sk-ant-[A-Za-z0-9_\-]{16,}/g;
const GOOGLE_KEY_PATTERN = /AIza[A-Za-z0-9_\-]{16,}/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_\-\.]{16,}/gi;

function sanitizeErrorCode(code: string): string {
    return code.slice(0, 100);
}

function sanitizeErrorMessage(message: string): string {
    let sanitized = message
        .replace(API_KEY_PATTERN, '[REDACTED_KEY]')
        .replace(ANTHROPIC_KEY_PATTERN, '[REDACTED_KEY]')
        .replace(GOOGLE_KEY_PATTERN, '[REDACTED_KEY]')
        .replace(BEARER_PATTERN, '[REDACTED_TOKEN]');
    if (sanitized.length > MAX_ERROR_MESSAGE_LENGTH) {
        sanitized = sanitized.slice(0, MAX_ERROR_MESSAGE_LENGTH) + '...[truncated]';
    }
    return sanitized;
}

function fs_exists(filePath: string): boolean {
    try {
        const fs = require('fs');
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}
