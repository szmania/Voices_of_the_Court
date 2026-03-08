import { Conversation } from "./Conversation";
import { Config } from "../../shared/Config";
import { convertMessagesToString } from "./promptBuilder";
import { Message, ActionResponse } from "../ts/conversation_interfaces";
import { parseVariables } from "../parseVariables";
import { convertChatToTextPrompt } from "./checkActions";
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

/**
 * 生成AI旁白，基于最后一轮对话和action的return结果
 * @param conv - 当前对话对象
 * @param actionResponses - 已触发的action响应列表
 * @returns 生成的旁白文本
 */
export async function generateNarrative(conv: Conversation, actionResponses: ActionResponse[]): Promise<string> {
    // 如果没有触发的action，返回空字符串
    if (actionResponses.length === 0) {
        return "";
    }

    console.log('Generating AI narrative for triggered actions.');

    // 构建旁白提示
    const prompt = buildNarrativePrompt(conv, actionResponses);

    let response;
    if (conv.actionsApiConnection.isChat()) {
        response = await conv.actionsApiConnection.complete(prompt, false, {});
    } else {
        response = await conv.actionsApiConnection.complete(
            convertChatToTextPrompt(prompt, conv.config),
            false,
            { stop: [conv.config.inputSequence, conv.config.outputSequence] }
        );
    }

    console.log(`Raw LLM response for narrative: ${response}`);
    
    // 清理响应，移除可能的格式标记
    response = response.replace(/(\r\n|\n|\r)/gm, "");
    response = response.replace(/<narrative>(.*?)<\/?narrative>/, "$1").trim();

    return response;
}

/**
 * 构建用于生成旁白的提示
 * @param conv - 当前对话对象
 * @param actionResponses - 已触发的action响应列表
 * @returns 构建的消息列表
 */
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
    const fallbackLocalePath = path.join(app.getAppPath(), 'public', 'locales', `en.json`);
    return JSON.parse(fs.readFileSync(fallbackLocalePath, 'utf-8'));
}

function buildNarrativePrompt(conv: Conversation, actionResponses: ActionResponse[]): Message[] {
    const translations = getTranslations(conv.config.language);
    const narrativeTranslations = translations.narrative || {};

    // 获取最后一轮对话（最近的两条消息）
    const lastMessages = conv.messages.slice(-2);
    
    // 构建action结果文本
    const actionResults = actionResponses.map(action => action.chatMessage).join("\n");
    
    // 使用配置中的narrativePrompt，并替换变量
    const fallbackPrompt = narrativeTranslations.fallback_prompt || "Please generate a short narrative based on the following conversation, describing the atmosphere of the scene or the character's inner feelings. The narrative should be concise and vivid, with a length of 50-100 words.";
    const promptTemplate = conv.config.narrativePrompt || fallbackPrompt;
    const promptContent = parseVariables(promptTemplate, conv.gameData);

    const lastRoundDialogueLabel = narrativeTranslations.last_round_dialogue || "Last round of dialogue:";
    const eventResultsLabel = narrativeTranslations.event_results || "Event results:";
    const generateDescriptionPromptLabel = narrativeTranslations.generate_description_prompt || "Please generate a narrative description for the above events:";
    
    const output: Message[] = [
        {
            role: "system",
            content: promptContent
        },
        {
            role: "user",
            content: `${lastRoundDialogueLabel}
${convertMessagesToString(lastMessages, "", "")}

${eventResultsLabel}
${actionResults}

${generateDescriptionPromptLabel}`
        }
    ];

    return output;
}
