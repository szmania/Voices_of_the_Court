import { app, ipcMain } from 'electron';
import path from 'path';
import type { Tiktoken } from 'js-tiktoken';
import type { Config } from '../../shared/Config.js';
import type { ClipboardListener } from '../ClipboardListener.js';
import { ChronicleWindow } from '../windows/ChronicleWindow.js';
import { ChronicleCoordinator, type ChronicleCoordinatorConfig, type ChronicleSignal } from '../chronicle/ChronicleCoordinator.js';
import { ChronicleStore } from '../chronicle/ChronicleStore.js';
import { ChronicleMemoryStore } from '../chronicle/ChronicleMemoryStore.js';
import { waitForChronicleMemoryBlock, blockRecordToObservationInputs, type ChronicleMemoryBlockRecord } from '../chronicle/ChronicleMemoryBlockParser.js';
import { parseChronicleClipboardPayload, gameDateFromChroniclePayload, type ChronicleClipboardPayload } from '../chronicle/chronicleClipboardPayload.js';
import { requireCampaignIdentity } from '../campaignIdentityResolver.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { TimelineWindowContext } from '../managerClipboardPayload.js';
import { buildTimelineContextFromParts, resolveTimelineContext, type TimelineRegistry } from '../timelineManager.js';
import { loadCampaignStoreWithMigration, observedStateFromContext } from '../campaignBusiness.js';
import { resolveTimelineWindowRequest } from './timelineIpc.js';

export function registerChronicleHandlers(deps: {
    getConfig(): Config;
    clipboardListener: ClipboardListener;
    encoder: Tiktoken | null;
    getTheme(): string;
}) {
    let chronicleWindow: ChronicleWindow | undefined;
    let chronicleWindowContext: TimelineWindowContext | undefined;
    let chronicleWindowPayload: ChronicleClipboardPayload | undefined;
    let managerRequest = 0;
    const chronicleCoordinator = new ChronicleCoordinator(app.getPath('userData'), () => buildChronicleCoordinatorConfig(deps.getConfig()), undefined, undefined, deps.encoder);

    function buildChronicleCoordinatorConfig(cfg: Config): ChronicleCoordinatorConfig {
        return {
            frequency: cfg.chronicleFrequency || 'yearly',
            rawSourceCharLimit: cfg.chronicleRawSourceCharLimit || 30000,
            outputMaxTokens: cfg.chronicleOutputMaxTokens || 1000,
            chroniclePrompt: cfg.chroniclePrompt || '',
            summarizationUseTextGenApi: cfg.summarizationUseTextGenApi,
            textGenerationApiConnectionConfig: cfg.textGenerationApiConnectionConfig,
            summarizationApiConnectionConfig: cfg.summarizationApiConnectionConfig,
            language: cfg.language || '',
            dumpPrompts: false
        };
    }

    function resolveChronicleIdentity(payload: ChronicleClipboardPayload): CampaignPlayerIdentity {
        return requireCampaignIdentity({
            playerID: Number(payload.playerId),
            timelineSnapshotResult: {
                status: 'valid',
                snapshot: {
                    playerId: payload.playerId,
                    source: 'manager',
                    epoch: payload.checkpointEpoch,
                    nodeA: payload.timelineNodeA,
                    nodeB: payload.timelineNodeB,
                    parentA: payload.timelineParentA,
                    parentB: payload.timelineParentB,
                    checkpointToken: payload.checkpointToken,
                    pendingCheckpointToken: payload.pendingCheckpointToken,
                    protocol: payload.protocol
                }
            }
        });
    }

    function resolveChronicleTimeline(payload: ChronicleClipboardPayload, identity: CampaignPlayerIdentity) {
        const context = buildTimelineContextFromParts(
            payload.playerId,
            payload.timelineNodeA,
            payload.timelineNodeB,
            payload.timelineParentA,
            payload.timelineParentB,
            payload.checkpointEpoch,
            payload.checkpointToken,
            payload.pendingCheckpointToken
        );

        let registry: TimelineRegistry | undefined;
        try {
            const migrationResult = loadCampaignStoreWithMigration(
                app.getPath('userData'),
                identity,
                { observedState: observedStateFromContext(context) }
            );
            const loadResult = migrationResult.loadResult;
            if (loadResult.status === 'found') {
                registry = loadResult.store;
            }
        } catch (error) {
            console.warn('[Chronicle] Failed to load timeline registry:', error);
        }

        const resolved = registry ? resolveTimelineContext(registry, context) : context;
        return {
            registry,
            currentNodeId: resolved.timelineNodeId,
            checkpointEpoch: payload.checkpointEpoch
        };
    }

    async function flushChronicleMemoryBlock(
        payload: ChronicleClipboardPayload,
        identity: CampaignPlayerIdentity,
        timeline: { registry?: TimelineRegistry; currentNodeId?: string; checkpointEpoch?: number }
    ): Promise<void> {
        const debugLogPath = path.join(deps.getConfig().userFolderPath, 'logs', 'debug.log');
        const memoryResult = await waitForChronicleMemoryBlock(debugLogPath, payload.memoryRequestId, 3000);

        if (memoryResult.status === 'complete') {
            if (memoryResult.playerId !== payload.playerId || memoryResult.currentDateTotalDays !== payload.currentDateTotalDays) {
                throw new Error('Chronicle memory block does not match the requested player/date');
            }
            const block: ChronicleMemoryBlockRecord = {
                requestId: memoryResult.requestId,
                playerId: memoryResult.playerId,
                currentDateTotalDays: memoryResult.currentDateTotalDays,
                memories: memoryResult.memories
            };

            const inputs = blockRecordToObservationInputs(block, {
                observedAt: new Date().toISOString(),
                votcCheckpointEpoch: timeline.checkpointEpoch,
                votcTimelineNodeId: timeline.currentNodeId,
                captureLanguage: deps.getConfig().language || undefined
            });

            const memoryStore = new ChronicleMemoryStore(app.getPath('userData'), identity);
            await memoryStore.observeChronicleSnapshot(inputs, {
                registry: timeline.registry,
                currentNodeId: timeline.currentNodeId,
                checkpointEpoch: timeline.checkpointEpoch
            });

            console.log(`[Chronicle] Flushed ${inputs.length} memories from tick block`);
        } else if (memoryResult.status === 'memory_snapshot_unavailable') {
            console.warn(`[Chronicle] Memory snapshot unavailable for request ${payload.memoryRequestId}`);
        } else {
            console.warn(`[Chronicle] Memory block parse issue: ${memoryResult.status} - ${'reason' in memoryResult ? memoryResult.reason : ''}`);
        }
    }

    function buildChronicleSignal(
        payload: ChronicleClipboardPayload,
        identity: CampaignPlayerIdentity,
        timeline: { registry?: TimelineRegistry; currentNodeId?: string; checkpointEpoch?: number }
    ): ChronicleSignal {
        return {
            kind: payload.signalKind,
            gameDate: gameDateFromChroniclePayload(payload),
            playerId: payload.playerId,
            playerName: payload.playerName || '',
            playerTitle: payload.playerPrimaryTitle || undefined,
            identity,
            timeline
        };
    }

    deps.clipboardListener.on('VOTC:CHRONICLE_TICK', async (payloads?: string[]) => {
        console.log('ClipboardListener: VOTC:CHRONICLE_TICK event detected.');
        try {
            const parseResult = parseChronicleClipboardPayload(payloads);
            if (parseResult.status !== 'valid') {
                console.error('[Chronicle] Invalid tick payload:', parseResult);
                return;
            }
            const payload = parseResult.payload;

            let identity: CampaignPlayerIdentity;
            try {
                identity = resolveChronicleIdentity(payload);
            } catch (error) {
                console.error('[Chronicle] Campaign identity required for tick:', error);
                return;
            }

            const timeline = resolveChronicleTimeline(payload, identity);
            await flushChronicleMemoryBlock(payload, identity, timeline);

            const signal = buildChronicleSignal(payload, identity, timeline);
            const result = await chronicleCoordinator!.handleSignal(signal);

            console.log(`[Chronicle] Tick result: ${result.outcome}`);
            if (result.outcome === 'failed') {
                console.error(`[Chronicle] Tick failed: ${result.errorCode} - ${result.errorMessage}`);
            }
        } catch (error) {
            console.error('[Chronicle] Error processing CHRONICLE_TICK:', error);
        }
    });

    deps.clipboardListener.on('VOTC:CHRONICLE_MANAGER', async (payloads?: string[]) => {
        const request = ++managerRequest;
        console.log('ClipboardListener: VOTC:CHRONICLE_MANAGER event detected.');
        try {
            const parseResult = parseChronicleClipboardPayload(payloads);
            if (parseResult.status !== 'valid') {
                console.error('[Chronicle] Invalid manager payload:', parseResult);
                return;
            }
            const payload = parseResult.payload;

            let identity: CampaignPlayerIdentity;
            try {
                identity = resolveChronicleIdentity(payload);
            } catch (error) {
                console.error('[Chronicle] Campaign identity required for manager:', error);
                return;
            }

            const timeline = resolveChronicleTimeline(payload, identity);
            await flushChronicleMemoryBlock(payload, identity, timeline);

            if (request !== managerRequest) return;

            chronicleWindowContext = {
                playerId: payload.playerId,
                timelineNodeA: payload.timelineNodeA,
                timelineNodeB: payload.timelineNodeB,
                timelineParentA: payload.timelineParentA,
                timelineParentB: payload.timelineParentB,
                checkpointEpoch: payload.checkpointEpoch,
                checkpointToken: payload.checkpointToken,
                pendingCheckpointToken: payload.pendingCheckpointToken,
                protocol: payload.protocol
            };
            chronicleWindowPayload = payload;

            if (!chronicleWindow || chronicleWindow.isDestroyed()) {
                chronicleWindow = new ChronicleWindow();
            }
            chronicleWindow.show();
            console.log('Chronicle window opened.');
        } catch (error) {
            console.error('[Chronicle] Error processing CHRONICLE_MANAGER:', error);
        }
    });

    // Helper functions for chronicle context resolution
    function resolveChronicleIdentityFromContext(context: TimelineWindowContext): CampaignPlayerIdentity | undefined {
        try {
            if (!context.protocol) return undefined;
            return requireCampaignIdentity({
                playerID: Number(context.playerId),
                timelineSnapshotResult: {
                    status: 'valid',
                    snapshot: {
                        playerId: context.playerId,
                        source: 'manager',
                        epoch: context.checkpointEpoch,
                        nodeA: context.timelineNodeA,
                        nodeB: context.timelineNodeB,
                        parentA: context.timelineParentA,
                        parentB: context.timelineParentB,
                        checkpointToken: context.checkpointToken,
                        pendingCheckpointToken: context.pendingCheckpointToken,
                        protocol: context.protocol
                    }
                }
            });
        } catch {
            return undefined;
        }
    }

    function resolveChronicleTimelineFromContext(
        context: TimelineWindowContext,
        identity: CampaignPlayerIdentity
    ): { registry?: TimelineRegistry; currentNodeId?: string; checkpointEpoch?: number } {
        try {
            const timelineContext = buildTimelineContextFromParts(
                context.playerId,
                context.timelineNodeA,
                context.timelineNodeB,
                context.timelineParentA,
                context.timelineParentB,
                context.checkpointEpoch,
                context.checkpointToken,
                context.pendingCheckpointToken
            );

            let registry: TimelineRegistry | undefined;
            const migrationResult = loadCampaignStoreWithMigration(
                app.getPath('userData'),
                identity,
                { observedState: observedStateFromContext(timelineContext) }
            );
            if (migrationResult.loadResult.status === 'found') {
                registry = migrationResult.loadResult.store;
            }

            const resolved = registry ? resolveTimelineContext(registry, timelineContext) : timelineContext;
            return {
                registry,
                currentNodeId: resolved.timelineNodeId,
                checkpointEpoch: context.checkpointEpoch
            };
        } catch {
            return { checkpointEpoch: context.checkpointEpoch };
        }
    }

    ipcMain.handle('get-chronicle-context', async () => {
        console.log('IPC: Received get-chronicle-context event.');
        if (!chronicleWindowContext) {
            return { playerId: null };
        }
        const windowContext = chronicleWindowContext;
        const windowPayload = chronicleWindowPayload;
        try {
            const { context } = await resolveTimelineWindowRequest(
                windowContext,
                windowContext.playerId,
                windowContext.checkpointEpoch
            );
            return {
                ...windowPayload,
                ...windowContext,
                ...context,
                uiTheme: deps.getTheme()
            };
        } catch (error) {
            console.error('Error resolving chronicle context:', error);
            return { playerId: null };
        }
    });

    ipcMain.handle('get-chronicle-entries', async () => {
        console.log('IPC: Received get-chronicle-entries event.');
        try {
            if (!chronicleWindowContext || !chronicleWindowPayload) return [];

            const identity = resolveChronicleIdentityFromContext(chronicleWindowContext);
            if (!identity) return [];

            const store = new ChronicleStore(app.getPath('userData'), identity);
            const { registry, currentNodeId, checkpointEpoch } = resolveChronicleTimelineFromContext(chronicleWindowContext, identity);

            const entries = store.queryVisibleEntries({
                registry,
                currentNodeId,
                checkpointEpoch,
                currentGameDate: gameDateFromChroniclePayload(chronicleWindowPayload),
                includeEmpty: true
            });

            return entries;
        } catch (error) {
            console.error('Error getting chronicle entries:', error);
            return [];
        }
    });

    ipcMain.handle('read-chronicle-entry', async (event, entryId: string) => {
        console.log(`IPC: Received read-chronicle-entry event for: ${entryId}`);
        try {
            if (!chronicleWindowContext || !chronicleWindowPayload) return undefined;

            const identity = resolveChronicleIdentityFromContext(chronicleWindowContext);
            if (!identity) return undefined;

            const store = new ChronicleStore(app.getPath('userData'), identity);
            const { registry, currentNodeId, checkpointEpoch } = resolveChronicleTimelineFromContext(
                chronicleWindowContext,
                identity
            );
            return store.queryVisibleEntries({
                registry,
                currentNodeId,
                checkpointEpoch,
                currentGameDate: gameDateFromChroniclePayload(chronicleWindowPayload),
                includeEmpty: true
            }).find(entry => entry.id === entryId);
        } catch (error) {
            console.error('Error reading chronicle entry:', error);
            return undefined;
        }
    });

    ipcMain.handle('get-chronicle-attempts', async () => {
        console.log('IPC: Received get-chronicle-attempts event.');
        try {
            if (!chronicleWindowContext) return [];

            const identity = resolveChronicleIdentityFromContext(chronicleWindowContext);
            if (!identity) return [];

            const store = new ChronicleStore(app.getPath('userData'), identity);
            return store.queryAttempts();
        } catch (error) {
            console.error('Error getting chronicle attempts:', error);
            return [];
        }
    });

    ipcMain.handle('generate-chronicle-to-current-date', async () => {
        console.log('IPC: Received generate-chronicle-to-current-date event.');
        try {
            if (!chronicleWindowContext || !chronicleWindowPayload) {
                return { outcome: 'failed', errorCode: 'no_context' };
            }

            const identity = resolveChronicleIdentityFromContext(chronicleWindowContext);
            if (!identity) {
                return { outcome: 'failed', errorCode: 'no_identity' };
            }

            const timeline = resolveChronicleTimelineFromContext(chronicleWindowContext, identity);

            const signal: ChronicleSignal = {
                ...buildChronicleSignal(chronicleWindowPayload, identity, timeline),
                kind: 'manual',
            };

            const result = await chronicleCoordinator!.handleSignal(signal);
            console.log(`[Chronicle] Manual generation result: ${result.outcome}`);
            if (result.outcome === 'failed') {
                console.error(`[Chronicle] Manual generation failed: ${result.errorCode} - ${result.errorMessage}`);
            }
            return result;
        } catch (error) {
            console.error('Error generating chronicle:', error);
            return { outcome: 'failed', errorCode: 'generation_error', errorMessage: String(error) };
        }
    });

    ipcMain.handle('retry-chronicle-attempt', async (event, requestKey: string) => {
        console.log(`IPC: Received retry-chronicle-attempt event for: ${requestKey}`);
        try {
            if (!chronicleWindowContext || !chronicleWindowPayload) {
                return { outcome: 'failed', errorCode: 'no_context' };
            }

            const identity = resolveChronicleIdentityFromContext(chronicleWindowContext);
            if (!identity) {
                return { outcome: 'failed', errorCode: 'no_identity' };
            }

            const timeline = resolveChronicleTimelineFromContext(chronicleWindowContext, identity);
            const signal = buildChronicleSignal(chronicleWindowPayload, identity, timeline);
            return await chronicleCoordinator!.retryAttempt(signal, requestKey);
        } catch (error) {
            console.error('Error retrying chronicle attempt:', error);
            return { outcome: 'failed', errorCode: 'retry_error' };
        }
    });

    ipcMain.handle('regenerate-chronicle-entry', async (event, entryId: string) => {
        console.log(`IPC: Received regenerate-chronicle-entry event for: ${entryId}`);
        try {
            if (!chronicleWindowContext || !chronicleWindowPayload) {
                return { outcome: 'failed', errorCode: 'no_context' };
            }
            const identity = resolveChronicleIdentityFromContext(chronicleWindowContext);
            if (!identity) {
                return { outcome: 'failed', errorCode: 'no_identity' };
            }
            const timeline = resolveChronicleTimelineFromContext(chronicleWindowContext, identity);
            const signal = buildChronicleSignal(chronicleWindowPayload, identity, timeline);
            return await chronicleCoordinator!.regenerateEntry(signal, entryId);
        } catch (error) {
            console.error('Error regenerating chronicle entry:', error);
            return { outcome: 'failed', errorCode: 'regeneration_error' };
        }
    });

    ipcMain.on('close-chronicle-window', () => {
        console.log('IPC: Received close-chronicle-window event.');
        if (chronicleWindow && !chronicleWindow.isDestroyed()) {
            chronicleWindow.close();
            console.log('Chronicle window closed.');
        }
    });

    return { getWindow: () => chronicleWindow };
}
