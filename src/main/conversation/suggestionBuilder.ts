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

function getDateDifference(pastDate: string, todayDate: string, lang: string = 'en'): string{
    const pastDateObj = parseGameDate(pastDate);
    const todayDateObj = parseGameDate(todayDate);

    const translations = {
        unknown: { en: "unknown time ago", zh: "未知时间前", ru: "неизвестно когда", fr: "il y a un temps inconnu", es: "hace un tiempo desconocido", de: "vor unbekannter Zeit", ja: "不明な時間前", ko: "알 수 없는 시간 전", pl: "nieznany czas temu" },
        years: { en: " years ago", zh: "年前", ru: " лет назад", fr: " ans", es: " años atrás", de: " Jahren", ja: "年前", ko: "년 전", pl: " lat temu" },
        months: { en: " months ago", zh: "个月前", ru: " месяцев назад", fr: " mois", es: " meses atrás", de: " Monaten", ja: "ヶ月前", ko: "개월 전", pl: " miesięcy temu" },
        days: { en: " days ago", zh: "天前", ru: " дней назад", fr: " jours", es: " días atrás", de: " Tagen", ja: "日前", ko: "일 전", pl: " dni temu" },
        today: { en: "today", zh: "今天", ru: "сегодня", fr: "aujourd'hui", es: "hoy", de: "heute", ja: "今日", ko: "오늘", pl: "dzisiaj" }
    };

    const getTranslation = (key: keyof typeof translations) => (translations[key] as any)[lang] || translations[key]['en'];

    // If either date can't be parsed, return a default string
    if (!pastDateObj || !todayDateObj) {
        return getTranslation('unknown');
    }

    // Calculate the difference in days
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.floor((todayDateObj.getTime() - pastDateObj.getTime()) / msPerDay);

    if(totalDays > 365){
        const years = Math.round(totalDays/365);
        return years + getTranslation('years');
    }
    else if(totalDays >= 30){
        const months = Math.round(totalDays/30);
        return months + getTranslation('months');
    }
    else if(totalDays > 0){
        return totalDays + getTranslation('days');
    }
    else{
        return getTranslation('today');
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
    const lang = conv.config.language;
    
    // 添加摘要信息，参考promptBuilder.ts中的摘要处理逻辑
    let summaryString = "";
    // 获取当前AI角色的摘要，而不是玩家角色的摘要
    const characterSummaries = conv.summaries.get(aiCharacter.id) || [];
    
    if(characterSummaries.length > 0){
        const summaryHeader = {
            en: "Here are the dates and summaries of previous conversations:\n",
            zh: "以下是之前对话的日期与摘要：\n",
            ru: "Вот даты и краткое содержание предыдущих разговоров:\n",
            fr: "Voici les dates et les résumés des conversations précédentes :\n",
            es: "Aquí están las fechas y los resúmenes de las conversaciones anteriores:\n",
            de: "Hier sind die Daten und Zusammenfassungen früherer Gespräche:\n",
            ja: "過去の会話の日付と要約は次のとおりです。\n",
            ko: "다음은 이전 대화의 날짜 및 요약입니다.\n",
            pl: "Oto daty i podsumowania poprzednich rozmów:\n"
        };
        summaryString = (summaryHeader as any)[lang] || summaryHeader.en;
        
        const summariesToProcess = [...characterSummaries];
        summariesToProcess.reverse();
        
        const currentGameDate = parseGameDate(conv.gameData.date);
        
        for(let summary of summariesToProcess){
            const summaryDate = parseGameDate(summary.date);
            
            // Include summary if its date is unknown OR if it's in the past/present.
            if(!summaryDate || (currentGameDate && summaryDate <= currentGameDate)){
                const timeAgo = getDateDifference(summary.date, conv.gameData.date, lang);
                summaryString += `${summary.date} (${timeAgo}): ${summary.content}\n`;
            }
        }
    }
    
    // 构建提示词，请求生成推荐输入语句
    const prompts = {
        en: `Based on the following conversation context and character information, generate 3-5 short and appropriate response suggestions for the player character ${playerCharacter.shortName}. Suggestions should:
1. Match the character's personality and current situation
2. Have diverse tones (e.g., inquiring, agreeing, disagreeing, neutral)
3. Be concise and natural
4. Each suggestion should not exceed 15 words

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

Conversation Context:
${conversationContext}

Player Character Suggestions (provide only the suggestions, one per line):`,
        zh: `基于以下对话上下文和角色信息，为玩家角色${playerCharacter.shortName}生成3-5个简短且合适的回应建议。建议应该：
1. 符合角色特点和当前情境
2. 语气多样（例如：询问、同意、反对、中立）
3. 简洁自然
4. 每条建议不超过15个词

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

对话上下文：
${conversationContext}

玩家角色建议（仅提供建议，每行一条）：`,
        ru: `На основе следующего контекста разговора и информации о персонаже, сгенерируйте 3-5 коротких и подходящих предложений для ответа игрового персонажа ${playerCharacter.shortName}. Предложения должны:
1. Соответствовать характеру персонажа и текущей ситуации
2. Иметь разнообразные тона (например, вопросительный, согласный, несогласный, нейтральный)
3. Быть краткими и естественными
4. Каждое предложение не должно превышать 15 слов

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

Контекст разговора:
${conversationContext}

Предложения для игрового персонажа (предоставьте только предложения, по одному в строке):`,
        fr: `En fonction du contexte de la conversation et des informations sur le personnage, générez 3 à 5 suggestions de réponses courtes et appropriées pour le personnage joueur ${playerCharacter.shortName}. Les suggestions doivent :
1. Correspondre à la personnalité du personnage et à la situation actuelle
2. Avoir des tons variés (par exemple, interrogatif, d'accord, en désaccord, neutre)
3. Être concises et naturelles
4. Chaque suggestion ne doit pas dépasser 15 mots

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

Contexte de la conversation :
${conversationContext}

Suggestions pour le personnage joueur (fournissez uniquement les suggestions, une par ligne) :`,
        es: `Basado en el siguiente contexto de conversación e información del personaje, genera de 3 a 5 sugerencias de respuesta cortas y apropiadas para el personaje jugador ${playerCharacter.shortName}. Las sugerencias deben:
1. Coincidir con la personalidad del personaje y la situación actual
2. Tener tonos diversos (p. ej., inquisitivo, de acuerdo, en desacuerdo, neutral)
3. Ser concisas y naturales
4. Cada sugerencia no debe exceder las 15 palabras

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

Contexto de la conversación:
${conversationContext}

Sugerencias para el personaje jugador (proporcione solo las sugerencias, una por línea):`,
        de: `Generieren Sie basierend auf dem folgenden Gesprächskontext und den Charakterinformationen 3-5 kurze und passende Antwortvorschläge für den Spielercharakter ${playerCharacter.shortName}. Die Vorschläge sollten:
1. Zur Persönlichkeit des Charakters und zur aktuellen Situation passen
2. Unterschiedliche Töne haben (z. B. fragend, zustimmend, ablehnend, neutral)
3. Prägnant und natürlich sein
4. Jeder Vorschlag sollte nicht mehr als 15 Wörter umfassen

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

Gesprächskontext:
${conversationContext}

Vorschläge für Spielercharaktere (geben Sie nur die Vorschläge an, einen pro Zeile):`,
        ja: `以下の会話の文脈とキャラクター情報に基づいて、プレイヤーキャラクター${playerCharacter.shortName}のための短く適切な応答の提案を3〜5個生成してください。提案は以下のようになります：
1. キャラクターの個性と現在の状況に一致する
2. 多様なトーンを持つ（例：質問、同意、反対、中立）
3. 簡潔で自然である
4. 各提案は15語を超えないこと

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

会話の文脈：
${conversationContext}

プレイヤーキャラクターの提案（提案のみを1行に1つずつ提供してください）：`,
        ko: `다음 대화 컨텍스트와 캐릭터 정보를 바탕으로 플레이어 캐릭터 ${playerCharacter.shortName}에 대한 3-5개의 짧고 적절한 응답 제안을 생성하십시오. 제안 사항은 다음과 같아야 합니다.
1. 캐릭터의 성격과 현재 상황과 일치
2. 다양한 톤을 가짐 (예: 문의, 동의, 반대, 중립)
3. 간결하고 자연스러움
4. 각 제안은 15단어를 초과하지 않아야 함

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

대화 컨텍스트:
${conversationContext}

플레이어 캐릭터 제안 (제안만 한 줄에 하나씩 제공):`,
        pl: `Na podstawie poniższego kontekstu rozmowy i informacji o postaci, wygeneruj 3-5 krótkich i odpowiednich sugestii odpowiedzi dla postaci gracza ${playerCharacter.shortName}. Sugestie powinny:
1. Pasować do osobowości postaci i aktualnej sytuacji
2. Mieć zróżnicowane tony (np. pytający, zgadzający się, niezgadzający się, neutralny)
3. Być zwięzłe i naturalne
4. Każda sugestia nie powinna przekraczać 15 słów

${conv.description}

${memoryString ? memoryString + "\n" : ""}

${summaryString ? summaryString + "\n" : ""}

Kontekst rozmowy:
${conversationContext}

Sugestie dla postaci gracza (podaj tylko sugestie, po jednej w wierszu):`
    };
    const prompt = (prompts as any)[lang] || prompts.en;

    const systemMessages = {
        en: "You are an assistant responsible for generating appropriate player response suggestions for a role-playing game.",
        zh: "你是一个助手，负责为角色扮演游戏生成合适的玩家回应建议。",
        ru: "Вы — помощник, отвечающий за создание подходящих предложений по ответам игроков для ролевой игры.",
        fr: "Vous êtes un assistant chargé de générer des suggestions de réponses de joueur appropriées pour un jeu de rôle.",
        es: "Eres un asistente responsable de generar sugerencias de respuesta de jugador apropiadas para un juego de rol.",
        de: "Sie sind ein Assistent, der für die Erstellung geeigneter Antwortvorschläge für Spieler in einem Rollenspiel verantwortlich ist.",
        ja: "あなたはロールプレイングゲームの適切なプレイヤー応答の提案を生成する責任があるアシスタントです。",
        ko: "당신은 롤플레잉 게임에 적합한 플레이어 응답 제안을 생성하는 조수입니다.",
        pl: "Jesteś asystentem odpowiedzialnym za generowanie odpowiednich sugestii odpowiedzi gracza w grze fabularnej."
    };
    const systemMessage = (systemMessages as any)[lang] || systemMessages.en;

    // 构建消息数组，参考promptBuilder.ts中的结构
    const messages: Message[] = [
        {
            role: "system",
            content: systemMessage
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
    const lang = conv.config.language;
    const allDefaultSuggestions: {[key: string]: string[]} = {
        en: ["I understand.", "Tell me more.", "What do you mean?"],
        zh: ["我明白了。", "告诉我更多。", "你是什么意思？"],
        ru: ["Я понимаю.", "Расскажи мне больше.", "Что ты имеешь в виду?"],
        fr: ["Je comprends.", "Dites-m'en plus.", "Que voulez-vous dire?"],
        es: ["Entiendo.", "Cuéntame más.", "¿Qué quieres decir?"],
        de: ["Ich verstehe.", "Erzähl mir mehr.", "Was meinst du?"],
        ja: ["わかりました。", "もっと詳しく教えてください。", "どういう意味ですか？"],
        ko: ["이해합니다.", "더 말해주세요.", "무슨 뜻이에요?"],
        pl: ["Rozumiem.", "Powiedz mi więcej.", "Co masz na myśli?"]
    };
    const defaultSuggestions = allDefaultSuggestions[lang] || allDefaultSuggestions.en;

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
