/**
 * Gets all player IDs by scanning summary directories.
 * @param userDataPath The path to the user data directory (e.g., .../votc_data).
 * @returns A promise that resolves to an array of player ID strings.
 */
export async function getAllPlayerIds(userDataPath: string): Promise<string[]> {
    try {
        const summaryDir = path.join(userDataPath, 'conversation_summaries');
        if (!fs.existsSync(summaryDir)) {
            return []; // Return empty array if the base directory doesn't exist
        }

        const playerDirs = fs.readdirSync(summaryDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        return playerDirs;
    } catch (error) {
        console.error('Error getting all player IDs from summaries:', error);
        throw error;
    }
}

import fs from 'fs';
import path from 'path';

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
 * @returns A promise that resolves to an array of all summaries.
 */
export async function readSummaryFile(userDataPath: string, playerId: string): Promise<any[]> {
    try {
        const summaryDir = path.join(userDataPath, 'conversation_summaries', playerId);
        
        // Ensure directory exists
        if (!fs.existsSync(summaryDir)) {
            fs.mkdirSync(summaryDir, { recursive: true });
            return [];
        }
        
        // Read all JSON files in the directory
        const files = fs.readdirSync(summaryDir).filter(file => file.endsWith('.json'));
        const allSummaries = [];
        
        for (const file of files) {
            const filePath = path.join(summaryDir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const summaries = JSON.parse(content);
                // Add character ID info to each summary
                const characterId = path.basename(file, '.json');
                const summariesWithCharacterId = summaries.map((summary: any) => ({
                    ...summary,
                    characterId
                }));
                allSummaries.push(...summariesWithCharacterId);
            } catch (error) {
                console.error(`Failed to read file ${filePath}:`, error);
            }
        }
        
        // Sort by date
        allSummaries.sort((a, b) => {
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
        
        return allSummaries;
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
export async function saveSummaryFile(userDataPath: string, playerId: string, summaries: any[]): Promise<void> {
    try {
        const summaryDir = path.join(userDataPath, 'conversation_summaries', playerId);
        
        // Ensure directory exists
        if (!fs.existsSync(summaryDir)) {
            fs.mkdirSync(summaryDir, { recursive: true });
        }
        
        // Group summaries by character ID
        const summariesByCharacter: { [key: string]: any[] } = {};
        summaries.forEach(summary => {
            const characterId = summary.characterId || 'default';
            if (!summariesByCharacter[characterId]) {
                summariesByCharacter[characterId] = [];
            }
            summariesByCharacter[characterId].push(summary);
        });
        
        // Create a separate file for each character
        for (const [characterId, characterSummaries] of Object.entries(summariesByCharacter)) {
            const summaryFilePath = path.join(summaryDir, `${characterId}.json`);
            
            // Remove characterId field as it is already in the filename
            const cleanSummaries = characterSummaries.map((summary: any) => {
                const { characterId, ...cleanSummary } = summary;
                return cleanSummary;
            });
            
            // Write to file
            fs.writeFileSync(summaryFilePath, JSON.stringify(cleanSummaries, null, '\t'), 'utf8');
        }
    } catch (error) {
        console.error('Error saving summary file:', error);
        throw error;
    }
}
