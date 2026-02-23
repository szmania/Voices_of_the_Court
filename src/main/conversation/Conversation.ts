
import { app } from 'electron';
import { GameData } from '../../shared/gameData/GameData.js';
import { Character } from '../../shared/gameData/Character.js';
import { Config } from '../../shared/Config.js';
import { ApiConnection} from '../../shared/apiConnection.js';
import { checkActions } from './checkActions.js';
import { convertChatToText, buildChatPrompt, buildResummarizeChatPrompt, convertChatToTextNoNames} from './promptBuilder.js';
import { generateSuggestions } from './suggestionBuilder.js';
import { generateSceneDescription } from './sceneDescriptionBuilder.js';
import { cleanMessageContent } from './messageCleaner.js';
import { summarize } from './summarize.js';
import fs from 'fs';
import path from 'path';

import {Message, MessageChunk, ErrorMessage, Summary, Action, ActionResponse} from '../ts/conversation_interfaces.js';
import { RunFileManager } from '../RunFileManager.js';
import { ChatWindow } from '../windows/ChatWindow.js';
import { SummaryFileWatcher } from './SummaryFileWatcher.js';

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
    narratives: Map<number, string[]>; // 存储每个消息ID对应的旁白列表
    summaryFileWatcher: SummaryFileWatcher; // 文件监控器
    consecutiveActionsCount: number; // Track consecutive responses with actions
    lastActionMessageIndex: number; // Track the last message index that had actions
    historicalConversations!: Array<{date: string, location: string, messages: Message[]}>; // Store historical conversation metadata
    
    constructor(gameData: GameData, config: Config, chatWindow: ChatWindow){
        console.log('Conversation initialized.');
        this.chatWindow = chatWindow;
        this.chatWindow.conversation = this;
        this.isOpen = true;
        this.gameData = gameData;
        this.messages = [];
        this.currentSummary = "";
        this.narratives = new Map<number, string[]>(); // 初始化旁白存储

        // 如果角色数量大于2，为所有非玩家角色创建空白消息
        if (gameData.characters.size > 2) {
            console.log(`Creating initial messages for ${gameData.characters.size - 1} non-player characters.`);
            gameData.characters.forEach((character) => {
                if (character.id !== gameData.playerID) {
                    const emptyMessage: Message = {
                        role: "assistant",
                        name: character.shortName,
                        content: "尚未发言"
                    };
                    this.messages.push(emptyMessage);
                    console.log(`Created empty message for character: ${character.shortName}`);
                }
            });
        }

        this.summaries = new Map<number, Summary[]>();
        this.summaryFileWatcher = new SummaryFileWatcher(); // 初始化文件监控器
        this.consecutiveActionsCount = 0; // Initialize consecutive actions counter
        this.lastActionMessageIndex = -1; // Initialize last action message index
        this.historicalConversations = []; // Initialize historical conversations array
        
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
                
                // 设置文件监控，当文件变化时自动重新加载
                this.summaryFileWatcher.watchFile(summaryFilePath, (updatedSummaries) => {
                    this.summaries.set(character.id, updatedSummaries);
                    console.log(`Automatically reloaded summaries for character ID ${character.id} due to file change`);
                });
            }
        });

        this.config = config;

        //TODO: wtf
        this.runFileManager = new RunFileManager(config.userFolderPath);
        this.description = "";
        this.actions = [];

        [this.textGenApiConnection, this.summarizationApiConnection, this.actionsApiConnection] = this.getApiConnections();
        
        this.loadConfig();
        
        // 如果启用了场景描述生成功能，在对话开始时生成场景描述
        if (this.config.generateSceneDescription) {
            this.generateInitialSceneDescription();
        }
        
        // 如果启用了自动生成建议功能，在对话开始时生成建议
        if (this.config.autoGenerateSuggestions) {
            // 如果场景描述生成也启用了，会在场景描述生成完成后自动调用建议生成
            if (!this.config.generateSceneDescription) {
                // 如果没有启用场景描述生成，直接生成建议
                this.generateInitialSuggestions();
            }
        }
        this.loadHistory();
        this.initiateConversation();
    }

    private loadHistory(): void {
        // Check if historical conversation loading is enabled
        if (!this.config.showPreviousConversations) {
            console.log('Historical conversation loading is disabled in config.');
            return;
        }
        
        console.log('Attempting to load historical conversation history.');
        const historyDir = path.join(userDataPath, 'conversation_history', this.gameData.playerID.toString());
        
        if (!fs.existsSync(historyDir)) {
            console.log('No history directory found for this player.');
            return;
        }

        // Get all historical conversation files for this player and AI character
        const files = fs.readdirSync(historyDir)
            .filter(file => file.startsWith(`${this.gameData.playerID}_${this.gameData.aiID}_`) && file.endsWith('.txt'))
            .map(file => ({
                name: file,
                time: parseInt(file.split('_')[2].split('.')[0]) || 0
            }))
            .sort((a, b) => b.time - a.time); // Sort by timestamp, newest first

        if (files.length === 0) {
            console.log('No previous history files found for this character pair.');
            return;
        }

        console.log(`Found ${files.length} historical conversation files. Loading all files...`);
        
        // Track loaded messages count
        let totalMessagesLoaded = 0;
        
        // Store historical conversation metadata (date and location for each file)
        const historicalConversations: Array<{date: string, location: string, messages: Message[]}> = [];
        
        // Load all historical conversation files
        for (const fileInfo of files) {
            const filePath = path.join(historyDir, fileInfo.name);
            console.log(`Loading historical conversation from: ${filePath}`);
            
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                
                let currentDate = this.gameData.date; // Default to current date
                let currentLocation = this.gameData.location; // Default to current location
                const fileMessages: Message[] = [];
                let currentMessage: Message | null = null;
                let messageIndex = -1;

                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;
                    
                    // Parse date from file
                    if (line.startsWith('Date:')) {
                        currentDate = line.replace('Date:', '').trim();
                        console.log(`Found historical conversation date: ${currentDate}`);
                        continue;
                    }
                    
                    // Parse location if present (custom format)
                    if (line.startsWith('Location:')) {
                        currentLocation = line.replace('Location:', '').trim();
                        console.log(`Found historical conversation location: ${currentLocation}`);
                        continue;
                    }

                    if (line.startsWith('[旁白]:')) {
                        if (messageIndex !== -1) {
                            const narrative = line.replace('[旁白]:', '').trim();
                            this.addNarrativeToMessage(this.messages.length + messageIndex, narrative);
                        }
                        continue;
                    }

                    const colonIndex = line.indexOf(':');
                    if (colonIndex !== -1) {
                        const name = line.substring(0, colonIndex).trim();
                        const messageContent = line.substring(colonIndex + 1).trim();
                        
                        const role = (name === this.gameData.playerName.replace(/\s+/g, '')) ? 'user' : 'assistant';
                        
                        currentMessage = {
                            role: role as 'user' | 'assistant',
                            name: name,
                            content: messageContent
                        };
                        fileMessages.push(currentMessage);
                        messageIndex = fileMessages.length - 1;
                        totalMessagesLoaded++;
                    }
                }
                
                // Store this conversation's metadata and messages
                if (fileMessages.length > 0) {
                    historicalConversations.push({
                        date: currentDate,
                        location: currentLocation,
                        messages: fileMessages
                    });
                    
                    // Add messages to the main messages array
                    this.messages.push(...fileMessages);
                }
                
                console.log(`Loaded ${fileMessages.length} messages from ${fileInfo.name} (Date: ${currentDate}, Location: ${currentLocation})`);
            } catch (error) {
                console.error(`Error reading or parsing history file ${fileInfo.name}: ${error}`);
            }
        }
        
        console.log(`Successfully loaded ${totalMessagesLoaded} messages from ${files.length} historical conversations.`);
        
        // Store historical conversation metadata for later use
        this.historicalConversations = historicalConversations;
    }

    pushMessage(message: Message): void{           
        this.messages.push(message);
        console.log(`Message pushed to conversation. Role: ${message.role}, Name: ${message.name}, Content length: ${message.content.length}`);
        
        // Reset consecutive actions counter when player sends a message
        if (message.role === "user") {
            this.consecutiveActionsCount = 0;
            console.log('Player message sent, resetting consecutive actions count.');
        }
    }

    // 添加旁白到指定消息
    addNarrativeToMessage(messageIndex: number, narrative: string): void {
        if (messageIndex >= 0 && messageIndex < this.messages.length) {
            // 在narratives映射中存储旁白
            const messageId = messageIndex;
            if (!this.narratives.has(messageId)) {
                this.narratives.set(messageId, []);
            }
            this.narratives.get(messageId)!.push(narrative);
            
            console.log(`Narrative added to message at index ${messageIndex}: ${narrative}`);
        } else {
            console.error(`Invalid message index: ${messageIndex}. Cannot add narrative.`);
        }
    }

    async generateAIsMessages() {
        console.log('Starting generation of AI messages for all characters.');

        // Special case for self-talk (player character is the AI character)
        if (this.gameData.playerID === this.gameData.aiID) {
            console.log('Self-talk session detected. Generating internal monologue for player character.');
            const playerCharacter = this.gameData.getPlayer();
            
            if (this.config.validateCharacterIdentity) {
                await this.generateNewAIMessageWithValidation(playerCharacter);
            } else {
                await this.generateNewAIMessage(playerCharacter);
            }
            
            this.chatWindow.window.webContents.send('actions-receive', []); // No actions in self-talk
            console.log('Finished generating self-talk message.');
            return; // Exit after self-talk message
        }

        // 根据配置选择角色排序方式
        let characters = Array.from(this.gameData.characters.values());
        
        if (this.config.dynamicCharacterSelection) {
            console.log('Using dynamic character selection for message generation.');
            await this.generateAIsMessagesDynamic();
        } else {
            // 根据配置决定是否打乱角色顺序
            if (this.config.shuffleCharacterOrder) {
                characters = characters.sort(() => Math.random() - 0.5);
                console.log('Character order shuffled for message generation.');
            } else {
                console.log('Using default character order for message generation.');
            }
            
            for (const character of characters) {
                if (character.id !== this.gameData.playerID) { // Only generate for non-player characters
                    if (this.config.validateCharacterIdentity) {
                        await this.generateNewAIMessageWithValidation(character);
                    } else {
                        await this.generateNewAIMessage(character);
                    }
                }
            }
        }
        
        this.chatWindow.window.webContents.send('actions-receive', []);
        console.log('Finished generating AI messages for all characters.');
        
        // 如果启用了自动生成建议功能，在对话结束时生成建议
        if (this.config.autoGenerateSuggestions) {
            await this.generateInitialSuggestions();
        }
    }

    /**
     * 动态角色选择生成消息的方法
     * 通过LLM分析最新对话内容，从角色池中选择下一个回复的角色
     */
    async generateAIsMessagesDynamic() {
        console.log('Starting dynamic character selection for AI messages.');
        
        // 获取所有非玩家角色
        const allCharacters = Array.from(this.gameData.characters.values())
            .filter(character => character.id !== this.gameData.playerID);
        
        // 创建角色池，包含所有尚未发言的角色
        let characterPool = [...allCharacters];
        let roundCount = 0;
        const maxRounds = 3; // 最多进行3轮，防止无限循环
        
        // 当角色池不为空且未达到最大轮数时，继续循环
        while (characterPool.length > 0 && roundCount < maxRounds) {
            roundCount++;
            console.log(`Starting round ${roundCount} of dynamic character selection.`);
            
            // 使用LLM分析对话内容，选择下一个回复的角色
            const selectedCharacter = await this.selectNextCharacter(characterPool);
            
            if (selectedCharacter) {
                console.log(`Selected character: ${selectedCharacter.fullName} for next response.`);
                
                // 为选中的角色生成消息，根据配置决定是否进行身份验证
                if (this.config.validateCharacterIdentity) {
                    await this.generateNewAIMessageWithValidation(selectedCharacter);
                } else {
                    await this.generateNewAIMessage(selectedCharacter);
                }
                
                // 从角色池中移除已发言的角色
                characterPool = characterPool.filter(char => char.id !== selectedCharacter.id);
            } else {
                console.log('No character was selected by the LLM. Ending dynamic selection.');
                break;
            }
        }
        
        // 如果还有角色未发言，使用默认顺序生成消息
        if (characterPool.length > 0) {
            console.log(`${characterPool.length} characters haven't spoken yet. Generating messages in default order.`);
            for (const character of characterPool) {
                // 根据配置决定是否进行身份验证
                if (this.config.validateCharacterIdentity) {
                    await this.generateNewAIMessageWithValidation(character);
                } else {
                    await this.generateNewAIMessage(character);
                }
            }
        }
        
        console.log(`Completed ${roundCount} rounds of dynamic character selection.`);
    }

    /**
     * 使用LLM分析对话内容，从角色池中选择下一个回复的角色
     * @param characterPool - 可选择的角色池
     * @returns 选中的角色，如果LLM无法选择则返回null
     */
    async selectNextCharacter(characterPool: Character[]): Promise<Character | null> {
        console.log('Asking LLM to select the next character for response.');
        
        // 如果角色池中只有一个角色，直接返回该角色，不需要调用LLM
        if (characterPool.length === 1) {
            console.log(`Only one character in pool: ${characterPool[0].fullName}. Returning directly without LLM analysis.`);
            return characterPool[0];
        }
        
        // 构建角色池描述
        const characterPoolDescription = characterPool.map(char => 
            `${char.id}: ${char.fullName} - ${char.primaryTitle}`
        ).join('\n');
        
        // 构建最近对话内容摘要
        const recentMessages = this.messages.slice(-5); // 获取最近5条消息
        const conversationSummary = recentMessages.map(msg => 
            `${msg.name}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
        ).join('\n');
        
        // 构建LLM提示
        const prompt: Message[] = [
            {
                role: "system",
                content: `你是一个智能对话分析助手，需要根据当前对话内容，从角色池中选择最适合下一个发言的角色。

角色池：
${characterPoolDescription}

最近对话内容：
${conversationSummary}

请分析对话内容和角色关系，选择最适合下一个发言的角色。只需要返回角色ID，不需要其他解释。`
            }
        ];
        
        try {
            // 调用LLM API
            const response = await this.textGenApiConnection.complete(prompt, false, {
                max_tokens: 10,
                temperature: 0.3
            });
            
            // 解析LLM返回的角色ID
            const selectedId = parseInt(response.trim());
            
            // 验证返回的ID是否在角色池中
            const selectedCharacter = characterPool.find(char => char.id === selectedId);
            
            if (selectedCharacter) {
                console.log(`LLM selected character ID ${selectedId}: ${selectedCharacter.fullName}`);
                return selectedCharacter;
            } else {
                console.warn(`LLM returned invalid character ID: ${selectedId}. Falling back to random selection.`);
                // 如果LLM返回了无效ID，随机选择一个角色
                return characterPool[Math.floor(Math.random() * characterPool.length)];
            }
        } catch (error) {
            console.error(`Error during LLM character selection: ${error}. Falling back to random selection.`);
            // 如果LLM调用失败，随机选择一个角色
            return characterPool[Math.floor(Math.random() * characterPool.length)];
        }
    }
    
    async generateNewAIMessage(character: Character, sendMessageToChat: boolean = true): Promise<Message | null> {
        console.log(`Generating AI message for character: ${character.fullName}`);
        
        const isSelfTalk = this.gameData.playerID === this.gameData.aiID;
        const characterNameForResponse = isSelfTalk ? character.shortName : character.fullName;

        let responseMessage: Message;

        if(this.config.stream && sendMessageToChat){
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
                content: await this.textGenApiConnection.complete(buildChatPrompt(this, character), this.config.stream && sendMessageToChat, {
                    //stop: [this.gameData.playerName+":", this.gameData.aiName+":", "you:", "user:"],
                    max_tokens: this.config.maxTokens,
                },
                this.config.stream && sendMessageToChat ? streamRelay : undefined)
            };  
            
        }
        //instruct
        else{
            console.log('Using completion API for AI message completion.');
            responseMessage = {
                role: "assistant",
                name: characterNameForResponse,
                content: await this.textGenApiConnection.complete(convertChatToText(buildChatPrompt(this, character), this.config, character.fullName), this.config.stream && sendMessageToChat, {
                    stop: [this.config.inputSequence, this.config.outputSequence],
                    max_tokens: this.config.maxTokens,
                },
                this.config.stream && sendMessageToChat ? streamRelay : undefined)
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
                return null; // Stop processing this message
            }
        }

        // If the response is empty after cleaning, don't send it.
        if (!responseMessage.content.trim()) {
            console.log(`AI response for ${character.fullName} was empty after cleaning. Skipping.`);
            return null;
        }

        if (isSelfTalk) {
            // First, remove any leading or trailing asterisks from the raw response to prevent doubling them up.
            let cleanedContent = responseMessage.content.replace(/^\*+|\*+$/g, '').trim();
            responseMessage.content = `*${cleanedContent}*`;
        }
        
        // 只有当sendMessageToChat为true时才将消息添加到消息数组并发送到聊天窗口
        if (sendMessageToChat) {
            this.pushMessage(responseMessage);
            const messageIndex = this.messages.length - 1; // 获取刚添加的消息索引

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
                    let narrative: string = "";
                    
                    if(this.config.actionsEnableAll){
                        try{
                            console.log('Actions are enabled. Checking for actions...');
                            
                            // Check max consecutive actions limit
                            if (this.consecutiveActionsCount >= this.config.maxConsecutiveActions) {
                                console.log(`Skipping action check: consecutive actions limit reached (${this.consecutiveActionsCount}/${this.config.maxConsecutiveActions})`);
                                collectedActions = [];
                                narrative = "";
                            } else {
                                const actionResult = await checkActions(this);
                                collectedActions = actionResult.actions;
                                narrative = actionResult.narrative;
                                
                                // Update consecutive actions tracking
                                if (collectedActions.length > 0) {
                                    this.consecutiveActionsCount++;
                                    this.lastActionMessageIndex = messageIndex;
                                    console.log(`Action triggered. Consecutive actions count: ${this.consecutiveActionsCount}`);
                                } else {
                                    // Reset counter if no actions were triggered
                                    this.consecutiveActionsCount = 0;
                                    console.log('No actions triggered, resetting consecutive actions count.');
                                }
                                
                                // 如果有旁白，将其与当前消息关联
                                if (narrative) {
                                    this.addNarrativeToMessage(messageIndex, narrative);
                                    console.log(`Associated narrative with message at index ${messageIndex}`);
                                }
                            }
                        }
                        catch(e){
                            console.error(`Error during action check: ${e}`);
                            collectedActions = [];
                            narrative = "";
                            // Reset counter on error
                            this.consecutiveActionsCount = 0;
                        }
                    }
                    else{
                        console.log('Actions are disabled in config.');
                        collectedActions = [];
                        narrative = "";
                        // Reset counter when actions are disabled
                        this.consecutiveActionsCount = 0;
                    }
        
                    this.chatWindow.window.webContents.send('actions-receive', collectedActions, narrative);    
                    console.log(`Sent ${collectedActions.length} actions to chat window.`);
                    if (narrative) {
                        console.log(`Sent narrative: ${narrative}`);
                    }
                }
            }
        } else {
            console.log(`Message generated but not sent to chat window due to sendMessageToChat=false`);
        }
        
        // 如果sendMessageToChat为false，返回生成的消息
        if (!sendMessageToChat) {
            return responseMessage;
        }
        
        return null;
    }

    /**
     * 验证生成的消息是否符合角色身份
     * @param character - 应该发言的角色
     * @param messageContent - 生成的消息内容
     * @returns 如果消息符合角色身份返回true，否则返回false
     */
    async validateCharacterIdentity(character: Character, messageContent: string): Promise<boolean> {
        console.log(`Validating if message content matches character identity for: ${character.fullName}`);
        
        // 获取最近的对话历史，用于提供上下文
        const recentMessages = this.messages.slice(-5); // 获取最近5条消息作为上下文
        const conversationHistory = recentMessages.map(msg => 
            `${msg.name}: ${msg.content}`
        ).join('\n');
        
        // 获取年龄描述，根据年龄段添加后缀
        let ageDescription = `${character.age}岁`;
        if (character.age >= 0 && character.age <= 3) {
            ageDescription += "（婴儿）";
        } else if (character.age >= 4 && character.age <= 5) {
            ageDescription += "（幼儿）";
        } else if (character.age >= 6 && character.age <= 12) {
            ageDescription += "（少儿）";
        } else if (character.age >= 13 && character.age <= 16) {
            ageDescription += "（少年）";
        }

        // 构建验证提示
        const prompt: Message[] = [
            {
                role: "user",
                content: `你是一个角色身份验证助手。你需要判断以下消息是否符合指定角色的身份。

角色信息：
- 姓名：${character.fullName}
- 名称：${character.shortName}
- 身份/头衔：${character.primaryTitle}
- 性别：${character.sheHe}
- 年龄：${ageDescription}
- 文化：${character.culture}
- 信仰：${character.faith}
- 是否为统治者：${character.isRuler ? '是' : '否'}
- 是否为独立统治者：${character.isIndependentRuler ? '是' : '否'}

最近的对话历史：
${conversationHistory}

当前角色发言：

消息内容：
"${messageContent}"

请结合对话历史上下文，判断这条消息是否符合上述角色的身份。如果符合，请回答"符合"；如果不符合，请回答"不符合"。只需要回答"符合"或"不符合"，不需要其他解释。`
            }
        ];
        
        try {
            // 调用LLM API进行验证
            const response = await this.textGenApiConnection.complete(prompt, false, {
                max_tokens: 10,
                temperature: 0.1 // 使用较低的温度以确保一致性
            });
            
            const responseText = response.trim();
            console.log(`[DEBUG] Parsed response: ${responseText}`);
            
            // 更严格的验证逻辑：明确检查是否为"符合"
            const isValid = responseText === "符合";
            console.log(`Character identity validation result for ${character.fullName}: ${isValid ? 'Valid' : 'Invalid'}`);
            return isValid;
        } catch (error) {
            console.error(`Error during character identity validation: ${error}. Defaulting to valid.`);
            // 如果验证过程出错，默认认为消息有效
            return true;
        }
    }

    /**
     * 生成带有身份验证的AI消息
     * @param character - 应该发言的角色
     */
    async generateNewAIMessageWithValidation(character: Character): Promise<void> {
        console.log(`Generating AI message with identity validation for character: ${character.fullName}`);
        
        // 检查是否满足身份验证的条件：流式传输关闭且角色数量大于2
        const shouldValidate = !this.config.stream && this.gameData.characters.size > 2;
        
        if (!shouldValidate) {
            console.log(`Identity validation conditions not met (stream: ${this.config.stream}, character count: ${this.gameData.characters.size}). Generating message without validation.`);
            await this.generateNewAIMessage(character, true);
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 3;
        let validMessageGenerated = false;
        let validMessage: Message | null = null;
        
        while (attempts < maxAttempts && !validMessageGenerated) {
            attempts++;
            console.log(`Attempt ${attempts} to generate valid message for ${character.fullName}`);
            
            try {
                let generatedMessage: Message | null = null;
                
                // 第一次尝试使用常规生成方式
                if (attempts === 1) {
                    generatedMessage = await this.generateNewAIMessage(character, false);
                } else {
                    // 后续尝试使用特定提示词生成消息
                    generatedMessage = await this.generateMessageWithValidationPrompt(character);
                }
                
                if (generatedMessage) {
                    // 验证消息是否符合角色身份
                    const isValid = await this.validateCharacterIdentity(character, generatedMessage.content);
                    
                    if (isValid) {
                        console.log(`Generated valid message for ${character.fullName} on attempt ${attempts}`);
                        validMessage = generatedMessage;
                        validMessageGenerated = true;
                    } else {
                        console.log(`Generated invalid message for ${character.fullName} on attempt ${attempts}. Retrying.`);
                    }
                } else {
                    console.warn(`No valid message found for ${character.fullName} after generation.`);
                }
            } catch (error) {
                console.error(`Error generating message for ${character.fullName} on attempt ${attempts}: ${error}`);
            }
        }
        
        if (validMessageGenerated && validMessage) {
            // 验证通过，将消息添加到消息数组并发送到聊天窗口
            this.pushMessage(validMessage);
            const messageIndex = this.messages.length - 1; // 获取刚添加消息的索引
            this.chatWindow.window.webContents.send('message-receive', validMessage, this.config.actionsEnableAll);
            console.log(`Sent validated message for ${character.fullName} to chat window.`);
            
            // 检查并执行动作
            if (this.gameData.playerID !== this.gameData.aiID && character.id === this.gameData.aiID) {
                let collectedActions: ActionResponse[];
                let narrative: string = "";
                
                if(this.config.actionsEnableAll){
                    try{
                        console.log('Actions are enabled. Checking for actions...');
                        
                        // Check max consecutive actions limit
                        if (this.consecutiveActionsCount >= this.config.maxConsecutiveActions) {
                            console.log(`Skipping action check: consecutive actions limit reached (${this.consecutiveActionsCount}/${this.config.maxConsecutiveActions})`);
                            collectedActions = [];
                            narrative = "";
                        } else {
                            const actionResult = await checkActions(this);
                            collectedActions = actionResult.actions;
                            narrative = actionResult.narrative;
                            
                            // Update consecutive actions tracking
                            if (collectedActions.length > 0) {
                                this.consecutiveActionsCount++;
                                this.lastActionMessageIndex = messageIndex;
                                console.log(`Action triggered. Consecutive actions count: ${this.consecutiveActionsCount}`);
                            } else {
                                // Reset counter if no actions were triggered
                                this.consecutiveActionsCount = 0;
                                console.log('No actions triggered, resetting consecutive actions count.');
                            }
                            
                            // 将旁白与消息关联
                            if (narrative) {
                                this.addNarrativeToMessage(messageIndex, narrative);
                                console.log(`Associated narrative with message at index ${messageIndex}`);
                            }
                        }
                    }
                    catch(e){
                        console.error(`Error during action check: ${e}`);
                        collectedActions = [];
                        narrative = "";
                        // Reset counter on error
                        this.consecutiveActionsCount = 0;
                    }
                }
                else{
                    console.log('Actions are disabled in config.');
                    collectedActions = [];
                    narrative = "";
                    // Reset counter when actions are disabled
                    this.consecutiveActionsCount = 0;
                }

                this.chatWindow.window.webContents.send('actions-receive', collectedActions, narrative);    
                console.log(`Sent ${collectedActions.length} actions to chat window.`);
                if (narrative) {
                    console.log(`Sent narrative: ${narrative}`);
                }
            }
        } else {
            console.warn(`Failed to generate valid message for ${character.fullName} after ${maxAttempts} attempts. Skipping this character.`);
            // 可以选择发送一个通知给用户
            this.chatWindow.window.webContents.send('error-message', ` ${character.fullName} 没有发言。`);
        }
    }

    /**
     * 使用特定提示词生成消息（用于验证失败后的重试）
     * @param character - 应该发言的角色
     * @returns 生成的消息对象
     */
    async generateMessageWithValidationPrompt(character: Character): Promise<Message | null> {
        console.log(`Generating message with validation prompt for character: ${character.fullName}`);
        
        // 获取年龄描述，根据年龄段添加后缀
        let ageDescription = `${character.age}岁`;
        if (character.age >= 0 && character.age <= 3) {
            ageDescription += "（婴儿）";
        } else if (character.age >= 4 && character.age <= 5) {
            ageDescription += "（幼儿）";
        } else if (character.age >= 6 && character.age <= 12) {
            ageDescription += "（少儿）";
        } else if (character.age >= 13 && character.age <= 16) {
            ageDescription += "（少年）";
        }
        
        // 获取最近的对话历史，用于提供上下文
        const recentMessages = this.messages.slice(-5); // 获取最近5条消息作为上下文
        const conversationHistory = recentMessages.map(msg => 
            `${msg.name}: ${msg.content}`
        ).join('\n');
        
        // 构建特定提示词
        const prompt: Message[] = [
            {
                role: "system",
                content: `请扮演角色${character.fullName}写下一条发言，使用markdown格式，用斜体表示动作，角色信息：
- 姓名：${character.fullName}
- 名称：${character.shortName}
- 身份/头衔：${character.primaryTitle}
- 性别：${character.sheHe}
- 年龄：${ageDescription}
- 文化：${character.culture}
- 信仰：${character.faith}
- 是否为统治者：${character.isRuler ? '是' : '否'}
- 是否为独立统治者：${character.isIndependentRuler ? '是' : '否'}

最近的对话历史：
${conversationHistory}

${character.fullName}的发言：`
            }
        ];
        
        try {
            // 调用LLM API生成消息
            const response = await this.textGenApiConnection.complete(prompt, false, {
                max_tokens: this.config.maxTokens,
                temperature: this.config.textGenerationApiConnectionConfig.parameters.temperature
            });
            
            if (!response || response.trim() === '') {
                console.warn(`Empty response from LLM for character ${character.fullName}`);
                return null;
            }
            
            // 创建消息对象
            const isSelfTalk = this.gameData.playerID === this.gameData.aiID;
            const characterNameForResponse = isSelfTalk ? character.shortName : character.fullName;
            
            const message: Message = {
                role: "assistant",
                name: characterNameForResponse,
                content: response.trim()
            };
            
            console.log(`Generated message with validation prompt for ${character.fullName}: ${message.content.substring(0, 50)}...`);
            return message;
        } catch (error) {
            console.error(`Error generating message with validation prompt for ${character.fullName}: ${error}`);
            return null;
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
                    this.currentSummary = await this.summarizationApiConnection.complete(buildResummarizeChatPrompt(this, messagesToSummarize), false, {});
                }
                else{
                    console.log('Using completion API for resummarization.');
                    this.currentSummary = await this.summarizationApiConnection.complete(convertChatToTextNoNames(buildResummarizeChatPrompt(this, messagesToSummarize), this.config), false, {});
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

        // Process conversation messages, keeping name, content and narrative
        const processedMessages = this.messages.map((msg, index) => {
          const messageData: any = {
            name: msg.name,
            content: msg.content
          };
          
          // 添加旁白信息（如果有）
          const narratives = this.narratives.get(index);
          if (narratives && narratives.length > 0) {
            messageData.narratives = narratives;
          }
          
          return messageData;
        });

        // Build the text content to be saved
        let textContent = `Date: ${this.gameData.date}\n\n`;

        processedMessages.forEach((msg, index) => {
          textContent += `${msg.name}: ${msg.content}\n`;
          
          // 添加旁白信息
          if (msg.narratives && msg.narratives.length > 0) {
            textContent += `[旁白]: ${msg.narratives.join('\n[旁白]: ')}\n`;
          }
          
          textContent += '\n';
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

                // 暂停文件监控，避免保存时触发重新加载
                this.summaryFileWatcher.pauseWatcher(summaryFile);

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

                // 恢复文件监控
                this.summaryFileWatcher.resumeWatcher(summaryFile);
            }
        });

    }

    // 生成推荐输入语句
    public async generateSuggestions(): Promise<string[]> {
        return generateSuggestions(this);
    }

    /**
     * 清理资源，停止文件监控
     */
    public cleanup(): void {
        if (this.summaryFileWatcher) {
            this.summaryFileWatcher.unwatchAll();
            // 确保清理所有暂停的监控文件
            this.summaryFileWatcher.clearPausedWatchers();
            console.log('Cleaned up summary file watchers and paused watchers');
        }
    }

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

    /**
     * 生成初始场景描述
     * 在对话开始时为角色提供对话背景和情境信息
     */
    private async generateInitialSceneDescription(): Promise<void> {
        console.log('Starting initial scene description generation.');
        
        try {
            // 生成场景描述
            const sceneDescription = await generateSceneDescription(this);
            
            if (sceneDescription && sceneDescription.trim()) {
                // 创建场景描述消息
                const sceneMessage: Message = {
                    role: "system",
                    name: "场景描述",
                    content: sceneDescription
                };
                
                // Calculate the position to insert scene description (after historical conversations)
                // Count total historical messages
                let historicalMessageCount = 0;
                if (this.historicalConversations) {
                    historicalMessageCount = this.historicalConversations.reduce((total, conv) => total + conv.messages.length, 0);
                }
                
                // Insert scene description after historical messages but before current conversation
                this.messages.splice(historicalMessageCount, 0, sceneMessage);
                
                // 发送场景描述到聊天窗口
                this.chatWindow.window.webContents.send('scene-description', sceneDescription);
                
                console.log(`Initial scene description generated and inserted at position ${historicalMessageCount} (after ${historicalMessageCount} historical messages): ${sceneDescription.substring(0, 100)}...`);
            } else {
                console.log('No scene description was generated or description was empty.');
            }
        } catch (error) {
            console.error('Error generating initial scene description:', error);
            // 如果生成失败，不影响对话的正常进行
        }
        
        // 场景描述生成完成后，如果启用了自动生成建议功能，则生成建议
        if (this.config.autoGenerateSuggestions) {
            console.log('Scene description generation completed, now generating suggestions.');
            this.generateInitialSuggestions();
        }
    }

    /**
     * 生成初始建议
     * 在对话开始时为用户提供输入建议
     */
    private async generateInitialSuggestions(): Promise<void> {
        console.log('Starting initial suggestions generation.');
        
        try {
            // 生成建议
            const suggestions = await this.generateSuggestions();
            
            if (suggestions && suggestions.length > 0) {
                // 发送建议到聊天窗口
                this.chatWindow.window.webContents.send('suggestions-response', suggestions);
                
                console.log(`Initial suggestions generated and sent to chat window: ${suggestions.length} suggestions`);
            } else {
                console.log('No suggestions were generated or suggestions array was empty.');
            }
        } catch (error) {
            console.error('Error generating initial suggestions:', error);
            // 如果生成失败，不影响对话的正常进行
        }
    }

    public getHistory(): Message[] {
        return this.messages;
    }

    public clearHistory(): void {
        console.log("Clearing conversation history.");
        this.messages = [];
        this.narratives.clear();
        this.currentSummary = "";
        this.consecutiveActionsCount = 0;
        this.lastActionMessageIndex = -1;
    }

    public undo(): void {
        console.log("Undoing last exchange.");
        const lastUserIndex = [...this.messages].reverse().findIndex(m => m.role === 'user');
        
        if (lastUserIndex !== -1) {
            const actualIndex = this.messages.length - 1 - lastUserIndex;
            console.log(`Removing messages from index ${actualIndex} onwards.`);
            this.messages.splice(actualIndex);
            
            // Clean up narratives for removed messages
            for (let i = actualIndex; i <= this.messages.length + 1; i++) {
                this.narratives.delete(i);
            }
            
            // Reset consecutive actions counter since we're going back in time
            this.consecutiveActionsCount = 0;
            this.lastActionMessageIndex = -1;
        }
    }

    public async initiateConversation(){
        if(this.config.aiCanStartConversation){
            if(Math.random() < this.config.aiStartConversationChance){
                await this.generateAIsMessages();
            }
        }
    }
}
