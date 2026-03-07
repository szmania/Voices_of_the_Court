import fs from 'fs';
import { Letter } from './Letter.js';

export async function parseLettersFromLog(debugLogPath: string, characterNameMap: Map<string, string>, gameDate: string): Promise<Letter[]> {
    console.log(`Starting to parse log file for letters at: ${debugLogPath}`);
    
    if (!fs.existsSync(debugLogPath)) {
        console.error(`Error: Log file not found at ${debugLogPath}`);
        return [];
    }

    // More efficient log reading
    const CHUNK_SIZE = 64 * 1024; // 64KB chunks
    const handle = await fs.promises.open(debugLogPath, 'r');
    const { size } = await handle.stat();
    const position = Math.max(0, size - CHUNK_SIZE);
    const buffer = Buffer.alloc(size - position);
    await handle.read(buffer, 0, buffer.length, position);
    await handle.close();

    const fileContent = buffer.toString('utf8');
    const lines = fileContent.split(/\r?\n/);
    
    const letters: Letter[] = [];

    for (const line of lines) {
        if (line.includes('VOTC:LETTER')) {
            const parts = line.split('/;/');
            if (parts.length >= 5) {
                const content = parts[1].trim();
                const subject = parts[2].trim();
                const recipientId = parts[3].trim();
                const senderId = parts[4].trim();
                const delay = parts.length > 5 ? parseInt(parts[5].trim(), 10) || 0 : 0;
                const totalDays = parts.length > 6 ? parseInt(parts[6].trim(), 10) || 0 : 0;

                if(content && subject && recipientId && senderId) {
                    const letter = Letter.fromLog(senderId, recipientId, subject, content, characterNameMap, gameDate, delay, totalDays);
                    if (letter) {
                        letters.push(letter);
                    }
                }
            }
        }
    }
    
    console.log(`Parsed ${letters.length} letters from log.`);
    return letters;
}
