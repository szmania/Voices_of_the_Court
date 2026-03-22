import fs from 'fs';
import path from 'path';
import { app } from 'electron';

function getPromptHistoryPath(playerId: string): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'votc_data', 'prompt_history', `${playerId}.json`);
}

export async function readPromptHistory(playerId: string): Promise<string[]> {
    const historyPath = getPromptHistoryPath(playerId);
    if (fs.existsSync(historyPath)) {
        try {
            const historyJson = await fs.promises.readFile(historyPath, 'utf-8');
            return JSON.parse(historyJson);
        } catch (error) {
            console.error(`Error reading prompt history for player ${playerId}:`, error);
            return [];
        }
    }
    return [];
}

export async function savePromptHistory(playerId: string, history: string[]): Promise<void> {
    const historyPath = getPromptHistoryPath(playerId);
    const historyDir = path.dirname(historyPath);

    try {
        if (!fs.existsSync(historyDir)) {
            await fs.promises.mkdir(historyDir, { recursive: true });
        }
        await fs.promises.writeFile(historyPath, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error(`Error saving prompt history for player ${playerId}:`, error);
    }
}
