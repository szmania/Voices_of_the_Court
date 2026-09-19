import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';

/**
 * Character Agency Ledger — Phase 0 + Phase 1 types.
 *
 * Phase 0 establishes the trusted message layer (ConversationTurn).
 * Phase 1 adds the agency events, intents, tasks, knowledge, projections,
 * and persistence shapes (see plan §4 for the full data model).
 *
 * This file MUST stay I/O-free. Persistence, validation, and reducer logic
 * live in separate modules.
 */

/**
 * How a turn is delivered to its audience.
 *
 * - 'group':    ordinary multi-party chat. Audience is everyone present except
 *               the speaker.
 * - 'direct':   an AI-to-AI direct message with a narrow audience. The second
 *               AI's reply must keep the same audience (§3.0.3 task 11).
 * - 'letter':   sender → receiver; audience is the receiver only.
 * - 'internal': self-talk / narrator-only; audience is the speaker only.
 *               VOTC has no self-talk UI in Phase 1; this enum value is reserved.
 * - 'synthetic': system-generated placeholders (e.g. "尚未发言"). MUST NOT
 *               enter the transcript (§3.0.3 task 7).
 */
export type ConversationDeliveryKind =
    | 'group'
    | 'direct'
    | 'letter'
    | 'internal'
    | 'synthetic';

/** Stable identifier for a single turn. Derived deterministically (§3.0.3 task 5). */
export type MessageId = string;

/**
 * A single auditable turn in a conversation.
 *
 * `transcript` is an append-only array of these. It is the canonical,
 * non-pruned record of what happened in the conversation. The LLM-facing
 * `messages` array can be safely re-summarized without losing these.
 *
 * Phase 0 invariants (enforced by pushMessage):
 *  - `isSynthetic === true` MUST NOT enter the transcript; placeholders live
 *    only in the LLM-facing `messages` array.
 *  - `content` MUST be validated for length and control characters.
 *  - `audienceCharacterIds` MUST be a stable, audience-equivalence-grouped
 *    list (sorted, deduped). The order MUST be deterministic.
 *  - `sequence` is per-conversation monotonic.
 *  - `messageId` is SHA-256 of stable inputs; never reused, never random.
 */
export interface ConversationTurn {
    messageId: MessageId;
    /**
     * The character who produced this turn. `null` only for synthetic
     * placeholders (e.g. "尚未发言" for a non-player who has not yet spoken).
     */
    speakerCharacterId: string | null;
    speakerName: string;
    /**
     * Character IDs that legitimately heard this turn. Order is sorted
     * (ascending by numeric value) and deduplicated.
     */
    audienceCharacterIds: string[];
    deliveryKind: ConversationDeliveryKind;
    isSynthetic: boolean;
    content: string;
    createdAt: string;
    sequence: number;
}

// --- Identity & anchors ---------------------------------------------------

/** CK3 numeric character id, string form (plan §4 CharacterId). */
export type CharacterId = string;

/** Reuses CampaignPlayerIdentity (v2 schema). */
export type AgencyCampaignPlayerIdentityRef = CampaignPlayerIdentity;

/**
 * Plan §4 AgencyTimelineAnchor. Carries identity + checkpoint + node +
 * parent + tokens. Mirrors what `timelineRegistry` actually records.
 */
export interface AgencyTimelineAnchor {
    identity: AgencyCampaignPlayerIdentityRef;
    votcCheckpointEpoch: number;
    votcTimelineNodeId: string;
    votcTimelineParentId?: string;
    votcTimelineToken?: number;
    votcTimelinePendingToken?: number;
}

// --- Source kinds (mirrors ChronicleSourceKind) ---------------------------

export type AgencySourceKind =
    | 'conversation'
    | 'character_memory'
    | 'outgoing_letter'
    | 'incoming_letter'
    | 'battle_report'
    | 'manual'
    | 'game_snapshot_log'
    | 'game_snapshot_save';

export interface AgencySourceRef {
    sourceRecordId: string;
    sourceKind: AgencySourceKind;
    sourceDigest: string;
}

// --- Typed save verification ---------------------------------------------

/** A result that is either a fact or an explicit inability to decide. */
export type AgencyVerificationKnowledge<T> =
    | { status: 'known'; value: T }
    | { status: 'unknown'; reasonCode: string };

export type AgencyVerificationValue = boolean | 'living' | 'dead';

/**
 * Minimal evidence retained by Agency. It deliberately contains no save
 * path, character name, raw save value, or raw save content.
 */
export interface AgencyVerificationEvidence {
    sourceFingerprint: string;
    snapshotSequence: number;
    snapshotSlot: 0 | 1;
    resultsByCheckKey: ReadonlyMap<string, AgencyVerificationKnowledge<AgencyVerificationValue>>;
}

// --- Evidence -------------------------------------------------------------

export interface AgencyEvidence {
    evidenceId: string;
    sourceRecordId: string;
    messageId?: string;
    speakerCharacterId?: CharacterId;
    audienceCharacterIds: CharacterId[];
    quote?: string;
    sequence?: number;
    contentStart?: number;
    contentEnd?: number;
    segmentIndex?: number;
}

// --- Intent ---------------------------------------------------------------

export type IntentStatus =
    | 'tentative' | 'active' | 'suspended' | 'fulfilled' | 'abandoned';
export type IntentPriority = 'low' | 'normal' | 'high' | 'critical';
export type IntentOrigin = 'explicit' | 'inferred' | 'manual';

export type AgencyVisibility =
    | { kind: 'private'; ownerId: CharacterId }
    | { kind: 'participants'; characterIds: CharacterId[] }
    | { kind: 'public' };

export type AgencyEventProjectionVisibility =
    | { kind: 'backend_only' }
    | AgencyVisibility;

export interface IntentState {
    intentId: string;
    ownerId: CharacterId;
    objective: string;
    motivation?: string;
    priority: IntentPriority;
    status: IntentStatus;
    origin: IntentOrigin;
    visibility: AgencyVisibility;
    relatedTaskIds: string[];
    evidenceIds: string[];
    createdEventId: string;
    lastEventId: string;
}

// --- Task -----------------------------------------------------------------

export type TaskStatus =
    | 'proposed' | 'active' | 'blocked' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export type TaskVerification =
    | { kind: 'game_snapshot'; predicate: SupportedTaskPredicate }
    | { kind: 'dialogue_evidence' }
    | { kind: 'manual' };

export type SupportedTaskPredicate =
    | { kind: 'character_is_dead'; characterId: CharacterId }
    | { kind: 'character_is_alive'; characterId: CharacterId }
    | { kind: 'character_has_skill_at_least'; characterId: CharacterId; skill: SkillKey; value: number }
    | { kind: 'character_has_trait'; characterId: CharacterId; traitId: number }
    | { kind: 'character_has_council_position'; characterId: CharacterId; position: string }
    | { kind: 'character_has_court_position'; characterId: CharacterId; position: string }
    | { kind: 'character_is_commander'; characterId: CharacterId; armySlot?: number }
    | { kind: 'character_gold_at_least'; characterId: CharacterId; amount: number }
    | { kind: 'character_relation_contains'; characterId: CharacterId; relation: string }
    | { kind: 'manual_only' };

export type SkillKey =
    | 'diplomacy' | 'martial' | 'stewardship'
    | 'intrigue' | 'learning' | 'prowess';

export interface TaskState {
    taskId: string;
    title: string;
    description: string;
    issuerId: CharacterId;
    assigneeId: CharacterId;
    beneficiaryIds: CharacterId[];
    visibility: AgencyVisibility;
    status: TaskStatus;
    priority: TaskPriority;
    dueGameDate?: Ck3GameDate;
    dependencyTaskIds: string[];
    verification: TaskVerification;
    progressNote?: string;
    evidenceIds: string[];
    createdEventId: string;
    lastEventId: string;
}

// --- Knowledge ------------------------------------------------------------

export type KnowledgeTruthStatus = 'asserted' | 'verified' | 'disputed' | 'refuted';
export type KnowledgeEpistemicStatus = 'reported' | 'observed' | 'verified' | 'refuted';
export type DisclosurePolicy = 'free' | 'confidential' | 'secret';

export interface KnowledgeSubjectRef {
    kind: 'character' | 'task' | 'intent' | 'place' | 'title' | 'other';
    id?: string;
    label?: string;
}

export interface KnowledgeItem {
    knowledgeItemId: string;
    subject: KnowledgeSubjectRef;
    statement: string;
    truthStatus: KnowledgeTruthStatus;
    truthEvidence: AgencyEvidence[];
    createdEventId: string;
    lastEventId: string;
}

export interface KnowledgeEdge {
    knowledgeEdgeId: string;
    knowledgeItemId: string;
    characterId: CharacterId;
    epistemicStatus: KnowledgeEpistemicStatus;
    attitude: 'believes' | 'denies' | 'uncertain' | 'suspects';
    confidence: number;
    disclosurePolicy: DisclosurePolicy;
    learnedFromCharacterId?: CharacterId;
    evidenceIds: string[];
    createdEventId: string;
    lastEventId: string;
}

// --- Event ----------------------------------------------------------------

export type AgencyEventKind =
    | 'intent_created' | 'intent_updated' | 'intent_retracted'
    | 'task_created' | 'task_updated' | 'task_retracted'
    | 'knowledge_item_upserted' | 'knowledge_edge_updated' | 'knowledge_edge_retracted'
    | 'manual_correction';

export interface AgencyEvent {
    eventId: string;
    kind: AgencyEventKind;
    anchor: AgencyTimelineAnchor;
    sourceRef: AgencySourceRef;
    actorCharacterId?: CharacterId;
    targetEntityId: string;
    payload: unknown;
    evidenceIds: string[];
    projectionVisibility: AgencyEventProjectionVisibility;
    sourceSequence: number;
    eventOrdinal: number;
    nodeCommitSequence: number;
    createdAt: string;
    actorKind: 'extractor' | 'manual' | 'system';
}

// --- Projection view types (NEW — plan references them but does not define) -

/**
 * Per-character projection of an Intent. Distinct from `IntentState`:
 *  - `knownStatus` is the *last status this character saw* (may differ
 *    from the backend's current `IntentState.status` if the character
 *    has not received a notification).
 *  - `knownPriority` likewise.
 *  - `omitted` is true when the projection dropped the entry due to
 *    token budget.
 */
export interface AgencyIntentView {
    intentId: string;
    objective: string;
    motivation?: string;
    knownStatus: IntentStatus;
    knownPriority: IntentPriority;
    knownDueGameDate?: Ck3GameDate;
    origin: IntentOrigin;
    isOwner: boolean;
    evidenceIds: string[];
    lastEventId: string;
    omitted: boolean;
}

export interface AgencyTaskView {
    taskId: string;
    title: string;
    description: string;
    issuerId: CharacterId;
    assigneeId: CharacterId;
    beneficiaryIds: CharacterId[];
    knownStatus: TaskStatus;
    knownPriority: TaskPriority;
    knownDueGameDate?: Ck3GameDate;
    progressNote?: string;
    isIssuer: boolean;
    isAssignee: boolean;
    isBeneficiary: boolean;
    evidenceIds: string[];
    lastEventId: string;
    omitted: boolean;
}

export interface AgencyKnowledgeView {
    knowledgeItemId: string;
    subject: KnowledgeSubjectRef;
    statement: string;
    /** Per-character epistemic status; the backend truthStatus is NEVER here. */
    epistemicStatus: KnowledgeEpistemicStatus;
    attitude: 'believes' | 'denies' | 'uncertain' | 'suspects';
    confidence: number;
    disclosurePolicy: DisclosurePolicy;
    learnedFromCharacterId?: CharacterId;
    evidenceIds: string[];
    lastEventId: string;
    omitted: boolean;
}

export type AgencySelectionHint =
    | { kind: 'has_active_task'; taskId: string; priority: TaskPriority }
    | { kind: 'has_blocked_task'; taskId: string }
    | { kind: 'has_new_information'; knowledgeItemId: string }
    | { kind: 'has_active_intent'; intentId: string };

export interface AgencyProjection {
    characterId: CharacterId;
    intents: AgencyIntentView[];
    tasks: AgencyTaskView[];
    knowledge: AgencyKnowledgeView[];
    selectionHints: AgencySelectionHint[];
    omitted: {
        intents: number;
        tasks: number;
        knowledge: number;
    };
}

// --- State-machine transition matrix (Intent) -----------------------------

/**
 * Plan §3.1.3 task 2 + table. Encodes which (from, to) pairs are
 * allowed. The Reducer (Task 1.3) consults this matrix to validate
 * `intent_update` mutations.
 *
 * The transition rules are:
 *  - (none → tentative) allowed: implicit create with origin=inferred
 *  - (none → active) allowed: implicit create with origin=explicit
 *  - (tentative → active) requires "second source confirms"
 *  - (tentative → suspended/fulfilled/abandoned) allowed
 *  - (active → active) allowed (priority/content update)
 *  - (active → suspended/fulfilled/abandoned) allowed
 *  - (suspended → active) allowed (owner resume)
 *  - (suspended → fulfilled/abandoned) allowed
 *  - (fulfilled/abandoned → anything) NOT allowed except via
 *    `manual_correction` (the Reducer enforces this separately).
 */
export type IntentTransitionFrom = IntentStatus | 'none';
export type IntentTransitionTo = IntentStatus;

export interface IntentTransitionRule {
    from: IntentTransitionFrom;
    to: IntentTransitionTo;
    /** Human-readable reason; used in logs and for debugging. */
    reason: string;
    /**
     * If true, this transition is forbidden from terminal states
     * (fulfilled/abandoned). The Reducer must additionally check
     * `manual_correction` to allow it.
     */
    terminalForbidden: boolean;
}

export const INTENT_TRANSITIONS: readonly IntentTransitionRule[] = [
    { from: 'none', to: 'tentative', reason: 'inferred create', terminalForbidden: false },
    { from: 'none', to: 'active', reason: 'explicit create', terminalForbidden: false },
    { from: 'tentative', to: 'active', reason: 'second-source confirm', terminalForbidden: false },
    { from: 'tentative', to: 'suspended', reason: 'owner pause', terminalForbidden: false },
    { from: 'tentative', to: 'fulfilled', reason: 'indirect evidence', terminalForbidden: false },
    { from: 'tentative', to: 'abandoned', reason: 'owner abandon', terminalForbidden: false },
    { from: 'active', to: 'active', reason: 'priority/content update', terminalForbidden: false },
    { from: 'active', to: 'suspended', reason: 'owner pause', terminalForbidden: false },
    { from: 'active', to: 'fulfilled', reason: 'achievement evidence', terminalForbidden: false },
    { from: 'active', to: 'abandoned', reason: 'owner abandon', terminalForbidden: false },
    { from: 'suspended', to: 'active', reason: 'owner resume', terminalForbidden: false },
    { from: 'suspended', to: 'fulfilled', reason: 'pause-achievement', terminalForbidden: false },
    { from: 'suspended', to: 'abandoned', reason: 'pause-abandon', terminalForbidden: false },
    // Terminal states have NO automatic outgoing transitions.
    // Restoring from terminal requires manual_correction; the Reducer
    // handles that case separately (plan §3.1.3 task 2 manual_correction
    // escape hatch).
];

/**
 * Plan §3.1.3 task 3 — Task state machine. Same shape as
 * INTENT_TRANSITIONS but for the 6 TaskStatus values.
 */
export type TaskTransitionFrom = TaskStatus | 'none';
export type TaskTransitionTo = TaskStatus;
export interface TaskTransitionRule {
    from: TaskTransitionFrom;
    to: TaskTransitionTo;
    reason: string;
    terminalForbidden: boolean;
}
export const TASK_TRANSITIONS: readonly TaskTransitionRule[] = [
    { from: 'none', to: 'proposed', reason: 'create', terminalForbidden: false },
    { from: 'proposed', to: 'active', reason: 'assignee accepted', terminalForbidden: false },
    { from: 'proposed', to: 'cancelled', reason: 'proposer withdrew', terminalForbidden: false },
    { from: 'active', to: 'blocked', reason: 'blocker raised', terminalForbidden: false },
    { from: 'active', to: 'completed', reason: 'predicate/evidence satisfied', terminalForbidden: false },
    { from: 'active', to: 'failed', reason: 'task failed', terminalForbidden: false },
    { from: 'active', to: 'cancelled', reason: 'cancelled by issuer', terminalForbidden: false },
    { from: 'blocked', to: 'active', reason: 'blocker cleared', terminalForbidden: false },
    { from: 'blocked', to: 'cancelled', reason: 'cancelled while blocked', terminalForbidden: false },
    // completed / failed / cancelled are terminal.
];

// --- Error codes (plan §8) ------------------------------------------------

export type AgencyErrorCode =
    | 'agency_identity_unavailable'
    | 'agency_timeline_unavailable'
    | 'agency_source_invalid'
    | 'agency_source_too_large'
    | 'agency_store_corrupt'
    | 'agency_api_unavailable'
    | 'agency_invalid_model_output'
    | 'agency_candidate_rejected'
    | 'agency_illegal_transition'
    | 'agency_prepared_batch_conflict'
    | 'agency_revision_conflict'
    | 'agency_timeline_context_stale'
    | 'agency_prompt_unsafe_content'
    | 'agency_prompt_too_large'
    | 'agency_predicate_disabled_first_phase'
    | 'agency_predicate_non_player'
    | 'agency_verification_unavailable'
    | 'agency_verification_unknown'
    | 'agency_predicate_false'
    /** Task 2.5: `Config.agencyEnabled === false` (or the actions API
     *  is missing) — the Service short-circuits without touching
     *  the disk. This is the noop path the regression guard
     *  asserts against (plan §11, §16). */
    | 'agency_disabled_by_config';

export class AgencyError extends Error {
    readonly code: AgencyErrorCode;
    constructor(code: AgencyErrorCode, message: string) {
        super(message);
        this.name = 'AgencyError';
        this.code = code;
    }
}

// --- File shape (events.json / attempts.json top-level) -------------------

export const AGENCY_EVENTS_SCHEMA_VERSION = 1;
export const AGENCY_ATTEMPTS_SCHEMA_VERSION = 1;
export const AGENCY_SOURCES_SCHEMA_VERSION = 1;

/**
 * Top-level events file (plan §12.3 mirror of ChronicleMemoryStoreFile).
 */
export interface AgencyEventsFile {
    schemaVersion: typeof AGENCY_EVENTS_SCHEMA_VERSION;
    campaignId: string;
    playerId: string;
    updatedAt: string;
    revision: number;
    events: AgencyEvent[];
}

/**
 * Top-level attempts file. Plan §5.2 — attempts is the extraction
 * working-state source of truth. Phase 1 declares the shape; Phase 2
 * populates it via `AgencyCoordinator`.
 */
export interface AgencyAttemptsFile {
    schemaVersion: typeof AGENCY_ATTEMPTS_SCHEMA_VERSION;
    campaignId: string;
    playerId: string;
    updatedAt: string;
    attempts: AgencyAttempt[];
}

/**
 * A single extraction attempt. The shape mirrors Chronicle's
 * `ChronicleGenerationAttempt` (status state machine, requestKey,
 * sourceDigest, error fields) plus Agency-specific sourceRecordId.
 */
export type AgencyAttemptStatus =
    | 'pending' | 'running' | 'prepared' | 'committed' | 'failed';

export interface AgencyAttempt {
    requestKey: string;            // agency:<sourceRecordId>:<sourceDigest>:v<n>:g<m>
    status: AgencyAttemptStatus;
    sourceRecordId: string;
    sourceDigest: string;
    sourceKind: AgencySourceKind;
    campaignId: string;
    playerId: string;
    nodeId: string;
    startedAt?: string;
    completedAt?: string;
    batchDigest?: string;          // canonical hash of the prepared batch
    committedEventIds?: string[];
    sanitizedErrorCode?: AgencyErrorCode;
    sanitizedErrorMessage?: string;
    extractionGeneration: number;  // plan §5.5 — incremented on terminal failure
    extractorVersion: number;
}

/**
 * Top-level sources directory entry. One per (sourceRecordId, digest)
 * pair. Immutable on disk: same recordId with a different digest gets
 * a separate file (plan §5.1).
 */
export interface AgencySourceSnapshotFile {
    schemaVersion: typeof AGENCY_SOURCES_SCHEMA_VERSION;
    campaignId: string;
    playerId: string;
    sourceRecordId: string;
    sourceDigest: string;
    sourceKind: AgencySourceKind;
    capturedAt: string;
    /** Raw, audit-only text. The model sees a projection, not this. */
    rawText: string;
    /** Pre-computed projection per the brief's two data sources. */
    anchor: AgencyTimelineAnchor;
    /** Per-character visible transcript slice (Phase 0's ConversationTurn[]). */
    visibleTranscript: import('./agencyTypes.js').ConversationTurn[];
}
