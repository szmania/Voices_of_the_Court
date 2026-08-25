import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import type { CreateChildNodeResult } from '../timelineManager.js';

export interface ConversationHistoryHeaderInput {
    sourceRecordId: string;
    gameDate?: Ck3GameDate;
    displayDate: string;
    checkpointEpoch: number;
    timeline?: CreateChildNodeResult;
    datePrefix: string;
    /** Basename of the canonical schema v1 record backing this transcript. */
    canonicalRecordFile?: string;
}

export function buildConversationHistoryHeader(input: ConversationHistoryHeaderInput): string {
    const { sourceRecordId, gameDate, displayDate, checkpointEpoch, timeline, datePrefix, canonicalRecordFile } = input;
    const gameDateTotalDays = gameDate?.totalDays ?? '';
    const gameDateStr = gameDate ? `${gameDate.year}-${gameDate.month}-${gameDate.day}` : '';
    const canonicalLine = canonicalRecordFile
        ? `VOTC canonical record: ${canonicalRecordFile}\n`
        : '';
    return `VOTC source record id: ${sourceRecordId}\n${canonicalLine}VOTC game date total days: ${gameDateTotalDays}\nVOTC game date: ${gameDateStr}\n${datePrefix}: ${displayDate}\nVOTC checkpoint: ${checkpointEpoch}\nVOTC timeline node: ${timeline?.nodeId ?? 'unknown'}\nVOTC timeline parent: ${timeline?.parentId ?? 'null'}\n\n`;
}
