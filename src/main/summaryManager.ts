import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { Summary } from './ts/conversation_interfaces';
import { compactedMemoryStore } from './compactedMemoryStore.js';
import { CompactedMemory } from '../shared/compactionTypes.js';
import AdmZip from 'adm-zip';
import { TimelineRegistry, isRecordVisibleForContext } from './timelineManager.js';
import { conversationSummariesDir as campaignConversationSummariesDir } from './campaignDataPaths.js';
import type { CampaignPlayerIdentity } from '../shared/gameData/CampaignIdentity.js';

function getSummaryCheckpointEpoch(summary: any): number | undefined {
    const rawEpoch = summary?.votcCheckpointEpoch;
    if (rawEpoch === undefined || rawEpoch === null || rawEpoch === '') {
        return undefined;
    }
    const epoch = Number(rawEpoch);
    return Number.isFinite(epoch) ? epoch : undefined;
}

export function splitSummariesForCheckpoint<T extends { votcCheckpointEpoch?: number }>(summaries: T[], checkpointEpoch: number): { visibleSummaries: T[], futureSummaries: T[] } {
    const visibleSummaries: T[] = [];
    const futureSummaries: T[] = [];
    summaries.forEach((summary) => {
        const summaryEpoch = getSummaryCheckpointEpoch(summary);
        if (summaryEpoch !== undefined && summaryEpoch > checkpointEpoch) {
            futureSummaries.push(summary);
        } else {
            visibleSummaries.push(summary);
        }
    });
    return { visibleSummaries, futureSummaries };
}

export function filterSummariesForCheckpoint<T extends { votcCheckpointEpoch?: number }>(summaries: T[], checkpointEpoch: number): T[] {
    return splitSummariesForCheckpoint(summaries, checkpointEpoch).visibleSummaries;
}

export function archiveFutureSummariesForCheckpoint(
    userDataPath: string,
    playerId: string,
    characterId: string,
    summaries: any[],
    checkpointEpoch: number,
    options: { sourceFilePath?: string, reason?: string } = {}
): { visibleSummaries: any[], archivedSummaries: any[], archiveFilePath?: string } {
    const { visibleSummaries, futureSummaries } = splitSummariesForCheckpoint(summaries, checkpointEpoch);
    if (futureSummaries.length === 0) {
        return { visibleSummaries, archivedSummaries: [] };
    }

    const archiveDir = path.join(userDataPath, 'conversation_summaries_archived', playerId);
    fs.mkdirSync(archiveDir, { recursive: true });

    const archiveFilePath = path.join(archiveDir, `${characterId}.json`);
    let existingArchivedSummaries: any[] = [];
    if (fs.existsSync(archiveFilePath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(archiveFilePath, 'utf8'));
            if (Array.isArray(parsed)) {
                existingArchivedSummaries = parsed;
            }
        } catch (error) {
            console.error(`Failed to read archive file ${archiveFilePath}:`, error);
        }
    }

    const archivedAt = new Date().toISOString();
    const archivedSummaries = futureSummaries.map((summary) => ({
        ...summary,
        archivedAt,
        archiveReason: options.reason ?? 'older_save_checkpoint',
        archivedFromCheckpointEpoch: checkpointEpoch,
        archivedSourcePlayerId: playerId,
        archivedSourceCharacterId: characterId,
        archivedSourceFilePath: options.sourceFilePath
    }));

    const mergedArchivedSummaries: any[] = [];
    const seenKeys = new Set<string>();
    [...archivedSummaries, ...existingArchivedSummaries].forEach((summary) => {
        const key = [
            summary?.archivedSourcePlayerId ?? '',
            summary?.archivedSourceCharacterId ?? summary?.characterId ?? '',
            getSummaryCheckpointEpoch(summary) ?? '',
            summary?.date ?? '',
            summary?.content ?? ''
        ].join('\u001f');
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            mergedArchivedSummaries.push(summary);
        }
    });

    fs.writeFileSync(archiveFilePath, JSON.stringify(mergedArchivedSummaries, null, '\t'), 'utf8');
    return { visibleSummaries, archivedSummaries, archiveFilePath };
}

export function archiveFutureSummaryFilesForPlayer(userDataPath: string, playerId: string, checkpointEpoch: number, reason: string = 'older_save_checkpoint'): number {
    const summaryDir = path.join(userDataPath, 'conversation_summaries', playerId);
    if (!fs.existsSync(summaryDir)) {
        return 0;
    }

    let archivedCount = 0;
    const files = fs.readdirSync(summaryDir).filter(file => file.endsWith('.json') && file !== '_character_map.json');

    files.forEach((file) => {
        const summaryFilePath = path.join(summaryDir, file);
        try {
            const summaries = JSON.parse(fs.readFileSync(summaryFilePath, 'utf8'));
            if (!Array.isArray(summaries)) return;

            const characterId = path.basename(file, '.json');
            const result = archiveFutureSummariesForCheckpoint(userDataPath, playerId, characterId, summaries, checkpointEpoch, {
                sourceFilePath: summaryFilePath,
                reason
            });

            if (result.archivedSummaries.length > 0) {
                fs.writeFileSync(summaryFilePath, JSON.stringify(result.visibleSummaries, null, '\t'), 'utf8');
                archivedCount += result.archivedSummaries.length;
                console.log(`Archived ${result.archivedSummaries.length} future summaries from ${summaryFilePath} for checkpoint ${checkpointEpoch}.`);
            }
        } catch (error) {
            console.error(`Failed to archive future summaries ${summaryFilePath}:`, error);
        }
    });

    return archivedCount;
}

/**
 * Gets all player IDs by scanning summary directories.
 * @param userDataPath The path to the user data directory (e.g., .../votc_data).
 * @returns A promise that resolves to an array of player ID strings.
 */
export async function getAllPlayerIds(userDataPath: string): Promise<{ id: string, name: string }[]> {
    try {
        const summaryDir = path.join(userDataPath, 'conversation_summaries');
        if (!fs.existsSync(summaryDir)) {
            return [];
        }

        const playerDirsData = fs.readdirSync(summaryDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                const playerId = dirent.name;
                const mapPath = path.join(summaryDir, playerId, '_character_map.json');
                let playerName = `Player ${playerId}`; // Fallback name
                if (fs.existsSync(mapPath)) {
                    try {
                        const mapContent = fs.readFileSync(mapPath, 'utf8');
                        const mapData = JSON.parse(mapContent);
                        if (mapData[playerId]) {
                            playerName = mapData[playerId];
                        }
                    } catch (e) {
                        console.error(`Error reading character map for player ${playerId}:`, e);
                    }
                }
                return { id: playerId, name: playerName };
            });

        const playerTimestamps = await Promise.all(playerDirsData.map(async (player) => {
            let latestTimestamp = 0;
            try {
                const summaries = await readSummaryFile(userDataPath, player.id);
                for (const summary of summaries) {
                    if ((summary as any).creationTimestamp) {
                        const timestamp = new Date((summary as any).creationTimestamp).getTime();
                        if (timestamp > latestTimestamp) {
                            latestTimestamp = timestamp;
                        }
                    }
                }
            } catch (e) {
                console.error(`Error processing summaries for player ${player.id}:`, e);
            }
            return { ...player, latestTimestamp };
        }));

        playerTimestamps.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

        return playerTimestamps.map(({ id, name }) => ({ id, name }));

    } catch (error) {
        console.error('Error getting all player IDs from summaries:', error);
        throw error;
    }
}

/**
 * Gets the most recent player ID by scanning summary directories.
 * This is determined by finding the most recently modified player directory.
 * @param userDataPath The path to the user data directory (e.g., .../votc_data).
 * @returns A promise that resolves to an object containing the player ID.
 */
export async function getPlayerId(userDataPath: string): Promise<{playerId: string}> {
    try {
        const summaryDir = path.join(userDataPath, 'conversation_summaries');
        if (!fs.existsSync(summaryDir)) {
            throw new Error(`Conversation summaries directory not found at: ${summaryDir}`);
        }

        const playerDirs = fs.readdirSync(summaryDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                return {
                    name: dirent.name,
                    time: fs.statSync(path.join(summaryDir, dirent.name)).mtimeMs,
                };
            });

        if (playerDirs.length === 0) {
            throw new Error('No player summary directories found.');
        }

        // Sort by most recent modification time
        playerDirs.sort((a, b) => b.time - a.time);
        
        const recentPlayerId = playerDirs[0].name;
        if (!recentPlayerId) {
            throw new Error('Could not determine the most recent player ID.');
        }
        
        return { playerId: recentPlayerId };
    } catch (error) {
        console.error('Error getting player ID from summaries:', error);
        throw error;
    }
}

/**
 * Reads all summary files for a given player.
 * @param userDataPath The path to the user data directory.
 * @param playerId The ID of the player whose summaries to read.
 * @param checkpointEpoch Optional checkpoint filter (legacy epoch-based).
 * @param registry Optional timeline registry for branch visibility of
 *                 node-tagged records (1.x readSummaryFile parity).
 * @param currentNodeId Current timeline node id used with `registry`.
 * @param identity When present, reads the campaign-scoped summary directory
 *                 instead of the legacy player-only one.
 * @returns A promise that resolves to an array of all summaries.
 */
export async function readSummaryFile(
    userDataPath: string,
    playerId: string,
    checkpointEpoch?: number,
    registry?: TimelineRegistry,
    currentNodeId?: string,
    identity?: CampaignPlayerIdentity
): Promise<Summary[]> {
    try {
        // Campaign-scoped layout is rooted at the userData dir; the legacy
        // layout hangs off the votc_data dir passed in by callers.
        const summaryDir = identity
            ? campaignConversationSummariesDir(app.getPath('userData'), identity)
            : path.join(userDataPath, 'conversation_summaries', playerId);
        
        // Ensure directory exists
        if (!fs.existsSync(summaryDir)) {
            fs.mkdirSync(summaryDir, { recursive: true });
            return [];
        }
        
        // Read all JSON files in the directory
        const files = fs.readdirSync(summaryDir).filter(file => file.endsWith('.json') && file !== '_character_map.json');
        const allSummaries: Summary[] = [];
        
        for (const file of files) {
            const filePath = path.join(summaryDir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const summaries: Summary[] = JSON.parse(content);
                // Add character ID info to each summary
                const characterId = path.basename(file, '.json');
                const summariesWithCharacterId = summaries.map((summary) => ({
                    ...summary,
                    characterId
                }));
                allSummaries.push(...summariesWithCharacterId);
            } catch (error) {
                console.error(`Failed to read file ${filePath}:`, error);
            }
        }
        
        // First apply the legacy epoch filter (preserves all timeline-tagged
        // records regardless of epoch), then apply graph-based visibility for
        // timeline records so other-branch summaries are hidden.
        // NOTE: no summary writer currently stamps votcTimelineNodeId, so the
        // node-tagged branch of isRecordVisibleForContext is dormant (and
        // fail-closed when registry/currentNodeId are absent). When P7
        // introduces node stamping for summaries, revisit this filter.
        const epochFiltered = checkpointEpoch === undefined
            ? allSummaries
            : filterSummariesForCheckpoint(allSummaries, checkpointEpoch);
        const visibleSummaries = epochFiltered.filter((summary) =>
            isRecordVisibleForContext(registry, currentNodeId, summary, checkpointEpoch)
        );

        // Sort by date
        visibleSummaries.sort((a, b) => {
            const extractDate = (dateStr: string) => {
                if (!dateStr) return { year: 0, month: 1, day: 1 };
                const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
                if (match) {
                    return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
                }
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
                }
                return { year: 0, month: 1, day: 1 };
            };
            const dateA = extractDate(a.date);
            const dateB = extractDate(b.date);
            if (dateB.year !== dateA.year) return dateB.year - dateA.year;
            if (dateB.month !== dateA.month) return dateB.month - dateA.month;
            return dateB.day - dateA.day;
        });
        
        return visibleSummaries;
    } catch (error) {
        console.error('Error reading summary file:', error);
        throw error;
    }
}

/**
 * Saves summaries to their respective character files for a given player.
 * @param userDataPath The path to the user data directory.
 * @param playerId The ID of the player.
 * @param summaries An array of all summaries to save.
 */
export async function saveSummaryFile(userDataPath: string, playerId: string, summaries: Summary[]): Promise<void> {
    try {
        const summaryDir = path.join(userDataPath, 'conversation_summaries', playerId);
        
        // Ensure directory exists
        if (!fs.existsSync(summaryDir)) {
            fs.mkdirSync(summaryDir, { recursive: true });
        }

        const existingSummaryFiles = fs.readdirSync(summaryDir).filter(f => f.endsWith('.json') && f !== '_character_map.json');
        const existingCharIds = new Set(existingSummaryFiles.map(f => f.replace('.json', '')));
        
        // Group summaries by character ID
        const summariesByCharacter: { [key: string]: Summary[] } = {};
        summaries.forEach(summary => {
            const characterId = summary.characterId || 'default';
            if (!summariesByCharacter[characterId]) {
                summariesByCharacter[characterId] = [];
            }
            summariesByCharacter[characterId].push(summary);
            existingCharIds.delete(characterId);
        });
        
        // Create a separate file for each character
        for (const [characterId, characterSummaries] of Object.entries(summariesByCharacter)) {
            const summaryFilePath = path.join(summaryDir, `${characterId}.json`);
            
            // Remove characterId field as it is already in the filename
            const cleanSummaries = characterSummaries.map(({ characterId, ...cleanSummary }) => cleanSummary);
            // Write to file
            fs.writeFileSync(summaryFilePath, JSON.stringify(cleanSummaries, null, '\t'), 'utf8');
        }

        // Delete summaries for characters that were removed
        for (const charIdToDelete of existingCharIds) {
            const summaryPath = path.join(summaryDir, `${charIdToDelete}.json`);
            if (fs.existsSync(summaryPath)) {
                fs.unlinkSync(summaryPath);
                console.log(`Deleted conversation summary for character ${charIdToDelete}`);
            }
        }
    } catch (error) {
        console.error('Error saving summary file:', error);
        throw error;
    }
}

/**
 * Reads the character map for a given player.
 * @param userDataPath The path to the user data directory.
 * @param playerId The ID of the player whose character map to read.
 * @returns A promise that resolves to a map of character IDs to names.
 */
export async function readCharacterMap(userDataPath: string, playerId: string): Promise<Map<string, string>> {
    try {
        const mapFilePath = path.join(userDataPath, 'conversation_summaries', playerId, '_character_map.json');
        const characterMap = new Map<string, string>();

        if (fs.existsSync(mapFilePath)) {
            const content = fs.readFileSync(mapFilePath, 'utf8');
            const mapData = JSON.parse(content);
            for (const id in mapData) {
                characterMap.set(id, mapData[id]);
            }
        }
        
        return characterMap;
    } catch (error) {
        console.error('Error reading character map file:', error);
        throw error;
    }
}

/**
 * Saves the character map for a given player.
 * @param userDataPath The path to the user data directory.
 * @param playerId The ID of the player whose character map to save.
 * @param characterMap An object mapping character IDs to names.
 */
export async function saveCharacterMap(userDataPath: string, playerId: string, characterMap: object): Promise<void> {
    try {
        const mapFilePath = path.join(userDataPath, 'conversation_summaries', playerId, '_character_map.json');
        const summaryDir = path.dirname(mapFilePath);

        // Ensure directory exists
        if (!fs.existsSync(summaryDir)) {
            fs.mkdirSync(summaryDir, { recursive: true });
        }

        fs.writeFileSync(mapFilePath, JSON.stringify(characterMap, null, '\t'), 'utf8');
    } catch (error) {
        console.error('Error saving character map file:', error);
        throw error;
    }
}

/**
 * Saves compacted memories for a specific character.
 * This is a wrapper around the function in compactedMemoryStore.
 * @param playerId The ID of the player.
 * @param characterId The ID of the character.
 * @param memories An array of CompactedMemory objects.
 */
export async function saveCompactedMemory(playerId: string, characterId: string, memories: CompactedMemory[]): Promise<void> {
    await compactedMemoryStore.saveCompactedMemory(playerId, characterId, memories);
}

/**
 * Reads compacted memories for a specific character.
 * This is a wrapper around the function in compactedMemoryStore.
 * @param playerId The ID of the player.
 * @param characterId The ID of the character.
 * @returns A promise that resolves to an array of CompactedMemory objects.
 */
export async function readCompactedMemory(playerId: string, characterId: string): Promise<CompactedMemory[]> {
    const result = await compactedMemoryStore.readCompactedMemory(playerId, characterId);
    return result.memories;
}

/**
 * Reads all compacted memories for a given player.
 * This is a wrapper around the function in compactedMemoryStore.
 * @param playerId The ID of the player.
 * @returns A promise that resolves to a flat array of all CompactedMemory objects.
 */
export async function getAllCompactedMemories(playerId: string): Promise<CompactedMemory[]> {
    const result = await compactedMemoryStore.getAllCompactedMemories(playerId);
    return result.memories;
}

/**
 * Exports all player data to a zip file.
 * Includes: conversation_summaries, compacted_memory, diary_history, diary_summaries,
 * letter_history, letter_summaries, conversation_history, prompt_history.
 * Compacted memory files are already encrypted at rest and are exported as-is.
 * @param userDataPath The path to the user data directory (e.g., .../votc_data).
 * @param outputZipPath The full path where the zip file should be written.
 * @returns A promise that resolves when the export is complete.
 */
export async function exportPlayerData(userDataPath: string, outputZipPath: string): Promise<void> {
    const zip = new AdmZip();

    const directoriesToExport = [
        'conversation_summaries',
        'compacted_memory',
        'diary_history',
        'diary_summaries',
        'letter_history',
        'letter_summaries',
        'conversation_history',
        'prompt_history'
    ];

    for (const dirName of directoriesToExport) {
        const dirPath = path.join(userDataPath, dirName);
        if (fs.existsSync(dirPath)) {
            try {
                zip.addLocalFolder(dirPath, dirName);
                console.log(`Added ${dirName} to export archive.`);
            } catch (error) {
                console.error(`Failed to add directory ${dirName} to export archive:`, error);
                throw new Error(`Failed to export ${dirName}: ${error instanceof Error ? error.message : String(error)}`);
            }
        } else {
            console.log(`Directory ${dirName} does not exist, skipping.`);
        }
    }

    try {
        zip.writeZip(outputZipPath);
        console.log(`Player data exported successfully to: ${outputZipPath}`);
    } catch (error) {
        console.error('Failed to write export zip file:', error);
        throw new Error(`Failed to write export file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Imports player data from a zip file.
 * Extracts all directories into the user data path, overwriting existing files.
 * Compacted memory files remain encrypted at rest as they were exported as-is.
 * @param userDataPath The path to the user data directory (e.g., .../votc_data).
 * @param inputZipPath The full path to the zip file to import.
 * @returns A promise that resolves when the import is complete.
 */
export async function importPlayerData(userDataPath: string, inputZipPath: string): Promise<void> {
    if (!fs.existsSync(inputZipPath)) {
        throw new Error(`Import file not found at: ${inputZipPath}`);
    }

    let zip: AdmZip;
    try {
        zip = new AdmZip(inputZipPath);
    } catch (error) {
        console.error('Failed to read import zip file:', error);
        throw new Error(`Failed to read import file (may be corrupted): ${error instanceof Error ? error.message : String(error)}`);
    }

    const expectedDirectories = [
        'conversation_summaries',
        'memories_compacted',
        'diary_history',
        'diary_summaries',
        'letter_history',
        'letter_summaries',
        'conversation_history',
        'prompt_history'
    ];

    // For backward compatibility, also check for the old directory name
    const oldCompactedDirName = 'compacted_memory';

    const zipEntries = zip.getEntries();
    const topLevelDirs = new Set<string>();
    for (const entry of zipEntries) {
        const parts = entry.entryName.split('/');
        if (parts.length > 0 && parts[0]) {
            topLevelDirs.add(parts[0]);
        }
    }

    const hasNewCompactedDir = topLevelDirs.has('memories_compacted');
    const hasOldCompactedDir = topLevelDirs.has(oldCompactedDirName);

    if (!hasNewCompactedDir && hasOldCompactedDir) {
        console.log('Importing from an older backup with "compacted_memory". It will be renamed to "memories_compacted" after extraction.');
        // No need to modify expectedDirectories, as the extraction will handle it.
    }

    const missingDirs = expectedDirectories.filter(dir => !topLevelDirs.has(dir) && !(dir === 'memories_compacted' && hasOldCompactedDir));
    if (missingDirs.length === expectedDirectories.length) {
        throw new Error('Import file does not contain any expected VOTC data directories. The file may not be a valid VOTC player data export.');
    }
    if (missingDirs.length > 0) {
        console.warn(`Import file is missing some expected directories: ${missingDirs.join(', ')}. Continuing with available data.`);
    }

    try {
        zip.extractAllTo(userDataPath, true);
        console.log(`Player data imported successfully from: ${inputZipPath}`);

        // Post-extraction migration for backward compatibility
        const oldExtractedPath = path.join(userDataPath, oldCompactedDirName);
        const newExtractedPath = path.join(userDataPath, 'memories_compacted');
        if (fs.existsSync(oldExtractedPath) && !fs.existsSync(newExtractedPath)) {
            fs.renameSync(oldExtractedPath, newExtractedPath);
            console.log(`Renamed imported 'compacted_memory' to 'memories_compacted'.`);
        }
    } catch (error) {
        console.error('Failed to extract import zip file:', error);
        throw new Error(`Failed to extract import file: ${error instanceof Error ? error.message : String(error)}`);
    }
}
