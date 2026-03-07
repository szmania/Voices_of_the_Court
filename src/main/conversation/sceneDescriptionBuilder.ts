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
        (conv.config.language === 'zh'
            ? "请生成一个引人入胜的场景描述，为角色们的对话提供背景和氛围。"
            : "Please generate an engaging scene description to provide background and atmosphere for the characters' dialogue.");

    const instruction = conv.config.language === 'zh'
        ? "根据以下信息，生成一个简短、大气的第三人称场景描述（50-100字）。不要包含角色思想或对话。只描述场景和氛围："
        : "Based on the following information, generate a brief, atmospheric, third-person scene description (50-100 words). Do not include character thoughts or dialogue. Only describe the setting and mood:";

    const descriptionLabel = conv.config.language === 'zh' ? "当前对话信息：" : "Current conversation information:";

    const prompt = `${getTranslation('instruction')}

${descriptionLabel}
${description}

${sceneDescriptionPrompt}`;

    // 构建消息数组
    const systemPrompt = getTranslation('systemPrompt');

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

        const lang = conv.config.language;
        const fallbackDescriptions = {
            en: `On ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} and ${conv.gameData.getAi().fullName} started a conversation at ${conv.gameData.location}.`,
            zh: `在${conv.gameData.date}，${conv.gameData.getPlayer().fullName}与${conv.gameData.getAi().fullName}在${conv.gameData.location}展开了对话。`,
            ru: `В ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} и ${conv.gameData.getAi().fullName} начали разговор в ${conv.gameData.location}.`,
            fr: `Le ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} et ${conv.gameData.getAi().fullName} ont entamé une conversation à ${conv.gameData.location}.`,
            es: `El ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} y ${conv.gameData.getAi().fullName} iniciaron una conversación en ${conv.gameData.location}.`,
            de: `Am ${conv.gameData.date} begannen ${conv.gameData.getPlayer().fullName} und ${conv.gameData.getAi().fullName} ein Gespräch in ${conv.gameData.location}.`,
            ja: `${conv.gameData.date}に、${conv.gameData.getPlayer().fullName}と${conv.gameData.getAi().fullName}は${conv.gameData.location}で会話を始めました。`,
            ko: `${conv.gameData.date}에 ${conv.gameData.getPlayer().fullName}와(과) ${conv.gameData.getAi().fullName}이(가) ${conv.gameData.location}에서 대화를 시작했습니다.`,
            pl: `Dnia ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} i ${conv.gameData.getAi().fullName} rozpoczęli rozmowę w ${conv.gameData.location}.`
        };
        const fallbackDescription = (fallbackDescriptions as any)[lang] || fallbackDescriptions.en;

        // 如果生成的描述太短或为空，返回默认描述
        if (!sceneDescription || sceneDescription.length < 10) {
            sceneDescription = fallbackDescription;
        }

        console.log(`Generated scene description: ${sceneDescription}`);
        return sceneDescription;
    } catch (error) {
        console.error('Error generating scene description:', error);
        const lang = conv.config.language;
        const fallbackDescriptions = {
            en: `On ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} and ${conv.gameData.getAi().fullName} started a conversation at ${conv.gameData.location}.`,
            zh: `在${conv.gameData.date}，${conv.gameData.getPlayer().fullName}与${conv.gameData.getAi().fullName}在${conv.gameData.location}展开了对话。`,
            ru: `В ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} и ${conv.gameData.getAi().fullName} начали разговор в ${conv.gameData.location}.`,
            fr: `Le ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} et ${conv.gameData.getAi().fullName} ont entamé une conversation à ${conv.gameData.location}.`,
            es: `El ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} y ${conv.gameData.getAi().fullName} iniciaron una conversación en ${conv.gameData.location}.`,
            de: `Am ${conv.gameData.date} begannen ${conv.gameData.getPlayer().fullName} und ${conv.gameData.getAi().fullName} ein Gespräch in ${conv.gameData.location}.`,
            ja: `${conv.gameData.date}に、${conv.gameData.getPlayer().fullName}と${conv.gameData.getAi().fullName}は${conv.gameData.location}で会話を始めました。`,
            ko: `${conv.gameData.date}에 ${conv.gameData.getPlayer().fullName}와(과) ${conv.gameData.getAi().fullName}이(가) ${conv.gameData.location}에서 대화를 시작했습니다.`,
            pl: `Dnia ${conv.gameData.date}, ${conv.gameData.getPlayer().fullName} i ${conv.gameData.getAi().fullName} rozpoczęli rozmowę w ${conv.gameData.location}.`
        };
        // 返回一个基本的场景描述作为后备
        return (fallbackDescriptions as any)[lang] || fallbackDescriptions.en;
    }
}
