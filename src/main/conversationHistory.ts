import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { TimelineRegistry, isRecordVisibleForContext } from './timelineManager.js';
import {
    battleReportHistoryArchivedPath as campaignBattleReportHistoryArchivedPath,
    battleReportHistoryPath as campaignBattleReportHistoryPath,
    conversationHistoryDir as campaignConversationHistoryDir,
    letterHistoryArchivedDir as campaignLetterHistoryArchivedDir,
    letterHistoryDir as campaignLetterHistoryDir
} from './campaignDataPaths.js';
import type { CampaignPlayerIdentity } from '../shared/gameData/CampaignIdentity.js';
import { updateJsonArrayAtomic, writeJsonAtomic } from './history/historyAtomicJson.js';
import {
    classifyBattleReportHistoryArray,
    classifyIncomingLetterHistoryArray,
    classifyLetterHistoryArray,
    type ClassifiedHistoryArray
} from './history/HistoryRecordReaders.js';

export type ArchiveHistoryEntry = {
    id: string;
    type: 'letter' | 'battle';
    title: string;
    subtitle: string;
    modifiedTime: number;
    content: string;
};

function isVisibleAtCheckpoint(record: any, checkpointEpoch?: number): boolean {
    if (checkpointEpoch === undefined) {
        return true;
    }

    const recordEpoch = Number(record?.votcCheckpointEpoch);
    return !Number.isFinite(recordEpoch) || recordEpoch <= checkpointEpoch;
}

function isTimelineRecord(record: any): record is { votcTimelineNodeId: string } {
    return record?.votcTimelineNodeId !== undefined && record.votcTimelineNodeId !== null && record.votcTimelineNodeId !== '';
}

function isRecordVisible(record: any, registry: TimelineRegistry | undefined, currentNodeId: string | undefined, checkpointEpoch?: number): boolean {
    return isRecordVisibleForContext(registry, currentNodeId, record, checkpointEpoch);
}

function getRecordTime(record: any, fallbackTime: number): number {
    const time = new Date(record?.createdAt ?? '').getTime();
    return Number.isFinite(time) ? time : fallbackTime;
}

function getArchiveRecordKey(record: any, sourceFileName: string): string {
    return [
        sourceFileName,
        record?.id ?? '',
        record?.createdAt ?? '',
        record?.aiName ?? '',
        record?.location ?? '',
        record?.playerLetter ?? '',
        record?.content ?? ''
    ].join('\u001f');
}

function conversationHistoryDirFor(playerId: string, identity?: CampaignPlayerIdentity): string {
    const userDataPath = app.getPath('userData');
    return identity
        ? campaignConversationHistoryDir(userDataPath, identity)
        : path.join(userDataPath, 'votc_data', 'conversation_history', playerId);
}

function letterHistoryDirFor(playerId: string, identity?: CampaignPlayerIdentity): string {
    const userDataPath = app.getPath('userData');
    return identity
        ? campaignLetterHistoryDir(userDataPath, identity)
        : path.join(userDataPath, 'votc_data', 'letter_history', `player_${playerId}`);
}

function letterHistoryArchivedDirFor(playerId: string, identity?: CampaignPlayerIdentity): string {
    const userDataPath = app.getPath('userData');
    return identity
        ? campaignLetterHistoryArchivedDir(userDataPath, identity)
        : path.join(userDataPath, 'votc_data', 'letter_history_archived', `player_${playerId}`);
}

function battleReportHistoryPathFor(playerId: string, identity?: CampaignPlayerIdentity): string {
    const userDataPath = app.getPath('userData');
    return identity
        ? campaignBattleReportHistoryPath(userDataPath, identity)
        : path.join(userDataPath, 'votc_data', 'battle_report_history', `player_${playerId}.json`);
}

function battleReportHistoryArchivedPathFor(playerId: string, identity?: CampaignPlayerIdentity): string {
    const userDataPath = app.getPath('userData');
    return identity
        ? campaignBattleReportHistoryArchivedPath(userDataPath, identity)
        : path.join(userDataPath, 'votc_data', 'battle_report_history_archived', `player_${playerId}.json`);
}

// Read list of historical conversation files
export async function getConversationHistoryFiles(playerId: string, currentCharacterIds: number[], limit: number): Promise<Array<{fileName: string, modifiedTime: number}>> {
    try {
        // Build path to conversation history directory - using userdata's conversation_history directory
        const userDataPath = app.getPath('userData');
        const conversationHistoryDir = path.join(userDataPath, 'votc_data', 'conversation_history', playerId);
        
        // Ensure directory exists
        try {
            await fs.access(conversationHistoryDir);
        } catch {
            console.log(`Conversation history directory does not exist: ${conversationHistoryDir}`);
            return [];
        }
        
        const currentIdSet = new Set(currentCharacterIds.map(String));

        // Read all txt files in the directory
        const allFiles = await fs.readdir(conversationHistoryDir);
        const filteredFiles = allFiles.filter(file => {
            if (!file.endsWith('.txt')) return false;

            const nameParts = file.replace('.txt', '').split('_');
            if (nameParts.length < 2) return false; // Must have at least one character id and a timestamp

            const timestamp = nameParts.pop(); // Remove and check timestamp
            if (isNaN(Number(timestamp))) return false;

            const fileCharacterIds = new Set(nameParts);

            // The history is only relevant if the set of participants is exactly the same.
            if (fileCharacterIds.size !== currentIdSet.size) {
                return false;
            }
            for (const id of fileCharacterIds) {
                if (!currentIdSet.has(id)) {
                    return false;
                }
            }
            return true;
        });
        
        // Get modification time for each file
        const filesWithStats = await Promise.all(filteredFiles.map(async (fileName) => {
            const filePath = path.join(conversationHistoryDir, fileName);
            const stats = await fs.stat(filePath);
            return {
                fileName,
                modifiedTime: stats.mtime.getTime()
            };
        }));
        
        // Sort by modification time, descending (newest first)
        filesWithStats.sort((a, b) => b.modifiedTime - a.modifiedTime);
        
        // If a limit is provided and is greater than 0, apply it
        if (limit > 0) {
            console.log(`Limiting historical conversations to the latest ${limit} files.`);
            return filesWithStats.slice(0, limit);
        }

        return filesWithStats;
    } catch (error) {
        console.error('Error reading conversation history file list:', error);
        throw error;
    }
}

// Read content of a specific historical conversation file
export async function readConversationHistoryFile(playerId: string, fileName: string): Promise<string> {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'votc_data', 'conversation_history', playerId, fileName);
    try {
        // Ensure file exists
        await fs.access(filePath);
        
        // Read file content
        const content = await fs.readFile(filePath, 'utf8');
        
        return content;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
             throw new Error(`Conversation history file does not exist: ${filePath}`);
        }
        console.error('Error reading conversation history file:', error);
        throw error;
    }
}

type ArchiveArrayClassifier = (entries: unknown[], identity: CampaignPlayerIdentity, mode: 'tolerant_for_chronicle' | 'strict_for_export', logicalPath: string) => ClassifiedHistoryArray<any>;

/**
 * Validates schema v1 entries via HistoryRecordReaders (tolerant mode) and
 * keeps legacy entries verbatim so the duck-typed projection below can render
 * both shapes. A classification failure (e.g. anchor identity mismatch) falls
 * back to projecting every entry as a legacy record instead of losing the file.
 */
function prepareArchiveEntries(
    raw: unknown[],
    identity: CampaignPlayerIdentity | undefined,
    classifiers: ArchiveArrayClassifier[],
    logicalPath: string
): unknown[] {
    if (!identity || classifiers.length === 0) {
        return raw;
    }

    const promoted: unknown[] = [];
    const claimedSourceIds = new Set<string>();
    for (const classify of classifiers) {
        try {
            const { v1Records, warnings } = classify(raw, identity, 'tolerant_for_chronicle', logicalPath);
            for (const warning of warnings) {
                console.warn(`[history] ${logicalPath}: ${warning.message}`);
            }
            for (const record of v1Records) {
                promoted.push(record);
                if (record?.sourceRecordId !== undefined && record?.sourceRecordId !== null) {
                    claimedSourceIds.add(String(record.sourceRecordId));
                }
            }
        } catch (error) {
            console.warn(`[history] ${logicalPath}: v1 classification failed; reading as legacy entries`, error);
            return raw;
        }
    }

    if (promoted.length === 0) {
        return raw;
    }

    const legacy = raw.filter(entry => {
        const sourceRecordId = (entry as { sourceRecordId?: unknown } | null)?.sourceRecordId;
        return !(typeof sourceRecordId === 'string' && claimedSourceIds.has(sourceRecordId));
    });
    return [...promoted, ...legacy];
}

function toLetterArchiveEntry(record: any, id: string, fallbackTime: number): ArchiveHistoryEntry {
    if (record?.direction === 'incoming') {
        return {
            id,
            type: 'letter',
            title: record.senderName || 'Unknown',
            subtitle: record.sourceType || '',
            modifiedTime: getRecordTime(record, fallbackTime),
            content: record.content || ''
        };
    }

    return {
        id,
        type: 'letter',
        title: record.aiName || 'Unknown',
        subtitle: record.playerName || 'Unknown',
        modifiedTime: getRecordTime(record, fallbackTime),
        content: `${record.playerName || 'Player'}:\n${record.playerLetter || ''}\n\n${record.aiName || 'Recipient'}:\n${record.aiReply || ''}`
    };
}

export async function getLetterHistoryEntries(playerId: string, checkpointEpoch?: number, registry?: TimelineRegistry, currentNodeId?: string, identity?: CampaignPlayerIdentity): Promise<ArchiveHistoryEntry[]> {
    const letterHistoryDir = letterHistoryDirFor(playerId, identity);
    if (!fs.existsSync(letterHistoryDir)) {
        return [];
    }

    const entries: ArchiveHistoryEntry[] = [];
    for (const fileName of fs.readdirSync(letterHistoryDir).filter(file => file.endsWith('.json'))) {
        const filePath = path.join(letterHistoryDir, fileName);
        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!Array.isArray(parsed)) {
                continue;
            }

            const records = prepareArchiveEntries(parsed, identity, [
                (entries, identity, mode, logicalPath) => classifyLetterHistoryArray(entries, identity, mode, logicalPath),
                (entries, identity, mode, logicalPath) => classifyIncomingLetterHistoryArray(entries, identity, mode, logicalPath)
            ], `letter_history/${fileName}`);

            const fallbackTime = fs.statSync(filePath).mtime.getTime();
            records.forEach((record, index) => {
                if (!isRecordVisible(record, registry, currentNodeId, checkpointEpoch)) {
                    return;
                }

                entries.push(toLetterArchiveEntry(record, `letter:${fileName}:${index}`, fallbackTime));
            });
        } catch (error) {
            console.error(`Failed to read letter history ${filePath}:`, error);
        }
    }

    return entries.sort((a, b) => b.modifiedTime - a.modifiedTime);
}

export async function getBattleReportHistoryEntries(playerId: string, checkpointEpoch?: number, registry?: TimelineRegistry, currentNodeId?: string, identity?: CampaignPlayerIdentity): Promise<ArchiveHistoryEntry[]> {
    const historyFilePath = battleReportHistoryPathFor(playerId, identity);
    if (!fs.existsSync(historyFilePath)) {
        return [];
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
        if (!Array.isArray(parsed)) {
            return [];
        }

        const records = prepareArchiveEntries(parsed, identity, [
            (entries, identity, mode, logicalPath) => classifyBattleReportHistoryArray(entries, identity, mode, logicalPath)
        ], 'battle_report_history.json');

        const fallbackTime = fs.statSync(historyFilePath).mtime.getTime();
        return records
            .map((record, index) => ({ record, index }))
            .filter(({ record }) => isRecordVisible(record, registry, currentNodeId, checkpointEpoch))
            .map(({ record, index }) => ({
                id: `battle:${(record as any)?.id || index}`,
                type: 'battle' as const,
                title: (record as any)?.location || 'Unknown battlefield',
                subtitle: [(record as any)?.winnerName, (record as any)?.loserName].filter(Boolean).join(' — '),
                modifiedTime: getRecordTime(record, fallbackTime),
                content: (record as any)?.content || ''
            }))
            .sort((a, b) => b.modifiedTime - a.modifiedTime);
    } catch (error) {
        console.error(`Failed to read battle report history ${historyFilePath}:`, error);
        return [];
    }
}

/**
 * Splits a history record array at a checkpoint: records anchored to timeline
 * nodes always stay visible (graph visibility decides elsewhere); plain records
 * newer than `checkpointEpoch` are returned as the archive set.
 */
export function archiveFutureRecords(records: any[], checkpointEpoch: number): { visible: any[]; future: any[] } {
    const visible: any[] = [];
    const future: any[] = [];
    for (const record of records) {
        if (isTimelineRecord(record) || isVisibleAtCheckpoint(record, checkpointEpoch)) {
            visible.push(record);
        } else {
            future.push(record);
        }
    }
    return { visible, future };
}

/**
 * Moves records from `sourceFilePath` that are ahead of `checkpointEpoch` into
 * the archive file at `archiveFilePath`. Both writes go through
 * updateJsonArrayAtomic/writeJsonAtomic; the archive write happens first so a
 * crash between the two writes can never lose a record (the leftover source
 * copy is simply re-archived idempotently on the next run — dedup is keyed on
 * stable record fields, not on archive annotations).
 */
async function archiveFutureRecordsInFile(
    sourceFilePath: string,
    archiveFilePath: string,
    checkpointEpoch: number,
    reason: string
): Promise<number> {
    if (!fs.existsSync(sourceFilePath)) {
        return 0;
    }

    try {
        const records = JSON.parse(fs.readFileSync(sourceFilePath, 'utf8'));
        if (!Array.isArray(records)) {
            return 0;
        }

        const { visible, future } = archiveFutureRecords(records, checkpointEpoch);
        if (!future.length) {
            return 0;
        }

        const sourceFileName = path.basename(sourceFilePath);
        const archivedAt = new Date().toISOString();
        const annotatedFutureRecords = future.map(record => ({
            ...record,
            archivedAt,
            archiveReason: reason,
            archivedFromCheckpointEpoch: checkpointEpoch,
            archivedSourceFile: sourceFileName
        }));

        await updateJsonArrayAtomic<any>(
            archiveFilePath,
            (value) => {
                if (!Array.isArray(value)) {
                    throw new Error('existing archive history file is not an array');
                }
                return value;
            },
            (archivedRecords) => {
                const seenKeys = new Set<string>();
                return [...annotatedFutureRecords, ...archivedRecords].filter(record => {
                    const key = getArchiveRecordKey(record, record?.archivedSourceFile ?? sourceFileName);
                    if (seenKeys.has(key)) {
                        return false;
                    }
                    seenKeys.add(key);
                    return true;
                });
            }
        );
        await writeJsonAtomic(sourceFilePath, visible);
        return future.length;
    } catch (error) {
        console.error(`Failed to archive future history ${sourceFilePath}:`, error);
        return 0;
    }
}

export async function archiveFutureLetterHistoryForPlayer(playerId: string, checkpointEpoch: number, reason = 'older_save_checkpoint', identity?: CampaignPlayerIdentity): Promise<number> {
    const historyDir = letterHistoryDirFor(playerId, identity);
    if (!fs.existsSync(historyDir)) {
        return 0;
    }

    const archiveDir = letterHistoryArchivedDirFor(playerId, identity);
    let count = 0;
    for (const fileName of fs.readdirSync(historyDir).filter(file => file.endsWith('.json'))) {
        count += await archiveFutureRecordsInFile(
            path.join(historyDir, fileName),
            path.join(archiveDir, fileName),
            checkpointEpoch,
            reason
        );
    }
    return count;
}

export async function archiveFutureBattleReportHistoryForPlayer(playerId: string, checkpointEpoch: number, reason = 'older_save_checkpoint', identity?: CampaignPlayerIdentity): Promise<number> {
    const historyFilePath = battleReportHistoryPathFor(playerId, identity);
    const archiveFilePath = battleReportHistoryArchivedPathFor(playerId, identity);
    return archiveFutureRecordsInFile(historyFilePath, archiveFilePath, checkpointEpoch, reason);
}

/**
 * Archives every letter/battle record that is ahead of the given checkpoint.
 * Wired into the get-archive-history-entries chain in Task 5 (1.x main.ts:5466).
 */
export async function archiveFutureArchiveHistoryForPlayer(playerId: string, checkpointEpoch: number, reason = 'older_save_checkpoint', identity?: CampaignPlayerIdentity): Promise<number> {
    return await archiveFutureLetterHistoryForPlayer(playerId, checkpointEpoch, reason, identity)
        + await archiveFutureBattleReportHistoryForPlayer(playerId, checkpointEpoch, reason, identity);
}

/**
 * Aggregated archive viewer feed for the history window's letter/battle tabs.
 * Task 5 registers this behind IPC 'get-archive-history-entries' with the call
 * shape `(playerId, checkpointEpoch, type)`; the optional registry/node/identity
 * parameters mirror getLetterHistoryEntries/getBattleReportHistoryEntries so the
 * resolveTimelineWindowRequest wiring can be threaded through without another
 * signature change. With no registry/context the visibility check degrades to
 * checkpoint-epoch-only filtering.
 */
export async function getArchiveHistoryEntries(
    playerId: string,
    checkpointEpoch?: number,
    type?: 'letter' | 'battle',
    registry?: TimelineRegistry,
    currentNodeId?: string,
    identity?: CampaignPlayerIdentity
): Promise<ArchiveHistoryEntry[]> {
    if (type === 'letter') {
        return getLetterHistoryEntries(playerId, checkpointEpoch, registry, currentNodeId, identity);
    }
    if (type === 'battle') {
        return getBattleReportHistoryEntries(playerId, checkpointEpoch, registry, currentNodeId, identity);
    }
    return [];
}
