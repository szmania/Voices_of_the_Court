import { ApiConnection } from "../../shared/apiConnection";
import { GameData } from "../../shared/gameData/GameData";
import { Config } from "../../shared/Config";
import { Message, Summary } from "../ts/conversation_interfaces";
import * as fs from "fs";
import * as path from "path";
import { readSummaryFile, saveSummaryFile } from '../summaryManager.js';
import { createMemoryString } from '../conversation/promptBuilder.js';
import { LetterManager } from "./LetterManager.js";
import { Letter } from "./Letter.js";
import { Letter as ILetter, LetterType } from "./letterInterfaces.js";
import { randomUUID } from 'crypto';

export class LetterReplyGenerator {
    private apiConnection: ApiConnection;
    private config: Config;
    private userDataPath: string;

    constructor(config: Config, userDataPath: string) {
        this.config = config;
        this.userDataPath = userDataPath;
        
        // Create API connection
        this.apiConnection = new ApiConnection(
            config.textGenerationApiConnectionConfig.connection,
            config.textGenerationApiConnectionConfig.parameters
        );
    }


    /**
     * Builds the prompt for the letter reply
     * @param gameData Game data
     * @param letterContent Letter content
     * @returns The constructed prompt
     */
    private async buildLetterPrompt(gameData: GameData, letterContent: { content: string; subject: string; senderId: string; recipientId: string; }): Promise<string> {
        const player = gameData.characters.get(gameData.playerID);
        const ai = gameData.characters.get(gameData.aiID);

        if (!player || !ai) {
            throw new Error('Player or AI character data not found in gameData');
        }

        // Use pListLetter.js to build character description
        const pListLetter = require("../../../default_userdata/scripts/prompts/description/standard/pListLetter.js");
        const characterDescription = pListLetter(gameData);

        // Read conversation summary
        let conversationSummary = '';
        try {
            const summaries: Summary[] = await readSummaryFile(this.userDataPath, String(gameData.playerID));
            const aiSummaries = summaries.filter(summary => summary.characterId === String(gameData.aiID));
            
            if (aiSummaries.length > 0) {
                // Read all summaries for this character, sorted by date (most recent first)
                const allSummaries = aiSummaries.map((summary, index) => 
                    `${index + 1}. ${summary.date}: ${summary.content}`
                ).join('\n');
                
                conversationSummary = `Summaries of previous conversations with ${player.fullName}:\n${allSummaries}\n\n`;
                console.log(`Loaded ${aiSummaries.length} conversation summaries for AI ID ${gameData.aiID}`);
            } else {
                console.log(`No conversation summary found for AI ID ${gameData.aiID}`);
            }
        } catch (error) {
            console.warn(`Failed to load conversation summary: ${error}`);
        }

        // Read memory content
        let memoryContent = '';
        try {
            // Create a temporary conversation object to get memory content
            const tempConversation = {
                gameData: gameData,
                config: {
                    memoriesPrompt: "Relevant memories:",
                    maxMemoryTokens: 1000
                },
                textGenApiConnection: this.apiConnection
            } as any;
            
            const memoryString = createMemoryString(tempConversation);
            if (memoryString && memoryString.trim() !== '') {
                memoryContent = `${memoryString}\n\n`;
                console.log(`Loaded memory content for letter prompt: ${memoryString.substring(0, 100)}...`);
            } else {
                console.log(`No memory content found for letter prompt`);
            }
        } catch (error) {
            console.warn(`Failed to load memory content: ${error}`);
        }

        let prompt = this.config.letterPrompt || "You are playing as {{aiName}}.\n\n{{characterDescription}}\n\n{{conversationSummary}}{{memoryContent}}You have received a letter from {{playerName}} with the following content:\n\"{{letterContent}}\"\n\nThe letter requires a reply in {{language}}.\n\nPlease write a suitable reply based on your character's personality, background, relationship with the sender, relevant memories, and the current game situation. The reply should:\n1. Be written in {{language}}\n2. Reflect your character's personality and stance\n3. Respond to the main content of the letter\n4. Have a tone that is appropriate for your identity and relationship with the sender\n5. Be of moderate length and clearly expressed\n6. Appropriately reference relevant memory content to make the reply more aligned with the character's background\n\nPlease write the reply content directly, without adding any explanation or description.";

        prompt = prompt.replace('{{aiName}}', ai.fullName)
                       .replace('{{characterDescription}}', characterDescription)
                       .replace('{{conversationSummary}}', conversationSummary)
                       .replace('{{memoryContent}}', memoryContent)
                       .replace('{{playerName}}', player.fullName)
                       .replace('{{letterContent}}', letterContent.content)
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
    public async generateLetterReply(gameData: GameData, letter: ILetter): Promise<string | null> {
        try {
            const letterContent = {
                content: letter.content,
                subject: letter.subject,
                senderId: String(letter.sender.id),
                recipientId: String(letter.recipient.id)
            };

            // Build prompt
            const promptText = await this.buildLetterPrompt(gameData, letterContent);
            console.log(`Generated letter prompt: ${promptText.substring(0, 200)}...`);

            // Convert prompt to Message array format
            const messages: Message[] = [
                {
                    role: "user",
                    content: promptText
                }
            ];

            // Call LLM to generate reply
            const response = await this.apiConnection.complete(messages, false, {
                max_tokens: this.config.maxTokens,
                temperature: this.config.textGenerationApiConnectionConfig.parameters.temperature
            });

            if (!response || response.trim() === '') {
                console.warn('Empty response from LLM for letter reply');
                return null;
            }

            // Escape quotes in the reply
            const escapedResponse = this.escapeQuotes(response.trim(), this.config.language);
            
            console.log(`Generated letter reply: ${escapedResponse.substring(0, 100)}...`);
            
            // Generate and save a summary of the letter
            await this.generateAndSaveLetterSummary(gameData, letterContent, escapedResponse);

            // Save letter history immediately
            await this.saveLetterHistory(String(gameData.playerID), String(gameData.aiID), letterContent, escapedResponse, gameData);
            
            // Return the generated reply so it can be queued for delayed delivery
            return escapedResponse;
        } catch (error) {
            console.error(`Error generating letter reply: ${error}`);
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
    private async saveLetterHistory(playerId: string, aiId: string, letterContent: { content: string; subject: string; senderId: string; recipientId: string; }, replyContent: string, gameData: GameData): Promise<void> {
        try {
            const letterManager = LetterManager.getInstance();
    
            const player = gameData.characters.get(Number(playerId));
            const ai = gameData.characters.get(Number(aiId));
    
            if (!player || !ai) {
                console.error("Could not find player or AI character to save letter history.");
                return;
            }
    
            // Get characters for the original letter
            const originalSender = gameData.getCharacter(Number(letterContent.senderId));
            const originalRecipient = gameData.getCharacter(Number(letterContent.recipientId));
    
            if (!originalSender || !originalRecipient) {
                console.error(`Could not find original sender (${letterContent.senderId}) or recipient (${letterContent.recipientId}) to save letter history.`);
                return;
            }
    
            // Create both letter objects
            const originalLetter = new Letter(
                randomUUID(),
                originalSender,
                originalRecipient,
                letterContent.subject,
                letterContent.content,
                LetterType.PERSONAL,
                new Date(gameData.date.replace(/\./g, '-')),
                true // The player sent it, so it's "read" by them.
            );
    
            const replyLetter = new Letter(
                randomUUID(),
                ai, // sender is the AI
                player, // recipient is the player
                `Re: ${letterContent.subject}`,
                replyContent,
                LetterType.PERSONAL,
                new Date(gameData.date.replace(/\./g, '-')),
                false // It's a new letter, so not read by the player yet
            );
    
            // Atomically update the history file
            const otherCharacterId = aiId; // The file is named after the non-player character
            const filePath = letterManager.getLetterFilePath(playerId, otherCharacterId);
    
            let history: Letter[] = [];
            if (fs.existsSync(filePath)) {
                history = letterManager.getLetters(playerId, otherCharacterId);
            }
    
            // Add original letter if not present
            if (!history.find(l => l.id === originalLetter.id)) {
                history.push(originalLetter);
            }
            // Add reply letter if not present
            if (!history.find(l => l.id === replyLetter.id)) {
                history.push(replyLetter);
            }
            
            history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
            fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
            
            console.log(`Saved original letter and AI reply to letter history for player ${playerId} and character ${aiId}`);
    
        } catch (error) {
            console.error(`Error saving letter history: ${error}`);
        }
    }

    /**
     * Generates a summary of the letter exchange and saves it to the summary file.
     * @param gameData Game data
     * @param letterContent Player's letter content
     * @param replyContent AI's reply content
     */
    private async generateAndSaveLetterSummary(gameData: GameData, letterContent: { content: string; subject: string; senderId: string; recipientId: string; }, replyContent: string): Promise<void> {
        try {
            const player = gameData.getPlayer();
            const ai = gameData.getAi();
            
            if (!player || !ai) {
                console.error('Player or AI character data not found for summary generation');
                return;
            }

            // Build summary generation prompt
            let summaryPrompt = this.config.letterSummaryPrompt || "Please generate a concise summary based on the following letter exchange:\n\nPlayer {{playerName}}'s letter:\n\"{{playerLetterContent}}\"\n\nCharacter {{aiName}}'s reply:\n\"{{aiReplyContent}}\"\n\nPlease generate a concise summary describing the main content of this letter exchange. The summary should:\n1. Be concise and clear, not exceeding 100 words\n2. Highlight the core content of the letter exchange\n3. Reflect the relationship and interaction characteristics between the characters\n\nPlease write the summary content directly, without adding any explanation or description.";

            summaryPrompt = summaryPrompt.replace('{{playerName}}', player.fullName)
                                         .replace('{{playerLetterContent}}', letterContent.content)
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

            // Use the date directly from gameData
            const letterDate = gameData.date;

            // Build new summary object
            const newSummary = {
                date: letterDate,
                content: summaryContent.trim()
            };

            // Read existing summary file
            let existingSummaries: Summary[] = [];
            try {
                existingSummaries = await readSummaryFile(this.userDataPath, String(gameData.playerID));
            } catch (error) {
                console.log('No existing summaries found, creating new summary file');
            }

            // Get existing summaries for the current AI character
            const aiCharacterId = String(gameData.aiID);
            const aiCharacterSummaries = existingSummaries.filter(summary => summary.characterId === aiCharacterId);
            const otherSummaries = existingSummaries.filter(summary => summary.characterId !== aiCharacterId);
            
            // Add the new summary to the list for the current AI character (at the beginning, most recent first)
            const updatedAiSummaries = [{
                ...newSummary,
                characterId: aiCharacterId
            }, ...aiCharacterSummaries];
            
            // Merge all summaries (current AI's summaries first, then others)
            const updatedSummaries = [...updatedAiSummaries, ...otherSummaries];

            // Save the updated summaries
            await saveSummaryFile(this.userDataPath, String(gameData.playerID), updatedSummaries);
            console.log(`Letter summary saved for AI ID ${gameData.aiID}`);

        } catch (error) {
            console.error(`Error generating and saving letter summary: ${error}`);
        }
    }

    // This function is now handled by the delivery mechanism in main.ts to support delays.
}
