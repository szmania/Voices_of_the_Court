
import { app } from 'electron';
import { GameData } from '../../shared/gameData/GameData.js';
import { Character } from '../../shared/gameData/Character.js';
import { ChatWindow } from '../windows/ChatWindow.js';
import { RunFileManager } from '../RunFileManager.js';
import { SummaryFileWatcher } from './SummaryFileWatcher.js';
import { LetterManager } from '../letter/LetterManager.js';
import { Letter as ILetter } from '../letter/letterInterfaces.js';
import { Config } from '../../shared/Config.js';
import { ApiConnection} from '../../shared/apiConnection.js';
import { checkActions } from './checkActions.js';
import { convertChatToText, buildChatPrompt, buildSummarizeChatPrompt, buildResummarizeChatPrompt, convertChatToTextNoNames, getEffectivePrompts} from './promptBuilder.js';
import { generateSuggestions } from './suggestionBuilder.js';
import { generateSceneDescription } from './sceneDescriptionBuilder.js';
import { generateNarrative } from './generateNarrative.js';
import { cleanMessageContent } from './messageCleaner.js';
import { DiaryGenerator } from '../diary/DiaryGenerator.js';
import { readDiaryFile, saveDiaryFile, readDiarySummaries, saveDiarySummaries } from '../diaryManager.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {Message, MessageChunk, ErrorMessage, Summary, Action, ActionResponse, PendingAction} from '../ts/conversation_interfaces.js';
import { parseGameDate } from '../../shared/dateUtils.js';
import { getConversationHistoryFiles } from '../conversationHistory.js';
import { getSimilarity } from '../../shared/stringUtils.js';
import { parseVariables } from '../parseVariables.js';
import { ActionEffectWriter } from './ActionEffectWriter.js';

function getTranslations(lang: string): any {
    const localePath = path.join(app.getAppPath(), 'public', 'locales', `${lang}.json`);
    try {
        if (fs.existsSync(localePath)) {
            return JSON.parse(fs.readFileSync(localePath, 'utf-8'));
        }
    } catch (error) {
        console.error(`Error reading locale file for ${lang}:`, error);
    }
    // Fallback to English
    const fallbackLocalePath = path.join(app.getAppPath(), 'public', 'locales', `en.json`);
    return JSON.parse(fs.readFileSync(fallbackLocalePath, 'utf-8'));
}

export class Conversation{
    userDataPath: string;
    chatWindow: ChatWindow;
    isOpen: boolean;
    gameData: GameData;
    messages: Message[];
    notSpokenYetText: string;
    description: string;
    config: Config;
    runFileManager!: RunFileManager;
    textGenApiConnection: ApiConnection;
    summarizationApiConnection: ApiConnection;
    diaryGenerator!: DiaryGenerator;
    actionsApiConnection: ApiConnection;
    actions!: Action[];
    summaries: Map<number, Summary[]>;
    currentSummary: string;
    summaryFileWatcher: SummaryFileWatcher; // 文件监控器
    letterManager: LetterManager;
    letters: Map<number, ILetter[]>;
    consecutiveActionsCount: number; // Track consecutive responses with actions
    lastActionMessageIndex: number; // Track the last message index that had actions
    historicalConversations!: Array<{date: string, scene: string, location: string, characters: string[], messages: Message[]}>; // Store historical conversation metadata
    actionInvolvedCharacterIds: Set<number>;
    translations: any;
    pendingActions: Map<string, PendingAction[]>;
    executedActions: Map<string, ActionResponse[]>;
    currentTurnTriggeredActions: Set<string>;

    npcQueue: Character[];
    customQueue: Character[] | null;
    isPaused: boolean;
    aiToAiTurnLimit: number = 0;
    persistCustomQueue: boolean;
    isGenerating: boolean;
    abortController: AbortController | null;
    isGeneratingScene: boolean;
    pendingPlayerRequest: boolean;

    constructor(gameData: GameData, config: Config, chatWindow: ChatWindow, userDataPath: string){
        console.log('Conversation initialized.');
        console.log(`[Conversation.ts CONSTRUCTOR] Initializing with scene: '${gameData.scene}'`);
        this.userDataPath = userDataPath;
        this.config = config;
        this.chatWindow = chatWindow;
        this.chatWindow.conversation = this;
        this.isOpen = true;
        this.gameData = gameData;
        this.messages = [];
        this.currentSummary = "";
        this.config = config;

        // Load translations
        const lang = this.config.language || 'en';
        this.translations = getTranslations(lang);
        this.notSpokenYetText = this.translations.chat.not_spoken || "Has not spoken yet";

        this.runFileManager = new RunFileManager(this.config.userFolderPath);
        this.description = "";
        this.actions = [];

        this.runFileManager = new RunFileManager(this.config.userFolderPath);
        this.description = "";
        this.actions = [];

        // 如果角色数量大于2，为所有非玩家角色创建空白消息
        if (gameData.characters.size > 2) {
            console.log(`Creating initial messages for ${gameData.characters.size - 1} non-player characters.`);
            gameData.characters.forEach((character) => {
                if (character.id !== gameData.playerID) {
                    const emptyMessage: Message = {
                        role: "assistant",
                        name: character.shortName,
                        content: this.notSpokenYetText,
                        characterId: character.id
                    };
                    this.messages.push(emptyMessage);
                    console.log(`Created empty message for character: ${character.shortName}`);
                }
            });
        }

        this.summaries = new Map<number, Summary[]>();
        this.summaryFileWatcher = new SummaryFileWatcher(); // 初始化文件监控器
        this.letterManager = LetterManager.getInstance();
        this.letters = new Map<number, ILetter[]>();
        this.consecutiveActionsCount = 0; // Initialize consecutive actions counter
        this.lastActionMessageIndex = -1; // Initialize last action message index
        this.historicalConversations = []; // Initialize historical conversations array
        
        this.npcQueue = [];
        this.customQueue = null;
        this.isPaused = false;
        this.persistCustomQueue = false;
        this.actionInvolvedCharacterIds = new Set();
        this.isGenerating = false;
        this.abortController = null;
        this.pendingActions = new Map();
        this.executedActions = new Map();
        this.currentTurnTriggeredActions = new Set<string>();
        this.isGeneratingScene = false;
        this.pendingPlayerRequest = false;

        const diariesBasePath = path.join(this.userDataPath, 'diary_history');
        if (!fs.existsSync(diariesBasePath)) {
            fs.mkdirSync(diariesBasePath, { recursive: true });
        }
        const playerDiariesPath = path.join(diariesBasePath, this.gameData.playerID.toString());
        if (!fs.existsSync(playerDiariesPath)) {
            fs.mkdirSync(playerDiariesPath, { recursive: true });
        }

        // Create/Update character map for the current player in the diary folder
        const characterMapPath = path.join(playerDiariesPath, '_character_map.json');
        let characterMap: { [key: string]: string } = {};
        if (fs.existsSync(characterMapPath)) {
            try {
                characterMap = JSON.parse(fs.readFileSync(characterMapPath, 'utf8'));
            } catch (e) {
                console.error(`Error parsing character map file, it will be overwritten: ${e}`);
            }
        }
        // Add/update all characters from current gameData
        this.gameData.characters.forEach((character) => {
            characterMap[character.id.toString()] = character.fullName;
        });
        fs.writeFileSync(characterMapPath, JSON.stringify(characterMap, null, '\t'));
        console.log(`Character map updated at ${characterMapPath}`);

        const summariesBasePath = path.join(this.userDataPath, 'conversation_summaries');
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
                this.summaryFileWatcher.watchFile(summaryFilePath, (updatedSummaries: Summary[]) => {
                    this.summaries.set(character.id, updatedSummaries);
                    console.log(`Automatically reloaded summaries for character ID ${character.id} due to file change`);
                });

                const characterLetters = this.letterManager.getLetters(String(this.gameData.playerID), String(character.id));
                this.letters.set(character.id, characterLetters);
                console.log(`Loaded ${characterLetters.length} letters for AI ID ${character.id}.`);
            }
        });

        this.config = config;

        this.messages.forEach(msg => {
            if (msg.content === "Has not spoken yet") {
                msg.content = this.notSpokenYetText;
                const character = Array.from(this.gameData.characters.values()).find(c => c.shortName === msg.name);
                if (character) {
                    (msg as any).characterId = character.id;
                }
            }
        });

        //TODO: wtf
        this.runFileManager = new RunFileManager(config.userFolderPath);
        this.actions = [];

        [this.textGenApiConnection, this.summarizationApiConnection, this.actionsApiConnection] = this.getApiConnections();
        
        this.loadConfig();

        // Sanitize messages to remove any historical placeholders that may have leaked in.
        const currentCharacterIds = new Set(Array.from(this.gameData.characters.keys()));
        this.messages = this.messages.filter(msg => {
            const msgCharId = (msg as any).characterId;
            // Keep user messages (no characterId) or messages for characters in the current conversation.
            return !msgCharId || currentCharacterIds.has(msgCharId);
        });
        console.log(`Sanitized messages array. Kept ${this.messages.length} messages for current conversation characters.`);

        this.checkForSummariesFromOtherPlayers();

        // Initialize diary generator
        this.diaryGenerator = new DiaryGenerator(this.config, this.userDataPath);
    }



    public async initialize(): Promise<void> {
        // 如果启用了场景描述生成功能，在对话开始时生成场景描述
        if (this.config.generateSceneDescription) {
            await this.generateSceneDescription(true);
        }
        
        // 如果启用了自动生成建议功能，在对话开始时生成建议
        if (this.config.autoGenerateSuggestions) {
            // 如果场景描述生成也启用了，会在场景描述生成完成后自动调用建议生成
            if (!this.config.generateSceneDescription) {
                // 如果没有启用场景描述生成，直接生成建议
                await this.generateInitialSuggestions();
            }
        }
        await this.initiateConversation();
    }

    public async loadHistory(): Promise<void> {
        // Check if historical conversation loading is enabled
        if (!this.config.showPreviousConversations || this.config.disableHistoricalConversations) {
            console.log('Historical conversation loading is disabled in config.');
            return;
        }
        
        console.log('Attempting to load historical conversation history.');
        console.log('showPreviousConversations config value:', this.config.showPreviousConversations);
        const historyDir = path.join(this.userDataPath, 'conversation_history', this.gameData.playerID.toString());
        console.log('Looking for historical conversations in:', historyDir);
        
        if (!fs.existsSync(historyDir)) {
            console.log('No history directory found for this player.');
            return;
        }

        const allCharacterIds = Array.from(this.gameData.characters.keys());
        const historyFiles = await getConversationHistoryFiles(this.gameData.playerID.toString(), allCharacterIds);

        const files = historyFiles
            .map(file => ({
                name: file.fileName,
                time: file.modifiedTime
            }))
            .sort((a, b) => a.time - b.time); // Sort by timestamp, oldest first

        console.log(`Found ${files.length} historical conversation files:`, files.map(f => f.name));
        if (files.length === 0) {
            console.log('No previous history files found for this character pair.');
            return;
        }

        console.log(`Found ${files.length} historical conversation files. Loading all files...`);
        
        // Send loading indicator to chat window
        this.chatWindow.window.webContents.send('historical-conversations-loading', true);
        
        // Track loaded messages count
        let totalMessagesLoaded = 0;
        
        // Store historical conversation metadata (date, scene, and location for each file)
        const historicalConversations: Array<{date: string, scene: string, location: string, characters: string[], messages: Message[]}> = [];
        
        // Load historical conversation files with a limit to prevent UI freezing
        const MAX_HISTORICAL_MESSAGES = 100; // Limit total historical messages to prevent UI freezing
        const MAX_CONVERSATIONS_TO_LOAD = 10; // Limit number of conversation files to load
        
        // Load most recent conversation files in chronological order
        const recentFiles = files.slice(-MAX_CONVERSATIONS_TO_LOAD);
        
        for (const fileInfo of recentFiles) {
            // Stop if we've reached the maximum number of messages
            if (totalMessagesLoaded >= MAX_HISTORICAL_MESSAGES) {
                console.log(`Reached maximum historical messages limit (${MAX_HISTORICAL_MESSAGES}). Stopping loading.`);
                break;
            }
            
            const filePath = path.join(historyDir, fileInfo.name);
            console.log(`Loading historical conversation from: ${filePath}`);
            
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                
                let currentDate = this.gameData.date; // Default to current date
                let currentScene = ""; // Default to empty
                let currentLocation = ""; // Default to empty
                const fileMessages: Message[] = [];
                const characterNames: string[] = [];
                let currentMessage: Message | null = null;
                let messageIndex = -1;

                const narrativeLabels = {
                    en: "[Narrative]:",
                    zh: "[旁白]:",
                    ru: "[Повествование]:",
                    fr: "[Récit]:",
                    es: "[Narrativa]:",
                    de: "[Erzählung]:",
                    ja: "[ナラティブ]:",
                    ko: "[내레이션]:",
                    pl: "[Narracja]:",
                    pt: "[Narrativa]:"
                };
                const narrativeLabelValues = Object.values(narrativeLabels);
                const narrativeRegex = new RegExp(`^(${narrativeLabelValues.map(v => v.replace(/[\[\]:]/g, '\\$&')).join('|')})`);

                const actionLabel = getEffectivePrompts(this)?.actionTriggeredPrompt || "\\[Action Triggered\\]:";
                const actionRegex = new RegExp(`^${actionLabel.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*(.*)`);

                // Build a regex to match any of the known character names at the start of a line
                const allChars = Array.from(this.gameData.characters.values());
                // Also add the player name from gameData, which might be different from the character object
                const playerChar = this.gameData.getPlayer();
                if (playerChar) {
                    allChars.push(playerChar);
                }
                const speakerNames = allChars.map(c => c.fullName).concat(allChars.map(c => c.shortName));
                speakerNames.push(this.gameData.playerName);
                const uniqueSpeakerNames = [...new Set(speakerNames)].filter(Boolean); // Remove empty and duplicates
                const speakerRegex = new RegExp(`^(${uniqueSpeakerNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}):`);

                for (let line of lines) {
                    // Metadata parsing remains the same
                    if (line.startsWith('Date:')) {
                        currentDate = line.replace('Date:', '').trim();
                        continue;
                    }
                    if (line.startsWith('Scene:')) {
                        currentScene = line.replace('Scene:', '').trim();
                        continue;
                    }
                    if (line.startsWith('Location:')) {
                        currentLocation = line.replace('Location:', '').trim();
                        continue;
                    }

                    const narrativeMatch = line.match(narrativeRegex);
                    if (narrativeMatch) {
                        if (currentMessage) {
                            const narrative = line.substring(narrativeMatch[0].length).trim();
                            if (!currentMessage.narrative) {
                                currentMessage.narrative = "";
                            }
                            currentMessage.narrative += narrative + "\n";
                        }
                        continue;
                    }

                    const actionMatch = line.match(actionRegex);
                    if (actionMatch) {
                        if (currentMessage) {
                            if (!(currentMessage as any).actions) {
                                (currentMessage as any).actions = [];
                            }
                            (currentMessage as any).actions.push({ actionName: '', chatMessage: actionMatch[1].trim(), chatMessageClass: 'neutral-action-message' });
                        }
                        continue;
                    }

                    const speakerMatch = line.match(speakerRegex);
                    if (speakerMatch) {
                        // This line starts a new message.
                        // First, save the previous message if it exists.
                        if (currentMessage) {
                            currentMessage.content = currentMessage.content.trim();
                            fileMessages.push(currentMessage);
                            totalMessagesLoaded++;
                        }

                        // Now, start the new message.
                        const name = speakerMatch[1].trim();
                        const messageContent = line.substring(speakerMatch[0].length).trim();
                        if (!characterNames.includes(name)) {
                            characterNames.push(name);
                        }
                        const role = (name === this.gameData.playerName.replace(/\s+/g, '')) ? 'user' : 'assistant';
                        
                        currentMessage = {
                            role: role as 'user' | 'assistant',
                            name: name,
                            content: messageContent
                        };
                    } else if (line.trim()) {
                        if (currentMessage) {
                            // This is a continuation of the current message.
                            currentMessage.content += '\n' + line;
                        } else {
                            // This is content before the first speaker, likely a scene description.
                            // Create a system message for it.
                            const sceneDescMessage: Message = {
                                role: 'system',
                                name: '', // Scene descriptions don't have a speaker name
                                content: line.trim()
                            };
                            fileMessages.push(sceneDescMessage);
                            totalMessagesLoaded++;
                        }
                    }

                    // Stop if we've reached the maximum number of messages
                    if (totalMessagesLoaded >= MAX_HISTORICAL_MESSAGES) {
                        console.log(`Reached maximum historical messages limit (${MAX_HISTORICAL_MESSAGES}) while loading ${fileInfo.name}.`);
                        break;
                    }
                }
                // Add the last message after the loop finishes
                if (currentMessage) {
                    currentMessage.content = currentMessage.content.trim();
                    fileMessages.push(currentMessage);
                    totalMessagesLoaded++;
                }
                
                // Store this conversation's metadata and messages
                if (fileMessages.length > 0) {
                    historicalConversations.push({
                        date: currentDate,
                        scene: currentScene,
                        location: currentLocation,
                        characters: characterNames,
                        messages: fileMessages
                    });
                }
                
                console.log(`Loaded ${fileMessages.length} messages from ${fileInfo.name} (Date: ${currentDate}, Location: ${currentLocation}, Scene: ${currentScene})`);
            } catch (error) {
                console.error(`Error reading or parsing history file ${fileInfo.name}: ${error}`);
            }
        }
        
        console.log(`Successfully loaded ${totalMessagesLoaded} messages from ${files.length} historical conversations.`);
        
        // Send loading complete event to chat window
        this.chatWindow.window.webContents.send('historical-conversations-loading', false);
        
        // Store historical conversation metadata for later use
        this.historicalConversations = historicalConversations;

        // After loading, send all conversations to the UI
        if (this.historicalConversations.length > 0) {
            this.chatWindow.window.webContents.send('historical-conversations-receive', this.historicalConversations);
        }
    }

    pushMessage(message: Message): void{
        if (!message.id) {
            message.id = randomUUID();
        }

        // If the user provides bracketed instructions, replace pronouns to avoid LLM confusion.
        if (message.role === 'user' && message.content.includes('[') && message.content.includes(']')) {
            const player = this.gameData.getPlayer();
            if (player) {
                const originalContent = message.content;
                
                message.content = originalContent.replace(/\[([^\]]*)\]/g, (match, insideBrackets) => {
                    let processedText = insideBrackets;

                    // Replace "I", "me", "my" with player's name
                    processedText = processedText.replace(/\bmy\b/gi, player.fullName + "'s");
                    processedText = processedText.replace(/\b(I|me)\b/gi, player.fullName);

                    // Determine the target for "you"
                    let targetCharacter: Character | undefined;
                    const otherCharacters = Array.from(this.gameData.characters.values()).filter(c => c.id !== this.gameData.playerID);
                    const targetIds = (message as any).targetCharacterIds as number[] | undefined;

                    if (targetIds && targetIds.length === 1) {
                        // If there's an explicit single target from the UI
                        targetCharacter = this.gameData.getCharacterById(targetIds[0]);
                    } else if (otherCharacters.length === 1) {
                        // If there's only one other character in the conversation
                        targetCharacter = otherCharacters[0];
                    }
                    // If multiple other characters and no explicit target, "you" is ambiguous. We won't replace it.

                    if (targetCharacter) {
                        // Replace "you", "your" with target character's name
                        processedText = processedText.replace(/\byour\b/gi, targetCharacter.fullName + "'s");
                        processedText = processedText.replace(/\byou\b/gi, targetCharacter.fullName);
                    }

                    return `[${processedText}]`;
                });

                if (originalContent !== message.content) {
                    console.log(`Replaced pronouns in user instruction. Original: "${originalContent}", New: "${message.content}"`);
                }
            }
        }

        // If this is an AI message, try to remove a placeholder
        if (message.role === 'assistant' && (message as any).characterId) {
            const characterId = (message as any).characterId;
            const placeholderIndex = this.messages.findIndex(
                msg => (msg as any).characterId === characterId && msg.content === this.notSpokenYetText
            );

            if (placeholderIndex !== -1) {
                this.messages.splice(placeholderIndex, 1); // Remove the placeholder
                console.log(`Removed placeholder for character ID ${characterId}.`);
            }
        }

        this.messages.push(message); // Always push the new message to the end

        console.log(`Message processed for conversation. Role: ${message.role}, Name: ${message.name}, Content length: ${message.content.length}`);
        
        // Reset consecutive actions counter when player sends a message
        if (message.role === "user") {
            this.consecutiveActionsCount = 0;
            this.currentTurnTriggeredActions.clear();
            console.log('Player message sent, resetting consecutive actions count and duplicate action check.');
        }
    }


    async generateAIsMessages() {
        if (this.isGeneratingScene) {
            console.log('Scene is currently generating. Queuing player request to be processed after.');
            this.pendingPlayerRequest = true;
            return;
        }
        if (this.isGenerating) {
            console.log('Already generating AI messages, skipping new request.');
            return;
        }
        this.isGenerating = true;
        this.abortController = new AbortController();
        try {
            // Ensure NPC queue is filled before determining targets.
            this.fillNpcQueue();
            const targetedCharacters = await this.determineTargetedCharacters();

            const lastMessage = this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;

            // Determine if we should check for actions immediately, before an AI's conversational reply.
            const userMessages = this.messages.filter(m => m.role === 'user');
            const isFirstUserTurn = userMessages.length === 1 && lastMessage?.role === 'user';
            const isDirectActionSyntax = lastMessage?.role === 'user' && (/\[(.*?)\]/.test(lastMessage.content) || /\*(.*?)\*/.test(lastMessage.content));

            if (lastMessage && lastMessage.role === 'user' && (isFirstUserTurn || isDirectActionSyntax)) {
                const reason = isFirstUserTurn ? "first user turn" : "direct action syntax";
                console.log(`Performing immediate action check due to: ${reason}.`);

                // If multiple targets, pick the first. If none, fallback to main AI.
                const targetId = targetedCharacters.length > 0 ? targetedCharacters[0].id : this.gameData.aiID;
                const sourceId = this.gameData.playerID;

                const collectedActions = await checkActions(this, sourceId, targetId);

                // If actions were found, we treat that as the "response" and bypass the normal AI chat reply.
                if (collectedActions.length > 0) {
                    console.log('Actions triggered on immediate check. Bypassing conversational reply.');
                    this.executedActions.set(lastMessage.id!, collectedActions);
                    this.actionInvolvedCharacterIds.add(sourceId);
                    this.actionInvolvedCharacterIds.add(targetId);
                    this.consecutiveActionsCount++;
                    this.lastActionMessageIndex = this.messages.length - 1;

                    let playerNarrative: Message | null = null;
                    if (this.config.narrativeEnable) {
                        playerNarrative = await generateNarrative(this, collectedActions);
                    }

                    if (playerNarrative) {
                        this.pushMessage(playerNarrative);
                    }
                    this.chatWindow.window.webContents.send('actions-receive', collectedActions, playerNarrative, false);

                    // End generation here since we handled the direct action.
                    this.isGenerating = false;
                    return;
                } else {
                    console.log('No actions triggered on immediate check. Proceeding with normal AI response.');
                }
            }

            this.aiToAiTurnLimit = 0;
            console.log('Starting generation of AI messages for all characters.');

            const isNowSelfTalk = this.gameData.characters.size === 1 && this.gameData.characters.has(this.gameData.playerID);

            // Special case for self-talk (player character is the AI character)
            if (isNowSelfTalk) {
                console.log('Self-talk session detected. Generating internal monologue for player character.');
                const playerCharacter = this.gameData.getPlayer();
                const messages = await this.processCharacterList([playerCharacter], false);
                for (const message of messages.messages) {
                    if (message) {
                        this.pushMessage(message);
                        this.chatWindow.window.webContents.send('message-receive', message, false);
                    }
                }
                this.chatWindow.window.webContents.send('actions-receive', [], "");
                console.log('Finished generating self-talk message.');
                return;
            }

            const respondedCharacterIds = new Set<number>();
            const allGeneratedMessages: Message[] = [];
            const allTurnActions: ActionResponse[] = [];

            // If the player's message contains action syntax, check for actions before the AI responds.
            // This ensures detection even if AI generation produces no messages, and avoids the old
            // problem of skipping the AI response entirely when actions were found.
            let playerActionsAlreadyChecked = false;
            if (this.config.actionsEnableAll && this.gameData.playerID !== this.gameData.aiID) {
                const lastMessage = this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
                if (lastMessage && lastMessage.role === 'user' &&
                    (/\[(.*?)\]/.test(lastMessage.content) || /\*(.*?)\*/.test(lastMessage.content))) {
                    console.log('Direct action detected in player message. Checking actions before AI responds.');
                    const targetId = targetedCharacters.length > 0 ? targetedCharacters[0].id : this.gameData.aiID;
                    const sourceId = this.gameData.playerID;

                    if (this.consecutiveActionsCount < this.config.maxConsecutiveActions) {
                        const collectedActions = await checkActions(this, sourceId, targetId);
                        if (collectedActions.length > 0) {
                            this.executedActions.set(lastMessage.id!, collectedActions);
                            allTurnActions.push(...collectedActions);
                            this.actionInvolvedCharacterIds.add(sourceId);
                            this.actionInvolvedCharacterIds.add(targetId);
                            this.consecutiveActionsCount++;
                            this.lastActionMessageIndex = this.messages.length - 1;
                        }
                    }
                    playerActionsAlreadyChecked = true;
                }
            }

            // Step 1: Get and process targeted characters
            if (targetedCharacters.length > 0) {
                const { messages, actions } = await this.processCharacterList(targetedCharacters, false, playerActionsAlreadyChecked);
                allGeneratedMessages.push(...messages.filter(m => m !== null) as Message[]);
                allTurnActions.push(...actions);
                messages.forEach(msg => {
                    if (msg) {
                        respondedCharacterIds.add((msg as any).characterId);
                    }
                });
            } else {
                // If no one is targeted, one random character responds
                console.log('No specific targets. Processing one random character from the queue.');
                const shuffledQueue = [...this.npcQueue].sort(() => Math.random() - 0.5);
                if (shuffledQueue.length > 0) {
                    const { messages, actions } = await this.processCharacterList([shuffledQueue[0]], false, playerActionsAlreadyChecked);
                    allGeneratedMessages.push(...messages.filter(m => m !== null) as Message[]);
                    allTurnActions.push(...actions);
                    messages.forEach(msg => {
                        if (msg) {
                            respondedCharacterIds.add((msg as any).characterId);
                        }
                    });
                }
            }

            // Step 2: Get and process non-targeted characters
            const nonTargetedCharacters = this.npcQueue.filter(c => !respondedCharacterIds.has(c.id));
            const respondingCharacters: Character[] = [];

            // Decide if ANY non-targeted character should respond
            const willAnyRespond = Math.random() < (this.config.nonTargetedCharacterResponseChance / 100);

            if (willAnyRespond && nonTargetedCharacters.length > 0) {
                console.log(`A non-targeted character will respond based on chance.`);
                // Select one random character from the available non-targeted characters
                const randomIndex = Math.floor(Math.random() * nonTargetedCharacters.length);
                const selectedCharacter = nonTargetedCharacters[randomIndex];
                respondingCharacters.push(selectedCharacter);
                console.log(`Selected non-targeted character to respond: ${selectedCharacter.shortName}`);
            } else {
                console.log(`No non-targeted character will respond this turn.`);
            }

            if (respondingCharacters.length > 0) {
                const { messages, actions } = await this.processCharacterList(respondingCharacters, true, playerActionsAlreadyChecked);
                allGeneratedMessages.push(...messages.filter(m => m !== null) as Message[]);
                allTurnActions.push(...actions);
            }

            // Clear queue display after all characters in this turn have been processed
            this.chatWindow.window.webContents.send('queue-update', [], null);

            // Send actions for player-directed part to re-enable user input
            let playerNarrative: Message | null = null;
            if (allTurnActions.length > 0 && this.config.narrativeEnable) {
                playerNarrative = await generateNarrative(this, allTurnActions);
                if (playerNarrative) {
                    this.pushMessage(playerNarrative);
                }
            }
            this.chatWindow.window.webContents.send('actions-receive', allTurnActions, playerNarrative, false);

            // --- AI-to-AI conversation starts here, in the background ---
            this.handleAiToAiConversation(allGeneratedMessages).catch(err => {
                console.error("Error in background AI-to-AI conversation:", err);
            });

            console.log('Finished generating and sending all AI messages to player.');

            // If suggestions are enabled, generate them now.
            if (this.config.autoGenerateSuggestions) {
                await this.generateInitialSuggestions();
            }
        } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
                console.log('generateAIsMessages was cancelled.');
                // The UI notification is handled in cancelGeneration(), so we do nothing here.
            } else {
                console.error('An error occurred during AI message generation:', error);
                this.chatWindow.window.webContents.send('error-message', 'An unexpected error occurred during generation.');
            }
        }
        finally {
            this.isGenerating = false;
            this.abortController = null;
        }
    }


    fillNpcQueue(): void {
        this.npcQueue = Array.from(this.gameData.characters.values()).filter(
            (character) => character.id !== this.gameData.playerID
        );
        console.log(`NPC queue filled with ${this.npcQueue.length} characters.`);
    }

    async determineTargetedCharacters(): Promise<Character[]> {
        console.log('Determining targeted characters...');
        const lastMessage = this.messages[this.messages.length - 1];
        // Only check for targets if the last message was from the user
        if (!lastMessage || lastMessage.role !== 'user') {
            console.log('Last message not from user, skipping targeting.');
            return [];
        }
        console.log(`Analyzing user message for targets: "${lastMessage.content}"`);

        // 1. Prioritize explicit targets from UI (passed as targetCharacterIds)
        const targetIds = (lastMessage as any).targetCharacterIds as number[] | undefined;
        if (targetIds && targetIds.length > 0 && targetIds.some(id => !isNaN(id))) { // Check if there are actual numbers
            const explicitTargets = new Set<Character>();
            targetIds.forEach(id => {
                const char = this.npcQueue.find(c => c.id === id);
                if (char) {
                    explicitTargets.add(char);
                }
            });
            if (explicitTargets.size > 0) {
                console.log(`UI targeted characters identified: ${Array.from(explicitTargets).map(c => c.shortName).join(', ')}`);
                return Array.from(explicitTargets);
            }
        }

        // 2. If no UI target, perform automatic detection
        console.log('No UI target found. Performing automatic detection...');
        const messageContent = lastMessage.content.toLowerCase();
        const words = messageContent.replace(/[.,!?;:]/g, '').split(/\s+/).filter(w => w.length > 2); // Clean punctuation and split into words
        console.log(`Words from message to check: [${words.join(', ')}]`);

        const potentialTargets = new Map<Character, number>(); // Map of Character to confidence score
        const FUZZY_MATCH_THRESHOLD = 0.75; // Lowered threshold slightly to catch more matches
        const SUBSTRING_CONFIDENCE = 0.9;
        const STOPWORDS = new Set(['the', 'of', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'and', 'le', 'la', 'de', 'my', 'your']);

        for (const character of this.npcQueue) {
            let highestConfidence = 0;
            console.log(`\nChecking character: ${character.shortName} (ID: ${character.id})`);

            const checkables = [
                character.fullName,
                character.shortName,
                character.firstName,
                character.primaryTitle,
                character.titleRankConcept
            ].filter(Boolean).map(n => n.toLowerCase());

            const player = this.gameData.getPlayer();
            if (player && player.relatives) {
                const relationshipToPlayer = player.relatives.find(m => m.id === character.id);
                if (relationshipToPlayer && relationshipToPlayer.relationship) {
                    const relationship = relationshipToPlayer.relationship.toLowerCase();
                    checkables.push(relationship);
                    if (relationship === 'child') {
                        // The character object from gameData should have gender info.
                        // We assume 'sheHe' property exists based on its usage elsewhere.
                        if (character.sheHe.toLowerCase() === 'he') {
                            checkables.push('son');
                        } else if (character.sheHe.toLowerCase() === 'she') {
                            checkables.push('daughter');
                        }
                    }
                }
            }

            console.log(`... against checkables: [${checkables.join(', ')}]`);

            for (const checkable of checkables) {
                const parts = checkable.split(/\s+/);
                for (const part of parts) {
                    const cleanPart = part.replace(/[.,!?;:]/g, '');
                    if (cleanPart.length < 3 || STOPWORDS.has(cleanPart)) continue;

                    for (const word of words) {
                        if (STOPWORDS.has(word)) continue;

                        // Substring match (high confidence)
                        if (cleanPart.includes(word)) {
                            if (SUBSTRING_CONFIDENCE > highestConfidence) {
                                highestConfidence = SUBSTRING_CONFIDENCE;
                                console.log(`... new highest confidence ${SUBSTRING_CONFIDENCE} from substring match: "${cleanPart}" includes "${word}"`);
                            }
                        }

                        // Fuzzy match (lower confidence)
                        const confidence = getSimilarity(cleanPart, word);
                        if (confidence > highestConfidence) {
                            highestConfidence = confidence;
                            console.log(`... new highest confidence ${confidence.toFixed(2)} from fuzzy match: "${cleanPart}" vs "${word}"`);
                        }
                    }
                }
            }

            if (highestConfidence > FUZZY_MATCH_THRESHOLD) {
                console.log(`---> Match found for ${character.shortName} with confidence ${highestConfidence.toFixed(2)} (Threshold: ${FUZZY_MATCH_THRESHOLD})`);
                const existingConfidence = potentialTargets.get(character) || 0;
                if (highestConfidence > existingConfidence) {
                    potentialTargets.set(character, highestConfidence);
                }
            }
        }

        if (potentialTargets.size > 0) {
            const sortedTargets = [...potentialTargets.entries()].sort((a, b) => b[1] - a[1]);
            const topConfidence = sortedTargets[0][1];

            // Return all targets with a confidence score close to the top score
            const highConfidenceTargets = sortedTargets
                .filter(t => t[1] >= topConfidence - 0.05) // Allow for small confidence differences
                .map(t => t[0]);

            if (highConfidenceTargets.length > 0) {
                console.log(`\nFinal targeted characters determined by automatic detection: ${highConfidenceTargets.map(c => `${c.shortName} (Confidence: ${potentialTargets.get(c)?.toFixed(2)})`).join(', ')}`);
                return highConfidenceTargets;
            }
        }

        console.log('\nNo specific character targeted after automatic detection.');
        return [];
    }

    async determineActionTarget(messageContent: string, speakerId: number): Promise<Character | null> {
        console.log(`Determining action target from message: "${messageContent}"`);
        const otherCharacters = Array.from(this.gameData.characters.values()).filter(c => c.id !== speakerId && c.id !== this.gameData.playerID);
        if (otherCharacters.length === 0) {
            return null; // No other AIs to target
        }

        const content = messageContent.toLowerCase();
        const words = content.replace(/[.,!?;:]/g, '').split(/\s+/);

        let bestMatch: Character | null = null;
        let highestConfidence = 0.75; // Start with a threshold

        for (const char of otherCharacters) {
            const checkables = [char.fullName, char.shortName, char.firstName].filter(Boolean).map(n => n.toLowerCase());
            for (const checkable of checkables) {
                for (const word of words) {
                    const confidence = getSimilarity(checkable, word);
                    if (confidence > highestConfidence) {
                        highestConfidence = confidence;
                        bestMatch = char;
                    }
                }
            }
        }

        if (bestMatch) {
            console.log(`Inferred action target: ${bestMatch.shortName} with confidence ${highestConfidence}`);
        } else {
            console.log('No specific AI action target inferred. Defaulting to player.');
        }

        return bestMatch;
    }

    async processCharacterList(characterList: Character[], isNonTargeted: boolean, playerActionsAlreadyChecked: boolean = false, performActionCheck: boolean = true): Promise<{ messages: (Message | null)[], actions: ActionResponse[] }> {
        const generatedMessages: (Message | null)[] = [];
        const allTurnActions: ActionResponse[] = [];

        for (const character of characterList) {
            if (this.isPaused) {
                console.log('Conversation paused. Queue processing will stop.');
                break;
            }

            // Update UI to show who is speaking
            const queueUpdate = characterList.filter(c => c.id !== character.id).map(c => ({ name: c.shortName, id: c.id }));
            const speakerUpdate = { name: character.shortName, id: character.id };
            this.chatWindow.window.webContents.send('queue-update', queueUpdate, speakerUpdate);

            console.log(`Processing character: ${character.shortName}`);
        
            // Generate message but don't send it to the UI yet
            const message = await this.generateNewAIMessage(character, false, isNonTargeted);
            
            if (message) {
                generatedMessages.push(message);
                this.pushMessage(message);
                this.chatWindow.window.webContents.send('message-receive', message, this.config.actionsEnableAll, false);

                // Check for actions initiated by the AI character's response.
                if (performActionCheck && this.config.actionsEnableAll) {
                    const sourceId = character.id; // The AI is the source.
                    const actionTarget = await this.determineActionTarget(message.content, sourceId);
                    const targetId = actionTarget ? actionTarget.id : this.gameData.playerID; // Target is player or another AI.

                    if (sourceId !== targetId) {
                        console.log(`[processCharacterList] Checking for AI-initiated actions. Source: ${sourceId}, Target: ${targetId}`);
                        const collectedActions = await checkActions(this, sourceId, targetId);
                        if (collectedActions.length > 0) {
                            const existingActions = this.executedActions.get(message.id!) || [];
                            this.executedActions.set(message.id!, [...existingActions, ...collectedActions]);
                            allTurnActions.push(...collectedActions);
                            this.actionInvolvedCharacterIds.add(sourceId);
                            this.actionInvolvedCharacterIds.add(targetId);
                        }
                    }
                }
            }
        }

        return { messages: generatedMessages, actions: allTurnActions };
    }

    pause(): void {
        this.isPaused = true;
        console.log('Conversation has been paused.');
    }

    resume(): void {
        if (!this.isPaused) {
            console.log('Conversation is not paused.');
            return;
        }
        this.isPaused = false;
        console.log('Conversation is resuming. Next user message will trigger AI responses.');
    }

    async generateAiToAiMessage(source: Character, target: Character): Promise<Message | null> {
        // Update UI to show who is speaking
        this.chatWindow.window.webContents.send('queue-update', [], { name: source.shortName, id: source.id });

        // buildChatPrompt will correctly set the target and use the right instruction.
        // We pass an empty array for messagesOverride to clear the history for a clean AI-to-AI start.
        let prompt = await buildChatPrompt(this, source, [], target);

        let currentTokens = this.textGenApiConnection.calculateTokensFromChat(prompt);
        console.log(`Current prompt token count for AI-to-AI: ${currentTokens}`);

        if(currentTokens > this.textGenApiConnection.context){
            console.log(`Context limit hit (${currentTokens}/${this.textGenApiConnection.context} tokens), resummarizing conversation!`);
            await this.resummarize();
            // Rebuild prompt after summarization
            prompt = await buildChatPrompt(this, source, [], target);
        }

        const content = await this.textGenApiConnection.complete(prompt, false, {
            max_tokens: this.config.maxTokens,
        }, undefined, this.abortController?.signal);

        if (content) {
            const message: Message = {
                role: 'assistant',
                name: source.fullName,
                content: content.trim()
            };
            // Add target information for the UI
            (message as any).targetCharacterIds = [target.id];
            (message as any).characterId = source.id;
            return message;
        }
        return null;
    }

    async generateNewAIMessage(character: Character, sendMessageToChat: boolean = true, isNonTargeted: boolean = false): Promise<Message | null> {
        console.log(`Generating AI message for character: ${character.fullName}`);
        
        const isSelfTalk = this.gameData.characters.size === 1 && this.gameData.characters.has(this.gameData.playerID);
        const characterNameForResponse = isSelfTalk ? character.shortName : character.fullName;

        // Check if we should question player actions
        const questioningChance = this.calculateQuestioningChance(character);
        if (questioningChance > 0 && Math.random() < (questioningChance / 100)) {
            const questionMessage = await this.generateActionQuestioningMessage(character);
            if (questionMessage) {
                if (sendMessageToChat) {
                    this.pushMessage(questionMessage);
                    this.chatWindow.window.webContents.send('message-receive', questionMessage, this.config.actionsEnableAll);
                }
                return questionMessage;
            }
        }

        let responseMessage: Message;

        if(this.config.stream && sendMessageToChat){
            this.chatWindow.window.webContents.send('stream-start');
            console.log('Stream started for AI message generation.');
        }

        let currentTokens = this.textGenApiConnection.calculateTokensFromChat(await buildChatPrompt(this, character, undefined, undefined, isNonTargeted));
        //let currentTokens = 500;
        console.log(`Current prompt token count: ${currentTokens}`);

        if(currentTokens > this.textGenApiConnection.context){
            console.log(`Context limit hit (${currentTokens}/${this.textGenApiConnection.context} tokens), resummarizing conversation!`);
            await this.resummarize();
        }

        let streamMessage: any = {
            role: "assistant",
            name: characterNameForResponse,//this.gameData.aiName,
            content: "",
            characterId: character.id
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
                content: await this.textGenApiConnection.complete(await buildChatPrompt(this, character, undefined, undefined, isNonTargeted), this.config.stream && sendMessageToChat, {
                    //stop: [this.gameData.playerName+":", this.gameData.aiName+":", "you:", "user:"],
                    max_tokens: this.config.maxTokens,
                },
                this.config.stream && sendMessageToChat ? streamRelay : undefined, this.abortController?.signal),
                characterId: character.id
            };  
            
        }
        //instruct
        else{
            console.log('Using completion API for AI message completion.');
            responseMessage = {
                role: "assistant",
                name: characterNameForResponse,
                content: await this.textGenApiConnection.complete(convertChatToText(await buildChatPrompt(this, character, undefined, undefined, isNonTargeted), this.config, character.fullName), this.config.stream && sendMessageToChat, {
                    stop: [this.config.inputSequence, this.config.outputSequence],
                    max_tokens: this.config.maxTokens,
                },
                this.config.stream && sendMessageToChat ? streamRelay : undefined, this.abortController?.signal),
                characterId: character.id
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
        
        const validationTranslations = this.translations.character_validation || getTranslations('en').character_validation;

        // 获取最近的对话历史，用于提供上下文
        const recentMessages = this.messages.slice(-5); // 获取最近5条消息作为上下文
        const conversationHistory = recentMessages.map(msg => 
            `${msg.name}: ${msg.content}`
        ).join('\n');
        
        // 获取年龄描述，根据年龄段添加后缀
        let ageDescription = `${character.age}`;
        if (character.age >= 0 && character.age <= 3) {
            ageDescription += ` ${validationTranslations.age_suffix.infant}`;
        } else if (character.age >= 4 && character.age <= 5) {
            ageDescription += ` ${validationTranslations.age_suffix.toddler}`;
        } else if (character.age >= 6 && character.age <= 12) {
            ageDescription += ` ${validationTranslations.age_suffix.child}`;
        } else if (character.age >= 13 && character.age <= 16) {
            ageDescription += ` ${validationTranslations.age_suffix.teenager}`;
        }

        // 构建验证提示
        const prompt: Message[] = [
            {
                role: "user",
                content: `${validationTranslations.prompt_assistant_role}

${validationTranslations.character_info}
- ${validationTranslations.name}: ${character.fullName}
- ${validationTranslations.short_name}: ${character.shortName}
- ${validationTranslations.title}: ${character.primaryTitle}
- ${validationTranslations.gender}: ${character.sheHe}
- ${validationTranslations.age}: ${ageDescription}
- ${validationTranslations.culture}: ${character.culture}
- ${validationTranslations.faith}: ${character.faith}
- ${validationTranslations.is_ruler}: ${character.isRuler ? validationTranslations.yes : validationTranslations.no}
- ${validationTranslations.is_independent_ruler}: ${character.isIndependentRuler ? validationTranslations.yes : validationTranslations.no}

${validationTranslations.recent_history}
${conversationHistory}

${validationTranslations.current_speaker}

${validationTranslations.message_content}
"${messageContent}"

${validationTranslations.instruction}`
            }
        ];
        
        try {
            // 调用LLM API进行验证
            const response = await this.textGenApiConnection.complete(prompt, false, {
                max_tokens: 10,
                temperature: 0.1 // 使用较低的温度以确保一致性
            }, undefined, this.abortController?.signal);
            
            const responseText = response.trim();
            console.log(`[DEBUG] Parsed response: ${responseText}`);
            
            // 更严格的验证逻辑：明确检查是否为"符合"
            const isValid = responseText === validationTranslations.valid;
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
    async generateNewAIMessageWithValidation(character: Character, isNonTargeted: boolean = false): Promise<Message | null> {
        console.log(`Generating AI message with identity validation for character: ${character.fullName}`);
        
        // 检查是否满足身份验证的条件：流式传输关闭且角色数量大于2
        const shouldValidate = !this.config.stream && this.gameData.characters.size > 2;
        
        if (!shouldValidate) {
            console.log(`Identity validation conditions not met (stream: ${this.config.stream}, character count: ${this.gameData.characters.size}). Generating message without validation.`);
            return await this.generateNewAIMessage(character, false, isNonTargeted);
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
                    generatedMessage = await this.generateNewAIMessage(character, false, isNonTargeted);
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
                if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
                    throw error; // Re-throw cancellation error
                }
            }
        }
        
        if (validMessageGenerated && validMessage) {
            return validMessage;
        } else {
            console.warn(`Failed to generate valid message for ${character.fullName} after ${maxAttempts} attempts. Skipping this character.`);
            // 可以选择发送一个通知给用户
            this.chatWindow.window.webContents.send('error-message', ` ${character.fullName} 没有发言。`);
            return null;
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
            }, undefined, this.abortController?.signal);
            
            if (!response || response.trim() === '') {
                console.warn(`Empty response from LLM for character ${character.fullName}`);
                return null;
            }
            
            // 创建消息对象
            const isSelfTalk = this.gameData.characters.size === 1 && this.gameData.characters.has(this.gameData.playerID);
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

    async executeApprovedAction(messageId: string, actionName: string) {
        const pending = this.pendingActions.get(messageId);
        if (!pending) {
            console.error(`No pending actions found for message ID ${messageId}`);
            return;
        }

        const actionToExecute = pending.find(p => p.action.signature === actionName);
        if (!actionToExecute) {
            console.error(`Action ${actionName} not found in pending actions for message ID ${messageId}`);
            return;
        }

        const { action, args, sourceId, targetId } = actionToExecute;

        try {
            let effectBody = "";
            action.run(this.gameData, (text: string) => { effectBody += text; }, args, sourceId, targetId);
            ActionEffectWriter.appendEffect(
                this.runFileManager,
                this.gameData,
                sourceId,
                targetId,
                effectBody
            );

            // Hardcoded effect for leaveConversation
            if (action.signature === 'leaveConversation' || action.signature === 'killCharacter') {
                if (targetId === this.gameData.playerID) {
                    console.log(`Player is leaving or was killed. Ending session. Action: ${action.signature}`);
                    this.chatWindow.window.webContents.send('chat-hide');
                    this.chatWindow.hide();
                    if (this.isOpen) {
                        this.summarize();
                    }
                } else {
                    this.removeCharacter(targetId);
                }
            }

            // Regenerate scene description if location changes
            if (action.signature === 'changeLocation') {
                this.generateSceneDescription();
            }

            this.runFileManager.append(`
                root = {trigger_event = mcc_event_v2.9003}                `
            );

            if (action.chatMessageClass != null) {
                let chatMessage = action.chatMessage(args);
                if (typeof chatMessage === 'object') {
                    chatMessage = chatMessage[this.config.language] || chatMessage['en'] || Object.values(chatMessage)[0];
                }
                const sourceChar = this.gameData.getCharacterById(sourceId);
                const targetChar = this.gameData.getCharacterById(targetId);
                this.gameData.character1Name = sourceChar ? sourceChar.shortName : "someone";
                this.gameData.character2Name = targetChar ? targetChar.shortName : "someone";
                const actionResponse: ActionResponse = {
                    actionName: action.signature,
                    chatMessage: parseVariables(chatMessage, this.gameData),
                    chatMessageClass: action.chatMessageClass
                };

                const existingActions = this.executedActions.get(messageId) || [];
                existingActions.push(actionResponse);
                this.executedActions.set(messageId, existingActions);

                this.chatWindow.window.webContents.send('actions-receive', [actionResponse], "");
            }

            console.log(`Action "${action.signature}" successfully executed after approval.`);
        } catch (e) {
            let errMsg = `Action error: failure in run function for action: ${action.signature}; details: `+e;
            console.error(errMsg);
            this.chatWindow.window.webContents.send('error-message', errMsg);
        }

        // Remove the executed action from pending
        const updatedPending = pending.filter(p => p.action.signature !== actionName);
        if (updatedPending.length === 0) {
            this.pendingActions.delete(messageId);
        } else {
            this.pendingActions.set(messageId, updatedPending);
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
                    this.currentSummary = await this.summarizationApiConnection.complete(buildResummarizeChatPrompt(this, messagesToSummarize), false, {}, undefined, this.abortController?.signal);
                }
                else{
                    console.log('Using completion API for resummarization.');
                    this.currentSummary = await this.summarizationApiConnection.complete(convertChatToTextNoNames(buildResummarizeChatPrompt(this, messagesToSummarize), this.config), false, {}, undefined, this.abortController?.signal);
                }
               
                console.log("New current summary after resummarization: "+this.currentSummary);
            } else {
                console.log('No messages to summarize during resummarization.');
            }
    }

    async summarize() {
        console.log('Starting end-of-conversation summarization process.');
        this.isOpen = false;
        this.cancelGeneration(); // Cancel any ongoing generation.
        // Write a trigger event to the game (e.g., trigger conversation end event)
        this.runFileManager.write(`
          trigger_event = mcc_event_v2.9002
          trigger_event = mcc_event_v2.9003
       `);
        setTimeout(() => {
            this.runFileManager.clear();  // Clear the event file after a delay (to ensure the game has read it)
            console.log('Run file cleared after conversation end event.');
        }, 500);

        // Generate and save diary entries for each character
        for (const character of this.gameData.characters.values()) {
            // @ts-ignore - diaryGenerationChance is a custom property we added
            const diaryChance = this.config.diaryGenerationChance / 100;
            const wasInvolvedInAction = this.actionInvolvedCharacterIds.has(character.id);

            if (diaryChance > 0 && (wasInvolvedInAction || Math.random() < diaryChance)) {
                if (wasInvolvedInAction) {
                    console.log(`Forcing diary entry for ${character.shortName} due to action involvement.`);
                }
                const newDiaryEntry = await this.diaryGenerator.generateDiaryEntry(this.gameData, this, character.id.toString());
                if (newDiaryEntry) {
                    await saveDiaryFile(this.gameData.playerID.toString(), character.id.toString(), newDiaryEntry);
                    
                    // Re-summarize the diary with the new entry
                    const summaryResult = await this.diaryGenerator.summarizeDiaryEntry(newDiaryEntry);
                    if (summaryResult) {
                        const summaries = await readDiarySummaries(this.gameData.playerID.toString(), character.id.toString());
                        summaries.unshift({ id: randomUUID(), ...summaryResult });
                        await saveDiarySummaries(this.gameData.playerID.toString(), character.id.toString(), summaries);
                    }
                }
            }
        }

        // Ensure the conversation_history directory exists
        const historyDir = path.join(this.userDataPath, 'conversation_history' ,this.gameData.playerID.toString());

        if (!fs.existsSync(historyDir)) {
          fs.mkdirSync(historyDir, { recursive: true });
          console.log(`Created conversation history directory: ${historyDir}`);
        }

        // Process conversation messages, keeping name, content and narrative
        const messagesToSave = this.messages.filter(msg => (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') && msg.content !== this.notSpokenYetText);
        const processedMessages = messagesToSave.map((msg, index) => {
          const messageData: any = {
            id: msg.id,
            name: msg.name,
            content: msg.content,
            type: (msg as any).type
          };
          
          return messageData;
        });

        // Build the text content to be saved
        let textContent = `Date: ${this.gameData.date}\n`;
        if (this.gameData.scene && this.gameData.scene.trim()) {
            textContent += `Scene: ${this.gameData.scene}\n`;
        }
        if (this.gameData.location && this.gameData.location.trim()) {
            textContent += `Location: ${this.gameData.location}\n`;
        }
        textContent += '\n';

        const narrativeLabels = {
            en: "[Narrative]:",
            zh: "[旁白]:",
            ru: "[Повествование]:",
            fr: "[Récit]:",
            es: "[Narrativa]:",
            de: "[Erzählung]:",
            ja: "[ナラティブ]:",
            ko: "[내레이션]:",
            pl: "[Narracja]:",
            pt: "[Narrativa]:"
        };
        const narrativeLabel = narrativeLabels[this.config.language] || narrativeLabels.en;

        processedMessages.forEach((msg, index) => {
            if (msg.type === 'narrative' || msg.name === 'Narrator') {
                textContent += `${narrativeLabel} ${msg.content}\n`;
            } else if (msg.type === 'scene') {
                // Scene descriptions are usually at the start and might not need a label in history,
                // but for clarity we can add one.
                textContent += `[Scene]: ${msg.content}\n`;
            } else if (msg.name) {
                textContent += `${msg.name}: ${msg.content}\n`;
            } else {
                textContent += `${msg.content}\n`;
            }

            const actions = this.executedActions.get(msg.id);
            if (actions && actions.length > 0) {
                const actionLabel = getEffectivePrompts(this)?.actionTriggeredPrompt || "[Action Triggered]:";
                actions.forEach(action => {
                    textContent += `${actionLabel} ${action.chatMessage}\n`;
                });
            }

          textContent += '\n';
        });

        // Store the message text for generating summaries in txt format
        const allCharacterIds = Array.from(this.gameData.characters.keys());
        const characterIdsString = allCharacterIds.join('_');
        const historyFile = path.join(
            this.userDataPath,
            'conversation_history',
            this.gameData.playerID.toString(),
            `${characterIdsString}_${new Date().getTime()}.txt`
        );
        fs.writeFileSync(historyFile, textContent);
        console.log(`Conversation history saved to: ${historyFile}`)

        // Do not generate a summary if there are not enough messages
        if (this.messages.length < 2) {
            console.log("Not enough messages to generate a summary (less than 2). Skipping summary generation.");
            return;
        }

        const summaryDirForMap = path.join(this.userDataPath, 'conversation_summaries', this.gameData.playerID.toString());
        const characterMapPath = path.join(summaryDirForMap, '_character_map.json');
        let characterMap: {[key: number]: string} = {};
        if (fs.existsSync(characterMapPath)) {
            try {
                characterMap = JSON.parse(fs.readFileSync(characterMapPath, 'utf8'));
            } catch (e) {
                console.error('Error reading existing character map:', e);
            }
        }
        for (const char of this.gameData.characters.values()) {
            if (!characterMap[char.id]) {
                characterMap[char.id] = char.shortName;
            }
        }
        fs.writeFileSync(characterMapPath, JSON.stringify(characterMap, null, '\t'));
        console.log(`Updated character map at: ${characterMapPath}`);

        for (const character of this.gameData.characters.values()) {
            if (character.id === this.gameData.playerID) continue;

            // Build a character-specific prompt
            const prompt = buildSummarizeChatPrompt(this, character);

            // Generate summary from this character's perspective
            // Do not pass the abortController signal here to ensure summarization is not cancelled.
            const summaryContent = await this.summarizationApiConnection.complete(prompt, false, {});

            const newSummary: Summary = {
                date: this.gameData.date,
                content: summaryContent
            };
            console.log(`Generated new summary for conversation from ${character.fullName}'s perspective: ${newSummary.content.substring(0, 100)}...`);

            const summaryDir = path.join(this.userDataPath, 'conversation_summaries', this.gameData.playerID.toString());
            const summaryFile = path.join(summaryDir, `${character.id.toString()}.json`);

            this.summaryFileWatcher.pauseWatcher(summaryFile);

            const existingSummaries = this.summaries.get(character.id) || [];

            if (newSummary.content.trim()) {
                existingSummaries.unshift(newSummary);
                fs.writeFileSync(summaryFile, JSON.stringify(existingSummaries, null, '\t'));
                console.log(`Saved updated summaries for AI ID ${character.id} to ${summaryFile}. Total summaries: ${existingSummaries.length}`);
            } else {
                console.log(`Skipping saving empty summary for AI ID ${character.id}.`);
            }

            this.summaryFileWatcher.resumeWatcher(summaryFile);
        }
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
    
        this.loadActions();
    }

    getApiConnections() {
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

    loadActions(){
        console.log('Loading actions from scripts.');
        this.actions = [];

        const actionsPath = path.join(this.userDataPath, 'scripts', 'actions');
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
            const actionModule = require(filePath);

            if (!actionModule || !actionModule.signature) {
                console.warn(`Action file ${file} is invalid or missing a signature.`);
                continue;
            }

            if (actionModule.run) {
                const runFunctionString = actionModule.run.toString();
                (actionModule as any).usesSource = runFunctionString.includes('votcce_action_source');
                (actionModule as any).usesTarget = runFunctionString.includes('votcce_action_target');
            } else {
                console.warn(`Action file ${file} is missing the 'run' function.`);
            }
            this.actions.push(actionModule);
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
            const actionModule = require(filePath);

            if (!actionModule || !actionModule.signature) {
                console.warn(`Action file ${file} is invalid or missing a signature.`);
                continue;
            }

            if (actionModule.run) {
                const runFunctionString = actionModule.run.toString();
                (actionModule as any).usesSource = runFunctionString.includes('votcce_action_source');
                (actionModule as any).usesTarget = runFunctionString.includes('votcce_action_target');
            } else {
                console.warn(`Action file ${file} is missing the 'run' function.`);
            }
            this.actions.push(actionModule);
            console.log(`Loaded custom action: ${file}`);
        }
        console.log(`Finished loading actions. Total actions loaded: ${this.actions.length}`);
        console.log(`Loaded action signatures: ${this.actions.map(a => a.signature).join(', ')}`);
    }

    /**
     * 生成场景描述
     * isInitial determines if it's for the start of the conversation or a mid-conversation update.
     */
    public async generateSceneDescription(isInitial: boolean = false): Promise<void> {
        console.log(`Starting scene description generation. Initial: ${isInitial}`);
        console.log(`[Conversation.ts] Generating scene description for scene: '${this.gameData.scene}'`);

        // Send status update to chat window
        this.chatWindow.window.webContents.send('status-update', 'chat.status_generating_scene');

        this.isGeneratingScene = true;
        const wasGenerating = this.isGenerating;
        if (!wasGenerating) {
            this.isGenerating = true;
            this.abortController = new AbortController();
        }

        try {
            // 生成场景描述
            const sceneDescription = await generateSceneDescription(this, this.abortController!.signal);

            if (sceneDescription && sceneDescription.trim()) {
                // 创建场景描述消息
                const sceneMessage: Message = {
                    id: randomUUID(),
                    role: "system",
                    name: "",
                    content: sceneDescription,
                    // @ts-ignore
                    type: 'scene'
                };

                if (isInitial) {
                    // Calculate the position to insert scene description (after historical conversations)
                    // Count total historical messages
                    let historicalMessageCount = 0;
                    if (this.historicalConversations) {
                        historicalMessageCount = this.historicalConversations.reduce((total, conv) => total + conv.messages.length, 0);
                    }

                    // Insert scene description after historical messages but before current conversation
                    this.messages.splice(historicalMessageCount, 0, sceneMessage);
                } else {
                    sceneMessage.id = randomUUID();
                    this.messages.push(sceneMessage);
                }

                // 发送场景描述到聊天窗口
                this.chatWindow.window.webContents.send('scene-description', sceneMessage);

                console.log(`Scene description generated and sent. Initial: ${isInitial}. Desc: ${sceneDescription.substring(0, 100)}...`);
            } else {
                console.log('No scene description was generated or description was empty.');
                // 发送空场景描述以清除加载状态
                this.chatWindow.window.webContents.send('scene-description', null);
            }
        } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
                console.log('Scene description generation was cancelled by user.');
                // The UI is already handled by the 'generation-cancelled' event, so we just need to ensure loading dots are gone.
                this.chatWindow.window.webContents.send('scene-description', null); // Clear loading state
            } else {
                console.error('Error generating scene description:', error);
                // 如果生成失败，不影响对话的正常进行
                // 但仍然需要清除加载状态
                this.chatWindow.window.webContents.send('scene-description', null);
            }
        } finally {
            this.chatWindow.window.webContents.send('status-update', '');
            this.isGeneratingScene = false;
            if (!wasGenerating) {
                this.isGenerating = false;
                this.abortController = null;
            }

            // If a player message came in while the scene was generating, process it now.
            if (this.pendingPlayerRequest) {
                console.log('Processing queued player request after scene generation finished.');
                this.pendingPlayerRequest = false;
                this.generateAIsMessages();
            }
        }

        // 场景描述生成完成后，如果启用了自动生成建议功能，则生成建议
        if (isInitial && this.config.autoGenerateSuggestions) {
            console.log('Initial scene description generation completed, now generating suggestions.');
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
        this.currentSummary = "";
        this.consecutiveActionsCount = 0;
        this.lastActionMessageIndex = -1;
    }

    public cancelGeneration(): void {
        if (this.abortController && !this.abortController.signal.aborted) {
            this.abortController.abort();
            console.log('Cancellation signal sent to API request.');
            this.isGenerating = false;
            this.abortController = null;
            this.chatWindow.window.webContents.send('generation-cancelled');
            this.chatWindow.window.webContents.send('status-update', ''); // Clear status text
        }
    }

    public undo(): void {
        console.log("Undoing last exchange.");
        const lastUserIndex = [...this.messages].reverse().findIndex(m => m.role === 'user');
        
        if (lastUserIndex !== -1) {
            const actualIndex = this.messages.length - 1 - lastUserIndex;
            console.log(`Removing messages from index ${actualIndex} onwards.`);
            const removedMessages = this.messages.splice(actualIndex);

            // Clean up actions for removed messages
            for (const msg of removedMessages) {
                if (msg.id) {
                    this.pendingActions.delete(msg.id);
                    this.executedActions.delete(msg.id);
                }
            }
            
            // Reset consecutive actions counter since we're going back in time
            this.consecutiveActionsCount = 0;
            this.lastActionMessageIndex = -1;
        }
    }


    public editMessage(messageId: string, newContent: string): void {
        const message = this.messages.find(m => m.id === messageId);
        if (message) {
            console.log(`Editing message ${messageId}. Old content: "${message.content.substring(0, 50)}...". New content: "${newContent.substring(0, 50)}..."`);
            message.content = newContent;
        } else {
            console.warn(`Could not find message with ID ${messageId} to edit.`);
        }
    }

    public async regenerate(): Promise<void> {
        console.log("Regenerating last AI response.");

        // Find the last user message to know where the exchange started
        const lastUserIndex = [...this.messages].reverse().findIndex(m => m.role === 'user');
        if (lastUserIndex === -1) {
            console.log("No user message found to regenerate from.");
            return;
        }
        const actualIndex = this.messages.length - 1 - lastUserIndex;

        // Remove all messages after the last user message
        if (actualIndex < this.messages.length - 1) {
            console.log(`Splicing messages from index ${actualIndex + 1}`);
            const removedMessages = this.messages.splice(actualIndex + 1);
            // Clean up actions associated with removed messages
            for (const msg of removedMessages) {
                if (msg.id) {
                    this.pendingActions.delete(msg.id);
                    this.executedActions.delete(msg.id);
                }
            }
        }

        // Reset action counter as we are re-doing this turn
        this.consecutiveActionsCount = 0;

        // Now, generate the AI response again
        await this.generateAIsMessages();
    }

    public removeCharacter(characterId: number): void {
        const character = this.gameData.characters.get(characterId);
        if (character) {
            console.log(`Removing character ${character.shortName} (ID: ${characterId}) from conversation state.`);

            // Add a system message to the chat history to inform the LLM
            const systemMessage: Message = {
                role: "system",
                name: "System",
                content: `[System note: ${character.fullName} has left the conversation and is no longer present.]`
            };
            this.pushMessage(systemMessage);
            // Also send it to the UI so it's visible for debugging and context
            this.chatWindow.window.webContents.send('message-receive', systemMessage, false);
            
            // Remove from GameData
            this.gameData.characters.delete(characterId);
            
            // Remove any placeholder messages
            const placeholderIndex = this.messages.findIndex(
                msg => (msg as any).characterId === characterId && msg.content === this.notSpokenYetText
            );
            if (placeholderIndex !== -1) {
                this.messages.splice(placeholderIndex, 1);
            }
    
            // Remove from NPC queue for future turns
            this.npcQueue = this.npcQueue.filter(c => c.id !== characterId);
            if (this.customQueue) {
                this.customQueue = this.customQueue.filter(c => c.id !== characterId);
            }
    
            // Notify the UI to update itself
            this.chatWindow.window.webContents.send('character-left', characterId);
            
            // Notify UI to update slash command dropdowns
            this.chatWindow.window.webContents.send('update-character-lists', Array.from(this.gameData.characters.keys()));
        } else {
            console.warn(`Attempted to remove character with ID ${characterId}, but they were not found in the conversation.`);
        }
    }



    private async checkForSummariesFromOtherPlayers(): Promise<void> {
        console.log('Checking for summaries from other players...');
        const summariesBasePath = path.join(this.userDataPath, 'conversation_summaries');
        if (!fs.existsSync(summariesBasePath)) return;

        const playerDirs = fs.readdirSync(summariesBasePath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        const otherPlayerIds = playerDirs.filter(id => id !== this.gameData.playerID.toString());

        if (otherPlayerIds.length === 0) {
            console.log('No other player summaries found.');
            return;
        }

        console.log(`Found summaries from other players: ${otherPlayerIds.join(', ')}`);

        for (const character of this.gameData.characters.values()) {
            if (character.id === this.gameData.playerID) continue;

            let characterSummaries = this.summaries.get(character.id) || [];

            for (const playerId of otherPlayerIds) {
                const summaryFilePath = path.join(summariesBasePath, playerId, `${character.id.toString()}.json`);
                if (fs.existsSync(summaryFilePath)) {
                    try {
                        const foreignSummaries: Summary[] = JSON.parse(fs.readFileSync(summaryFilePath, 'utf8'));
                        const summariesToImport = foreignSummaries.map(s => ({
                            ...s,
                            fromPlayerId: playerId // Add the player ID
                        }));
                        characterSummaries.push(...summariesToImport);
                        console.log(`Imported ${summariesToImport.length} summaries for character ${character.id} from player ${playerId}.`);
                    } catch (e) {
                        console.error(`Error reading or parsing summary file ${summaryFilePath}:`, e);
                    }
                }
            }

            // Re-sort all summaries by date
            characterSummaries.sort((a: any, b: any) => {
                const dateA = parseGameDate(a.date) || new Date(0);
                const dateB = parseGameDate(b.date) || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });

            this.summaries.set(character.id, characterSummaries);
        }
    }

    private async handleAiToAiConversation(initialMessages: Message[]): Promise<void> {
        const shouldTalkToAi = Math.random() < (this.config.aiToAiChatChance / 100);
        if (initialMessages.length === 0 || this.aiToAiTurnLimit >= 2 || !shouldTalkToAi) {
            return;
        }

        this.aiToAiTurnLimit++;
        const lastRespondingCharacter = this.gameData.characters.get((initialMessages[initialMessages.length - 1] as any).characterId);
        if (!lastRespondingCharacter) return;

        const otherAIs = Array.from(this.gameData.characters.values()).filter(
            c => c.id !== this.gameData.playerID && c.id !== lastRespondingCharacter.id
        );

        if (otherAIs.length > 0) {
            const targetAI = otherAIs[Math.floor(Math.random() * otherAIs.length)];
            console.log(`AI-to-AI turn: ${lastRespondingCharacter.shortName} will now talk to ${targetAI.shortName}.`);

            // Generate AI1 -> AI2 message
            const aiMessage = await this.generateAiToAiMessage(lastRespondingCharacter, targetAI);
            if (aiMessage) {
                this.pushMessage(aiMessage);
                this.chatWindow.window.webContents.send('message-receive', aiMessage, this.config.actionsEnableAll, true);

                let collectedActions: ActionResponse[] = [];
                if (this.config.actionsEnableAll) {
                    collectedActions = await checkActions(this, lastRespondingCharacter.id, targetAI.id);
                    if (collectedActions.length > 0) {
                        this.actionInvolvedCharacterIds.add(lastRespondingCharacter.id);
                        this.actionInvolvedCharacterIds.add(targetAI.id);
                    }
                }
                let narrativeMessage: Message | null = null;
                if (collectedActions.length > 0 && this.config.narrativeEnable) {
                    narrativeMessage = await generateNarrative(this, collectedActions);
                    if (narrativeMessage) {
                        this.pushMessage(narrativeMessage);
                    }
                }
                this.chatWindow.window.webContents.send('actions-receive', collectedActions, narrativeMessage, true);

                // Generate AI2 -> AI1 response
                const { messages } = await this.processCharacterList([targetAI], false, false, false);
                for (const responseMsg of messages) {
                    if (responseMsg) {
                        this.pushMessage(responseMsg);
                        this.chatWindow.window.webContents.send('message-receive', responseMsg, this.config.actionsEnableAll, true);

                        let responseActions: ActionResponse[] = [];
                        if (this.config.actionsEnableAll) {
                            responseActions = await checkActions(this, targetAI.id, lastRespondingCharacter.id);
                            if (responseActions.length > 0) {
                                this.actionInvolvedCharacterIds.add(targetAI.id);
                                this.actionInvolvedCharacterIds.add(lastRespondingCharacter.id);
                            }
                        }
                        let responseNarrative: Message | null = null;
                        if (responseActions.length > 0 && this.config.narrativeEnable) {
                            responseNarrative = await generateNarrative(this, responseActions);
                            if (responseNarrative) {
                                this.pushMessage(responseNarrative);
                            }
                        }
                        this.chatWindow.window.webContents.send('actions-receive', responseActions, responseNarrative, true);
                    }
                }
            }
        }
    }

    public async initiateConversation(){
        if(Math.random() < (this.config.aiStartConversationChance / 100)){
            // Send loading event to chat window when AI starts conversation
            this.chatWindow.window.webContents.send('ai-first-conversation-loading', true);
            await this.generateAIsMessages();
        }
    }

    /**
     * Generate a message where the AI character questions the player's actions
     * based on their personality and history.
     */
    private async generateActionQuestioningMessage(character: Character): Promise<Message | null> {
        console.log(`Generating action questioning message for character: ${character.fullName}`);

        // Build a prompt that uses the full conversation context and adds a questioning instruction.
        const prompt = await this.buildQuestioningPrompt(character);

        try {
            const response = await this.textGenApiConnection.complete(prompt, false, {
                max_tokens: this.config.maxTokens,
                temperature: 0.7 // Slightly higher temperature for more creative questioning
            });

            if (!response || response.trim() === '') {
                return null;
            }

            const message: Message = {
                role: "assistant",
                name: character.fullName,
                content: response.trim(),
                characterId: character.id
            };

            return message;
        } catch (error) {
            console.error(`Error generating action questioning message: ${error}`);
            return null;
        }
    }

    /**
     * Build a prompt for questioning player actions by appending an instruction to the main chat prompt.
     */
    private async buildQuestioningPrompt(character: Character): Promise<any[]> {
        // Get the standard, rich prompt with full conversation context.
        const standardPrompt = await buildChatPrompt(this, character);

        // Add a new system instruction at the end to guide the AI's response.
        const questioningInstruction = {
            role: "system" as const,
            content: `Instead of directly complying, your character has reservations about the player's last statement. Based on your personality and the situation, express your hesitation, question their motives, or suggest an alternative. Your response should be in character and move the conversation forward by exploring this conflict or concern.`
        };

        standardPrompt.push(questioningInstruction);
        console.log("Appended questioning instruction to the standard prompt.");

        return standardPrompt;
    }

    private calculateQuestioningChance(character: Character): number {
        let chance = this.config.questionPlayerActionsChance;
        if (chance <= 0) {
            return 0;
        }

        console.log(`Calculating questioning chance for ${character.shortName}. Base chance: ${chance}%`);

        // Trait-based modifiers (positive for more likely to question, negative for less)
        const traitModifiers: { [key: string]: number } = {
            'just': 20,
            'honest': 15,
            'honorable': 15,
            'compassionate': 10,
            'cynical': 10,
            'paranoid': 25,
            'arbitrary': -10,
            'deceitful': -20,
            'callous': -15,
            'lazy': -10
        };

        for (const trait of character.traits) {
            const traitName = trait.name.toLowerCase();
            if (traitModifiers[traitName]) {
                const modifier = traitModifiers[traitName];
                chance += modifier;
                console.log(`... applying modifier for trait '${traitName}': ${modifier}%. New chance: ${chance}%`);
            }
        }

        // Clamp the chance between 0 and 100
        const finalChance = Math.max(0, Math.min(100, chance));
        if (finalChance !== this.config.questionPlayerActionsChance) {
            console.log(`Final questioning chance for ${character.shortName}: ${finalChance}%`);
        }
        return finalChance;
    }
}
