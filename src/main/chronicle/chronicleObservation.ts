import type { GameData, Memory, MemoryTypeTokenSource } from '../../shared/gameData/GameData.js';
import type { Character } from '../../shared/gameData/Character.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import {
    requireCampaignIdentity,
    CampaignIdentityUnavailableError
} from '../campaignIdentityResolver.js';
import {
    buildContextFromGameData,
    resolveTimelineContext,
    FsTimelinePersistence,
    type TimelineRegistry
} from '../timelineManager.js';
import { ChronicleMemoryStore } from './ChronicleMemoryStore.js';
import { ChronicleStoreError } from './chronicleAtomicJson.js';
import type {
    ChronicleMemoryObservationInput,
    ChronicleMemoryObservationResult
} from './chronicleTypes.js';

export type ChronicleObservationSource =
    | 'conversation'
    | 'letter'
    | 'incoming_letter'
    | 'battle_report';

export interface ChronicleObservationNoOpResult {
    recordCount: 0;
    createdCount: 0;
    observedCount: 0;
    ambiguousCount: 0;
    skipped: true;
    reason: 'legacy-mod' | 'unsupported-schema' | 'invalid';
}

/**
 * Unified chronicle observation entry point for parsed GameData.
 *
 * Called after `parseLog` completes successfully and before the downstream
 * business generator (Conversation / LetterReply / IncomingLetter /
 * BattleReport) runs.
 *
 * Behavior:
 *  - legacy-mod (no v2 campaign identity) -> return a no-op result without
 *    throwing. This is the compat boundary.
 *  - valid identity -> build timeline context, load registry (best-effort;
 *    if the registry is missing/corrupt we still observe without branch
 *    visibility filtering), filter memories by identityComplete, write-through.
 *  - ChronicleStoreError propagates to the caller so it can mark health.
 */
export async function observeParsedGameDataForChronicle(
    userDataDir: string,
    gameData: GameData,
    source: ChronicleObservationSource,
    language?: string
): Promise<ChronicleMemoryObservationResult | ChronicleObservationNoOpResult> {
    let identity: CampaignPlayerIdentity;
    try {
        identity = requireCampaignIdentity({
            playerID: gameData.playerID,
            timelineSnapshotResult: gameData.timelineSnapshotResult
        });
    } catch (error) {
        if (error instanceof CampaignIdentityUnavailableError) {
            console.debug(`[Chronicle] skipping observation (${source}): ${error.code}, no campaign identity`);
            return {
                recordCount: 0,
                createdCount: 0,
                observedCount: 0,
                ambiguousCount: 0,
                skipped: true,
                reason: error.code
            };
        }
        throw error;
    }

    console.debug(`[Chronicle] observing game_data memories from ${source}: identity=${identity.campaignId}/${identity.playerId}`);

    const { registry, currentNodeId } = loadTimelineForChronicle(userDataDir, gameData, identity);

    const inputs = collectMemoryInputs(gameData, language);

    const store = new ChronicleMemoryStore(userDataDir, identity);
    try {
        return await store.observeGameData(inputs, {
            registry,
            currentNodeId,
            checkpointEpoch: gameData.votcCheckpointEpoch
        });
    } catch (error) {
        if (error instanceof ChronicleStoreError) {
            console.debug(`[Chronicle] store observe failed from ${source}: code=${error.code}`);
        }
        throw error;
    }
}

/**
 * Build and resolve the timeline context for chronicle branch visibility.
 * Registry load is best-effort: if the registry is missing or corrupt,
 * chronicle can still observe (without branch visibility filtering).
 */
function loadTimelineForChronicle(
    userDataDir: string,
    gameData: GameData,
    identity: CampaignPlayerIdentity
): { registry: TimelineRegistry | undefined; currentNodeId: string | undefined } {
    const persistence = new FsTimelinePersistence(userDataDir);
    try {
        const result = persistence.loadStoreWithIdentity(identity);
        if (result.status !== 'found') {
            return { registry: undefined, currentNodeId: undefined };
        }
        const registry = result.store;
        const context = resolveTimelineContext(registry, buildContextFromGameData(gameData));
        return {
            registry,
            currentNodeId: context.timelineNodeId
        };
    } catch {
        return { registry: undefined, currentNodeId: undefined };
    }
}

function collectMemoryInputs(
    gameData: GameData,
    language?: string
): ChronicleMemoryObservationInput[] {
    const inputs: ChronicleMemoryObservationInput[] = [];
    const observedAt = new Date().toISOString();
    const observedGameDate = gameData.gameDate;
    const votcCheckpointEpoch = gameData.votcCheckpointEpoch;
    const votcTimelineNodeId = buildTimelineNodeId(
        gameData.votcTimelineNodeA,
        gameData.votcTimelineNodeB
    );
    const votcTimelineParentId = buildTimelineNodeId(
        gameData.votcTimelineParentA,
        gameData.votcTimelineParentB
    );

    for (const character of gameData.characters.values()) {
        for (const memory of character.memories) {
            if (!memory.identityComplete) continue;
            inputs.push(memoryToInput(
                character,
                memory,
                observedAt,
                observedGameDate,
                votcCheckpointEpoch,
                votcTimelineNodeId,
                votcTimelineParentId,
                language
            ));
        }
    }

    return inputs;
}

function memoryToInput(
    character: Character,
    memory: Memory,
    observedAt: string,
    observedGameDate: Ck3GameDate | undefined,
    votcCheckpointEpoch: number,
    votcTimelineNodeId: string | undefined,
    votcTimelineParentId: string | undefined,
    language?: string
): ChronicleMemoryObservationInput {
    const tokenSource: MemoryTypeTokenSource = memory.memoryTypeTokenSource ?? 'localized_name';
    const token = memory.memoryTypeToken ?? memory.type;
    return {
        ownerId: String(character.id),
        ownerName: character.shortName || character.fullName,
        memoryTypeToken: token,
        memoryTypeTokenSource: tokenSource,
        memoryName: token,
        description: memory.desc,
        creationDate: memory.creationGameDate,
        creationDateDisplay: memory.creationDate,
        relevanceWeight: memory.relevanceWeight,
        // 2CE's Memory type declares participantIds optional (1.x required);
        // an empty participant set keeps the identity anchor well-defined.
        participantIds: (memory.participantIds ?? []).map(String),
        snapshotOrdinal: memory.snapshotOrdinal,
        observedGameDate,
        observationSource: 'game_data',
        observedAt,
        votcCheckpointEpoch,
        votcTimelineNodeId,
        votcTimelineParentId,
        captureLanguage: language
    };
}

function buildTimelineNodeId(a: number | undefined, b: number | undefined): string | undefined {
    if (a === undefined || b === undefined || a <= 0 || b <= 0) return undefined;
    return `${a}-${b}`;
}
