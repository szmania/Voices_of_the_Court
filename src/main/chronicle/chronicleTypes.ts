import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import type { MemoryTypeTokenSource } from '../../shared/gameData/GameData.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { TimelineRegistry } from '../timelineManager.js';
import type { ApiConnectionConfig } from '../../shared/Config.js';

/**
 * Chronicle memory store schema types.
 *
 * The memory store is the authoritative historical record of character
 * memories observed by VOTC. `GameData.characters[*].memories` is only a
 * transient snapshot; this file survives application restarts and CK3 memory
 * cleanup.
 *
 * Identity invariants (frozen by Task 0 protocol):
 *  - description, ownerName, memoryName, title and localized third-person text
 *    are dynamic and MUST NOT participate in identity.
 *  - identityAnchor is SHA-256(ownerId + creationDate.totalDays + tokenSource
 *    + normalized memoryTypeToken + sorted unique participant IDs).
 *  - memoryKey is SHA-256(identityAnchor + firstVisibleTimelineAnchor +
 *    collisionSlot).
 *  - frozen fields are write-once: ownerName, memoryName, description,
 *    relevanceWeightAtCapture, capturedAt, capturedGameDate, captured
 *    timeline/checkpoint and captureSource.
 *  - Subsequent observations only add a new observation row or update an
 *    existing observation's lastObservedAt / observationCount / render hash.
 */

export const CHRONICLE_MEMORY_STORE_SCHEMA_VERSION = 1;

/** How a memory was observed. */
export type ChronicleMemoryCaptureSource = 'game_data' | 'chronicle_tick';

/**
 * A single observation of a memory. Multiple observations of the same
 * `memoryKey` prove the memory persisted across snapshots; they never
 * overwrite the frozen fields of the parent record.
 */
export interface ChronicleMemoryObservation {
    observationId: string;
    firstObservedAt: string;
    lastObservedAt: string;
    observationCount: number;
    observedGameDate?: Ck3GameDate;
    observationSource: ChronicleMemoryCaptureSource;
    /** SHA-256 of the rendered description at observation time (hex). */
    renderedDescriptionHash: string;
    votcCheckpointEpoch?: number;
    votcTimelineNodeId?: string;
    votcTimelineParentId?: string;
}

/**
 * A frozen memory record. The `frozen` block is write-once per timeline
 * branch. Dynamic fields (description, ownerName, title) from later snapshots
 * are never allowed to overwrite these values.
 */
export interface ChronicleMemoryRecord {
    memoryKey: string;
    identityAnchor: string;
    collisionSlot: number;
    ownerId: string;
    memoryTypeToken: string;
    memoryTypeTokenSource: MemoryTypeTokenSource;
    /** The game language at capture time. If a later snapshot changes language,
     * the token would differ; we treat it as a new record rather than overwrite. */
    captureLanguage?: string;
    participantIds: string[];
    creationDate?: Ck3GameDate;
    frozen: {
        ownerName: string;
        memoryName: string;
        description: string;
        relevanceWeight?: number;
        capturedAt: string;
        capturedGameDate?: Ck3GameDate;
        capturedCheckpointEpoch?: number;
        capturedTimelineNodeId?: string;
        capturedTimelineParentId?: string;
        captureSource: ChronicleMemoryCaptureSource;
    };
    observations: ChronicleMemoryObservation[];
    /**
     * Diagnostic flag set when the reconciler could not reliably match a
     * snapshot member to an existing record. The frozen text is preserved;
     * the source drawer surfaces this as "记忆身份存在歧义".
     */
    ambiguousCollision?: boolean;
}

/**
 * Top-level memory store file. One file per campaign/player, containing all
 * branches' records (branch visibility is resolved at query time, never by
 * deleting sibling-branch records).
 */
export interface ChronicleMemoryStoreFile {
    schemaVersion: typeof CHRONICLE_MEMORY_STORE_SCHEMA_VERSION;
    campaignId: string;
    playerId: string;
    updatedAt: string;
    records: ChronicleMemoryRecord[];
}

/**
 * Input describing a memory observed in a GameData snapshot or a chronicle
 * tick memory block. The store reconciles a batch of these against existing
 * frozen records.
 */
export interface ChronicleMemoryObservationInput {
    ownerId: string;
    ownerName: string;
    memoryTypeToken: string;
    memoryTypeTokenSource: MemoryTypeTokenSource;
    memoryName: string;
    description: string;
    creationDate?: Ck3GameDate;
    creationDateDisplay: string;
    relevanceWeight?: number;
    participantIds: readonly (string | number)[];
    /** Snapshot ordinal within one tick/snapshot block. Used for collision
     * disambiguation when there is no engine-stable memory ID. */
    snapshotOrdinal?: number;
    /** Observed game date (when the snapshot was taken). */
    observedGameDate?: Ck3GameDate;
    observationSource: ChronicleMemoryCaptureSource;
    observedAt: string;
    votcCheckpointEpoch?: number;
    votcTimelineNodeId?: string;
    votcTimelineParentId?: string;
    /** Game language at capture, used to detect token-source language switches. */
    captureLanguage?: string;
}

/**
 * The anchor that identifies which timeline branch first observed a memory.
 * `firstVisibleTimelineAnchor` is preferred from the timeline node; legacy
 * data falls back to the checkpoint epoch.
 */
export interface ChronicleMemoryTimelineAnchor {
    timelineNodeId?: string;
    timelineParentId?: string;
    checkpointEpoch?: number;
}

export interface ChronicleMemoryObservationResult {
    /** Total records in the store after this batch was committed. */
    recordCount: number;
    /** Number of new frozen records created in this batch. */
    createdCount: number;
    /** Number of existing records that received a new observation. */
    observedCount: number;
    /** Number of inputs that could not be reliably matched (ambiguous). */
    ambiguousCount: number;
}

export type ChronicleSourceKind =
    | 'conversation'
    | 'character_memory'
    | 'outgoing_letter'
    | 'incoming_letter'
    | 'battle_report';

export interface ChronicleSourceRecord {
    id: string;
    kind: ChronicleSourceKind;
    gameDate?: Ck3GameDate;
    legacyUndated: boolean;
    title: string;
    participants: Array<{ id?: string; name: string }>;
    rawText: string;
    memoryKey?: string;
    memoryIdentityAnchor?: string;
    memoryCollisionSlot?: number;
    memoryOwnerId?: string;
    memoryCapturedAt?: string;
    memoryCapturedGameDate?: Ck3GameDate;
    memoryTextFrozen?: boolean;
    relevanceWeight?: number;
    existingSummary?: string;
    existingSummaryId?: string;
    votcCheckpointEpoch?: number;
    votcTimelineNodeId?: string;
    votcTimelineParentId?: string;
    createdAt?: string;
    /**
     * Side-channel for battle report records: character ids (winnerId, loserId,
     * commanders, notableCharacters) that are not projected into `participants`
     * but must participate in relevant-owner-set derivation. Undefined for
     * non-battle sources.
     */
    battleReportCharacterIds?: string[];
}

/**
 * Representation mode chosen by the ChronicleBudgetPlanner for a single source.
 *
 *  - `raw`: the source's `rawText` is included verbatim.
 *  - `existing_summary`: a previously-generated summary (already stored on the
 *    source record, e.g. a conversation summary) is reused without a new API
 *    call. Cheapest path.
 *  - `generated_digest`: a new digest is produced via the summarization API
 *    (or loaded from the digest cache).
 *  - `chunk_digest`: the final fallback. The source is too large even for a
 *    single digest, so it is split into per-source chunks, each chunk gets its
 *    own digest, and the chunk digests are concatenated. Chunks never cross a
 *    source boundary.
 */
export type ChronicleRepresentationMode =
    | 'raw'
    | 'existing_summary'
    | 'generated_digest'
    | 'chunk_digest';

/**
 * Manifest entry for a single source after budget planning. The manifest is
 * persisted alongside the chronicle attempt so the UI can show the original
 * human-readable source while retaining an audit of what representation was
 * sent to the model, without re-running the planner.
 */
export interface ChronicleSourceManifestItem {
    sourceId: string;
    kind: ChronicleSourceKind;
    title: string;
    gameDate?: Ck3GameDate;
    /**
     * Complete human-readable source text for the source drawer. Optional so
     * chronicle entries written before this field was introduced remain valid.
     */
    content?: string;
    representation: ChronicleRepresentationMode;
    rawCharCount: number;
    selectedCharCount: number;
    rawHash: string;
    selectedTextHash: string;
    votcCheckpointEpoch?: number;
    votcTimelineNodeId?: string;
    /**
     * Set when budget planning attempted to degrade this source (digest or
     * existing-summary path) but failed, and the source was left as `raw`.
     * Callers can inspect this to decide whether to fail the attempt or
     * proceed with partial degradation.
     */
    degradationFailed?: boolean;
    degradationError?: string;
}

/**
 * A source record paired with its chosen representation and the text that will
 * actually be sent to the model for that source. The `manifestItem` is derived
 * from `record` + `mode` + `text` and is recomputed whenever any of them
 * changes.
 */
export interface ChronicleSelectedSource {
    record: ChronicleSourceRecord;
    mode: ChronicleRepresentationMode;
    text: string;
    manifestItem: ChronicleSourceManifestItem;
    /**
     * True when budget planning attempted to degrade this source but failed,
     * and the source was left as `raw`. Mirrors
     * `manifestItem.degradationFailed`.
     */
    degradationFailed?: boolean;
    degradationError?: string;
}

/**
 * Budget for the chronicle planning pass.
 *
 *  - `rawSourceCharLimit`: soft cap on the total visible characters across all
 *    selected sources. Sources are degraded when this is exceeded.
 *  - `contextSafetyRatio`: fraction of the model's context window reserved for
 *    the prompt input (the rest is left for the chronicle output and safety).
 *    Constant 0.70 for now.
 *  - `contextTokens`: the model's raw context window size (tokens).
 *  - `outputMaxTokens`: tokens reserved for the model's response. The usable
 *    input budget is `contextTokens * contextSafetyRatio - outputMaxTokens`.
 */
export interface ChronicleBudget {
    rawSourceCharLimit: number;
    contextSafetyRatio: 0.70;
    contextTokens: number;
    outputMaxTokens: number;
}

/**
 * On-disk cache file for source digests generated by the budget planner.
 * Keyed by a composite of rawHash + digestPromptVersion + modelCategory + sourceKind.
 */
export interface ChronicleDigestCacheFile {
    schemaVersion: number;
    entries: Record<string, ChronicleDigestCacheEntry>;
}

export interface ChronicleDigestCacheEntry {
    rawHash: string;
    sourceKind: ChronicleSourceKind;
    digestPromptVersion: number;
    modelCategory: string;
    digestText: string;
    mode: 'generated_digest' | 'chunk_digest';
    generatedAt: string;
}

/**
 * Chronicle entry/attempt schema versions. Bumped together for now since the
 * two files are written by the same store; future migrations may diverge them.
 */
export const CHRONICLE_ENTRIES_SCHEMA_VERSION = 1;
export const CHRONICLE_ATTEMPTS_SCHEMA_VERSION = 1;

/** Whether a chronicle entry carries real narrative content. */
export type ChronicleEntryStatus = 'ready' | 'empty';

/** Why a chronicle entry was generated. */
export type ChronicleEntryReason =
    | 'quarterly'
    | 'yearly'
    | 'manual'
    | 'backfill'
    | 'catch_up';

/**
 * Aggregate source statistics captured at generation time. All counts are
 * non-negative integers; the UI renders them verbatim. Persisted on the entry
 * so the UI can render "what was actually sent" without re-running the
 * planner.
 */
export interface ChronicleEntrySourceStats {
    total: number;
    rawConversationCount: number;
    summarizedConversationCount: number;
    memoryCount: number;
    digestedMemoryCount: number;
    letterCount: number;
    battleReportCount: number;
    rawVisibleChars: number;
    selectedVisibleChars: number;
    promptInputTokens: number;
}

/**
 * A single chronicle entry (one period's narrative). The same logical entry ID
 * is reused across revisions: re-editing the same period increments `revision`
 * rather than creating a new entry. Sibling-branch entries (different
 * `votcTimelineNodeId`) are preserved in the file but filtered out at query
 * time by {@link ChronicleStore.queryVisibleEntries}.
 */
export interface ChronicleEntry {
    schemaVersion: typeof CHRONICLE_ENTRIES_SCHEMA_VERSION;
    id: string;
    status: ChronicleEntryStatus;
    reason: ChronicleEntryReason;
    playerId: string;
    playerName: string;
    playerTitle?: string;
    periodStart: Ck3GameDate;
    periodEnd: Ck3GameDate;
    title: string;
    content?: string;
    sourceManifest: ChronicleSourceManifestItem[];
    sourceDigest: string;
    promptVersion: number;
    generatedAt: string;
    revision: number;
    sourceStats: ChronicleEntrySourceStats;
    votcCheckpointEpoch?: number;
    votcTimelineNodeId?: string;
    votcTimelineParentId?: string;
}

/** State of a chronicle generation attempt. */
export type ChronicleAttemptStatus = 'pending' | 'running' | 'failed' | 'committed';

/**
 * A generation attempt. Idempotent by `requestKey`: the same period/node/reason
 * always maps to the same requestKey, so duplicate triggers do not create
 * duplicate attempts. The state machine is:
 *
 *   pending -> running -> committed
 *   pending -> running -> failed
 *   failed -> running              (retry)
 *   committed + digest changed -> running (revision)
 *
 * `committed` is forbidden until an entry has been written for this attempt.
 */
export interface ChronicleGenerationAttempt {
    requestKey: string;
    status: ChronicleAttemptStatus;
    entryId?: string;
    periodStartDay: number;
    periodEndDay: number;
    sourceDigest?: string;
    startedAt?: string;
    completedAt?: string;
    sanitizedErrorCode?: string;
    sanitizedErrorMessage?: string;
}

/**
 * On-disk entries file. One per campaign/player, containing all branches'
 * entries (branch visibility is resolved at query time, never by deleting
 * sibling-branch entries).
 */
export interface ChronicleEntriesFile {
    schemaVersion: typeof CHRONICLE_ENTRIES_SCHEMA_VERSION;
    campaignId: string;
    playerId: string;
    updatedAt: string;
    entries: ChronicleEntry[];
}

/**
 * On-disk attempts file. One per campaign/player.
 */
export interface ChronicleAttemptsFile {
    schemaVersion: typeof CHRONICLE_ATTEMPTS_SCHEMA_VERSION;
    campaignId: string;
    playerId: string;
    updatedAt: string;
    attempts: ChronicleGenerationAttempt[];
}

/**
 * ChronicleCoordinator (Task 12) types.
 *
 * The Coordinator is the single orchestration entry point that turns an
 * incoming {@link ChronicleSignal} into a persisted {@link ChronicleEntry}.
 * It consults the ChronicleMemoryStore / ChronicleSourceCollector /
 * ChronicleBudgetPlanner / ChronicleGenerator / ChronicleStore and never
 * advances the timeline (Step 7).
 */

export type ChronicleSignalKind = 'quarterly' | 'yearly' | 'manual';

export interface ChronicleSignalTimelineContext {
    registry?: TimelineRegistry;
    currentNodeId?: string;
    checkpointEpoch?: number;
}

export interface ChronicleSignal {
    kind: ChronicleSignalKind;
    gameDate: Ck3GameDate;
    playerId: string;
    playerName: string;
    playerTitle?: string;
    identity: CampaignPlayerIdentity;
    timeline: ChronicleSignalTimelineContext;
}

export type ChronicleCoordinatorFrequency = 'disabled' | 'quarterly' | 'yearly';

export interface ChronicleCoordinatorConfig {
    frequency: ChronicleCoordinatorFrequency;
    rawSourceCharLimit: number;
    outputMaxTokens: number;
    chroniclePrompt: string;
    summarizationUseTextGenApi: boolean;
    textGenerationApiConnectionConfig: ApiConnectionConfig;
    summarizationApiConnectionConfig: ApiConnectionConfig;
    language: string;
    dumpPrompts?: boolean;
}

export type ChronicleCoordinatorOutcome =
    | 'generated'
    | 'empty'
    | 'revision_available'
    | 'ignored_frequency'
    | 'ignored_unhealthy'
    | 'skipped_already_running'
    | 'skipped_idempotent'
    | 'failed';

export interface ChronicleCoordinatorResult {
    outcome: ChronicleCoordinatorOutcome;
    entryId?: string;
    requestKey?: string;
    reason?: ChronicleEntryReason;
    periodStart?: Ck3GameDate;
    periodEnd?: Ck3GameDate;
    revisionAvailable?: boolean;
    errorCode?: string;
    errorMessage?: string;
}
