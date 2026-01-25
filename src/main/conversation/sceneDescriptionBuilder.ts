/**
 * 场景描述生成器
 * 用于在对话开始时生成对对话场景的描述
 */

import { Conversation } from "./Conversation";
import { Message } from "../ts/conversation_interfaces";

/**
 * 构建用于生成场景描述的提示词
 * @param conv 当前对话对象
 * @returns 构建好的消息数组
 */
export function buildSceneDescriptionPrompt(conv: Conversation): Message[] {
    console.log('Building scene description prompt...');
    



    // 获取之前的总结信息
    const previousSummaries: string[] = [];
    
    // 从所有角色的摘要中获取最近的总结
    for (const [characterId, summaries] of conv.summaries) {
        if (summaries && summaries.length > 0) {
            // 获取最新的总结（数组第一个元素，因为已经按时间倒序排列）
            const latestSummary = summaries[0];
            if (latestSummary && latestSummary.content) {
                previousSummaries.push(latestSummary.content);
            }
        }
    }

    // 构建提示词，包含当前对话描述和之前的总结
    const sceneDescriptionPrompt = conv.config.sceneDescriptionPrompt || "请生成一个引人入胜的场景描述，为角色们的对话提供背景和氛围。";
    const prompt = `根据以下信息，生成一个简短的角色扮演场景描述（50-100字）：

当前对话描述：${conv.description}

之前的对话总结：
${previousSummaries.length > 0 ? previousSummaries.map(summary => `- ${summary}`).join('\n') : '暂无之前的对话总结'}

${sceneDescriptionPrompt}`;

    // 构建消息数组
    const messages: Message[] = [
        {
            role: "system",
            content: "你是一个场景描述生成助手，负责为角色扮演游戏创造生动的场景氛围描述。"
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
export async function generateSceneDescription(conv: Conversation): Promise<string> {
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
        const response = await conv.textGenApiConnection.complete(messages, false, {});
        
        // 清理响应内容
        let sceneDescription = response.trim();
        
        // 如果生成的描述太短或为空，返回默认描述
        if (!sceneDescription || sceneDescription.length < 10) {
            sceneDescription = `在${conv.gameData.date}，${conv.gameData.getPlayer().fullName}与${conv.gameData.getAi().fullName}在${conv.gameData.location}展开了对话。`;
        }
        
        console.log(`Generated scene description: ${sceneDescription}`);
        return sceneDescription;
    } catch (error) {
        console.error('Error generating scene description:', error);
        // 返回一个基本的场景描述作为后备
        return `在${conv.gameData.date}，${conv.gameData.getPlayer().fullName}与${conv.gameData.getAi().fullName}在${conv.gameData.location}展开了对话。`;
    }
}