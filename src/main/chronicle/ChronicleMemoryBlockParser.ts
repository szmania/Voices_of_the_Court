import { ck3DateFromTotalDays as totalDaysToDate } from '../../shared/gameData/ck3Calendar.js';
import * as fs from 'fs';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';

import { removeTooltip } from '../../shared/gameData/ck3Text.js';
import type { ChronicleMemoryObservationInput } from './chronicleTypes.js';

export const CHRONICLE_MEMORY_LOG_PREFIX = 'VOTC:CHRONICLE_MEMORY';

const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_TIMEOUT_MS = 2000;

export interface ChronicleMemoryBlockRecord {
    requestId: number;
    playerId: string;
    currentDateTotalDays: number;
    memories: ChronicleMemoryBlockMemory[];
}

export interface ChronicleMemoryBlockMemory {
    snapshotOrdinal: number;
    ownerId: string;
    ownerName: string;
    memoryTypeToken: string;
    memoryName: string;
    creationDate?: Ck3GameDate;
    creationDateDisplay: string;
    description: string;
    relevanceWeight: number;
    participantIds: Array<string | number>;
}

export type ChronicleMemoryBlockResult =
    | { status: 'complete'; requestId: number; playerId: string; currentDateTotalDays: number; memories: ChronicleMemoryBlockMemory[] }
    | { status: 'incomplete'; reason: string }
    | { status: 'invalid'; reason: string }
    | { status: 'memory_snapshot_unavailable'; reason: string };

interface ParsedStartLine {
    requestId: number;
    playerId: string;
    currentDateTotalDays: number;
}

interface ParsedMemoryLine {
    requestId: number;
    ordinal: number;
    ownerId: string;
    ownerName: string;
    typeToken: string;
    memoryName: string;
    creationTotalDays: number;
    creationDisplay: string;
    description: string;
    relevance: number;
    participantCount: number;
}

interface ParsedParticipantLine {
    requestId: number;
    ordinal: number;
    participantId: string | number;
}

interface ParsedEndLine {
    requestId: number;
    memoryCount: number;
}

interface MemoryRow {
    parsed: ParsedMemoryLine;
    actualParticipantIds: Array<string | number>;
}

function isChronicleMemoryLine(line: string): boolean {
    return line.includes(CHRONICLE_MEMORY_LOG_PREFIX);
}

function splitChronicleMemoryLine(line: string): string[] | undefined {
    if (!isChronicleMemoryLine(line)) return undefined;
    const payloadStart = line.indexOf(CHRONICLE_MEMORY_LOG_PREFIX);
    return line.slice(payloadStart).split('/;/');
}

function tryParseInt(value: string | undefined, label: string): number | { error: string } {
    if (value === undefined) return { error: `${label} is missing` };
    const trimmed = value.trim();
    if (trimmed === '') return { error: `${label} is missing` };
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed)) return { error: `${label} is not an integer: "${value}"` };
    return parsed;
}

function parseStartLine(parts: string[]): ParsedStartLine | { error: string } {
    const requestId = tryParseInt(parts[2], 'start request id');
    if (typeof requestId !== 'number') return { error: requestId.error };
    const playerId = (parts[3] ?? '').trim();
    if (playerId === '') return { error: 'start line missing player id' };
    const dateDays = tryParseInt(parts[4], 'start current date total days');
    if (typeof dateDays !== 'number') return { error: dateDays.error };
    return { requestId, playerId, currentDateTotalDays: dateDays };
}

function parseMemoryLine(parts: string[]): ParsedMemoryLine | { error: string } {
    const requestId = tryParseInt(parts[2], 'memory request id');
    if (typeof requestId !== 'number') return { error: requestId.error };
    const ordinal = tryParseInt(parts[3], 'memory ordinal');
    if (typeof ordinal !== 'number') return { error: ordinal.error };
    const ownerId = (parts[4] ?? '').trim();
    const ownerName = removeTooltip(parts[5] ?? '');
    const typeToken = removeTooltip(parts[6] ?? '');
    const memoryName = removeTooltip(parts[7] ?? '');
    const creationTotalDays = tryParseInt(parts[8], 'memory creation total days');
    if (typeof creationTotalDays !== 'number') return { error: creationTotalDays.error };
    const creationDisplay = removeTooltip(parts[9] ?? '');
    const description = removeTooltip(parts[10] ?? '');
    const relevance = tryParseInt(parts[11], 'memory relevance');
    if (typeof relevance !== 'number') return { error: relevance.error };
    const participantCount = tryParseInt(parts[12], 'memory participant count');
    if (typeof participantCount !== 'number') return { error: participantCount.error };
    return {
        requestId,
        ordinal,
        ownerId,
        ownerName,
        typeToken,
        memoryName,
        creationTotalDays,
        creationDisplay,
        description,
        relevance,
        participantCount
    };
}

function parseParticipantLine(parts: string[]): ParsedParticipantLine | { error: string } {
    const requestId = tryParseInt(parts[2], 'participant request id');
    if (typeof requestId !== 'number') return { error: requestId.error };
    const ordinal = tryParseInt(parts[3], 'participant ordinal');
    if (typeof ordinal !== 'number') return { error: ordinal.error };
    const participantRaw = (parts[4] ?? '').trim();
    if (participantRaw === '') return { error: 'participant id is missing' };
    const asNum = Number(participantRaw);
    const participantId: string | number = Number.isInteger(asNum) ? asNum : participantRaw;
    return { requestId, ordinal, participantId };
}

function parseEndLine(parts: string[]): ParsedEndLine | { error: string } {
    const requestId = tryParseInt(parts[2], 'end request id');
    if (typeof requestId !== 'number') return { error: requestId.error };
    const memoryCount = tryParseInt(parts[3], 'end memory count');
    if (typeof memoryCount !== 'number') return { error: memoryCount.error };
    return { requestId, memoryCount };
}

function buildGameDate(totalDays: number, display: string): Ck3GameDate {
    const { year, month, day } = totalDaysToDate(totalDays);
    return { totalDays, year, month, day, display };
}

export function parseChronicleMemoryBlock(
    lines: string[],
    requestId: number
): ChronicleMemoryBlockResult {
    let start: ParsedStartLine | undefined;
    const rows: MemoryRow[] = [];
    const ordinalsSeen = new Set<number>();
    let end: ParsedEndLine | undefined;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        const parts = splitChronicleMemoryLine(line);
        if (parts === undefined) continue;

        const kind = parts[1]?.trim();

        if (kind === 'start') {
            const parsed = parseStartLine(parts);
            if ('error' in parsed) {
                return { status: 'invalid', reason: parsed.error };
            }
            if (parsed.requestId === requestId) {
                if (start !== undefined) {
                    return { status: 'incomplete', reason: 'a second start line interrupted the block before end' };
                }
                start = parsed;
            }
            continue;
        }

        if (start === undefined) continue;

        if (kind === 'memory') {
            const parsed = parseMemoryLine(parts);
            if ('error' in parsed) {
                return { status: 'invalid', reason: parsed.error };
            }
            if (parsed.requestId !== requestId) continue;
            if (ordinalsSeen.has(parsed.ordinal)) {
                return { status: 'invalid', reason: `duplicate snapshot ordinal ${parsed.ordinal} within block` };
            }
            if (parsed.ownerId === '') {
                return { status: 'invalid', reason: 'memory owner id is empty' };
            }
            if (parsed.creationTotalDays <= 0) {
                return { status: 'invalid', reason: `creationTotalDays must be positive: ${parsed.creationTotalDays}` };
            }
            if (parsed.typeToken === '') {
                return { status: 'invalid', reason: 'memory type token is empty' };
            }
            if (parsed.description === '') {
                return { status: 'invalid', reason: 'memory description is empty' };
            }
            ordinalsSeen.add(parsed.ordinal);
            rows.push({ parsed, actualParticipantIds: [] });
            continue;
        }

        if (kind === 'participant') {
            const parsed = parseParticipantLine(parts);
            if ('error' in parsed) {
                return { status: 'invalid', reason: parsed.error };
            }
            if (parsed.requestId !== requestId) continue;
            const row = rows.find(r => r.parsed.ordinal === parsed.ordinal);
            if (row === undefined) {
                return { status: 'invalid', reason: `participant for unknown ordinal ${parsed.ordinal}` };
            }
            row.actualParticipantIds.push(parsed.participantId);
            continue;
        }

        if (kind === 'end') {
            const parsed = parseEndLine(parts);
            if ('error' in parsed) {
                return { status: 'invalid', reason: parsed.error };
            }
            if (parsed.requestId !== requestId) continue;
            end = parsed;
            break;
        }
    }

    if (start === undefined || end === undefined) {
        return { status: 'incomplete', reason: 'missing start or end line' };
    }

    for (const row of rows) {
        if (row.actualParticipantIds.length !== row.parsed.participantCount) {
            return { status: 'invalid', reason: `participant count mismatch for ordinal ${row.parsed.ordinal}: declared ${row.parsed.participantCount}, got ${row.actualParticipantIds.length}` };
        }
    }

    if (end.memoryCount !== rows.length) {
        return { status: 'invalid', reason: `end memory count ${end.memoryCount} does not match parsed memory count ${rows.length}` };
    }

    const memories: ChronicleMemoryBlockMemory[] = rows.map(row => ({
        snapshotOrdinal: row.parsed.ordinal,
        ownerId: row.parsed.ownerId,
        ownerName: row.parsed.ownerName,
        memoryTypeToken: row.parsed.typeToken,
        memoryName: row.parsed.memoryName,
        creationDate: buildGameDate(row.parsed.creationTotalDays, row.parsed.creationDisplay),
        creationDateDisplay: row.parsed.creationDisplay,
        description: row.parsed.description,
        relevanceWeight: row.parsed.relevance,
        participantIds: row.actualParticipantIds
    }));

    return {
        status: 'complete',
        requestId: start.requestId,
        playerId: start.playerId,
        currentDateTotalDays: start.currentDateTotalDays,
        memories
    };
}

export function findChronicleMemoryBlock(
    logContent: string,
    requestId: number
): ChronicleMemoryBlockResult {
    const lines = logContent.split(/\r?\n/);

    const blockStarts: number[] = [];
    for (let i = 0; i < lines.length; i++) {
        const parts = splitChronicleMemoryLine(lines[i].trim());
        if (parts === undefined) continue;
        const kind = parts[1]?.trim();
        if (kind === 'start') {
            const parsed = parseStartLine(parts);
            if (!('error' in parsed) && parsed.requestId === requestId) {
                blockStarts.push(i);
            }
        }
    }

    if (blockStarts.length === 0) {
        return { status: 'incomplete', reason: `no start line for request id ${requestId}` };
    }

    const lastStart = blockStarts[blockStarts.length - 1];

    for (let end = lastStart + 1; end <= lines.length; end++) {
        if (end === lines.length) {
            return parseChronicleMemoryBlock(lines.slice(lastStart), requestId);
        }
        const parts = splitChronicleMemoryLine(lines[end].trim());
        if (parts === undefined) continue;
        const kind = parts[1]?.trim();
        if (kind === 'start') {
            const parsed = parseStartLine(parts);
            if (!('error' in parsed) && parsed.requestId === requestId) {
                return parseChronicleMemoryBlock(lines.slice(lastStart, end), requestId);
            }
        }
        if (kind === 'end') {
            const parsed = parseEndLine(parts);
            if (!('error' in parsed) && parsed.requestId === requestId) {
                return parseChronicleMemoryBlock(lines.slice(lastStart, end + 1), requestId);
            }
        }
    }

    return parseChronicleMemoryBlock(lines.slice(lastStart), requestId);
}

export async function waitForChronicleMemoryBlock(
    logPath: string,
    requestId: number,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ChronicleMemoryBlockResult> {
    const interval = DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;
    let lastSize = -1;

    while (Date.now() < deadline) {
        let content: string | undefined;
        try {
            const stat = fs.statSync(logPath);
            if (stat.size !== lastSize) {
                lastSize = stat.size;
                content = fs.readFileSync(logPath, 'utf8');
            }
        } catch {
            content = undefined;
        }

        if (content !== undefined) {
            const result = findChronicleMemoryBlock(content, requestId);
            if (result.status === 'complete' || result.status === 'invalid') {
                return result;
            }
        }

        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await sleep(Math.min(interval, remaining));
    }

    return {
        status: 'memory_snapshot_unavailable',
        reason: `timed out waiting for chronicle memory block for request id ${requestId}`
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function blockRecordToObservationInputs(
    block: ChronicleMemoryBlockRecord,
    options: {
        observedAt: string;
        observedGameDate?: Ck3GameDate;
        votcCheckpointEpoch?: number;
        votcTimelineNodeId?: string;
        votcTimelineParentId?: string;
        captureLanguage?: string;
    }
): ChronicleMemoryObservationInput[] {
    const memoryTypeTokenSource = 'localized_name';
    return block.memories.map(mem => ({
        ownerId: mem.ownerId,
        ownerName: mem.ownerName,
        memoryTypeToken: mem.memoryTypeToken,
        memoryTypeTokenSource,
        memoryName: mem.memoryName,
        description: mem.description,
        creationDate: mem.creationDate,
        creationDateDisplay: mem.creationDateDisplay,
        relevanceWeight: mem.relevanceWeight,
        participantIds: mem.participantIds,
        snapshotOrdinal: mem.snapshotOrdinal,
        observedGameDate: options.observedGameDate,
        observationSource: 'chronicle_tick' as const,
        observedAt: options.observedAt,
        votcCheckpointEpoch: options.votcCheckpointEpoch,
        votcTimelineNodeId: options.votcTimelineNodeId,
        votcTimelineParentId: options.votcTimelineParentId,
        captureLanguage: options.captureLanguage
    }));
}
