

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DiaryEntry } from './ts/diary_interfaces';

const userDataPath = path.join(app.getPath('userData'), 'votc_data');
const diariesDir = path.join(userDataPath, 'diary_history');

function getPlayerDiaryDir(playerId: string): string {
    return path.join(diariesDir, playerId);
}

function getDiaryFilePath(playerId: string, characterId: string): string {
    return path.join(getPlayerDiaryDir(playerId), `${characterId}.json`);
}


export async function readDiarySummary(playerId: string, characterId: string): Promise<{ summary: string, date: string } | null> {
    const summaryPath = path.join(app.getPath('userData'), 'votc_data', 'diary_summaries', playerId, `${characterId}.json`);
    if (!fs.existsSync(summaryPath)) {
        return null;
    }
    const fileContent = await fs.promises.readFile(summaryPath, 'utf-8');
    const summaryData = JSON.parse(fileContent);
    return summaryData.summary ? summaryData : null;
}

export async function saveDiarySummary(playerId: string, characterId: string, summary: string, date: string): Promise<void> {
    const summaryDir = path.join(app.getPath('userData'), 'votc_data', 'diary_summaries', playerId);
    if (!fs.existsSync(summaryDir)) {
        fs.mkdirSync(summaryDir, { recursive: true });
    }
    const summaryPath = path.join(summaryDir, `${characterId}.json`);
    const summaryData = { summary: summary, date: date };
    await fs.promises.writeFile(summaryPath, JSON.stringify(summaryData, null, '\t'));
}

export async function parseDiaryIdsFromLog(logFilePath: string): Promise<{ playerId: string | null }> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(logFilePath)) {
            return reject(new Error(`Log file not found at: ${logFilePath}`));
        }

        const stream = fs.createReadStream(logFilePath, { encoding: 'utf8' });
        let lastPlayerId: string | null = null;

        stream.on('data', (chunk: string) => {
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.includes("VOTC:PLAYER_ID")) {
                    const parts = line.split('/');
                    if (parts.length > 2) {
                        lastPlayerId = parts[2].trim();
                    }
                }
            }
        });

        stream.on('end', () => {
            resolve({ playerId: lastPlayerId });
        });

        stream.on('error', (err) => {
            reject(err);
        });
    });
}

export async function getAllDiaryPlayerIds(userDataPath: string): Promise<{ id: string, name: string }[]> {
    const diariesRootPath = path.join(userDataPath, 'diary_summaries');
    if (!fs.existsSync(diariesRootPath)) {
        return [];
    }
    const playerDirs = fs.readdirSync(diariesRootPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => {
            const playerId = dirent.name;
            const mapPath = path.join(userDataPath, 'conversation_summaries', playerId, '_character_map.json');
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
    return playerDirs.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDiaryFiles(playerId: string): Promise<string[]> {
    const playerDir = getPlayerDiaryDir(playerId);
    if (!fs.existsSync(playerDir)) {
        return [];
    }
    return fs.readdirSync(playerDir).filter(file => file.endsWith('.json') && file !== '_character_map.json');
}

export async function readDiaryFile(playerId: string, characterId: string): Promise<{ diary_entries: DiaryEntry[] }> {
    const filePath = getDiaryFilePath(playerId, characterId);
    if (!fs.existsSync(filePath)) {
        return { diary_entries: [] };
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        // Handle both array and object formats
        const entries = Array.isArray(data) ? data : data.diary_entries || [];
        return { diary_entries: entries.sort((a: { date: string; }, b: { date: string; }) => new Date(b.date).getTime() - new Date(a.date).getTime()) };
    } catch (error) {
        console.error(`Error reading diary file for player ${playerId}, character ${characterId}:`, error);
        return { diary_entries: [] };
    }
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
    diaryFileContent.diary_entries.sort((a: { date: string; }, b: { date: string; }) => new Date(b.date).getTime() - new Date(a.date).getTime());

    await fs.promises.writeFile(filePath, JSON.stringify(diaryFileContent, null, '\t'));
}

export async function getCharacterMap(playerId: string): Promise<{ [key: string]: string }> {
    const userDataPath = app.getPath('userData');
    const mapPath = path.join(userDataPath, 'votc_data', 'diary_history', playerId, '_character_map.json');
    if (fs.existsSync(mapPath)) {
        try {
            return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        } catch (e) {
            console.error(`Error reading character map for player ${playerId}:`, e);
        }
    }
    return {};
}

export async function getAllDiarySummaries(playerId: string): Promise<{ summary: string, date: string, characterId: string, characterName: string }[]> {
    const summaryDir = path.join(diariesDir, '..', 'diary_summaries', playerId);
    if (!fs.existsSync(summaryDir)) {
        return [];
    }

    const characterMap = await getCharacterMap(playerId);
    const summaryFiles = fs.readdirSync(summaryDir).filter(file => file.endsWith('.json') && file !== '_character_map.json');
    const allSummaries: { summary: string, date: string, characterId: string, characterName: string }[] = [];

    for (const file of summaryFiles) {
        const characterId = path.basename(file, '.json');
        const summaryPath = path.join(summaryDir, file);
        try {
            const fileContent = await fs.promises.readFile(summaryPath, 'utf-8');
            const summaryData = JSON.parse(fileContent);
            if (summaryData.summary) {
                allSummaries.push({
                    summary: summaryData.summary,
                    date: summaryData.date,
                    characterId: characterId,
                    characterName: characterMap[characterId] || `Character ${characterId}`
                });
            }
        } catch (error) {
            console.error(`Error reading diary summary file ${summaryPath}:`, error);
        }
    }
    return allSummaries;
}
