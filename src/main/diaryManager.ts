
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

export async function getAllDiaryPlayerIds(userDataPath: string): Promise<string[]> {
    const diariesRootPath = path.join(userDataPath, 'diaries');
    if (!fs.existsSync(diariesRootPath)) {
        return [];
    }
    const playerDirs = await fs.promises.readdir(diariesRootPath, { withFileTypes: true });
    return playerDirs
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}

