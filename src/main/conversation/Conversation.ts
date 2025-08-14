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
    exampleMessages: Message[];
    summaries: Summary[];
    currentSummary: string;
    
    constructor(gameData: GameData, config: Config, chatWindow: ChatWindow){
        this.chatWindow = chatWindow;
        this.isOpen = true;
        this.gameData = gameData;
        this.messages = [];
        this.currentSummary = "";

        this.summaries = [];
        if (!fs.existsSync(path.join(userDataPath, 'conversation_summaries'))){
            fs.mkdirSync(path.join(userDataPath, 'conversation_summaries'));
        }

        if (!fs.existsSync(path.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString()))){
            fs.mkdirSync(path.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString()));
        }
        
        if(fs.existsSync(path.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString(), this.gameData.aiID.toString()+".json"))){
            this.summaries = JSON.parse(fs.readFileSync(path.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString(), this.gameData.aiID.toString()+".json"), 'utf8'));
        }
        else{
            this.summaries = [];
            fs.writeFileSync(path.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString(), this.gameData.aiID.toString()+".json"), JSON.stringify(this.summaries, null, '\t'));
        }

        this.config = config;

        //TODO: wtf
        this.runFileManager = new RunFileManager(config.userFolderPath);
        this.description = "";
        this.actions = [];
        this.exampleMessages = [],

        [this.textGenApiConnection, this.summarizationApiConnection, this.actionsApiConnection] = this.getApiConnections();
        
        this.loadConfig();
    }

    pushMessage(message: Message): void{           
        this.messages.push(message);
    }

    async generateAIsMessages() {
        const shuffled_characters = Array.from(this.gameData.characters.values()).sort(() => Math.random() - 0.5);
        for (const character of shuffled_characters) {
            if (character.id !== this.gameData.playerID) {
                await this.generateNewAIMessage(character);
            }
        }
        this.chatWindow.window.webContents.send('actions-receive', []);
    }
    
    async generateNewAIMessage(character: Character){

        
        let responseMessage: Message;

        if(this.config.stream){
            this.chatWindow.window.webContents.send('stream-start');
        }

        let currentTokens = this.textGenApiConnection.calculateTokensFromChat(buildChatPrompt(this, character));
        //let currentTokens = 500;
        console.log(`current tokens: ${currentTokens}`);

        if(currentTokens > this.textGenApiConnection.context){
            console.log(`Context limit hit, resummarizing conversation! limit:${this.textGenApiConnection.context}`);
            await this.resummarize();
        }

        let streamMessage = {
            role: "assistant",
            name: character.fullName,//this.gameData.aiName,
            content: ""
        }
        let cw = this.chatWindow;
        function streamRelay(msgChunk: MessageChunk): void{
            streamMessage.content += msgChunk.content;
            cw.window.webContents.send('stream-message', streamMessage)
        }


        if(this.textGenApiConnection.isChat()){
            
            responseMessage = {
                role: "assistant",
                name: character.fullName,//this.gameData.aiName,
                content: await this.textGenApiConnection.complete(buildChatPrompt(this, character), this.config.stream, {
                    //stop: [this.gameData.playerName+":", this.gameData.aiName+":", "you:", "user:"],
                    max_tokens: this.config.maxTokens,
                },
                streamRelay)
            };  
            
        }
        //instruct
        else{

            responseMessage = {
                role: "assistant",
                name: character.fullName,
                content: await this.textGenApiConnection.complete(convertChatToText(buildChatPrompt(this, character), this.config, character.fullName), this.config.stream, {
                    stop: [this.config.inputSequence, this.config.outputSequence],
                    max_tokens: this.config.maxTokens,
                },
                streamRelay)
            };
    
        }

        if(this.config.cleanMessages){
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
            console.log(`Preamble terminator found. Stripping preamble.`);
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
                console.log(`Preamble detected via fallback. Stripping preamble.`);
                content = content.substring(fallbackSplitIndex);
            }
        }

        // Final cleanup: After stripping the preamble, remove the character name prefix from the start of the actual response.
        const aiPrefixes = [`${character.fullName}:`, `${character.shortName}:`];
        for (const prefix of aiPrefixes) {
            if (content.startsWith(prefix)) {
                content = content.substring(prefix.length).trim();
                break;
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
                this.chatWindow.window.webContents.send('error-message', { text: errorMsg });
                return; // Stop processing this message
            }
        }

        // If the response is empty after cleaning, don't send it.
        if (!responseMessage.content.trim()) {
            console.log(`AI response for ${character.fullName} was empty after cleaning. Skipping.`);
            return;
        }

        this.pushMessage(responseMessage);

        if(!this.config.stream){
            this.chatWindow.window.webContents.send('message-receive', responseMessage, this.config.actionsEnableAll);
        }
        
        if (character.id === this.gameData.aiID){
            let collectedActions: ActionResponse[];
            if(this.config.actionsEnableAll){
                try{
                    collectedActions = await checkActions(this);
                }
                catch(e){
                    collectedActions = [];
                }
            }
            else{
                collectedActions = [];
            }
    
            this.chatWindow.window.webContents.send('actions-receive', collectedActions);    
        }
    }

    async resummarize(){
        let tokensToSummarize = this.textGenApiConnection.context * (this.config.percentOfContextToSummarize / 100)
        console.log(`context: ${this.textGenApiConnection.context} percent to summarize: ${this.config.percentOfContextToSummarize} tokens to summarize: ${tokensToSummarize}`)
            let tokenSum = 0;
            let messagesToSummarize: Message[] = [];

            while(tokenSum < tokensToSummarize && this.messages.length > 0){
                let msg = this.messages.shift()!;
                tokenSum += this.textGenApiConnection.calculateTokensFromMessage(msg);
                console.log("to remove:")
                console.log(msg)
                messagesToSummarize.push(msg);
            }

            if(messagesToSummarize.length > 0){ //prevent infinite loops
                console.log("current summary: "+this.currentSummary)
                if(this.summarizationApiConnection.isChat()){
                    this.currentSummary = await this.summarizationApiConnection.complete(buildResummarizeChatPrompt(this, messagesToSummarize), false, {});
                }
                else{
                    this.currentSummary = await this.summarizationApiConnection.complete(convertChatToTextNoNames(buildResummarizeChatPrompt(this, messagesToSummarize), this.config), false, {});
                }
               
                console.log("after current summary: "+this.currentSummary)
            }
    }

    // Store a summary for each character participating in the conversation.
    async summarize() {
        this.isOpen = false;
        // Write a trigger event to the game (e.g., trigger conversation end event)
        this.runFileManager.write("trigger_event = talk_event.9002");
        setTimeout(() => {
            this.runFileManager.clear();  // Clear the event file after a delay (to ensure the game has read it)
        }, 500);

        // Do not generate a summary if there are not enough messages
        if (this.messages.length < 6) {
            console.log("Not enough messages to generate a summary.");
            return;
        }

        // Generate a new summary (by calling the summarize utility function)
        const summary: Summary = {
            date: this.gameData.date,  // Current in-game date
            content: await summarize(this)  // Asynchronously generate summary content
        };

        this.gameData.characters.forEach((_value, key) => {
            if (key !== this.gameData.playerID) {
                this.summaries=[]
                const summaryDir = path.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString());
                if (!fs.existsSync(summaryDir)) {
                    fs.mkdirSync(summaryDir, { recursive: true });
                }
        
                // Load historical summaries (if they exist)
                const summaryFile = path.join(summaryDir, `${key.toString()}.json`);
                if (fs.existsSync(summaryFile)) {
                    this.summaries = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
                } else {
                    fs.writeFileSync(summaryFile, JSON.stringify(this.summaries, null, '\t'));  // Initialize an empty summary file
                }
                // Add the new summary to the beginning of the list
                this.summaries.unshift(summary);
                // Persist the summaries, categorized by player ID and AI ID
                const summaryFile1 = path.join(
                    userDataPath, 
                    'conversation_summaries', 
                    this.gameData.playerID.toString(), 
                    `${key.toString()}.json`
                    );
                fs.writeFileSync(summaryFile1, JSON.stringify(this.summaries, null, '\t'));
            }
            })
        }; 

    updateConfig(config: Config){
        console.log("config updated!")
        this.loadConfig();
    }

    loadConfig(){

        console.log(this.config.toSafeConfig());

        this.runFileManager = new RunFileManager(this.config.userFolderPath);
        this.runFileManager.clear();

        this.description = "";
        this.exampleMessages = [];

        const descriptionPath = path.join(userDataPath, 'scripts', 'prompts', 'description', this.config.selectedDescScript)
        try{
            delete require.cache[require.resolve(path.join(descriptionPath))];
            this.description = require(path.join(descriptionPath))(this.gameData); 
        }catch(err){
            throw new Error("description script error, your used description script file is not valid! error message:\n"+err);
        }
        const exampleMessagesPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages', this.config.selectedExMsgScript);
        try{
            delete require.cache[require.resolve(path.join(exampleMessagesPath))];
            this.exampleMessages= require(path.join(exampleMessagesPath))(this.gameData);
        }catch(err){
            throw new Error("example messages script error, your used example messages file is not valid! error message:\n"+err);
        }
    
        this.loadActions();
    }

    getApiConnections(){
        let textGenApiConnection, summarizationApiConnection, actionsApiConnection
        summarizationApiConnection = textGenApiConnection = actionsApiConnection = new ApiConnection(this.config.textGenerationApiConnectionConfig.connection, this.config.textGenerationApiConnectionConfig.parameters);

        if(this.config.summarizationUseTextGenApi){
            this.summarizationApiConnection = new ApiConnection(this.config.textGenerationApiConnectionConfig.connection, this.config.summarizationApiConnectionConfig.parameters);;
        }

        if(this.config.actionsUseTextGenApi){;
            this.actionsApiConnection = new ApiConnection(this.config.textGenerationApiConnectionConfig.connection, this.config.actionsApiConnectionConfig.parameters);;
        }
        return [textGenApiConnection, summarizationApiConnection, actionsApiConnection];
    }

    async loadActions(){
        this.actions = [];

        const actionsPath = path.join(userDataPath, 'scripts', 'actions');
        let standardActionFiles = fs.readdirSync(path.join(actionsPath, 'standard')).filter(file => path.extname(file) === ".js");
        let customActionFiles = fs.readdirSync(path.join(actionsPath, 'custom')).filter(file => path.extname(file) === ".js");

        for(const file of standardActionFiles) {

            if(this.config.disabledActions.includes(path.basename(file).split(".")[0])){
                continue;
            }
            
            delete require.cache[require(path.join(actionsPath, 'standard', file))];
            this.actions.push(require(path.join(actionsPath, 'standard', file)));
            console.log(`loaded standard action: `+file)
        }

        for(const file of customActionFiles) {

            if(this.config.disabledActions.includes(path.basename(file).split(".")[0])){
                continue;
            }
    
            delete require.cache[require(path.join(actionsPath, 'custom', file))];
            this.actions.push(require(path.join(actionsPath, 'custom', file)));
            console.log(`loaded custom action: `+file)
        }
    }

}
