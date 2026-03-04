import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Parse player ID from debug log
export async function parseSummaryIdsFromLog(logFilePath: string): Promise<{playerId: string}> {
    try {
        if (!fs.existsSync(logFilePath)) {
            throw new Error(`Log file does not exist: ${logFilePath}`);
        }
        
        const logContent = fs.readFileSync(logFilePath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        
        // Find the last line containing VOTC:summary_manager
        let summaryManageLine = '';
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('VOTC:summary_manager')) {
                summaryManageLine = lines[i];
                break;
            }
        }
        
        if (!summaryManageLine) {
            throw new Error('Could not find VOTC:summary_manager line in log');
        }
        
        // Parse format: VOTC:summary_manager/;/PlayerID/CharacterID
        const parts = summaryManageLine.split('/;/');
        if (parts.length < 2) {
            throw new Error('VOTC:summary_manager line format is incorrect');
        }
        
        const playerId = parts[1].trim();
        
        if (!playerId) {
            throw new Error('Unable to parse player ID from VOTC:summary_manager line');
        }
        
        return { playerId };
    } catch (error) {
        console.error('Error parsing summary IDs:', error);
        throw error;
    }
}

// Read summary file
export async function readSummaryFile(playerId: string): Promise<any[]> {
    try {
        // Build summary directory path
        const userDataPath = path.join(app.getPath("userData"), 'votc_data');
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
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        
        return allSummaries;
    } catch (error) {
        console.error('Error reading summary file:', error);
        throw error;
    }
}

// Save summary file
export async function saveSummaryFile(playerId: string, summaries: any[]): Promise<void> {
    try {
        // Build summary directory path
        const userDataPath = path.join(app.getPath("userData"), 'votc_data');
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
