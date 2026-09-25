import { app, ipcMain } from 'electron';
import fs from 'fs';
import {
    buildTimelineContextFromParts,
    loadRegistryForContext,
    resolveTimelineContext,
    TimelineRegistry,
    TimelineRegistryCorruptError,
    type TimelineContext
} from '../timelineManager.js';
import type { TimelineWindowContext } from '../managerClipboardPayload.js';
import { requireCampaignIdentity } from '../campaignIdentityResolver.js';
import { loadCampaignStoreWithMigration, observedStateFromContext } from '../campaignBusiness.js';
import { reportCorruptTimelineRegistry } from '../timelineRegistryRecovery.js';
import { scanDeliverySnapshotEvidence } from '../campaignLoadObserver.js';
import {
    parseCampaignLoadedLine,
    parseTimelineCheckpointSetLine,
    parseLog,
    readLastLogLineContaining
} from '../../shared/gameData/parseLog.js';
import { TIMELINE_PROTOCOL_SCHEMA } from '../../shared/gameData/timelineProtocol.js';
import {
    archiveFutureArchiveHistoryForPlayer,
    getConversationHistoryFiles,
    getArchiveHistoryEntries,
    parseConversationHistoryIdsFromLog,
    readConversationHistoryFile
} from '../conversationHistory.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';

export interface TimelineIpcDeps {
    /** Window context captured when the history window was opened (v2 mod payloads). */
    getWindowContext(): TimelineWindowContext | undefined;
    /** debug.log path for the legacy (pre-payload) conversation-history lookup. */
    getDebugLogPath(): string;
    /** Closes the conversation history window ('close-conversation-history'). */
    onCloseRequested(): void;
}

/** Set once registerTimelineIpc has wired the channels; guards double registration. */
let timelineIpcRegistered = false;

// The legacy (no manager payload) flow derives a window context from the
// latest trusted log state once, then reuses it for every history channel of
// this window so ids/files/read/archive all resolve the same registry. The
// cache is keyed by log path + player and invalidated when the log changes
// (size/mtime) — a save load or a new conversation re-derives on next call.
let legacyContextCache:
    | {logPath: string; playerId: string; size: number; mtimeMs: number; context: TimelineWindowContext | undefined}
    | undefined;

/** Test seam: drop the derived legacy window context. */
export function _private_resetLegacyWindowContext(): void {
    legacyContextCache = undefined;
}

async function deriveLegacyWindowContext(logPath: string): Promise<TimelineWindowContext | undefined> {
    const evidence = scanDeliverySnapshotEvidence(logPath);
    if (evidence.source === 'none' || evidence.source === 'observed') {
        // Nothing fresher than the observer's memory to trust; keep the
        // legacy player-only behavior.
        return undefined;
    }
    if (evidence.source === 'load' && !evidence.campaignId) {
        // A fresher load line that failed to parse must not fall back to the
        // stale init block's campaign identity — fail closed.
        return undefined;
    }

    const buildFromLoadLine = async (): Promise<TimelineWindowContext | undefined> => {
        const loadLine = await readLastLogLineContaining(logPath, 'VOTC:CAMPAIGN/;/loaded/;/');
        const parsedLoad = loadLine ? parseCampaignLoadedLine(loadLine) : undefined;
        if (!parsedLoad) return undefined;
        return {
            playerId: parsedLoad.playerId,
            checkpointEpoch: parsedLoad.checkpointEpoch,
            timelineNodeA: parsedLoad.nodeA,
            timelineNodeB: parsedLoad.nodeB,
            protocol: {
                protocolSchema: TIMELINE_PROTOCOL_SCHEMA,
                campaignSchema: parsedLoad.campaignSchema,
                campaignIdA: parsedLoad.campaignParts.a,
                campaignIdB: parsedLoad.campaignParts.b,
                campaignIdC: parsedLoad.campaignParts.c,
                campaignIdD: parsedLoad.campaignParts.d,
                campaignBootstrapKind: parsedLoad.bootstrapKind ?? 0,
                playerTimelineSchema: 0
            }
        };
    };

    const buildFromInit = async (): Promise<TimelineWindowContext | undefined> => {
        const gameData = await parseLog(logPath);
        const snapshotResult = gameData?.timelineSnapshotResult;
        if (gameData && snapshotResult?.status === 'valid') {
            const snapshot = snapshotResult.snapshot;
            return {
                playerId: String(gameData.playerID),
                checkpointEpoch: snapshot.epoch,
                timelineNodeA: snapshot.nodeA,
                timelineNodeB: snapshot.nodeB,
                timelineParentA: snapshot.parentA,
                timelineParentB: snapshot.parentB,
                checkpointToken: snapshot.checkpointToken,
                pendingCheckpointToken: snapshot.pendingCheckpointToken,
                protocol: snapshot.protocol
            };
        }
        return undefined;
    };

    let context: TimelineWindowContext | undefined;
    if (evidence.campaignId) {
        // A load line outranks the init block (whether or not a checkpoint
        // receipt came after both): it owns the campaign identity, and the
        // loaded save's own node/epoch replace the stale init values.
        context = await buildFromLoadLine();
    } else {
        // Init-freshest (optionally with a fresher checkpoint receipt): the
        // init snapshot anchors the campaign.
        context = await buildFromInit();
    }
    if (!context) return undefined;

    if (evidence.source === 'checkpoint') {
        // The receipt reports the save's state AFTER the newest transition
        // the game applied, so its node/epoch/player override whatever the
        // older evidence carried.
        const checkpointLine = await readLastLogLineContaining(logPath, 'VOTC:CHECKPOINT/;/set/;/');
        const parsedCheckpoint = checkpointLine ? parseTimelineCheckpointSetLine(checkpointLine) : undefined;
        if (parsedCheckpoint) {
            context = {
                ...context,
                playerId: parsedCheckpoint.playerId,
                checkpointEpoch: parsedCheckpoint.checkpointEpoch ?? context.checkpointEpoch,
                timelineNodeA: parsedCheckpoint.nodeA ?? context.timelineNodeA,
                timelineNodeB: parsedCheckpoint.nodeB ?? context.timelineNodeB,
                timelineParentA: parsedCheckpoint.parentA ?? context.timelineParentA,
                timelineParentB: parsedCheckpoint.parentB ?? context.timelineParentB
            };
        }
    }

    return context;
}

async function legacyWindowContext(logPath: string, playerId: string): Promise<TimelineWindowContext | undefined> {
    try {
        const stat = fs.statSync(logPath);
        const cached = legacyContextCache;
        if (cached && cached.logPath === logPath && cached.playerId === playerId
            && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
            return cached.context;
        }
        const context = await deriveLegacyWindowContext(logPath);
        legacyContextCache = {logPath, playerId, size: stat.size, mtimeMs: stat.mtimeMs, context};
        return context;
    } catch (error) {
        console.warn('[timeline] Could not derive a window context from the game log; keeping the legacy player-only lookup.', error);
        return undefined;
    }
}

// The node committed last into a registry: every checkpoint bump commits a
// node, so the newest commit is the best remaining estimate of the current
// branch when the log evidence carries no node at all (same last resort
// LetterManager uses for delivery validation).
function newestRegistryNodeId(registry: TimelineRegistry): string | undefined {
    let headNodeId: string | undefined;
    let headCreatedAt = '';
    for (const [nodeId, node] of registry.getNodeEntries()) {
        const createdAt = typeof node?.createdAt === 'string' ? node.createdAt : '';
        if (createdAt > headCreatedAt || (createdAt === headCreatedAt && headNodeId !== undefined && nodeId > headNodeId)) {
            headCreatedAt = createdAt;
            headNodeId = nodeId;
        }
    }
    return headNodeId;
}

/**
 * Mirrors 1.x main.resolveTimelineWindowRequest (main.ts:629): builds a
 * TimelineContext from an optional manager window context plus explicit
 * playerId/checkpointEpoch, and loads the matching registry. When the window
 * context carries a v2 protocol tail, the registry load goes through the
 * campaign-scoped path (requireCampaignIdentity + loadCampaignStoreWithMigration,
 * with §8 mid-game staging migration); legacy snapshots fall back to the
 * player-only load (display only; no writes).
 *
 * When no window context exists and `debugLogPath` is provided (legacy mod
 * flow without a manager clipboard payload), an equivalent context is derived
 * from the latest trusted log state and cached, so every channel of one
 * history window resolves the same campaign registry. With no trustworthy
 * log evidence the call keeps the pre-P6 player-only behavior.
 */
export async function resolveTimelineWindowRequest(
    windowContext: TimelineWindowContext | undefined,
    playerId: string,
    checkpointEpoch?: number,
    debugLogPath?: string
): Promise<{ context: TimelineContext; registry: TimelineRegistry; identity?: CampaignPlayerIdentity }> {
    let source = windowContext?.playerId === playerId ? windowContext : undefined;
    let derivedFromLog = false;
    if (!source && debugLogPath) {
        const derived = await legacyWindowContext(debugLogPath, playerId);
        if (derived && derived.playerId === playerId) {
            source = derived;
            derivedFromLog = true;
        }
    }
    const context = buildTimelineContextFromParts(
        playerId,
        source?.timelineNodeA,
        source?.timelineNodeB,
        source?.timelineParentA,
        source?.timelineParentB,
        checkpointEpoch ?? source?.checkpointEpoch,
        source?.checkpointToken,
        source?.pendingCheckpointToken
    );
    let registry: TimelineRegistry;
    let identity: CampaignPlayerIdentity | undefined;
    try {
        if (source?.protocol) {
            identity = requireCampaignIdentity({
                playerID: Number(playerId),
                timelineSnapshotResult: {
                    status: 'valid',
                    snapshot: {
                        playerId,
                        source: 'manager',
                        epoch: checkpointEpoch ?? source?.checkpointEpoch,
                        nodeA: source?.timelineNodeA,
                        nodeB: source?.timelineNodeB,
                        parentA: source?.timelineParentA,
                        parentB: source?.timelineParentB,
                        checkpointToken: source?.checkpointToken,
                        pendingCheckpointToken: source?.pendingCheckpointToken,
                        protocol: source.protocol
                    }
                }
            });
            // §2 mid-game enablement: when the campaign-scoped store is
            // missing AND legacy player-only data exists for this playerId,
            // auto-trigger staging migration (ExactCandidate check). The
            // observed state is built from the window context's snapshot
            // so the §8.3 strict candidate check can prove the legacy
            // registry describes the same checkpoint branch.
            const observedState = observedStateFromContext(context);
            const migrationResult = loadCampaignStoreWithMigration(
                app.getPath('userData'),
                identity,
                { observedState }
            );
            const loadResult = migrationResult.loadResult;
            if (loadResult.status === 'found') {
                registry = loadResult.store;
            } else if (loadResult.status === 'missing') {
                registry = new TimelineRegistry(playerId);
            } else {
                throw new TimelineRegistryCorruptError(
                    loadResult.filePath,
                    'campaign registry corrupt on window-context load',
                    loadResult.quarantinePath,
                    loadResult.errors
                );
            }
        } else {
            registry = loadRegistryForContext(app.getPath('userData'), context);
        }
        const resolvedContext = resolveTimelineContext(registry, context);
        if (derivedFromLog && identity && resolvedContext.timelineNodeId === undefined) {
            // The log evidence carried no node (the save has not applied a
            // checkpoint transition since the reported init/load state). The
            // campaign registry's newest committed node is the best remaining
            // estimate of the visible branch — without it every node-tagged
            // transcript would be filtered out of this window.
            const headNodeId = newestRegistryNodeId(registry);
            if (headNodeId) {
                return {context: {...resolvedContext, timelineNodeId: headNodeId}, registry, identity};
            }
        }
        return { context: resolvedContext, registry, identity };
    } catch (error) {
        if (error instanceof TimelineRegistryCorruptError) {
            reportCorruptTimelineRegistry(error);
        }
        throw error;
    }
}

/**
 * Registers the five timeline/history IPC channels previously registered
 * inline in main.ts, upgraded to the 1.x channel bodies (1.x main.ts:5452).
 * Must be called once during app startup.
 */
export function registerTimelineIpc(deps: TimelineIpcDeps): void {
    if (timelineIpcRegistered) {
        throw new Error('registerTimelineIpc called twice');
    }
    timelineIpcRegistered = true;

    ipcMain.handle('get-conversation-history-ids', async () => {
        console.log('IPC: Received get-conversation-history-ids event.');
        const windowContext = deps.getWindowContext();
        if (!windowContext) {
            // Legacy mod flow: no manager clipboard payload was captured, so
            // keep the pre-P6 behavior of parsing playerId/epoch out of the
            // VOTC:conversation_history line in debug.log.
            try {
                return await parseConversationHistoryIdsFromLog(deps.getDebugLogPath());
            } catch (error) {
                console.error('Error parsing conversation history IDs:', error);
                // Same failure shape as the v2 path below: the renderer only
                // checks `!context.playerId`, which treats '' and null alike.
                return { playerId: null };
            }
        }
        try {
            const { context, identity } = await resolveTimelineWindowRequest(
                windowContext,
                windowContext.playerId,
                windowContext.checkpointEpoch,
                deps.getDebugLogPath()
            );

            if (context.checkpointEpoch !== undefined) {
                const archivedCount = await archiveFutureArchiveHistoryForPlayer(
                    context.playerId,
                    context.checkpointEpoch,
                    'archive_viewer_checkpoint_filter',
                    identity
                );
                if (archivedCount > 0) {
                    console.log(`Archived ${archivedCount} future letter or battle history records for checkpoint ${context.checkpointEpoch}.`);
                }
            }
            return { ...windowContext, ...context };
        } catch (error) {
            console.error('Error getting conversation history IDs:', error);
            return { playerId: null };
        }
    });

    // Trust boundary: playerId/filename/checkpointEpoch below arrive raw from
    // the history-window renderer over IPC; they are treated as untrusted and
    // validated downstream (resolveTimelineWindowRequest / conversationHistory).
    ipcMain.handle('get-conversation-history-files', async (event: Electron.IpcMainInvokeEvent, playerId: string, checkpointEpoch: number | undefined) => {
        console.log(`IPC: Received get-conversation-history-files event for player: ${playerId}`);
        try {
            const { context, registry, identity } = await resolveTimelineWindowRequest(deps.getWindowContext(), playerId, checkpointEpoch, deps.getDebugLogPath());
            const files = await getConversationHistoryFiles(playerId, checkpointEpoch, registry, context.timelineNodeId, identity);
            return files;
        } catch (error) {
            console.error('Error getting conversation history files:', error);
            return [];
        }
    });

    ipcMain.handle('read-conversation-history-file', async (event: Electron.IpcMainInvokeEvent, playerId: string, filename: string, checkpointEpoch: number | undefined) => {
        console.log(`IPC: Received read-conversation-history-file event for player: ${playerId}, file: ${filename}`);
        try {
            const { context, registry, identity } = await resolveTimelineWindowRequest(deps.getWindowContext(), playerId, checkpointEpoch, deps.getDebugLogPath());
            const content = await readConversationHistoryFile(playerId, filename, checkpointEpoch, registry, context.timelineNodeId, identity);
            return content;
        } catch (error) {
            console.error('Error reading conversation history file:', error);
            return '';
        }
    });

    ipcMain.handle('get-archive-history-entries', async (event: Electron.IpcMainInvokeEvent, playerId: string, checkpointEpoch: number | undefined, type: 'letter' | 'battle' | undefined) => {
        try {
            const { context, registry, identity } = await resolveTimelineWindowRequest(deps.getWindowContext(), playerId, checkpointEpoch, deps.getDebugLogPath());
            if (type === 'letter' || type === 'battle') {
                return await getArchiveHistoryEntries(playerId, checkpointEpoch, type, registry, context.timelineNodeId, identity);
            }
            return [];
        } catch (error) {
            console.error(`Error reading ${type} archive history for player ${playerId}:`, error);
            return [];
        }
    });

    ipcMain.on('close-conversation-history', () => {
        console.log('IPC: Received close-conversation-history event.');
        deps.onCloseRequested();
    });
}
