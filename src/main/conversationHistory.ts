import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';

// Read list of historical conversation files
export async function getConversationHistoryFiles(playerId: string, currentCharacterIds: number[], limit: number): Promise<Array<{fileName: string, modifiedTime: number}>> {
    try {
        // Build path to conversation history directory - using userdata's conversation_history directory
        const userDataPath = app.getPath('userData');
        const conversationHistoryDir = path.join(userDataPath, 'votc_data', 'conversation_history', playerId);
        
        // Ensure directory exists
        try {
            await fs.access(conversationHistoryDir);
        } catch {
            console.log(`Conversation history directory does not exist: ${conversationHistoryDir}`);
            return [];
        }
        
        const currentIdSet = new Set(currentCharacterIds.map(String));

        // Read all txt files in the directory
        const allFiles = await fs.readdir(conversationHistoryDir);
        const filteredFiles = allFiles.filter(file => {
            if (!file.endsWith('.txt')) return false;

            const nameParts = file.replace('.txt', '').split('_');
            if (nameParts.length < 2) return false; // Must have at least one character id and a timestamp

            const timestamp = nameParts.pop(); // Remove and check timestamp
            if (isNaN(Number(timestamp))) return false;

            const fileCharacterIds = new Set(nameParts);
            
            // New logic: Check if the characters in the history file are a subset of the current characters.
            for (const id of fileCharacterIds) {
                if (!currentIdSet.has(id)) {
                    return false; // History has a character not in the current conversation
                }
            }
            return true;
        });
        
        // Get modification time for each file
        const filesWithStats = await Promise.all(filteredFiles.map(async (fileName) => {
            const filePath = path.join(conversationHistoryDir, fileName);
            const stats = await fs.stat(filePath);
            return {
                fileName,
                modifiedTime: stats.mtime.getTime()
            };
        }));
        
        // Sort by modification time, descending (newest first)
        filesWithStats.sort((a, b) => b.modifiedTime - a.modifiedTime);
        
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

// Read content of a specific historical conversation file
export async function readConversationHistoryFile(playerId: string, fileName: string): Promise<string> {
    try {
        // Build path to conversation history file - using userdata's conversation_history directory
        const userDataPath = app.getPath('userData');
        const filePath = path.join(userDataPath, 'votc_data', 'conversation_history', playerId, fileName);
        
        // Ensure file exists
        await fs.access(filePath);
        
        // Read file content
        const content = await fs.readFile(filePath, 'utf8');
        
        return content;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
             throw new Error(`Conversation history file does not exist: ${filePath}`);
        }
        console.error('Error reading conversation history file:', error);
        throw error;
    }
}
