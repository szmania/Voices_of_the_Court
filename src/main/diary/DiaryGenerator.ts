
import { ApiConnection } from "../../shared/apiConnection";
import { GameData } from "../../shared/gameData/GameData";
import { Config } from "../../shared/Config";
import { Message } from "../ts/conversation_interfaces";
import { Conversation } from "../conversation/Conversation";
import { DiaryEntry } from "../ts/diary_interfaces";

export class DiaryGenerator {
    private apiConnection: ApiConnection;
    private config: Config;

    constructor(config: Config) {
        this.config = config;
        this.apiConnection = new ApiConnection(
            config.textGenerationApiConnectionConfig.connection,
            config.textGenerationApiConnectionConfig.parameters
        );
    }

    private buildDiaryPrompt(gameData: GameData, conversation: Conversation, characterId: string): string {
        const character = gameData.getCharacter(parseInt(characterId, 10));
        if (!character) {
            throw new Error(`Character with ID ${characterId} not found.`);
        }

        const conversationHistory = conversation.getHistory()
            .map(msg => `${msg.name}: ${msg.content}`)
            .join('\n');

        let prompt = this.config.prompts[this.config.language]?.diaryPrompt || this.config.prompts.en.diaryPrompt;

        prompt = prompt.replace(/{{charName}}/g, character.fullName)
                       .replace(/{{conversationHistory}}/g, conversationHistory);

        return prompt;
    }

    public async generateDiaryEntry(gameData: GameData, conversation: Conversation, characterId: string): Promise<DiaryEntry | null> {
        try {
            const character = gameData.getCharacter(parseInt(characterId, 10));
            if (!character) {
                console.error(`DiaryGenerator: Character with ID ${characterId} not found.`);
                return null;
            }

            const promptText = this.buildDiaryPrompt(gameData, conversation, characterId);
            const messages: Message[] = [{ role: "user", content: promptText }];

            const response = await this.apiConnection.complete(messages, false, {
                max_tokens: 1500,
                temperature: 0.7
            });

            if (!response || response.trim() === '') {
                console.warn(`Empty response from LLM for diary entry for character ${characterId}`);
                return null;
            }

            const participants = Array.from(gameData.characters.values()).map(c => c.fullName);
            const character_traits = character.traits.reduce((acc, trait) => {
                acc[trait.name] = trait.desc;
                return acc;
            }, {} as { [key: string]: string });

            const newEntry: DiaryEntry = {
                date: gameData.date,
                location: gameData.location,
                scene: gameData.scene,
                participants: participants,
                content: response.trim(),
                character_traits: character_traits
            };

            console.log(`Generated diary entry for character ${characterId}: ${newEntry.content.substring(0, 100)}...`);
            return newEntry;

        } catch (error) {
            console.error(`Error generating diary entry for character ${characterId}:`, error);
            return null;
        }
    }
}
