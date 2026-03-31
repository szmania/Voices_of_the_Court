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
        gameDate: string, // Date string when SENT
        delay: number,    // Travel time
        totalDays: number // Game day number when SENT
    ): Letter | null {
        try {
            // The written timestamp is the date the letter was sent.
            const writtenTimestamp = new Date(gameDate.replace(/\./g, '-') + 'T12:00:00Z');
            if (isNaN(writtenTimestamp.getTime())) {
                console.error(`Invalid gameDate provided to Letter.fromLog: ${gameDate}`);
                return null;
            }

            // The delivery timestamp is when the AI receives it.
            const deliveryTimestamp = new Date(writtenTimestamp.getTime());
            deliveryTimestamp.setUTCDate(writtenTimestamp.getUTCDate() + delay);

            return new Letter(
                randomUUID(),
                sender,
                recipient,
                letterId, // subject
                content,
                LetterType.UNKNOWN,
                writtenTimestamp, // Correct written date
                false, // isRead
                delay, // The travel time
                totalDays, // The day number it was sent
                undefined, // replyToId
                'sent', // status
                true, // The player's letter is considered 'delivered' to the AI after the delay. The journey tracking handles the rest.
                undefined, // creationTimestamp (real world)
                deliveryTimestamp // Correct delivery date
            );
        } catch (error) {
            console.error("Error creating letter from log:", error);
            return null;
        }
    }
}
