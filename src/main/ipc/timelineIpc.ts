import { app, ipcMain } from 'electron';
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

/**
 * Mirrors 1.x main.resolveTimelineWindowRequest (main.ts:629): builds a
 * TimelineContext from an optional manager window context plus explicit
 * playerId/checkpointEpoch, and loads the matching registry. When the window
 * context carries a v2 protocol tail, the registry load goes through the
 * campaign-scoped path (requireCampaignIdentity + loadCampaignStoreWithMigration,
 * with §8 mid-game staging migration); legacy snapshots fall back to the
 * player-only load (display only; no writes).
 */
export function resolveTimelineWindowRequest(
    windowContext: TimelineWindowContext | undefined,
    playerId: string,
    checkpointEpoch?: number
): { context: TimelineContext; registry: TimelineRegistry; identity?: CampaignPlayerIdentity } {
    const source = windowContext?.playerId === playerId ? windowContext : undefined;
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
        return { context: resolveTimelineContext(registry, context), registry, identity };
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
            const { context, identity } = resolveTimelineWindowRequest(
                windowContext,
                windowContext.playerId,
                windowContext.checkpointEpoch
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
            const { context, registry, identity } = resolveTimelineWindowRequest(deps.getWindowContext(), playerId, checkpointEpoch);
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
            const { context, registry, identity } = resolveTimelineWindowRequest(deps.getWindowContext(), playerId, checkpointEpoch);
            const content = await readConversationHistoryFile(playerId, filename, checkpointEpoch, registry, context.timelineNodeId, identity);
            return content;
        } catch (error) {
            console.error('Error reading conversation history file:', error);
            return '';
        }
    });

    ipcMain.handle('get-archive-history-entries', async (event: Electron.IpcMainInvokeEvent, playerId: string, checkpointEpoch: number | undefined, type: 'letter' | 'battle' | undefined) => {
        try {
            const { context, registry, identity } = resolveTimelineWindowRequest(deps.getWindowContext(), playerId, checkpointEpoch);
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
