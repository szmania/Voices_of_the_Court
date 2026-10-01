import fs from 'fs';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import { conversationHistoryRecordPath } from '../campaignDataPaths.js';
import { parseConversationHistoryRecord } from './historyRecordSchemas.js';
import {
    HistoryAtomicJsonError,
    writeJsonAtomic
} from './historyAtomicJson.js';
import type { ConversationHistoryRecordV1 } from './historyRecordTypes.js';

/**
 * Store for the per-node canonical conversation history record
 * (`conversation.json`, schema v1). Bound to one campaign/player namespace at
 * construction; it never guesses identity from global state.
 */
export class ConversationHistoryRecordStore {
    constructor(
        private readonly userDataDir: string,
        private readonly identity: CampaignPlayerIdentity
    ) {}

    /**
     * Validates the record through the shared parser (self-check), then
     * atomically writes it to the node's `conversation.json`. The record's
     * anchor node id selects the target file.
     */
    async save(record: ConversationHistoryRecordV1): Promise<void> {
        const validated = parseConversationHistoryRecord(record);
        const filePath = conversationHistoryRecordPath(
            this.userDataDir,
            this.identity,
            validated.anchor.votcTimelineNodeId
        );
        await writeJsonAtomic(filePath, validated);
    }

    /**
     * Reads and strictly validates the node's canonical record. Returns null
     * when no record exists yet; throws on parse or schema failure (fail
     * closed — callers must never fall back to the legacy `.txt` here).
     */
    async read(nodeId: string): Promise<ConversationHistoryRecordV1 | null> {
        const filePath = conversationHistoryRecordPath(this.userDataDir, this.identity, nodeId);
        let raw: string;
        try {
            raw = fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }
            throw new HistoryAtomicJsonError('history_io_failed', `cannot read ${filePath}: ${String(error)}`);
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            throw new HistoryAtomicJsonError('history_parse_failed', `cannot parse ${filePath}: ${String(error)}`);
        }
        return parseConversationHistoryRecord(parsed);
    }
}
