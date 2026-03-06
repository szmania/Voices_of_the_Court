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

    public static async fromLog(
        senderId: string,
        recipientId: string,
        subject: string,
        content: string,
        characterNameMap: Map<string, string>
    ): Promise<Letter | null> {
        try {
            const { v4: uuidv4 } = await import('uuid');
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

            return new Letter(
                uuidv4(),
                sender,
                recipient,
                subject,
                content,
                LetterType.UNKNOWN
            );
        } catch (error) {
            console.error("Error creating letter from log:", error);
            return null;
        }
    }
}
