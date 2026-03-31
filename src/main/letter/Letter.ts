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
    creationTimestamp: Date;
    isRead: boolean;
    letterType: LetterType;
    delay: number;
    totalDays: number;
    replyToId?: string;
    status?: 'generating' | 'pending' | 'sent' | 'failed' | 'read';
    delivered?: boolean;
    deliveryTimestamp?: Date;

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
        delivered?: boolean,
        creationTimestamp?: Date,
        deliveryTimestamp?: Date
    ) {
        this.id = id;
        this.sender = sender;
        this.recipient = recipient;
        this.subject = subject;
        this.content = content;
        this.timestamp = timestamp;
        this.creationTimestamp = creationTimestamp || new Date();
        this.isRead = isRead;
        this.letterType = letterType;
        this.delay = delay;
        this.totalDays = totalDays;
        this.replyToId = replyToId;
        this.status = status;
        this.delivered = delivered;

        if (deliveryTimestamp && timestamp && deliveryTimestamp < timestamp) {
            console.warn(`Delivery timestamp for letter ${id} is before its written timestamp. Adjusting delivery timestamp to be same as written timestamp.`);
            this.deliveryTimestamp = timestamp;
        } else {
            this.deliveryTimestamp = deliveryTimestamp;
        }
    }

    public static fromLog(
        sender: Character,
        recipient: Character,
        letterId: string,
        content: string,
        gameDate: string,
        delay: number,
        totalDays: number
    ): Letter | null {
        try {
            let deliveryTimestamp: Date;
            if (gameDate) {
                const parts = gameDate.split('.');
                const year = parts[0].padStart(4, '0');
                const month = parts[1].padStart(2, '0');
                const day = parts[2].padStart(2, '0');
                deliveryTimestamp = new Date(`${year}-${month}-${day}T12:00:00Z`);
            } else {
                deliveryTimestamp = new Date();
            }
            const writtenTimestamp = new Date(deliveryTimestamp.getTime());
            writtenTimestamp.setUTCDate(writtenTimestamp.getUTCDate() - totalDays);

            return new Letter(
                randomUUID(),
                sender,
                recipient,
                letterId,
                content,
                LetterType.UNKNOWN,
                writtenTimestamp,
                false,
                delay,
                totalDays,
                undefined,
                'sent',
                true,
                undefined,
                deliveryTimestamp // For player-sent letters from log, delivery is immediate
            );
        } catch (error) {
            console.error("Error creating letter from log:", error);
            return null;
        }
    }
}
