import { ApiConnection } from "../../shared/apiConnection";
import { Tiktoken } from "js-tiktoken";
import { GameData } from "../../shared/gameData/GameData";
import { parseLog, removeTooltip } from "../../shared/gameData/parseLog.js";
import { Config } from "../../shared/Config";
import { Message } from "../ts/conversation_interfaces";
import { app } from 'electron';
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { archiveFutureSummaryFilesForPlayer, readSummaryFile, saveSummaryFile } from '../summaryManager.js';
import { Summary } from '../ts/conversation_interfaces';
import { archiveFutureLetterHistoryForPlayer, saveIncomingLetterHistory } from '../conversationHistory.js';
import { buildIncomingLetterHistoryRecord } from './letterHistoryRecord.js';
import { createMemoryString, getEffectivePrompts } from '../conversation/promptBuilder';
import {
    TimelineRegistryCorruptError,
    FsTimelinePersistence,
    TimelineRegistry,
    resolveTimelineContext,
    buildContextFromGameData,
    type CreateChildNodeResult,
    type GameDataLike
} from '../timelineManager.js';
import { UnsupportedTimelineSchemaError } from '../../shared/gameData/timelineProtocol.js';
import { reportCorruptTimelineRegistry, reportUnsupportedTimelineSchema, reportCampaignIdentityUnavailable } from '../timelineRegistryRecovery.js';
import { requireCampaignIdentity, CampaignIdentityUnavailableError } from '../campaignIdentityResolver.js';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import { runIncomingLetterTimelineTransition } from '../timelineBusinessWire.js';

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

const DEFAULT_INCOMING_LETTER_PROMPT = `请根据你的角色性格、背景、与收信人的关系、相关记忆内容，以及当前的游戏情境，用{{letterLanguage}}写一段由{{senderName}}主动寄给{{playerName}}的简短书信正文。只输出一段纯文本，不要换行、不要引号、不要Markdown格式，总长度控制在200字以内。`;

// F13 (1.x P1-L1): fallback for configs without the maxSummaryTokens key
// (see Config.ts / default_config.json). The generator reads
// config.maxSummaryTokens so the budget is user-tunable.
const INCOMING_LETTER_SUMMARY_TOKEN_BUDGET = 2000;

// KV-cache-friendly stable prefix: fixed rules that never contain names, dates
// or event facts. Must stay byte-identical across requests so DeepSeek can
// reuse the cached prefix.
const STABLE_INCOMING_LETTER_POLICY = `你是一名书信代写助手。后续消息将提供发信人与收信人的角色描述、相关总结与记忆、已确认的游戏事实以及具体的写作要求。请严格按照这些信息，以发信人的身份撰写书信正文。`;

const TOPIC_LABELS: Record<IncomingLetterType, string> = {
    vassal_memorial: '下属奏折',
    family_letter: '近亲家书',
    poetry_letter: '诗词歌赋',
    siege_report: '围城军报',
    lost_holding: '失城急报',
    courtier_petition: '廷臣请愿',
    rival_taunt: '宿敌挑衅',
    dear_friend_greeting: '挚友问候',
    letter_to_travelling_player: '旅途家书',
    ally_call_for_aid: '盟友求援',
    revolt_urgent: '叛乱告急',
    deathbed_letter: '临终遗言',
    pilgrimage_tales: '朝圣见闻',
    tour_tales: '巡游见闻',
    wedding_tales: '婚礼见闻',
    hunt_tales: '狩猎见闻',
    tournament_tales: '比武见闻',
    travel_tales: '旅行见闻',
    faction_warning: '叛乱预警',
    scheme_exposed: '秘谋揭发',
    natural_disaster: '自然灾害',
    tributary_letter: '朝贡来信',
    liege_overlord_letter: '领主来信',
    great_work_notice: '特殊建筑通告',
    great_project_report: '国家重大工程'
};

const FACT_LABELS: Record<string, string> = {
    sender_location: '发信人所在地',
    poetry_sender_source: '发信人来源',
    siege_location: '围城地点',
    army_soldiers: '部队兵力',
    lost_holding: '失守地产',
    attacker: '攻占者',
    siege_progress: '围城进度',
    attacker_men: '攻城方兵力',
    defender_men: '守城方兵力',
    siege_fort_level: '城防等级',
    siege_phase_progress: '围城阶段进度',
    siege_blocked: '围城受阻',
    petition_type: '请愿类型',
    courtier_years: '入廷年限',
    courtier_skill: '擅长领域',
    rival_type: '敌对类型',
    relation_type: '关系类型',
    sender_mood: '发信人心情',
    player_destination: '玩家目的地',
    player_destination_name: '玩家目的地',
    enemy: '敌方',
    war_type: '战争类型',
    defender: '防守方',
    deceased: '逝者',
    relation: '关系',
    sender_role: '发信人身份',
    death_category: '死亡类别',
    death_reason: '具体死因',
    traveller: '旅行者',
    travel_stage: '旅行阶段',
    faction_type: '派系类型',
    faction_leader: '派系首领',
    faction_name: '派系名称',
    faction_power: '派系实力',
    faction_discontent: '派系不满度',
    faction_size: '派系规模',
    faction_target_title: '派系目标头衔',
    faction_at_war: '派系战争状态',
    scheme_owner: '阴谋主使',
    scheme_target: '阴谋目标',
    scheme_target_title: '阴谋目标头衔',
    scheme_type: '阴谋类型',
    disaster_type: '灾害类型',
    tributary_realm: '朝贡领地',
    liege_title: '领主头衔',
    work_location: '工程地点',
    work_type: '工程类型',
    work_stage: '工程阶段',
    project_name: '重大工程名称',
    project_type: '重大工程类型',
    project_stage: '重大工程阶段',
    project_location: '重大工程地点',
    project_progress: '建设进度',
    project_days_left: '预计剩余天数',
    project_required_funded: '已筹足的必要出资',
    project_required_total: '必要出资总数',
    project_founder: '工程发起人',
    project_owner: '工程负责人',
    reporter_role: '汇报人身份',
    player_project_role: '收信人与工程的关系'
};

const POETRY_SENDER_SOURCE_LABELS: Record<string, string> = {
    friend: '朋友',
    lover: '情人',
    soulmate: '灵魂伴侣',
    spouse: '配偶',
    close_family: '近亲家人',
    court_poet: '宫廷诗人',
    realm_poet: '领地内的诗人',
    top_liege_realm_poet: '同一最高领主领地内的诗人'
};

const GREAT_PROJECT_STAGE_LABELS: Record<string, string> = {
    planned: '规划立项',
    started: '正式开工',
    halfway: '建设过半',
    completed: '竣工'
};

const GREAT_PROJECT_REPORTER_ROLE_LABELS: Record<string, string> = {
    founder: '工程发起人',
    owner: '工程负责人',
    minister_of_works: '工部尚书',
    courtier: '宫廷官员',
    vassal: '封臣'
};

const GREAT_PROJECT_PLAYER_ROLE_LABELS: Record<string, string> = {
    owner: '工程负责人',
    founder: '工程发起人',
    contributor: '工程出资者'
};

function describeSiegeFortLevel(value: string): string {
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    if (num <= 0) return '无城防';
    if (num === 1) return '城防薄弱';
    if (num === 2) return '城防较低';
    if (num === 3) return '城防中等';
    if (num === 4) return '城防较高';
    if (num === 5) return '城防很高';
    return '城防极高';
}

function describeSiegePhaseProgress(value: string): string {
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    if (num <= 0) return '刚刚开始';
    if (num < 30) return '处于初期';
    if (num < 60) return '处于中期';
    if (num < 90) return '处于后期';
    return '接近破城';
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

    // 1.x IncomingLetterGenerator.getSummaryTimeline parity: load the timeline
    // registry (campaign-scoped when the snapshot carries a v2 identity,
    // player-only legacy fallback otherwise) so summary reads filter
    // node-tagged records by branch and summary saves merge instead of
    // overwriting hidden sibling-branch records. F21 also exposes the
    // resolved campaign identity so summary reads/writes route into the
    // campaign namespace via summaryManager's identity parameter.
    private getSummaryTimeline(gameData: GameData): { registry: TimelineRegistry | undefined; currentNodeId: string | undefined; identity?: CampaignPlayerIdentity } {
        const persistence = new FsTimelinePersistence(app.getPath('userData'));
        let registry: TimelineRegistry | undefined;
        let identity: CampaignPlayerIdentity | undefined;
        try {
            identity = requireCampaignIdentity({
                playerID: gameData.playerID,
                timelineSnapshotResult: gameData.timelineSnapshotResult
            });
            const result = persistence.loadStoreWithIdentity(identity);
            registry = result.status === 'found' ? result.store : undefined;
        } catch {
            // Legacy snapshot: fall back to player-only display load.
            identity = undefined;
            registry = persistence.loadRegistry(String(gameData.playerID)) ?? undefined;
        }
        const context = registry
            ? resolveTimelineContext(registry, buildContextFromGameData(gameData))
            : buildContextFromGameData(gameData);
        return {
            registry,
            currentNodeId: context.timelineNodeId,
            identity
        };
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

        try {
            // Write the identity-independent gated fallback FIRST so a letter
            // degrades to fallback text even when the timeline transition
            // fails (e.g. campaign id not yet bootstrapped); the final run
            // file overwrites it on success. Audit fix: previously an
            // identity failure returned before any run file existed and the
            // delivery stalled until the slot cleanup.
            this.writeFallbackRunFile(userFolderPath, slotNumber, context.type, context.deliveryId, null);

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
                    return;
                }
                if (error instanceof TimelineRegistryCorruptError) {
                    reportCorruptTimelineRegistry(error);
                    return;
                }
                if (error instanceof UnsupportedTimelineSchemaError) {
                    reportUnsupportedTimelineSchema(error.schema);
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
                console.warn(`[IncomingLetterGenerator] Empty LLM response for ${signature}; fallback remains.`);
                return;
            }

            if (latestSignatureBySlot.get(slotId) !== signature) {
                console.log(`[IncomingLetterGenerator] Expired slot ${slotId}, skipping overwrite for ${signature}`);
                return;
            }

            const normalizedText = normalizeCk3String(response);
            this.writeFinalRunFile(userFolderPath, slotNumber, context.type, context.deliveryId, normalizedText, timeline);

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
        } finally {
            inFlight.delete(signature);
        }
    }

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
                        snapshotStartOffset: initStart,
                        snapshotEndOffset: contextLineEnd
                    };
                }

                searchFrom = contextStart - 1;
            }

            console.log(`[IncomingLetterGenerator] No matching context found for ${expectedSlotId}/${expectedType}/${expectedDeliveryId}`);
            return null;
        } catch (error) {
            console.error(`[IncomingLetterGenerator] Error parsing incoming letter context:`, error);
            return null;
        }
    }

    private async buildMessages(gameData: GameData, context: IncomingLetterContext): Promise<Message[]> {
        const player = gameData.characters.get(gameData.playerID);
        const sender = gameData.characters.get(context.senderId);

        if (!player || !sender) {
            throw new Error('Player or sender character data not found in gameData');
        }

        const pListLetter = require("../../../default_userdata/scripts/prompts/description/standard/pListLetter.js");
        const characterDescription = pListLetter(gameData);

        const topicLabel = TOPIC_LABELS[context.type];

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
                    `以下是之前与${player.fullName}相关的总结（按时间顺序）：`,
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
                    memoriesPrompt: "相关记忆：",
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

        const letterLanguage = this.config.language || '中文';
        let configuredInstruction = '';
        try {
            const effectivePrompts = getEffectivePrompts(this.config, this.getVotcDataRoot(), gameData);
            configuredInstruction = effectivePrompts?.incomingLetterPrompt ?? '';
        } catch (error) {
            console.warn(`[IncomingLetterGenerator] Failed to resolve effective prompts: ${error}`);
        }
        const instructionPrompt = (configuredInstruction || DEFAULT_INCOMING_LETTER_PROMPT)
            .replace(/\{\{\s*senderName\s*\}\}/g, sender.fullName)
            .replace(/\{\{\s*playerName\s*\}\}/g, player.fullName)
            .replace(/\{\{\s*letterLanguage\s*\}\}/g, letterLanguage);

        const factLines = Object.entries(context.facts)
            .filter(([key, value]) => !(key === 'siege_blocked' && value === 'no'))
            .filter(([key]) => key !== 'deceased_id')
            .map(([key, value]) => {
                let displayValue = value;
                if (key === 'siege_fort_level') {
                    displayValue = describeSiegeFortLevel(value);
                } else if (key === 'siege_phase_progress') {
                    displayValue = describeSiegePhaseProgress(value);
                } else if (key === 'siege_blocked') {
                    displayValue = value === 'yes' ? '是' : value;
                } else if (key === 'poetry_sender_source') {
                    displayValue = POETRY_SENDER_SOURCE_LABELS[value] || value;
                } else if (key === 'project_stage') {
                    displayValue = GREAT_PROJECT_STAGE_LABELS[value] || value;
                } else if (key === 'reporter_role') {
                    displayValue = GREAT_PROJECT_REPORTER_ROLE_LABELS[value] || value;
                } else if (key === 'player_project_role') {
                    displayValue = GREAT_PROJECT_PLAYER_ROLE_LABELS[value] || value;
                }
                return `- ${FACT_LABELS[key] || key}：${displayValue}`;
            })
            .join('\n');
        const eventFacts = factLines ? `${factLines}\n` : '';

        let topicReason = `因为${topicLabel}事项`;
        if (context.type === 'siege_report' && context.facts.siege_location) {
            topicReason = `因为正在围攻${context.facts.siege_location}，需要向${player.fullName}禀报军情`;
        } else if (context.type === 'lost_holding' && context.facts.lost_holding) {
            topicReason = `因为${context.facts.lost_holding}已经失守，需要向${player.fullName}告急`;
        } else if (context.type === 'vassal_memorial') {
            topicReason = `因为有事务需要向${player.fullName}禀报`;
        } else if (context.type === 'family_letter') {
            topicReason = `作为${player.fullName}的配偶或近亲，因为惦念对方或有家事想分享，所以写来家书`;
        } else if (context.type === 'poetry_letter') {
            const senderSource = POETRY_SENDER_SOURCE_LABELS[context.facts.poetry_sender_source] || '亲近之人或诗人';
            topicReason = `作为${player.fullName}的${senderSource}，有感而发，特意写下诗、词、歌、赋或符合自身文化传统的韵文赠予对方`;
        } else if (context.type === 'courtier_petition') {
            const petitionType = context.facts.petition_type;
            const petitionLabel: Record<string, string> = {
                marriage_request: '希望得到一桩美满的姻缘',
                land_grant: '希望获封一块土地',
                office_request: '希望能领一份俸禄官职',
                council_seat: '希望能进入御前会议',
                tax_relief: '因为生活困顿，希望减免个人税赋或役务',
                title_promotion: '希望能晋升自己的爵位',
                prisoner_release: '希望能释放被囚禁的至亲好友',
                hook_use: '希望玩家能兑现一个钩子',
                war_aid: '希望在战时得到军需支持、为领主效力',
                guardian_request: '希望能担任某位继承人的监护人',
                gift_request: '希望能得到一份赏赐',
                alliance_proposal: '希望能促成家族间的联姻'
            };
            const subReason = petitionLabel[petitionType] || '有事务想要请愿';
            topicReason = `因为${subReason}，所以向${player.fullName}写信请愿`;
        } else if (context.type === 'rival_taunt') {
            topicReason = `因为与${player.fullName}敌对，所以写信嘲讽或挑衅`;
        } else if (context.type === 'dear_friend_greeting') {
            topicReason = `因为思念${player.fullName}，所以写信问候`;
        } else if (context.type === 'letter_to_travelling_player') {
            topicReason = `因为${player.fullName}正在旅途中，所以写信关心`;
        } else if (context.type === 'ally_call_for_aid') {
            topicReason = `因为${context.facts.enemy || '敌人'}正在进攻，所以向${player.fullName}求援`;
        } else if (context.type === 'revolt_urgent') {
            topicReason = `因为${context.facts.defender || '领地'}遭遇叛乱，所以向${player.fullName}告急`;
        } else if (context.type === 'deathbed_letter') {
            const deceasedName = context.facts.deceased || '故人';
            if (context.facts.sender_role === 'deceased') {
                const categoryDesc = context.facts.death_category === 'disease' ? '因病离世' : '安详离世';
                topicReason = `因为${deceasedName}${categoryDesc}，留下临终遗言写给${player.fullName}`;
            } else {
                const categoryDesc = context.facts.death_category === 'disease' ? '因病离世' : '骤然离世';
                topicReason = `因为${deceasedName}${categoryDesc}，亲属写信向${player.fullName}报丧`;
            }
        } else if (context.type === 'pilgrimage_tales') {
            topicReason = `因为完成了朝圣，所以写信给${player.fullName}分享朝圣见闻`;
        } else if (context.type === 'tour_tales') {
            topicReason = `因为完成了巡游，所以写信给${player.fullName}分享巡游见闻`;
        } else if (context.type === 'wedding_tales') {
            topicReason = `因为参加了婚礼归来，所以写信给${player.fullName}分享婚礼见闻`;
        } else if (context.type === 'hunt_tales') {
            topicReason = `因为完成了狩猎，所以写信给${player.fullName}分享狩猎见闻`;
        } else if (context.type === 'tournament_tales') {
            topicReason = `因为参加了比武大会归来，所以写信给${player.fullName}分享比武见闻`;
        } else if (context.type === 'travel_tales') {
            topicReason = `因为完成了旅行，所以写信给${player.fullName}分享旅途见闻`;
        } else if (context.type === 'faction_warning') {
            const factionName = context.facts.faction_name || '某个匿名派系';
            const factionType = context.facts.faction_type;
            const factionTypeLabel: Record<string, string> = {
                populist_faction: '平民派系',
                peasant_faction: '农民派系',
                claimant_faction: '宣称派系',
                liberty_faction: '自由派系',
                independence_faction: '独立派系',
                nation_fracturing_faction: '裂国派系'
            };
            const typeLabel = (factionType && factionTypeLabel[factionType]) || '派系';
            const factionSize = context.facts.faction_size;
            const sizeLabel = factionSize === 'large' ? '势力庞大' :
                factionSize === 'medium' ? '颇具规模' :
                factionSize === 'small' ? '初具雏形' : '规模不明';
            const factionPower = context.facts.faction_power;
            const factionDiscontent = context.facts.faction_discontent;
            const factionAtWar = context.facts.faction_at_war === 'yes';
            const targetTitle = context.facts.faction_target_title;
            const factionLeader = context.facts.faction_leader;

            const parts: string[] = [`${typeLabel}「${factionName}」${sizeLabel}`];
            if (factionLeader) parts.push(`以${factionLeader}为首`);
            if (factionPower) parts.push(`实力约 ${factionPower}`);
            if (factionDiscontent) parts.push(`不满度 ${factionDiscontent}`);
            if (targetTitle) parts.push(`图谋夺取「${targetTitle}」`);
            parts.push(factionAtWar ? '已经公开举兵' : '尚未公开举兵');
            topicReason = `因为${parts.join('，')}，所以向${player.fullName}写信预警`;
        } else if (context.type === 'scheme_exposed') {
            const schemeTarget = context.facts.scheme_target || context.facts.scheme_target_title || '某人';
            topicReason = `因为一个针对${schemeTarget}的阴谋已经暴露，所以写信提醒${player.fullName}`;
        } else if (context.type === 'natural_disaster') {
            topicReason = `因为领地发生了${context.facts.disaster_type || '灾害'}，所以向${player.fullName}报告`;
        } else if (context.type === 'tributary_letter') {
            topicReason = `作为朝贡者，写信向宗主${player.fullName}致意`;
        } else if (context.type === 'liege_overlord_letter') {
            topicReason = `作为${player.fullName}的领主，写信传达旨意或要求`;
        } else if (context.type === 'great_work_notice') {
            topicReason = `因为${context.facts.work_location || '某地'}的${context.facts.work_type || '工程'}已经${context.facts.work_stage || '动工'}，所以向${player.fullName}报告`;
        } else if (context.type === 'great_project_report') {
            const projectName = context.facts.project_name || '一项国家重大工程';
            const projectStage = GREAT_PROJECT_STAGE_LABELS[context.facts.project_stage] || context.facts.project_stage || '取得新进展';
            const projectLocation = context.facts.project_location ? `位于${context.facts.project_location}的` : '';
            const reporterRole = GREAT_PROJECT_REPORTER_ROLE_LABELS[context.facts.reporter_role] || '工程相关官员';
            topicReason = `因为${projectLocation}国家重大工程“${projectName}”已经${projectStage}，所以作为${reporterRole}向${player.fullName}呈报工程进展`;
        }

        // For deathbed_letter with sender_role=mourner, the sender is the
        // mourner but the letter is about the deceased. Append the deceased's
        // basic info so the LLM can describe them accurately.
        let deceasedInfo = '';
        if (context.type === 'deathbed_letter' && context.facts.sender_role === 'mourner' && context.facts.deceased_id) {
            const deceasedChar = gameData.characters.get(Number(context.facts.deceased_id));
            if (deceasedChar) {
                deceasedInfo = `- 逝者基本信息：${deceasedChar.fullName}，${deceasedChar.age}岁，${deceasedChar.culture}人，${deceasedChar.faith}信徒\n`;
            }
        }

        const contextContent = `${characterDescription}\n\n${summaryContent}${memoryContent}`.trim();

        const categoryInstruction = context.type === 'poetry_letter'
            ? `这是一封“诗词歌赋”来信。正文主体必须是一首原创诗、词、歌、赋或符合发信人文化传统的短篇韵文，而不是普通寒暄书信；题材与语气应体现发信人的性格、文化、经历及其与收信人的关系。必须主动避开此前内容已经使用过的主题、立意、意象、典故、开头、句式和措辞，不得复述、改写或生成与此前作品近似、雷同的内容，每次都要采用新的构思与表达。可以有一句极短的题赠，但不要解释作品、不要标注体裁、不要虚构具体事件。`
            : '';

        const requestContent = `你正在扮演${sender.fullName}，向${player.fullName}主动写信。
${topicReason}，你决定提笔向${player.fullName}写信。
本次主题：${topicLabel}。
以下是已确认的游戏事实：
- 发信人：${sender.fullName}
- 收信人：${player.fullName}
- 发信日期：${context.sentDate}
- 主题：${topicLabel}
${eventFacts}${deceasedInfo}只使用上述已确认事实，不要编造未提供的地点、人物、战况或数字。

${instructionPrompt}
${categoryInstruction}`;

        // Stable rules first, dynamic context second, current request last,
        // so DeepSeek KV cache can reuse the fixed prefix across letters.
        const messages: Message[] = [
            { role: 'system', content: STABLE_INCOMING_LETTER_POLICY },
            { role: 'user', content: contextContent },
            { role: 'user', content: requestContent }
        ];

        return messages;
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
        const filePath = path.join(runFolderPath, `incomingletter_v2_${slotNumber}.txt`);
        const content = `if = {
\tlimit = {
\t\texists = global_var:votc_incoming_letter_${slotNumber}
\t\thas_variable = votc_incoming_letter_${slotNumber}_delivery_id
\t\tvar:votc_incoming_letter_${slotNumber}_delivery_id = ${deliveryId}
\t\tglobal_var:votc_incoming_letter_type_${slotNumber} = flag:${type}
\t}
${timelineSetBlock}\tsend_interface_message = {
\t\ttype = votc_message_popup
\t\ttitle = votc_incoming_letter_title${slotNumber}
\t\tdesc = votc_incoming_letter_fallback_desc
\t\tleft_icon = global_var:votc_incoming_letter_sender_${slotNumber}
\t}
\tremove_global_variable ?= votc_incoming_letter_${slotNumber}
\tremove_global_variable ?= votc_incoming_letter_sender_${slotNumber}
\tremove_global_variable ?= votc_incoming_letter_type_${slotNumber}
\tremove_variable ?= votc_incoming_letter_${slotNumber}_timer
\tremove_variable ?= votc_incoming_letter_${slotNumber}_sent_day
\tremove_variable ?= votc_incoming_letter_${slotNumber}_delivery_id
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
        const filePath = path.join(runFolderPath, `incomingletter_v2_${slotNumber}.txt`);
        const content = `if = {
\tlimit = {
\t\texists = global_var:votc_incoming_letter_${slotNumber}
\t\thas_variable = votc_incoming_letter_${slotNumber}_delivery_id
\t\tvar:votc_incoming_letter_${slotNumber}_delivery_id = ${deliveryId}
\t\tglobal_var:votc_incoming_letter_type_${slotNumber} = flag:${type}
\t}
${timelineSetBlock}\tsend_interface_message = {
\t\ttype = votc_message_popup
\t\ttitle = votc_incoming_letter_title${slotNumber}
\t\tdesc = "${normalizedText}"
\t\tleft_icon = global_var:votc_incoming_letter_sender_${slotNumber}
\t}
\tcreate_artifact = {
\t\tname = votc_incoming_letter_title${slotNumber}
\t\tdescription = "${normalizedText}"
\t\ttype = journal
\t\tvisuals = scroll
\t\tcreator = global_var:votc_incoming_letter_sender_${slotNumber}
\t\tmodifier = artifact_monthly_minor_prestige_1_modifier
\t}
\tremove_global_variable ?= votc_incoming_letter_${slotNumber}
\tremove_global_variable ?= votc_incoming_letter_sender_${slotNumber}
\tremove_global_variable ?= votc_incoming_letter_type_${slotNumber}
\tremove_variable ?= votc_incoming_letter_${slotNumber}_timer
\tremove_variable ?= votc_incoming_letter_${slotNumber}_sent_day
\tremove_variable ?= votc_incoming_letter_${slotNumber}_delivery_id
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

        const topicLabel = TOPIC_LABELS[context.type];
        const newSummary: Summary = {
            characterId: senderCharacterId,
            date: gameData.date,
            content: `[主动来信·${topicLabel}·${gameData.date}] ${normalizedText.slice(0, 600)}`,
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
