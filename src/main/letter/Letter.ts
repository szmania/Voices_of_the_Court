import { Character } from "../../shared/gameData/Character.js";
import { Letter as ILetter, LetterType } from "./letterInterfaces.js";
import { v4 as uuidv4 } from 'uuid';

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

    public static fromLog(
        senderId: string,
        recipientId: string,
        subject: string,
        content: string,
        characterNameMap: Map<string, string>,
        gameDate?: string
    ): Letter | null {
        try {
            const senderName = characterNameMap.get(senderId) || `Character ${senderId}`;
            const recipientName = characterNameMap.get(recipientId) || `Character ${recipientId}`;

            const createCharacter = (id: string, name: string): Character => {
                const data = new Array(27).fill('0');
                data[0] = id;
                data[1] = name; // shortName
                data[2] = name; // fullName
                data[18] = name.split(' ')[0]; // firstName
                return new Character(data);
            };

            const sender = createCharacter(senderId, senderName);
            const recipient = createCharacter(recipientId, recipientName);

            const timestamp = gameDate ? new Date(gameDate.replace(/\./g, '-')) : new Date();

            return new Letter(
                uuidv4(),
                sender,
                recipient,
                subject,
                content,
                LetterType.UNKNOWN,
                timestamp
            );
        } catch (error) {
            console.error("Error creating letter from log:", error);
            return null;
        }
    }
}
