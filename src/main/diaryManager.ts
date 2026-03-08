
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
    const diaryPath = path.join(app.getPath('userData'), 'votc_data', 'diaries', playerId);
    if (!fs.existsSync(diaryPath)) {
        return [];
    }
    const files = await fs.promises.readdir(diaryPath);
    return files.filter(file => file.endsWith('.json'));
}

export async function readDiaryFile(playerId: string, characterId: string): Promise<any> {
    const filePath = path.join(app.getPath('userData'), 'votc_data', 'diaries', playerId, `${characterId}.json`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
}

export async function saveDiaryFile(playerId: string, characterId: string, diaryData: any): Promise<void> {
    const diaryPath = path.join(app.getPath('userData'), 'votc_data', 'diaries', playerId);
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

export async function getAllDiaryPlayerIds(userDataPath: string): Promise<{ id: string, name: string }[]> {
    const diariesRootPath = path.join(userDataPath, 'diaries');
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
    const mapPath = path.join(userDataPath, 'votc_data', 'diaries', playerId, '_character_map.json');
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

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DiaryEntry } from './ts/diary_interfaces';

const userDataPath = path.join(app.getPath('userData'), 'votc_data');
const diariesDir = path.join(userDataPath, 'diaries');

function getPlayerDiaryDir(playerId: string): string {
    return path.join(diariesDir, playerId);
}

function getDiaryFilePath(playerId: string, characterId: string): string {
    return path.join(getPlayerDiaryDir(playerId), `${characterId}.json`);
}

export async function parseDiaryIdsFromLog(logPath: string): Promise<{ playerId: string | null }> {
    // This function can be implemented similarly to how summary/conversation history IDs are parsed
    // For now, we'll just return a placeholder
    return { playerId: null };
}

export async function getAllDiaryPlayerIds(): Promise<{ id: string, name: string }[]> {
    if (!fs.existsSync(diariesDir)) {
        return [];
    }
    const playerDirs = fs.readdirSync(diariesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => {
            const playerId = dirent.name;
            const mapPath = path.join(diariesDir, playerId, '_character_map.json');
            let playerName = `Player ${playerId}`;
            if (fs.existsSync(mapPath)) {
                try {
                    const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
                    if (mapData[playerId]) {
                        playerName = mapData[playerId];
                    }
                } catch (e) {
                    console.error(`Error reading character map for player ${playerId}:`, e);
                }
            }
            return { id: playerId, name: playerName };
        });
    return playerDirs;
}

export async function getDiaryFiles(playerId: string): Promise<string[]> {
    const playerDir = getPlayerDiaryDir(playerId);
    if (!fs.existsSync(playerDir)) {
        return [];
    }
    return fs.readdirSync(playerDir).filter(file => file.endsWith('.json') && file !== '_character_map.json');
}

export async function readDiaryFile(playerId: string, characterId: string): Promise<DiaryEntry[]> {
    const filePath = getDiaryFilePath(playerId, characterId);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const entries: DiaryEntry[] = JSON.parse(content);
        return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
        console.error(`Error reading diary file for player ${playerId}, character ${characterId}:`, error);
        return [];
    }
}

export async function saveDiaryFile(playerId: string, characterId: string, newEntry: DiaryEntry): Promise<void> {
    const playerDir = getPlayerDiaryDir(playerId);
    if (!fs.existsSync(playerDir)) {
        fs.mkdirSync(playerDir, { recursive: true });
    }
    const filePath = getDiaryFilePath(playerId, characterId);
    let entries: DiaryEntry[] = [];
    if (fs.existsSync(filePath)) {
        try {
            entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`Error parsing existing diary file, it will be overwritten:`, error);
        }
    }
    entries.unshift(newEntry);
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(filePath, JSON.stringify(entries, null, '\t'), 'utf8');
}

export async function getCharacterMap(playerId: string): Promise<{ [key: string]: string }> {
    const mapPath = path.join(getPlayerDiaryDir(playerId), '_character_map.json');
    if (fs.existsSync(mapPath)) {
        try {
            return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        } catch (e) {
            console.error(`Error reading character map for player ${playerId}:`, e);
        }
    }
    return {};
}
