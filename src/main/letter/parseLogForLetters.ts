import fs from 'fs';
import { Letter } from './Letter.js';
import { LetterManager } from './LetterManager.js';

export async function parseLettersFromLog(debugLogPath: string, characterNameMap: Map<string, string>, gameDate: string, playerId?: string, recipientId?: string): Promise<Letter[]> {
    console.log(`Starting to parse log file for letters at: ${debugLogPath}`);
    
    if (!fs.existsSync(debugLogPath)) {
        console.error(`Error: Log file not found at ${debugLogPath}`);
        return [];
    }

    // More efficient log reading - read the last 256KB, which should be enough for recent letters.
    const CHUNK_SIZE = 256 * 1024; // 256KB
    let fileContent = '';
    let handle;
    try {
        handle = await fs.promises.open(debugLogPath, 'r');
        const { size } = await handle.stat();
        const position = Math.max(0, size - CHUNK_SIZE);
        const buffer = Buffer.alloc(size - position);
        await handle.read(buffer, 0, buffer.length, position);
        fileContent = buffer.toString('utf8');
    } catch (err) {
        console.error(`Error reading log file for letters: ${err}`);
        return [];
    } finally {
        if (handle) await handle.close();
    }

    const lines = fileContent.split(/\r?\n/);
    
    const letters: Letter[] = [];

    for (const line of lines) {
        if (line.includes('VOTC:LETTER')) {
            const votcIndex = line.indexOf('VOTC:LETTER');
            if (votcIndex === -1) continue;

            const dataString = line.substring(votcIndex + 'VOTC:LETTER'.length);
            const parts = dataString.split('/;/').slice(1);

            if (parts.length >= 4) {
                const content = parts[0].trim();
                const subject = parts[1].trim(); // This is letterId, using as subject
                const totalDays = parseInt(parts[2].trim(), 10) || 0;
                const delay = parseInt(parts[3].trim(), 10) || 0;

                if(content && subject && playerId && recipientId) {
                    const letter = Letter.fromLog(playerId, recipientId, subject, content, characterNameMap, gameDate, delay, totalDays);
                    if (letter) {
                        letters.push(letter);
                        // If a playerId is provided, save the letter immediately.
                        LetterManager.getInstance().saveLetter(letter, playerId);
                    }
                }
            }
        }
    }
    
    console.log(`Parsed ${letters.length} letters from log.`);
    return letters;
}
