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


export function buildChatPrompt(conv: Conversation, character: Character): Message[]{
    console.log(`Building chat prompt for character: ${character.fullName}`);
    let chatPrompt: Message[]  = [];

    const userDataPath = path.join(app.getPath('userData'), 'votc_data');
    const isSelfTalk = conv.gameData.playerID === conv.gameData.aiID;


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

    const roleplayInstructionTemplate = translations.system.roleplay_instruction || "Your task is to roleplay as the character {characterName}. Write a reply for this character only. Remember, you are playing as {characterName}, do not write replies for any other character.";
    const roleplayInstruction = roleplayInstructionTemplate.replace(/{characterName}/g, character.fullName);

    if (isSelfTalk) {
        exampleMessagesScriptFileName = conv.config.selectedSelfTalkExMsgScript;
        exampleMessagesPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', 'self-talk', exampleMessagesScriptFileName);
    } else {
        exampleMessagesScriptFileName = conv.config.selectedExMsgScript;
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

    let messages = conv.messages.slice(0); //pass by value

    const descriptionScriptFileName = conv.config.selectedDescScript;
    const descriptionPath = path.join(userDataPath, 'scripts', 'prompts', 'description', descriptionScriptFileName);
    let description = "";
    try{
        delete require.cache[require.resolve(descriptionPath)];
        // Pass character to the script
        description = require(descriptionPath)(conv.gameData, character); 
        console.log(`Description script '${descriptionScriptFileName}' loaded successfully for ${character.fullName}.`);
    }catch(err){
        console.error(`Description script error for '${descriptionScriptFileName}': ${err}`);
        conv.chatWindow.window.webContents.send('error-message', `Error in description script '${descriptionScriptFileName}'.`);
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
        content: createMemoryString(conv)
    }

    
    if(memoryMessage.content){
        insertMessageAtDepth(messages, memoryMessage, conv.config.memoriesInsertDepth);
        console.log(`Inserted memories at depth: ${conv.config.memoriesInsertDepth}.`);
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
            summaryString = "以下是之前对话的日期与摘要：\n";
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
    

    

    if(conv.currentSummary){
        let currentSummaryMessage: Message = {
            role: "system",
            content: "Summarization of the previous messages in this conversation: "+conv.currentSummary,
        }

        messages.unshift(currentSummaryMessage);
        console.log('Added current conversation summary.');
    }

    chatPrompt = chatPrompt.concat(messages);

    if (isSelfTalk) {
        chatPrompt.push({
            role: "system",
            content: parseVariables(conv.config.selfTalkPrompt, conv.gameData)
        });
        console.log('Added self-talk main prompt from config.');
    } else {
        chatPrompt.push({
            role: "system",
            content: parseVariables(conv.config.mainPrompt, conv.gameData)
        });
        console.log('Added standard main prompt.');
    }


    if(conv.config.enableSuffixPrompt){
        chatPrompt.push({
            role: "system",
            content: conv.config.suffixPrompt
        })
        console.log('Added suffix prompt.');
    }

    chatPrompt.push({
        role: "system",
        content: roleplayInstruction
    });

    console.log(`Final chat prompt message count: ${chatPrompt.length}`);
    return chatPrompt;
}

//SUMMARIZATION

export function buildSummarizeChatPrompt(conv: Conversation, character: Character): Message[]{
    let output: Message[] = [];

    output.push({
        role: "system",
        content: convertMessagesToString(conv.messages, "", "")
    });

    const isSelfTalk = conv.gameData.playerID === conv.gameData.aiID;
    const prompt = isSelfTalk ? conv.config.selfTalkSummarizePrompt : conv.config.summarizePrompt;

    let finalPrompt = parseVariables(prompt, conv.gameData);
    if (!isSelfTalk) {
        finalPrompt += `\nSummarize from the perspective of ${character.fullName}.`;
    }

    output.push({
        role: "system",
        content: finalPrompt
    });

    return output;
}

export function buildResummarizeChatPrompt(conv: Conversation, messagesToSummarize: Message[]): Message[]{
    let prompt: Message[] = [];
    const isSelfTalk = conv.gameData.playerID === conv.gameData.aiID;

    if(conv.currentSummary){
        const summaryIntro = isSelfTalk 
            ? "Summary of this internal monologue that happened before the messages:" 
            : "Summary of this conversation that happened before the messages:";
        
        prompt.push({
            role: "system",
            content: summaryIntro + conv.currentSummary
        });
    }
    
    prompt.push({
        role: "system",
        content: convertMessagesToString(messagesToSummarize, "", "")
    });

    const summarizePrompt = isSelfTalk ? conv.config.selfTalkSummarizePrompt : conv.config.summarizePrompt;

    prompt.push({
        role: "system",
        content: parseVariables(summarizePrompt, conv.gameData)
    });

    return prompt;
}

export function buildAiToAiPrompt(conv: Conversation, source: Character, target: Character): Message[] {
    // Get the full prompt context for the source character, as if they were about to speak.
    const prompt = buildChatPrompt(conv, source);

    // Add a final, specific instruction to direct the response to the target AI character.
    const instruction = `Your task is to continue the roleplay as ${source.fullName}. Based on the conversation so far, write a short, in-character message from you directed specifically at ${target.fullName}. Do not respond to the player. Your message should be a direct continuation of the dialogue. Only output the message content, without your name or any prefixes.`;
    
    prompt.push({
        role: 'system',
        content: instruction
    });

    return prompt;
}



//help functions 

export function convertMessagesToString(messages: Message[], inputSeq: string, outputSeq: string): string{
    let output= "";
    for(const message of messages){
        if(message.role === 'user'){
            output+= `${inputSeq}${message.name}:${message.content}\n`
        }
        else if(message.role == 'assistant'){
            output+= `${outputSeq}${message.name}:${message.content}\n`
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




export function createMemoryString(conv: Conversation): string{

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
        output = conv.config.memoriesPrompt;
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
