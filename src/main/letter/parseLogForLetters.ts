import fs from 'fs';
import { Letter as LetterClass } from './Letter.js';
import { Letter } from './letterInterfaces.js';
import { LetterManager } from './LetterManager.js';
import { GameData } from '../../shared/gameData/GameData.js';
import { Config } from '../../shared/Config.js';
import { LetterActionTrigger } from './LetterActionTrigger.js';

function totalDaysToDateString(totalDays: number): string {
    const year = Math.max(1, 867 + Math.floor(totalDays / 365));
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

export async function parseLettersFromLog(debugLogPath: string, gameData: GameData, gameDate: string, config: Config, playerId?: string, recipientId?: string): Promise<Letter[]> {
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
                const delay = parseInt(parts[3].trim(), 10) || 0;
                const senderIdFromLog = parts[4] ? parts[4].trim() : undefined;
                const recipientIdFromLog = parts[5] ? parts[5].trim() : undefined;

                // Use the playerId and recipientId from the function arguments if they exist,
                // as they are more reliable than the potentially swapped log values.
                const finalSenderId = playerId || senderIdFromLog;
                const finalRecipientId = recipientId || recipientIdFromLog;

                // Parse triggered actions from remaining parts (parts[6+])
                // Format: signature:arg1,arg2,...:triggerOn
                const triggeredActions: any[] = [];
                for (let i = 6; i < parts.length; i++) {
                    const actionPart = parts[i].trim();
                    if (actionPart) {
                        const actionFields = actionPart.split(":");
                        if (actionFields.length >= 3) {
                            const signature = actionFields[0];
                            const argsStr = actionFields[1];
                            const triggerOn = actionFields[2];
                            const args = argsStr ? argsStr.split(",").map(a => {
                                const num = Number(a);
                                return isNaN(num) ? a : num;
                            }) : [];
                            triggeredActions.push({ signature, args, triggerOn });
                        }
                    }
                }

                if (content && letterId && finalSenderId && finalRecipientId) {
                    const sender = gameData.characters.get(Number(finalSenderId));
                    const recipient = gameData.characters.get(Number(finalRecipientId));

                    if (sender && recipient) {
                        const letterGameDate = totalDaysToDateString(writtenDateInDays);
                        const letter = LetterClass.fromLog(sender, recipient, letterId, content, letterGameDate, delay, writtenDateInDays);
                        if (letter) {
                            letter.triggeredActions = triggeredActions;
                            if (letter.associatedAction?.triggerOn === 'receive') {
                                LetterActionTrigger.executeLetterAction(letter, letter.associatedAction, config);
                            }
                            letters.push(letter);
                            // The player is the sender of the letter being imported from the log
                            LetterManager.getInstance().saveLetter(letter, finalSenderId);
                        }
                    } else {
                        console.error(`Could not find sender (${finalSenderId}) or recipient (${finalRecipientId}) in gameData for letter.`);
                    }
                }
            }
        }
    }

    console.log(`Parsed ${letters.length} letters from log.`);
    return letters;
}
