import fs from 'fs';
import { Letter } from './Letter.js';
import { LetterManager } from './LetterManager.js';
import { GameData } from '../../shared/gameData/GameData.js';

function totalDaysToDateString(totalDays: number): string {
    const year = Math.floor(totalDays / 365);
    const dayOfYear = (totalDays % 365) + 1; // 1-indexed day

    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let day = dayOfYear;
    let month = 1;

    for (let i = 0; i < monthDays.length; i++) {
        if (day <= monthDays[i]) {
            month = i + 1;
            break;
        }
        day -= monthDays[i];
    }

    // Returns "867.10.22"
    return `${year}.${month.toString().padStart(2, '0')}.${day.toString().padStart(2, '0')}`;
}

export async function parseLettersFromLog(debugLogPath: string, gameData: GameData, gameDate: string, playerId?: string, recipientId?: string): Promise<Letter[]> {
    console.log(`Starting to parse log file for letters at: ${debugLogPath}`);

    if (!fs.existsSync(debugLogPath)) {
        console.error(`Error: Log file not found at ${debugLogPath}`);
        return [];
    }

    // More efficient log reading - read the last 1MB, which should be enough for recent letters and character data
    const CHUNK_SIZE = 1024 * 1024; // 1MB
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

            if (parts.length >= 3) {
                const content = parts[0].trim();
                const letterId = parts[1].trim(); // This is letterId, using as subject
                const writtenDateInDays = parseInt(parts[2].trim());
                const travelTime = gameData.totalDays > writtenDateInDays ? gameData.totalDays - writtenDateInDays : 0;
                const delay = parseInt(parts[3].trim(), 10) || 0;
                const senderIdFromLog = parts[4] ? parts[4].trim() : playerId; // Use sender from log if available
                const recipientIdFromLog = parts[5] ? parts[5].trim() : recipientId; // Use recipient from log if available

                if(content && letterId && playerId && recipientId) {
                    const sender = gameData.characters.get(Number(playerId));
                    const recipient = gameData.characters.get(Number(recipientId));

                    if (sender && recipient) {
                        const correctedGameDate = totalDaysToDateString(gameData.totalDays);
                        const letter = Letter.fromLog(sender, recipient, letterId, content, correctedGameDate, delay, travelTime);
                        if (letter) {
                            letters.push(letter);
                            // If a playerId is provided, save the letter immediately.
                            LetterManager.getInstance().saveLetter(letter, playerId);
                        }
                    } else {
                        console.error(`Could not find sender (${playerId}) or recipient (${recipientId}) in gameData for letter.`);
                    }
                }
            }
        }
    }

    console.log(`Parsed ${letters.length} letters from log.`);
    return letters;
}
