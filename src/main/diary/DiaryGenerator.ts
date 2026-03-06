
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
        const character = gameData.characters.get(characterId);
        if (!character) {
            return null;
        }

        const diaryPrompt = this.config.prompts[this.config.language]?.diaryPrompt || this.config.prompts['en']?.diaryPrompt;

        if (!diaryPrompt) {
            return null;
        }

        const conversationHistory = conversation.getHistory().map(msg => `${msg.name}: ${msg.content}`).join('\n');

        const prompt = `${diaryPrompt}\n\n${conversationHistory}`;

        const generatedContent = await this.textGenApiConnection.generate(prompt);

        if (!generatedContent) {
            return null;
        }

        const diaryEntry: DiaryEntry = {
            date: new Date().toISOString(),
            location: gameData.location,
            scene: gameData.scene,
            participants: Array.from(gameData.characters.keys()),
            content: generatedContent,
            character_traits: character.traits.reduce((acc, trait) => {
                acc[trait.name] = trait.value;
                return acc;
            }, {} as { [key: string]: string })
        };

        return diaryEntry;
    }
}
