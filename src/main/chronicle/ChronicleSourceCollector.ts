import fs from 'fs';
import path from 'path';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import { parseCk3CalendarDate as parseLegacyCk3DisplayDate } from '../../shared/gameData/ck3Calendar.js';
import { readCanonicalConversationSources } from '../history/HistoryRecordReaders.js';
import { isRecordVisibleForContext, type TimelineRegistry } from '../timelineManager.js';
import {
    conversationHistoryDir,
    conversationSummariesDir,
    letterHistoryDir,
    battleReportHistoryPath
} from '../campaignDataPaths.js';
import { ChronicleMemoryStore } from './ChronicleMemoryStore.js';
import type { LetterHistoryRecordV1 as LetterReplyHistoryRecord } from '../history/historyRecordTypes.js';
import { resolveBattleReportGameDate } from '../battleReport/battleReportGameDate.js';
import type {
    ChronicleMemoryRecord,
    ChronicleSourceRecord
} from './chronicleTypes.js';

export interface CollectChronicleSourcesParams {
    userDataDir: string;
    identity: CampaignPlayerIdentity;
    playerId: string;
    registry?: TimelineRegistry;
    currentNodeId?: string;
    checkpointEpoch?: number;
    periodStart?: Ck3GameDate;
    periodEnd?: Ck3GameDate;
    firstBackfill: boolean;
}

interface ParsedConversationHeader {
    sourceRecordId?: string;
    gameDateTotalDays?: number;
    gameDateYear?: number;
    gameDateMonth?: number;
    gameDateDay?: number;
    displayDate?: string;
    checkpointEpoch?: number;
    timelineNode?: string;
    timelineParent?: string;
}

interface SummaryRecord {
    date?: string;
    content?: string;
    votcCheckpointEpoch?: number;
    votcTimelineNodeId?: string;
    votcTimelineParentId?: string;
    id?: string;
    characterName?: string;
    characterId?: string;
    sourceType?: string;
    sourceRecordId?: string;
    gameDate?: Ck3GameDate;
}

const SOURCE_RECORD_ID_PREFIX = 'VOTC source record id: ';
const GAME_DATE_TOTAL_DAYS_PREFIX = 'VOTC game date total days: ';
const GAME_DATE_PREFIX = 'VOTC game date: ';
const CHECKPOINT_PREFIX = 'VOTC checkpoint: ';
const TIMELINE_NODE_PREFIX = 'VOTC timeline node: ';
const TIMELINE_PARENT_PREFIX = 'VOTC timeline parent: ';

function getHistoryFileTimelineNodeId(fileName: string): string | undefined {
    const match = fileName.match(/_tl_(\d+)(?:-|_)(\d+)_/);
    return match ? `${match[1]}-${match[2]}` : undefined;
}

function getHistoryFileCheckpointEpoch(fileName: string): number | undefined {
    const match = fileName.match(/_ckpt(\d+)_/);
    if (!match) return undefined;
    const epoch = Number(match[1]);
    return Number.isFinite(epoch) ? epoch : undefined;
}

function parseConversationHeader(content: string, fileName: string): { header: ParsedConversationHeader; body: string } {
    const lines = content.split('\n');
    const header: ParsedConversationHeader = {};
    let bodyStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === '') {
            bodyStartIndex = i + 1;
            break;
        }
        if (line.startsWith(SOURCE_RECORD_ID_PREFIX)) {
            header.sourceRecordId = line.slice(SOURCE_RECORD_ID_PREFIX.length).trim();
        } else if (line.startsWith(GAME_DATE_TOTAL_DAYS_PREFIX)) {
            const raw = line.slice(GAME_DATE_TOTAL_DAYS_PREFIX.length).trim();
            const num = Number(raw);
            header.gameDateTotalDays = raw !== '' && Number.isFinite(num) ? num : undefined;
        } else if (line.startsWith(GAME_DATE_PREFIX)) {
            const raw = line.slice(GAME_DATE_PREFIX.length).trim();
            const parts = raw.split('-');
            if (parts.length === 3) {
                const y = Number(parts[0]);
                const m = Number(parts[1]);
                const d = Number(parts[2]);
                if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
                    header.gameDateYear = y;
                    header.gameDateMonth = m;
                    header.gameDateDay = d;
                }
            }
        } else if (line.startsWith(CHECKPOINT_PREFIX)) {
            const raw = line.slice(CHECKPOINT_PREFIX.length).trim();
            const num = Number(raw);
            header.checkpointEpoch = raw !== '' && Number.isFinite(num) ? num : undefined;
        } else if (line.startsWith(TIMELINE_NODE_PREFIX)) {
            const raw = line.slice(TIMELINE_NODE_PREFIX.length).trim();
            header.timelineNode = raw && raw !== 'unknown' ? raw : undefined;
        } else if (line.startsWith(TIMELINE_PARENT_PREFIX)) {
            const raw = line.slice(TIMELINE_PARENT_PREFIX.length).trim();
            header.timelineParent = raw && raw !== 'null' ? raw : undefined;
        } else if (line.includes(': ') && !line.startsWith('VOTC ')) {
            const colonIndex = line.indexOf(': ');
            if (colonIndex > 0) {
                header.displayDate = line.slice(colonIndex + 2).trim();
            }
        }
    }

    if (bodyStartIndex === 0) {
        bodyStartIndex = lines.length;
    }

    if (!header.timelineNode) {
        header.timelineNode = getHistoryFileTimelineNodeId(fileName);
    }
    if (header.checkpointEpoch === undefined) {
        header.checkpointEpoch = getHistoryFileCheckpointEpoch(fileName);
    }

    const body = lines.slice(bodyStartIndex).join('\n');
    return { header, body };
}

function resolveGameDateFromHeader(header: ParsedConversationHeader): { gameDate?: Ck3GameDate; legacyUndated: boolean } {
    if (header.gameDateTotalDays !== undefined
        && header.gameDateYear !== undefined
        && header.gameDateMonth !== undefined
        && header.gameDateDay !== undefined) {
        return {
            gameDate: {
                totalDays: header.gameDateTotalDays,
                year: header.gameDateYear,
                month: header.gameDateMonth,
                day: header.gameDateDay,
                display: header.displayDate ?? `${header.gameDateYear}.${header.gameDateMonth}.${header.gameDateDay}`
            },
            legacyUndated: false
        };
    }

    if (header.displayDate) {
        const parsed = parseLegacyCk3DisplayDate(header.displayDate);
        if (parsed) {
            return { gameDate: parsed, legacyUndated: false };
        }
    }

    return { gameDate: undefined, legacyUndated: true };
}

function isInPeriod(day: number | undefined, periodStart: Ck3GameDate | undefined, periodEnd: Ck3GameDate | undefined): boolean {
    if (periodStart === undefined || periodEnd === undefined) return true;
    if (day === undefined) return false;
    return day > periodStart.totalDays && day <= periodEnd.totalDays;
}

function stableSortSources(sources: ChronicleSourceRecord[]): ChronicleSourceRecord[] {
    return sources.sort((a, b) => {
        const dayA = a.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
        const dayB = b.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
        if (dayA !== dayB) return dayA - dayB;

        const epochA = a.votcCheckpointEpoch ?? -1;
        const epochB = b.votcCheckpointEpoch ?? -1;
        if (epochA !== epochB) return epochA - epochB;

        const createdA = a.createdAt ?? '';
        const createdB = b.createdAt ?? '';
        if (createdA !== createdB) return createdA.localeCompare(createdB);

        return a.id.localeCompare(b.id);
    });
}

function collectConversationSources(params: CollectChronicleSourcesParams): ChronicleSourceRecord[] {
    const dir = conversationHistoryDir(params.userDataDir, params.identity);
    if (!fs.existsSync(dir)) return [];

    const { bySourceId, legacySummaries } = readConversationSummaries(params.userDataDir, params.identity, params);
    const sources: ChronicleSourceRecord[] = [];

    // Plan task T8: canonical-first dual-layout read. Valid
    // `<nodeId>/conversation.json` records win over any mirrored `.txt`;
    // remaining `.txt` files are adapted as legacy records.
    const { sources: canonicalSources } = readCanonicalConversationSources(
        params.userDataDir,
        params.identity,
        'tolerant_for_chronicle'
    );

    for (const canonical of canonicalSources) {
        const timelineNode = canonical.votcTimelineNodeId;
        const checkpointEpoch = canonical.votcCheckpointEpoch;

        if (!isRecordVisibleForContext(
            params.registry,
            params.currentNodeId,
            { votcTimelineNodeId: timelineNode, votcCheckpointEpoch: checkpointEpoch },
            params.checkpointEpoch
        )) {
            continue;
        }

        let gameDate = canonical.gameDate;
        let legacyUndated = false;
        if (!gameDate && canonical.origin === 'legacy') {
            if (
                canonical.gameDateTotalDays !== undefined &&
                canonical.gameDateParts &&
                canonical.gameDateParts.year !== undefined
            ) {
                gameDate = {
                    totalDays: canonical.gameDateTotalDays,
                    year: canonical.gameDateParts.year,
                    month: canonical.gameDateParts.month,
                    day: canonical.gameDateParts.day,
                    display: canonical.displayDate ||
                        `${canonical.gameDateParts.year}.${canonical.gameDateParts.month}.${canonical.gameDateParts.day}`
                };
            } else if (canonical.displayDate) {
                const parsed = parseLegacyCk3DisplayDate(canonical.displayDate);
                if (parsed) {
                    gameDate = parsed;
                } else if (!canonical.sourceRecordId) {
                    legacyUndated = true;
                }
            } else if (!canonical.sourceRecordId) {
                legacyUndated = true;
            }
        }

        if (legacyUndated && !params.firstBackfill) continue;
        if (!legacyUndated && !isInPeriod(gameDate?.totalDays, params.periodStart, params.periodEnd)) continue;

        const participantsWithIds =
            canonical.origin === 'v1'
                ? canonical.characters.map(character => ({
                    id: character.characterId ?? undefined,
                    name: character.displayName
                }))
                : extractParticipantsFromBody(canonical.rawText).map((p, i) => ({
                    ...p,
                    id: p.id ?? extractCharacterIdsFromFileName(path.basename(canonical.logicalPath))[i]
                }));

        let existingSummary: string | undefined;
        let existingSummaryId: string | undefined;
        if (canonical.sourceRecordId) {
            const matched = bySourceId.get(canonical.sourceRecordId);
            if (matched) {
                existingSummary = matched.content;
                existingSummaryId = matched.id;
            }
        } else if (timelineNode !== undefined || checkpointEpoch !== undefined) {
            const matched = matchLegacySummary(legacySummaries, {
                timelineNode,
                checkpointEpoch,
                displayDate: canonical.displayDate,
                participants: participantsWithIds
            });
            if (matched) {
                existingSummary = matched.content;
                existingSummaryId = matched.id;
            }
        }

        sources.push({
            id: canonical.sourceRecordId ??
                (canonical.origin === 'legacy'
                    ? `conv:${path.basename(canonical.logicalPath)}`
                    : `conv:${canonical.nodeId ?? canonical.logicalPath}`),
            kind: 'conversation',
            gameDate: gameDate ?? undefined,
            legacyUndated,
            title: canonical.title !== '' ? canonical.title : 'Conversation',
            participants: participantsWithIds,
            rawText: canonical.rawText,
            existingSummary,
            existingSummaryId,
            votcCheckpointEpoch: checkpointEpoch,
            votcTimelineNodeId: timelineNode,
            votcTimelineParentId: canonical.votcTimelineParentId,
            createdAt: canonical.createdAt
        });
    }

    return sources;
}

function matchLegacySummary(
    summaries: SummaryRecord[],
    criteria: {
        timelineNode?: string;
        checkpointEpoch?: number;
        displayDate?: string;
        participants: Array<{ id?: string; name: string }>;
    }
): SummaryRecord | undefined {
    const candidates = summaries.filter(s => {
        if (criteria.timelineNode !== undefined && s.votcTimelineNodeId !== criteria.timelineNode) return false;
        if (criteria.checkpointEpoch !== undefined && s.votcCheckpointEpoch !== criteria.checkpointEpoch) return false;
        if (criteria.displayDate && s.date && s.date !== criteria.displayDate) return false;
        if (criteria.participants.length > 0 && s.characterName) {
            const matchesParticipant = criteria.participants.some(p => {
                if (p.id && s.characterId && p.id === s.characterId) return true;
                if (p.name && p.name === s.characterName) return true;
                return false;
            });
            if (!matchesParticipant) return false;
        }
        return true;
    });

    if (candidates.length === 1) return candidates[0];
    if (candidates.length >= 2) {
        console.warn(`[Chronicle] ambiguous legacy summary match: ${candidates.length} candidates`);
    }
    return undefined;
}

function readConversationSummaries(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    params: CollectChronicleSourcesParams
): { bySourceId: Map<string, SummaryRecord>; legacySummaries: SummaryRecord[] } {
    const dir = conversationSummariesDir(userDataDir, identity);
    const bySourceId = new Map<string, SummaryRecord>();
    const legacySummaries: SummaryRecord[] = [];
    if (!fs.existsSync(dir)) return { bySourceId, legacySummaries };

    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
        const filePath = path.join(dir, file);
        let records: any[];
        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            records = Array.isArray(parsed) ? parsed : [];
        } catch {
            continue;
        }

        const characterId = path.basename(file, '.json');
        for (const record of records) {
            if (!record || typeof record !== 'object') continue;
            const summary: SummaryRecord = { ...record, characterId };
            if (!isRecordVisibleForContext(
                params.registry,
                params.currentNodeId,
                { votcTimelineNodeId: summary.votcTimelineNodeId, votcCheckpointEpoch: summary.votcCheckpointEpoch },
                params.checkpointEpoch
            )) {
                continue;
            }
            if (summary.sourceRecordId) {
                if (!bySourceId.has(summary.sourceRecordId)) {
                    bySourceId.set(summary.sourceRecordId, summary);
                }
            } else {
                legacySummaries.push(summary);
            }
        }
    }

    return { bySourceId, legacySummaries };
}

function extractParticipantsFromBody(body: string): Array<{ id?: string; name: string }> {
    const seen = new Map<string, { id?: string; name: string }>();
    const lines = body.split('\n');
    for (const line of lines) {
        const colonIndex = line.indexOf(': ');
        if (colonIndex <= 0) continue;
        const name = line.slice(0, colonIndex).trim();
        if (!name || name.startsWith('[')) continue;
        if (!seen.has(name)) {
            seen.set(name, { name });
        }
    }
    return Array.from(seen.values());
}

function collectMemorySources(
    params: CollectChronicleSourcesParams,
    relevantOwnerIds: Set<string>
): ChronicleSourceRecord[] {
    const store = new ChronicleMemoryStore(params.userDataDir, params.identity);

    const memories = store.queryVisibleMemories({
        registry: params.registry,
        currentNodeId: params.currentNodeId,
        checkpointEpoch: params.checkpointEpoch,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        relevantOwnerIds
    });

    return memories.map(record => projectMemoryToSource(record));
}

/**
 * Derive the relevant owner set from already-collected conversation, letter and
 * battle report sources, plus the player id. This replaces the former parallel
 * re-scan of the same files (C1 fix): the participant arrays on the collected
 * `ChronicleSourceRecord` entries now carry the character ids we need.
 */
function computeRelevantOwnerIdsFromSources(
    sources: ChronicleSourceRecord[],
    playerId: string
): Set<string> {
    const ids = new Set<string>();
    ids.add(playerId);
    for (const source of sources) {
        for (const p of source.participants) {
            if (p.id) ids.add(String(p.id));
        }
        // Battle report records also carry commander / notable-character ids in
        // a side channel that is not projected into `participants`; collect
        // those here so the relevant set still covers them.
        if (source.kind === 'battle_report') {
            const extras = source.battleReportCharacterIds;
            if (extras) {
                for (const id of extras) ids.add(String(id));
            }
        }
    }
    return ids;
}

function extractCharacterIdsFromFileName(fileName: string): string[] {
    const ids: string[] = [];
    const match = fileName.match(/^(\d+)_(\d+)_/);
    if (match) {
        ids.push(match[1]);
        ids.push(match[2]);
    }
    return ids;
}

function projectMemoryToSource(record: ChronicleMemoryRecord): ChronicleSourceRecord {
    const frozen = record.frozen;
    return {
        id: record.memoryKey,
        kind: 'character_memory',
        gameDate: record.creationDate,
        legacyUndated: false,
        title: frozen.memoryName,
        participants: record.participantIds.map(id => ({ id, name: id })),
        rawText: frozen.description,
        memoryKey: record.memoryKey,
        memoryIdentityAnchor: record.identityAnchor,
        memoryCollisionSlot: record.collisionSlot,
        memoryOwnerId: record.ownerId,
        memoryCapturedAt: frozen.capturedAt,
        memoryCapturedGameDate: frozen.capturedGameDate,
        memoryTextFrozen: true,
        relevanceWeight: frozen.relevanceWeight,
        votcCheckpointEpoch: frozen.capturedCheckpointEpoch,
        votcTimelineNodeId: frozen.capturedTimelineNodeId,
        votcTimelineParentId: frozen.capturedTimelineParentId,
        createdAt: frozen.capturedAt
    };
}

function collectLetterSources(params: CollectChronicleSourcesParams): ChronicleSourceRecord[] {
    const dir = letterHistoryDir(params.userDataDir, params.identity);
    if (!fs.existsSync(dir)) return [];

    const sources: ChronicleSourceRecord[] = [];
    const seenSourceIds = new Set<string>();

    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
        const filePath = path.join(dir, file);
        let records: LetterReplyHistoryRecord[];
        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            records = Array.isArray(parsed) ? parsed : [];
        } catch {
            continue;
        }

        for (const record of records) {
            if (!record || typeof record !== 'object') continue;
            const isIncoming = (record as any).direction === 'incoming';
            const sourceRecordId = record.sourceRecordId;

            if (!isRecordVisibleForContext(
                params.registry,
                params.currentNodeId,
                { votcTimelineNodeId: record.votcTimelineNodeId, votcCheckpointEpoch: record.votcCheckpointEpoch },
                params.checkpointEpoch
            )) {
                continue;
            }

            const rawGameDate = record.gameDate as Ck3GameDate | undefined;
            const gameDate = rawGameDate ?? parseLegacyCk3DisplayDate((record as any).date);
            const legacyUndated = !gameDate && !sourceRecordId;

            if (legacyUndated && !params.firstBackfill) continue;
            if (!legacyUndated && !isInPeriod(gameDate?.totalDays, params.periodStart, params.periodEnd)) continue;

            if (isIncoming) {
                const incoming = record as any;
                const id = sourceRecordId ?? `letter_incoming:${file}:${incoming.id ?? ''}`;
                if (sourceRecordId && seenSourceIds.has(sourceRecordId)) continue;
                if (sourceRecordId) seenSourceIds.add(sourceRecordId);
                sources.push({
                    id,
                    kind: 'incoming_letter',
                    gameDate,
                    legacyUndated,
                    title: incoming.senderName ?? 'Unknown sender',
                    participants: [
                        { id: incoming.senderId ? String(incoming.senderId) : undefined, name: incoming.senderName ?? 'Unknown' },
                        { id: incoming.receiverId ? String(incoming.receiverId) : undefined, name: incoming.receiverName ?? 'Unknown' }
                    ],
                    rawText: incoming.content ?? '',
                    votcCheckpointEpoch: incoming.votcCheckpointEpoch,
                    votcTimelineNodeId: incoming.votcTimelineNodeId,
                    votcTimelineParentId: incoming.votcTimelineParentId,
                    createdAt: incoming.createdAt
                });
            } else {
                const id = sourceRecordId ?? `letter_outgoing:${file}:${record.createdAt ?? ''}`;
                if (sourceRecordId && seenSourceIds.has(sourceRecordId)) continue;
                if (sourceRecordId) seenSourceIds.add(sourceRecordId);

                const rawText = `${record.playerName ?? 'Player'}:\n${record.playerLetter ?? ''}\n\n${record.aiName ?? 'Recipient'}:\n${record.aiReply ?? ''}`;
                sources.push({
                    id,
                    kind: 'outgoing_letter',
                    gameDate,
                    legacyUndated,
                    title: record.aiName ?? 'Letter',
                    participants: [
                        { id: record.senderId ? String(record.senderId) : undefined, name: record.playerName ?? 'Player' },
                        { id: record.receiverId ? String(record.receiverId) : undefined, name: record.aiName ?? 'Recipient' }
                    ],
                    rawText,
                    votcCheckpointEpoch: record.votcCheckpointEpoch,
                    votcTimelineNodeId: record.votcTimelineNodeId,
                    votcTimelineParentId: record.votcTimelineParentId,
                    createdAt: record.createdAt
                });
            }
        }
    }

    return sources;
}

function collectBattleReportSources(params: CollectChronicleSourcesParams): ChronicleSourceRecord[] {
    const filePath = battleReportHistoryPath(params.userDataDir, params.identity);
    if (!fs.existsSync(filePath)) return [];

    let records: any[];
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        records = Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }

    const sources: ChronicleSourceRecord[] = [];
    for (const record of records) {
        if (!record || typeof record !== 'object') continue;
        if (!isRecordVisibleForContext(
            params.registry,
            params.currentNodeId,
            { votcTimelineNodeId: record.votcTimelineNodeId, votcCheckpointEpoch: record.votcCheckpointEpoch },
            params.checkpointEpoch
        )) {
            continue;
        }

        // Prefer the battle block's own date when it disagrees with the
        // structured date captured from a stale general GameData snapshot.
        // This also repairs affected history records at read time.
        const gameDate = resolveBattleReportGameDate(record.date, record.gameDate);
        const legacyUndated = !gameDate && !record.sourceRecordId;

        if (legacyUndated && !params.firstBackfill) continue;
        if (!legacyUndated && !isInPeriod(gameDate?.totalDays, params.periodStart, params.periodEnd)) continue;

        // Collect character ids from the record that are not represented in the
        // projected `participants` (which only carries winner/loser names). The
        // relevant-owner-set derivation reads this side channel so battle-derived
        // memories are still picked up without re-reading the file (C1 fix).
        const battleReportCharacterIds: string[] = [];
        if (record.winnerId) battleReportCharacterIds.push(String(record.winnerId));
        if (record.loserId) battleReportCharacterIds.push(String(record.loserId));
        if (Array.isArray(record.commanders)) {
            for (const cmd of record.commanders) {
                if (cmd?.id) battleReportCharacterIds.push(String(cmd.id));
            }
        }
        if (Array.isArray(record.notableCharacters)) {
            for (const ch of record.notableCharacters) {
                if (ch?.id) battleReportCharacterIds.push(String(ch.id));
            }
        }

        const id = record.sourceRecordId ?? `battle:${record.id ?? record.dedupKey ?? ''}`;
        sources.push({
            id,
            kind: 'battle_report',
            gameDate,
            legacyUndated,
            title: record.location ?? 'Unknown battlefield',
            participants: [
                { id: record.winnerId ? String(record.winnerId) : undefined, name: record.winnerName ?? '' },
                { id: record.loserId ? String(record.loserId) : undefined, name: record.loserName ?? '' }
            ].filter(p => p.name),
            battleReportCharacterIds,
            rawText: record.content ?? '',
            votcCheckpointEpoch: record.votcCheckpointEpoch,
            votcTimelineNodeId: record.votcTimelineNodeId,
            votcTimelineParentId: record.votcTimelineParentId,
            createdAt: record.createdAt
        });
    }

    return sources;
}

export function collectChronicleSources(params: CollectChronicleSourcesParams): ChronicleSourceRecord[] {
    const conversation = collectConversationSources(params);
    const letter = collectLetterSources(params);
    const battle = collectBattleReportSources(params);

    const relevantOwnerIds = computeRelevantOwnerIdsFromSources(
        [...conversation, ...letter, ...battle],
        params.playerId
    );
    const memory = collectMemorySources(params, relevantOwnerIds);

    return stableSortSources([...conversation, ...memory, ...letter, ...battle]);
}
