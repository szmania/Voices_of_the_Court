import { Character } from "../../shared/gameData/Character.js";
import { Letter as ILetter, LetterType } from "./letterInterfaces.js";

export class Letter implements ILetter {
    id: string;
    sender: Character;
    recipient: Character;
    subject: string;
    content: string;
    timestamp: Date;
    isRead: boolean;
    letterType: LetterType;

    constructor(
        id: string,
        sender: Character,
        recipient: Character,
        subject: string,
        content: string,
        letterType: LetterType,
        timestamp: Date = new Date(),
        isRead: boolean = false
    ) {
        this.id = id;
        this.sender = sender;
        this.recipient = recipient;
        this.subject = subject;
        this.content = content;
        this.timestamp = timestamp;
        this.isRead = isRead;
        this.letterType = letterType;
    }
}
