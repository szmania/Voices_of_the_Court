import fs from 'fs';
import { Letter as LetterClass } from './Letter.js';
import { Letter } from './letterInterfaces.js';
import { LetterManager } from './LetterManager.js';
import { GameData } from '../../shared/gameData/GameData.js';
import { Config } from '../../shared/Config.js';
import { LetterActionTrigger } from './LetterActionTrigger.js';

function totalDaysToDateString(totalDays: number): string {
    // The mod writes GetDateAsTotalDays, which is an absolute year*365+dayOfYear
    // count (verified: 430583 == 5 Sep 1179). Upstream's 867 + ... offset assumes
    // days-since-867 and shifts every displayed date 867 years into the future.
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
    let parseTimeOffset = 0;

    for (const line of lines) {
        if (line.includes('VOTC:LETTER')) {
            const votcIndex = line.indexOf('VOTC:LETTER');
            if (votcIndex === -1) continue;

            const dataString = line.substring(votcIndex + 'VOTC:LETTER'.length);
            const parts = dataString.split('/;/').slice(1);

            if (parts.length >= 3) {
                const content = parts[0].trim();
                // Control lines from pre-receipt delivery payloads (e.g.
                // VOTC:LETTER/;/run_skipped) are not letters.
                if (content === 'run_skipped') continue;
                const letterId = parts[1].trim(); // This is letterId, using as subject
                // Whisper Ledger requests share the VOTC:LETTER line shape but are
                // routed by the dedicated whisper channel (letterId === 'whisper').
                // They must never enter the letter store: no fake self-addressed
                // letters, threads, or summaries in the Letters UI/history.
                if (letterId === 'whisper') continue;
                let writtenDateInDays = parseInt(parts[2].trim());
                if (isNaN(writtenDateInDays) || writtenDateInDays <= 0) {
                    writtenDateInDays = gameData.totalDays; // Fallback only if missing or invalid
                }
                const delay = parseInt(parts[3].trim(), 10) || 0;
                const senderIdFromLog = parts[4] ? parts[4].trim() : undefined;
                const recipientIdFromLog = parts[5] ? parts[5].trim() : undefined;

                // AI-initiated letter request (VOTC-194): the payload carries no
                // sender/recipient fields; both ids come from the letter-session
                // init block (gameData). The NPC is the sender, the player the
                // recipient. Content signature: VOTC_CE_LETTER|<CATEGORY>|<flavor>.
                const isNpcInitiated = letterId === 'npcltr' || content.startsWith('VOTC_CE_LETTER|');
                let npcLetterCategory: string | undefined;
                let letterContent = content;
                if (isNpcInitiated) {
                    const sigParts = content.split('|');
                    if (sigParts.length >= 3 && sigParts[0] === 'VOTC_CE_LETTER') {
                        npcLetterCategory = sigParts[1].trim() || undefined;
                        letterContent = sigParts.slice(2).join('|').trim();
                    }
                }

                // Use the playerId and recipientId from the function arguments if they exist,
                // as they are more reliable than the potentially swapped log values.
                // For npcltr payloads the init block is the only id source.
                const finalSenderId = isNpcInitiated
                    ? String(gameData.aiID)
                    : (playerId || senderIdFromLog);
                const finalRecipientId = isNpcInitiated
                    ? String(gameData.playerID)
                    : (recipientId || recipientIdFromLog);
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

                if (letterContent && letterId && finalSenderId && finalRecipientId) {
                    const sender = gameData.characters.get(Number(finalSenderId));
                    const recipient = gameData.characters.get(Number(finalRecipientId));

                    if (sender && recipient) {
                        const correctedGameDate = totalDaysToDateString(writtenDateInDays);
                        const creationTimestamp = new Date(Date.now() + parseTimeOffset);
                        parseTimeOffset++;
                        const letter = LetterClass.fromLog(sender, recipient, letterId, letterContent, correctedGameDate, delay, writtenDateInDays, creationTimestamp);
                        if (letter) {
                            letter.triggeredActions = triggeredActions;
                            if (npcLetterCategory) {
                                letter.npcLetterCategory = npcLetterCategory;
                            }
                            // Thread continuity (VOTC-194): a player response
                            // written after an NPC opening letter is linked to
                            // that opening so the letters tab can render the
                            // full chain (AI opening -> player -> AI reply).
                            if (!isNpcInitiated && /^letter_\d+$/.test(letterId)) {
                                const playerNumericId = Number(finalSenderId);
                                const npcNumericId = Number(finalRecipientId);
                                const priorLetters = LetterManager.getInstance().getAllLetters(finalSenderId);
                                const opening = priorLetters.find(l =>
                                    l.subject === 'npcltr' &&
                                    l.sender.id === npcNumericId &&
                                    l.recipient.id === playerNumericId &&
                                    !priorLetters.some(r => r.replyToId === l.id)
                                );
                                if (opening) {
                                    letter.replyToId = opening.id;
                                    console.log(`Linked player letter ${letterId} to NPC opening letter ${opening.id}.`);
                                }
                            }
                            // Guard: never auto-execute letter actions when manual approval is enabled.
                            // This branch is currently dead (associatedAction is never assigned), but if it
                            // is ever enabled, it must still respect manualLetterActionApproval.
                            if (!config.manualLetterActionApproval && letter.associatedAction?.triggerOn === 'receive') {
                                LetterActionTrigger.executeLetterAction(letter, letter.associatedAction, config);
                            }
                            letters.push(letter);
                            // Letters are stored under the player's folder. For a
                            // player-sent letter the sender IS the player; for an
                            // npcltr request the sender is the NPC, so the player
                            // id must be used explicitly or the opening letter
                            // would land in the NPC's folder and never show in the
                            // Letters tab.
                            LetterManager.getInstance().saveLetter(letter, isNpcInitiated ? String(gameData.playerID) : finalSenderId);
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
