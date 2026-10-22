import { app } from 'electron';
import { GameData } from '../../shared/gameData/GameData';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import {
    FsTimelinePersistence,
    TimelineRegistry,
    resolveTimelineContext,
    buildContextFromGameData
} from '../timelineManager.js';
import { requireCampaignIdentity } from '../campaignIdentityResolver.js';

export interface SummaryTimelineContext {
    registry: TimelineRegistry | undefined;
    currentNodeId: string | undefined;
    identity?: CampaignPlayerIdentity;
}

/**
 * Shared summary-timeline resolver (M4/M7 of the VOTC-194 merge plan): loads
 * the timeline registry (campaign-scoped when the snapshot carries a v2
 * identity, player-only legacy fallback otherwise) and resolves the current
 * node, so summary reads filter node-tagged records by branch and summary
 * saves merge instead of overwriting hidden sibling-branch records.
 *
 * Extracted verbatim from IncomingLetterGenerator.getSummaryTimeline so
 * LetterReplyGenerator's letter summaries resolve the exact same context.
 */
export function resolveSummaryTimelineContext(gameData: GameData): SummaryTimelineContext {
    const persistence = new FsTimelinePersistence(app.getPath('userData'));
    let registry: TimelineRegistry | undefined;
    let identity: CampaignPlayerIdentity | undefined;
    try {
        identity = requireCampaignIdentity({
            playerID: gameData.playerID,
            timelineSnapshotResult: gameData.timelineSnapshotResult
        });
        const result = persistence.loadStoreWithIdentity(identity);
        registry = result.status === 'found' ? result.store : undefined;
    } catch {
        // Legacy snapshot: fall back to player-only display load.
        identity = undefined;
        registry = persistence.loadRegistry(String(gameData.playerID)) ?? undefined;
    }
    const context = registry
        ? resolveTimelineContext(registry, buildContextFromGameData(gameData))
        : buildContextFromGameData(gameData);
    return {
        registry,
        currentNodeId: context.timelineNodeId,
        identity
    };
}