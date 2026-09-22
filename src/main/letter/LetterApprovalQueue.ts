import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * A queued letter-action approval that could not be executed immediately because the
 * letter belongs to a player who is not currently being played in-game. It is stored
 * on disk so it survives app restarts, and is executed exactly once the next time that
 * player becomes the active session player.
 */
export interface QueuedLetterApproval {
    id: string;
    playerId: string;
    characterId: string;
    letterId: string;
    actionSignature: string;
    args: any[];
    sourceId: number;
    targetId: number;
    /** Letter thread name (e.g. "letter_1"). Optional for backward compat with pre-existing queued entries. */
    letterName?: string;
    /** In-game day number (totalDays) when this approval was queued. Optional for backward compat; missing = treat as due. */
    gameDateTotalDays?: number;
}

export class LetterApprovalQueue {
    private static getQueuePath(): string {
        return path.join(app.getPath('userData'), 'votc_data', 'letter_approval_queue.json');
    }

    private static readQueue(): QueuedLetterApproval[] {
        const queuePath = this.getQueuePath();
        if (!fs.existsSync(queuePath)) return [];
        try {
            const data = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[LetterApprovalQueue] Failed to read queue:', error);
            return [];
        }
    }

    private static writeQueue(queue: QueuedLetterApproval[]): void {
        const queuePath = this.getQueuePath();
        try {
            fs.mkdirSync(path.dirname(queuePath), { recursive: true });
            fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), 'utf8');
        } catch (error) {
            console.error('[LetterApprovalQueue] Failed to write queue:', error);
        }
    }

    /** Adds an approval to the queue, de-duplicating by letter/action identity. */
    public static queueApproval(entry: Omit<QueuedLetterApproval, 'id'>): void {
        const queue = this.readQueue();
        const key = `${entry.playerId}|${entry.letterId}|${entry.actionSignature}`;
        const existing = queue.find(q => `${q.playerId}|${q.letterId}|${q.actionSignature}` === key);
        if (existing) {
            // Already queued; keep the existing entry (idempotent).
            console.log(`[LetterApprovalQueue] Approval for '${entry.actionSignature}' (letter ${entry.letterId}) already queued.`);
            return;
        }
        queue.push({ ...entry, id: randomUUID() });
        this.writeQueue(queue);
        console.log(`[LetterApprovalQueue] Queued approval for '${entry.actionSignature}' (letter ${entry.letterId}, player ${entry.playerId}).`);
    }

    public static getQueuedApprovalsForPlayer(playerId: string): QueuedLetterApproval[] {
        return this.readQueue().filter(q => q.playerId === playerId);
    }

    /**
     * Returns queued approvals for the given player that are due for execution:
     * entries with no gameDateTotalDays (legacy, treated as due) or with
     * gameDateTotalDays <= currentTotalDays. Future-dated entries remain queued.
     */
    public static getDueApprovalsForPlayer(playerId: string, currentTotalDays: number): QueuedLetterApproval[] {
        return this.readQueue().filter(q =>
            q.playerId === playerId &&
            (q.gameDateTotalDays == null || q.gameDateTotalDays <= currentTotalDays)
        );
    }

    public static removeQueuedApproval(id: string): void {
        const queue = this.readQueue();
        const next = queue.filter(q => q.id !== id);
        if (next.length !== queue.length) {
            this.writeQueue(next);
            console.log(`[LetterApprovalQueue] Removed queued approval ${id}.`);
        }
    }
}