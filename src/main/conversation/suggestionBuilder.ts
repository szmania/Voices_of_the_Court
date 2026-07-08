import { Conversation } from "./Conversation";
import { Message } from "../ts/conversation_interfaces";
import { Character } from "../../shared/gameData/Character";
import { createMemoryString, getEffectivePrompts } from "./promptBuilder";
import { parseGameDate, getDateDifference } from "../../shared/dateUtils";
import { parseVariables } from "../parseVariables";
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

function getTranslations(lang: string): any {
    const localePath = path.join(app.getAppPath(), 'public', 'locales', `${lang}.json`);
    try {
        if (fs.existsSync(localePath)) {
            return JSON.parse(fs.readFileSync(localePath, 'utf-8'));
        }
    } catch (error) {
        console.error(`Error reading locale file for ${lang}:`, error);
    }
    // Fallback to English
    const fallbackLocalePath = path.join(app.getAppPath(), 'public', 'locales', 'en.json');
    return JSON.parse(fs.readFileSync(fallbackLocalePath, 'utf-8'));
}


/**
 * 构建建议提示词
 * @param conv 对话对象
 * @returns 构建好的消息数组
 */
export function buildSuggestionPrompt(conv: Conversation): Message[] {
    console.log('Building suggestion prompt...');

    const prompts = getEffectivePrompts(conv.config, conv.userDataPath, conv.gameData);
    const suggestionPromptTemplate = prompts.suggestionPrompt;

    if (!suggestionPromptTemplate) {
        console.error("Suggestion prompt template is missing from the configuration.");
        return [];
    }

    const descriptionScriptFileName = conv.config.selectedDescScript;
    const descriptionPath = path.join(conv.userDataPath, 'scripts', 'prompts', 'description', descriptionScriptFileName);
    let description = "";
    try {
        delete require.cache[require.resolve(descriptionPath)];
        description = require(descriptionPath)(conv.gameData, conv.gameData.getPlayer());
    } catch (err) {
        console.error(`Description script error for '${descriptionScriptFileName}': ${err}`);
        conv.chatWindow.window.webContents.send('error-message', `Error in description script '${descriptionScriptFileName}'.`);
    }

    const playerCharacter = conv.gameData.getPlayer();
    const aiCharacter = conv.gameData.getAi();

    const recentMessages = conv.messages.slice(-10);
    const conversationContext = recentMessages.map(m => `${m.name}: ${m.content}`).join('\n');
    console.log('Conversation context for suggestions:', conversationContext);

    let memoryString = createMemoryString(conv, prompts);

    let summaryString = "";
    const characterSummaries = conv.summaries.get(aiCharacter.id) || [];
    if (characterSummaries.length > 0) {
        const summaryHeader = "Here are the dates and summaries of previous conversations:"; // Fallback
        summaryString = summaryHeader + "\n";

        const summariesToProcess = [...characterSummaries];
        summariesToProcess.reverse();
        const currentGameDate = parseGameDate(conv.gameData.date);

        for (let summary of summariesToProcess) {
            const summaryDate = parseGameDate(summary.date);
            if (!summaryDate || (currentGameDate && summaryDate <= currentGameDate)) {
                const timeAgo = getDateDifference(summary.date, conv.gameData.date);
                summaryString += `${summary.date} (${timeAgo}): ${summary.content}\n`;
            }
        }
    }

    // Replace placeholders in the new suggestion prompt template
    let promptContent = suggestionPromptTemplate
      .replace(/{{characterName}}/g, (playerCharacter && playerCharacter.shortName) ? playerCharacter.shortName : '')
      .replace(/{{description}}/g, description || '')
      .replace(/{{memoryString}}/g, memoryString || '')
      .replace(/{{summaryString}}/g, summaryString || '')
      .replace(/{{conversationContext}}/g, conversationContext || '');
    promptContent = parseVariables(promptContent, conv.gameData);

    const messages: Message[] = [
        {
            role: "user",
            content: promptContent
        }
    ];

    console.log(`Built suggestion prompt with ${messages.length} messages`);
    return messages;
}

/**
 * 生成玩家回应建议
 * @param conv 对话对象
 * @returns 建议字符串数组
 */
export async function generateSuggestions(conv: Conversation): Promise<string[]> {
    const translations = getTranslations(conv.config.language);
    const suggestionTranslations = translations.suggestion_builder;
    const defaultSuggestions = [
        suggestionTranslations.default_suggestion1,
        suggestionTranslations.default_suggestion2,
        suggestionTranslations.default_suggestion3
    ];

    try {
        console.log('Starting to generate suggestions...');
        
        // 检查API连接是否可用
        if (!conv.textGenApiConnection) {
            console.error('Text generation API connection is not available');
            return defaultSuggestions;
        }
        
        // 构建提示词
        const messages = buildSuggestionPrompt(conv);
        
        // 调用API生成建议，使用complete方法而不是generateText
        const response = await conv.textGenApiConnection.complete(messages, false, {});
        
        // 处理响应，分割建议
        let suggestions = response.split('\n')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
        
        // 如果没有生成足够的建议，添加默认建议
        if (suggestions.length < 3) {
            suggestions = suggestions.concat(defaultSuggestions);
        }
        
        // 限制建议数量
        suggestions = suggestions.slice(0, 5);
        
        console.log(`Generated ${suggestions.length} suggestions:`, suggestions);
        return suggestions;
    } catch (error) {
        console.error('Error generating suggestions:', error);
        return defaultSuggestions;
    }
}
