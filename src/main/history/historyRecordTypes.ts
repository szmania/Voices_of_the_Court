import type { ConversationTurn } from '../agency/agencyTypes.js';
import type {
    BattleCommander,
    BattleOutcome,
    BattleSide,
    BattleSideResult,
    NotableBattleCharacter
} from '../battleReport/BattleReportGenerator.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import type { CharacterSnapshotV1 } from '../promptWorkbench/promptWorkbenchTypes.js';

/**
 * Versioned history record contracts shared by every history writer, reader
 * and the timeline export pipeline. Plan section 6.
 */

export const HISTORY_RECORD_SCHEMA_VERSION = 1 as const;
export const TIMELINE_EXPORT_SCHEMA_VERSION = 1 as const;
export const TIMELINE_EXPORT_FORMAT = 'votc-timeline-archive' as const;
export const TIMELINE_EXPORT_FORMAT_VERSION = '1.0.0' as const;

export type HistoryCharacterRole =
    | 'player'
    | 'conversation_participant'
    | 'speaker'
    | 'audience'
    | 'letter_sender'
    | 'letter_receiver'
    | 'battle_winner'
    | 'battle_loser'
    | 'battle_commander_winner'
    | 'battle_commander_loser'
    | 'battle_notable_slain_winner_side'
    | 'battle_notable_slain_loser_side'
    | 'battle_notable_captured_loser_side';

export const HISTORY_CHARACTER_ROLES: readonly HistoryCharacterRole[] = [
    'player',
    'conversation_participant',
    'speaker',
    'audience',
    'letter_sender',
    'letter_receiver',
    'battle_winner',
    'battle_loser',
    'battle_commander_winner',
    'battle_commander_loser',
    'battle_notable_slain_winner_side',
    'battle_notable_slain_loser_side',
    'battle_notable_captured_loser_side'
];

/**
 * - `full`: complete snapshot captured at record time.
 * - `reference_only`: only id/name known (battle log references).
 * - `missing_legacy`: legacy record that predates snapshots; never backfilled.
 */
export type HistoryCharacterSnapshotStatus = 'full' | 'reference_only' | 'missing_legacy';

export interface HistoryCharacterSnapshotV1 {
    schemaVersion: 1;
    characterId: string | null;
    displayName: string;
    roles: HistoryCharacterRole[];
    status: HistoryCharacterSnapshotStatus;
    capturedAt: string | null;
    capturedGameDate: Ck3GameDate | null;
    snapshotHash: string | null;
    snapshot: CharacterSnapshotV1 | null;
    unavailableReason?: string;
}

export interface HistoryTimelineAnchorV1 {
    campaignId: string;
    playerId: string;
    votcCheckpointEpoch: number;
    votcTimelineNodeId: string;
    votcTimelineParentId?: string;
}

export type HistorySourceKind =
    | 'conversation'
    | 'outgoing_letter'
    | 'incoming_letter'
    | 'battle_report';

export interface HistoryRecordBaseV1 {
    schemaVersion: 1;
    sourceRecordId: string;
    kind: HistorySourceKind;
    createdAt: string;
    gameDate: Ck3GameDate;
    displayDate: string;
    anchor: HistoryTimelineAnchorV1;
    characters: HistoryCharacterSnapshotV1[];

    /**
     * Migration-period compatibility projections of `anchor`. Validators must
     * require them to match the anchor exactly; readers should prefer the
     * anchor. Removable only in a future schema version once every consumer
     * has migrated.
     */
    votcCheckpointEpoch: number;
    votcTimelineNodeId: string;
    votcTimelineParentId?: string;
}

export interface HistoryConversationTurnV1 {
    turn: ConversationTurn;
    narratives: string[];
}

export interface ConversationHistoryRecordV1 extends HistoryRecordBaseV1 {
    kind: 'conversation';
    title: string;
    participantCharacterIds: string[];
    turns: HistoryConversationTurnV1[];
    renderedText: string;
    humanReadableTranscriptFile: string;
}

export interface LetterHistoryRecordV1 extends HistoryRecordBaseV1 {
    kind: 'outgoing_letter';
    letterId: string;
    deliveryId: number;
    senderId: string;
    senderName: string;
    receiverId: string;
    receiverName: string;
    outgoingBody: string;
    replyBody: string;

    sourceType: 'letter';
    playerName: string;
    aiName: string;
    playerLetter: string;
    aiReply: string;
}

export interface IncomingLetterHistoryRecordV1 extends HistoryRecordBaseV1 {
    kind: 'incoming_letter';
    id: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    receiverName: string;
    topic: string;
    body: string;

    direction: 'incoming';
    sourceType: string;
    chronicleSourceKind: 'incoming_letter';
    content: string;
}

export interface BattleReportHistoryRecordV1 extends HistoryRecordBaseV1 {
    kind: 'battle_report';
    id: string;
    dedupKey: string;
    location: string;
    terrain?: string;
    winter?: string;
    result?: BattleOutcome;
    winningSide?: BattleSide;
    winnerId: string;
    winnerName: string;
    loserId: string;
    loserName: string;
    sideResults: BattleSideResult[];
    commanders: BattleCommander[];
    notableCharacters: NotableBattleCharacter[];
    tags: string[];
    content: string;
    generationStatus: 'fallback' | 'generated';
}

export type AnyHistoryRecordV1 =
    | ConversationHistoryRecordV1
    | LetterHistoryRecordV1
    | IncomingLetterHistoryRecordV1
    | BattleReportHistoryRecordV1;
