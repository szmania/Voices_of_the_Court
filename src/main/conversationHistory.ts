import fs from 'fs';
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

function legacyConversationHistoryDir(playerId: string): string {
    return path.join(app.getPath('userData'), 'votc_data', 'conversation_history', playerId);
}

function conversationHistoryDirFor(playerId: string, identity?: CampaignPlayerIdentity): string {
    return identity
        ? campaignConversationHistoryDir(app.getPath('userData'), identity)
        : legacyConversationHistoryDir(playerId);
}

// Legacy transcripts must stay visible under a v2 identity: the conversation
// writer still mirrors transcripts to the legacy player directory and older
// saves never migrate their files. Legacy is listed first so name collisions
// resolve to the legacy copy (same content the user has always seen).
function conversationHistoryCandidateDirs(playerId: string, identity?: CampaignPlayerIdentity): string[] {
    const legacyDir = legacyConversationHistoryDir(playerId);
    return identity
        ? [legacyDir, campaignConversationHistoryDir(app.getPath('userData'), identity)]
        : [legacyDir];
}

function letterHistoryDirFor(playerId: string, identity?: CampaignPlayerIdentity): string {
    // Timeline letter-history layout. The legacy branch
    // (`votc_data/letter_history/player_<id>/`) is the location 1.x wrote
    // outgoing/incoming letter history records before the campaign-scoped
    // migration (1.x commits 884b29ec -> 1270eb20/92858374) and is kept as a
    // read-only fallback for data written before campaign identities existed;
    // new writes go through the campaign branch below once the Task 5 letter
    // writer wiring lands. Unrelated to LetterManager chat letters, which live
    // at `votc_data/letter_history/<playerId>/<characterId>.json` and are a
    // separate feature never surfaced in this archive view.
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

function getHistoryFileCheckpointEpoch(fileName: string): number | undefined {
    const match = fileName.match(/_ckpt(\d+)_/);
    if (!match) return undefined;
    const epoch = Number(match[1]);
    return Number.isFinite(epoch) ? epoch : undefined;
}

export async function parseConversationHistoryIdsFromLog(logFilePath: string): Promise<{playerId: string, checkpointEpoch?: number}> {
    try {
        if (!fs.existsSync(logFilePath)) {
            throw new Error(`Log file not found: ${logFilePath}`);
        }
        const logContent = fs.readFileSync(logFilePath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        
        let conversationHistoryLine = '';
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('VOTC:conversation_history')) {
                conversationHistoryLine = lines[i];
                break;
            }
        }
        
        if (!conversationHistoryLine) {
            throw new Error('VOTC:conversation_history line not found in log');
        }
        
        const parts = conversationHistoryLine.split('/;/');
        if (parts.length < 2) {
            throw new Error('Invalid VOTC:conversation_history line format');
        }
        
        const playerId = parts[1].trim();
        const checkpointEpoch = parts[2] !== undefined ? Number(parts[2].trim()) : undefined;
        
        if (!playerId) {
            throw new Error('Failed to parse playerId from VOTC:conversation_history line');
        }
        
        return {
            playerId,
            checkpointEpoch: Number.isFinite(checkpointEpoch) ? checkpointEpoch : undefined
        };
    } catch (error) {
        console.error('Error parsing conversation history IDs:', error);
        throw error;
    }
}

function getHistoryFileTimelineNodeId(fileName: string): string | undefined {
    // Early development builds wrote the two node components with an
    // underscore; current files use the canonical hyphenated node ID.
    const match = fileName.match(/_tl_(\d+)(?:-|_)(\d+)_/);
    return match ? `${match[1]}-${match[2]}` : undefined;
}

// List transcript .txt files for the chat prompt builder. 2CE-specific shape:
// filters by the exact participating-character-id set and applies an optional
// limit. Unrelated to the history-viewer listing below, which follows the 1.x
// timeline-visibility rules instead.
//
// When `identity` is present the campaign-scoped dir is listed TOO and both
// layouts are merged (dedup by file name). Union rationale: 1.x has no such
// prompt feature, so it never needed this — but 2CE transcripts written
// before the campaign-scoped routing fix live in the legacy player dir, and
// dropping them would make existing users' old transcripts vanish from the
// prompt context as soon as a v2 mod starts providing an identity.
export async function listPromptTranscriptFiles(playerId: string, currentCharacterIds: number[], limit: number, checkpointEpoch?: number, identity?: CampaignPlayerIdentity): Promise<Array<{fileName: string, modifiedTime: number, sourceDir: string}>> {
    try {
        const userDataPath = app.getPath('userData');
        const legacyDir = path.join(userDataPath, 'votc_data', 'conversation_history', playerId);
        // Linked set keeps legacy first so name collisions resolve to the
        // legacy copy (same content the user has always seen).
        const dirs = new Set<string>([legacyDir]);
        if (identity) {
            dirs.add(campaignConversationHistoryDir(userDataPath, identity));
        }

        const mergedByName = new Map<string, { fileName: string, modifiedTime: number, sourceDir: string }>();
        for (const conversationHistoryDir of dirs) {
            if (!fs.existsSync(conversationHistoryDir)) {
                console.log(`Conversation history directory does not exist: ${conversationHistoryDir}`);
                continue;
            }

            const currentIdSet = new Set(currentCharacterIds.map(String));

            // Read all txt files in the directory
            const files = fs.readdirSync(conversationHistoryDir).filter(file => {
                if (!file.endsWith('.txt')) return false;

                const nameParts = file.replace('.txt', '').split('_');
                if (nameParts.length < 2) return false; // Must have at least one character id and a timestamp

                const timestamp = nameParts.pop(); // Remove and check timestamp
                if (isNaN(Number(timestamp))) return false;

                // Handle _ckptN_ segment
                let fileEpoch: number | undefined;
                const lastPart = nameParts[nameParts.length - 1];
                if (lastPart && lastPart.startsWith('ckpt')) {
                    nameParts.pop();
                    fileEpoch = Number(lastPart.replace('ckpt', ''));
                    if (!Number.isFinite(fileEpoch)) fileEpoch = undefined;
                }

                // Epoch filtering: hide files from the "future"
                if (checkpointEpoch !== undefined && fileEpoch !== undefined && fileEpoch > checkpointEpoch) {
                    return false;
                }

                // Character ID matching - skip when currentCharacterIds is empty
                if (currentCharacterIds.length > 0) {
                    const fileCharacterIds = new Set(nameParts);
                    if (fileCharacterIds.size !== currentIdSet.size) return false;
                    for (const id of currentIdSet) {
                        if (!fileCharacterIds.has(id)) return false;
                    }
                }
                return true;
            });

            for (const fileName of files) {
                if (mergedByName.has(fileName)) continue;
                const stats = fs.statSync(path.join(conversationHistoryDir, fileName));
                mergedByName.set(fileName, {
                    fileName,
                    modifiedTime: stats.mtime.getTime(),
                    sourceDir: conversationHistoryDir
                });
            }
        }

        // Sort by modification time, descending (newest first)
        const filesWithStats = [...mergedByName.values()].sort((a, b) => b.modifiedTime - a.modifiedTime);

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

// Read list of historical conversation files for the history viewer.
// Mirrors 1.x conversationHistory.getConversationHistoryFiles: campaign-scoped
// directory when an identity is available, graph visibility for node-tagged
// files, epoch filter otherwise.
export async function getConversationHistoryFiles(playerId: string, checkpointEpoch?: number, registry?: TimelineRegistry, currentNodeId?: string, identity?: CampaignPlayerIdentity): Promise<Array<{fileName: string, modifiedTime: number}>> {
    try {
        // Union over the legacy player dir and (when identifiable) the campaign
        // dir; first directory containing a name wins (legacy first).
        const fileSourceDirs = new Map<string, string>();
        for (const conversationHistoryDir of conversationHistoryCandidateDirs(playerId, identity)) {
            if (!fs.existsSync(conversationHistoryDir)) {
                console.log(`Conversation history directory does not exist: ${conversationHistoryDir}`);
                continue;
            }
            for (const file of fs.readdirSync(conversationHistoryDir)) {
                if (file.endsWith('.txt') && !fileSourceDirs.has(file)) {
                    fileSourceDirs.set(file, conversationHistoryDir);
                }
            }
        }

        const filesWithStats = Array.from(fileSourceDirs.entries())
            .map(([fileName, sourceDir]) => ({fileName, sourceDir}))
            .filter(({fileName}) => {
                const timelineNodeId = getHistoryFileTimelineNodeId(fileName);
                if (timelineNodeId) {
                    // Node-tagged histories must always pass graph visibility. Checkpoint
                    // values are not enough to distinguish siblings created after a load.
                    return Boolean(registry && currentNodeId && registry.isRecordVisible(timelineNodeId, currentNodeId));
                }

                const fileCheckpointEpoch = getHistoryFileCheckpointEpoch(fileName);
                return checkpointEpoch === undefined || fileCheckpointEpoch === undefined || fileCheckpointEpoch <= checkpointEpoch;
            })
            .map(({fileName, sourceDir}) => {
                const stats = fs.statSync(path.join(sourceDir, fileName));
                return {
                    fileName,
                    modifiedTime: stats.mtime.getTime()
                };
            });

        // Sort by modification time, descending (newest first)
        filesWithStats.sort((a, b) => b.modifiedTime - a.modifiedTime);

        return filesWithStats;
    } catch (error) {
        console.error('Error reading conversation history file list:', error);
        throw error;
    }
}

// Read content of a specific historical conversation file for the history
// viewer. Node-tagged files must belong to the current save branch; plain
// files must not be ahead of the given checkpoint.
export async function readConversationHistoryFile(playerId: string, fileName: string, checkpointEpoch?: number, registry?: TimelineRegistry, currentNodeId?: string, identity?: CampaignPlayerIdentity): Promise<string> {
    try {
        if (path.basename(fileName) !== fileName || !fileName.endsWith('.txt')) {
            throw new Error('Invalid conversation history file name');
        }

        const timelineNodeId = getHistoryFileTimelineNodeId(fileName);
        if (timelineNodeId) {
            if (!(registry && currentNodeId && registry.isRecordVisible(timelineNodeId, currentNodeId))) {
                throw new Error('This conversation history does not belong to the current save branch');
            }
        } else {
            const fileCheckpointEpoch = getHistoryFileCheckpointEpoch(fileName);
            if (checkpointEpoch !== undefined && fileCheckpointEpoch !== undefined && fileCheckpointEpoch > checkpointEpoch) {
                throw new Error('This conversation history belongs to a later point of the current save');
            }
        }

        let filePath: string | undefined;
        for (const dir of conversationHistoryCandidateDirs(playerId, identity)) {
            const candidate = path.join(dir, fileName);
            if (fs.existsSync(candidate)) {
                filePath = candidate;
                break;
            }
        }
        if (!filePath) {
            throw new Error(`Conversation history file does not exist: ${path.join(conversationHistoryDirFor(playerId, identity), fileName)}`);
        }

        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');

        return content;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
             throw new Error(`Conversation history file does not exist: ${fileName}`);
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
    // Reads only the timeline letter-history layout (see letterHistoryDirFor);
    // LetterManager chat letters use a different directory and record shape.
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
        const archivedKeys = new Set(annotatedFutureRecords.map(record => getArchiveRecordKey(record, sourceFileName)));

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

        // Re-read the source right before rewriting it so records appended by
        // concurrent writers between the first snapshot and the archive commit
        // survive instead of being clobbered. Only records whose stable business
        // key matches this batch's archived set are dropped; a re-read failure
        // falls back to the pre-archive snapshot (previous behavior).
        let survivingRecords = visible;
        try {
            const freshRecords = JSON.parse(fs.readFileSync(sourceFilePath, 'utf8'));
            if (Array.isArray(freshRecords)) {
                survivingRecords = freshRecords.filter(record => !archivedKeys.has(getArchiveRecordKey(record, sourceFileName)));
            }
        } catch (error) {
            console.warn(`Failed to re-read ${sourceFilePath} before rewrite; using the pre-archive snapshot:`, error);
        }

        await writeJsonAtomic(sourceFilePath, survivingRecords);
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
 * shape `(playerId, checkpointEpoch, type)`. Visibility caveat: records
 * anchored with a `votcTimelineNodeId` are treated as INVISIBLE while the
 * registry/current-node context is not threaded in (isRecordVisibleForContext
 * fail-closes without a registry), so until Task 5 wires
 * resolveTimelineWindowRequest through, only epoch-anchored records are shown;
 * full branch-visibility judgement resumes after that wiring. The optional
 * registry/node/identity parameters mirror getLetterHistoryEntries /
 * getBattleReportHistoryEntries so no further signature change is needed.
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
