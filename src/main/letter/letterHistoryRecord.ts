import type { Character } from '../../shared/gameData/Character.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import type { CreateChildNodeResult } from '../timelineManager.js';
import { captureHistoryCharacterSnapshots } from '../history/historyCharacterSnapshots.js';
import type { IncomingLetterHistoryRecordV1, LetterHistoryRecordV1 } from '../history/historyRecordTypes.js';

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

export type LetterReplyHistoryRecord = LetterHistoryRecordV1;

export interface BuildLetterHistoryRecordInput {
    letterId: string;
    deliveryId: number;
    playerLetter: string;
    aiReply: string;
    checkpointEpoch: number;
    timeline: CreateChildNodeResult;
    identity: CampaignPlayerIdentity;
    sourceRecordId: string;
    gameDate: Ck3GameDate;
    senderId: string;
    receiverId: string;
    /** Fallback display names when the character object is unavailable. */
    playerName: string;
    aiName: string;
    /** Loaded character objects; both are REQUIRED for a full snapshot. */
    senderCharacter: Character | null;
    receiverCharacter: Character | null;
}

/**
 * Single builder for outgoing letter history records (plan task T5). Produces
 * the versioned schema v1 record including sender/receiver character
 * snapshots captured from the current GameData. Both letter parties are
 * required-full: when either character object is missing, snapshot capture
 * fails and the caller must not persist a canonical record.
 */
export function buildLetterHistoryRecord(input: BuildLetterHistoryRecordInput): LetterHistoryRecordV1 {
    if (!input.gameDate) {
        throw new Error('letter history record requires a structured gameDate');
    }
    const capturedAt = new Date().toISOString();
    const characters = captureHistoryCharacterSnapshots([
        {
            characterId: input.senderId,
            displayName: input.senderCharacter?.shortName ?? input.playerName,
            roles: ['letter_sender', 'player'],
            character: input.senderCharacter,
            capturedAt,
            capturedGameDate: input.gameDate,
            completeness: 'required_full'
        },
        {
            characterId: input.receiverId,
            displayName: input.receiverCharacter?.shortName ?? input.aiName,
            roles: ['letter_receiver'],
            character: input.receiverCharacter,
            capturedAt,
            capturedGameDate: input.gameDate,
            completeness: 'required_full'
        }
    ]);
    // captureHistoryCharacterSnapshots returns a deterministically ordered
    // list; never assume the sender comes first.
    const senderSnapshot = characters.find(c => c.characterId === input.senderId);
    const receiverSnapshot = characters.find(c => c.characterId === input.receiverId);
    if (!senderSnapshot || !receiverSnapshot) {
        throw new Error('letter history snapshot capture lost the sender or receiver');
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
        kind: 'outgoing_letter',
        createdAt: capturedAt,
        gameDate: input.gameDate,
        displayDate: input.gameDate.display,
        anchor,
        characters,
        votcCheckpointEpoch: anchor.votcCheckpointEpoch,
        votcTimelineNodeId: anchor.votcTimelineNodeId,
        ...(anchor.votcTimelineParentId ? { votcTimelineParentId: anchor.votcTimelineParentId } : {}),
        letterId: input.letterId,
        deliveryId: input.deliveryId,
        senderId: input.senderId,
        senderName: senderSnapshot.displayName,
        receiverId: input.receiverId,
        receiverName: receiverSnapshot.displayName,
        outgoingBody: input.playerLetter,
        replyBody: input.aiReply,
        sourceType: 'letter',
        playerName: senderSnapshot.displayName,
        aiName: receiverSnapshot.displayName,
        playerLetter: input.playerLetter,
        aiReply: input.aiReply
    };
}

/**
 * Delivery-level idempotency check (plan T5 step 5): a retry of the same
 * letterId + deliveryId + timeline node must not append a second record.
 * Legacy entries (without kind/letterId) never match, so they are preserved.
 */
export function isSameOutgoingLetterDelivery(existing: unknown, candidate: LetterHistoryRecordV1): boolean {
    const record = existing as Partial<LetterHistoryRecordV1> | null;
    return Boolean(
        record &&
        record.kind === 'outgoing_letter' &&
        record.letterId === candidate.letterId &&
        record.deliveryId === candidate.deliveryId &&
        record.votcTimelineNodeId === candidate.votcTimelineNodeId
    );
}
