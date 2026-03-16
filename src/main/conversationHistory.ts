import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Parse player ID from debug log
export async function parseConversationHistoryIdsFromLog(logFilePath: string): Promise<{playerId: string}> {
    try {
        if (!fs.existsSync(logFilePath)) {
            throw new Error(`Log file does not exist: ${logFilePath}`);
        }
        
        const logContent = fs.readFileSync(logFilePath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        
        // Find the last line containing VOTC:conversation_history
        let conversationHistoryLine = '';
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('VOTC:conversation_history')) {
                conversationHistoryLine = lines[i];
                break;
            }
        }
        
        if (!conversationHistoryLine) {
            throw new Error('VOTC:conversation_history line not found in log');
        }
        
        // Parse format: VOTC:conversation_history/;/PlayerID
        const parts = conversationHistoryLine.split('/;/');
        if (parts.length < 2) {
            throw new Error('VOTC:conversation_history line has incorrect format');
        }
        
        const playerId = parts[1].trim();
        
        if (!playerId) {
            throw new Error('Could not parse player ID from VOTC:conversation_history line');
        }
        
        return { playerId };
    } catch (error) {
        console.error('Error parsing conversation history ID:', error);
        throw error;
    }
}

// Read list of historical conversation files
export async function getConversationHistoryFiles(playerId: string, currentCharacterIds: number[]): Promise<Array<{fileName: string, modifiedTime: number}>> {
    try {
        // Build path to conversation history directory - using userdata's conversation_history directory
        const userDataPath = app.getPath('userData');
        const conversationHistoryDir = path.join(userDataPath, 'votc_data', 'conversation_history', playerId);
        
        // Ensure directory exists
        if (!fs.existsSync(conversationHistoryDir)) {
            console.log(`Conversation history directory does not exist: ${conversationHistoryDir}`);
            return [];
        }
        
        const currentIdSet = new Set(currentCharacterIds.map(String));

        // Read all txt files in the directory
        const files = fs.readdirSync(conversationHistoryDir).filter(file => {
            if (!file.endsWith('.txt')) return false;

            const nameParts = file.replace('.txt', '').split('_');
            if (nameParts.length < 2) return false; // Must have at least playerid and timestamp

            const timestamp = nameParts.pop(); // Remove and check timestamp
            if (isNaN(Number(timestamp))) return false;

            const fileCharacterIds = new Set(nameParts);

            if (fileCharacterIds.size !== currentIdSet.size) return false;

            for (const id of currentIdSet) {
                if (!fileCharacterIds.has(id)) {
                    return false;
                }
            }
            return true;
        });
        
        // Get modification time for each file
        const filesWithStats = files.map(fileName => {
            const filePath = path.join(conversationHistoryDir, fileName);
            const stats = fs.statSync(filePath);
            return {
                fileName,
                modifiedTime: stats.mtime.getTime()
            };
        });
        
        // Sort by modification time, descending (newest first)
        filesWithStats.sort((a, b) => b.modifiedTime - a.modifiedTime);
        
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
        if (!fs.existsSync(filePath)) {
            throw new Error(`Conversation history file does not exist: ${filePath}`);
        }
        
        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        return content;
    } catch (error) {
        console.error('Error reading conversation history file:', error);
        throw error;
    }
}
