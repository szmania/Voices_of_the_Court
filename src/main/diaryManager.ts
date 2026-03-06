
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
    await fs.promises.writeFile(filePath, JSON.stringify(diaryData, null, '\t'));
}

// Similar to getConversationHistoryFiles, but for diaries
export async function getDiaryFiles(playerId: string): Promise<string[]> {
    const diaryPath = path.join(app.getPath('userData'), 'votc_data', 'diaries', playerId);
    if (!fs.existsSync(diaryPath)) {
        return [];
    }
    const files = await fs.promises.readdir(diaryPath);
    return files.filter(file => file.endsWith('.json'));
}

// Similar to readConversationHistoryFile, but for diaries
export async function readDiaryFile(playerId: string, characterId: string): Promise<any> {
    const filePath = path.join(app.getPath('userData'), 'votc_data', 'diaries', playerId, `${characterId}.json`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
}

// Similar to saveSummaryFile, but for diaries
export async function saveDiaryFile(playerId: string, characterId: string, diaryData: any): Promise<void> {
    const diaryPath = path.join(app.getPath('userData'), 'votc_data', 'diaries', playerId);
    if (!fs.existsSync(diaryPath)) {
        fs.mkdirSync(diaryPath, { recursive: true });
    }
    const filePath = path.join(diaryPath, `${characterId}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(diaryData, null, '\t'));
}
