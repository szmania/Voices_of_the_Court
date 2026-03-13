

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DiaryEntry, DiarySummary } from './ts/diary_interfaces';
import { randomUUID } from 'crypto';

const userDataPath = path.join(app.getPath('userData'), 'votc_data');
const diariesDir = path.join(userDataPath, 'diary_history');
const diarySummariesDir = path.join(userDataPath, 'diary_summaries');

function getPlayerDiaryDir(playerId: string): string {
    return path.join(diariesDir, playerId);
}

function getDiaryFilePath(playerId: string, characterId: string): string {
    return path.join(getPlayerDiaryDir(playerId), `${characterId}.json`);
}

function getDiarySummaryFilePath(playerId: string, characterId: string): string {
    const playerSummaryDir = path.join(diarySummariesDir, playerId);
    if (!fs.existsSync(playerSummaryDir)) {
        fs.mkdirSync(playerSummaryDir, { recursive: true });
    }
    return path.join(playerSummaryDir, `${characterId}.json`);
}

export async function readDiarySummaries(playerId: string, characterId: string): Promise<DiarySummary[]> {
    const summaryPath = getDiarySummaryFilePath(playerId, characterId);
    if (!fs.existsSync(summaryPath)) {
        return [];
    }
    const fileContent = await fs.promises.readFile(summaryPath, 'utf-8');
    try {
        const data = JSON.parse(fileContent);

        if (Array.isArray(data)) {
            // New format (array of summaries). Ensure all items are valid.
            return data.map(s => {
                if (typeof s === 'object' && s !== null && s.summary && s.date) {
                    return {
                        id: s.id || randomUUID(),
                        diaryEntryId: s.diaryEntryId || '',
                        date: s.date,
                        summary: s.summary,
                        characterId: characterId
                    };
                }
                return null;
            }).filter((s): s is DiarySummary => s !== null);
        } else if (typeof data === 'object' && data !== null && data.summary && data.date) {
            // Old format (single summary object).
            return [{
                id: randomUUID(),
                diaryEntryId: '',
                date: data.date,
                summary: data.summary,
                characterId: characterId
            }];
        }
    } catch (error) {
        console.error(`Error parsing diary summary file ${summaryPath}:`, error);
    }

    return [];
}

export async function saveDiarySummaries(playerId: string, characterId: string, summaries: DiarySummary[]): Promise<void> {
    const summaryPath = getDiarySummaryFilePath(playerId, characterId);
    await fs.promises.writeFile(summaryPath, JSON.stringify(summaries, null, '\t'));
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

export async function getAllDiarySummaries(playerId: string): Promise<(DiarySummary & { characterName: string })[]> {
    const summaryDir = path.join(diarySummariesDir, playerId);
    if (!fs.existsSync(summaryDir)) {
        return [];
    }

    const characterMap = await getCharacterMap(playerId);
    const summaryFiles = fs.readdirSync(summaryDir).filter(file => file.endsWith('.json') && file !== '_character_map.json');
    const allSummaries: (DiarySummary & { characterName: string })[] = [];

    for (const file of summaryFiles) {
        const characterId = path.basename(file, '.json');
        try {
            const summaries = await readDiarySummaries(playerId, characterId);
            const characterName = characterMap[characterId] || `Character ${characterId}`;
            summaries.forEach(summary => {
                allSummaries.push({
                    ...summary,
                    characterName: characterName
                });
            });
        } catch (error) {
            console.error(`Error reading diary summary file for character ${characterId}:`, error);
        }
    }
    allSummaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allSummaries;
}
