import { randomUUID } from 'crypto';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import type { MemoryTypeTokenSource } from '../../shared/gameData/GameData.js';
import {
    chronicleMemoryStorePath,
    chronicleMemoryBackupPath
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
    CHRONICLE_MEMORY_STORE_SCHEMA_VERSION,
    type ChronicleMemoryObservationInput,
    type ChronicleMemoryObservationResult,
    type ChronicleMemoryRecord,
    type ChronicleMemoryStoreFile,
    type ChronicleMemoryTimelineAnchor
} from './chronicleTypes.js';
import {
    canonicalParticipantIds,
    computeIdentityAnchor,
    computeMemoryKey,
    computeRenderedDescriptionHash,
    normalizeMemoryTypeToken,
    resolveFirstVisibleTimelineAnchor
} from './chronicleMemoryIdentity.js';

/**
 * ChronicleMemoryStore
 *
 * Persists character memory observations per campaign/player. The store is
 * the authoritative historical record: a {@link ChronicleMemoryStoreFile} on
 * disk, written through with atomic tmp+fsync+rename. In-memory cache is only
 * an acceleration; the file is the source of truth.
 *
 * Core invariants enforced here:
 *  - Frozen fields are write-once per timeline branch (Step 5).
 *  - Subsequent observations only add/merge observation rows (Step 6).
 *  - Reconciliation only considers records visible in the current branch
 *    (Step 7); sibling-branch records stay in the file but cannot be reused.
 *  - {@link observeGameData} / {@link observeChronicleSnapshot} return Promises
 *    that resolve only after the batch is durably persisted (Step 8).
 *  - CK3 forgetting a memory never deletes the persisted observation (the
 *    store only adds; it never prunes on snapshot absence).
 */
export class ChronicleMemoryStore {
    private file: ChronicleMemoryStoreFile | undefined;
    private readonly loadedIdentity: CampaignPlayerIdentity;
    private loadAttempted = false;

    constructor(
        private readonly userDataDir: string,
        private readonly identity: CampaignPlayerIdentity
    ) {
        this.loadedIdentity = identity;
    }

    /**
     * Lazily load and validate the store file. On first access:
     *  - missing file => create an empty schema v1 store (not yet persisted;
     *    persistence happens on the first observe call).
     *  - parse/schema failure => try `.bak`; if both fail, quarantine the
     *    corrupt files and throw {@link ChronicleStoreError}(chronicle_corrupt)
     *    so the Coordinator can mark this player unhealthy and fail closed.
     */
    private load(): ChronicleMemoryStoreFile {
        if (this.file !== undefined) return this.file;
        if (this.loadAttempted) {
            throw new ChronicleStoreError(
                'chronicle_corrupt',
                `memory store previously failed to load for ${this.identity.campaignId}/${this.identity.playerId}`
            );
        }
        this.loadAttempted = true;

        const primaryPath = chronicleMemoryStorePath(this.userDataDir, this.loadedIdentity);
        const backupPath = chronicleMemoryBackupPath(this.userDataDir, this.loadedIdentity);

        // Try the primary first.
        const primaryResult = tryReadAndValidate(primaryPath, this.loadedIdentity);
        if (primaryResult.status === 'valid') {
            this.file = primaryResult.file;
            return this.file;
        }

        // Primary missing or schema-invalid: try the backup.
        const backupResult = tryReadAndValidate(backupPath, this.loadedIdentity);
        if (backupResult.status === 'valid') {
            // Recover: quarantine the corrupt primary (if it exists), then
            // rewrite the primary from the validated backup so future loads
            // find a valid primary.
            quarantineCorruptChronicleFile(primaryPath);
            this.file = backupResult.file;
            writeChronicleJsonAtomic(this.userDataDir, this.loadedIdentity, primaryPath, backupResult.file);
            return this.file;
        }

        // Neither primary nor backup is usable.
        if (primaryResult.status === 'corrupt' || backupResult.status === 'corrupt') {
            // At least one file existed and was corrupt -> fail closed.
            quarantineCorruptChronicleFile(primaryPath);
            quarantineCorruptChronicleFile(backupPath);
            throw new ChronicleStoreError(
                'chronicle_corrupt',
                `memory store and backup are both corrupt or missing schema for ${this.loadedIdentity.campaignId}/${this.loadedIdentity.playerId}; quarantined`
            );
        }

        // No file at all (both missing): create an in-memory empty store. It
        // will be persisted on the first observe call. Never silently write an
        // empty file here, to avoid masking a later write failure.
        this.file = createEmptyStore(this.loadedIdentity);
        return this.file;
    }

    /**
     * Observe a batch of memories from a GameData snapshot (channel A).
     *
     * The batch is reconciled against existing frozen records visible in the
     * current branch, then atomically persisted. The returned Promise resolves
     * only after the file has been durably written.
     */
    async observeGameData(
        inputs: readonly ChronicleMemoryObservationInput[],
        timeline: {
            registry?: TimelineRegistry;
            currentNodeId?: string;
            checkpointEpoch?: number;
        }
    ): Promise<ChronicleMemoryObservationResult> {
        return this.observeBatch(inputs, timeline, 'game_data');
    }

    /**
     * Observe a batch of memories from a CHRONICLE_MEMORY tick block
     * (channel B). Semantics are identical to {@link observeGameData}; the
     * only difference is the recorded `captureSource` / `observationSource`.
     */
    async observeChronicleSnapshot(
        inputs: readonly ChronicleMemoryObservationInput[],
        timeline: {
            registry?: TimelineRegistry;
            currentNodeId?: string;
            checkpointEpoch?: number;
        }
    ): Promise<ChronicleMemoryObservationResult> {
        return this.observeBatch(inputs, timeline, 'chronicle_tick');
    }

    private observeBatch(
        inputs: readonly ChronicleMemoryObservationInput[],
        timeline: {
            registry?: TimelineRegistry;
            currentNodeId?: string;
            checkpointEpoch?: number;
        },
        _expectedSource: 'game_data' | 'chronicle_tick'
    ): Promise<ChronicleMemoryObservationResult> {
        const store = this.load();

        const timelineAnchor: ChronicleMemoryTimelineAnchor = {
            timelineNodeId: timeline.currentNodeId,
            checkpointEpoch: timeline.checkpointEpoch
        };
        const firstVisibleAnchor = resolveFirstVisibleTimelineAnchor(timelineAnchor);

        // Group inputs by identityAnchor so collision reconciliation is local
        // to same-owner/same-date/same-type sets.
        const groups = new Map<string, ChronicleMemoryObservationInput[]>();
        for (const input of inputs) {
            if (!isInputValid(input)) continue;
            const anchor = computeIdentityAnchor({
                ownerId: input.ownerId,
                creationTotalDays: input.creationDate?.totalDays,
                creationDateDisplay: input.creationDateDisplay,
                tokenSource: input.memoryTypeTokenSource,
                memoryTypeToken: input.memoryTypeToken,
                participantIds: input.participantIds
            });
            const group = groups.get(anchor) ?? [];
            group.push(input);
            groups.set(anchor, group);
        }

        let created = 0;
        let observed = 0;
        let ambiguous = 0;

        for (const [anchor, groupInputs] of groups) {
            // Candidate existing records for this identityAnchor that are
            // visible in the current branch (Step 7).
            const candidates = store.records.filter(record =>
                record.identityAnchor === anchor
                && isRecordVisibleForContext(
                    timeline.registry,
                    timeline.currentNodeId,
                    {
                        votcTimelineNodeId: record.frozen.capturedTimelineNodeId,
                        votcCheckpointEpoch: record.frozen.capturedCheckpointEpoch
                    },
                    timeline.checkpointEpoch
                )
            );
            // Track the snapshotOrdinal of each candidate within this batch so
            // that Step 2 can match by ordinal. Records loaded from disk have
            // no batch ordinal (undefined); only records created in this batch
            // carry their input ordinal.
            const batchOrdinalByRecord = new Map<ChronicleMemoryRecord, number | undefined>();

            for (const input of groupInputs) {
                const match = this.reconcileOne(
                    input,
                    anchor,
                    candidates,
                    firstVisibleAnchor,
                    timeline,
                    batchOrdinalByRecord,
                    groupInputs.length > 1
                );
                if (match.kind === 'created') {
                    created++;
                    store.records.push(match.record!);
                    candidates.push(match.record!);
                    batchOrdinalByRecord.set(match.record!, input.snapshotOrdinal);
                } else if (match.kind === 'observed') {
                    observed++;
                } else {
                    ambiguous++;
                }
            }
        }

        store.updatedAt = new Date().toISOString();

        // Step 8: write-through. Persist atomically before resolving.
        const result: ChronicleMemoryObservationResult = {
            recordCount: store.records.length,
            createdCount: created,
            observedCount: observed,
            ambiguousCount: ambiguous
        };

        this.persist();

        return Promise.resolve(result);
    }

    /**
     * Reconcile a single input against the candidate records for its
     * identityAnchor. Implements the deterministic matching order from the
     * plan (Step 4):
     *  1. Same render hash as a frozen record or existing observation.
     *  2. Same participant set + snapshot ordinal.
     *  3. Single input / single candidate -> direct match.
     *  4. Group has more members than candidates -> allocate a new collision
     *     slot for the confirmed-new member.
     *  5. Group has fewer members -> do not delete old slots.
     *  6. Unreliable match -> record ambiguous_collision, do not overwrite.
     */
    private reconcileOne(
        input: ChronicleMemoryObservationInput,
        identityAnchor: string,
        candidates: ChronicleMemoryRecord[],
        firstVisibleAnchor: string,
        timeline: {
            registry?: TimelineRegistry;
            currentNodeId?: string;
            checkpointEpoch?: number;
        },
        batchOrdinalByRecord: Map<ChronicleMemoryRecord, number | undefined>,
        groupHasMultipleInputs: boolean
    ): { kind: 'created' | 'observed' | 'ambiguous'; record?: ChronicleMemoryRecord } {
        const renderHash = computeRenderedDescriptionHash(input.description);

        // 1. Render-hash match against frozen description or any observation.
        for (const candidate of candidates) {
            if (candidate.frozen.description === input.description
                || candidate.observations.some(obs => obs.renderedDescriptionHash === renderHash)) {
                this.mergeObservation(candidate, input, renderHash, timeline);
                return { kind: 'observed' };
            }
        }

        // 2. Participant set + snapshot ordinal match within the same batch.
        const inputParticipants = canonicalParticipantIds(input.participantIds);
        if (input.snapshotOrdinal !== undefined) {
            for (const candidate of candidates) {
                if (!arrayEquals(candidate.participantIds, inputParticipants)) continue;
                const candidateOrdinal = batchOrdinalByRecord.get(candidate);
                if (candidateOrdinal === input.snapshotOrdinal) {
                    this.mergeObservation(candidate, input, renderHash, timeline);
                    return { kind: 'observed' };
                }
            }
        }

        // 3. Single input / single candidate -> direct match. This handles the
        //    cross-snapshot dynamic re-render case: a later snapshot observes
        //    the same memory with a different (dynamic) description. We merge it
        //    as a new observation and keep the frozen text. This step is
        //    suppressed when the current anchor group has multiple inputs in
        //    this batch (intra-snapshot collision): those must be allocated
        //    distinct slots in step 4 rather than merged.
        if (!groupHasMultipleInputs && candidates.length === 1) {
            const sole = candidates[0];
            if (arrayEquals(sole.participantIds, inputParticipants)) {
                this.mergeObservation(sole, input, renderHash, timeline);
                return { kind: 'observed' };
            }
        }

        // 4. New member: allocate a new collision slot.
        const maxSlot = candidates.reduce((max, c) => Math.max(max, c.collisionSlot), -1);
        const newSlot = maxSlot + 1;
        const newRecord = this.createFrozenRecord(input, identityAnchor, firstVisibleAnchor, newSlot, timeline);
        return { kind: 'created', record: newRecord };
    }

    private mergeObservation(
        record: ChronicleMemoryRecord,
        input: ChronicleMemoryObservationInput,
        renderHash: string,
        timeline: { checkpointEpoch?: number }
    ): void {
        // Frozen fields are NEVER overwritten (Step 5). Only observations
        // are merged/updated (Step 6).
        //
        // Match key: memoryKey (implicit - we are on `record`) +
        // timeline anchor (the record's captured timeline node) +
        // observationSource.
        const observationTimelineNode = record.frozen.capturedTimelineNodeId ?? '';
        const existing = record.observations.find(
            obs => obs.observationSource === input.observationSource
                && (obs.votcTimelineNodeId ?? '') === observationTimelineNode
        );

        if (existing) {
            // Step 6: same key -> only update lastObservedAt, observationCount
            // and render hash. Never overwrite frozen.description.
            existing.lastObservedAt = input.observedAt;
            existing.observationCount += 1;
            existing.renderedDescriptionHash = renderHash;
            if (input.observedGameDate) {
                existing.observedGameDate = input.observedGameDate;
            }
            if (timeline.checkpointEpoch !== undefined) {
                existing.votcCheckpointEpoch = timeline.checkpointEpoch;
            }
        } else {
            record.observations.push({
                observationId: randomUUID(),
                firstObservedAt: input.observedAt,
                lastObservedAt: input.observedAt,
                observationCount: 1,
                observedGameDate: input.observedGameDate,
                observationSource: input.observationSource,
                renderedDescriptionHash: renderHash,
                votcCheckpointEpoch: timeline.checkpointEpoch ?? input.votcCheckpointEpoch,
                votcTimelineNodeId: input.votcTimelineNodeId,
                votcTimelineParentId: input.votcTimelineParentId
            });
        }
    }

    private createFrozenRecord(
        input: ChronicleMemoryObservationInput,
        identityAnchor: string,
        firstVisibleAnchor: string,
        collisionSlot: number,
        timeline: { checkpointEpoch?: number }
    ): ChronicleMemoryRecord {
        const memoryKey = computeMemoryKey(identityAnchor, firstVisibleAnchor, collisionSlot);
        const renderHash = computeRenderedDescriptionHash(input.description);
        const capturedTimelineNodeId = input.votcTimelineNodeId ?? timelineNodeIdOf(input);
        const capturedCheckpointEpoch = input.votcCheckpointEpoch ?? timeline.checkpointEpoch;

        const record: ChronicleMemoryRecord = {
            memoryKey,
            identityAnchor,
            collisionSlot,
            ownerId: input.ownerId,
            memoryTypeToken: normalizeMemoryTypeToken(input.memoryTypeToken),
            memoryTypeTokenSource: input.memoryTypeTokenSource,
            captureLanguage: input.captureLanguage,
            participantIds: canonicalParticipantIds(input.participantIds),
            creationDate: input.creationDate,
            frozen: {
                ownerName: input.ownerName,
                memoryName: input.memoryName,
                description: input.description,
                relevanceWeight: input.relevanceWeight,
                capturedAt: input.observedAt,
                capturedGameDate: input.observedGameDate,
                capturedCheckpointEpoch,
                capturedTimelineNodeId,
                capturedTimelineParentId: input.votcTimelineParentId,
                captureSource: input.observationSource
            },
            observations: [
                {
                    observationId: randomUUID(),
                    firstObservedAt: input.observedAt,
                    lastObservedAt: input.observedAt,
                    observationCount: 1,
                    observedGameDate: input.observedGameDate,
                    observationSource: input.observationSource,
                    renderedDescriptionHash: renderHash,
                    votcCheckpointEpoch: capturedCheckpointEpoch,
                    votcTimelineNodeId: input.votcTimelineNodeId,
                    votcTimelineParentId: input.votcTimelineParentId
                }
            ]
        };
        return record;
    }

    /**
     * Persist the in-memory store to disk atomically, rotating the previous
     * primary to `.bak` first.
     */
    private persist(): void {
        if (this.file === undefined) return;
        const primaryPath = chronicleMemoryStorePath(this.userDataDir, this.loadedIdentity);
        const backupPath = chronicleMemoryBackupPath(this.userDataDir, this.loadedIdentity);

        // Step 3: rotate the current primary to .bak before committing the new one.
        if (fs_exists(primaryPath)) {
            rotatePrimaryToBackup(this.userDataDir, this.loadedIdentity, primaryPath, backupPath);
        }

        writeChronicleJsonAtomic(this.userDataDir, this.loadedIdentity, primaryPath, this.file);
    }

    /**
     * Query records visible in the current branch with a creation date in the
     * half-open period `(periodStart, periodEnd]` and owner in the relevant
     * set. Used by the Collector.
     */
    queryVisibleMemories(params: {
        registry?: TimelineRegistry;
        currentNodeId?: string;
        checkpointEpoch?: number;
        periodStart?: Ck3GameDate;
        periodEnd?: Ck3GameDate;
        relevantOwnerIds?: ReadonlySet<string>;
    }): ChronicleMemoryRecord[] {
        const store = this.load();
        return store.records.filter(record => {
            if (!isRecordVisibleForContext(
                params.registry,
                params.currentNodeId,
                {
                    votcTimelineNodeId: record.frozen.capturedTimelineNodeId,
                    votcCheckpointEpoch: record.frozen.capturedCheckpointEpoch
                },
                params.checkpointEpoch
            )) {
                return false;
            }
            if (params.relevantOwnerIds && !params.relevantOwnerIds.has(record.ownerId)) {
                return false;
            }
            if (params.periodStart && params.periodEnd && record.creationDate) {
                const day = record.creationDate.totalDays;
                if (!(day > params.periodStart.totalDays && day <= params.periodEnd.totalDays)) {
                    return false;
                }
            }
            return true;
        });
    }

    /** Total record count (all branches). For diagnostics. */
    getRecordCount(): number {
        return this.load().records.length;
    }
}

function isInputValid(input: ChronicleMemoryObservationInput): boolean {
    if (typeof input.ownerId !== 'string' || input.ownerId.trim().length === 0) return false;
    if (typeof input.memoryTypeToken !== 'string' || input.memoryTypeToken.trim().length === 0) return false;
    if (input.memoryTypeTokenSource !== 'raw_type' && input.memoryTypeTokenSource !== 'localized_name') return false;
    if (typeof input.description !== 'string' || input.description.length === 0) return false;
    if (!Array.isArray(input.participantIds)) return false;
    return true;
}

function createEmptyStore(identity: CampaignPlayerIdentity): ChronicleMemoryStoreFile {
    return {
        schemaVersion: CHRONICLE_MEMORY_STORE_SCHEMA_VERSION,
        campaignId: identity.campaignId,
        playerId: identity.playerId,
        updatedAt: new Date().toISOString(),
        records: []
    };
}

/**
 * Validate a parsed object as a {@link ChronicleMemoryStoreFile}. Returns the
 * validated file or `undefined` if the schema is invalid. Never throws on
 * shape mismatches (the caller decides quarantine vs. recover).
 */
function validateStoreFile(parsed: unknown, identity: CampaignPlayerIdentity): ChronicleMemoryStoreFile | undefined {
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const p = parsed as Record<string, unknown>;
    if (p.schemaVersion !== CHRONICLE_MEMORY_STORE_SCHEMA_VERSION) return undefined;
    if (p.campaignId !== identity.campaignId) return undefined;
    if (p.playerId !== identity.playerId) return undefined;
    if (typeof p.updatedAt !== 'string') return undefined;
    if (!Array.isArray(p.records)) return undefined;

    const records: ChronicleMemoryRecord[] = [];
    for (const raw of p.records) {
        const record = validateRecord(raw);
        if (record === undefined) return undefined;
        records.push(record);
    }

    return {
        schemaVersion: CHRONICLE_MEMORY_STORE_SCHEMA_VERSION,
        campaignId: identity.campaignId,
        playerId: identity.playerId,
        updatedAt: p.updatedAt,
        records
    };
}

function validateRecord(raw: unknown): ChronicleMemoryRecord | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const r = raw as Record<string, unknown>;
    if (typeof r.memoryKey !== 'string' || r.memoryKey.length === 0) return undefined;
    if (typeof r.identityAnchor !== 'string' || r.identityAnchor.length === 0) return undefined;
    if (typeof r.collisionSlot !== 'number' || !Number.isInteger(r.collisionSlot) || r.collisionSlot < 0) return undefined;
    if (typeof r.ownerId !== 'string' || r.ownerId.length === 0) return undefined;
    if (typeof r.memoryTypeToken !== 'string') return undefined;
    if (r.memoryTypeTokenSource !== 'raw_type' && r.memoryTypeTokenSource !== 'localized_name') return undefined;
    if (!Array.isArray(r.participantIds)) return undefined;
    if (typeof r.frozen !== 'object' || r.frozen === null) return undefined;
    const f = r.frozen as Record<string, unknown>;
    if (typeof f.ownerName !== 'string') return undefined;
    if (typeof f.memoryName !== 'string') return undefined;
    if (typeof f.description !== 'string') return undefined;
    if (typeof f.capturedAt !== 'string') return undefined;
    if (f.captureSource !== 'game_data' && f.captureSource !== 'chronicle_tick') return undefined;
    if (!Array.isArray(r.observations)) return undefined;

    const observations = r.observations.map(validateObservation).filter((o): o is NonNullable<typeof o> => o !== undefined);
    if (observations.length !== r.observations.length) return undefined;

    return r as unknown as ChronicleMemoryRecord;
}

function validateObservation(raw: unknown): ChronicleMemoryRecord['observations'][number] | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const o = raw as Record<string, unknown>;
    if (typeof o.observationId !== 'string' || o.observationId.length === 0) return undefined;
    if (typeof o.firstObservedAt !== 'string') return undefined;
    if (typeof o.lastObservedAt !== 'string') return undefined;
    if (typeof o.observationCount !== 'number' || !Number.isInteger(o.observationCount) || o.observationCount < 1) return undefined;
    if (o.observationSource !== 'game_data' && o.observationSource !== 'chronicle_tick') return undefined;
    if (typeof o.renderedDescriptionHash !== 'string' || o.renderedDescriptionHash.length === 0) return undefined;
    return o as unknown as ChronicleMemoryRecord['observations'][number];
}

function arrayEquals(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function timelineNodeIdOf(input: ChronicleMemoryObservationInput): string | undefined {
    return input.votcTimelineNodeId;
}

type ReadResult =
    | { status: 'valid'; file: ChronicleMemoryStoreFile }
    | { status: 'missing' }
    | { status: 'corrupt' };

/**
 * Canonical parse+validate of a memory store payload taken from a frozen
 * buffer (timeline export). Applies exactly the same schema validation as a
 * disk load; returns `undefined` when unparseable or schema-invalid.
 */
export function parseMemoryStoreBuffer(
    buffer: Buffer,
    identity: CampaignPlayerIdentity
): ChronicleMemoryStoreFile | undefined {
    let parsed: unknown;
    try {
        parsed = JSON.parse(buffer.toString('utf8'));
    } catch {
        return undefined;
    }
    return validateStoreFile(parsed, identity);
}

/**
 * Read a chronicle memory store file and validate it.
 *  - missing file -> { status: 'missing' }
 *  - file exists but unparseable or schema-invalid -> { status: 'corrupt' }
 *  - file exists and validates -> { status: 'valid', file }
 */
function tryReadAndValidate(filePath: string, identity: CampaignPlayerIdentity): ReadResult {
    if (!fs_exists(filePath)) {
        return { status: 'missing' };
    }
    let parsed: unknown;
    try {
        parsed = readChronicleJson(filePath);
    } catch {
        return { status: 'corrupt' };
    }
    if (parsed === undefined) {
        return { status: 'missing' };
    }
    const validated = validateStoreFile(parsed, identity);
    if (validated === undefined) {
        return { status: 'corrupt' };
    }
    return { status: 'valid', file: validated };
}

function fs_exists(filePath: string): boolean {
    try {
        // Use require('fs') to avoid importing 'fs' at module top-level for the
        // store (which is mostly fs-free logic). The atomic helper already
        // wraps all fs operations.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs');
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

// Re-export token source type for convenience.
export type { MemoryTypeTokenSource };
