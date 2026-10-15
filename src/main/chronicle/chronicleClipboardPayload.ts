import {
    parseTimelineSnapshot,
    type TimelineProtocolTail
} from '../../shared/gameData/timelineProtocol.js';
import {
    formatCk3GameDate,
    type Ck3GameDate
} from '../../shared/gameData/gameDate.js';

export const CHRONICLE_CLIPBOARD_FIELD_COUNT = 25;
const MANAGER_CORE_FIELD_COUNT = 9;
const PROTOCOL_TAIL_FIELD_COUNT = 8;
const CHRONICLE_FIELD_START = MANAGER_CORE_FIELD_COUNT + PROTOCOL_TAIL_FIELD_COUNT;

export type ChronicleSignalKind = 'quarterly' | 'yearly' | 'manual';

export interface ChronicleClipboardPayload {
    playerId: string;
    playerName?: string;
    checkpointEpoch?: number;
    timelineNodeA?: number;
    timelineNodeB?: number;
    timelineParentA?: number;
    timelineParentB?: number;
    checkpointToken?: number;
    pendingCheckpointToken?: number;
    protocol: TimelineProtocolTail;
    signalKind: ChronicleSignalKind;
    currentDateTotalDays: number;
    currentYear: number;
    currentMonth: number;
    currentDay: number;
    pulseQuarter: number;
    playerPrimaryTitle: string;
    memoryRequestId: number;
}

export type ChronicleClipboardParseResult =
    | { status: 'valid'; payload: ChronicleClipboardPayload }
    | { status: 'truncated'; expected: number; actual: number }
    | { status: 'invalid'; reason: string }
    | { status: 'unsupported-schema'; schema: number };

const VALID_SIGNAL_KINDS: ReadonlySet<string> = new Set(['quarterly', 'yearly', 'manual']);

export function parseChronicleClipboardPayload(
    payloads: readonly (string | undefined)[] | undefined
): ChronicleClipboardParseResult {
    const fields = payloads ?? [];

    if (fields.length < CHRONICLE_CLIPBOARD_FIELD_COUNT) {
        return {
            status: 'truncated',
            expected: CHRONICLE_CLIPBOARD_FIELD_COUNT,
            actual: fields.length
        };
    }

    const snapshotResult = parseTimelineSnapshot(fields, 'manager');
    switch (snapshotResult.status) {
        case 'truncated':
        case 'invalid':
        case 'unsupported-schema':
            return snapshotResult;
        case 'legacy':
            return {
                status: 'invalid',
                reason: 'chronicle tick requires protocol v2 tail (old protocol rejected)'
            };
        case 'valid':
            break;
    }

    const snapshot = snapshotResult.snapshot;

    if (!snapshot.playerId) {
        return { status: 'invalid', reason: 'missing player id' };
    }

    const at = (index: number): string | undefined => {
        const value = fields[index];
        if (value === undefined) return undefined;
        const trimmed = value.trim();
        return trimmed === '' ? undefined : trimmed;
    };

    const signalKindRaw = at(CHRONICLE_FIELD_START + 0);
    if (signalKindRaw === undefined) {
        return { status: 'invalid', reason: 'missing signal kind' };
    }
    if (!VALID_SIGNAL_KINDS.has(signalKindRaw)) {
        return { status: 'invalid', reason: `unknown signal kind: "${signalKindRaw}"` };
    }
    const signalKind = signalKindRaw as ChronicleSignalKind;

    const currentDateTotalDays = parseStrictInt(at(CHRONICLE_FIELD_START + 1), 'current date total days');
    if (typeof currentDateTotalDays !== 'number') return { status: 'invalid', reason: currentDateTotalDays };
    const currentYear = parseStrictInt(at(CHRONICLE_FIELD_START + 2), 'current year');
    if (typeof currentYear !== 'number') return { status: 'invalid', reason: currentYear };
    const currentMonth = parseStrictInt(at(CHRONICLE_FIELD_START + 3), 'current month');
    if (typeof currentMonth !== 'number') return { status: 'invalid', reason: currentMonth };
    const currentDay = parseStrictInt(at(CHRONICLE_FIELD_START + 4), 'current day');
    if (typeof currentDay !== 'number') return { status: 'invalid', reason: currentDay };

    if (!isValidDate(currentYear, currentMonth, currentDay)) {
        return { status: 'invalid', reason: `invalid date: ${currentYear}.${currentMonth}.${currentDay}` };
    }
    if (currentDateTotalDays <= 0) {
        return { status: 'invalid', reason: `current date total days must be a positive integer: ${currentDateTotalDays}` };
    }

    const pulseQuarter = parseStrictInt(at(CHRONICLE_FIELD_START + 5), 'pulse quarter');
    if (typeof pulseQuarter !== 'number') return { status: 'invalid', reason: pulseQuarter };
    if (pulseQuarter < 1 || pulseQuarter > 4) {
        return { status: 'invalid', reason: `pulse quarter must be between 1 and 4: ${pulseQuarter}` };
    }

    const playerPrimaryTitle = at(CHRONICLE_FIELD_START + 6) ?? '';

    const memoryRequestId = parseStrictInt(at(CHRONICLE_FIELD_START + 7), 'memory request id');
    if (typeof memoryRequestId !== 'number') return { status: 'invalid', reason: memoryRequestId };
    if (memoryRequestId === 0) {
        return { status: 'invalid', reason: 'memory request id is 0 (no snapshot requested)' };
    }

    return {
        status: 'valid',
        payload: {
            playerId: snapshot.playerId,
            playerName: snapshot.playerName,
            checkpointEpoch: snapshot.epoch,
            timelineNodeA: snapshot.nodeA,
            timelineNodeB: snapshot.nodeB,
            timelineParentA: snapshot.parentA,
            timelineParentB: snapshot.parentB,
            checkpointToken: snapshot.checkpointToken,
            pendingCheckpointToken: snapshot.pendingCheckpointToken,
            protocol: snapshot.protocol,
            signalKind,
            currentDateTotalDays,
            currentYear,
            currentMonth,
            currentDay,
            pulseQuarter,
            playerPrimaryTitle,
            memoryRequestId
        }
    };
}

export function gameDateFromChroniclePayload(
    payload: Pick<
        ChronicleClipboardPayload,
        'currentDateTotalDays' | 'currentYear' | 'currentMonth' | 'currentDay'
    >
): Ck3GameDate {
    const date: Ck3GameDate = {
        totalDays: payload.currentDateTotalDays,
        year: payload.currentYear,
        month: payload.currentMonth,
        day: payload.currentDay,
        display: ''
    };
    return {
        ...date,
        display: formatCk3GameDate(date)
    };
}

function parseStrictInt(value: string | undefined, label: string): number | string {
    if (value === undefined) {
        return `${label} is missing`;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        return `${label} is not an integer: "${value}"`;
    }
    return parsed;
}

function isValidDate(year: number, month: number, day: number): boolean {
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const maxDay = month === 2 ? (isLeap ? 29 : 28) : MONTH_DAYS[month - 1];
    return day <= maxDay;
}
