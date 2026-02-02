import { Conversation } from "./Conversation";
import { Message } from "../ts/conversation_interfaces";
import { Character } from "../../shared/gameData/Character";
import { parseVariables } from "../parseVariables";
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

// 从promptBuilder.ts导入需要的函数
function createMemoryString(conv: Conversation): string {
    let allMemories: any[] = [];

    conv.gameData.characters.forEach((value, key) => {
        allMemories = allMemories.concat(value!.memories);
    });

    allMemories.sort((a, b) => (b.relevanceWeight - a.relevanceWeight));
    allMemories.reverse();

    let output ="";
    if(allMemories.length>0){
        output = conv.config.memoriesPrompt;
    }

    let tokenCount = 0;
    while(allMemories.length>0){
        const memory = allMemories.pop()!;

        let memoryLine = `${memory.creationDate}: ${memory.desc}`;
        let memoryLineTokenCount = conv.textGenApiConnection.calculateTokensFromText(memoryLine);

        if(tokenCount + memoryLineTokenCount > conv.config.maxMemoryTokens){
            break;
        }
        else{
            output+="\n"+memoryLine;
            tokenCount+=memoryLineTokenCount;
        }
    }

    return output;
}

function parseGameDate(dateStr: string): Date | null {
    if (!dateStr || !(dateStr.trim())) return null;

    const str = dateStr.trim();

    // Handle purely numeric strings, assuming they are a year.
    if (/^\d+$/.test(str)) {
        const year = parseInt(str);
        const date = new Date();
        date.setFullYear(year, 0, 1);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    // Handle Chinese date format with optional prefix (e.g., "伊耿历82年1月22日" or "82年1月22日")
    const chineseDateMatch = str.match(/^.*?(\d+)年(\d+)月(\d+)日$/);
    if (chineseDateMatch) {
        const year = parseInt(chineseDateMatch[1]);
        const month = parseInt(chineseDateMatch[2]) - 1; // JavaScript months are 0-indexed
        const day = parseInt(chineseDateMatch[3]);
        const date = new Date();
        date.setFullYear(year, month, day);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    // Handle "Moon" format dates (e.g., "14th Third Moon, 172 A.C.")
    const moonDateMatch = str.match(/^(\d+)(?:st|nd|rd|th)\s+(\w+)\s+Moon,\s+(\d+)\s*(?:A\.C\.|AC)?$/);
    if (moonDateMatch) {
        const day = parseInt(moonDateMatch[1]);
        const moonName = moonDateMatch[2].toLowerCase();
        const year = parseInt(moonDateMatch[3]);
        
        // Map moon names to month numbers
        const moonToMonth: { [key: string]: number } = {
            'first': 0,     // January
            'second': 1,    // February
            'third': 2,     // March
            'fourth': 3,    // April
            'fifth': 4,     // May
            'sixth': 5,     // June
            'seventh': 6,   // July
            'eighth': 7,    // August
            'ninth': 8,     // September
            'tenth': 9,     // October
            'eleventh': 10, // November
            'twelfth': 11   // December
        };
        
        const month = moonToMonth[moonName];
        if (month !== undefined) {
            const date = new Date();
            date.setFullYear(year, month, day);
            date.setHours(0, 0, 0, 0);
            return date;
        }
    }

    // Attempt to parse with the native constructor for standard/English formats.
    const date = new Date(str);

    // Return the date object if it's valid, otherwise return null.
    if (!isNaN(date.getTime())) {
        return date;
    }

    console.warn(`Could not parse date string: "${str}". It will be included in the prompt by default.`);
    return null;
}

function getDateDifference(pastDate: string, todayDate: string, isZh: boolean = false): string{
    const pastDateObj = parseGameDate(pastDate);
    const todayDateObj = parseGameDate(todayDate);

    // If either date can't be parsed, return a default string
    if (!pastDateObj || !todayDateObj) {
        return isZh ? "未知时间前" : "unknown time ago";
    }

    // Calculate the difference in days
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.floor((todayDateObj.getTime() - pastDateObj.getTime()) / msPerDay);

    if(totalDays > 365){
        const years = Math.round(totalDays/365);
        return isZh ? `${years}年前` : years + " years ago";
    }
    else if(totalDays >= 30){
        const months = Math.round(totalDays/30);
        return isZh ? `${months}个月前` : months + " months ago";
    }
    else if(totalDays > 0){
        return isZh ? `${totalDays}天前` : totalDays + " days ago";
    }
    else{
        return isZh ? "今天" : "today";
    }
}

/**
 * 构建建议提示词
 * @param conv 对话对象
 * @returns 构建好的消息数组
 */
export function buildSuggestionPrompt(conv: Conversation): Message[] {
    console.log('Building suggestion prompt...');
    
    // 获取玩家和AI角色信息
    const playerCharacter = conv.gameData.getPlayer();
    const aiCharacter = conv.gameData.getAi();
    
    // 获取最近的对话历史，用于上下文
    const recentMessages = conv.messages.slice(-10); // 获取最近10条消息
    const conversationContext = recentMessages.map(m => `${m.name}: ${m.content}`).join('\n');
    console.log('Conversation context for suggestions:', conversationContext);
    
    // 添加记忆信息，参考promptBuilder.ts中的createMemoryString函数
    let memoryString = createMemoryString(conv);
    
    // 添加摘要信息，参考promptBuilder.ts中的摘要处理逻辑
    const isZh = conv.config.language === 'zh';
    
    // 添加摘要信息，参考promptBuilder.ts中的摘要处理逻辑
    let summaryString = "";
    // 获取当前AI角色的摘要，而不是玩家角色的摘要
    const characterSummaries = conv.summaries.get(aiCharacter.id) || [];
    
    if(characterSummaries.length > 0){
        summaryString = isZh ? "以下是之前对话的日期与摘要：\n" : "Here are the dates and summaries of previous conversations:\n";
        
        const summariesToProcess = [...characterSummaries];
        summariesToProcess.reverse();
        
        const currentGameDate = parseGameDate(conv.gameData.date);
        
        for(let summary of summariesToProcess){
            const summaryDate = parseGameDate(summary.date);
            
            // Include summary if its date is unknown OR if it's in the past/present.
            if(!summaryDate || (currentGameDate && summaryDate <= currentGameDate)){
                const timeAgo = getDateDifference(summary.date, conv.gameData.date, isZh);
                summaryString += `${summary.date} (${timeAgo}): ${summary.content}\n`;
            }
        }
    }
    
    // 构建提示词，请求生成推荐输入语句
    const prompt = isZh ? 
        `基于以下对话上下文和角色信息，为玩家角色${playerCharacter.shortName}生成3-5个简短且合适的回应建议。建议应该：
1. 符合角色特点和当前情境
2. 语气多样（例如：询问、同意、反对、中立）
3. 简洁自然
4. 每条建议不超过15个词

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

对话上下文：
${conversationContext}

玩家角色建议（仅提供建议，每行一条）：` :
        `Based on the following conversation context and character information, generate 3-5 short and appropriate response suggestions for the player character ${playerCharacter.shortName}. Suggestions should:
1. Match the character's personality and current situation
2. Have diverse tones (e.g., inquiring, agreeing, disagreeing, neutral)
3. Be concise and natural
4. Each suggestion should not exceed 15 words

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

Conversation Context:
${conversationContext}

Player Character Suggestions (provide only the suggestions, one per line):`;

    // 构建消息数组，参考promptBuilder.ts中的结构
    const messages: Message[] = [
        {
            role: "system",
            content: isZh ? "你是一个助手，负责为角色扮演游戏生成合适的玩家回应建议。" : "You are an assistant responsible for generating appropriate player response suggestions for a role-playing game."
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
    const isZh = conv.config.language === 'zh';
    const defaultSuggestions = isZh ? 
        ["我明白了。", "告诉我更多。", "你是什么意思？"] : 
        ["I understand.", "Tell me more.", "What do you mean?"];

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