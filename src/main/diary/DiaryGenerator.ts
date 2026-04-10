
import { ApiConnection } from "../../shared/apiConnection";
import { Character } from "../../shared/gameData/Character";
import { GameData, Trait } from "../../shared/gameData/GameData";
import { Config } from "../../shared/Config";
import { Message } from "../ts/conversation_interfaces";
import { Conversation } from "../conversation/Conversation";
import { DiaryEntry } from "../ts/diary_interfaces";
import { LetterManager } from "../letter/LetterManager";
import { randomUUID } from "crypto";
import * as path from "path";
import * as fs from "fs";

let promptsConfig: any = null;
function getPromptsConfig(userDataPath: string) {
    if (promptsConfig) return promptsConfig;
    const promptsPath = path.join(userDataPath, 'configs', 'default_prompts.json');
    promptsConfig = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
    return promptsConfig;
}

export class DiaryGenerator {
    private apiConnection: ApiConnection;
    private config: Config;
    private userDataPath: string;

    constructor(config: Config, userDataPath: string) {
        this.config = config;
        this.userDataPath = userDataPath;
        this.apiConnection = new ApiConnection(
            config.textGenerationApiConnectionConfig.connection,
            config.textGenerationApiConnectionConfig.parameters
        );
    }

    private getEffectivePrompts() {
        const promptsConfig = getPromptsConfig(this.userDataPath);
        const lang = this.config.language || 'en';
        const activePreset = this.config.activePromptPreset || 'Default';
    
        if (promptsConfig.mod_prompt_sets?.[activePreset]) {
            return promptsConfig.mod_prompt_sets[activePreset][lang] || promptsConfig.mod_prompt_sets[activePreset].en;
        }
        
        return promptsConfig.prompts[lang] || promptsConfig.prompts.en;
    }

    private buildDiaryPrompt(gameData: GameData, conversation: Conversation, characterId: string): string {
        const character = gameData.getCharacter(parseInt(characterId, 10));
        if (!character) {
            throw new Error(`Character with ID ${characterId} not found.`);
        }

        const conversationHistory = conversation.getHistory()
            .map(msg => `${msg.name}: ${msg.content}`)
            .join('\n');

        let prompt = this.getEffectivePrompts().diaryPrompt;

        // Add letter summaries
        const letterManager = LetterManager.getInstance();
        // @ts-ignore
        const depth = this.config.summaries_insert_depth || 3;
        const letterSummaries = letterManager.getLetterSummaries(String(gameData.playerID), characterId).slice(0, depth);
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

        const defaultPrompts = (getPromptsConfig(this.userDataPath).prompts[this.config.language || 'en'] || getPromptsConfig(this.userDataPath).prompts.en);
        const diaryPrompt = this.getEffectivePrompts().diaryPrompt || defaultPrompts.diaryPrompt;

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
          id: randomUUID(),
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
        const effectivePrompts = this.getEffectivePrompts();
        const defaultPrompts = (getPromptsConfig(this.userDataPath).prompts[this.config.language || 'en'] || getPromptsConfig(this.userDataPath).prompts.en);
        const diaryPrompt = effectivePrompts.diaryForLetterPrompt || defaultPrompts.diaryForLetterPrompt;
        if (!diaryPrompt) return null;

        const replacedPrompt = diaryPrompt
            .replace(/{{charName}}/g, character.fullName)
            .replace(/{{letterDirection}}/g, letterDirection)
            .replace(/{{letterContent}}/g, letterContent);

        const promptForApi: Message[] = [{ role: 'user', content: replacedPrompt }];
        const generatedContent = await this.apiConnection.complete(promptForApi, false, {});

        if (!generatedContent) return null;

        return {
            id: randomUUID(),
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

    public async summarizeDiaryEntry(diaryEntry: DiaryEntry): Promise<{ summary: string, date: string, diaryEntryId: string } | null> {
        if (!diaryEntry) {
            return null;
        }

        const defaultPrompts = (getPromptsConfig(this.userDataPath).prompts[this.config.language || 'en'] || getPromptsConfig(this.userDataPath).prompts.en);
        const diarySummarizePrompt = this.getEffectivePrompts().diarySummarizePrompt || defaultPrompts.diarySummarizePrompt;
        if (!diarySummarizePrompt) {
            return null;
        }

        const entryText = `Date: ${diaryEntry.date}\n${diaryEntry.content}`;
        const fullPrompt = `${diarySummarizePrompt}\n\n${entryText}`;

        const promptForApi: Message[] = [{ role: 'user', name: 'user', content: fullPrompt }];

        const summaryContent = await this.apiConnection.complete(promptForApi, false, {});
        
        if (!summaryContent) {
            return null;
        }

        return { summary: summaryContent, date: diaryEntry.date, diaryEntryId: diaryEntry.id };
    }
}
