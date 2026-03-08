
import { Config } from '../../shared/Config';
import { GameData } from '../../shared/gameData/GameData';
import { Conversation } from '../conversation/Conversation';
import { DiaryEntry } from '../ts/diary_interfaces';
import { ApiConnection } from '../../shared/apiConnection';

export class DiaryGenerator {
    private config: Config;
    private textGenApiConnection: ApiConnection;

    constructor(config: Config) {
        this.config = config;
        this.textGenApiConnection = new ApiConnection(
            this.config.textGenerationApiConnectionConfig.connection,
            this.config.textGenerationApiConnectionConfig.parameters
        );
    }

    public async generateDiaryEntry(gameData: GameData, conversation: Conversation, characterId: string): Promise<DiaryEntry | null> {
        const character = gameData.characters.get(parseInt(characterId));
        if (!character) {
            return null;
        }

        // @ts-ignore - diaryPrompt is a custom property we added
        const diaryPrompt = this.config.prompts[this.config.language]?.diaryPrompt || this.config.prompts['en']?.diaryPrompt;

        if (!diaryPrompt) {
            return null;
        }

        const replacedPrompt = diaryPrompt.replace(/{{charName}}/g, character.fullName);

        const conversationHistory = conversation.getHistory().map(msg => `${msg.name}: ${msg.content}`).join('\n');

        const fullPrompt = `${replacedPrompt}\n\n${conversationHistory}`;
        
        const promptForApi = [{ role: 'user', content: fullPrompt }];

        // @ts-ignore - using complete instead of generate
        const generatedContent = await this.textGenApiConnection.complete(promptForApi, false, {});

        if (!generatedContent) {
            return null;
        }

        const diaryEntry: DiaryEntry = {
            date: gameData.date,
            location: gameData.location,
            scene: gameData.scene,
            participants: Array.from(gameData.characters.keys()).map(id => id.toString()),
            content: generatedContent,
            character_traits: character.traits.reduce((acc, trait) => {
                // @ts-ignore - assuming trait has a value property
                acc[trait.name] = trait.value || '';
                return acc;
            }, {} as { [key: string]: string })
        };

        return diaryEntry;
    }
}
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

            const newEntry: DiaryEntry = {
                date: gameData.date,
                content: response.trim(),
                characterId: characterId
            };

            console.log(`Generated diary entry for character ${characterId}: ${newEntry.content.substring(0, 100)}...`);
            return newEntry;

        } catch (error) {
            console.error(`Error generating diary entry for character ${characterId}:`, error);
            return null;
        }
    }
}
