import type { Character } from '../../shared/gameData/Character.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import type { CreateChildNodeResult } from '../timelineManager.js';
import { captureHistoryCharacterSnapshots } from '../history/historyCharacterSnapshots.js';
import type { IncomingLetterHistoryRecordV1 } from '../history/historyRecordTypes.js';

export interface BuildIncomingLetterHistoryRecordInput {
    /** Stable business signature; doubles as the delivery idempotency key. */
    id: string;
    topic: string;
    senderId: string;
    receiverId: string;
    content: string;
    checkpointEpoch: number;
    timeline: CreateChildNodeResult;
    identity: CampaignPlayerIdentity;
    sourceRecordId: string;
    gameDate: Ck3GameDate;
    senderCharacter: Character | null;
    receiverCharacter: Character | null;
}

/**
 * Builder for incoming letter history records (P1 port of the source-line
 * builder). Sender and receiving player are required-full snapshots;
 * `sourceType` keeps the letter TOPIC semantics while the category lives in
 * `chronicleSourceKind`.
 *
 * The source-line file also carries the outgoing-letter builder and its
 * delivery comparator; the upstream letter round-trip has its own history
 * wiring, so P1 ports only the incoming builder.
 */
export function buildIncomingLetterHistoryRecord(
    input: BuildIncomingLetterHistoryRecordInput
): IncomingLetterHistoryRecordV1 {
    if (!input.gameDate) {
        throw new Error('incoming letter history record requires a structured gameDate');
    }
    const capturedAt = new Date().toISOString();
    const characters = captureHistoryCharacterSnapshots([
        {
            characterId: input.senderId,
            displayName: input.senderCharacter?.shortName ?? `character_${input.senderId}`,
            roles: ['letter_sender'],
            character: input.senderCharacter,
            capturedAt,
            capturedGameDate: input.gameDate,
            completeness: 'required_full'
        },
        {
            characterId: input.receiverId,
            displayName: input.receiverCharacter?.shortName ?? `player_${input.receiverId}`,
            roles: ['letter_receiver', 'player'],
            character: input.receiverCharacter,
            capturedAt,
            capturedGameDate: input.gameDate,
            completeness: 'required_full'
        }
    ]);
    const senderSnapshot = characters.find(c => c.characterId === input.senderId);
    const receiverSnapshot = characters.find(c => c.characterId === input.receiverId);
    if (!senderSnapshot || !receiverSnapshot) {
        throw new Error('incoming letter snapshot capture lost the sender or receiver');
    }

    const anchor = {
        campaignId: input.identity.campaignId,
        playerId: input.identity.playerId,
        votcCheckpointEpoch: input.checkpointEpoch,
        votcTimelineNodeId: input.timeline.nodeId,
        ...(input.timeline.parentId ? { votcTimelineParentId: input.timeline.parentId } : {})
    };

    return {
        schemaVersion: 1,
        sourceRecordId: input.sourceRecordId,
        kind: 'incoming_letter',
        createdAt: capturedAt,
        gameDate: input.gameDate,
        displayDate: input.gameDate.display,
        anchor,
        characters,
        votcCheckpointEpoch: anchor.votcCheckpointEpoch,
        votcTimelineNodeId: anchor.votcTimelineNodeId,
        ...(anchor.votcTimelineParentId ? { votcTimelineParentId: anchor.votcTimelineParentId } : {}),
        id: input.id,
        senderId: input.senderId,
        senderName: senderSnapshot.displayName,
        receiverId: input.receiverId,
        receiverName: receiverSnapshot.displayName,
        topic: input.topic,
        body: input.content,
        direction: 'incoming',
        sourceType: input.topic,
        chronicleSourceKind: 'incoming_letter',
        content: input.content
    };
}
