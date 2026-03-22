/**
 * 场景描述生成器
 * 用于在对话开始时生成对对话场景的描述
 */

import { Conversation } from "./Conversation";
import { Message } from "../ts/conversation_interfaces";
import path from 'path';

/**
 * 构建用于生成场景描述的提示词
 * @param conv 当前对话对象
 * @returns 构建好的消息数组
 */
export function buildSceneDescriptionPrompt(conv: Conversation): Message[] {
    console.log('Building scene description prompt...');

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

    // 构建提示词，只包含当前对话描述
    const sceneDescriptionPrompt = conv.config.sceneDescriptionPrompt ||
        (conv.translations.scene_description?.default_prompt || "Please generate an engaging scene description to provide background and atmosphere for the characters' dialogue.");

    const instruction = conv.translations.scene_description?.instruction || "Based on the following information, generate a brief, atmospheric, third-person scene description (50-100 words). Do not include character thoughts or dialogue. Only describe the setting and mood:";

    const descriptionLabel = conv.translations.scene_description?.description_label || "Current conversation information:";
    
    const prompt = `${instruction}

${descriptionLabel}
${description}

${sceneDescriptionPrompt}`;

    // 构建消息数组
    const systemPrompt = conv.translations.scene_description?.system_prompt || "You are a scene description generation assistant responsible for creating vivid scene atmosphere descriptions for role-playing games.";
    
    const messages: Message[] = [
        {
            role: "system",
            content: systemPrompt
        },
        {
            role: "user",
            content: prompt
        }
    ];
    
    console.log(`Built scene description prompt with ${messages.length} messages`);
    return messages;
}

/**
 * 生成场景描述
 * @param conv 当前对话对象
 * @returns 生成的场景描述
 */
export async function generateSceneDescription(conv: Conversation, signal?: AbortSignal): Promise<string> {
    try {
        console.log('Starting to generate scene description...');
        
        // 检查API连接是否可用
        if (!conv.textGenApiConnection) {
            console.error('Text generation API connection is not available');
            return "";
        }
        
        // 构建提示词
        const messages = buildSceneDescriptionPrompt(conv);
        
        // 调用API生成场景描述，使用complete方法
        const response = await conv.textGenApiConnection.complete(messages, false, {}, undefined, signal);
        
        // 清理响应内容
        let sceneDescription = response.trim();
        
        // 如果生成的描述太短或为空，返回默认描述
        if (!sceneDescription || sceneDescription.length < 10) {
            const fallbackTemplate = conv.translations.scene_description?.fallback_description || "On {{date}}, {{playerName}} and {{aiName}} started a conversation at {{location}}.";
            sceneDescription = fallbackTemplate
                .replace('{{date}}', conv.gameData.date)
                .replace('{{playerName}}', conv.gameData.getPlayer().fullName)
                .replace('{{aiName}}', conv.gameData.getAi().fullName)
                .replace('{{location}}', conv.gameData.location);
        }
        
        console.log(`Generated scene description: ${sceneDescription}`);
        return sceneDescription;
    } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
            console.log('Scene description generation was cancelled.');
            throw error; // Re-throw to be handled by the caller
        }
        console.error('Error generating scene description:', error);
        // 返回一个基本的场景描述作为后备
        const fallbackTemplate = conv.translations.scene_description?.fallback_description || "On {{date}}, {{playerName}} and {{aiName}} started a conversation at {{location}}.";
        return fallbackTemplate
            .replace('{{date}}', conv.gameData.date)
            .replace('{{playerName}}', conv.gameData.getPlayer().fullName)
            .replace('{{aiName}}', conv.gameData.getAi().fullName)
            .replace('{{location}}', conv.gameData.location);
    }
}
