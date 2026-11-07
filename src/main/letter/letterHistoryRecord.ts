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
    /**
     * Timeline anchor for the record. Only the node id and its parent are read,
     * so callers may pass a full CreateChildNodeResult or a minimal anchor
     * (e.g. the save's current node when no transition was allocated).
     */
    timeline: Pick<CreateChildNodeResult, 'nodeId' | 'parentId'>;
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
 *
 * `buildLetterHistoryRecord` below is the outgoing-letter twin (M3): it
 * records a player letter and the AI reply it produced as one round-trip
 * record, mirroring the source-line builder's shape.
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

export interface BuildLetterHistoryRecordInput {
    /** Stable business signature; doubles as the delivery idempotency key. */
    id: string;
    /** Letter thread slot (e.g. 'letter_1') or the npcltr channel id. */
    letterId: string;
    /** Game day the player letter was sent; the occurrence discriminator. */
    deliveryId: number;
    /** Player character id (the letter's sender). */
    senderId: string;
    /** AI character id (the letter's recipient and reply author). */
    receiverId: string;
    /** The player's letter body. */
    outgoingBody: string;
    /** The AI's reply body. */
    replyBody: string;
    checkpointEpoch: number;
    /** Timeline anchor; see BuildIncomingLetterHistoryRecordInput.timeline. */
    timeline: Pick<CreateChildNodeResult, 'nodeId' | 'parentId'>;
    identity: CampaignPlayerIdentity;
    sourceRecordId: string;
    gameDate: Ck3GameDate;
    senderCharacter: Character | null;
    receiverCharacter: Character | null;
}

/**
 * Builder for outgoing letter history records (M3 port of the source-line
 * builder). Records one player letter and the AI reply it produced as a single
 * round-trip record; the player is the sender and the AI the receiver, matching
 * the `outgoing_letter` schema and its parser.
 *
 * The `playerName`/`aiName`/`playerLetter`/`aiReply` aliases are required by
 * the schema and validated to equal their canonical counterparts, so they are
 * filled from the same values here.
 */
export function buildLetterHistoryRecord(
    input: BuildLetterHistoryRecordInput
): LetterHistoryRecordV1 {
    if (!input.gameDate) {
        throw new Error('outgoing letter history record requires a structured gameDate');
    }
    const capturedAt = new Date().toISOString();
    const characters = captureHistoryCharacterSnapshots([
        {
            characterId: input.senderId,
            displayName: input.senderCharacter?.shortName ?? `player_${input.senderId}`,
            roles: ['letter_sender', 'player'],
            character: input.senderCharacter,
            capturedAt,
            capturedGameDate: input.gameDate,
            completeness: 'required_full'
        },
        {
            characterId: input.receiverId,
            displayName: input.receiverCharacter?.shortName ?? `character_${input.receiverId}`,
            roles: ['letter_receiver'],
            character: input.receiverCharacter,
            capturedAt,
            capturedGameDate: input.gameDate,
            completeness: 'required_full'
        }
    ]);
    const senderSnapshot = characters.find(c => c.characterId === input.senderId);
    const receiverSnapshot = characters.find(c => c.characterId === input.receiverId);
    if (!senderSnapshot || !receiverSnapshot) {
        throw new Error('outgoing letter snapshot capture lost the sender or receiver');
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
        outgoingBody: input.outgoingBody,
        replyBody: input.replyBody,
        sourceType: 'letter',
        playerName: senderSnapshot.displayName,
        aiName: receiverSnapshot.displayName,
        playerLetter: input.outgoingBody,
        aiReply: input.replyBody
    };
}
