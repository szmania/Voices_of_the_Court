import { ApiConnection } from "../../shared/apiConnection";
import { Tiktoken } from "js-tiktoken";
import { GameData } from "../../shared/gameData/GameData";
import { parseLog, removeTooltip } from "../../shared/gameData/parseLog.js";
import { Config } from "../../shared/Config";
import { Message } from "../ts/conversation_interfaces";
import { app, BrowserWindow } from 'electron';
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { archiveFutureSummaryFilesForPlayer, readSummaryFile, saveSummaryFile } from '../summaryManager.js';
import { Summary } from '../ts/conversation_interfaces';
import { archiveFutureLetterHistoryForPlayer, saveIncomingLetterHistory } from '../conversationHistory.js';
import { buildIncomingLetterHistoryRecord } from './letterHistoryRecord.js';
import {
    TimelineRegistryCorruptError,
    type CreateChildNodeResult,
    type GameDataLike
} from '../timelineManager.js';
import { resolveSummaryTimelineContext, type SummaryTimelineContext } from './summaryTimelineContext.js';
import { createMemoryString, getEffectivePrompts } from '../conversation/promptBuilder';
import { UnsupportedTimelineSchemaError } from '../../shared/gameData/timelineProtocol.js';
import { reportCorruptTimelineRegistry, reportUnsupportedTimelineSchema, reportCampaignIdentityUnavailable } from '../timelineRegistryRecovery.js';
import { requireCampaignIdentity, CampaignIdentityUnavailableError } from '../campaignIdentityResolver.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import { runIncomingLetterTimelineTransition } from '../timelineBusinessWire.js';
import { loadIncomingLetterPrompts, substitute, resolveInstructionPrompt, type IncomingLetterPromptData } from './incomingLetterPromptsLoader.js';
import { Letter } from './Letter.js';
import { LetterType } from './letterInterfaces.js';
import { LetterManager } from './LetterManager.js';
import { withGameDataLocalize } from '../conversation/gameDataLocalize.js';

// Porting notes (P1): the source line additionally injected Agency
// projections (P4, out of scope) and fed the parsed snapshot to the court
// chronicle (P2). The P2 chronicle feed is deliberately not wired here; its
// backfill point is the block after the timeline transition below (source
// main-line commit 04188f46, observeParsedGameDataForChronicle with
// 'incoming_letter'). The protocol-facing code below is byte-compatible with
// the 1.x implementation.

type IncomingLetterType =
    | 'vassal_memorial' | 'siege_report' | 'lost_holding' | 'family_letter' | 'poetry_letter'
    | 'courtier_petition' | 'rival_taunt' | 'dear_friend_greeting' | 'letter_to_travelling_player'
    | 'ally_call_for_aid' | 'revolt_urgent' | 'deathbed_letter' | 'pilgrimage_tales'
    | 'tour_tales' | 'wedding_tales' | 'hunt_tales' | 'tournament_tales' | 'travel_tales'
    | 'faction_warning'
    | 'scheme_exposed' | 'natural_disaster' | 'tributary_letter' | 'liege_overlord_letter'
    | 'great_work_notice' | 'great_project_report';

interface IncomingLetterContext {
    slotId: 'incoming_letter_1' | 'incoming_letter_2' | 'incoming_letter_3' | 'incoming_letter_4' | 'incoming_letter_5' | 'incoming_letter_6' | 'incoming_letter_7' | 'incoming_letter_8';
    type: IncomingLetterType;
    sentDate: string;
    senderId: number;
    deliveryId: number;
    facts: Record<string, string>;
    snapshotStartOffset: number;
    snapshotEndOffset: number;
}

const VALID_TYPES: IncomingLetterType[] = [
    'vassal_memorial', 'siege_report', 'lost_holding', 'family_letter', 'poetry_letter',
    'courtier_petition', 'rival_taunt', 'dear_friend_greeting', 'letter_to_travelling_player',
    'ally_call_for_aid', 'revolt_urgent', 'deathbed_letter', 'pilgrimage_tales',
    'tour_tales', 'wedding_tales', 'hunt_tales', 'tournament_tales', 'travel_tales',
    'faction_warning',
    'scheme_exposed', 'natural_disaster', 'tributary_letter', 'liege_overlord_letter',
    'great_work_notice', 'great_project_report'
];

const inFlight = new Set<string>();
const completed = new Set<string>();
const latestSignatureBySlot = new Map<string, string>();


// F13 (1.x P1-L1): fallback for configs without the maxSummaryTokens key
// (see Config.ts / default_config.json). The generator reads
// config.maxSummaryTokens so the budget is user-tunable.
const INCOMING_LETTER_SUMMARY_TOKEN_BUDGET = 2000;



// Data-driven siege descriptors: numeric fact -> localized label from the
// per-locale prompt file. Unknown/non-numeric values pass through unchanged.
function describeSiegeFortLevel(prompts: IncomingLetterPromptData, value: string): string {
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    const d = prompts.siegeFortLevelDescriptions;
    if (num <= 0) return d['none'] || value;
    if (num === 1) return d['very_low'] || value;
    if (num === 2) return d['low'] || value;
    if (num === 3) return d['medium'] || value;
    if (num === 4) return d['high'] || value;
    if (num === 5) return d['very_high'] || value;
    return d['extreme'] || value;
}

function describeSiegePhaseProgress(prompts: IncomingLetterPromptData, value: string): string {
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    const d = prompts.siegePhaseProgressDescriptions;
    if (num <= 0) return d['started'] || value;
    if (num < 30) return d['early'] || value;
    if (num < 60) return d['mid'] || value;
    if (num < 90) return d['late'] || value;
    return d['near_breach'] || value;
}

export function normalizeCk3String(text: string): string {
    let normalized = text.trim();
    normalized = normalized.replace(/[\r\n\t]+/g, ' ');
    normalized = normalized.replace(/"/g, '“').replace(/'/g, '’');
    normalized = normalized.replace(/[#\[\]{}|@$%&\\]/g, '');
    normalized = normalized.replace(/[\x00-\x1F\x7F]/g, '');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    if (normalized.length > 500) {
        normalized = normalized.slice(0, 500);
    }
    return normalized || 'votc_incoming_letter_fallback_desc';
}

// CK3's run-file lexer requires UTF-8 BOM, otherwise effects containing
// non-ASCII letter text can fail to parse (same convention as
// LetterManager/RunFileManager). Written atomically so a crash cannot leave a
// half-written script for the game to execute.
function writeIncomingRunFileAtomically(filePath: string, content: string): void {
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, '\uFEFF' + content, 'utf8');
        fs.renameSync(temporaryPath, filePath);
    } finally {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
}

export class IncomingLetterGenerator {
    private apiConnection: ApiConnection;
    private config: Config;
    private votcDataPath: string;

    // Same injection shape as LetterReplyGenerator: main.ts owns the
    // <userData>/votc_data root and the shared tiktoken encoder, so this
    // generator never resolves user paths from the electron app itself.
    constructor(config: Config, votcDataPath: string, encoder: Tiktoken | null) {
        this.config = config;
        this.votcDataPath = votcDataPath;
        this.apiConnection = new ApiConnection(
            config.textGenerationApiConnectionConfig.connection,
            config.textGenerationApiConnectionConfig.parameters,
            encoder
        );
    }

    // Summary/prompt roots follow the upstream summaryManager convention: the
    // caller passes the <userData>/votc_data root, not the bare userData dir.
    // F21: incoming-letter summaries are routed into
    // the campaign-scoped conversation_summaries directory whenever the
    // snapshot carries a v2 identity; the legacy player store remains the
    // degraded fallback and stays readable through the union read below.
    private getVotcDataRoot(): string {
        return this.votcDataPath;
    }

    // F21/M7: the shared summary-timeline resolver (summaryTimelineContext.ts)
    // now owns the registry load + context resolution, so letter summaries and
    // conversation summaries resolve the exact same branch context.
    private getSummaryTimeline(gameData: GameData): SummaryTimelineContext {
        return resolveSummaryTimelineContext(gameData);
    }

    public async generateIncomingLetter(
        debugLogPath: string,
        userFolderPath: string,
        slotId: string,
        type: string,
        deliveryId: number
    ): Promise<void> {
        const slotMatch = slotId.match(/^incoming_letter_([1-8])$/);
        if (!slotMatch) {
            console.log(`[IncomingLetterGenerator] Invalid slotId: ${slotId}`);
            return;
        }
        const slotNumber = Number(slotMatch[1]);

        if (!VALID_TYPES.includes(type as IncomingLetterType)) {
            console.log(`[IncomingLetterGenerator] Invalid type: ${type}`);
            return;
        }
        const validatedType = type as IncomingLetterType;
        if (!Number.isSafeInteger(deliveryId) || deliveryId < 0) {
            console.log(`[IncomingLetterGenerator] Invalid deliveryId: ${deliveryId}`);
            return;
        }

        // Invalidate any older in-flight generation for this slot before doing
        // file or log parsing. A failed newer handoff must not be overwritten by
        // a late response for the previous occupant of the same slot.
        const handoffSignature = `${slotId}|${validatedType}|${deliveryId}|handoff`;
        latestSignatureBySlot.set(slotId, handoffSignature);

        const context = this.parseContext(debugLogPath, slotId, validatedType, deliveryId);
        if (!context) {
            console.log(`[IncomingLetterGenerator] Failed to parse context for ${slotId}/${type}/${deliveryId}; writing fallback.`);
            this.writeFallbackRunFile(userFolderPath, slotNumber, validatedType, deliveryId);
            return;
        }

        let gameData: GameData | undefined;
        try {
            gameData = await parseLog(debugLogPath, {
                startOffset: context.snapshotStartOffset,
                endOffset: context.snapshotEndOffset
            });
        } catch (error) {
            console.error(`[IncomingLetterGenerator] Failed to parse selected snapshot for ${slotId}/${deliveryId}:`, error);
        }
        if (!gameData || gameData.aiID !== context.senderId) {
            console.error(`[IncomingLetterGenerator] Snapshot data did not match sender ${context.senderId}; writing fallback.`);
            this.writeFallbackRunFile(userFolderPath, slotNumber, validatedType, deliveryId);
            return;
        }

        const signature = `${context.slotId}|${gameData.playerID}|${context.senderId}|${context.sentDate}|${context.type}|${context.deliveryId}`;

        if (completed.has(signature) || inFlight.has(signature)) {
            // A repeated notification must not expire the request it is
            // deduplicating. Restore ownership only if no different handoff
            // arrived while this snapshot was being parsed.
            if (inFlight.has(signature) && latestSignatureBySlot.get(slotId) === handoffSignature) {
                latestSignatureBySlot.set(slotId, signature);
            }
            console.log(`[IncomingLetterGenerator] Signature already completed or in flight: ${signature}`);
            return;
        }
        if (latestSignatureBySlot.get(slotId) !== handoffSignature) {
            console.log(`[IncomingLetterGenerator] Expired handoff for ${slotId}/${deliveryId}, skipping generation`);
            return;
        }
        inFlight.add(signature);
        latestSignatureBySlot.set(slotId, signature);

        // §43: the run file must exist during generation (the mod's poller
        // executes it every ~1-2s and logs `console_failure: No such file in
        // run/` otherwise), but it must NOT be the executable guarded fallback:
        // the poller would execute that fallback before the LLM responds and
        // consume the slot globals, so the final run file would hit its `else`
        // branch and the fallback body would be what the player sees. Write an
        // inert heartbeat placeholder instead — harmless on every beat, creates
        // no artifact, consumes nothing. The real guarded fallback is written
        // only on definitive failure paths below.
        let finalWritten = false;
        try {
            this.writePlaceholderRunFile(userFolderPath, slotNumber);

            // Create a timeline child node for this incoming letter delivery. The
            // parent is the pre-delivery save node from GameData; the child becomes
            // the new save node. The signature makes this idempotent, so the fallback
            // and the final LLM run file share the same node.
            //
            // §4.1: capture immutable identity; §9: fail closed if missing.
            let timeline: CreateChildNodeResult;
            let identity: CampaignPlayerIdentity;
            try {
                identity = requireCampaignIdentity({
                    playerID: gameData.playerID,
                    timelineSnapshotResult: gameData.timelineSnapshotResult
                });
                // §9.3 P5.4: incoming_letter uses the v2 journal API with
                // `post-bump-node-only` commit mode and a requestKey derived
                // from `slot + type + deliveryId` (Mod-provided occurrence
                // evidence). The signature is stored as eventSignature (audit
                // only); it is NOT used as the requestKey.
                const eventSignature = `incoming:${signature}`;
                const transition = await runIncomingLetterTimelineTransition({
                    userDataDir: app.getPath('userData'),
                    gameData: gameData as any as GameDataLike,
                    identity,
                    slotId: context.slotId,
                    type: context.type,
                    deliveryId: context.deliveryId,
                    eventSignature,
                    targetEpoch: gameData.votcCheckpointEpoch + 1,
                    scopeVar: 'talk_first_scope'
                });
                timeline = {
                    nodeId: transition.targetNodeId,
                    parentId: transition.context.timelineParentId ?? null,
                    script: transition.script,
                    context: transition.context,
                    createdNewRoot: false
                };
                console.log(`[IncomingLetterGenerator] Timeline node created: ${timeline.nodeId} (parent: ${timeline.parentId ?? 'null'}, attempt: ${transition.attemptId}, reused: ${transition.reused}) for ${signature}`);
            } catch (error) {
                if (error instanceof CampaignIdentityUnavailableError) {
                    reportCampaignIdentityUnavailable(error);
                    // §43: definitive failure — replace the inert placeholder with
                    // the real guarded fallback so the letter still delivers.
                    this.writeFallbackRunFile(userFolderPath, slotNumber, context.type, context.deliveryId, null);
                    return;
                }
                if (error instanceof TimelineRegistryCorruptError) {
                    reportCorruptTimelineRegistry(error);
                    this.writeFallbackRunFile(userFolderPath, slotNumber, context.type, context.deliveryId, null);
                    return;
                }
                if (error instanceof UnsupportedTimelineSchemaError) {
                    reportUnsupportedTimelineSchema(error.schema);
                    this.writeFallbackRunFile(userFolderPath, slotNumber, context.type, context.deliveryId, null);
                    return;
                }
                throw error;
            }

            const sourceRecordId = randomUUID();
            const sourceGameDate = gameData.gameDate;

            // P2 backfill point: the source line observes the parsed snapshot
            // for the court chronicle here (observeParsedGameDataForChronicle
            // with 'incoming_letter'); the chronicle belongs to a later PR, so
            // P1 intentionally leaves generation self-contained.

            const messages = await this.buildMessages(gameData, context);
            console.log(`[IncomingLetterGenerator] Generated prompt for ${signature}: ${messages.map(m => m.content).join('\n').substring(0, 200)}...`);

            // The source line carried a local `__purpose: 'incomingLetter'`
            // marker inside otherArgs; the upstream ApiConnection spreads
            // otherArgs into provider requests, so the marker stays a local
            // diagnostic here and never reaches the provider.
            console.log(`[IncomingLetterGenerator] LLM request purpose: incomingLetter`);
            const apiResult = await this.apiConnection.complete(messages, false, {
                max_tokens: this.config.maxTokens,
                temperature: this.config.textGenerationApiConnectionConfig.parameters.temperature
            });
            // complete() resolves to MessageChunk | string | void across the
            // upstream providers; normalize exactly like LetterReplyGenerator.
            const response = typeof apiResult === 'string' ? apiResult : (apiResult?.content ?? '');

            if (!response || response.trim() === '') {
                console.warn(`[IncomingLetterGenerator] Empty LLM response for ${signature}; writing fallback.`);
                // §43: definitive failure — the placeholder must not stay inert.
                this.writeFallbackRunFile(userFolderPath, slotNumber, context.type, context.deliveryId, timeline);
                return;
            }

            if (latestSignatureBySlot.get(slotId) !== signature) {
                console.log(`[IncomingLetterGenerator] Expired slot ${slotId}, skipping overwrite for ${signature}`);
                return;
            }

            const normalizedText = normalizeCk3String(response);
            this.writeFinalRunFile(userFolderPath, slotNumber, context.type, context.deliveryId, normalizedText, timeline);
            // §43: the final run file is on disk; a later throw (history/summary
            // save) must not clobber it with the fallback.
            finalWritten = true;

            try {
                await this.saveHistory(gameData, context, normalizedText, timeline, identity, sourceRecordId, sourceGameDate);
            } catch (historyError) {
                console.error(`[IncomingLetterGenerator] History save failed for ${signature}:`, historyError);
            }

            try {
                await this.saveSummary(gameData, context, normalizedText, timeline, sourceRecordId, sourceGameDate);
            } catch (summaryError) {
                console.error(`[IncomingLetterGenerator] Summary save failed for ${signature}:`, summaryError);
            }

            completed.add(signature);
        } catch (error) {
            if (error instanceof TimelineRegistryCorruptError) {
                reportCorruptTimelineRegistry(error);
            } else if (error instanceof UnsupportedTimelineSchemaError) {
                reportUnsupportedTimelineSchema(error.schema);
            }
            console.error(`[IncomingLetterGenerator] Error generating incoming letter for ${signature}:`, error);
            // §43: definitive failure — write the real guarded fallback unless the
            // final run file already landed (a post-final throw must not clobber
            // a good final).
            if (!finalWritten) {
                this.writeFallbackRunFile(userFolderPath, slotNumber, context.type, context.deliveryId, null);
            }
        } finally {
            inFlight.delete(signature);
        }
    }

    /**
     * Byte offset of the last occurrence of `marker` at or before `beforeOffset`,
     * found by scanning backward in 512KB chunks (1KB overlap so a marker
     * straddling a chunk edge is still complete). Returns -1 when the marker is
     * not present above `floorOffset`. Byte offsets, not string indexes, so
     * multibyte (CJK) content cannot shift the result.
     */
    private findLastMarkerOffset(fd: number, size: number, marker: string, beforeOffset: number, floorOffset: number): number {
        const CHUNK = 512 * 1024;
        const OVERLAP = 1024;
        let end = Math.min(size, beforeOffset);
        while (end > floorOffset) {
            const start = Math.max(floorOffset, end - CHUNK);
            const readEnd = Math.min(size, end + OVERLAP);
            const buffer = Buffer.alloc(readEnd - start);
            fs.readSync(fd, buffer, 0, buffer.length, start);
            const text = buffer.toString('utf8');
            // Only consider markers starting inside [start, end); the overlap
            // exists so a marker straddling the chunk edge is still complete.
            const own = text.slice(0, end - start);
            const idx = own.lastIndexOf(marker);
            if (idx >= 0) {
                const absolute = start + Buffer.byteLength(text.slice(0, idx), 'utf8');
                if (absolute <= beforeOffset) return absolute;
            }
            end = start;
        }
        return -1;
    }

    /**
     * Locates the newest matching incoming-letter context line by scanning the
     * log tail backward in chunks, instead of decoding the whole (unbounded)
     * debug.log into one string. Returns absolute BYTE offsets for the snapshot
     * window, or null when no match is found inside the bounded tail.
     */
    private parseContext(
        debugLogPath: string,
        expectedSlotId: string,
        expectedType: IncomingLetterType,
        expectedDeliveryId: number
    ): IncomingLetterContext | null {
        try {
            if (!fs.existsSync(debugLogPath)) {
                console.error(`[IncomingLetterGenerator] debug.log not found: ${debugLogPath}`);
                return null;
            }

            const initMarker = 'VOTC:IN/;/init/';
            const contextMarker = 'VOTC:INCOMING_LETTER/;/context/';

            const size = fs.statSync(debugLogPath).size;
            const CHUNK = 512 * 1024;
            const OVERLAP = 1024; // markers are short; a 1KB overlap covers straddles
            // The request is always written just before the clipboard trigger, so
            // it sits at the tail. A 16MB window is generous; beyond it the
            // whole-file fallback below preserves the old (correct, slow) path.
            const MAX_TAIL = 16 * 1024 * 1024;
            const floor = Math.max(0, size - MAX_TAIL);

            const fd = fs.openSync(debugLogPath, 'r');
            try {
                let end = size;
                while (end > floor) {
                    const start = Math.max(floor, end - CHUNK);
                    const readEnd = Math.min(size, end + OVERLAP);
                    const buffer = Buffer.alloc(readEnd - start);
                    fs.readSync(fd, buffer, 0, buffer.length, start);
                    const text = buffer.toString('utf8');
                    // Only consider markers starting inside [start, end); the
                    // overlap exists so a marker straddling the chunk edge is
                    // still complete.
                    const own = text.slice(0, end - start);

                    let searchFrom = own.length;
                    while (searchFrom > 0) {
                        const idx = own.lastIndexOf(contextMarker, searchFrom);
                        if (idx < 0) break;

                        // Full line containing the marker (may extend into the overlap).
                        const lineStart = text.lastIndexOf('\n', idx) + 1;
                        const eol = text.indexOf('\n', idx);
                        const contextLine = text.slice(lineStart, eol >= 0 ? eol : text.length).replace(/\r$/, '');
                        const parts = contextLine.split('/;/').map(part => part.trim());
                        const slot = parts[2];
                        const type = parts[3];
                        const sentDate = parts[4];
                        const senderId = Number(parts[5]);
                        const deliveryId = Number(parts[6]);

                        if (
                            parts.length >= 7
                            && parts[0] === 'VOTC:INCOMING_LETTER'
                            && parts[1] === 'context'
                            && slot === expectedSlotId
                            && type === expectedType
                            && deliveryId === expectedDeliveryId
                            && sentDate
                            && Number.isFinite(senderId)
                        ) {
                            const contextStart = start + Buffer.byteLength(text.slice(0, idx), 'utf8');
                            const contextLineEnd = start + Buffer.byteLength(text.slice(0, eol >= 0 ? eol : text.length), 'utf8');
                            const initStart = this.findLastMarkerOffset(fd, size, initMarker, contextStart, floor);
                            if (initStart < 0) {
                                console.log(`[IncomingLetterGenerator] Matching context has no preceding init marker: ${contextLine}`);
                                searchFrom = idx - 1;
                                continue;
                            }

                            const facts: Record<string, string> = {};
                            for (let i = 7; i < parts.length; i++) {
                                const separatorIndex = parts[i].indexOf('=');
                                if (separatorIndex <= 0) continue;
                                const key = parts[i].slice(0, separatorIndex).trim();
                                const value = removeTooltip(parts[i].slice(separatorIndex + 1).trim());
                                if (/^[a-z0-9_]+$/i.test(key) && value) {
                                    facts[key] = value;
                                }
                            }

                            return {
                                slotId: slot as IncomingLetterContext['slotId'],
                                type: type as IncomingLetterType,
                                sentDate,
                                senderId,
                                deliveryId,
                                facts,
                                snapshotStartOffset: initStart,
                                snapshotEndOffset: contextLineEnd
                            };
                        }

                        searchFrom = idx - 1;
                    }

                    end = start;
                }
            } finally {
                fs.closeSync(fd);
            }

            // Markers not found inside the bounded tail: fall back to the
            // original whole-file scan so correctness never depends on the
            // window size (only the common case is fast).
            return this.parseContextWholeFile(debugLogPath, expectedSlotId, expectedType, expectedDeliveryId);
        } catch (error) {
            console.error(`[IncomingLetterGenerator] Error parsing incoming letter context:`, error);
            return null;
        }
    }

    /**
     * Whole-file fallback for `parseContext` (the pre-chunking implementation).
     * Only reached when the bounded tail scan finds no match; offsets are byte
     * offsets, matching the chunked path and `parseLog`'s range contract.
     */
    private parseContextWholeFile(
        debugLogPath: string,
        expectedSlotId: string,
        expectedType: IncomingLetterType,
        expectedDeliveryId: number
    ): IncomingLetterContext | null {
        const content = fs.readFileSync(debugLogPath, 'utf8');
        const initMarker = 'VOTC:IN/;/init/';
        const contextMarker = 'VOTC:INCOMING_LETTER/;/context/';
        let searchFrom = content.length;

        while (searchFrom >= 0) {
            const contextStart = content.lastIndexOf(contextMarker, searchFrom);
            if (contextStart === -1) break;

            const rawLineEnd = content.indexOf('\n', contextStart);
            const contextLineEnd = rawLineEnd === -1 ? content.length : rawLineEnd;
            const contextLine = content.slice(contextStart, contextLineEnd).replace(/\r$/, '');
            const parts = contextLine.split('/;/').map(part => part.trim());
            const slot = parts[2];
            const type = parts[3];
            const sentDate = parts[4];
            const senderId = Number(parts[5]);
            const deliveryId = Number(parts[6]);

            if (
                parts.length >= 7
                && parts[0] === 'VOTC:INCOMING_LETTER'
                && parts[1] === 'context'
                && slot === expectedSlotId
                && type === expectedType
                && deliveryId === expectedDeliveryId
                && sentDate
                && Number.isFinite(senderId)
            ) {
                const initStart = content.lastIndexOf(initMarker, contextStart);
                if (initStart === -1) {
                    console.log(`[IncomingLetterGenerator] Matching context has no preceding init marker: ${contextLine}`);
                    searchFrom = contextStart - 1;
                    continue;
                }

                const facts: Record<string, string> = {};
                for (let i = 7; i < parts.length; i++) {
                    const separatorIndex = parts[i].indexOf('=');
                    if (separatorIndex <= 0) continue;
                    const key = parts[i].slice(0, separatorIndex).trim();
                    const value = removeTooltip(parts[i].slice(separatorIndex + 1).trim());
                    if (/^[a-z0-9_]+$/i.test(key) && value) {
                        facts[key] = value;
                    }
                }

                return {
                    slotId: slot as IncomingLetterContext['slotId'],
                    type: type as IncomingLetterType,
                    sentDate,
                    senderId,
                    deliveryId,
                    facts,
                    snapshotStartOffset: Buffer.byteLength(content.slice(0, initStart), 'utf8'),
                    snapshotEndOffset: Buffer.byteLength(content.slice(0, contextLineEnd), 'utf8')
                };
            }

            searchFrom = contextStart - 1;
        }

        console.log(`[IncomingLetterGenerator] No matching context found for ${expectedSlotId}/${expectedType}/${expectedDeliveryId}`);
        return null;
    }

    private async buildMessages(gameData: GameData, context: IncomingLetterContext): Promise<Message[]> {
        const player = gameData.characters.get(gameData.playerID);
        const sender = gameData.characters.get(context.senderId);

        if (!player || !sender) {
            throw new Error('Player or sender character data not found in gameData');
        }

        // The script resolves its labels through gameData.localize(key, lang, vars),
        // which the conversation flow injects in promptBuilder.ts; attach it here too
        // so incoming-letter prompts get localized descriptions instead of raw loc keys.
        const pListLetter = require("../../../default_userdata/scripts/prompts/description/standard/pListLetter.js");
        const characterDescription = withGameDataLocalize(gameData, this.config.language || 'en', () => pListLetter(gameData)) as string;

        const prompts = loadIncomingLetterPrompts(this.getVotcDataRoot(), this.config.language);
        const topicLabel = prompts.types[context.type] || context.type;

        let summaryContent = '';
        try {
            const userDataPath = this.getVotcDataRoot();
            archiveFutureSummaryFilesForPlayer(
                userDataPath,
                String(gameData.playerID),
                gameData.votcCheckpointEpoch,
                'incoming_letter_summary_checkpoint_filter'
            );
            const summaryTimeline = this.getSummaryTimeline(gameData);
            // F21: union read across the campaign summary store (when an
            // identity is available) and the legacy player store, so records
            // written in either namespace feed the prompt. Dedup by summary
            // id keeps the campaign copy authoritative.
            const campaignSummaries = summaryTimeline.identity
                ? await readSummaryFile(
                    this.getVotcDataRoot(),
                    String(gameData.playerID),
                    gameData.votcCheckpointEpoch,
                    summaryTimeline.registry,
                    summaryTimeline.currentNodeId,
                    summaryTimeline.identity
                )
                : [];
            const legacySummaries = await readSummaryFile(
                userDataPath,
                String(gameData.playerID),
                gameData.votcCheckpointEpoch,
                summaryTimeline.registry,
                summaryTimeline.currentNodeId
            );
            const seenSummaryIds = new Set(campaignSummaries.map(s => s.id));
            const summaries = [...campaignSummaries, ...legacySummaries.filter(s => !s.id || !seenSummaryIds.has(s.id))];
            const senderSummaries = summaries.filter(summary => summary.characterId === String(context.senderId));
            if (senderSummaries.length > 0) {
                const boundedSummaries = this.buildBoundedChronologicalBlock(
                    substitute(prompts.summaryHeader, { playerName: player.fullName }),
                    senderSummaries.map(summary => `${summary.date}: ${summary.content}`),
                    this.config.maxSummaryTokens ?? INCOMING_LETTER_SUMMARY_TOKEN_BUDGET
                );
                summaryContent = boundedSummaries ? `${boundedSummaries}\n` : '';
            }
        } catch (error) {
            console.warn(`[IncomingLetterGenerator] Failed to load summaries: ${error}`);
        }

        let memoryContent = '';
        try {
            const tempConversation = {
                gameData: gameData,
                config: {
                    memoriesPrompt: prompts.memoriesPrompt,
                    maxMemoryTokens: 1000
                },
                textGenApiConnection: this.apiConnection
            } as any;
            // The upstream createMemoryString takes an optional per-character
            // scope; pass the sender so the prompt carries player+sender
            // memories only (same set the source line obtained through its
            // player+aiID fallback, since aiID === senderId is enforced above).
            const memoryString = createMemoryString(tempConversation, tempConversation.config, sender);
            if (memoryString && memoryString.trim() !== '') {
                memoryContent = `${memoryString}\n\n`;
            }
        } catch (error) {
            console.warn(`[IncomingLetterGenerator] Failed to load memory content: ${error}`);
        }

        // 2CE has no createIntelligenceString equivalent yet; keep the section
        // empty so the prompt layout stays stable.

        const letterLanguage = this.config.language || prompts.misc.letterLanguageFallback;
        let configuredInstruction = '';
        try {
            const effectivePrompts = getEffectivePrompts(this.config, this.getVotcDataRoot(), gameData);
            configuredInstruction = effectivePrompts?.incomingLetterPrompt ?? '';
        } catch (error) {
            console.warn(`[IncomingLetterGenerator] Failed to resolve effective prompts: ${error}`);
        }
        // Resolution chain (9.7.8): per-type user override -> effectivePrompts.incomingLetterPrompt -> per-type locale default -> shared per-locale default.
        const instructionPrompt = substitute(
            resolveInstructionPrompt(prompts, context.type, this.config.categorizedIncomingLetterPrompts, configuredInstruction),
            { senderName: sender.fullName, playerName: player.fullName, letterLanguage }
        );

        const factLines = Object.entries(context.facts)
            .filter(([key, value]) => !(key === 'siege_blocked' && value === 'no'))
            .filter(([key]) => key !== 'deceased_id')
            .map(([key, value]) => {
                let displayValue = value;
                if (key === 'siege_fort_level') {
                    displayValue = describeSiegeFortLevel(prompts, value);
                } else if (key === 'siege_phase_progress') {
                    displayValue = describeSiegePhaseProgress(prompts, value);
                } else if (key === 'siege_blocked') {
                    displayValue = value === 'yes' ? prompts.misc.siegeBlockedYes : value;
                } else if (key === 'poetry_sender_source') {
                    displayValue = prompts.poetrySenderSourceLabels[value] || value;
                } else if (key === 'project_stage') {
                    displayValue = prompts.greatProjectStageLabels[value] || value;
                } else if (key === 'reporter_role') {
                    displayValue = prompts.greatProjectReporterRoleLabels[value] || value;
                } else if (key === 'player_project_role') {
                    displayValue = prompts.greatProjectPlayerRoleLabels[value] || value;
                }
                return substitute(prompts.factLineTemplate, { label: prompts.factLabels[key] || key, value: displayValue });
            })
            .join('\n');
        const eventFacts = factLines ? `${factLines}\n` : '';

        const topicReason = this.buildTopicReason(prompts, context, player.fullName);

        // For deathbed_letter with sender_role=mourner, the sender is the
        // mourner but the letter is about the deceased. Append the deceased's
        // basic info so the LLM can describe them accurately.
        let deceasedInfo = '';
        if (context.type === 'deathbed_letter' && context.facts.sender_role === 'mourner' && context.facts.deceased_id) {
            const deceasedChar = gameData.characters.get(Number(context.facts.deceased_id));
            if (deceasedChar) {
                deceasedInfo = substitute(prompts.deceasedInfoTemplate, {
                    name: deceasedChar.fullName,
                    age: String(deceasedChar.age),
                    culture: deceasedChar.culture,
                    faith: deceasedChar.faith
                }) + '\n';
            }
        }

        const contextContent = `${characterDescription}\n\n${summaryContent}${memoryContent}`.trim();

        const categoryInstruction = context.type === 'poetry_letter' ? prompts.poetryCategoryInstruction : '';

        const requestContent = substitute(prompts.requestTemplate, {
            senderName: sender.fullName,
            playerName: player.fullName,
            topicReason,
            topicLabel,
            sentDate: context.sentDate,
            eventFacts,
            deceasedInfo,
            instructionPrompt,
            categoryInstruction
        });

        // Stable rules first, dynamic context second, current request last,
        // so DeepSeek KV cache can reuse the fixed prefix across letters.
        const messages: Message[] = [
            { role: 'system', content: prompts.stablePolicy },
            { role: 'user', content: contextContent },
            { role: 'user', content: requestContent }
        ];

        return messages;
    }

    // Data-driven replacement for the old 25-branch if/else chain: every
    // branch is now a reasonTemplates entry in the per-locale prompt file.
    private buildTopicReason(prompts: IncomingLetterPromptData, context: IncomingLetterContext, playerName: string): string {
        const f = context.facts;
        const m = prompts.misc;
        // Per-type user override (Option C) overlays the locale template; every
        // branch below reads t.<type>, so all paths pick up the override. The
        // deathbed_letter_deceased variant stays locale-driven (sender_role split).
        const t: Record<string, string> = { ...prompts.reasonTemplates };
        const reasonOverride = this.config.categorizedIncomingLetterReasons?.[context.type];
        if (reasonOverride && reasonOverride.trim() !== '') t[context.type] = reasonOverride;

        switch (context.type) {
            case 'siege_report':
                if (f.siege_location) return substitute(t.siege_report, { siege_location: f.siege_location, playerName });
                break;
            case 'lost_holding':
                if (f.lost_holding) return substitute(t.lost_holding, { lost_holding: f.lost_holding, playerName });
                break;
            case 'poetry_letter':
                return substitute(t.poetry_letter, {
                    playerName,
                    senderSource: prompts.poetrySenderSourceLabels[f.poetry_sender_source] || m.poetFallback
                });
            case 'courtier_petition':
                return substitute(t.courtier_petition, {
                    playerName,
                    subReason: prompts.petitionLabels[f.petition_type] || m.petitionFallback
                });
            case 'ally_call_for_aid':
                return substitute(t.ally_call_for_aid, { playerName, enemy: f.enemy || m.enemyFallback });
            case 'revolt_urgent':
                return substitute(t.revolt_urgent, { playerName, defender: f.defender || m.defenderFallback });
            case 'deathbed_letter': {
                const deceasedName = f.deceased || m.deceasedFallback;
                const isDeceased = f.sender_role === 'deceased';
                const categoryDesc = f.death_category === 'disease'
                    ? prompts.deceasedCategoryLabels.disease
                    : (isDeceased ? prompts.deceasedCategoryLabels.natural : prompts.deceasedCategoryLabels.sudden);
                return substitute(isDeceased ? t.deathbed_letter_deceased : t.deathbed_letter, { deceasedName, categoryDesc, playerName });
            }
            case 'faction_warning': {
                const factionName = f.faction_name || m.anonymousFaction;
                const typeLabel = (f.faction_type && prompts.factionTypeLabels[f.faction_type]) || m.defaultFactionType;
                const sizeLabel = prompts.factionSizeLabels[f.faction_size] || prompts.factionSizeLabels.unknown;
                const p = prompts.factionWarningParts;
                const parts: string[] = [substitute(p.header, { typeLabel, factionName, sizeLabel })];
                if (f.faction_leader) parts.push(substitute(p.leader, { factionLeader: f.faction_leader }));
                if (f.faction_power) parts.push(substitute(p.power, { factionPower: f.faction_power }));
                if (f.faction_discontent) parts.push(substitute(p.discontent, { factionDiscontent: f.faction_discontent }));
                if (f.faction_target_title) parts.push(substitute(p.target, { targetTitle: f.faction_target_title }));
                parts.push(f.faction_at_war === 'yes' ? p.at_war : p.not_at_war);
                return substitute(t.faction_warning, { playerName, factionDescription: parts.join(p.joiner) });
            }
            case 'scheme_exposed':
                return substitute(t.scheme_exposed, { playerName, schemeTarget: f.scheme_target || f.scheme_target_title || m.someone });
            case 'natural_disaster':
                return substitute(t.natural_disaster, { playerName, disasterType: f.disaster_type || m.disasterFallback });
            case 'great_work_notice':
                return substitute(t.great_work_notice, {
                    playerName,
                    workLocation: f.work_location || m.somewhere,
                    workType: f.work_type || m.workFallback,
                    workStage: f.work_stage || m.startedFallback
                });
            case 'great_project_report': {
                const projectStage = prompts.greatProjectStageLabels[f.project_stage] || f.project_stage || m.projectStageFallback;
                return substitute(t.great_project_report, {
                    playerName,
                    projectName: f.project_name || m.defaultProject,
                    projectLocation: f.project_location ? substitute(prompts.reasonTemplates.project_location_prefix, { projectLocation: f.project_location }) : '',
                    projectStage,
                    reporterRole: prompts.greatProjectReporterRoleLabels[f.reporter_role] || m.reporterRoleFallback
                });
            }
        }
        return substitute(t[context.type] || t.default, { playerName, topicLabel: prompts.types[context.type] || context.type });
    }

    private buildBoundedChronologicalBlock(header: string, lines: string[], maxTokens: number): string | null {
        const body: string[] = [];
        let used = this.apiConnection.calculateTokensFromText(header);
        for (const line of lines) {
            const lineTokens = this.apiConnection.calculateTokensFromText(line);
            if (body.length > 0 && used + lineTokens > maxTokens) {
                break;
            }
            body.push(line);
            used += lineTokens;
        }
        if (body.length === 0) {
            return null;
        }
        return `${header}\n${body.join('\n')}`;
    }

    private buildTimelineSetBlock(timeline: CreateChildNodeResult | null, indent = ''): string {
        if (!timeline) return '';
        const [na, nb] = timeline.nodeId.split('-');
        const [pa, pb] = (timeline.parentId ?? '0-0').split('-');
        const effectIndent = `${indent}\t`;
        // Incoming letters do not open a conversation, so talk_first_scope may be
        // absent or point at an unrelated conversation. The mod records this
        // delivery's player in votc_incoming_letter_player_scope before requesting
        // generation.
        return `${indent}global_var:votc_incoming_letter_player_scope = {
${effectIndent}set_variable = { name = votc_timeline_node_a value = ${na} }
${effectIndent}set_variable = { name = votc_timeline_node_b value = ${nb} }
${effectIndent}set_variable = { name = votc_timeline_parent_a value = ${pa} }
${effectIndent}set_variable = { name = votc_timeline_parent_b value = ${pb} }
${effectIndent}set_variable = { name = votc_timeline_schema value = 1 }
${indent}}
`;
    }

    // §43: Inert heartbeat placeholder written immediately when generation starts,
    // so the mod's poller finds an existing file (no `console_failure` spam) but
    // the placeholder cannot create an artifact or consume the slot globals.
    // Byte-identical to the §10/§11/§42.3 startup seeds.
    private writePlaceholderRunFile(userFolderPath: string, slotNumber: number): void {
        const runFolderPath = path.join(userFolderPath, "run");
        if (!fs.existsSync(runFolderPath)) {
            fs.mkdirSync(runFolderPath, { recursive: true });
        }
        const filePath = path.join(runFolderPath, `votc_ce_incomingletter_v2_${slotNumber}.txt`);
        // writeIncomingRunFileAtomically prepends the BOM itself; do NOT add
        // another one here or the file would carry a double BOM (the second
        // BOM becomes a stray character the run-file lexer chokes on).
        const content = "debug_log = \"[Localize('talk_event.9999.desc')]\"";
        writeIncomingRunFileAtomically(filePath, content);
        console.log(`[IncomingLetterGenerator] Placeholder run file written: ${filePath}`);
    }

    private writeFallbackRunFile(
        userFolderPath: string,
        slotNumber: number,
        type: IncomingLetterType,
        deliveryId: number,
        timeline: CreateChildNodeResult | null = null
    ): void {
        const runFolderPath = path.join(userFolderPath, "run");
        if (!fs.existsSync(runFolderPath)) {
            fs.mkdirSync(runFolderPath, { recursive: true });
        }

        const timelineSetBlock = this.buildTimelineSetBlock(timeline, '\t');
        const filePath = path.join(runFolderPath, `votc_ce_incomingletter_v2_${slotNumber}.txt`);
        const content = `if = {
\tlimit = {
\t\texists = global_var:votc_incoming_letter_${slotNumber}
\t\thas_variable = votc_incoming_letter_${slotNumber}_delivery_id
\t\tvar:votc_incoming_letter_${slotNumber}_delivery_id = ${deliveryId}
\t\tglobal_var:votc_incoming_letter_type_${slotNumber} = flag:${type}
\t}
${timelineSetBlock}\tcreate_artifact = {
\t\tname = votc_incoming_letter_title${slotNumber}
\t\tdescription = votc_incoming_letter_fallback_desc
\t\ttype = journal
\t\tvisuals = scroll
\t\tcreator = global_var:votc_incoming_letter_sender_${slotNumber}
\t\tmodifier = artifact_monthly_minor_prestige_1_modifier
\t\tsave_scope_as = votc_latest_letter
\t}
\tif = {
\t\tlimit = { exists = scope:votc_latest_letter }
\t\tscope:votc_latest_letter = {
\t\t\tset_variable = { 
\t\t\t\tname = votc_letter_artifact 
\t\t\t\tvalue = yes 
\t\t\t}
\t\t}
\t\tset_global_variable = {
\t\t\tname = votc_latest_letter
\t\t\tvalue = scope:votc_latest_letter
\t\t}
\t}
\tif = { 
\t\tlimit = { 
\t\t\texists = global_var:votc_incoming_letter_sender_${slotNumber} 
\t\t} 
\t\tset_global_variable = { 
\t\t\tname = message_second_scope 
\t\t\tvalue = global_var:votc_incoming_letter_sender_${slotNumber} 
\t\t} 
\t}
\ttrigger_event = message_event.362
\tremove_global_variable ?= votc_incoming_letter_${slotNumber}
\tremove_global_variable ?= votc_incoming_letter_sender_${slotNumber}
\tremove_global_variable ?= votc_incoming_letter_type_${slotNumber}
\tremove_variable ?= votc_incoming_letter_${slotNumber}_timer
\tremove_variable ?= votc_incoming_letter_${slotNumber}_sent_day
\tremove_variable ?= votc_incoming_letter_${slotNumber}_delivery_id
\tdebug_log = "VOTC:INCOMING_LETTER/;/run_applied/;/incoming_letter_${slotNumber}/;/${deliveryId}"
}
else = {
\tdebug_log = "VOTC:INCOMING_LETTER/;/run_skipped/;/incoming_letter_${slotNumber}/;/${deliveryId}"
}
`;
        writeIncomingRunFileAtomically(filePath, content);
        console.log(`[IncomingLetterGenerator] Fallback run file written: ${filePath}`);
    }

    private writeFinalRunFile(
        userFolderPath: string,
        slotNumber: number,
        type: IncomingLetterType,
        deliveryId: number,
        normalizedText: string,
        timeline: CreateChildNodeResult
    ): void {
        const runFolderPath = path.join(userFolderPath, "run");
        if (!fs.existsSync(runFolderPath)) {
            fs.mkdirSync(runFolderPath, { recursive: true });
        }

        const timelineSetBlock = this.buildTimelineSetBlock(timeline, '\t');
        const filePath = path.join(runFolderPath, `votc_ce_incomingletter_v2_${slotNumber}.txt`);
        const content = `if = {
\tlimit = {
\t\texists = global_var:votc_incoming_letter_${slotNumber}
\t\thas_variable = votc_incoming_letter_${slotNumber}_delivery_id
\t\tvar:votc_incoming_letter_${slotNumber}_delivery_id = ${deliveryId}
\t\tglobal_var:votc_incoming_letter_type_${slotNumber} = flag:${type}
\t}
${timelineSetBlock}\tcreate_artifact = {
\t\tname = votc_incoming_letter_title${slotNumber}
\t\tdescription = "${normalizedText}"
\t\ttype = journal
\t\tvisuals = scroll
\t\tcreator = global_var:votc_incoming_letter_sender_${slotNumber}
\t\tmodifier = artifact_monthly_minor_prestige_1_modifier
\t\tsave_scope_as = votc_latest_letter
\t}
\tif = {
\t\tlimit = { exists = scope:votc_latest_letter }
\t\tscope:votc_latest_letter = {
\t\t\tset_variable = { name = votc_letter_artifact value = yes }
\t\t}
\t\tset_global_variable = {
\t\t\tname = votc_latest_letter
\t\t\tvalue = scope:votc_latest_letter
\t\t}
\t}
\tif = { limit = { exists = global_var:votc_incoming_letter_sender_${slotNumber} } set_global_variable = { name = message_second_scope value = global_var:votc_incoming_letter_sender_${slotNumber} } }
\ttrigger_event = message_event.362
\tremove_global_variable ?= votc_incoming_letter_${slotNumber}
\tremove_global_variable ?= votc_incoming_letter_sender_${slotNumber}
\tremove_global_variable ?= votc_incoming_letter_type_${slotNumber}
\tremove_variable ?= votc_incoming_letter_${slotNumber}_timer
\tremove_variable ?= votc_incoming_letter_${slotNumber}_sent_day
\tremove_variable ?= votc_incoming_letter_${slotNumber}_delivery_id
\tdebug_log = "VOTC:INCOMING_LETTER/;/run_applied/;/incoming_letter_${slotNumber}/;/${deliveryId}"
}
else = {
\tdebug_log = "VOTC:INCOMING_LETTER/;/run_skipped/;/incoming_letter_${slotNumber}/;/${deliveryId}"
}
`;
        writeIncomingRunFileAtomically(filePath, content);
        console.log(`[IncomingLetterGenerator] Final run file written: ${filePath}`);
    }

    private async saveHistory(gameData: GameData, context: IncomingLetterContext, normalizedText: string, timeline: CreateChildNodeResult, identity: CampaignPlayerIdentity, sourceRecordId: string, gameDate?: import("../../shared/gameData/gameDate").Ck3GameDate): Promise<void> {
        const player = gameData.characters.get(gameData.playerID);
        const sender = gameData.characters.get(context.senderId);
        if (!player || !sender) {
            throw new Error('Player or sender character data not found for history save');
        }
        if (!gameDate) {
            // Fail closed: a canonical record requires the structured date.
            throw new Error('Structured gameDate unavailable for incoming letter history save');
        }

        // M1 (Letters-tab projection): upsert a display-only ILetter into the
        // legacy LetterManager store so incoming letters appear in the Letters
        // tab, which reads only that store. The projection is display-only:
        // delivered:true and a non-letter_N subject guarantee it never
        // re-enters delivery logic; the campaign history record below stays
        // authoritative. Idempotency comes from saveLetter's built-in
        // duplicate check (subject + totalDays + sender + recipient).
        // Same UTC convention as Letter.fromLog (month is 0-indexed in JS Date).
        //
        // Fix B (VOTC-194 hotfix): this block runs BEFORE the campaign history
        // work and swallows its own errors, so a history-side failure (e.g. a
        // snapshot validation error) can never hide the letter from the tab.
        try {
            const writtenTimestamp = new Date(Date.UTC(gameDate.year, gameDate.month - 1, gameDate.day, 12, 0, 0));
            const projection = new Letter(
                `${context.slotId}|${gameData.playerID}|${context.senderId}|${context.sentDate}|${context.type}|${context.deliveryId}`,
                sender,
                player,
                `incoming_${context.type}`,
                normalizedText,
                LetterType.PERSONAL,
                writtenTimestamp,
                false, // isRead: hidden until the player actually receives it
                0, // delay: no journey — delivered instantly by the guarded run file
                gameDate.totalDays,
                undefined, // replyToId
                'read', // read
                true // delivered: incoming letters arrive instantly, no journey needed
            );
            LetterManager.getInstance().saveLetter(projection, String(gameData.playerID));
            BrowserWindow.getAllWindows().forEach(win => win.webContents.send('letter-status-changed'));
        } catch (projectionError) {
            console.error(`[IncomingLetterGenerator] Letters-tab projection failed for ${context.slotId}/${context.type}/${context.deliveryId}:`, projectionError);
        }

        // 2CE made this async (1.x was synchronous); awaiting keeps the
        // archive pass strictly ordered before the record write below, since
        // both read-modify-write the same campaign history file.
        await archiveFutureLetterHistoryForPlayer(
            String(gameData.playerID),
            gameData.votcCheckpointEpoch,
            'incoming_letter_checkpoint_filter',
            identity
        );

        const signature = `${context.slotId}|${gameData.playerID}|${context.senderId}|${context.sentDate}|${context.type}|${context.deliveryId}`;
        const record = buildIncomingLetterHistoryRecord({
            id: signature,
            topic: context.type,
            senderId: String(context.senderId),
            receiverId: String(gameData.playerID),
            content: normalizedText,
            checkpointEpoch: gameData.votcCheckpointEpoch + 1,
            timeline,
            identity,
            sourceRecordId,
            gameDate,
            senderCharacter: sender,
            receiverCharacter: player
        });
        await saveIncomingLetterHistory(record, identity);
    }

    private async saveSummary(gameData: GameData, context: IncomingLetterContext, normalizedText: string, timeline: CreateChildNodeResult, sourceRecordId: string, gameDate?: import("../../shared/gameData/gameDate").Ck3GameDate): Promise<void> {
        const sender = gameData.characters.get(context.senderId);
        if (!sender) {
            throw new Error('Sender character data not found for summary save');
        }

        const userDataPath = this.getVotcDataRoot();
        archiveFutureSummaryFilesForPlayer(
            userDataPath,
            String(gameData.playerID),
            gameData.votcCheckpointEpoch,
            'incoming_letter_summary_checkpoint_filter'
        );

        // Read with the timeline context so node-tagged summaries from the
        // current branch stay visible; without a registry the fail-closed
        // filter would drop them and the save below would lose them (the
        // pre-merge bug this guards against).
        // F21: when a campaign identity is available the summary is stored in
        // the campaign-scoped conversation_summaries directory; the read
        // targets the same store the merge-save below writes so hidden
        // sibling-branch records of THAT store survive. The legacy store is
        // left untouched (still read through the union read in buildMessages).
        const summaryTimeline = this.getSummaryTimeline(gameData);
        const identity = summaryTimeline.identity;
        const existingSummaries = await readSummaryFile(
            userDataPath,
            String(gameData.playerID),
            gameData.votcCheckpointEpoch,
            summaryTimeline.registry,
            summaryTimeline.currentNodeId,
            identity
        );
        const senderCharacterId = String(context.senderId);
        const senderSummaries = existingSummaries.filter(summary => summary.characterId === senderCharacterId);
        const otherSummaries = existingSummaries.filter(summary => summary.characterId !== senderCharacterId);

        const prompts = loadIncomingLetterPrompts(this.getVotcDataRoot(), this.config.language);
        const topicLabel = prompts.types[context.type] || context.type;
        const newSummary: Summary = {
            characterId: senderCharacterId,
            date: gameData.date,
            content: substitute(prompts.summaryPrefix, { topicLabel, date: gameData.date }) + normalizedText.slice(0, 600),
            votcCheckpointEpoch: gameData.votcCheckpointEpoch + 1,
            votcTimelineNodeId: timeline.nodeId,
            ...(timeline.parentId ? { votcTimelineParentId: timeline.parentId } : {}),
            ...(identity ? { votcCampaignId: identity.campaignId } : {}),
            id: `summary_${timeline.nodeId}_${new Date().getTime()}`,
            characterName: sender.shortName || sender.fullName,
            sourceType: 'incoming_letter',
            sourceRecordId,
            ...(gameDate ? { gameDate } : {})
        };

        const updatedSummaries: Summary[] = [newSummary, ...senderSummaries, ...otherSummaries];
        // Merge-save with the timeline context: hidden sibling-branch records
        // stay on disk and summary files of other senders are never deleted.
        await saveSummaryFile(userDataPath, String(gameData.playerID), updatedSummaries, gameData.votcCheckpointEpoch + 1, {
            registry: summaryTimeline.registry,
            currentNodeId: summaryTimeline.currentNodeId,
            identity
        });
        console.log(`[IncomingLetterGenerator] Summary saved for sender ${context.senderId}${identity ? ` (campaign ${identity.campaignId})` : ' (legacy store)'}`);
    }
}
