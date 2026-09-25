import { app, BrowserWindow } from "electron";
import { ApiConnection } from "../../shared/apiConnection";
import { Tiktoken } from "js-tiktoken";
import { Character } from "../../shared/gameData/Character.js";
import { GameData, Trait } from "../../shared/gameData/GameData.js";
import { Config } from "../../shared/Config";
import { Message, Summary } from "../ts/conversation_interfaces";
import * as fs from "fs";
import * as path from "path";
import { readSummaryFile, saveSummaryFile } from '../summaryManager.js';
import { createMemoryString } from '../conversation/promptBuilder.js';
import { LetterManager } from "./LetterManager.js";
import { Letter } from "./Letter.js";
import { Letter as ILetter, LetterType, LetterSummary } from "./letterInterfaces.js";
import { evaluateReplyDeliveryGate } from "./letterDeliveryGate.js";
import { scanDeliverySnapshotEvidence } from "../campaignLoadObserver.js";
import { randomUUID, createHash } from 'crypto';
import { getEffectivePrompts } from "../conversation/promptBuilder.js";
import {
    TimelineRegistryCorruptError,
    TimelineParentNotFoundError,
    type CreateChildNodeResult,
    type GameDataLike
} from '../timelineManager.js';
import { UnsupportedTimelineSchemaError } from '../../shared/gameData/timelineProtocol.js';
import { requireCampaignIdentity, CampaignIdentityUnavailableError } from '../campaignIdentityResolver.js';
import { parseLog } from '../../shared/gameData/parseLog.js';
import { reportCampaignIdentityUnavailable, reportCorruptTimelineRegistry, reportTimelineParentNotFound, reportUnsupportedTimelineSchema } from '../timelineRegistryRecovery.js';
import { runLetterReplyTimelineTransition } from '../timelineBusinessWire.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';

function indentCk3Block(block: string, indent: string): string {
    return block
        .split(/\r?\n/)
        .map(line => line ? `${indent}${line}` : line)
        .join('\n');
}

function writeRunFileAtomically(filePath: string, content: string): void {
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, content, 'utf8');
        fs.renameSync(temporaryPath, filePath);
    } finally {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
}

/**
 * Build the guarded CK3 console script that applies a letter reply's timeline
 * node and clears the letter thread (ported from 1.x). The timeline script is
 * supplied only after the transition journal has created/reused its node.
 *
 * Unlike 1.x there is deliberately NO votc_letter_N_delivery_id guard here:
 * mod2 ce does not emit per-delivery ids, so the only mod-verifiable guard is
 * the thread marker itself.
 */
function buildLetterReplyRunFile(
    letterNumber: string,
    deliveryId: number,
    descriptionExpression: string,
    timeline?: Pick<CreateChildNodeResult, 'script'>
): string {
    const timelineScript = timeline?.script
        ? `${indentCk3Block(timeline.script, '\t')}\n`
        : '';

    // The first line doubles as the app's date heartbeat: the mod-side
    // letters_runner executes run/letters.txt every ~2s and the app reads
    // the current game date from the VOTC:DATE line this debug_log emits
    // (talk_event.9999.desc localizes to VOTC:DATE/<totalDays>). Every
    // payload written into letters.txt must keep it as line 1.
    return `debug_log = "[Localize('talk_event.9999.desc')]"
if = {
\tlimit = {
\t\texists = global_var:votc_letter_${letterNumber}
\t}
${timelineScript}\tsend_interface_message = {
\t\ttype = votc_message_popup
\t\ttitle = votc_huixin_title${letterNumber}
\t\tdesc = ${descriptionExpression}
\t\tleft_icon = global_var:message_second_scope_letter_${letterNumber}
\t}
\tremove_global_variable ?= votc_letter_${letterNumber}
\tdebug_log = "VOTC:FALLBACK/;/applied/;/letter_${letterNumber}/;/${deliveryId}"
}
else = {
\tdebug_log = "VOTC:FALLBACK/;/skipped/;/letter_${letterNumber}/;/${deliveryId}"
}
`;
}

/**
 * Receipt markers: the block logs VOTC:FALLBACK/;/applied or /skipped on
 * execution; the desktop app tails both and clears run/letters.txt so the
 * mod-side letters_runner stops re-executing it every poll. The prefix
 * avoids the VOTC:LETTER substring on purpose - the import scanner in
 * parseLogForLetters treats any VOTC:LETTER line as an incoming letter.
 *
 * Drain one exact CK3 letter thread when the desktop app cannot produce a
 * reply (ported from 1.x). A timeline script is supplied only after the
 * transition journal has created/reused its node; writing this file before
 * any LLM work guarantees that exhausted retries still clear the stuck
 * thread and apply the journal-created timeline node.
 */
export function writeLetterReplyFallbackRunFile(
    userFolderPath: string,
    slotId: string,
    deliveryId: number,
    timeline?: Pick<CreateChildNodeResult, 'script'>
): boolean {
    const letterNumber = slotId.match(/^letter_([1-9])$/)?.[1];
    if (!letterNumber || !Number.isSafeInteger(deliveryId) || deliveryId < 0) return false;

    const runFolderPath = path.join(userFolderPath, 'run');
    fs.mkdirSync(runFolderPath, { recursive: true });
    const filePath = path.join(runFolderPath, `letter${letterNumber}.txt`);
    writeRunFileAtomically(
        filePath,
        buildLetterReplyRunFile(letterNumber, deliveryId, 'votc_letter_reply_fallback_desc', timeline)
    );
    console.warn(`[LetterReply] Fallback run file written for ${slotId}/${deliveryId}${timeline ? ' with timeline transition.' : ' without timeline transition.'}`);
    return true;
}

export class LetterReplyGenerator {
    private apiConnection: ApiConnection;
    private config: Config;
    private userDataPath: string;

    constructor(config: Config, userDataPath: string, encoder: Tiktoken | null) {
        this.config = config;
        this.userDataPath = userDataPath;
        
        // Create API connection
        console.log('[LetterReplyGenerator] Creating ApiConnection...');
        this.apiConnection = new ApiConnection(
            config.textGenerationApiConnectionConfig.connection,
            config.textGenerationApiConnectionConfig.parameters,
            encoder
        );
        console.log('[LetterReplyGenerator] ApiConnection created.');
    }


    /**
     * Builds the prompt for the letter reply
     * @param gameData Game data
     * @param letterContent Letter content
     * @returns The constructed prompt
     */
    private async buildLetterPrompt(gameData: GameData, letter: ILetter): Promise<string> {
        // Ensure sender and recipient from the letter are in the gameData context
        if (!gameData.characters.has(letter.sender.id)) {
            gameData.addCharacter(letter.sender.id, letter.sender);
        }
        if (!gameData.characters.has(letter.recipient.id)) {
            gameData.addCharacter(letter.recipient.id, letter.recipient);
        }

        const player = gameData.characters.get(letter.sender.id);
        const ai = gameData.characters.get(letter.recipient.id);

        if (!player || !ai) {
            // This should now be much less likely to happen
            throw new Error('Player or AI character data not found in gameData');
        }

        // Use pListLetter.js to build character description
        const pListLetter = require("../../../default_userdata/scripts/prompts/description/standard/pListLetter.js");
        const characterDescription = pListLetter(gameData);

        // Read conversation summary
        let conversationSummary = '';
        try {
            // @ts-ignore
            const depth = this.config.summaries_insert_depth || 3;
            const summaries: Summary[] = await readSummaryFile(this.userDataPath, String(player.id));
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
            
            const prompts = { memoriesPrompt: getEffectivePrompts(this.config, this.userDataPath, gameData).memoriesPrompt };
            const memoryString = createMemoryString(tempConversation, prompts);
            if (memoryString && memoryString.trim() !== '') {
                memoryContent = `${memoryString}\n\n`;
                console.log(`Loaded memory content for letter prompt: ${memoryString.substring(0, 100)}...`);
            } else {
                console.log(`No memory content found for letter prompt`);
            }
        } catch (error) {
            console.warn(`Failed to load memory content: ${error}`);
        }

        const effectivePrompts = getEffectivePrompts(this.config, this.userDataPath, gameData);
        let prompt = effectivePrompts.letterPrompt;

        prompt = prompt.replace('{{aiName}}', ai?.fullName || '')
                       .replace('{{characterDescription}}', characterDescription || '')
                       .replace('{{conversationSummary}}', conversationSummary || '')
                       .replace('{{letterSummaryContent}}', letterSummaryContent || '')
                       .replace('{{memoryContent}}', memoryContent || '')
                       .replace('{{playerName}}', player?.fullName || '')
                       .replace('{{letterContent}}', letter?.content || '')
                       .replace(/{{language}}/g, this.config.language || 'en');

        return prompt;
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
    public async generateLetterReply(gameData: GameData, letter: ILetter): Promise<ILetter | null> {
        // Function scope: the failure paths below the try still need them to
        // hand the fallback run block to the CK3 letters channel.
        let timeline: CreateChildNodeResult | undefined;
        let snapshot: { slotId: string; deliveryId: number } | undefined;
        let timelineInfo: { script: string; epoch: number; nodeId: string; campaignId: string; playerId: string } | undefined;
        // Function scope too: the fallback delivery gate needs the identity the
        // timeline transition ran under, even when the catch below cannot see
        // the transition block's locals.
        let transitionIdentity: CampaignPlayerIdentity | undefined;
        try {
            console.log('[LetterReplyGenerator] Starting letter reply generation.');

            // ── Timeline transition chain (ported from 1.x) ─────────────────
            // mod2 ce letters are identified by their thread subject
            // ('letter_1'..'letter_9'); letters outside that scheme follow the
            // legacy path without a timeline branch.
            const slotId = /^letter_[1-9]$/.test(letter.subject) ? letter.subject : null;


            if (slotId) {
                // mod2 ce emits no per-delivery id; the sending game day is the
                // only stable occurrence discriminator available app-side. It
                // threads through the request key/journal identity only.
                const deliveryId = Number.isSafeInteger(letter.totalDays) && letter.totalDays >= 0 ? letter.totalDays : 0;
                snapshot = { slotId, deliveryId };

                const userFolderPath = this.userDataPath;

                let identity: CampaignPlayerIdentity;
                try {
                    identity = requireCampaignIdentity({
                        playerID: gameData.playerID,
                        timelineSnapshotResult: gameData.timelineSnapshotResult
                    });
                } catch (error) {
                    if (error instanceof CampaignIdentityUnavailableError) {
                        reportCampaignIdentityUnavailable(error);
                        return null;
                    }
                    throw error;
                }
                transitionIdentity = identity;

                // The mod bumps the checkpoint after the init line, so the child
                // node becomes the new save node at epoch+1 (same as 1.x and the
                // 2CE conversation close flow).
                const nextCheckpointEpoch = gameData.votcCheckpointEpoch + 1;

                // Include the immutable letter occurrence in the signature so a
                // different letter after a save rollback cannot reuse the old
                // branch's journal attempt. Content is hashed, never persisted.
                const contentFingerprint = createHash('sha256')
                    .update(letter.content, 'utf8')
                    .digest('hex')
                    .slice(0, 16);
                const eventSignature = [
                    'letter',
                    snapshot.slotId,
                    snapshot.deliveryId,
                    gameData.playerID,
                    gameData.aiID,
                    gameData.date,
                    contentFingerprint
                ].join(':');

                try {
                    const transition = await runLetterReplyTimelineTransition({
                        // campaignDataPaths appends votc_data itself; pass the
                        // electron userData root so letters share the campaign
                        // registry with conversations.
                        userDataDir: app.getPath('userData'),
                        gameData: gameData as any as GameDataLike,
                        identity,
                        slotId: snapshot.slotId,
                        letterDeliveryId: snapshot.deliveryId,
                        eventSignature,
                        targetEpoch: nextCheckpointEpoch,
                        // message_first_scope is the persisted player scope for
                        // this letter thread (set by mod2 ce message_events);
                        // talk_first_scope belongs to conversations.
                        scopeVar: 'global_var:message_first_scope'
                    });
                    timeline = {
                        nodeId: transition.targetNodeId,
                        parentId: transition.context.timelineParentId ?? null,
                        script: transition.script,
                        context: transition.context,
                        createdNewRoot: false
                    };
                    timelineInfo = {
                        script: transition.script,
                        epoch: nextCheckpointEpoch,
                        nodeId: transition.targetNodeId,
                        campaignId: identity.campaignId,
                        playerId: identity.playerId
                    };
                    console.log(`Timeline node created for letter reply: ${timeline.nodeId} (parent: ${timeline.parentId ?? 'null'}, attempt: ${transition.attemptId}, reused: ${transition.reused})`);
                } catch (error) {
                    if (error instanceof CampaignIdentityUnavailableError) {
                        reportCampaignIdentityUnavailable(error);
                        return null;
                    }
                    if (error instanceof TimelineRegistryCorruptError) {
                        reportCorruptTimelineRegistry(error);
                        return null;
                    }
                    if (error instanceof TimelineParentNotFoundError) {
                        reportTimelineParentNotFound(error);
                        return null;
                    }
                    if (error instanceof UnsupportedTimelineSchemaError) {
                        reportUnsupportedTimelineSchema(error.schema);
                        return null;
                    }
                    throw error;
                }

                // Safe, thread-guarded handoff before any prompt or LLM work:
                // if generation exhausts retries, CK3 can still clear this
                // exact thread and apply the journal-created timeline node.
                writeLetterReplyFallbackRunFile(userFolderPath, snapshot.slotId, snapshot.deliveryId, timeline);
            }

            // Build prompt
            const promptText = await this.buildLetterPrompt(gameData, letter);
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
                await this.deliverFallbackRunBlockToGame(snapshot, timeline, transitionIdentity, gameData);
                return null;
            }

            // Escape quotes in the reply
            const escapedResponse = this.escapeQuotes(response.trim(), this.config.language);
            
            console.log(`[LetterReplyGenerator] Generated letter reply: ${escapedResponse.substring(0, 100)}...`);
            
            // Create a UUID for the reply letter *before* saving history and summary
            const replyLetterId = randomUUID();

            // Generate and save a summary of the letter
            console.log('[LetterReplyGenerator] Generating and saving letter summary...');
            await this.generateAndSaveLetterSummary(gameData, letter, escapedResponse, replyLetterId);
            console.log('[LetterReplyGenerator] Letter summary saved.');

            // Save letter history immediately
            console.log('[LetterReplyGenerator] Saving letter history...');
            const replyLetter = await this.saveLetterHistory(String(letter.sender.id), String(letter.recipient.id), letter, escapedResponse, gameData, replyLetterId, timelineInfo);
            if (!replyLetter) {
                // Persisting failed: the LLM reply is lost and the letter
                // thread would dangle in the save. Deliver the fallback so
                // the game-side thread is cleaned up anyway.
                console.warn('[LetterReplyGenerator] Letter history could not be saved; delivering the fallback thread cleanup.');
                await this.deliverFallbackRunBlockToGame(snapshot, timeline, transitionIdentity, gameData);
                return null;
            }
            console.log('[LetterReplyGenerator] Letter history saved.');

            // Re-assert the timeline payload on the returned object: it rides
            // into the pending-delivery queue, and this also covers callers
            // that stub saveLetterHistory in tests.
            if (replyLetter && timelineInfo) {
                replyLetter.timelineScript = timelineInfo.script;
                replyLetter.timelineEpoch = timelineInfo.epoch;
                replyLetter.timelineNodeId = timelineInfo.nodeId;
                replyLetter.timelineCampaignId = timelineInfo.campaignId;
                replyLetter.timelinePlayerId = timelineInfo.playerId;
            }
            
            // Update original letter status back to 'sent' since reply is now pending
            const letterManager = LetterManager.getInstance();
            letterManager.updateLetterStatus(String(letter.sender.id), String(letter.recipient.id), letter.id, 'sent');

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
            await this.deliverFallbackRunBlockToGame(snapshot, timeline, transitionIdentity, gameData);
            return null;
        }
    }

    /**
     * On generation failure the letter thread would dangle in the save: the
     * mod-side letters_runner only executes `run/letters.txt` in the CK3 user
     * folder, so the fallback block (thread cleanup + journal-created node)
     * must be delivered through that channel as well. The app-data
     * `votc_data/run/letterN.txt` copy stays as a diagnostic handoff.
     *
     * The fallback block clears `votc_letter_N` — a global variable that is
     * shared across campaigns — and carries the reply branch's checkpoint
     * script, so it must pass the same delivery gate as a normal reply:
     * when generation outlives a campaign/player switch, writing it into the
     * newly loaded game's letters.txt would clear THAT game's letter slot
     * and re-point ITS timeline. When the current context cannot be verified
     * at all, fail closed: the thread stays dangling in its own campaign
     * instead of corrupting another one.
     */
    private async deliverFallbackRunBlockToGame(
        snapshot: { slotId: string; deliveryId: number } | undefined,
        timeline: CreateChildNodeResult | undefined,
        transitionIdentity: CampaignPlayerIdentity | undefined,
        gameData: GameData
    ): Promise<void> {
        if (!snapshot) return;
        const letterNumber = snapshot.slotId.match(/^letter_([1-9])$/)?.[1];
        if (!letterNumber) return;
        const gate = await this.fallbackDeliveryGate(snapshot, timeline, transitionIdentity, gameData);
        if (!gate.passed) {
            return;
        }
        const fallbackRunBlock = buildLetterReplyRunFile(letterNumber, snapshot.deliveryId, 'votc_letter_reply_fallback_desc', gate.timeline);
        // Queue instead of writing directly: letters.txt is a single
        // whole-file-overwrite channel, and a direct write here could clobber
        // a successful reply that is still awaiting VOTC:LETTER_ACCEPTED (that
        // reply has already left the pending queue, so the loss would be
        // permanent). checkAndDeliverLetters flushes one queued fallback per
        // pass once the channel is idle.
        LetterManager.getInstance().queueLetterFallback(letterNumber, snapshot.deliveryId, fallbackRunBlock);
    }

    /**
     * Decide whether the fallback block may be written into the loaded game's
     * letters.txt, and with which timeline script. The block clears
     * `votc_letter_N` — a global variable shared across campaigns — and carries
     * the reply branch's checkpoint script, so it needs the same delivery gate
     * as a normal reply: when generation outlives a campaign/player switch,
     * writing it into the newly loaded game would clear THAT game's letter
     * slot and re-point ITS timeline. The current context is resolved from
     * log-order evidence (a fresher save-load line or checkpoint receipt
     * outranks everything older). When the freshest evidence is an init
     * block, it is re-parsed: that block may be NEWER than the snapshot this
     * reply was generated from (a save was loaded and a new conversation
     * started mid-generation), and the generation-time snapshot must not vouch
     * for it. Unconfirmable context fails closed: the thread stays pending in
     * its own campaign instead of clearing a foreign slot. The timeline
     * script is dropped when the save's current node no longer matches the
     * branch the reply was allocated on.
     */
    private async fallbackDeliveryGate(
        snapshot: { slotId: string; deliveryId: number },
        timeline: CreateChildNodeResult | undefined,
        transitionIdentity: CampaignPlayerIdentity | undefined,
        gameData: GameData
    ): Promise<{ passed: boolean; timeline: CreateChildNodeResult | undefined }> {
        const identity = transitionIdentity ?? timeline?.context?.identity;
        // Legacy mod (no timeline identity): no campaign concept exists, so
        // the pre-gate behaviour is kept. The danger scenario requires the v2
        // protocol, which always carries the identity here.
        if (!identity) {
            return {passed: true, timeline};
        }
        const logPath = path.join(this.config.userFolderPath, 'logs', 'debug.log');
        const evidence = scanDeliverySnapshotEvidence(logPath);

        let currentCampaignId: string | undefined;
        let currentPlayerId: string | undefined;
        let currentNodeId: string | undefined;

        if (evidence.source === 'load' || evidence.source === 'observed' || evidence.source === 'checkpoint') {
            currentCampaignId = evidence.campaignId;
            currentPlayerId = evidence.playerId;
            currentNodeId = evidence.nodeId;
        }
        if (!currentCampaignId || !currentPlayerId) {
            // No load line or checkpoint receipt established the context, so
            // the freshest init block decides — and it can be newer than the
            // generation-time snapshot. Re-parse the log instead of trusting
            // gameData; a parse failure leaves the fields undefined and the
            // gate below refuses (fail closed).
            const freshGameData = await parseLog(logPath);
            const freshIdentity = freshGameData
                ? (() => {
                    try {
                        return requireCampaignIdentity({
                            playerID: freshGameData.playerID,
                            timelineSnapshotResult: freshGameData.timelineSnapshotResult
                        });
                    } catch {
                        return undefined;
                    }
                })()
                : undefined;
            currentCampaignId = currentCampaignId ?? freshIdentity?.campaignId;
            currentPlayerId = currentPlayerId ?? (freshGameData ? String(freshGameData.playerID) : undefined);
            currentNodeId = currentNodeId ?? (freshIdentity
                ? (freshGameData!.votcTimelineNodeA && freshGameData!.votcTimelineNodeB
                    ? `${freshGameData!.votcTimelineNodeA}-${freshGameData!.votcTimelineNodeB}`
                    : undefined)
                : currentNodeId);
        }

        if (!currentCampaignId || !currentPlayerId) {
            console.warn(`[LetterReply] Fallback for ${snapshot.slotId} skipped: the current game context could not be verified. The reply thread stays pending in its own campaign instead of clearing a foreign letter slot.`);
            return {passed: false, timeline};
        }
        const verdict = evaluateReplyDeliveryGate(
            {recipientId: identity.playerId, campaignId: identity.campaignId},
            {campaignId: currentCampaignId},
            currentPlayerId,
            {allowUnstampedLegacyReplies: true}
        );
        if (!verdict.deliverable) {
            console.warn(`[LetterReply] Fallback for ${snapshot.slotId} skipped (${verdict.reason}): it belongs to campaign ${identity.campaignId}/player ${identity.playerId}, but the loaded game is ${currentCampaignId}/player ${currentPlayerId}. Not clearing the foreign letter slot.`);
            return {passed: false, timeline};
        }

        let effectiveTimeline = timeline;
        if (timeline?.nodeId && currentNodeId && currentNodeId !== timeline.nodeId) {
            console.warn(`[LetterReply] Fallback for ${snapshot.slotId} drops its timeline script: the save's current node is ${currentNodeId}, not the ${timeline.nodeId} allocated for this reply.`);
            effectiveTimeline = undefined;
        }
        return {passed: true, timeline: effectiveTimeline};
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
    private async saveLetterHistory(playerId: string, aiId: string, originalLetter: ILetter, replyContent: string, gameData: GameData, replyLetterId: string, timelineInfo?: { script: string; epoch: number; nodeId: string; campaignId: string; playerId: string }): Promise<ILetter | null> {
        try {
            const letterManager = LetterManager.getInstance();
    
            const player = gameData.characters.get(Number(playerId));
            const ai = gameData.characters.get(Number(aiId));
    
            if (!player || !ai) {
                console.error("Could not find player or AI character to save letter history.");
                return null;
            }
    
            // AI writes the reply after stage 2 of the journey.
            const stage2EndDays = Math.floor(originalLetter.delay * 5 / 9);
            const replyWrittenDay = originalLetter.totalDays + stage2EndDays;
            
            const replyTimestamp = new Date(originalLetter.timestamp);
            replyTimestamp.setUTCDate(replyTimestamp.getUTCDate() + stage2EndDays);

            // The player is expected to receive the reply after the full delay.
            const expectedPlayerDeliveryDate = new Date(originalLetter.timestamp);
            expectedPlayerDeliveryDate.setUTCDate(expectedPlayerDeliveryDate.getUTCDate() + originalLetter.delay);

            const replyLetter = new Letter(
                replyLetterId,
                ai, // sender is the AI
                player, // recipient is the player
                `Re: ${originalLetter.subject}`,
                replyContent,
                LetterType.PERSONAL,
                replyTimestamp, // Use the calculated reply date
                false, // It's a new letter, so not read by the player yet
                originalLetter.delay,
                replyWrittenDay, // The "day number" when the reply was written
                originalLetter.id,
                'pending',
                false,
                undefined, // creationTimestamp
                undefined, // deliveryTimestamp (set on VOTC:LETTER_ACCEPTED)
                expectedPlayerDeliveryDate // When the player should receive it
            );

            // Persist the timeline payload with the letter itself: a restart
            // rehydrates pending replies from this JSON, and a script that
            // only lives on the in-memory object would be lost.
            if (timelineInfo) {
                replyLetter.timelineScript = timelineInfo.script;
                replyLetter.timelineEpoch = timelineInfo.epoch;
                replyLetter.timelineNodeId = timelineInfo.nodeId;
                replyLetter.timelineCampaignId = timelineInfo.campaignId;
                replyLetter.timelinePlayerId = timelineInfo.playerId;
            }
    
            // Atomically update the history file
            const otherCharacterId = aiId; // The file is named after the non-player character
            const filePath = letterManager.getLetterFilePath(playerId, otherCharacterId);
    
            let history: ILetter[] = [];
            if (fs.existsSync(filePath)) {
                history = letterManager.getLetters(playerId, otherCharacterId);
            }
    
            // Add original letter if not present (using a more robust duplicate check)
            const isOriginalDuplicate = history.some(l =>
                l.subject === originalLetter.subject &&
                l.totalDays === originalLetter.totalDays &&
                l.sender.id === originalLetter.sender.id &&
                l.recipient.id === originalLetter.recipient.id
            );
            if (!isOriginalDuplicate) {
                history.push(originalLetter);
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
    private async generateAndSaveLetterSummary(gameData: GameData, originalLetter: ILetter, replyContent: string, replyLetterId: string): Promise<void> {
        try {
            const player = gameData.characters.get(originalLetter.sender.id);
            const ai = gameData.characters.get(originalLetter.recipient.id);
            
            if (!player || !ai) {
                console.error('Player or AI character data not found for summary generation');
                return;
            }

            // Build summary generation prompt
            const effectivePrompts = getEffectivePrompts(this.config, this.userDataPath, gameData);
            let summaryPrompt = effectivePrompts.letterSummaryPrompt;

            summaryPrompt = summaryPrompt.replace('{{playerName}}', player.fullName)
                                         .replace('{{playerLetterContent}}', originalLetter.content)
                                         .replace('{{aiName}}', ai.fullName)
                                         .replace('{{aiReplyContent}}', replyContent);

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
