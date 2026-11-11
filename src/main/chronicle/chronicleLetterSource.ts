import path from 'path';
import type { GameData } from '../../shared/gameData/GameData.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { CreateChildNodeResult } from '../timelineManager.js';
import type { Letter } from '../letter/letterInterfaces.js';
import { buildLetterHistoryRecord, isSameOutgoingLetterDelivery } from '../letter/letterHistoryRecord.js';
import { letterHistoryDir } from '../campaignDataPaths.js';
import { updateJsonArrayAtomic } from '../history/historyAtomicJson.js';

/** Preserve the upstream letter UI history and add its campaign-scoped source. */
export async function saveChronicleLetterSource(input: {
    userDataDir: string;
    gameData: GameData;
    identity: CampaignPlayerIdentity;
    timeline: CreateChildNodeResult;
    original: Letter;
    reply: string;
}): Promise<void> {
    const { gameData, identity, timeline, original } = input;
    if (!gameData.gameDate) throw new Error('Chronicle letter source requires a game date');
    const player = gameData.characters.get(gameData.playerID);
    const ai = gameData.characters.get(gameData.aiID);
    const sourceRecordId = `letter_reply:${original.id}:${original.totalDays}:${timeline.nodeId}`;
    const record = buildLetterHistoryRecord({
        letterId: original.id, deliveryId: original.totalDays,
        playerLetter: original.content, aiReply: input.reply,
        checkpointEpoch: timeline.context.checkpointEpoch ?? gameData.votcCheckpointEpoch,
        timeline, identity, sourceRecordId, gameDate: gameData.gameDate,
        senderId: String(gameData.playerID), receiverId: String(gameData.aiID),
        playerName: player?.shortName ?? 'Player', aiName: ai?.shortName ?? 'Recipient',
        senderCharacter: player ?? null, receiverCharacter: ai ?? null
    });
    const file = path.join(letterHistoryDir(input.userDataDir, identity), `character_${gameData.aiID}.json`);
    await updateJsonArrayAtomic<unknown>(file, value => {
        if (!Array.isArray(value)) throw new Error('Chronicle letter history is not an array');
        return value;
    }, records => records.some(item => isSameOutgoingLetterDelivery(item, record)) ? records : [...records, record]);
}
