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
