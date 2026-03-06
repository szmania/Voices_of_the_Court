import fs from 'fs';
import { Letter } from './Letter.js';

export async function parseLettersFromLog(debugLogPath: string, characterNameMap: Map<string, string>): Promise<Letter[]> {
    console.log(`Starting to parse log file for letters at: ${debugLogPath}`);
    
    if (!fs.existsSync(debugLogPath)) {
        console.error(`Error: Log file not found at ${debugLogPath}`);
        return [];
    }

    const fileContent = await fs.promises.readFile(debugLogPath, 'utf8');
    const lines = fileContent.split(/\r?\n/);
    
    const letters: Letter[] = [];

    for (const line of lines) {
        if (line.includes('VOTC:LETTER')) {
            const parts = line.split('/;/');
            if (parts.length >= 5) {
                // Example: [21:44:13][D][jomini_effect_impl.cpp:450]: file: events/message_events.txt line: 202 (message_event.360:option): VOTC:LETTER/;/hi how are you/;/letter_1/;/316742/;/30/;/
                const content = parts[1].trim();
                const subject = parts[2].trim();
                const recipientId = parts[3].trim();
                const senderId = parts[4].trim();

                if(content && subject && recipientId && senderId) {
                    const letter = Letter.fromLog(senderId, recipientId, subject, content, characterNameMap);
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
