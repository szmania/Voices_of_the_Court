import { app } from 'electron';
import { GameData } from '../../shared/gameData/GameData.js';
import { Character } from '../../shared/gameData/Character.js';
import { Config } from '../../shared/Config.js';
import { ApiConnection} from '../../shared/apiConnection.js';
import { checkActions } from './checkActions.js';
import { convertChatToText, buildChatPrompt, buildResummarizeChatPrompt, convertChatToTextNoNames} from './promptBuilder.js';
import { cleanMessageContent } from './messageCleaner.js';
import { summarize } from './summarize.js';
import fs from 'fs';
import path from 'path';

import {Message, MessageChunk, ErrorMessage, Summary, Action, ActionResponse} from '../ts/conversation_interfaces.js';
import { RunFileManager } from '../RunFileManager.js';
import { ChatWindow } from '../windows/ChatWindow.js';

const userDataPath = path.join(app.getPath('userData'), 'votc_data');

export class Conversation{
    chatWindow: ChatWindow;
    isOpen: boolean;
    gameData: GameData;
    messages: Message[];
    config: Config;
    runFileManager: RunFileManager;
    textGenApiConnection: ApiConnection;
    summarizationApiConnection: ApiConnection;
    actionsApiConnection: ApiConnection;
    description: string;
    actions: Action[];
    summaries: Map<number, Summary[]>;
    currentSummary: string;
    
    constructor(gameData: GameData, config: Config, chatWindow: ChatWindow){
        console.log('Conversation initialized.');
        this.chatWindow = chatWindow;
        this.isOpen = true;
        this.gameData = gameData;
        this.messages = [];
        this.currentSummary = "";

        this.summaries = new Map<number, Summary[]>();
        const summariesBasePath = path.join(userDataPath, 'conversation_summaries');
        if (!fs.existsSync(summariesBasePath)){
            fs.mkdirSync(summariesBasePath);
            console.log('Created conversation_summaries directory.');
        }

        const playerSummaryPath = path.join(summariesBasePath, this.gameData.playerID.toString());
        if (!fs.existsSync(playerSummaryPath)){
            fs.mkdirSync(playerSummaryPath);
            console.log(`Created player-specific summary directory for player ID: ${this.gameData.playerID}`);
        }
        
        // Load summaries for all non-player characters
        this.gameData.characters.forEach((character) => {
            if (character.id !== this.gameData.playerID) {
                const summaryFilePath = path.join(playerSummaryPath, `${character.id.toString()}.json`);
                let characterSummaries: Summary[] = [];
                if (fs.existsSync(summaryFilePath)) {
                    try {
                        characterSummaries = JSON.parse(fs.readFileSync(summaryFilePath, 'utf8'));
                        characterSummaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        console.log(`Loaded and sorted ${characterSummaries.length} prior summaries for AI ID ${character.id} from ${summaryFilePath}.`);
                    } catch (e) {
                        console.error(`Error parsing summary file for AI ID ${character.id}: ${e}`);
                    }
                } else {
                    fs.writeFileSync(summaryFilePath, JSON.stringify([], null, '\t'));
                    console.log(`No prior summaries found for AI ID ${character.id}. Initialized empty summaries file at ${summaryFilePath}.`);
                }
                this.summaries.set(character.id, characterSummaries);
            }
        });

        this.config = config;

        //TODO: wtf
        this.runFileManager = new RunFileManager(config.userFolderPath);
        this.description = "";
        this.actions = [];

        [this.textGenApiConnection, this.summarizationApiConnection, this.actionsApiConnection] = this.getApiConnections();
        
        this.loadConfig();
    }

    pushMessage(message: Message): void{           
        this.messages.push(message);
        console.log(`Message pushed to conversation. Role: ${message.role}, Name: ${message.name}, Content length: ${message.content.length}`);
    }

    async generateAIsMessages() {
        console.log('Starting generation of AI messages for all characters.');

        // Special case for self-talk (player character is the AI character)
        if (this.gameData.playerID === this.gameData.aiID) {
            console.log('Self-talk session detected. Generating internal monologue for player character.');
            const playerCharacter = this.gameData.getPlayer();
            await this.generateNewAIMessage(playerCharacter);
            this.chatWindow.window.webContents.send('actions-receive', []); // No actions in self-talk
            console.log('Finished generating self-talk message.');
            return; // Exit after self-talk message
        }

        // Standard multi-character conversation logic
        const shuffled_characters = Array.from(this.gameData.characters.values()).sort(() => Math.random() - 0.5);
        for (const character of shuffled_characters) {
            if (character.id !== this.gameData.playerID) { // Only generate for non-player characters
                await this.generateNewAIMessage(character);
            }
        }
        this.chatWindow.window.webContents.send('actions-receive', []);
        console.log('Finished generating AI messages for all characters.');
    }
    
    async generateNewAIMessage(character: Character){
        console.log(`Generating AI message for character: ${character.fullName}`);
        
        const isSelfTalk = this.gameData.playerID === this.gameData.aiID;
        const characterNameForResponse = isSelfTalk ? character.shortName : character.fullName;

        let responseMessage: Message;

        if(this.config.stream){
            this.chatWindow.window.webContents.send('stream-start');
            console.log('Stream started for AI message generation.');
        }

        let currentTokens = this.textGenApiConnection.calculateTokensFromChat(buildChatPrompt(this, character));
        //let currentTokens = 500;
        console.log(`Current prompt token count: ${currentTokens}`);

        if(currentTokens > this.textGenApiConnection.context){
            console.log(`Context limit hit (${currentTokens}/${this.textGenApiConnection.context} tokens), resummarizing conversation!`);
            await this.resummarize();
        }

        let streamMessage = {
            role: "assistant",
            name: characterNameForResponse,//this.gameData.aiName,
            content: ""
        }
        let cw = this.chatWindow;
        function streamRelay(msgChunk: MessageChunk): void{
            streamMessage.content += msgChunk.content;
            const messageToSend = JSON.parse(JSON.stringify(streamMessage));
            
            if (isSelfTalk) {
                messageToSend.content = `*${messageToSend.content}`;
            }
            cw.window.webContents.send('stream-message', messageToSend);
        }


        if(this.textGenApiConnection.isChat()){
            console.log('Using chat API for AI message completion.');
            responseMessage = {
                role: "assistant",
                name: characterNameForResponse,//this.gameData.aiName,
                content: await this.textGenApiConnection.complete(buildChatPrompt(this, character), this.config.stream, {
                    //stop: [this.gameData.playerName+":", this.gameData.aiName+":", "you:", "user:"],
                    max_tokens: this.config.maxTokens,
                },
                streamRelay)
            };  
            
        }
        //instruct
        else{
            console.log('Using completion API for AI message completion.');
            responseMessage = {
                role: "assistant",
                name: characterNameForResponse,
                content: await this.textGenApiConnection.complete(convertChatToText(buildChatPrompt(this, character), this.config, character.fullName), this.config.stream, {
                    stop: [this.config.inputSequence, this.config.outputSequence],
                    max_tokens: this.config.maxTokens,
                },
                streamRelay)
            };
    
        }

        if(this.config.cleanMessages){
            console.log('Cleaning AI message content.');
            responseMessage.content = cleanMessageContent(responseMessage.content);
        }

        let content = responseMessage.content.trim();

        // Stage 1: Look for explicit phrases that terminate a preamble.
        const preambleTerminators = [
            "Time to write the reply.",
            "Here is the reply.",
            "Here's the reply.",
            "Now for the reply.",
            "Now, I will write the reply."
        ];

        let splitIndex = -1;
        let terminatorLength = 0;

        for (const terminator of preambleTerminators) {
            const index = content.lastIndexOf(terminator);
            if (index > splitIndex) {
                splitIndex = index;
                terminatorLength = terminator.length;
            }
        }

        const PREAMBLE_MIN_LENGTH = 100; // A safety check for all stripping operations.

        // If a terminator was found and it's preceded by a long preamble, strip it.
        if (splitIndex > PREAMBLE_MIN_LENGTH) {
            console.log(`Preamble terminator found. Stripping preamble from AI response.`);
            content = content.substring(splitIndex + terminatorLength).trim();
        }
        // Stage 2: Fallback for cases without a clear terminator phrase.
        // This looks for the last instance of "Character Name:"
        else {
            const markers = [`${character.fullName}:`, `${character.shortName}:`];
            let fallbackSplitIndex = -1;
            for (const marker of markers) {
                const index = content.lastIndexOf(marker);
                if (index > fallbackSplitIndex) {
                    fallbackSplitIndex = index;
                }
            }

            if (fallbackSplitIndex > PREAMBLE_MIN_LENGTH) {
                console.log(`Preamble detected via fallback. Stripping preamble from AI response.`);
                content = content.substring(fallbackSplitIndex);
            }
        }

        // Final cleanup: After stripping the preamble, remove the character name prefix from the start of the actual response.
        const characterNames = [character.fullName, character.shortName].filter(Boolean);
        if (characterNames.length > 0) {
            // Escape names for regex and join with |
            const namePattern = characterNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            
            // Regex to find name at the start, followed by any characters up to a comma or colon.
            // This is to strip prefixes like "Name:", "Name,", or "Name, doing something:".
            const prefixRegex = new RegExp(`^\\s*\\b(${namePattern})\\b.*?[,:]`, 'i');
            
            const match = content.match(prefixRegex);
            if (match) {
                console.log(`Found and stripping prefix: "${match[0]}"`);
                content = content.substring(match[0].length).trim();
            }
        }

        responseMessage.content = content;

        // The AI should not generate a response for the player.
        const player = this.gameData.getPlayer();
        const playerPrefixes = [`${player.fullName}:`, `${player.shortName}:`];
        for (const prefix of playerPrefixes) {
            if (responseMessage.content.trim().startsWith(prefix)) {
                const errorMsg = `Error: The AI attempted to generate a response for the player character (${player.shortName}). This action has been blocked.`;
                console.error(errorMsg + `\nOriginal AI response: "${responseMessage.content}"`);
                this.chatWindow.window.webContents.send('error-message', errorMsg);
                return; // Stop processing this message
            }
        }

        // If the response is empty after cleaning, don't send it.
        if (!responseMessage.content.trim()) {
            console.log(`AI response for ${character.fullName} was empty after cleaning. Skipping.`);
            return;
        }

        if (isSelfTalk) {
            // First, remove any leading or trailing asterisks from the raw response to prevent doubling them up.
            let cleanedContent = responseMessage.content.replace(/^\*+|\*+$/g, '').trim();
            responseMessage.content = `*${cleanedContent}*`;
        }
        this.pushMessage(responseMessage);

        if (this.config.stream) {
            // The stream is over, send the final, cleaned, and formatted message
            // to replace the streaming content in the UI.
            streamMessage.content = responseMessage.content;
            this.chatWindow.window.webContents.send('stream-message', streamMessage);
            console.log('Sent final stream message to chat window.');
        } else {
            this.chatWindow.window.webContents.send('message-receive', responseMessage, this.config.actionsEnableAll);
            console.log('Sent AI message to chat window (non-streaming).');
        }
        
        // Only check for actions if it's a conversation between two different characters
        if (this.gameData.playerID !== this.gameData.aiID) {
            if (character.id === this.gameData.aiID){
                let collectedActions: ActionResponse[];
                if(this.config.actionsEnableAll){
                    try{
                        console.log('Actions are enabled. Checking for actions...');
                        collectedActions = await checkActions(this);
                    }
                    catch(e){
                        console.error(`Error during action check: ${e}`);
                        collectedActions = [];
                    }
                }
                else{
                    console.log('Actions are disabled in config.');
                    collectedActions = [];
                }
    
                this.chatWindow.window.webContents.send('actions-receive', collectedActions);    
                console.log(`Sent ${collectedActions.length} actions to chat window.`);
            }
        }
    }

    async resummarize(){
        console.log('Starting conversation resummarization due to context limit.');
        let tokensToSummarize = this.textGenApiConnection.context * (this.config.percentOfContextToSummarize / 100)
        console.log(`Context: ${this.textGenApiConnection.context}, Percent to summarize: ${this.config.percentOfContextToSummarize}%, Tokens to summarize: ${tokensToSummarize}`);
            let tokenSum = 0;
            let messagesToSummarize: Message[] = [];

            while(tokenSum < tokensToSummarize && this.messages.length > 0){
                let msg = this.messages.shift()!;
                tokenSum += this.textGenApiConnection.calculateTokensFromMessage(msg);
                console.log("Message removed for summarization:")
                console.log(msg)
                messagesToSummarize.push(msg);
            }

            if(messagesToSummarize.length > 0){ //prevent infinite loops
                console.log("Current summary before resummarization: "+this.currentSummary);
                if(this.summarizationApiConnection.isChat()){
                    console.log('Using chat API for resummarization.');
                    this.currentSummary = await this.summarizationApiConnection.complete(
                        buildResummarizeChatPrompt(this, messagesToSummarize),
                        false,
                        {},
                    );
                }
                else{
                    console.log('Using completion API for resummarization.');
                    this.currentSummary = await this.summarizationApiConnection.complete(
                        convertChatToTextNoNames(buildResummarizeChatPrompt(this, messagesToSummarize), this.config),
                        false,
                        {
                            stop: [this.config.inputSequence, this.config.outputSequence],
                            max_tokens: this.config.maxTokens,
                        },
                    );
                }
               
                console.log("New current summary after resummarization: "+this.currentSummary);
            } else {
                console.log('No messages to summarize during resummarization.');
            }
    }

    // Store a summary for each character participating in the conversation.
    async summarize() {
        console.log('Starting end-of-conversation summarization process.');
        this.isOpen = false;
        // Write a trigger event to the game (e.g., trigger conversation end event)
        this.runFileManager.write("trigger_event = talk_event.9002");
        setTimeout(() => {
            this.runFileManager.clear();  // Clear the event file after a delay (to ensure the game has read it)
            console.log('Run file cleared after conversation end event.');
        }, 500);

        // Ensure the conversation_history directory exists
        const historyDir = path.join(userDataPath, 'conversation_history' ,this.gameData.playerID.toString());

        if (!fs.existsSync(historyDir)) {
          fs.mkdirSync(historyDir, { recursive: true });
          console.log(`Created conversation history directory: ${historyDir}`);
        }

        // Process conversation messages, keeping only name and content
        const processedMessages = this.messages.map(msg => ({
          name: msg.name,
          content: msg.content
        }));

        // Build the text content to be saved
        let textContent = `Date: ${this.gameData.date}\n\n`;

        processedMessages.forEach((msg, index) => {
          textContent += `${msg.name}: ${msg.content}\n\n`;
        });

        // Store the message text for generating summaries in txt format
        const historyFile = path.join(
          userDataPath,
          'conversation_history',
          this.gameData.playerID.toString(),
          `${this.gameData.playerID}_${this.gameData.aiID}_${new Date().getTime()}.txt`
        );
        fs.writeFileSync(historyFile, textContent);
        console.log(`Conversation history saved to: ${historyFile}`)

        // Do not generate a summary if there are not enough messages
        if (this.messages.length < 2) {
            console.log("Not enough messages to generate a summary (less than 2). Skipping summary generation.");
            return;
        }

        // Generate a new summary (by calling the summarize utility function)
        const newSummary: Summary = {
            date: this.gameData.date,  // Current in-game date
            content: await summarize(this)  // Asynchronously generate summary content
        };
        console.log(`Generated new summary for conversation: ${newSummary.content.substring(0, 100)}...`);


        this.gameData.characters.forEach((character) => {
            if (character.id !== this.gameData.playerID) {
                const summaryDir = path.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString());
                const summaryFile = path.join(summaryDir, `${character.id.toString()}.json`);

                // Get existing summaries from the map, or start with an empty array
                const existingSummaries = this.summaries.get(character.id) || [];
                
                // Add the new summary to the end of the list ONLY if its content is not empty
                if (newSummary.content.trim()) {
                    existingSummaries.unshift(newSummary); // Changed from .push to .unshift
                    
                    // Persist the updated summaries for the specific character
                    fs.writeFileSync(summaryFile, JSON.stringify(existingSummaries, null, '\t'));
                    console.log(`Saved updated summaries for AI ID ${character.id} to ${summaryFile}. Total summaries: ${existingSummaries.length}`);
                } else {
                    console.log(`Skipping saving empty summary for AI ID ${character.id}.`);
                }
            }
        });


        }; 

    updateConfig(config: Config){
        console.log("Config updated! Reloading conversation configuration.");
        this.config = config; // Ensure the config object itself is updated
        this.loadConfig();
    }

    loadConfig(){
        console.log('Loading conversation configuration.');
        console.log('Current config (safe version):', this.config.toSafeConfig());

        this.runFileManager = new RunFileManager(this.config.userFolderPath);
        this.runFileManager.clear();

        this.description = "";

        const descriptionScriptFileName = this.config.selectedDescScript;
        const descriptionPath = path.join(userDataPath, 'scripts', 'prompts', 'description', descriptionScriptFileName);
        try{
            delete require.cache[require.resolve(descriptionPath)];
            this.description = require(descriptionPath)(this.gameData); 
            console.log(`Description script '${descriptionScriptFileName}' loaded successfully.`);
        }catch(err){
            console.error(`Description script error for '${descriptionScriptFileName}': ${err}`);
            throw new Error("description script error, your used description script file is not valid! error message:\n"+err);
        }
    
        this.loadActions();
    }

    getApiConnections(){
        let textGenApiConnection, summarizationApiConnection, actionsApiConnection;
        
        textGenApiConnection = new ApiConnection(this.config.textGenerationApiConnectionConfig.connection, this.config.textGenerationApiConnectionConfig.parameters);
        console.log('Text generation API connection configured.');

        if(this.config.summarizationUseTextGenApi){
            this.summarizationApiConnection = new ApiConnection(this.config.textGenerationApiConnectionConfig.connection, this.config.summarizationApiConnectionConfig.parameters);
            console.log('Summarization API connection configured (using text generation API).');
        } else {
            this.summarizationApiConnection = new ApiConnection(this.config.summarizationApiConnectionConfig.connection, this.config.summarizationApiConnectionConfig.parameters);
            console.log('Summarization API connection configured (using dedicated summarization API).');
        }

        if(this.config.actionsUseTextGenApi){
            this.actionsApiConnection = new ApiConnection(this.config.textGenerationApiConnectionConfig.connection, this.config.actionsApiConnectionConfig.parameters);
            console.log('Actions API connection configured (using text generation API).');
        } else {
            this.actionsApiConnection = new ApiConnection(this.config.actionsApiConnectionConfig.connection, this.config.actionsApiConnectionConfig.parameters);
            console.log('Actions API connection configured (using dedicated actions API).');
        }
        return [textGenApiConnection, this.summarizationApiConnection, this.actionsApiConnection];
    }

    async loadActions(){
        console.log('Loading actions from scripts.');
        this.actions = [];

        const actionsPath = path.join(userDataPath, 'scripts', 'actions');
        let standardActionFiles = fs.readdirSync(path.join(actionsPath, 'standard')).filter(file => path.extname(file) === ".js");
        let customActionFiles = fs.readdirSync(path.join(actionsPath, 'custom')).filter(file => path.extname(file) === ".js");

        for(const file of standardActionFiles) {
            const actionName = path.basename(file).split(".")[0];
            if(this.config.disabledActions.includes(actionName)){
                console.log(`Skipping disabled standard action: ${actionName}`);
                continue;
            }
            
            const filePath = path.join(actionsPath, 'standard', file);
            delete require.cache[require.resolve(filePath)];
            this.actions.push(require(filePath));
            console.log(`Loaded standard action: ${file}`);
        }

        for(const file of customActionFiles) {
            const actionName = path.basename(file).split(".")[0];
            if(this.config.disabledActions.includes(actionName)){
                console.log(`Skipping disabled custom action: ${actionName}`);
                continue;
            }
    
            const filePath = path.join(actionsPath, 'custom', file);
            delete require.cache[require.resolve(filePath)];
            this.actions.push(require(filePath));
            console.log(`Loaded custom action: ${file}`);
        }
        console.log(`Finished loading actions. Total actions loaded: ${this.actions.length}`);
    }

}
