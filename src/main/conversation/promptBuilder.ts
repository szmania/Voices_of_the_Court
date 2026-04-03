import type { Conversation } from "./Conversation";
import { parseVariables } from "../parseVariables";
import { Message } from "../ts/conversation_interfaces";
import { Memory, Secret } from "../../shared/gameData/GameData";
import { Character } from "../../shared/gameData/Character";
import { Config } from "../../shared/Config";
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { parseGameDate, getDateDifference } from '../../shared/dateUtils.js';
import { readDiarySummaries } from "../diaryManager.js";

let promptsConfig: any = null;
function getPromptsConfig(userDataPath: string) {
    if (promptsConfig) return promptsConfig;
    const promptsPath = path.join(userDataPath, 'configs', 'default_prompts.json');
    promptsConfig = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
    return promptsConfig;
}

export function getEffectivePrompts(conv: Conversation): any {
    const promptsConfig = getPromptsConfig(conv.userDataPath);
    const lang = conv.config.language || 'en';
    const activePreset = conv.config.activePromptPreset || 'Default';

    if (promptsConfig.mod_prompt_sets?.[activePreset]) {
        return promptsConfig.mod_prompt_sets[activePreset][lang] || promptsConfig.mod_prompt_sets[activePreset].en;
    }
    
    // For "Default" or custom presets, use the base prompts for the language.
    // Custom presets overwrite the values in the UI, which then get saved into the main config object
    // that the backend conversation uses.
    return promptsConfig.prompts[lang] || promptsConfig.prompts.en;
}

export function convertChatToText(chat: Message[], config: Config, aiName: string): string{
    let output: string = "";

    for(let msg of chat){

        switch(msg.role){
            case "system":
                    output += msg.content+"\n";
                break;
            case "user":
                output += `${config.inputSequence}\n${msg.name}: ${msg.content}\n`;
                break;
                case "assistant":
                    output += `${config.outputSequence}\n${msg.name}: ${msg.content}\n`;
                    break;
        }
    }

    output+=config.outputSequence+"\n"+aiName+": ";
    return output;
}

export function convertChatToTextNoNames(messages: Message[], config: Config): string{
    let output: string = "";
    for(let msg of messages){
        if(msg.role === "user"){
            output+=config.inputSequence+"\n";
        }
        output += msg.content+"\n";
    }

    output+=config.outputSequence+"\n";
    return output;
}


export async function buildChatPrompt(conv: Conversation, character: Character, messagesOverride?: Message[], targetCharacter?: Character, isNonTargetedResponse: boolean = false): Promise<Message[]>{
    console.log(`Building chat prompt for character: ${character.fullName}`);
    let chatPrompt: Message[]  = [];

    const userDataPath = path.join(app.getPath('userData'), 'votc_data');
    const isSelfTalk = conv.gameData.characters.size === 1 && conv.gameData.characters.has(conv.gameData.playerID);

    let exampleMessagesScriptFileName: string;
    let exampleMessagesPath: string | null;

    const lang = conv.config.language || 'en';
    const localePath = path.join(app.getAppPath(), 'public', 'locales', `${lang}.json`);
    let translations;
    try {
        translations = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
    } catch (error) {
        console.error(`Could not load translation file for language: ${lang}. Falling back to en.`, error);
        const fallbackLocalePath = path.join(app.getAppPath(), 'public', 'locales', `en.json`);
        translations = JSON.parse(fs.readFileSync(fallbackLocalePath, 'utf-8'));
    }

    const roleplayInstructionTemplate = translations.system.roleplay_instruction || "Your task is to roleplay as the character {characterName}. Write a reply for this character only. Do not write as any other character. Do not narrate the actions of other characters.";

    let messages = messagesOverride ? messagesOverride.slice(0) : conv.messages.slice(0); //pass by value

    let replyToName: string;
    let isAiToAi = false;

    if (targetCharacter) {
        replyToName = targetCharacter.fullName;
        isAiToAi = true;
        console.log(`Explicit target provided. Setting reply target for ${character.fullName} to ${replyToName}`);
    } else {
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        replyToName = conv.gameData.getPlayer()!.fullName; // Default to player
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.name !== character.fullName) {
            const lastSpeaker = Array.from(conv.gameData.characters.values()).find(c => c.fullName === lastMessage.name || c.shortName === lastMessage.name);
            if (lastSpeaker) {
                replyToName = lastSpeaker.fullName;
                isAiToAi = true;
                console.log(`AI-to-AI reply detected. Setting reply target for ${character.fullName} to ${replyToName}`);
            }
        }
    }

    if (isSelfTalk) {
        exampleMessagesScriptFileName = conv.config.selectedSelfTalkExMsgScript;
        exampleMessagesScriptFileName = path.basename(exampleMessagesScriptFileName);
        exampleMessagesPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', 'self-talk', exampleMessagesScriptFileName);
    } else {
        exampleMessagesScriptFileName = conv.config.selectedExMsgScript;
        exampleMessagesScriptFileName = path.basename(exampleMessagesScriptFileName);
        const standardPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', 'standard', exampleMessagesScriptFileName);
        const customPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', 'custom', exampleMessagesScriptFileName);

        if (fs.existsSync(standardPath)) {
            exampleMessagesPath = standardPath;
        } else if (fs.existsSync(customPath)) {
            exampleMessagesPath = customPath;
        } else {
            console.error(`Example message script not found: ${exampleMessagesScriptFileName}. Continuing without example messages.`);
            exampleMessagesPath = null;
        }
    }

    if (exampleMessagesPath && fs.existsSync(exampleMessagesPath)) {
        try {
            delete require.cache[require.resolve(exampleMessagesPath)];
            let exampleMessages = require(exampleMessagesPath)(conv.gameData, character);

            // 只有当example messages不为空时才添加占位符和实际消息
            if (exampleMessages && exampleMessages.length > 0) {
                chatPrompt.push({
                    role: "system",
                    content: "[example messages]"
                });
                chatPrompt = chatPrompt.concat(exampleMessages);
                console.log(`Added example messages from script: ${exampleMessagesScriptFileName}.`);
            } else {
                console.log(`Example messages script returned empty array: ${exampleMessagesScriptFileName}. Skipping example messages.`);
            }
        } catch (err) {
            console.error(`Error loading example message script '${exampleMessagesScriptFileName}': ${err}`);
            conv.chatWindow.window.webContents.send('error-message', `Error in example message script '${exampleMessagesScriptFileName}'.`);
        }
    } else if (exampleMessagesPath) { // If path was set but file doesn't exist
        console.error(`Example message script file not found at expected path: ${exampleMessagesPath}. Continuing without example messages.`);
    }


    chatPrompt.push({
        role: "system",
        content: "[Start a new chat]"
    })

    const descriptionScriptFileName = conv.config.selectedDescScript;
    const descriptionPath = path.join(userDataPath, 'scripts', 'prompts', 'description', descriptionScriptFileName);
    let description = "";
    const originalAiId = conv.gameData.aiID; // Store it before the try block
    const originalPlayerId = conv.gameData.playerID; // Store playerID
    try{
        delete require.cache[require.resolve(descriptionPath)];

        if (isAiToAi && targetCharacter) {
            // For AI-to-AI, temporarily set player/ai to source/target
            conv.gameData.playerID = character.id;
            conv.gameData.aiID = targetCharacter.id;
        } else {
            // For AI-to-Player, set ai to the current speaker
            conv.gameData.aiID = character.id;
        }

        // Pass character to the script
        description = require(descriptionPath)(conv.gameData, character);

        console.log(`Description script '${descriptionScriptFileName}' loaded successfully for ${character.fullName}.`);
    }catch(err){
        console.error(`Description script error for '${descriptionScriptFileName}': ${err}`);
        conv.chatWindow.window.webContents.send('error-message', `Error in description script '${descriptionScriptFileName}'.`);
    } finally {
        // Always restore the original IDs
        conv.gameData.aiID = originalAiId;
        conv.gameData.playerID = originalPlayerId;
    }

    if (description) {
        const descMessage: Message = {
            role: "system",
            content: "The following is a description of the characters in the conversation, from the perspective of " + character.fullName + ":\n" + description
        };

        insertMessageAtDepth(messages, descMessage, conv.config.descInsertDepth);
        console.log(`Inserted description for ${character.fullName} at depth: ${conv.config.descInsertDepth}.`);
    }


    const memoryMessage: Message = {
        role: "system",
        content: createMemoryString(conv, getEffectivePrompts(conv))
    }


    if(memoryMessage.content){
        insertMessageAtDepth(messages, memoryMessage, conv.config.memoriesInsertDepth);
        console.log(`Inserted memories at depth: ${conv.config.memoriesInsertDepth}.`);
    }

    // @ts-ignore
    const depth = conv.config.summaries_insert_depth || 3;
    const diarySummaries = await readDiarySummaries(conv.gameData.playerID.toString(), character.id.toString());
    const recentDiarySummaries = diarySummaries.slice(0, depth);
    if (recentDiarySummaries.length > 0) {
        const summaryContent = recentDiarySummaries.map(s => `${s.date}: ${s.summary}`).join('\n');
        const diarySummaryMessage: Message = {
            role: "system",
            content: `Summary of ${character.shortName}'s diary:\n${summaryContent}`
        };
        insertMessageAtDepth(messages, diarySummaryMessage, conv.config.memoriesInsertDepth); // Or a new depth config
        console.log(`Inserted ${recentDiarySummaries.length} diary summaries for ${character.shortName}.`);
    }

    // too early right now
    // const secretMessage: Message = {
    //     role: "system",
    //     content: createSecretString(conv)
    // }

    // if(secretMessage.content){
    //     insertMessageAtDepth(messages, secretMessage, conv.config.memoriesInsertDepth);
    //     console.log(`Inserted secrets at depth: ${conv.config.memoriesInsertDepth}.`);
    // }

    const characterSummaries = conv.summaries.get(character.id) || [];

    if(characterSummaries.length > 0){
        let summaryString: string;
        if (isSelfTalk) {
            summaryString = "Here are the date and summary of previous internal monologues for " + conv.gameData.playerName + ":\n";
        } else {
            summaryString = (translations.prompt_builder?.summary_header || "Here are the dates and summaries of previous conversations:") + "\n";
        }

        const summariesToProcess = [...characterSummaries];
        summariesToProcess.reverse();

        const currentGameDate = parseGameDate(conv.gameData.date);

        for(let summary of summariesToProcess){
            const summaryDate = parseGameDate(summary.date);

            // Include summary if its date is unknown OR if it's in the past/present.
            if(!summaryDate || (currentGameDate && summaryDate <= currentGameDate)){
                let summaryLine = `${summary.date} (${getDateDifference(summary.date, conv.gameData.date)}): ${summary.content}\n`;
                if ((summary as any).fromPlayerId) {
                    summaryLine = `(From a conversation with another player) ${summaryLine}`;
                }
                summaryString += summaryLine;
            }
        }

        let summariesMessage: Message = {
            role: "system",
            content: summaryString
        }

        insertMessageAtDepth(messages, summariesMessage, conv.config.summariesInsertDepth);
        console.log(`Added previous conversation summaries for ${character.fullName} at depth: ${conv.config.summariesInsertDepth}.`);
    }

    // Load letter summaries
    const letterSummaries = conv.letterManager.getLetterSummaries(String(conv.gameData.playerID), String(character.id));
    if (letterSummaries.length > 0) {
        const allLetterSummaries = letterSummaries.map((summary, index) =>
            `${index + 1}. ${summary.date}: ${summary.summary}`
        ).join('\n');

        const letterSummaryString = `Summaries of previous letters with ${character.fullName}:\n${allLetterSummaries}\n\n`;

        const letterSummaryMessage: Message = {
            role: "system",
            content: letterSummaryString
        };

        insertMessageAtDepth(messages, letterSummaryMessage, conv.config.summariesInsertDepth);
        console.log(`Added ${letterSummaries.length} letter summaries for ${character.fullName} at depth: ${conv.config.summariesInsertDepth}.`);
    }


    if(conv.currentSummary){
        let currentSummaryMessage: Message = {
            role: "system",
            content: "Summarization of the previous messages in this conversation: "+conv.currentSummary,
        }

        messages.unshift(currentSummaryMessage);
        console.log('Added current conversation summary.');
    }

    chatPrompt = chatPrompt.concat(messages);

    const prompts = getEffectivePrompts(conv);

    if (!isAiToAi && !isNonTargetedResponse) {
        const originalAiId = conv.gameData.aiID;
        try {
            // Temporarily set the AI to the current speaker for variable parsing
            conv.gameData.aiID = character.id;
            if (isSelfTalk) {
                chatPrompt.push({
                    role: "system",
                    content: parseVariables(prompts.selfTalkPrompt, conv.gameData)
                });
                console.log('Added self-talk main prompt from config.');
            } else {
                let mainPromptText = prompts.mainPrompt;
                const characterNames = Array.from(conv.gameData.characters.values()).map(c => c.shortName).join(', ');
                mainPromptText = mainPromptText.replace(/{{characterNames}}/g, characterNames);

                chatPrompt.push({
                    role: "system",
                    content: parseVariables(mainPromptText, conv.gameData)
                });
                console.log('Added standard main prompt.');
            }
        } finally {
            // Restore the original AI ID
            conv.gameData.aiID = originalAiId;
        }
    }


    if(conv.config.enableSuffixPrompt){
        chatPrompt.push({
            role: "system",
            content: prompts.suffixPrompt
        })
        console.log('Added suffix prompt.');
    }

    let roleplayInstruction: string;
    const isInitiatingAiToAi = isAiToAi && messagesOverride && messagesOverride.length === 0;

    if (isInitiatingAiToAi) {
        // Case 1: AI 1 is initiating a conversation with AI 2
        const contextSwitchTemplate = translations.system.ai_to_ai_context_switch || "[System note: The previous exchange is complete. You will now initiate a new exchange with a different character.]";
        const aiToAiInitiateTemplate = translations.system.roleplay_instruction_ai_to_ai_initiate || "[System instruction: You are {sourceCharacterName}. Now, write a message to {targetCharacterName}. Write a message for your character only. Do not write as any other character. Use markdown for actions, like *this*.]";

        // Combine into a single instruction to save tokens
        roleplayInstruction = `${contextSwitchTemplate}\n\n${aiToAiInitiateTemplate}`
            .replace(/{sourceCharacterName}/g, character.fullName)
            .replace(/{targetCharacterName}/g, replyToName);
        console.log('Combined AI-to-AI context switch and initiate message.');

        const narratorPromptTemplate = translations.system.ai_to_ai_narrator_prompt || "Now, what does {sourceCharacterName} say to {targetCharacterName}?";
        const narratorPrompt = narratorPromptTemplate
            .replace(/{sourceCharacterName}/g, character.shortName)
            .replace(/{targetCharacterName}/g, replyToName);

        chatPrompt.push({
            role: "user",
            name: "Narrator",
            content: narratorPrompt
        });
        console.log('Added AI-to-AI narrator prompt.');

    } else if (isAiToAi) {
        // Case 2: AI 2 is replying to AI 1
        const aiToAiTemplate = translations.system.roleplay_instruction_ai_to_ai || "[System instruction: You are {sourceCharacterName}. Write a reply to {targetCharacterName}. Write a reply for your character only. Do not write as any other character. Use markdown for actions, like *this*.]";
        roleplayInstruction = aiToAiTemplate
            .replace(/{sourceCharacterName}/g, character.fullName)
            .replace(/{targetCharacterName}/g, replyToName);

        const narratorReplyPromptTemplate = translations.system.ai_to_ai_narrator_reply_prompt || "Now, what is {sourceCharacterName}'s reply to {targetCharacterName}?";
        const narratorPrompt = narratorReplyPromptTemplate
            .replace(/{sourceCharacterName}/g, character.shortName)
            .replace(/{targetCharacterName}/g, replyToName);

        chatPrompt.push({
            role: "user",
            name: "Narrator",
            content: narratorPrompt
        });
        console.log('Added AI-to-AI narrator reply prompt.');

    } else if (isNonTargetedResponse) {
        const nonTargetedTemplate = translations.system.ai_to_ai_narrator_non_targeted_prompt || "Now, what is {sourceCharacterName}'s response in the ongoing conversation?";
        const narratorPrompt = nonTargetedTemplate.replace(/{sourceCharacterName}/g, character.shortName);
        chatPrompt.push({
            role: "user",
            name: "Narrator",
            content: narratorPrompt
        });
        console.log('Added non-targeted narrator prompt.');

        roleplayInstruction = roleplayInstructionTemplate
            .replace(/{characterName}/g, character.fullName)
            .replace(/{playerName}/g, replyToName);
    } else {
        // Case 3: Normal reply to the player
        roleplayInstruction = roleplayInstructionTemplate
            .replace(/{characterName}/g, character.fullName)
            .replace(/{playerName}/g, replyToName);
    }

    // Append the final instruction to the last user/system message to avoid role alternation errors.
    const lastPromptMessage = chatPrompt.length > 0 ? chatPrompt[chatPrompt.length - 1] : null;
    if (lastPromptMessage && (lastPromptMessage.role === 'user' || lastPromptMessage.role === 'system')) {
        lastPromptMessage.content += `\n\n${roleplayInstruction}`;
        console.log('Appended roleplay instruction to the last message.');
    } else {
        chatPrompt.push({
            role: "system",
            content: roleplayInstruction
        });
        console.log('Pushed roleplay instruction as a new system message.');
    }

    console.log(`Final chat prompt message count: ${chatPrompt.length}`);

    // Enforce context limit by trimming older messages if necessary
    const calculateTotalTokens = (prompt: Message[]): number => {
        const text = convertMessagesToString(prompt, "", "");
        return conv.textGenApiConnection.calculateTokensFromText(text);
    };

    let contextLimit = 90000; // A safe fallback
    const connConfig = conv.config.textGenerationApiConnectionConfig.connection;
    if (connConfig.overwriteContext && connConfig.customContext > 0) {
        contextLimit = Number(connConfig.customContext);
    } else if (conv.textGenApiConnection.context && conv.textGenApiConnection.context > 0) {
        contextLimit = conv.textGenApiConnection.context;
    }

    let totalTokens = calculateTotalTokens(chatPrompt);

    if (totalTokens > contextLimit) {
        console.warn(`Prompt exceeds context limit. Tokens: ${totalTokens}, Limit: ${contextLimit}. Trimming...`);

        const trimStartIndex = chatPrompt.findIndex(m => m.content === "[Start a new chat]") + 1;
        const nonTrimmableSuffixLength = 3; // Protect the last few instructional messages

        if (trimStartIndex > 0) {
            while (totalTokens > contextLimit) {
                const trimmableSectionEnd = chatPrompt.length - nonTrimmableSuffixLength;
                if (trimStartIndex >= trimmableSectionEnd) {
                    console.warn("Cannot trim further. No trimmable messages left.");
                    break;
                }
                chatPrompt.splice(trimStartIndex, 1);
                totalTokens = calculateTotalTokens(chatPrompt);
            }
        }
        console.log(`Trimming complete. Final token count: ${totalTokens}, Message count: ${chatPrompt.length}`);
    }

    return chatPrompt;
}

//SUMMARIZATION

export function buildSummarizeChatPrompt(conv: Conversation, character: Character): Message[]{
    const prompts = getEffectivePrompts(conv);
    let output: Message[] = [];

    const isSelfTalk = conv.gameData.characters.size === 1 && conv.gameData.characters.has(conv.gameData.playerID);
    const prompt = isSelfTalk ? prompts.selfTalkSummarizePrompt : prompts.summarizePrompt;

    let finalPrompt = parseVariables(prompt, conv.gameData);
    if (!isSelfTalk) {
        finalPrompt += `\nSummarize from the perspective of ${character.fullName}.`;
    }

    const combinedSystemContent = `${convertMessagesToString(conv.messages, "", "")}\n\n${finalPrompt}`;

    output.push({
        role: "system",
        content: combinedSystemContent
    });

    return output;
}

export function buildResummarizeChatPrompt(conv: Conversation, messagesToSummarize: Message[]): Message[]{
    const prompts = getEffectivePrompts(conv);
    let prompt: Message[] = [];
    const isSelfTalk = conv.gameData.characters.size === 1 && conv.gameData.characters.has(conv.gameData.playerID);

    let systemContent = "";
    if(conv.currentSummary){
        const summaryIntro = isSelfTalk
            ? "Summary of this internal monologue that happened before the messages:"
            : "Summary of this conversation that happened before the messages:";
        systemContent += `${summaryIntro}${conv.currentSummary}\n\n`;
    }

    systemContent += `${convertMessagesToString(messagesToSummarize, "", "")}\n\n`;

    const summarizePrompt = isSelfTalk ? prompts.selfTalkSummarizePrompt : prompts.summarizePrompt;
    systemContent += parseVariables(summarizePrompt, conv.gameData);

    prompt.push({
        role: "system",
        content: systemContent
    });

    return prompt;
}

//help functions

export function convertMessagesToString(messages: Message[], inputSeq: string, outputSeq: string): string{
    let output= "";
    for(const message of messages){
        if(message.role === 'user'){
            if (message.name) {
                output+= `${inputSeq}${message.name}:${message.content}\n`
            } else {
                output+= `${inputSeq}${message.content}\n`
            }
        }
        else if(message.role == 'assistant'){
            if (message.name) {
                output+= `${outputSeq}${message.name}:${message.content}\n`
            } else {
                output+= `${outputSeq}${message.content}\n`
            }
        }
        else if(message.role == 'system'){
            output+= `${inputSeq}${message.content}\n`
        }
    }

    return output;
}

function insertMessageAtDepth(messages: Message[], messageToInsert: Message, insertDepth: number): void{

    if(messages.length < insertDepth){
        messages.splice(0, 0, messageToInsert);
    }
    else{
        messages.splice(messages.length - insertDepth + 1, 0, messageToInsert);
    }
}




export function createMemoryString(conv: Conversation, prompts: any): string{

    let allMemories: Memory[] = [];

    conv.gameData.characters.forEach((value, key) => {
        allMemories = allMemories.concat(value!.memories);
    })
    // allMemories =allMemories.concat(conv.gameData.characters.get(conv.gameData.playerID)!.memories);
    // allMemories = allMemories.concat(conv.gameData.characters.get(conv.gameData.aiID)!.memories);

    allMemories.sort((a, b) => (b.relevanceWeight - a.relevanceWeight));

    allMemories.reverse();



    let output ="";
    if(allMemories.length>0){
        output = prompts.memoriesPrompt;
    }

    let tokenCount = 0;
    while(allMemories.length>0){
        const memory: Memory = allMemories.pop()!;

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
