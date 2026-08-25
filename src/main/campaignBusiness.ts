import fs from 'fs';
import path from 'path';
import type { CampaignPlayerIdentity } from '../shared/gameData/CampaignIdentity.js';
import {
    FsTimelinePersistence,
    TimelineRegistry,
    TimelineRegistryCorruptError,
    type TimelineStoreLoadResult,
    type TimelineContext,
    type GameDataLike,
    type SourceKind,
    type CreateChildNodeResult,
    buildContextFromGameData,
    resolveTimelineContext,
    createChildNodeAndScript
} from './timelineManager.js';
import {
    stageCampaignMigration,
    type MigrationStageOptions,
    type MigrationStageResult,
    type ObservedTimelineState
} from './campaignMigration.js';
import { withTimelineLock } from './timelineLock.js';
import { UnsupportedTimelineSchemaError } from '../shared/gameData/timelineProtocol.js';

export interface CampaignReadyOptions {
    observedState?: MigrationStageOptions['observedState'];
}

export interface CampaignReadyResult {
    loadResult: TimelineStoreLoadResult;
    migrationPerformed: boolean;
    migrationDecision?: MigrationStageResult['decision'];
    migrationImportedNodeCount?: number;
}

/**
 * §8 mid-game enablement: load a campaign/player store; if missing, trigger
 * staging migration (P4.2 stageCampaignMigration) which imports proven legacy
 * records for the matching playerId when an ExactCandidate exists. Per §8.3,
 * migration is conservative: ambiguous candidates are skipped and the load
 * returns missing so the caller may create a fresh namespace.
 *
 * The auto-trigger fires only when (campaign dir missing) AND (legacy
 * player-only data exists with matching playerId). Migration is idempotent:
 * a second call with status=imported returns skipped/already-staged.
 *
 * After migration, re-load the campaign path so the caller sees the staged
 * envelope. If migration was skipped (no-legacy-data or ambiguous), the load
 * result remains missing.
 */
export function loadCampaignStoreWithMigration(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    options: CampaignReadyOptions
): CampaignReadyResult {
    const persistence = new FsTimelinePersistence(userDataDir);
    const initial = persistence.loadStoreWithIdentity(identity);

    if (initial.status !== 'missing') {
        return {
            loadResult: initial,
            migrationPerformed: false
        };
    }

    // Phase 4 mid-game enablement: attempt staging migration. This is a
    // read-only operation with respect to legacy data (copies + backup).
    // §8.3 strict candidate check happens inside stageCampaignMigration.
    const migrationResult = stageCampaignMigration(userDataDir, identity, {
        observedState: options.observedState
    });

    const migrationPerformed = migrationResult.status === 'imported';

    // Re-load after migration to surface the staged envelope (if imported),
    // or keep the missing result (if skipped).
    const loadResult: TimelineStoreLoadResult = migrationPerformed
        ? persistence.loadStoreWithIdentity(identity)
        : initial;

    return {
        loadResult,
        migrationPerformed,
        migrationDecision: migrationResult.decision,
        migrationImportedNodeCount: migrationResult.importedNodeCount
    };
}

/**
 * Save a campaign store at the identity-scoped path. Thin wrapper around
 * FsTimelinePersistence.saveStoreWithIdentity so business callers do not need
 * to construct the persistence object themselves.
 */
export function saveCampaignStore(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    registry: InstanceType<typeof FsTimelinePersistence> extends never ? never : any
): void {
    const persistence = new FsTimelinePersistence(userDataDir);
    persistence.saveStoreWithIdentity(identity, registry);
}

export function loadCampaignStore(
    userDataDir: string,
    identity: CampaignPlayerIdentity
): TimelineStoreLoadResult {
    const persistence = new FsTimelinePersistence(userDataDir);
    return persistence.loadStoreWithIdentity(identity);
}

export function campaignStoreExists(userDataDir: string, identity: CampaignPlayerIdentity): boolean {
    const persistence = new FsTimelinePersistence(userDataDir);
    return persistence.loadStoreWithIdentity(identity).status === 'found';
}

/**
 * Build an `ObservedTimelineState` from a `TimelineContext` so the migration
 * ExactCandidate check can match the legacy registry against the snapshot
 * the App currently sees. Only the fields that exist on the context are
 * forwarded; `playerId` is always present, the rest are optional.
 *
 * This is the §8.3 "observed state" evidence: the playerId, epoch, node id
 * and checkpointToken the App just received from CK3, used to prove the
 * legacy player-only registry describes the SAME checkpoint branch.
 */
export function observedStateFromContext(ctx: TimelineContext): ObservedTimelineState {
    const observed: ObservedTimelineState = { playerId: ctx.playerId };
    if (ctx.checkpointEpoch !== undefined) {
        observed.epoch = ctx.checkpointEpoch;
    }
    if (ctx.timelineNodeId !== undefined) {
        observed.timelineNodeId = ctx.timelineNodeId;
    }
    if (ctx.checkpointToken !== undefined) {
        observed.checkpointToken = ctx.checkpointToken;
    }
    return observed;
}

/**
 * §1, §3: the canonical campaign-scoped timeline read-modify-write sequence
 * for business operations (Conversation.summarize, LetterReplyGenerator,
 * IncomingLetterGenerator, BattleReportGenerator). Captures the identity
 * immutably from the game data at call time, runs the RMW under
 * withTimelineLock({campaignId, playerId}), and persists via
 * saveStoreWithIdentity.
 *
 * The caller supplies a callback that performs the registry mutation
 * (createChildNodeAndScript) and returns the CreateChildNodeResult. Any
 * thrown TimelineRegistryCorruptError / UnsupportedTimelineSchemaError is
 * reported via the recovery handlers; the callback's return value is
 * surfaced back to the caller so it can write the run file etc.
 *
 * Per §4.2: the legacy player-only saveRegistry path is NOT used. Per §9:
 * if the identity is missing (legacy Mod), the operation fails closed.
 */
export interface CampaignTimelineOperationResult {
    timeline: CreateChildNodeResult | undefined;
    registry: TimelineRegistry | undefined;
}

export async function runCampaignTimelineOperation(
    userDataDir: string,
    gameData: GameDataLike,
    source: SourceKind,
    eventKey: string,
    nextEpoch: number | undefined,
    scopeVar: string,
    identity: CampaignPlayerIdentity
): Promise<CampaignTimelineOperationResult> {
    return withTimelineLock(
        userDataDir,
        { campaignId: identity.campaignId, playerId: identity.playerId },
        async () => {
            const persistence = new FsTimelinePersistence(userDataDir);
            // §2 mid-game enablement: when the campaign-scoped store is
            // missing AND legacy player-only data exists for this playerId,
            // auto-trigger staging migration (ExactCandidate check). The
            // observed state is built from the snapshot the App just saw,
            // so the §8.3 strict candidate check can prove the legacy
            // registry describes the same checkpoint branch.
            const observedContext = buildContextFromGameData(gameData);
            const observedState = observedStateFromContext(observedContext);
            const migrationResult = loadCampaignStoreWithMigration(userDataDir, identity, {
                observedState
            });
            const loadResult = migrationResult.loadResult;
            let registry: TimelineRegistry;
            if (loadResult.status === 'found') {
                registry = loadResult.store;
            } else if (loadResult.status === 'missing') {
                // Fresh namespace for a new campaign/player. Empty registry;
                // saveStoreWithIdentity will create the envelope on first write.
                registry = new TimelineRegistry(identity.playerId);
            } else {
                // corrupt: fail closed. The caller's error handler reports.
                throw new TimelineRegistryCorruptError(
                    loadResult.filePath,
                    'campaign registry corrupt on business-entry load',
                    loadResult.quarantinePath,
                    loadResult.errors
                );
            }
            const parentContext = resolveTimelineContext(registry, observedContext);
            const timeline = createChildNodeAndScript(
                registry,
                parentContext,
                source,
                eventKey,
                nextEpoch,
                scopeVar
            );
            persistence.saveStoreWithIdentity(identity, registry);
            return { timeline, registry };
        }
    );
}

/**
 * Batched battle-report write: each battle produces a child node under the
 * resolved snapshot context; when multiple battles share the same snapshot
 * key, the second and subsequent battles chain off the previous battle's
 * context (chainedContext) so that `battle:b` is parented to `battle:a`
 * rather than re-parenting to the snapshot root.
 *
 * Per P4.3 §2: the campaign store load runs through
 * `loadCampaignStoreWithMigration`, mirroring `runCampaignTimelineOperation`.
 * The observed state for the ExactCandidate check is built from the FIRST
 * battle's snapshot context (via `observedStateFromContext`) - this is the
 * battle's own checkpoint, not the App's current GameData snapshot, because
 * battles carry their own save-point evidence (§battle-checkpoint contract).
 * If the first battle's context has no checkpoint evidence (epoch-only or
 * legacy), no observed state is forwarded and migration will only fire on
 * playerId match without strict proof.
 *
 * Per §4.2: the legacy player-only saveRegistry path is NOT used. Per §9:
 * if the identity is missing (legacy Mod), the caller fails closed before
 * reaching this function.
 */
export interface BattleBatchEntry {
    eventKey: string;
    context: TimelineContext;
    nextEpoch: number | undefined;
}

export interface BattleBatchResult {
    timelines: Map<string, CreateChildNodeResult>;
}

export async function runBattleTimelineBatch(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    entries: BattleBatchEntry[]
): Promise<BattleBatchResult> {
    return withTimelineLock(
        userDataDir,
        { campaignId: identity.campaignId, playerId: identity.playerId },
        async () => {
            const persistence = new FsTimelinePersistence(userDataDir);
            // §2 mid-game enablement: route the load through the
            // migration-aware path. The observed state is built from the
            // first battle's snapshot context so the ExactCandidate check
            // can prove the legacy registry describes the same checkpoint
            // branch the battle reports.
            const firstContext = entries[0]?.context ?? { playerId: identity.playerId };
            const observedState = observedStateFromContext(firstContext);
            const migrationResult = loadCampaignStoreWithMigration(userDataDir, identity, {
                observedState
            });
            const loadResult = migrationResult.loadResult;
            let registry: TimelineRegistry;
            if (loadResult.status === 'found') {
                registry = loadResult.store;
            } else if (loadResult.status === 'missing') {
                registry = new TimelineRegistry(identity.playerId);
            } else {
                throw new TimelineRegistryCorruptError(
                    loadResult.filePath,
                    'campaign registry corrupt on battle-report load',
                    loadResult.quarantinePath,
                    loadResult.errors
                );
            }
            let previousSnapshotKey: string | undefined;
            let chainedContext: TimelineContext | undefined;
            const timelines = new Map<string, CreateChildNodeResult>();
            for (const entry of entries) {
                const snapshotContext = resolveTimelineContext(registry, entry.context);
                const snapshotKey = [
                    snapshotContext.timelineNodeId ?? '',
                    snapshotContext.checkpointEpoch ?? '',
                    snapshotContext.checkpointToken ?? '',
                    snapshotContext.pendingCheckpointToken ?? ''
                ].join('\u001f');
                const parentContext = previousSnapshotKey === snapshotKey && chainedContext
                    ? chainedContext
                    : snapshotContext;
                const nextEpoch = previousSnapshotKey === snapshotKey
                    && parentContext.checkpointEpoch !== undefined
                    ? Math.max(entry.nextEpoch ?? parentContext.checkpointEpoch + 1, parentContext.checkpointEpoch + 1)
                    : entry.nextEpoch;
                const timeline = createChildNodeAndScript(
                    registry,
                    parentContext,
                    'battle',
                    entry.eventKey,
                    nextEpoch,
                    'votc_battle_report_player'
                );
                timelines.set(entry.eventKey, timeline);
                previousSnapshotKey = snapshotKey;
                chainedContext = timeline.context;
            }
            persistence.saveStoreWithIdentity(identity, registry);
            return { timelines };
        }
    );
}

export { stageCampaignMigration };
export type { MigrationStageOptions, MigrationStageResult };
