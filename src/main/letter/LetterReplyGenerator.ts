import { BrowserWindow } from "electron";
import { ApiConnection } from "../../shared/apiConnection";
import { Tiktoken } from "js-tiktoken";
import { Character } from "../../shared/gameData/Character.js";
import { GameData, Trait } from "../../shared/gameData/GameData.js";
import { Config } from "../../shared/Config";
import { Message, Summary, Action } from "../ts/conversation_interfaces";
import * as fs from "fs";
import * as path from "path";
import { readSummaryFile, saveSummaryFile } from '../summaryManager.js';
import { createMemoryString } from '../conversation/promptBuilder.js';
import { LetterManager } from "./LetterManager.js";
import { Letter } from "./Letter.js";
import { Letter as ILetter, LetterType, LetterSummary, LetterAssociatedAction } from "./letterInterfaces.js";
import { randomUUID } from 'crypto';
import { getEffectivePrompts } from "../conversation/promptBuilder.js";
import { LetterActionTrigger } from "./LetterActionTrigger.js";
import { getEffectiveCharacterDescription } from "../characterDescription";

export class LetterReplyGenerator {
    private apiConnection: ApiConnection;
    private actionsApiConnection: ApiConnection;
    private config: Config;
    private votcDataPath: string;

    constructor(config: Config, votcDataPath: string, encoder: Tiktoken | null) {
        this.config = config;
        this.votcDataPath = votcDataPath;

        // Create API connection
        console.log('[LetterReplyGenerator] Creating ApiConnection...');
        this.apiConnection = new ApiConnection(
            config.textGenerationApiConnectionConfig.connection,
            config.textGenerationApiConnectionConfig.parameters,
            encoder
        );
        console.log('[LetterReplyGenerator] ApiConnection created.');

        this.actionsApiConnection = config.actionsUseTextGenApi
            ? new ApiConnection(config.textGenerationApiConnectionConfig.connection, config.actionsApiConnectionConfig.parameters, encoder)
            : new ApiConnection(config.actionsApiConnectionConfig.connection, config.actionsApiConnectionConfig.parameters, encoder);
        console.log('[LetterReplyGenerator] ActionsApiConnection created.');
    }


    /**
     * Builds the prompt for the letter reply
     * @param gameData Game data
     * @param letterContent Letter content
     * @returns The constructed prompt
     */
    private async buildLetterPrompt(gameData: GameData, latestLetter: ILetter): Promise<string> {
        // Ensure sender and recipient from the letter are in the gameData context
        if (!gameData.characters.has(latestLetter.sender.id)) {
            gameData.addCharacter(latestLetter.sender.id, latestLetter.sender);
        }
        if (!gameData.characters.has(latestLetter.recipient.id)) {
            gameData.addCharacter(latestLetter.recipient.id, latestLetter.recipient);
        }

        const player = gameData.characters.get(latestLetter.sender.id);
        const ai = gameData.characters.get(latestLetter.recipient.id);

        if (!player || !ai) {
            // This should now be much less likely to happen
            throw new Error('Player or AI character data not found in gameData');
        }

        // Use pListLetter.js to build character description
        const pListLetter = require("../../../default_userdata/scripts/prompts/description/standard/pListLetter.js");
        let characterDescription = pListLetter(gameData);

        // Inject the user-authored character description for the AI character writing the reply.
        const userCharacterDescription = getEffectiveCharacterDescription(this.votcDataPath, String(player.id), String(ai.id));
        if (userCharacterDescription) {
            characterDescription += `\n\nCharacter description for ${ai.fullName} (provided by the player):\n${userCharacterDescription}`;
        }

        // Read conversation summary
        let conversationSummary = '';
        try {
            // @ts-ignore
            const depth = this.config.summaries_insert_depth || 3;
            const summaries: Summary[] = await readSummaryFile(this.votcDataPath, String(player.id));
            const aiSummaries = summaries.filter(summary => summary.characterId === String(ai.id)).slice(0, depth);

            if (aiSummaries.length > 0) {
                // Read all summaries for this character, sorted by date (most recent first)
                const allSummaries = aiSummaries.map((summary, index) =>
                    `${index + 1}. ${summary.date}: ${summary.content}`
                ).join('\n');

                conversationSummary = `Summaries of previous conversations with ${player.fullName}:\n${allSummaries}\n\n`;
                console.log(`Loaded ${aiSummaries.length} conversation summaries for AI ID ${ai.id}`);
            } else {
                console.log(`No conversation summary found for AI ID ${ai.id}`);
            }
        } catch (error) {
            console.warn(`Failed to load conversation summary: ${error}`);
        }

        // Load letter summaries
        const letterManager = LetterManager.getInstance();
        // @ts-ignore
        const depth = this.config.summaries_insert_depth || 3;
        const letterSummaries = letterManager.getLetterSummaries(String(player.id), String(ai.id)).slice(0, depth);
        let letterSummaryContent = '';
        if (letterSummaries.length > 0) {
            const allSummaries = letterSummaries.map((summary, index) =>
                `${index + 1}. ${summary.date}: ${summary.summary}`
            ).join('\n');
            letterSummaryContent = `Summaries of previous letters with ${player.fullName}:\n${allSummaries}\n\n`;
            console.log(`Loaded ${letterSummaries.length} letter summaries for AI ID ${ai.id}`);
        } else {
            console.log(`No letter summaries found for AI ID ${ai.id}`);
        }

        // Read memory content
        let memoryContent = '';
        try {
            // Create a temporary conversation object to get memory content
            const tempConversation = {
                gameData: gameData,
                config: {
                    maxMemoryTokens: 1000
                },
                textGenApiConnection: this.apiConnection
            } as any;

            const prompts = { memoriesPrompt: getEffectivePrompts(this.config, this.votcDataPath, gameData).memoriesPrompt };
            const memoryString = createMemoryString(tempConversation, prompts, ai);
            if (memoryString && memoryString.trim() !== '') {
                memoryContent = `${memoryString}\n\n`;
                console.log(`Loaded memory content for letter prompt: ${memoryString.substring(0, 100)}...`);
            } else {
                console.log(`No memory content found for letter prompt`);
            }
        } catch (error) {
            console.warn(`Failed to load memory content: ${error}`);
        }

        const effectivePrompts = getEffectivePrompts(this.config, this.votcDataPath, gameData);
        let prompt = effectivePrompts.letterPrompt;

        prompt = prompt.replace('{{aiName}}', ai?.fullName || '')
                       .replace('{{characterDescription}}', characterDescription || '')
                       .replace('{{conversationSummary}}', conversationSummary || '')
                       .replace('{{letterSummaryContent}}', letterSummaryContent || '')
                       .replace('{{memoryContent}}', memoryContent || '')
                       .replace('{{playerName}}', player?.fullName || '')
                       .replace('{{letterContent}}', latestLetter?.content || '')
                       .replace(/{{language}}/g, this.config.language || 'en');

        return prompt;
    }

    /**
     * Generate letter actions via the action LLM, similar to conversation action detection.
     * @param gameData Game data
     * @param latestLetter The original letter received
     * @param replyContent The AI's reply content
     * @returns Object with playerActions (triggered by the letter sender) and aiActions (triggered by the reply author)
     */
    private async generateLetterActions(gameData: GameData, latestLetter: ILetter, replyContent: string): Promise<{ playerActions: LetterAssociatedAction[], aiActions: LetterAssociatedAction[] }> {
        console.log('[LetterReplyGenerator] Starting letter action generation via LLM.');

        // Load available actions (only distance-capable ones for letters)
        const actionsPath = path.join(this.votcDataPath, 'scripts', 'actions');
        const availableActions: Action[] = [];

        const loadDir = (dir: string) => {
            const dirPath = path.join(actionsPath, dir);
            if (!fs.existsSync(dirPath)) return;
            const files = fs.readdirSync(dirPath).filter(f => path.extname(f) === '.js');
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                delete require.cache[require.resolve(filePath)];
                const actionModule = require(filePath);
                if (!actionModule || !actionModule.signature || !actionModule.run) continue;
                if (actionModule.canPerformAtDistance === false) continue; // Only distance-capable actions
                availableActions.push(actionModule);
            }
        };
        loadDir('standard');
        loadDir('custom');

        if (availableActions.length === 0) {
            console.log('[LetterReplyGenerator] No distance-capable actions available for letter.');
            return { playerActions: [], aiActions: [] };
        }

        const player = gameData.characters.get(latestLetter.sender.id);
        const ai = gameData.characters.get(latestLetter.recipient.id);
        if (!player || !ai) {
            console.warn('[LetterReplyGenerator] Could not find player or AI character for letter action generation.');
            return { playerActions: [], aiActions: [] };
        }

        let characterList = "Characters in conversation:";
        for (const char of gameData.characters.values()) {
            characterList += `\n- ${char.fullName} (ID: ${char.id})`;
        }

        let listOfActions = "List of actions:";
        for (const action of availableActions) {
            let argNames: string[] = [];
            action.args.forEach((arg: any) => argNames.push(arg.name));
            // Show the full signature including sourceId/targetId so the LLM knows the
            // exact argument order. Omitting them caused the LLM to guess the order and
            // emit malformed actions (e.g. addTrait(wrathful, 49643, ...)).
            let signature = action.signature + '(sourceId, targetId' + (argNames.length > 0 ? ', ' + argNames.join(', ') : '') + ')';
            let argString = action.args.length > 0 ? `Takes ${action.args.length} arguments: ` : "Takes no arguments.";
            for (const arg of action.args) {
                let argDesc = arg.desc;
                if (typeof argDesc === 'object') {
                    argDesc = argDesc[this.config.language] || argDesc['en'] || Object.values(argDesc)[0];
                }
                argString += `${arg.name} (${arg.type}): ${argDesc}. `;
                if ((arg as any).options && Array.isArray((arg as any).options)) {
                    const optionValues = (arg as any).options.map((opt: any) => typeof opt === 'object' ? opt.value : opt).join(', ');
                    argString += `Possible values: [${optionValues}]. `;
                }
            }
            let description = action.description;
            if (typeof description === 'object') {
                description = description[this.config.language] || description['en'] || Object.values(description)[0];
            }
            listOfActions += `\n- ${signature}: ${description} ${argString}`;
        }
        listOfActions += `\n- noop(): Execute when none of the previous actions are a good fit for the given replies.`;
        listOfActions += `\nExplain why and which actions you would trigger (rationale), then write the most appropriate actions (actions). For each action, you MUST identify the source and the target by their ID from the character list. If you think multiple actions should be triggered, then separate them with commas (,) inside the <actions> tags.`;
        listOfActions += `\nResponse format: <rationale>Reasoning.</rationale><actions>actionName1(sourceId, targetId, arg1, arg2), actionName2(sourceId, targetId)</actions>`;
        listOfActions += `\nCRITICAL: The first two arguments of every action MUST be the source character ID and the target character ID, in that exact order. The action's own arguments (if any) come AFTER the source and target IDs. Never place an action's arguments before the IDs. Only use actions whose argument count matches the signature shown above.`;

        const prompts = getEffectivePrompts(this.config, this.votcDataPath, gameData);
        const actionPrompt = prompts.actionPrompt;

        const userContent = `Based on the following letter and reply, choose the most relevant actions. Actions can be triggered by EITHER character: the letter sender (${player.fullName}) based on what they wrote in their letter, or the reply author (${ai.fullName}) based on what they wrote in their reply.\n${characterList}\n"Letter from ${player.fullName}:\n${latestLetter.content}\n\nReply from ${ai.fullName}:\n${replyContent}\n${listOfActions}`;

        const messages: Message[] = [
            { role: "system", content: actionPrompt },
            { role: "user", content: userContent }
        ];

        let response: string;
        if (this.actionsApiConnection.isChat()) {
            const result = await this.actionsApiConnection.complete(messages, false, {});
            response = typeof result === 'string' ? result : (result?.content ?? '');
        } else {
            const textPrompt = messages.map(m => m.content).join('\n');
            const result = await this.actionsApiConnection.complete(textPrompt, false, { stop: [this.config.inputSequence, this.config.outputSequence] });
            response = typeof result === 'string' ? result : (result?.content ?? '');
        }
        response = response.replace(/(\r\n|\n|\r)/gm, "");

        if (!response.match(/<rationale>(.*?)<\/?rationale>/) || !response.match(/<actions>(.*?)<\/?actions>/)) {
            console.warn("Letter action warning: rationale or action couldn't be extracted from LLM response. Response: " + response);
            return { playerActions: [], aiActions: [] };
        }

        const actionsString = response.match(/<actions>(.*?)<\/actions>/)![1];
        if (actionsString.trim().toLowerCase().startsWith("noop")) {
            console.log('[LetterReplyGenerator] LLM returned "noop()", no letter actions triggered.');
            return { playerActions: [], aiActions: [] };
        }

        const actions = actionsString.split(/\s*,\s*(?=[a-zA-Z_][a-zA-Z0-9_]*\()/).filter(a => !a.trim().toLowerCase().startsWith('noop'));

        const playerActions: LetterAssociatedAction[] = [];
        const aiActions: LetterAssociatedAction[] = [];
        for (const actionInResponse of actions) {
            const foundActionName = actionInResponse.match(/([a-zA-Z_{1}][a-zA-Z0-9_]+)(?=\()/g);
            if (!foundActionName) {
                console.warn(`Letter action warning: Could not extract action name from "${actionInResponse}". Skipping.`);
                continue;
            }
            const matchedAction = availableActions.find(a => a.signature.toLowerCase() == foundActionName[0].toLowerCase());
            if (!matchedAction) {
                console.warn(`Letter action warning: The returned action "${foundActionName[0]}" from LLM matched none of the listed available actions. Skipping.`);
                continue;
            }
            const argsString = /\(([^)]+)\)/.exec(actionInResponse);
            const allArgs = argsString ? argsString[1].split(",").map(arg => arg.trim()) : [];
            if (allArgs.length < 2) {
                console.warn(`Letter action warning: Action "${actionInResponse}" did not include sourceId and targetId. Skipping.`);
                continue;
            }
            const newSourceId = parseInt(allArgs[0], 10);
            const newTargetId = parseInt(allArgs[1], 10);
            const actionArgs = allArgs.slice(2);
            if (isNaN(newSourceId) || isNaN(newTargetId)) {
                console.warn(`Letter action warning: Invalid sourceId or targetId in "${actionInResponse}". Skipping.`);
                continue;
            }
            if (actionArgs.length > matchedAction.args.length) {
                console.warn(`Letter action warning: The matched action "${matchedAction.signature}" received too many arguments (${actionArgs.length}) from the LLM response, expected no more than ${matchedAction.args.length}. Skipping.`);
                continue;
            }
            let isValidAction = true;
            for (let i = 0; i < actionArgs.length; i++) {
                if (matchedAction.args[i].type === "number" && isNaN(Number(actionArgs[i]))) {
                    console.warn(`Letter action warning: Argument "${actionArgs[i]}" for action "${matchedAction.signature}" was not a valid number. Skipping.`);
                    isValidAction = false;
                    break;
                }
            }
            if (!isValidAction) continue;

            // Split actions by who triggered them: the player (letter sender) or the AI (reply author).
            // Player actions belong to the sent letter ('send'), AI actions to the reply ('receive').
            if (newSourceId === player.id) {
                playerActions.push({
                    signature: matchedAction.signature,
                    args: actionArgs.map(a => { const n = Number(a); return isNaN(n) ? a : n; }),
                    triggerOn: 'send'
                });
            } else {
                aiActions.push({
                    signature: matchedAction.signature,
                    args: actionArgs.map(a => { const n = Number(a); return isNaN(n) ? a : n; }),
                    triggerOn: 'receive'
                });
            }
        }

        console.log(`[LetterReplyGenerator] Final letter triggered actions: player=[${playerActions.map(a => a.signature).join(', ')}], ai=[${aiActions.map(a => a.signature).join(', ')}]`);
        return { playerActions, aiActions };
    }

    /**
     * Escapes quotes in the model's reply, replacing standard quotes with Chinese quotes for 'zh' language.
     * @param text The original text
     * @param language The language of the reply
     * @returns The escaped text
     */
    private escapeQuotes(text: string, language: string): string {
        if (language === 'zh') {
            return text.replace(/"/g, '“').replace(/'/g, '’');
        }
        return text;
    }

    /**
     * Generates a letter reply and writes it to a file.
     * @param gameData Game data
     * @param debugLogPath Path to debug.log file
     * @param userFolderPath User folder path
     * @returns The generated reply content, or null on failure
     */
    public async generateLetterReply(gameData: GameData, latestLetter: ILetter): Promise<ILetter | null> {
        try {
            console.log('[LetterReplyGenerator] Starting letter reply generation.');
            // Build prompt
            const promptText = await this.buildLetterPrompt(gameData, latestLetter);
            console.log(`[LetterReplyGenerator] Generated letter prompt: ${promptText.substring(0, 200)}...`);

            // Convert prompt to Message array format
            const messages: Message[] = [
                {
                    role: "user",
                    content: promptText
                }
            ];

            // Call LLM to generate reply
            console.log('[LetterReplyGenerator] Calling LLM to generate reply...');
            const apiResult = await this.apiConnection.complete(messages, false, {
                max_tokens: this.config.maxTokens,
                temperature: this.config.textGenerationApiConnectionConfig.parameters.temperature
            });
            console.log('[LetterReplyGenerator] LLM call complete.');

            const response = typeof apiResult === 'string' ? apiResult : (apiResult?.content ?? '');
            if (!response || response.trim() === '') {
                console.warn('[LetterReplyGenerator] Empty response from LLM for letter reply');
                return null;
            }

            // Escape quotes in the reply
            const escapedResponse = this.escapeQuotes(response.trim(), this.config.language);

            console.log(`[LetterReplyGenerator] Generated letter reply: ${escapedResponse.substring(0, 100)}...`);

            // Create a UUID for the reply letter *before* saving history and summary
            const replyLetterId = randomUUID();

            // Generate letter actions via LLM (like conversations)
            console.log('[LetterReplyGenerator] Generating letter actions via LLM...');
            const { playerActions, aiActions } = await this.generateLetterActions(gameData, latestLetter, escapedResponse);
            console.log(`[LetterReplyGenerator] Generated ${playerActions.length} player actions and ${aiActions.length} AI letter actions.`);

            // Attach player-triggered actions to the original (sent) letter so they appear on
            // the player's letter in the letters tab, and persist them to disk.
            if (playerActions.length > 0) {
                latestLetter.triggeredActions = playerActions;
                LetterManager.getInstance().updateLetterActions(String(latestLetter.sender.id), String(latestLetter.recipient.id), latestLetter.id, playerActions);
            }

            // Save letter history immediately
            console.log('[LetterReplyGenerator] Saving letter history...');
            const replyLetter = await this.saveLetterHistory(String(latestLetter.sender.id), String(latestLetter.recipient.id), latestLetter, escapedResponse, gameData, replyLetterId, aiActions);
            console.log('[LetterReplyGenerator] Letter history saved.');

            // Generate and save a summary of the letter asynchronously, AFTER the actions have
            // been generated, so the summary can include the triggered actions. The summary is
            // not needed for the reply to be displayed or for actions to run, so we fire-and-forget
            // it to avoid delaying the letter delivery.
            console.log('[LetterReplyGenerator] Generating and saving letter summary (async)...');
            this.generateAndSaveLetterSummary(gameData, latestLetter, escapedResponse, replyLetterId, [...playerActions, ...aiActions]).catch(err => {
                console.error('[LetterReplyGenerator] Background letter summary generation failed:', err);
            });

            // Execute actions automatically if manual approval is disabled.
            // Player actions run against the sent letter; AI actions against the reply.
            if (!this.config.manualLetterActionApproval) {
                for (const action of playerActions) {
                    LetterActionTrigger.executeLetterAction(latestLetter, action, this.config);
                }
                if (replyLetter) {
                    for (const action of replyLetter.triggeredActions) {
                        LetterActionTrigger.executeLetterAction(replyLetter, action, this.config);
                    }
                }
            }

            // Update original letter status back to 'sent' since reply is now pending
            const letterManager = LetterManager.getInstance();
            letterManager.updateLetterStatus(String(latestLetter.sender.id), String(latestLetter.recipient.id), latestLetter.id, 'sent');

            // Return the generated reply so it can be queued for delayed delivery
            if (replyLetter) {
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('letter-status-changed');
                });
            }
            return replyLetter;
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(`[LetterReplyGenerator] Error generating letter reply: ${error.message}`);
                console.error(error.stack);
            } else {
                console.error('[LetterReplyGenerator] An unknown error occurred during letter reply generation:', error);
            }
            return null;
        }
    }

    /**
     * Saves the letter exchange to a local file.
     * @param playerId Player ID
     * @param aiId Character ID
     * @param letterContent Player's letter content
     * @param replyContent AI's reply content
     * @param userFolderPath User folder path
     * @param gameData Game data (for character names)
     */
    private async saveLetterHistory(playerId: string, aiId: string, latestLetter: ILetter, replyContent: string, gameData: GameData, replyLetterId: string, triggeredActions: LetterAssociatedAction[]): Promise<ILetter | null> {
        try {
            const letterManager = LetterManager.getInstance();

            const player = gameData.characters.get(Number(playerId));
            const ai = gameData.characters.get(Number(aiId));

            if (!player || !ai) {
                console.error("Could not find player or AI character to save letter history.");
                return null;
            }

            // AI writes the reply after stage 2 of the journey.
            const stage2EndDays = Math.floor(latestLetter.delay * 5 / 9);
            const replyWrittenDay = latestLetter.totalDays + stage2EndDays;

            const replyTimestamp = new Date(latestLetter.timestamp);
            replyTimestamp.setUTCDate(replyTimestamp.getUTCDate() + stage2EndDays);

            // The player is expected to receive the reply after the full delay.
            const expectedPlayerDeliveryDate = new Date(latestLetter.timestamp);
            expectedPlayerDeliveryDate.setUTCDate(expectedPlayerDeliveryDate.getUTCDate() + latestLetter.delay);

            const replyLetter = new Letter(
                replyLetterId,
                ai, // sender is the AI
                player, // recipient is the player
                `Re: ${latestLetter.subject}`,
                replyContent,
                LetterType.PERSONAL,
                replyTimestamp, // Use the calculated reply date
                false, // It's a new letter, so not read by the player yet
                latestLetter.delay,
                replyWrittenDay, // The "day number" when the reply was written
                latestLetter.id,
                'pending',
                false,
                undefined, // creationTimestamp
                undefined, // deliveryTimestamp (set on VOTC:LETTER_ACCEPTED)
                expectedPlayerDeliveryDate // When the player should receive it
            );
            replyLetter.triggeredActions = triggeredActions;

            // Atomically update the history file
            const otherCharacterId = aiId; // The file is named after the non-player character
            const filePath = letterManager.getLetterFilePath(playerId, otherCharacterId);

            let history: ILetter[] = [];
            if (fs.existsSync(filePath)) {
                history = letterManager.getLetters(playerId, otherCharacterId);
            }

            // Add original letter if not present (using a more robust duplicate check)
            const isOriginalDuplicate = history.some(l =>
                l.subject === latestLetter.subject &&
                l.totalDays === latestLetter.totalDays &&
                l.sender.id === latestLetter.sender.id &&
                l.recipient.id === latestLetter.recipient.id
            );
            if (!isOriginalDuplicate) {
                history.push(latestLetter);
            }

            // Add reply letter if not present (UUID check is fine here as it's brand new)
            if (!history.some(l => l.id === replyLetter.id)) {
                history.push(replyLetter);
            }

            history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');

            console.log(`Saved original letter and AI reply to letter history for player ${playerId} and character ${aiId}`);

            return replyLetter;
        } catch (error) {
            console.error(`Error saving letter history: ${error}`);
            return null;
        }
    }

    /**
     * Generates a summary of the letter exchange and saves it to the summary file.
     * @param gameData Game data
     * @param letterContent Player's letter content
     * @param replyContent AI's reply content
     */
    private async generateAndSaveLetterSummary(gameData: GameData, originalLetter: ILetter, replyContent: string, replyLetterId: string, triggeredActions: LetterAssociatedAction[] = []): Promise<void> {
        try {
            const player = gameData.characters.get(originalLetter.sender.id);
            const ai = gameData.characters.get(originalLetter.recipient.id);

            if (!player || !ai) {
                console.error('Player or AI character data not found for summary generation');
                return;
            }

            // Build summary generation prompt
            const effectivePrompts = getEffectivePrompts(this.config, this.votcDataPath, gameData);
            let summaryPrompt = effectivePrompts.letterSummaryPrompt;

            summaryPrompt = summaryPrompt.replace('{{playerName}}', player.fullName)
                                         .replace('{{playerLetterContent}}', originalLetter.content)
                                         .replace('{{aiName}}', ai.fullName)
                                         .replace('{{aiReplyContent}}', replyContent);

            // Include the triggered actions in the summary so the summary captures this important context.
            if (triggeredActions && triggeredActions.length > 0) {
                const actionsText = triggeredActions.map(a => a.signature).join(', ');
                summaryPrompt += `\n\nActions triggered in this exchange: ${actionsText}`;
            }

            // Use LLM to generate summary
            const summaryMessages: Message[] = [
                {
                    role: "user",
                    content: summaryPrompt
                }
            ];

            const summaryResult = await this.apiConnection.complete(summaryMessages, false, {
                max_tokens: 150,
                temperature: 0.3 // Use a lower temperature for more stable summaries
            });

            const summaryContent = typeof summaryResult === 'string' ? summaryResult : (summaryResult?.content ?? '');
        if (!summaryContent || (summaryContent as any)?.trim?.() === '') {
                console.warn('Empty summary content generated');
                return;
            }

            console.log(`Generated letter summary: ${(summaryContent as any)?.trim() ?? ''}`);

            const letterDate = gameData.date;
            const playerId = String(originalLetter.sender.id);
            const aiId = String(originalLetter.recipient.id);

            const newSummary: LetterSummary = {
                id: randomUUID(),
                date: letterDate,
        summary: (summaryContent as any)?.trim?.() ?? '',
                letterIds: [originalLetter.id, replyLetterId]
            };

            const letterManager = LetterManager.getInstance();
            const existingSummaries = letterManager.getLetterSummaries(playerId, aiId);

            // Add new summary to the beginning of the list
            existingSummaries.unshift(newSummary);

            letterManager.saveLetterSummaries(playerId, aiId, existingSummaries);
            console.log(`Letter summary saved for AI ID ${aiId}`);

        } catch (error) {
            console.error(`Error generating and saving letter summary: ${error}`);
        }
    }

    // This function is now handled by the delivery mechanism in main.ts to support delays.
}
