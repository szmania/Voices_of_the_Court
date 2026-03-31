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
    expectedDeliveryDate?: Date;

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
        deliveryTimestamp?: Date,
        expectedDeliveryDate?: Date
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
        this.expectedDeliveryDate = expectedDeliveryDate;

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
        delay: number,    // Travel time (totalJourneyTime)
        totalDays: number // Game day number when SENT
    ): Letter | null {
        try {
            // The written timestamp is the date the letter was sent.
            const dateParts = gameDate.split('.').map(Number);
            if (dateParts.length !== 3 || dateParts.some(isNaN)) {
                console.error(`Invalid gameDate format provided to Letter.fromLog: ${gameDate}`);
                return null;
            }
            const [year, month, day] = dateParts;
            // Month is 0-indexed in JavaScript Date, and we use UTC to avoid timezone issues.
            const writtenTimestamp = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
            if (isNaN(writtenTimestamp.getTime())) {
                console.error(`Could not create valid date from gameDate: ${gameDate}`);
                return null;
            }

            // The delivery timestamp (when AI receives it) is after stage 1 of the journey.
            const stage1EndDays = Math.floor(delay * 4 / 9);
            const deliveryTimestamp = new Date(writtenTimestamp.getTime());
            deliveryTimestamp.setUTCDate(writtenTimestamp.getUTCDate() + stage1EndDays);

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
                false, // It's not delivered to the AI instantly, the journey tracks this.
                undefined, // creationTimestamp (real world)
                deliveryTimestamp, // When the AI will receive it
                deliveryTimestamp // For a player-sent letter, expected is same as actual.
            );
        } catch (error) {
            console.error("Error creating letter from log:", error);
            return null;
        }
    }
}
