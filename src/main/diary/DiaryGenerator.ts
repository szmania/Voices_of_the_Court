
import { ApiConnection } from "../../shared/apiConnection";
import { Character } from "../../shared/gameData/Character";
import { GameData, Trait } from "../../shared/gameData/GameData";
import { Config } from "../../shared/Config";
import { Message } from "../ts/conversation_interfaces";
import { Conversation } from "../conversation/Conversation";
import { DiaryEntry } from "../ts/diary_interfaces";
import { LetterManager } from "../letter/LetterManager";

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

        // Add letter summaries
        const letterManager = LetterManager.getInstance();
        const letterSummaries = letterManager.getLetterSummaries(String(gameData.playerID), characterId);
        let letterSummaryContent = '';
        if (letterSummaries.length > 0) {
            const allSummaries = letterSummaries.map((summary, index) =>
                `${index + 1}. ${summary.date}: ${summary.summary}`
            ).join('\n');
            letterSummaryContent = `Summaries of previous letters with ${gameData.getPlayer().fullName}:\n${allSummaries}\n\n`;
            console.log(`Loaded ${letterSummaries.length} letter summaries for diary prompt for character ID ${characterId}`);
        } else {
            console.log(`No letter summaries found for diary prompt for character ID ${characterId}`);
        }

        prompt = prompt.replace(/{{charName}}/g, character.fullName)
                       .replace(/{{conversationHistory}}/g, conversationHistory)
                       .replace(/{{letterSummaryContent}}/g, letterSummaryContent);

        return prompt;
    }

    public async generateDiaryEntry(gameData: GameData, conversation: Conversation, characterId: string): Promise<DiaryEntry | null> {
        const character = gameData.characters.get(parseInt(characterId));
        if (!character) {
          return null;
        }

        const diaryPrompt = this.config.prompts[this.config.language]?.diaryPrompt || this.config.prompts['en']?.diaryPrompt;

        if (!diaryPrompt) {
          return null;
        }

        const replacedPrompt = diaryPrompt.replace(/{{charName}}/g, character.fullName);

        const conversationHistory = conversation.getHistory().map(msg => `${msg.name}: ${msg.content}`).join('\n');

        const fullPrompt = `${replacedPrompt}\n\n${conversationHistory}`;

        const promptForApi = [{ role: 'user', content: fullPrompt }];

        // @ts-ignore - using complete instead of generate
        const generatedContent = await this.apiConnection.complete(promptForApi, false, {});

        if (!generatedContent) {
          return null;
        }

        const diaryEntry: DiaryEntry = {
          date: gameData.date,
          location: gameData.location,
          scene: gameData.scene,
          participants: Array.from(gameData.characters.keys()).map(id => id.toString()),
          content: generatedContent,
          character_traits: character.traits.reduce((acc: { [key: string]: string; }, trait: Trait) => {
            if (trait && trait.name) {
              acc[trait.name] = trait.desc || 'true';
            }
            return acc;
          }, {}),
          creationTimestamp: new Date()
        };

        return diaryEntry;
    }

    public async generateDiaryEntryForLetter(gameData: GameData, character: Character, letterContent: string, letterDirection: 'sent' | 'received'): Promise<DiaryEntry | null> {
        const diaryPrompt = this.config.prompts[this.config.language]?.diaryForLetterPrompt || this.config.prompts['en']?.diaryForLetterPrompt;
        if (!diaryPrompt) return null;

        const replacedPrompt = diaryPrompt
            .replace(/{{charName}}/g, character.fullName)
            .replace(/{{letterDirection}}/g, letterDirection)
            .replace(/{{letterContent}}/g, letterContent);

        const promptForApi: Message[] = [{ role: 'user', content: replacedPrompt }];
        const generatedContent = await this.apiConnection.complete(promptForApi, false, {});

        if (!generatedContent) return null;

        return {
            date: gameData.date,
            location: gameData.location,
            scene: 'Wrote/Read a letter',
            participants: [String(gameData.playerID), String(character.id)],
            content: generatedContent,
            character_traits: character.traits.reduce((acc: { [key: string]: string; }, trait: Trait) => {
                if (trait && trait.name) {
                    acc[trait.name] = trait.desc || 'true';
                }
                return acc;
            }, {}),
            creationTimestamp: new Date()
        };
    }

    public async summarizeDiary(diaryEntries: DiaryEntry[]): Promise<string | null> {
        if (!diaryEntries || diaryEntries.length === 0) {
            return null;
        }

        const diarySummarizePrompt = this.config.prompts[this.config.language]?.diarySummarizePrompt || this.config.prompts['en']?.diarySummarizePrompt;
        if (!diarySummarizePrompt) {
            return null;
        }

        const entriesText = diaryEntries.map((entry: any) => `Date: ${entry.date}\n${entry.content}`).join('\n\n');
        const fullPrompt = `${diarySummarizePrompt}\n\n${entriesText}`;

        const promptForApi: Message[] = [{ role: 'user', name: 'user', content: fullPrompt }];

        const summaryContent = await this.apiConnection.complete(promptForApi, false, {});
        return summaryContent;
    }
}
