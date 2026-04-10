import { BrowserWindow } from "electron";
import { ApiConnection } from "../../shared/apiConnection";
import { Character } from "../../shared/gameData/Character.js";
import { GameData, Trait } from "../../shared/gameData/GameData.js";
import { Config } from "../../shared/Config";
import { Message, Summary } from "../ts/conversation_interfaces";
import * as fs from "fs";
import * as path from "path";
import { readSummaryFile, saveSummaryFile } from '../summaryManager.js';
import { createMemoryString } from '../conversation/promptBuilder.js';
import { LetterManager } from "./LetterManager.js";
import { Letter } from "./Letter.js";
import { Letter as ILetter, LetterType, LetterSummary } from "./letterInterfaces.js";
import { randomUUID } from 'crypto';
import { getEffectivePrompts } from "../conversation/promptBuilder.js";

export class LetterReplyGenerator {
    private apiConnection: ApiConnection;
    private config: Config;
    private userDataPath: string;

    constructor(config: Config, userDataPath: string) {
        this.config = config;
        this.userDataPath = userDataPath;
        
        // Create API connection
        console.log('[LetterReplyGenerator] Creating ApiConnection...');
        this.apiConnection = new ApiConnection(
            config.textGenerationApiConnectionConfig.connection,
            config.textGenerationApiConnectionConfig.parameters
        );
        console.log('[LetterReplyGenerator] ApiConnection created.');
    }


    /**
     * Builds the prompt for the letter reply
     * @param gameData Game data
     * @param letterContent Letter content
     * @returns The constructed prompt
     */
    private async buildLetterPrompt(gameData: GameData, letter: ILetter): Promise<string> {
        // Ensure sender and recipient from the letter are in the gameData context
        if (!gameData.characters.has(letter.sender.id)) {
            gameData.addCharacter(letter.sender.id, letter.sender);
        }
        if (!gameData.characters.has(letter.recipient.id)) {
            gameData.addCharacter(letter.recipient.id, letter.recipient);
        }

        const player = gameData.characters.get(letter.sender.id);
        const ai = gameData.characters.get(letter.recipient.id);

        if (!player || !ai) {
            // This should now be much less likely to happen
            throw new Error('Player or AI character data not found in gameData');
        }

        // Use pListLetter.js to build character description
        const pListLetter = require("../../../default_userdata/scripts/prompts/description/standard/pListLetter.js");
        const characterDescription = pListLetter(gameData);

        // Read conversation summary
        let conversationSummary = '';
        try {
            // @ts-ignore
            const depth = this.config.summaries_insert_depth || 3;
            const summaries: Summary[] = await readSummaryFile(this.userDataPath, String(player.id));
            const aiSummaries = summaries.filter(summary => summary.characterId === String(ai.id)).slice(0, depth);
            
            if (aiSummaries.length > 0) {
                // Read all summaries for this character, sorted by date (most recent first)
                const allSummaries = aiSummaries.map((summary, index) => 
                    `${index + 1}. ${summary.date}: ${summary.content}`
                ).join('\n');
                
                conversationSummary = `Summaries of previous conversations with ${player.fullName}:\n${allSummaries}\n\n`;
                console.log(`Loaded ${aiSummaries.length} conversation summaries for AI ID ${ai.id}`);
            } else {
                console.log(`No conversation summary found for AI ID ${ai.id}`);
            }
        } catch (error) {
            console.warn(`Failed to load conversation summary: ${error}`);
        }

        // Load letter summaries
        const letterManager = LetterManager.getInstance();
        // @ts-ignore
        const depth = this.config.summaries_insert_depth || 3;
        const letterSummaries = letterManager.getLetterSummaries(String(player.id), String(ai.id)).slice(0, depth);
        let letterSummaryContent = '';
        if (letterSummaries.length > 0) {
            const allSummaries = letterSummaries.map((summary, index) => 
                `${index + 1}. ${summary.date}: ${summary.summary}`
            ).join('\n');
            letterSummaryContent = `Summaries of previous letters with ${player.fullName}:\n${allSummaries}\n\n`;
            console.log(`Loaded ${letterSummaries.length} letter summaries for AI ID ${ai.id}`);
        } else {
            console.log(`No letter summaries found for AI ID ${ai.id}`);
        }

        // Read memory content
        let memoryContent = '';
        try {
            // Create a temporary conversation object to get memory content
            const tempConversation = {
                gameData: gameData,
                config: {
                    maxMemoryTokens: 1000
                },
                textGenApiConnection: this.apiConnection
            } as any;
            
            const prompts = { memoriesPrompt: this.getEffectivePrompts().memoriesPrompt };
            const memoryString = createMemoryString(tempConversation, prompts);
            if (memoryString && memoryString.trim() !== '') {
                memoryContent = `${memoryString}\n\n`;
                console.log(`Loaded memory content for letter prompt: ${memoryString.substring(0, 100)}...`);
            } else {
                console.log(`No memory content found for letter prompt`);
            }
        } catch (error) {
            console.warn(`Failed to load memory content: ${error}`);
        }

        const effectivePrompts = getEffectivePrompts(this.config, this.userDataPath, gameData);
        let prompt = effectivePrompts.letterPrompt;

        prompt = prompt.replace('{{aiName}}', ai.fullName)
                       .replace('{{characterDescription}}', characterDescription)
                       .replace('{{conversationSummary}}', conversationSummary)
                       .replace('{{letterSummaryContent}}', letterSummaryContent)
                       .replace('{{memoryContent}}', memoryContent)
                       .replace('{{playerName}}', player.fullName)
                       .replace('{{letterContent}}', letter.content)
                       .replace(/{{language}}/g, this.config.language);

        return prompt;
    }

    /**
     * Escapes quotes in the model's reply, replacing standard quotes with Chinese quotes for 'zh' language.
     * @param text The original text
     * @param language The language of the reply
     * @returns The escaped text
     */
    private escapeQuotes(text: string, language: string): string {
        if (language === 'zh') {
            return text.replace(/"/g, '“').replace(/'/g, '’');
        }
        return text;
    }

    /**
     * Generates a letter reply and writes it to a file.
     * @param gameData Game data
     * @param debugLogPath Path to debug.log file
     * @param userFolderPath User folder path
     * @returns The generated reply content, or null on failure
     */
    public async generateLetterReply(gameData: GameData, letter: ILetter): Promise<ILetter | null> {
        try {
            console.log('[LetterReplyGenerator] Starting letter reply generation.');
            // Build prompt
            const promptText = await this.buildLetterPrompt(gameData, letter);
            console.log(`[LetterReplyGenerator] Generated letter prompt: ${promptText.substring(0, 200)}...`);

            // Convert prompt to Message array format
            const messages: Message[] = [
                {
                    role: "user",
                    content: promptText
                }
            ];

            // Call LLM to generate reply
            console.log('[LetterReplyGenerator] Calling LLM to generate reply...');
            const response = await this.apiConnection.complete(messages, false, {
                max_tokens: this.config.maxTokens,
                temperature: this.config.textGenerationApiConnectionConfig.parameters.temperature
            });
            console.log('[LetterReplyGenerator] LLM call complete.');

            if (!response || response.trim() === '') {
                console.warn('[LetterReplyGenerator] Empty response from LLM for letter reply');
                return null;
            }

            // Escape quotes in the reply
            const escapedResponse = this.escapeQuotes(response.trim(), this.config.language);
            
            console.log(`[LetterReplyGenerator] Generated letter reply: ${escapedResponse.substring(0, 100)}...`);
            
            // Create a UUID for the reply letter *before* saving history and summary
            const replyLetterId = randomUUID();

            // Generate and save a summary of the letter
            console.log('[LetterReplyGenerator] Generating and saving letter summary...');
            await this.generateAndSaveLetterSummary(gameData, letter, escapedResponse, replyLetterId);
            console.log('[LetterReplyGenerator] Letter summary saved.');

            // Save letter history immediately
            console.log('[LetterReplyGenerator] Saving letter history...');
            const replyLetter = await this.saveLetterHistory(String(letter.sender.id), String(letter.recipient.id), letter, escapedResponse, gameData, replyLetterId);
            console.log('[LetterReplyGenerator] Letter history saved.');
            
            // Update original letter status back to 'sent' since reply is now pending
            const letterManager = LetterManager.getInstance();
            letterManager.updateLetterStatus(String(letter.sender.id), String(letter.recipient.id), letter.id, 'sent');

            // Return the generated reply so it can be queued for delayed delivery
            if (replyLetter) {
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('letter-status-changed');
                });
            }
            return replyLetter;
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(`[LetterReplyGenerator] Error generating letter reply: ${error.message}`);
                console.error(error.stack);
            } else {
                console.error('[LetterReplyGenerator] An unknown error occurred during letter reply generation:', error);
            }
            return null;
        }
    }

    /**
     * Saves the letter exchange to a local file.
     * @param playerId Player ID
     * @param aiId Character ID
     * @param letterContent Player's letter content
     * @param replyContent AI's reply content
     * @param userFolderPath User folder path
     * @param gameData Game data (for character names)
     */
    private async saveLetterHistory(playerId: string, aiId: string, originalLetter: ILetter, replyContent: string, gameData: GameData, replyLetterId: string): Promise<ILetter | null> {
        try {
            const letterManager = LetterManager.getInstance();
    
            const player = gameData.characters.get(Number(playerId));
            const ai = gameData.characters.get(Number(aiId));
    
            if (!player || !ai) {
                console.error("Could not find player or AI character to save letter history.");
                return null;
            }
    
            // AI writes the reply after stage 2 of the journey.
            const stage2EndDays = Math.floor(originalLetter.delay * 5 / 9);
            const replyWrittenDay = originalLetter.totalDays + stage2EndDays;
            
            const replyTimestamp = new Date(originalLetter.timestamp);
            replyTimestamp.setUTCDate(replyTimestamp.getUTCDate() + stage2EndDays);

            // The player is expected to receive the reply after the full delay.
            const expectedPlayerDeliveryDate = new Date(originalLetter.timestamp);
            expectedPlayerDeliveryDate.setUTCDate(expectedPlayerDeliveryDate.getUTCDate() + originalLetter.delay);

            const replyLetter = new Letter(
                replyLetterId,
                ai, // sender is the AI
                player, // recipient is the player
                `Re: ${originalLetter.subject}`,
                replyContent,
                LetterType.PERSONAL,
                replyTimestamp, // Use the calculated reply date
                false, // It's a new letter, so not read by the player yet
                originalLetter.delay,
                replyWrittenDay, // The "day number" when the reply was written
                originalLetter.id,
                'pending',
                false,
                undefined, // creationTimestamp
                undefined, // deliveryTimestamp (set on VOTC:LETTER_ACCEPTED)
                expectedPlayerDeliveryDate // When the player should receive it
            );
    
            // Atomically update the history file
            const otherCharacterId = aiId; // The file is named after the non-player character
            const filePath = letterManager.getLetterFilePath(playerId, otherCharacterId);
    
            let history: ILetter[] = [];
            if (fs.existsSync(filePath)) {
                history = letterManager.getLetters(playerId, otherCharacterId);
            }
    
            // Add original letter if not present (using a more robust duplicate check)
            const isOriginalDuplicate = history.some(l =>
                l.subject === originalLetter.subject &&
                l.totalDays === originalLetter.totalDays &&
                l.sender.id === originalLetter.sender.id &&
                l.recipient.id === originalLetter.recipient.id
            );
            if (!isOriginalDuplicate) {
                history.push(originalLetter);
            }

            // Add reply letter if not present (UUID check is fine here as it's brand new)
            if (!history.some(l => l.id === replyLetter.id)) {
                history.push(replyLetter);
            }
            
            history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
            fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
            
            console.log(`Saved original letter and AI reply to letter history for player ${playerId} and character ${aiId}`);
    
            return replyLetter;
        } catch (error) {
            console.error(`Error saving letter history: ${error}`);
            return null;
        }
    }

    /**
     * Generates a summary of the letter exchange and saves it to the summary file.
     * @param gameData Game data
     * @param letterContent Player's letter content
     * @param replyContent AI's reply content
     */
    private async generateAndSaveLetterSummary(gameData: GameData, originalLetter: ILetter, replyContent: string, replyLetterId: string): Promise<void> {
        try {
            const player = gameData.characters.get(originalLetter.sender.id);
            const ai = gameData.characters.get(originalLetter.recipient.id);
            
            if (!player || !ai) {
                console.error('Player or AI character data not found for summary generation');
                return;
            }

            // Build summary generation prompt
            const effectivePrompts = getEffectivePrompts(this.config, this.userDataPath, gameData);
            let summaryPrompt = effectivePrompts.letterSummaryPrompt;

            summaryPrompt = summaryPrompt.replace('{{playerName}}', player.fullName)
                                         .replace('{{playerLetterContent}}', originalLetter.content)
                                         .replace('{{aiName}}', ai.fullName)
                                         .replace('{{aiReplyContent}}', replyContent);

            // Use LLM to generate summary
            const summaryMessages: Message[] = [
                {
                    role: "user",
                    content: summaryPrompt
                }
            ];

            const summaryContent = await this.apiConnection.complete(summaryMessages, false, {
                max_tokens: 150,
                temperature: 0.3 // Use a lower temperature for more stable summaries
            });

            if (!summaryContent || summaryContent.trim() === '') {
                console.warn('Empty summary content generated');
                return;
            }

            console.log(`Generated letter summary: ${summaryContent.trim()}`);

            const letterDate = gameData.date;
            const playerId = String(originalLetter.sender.id);
            const aiId = String(originalLetter.recipient.id);

            const newSummary: LetterSummary = {
                id: randomUUID(),
                date: letterDate,
                summary: summaryContent.trim(),
                letterIds: [originalLetter.id, replyLetterId]
            };
    
            const letterManager = LetterManager.getInstance();
            const existingSummaries = letterManager.getLetterSummaries(playerId, aiId);
            
            // Add new summary to the beginning of the list
            existingSummaries.unshift(newSummary);
    
            letterManager.saveLetterSummaries(playerId, aiId, existingSummaries);
            console.log(`Letter summary saved for AI ID ${aiId}`);

        } catch (error) {
            console.error(`Error generating and saving letter summary: ${error}`);
        }
    }

    // This function is now handled by the delivery mechanism in main.ts to support delays.
}
