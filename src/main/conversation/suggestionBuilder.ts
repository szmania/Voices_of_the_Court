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

    const translations = getTranslations(conv.config.language);
    const suggestionTranslations = translations.suggestion_builder;

    const descriptionScriptFileName = conv.config.selectedDescScript;
    const descriptionPath = path.join(conv.userDataPath, 'scripts', 'prompts', 'description', descriptionScriptFileName);
    let description = "";
    try{
        delete require.cache[require.resolve(descriptionPath)];
        description = require(descriptionPath)(conv.gameData, conv.gameData.getPlayer()); 
    }catch(err){
        console.error(`Description script error for '${descriptionScriptFileName}': ${err}`);
        conv.chatWindow.window.webContents.send('error-message', `Error in description script '${descriptionScriptFileName}'.`);
    }
    
    // 获取玩家和AI角色信息
    const playerCharacter = conv.gameData.getPlayer();
    const aiCharacter = conv.gameData.getAi();
    
    // 获取最近的对话历史，用于上下文
    const recentMessages = conv.messages.slice(-10); // 获取最近10条消息
    const conversationContext = recentMessages.map(m => `${m.name}: ${m.content}`).join('\n');
    console.log('Conversation context for suggestions:', conversationContext);
    
    // 添加记忆信息，参考promptBuilder.ts中的createMemoryString函数
    const prompts = getEffectivePrompts(conv.config, conv.userDataPath, conv.gameData);
    let memoryString = createMemoryString(conv, prompts);
    
    // 添加摘要信息，参考promptBuilder.ts中的摘要处理逻辑
    let summaryString = "";
    // 获取当前AI角色的摘要，而不是玩家角色的摘要
    const characterSummaries = conv.summaries.get(aiCharacter.id) || [];
    
    if(characterSummaries.length > 0){
        summaryString = suggestionTranslations.summary_header + "\n";
        
        const summariesToProcess = [...characterSummaries];
        summariesToProcess.reverse();
        
        const currentGameDate = parseGameDate(conv.gameData.date);
        
        for(let summary of summariesToProcess){
            const summaryDate = parseGameDate(summary.date);
            
            // Include summary if its date is unknown OR if it's in the past/present.
            if(!summaryDate || (currentGameDate && summaryDate <= currentGameDate)){
                const timeAgo = getDateDifference(summary.date, conv.gameData.date);
                summaryString += `${summary.date} (${timeAgo}): ${summary.content}\n`;
            }
        }
    }
    
    // 构建提示词，请求生成推荐输入语句
    const promptHeader = suggestionTranslations.prompt_header.replace('{characterName}', playerCharacter.shortName);
    const prompt = `${promptHeader}
${suggestionTranslations.prompt_rule1}
${suggestionTranslations.prompt_rule2}
${suggestionTranslations.prompt_rule3}
${suggestionTranslations.prompt_rule4}

${description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

${suggestionTranslations.prompt_context_header}
${conversationContext}

${suggestionTranslations.prompt_suggestions_header}`;

    // 构建消息数组，参考promptBuilder.ts中的结构
    const messages: Message[] = [
        {
            role: "system",
            content: suggestionTranslations.system_message
        },
        {
            role: "user",
            content: prompt
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
