import { Character } from "../../shared/gameData/Character.js";
import { Letter as ILetter, LetterType } from "./letterInterfaces.js";
import { randomUUID } from 'crypto';

export class Letter implements ILetter {
    id: string;
    sender: Character;
    recipient: Character;
    subject: string;
    content: string;
    timestamp: Date;
    isRead: boolean;
    letterType: LetterType;
    delay: number;
    totalDays: number;
    replyToId?: string;
    status?: 'generating' | 'pending' | 'sent' | 'failed' | 'read';
    delivered?: boolean;

    constructor(
        id: string,
        sender: Character,
        recipient: Character,
        subject: string,
        content: string,
        letterType: LetterType,
        timestamp: Date = new Date(),
        isRead: boolean = false,
        delay: number = 0,
        totalDays: number = 0,
        replyToId?: string,
        status?: 'generating' | 'pending' | 'sent' | 'failed' | 'read',
        delivered?: boolean
    ) {
        this.id = id;
        this.sender = sender;
        this.recipient = recipient;
        this.subject = subject;
        this.content = content;
        this.timestamp = timestamp;
        this.isRead = isRead;
        this.letterType = letterType;
        this.delay = delay;
        this.totalDays = totalDays;
        this.replyToId = replyToId;
        this.status = status;
        this.delivered = delivered;
    }

    public static fromLog(
        senderId: string,
        recipientId: string,
        letterId: string,
        content: string,
        characterNameMap: Map<string, string>,
        gameDate: string,
        delay: number,
        totalDays: number
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
                randomUUID(),
                sender,
                recipient,
                letterId,
                content,
                LetterType.UNKNOWN,
                timestamp,
                false,
                delay,
                totalDays,
                undefined,
                'sent',
                true
            );
        } catch (error) {
            console.error("Error creating letter from log:", error);
            return null;
        }
    }
}
