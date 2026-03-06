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
  timestamp: Date;
  isRead: boolean;
  letterType: LetterType;
}
