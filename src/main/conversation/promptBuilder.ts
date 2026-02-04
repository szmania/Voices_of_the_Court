import { Conversation, } from "./Conversation";
import { parseVariables } from "../parseVariables";
import { Message } from "../ts/conversation_interfaces";
import { Memory, Secret } from "../../shared/gameData/GameData";
import { Character } from "../../shared/gameData/Character";
import { Config } from "../../shared/Config";
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

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

    chatPrompt.push({
        role: "system",
        content: "你的任务是扮演角色 " + character.fullName + "，为该角色写一条回复，只要写该角色的回复，注意你扮演的是" + character.fullName + "，不要写其他任何角色的回复。" + "\n"
    })

    if (isSelfTalk) {
        exampleMessagesScriptFileName = conv.config.selectedSelfTalkExMsgScript;
        exampleMessagesPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', exampleMessagesScriptFileName);
    } else {
        exampleMessagesScriptFileName = conv.config.selectedExMsgScript;
        const standardPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', exampleMessagesScriptFileName);
        const customPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', exampleMessagesScriptFileName);

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
            let exampleMessages = require(exampleMessagesPath)(conv.gameData, character.id);
            
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

    const descMessage: Message = {
        role: "system",
        content: "参与对话的角色：" + conv.description
    };

    insertMessageAtDepth(messages, descMessage, conv.config.descInsertDepth);
    console.log(`Inserted description at depth: ${conv.config.descInsertDepth}.`);


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
                summaryString += `${summary.date} (${getDateDifference(summary.date, conv.gameData.date)}): ${summary.content}\n`;
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
            content: "你的任务是扮演角色 " + character.fullName + "，为该角色写一条回复，只要写该角色的回复，注意你扮演的是" + character.fullName + "，不要写其他任何角色的回复。"+ "\n" + parseVariables(conv.config.mainPrompt, conv.gameData) + "现在开始写" +character.fullName +"的回复："
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

    console.log(`Final chat prompt message count: ${chatPrompt.length}`);
    return chatPrompt;
}

//SUMMARIZATION

export function buildSummarizeChatPrompt(conv: Conversation): Message[]{
    let output: Message[] = [];

    output.push({
        role: "system",
        content: convertMessagesToString(conv.messages, "", "")
    });

    const isSelfTalk = conv.gameData.playerID === conv.gameData.aiID;
    const prompt = isSelfTalk ? conv.config.selfTalkSummarizePrompt : conv.config.summarizePrompt;

    output.push({
        role: "system",
        content: parseVariables(prompt, conv.gameData)
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

function parseGameDate(dateStr: string): Date | null {
    if (!dateStr || !(dateStr.trim())) return null;

    const str = dateStr.trim();

    // Handle purely numeric strings, assuming they are a year.
    if (/^\d+$/.test(str)) {
        // Creates a date for Jan 1st of that year.
        // For two-digit years, we want to use them as-is (e.g., 82 = 82 AD, not 1982)
        const year = parseInt(str);
        // Use setFullYear to ensure two-digit years are not interpreted as 1900s
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
        // For two-digit years, we want to use them as-is (e.g., 82 = 82 AD, not 1982)
        // Use setFullYear to ensure two-digit years are not interpreted as 1900s
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
            // For two-digit years, we want to use them as-is (e.g., 73 = 73 AD, not 1973)
            // Use setFullYear to ensure two-digit years are not interpreted as 1900s
            const date = new Date();
            date.setFullYear(year, month, day);
            date.setHours(0, 0, 0, 0);
            return date;
        }
    }

    // Attempt to parse with the native constructor for standard/English formats.
    // Note: This may still interpret two-digit years as 1900s, but we've already
    // handled the specific game date formats above.
    const date = new Date(str);

    // Return the date object if it's valid, otherwise return null.
    if (!isNaN(date.getTime())) {
        return date;
    }

    console.warn(`Could not parse date string: "${str}". It will be included in the prompt by default.`);
    return null;
}

function getDateDifference(pastDate: string, todayDate: string): string{
    // Use parseGameDate to handle both English and Chinese date formats
    const pastDateObj = parseGameDate(pastDate);
    const todayDateObj = parseGameDate(todayDate);

    // If either date can't be parsed, return a default string
    if (!pastDateObj || !todayDateObj) {
        return "unknown time ago";
    }

    // Calculate the difference in days
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.floor((todayDateObj.getTime() - pastDateObj.getTime()) / msPerDay);

    if(totalDays > 365){
        return Math.round(totalDays/365) + " years ago"
    }
    else if(totalDays >= 30){
        return Math.round(totalDays/30) + " months ago"
    }
    else if(totalDays > 0){
        return totalDays + " days ago"
    }
    else{
        return "today"
    }
}


function createSecretString(conv: Conversation): string{
    let aiSecrets: Secret[] = [];
    let playerSecrets: Secret[] = [];
    
    aiSecrets = aiSecrets.concat(conv.gameData.characters.get(conv.gameData.aiID)!.secrets);
    playerSecrets = playerSecrets.concat(conv.gameData.characters.get(conv.gameData.playerID)!.secrets);

    let output ="SECRETS BELOW SHALL NOT BE REVEALED EASY, IF CHARACTER REVEALS IT, IT MAY BE USED AGAINST HIM AND LEAD HIM TO DEATH OR PRISON\n";
    if(aiSecrets.length>0){
        output += `${conv.gameData.aiName}'s secrets:`;
    }
    while(aiSecrets.length>0){
        const secret: Secret = aiSecrets.pop()!;
        output+=`\n${conv.gameData.aiName}: ${secret.desc}`;
    }

    if(playerSecrets.length>0){
        output += `\n\n${conv.gameData.playerName}'s secrets:`;
    }
    while(playerSecrets.length>0){
        const secret: Secret = playerSecrets.pop()!;
        output+=`\n${conv.gameData.playerName}: ${secret.desc}`;
    }

    return output+"\n\n";
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
