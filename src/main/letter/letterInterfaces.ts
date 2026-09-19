import { Character } from "../../shared/gameData/Character.js";

export enum LetterType {
    DIPLOMATIC = 'diplomatic',
    PERSONAL = 'personal',
    EVENT = 'event',
    UNKNOWN = 'unknown'
}

export interface Letter {
  id: string;
  sender: Character;
  recipient: Character;
  subject: string;
  content: string;
  timestamp: Date; // Game Date
  creationTimestamp: Date; // Real-world Date
  isRead: boolean;
  letterType: LetterType;
  delay: number;
  totalDays: number;
  replyToId?: string;
  status?: 'generating' | 'pending' | 'sent' | 'failed' | 'read';
  delivered?: boolean;
  deliveryTimestamp?: Date;
  expectedDeliveryDate?: Date;
  isPlayerSender?: boolean;
  /** Timeline v2 script (node/parent variables) allocated for this reply's thread; applied on delivery. */
  timelineScript?: string;
  /** Checkpoint epoch the script targets; delivery re-validates it against the registry. */
  timelineEpoch?: number;
  /** Campaign/player identity the timeline allocation belongs to (registry lookup at delivery). */
  timelineCampaignId?: string;
  timelinePlayerId?: string;
  characterContext?: {
    playerId: string;
    playerName: string;
    recipientId: string;
    recipientName: string;
    gameDate: string;
    scene: string;
    location: string;
    locationController: string;
    totalDays: number;
  };
}

export interface StoredLetter {
    letter: Letter; // The reply letter
    originalLetter: Letter;
    expectedDeliveryDay: number;
}

export interface LetterSummary {
  id: string;
  date: string;
  summary: string;
  letterIds: string[]; // To track which letters this summary covers
}
