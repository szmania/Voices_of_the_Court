import { ck3DateFromTotalDays as totalDaysToDate } from '../../shared/gameData/ck3Calendar.js';
import { createHash, randomUUID } from 'crypto';
import type { Tiktoken } from 'js-tiktoken';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import { formatCk3GameDate } from '../../shared/gameData/gameDate.js';
import type { Parameters } from '../../shared/apiConnection.js';
import {
    CHRONICLE_CONTEXT_SAFETY_RATIO,
    DIGEST_PROMPT_VERSION,
    selectChronicleRepresentations,
    type ChroniclePlannerApi
} from './ChronicleBudgetPlanner.js';
import {
    createChronicleSummarizationConnection,
    generateChronicle,
    sanitizeChronicleErrorMessage,
    type ChronicleGeneratorApi,
    type ChronicleGeneratorConfig
} from './ChronicleGenerator.js';
import {
    collectChronicleSources
} from './ChronicleSourceCollector.js';
import { ChronicleStore } from './ChronicleStore.js';
import {
    isChronicleUnhealthy,
    markChronicleUnhealthy
} from './chronicleHealth.js';
import {
    CHRONICLE_ENTRIES_SCHEMA_VERSION,
    type ChronicleBudget,
    type ChronicleEntry,
    type ChronicleEntryReason,
    type ChronicleEntrySourceStats,
    type ChronicleGenerationAttempt,
    type ChronicleSelectedSource,
    type ChronicleSourceRecord,
    type ChronicleCoordinatorConfig,
    type ChronicleCoordinatorResult,
    type ChronicleSignal
} from './chronicleTypes.js';
import { ChronicleStoreError } from './chronicleAtomicJson.js';
import type { PreviousChronicleRef } from './ChroniclePromptBuilder.js';

export type { ChronicleCoordinatorConfig, ChronicleCoordinatorResult, ChronicleSignal } from './chronicleTypes.js';

const PROMPT_VERSION = 1;
const QUARTERLY_PERIOD_DAYS = 90;
const YEARLY_PERIOD_DAYS = 365;

interface ForcedChronicleRun {
    periodStart: Ck3GameDate;
    periodEnd: Ck3GameDate;
    reason: ChronicleEntryReason;
    firstBackfill: boolean;
    requestKey: string;
    revisionEntry?: ChronicleEntry;
}

const RECENT_CHRONICLES_LIMIT = 5;

function collectRecentChronicleRefs(
    store: ChronicleStore,
    signal: ChronicleSignal,
    currentPeriodStart: Ck3GameDate,
    excludeEntryId?: string
): PreviousChronicleRef[] {
    const visible = store.queryVisibleEntries({
        registry: signal.timeline.registry,
        currentNodeId: signal.timeline.currentNodeId,
        checkpointEpoch: signal.timeline.checkpointEpoch,
        includeEmpty: false
    });
    return visible
        .filter(entry => {
            if (!entry.content || !entry.content.trim()) return false;
            if (entry.periodEnd.totalDays >= currentPeriodStart.totalDays) return false;
            if (excludeEntryId && entry.id === excludeEntryId) return false;
            return true;
        })
        .sort((a, b) => b.periodEnd.totalDays - a.periodEnd.totalDays)
        .slice(0, RECENT_CHRONICLES_LIMIT)
        .map(entry => ({
            periodStart: entry.periodStart,
            periodEnd: entry.periodEnd,
            content: entry.content!
        }));
}

export class ChronicleCoordinator {
    private readonly runningByPlayer = new Map<string, Promise<ChronicleCoordinatorResult>>();

    constructor(
        private readonly userDataDir: string,
        private readonly configProvider: () => ChronicleCoordinatorConfig,
        private readonly chronicleApiProvider?: () => ChronicleGeneratorApi,
        private readonly plannerApiProvider?: () => ChroniclePlannerApi,
        private readonly encoder: Tiktoken | null = null
    ) {}

    async handleSignal(signal: ChronicleSignal): Promise<ChronicleCoordinatorResult> {
        const config = this.configProvider();
        const identity = signal.identity;
        const playerKey = `${identity.campaignId}:${identity.playerId}`;

        if (isChronicleUnhealthy(identity)) {
            return {
                outcome: 'ignored_unhealthy'
            };
        }

        if (signal.kind !== 'manual') {
            if (!shouldProcessFrequency(signal.kind, config.frequency)) {
                return { outcome: 'ignored_frequency' };
            }
        }

        return this.runExclusive(playerKey, () => this.runSignal(signal, config));
    }

    async retryAttempt(
        signal: ChronicleSignal,
        requestKey: string
    ): Promise<ChronicleCoordinatorResult> {
        const identity = signal.identity;
        if (isChronicleUnhealthy(identity)) {
            return { outcome: 'ignored_unhealthy' };
        }

        let store: ChronicleStore;
        try {
            store = new ChronicleStore(this.userDataDir, identity);
        } catch (error) {
            return {
                outcome: 'failed',
                errorCode: 'store_load_failed',
                errorMessage: sanitizeError(error)
            };
        }

        const attempt = store.getAttempt(requestKey);
        if (!attempt || attempt.status !== 'failed') {
            return {
                outcome: 'failed',
                errorCode: attempt ? 'attempt_not_failed' : 'attempt_not_found',
                requestKey
            };
        }
        const reason = parseReasonFromRequestKey(requestKey);
        if (!reason) {
            return {
                outcome: 'failed',
                errorCode: 'invalid_request_key',
                requestKey
            };
        }

        const revisionEntry = store.queryVisibleEntries({
            registry: signal.timeline.registry,
            currentNodeId: signal.timeline.currentNodeId,
            checkpointEpoch: signal.timeline.checkpointEpoch,
            currentGameDate: signal.gameDate,
            includeEmpty: true
        }).find(entry =>
            buildRequestKey(
                identity,
                entry.periodStart.totalDays,
                entry.periodEnd.totalDays,
                entry.votcTimelineNodeId,
                entry.reason
            ) === requestKey
        );

        const forced: ForcedChronicleRun = {
            periodStart: revisionEntry?.periodStart
                ?? dateFromTotalDays(attempt.periodStartDay),
            periodEnd: revisionEntry?.periodEnd
                ?? dateFromTotalDays(attempt.periodEndDay),
            reason: revisionEntry?.reason ?? reason,
            firstBackfill: (revisionEntry?.reason ?? reason) === 'backfill',
            requestKey,
            revisionEntry
        };
        const config = this.configProvider();
        const playerKey = `${identity.campaignId}:${identity.playerId}`;
        return this.runExclusive(
            playerKey,
            () => this.runSignal(signal, config, forced)
        );
    }

    async regenerateEntry(
        signal: ChronicleSignal,
        entryId: string
    ): Promise<ChronicleCoordinatorResult> {
        const identity = signal.identity;
        if (isChronicleUnhealthy(identity)) {
            return { outcome: 'ignored_unhealthy' };
        }

        let store: ChronicleStore;
        try {
            store = new ChronicleStore(this.userDataDir, identity);
        } catch (error) {
            return {
                outcome: 'failed',
                errorCode: 'store_load_failed',
                errorMessage: sanitizeError(error)
            };
        }

        const entry = store.queryVisibleEntries({
            registry: signal.timeline.registry,
            currentNodeId: signal.timeline.currentNodeId,
            checkpointEpoch: signal.timeline.checkpointEpoch,
            currentGameDate: signal.gameDate,
            includeEmpty: true
        }).find(candidate => candidate.id === entryId);
        if (!entry) {
            return {
                outcome: 'failed',
                errorCode: 'entry_not_visible'
            };
        }

        const requestKey = buildRequestKey(
            identity,
            entry.periodStart.totalDays,
            entry.periodEnd.totalDays,
            entry.votcTimelineNodeId,
            entry.reason
        );
        const forced: ForcedChronicleRun = {
            periodStart: entry.periodStart,
            periodEnd: entry.periodEnd,
            reason: entry.reason,
            firstBackfill: entry.reason === 'backfill',
            requestKey,
            revisionEntry: entry
        };
        const config = this.configProvider();
        const playerKey = `${identity.campaignId}:${identity.playerId}`;
        return this.runExclusive(
            playerKey,
            () => this.runSignal(signal, config, forced)
        );
    }

    private async runExclusive(
        playerKey: string,
        taskFactory: () => Promise<ChronicleCoordinatorResult>
    ): Promise<ChronicleCoordinatorResult> {
        if (this.runningByPlayer.has(playerKey)) {
            return { outcome: 'skipped_already_running' };
        }
        const task = taskFactory();
        this.runningByPlayer.set(playerKey, task);
        try {
            return await task;
        } finally {
            this.runningByPlayer.delete(playerKey);
        }
    }

    private async runSignal(
        signal: ChronicleSignal,
        config: ChronicleCoordinatorConfig,
        forced?: ForcedChronicleRun
    ): Promise<ChronicleCoordinatorResult> {
        const identity = signal.identity;
        let store: ChronicleStore;
        try {
            store = new ChronicleStore(this.userDataDir, identity);
        } catch (error) {
            this.markUnhealthy(identity, error, 'store_load_failed');
            return {
                outcome: 'failed',
                errorCode: 'store_load_failed',
                errorMessage: sanitizeError(error)
            };
        }

        const periodSelection = forced ?? this.selectPeriod(store, signal, config);
        if (periodSelection === undefined) {
            return { outcome: 'failed', errorCode: 'period_selection_failed' };
        }

        const { periodStart, periodEnd, reason, firstBackfill } = periodSelection;
        const timelineNodeId = forced?.revisionEntry?.votcTimelineNodeId
            ?? signal.timeline.currentNodeId;
        const checkpointEpoch = forced?.revisionEntry?.votcCheckpointEpoch
            ?? signal.timeline.checkpointEpoch;

        if (periodStart.totalDays >= periodEnd.totalDays) {
            const visibleForId = store.queryVisibleEntries({
                registry: signal.timeline.registry,
                currentNodeId: signal.timeline.currentNodeId,
                checkpointEpoch: signal.timeline.checkpointEpoch,
                currentGameDate: signal.gameDate,
                includeEmpty: false
            });
            const lastVisible = visibleForId.length > 0
                ? visibleForId.reduce((a, b) => a.periodEnd.totalDays > b.periodEnd.totalDays ? a : b)
                : undefined;
            return {
                outcome: 'skipped_idempotent',
                entryId: lastVisible?.id
            };
        }

        const requestKey = forced?.requestKey ?? buildRequestKey(
            identity,
            periodStart.totalDays,
            periodEnd.totalDays,
            timelineNodeId,
            reason
        );

        let sources: ChronicleSourceRecord[];
        try {
            sources = collectChronicleSources({
                userDataDir: this.userDataDir,
                identity,
                playerId: signal.playerId,
                registry: signal.timeline.registry,
                currentNodeId: signal.timeline.currentNodeId,
                checkpointEpoch,
                periodStart,
                periodEnd,
                firstBackfill
            });
        } catch (error) {
            return this.failAttempt(store, identity, requestKey, 'source_collection_failed', error, {
                periodStart, periodEnd, reason
            });
        }

        const sourceDigest = computeSourceDigest(sources);

        let attempt: ChronicleGenerationAttempt;
        if (forced?.revisionEntry) {
            try {
                const existing = store.getAttempt(requestKey);
                attempt = existing?.status === 'failed'
                    ? store.retryAttempt(requestKey)
                    : store.beginRevision(requestKey, sourceDigest, true);
            } catch (error) {
                return {
                    outcome: 'failed',
                    errorCode: error instanceof ChronicleStoreError ? error.code : 'begin_revision_failed',
                    errorMessage: sanitizeError(error),
                    requestKey
                };
            }
        } else {
            try {
                attempt = store.beginAttempt(requestKey, periodStart.totalDays, periodEnd.totalDays, sourceDigest);
            } catch (error) {
                if (error instanceof ChronicleStoreError && error.code === 'chronicle_invalid_state') {
                    const existing = store.getAttempt(requestKey);
                    if (existing && existing.status === 'failed') {
                        try {
                            attempt = store.retryAttempt(requestKey);
                        } catch {
                            return {
                                outcome: 'failed',
                                errorCode: 'retry_failed',
                                errorMessage: sanitizeError(error),
                                requestKey
                            };
                        }
                    } else if (existing && existing.status === 'committed') {
                        return this.handleCommittedDigest(
                            store, identity, existing, requestKey, sourceDigest,
                            periodStart, periodEnd, reason
                        );
                    } else {
                        return {
                            outcome: 'failed',
                            errorCode: 'invalid_attempt_state',
                            errorMessage: sanitizeError(error),
                            requestKey
                        };
                    }
                } else {
                    this.markUnhealthy(identity, error, 'begin_attempt_failed');
                    return {
                        outcome: 'failed',
                        errorCode: error instanceof ChronicleStoreError ? error.code : 'begin_attempt_failed',
                        errorMessage: sanitizeError(error),
                        requestKey
                    };
                }
            }
        }

        if (attempt.status === 'committed') {
            return {
                outcome: 'skipped_idempotent',
                entryId: attempt.entryId,
                requestKey
            };
        }

        if (sources.length === 0) {
            const emptyEntryId = forced?.revisionEntry?.id
                ?? `chronicle:${identity.campaignId}:${identity.playerId}:${periodStart.totalDays}:${periodEnd.totalDays}:${timelineNodeId ?? 'legacy'}:${reason}:${randomUUID()}`;
            const entry: ChronicleEntry = {
                ...buildEmptyEntry({
                entryId: emptyEntryId,
                playerId: signal.playerId,
                playerName: signal.playerName,
                playerTitle: signal.playerTitle,
                periodStart,
                periodEnd,
                reason,
                sourceDigest,
                checkpointEpoch,
                timelineNodeId
                }),
                votcTimelineParentId: forced?.revisionEntry?.votcTimelineParentId
            };
            try {
                store.saveEntry(entry);
                store.completeAttempt(requestKey, entry.id);
            } catch (error) {
                this.markUnhealthy(identity, error, 'empty_save_failed');
                return {
                    outcome: 'failed',
                    errorCode: 'empty_save_failed',
                    errorMessage: sanitizeError(error),
                    requestKey
                };
            }
            return {
                outcome: 'empty',
                entryId: entry.id,
                requestKey,
                reason,
                periodStart,
                periodEnd
            };
        }

        let chronicleApi: ChronicleGeneratorApi;
        let plannerApi: ChroniclePlannerApi;
        try {
            const defaultApi = (!this.chronicleApiProvider || !this.plannerApiProvider)
                ? createChronicleSummarizationConnection(buildGeneratorConfig(config), this.encoder)
                : undefined;
            chronicleApi = this.chronicleApiProvider
                ? this.chronicleApiProvider()
                : defaultApi!;
            plannerApi = this.plannerApiProvider
                ? this.plannerApiProvider()
                : defaultApi!;
        } catch (error) {
            return this.failAttempt(store, identity, requestKey, 'api_connection_failed', error, {
                periodStart, periodEnd, reason
            });
        }

        try {
            const budget: ChronicleBudget = {
                rawSourceCharLimit: config.rawSourceCharLimit,
                contextSafetyRatio: CHRONICLE_CONTEXT_SAFETY_RATIO,
                contextTokens: plannerApi.context,
                outputMaxTokens: config.outputMaxTokens
            };

            let selected: ChronicleSelectedSource[];
            try {
                selected = await selectChronicleRepresentations(
                    sources,
                    budget,
                    plannerApi,
                    {
                        userDataDir: this.userDataDir,
                        identity,
                        modelCategory: 'default',
                        digestPromptVersion: DIGEST_PROMPT_VERSION,
                        promptOverheadText: config.chroniclePrompt
                    }
                );
            } catch (error) {
                return this.failAttempt(store, identity, requestKey, 'budget_planning_failed', error, {
                    periodStart, periodEnd, reason
                });
            }

            const generatorConfig = buildGeneratorConfig(config);
            const recentRefs = collectRecentChronicleRefs(
                store, signal, periodStart, forced?.revisionEntry?.id
            );
            const generationResult = await generateChronicle({
                sources: selected,
                generatorConfig,
                api: chronicleApi,
                requestKey,
                playerName: signal.playerName,
                periodStart,
                periodEnd,
                previousChronicleEntries: recentRefs
            });

            if (!generationResult.ok) {
                return this.failAttemptRaw(store, identity, requestKey, generationResult.errorCode, generationResult.errorMessage, {
                    periodStart, periodEnd, reason
                });
            }

            const sourceStats = computeSourceStats(selected);
            const manifest = selected.map(s => s.manifestItem);
            const entryId = forced?.revisionEntry?.id
                ?? `chronicle:${identity.campaignId}:${identity.playerId}:${periodStart.totalDays}:${periodEnd.totalDays}:${timelineNodeId ?? 'legacy'}:${reason}:${randomUUID()}`;

            const entry: ChronicleEntry = {
                schemaVersion: CHRONICLE_ENTRIES_SCHEMA_VERSION,
                id: entryId,
                status: 'ready',
                reason,
                playerId: signal.playerId,
                playerName: signal.playerName,
                playerTitle: signal.playerTitle,
                periodStart,
                periodEnd,
                title: buildEntryTitle(periodStart, periodEnd),
                content: generationResult.content,
                sourceManifest: manifest,
                sourceDigest,
                promptVersion: PROMPT_VERSION,
                generatedAt: new Date().toISOString(),
                revision: forced?.revisionEntry?.revision ?? 0,
                sourceStats,
                votcCheckpointEpoch: checkpointEpoch,
                votcTimelineNodeId: timelineNodeId,
                votcTimelineParentId: forced?.revisionEntry?.votcTimelineParentId
            };

            try {
                store.saveEntry(entry);
                store.completeAttempt(requestKey, entry.id);
            } catch (error) {
                this.markUnhealthy(identity, error, 'entry_save_failed');
                return {
                    outcome: 'failed',
                    errorCode: 'entry_save_failed',
                    errorMessage: sanitizeError(error),
                    requestKey,
                    reason,
                    periodStart,
                    periodEnd
                };
            }

            return {
                outcome: 'generated',
                entryId,
                requestKey,
                reason,
                periodStart,
                periodEnd
            };
        } catch (error) {
            return this.failAttempt(store, identity, requestKey, 'generation_unexpected_error', error, {
                periodStart, periodEnd, reason
            });
        }
    }

    private handleCommittedDigest(
        store: ChronicleStore,
        identity: CampaignPlayerIdentity,
        existing: ChronicleGenerationAttempt,
        requestKey: string,
        newDigest: string,
        periodStart: Ck3GameDate,
        periodEnd: Ck3GameDate,
        reason: ChronicleEntryReason
    ): ChronicleCoordinatorResult {
        if (existing.sourceDigest === newDigest) {
            return {
                outcome: 'skipped_idempotent',
                entryId: existing.entryId,
                requestKey
            };
        }

        return {
            outcome: 'revision_available',
            entryId: existing.entryId,
            requestKey,
            reason,
            periodStart,
            periodEnd,
            revisionAvailable: true
        };
    }

    private selectPeriod(
        store: ChronicleStore,
        signal: ChronicleSignal,
        config: ChronicleCoordinatorConfig
    ): { periodStart: Ck3GameDate; periodEnd: Ck3GameDate; reason: ChronicleEntryReason; firstBackfill: boolean } | undefined {
        const visible = store.queryVisibleEntries({
            registry: signal.timeline.registry,
            currentNodeId: signal.timeline.currentNodeId,
            checkpointEpoch: signal.timeline.checkpointEpoch,
            currentGameDate: signal.gameDate,
            includeEmpty: true
        });

        if (visible.length === 0) {
            const sources = collectChronicleSources({
                userDataDir: this.userDataDir,
                identity: signal.identity,
                playerId: signal.playerId,
                registry: signal.timeline.registry,
                currentNodeId: signal.timeline.currentNodeId,
                checkpointEpoch: signal.timeline.checkpointEpoch,
                firstBackfill: true
            });
            const earliest = findEarliestSourceDate(sources);
            if (earliest === undefined) {
                return {
                    periodStart: dayBefore(signal.gameDate),
                    periodEnd: signal.gameDate,
                    reason: 'backfill',
                    firstBackfill: true
                };
            }
            return {
                periodStart: dayBefore(earliest),
                periodEnd: signal.gameDate,
                reason: 'backfill',
                firstBackfill: true
            };
        }

        const sorted = [...visible].sort((a, b) => a.periodEnd.totalDays - b.periodEnd.totalDays);
        const lastEntry = sorted[sorted.length - 1];
        const periodStart = lastEntry.periodEnd;
        const periodEnd = signal.gameDate;

        const gapDays = periodEnd.totalDays - periodStart.totalDays;
        const periodLimit = config.frequency === 'yearly' ? YEARLY_PERIOD_DAYS : QUARTERLY_PERIOD_DAYS;

        if (gapDays > periodLimit) {
            return {
                periodStart,
                periodEnd,
                reason: 'catch_up',
                firstBackfill: false
            };
        }

        const reason: ChronicleEntryReason = signal.kind === 'manual'
            ? 'manual'
            : (signal.kind === 'yearly' && config.frequency === 'quarterly')
                ? 'catch_up'
                : signal.kind;
        return {
            periodStart,
            periodEnd,
            reason,
            firstBackfill: false
        };
    }

    private failAttempt(
        store: ChronicleStore,
        identity: CampaignPlayerIdentity,
        requestKey: string,
        errorCode: string,
        error: unknown,
        meta: { periodStart: Ck3GameDate; periodEnd: Ck3GameDate; reason: ChronicleEntryReason }
    ): ChronicleCoordinatorResult {
        const errorMessage = sanitizeError(error);
        try {
            store.failAttempt(requestKey, errorCode, errorMessage);
        } catch (failError) {
            this.markUnhealthy(identity, failError, 'fail_attempt_persist_failed');
        }
        return {
            outcome: 'failed',
            errorCode,
            errorMessage,
            requestKey,
            reason: meta.reason,
            periodStart: meta.periodStart,
            periodEnd: meta.periodEnd
        };
    }

    private failAttemptRaw(
        store: ChronicleStore,
        identity: CampaignPlayerIdentity,
        requestKey: string,
        errorCode: string,
        errorMessage: string,
        meta: { periodStart: Ck3GameDate; periodEnd: Ck3GameDate; reason: ChronicleEntryReason }
    ): ChronicleCoordinatorResult {
        try {
            store.failAttempt(requestKey, errorCode, errorMessage);
        } catch (failError) {
            this.markUnhealthy(identity, failError, 'fail_attempt_persist_failed');
        }
        return {
            outcome: 'failed',
            errorCode,
            errorMessage,
            requestKey,
            reason: meta.reason,
            periodStart: meta.periodStart,
            periodEnd: meta.periodEnd
        };
    }

    private markUnhealthy(identity: CampaignPlayerIdentity, error: unknown, code: string): void {
        if (error instanceof ChronicleStoreError) {
            markChronicleUnhealthy(identity, error.code);
        } else {
            markChronicleUnhealthy(identity, code);
        }
    }
}

function shouldProcessFrequency(kind: 'quarterly' | 'yearly', config: ChronicleCoordinatorConfig['frequency']): boolean {
    if (config === 'disabled') return false;
    if (config === 'quarterly') return kind === 'quarterly' || kind === 'yearly';
    if (config === 'yearly') return kind === 'yearly';
    return false;
}

function buildRequestKey(
    identity: CampaignPlayerIdentity,
    startDay: number,
    endDay: number,
    timelineNodeId: string | undefined,
    reason: ChronicleEntryReason
): string {
    const nodePart = timelineNodeId ?? 'legacy';
    return `chronicle:${identity.campaignId}:${identity.playerId}:${startDay}:${endDay}:${nodePart}:${reason}`;
}

export function computeSourceDigest(sources: ChronicleSourceRecord[]): string {
    if (sources.length === 0) return 'empty';
    const parts = sources.map(s => {
        const contentHash = createHash('sha256').update(s.rawText, 'utf8').digest('hex');
        return `${s.id}:${s.kind}:${contentHash}`;
    });
    return createHash('sha256').update(parts.join('\u0001'), 'utf8').digest('hex');
}

function parseReasonFromRequestKey(requestKey: string): ChronicleEntryReason | undefined {
    const reason = requestKey.split(':').at(-1);
    if (reason === 'backfill' || reason === 'quarterly' || reason === 'yearly'
        || reason === 'catch_up' || reason === 'manual') {
        return reason;
    }
    return undefined;
}

function dateFromTotalDays(totalDays: number): Ck3GameDate {
    const { year, month, day } = totalDaysToDate(totalDays);
    const date: Ck3GameDate = {
        totalDays,
        year,
        month,
        day,
        display: ''
    };
    return {
        ...date,
        display: formatCk3GameDate(date)
    };
}

function findEarliestSourceDate(sources: ChronicleSourceRecord[]): Ck3GameDate | undefined {
    let earliest: Ck3GameDate | undefined;
    for (const source of sources) {
        if (source.gameDate && (earliest === undefined || source.gameDate.totalDays < earliest.totalDays)) {
            earliest = source.gameDate;
        }
    }
    return earliest;
}

function dayBefore(date: Ck3GameDate): Ck3GameDate {
    return dateFromTotalDays(date.totalDays - 1);
}

function buildGeneratorConfig(config: ChronicleCoordinatorConfig): ChronicleGeneratorConfig {
    const parameters: Parameters = config.summarizationApiConnectionConfig.parameters;
    return {
        chroniclePrompt: config.chroniclePrompt,
        chronicleOutputMaxTokens: config.outputMaxTokens,
        summarizationUseTextGenApi: config.summarizationUseTextGenApi,
        summarizationParameters: parameters,
        textGenerationApiConnectionConfig: config.textGenerationApiConnectionConfig,
        summarizationApiConnectionConfig: config.summarizationApiConnectionConfig,
        dumpPrompts: config.dumpPrompts ?? false
    };
}

function computeSourceStats(selected: ChronicleSelectedSource[]): ChronicleEntrySourceStats {
    let total = selected.length;
    let rawConversationCount = 0;
    let summarizedConversationCount = 0;
    let memoryCount = 0;
    let digestedMemoryCount = 0;
    let letterCount = 0;
    let battleReportCount = 0;
    let rawVisibleChars = 0;
    let selectedVisibleChars = 0;

    for (const s of selected) {
        const record = s.record;
        const manifest = s.manifestItem;
        if (record.kind === 'conversation') {
            if (manifest.representation === 'raw') rawConversationCount++;
            else summarizedConversationCount++;
        } else if (record.kind === 'character_memory') {
            memoryCount++;
            if (manifest.representation === 'generated_digest' || manifest.representation === 'chunk_digest') {
                digestedMemoryCount++;
            }
        } else if (record.kind === 'outgoing_letter' || record.kind === 'incoming_letter') {
            letterCount++;
        } else if (record.kind === 'battle_report') {
            battleReportCount++;
        }
        rawVisibleChars += manifest.rawCharCount;
        selectedVisibleChars += manifest.selectedCharCount;
    }

    return {
        total,
        rawConversationCount,
        summarizedConversationCount,
        memoryCount,
        digestedMemoryCount,
        letterCount,
        battleReportCount,
        rawVisibleChars,
        selectedVisibleChars,
        promptInputTokens: 0
    };
}

function buildEmptyEntry(params: {
    entryId: string;
    playerId: string;
    playerName: string;
    playerTitle?: string;
    periodStart: Ck3GameDate;
    periodEnd: Ck3GameDate;
    reason: ChronicleEntryReason;
    sourceDigest: string;
    checkpointEpoch?: number;
    timelineNodeId?: string;
}): ChronicleEntry {
    return {
        schemaVersion: CHRONICLE_ENTRIES_SCHEMA_VERSION,
        id: params.entryId,
        status: 'empty',
        reason: params.reason,
        playerId: params.playerId,
        playerName: params.playerName,
        playerTitle: params.playerTitle,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        title: buildEntryTitle(params.periodStart, params.periodEnd),
        content: undefined,
        sourceManifest: [],
        sourceDigest: params.sourceDigest,
        promptVersion: PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
        revision: 0,
        sourceStats: emptySourceStats(),
        votcCheckpointEpoch: params.checkpointEpoch,
        votcTimelineNodeId: params.timelineNodeId
    };
}

function emptySourceStats(): ChronicleEntrySourceStats {
    return {
        total: 0,
        rawConversationCount: 0,
        summarizedConversationCount: 0,
        memoryCount: 0,
        digestedMemoryCount: 0,
        letterCount: 0,
        battleReportCount: 0,
        rawVisibleChars: 0,
        selectedVisibleChars: 0,
        promptInputTokens: 0
    };
}

function buildEntryTitle(periodStart: Ck3GameDate, periodEnd: Ck3GameDate): string {
    return `${periodStart.year}.${periodStart.month}.${periodStart.day}–${periodEnd.year}.${periodEnd.month}.${periodEnd.day}`;
}

function sanitizeError(error: unknown): string {
    return sanitizeChronicleErrorMessage(
        error instanceof Error ? error.message : String(error)
    );
}
