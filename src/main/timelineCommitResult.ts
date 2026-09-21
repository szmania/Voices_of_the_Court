import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { ObservedTimelineState } from '../shared/gameData/timelineProtocol.js';

export const TIMELINE_DIAGNOSTIC_MARKER = 'VOTC:TIMELINE/;/';

export interface TimelineDiagnosticSnapshotEvent {
    type: 'snapshot';
    protocolSchema?: number;
    campaign?: string;
    playerId?: string;
    source?: string;
    epoch?: number;
    nodeA?: number;
    nodeB?: number;
    parentA?: number;
    parentB?: number;
    checkpointToken?: number;
    pendingCheckpointToken?: number;
}

export interface TimelineDiagnosticBumpEvent extends Omit<TimelineDiagnosticSnapshotEvent, 'type' | 'pendingCheckpointToken'> {
    type: 'bump';
    date?: string;
}

export interface TimelineCommitEvent {
    type: 'commit';
    attemptId: string;
    protocolSchema?: number;
    campaign?: string;
    playerId?: string;
    source?: string;
    slot?: string;
    deliveryId?: string;
    targetEpoch?: number;
    targetNodeA?: number;
    targetNodeB?: number;
    graphParentA?: number;
    graphParentB?: number;
}

export interface TimelineCommitResultEvent {
    type: 'commit_result';
    format: 'full' | 'legacy';
    attemptId: string;
    resultCode: string;
    protocolSchema?: number;
    campaign?: string;
    playerId?: string;
    source?: string;
    slot?: string;
    deliveryId?: string;
    observed: ObservedTimelineState;
    graphParentA?: number;
    graphParentB?: number;
    targetEpoch?: number;
    targetNodeA?: number;
    targetNodeB?: number;
    ck3State: ObservedTimelineState;
}

export interface TimelineGuardEvent {
    type: 'skip_advanced' | 'skip_delivery_mismatch' | 'ambiguous';
    fields: string[];
}

export interface TimelineRegistryRecoveryEvent {
    type: 'registry_recovery';
    kind?: string;
    fields: string[];
}

export interface TimelineInvalidEvent {
    type: 'invalid';
    reason: string;
}

export type TimelineDiagnosticEvent =
    | TimelineDiagnosticSnapshotEvent
    | TimelineDiagnosticBumpEvent
    | TimelineCommitEvent
    | TimelineCommitResultEvent
    | TimelineGuardEvent
    | TimelineRegistryRecoveryEvent
    | TimelineInvalidEvent;

export interface TimelineCommitConsumeSummary {
    commitResults: number;
    appliedUpdates: number;
    duplicateResults: number;
    unmatchedResults: number;
    syntheticProofs: number;
    ambiguousAttempts: number;
    writeFailures: number;
}

interface HistoryRecord {
    votcCommitAttemptId?: string;
    votcCommitOutcome?: string;
    votcCommitOutcomeSource?: 'log' | 'synthetic';
    votcCommitResultId?: string;
    votcCheckpointEpoch?: number;
    votcTimelineNodeId?: string;
    [key: string]: unknown;
}

function normalize(raw: string | undefined): string | undefined {
    if (raw === undefined) return undefined;
    const trimmed = raw.trim();
    return trimmed === '' ? undefined : trimmed;
}

function parseNonNegativeInt(raw: string | undefined): number | undefined {
    const value = normalize(raw);
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseComponentField(raw: string | undefined): number | undefined {
    const value = normalize(raw);
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
    return parsed;
}

function parseSnapshotBody(type: 'snapshot', fields: readonly string[]): TimelineDiagnosticSnapshotEvent;
function parseSnapshotBody(type: 'bump', fields: readonly string[]): TimelineDiagnosticBumpEvent;
function parseSnapshotBody(type: 'snapshot' | 'bump', fields: readonly string[]): TimelineDiagnosticSnapshotEvent | TimelineDiagnosticBumpEvent {
    const base = {
        protocolSchema: parseNonNegativeInt(fields[0]),
        campaign: normalize(fields[1]),
        playerId: normalize(fields[2]),
        source: normalize(fields[3]),
        epoch: parseNonNegativeInt(fields[4]),
        nodeA: parseComponentField(fields[5]),
        nodeB: parseComponentField(fields[6]),
        parentA: parseComponentField(fields[7]),
        parentB: parseComponentField(fields[8]),
        checkpointToken: parseComponentField(fields[9])
    };
    if (type === 'snapshot') {
        return { type, ...base, pendingCheckpointToken: parseComponentField(fields[10]) };
    }
    return { type, ...base, date: normalize(fields[10]) };
}

function parseCommitEvent(fields: readonly string[]): TimelineCommitEvent | TimelineInvalidEvent {
    const attemptId = normalize(fields[0]);
    if (!attemptId) {
        return { type: 'invalid', reason: 'commit line is missing the attempt id' };
    }
    return {
        type: 'commit',
        attemptId,
        protocolSchema: parseNonNegativeInt(fields[1]),
        campaign: normalize(fields[2]),
        playerId: normalize(fields[3]),
        source: normalize(fields[4]),
        slot: normalize(fields[5]),
        deliveryId: normalize(fields[6]),
        targetEpoch: parseNonNegativeInt(fields[7]),
        targetNodeA: parseComponentField(fields[8]),
        targetNodeB: parseComponentField(fields[9]),
        graphParentA: parseComponentField(fields[10]),
        graphParentB: parseComponentField(fields[11])
    };
}

function parseCommitResultEvent(fields: readonly string[]): TimelineCommitResultEvent | TimelineInvalidEvent {
    const attemptId = normalize(fields[0]);
    const resultCode = normalize(fields[1]);
    if (!attemptId || !resultCode) {
        return { type: 'invalid', reason: 'commit_result line requires an attempt id and a result code' };
    }
    if (fields.length <= 2 || fields.slice(2).every(field => normalize(field) === undefined)) {
        return { type: 'commit_result', format: 'legacy', attemptId, resultCode, observed: {}, ck3State: {} };
    }
    return {
        type: 'commit_result',
        format: 'full',
        attemptId,
        resultCode,
        protocolSchema: parseNonNegativeInt(fields[2]),
        campaign: normalize(fields[3]),
        playerId: normalize(fields[4]),
        source: normalize(fields[5]),
        slot: normalize(fields[6]),
        deliveryId: normalize(fields[7]),
        observed: {
            epoch: parseNonNegativeInt(fields[8]),
            nodeA: parseComponentField(fields[9]),
            nodeB: parseComponentField(fields[10]),
            parentA: parseComponentField(fields[11]),
            parentB: parseComponentField(fields[12]),
            checkpointToken: parseComponentField(fields[13])
        },
        graphParentA: parseComponentField(fields[14]),
        graphParentB: parseComponentField(fields[15]),
        targetEpoch: parseNonNegativeInt(fields[16]),
        targetNodeA: parseComponentField(fields[17]),
        targetNodeB: parseComponentField(fields[18]),
        ck3State: {
            epoch: parseNonNegativeInt(fields[19]),
            nodeA: parseComponentField(fields[20]),
            nodeB: parseComponentField(fields[21]),
            parentA: parseComponentField(fields[22]),
            parentB: parseComponentField(fields[23]),
            checkpointToken: parseComponentField(fields[24])
        }
    };
}

export function parseTimelineDiagnosticLine(line: string): TimelineDiagnosticEvent | null {
    const markerIndex = line.indexOf(TIMELINE_DIAGNOSTIC_MARKER);
    if (markerIndex === -1) {
        return null;
    }
    const parts = line.substring(markerIndex + TIMELINE_DIAGNOSTIC_MARKER.length).split('/;/').map(part => part.trim());
    const type = parts[0];
    const fields = parts.slice(1);
    switch (type) {
        case 'snapshot':
            return parseSnapshotBody('snapshot', fields);
        case 'bump':
            return parseSnapshotBody('bump', fields);
        case 'commit':
            return parseCommitEvent(fields);
        case 'commit_result':
            return parseCommitResultEvent(fields);
        case 'skip_advanced':
        case 'skip_delivery_mismatch':
        case 'ambiguous':
            return { type, fields };
        case 'registry_recovery':
            return { type, kind: unescapeTimelineField(normalize(fields[0]) ?? ''), fields: fields.slice(1).map(unescapeTimelineField) };
        default:
            return { type: 'invalid', reason: `unknown VOTC:TIMELINE diagnostic type: "${type}"` };
    }
}

function canonicalCk3State(state: ObservedTimelineState): string {
    return [
        state.epoch ?? '',
        state.nodeA ?? '',
        state.nodeB ?? '',
        state.parentA ?? '',
        state.parentB ?? '',
        state.checkpointToken ?? ''
    ].join('|');
}

export function computeCommitResultId(attemptId: string, resultCode: string, ck3State: ObservedTimelineState): string {
    return createHash('sha256')
        .update(`${attemptId}|${resultCode}|${canonicalCk3State(ck3State)}`)
        .digest('hex')
        .slice(0, 16);
}

export function escapeTimelineField(raw: string | number | undefined): string {
    return String(raw ?? '').replace(/\/;\//g, '%3B%3B');
}

export function unescapeTimelineField(raw: string): string {
    return raw.replace(/%3B%3B/g, '/;/');
}

export function formatRegistryRecoveryLine(kind: string, ...fields: readonly (string | number | undefined)[]): string {
    const suffix = fields.map(escapeTimelineField).join('/;/');
    return `${TIMELINE_DIAGNOSTIC_MARKER}registry_recovery/;/${escapeTimelineField(kind)}${suffix ? `/;/${suffix}` : ''}`;
}

interface HistoryFile {
    playerId: string;
    filePath: string;
    records: HistoryRecord[];
}

function loadHistoryFiles(historyDir: string): HistoryFile[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(historyDir);
    } catch {
        return [];
    }
    const files: HistoryFile[] = [];
    for (const entry of entries) {
        const match = entry.match(/^player_(.+)\.json$/);
        if (!match) continue;
        const filePath = path.join(historyDir, entry);
        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (Array.isArray(parsed)) {
                files.push({ playerId: match[1], filePath, records: parsed });
            }
        } catch (error) {
            console.warn(`[timeline] Skipping unreadable battle report history ${filePath}: ${error}`);
        }
    }
    return files;
}

function saveHistoryFile(file: HistoryFile): boolean {
    try {
        fs.writeFileSync(file.filePath, JSON.stringify(file.records, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.warn(`[timeline] Failed to save battle report history ${file.filePath}: ${error}`);
        return false;
    }
}

function parseNodeIdPair(nodeId: string | undefined): { a: number; b: number } | undefined {
    const match = nodeId?.match(/^(\d+)-(\d+)$/);
    if (!match) return undefined;
    return { a: Number(match[1]), b: Number(match[2]) };
}

export function consumeTimelineCommitResults(logContent: string, options: { historyDir: string }): TimelineCommitConsumeSummary {
    const summary: TimelineCommitConsumeSummary = {
        commitResults: 0,
        appliedUpdates: 0,
        duplicateResults: 0,
        unmatchedResults: 0,
        syntheticProofs: 0,
        ambiguousAttempts: 0,
        writeFailures: 0
    };

    const events: TimelineDiagnosticEvent[] = [];
    for (const line of logContent.split(/\r?\n/)) {
        const event = parseTimelineDiagnosticLine(line);
        if (event) {
            events.push(event);
        }
    }

    const results = events.filter((event): event is TimelineCommitResultEvent => event.type === 'commit_result');
    const commits = new Map<string, TimelineCommitEvent>();
    const snapshots: TimelineDiagnosticSnapshotEvent[] = [];
    for (const event of events) {
        if (event.type === 'commit') {
            commits.set(event.attemptId, event);
        } else if (event.type === 'snapshot') {
            snapshots.push(event);
        }
    }
    summary.commitResults = results.length;

    const historyFiles = loadHistoryFiles(options.historyDir);
    const dirtyFiles = new Set<HistoryFile>();

    for (const result of results) {
        let matched = false;
        for (const file of historyFiles) {
            if (result.format === 'full' && result.playerId && result.playerId !== '0' && result.playerId !== file.playerId) {
                continue;
            }
            const record = file.records.find(entry => entry.votcCommitAttemptId === result.attemptId);
            if (!record) continue;
            matched = true;
            if (record.votcCommitOutcomeSource === 'log') {
                summary.duplicateResults++;
                continue;
            }
            record.votcCommitOutcome = result.resultCode;
            record.votcCommitOutcomeSource = 'log';
            record.votcCommitResultId = computeCommitResultId(result.attemptId, result.resultCode, result.ck3State);
            dirtyFiles.add(file);
            summary.appliedUpdates++;
        }
        if (!matched) {
            summary.unmatchedResults++;
        }
    }

    for (const file of historyFiles) {
        for (const record of file.records) {
            const attemptId = record.votcCommitAttemptId;
            if (!attemptId || record.votcCommitOutcome) {
                continue;
            }
            const commit = commits.get(attemptId);
            const targetNode = commit && commit.targetNodeA !== undefined && commit.targetNodeB !== undefined
                ? { a: commit.targetNodeA, b: commit.targetNodeB }
                : parseNodeIdPair(record.votcTimelineNodeId);
            const targetEpoch = commit?.targetEpoch ?? record.votcCheckpointEpoch;
            if (!targetNode || targetEpoch === undefined) {
                continue;
            }
            let proof: TimelineDiagnosticSnapshotEvent | undefined;
            for (const snapshot of snapshots) {
                if (
                    snapshot.playerId === file.playerId
                    && snapshot.nodeA === targetNode.a
                    && snapshot.nodeB === targetNode.b
                    && snapshot.epoch !== undefined
                    && snapshot.epoch >= targetEpoch
                ) {
                    if (!proof || snapshot.epoch >= proof.epoch!) {
                        proof = snapshot;
                    }
                }
            }
            if (!proof) {
                continue;
            }
            record.votcCommitOutcome = 'already_applied';
            record.votcCommitOutcomeSource = 'synthetic';
            record.votcCommitResultId = computeCommitResultId(attemptId, 'already_applied', proof);
            dirtyFiles.add(file);
            summary.syntheticProofs++;
        }
    }

    for (const file of dirtyFiles) {
        if (!saveHistoryFile(file)) {
            summary.writeFailures++;
        }
    }

    for (const file of historyFiles) {
        for (const record of file.records) {
            if (record.votcCommitAttemptId && !record.votcCommitOutcome) {
                summary.ambiguousAttempts++;
            }
        }
    }

    return summary;
}

export function consumeTimelineCommitResultsFromLog(debugLogPath: string, userDataPath: string): TimelineCommitConsumeSummary | null {
    if (!fs.existsSync(debugLogPath)) {
        return null;
    }
    const summary = consumeTimelineCommitResults(fs.readFileSync(debugLogPath, 'utf8'), {
        historyDir: path.join(userDataPath, 'votc_data', 'battle_report_history')
    });
    if (summary.commitResults > 0 || summary.syntheticProofs > 0 || summary.ambiguousAttempts > 0) {
        console.log(`[timeline] Consumed commit results: ${summary.appliedUpdates} applied, ${summary.duplicateResults} duplicate, ${summary.unmatchedResults} unmatched, ${summary.syntheticProofs} synthetic proofs, ${summary.ambiguousAttempts} still ambiguous.`);
    }
    return summary;
}
