
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export async function parseDiaryIdsFromLog(logFilePath: string): Promise<{ playerId: string | null }> {
    try {
        if (!fs.existsSync(logFilePath)) {
            throw new Error(`Log file not found: ${logFilePath}`);
        }

        const logContent = fs.readFileSync(logFilePath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());

        let diaryLine = '';
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('VOTC:DIARY')) {
                diaryLine = lines[i];
                break;
            }
        }

        if (!diaryLine) {
            for (let i = lines.length - 1; i >= 0; i--) {
                if (lines[i].includes('VOTC:conversation_history')) {
                    diaryLine = lines[i];
                    break;
                }
            }
        }

        if (!diaryLine) {
            throw new Error('No VOTC:DIARY or VOTC:conversation_history line found in the log');
        }

        const parts = diaryLine.split('/;/');
        if (parts.length < 2) {
            throw new Error('VOTC line format is incorrect');
        }

        const playerId = parts[1].trim();

        if (!playerId) {
            throw new Error('Could not parse player ID from the log line');
        }

        return { playerId };
    } catch (error) {
        console.error('Error parsing diary IDs from log:', error);
        throw error;
    }
}

export async function getDiaryFiles(playerId: string): Promise<string[]> {
    const diaryPath = path.join(app.getPath('userData'), 'votc_data', 'diary_history', playerId);
    if (!fs.existsSync(diaryPath)) {
        return [];
    }
    const files = await fs.promises.readdir(diaryPath);
    return files.filter(file => file.endsWith('.json'));
}

export async function readDiaryFile(playerId: string, characterId: string): Promise<any> {
    const filePath = path.join(app.getPath('userData'), 'votc_data', 'diary_history', playerId, `${characterId}.json`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
}

export async function saveDiaryFile(playerId: string, characterId: string, diaryData: any): Promise<void> {
    const diaryPath = path.join(app.getPath('userData'), 'votc_data', 'diary_history', playerId);
    if (!fs.existsSync(diaryPath)) {
        fs.mkdirSync(diaryPath, { recursive: true });
    }
    const filePath = path.join(diaryPath, `${characterId}.json`);

    // Case 1: diaryData is a complete file structure from the manager UI, so just overwrite.
    if (diaryData && diaryData.diary_entries && Array.isArray(diaryData.diary_entries)) {
        await fs.promises.writeFile(filePath, JSON.stringify(diaryData, null, '\t'));
        return;
    }

    // Case 2: diaryData is a single new entry from the conversation flow. Read, prepend, and write.
    let diaryFileContent: { diary_entries: any[] } = { diary_entries: [] };
    if (fs.existsSync(filePath)) {
        try {
            const fileContent = await fs.promises.readFile(filePath, 'utf-8');
            if (fileContent) {
                const parsedContent = JSON.parse(fileContent);
                if (parsedContent && Array.isArray(parsedContent.diary_entries)) {
                    diaryFileContent = parsedContent;
                } else if (parsedContent && typeof parsedContent === 'object' && !Array.isArray(parsedContent)) {
                    // Handle migration of old single-object format
                    diaryFileContent.diary_entries.push(parsedContent);
                }
            }
        } catch (e) {
            console.error(`Error reading or parsing diary file ${filePath}, it will be overwritten.`, e);
        }
    }

    // Add the new single entry to the beginning of the array
    diaryFileContent.diary_entries.unshift(diaryData);

    await fs.promises.writeFile(filePath, JSON.stringify(diaryFileContent, null, '\t'));
}

export async function readDiarySummary(playerId: string, characterId: string): Promise<string | null> {
    const summaryPath = path.join(app.getPath('userData'), 'votc_data', 'diary_summaries', playerId, `${characterId}.json`);
    if (!fs.existsSync(summaryPath)) {
        return null;
    }
    const fileContent = await fs.promises.readFile(summaryPath, 'utf-8');
    const summaryData = JSON.parse(fileContent);
    return summaryData.summary || null;
}

export async function saveDiarySummary(playerId: string, characterId: string, summary: string): Promise<void> {
    const summaryDir = path.join(app.getPath('userData'), 'votc_data', 'diary_summaries', playerId);
    if (!fs.existsSync(summaryDir)) {
        fs.mkdirSync(summaryDir, { recursive: true });
    }
    const summaryPath = path.join(summaryDir, `${characterId}.json`);
    const summaryData = { summary: summary };
    await fs.promises.writeFile(summaryPath, JSON.stringify(summaryData, null, '\t'));
}

export async function getAllDiaryPlayerIds(userDataPath: string): Promise<{ id: string, name: string }[]> {
    const diariesRootPath = path.join(userDataPath, 'diary_history');
    if (!fs.existsSync(diariesRootPath)) {
        return [];
    }
    const playerDirs = await fs.promises.readdir(diariesRootPath, { withFileTypes: true });
    return playerDirs
        .filter(dirent => dirent.isDirectory())
        .map(dirent => {
            const playerId = dirent.name;
            const mapPath = path.join(diariesRootPath, playerId, '_character_map.json');
            let playerName = `Player ${playerId}`; // Fallback name
            if (fs.existsSync(mapPath)) {
                try {
                    const mapContent = fs.readFileSync(mapPath, 'utf8');
                    const mapData = JSON.parse(mapContent);
                    // The player's name is also in the map, with their ID as the key
                    if (mapData[playerId]) {
                        playerName = mapData[playerId];
                    }
                } catch (e) {
                    console.error(`Error reading character map for player ${playerId}:`, e);
                }
            }
            return { id: playerId, name: playerName };
        });
}

export async function getCharacterMap(playerId: string): Promise<{ [key: string]: string }> {
    const userDataPath = app.getPath('userData');
    const mapPath = path.join(userDataPath, 'votc_data', 'diary_history', playerId, '_character_map.json');
    if (fs.existsSync(mapPath)) {
        try {
            const mapContent = await fs.promises.readFile(mapPath, 'utf8');
            return JSON.parse(mapContent);
        } catch (e) {
            console.error(`Error reading character map for player ${playerId}:`, e);
        }
    }
    return {};
}

