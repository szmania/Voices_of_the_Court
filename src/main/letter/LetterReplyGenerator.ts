import { ApiConnection } from "../../shared/apiConnection";
import { GameData } from "../../shared/gameData/GameData";
import { Config } from "../../shared/Config";
import { Message } from "../ts/conversation_interfaces";
import * as fs from "fs";
import * as path from "path";
import { readSummaryFile, saveSummaryFile } from '../summaryManager.js';
import { createMemoryString } from '../conversation/promptBuilder.js';
import { LetterManager } from "./LetterManager.js";
import { Letter } from "./Letter.js";
import { LetterType } from "./letterInterfaces.js";
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
     * Extracts player letter content from debug.log
     * @param debugLogPath Path to debug.log file
     * @returns Extracted letter content, or null if not found
     */
    private extractLetterContent(debugLogPath: string): { content: string; subject: string; senderId: string; recipientId: string; } | null {
        try {
            if (!fs.existsSync(debugLogPath)) {
                console.error(`Debug log file not found at: ${debugLogPath}`);
                return null;
            }

            const fileContent = fs.readFileSync(debugLogPath, 'utf8');
            const lines = fileContent.split(/\r?\n/);
            
            let lastMatchParts: string[] | null = null;
            for (const line of lines) {
                if (line.includes("VOTC:LETTER")) {
                    const parts = line.split('/;/');
                    if (parts.length >= 5) {
                        lastMatchParts = parts;
                    }
                }
            }

            if (!lastMatchParts) {
                console.log('No VOTC:LETTER entries found in debug.log');
                return null;
            }

            const content = lastMatchParts[1].trim();
            const subject = lastMatchParts[2].trim();
            const recipientId = lastMatchParts[3].trim();
            const senderId = lastMatchParts[4].trim();

            console.log(`Extracted letter - Sender: ${senderId}, Recipient: ${recipientId}, Subject: ${subject}, Content: ${content}`);
            return { content, subject, senderId, recipientId };
        } catch (error) {
            console.error(`Error extracting letter content: ${error}`);
            return null;
        }
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
            const summaries = await readSummaryFile(this.userDataPath, String(gameData.playerID));
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

        let prompt = this.config.prompts[this.config.language]?.letterPrompt || this.config.prompts['en'].letterPrompt;

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
    public async generateLetterReply(gameData: GameData, debugLogPath: string, userFolderPath: string): Promise<string | null> {
        try {
            // Extract letter content
            const letterContent = this.extractLetterContent(debugLogPath);
            if (!letterContent) {
                console.error('Failed to extract letter content');
                return null;
            }

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
            
            // Write the reply to the corresponding file and save history
            await this.writeLetterReply(escapedResponse, userFolderPath, letterContent, gameData);
            
            // Generate and save a summary of the letter
            await this.generateAndSaveLetterSummary(gameData, letterContent, escapedResponse);
            
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

            // The player's letter is parsed and saved by `importLettersFromLog`.
            // Here, we just save the AI's reply.
            const replyLetter = new Letter(
                randomUUID(),
                ai, // sender is the AI
                player, // recipient is the player
                `Re: ${letterContent.subject}`,
                replyContent,
                LetterType.PERSONAL, // Or some other appropriate type
                new Date(gameData.date.replace(/\./g, '-')), // Use game date
                false // It's a new letter, so not read by the player yet
            );

            letterManager.saveLetter(replyLetter, playerId);
            console.log(`AI reply saved to letter history for player ${playerId} and character ${aiId}`);

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
            let summaryPrompt = this.config.prompts[this.config.language]?.letterSummaryPrompt || this.config.prompts['en'].letterSummaryPrompt;

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
            let existingSummaries = [];
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

    /**
     * Writes the reply to the corresponding letter file and saves the letter history.
     * @param replyContent The reply content
     * @param userFolderPath User folder path
     * @param letterContent Original letter content (contains player letter info)
     * @param gameData Game data (to get player and character IDs)
     */
    public async writeLetterReply(replyContent: string, userFolderPath: string, letterContent: { content: string; subject: string; senderId: string; recipientId: string; }, gameData: GameData): Promise<void> {
        try {
            const letterId = letterContent.subject;
            
            // Extract numeric suffix from letterId (e.g., letter_1 -> 1)
            const letterNumber = letterId.replace('letter_', '');
            const letterFileName = `letter${letterNumber}.txt`;
            const letterFilePath = path.join(userFolderPath, "run", letterFileName);
            
            // Ensure the run folder exists
            const runFolderPath = path.join(userFolderPath, "run");
            if (!fs.existsSync(runFolderPath)) {
                fs.mkdirSync(runFolderPath, { recursive: true });
                console.log(`Created run folder at: ${runFolderPath}`);
            }

            // Select template based on event
            const commandTemplates = require("../../../default_userdata/scripts/letters/command_templates.js");
            const eventType = gameData.recentEvent?.type;
            const template = eventType ? commandTemplates[eventType] || commandTemplates.default : commandTemplates.default;

            // Populate the template
            const gameCommand = template
                .replace(/{{letterNumber}}/g, letterNumber)
                .replace(/{{replyContent}}/g, replyContent)
                .replace(/{{letterId}}/g, letterId);

            // Write to file
            fs.writeFileSync(letterFilePath, gameCommand, 'utf8');
            console.log(`Letter reply written to: ${letterFilePath} for ${letterId}`);

            // Save letter history
            const playerId = String(gameData.playerID);
            const aiId = String(gameData.aiID);
            await this.saveLetterHistory(playerId, aiId, letterContent, replyContent, gameData);
            
        } catch (error) {
            console.error(`Error writing letter reply file: ${error}`);
        }
    }
}
