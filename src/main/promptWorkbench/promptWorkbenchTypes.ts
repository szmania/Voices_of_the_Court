import { Message } from "../ts/conversation_interfaces";
import type { Ck3GameDate } from "../../shared/gameData/gameDate";
import type {
    CharacterScheme,
    ExposedTargetingScheme,
    KnownSecretV1,
    Memory,
    MilitarySnapshot,
    OpinionModifier,
    OwnedSecret,
    Secret,
    Trait,
    WarInfo
} from "../../shared/gameData/GameData";

/**
 * Prompt Workbench - shared type declarations.
 *
 * See docs/prompt-workbench-design-2026-08-01.md sections 4.1 and 5.
 * Phase 0a introduced the explicit conversation generation context and the
 * resolver/builder split types. Phase 1a adds the persisted DTOs (GameData
 * snapshot, frozen input, fixture, prompt-relevant config, workbench
 * settings) that the schema validators and fixture store operate on.
 */

/**
 * The four explicit conversation prompt modes (design doc section 4.1).
 * The production builder must receive the mode from the caller through
 * ConversationGenerationContextV1 and must never infer it from
 * playerID === aiID, an empty history override, or the presence of a
 * target character.
 */
export type ConversationPromptMode =
    | 'conversation'
    | 'selfTalk'
    | 'aiToAiInitiate'
    | 'aiToAiReply';

/**
 * Explicit description of one top-level generation request, decoupled from
 * the Conversation object (design doc section 4.1).
 *
 * Invariants:
 * - 'conversation' and 'selfTalk' must NOT set replyToCharacterId;
 * - 'aiToAiInitiate' and 'aiToAiReply' MUST set replyToCharacterId;
 * - requestId is created when a top-level generation starts; API-internal
 *   retries keep the same value;
 * - a renderer "regenerate" is a new top-level generation and therefore
 *   gets a new requestId, even if the request hash is identical.
 */
export interface ConversationGenerationContextV1 {
    requestId: string;
    mode: ConversationPromptMode;
    speakerCharacterId: number;
    replyToCharacterId?: number;
    /** 'empty' is used by AI-to-AI initiate, which builds without live history. */
    historyMode: 'live' | 'empty';
}

/**
 * Runtime guard for the ConversationGenerationContextV1 invariants above.
 * Throws on violation instead of silently degrading.
 */
export function assertValidConversationGenerationContext(context: ConversationGenerationContextV1): void {
    const needsReplyTarget = context.mode === 'aiToAiInitiate' || context.mode === 'aiToAiReply';
    if (needsReplyTarget && context.replyToCharacterId === undefined) {
        throw new Error(`ConversationGenerationContextV1: mode '${context.mode}' requires replyToCharacterId.`);
    }
    if (!needsReplyTarget && context.replyToCharacterId !== undefined) {
        throw new Error(`ConversationGenerationContextV1: mode '${context.mode}' must not set replyToCharacterId.`);
    }
}

// ---------------------------------------------------------------------------
// Design doc section 5.1 - logical request and build trace.
// Type-only declarations for the next phase (resolver/builder split);
// no implementation or persistence yet.
// ---------------------------------------------------------------------------

export type PromptRequestInputV1 =
    | {
        kind: 'chat';
        messages: Message[];
    }
    | {
        kind: 'completion';
        text: string;
    };

export type PromptSectionKind =
    | 'policy'
    | 'roleInstruction'
    | 'examples'
    | 'summaries'
    | 'memories'
    | 'intelligence'
    | 'agencyProjection'
    | 'description'
    | 'gameFacts'
    | 'currentSummary'
    | 'history'
    | 'turnCue';

export interface PromptSectionTraceV1 {
    kind: PromptSectionKind;
    label: string;
    renderedText: string;
    estimatedTokens: number;
    sourceItemCount?: number;
    includedItemCount?: number;
    truncated?: boolean;
    /**
     * Task 17: machine-readable provenance of the section content (e.g.
     * 'ck3_snapshot' for the gameFacts section). Absent for all sections
     * derived from live GameData/conversation state.
     */
    source?: string;
}

export interface PromptBuildArtifactV1 {
    logicalRequest: PromptRequestInputV1;
    /** Hash over UTF-8 canonical JSON (stable key order), not JSON.stringify. */
    logicalRequestHash: string;
    sections: PromptSectionTraceV1[];
    /** Local estimate only; never a substitute for provider usage. */
    estimatedInputTokens: number;
    estimator: {
        id: string;
        version: number;
    };
}

// ---------------------------------------------------------------------------
// Design doc section 5.3 - frozen prompt input (resolver output).
// A ResolvedPromptInputV1 contains only plain, JSON-serializable data: no
// GameData/Conversation/Config class instances may leak into it.
// ---------------------------------------------------------------------------

/**
 * A pool of candidate lines plus the budget that was in effect when the pool
 * was captured. itemsInSelectionOrder expresses builder selection priority
 * (summaries are newest-first, memories are relevance-first).
 * capturedRenderedText is null for production resolution; it is only filled
 * when a capture stores the exact text rendered under the production budget.
 */
export interface ResolvedTextPoolV1 {
    header: string;
    itemsInSelectionOrder: string[];
    capturedRenderedText: string | null;
    capturedBudgetTokens: number;
}

/**
 * Frozen game-facts projection (implementation plan Task 17 step 2).
 *
 * Contains ONLY the rendered candidate lines that already passed the
 * save-fact visibility registry, authority checks, name resolution and the
 * renderer sanitizer, plus the fixed localized block header and the token
 * budgets in effect at capture time. It NEVER contains a SaveFactIndex,
 * blocked facts, source paths, warnings or raw entities - the fixture holds
 * exactly the prompt-facing projection and nothing omniscient.
 *
 * The item pools are PRE-budget (like summaries/memories): builder v2
 * re-runs the per-lane budget selection from these frozen pools, so a
 * variant can re-select without touching the live fact index.
 */
export interface ResolvedGameFactsV1 {
    /**
     * 'available': the snapshot was parsed and prompt injection was enabled
     * (the pools may still be legitimately empty). 'unavailable': feature
     * off, snapshot missing/stale/failed - no facts may be rendered.
     */
    status: 'available' | 'unavailable';
    /** Fixed provenance marker rendered into the block's source attribute. */
    source: 'ck3_snapshot';
    /** Snapshot game-date display (e.g. '878.2.27'); '' when none is safe. */
    asOfDisplay: string;
    /**
     * Fixed localized block header captured at resolution time: the opening
     * <game_facts ...> tag (with as_of) plus the safety notice lines. Frozen
     * as text so a rebuild never re-derives localized templates; '' when
     * unavailable.
     */
    blockHeader: string;
    baselineItemsInSelectionOrder: string[];
    dynamicItemsInSelectionOrder: string[];
    capturedBaselineBudgetTokens: number;
    capturedDynamicBudgetTokens: number;
}

/**
 * Explicit per-speaker projection request handed to
 * ConversationPromptSource.resolveGameFacts (Task 17 step 3). The resolver
 * owns the bounding; the source owns the projection. Neither side may reach
 * into live Conversation state beyond this request.
 */
export interface GameFactsResolutionRequestV1 {
    context: ConversationGenerationContextV1;
    /** Speaker plus reply target (AI-to-AI) or player; deduped, stable order. */
    participantCharacterIds: number[];
    playerCharacterId: number;
    /** Bounded recent history (oldest-to-newest), already capped by the resolver. */
    recentHistory: Message[];
    /** Current clamped save-fact budgets from Config (resolver-side view). */
    maxBaselineTokens: number;
    maxDynamicTokens: number;
    countTokens: (text: string) => number;
}

export interface ResolvedPromptInputV1 {
    generation: ConversationGenerationContextV1;
    /**
     * Values that parseVariables would substitute for the {{variables}} used
     * by the mainPrompt/selfTalkPrompt templates. Variant templates may only
     * be expanded from this frozen record; unknown variables must fail.
     */
    variableValues: Record<string, string | number | boolean | null>;
    policies: {
        /** Resolved main/self-talk policy for the mode; null for AI-to-AI. */
        primary: string | null;
        /** Optional formatting/style policy, stored separately from primary. */
        suffix: string | null;
    };
    roleInstruction: string;
    exampleMessages: Message[];
    summaries: ResolvedTextPoolV1;
    memories: ResolvedTextPoolV1;
    intelligence: string;
    /** Optional per-character Agency ledger projection, frozen at capture. */
    agencyProjection?: string;
    description: string;
    currentSummary: string;
    /**
     * Task 17: frozen save-fact projection for this generation. Undefined in
     * fixtures captured by resolver v1; builder v2 treats a missing block as
     * 'unavailable' (see validateResolvedPromptInputV1). Builder v1 ignores
     * this field entirely.
     */
    gameFacts?: ResolvedGameFactsV1;
    history: Message[];
    turnMessages: Message[];
}

// ---------------------------------------------------------------------------
// Design doc section 6.1 - declarative prompt variant.
// Variants never execute JavaScript; they only re-select and re-order the
// frozen input above.
// ---------------------------------------------------------------------------

export type PromptContextSectionKind =
    | 'summaries'
    | 'memories'
    | 'intelligence'
    | 'description'
    | 'gameFacts'
    | 'currentSummary';

/**
 * The five context section kinds the frozen builder v1 knows. 'gameFacts'
 * was introduced with builder v2; builder v1 rejects it in contextOrder as
 * an unknown section.
 */
export type PromptContextSectionKindV1 = Exclude<PromptContextSectionKind, 'gameFacts'>;

export interface PromptVariantV1 {
    schemaVersion: 1;
    id: string;
    name: string;
    description: string;
    base: 'literal-baseline' | 'frozen-input';

    policy?: {
        mode: 'inherit' | 'replace';
        template?: string;
    };
    suffixPolicy?: {
        mode: 'inherit' | 'remove' | 'replace';
        template?: string;
    };
    maxSummaryTokens?: number;
    maxMemoryTokens?: number;
    /**
     * Task 17 step 6: builder-v2-only budget overrides for the gameFacts
     * section lanes. Same hard cap as the other token budgets. Builder v1
     * rejects a variant carrying these fields (unsupported modification)
     * instead of silently ignoring them.
     */
    maxGameFactBaselineTokens?: number;
    maxGameFactDynamicTokens?: number;
    contextOrder?: PromptContextSectionKind[];
    includeShortTurnCue?: boolean;
}

/**
 * Builder protocol version. Bump when frozen-input rendering changes.
 * v1: pre-save-facts builder (frozen, see buildConversationPromptArtifactV1).
 * v2: adds the gameFacts context section (implementation plan Task 17).
 */
export const CONVERSATION_BUILDER_VERSION = 2;

/**
 * Save-time bounds for variant token budgets (design doc section 6.1:
 * "budget limits consistent with Config, plus a sane hard cap"). The lower
 * bound matches Config (0 disables the section); the upper bound is a hard
 * cap so a hostile or corrupt variant cannot demand unbounded re-selection
 * work or imply unbounded API cost. Config's own UI caps are far lower
 * (thousands), so anything near the cap is already suspicious.
 */
export const WORKBENCH_VARIANT_TOKEN_BUDGET_MIN = 0;
export const WORKBENCH_VARIANT_TOKEN_BUDGET_MAX = 200000;

/**
 * Frozen builder-v1 background-context order (five sections, no gameFacts).
 * Kept so the v1 implementation and its variant validation never change.
 */
export const DEFAULT_CONTEXT_ORDER_V1: PromptContextSectionKindV1[] = [
    'summaries',
    'memories',
    'intelligence',
    'description',
    'currentSummary'
];

/**
 * Fixed background-context sub-section order used by production (builder
 * v2): gameFacts sits inside the fixed background context after the
 * participant description and before the current conversation summary,
 * still ahead of the append-only history (plan Task 17 step 4).
 */
export const DEFAULT_CONTEXT_ORDER: PromptContextSectionKind[] = [
    'summaries',
    'memories',
    'intelligence',
    'description',
    'gameFacts',
    'currentSummary'
];

/**
 * The variant used by the live conversation path: frozen input, no
 * modifications. buildConversationPromptArtifact(resolved, PRODUCTION_VARIANT)
 * must produce byte-identical output to the pre-split buildChatPrompt.
 */
export const PRODUCTION_VARIANT: PromptVariantV1 = {
    schemaVersion: 1,
    id: 'production',
    name: 'Production',
    description: 'Production build path: frozen input with no modifications.',
    base: 'frozen-input'
};

// ---------------------------------------------------------------------------
// Design doc section 7.5.5 - program candidate protocol.
// A PromptProgramCandidateV2 composes a declarative prompt variant with a
// participant-description variant. The description variants deliberately
// avoid the PromptVariantV1.description metadata name: 'inherit-captured'
// uses the fixture's frozen description, and 'trusted-script' re-executes
// ONLY a built-in script whose manifest hash still matches the candidate.
// (The 1.x 'profile' mode, which embedded a declarative DescriptionProfileV1,
// is not ported: it belongs to the description subsystem that stays in 1.x.)
// ---------------------------------------------------------------------------

export type ParticipantDescriptionVariantV1 =
    | { mode: 'inherit-captured' }
    | { mode: 'trusted-script'; rendererManifestId: string; rendererManifestHash: string };

export interface PromptProgramCandidateV2 {
    schemaVersion: 2;
    id: string;
    name: string;
    promptVariant: PromptVariantV1;
    participantDescription: ParticipantDescriptionVariantV1;
}

// ---------------------------------------------------------------------------
// Design doc section 5.2 - GameDataSnapshotV1.
// GameData contains Maps, class instances and methods, so it cannot be JSON
// serialized directly. GameDataSnapshotCodec copies an explicit field
// whitelist into these plain DTOs; Maps become arrays sorted by stable key.
// ---------------------------------------------------------------------------

/**
 * MilitarySnapshot with the wars Map replaced by an array sorted by war id
 * ascending (design doc section 5.2).
 */
export type MilitarySnapshotSnapshotV1 = Omit<MilitarySnapshot, 'wars'> & {
    wars: WarInfo[];
};

/**
 * Plain-JSON copy of every persistable Character field (design doc section
 * 5.2). Field order and names mirror the Character class. Opinion entries use
 * the key 'opinion', aligned with the CE producer (parseLog) field name;
 * 1.x used the misspelled 'opinon'.
 */
export interface CharacterSnapshotV1 {
    id: number;
    shortName: string;
    fullName: string;
    firstName: string;
    primaryTitle: string;
    titleRankConcept: string;
    sheHe: string;
    age: number;
    gold: number;
    opinionOfPlayer: number;
    sexuality: string;
    personality: string;
    greed: number;
    isIndependentRuler: boolean;
    isRuler: boolean;
    isLandedRuler: boolean;
    isKnight: boolean;
    prowess: number;
    liege: string;
    topLiege: string;
    consort: string;
    culture: string;
    faith: string;
    house: string;
    capitalLocation: string;
    liegeRealmLaw: string;
    heldCourtAndCouncilPositions: string;
    secrets: Secret[];
    ownedSecrets: OwnedSecret[];
    knownSecrets: KnownSecretV1[];
    ownedSchemes: CharacterScheme[];
    exposedTargetingSchemes: ExposedTargetingScheme[];
    memories: Memory[];
    traits: Trait[];
    relationsToPlayer: string[];
    relationsToCharacters: Array<{ id: number; relations: string[] }>;
    opinionBreakdownToPlayer: OpinionModifier[];
    opinions: Array<{ id: number; opinion: number }>;
}

export interface GameDataSnapshotV1 {
    date: string;
    gameDate?: Ck3GameDate;
    scene: string;
    location: string;
    locationController: string;
    playerID: number;
    playerName: string;
    aiID: number;
    aiName: string;
    character1Name: string;
    character2Name: string;

    /**
     * Save snapshot metadata from the init tail (plan section 5.1), kept for
     * fixture diagnosis. Absent for legacy mods and for any non-available
     * parse status.
     */
    saveSnapshotProtocolVersion?: number;
    saveSnapshotSequence?: number;
    saveSnapshotSlot?: 0 | 1;

    timeline: {
        checkpointEpoch: number;
        nodeA?: number;
        nodeB?: number;
        parentA?: number;
        parentB?: number;
        checkpointToken?: number;
        pendingCheckpointToken?: number;
        protocolSchema?: number;
        campaignSchema?: number;
        campaignIdParts?: [number, number, number, number];
        campaignBootstrapKind?: number;
        playerTimelineSchema?: number;
    };

    /** Sorted by character id ascending. */
    characters: CharacterSnapshotV1[];
    militarySnapshot?: MilitarySnapshotSnapshotV1;
}

// ---------------------------------------------------------------------------
// Design doc section 5.4 - fixture scope, prompt-relevant config and the
// persisted fixture envelope.
// ---------------------------------------------------------------------------

export type FixtureScopeV1 =
    | { kind: 'campaign'; campaignId: string; playerId: string }
    | { kind: 'legacy-player'; playerId: string };

/**
 * Locked sampling parameters for a fixture/experiment (design doc section
 * 6.2). Provider-aware whitelist - never an arbitrary Record passthrough.
 */
export interface WorkbenchSamplingParametersV1 {
    temperature: number;
    topP: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    seed?: number;
    thinkingEnabled: boolean;
}

/**
 * The prompt-relevant slice of Config frozen into a fixture (design doc
 * section 5.4). Never contains API keys, base URLs, headers or user paths.
 */
export interface PromptRelevantConfigV1 {
    transport: {
        kind: 'chat' | 'completion';
        inputSequence: string;
        outputSequence: string;
    };
    prompts: {
        mainPrompt: string;
        selfTalkPrompt: string;
        memoriesPrompt: string;
        suffixPrompt: string;
        enableSuffixPrompt: boolean;
    };
    scripts: {
        descriptionFileName: string;
        exampleMessagesFileName: string;
    };
    budgets: {
        maxInputContextTokens: number;
        maxOutputTokens: number;
        maxSummaryTokens: number;
        maxMemoryTokens: number;
    };
    responseProcessing: {
        cleanMessages: boolean;
    };
    sampling: WorkbenchSamplingParametersV1;
}

/**
 * One captured, reproducible conversation sample (design doc section 5.4).
 */
export interface PromptFixtureV1 {
    schemaVersion: 1;
    id: string;
    sourceRequestId: string;
    capturedAt: string;
    scope: FixtureScopeV1;
    timelineNodeId?: string;
    checkpointEpoch: number;
    gameDate: string;

    versions: {
        resolver: number;
        builder: number;
        providerNormalizer: number;
        tokenEstimator: number;
        app: string;
    };

    /** Search/compare field, not a unique key. */
    sourceHash: string;
    gameData: GameDataSnapshotV1;
    resolved: ResolvedPromptInputV1;
    effectiveConfig: PromptRelevantConfigV1;
    scriptSources: Array<{
        kind: 'description' | 'exampleMessages';
        fileName: string;
        sha256: string;
    }>;
    baseline: PromptBuildArtifactV1;
    sourceConnection: {
        provider: string;
        model: string;
        /** One-way hash of provider+model+normalized endpoint identity. */
        connectionFingerprint: string;
    };
    sourceOutcome?: {
        status: 'pending' | 'succeeded' | 'failed';
        completedAt?: string;
        errorCategory?: string;
        providerRequestHash?: string;
    };
    pinned?: boolean;
    tags?: string[];
    /**
     * Post-promotion observation marker (prompt-benchmark plan Task 7.5): when
     * a benchmark candidate is promoted into production, fixtures captured
     * AFTER that promotion carry the promotion id + candidate hash so enough
     * production samples can later seed a NEW observation suite. Such samples
     * must never be merged into the old holdout without human review.
     */
    promotionId?: string;
    /** sha256 of the promoted benchmark candidate that produced this fixture. */
    candidateHash?: string;
}

/**
 * Fixture V2 - snapshot provenance (prompt-benchmark design doc sections
 * 4.2 and 7.5). V2 adds a frozen hash over the captured GameDataSnapshot.
 * V1 fixtures are never rewritten on load; a V1 fixture maps to a
 * 'captured-unknown' provenance view in the read layer only.
 *
 * (The 1.x description-provenance fields descriptionProvenance/
 * descriptionArtifact are not ported: they belong to the description
 * subsystem that stays in 1.x.)
 */

export interface PromptFixtureV2 extends Omit<PromptFixtureV1, 'schemaVersion'> {
    schemaVersion: 2;
    /** sha256 over the canonical JSON of gameData (design doc section 4.3). */
    gameDataSnapshotHash: string;
}

export type PromptFixtureAnyVersion = PromptFixtureV1 | PromptFixtureV2;

/**
 * Persisted fixture-index schema version. Version 2 added the
 * FixtureIndexSummaryV1 card fields; version 3 extends the index DTO shape
 * for any-version fixture loading; version 4 (PR14) adds the builder/resolver
 * versions, the promotion marker and the compatibility card to the summary.
 * An index written by an older schema version is rebuilt by scanning the
 * fixture files, never guessed in place.
 */
export const FIXTURE_INDEX_SCHEMA_VERSION = 4;

// ---------------------------------------------------------------------------
// Design doc section 7 - workbench capture settings.
// ---------------------------------------------------------------------------

export interface WorkbenchSettingsV1 {
    /** Capture is opt-in; default false. */
    captureEnabled: boolean;
    /** Rolling retention per scope; 1-200, default 30. */
    retainCount: number;
    /** Per-scope byte quota; default 100 MB. */
    scopeQuotaBytes: number;
    /**
     * Set once the user has seen the first-enable notice (directory, content
     * sensitivity, retain count, quota). Undefined/false means the notice has
     * not been acknowledged yet.
     */
    noticeAcknowledged?: boolean;
    /**
     * PR13 M5 first-use wizard state (§10.2). Undefined (old settings) means
     * the wizard was never completed, so it auto-opens on the first open
     * without samples. The wizard only GUIDES - these flags never enable
     * capture, send API requests or apply candidates.
     */
    onboardingCompleted?: boolean;
    /** Explicitly dismissed ("Later"); the auto-open stays suppressed, the manual button still works. */
    onboardingDismissed?: boolean;
    /** 1..9 while the wizard is in progress; undefined = never started. */
    onboardingStep?: number;
    /**
     * PR14 M5 fixture bundle import gate (§11.1: "fixture import 单独 gate，
     * 先只开放 export"). Default OFF: bundle EXPORT always works, bundle
     * IMPORT is refused while this is not exactly true. PR15 exposes the
     * toggle; undefined (old settings) means the gate is closed.
     */
    fixtureImportEnabled?: boolean;
    /**
     * PR-S9 simple-mode feature flag. Default ON (undefined, including old
     * settings files, means enabled); set exactly false to refuse new
     * simple-mode tasks while leaving existing tasks readable. A config-UI
     * toggle lands in a later milestone; until then the flag is flipped via
     * the settings store only.
     */
    simpleModeEnabled?: boolean;
    /**
     * Beginner-UX plan §16.1: which mode the workbench opens to on launch.
     * 'simple' = the simple / history / applied first-class tabs;
     * 'advanced' = the four advanced menus (quick / description / benchmark /
     * optimization). New users default to 'simple' per §16.2.3; once the
     * user picks a tab the value is persisted and restored on every
     * subsequent launch. Compiled-time default (DEFAULT_WORKBENCH_MODE) is
     * the same 'simple', so the renderer falls back cleanly when the field
     * is undefined (old settings files).
     */
    promptWorkbenchDefaultMode?: 'simple' | 'advanced';
}

export const WORKBENCH_RETAIN_COUNT_MIN = 1;
export const WORKBENCH_RETAIN_COUNT_MAX = 200;
export const WORKBENCH_DEFAULT_RETAIN_COUNT = 30;
export const WORKBENCH_DEFAULT_SCOPE_QUOTA_BYTES = 100 * 1024 * 1024;

/**
 * PR14 M5 (§10.4, review): the tag character whitelist and count cap, shared
 * by the IPC metadata DTO validation (main.ts) and the fixture bundle import
 * sanitizer (fixtureBundleLogic) so the two can never drift.
 */
export const WORKBENCH_TAG_PATTERN = /^[A-Za-z0-9_\- .+#]{1,64}$/;
export const WORKBENCH_MAX_TAGS = 20;

/**
 * Beginner-UX plan §16.1: the binary default-mode group persisted under
 * `WorkbenchSettingsV1.promptWorkbenchDefaultMode`. 'simple' covers the
 * first-class tabs (simple / history / applied); 'advanced' covers the four
 * "Advanced tools" menus (quick / description / benchmark / optimization).
 * The renderer maps a specific WorkbenchMode to one of these groups when
 * the user switches tabs and reads the group back to derive the initial
 * mode on launch.
 */
export const WORKBENCH_DEFAULT_MODE_VALUES = ['simple', 'advanced'] as const;
export type WorkbenchDefaultModeValue = typeof WORKBENCH_DEFAULT_MODE_VALUES[number];

export const DEFAULT_WORKBENCH_SETTINGS: WorkbenchSettingsV1 = {
    captureEnabled: false,
    retainCount: WORKBENCH_DEFAULT_RETAIN_COUNT,
    scopeQuotaBytes: WORKBENCH_DEFAULT_SCOPE_QUOTA_BYTES,
    noticeAcknowledged: false,
    onboardingCompleted: false,
    onboardingDismissed: false,
    // PR C16.1: new users open the simple-mode wizard (§16.2.3).
    promptWorkbenchDefaultMode: 'simple'
};

// ---------------------------------------------------------------------------
// Design doc section 6.3 - API return contract and run results (Phase 3a).
// ---------------------------------------------------------------------------

/**
 * Provider-reported token usage, normalized across provider shapes (design
 * doc section 6.3). Metrics the provider did not report stay undefined -
 * they are NEVER filled with 0 or a local estimate. providerRaw keeps only
 * the whitelisted, size-capped subset of the raw provider usage object (see
 * WorkbenchUsageAdapter); the full response object is never persisted.
 */
export interface NormalizedUsageV1 {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadInputTokens?: number;
    cacheWriteInputTokens?: number;
    cacheMissInputTokens?: number;
    providerRaw?: Record<string, unknown>;
}

/** The measured result of one API call (design doc section 6.3). */
export interface CompletionResultV1 {
    rawResponse: string;
    /** Total wall time of the call, including internal retries. */
    durationMs: number;
    /** Only when streaming AND a first content chunk was measurable. */
    firstTokenMs?: number;
    /** Actual attempts minus one, from the shared retry loop. */
    retryCount: number;
    usage?: NormalizedUsageV1;
    /**
     * sha256 over the canonical JSON of the provider-normalized request body
     * that was actually sent on the successful (last) attempt.
     */
    providerRequestHash: string;
}

/**
 * Per-call options for ApiConnection.completeWithMetrics. The sampling
 * parameters must already be provider-filtered (design doc section 6.2) by
 * the caller - completeWithMetrics sends exactly what it is given, so the
 * run record and the wire request stay consistent.
 */
export interface CompletionOptionsV1 {
    /** Workbench runs are non-streaming; streaming is reserved for later. */
    stream?: boolean;
    /** Sent as max_tokens where the provider branch supports otherArgs. */
    maxOutputTokens?: number;
    /** Effective (post provider-capability-filter) sampling parameters. */
    sampling?: WorkbenchSamplingParametersV1;
    /** Dump/attribution purpose; the workbench always passes 'promptWorkbench'. */
    purpose?: string;
    /**
     * Caller-side cancellation (stop button / lease teardown). When fired,
     * the in-flight attempt aborts immediately and is never retried.
     */
    signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Design doc section 6.2 - experiment.
// ---------------------------------------------------------------------------

export type WorkbenchExperimentState = 'draft' | 'running' | 'completed' | 'cancelled' | 'partial';

export interface ScheduledRunV1 {
    runId: string;
    variantId: string;
    /** 1-based repetition round. */
    repetition: number;
    /** 0-based position in the overall execution order. */
    position: number;
}

/**
 * One locked A/B experiment (design doc section 6.2). variantSnapshots are
 * COPIES taken at creation time (section 6.1): later edits to the global
 * variant store must not affect an experiment that already exists.
 */
export interface PromptExperimentV1 {
    schemaVersion: 1;
    id: string;
    createdAt: string;
    updatedAt: string;
    fixtureId: string;
    state: WorkbenchExperimentState;
    provider: string;
    model: string;
    connectionFingerprint: string;
    parameters: WorkbenchSamplingParametersV1;
    maxOutputTokens: number;
    /** 1-5 repetitions per variant. */
    repetitions: number;
    orderingSeed: string;
    variantSnapshots: PromptVariantV1[];
    scheduledRuns: ScheduledRunV1[];
    conclusion?: string;
    recommendForProduction?: boolean;
}

export const WORKBENCH_REPETITIONS_MIN = 1;
export const WORKBENCH_REPETITIONS_MAX = 5;

/** Hard upper cap for an experiment's max output tokens (cost guard). */
export const WORKBENCH_MAX_OUTPUT_TOKENS_MAX = 32768;

/** Valid id shape for experiment/run ids (safe file names, like fixtures). */
export const WORKBENCH_EXPERIMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

// ---------------------------------------------------------------------------
// Design doc section 6.3 - run result, error and ratings.
// ---------------------------------------------------------------------------

export type WorkbenchRunStatus =
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'interrupted';

export type WorkbenchErrorCategory =
    | 'validation'
    | 'connection'
    | 'timeout'
    | 'rateLimit'
    | 'provider'
    | 'cancelled'
    | 'internal';

export interface WorkbenchErrorV1 {
    category: WorkbenchErrorCategory;
    retryable: boolean;
    statusCode?: number;
    /**
     * Sanitized message: no request body, no headers, no API keys and no
     * echoed prompt text may ever land here (design doc section 6.3).
     */
    safeMessage: string;
}

export const WORKBENCH_HARD_FAILURES = [
    'fabricatedKeyFact',
    'spokeForOtherCharacter',
    'systemPromptLeak',
    'emptyResponse',
    'wrongLanguage',
    'unparseableFormat'
] as const;

export type WorkbenchHardFailure = (typeof WORKBENCH_HARD_FAILURES)[number];

/**
 * Blind-review ratings for one run (design doc sections 6.3 and 10). Every
 * score is an integer 1-5; `repetition` is reverse-scored (higher = more
 * repetition), so any aggregated display must use `6 - repetition`.
 */
export interface WorkbenchRatingsV1 {
    /** Set by the main process when the ratings are persisted. */
    ratedAt: string;
    reviewerLabel?: string;
    scores: {
        characterConsistency: number;
        factAccuracy: number;
        targetCharacterOnly: number;
        latestTurnRelevance: number;
        styleCompliance: number;
        dramaticAgency: number;
        /** Reverse-scored: higher means MORE repetition/cliche. */
        repetition: number;
    };
    hardFailures: WorkbenchHardFailure[];
    note?: string;
}

/** Renderer-supplied ratings payload; ratedAt is assigned server-side. */
export type WorkbenchRatingsInputV1 = Omit<WorkbenchRatingsV1, 'ratedAt'>;

export interface WorkbenchRunResultV1 {
    schemaVersion: 1;
    runId: string;
    experimentId: string;
    fixtureId: string;
    variantId: string;
    repetition: number;
    position: number;
    status: WorkbenchRunStatus;
    startedAt?: string;
    completedAt?: string;

    provider: string;
    model: string;
    /**
     * EFFECTIVE (provider-capability-filtered) parameters actually sent for
     * this run (design doc section 6.2). At queue time this mirrors the
     * experiment parameters; the runner overwrites it with the filtered set.
     */
    parameters: WorkbenchSamplingParametersV1;
    /**
     * Undefined while queued: the request artifact is only built (and
     * persisted) when the runner starts the run. It never changes afterwards
     * because the fixture input and variant snapshot are frozen.
     */
    request?: PromptBuildArtifactV1;
    providerRequestHash?: string;
    rawResponse: string | null;
    cleanedResponse: string | null;
    error: WorkbenchErrorV1 | null;
    durationMs?: number;
    firstTokenMs?: number;
    retryCount?: number;
    usage?: NormalizedUsageV1;
    /**
     * Whether a seed was actually sent (only providers that support one);
     * when false the repetitions are randomness samples, not deterministic
     * replays (design doc section 10).
     */
    seedSent?: boolean;
    determinismAvailable?: boolean;
    ratings?: WorkbenchRatingsV1;
}

/**
 * Input for prompt-workbench:create-experiment. provider/model/
 * connectionFingerprint must match the CURRENT configured connection; the
 * main process rejects mismatches with a structured error so a stale plan
 * can never run against a different backend than the user reviewed.
 */
export interface CreateExperimentInputV1 {
    fixtureId: string;
    variantIds: string[];
    repetitions: number;
    provider: string;
    model: string;
    connectionFingerprint: string;
    parameters: WorkbenchSamplingParametersV1;
    maxOutputTokens: number;
    /** Optional; the store generates one when omitted. */
    orderingSeed?: string;
}
