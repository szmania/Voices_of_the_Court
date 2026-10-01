import {
    parseTimelineSnapshot,
    type TimelineProtocolTail
} from '../shared/gameData/timelineProtocol.js';

export const MANAGER_CLIPBOARD_FIELD_COUNT = 9;

export interface TimelineWindowContext {
    playerId: string;
    checkpointEpoch?: number;
    playerName?: string;
    timelineNodeA?: number;
    timelineNodeB?: number;
    timelineParentA?: number;
    timelineParentB?: number;
    checkpointToken?: number;
    pendingCheckpointToken?: number;
    protocol?: TimelineProtocolTail;
}

export type ManagerClipboardPayload = TimelineWindowContext & { extraFields: string[] };

export type ManagerClipboardParseResult =
    | { status: 'valid'; payload: ManagerClipboardPayload }
    | { status: 'unsupported-schema'; schema: number }
    | { status: 'truncated'; expected: number; actual: number }
    | { status: 'invalid'; reason: string };

export type ManagerWindowContextDecision =
    | { status: 'ok'; context: ManagerClipboardPayload }
    | { status: 'error'; message: string; unsupportedSchema?: number };

export function parseManagerClipboardPayload(payloads: readonly (string | undefined)[] | undefined): ManagerClipboardParseResult {
    const fields = payloads ?? [];
    const parsed = parseTimelineSnapshot(fields, 'manager');
    switch (parsed.status) {
        case 'truncated':
        case 'invalid':
        case 'unsupported-schema':
            return parsed;
        case 'valid':
        case 'legacy': {
            const snapshot = parsed.snapshot;
            if (!snapshot.playerId) {
                return { status: 'invalid', reason: 'missing player id' };
            }
            return {
                status: 'valid',
                payload: {
                    playerId: snapshot.playerId,
                    checkpointEpoch: snapshot.epoch,
                    playerName: snapshot.playerName,
                    timelineNodeA: snapshot.nodeA,
                    timelineNodeB: snapshot.nodeB,
                    timelineParentA: snapshot.parentA,
                    timelineParentB: snapshot.parentB,
                    checkpointToken: snapshot.checkpointToken,
                    pendingCheckpointToken: snapshot.pendingCheckpointToken,
                    protocol: parsed.status === 'valid' ? parsed.snapshot.protocol : undefined,
                    extraFields: fields.slice(MANAGER_CLIPBOARD_FIELD_COUNT).map(field => field ?? '')
                }
            };
        }
    }
}

export function decideManagerWindowContext(commandLabel: string, payloads: readonly (string | undefined)[] | undefined): ManagerWindowContextDecision {
    const parsed = parseManagerClipboardPayload(payloads);
    switch (parsed.status) {
        case 'valid':
            return { status: 'ok', context: parsed.payload };
        case 'unsupported-schema':
            return {
                status: 'error',
                message: `${commandLabel} clipboard payload uses unsupported timeline protocol schema ${parsed.schema}. Update the app and the mod to matching versions.`,
                unsupportedSchema: parsed.schema
            };
        case 'truncated':
            return {
                status: 'error',
                message: `${commandLabel} clipboard payload truncated: expected ${parsed.expected} fields, got ${parsed.actual}. Refusing to open a window without complete checkpoint evidence.`
            };
        case 'invalid':
            return {
                status: 'error',
                message: `${commandLabel} clipboard payload invalid: ${parsed.reason}. Refusing to open a window without complete checkpoint evidence.`
            };
    }
}
