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
    const sceneDescriptionPrompt = conv.config.sceneDescriptionPrompt || 
        (conv.config.language === 'zh' 
            ? "请生成一个引人入胜的场景描述，为角色们的对话提供背景和氛围。"
            : "Please generate an engaging scene description to provide background and atmosphere for the characters' dialogue.");
    
    const lang = conv.config.language;
    const translations = {
        instruction: {
            en: "Based on the following information, generate a brief role-playing scene description (50-100 words):",
            zh: "根据以下信息，生成一个简短的角色扮演场景描述（50-100字）：",
            ru: "На основе следующей информации создайте краткое описание ролевой сцены (50-100 слов):",
            fr: "En vous basant sur les informations suivantes, générez une brève description de scène de jeu de rôle (50-100 mots) :",
            es: "Basado en la siguiente información, genera una breve descripción de la escena de rol (50-100 palabras):",
            de: "Erstellen Sie auf der Grundlage der folgenden Informationen eine kurze Rollenspielszenenbeschreibung (50-100 Wörter):",
            ja: "以下の情報に基づいて、簡単なロールプレイングシーンの説明（50〜100語）を生成してください：",
            ko: "다음 정보를 바탕으로 간략한 롤플레잉 장면 설명(50-100단어)을 생성하세요:",
            pl: "Na podstawie poniższych informacji wygeneruj krótki opis sceny fabularnej (50-100 słów):"
        },
        descriptionLabel: {
            en: "Current conversation description:",
            zh: "当前对话描述：",
            ru: "Текущее описание разговора:",
            fr: "Description de la conversation actuelle :",
            es: "Descripción de la conversación actual:",
            de: "Aktuelle Gesprächsbeschreibung:",
            ja: "現在の会話の説明：",
            ko: "현재 대화 설명:",
            pl: "Aktualny opis rozmowy:"
        },
        summariesLabel: {
            en: "Previous conversation summaries:",
            zh: "之前的对话总结：",
            ru: "Сводки предыдущих разговоров:",
            fr: "Résumés des conversations précédentes :",
            es: "Resúmenes de conversaciones anteriores:",
            de: "Zusammenfassungen früherer Gespräche:",
            ja: "以前の会話の要約：",
            ko: "이전 대화 요약:",
            pl: "Podsumowania poprzednich rozmów:"
        },
        noSummariesText: {
            en: "No previous conversation summaries",
            zh: "暂无之前的对话总结",
            ru: "Нет сводок предыдущих разговоров",
            fr: "Aucun résumé de conversation précédent",
            es: "No hay resúmenes de conversaciones anteriores",
            de: "Keine Zusammenfassungen früherer Gespräche",
            ja: "以前の会話の要約はありません",
            ko: "이전 대화 요약 없음",
            pl: "Brak podsumowań poprzednich rozmów"
        },
        systemPrompt: {
            en: "You are a scene description generation assistant responsible for creating vivid scene atmosphere descriptions for role-playing games.",
            zh: "你是一个场景描述生成助手，负责为角色扮演游戏创造生动的场景氛围描述。",
            ru: "Вы — помощник по созданию описаний сцен, отвечающий за создание ярких описаний атмосферы сцен для ролевых игр.",
            fr: "Vous êtes un assistant de génération de descriptions de scènes chargé de créer des descriptions d'ambiance de scène vives pour les jeux de rôle.",
            es: "Eres un asistente de generación de descripciones de escenas responsable de crear descripciones vívidas de la atmósfera de la escena para juegos de rol.",
            de: "Sie sind ein Assistent zur Generierung von Szenenbeschreibungen, der für die Erstellung lebendiger Szenenatmosphärenbeschreibungen für Rollenspiele verantwortlich ist.",
            ja: "あなたは、ロールプレイングゲームの鮮やかなシーンの雰囲気の説明を作成する責任があるシーン説明生成アシスタントです。",
            ko: "당신은 롤플레잉 게임을 위한 생생한 장면 분위기 설명을 만드는 장면 설명 생성 도우미입니다.",
            pl: "Jesteś asystentem generowania opisów scen, odpowiedzialnym za tworzenie żywych opisów atmosfery scen do gier fabularnych."
        }
    };

    const getTranslation = (key: keyof typeof translations) => (translations[key] as any)[lang] || translations[key]['en'];
    
    const prompt = `${getTranslation('instruction')}

${getTranslation('descriptionLabel')}${conv.description}

${getTranslation('summariesLabel')}
${previousSummaries.length > 0 ? previousSummaries.map(summary => `- ${summary}`).join('\n') : getTranslation('noSummariesText')}

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
