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

    if (isSelfTalk) {
        const selfTalkPromptFileName = conv.config.selfTalkPrompt;
        const selfTalkPromptPath = path.join(userDataPath, 'scripts', 'prompts', 'self-talk', selfTalkPromptFileName);
        try {
            delete require.cache[require.resolve(selfTalkPromptPath)];
            const getSelfTalkPrompt = require(selfTalkPromptPath);
            chatPrompt.push({
                role: "system",
                content: parseVariables(getSelfTalkPrompt(conv.gameData), conv.gameData)
            });
            console.log(`Added self-talk main prompt from script: ${selfTalkPromptFileName}.`);
        } catch (err) {
            console.error(`Error loading self-talk main prompt script '${selfTalkPromptFileName}': ${err}. Falling back to standard main prompt.`);
            conv.chatWindow.window.webContents.send('error-message', `Error in self-talk main prompt script '${selfTalkPromptFileName}'. Falling back.`);
            chatPrompt.push({
                role: "system",
                content: parseVariables(conv.config.mainPrompt, conv.gameData)
            });
        }
    } else {
        chatPrompt.push({
            role: "system",
            content: parseVariables(conv.config.mainPrompt, conv.gameData)
        });
        console.log('Added standard main prompt.');
    }

    chatPrompt.push({
        role: "system",
        content: "[example messages]"
    })

    let exampleMessagesScriptFileName: string;
    let exampleMessagesPath: string | null;

    if (isSelfTalk) {
        exampleMessagesScriptFileName = conv.config.selectedSelfTalkExMsgScript;
        exampleMessagesPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', 'self-talk', exampleMessagesScriptFileName);
    } else {
        exampleMessagesScriptFileName = conv.config.selectedExMsgScript;
        const standardPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', "standard", exampleMessagesScriptFileName);
        const customPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', "custom", exampleMessagesScriptFileName);

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
            chatPrompt = chatPrompt.concat(exampleMessages);
            console.log(`Added example messages from script: ${exampleMessagesScriptFileName}.`);
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
        content: conv.description
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
            summaryString = "Here are the date and summary of previous conversations between " + character.fullName + " and " + conv.gameData.playerName + ":\n";
        }

        const summariesToProcess = [...characterSummaries];
        summariesToProcess.reverse();

        for(let summary of summariesToProcess){
            // 只添加日期不晚于当前游戏日期的总结.Only add summaries with a date no later than the current game date.
            if(new Date(summary.date) <= new Date(conv.gameData.date)){
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

function getDateDifference(pastDate: string, todayDate: string): string{

    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ];

      const past = {
        day: Number(pastDate.split(" ")[0]),
        month: months.indexOf(pastDate.split(" ")[1]),
        year: Number(pastDate.split(" ")[2])
      }

      const today = {
        day: Number(todayDate.split(" ")[0]),
        month: months.indexOf(todayDate.split(" ")[1]),
        year: Number(todayDate.split(" ")[2])
      }

      let totalDays = (today.year - past.year) * 365 + (today.month - past.month) * 30 + (today.day - past.day);

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

function createMemoryString(conv: Conversation): string{

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
