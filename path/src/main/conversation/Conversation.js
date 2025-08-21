"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conversation = void 0;
const electron_1 = require("electron");
const apiConnection_js_1 = require("../../shared/apiConnection.js");
const checkActions_js_1 = require("./checkActions.js");
const promptBuilder_js_1 = require("./promptBuilder.js");
const messageCleaner_js_1 = require("./messageCleaner.js");
const summarize_js_1 = require("./summarize.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const RunFileManager_js_1 = require("../RunFileManager.js");
const userDataPath = path_1.default.join(electron_1.app.getPath('userData'), 'votc_data');
class Conversation {
    constructor(gameData, config, chatWindow) {
        this.chatWindow = chatWindow;
        this.isOpen = true;
        this.gameData = gameData;
        this.messages = [];
        this.currentSummary = "";
        this.summaries = [];
        if (!fs_1.default.existsSync(path_1.default.join(userDataPath, 'conversation_summaries'))) {
            fs_1.default.mkdirSync(path_1.default.join(userDataPath, 'conversation_summaries'));
        }
        if (!fs_1.default.existsSync(path_1.default.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString()))) {
            fs_1.default.mkdirSync(path_1.default.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString()));
        }
        if (fs_1.default.existsSync(path_1.default.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString(), this.gameData.aiID.toString() + ".json"))) {
            this.summaries = JSON.parse(fs_1.default.readFileSync(path_1.default.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString(), this.gameData.aiID.toString() + ".json"), 'utf8'));
        }
        else {
            this.summaries = [];
            fs_1.default.writeFileSync(path_1.default.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString(), this.gameData.aiID.toString() + ".json"), JSON.stringify(this.summaries, null, '\t'));
        }
        this.config = config;
        //TODO: wtf
        this.runFileManager = new RunFileManager_js_1.RunFileManager(config.userFolderPath);
        this.description = "";
        this.actions = [];
        this.exampleMessages = [],
            [this.textGenApiConnection, this.summarizationApiConnection, this.actionsApiConnection] = this.getApiConnections();
        this.loadConfig();
    }
    pushMessage(message) {
        this.messages.push(message);
    }
    generateAIsMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            const shuffled_characters = Array.from(this.gameData.characters.values()).sort(() => Math.random() - 0.5);
            for (const character of shuffled_characters) {
                if (character.id !== this.gameData.playerID) {
                    yield this.generateNewAIMessage(character);
                }
            }
            this.chatWindow.window.webContents.send('actions-receive', []);
        });
    }
    generateNewAIMessage(character) {
        return __awaiter(this, void 0, void 0, function* () {
            let responseMessage;
            if (this.config.stream) {
                this.chatWindow.window.webContents.send('stream-start');
            }
            let currentTokens = this.textGenApiConnection.calculateTokensFromChat((0, promptBuilder_js_1.buildChatPrompt)(this, character));
            //let currentTokens = 500;
            console.log(`current tokens: ${currentTokens}`);
            if (currentTokens > this.textGenApiConnection.context) {
                console.log(`Context limit hit, resummarizing conversation! limit:${this.textGenApiConnection.context}`);
                yield this.resummarize();
            }
            let streamMessage = {
                role: "assistant",
                name: character.fullName, //this.gameData.aiName,
                content: ""
            };
            let cw = this.chatWindow;
            function streamRelay(msgChunk) {
                streamMessage.content += msgChunk.content;
                cw.window.webContents.send('stream-message', streamMessage);
            }
            if (this.textGenApiConnection.isChat()) {
                responseMessage = {
                    role: "assistant",
                    name: character.fullName, //this.gameData.aiName,
                    content: yield this.textGenApiConnection.complete((0, promptBuilder_js_1.buildChatPrompt)(this, character), this.config.stream, {
                        //stop: [this.gameData.playerName+":", this.gameData.aiName+":", "you:", "user:"],
                        max_tokens: this.config.maxTokens,
                    }, streamRelay)
                };
            }
            //instruct
            else {
                responseMessage = {
                    role: "assistant",
                    name: character.fullName,
                    content: yield this.textGenApiConnection.complete((0, promptBuilder_js_1.convertChatToText)((0, promptBuilder_js_1.buildChatPrompt)(this, character), this.config, character.fullName), this.config.stream, {
                        stop: [this.config.inputSequence, this.config.outputSequence],
                        max_tokens: this.config.maxTokens,
                    }, streamRelay)
                };
            }
            if (this.config.cleanMessages) {
                responseMessage.content = (0, messageCleaner_js_1.cleanMessageContent)(responseMessage.content);
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
                    this.chatWindow.window.webContents.send('error-message', errorMsg);
                    return; // Stop processing this message
                }
            }
            // If the response is empty after cleaning, don't send it.
            if (!responseMessage.content.trim()) {
                console.log(`AI response for ${character.fullName} was empty after cleaning. Skipping.`);
                return;
            }
            this.pushMessage(responseMessage);
            if (!this.config.stream) {
                this.chatWindow.window.webContents.send('message-receive', responseMessage, this.config.actionsEnableAll);
            }
            if (character.id === this.gameData.aiID) {
                let collectedActions;
                if (this.config.actionsEnableAll) {
                    try {
                        collectedActions = yield (0, checkActions_js_1.checkActions)(this);
                    }
                    catch (e) {
                        collectedActions = [];
                    }
                }
                else {
                    collectedActions = [];
                }
                this.chatWindow.window.webContents.send('actions-receive', collectedActions);
            }
        });
    }
    resummarize() {
        return __awaiter(this, void 0, void 0, function* () {
            let tokensToSummarize = this.textGenApiConnection.context * (this.config.percentOfContextToSummarize / 100);
            console.log(`context: ${this.textGenApiConnection.context} percent to summarize: ${this.config.percentOfContextToSummarize} tokens to summarize: ${tokensToSummarize}`);
            let tokenSum = 0;
            let messagesToSummarize = [];
            while (tokenSum < tokensToSummarize && this.messages.length > 0) {
                let msg = this.messages.shift();
                tokenSum += this.textGenApiConnection.calculateTokensFromMessage(msg);
                console.log("to remove:");
                console.log(msg);
                messagesToSummarize.push(msg);
            }
            if (messagesToSummarize.length > 0) { //prevent infinite loops
                console.log("current summary: " + this.currentSummary);
                if (this.summarizationApiConnection.isChat()) {
                    this.currentSummary = yield this.summarizationApiConnection.complete((0, promptBuilder_js_1.buildResummarizeChatPrompt)(this, messagesToSummarize), false, {});
                }
                else {
                    this.currentSummary = yield this.summarizationApiConnection.complete((0, promptBuilder_js_1.convertChatToTextNoNames)((0, promptBuilder_js_1.buildResummarizeChatPrompt)(this, messagesToSummarize), this.config), false, {});
                }
                console.log("after current summary: " + this.currentSummary);
            }
        });
    }
    // Store a summary for each character participating in the conversation.
    summarize() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isOpen = false;
            // Write a trigger event to the game (e.g., trigger conversation end event)
            this.runFileManager.write("trigger_event = talk_event.9002");
            setTimeout(() => {
                this.runFileManager.clear(); // Clear the event file after a delay (to ensure the game has read it)
            }, 500);
            // Ensure the conversation_history directory exists
            const historyDir = path_1.default.join(userDataPath, 'conversation_history', this.gameData.playerID.toString());
            if (!fs_1.default.existsSync(historyDir)) {
                fs_1.default.mkdirSync(historyDir, { recursive: true });
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
            const historyFile = path_1.default.join(userDataPath, 'conversation_history', this.gameData.playerID.toString(), `${this.gameData.playerID}_${this.gameData.aiID}_${new Date().getTime()}.txt`);
            fs_1.default.writeFileSync(historyFile, textContent);
            console.log(`Conversation history saved to: ${historyFile}`);
            // Do not generate a summary if there are not enough messages
            if (this.messages.length < 6) {
                console.log("Not enough messages to generate a summary.");
                return;
            }
            // Generate a new summary (by calling the summarize utility function)
            const summary = {
                date: this.gameData.date, // Current in-game date
                content: yield (0, summarize_js_1.summarize)(this) // Asynchronously generate summary content
            };
            this.gameData.characters.forEach((_value, key) => {
                if (key !== this.gameData.playerID) {
                    this.summaries = [];
                    const summaryDir = path_1.default.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString());
                    if (!fs_1.default.existsSync(summaryDir)) {
                        fs_1.default.mkdirSync(summaryDir, { recursive: true });
                    }
                    // Load historical summaries (if they exist)
                    const summaryFile = path_1.default.join(summaryDir, `${key.toString()}.json`);
                    if (fs_1.default.existsSync(summaryFile)) {
                        this.summaries = JSON.parse(fs_1.default.readFileSync(summaryFile, 'utf8'));
                    }
                    else {
                        fs_1.default.writeFileSync(summaryFile, JSON.stringify(this.summaries, null, '\t')); // Initialize an empty summary file
                    }
                    // Add the new summary to the beginning of the list
                    this.summaries.unshift(summary);
                    // Persist the summaries, categorized by player ID and AI ID
                    const summaryFile1 = path_1.default.join(userDataPath, 'conversation_summaries', this.gameData.playerID.toString(), `${key.toString()}.json`);
                    fs_1.default.writeFileSync(summaryFile1, JSON.stringify(this.summaries, null, '\t'));
                }
            });
        });
    }
    ;
    updateConfig(config) {
        console.log("config updated!");
        this.loadConfig();
    }
    loadConfig() {
        var _a, _b, _c, _d, _e, _f;
        const configToLog = JSON.parse(JSON.stringify(this.config.toSafeConfig()));
        if ((_b = (_a = configToLog.textGenerationApiConnectionConfig) === null || _a === void 0 ? void 0 : _a.connection) === null || _b === void 0 ? void 0 : _b.key) {
            configToLog.textGenerationApiConnectionConfig.connection.key = "[REDACTED]";
        }
        if ((_d = (_c = configToLog.summarizationApiConnectionConfig) === null || _c === void 0 ? void 0 : _c.connection) === null || _d === void 0 ? void 0 : _d.key) {
            configToLog.summarizationApiConnectionConfig.connection.key = "[REDACTED]";
        }
        if ((_f = (_e = configToLog.actionsApiConnectionConfig) === null || _e === void 0 ? void 0 : _e.connection) === null || _f === void 0 ? void 0 : _f.key) {
            configToLog.actionsApiConnectionConfig.connection.key = "[REDACTED]";
        }
        console.log(configToLog);
        this.runFileManager = new RunFileManager_js_1.RunFileManager(this.config.userFolderPath);
        this.runFileManager.clear();
        this.description = "";
        this.exampleMessages = [];
        const descriptionPath = path_1.default.join(userDataPath, 'scripts', 'prompts', 'description', this.config.selectedDescScript);
        try {
            delete require.cache[require.resolve(path_1.default.join(descriptionPath))];
            this.description = require(path_1.default.join(descriptionPath))(this.gameData);
        }
        catch (err) {
            throw new Error("description script error, your used description script file is not valid! error message:\n" + err);
        }
        const exampleMessagesPath = path_1.default.join(userDataPath, 'scripts', 'prompts', 'example messages', this.config.selectedExMsgScript);
        try {
            delete require.cache[require.resolve(path_1.default.join(exampleMessagesPath))];
            this.exampleMessages = require(path_1.default.join(exampleMessagesPath))(this.gameData);
        }
        catch (err) {
            throw new Error("example messages script error, your used example messages file is not valid! error message:\n" + err);
        }
        this.loadActions();
    }
    getApiConnections() {
        let textGenApiConnection, summarizationApiConnection, actionsApiConnection;
        summarizationApiConnection = textGenApiConnection = actionsApiConnection = new apiConnection_js_1.ApiConnection(this.config.textGenerationApiConnectionConfig.connection, this.config.textGenerationApiConnectionConfig.parameters);
        if (this.config.summarizationUseTextGenApi) {
            this.summarizationApiConnection = new apiConnection_js_1.ApiConnection(this.config.textGenerationApiConnectionConfig.connection, this.config.summarizationApiConnectionConfig.parameters);
            ;
        }
        if (this.config.actionsUseTextGenApi) {
            ;
            this.actionsApiConnection = new apiConnection_js_1.ApiConnection(this.config.textGenerationApiConnectionConfig.connection, this.config.actionsApiConnectionConfig.parameters);
            ;
        }
        return [textGenApiConnection, summarizationApiConnection, actionsApiConnection];
    }
    loadActions() {
        return __awaiter(this, void 0, void 0, function* () {
            this.actions = [];
            const actionsPath = path_1.default.join(userDataPath, 'scripts', 'actions');
            let standardActionFiles = fs_1.default.readdirSync(path_1.default.join(actionsPath, 'standard')).filter(file => path_1.default.extname(file) === ".js");
            let customActionFiles = fs_1.default.readdirSync(path_1.default.join(actionsPath, 'custom')).filter(file => path_1.default.extname(file) === ".js");
            for (const file of standardActionFiles) {
                if (this.config.disabledActions.includes(path_1.default.basename(file).split(".")[0])) {
                    continue;
                }
                delete require.cache[require(path_1.default.join(actionsPath, 'standard', file))];
                this.actions.push(require(path_1.default.join(actionsPath, 'standard', file)));
                console.log(`loaded standard action: ` + file);
            }
            for (const file of customActionFiles) {
                if (this.config.disabledActions.includes(path_1.default.basename(file).split(".")[0])) {
                    continue;
                }
                delete require.cache[require(path_1.default.join(actionsPath, 'custom', file))];
                this.actions.push(require(path_1.default.join(actionsPath, 'custom', file)));
                console.log(`loaded custom action: ` + file);
            }
        });
    }
}
exports.Conversation = Conversation;
//# sourceMappingURL=Conversation.js.map