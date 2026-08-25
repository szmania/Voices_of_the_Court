export const TIMELINE_PROTOCOL_SCHEMA = 2;
export const TIMELINE_CAMPAIGN_SCHEMA = 1;
export const PROTOCOL_TAIL_FIELD_COUNT = 8;
export const MAX_NODE_COMPONENT = 0x7FFFFFFF;

// Init v2 field layout. Core fields occupy indices 0-14; the 8-field protocol
// tail occupies 15-22. Date extras (totalDays/year/month/day/display) start at
// index 23 and are appended after the tail.
export const INIT_CORE_FIELD_COUNT = 15;
export const INIT_DATE_EXTRA_START_INDEX = INIT_CORE_FIELD_COUNT + PROTOCOL_TAIL_FIELD_COUNT;
export const INIT_DATE_EXTRA_FIELD_COUNT = 5;

export type TimelineSnapshotSource = 'init' | 'battle' | 'incoming' | 'manager' | 'bookmark';

export interface ObservedTimelineState {
    epoch?: number;
    nodeA?: number;
    nodeB?: number;
    parentA?: number;
    parentB?: number;
    checkpointToken?: number;
    pendingCheckpointToken?: number;
}

export interface TimelineProtocolTail {
    protocolSchema: number;
    campaignSchema: number;
    campaignIdA: number;
    campaignIdB: number;
    campaignIdC: number;
    campaignIdD: number;
    campaignBootstrapKind: number;
    playerTimelineSchema: number;
}

export interface TimelineSnapshot extends ObservedTimelineState {
    playerId?: string;
    playerName?: string;
    source: TimelineSnapshotSource;
    protocol: TimelineProtocolTail;
}

export interface LegacyTimelineSnapshot extends ObservedTimelineState {
    playerId?: string;
    playerName?: string;
    source: TimelineSnapshotSource;
}

export type TimelineParseResult =
    | { status: 'valid'; snapshot: TimelineSnapshot }
    | { status: 'legacy'; snapshot: LegacyTimelineSnapshot }
    | { status: 'unsupported-schema'; schema: number }
    | { status: 'truncated'; expected: number; actual: number }
    | { status: 'invalid'; reason: string };

export class UnsupportedTimelineSchemaError extends Error {
    readonly code = 'TIMELINE_UNSUPPORTED_SCHEMA';

    constructor(readonly schema: number) {
        super(`Unsupported VOTC timeline protocol schema: ${schema}. Update the app and the mod to matching versions.`);
        this.name = 'UnsupportedTimelineSchemaError';
    }
}

interface SourceLayout {
    coreFieldCount: number;
    strictCore: boolean;
    strictEpoch: boolean;
    playerId?: number;
    playerName?: number;
    epoch: number;
    nodeA: number;
    nodeB: number;
    parentA: number;
    parentB: number;
    token: number;
    pendingToken: number;
    tailStart: number;
}

const INIT_LAYOUT: SourceLayout = {
    coreFieldCount: 15,
    strictCore: false,
    strictEpoch: false,
    playerId: 0,
    epoch: 8,
    nodeA: 9,
    nodeB: 10,
    parentA: 11,
    parentB: 12,
    token: 13,
    pendingToken: 14,
    tailStart: 15
};

const SOURCE_LAYOUTS: Record<TimelineSnapshotSource, SourceLayout> = {
    init: INIT_LAYOUT,
    incoming: INIT_LAYOUT,
    bookmark: INIT_LAYOUT,
    battle: {
        coreFieldCount: 7,
        strictCore: false,
        strictEpoch: false,
        epoch: 0,
        nodeA: 1,
        nodeB: 2,
        parentA: 3,
        parentB: 4,
        token: 5,
        pendingToken: 6,
        tailStart: 7
    },
    manager: {
        coreFieldCount: 9,
        strictCore: true,
        strictEpoch: true,
        playerId: 0,
        epoch: 1,
        playerName: 2,
        nodeA: 3,
        nodeB: 4,
        parentA: 5,
        parentB: 6,
        token: 7,
        pendingToken: 8,
        tailStart: 9
    }
};

type ComponentParse =
    | { ok: true; value?: number }
    | { ok: false; reason: string };

function normalize(raw: string | undefined): string | undefined {
    if (raw === undefined) return undefined;
    const trimmed = raw.trim();
    return trimmed === '' ? undefined : trimmed;
}

function parseEpoch(raw: string | undefined, strict: boolean): ComponentParse {
    const value = normalize(raw);
    if (value === undefined) return { ok: true };
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        if (!strict) return { ok: true };
        return { ok: false, reason: `checkpoint epoch is not a valid non-negative integer: "${raw}"` };
    }
    return { ok: true, value: parsed };
}

function parseComponent(raw: string | undefined, label: string): ComponentParse {
    const value = normalize(raw);
    if (value === undefined) return { ok: true };
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_NODE_COMPONENT) {
        return { ok: false, reason: `${label} must be an integer between 0 and ${MAX_NODE_COMPONENT}: "${raw}"` };
    }
    return { ok: true, value: parsed === 0 ? undefined : parsed };
}

function parseProtocolTail(
    tailFields: readonly (string | undefined)[],
    tailStart: number
): TimelineParseResult | { status: 'tail'; tail?: TimelineProtocolTail } {
    const present = tailFields.some(field => normalize(field) !== undefined);
    if (!present) {
        return { status: 'tail' };
    }
    if (tailFields.length < PROTOCOL_TAIL_FIELD_COUNT) {
        return { status: 'truncated', expected: tailStart + PROTOCOL_TAIL_FIELD_COUNT, actual: tailStart + tailFields.length };
    }

    const [protocolRaw, campaignRaw, aRaw, bRaw, cRaw, dRaw, bootstrapRaw, playerSchemaRaw] = tailFields;

    const protocolSchema = Number(normalize(protocolRaw));
    if (!Number.isInteger(protocolSchema)) {
        return { status: 'invalid', reason: `protocol schema is not an integer: "${protocolRaw}"` };
    }
    if (protocolSchema !== TIMELINE_PROTOCOL_SCHEMA) {
        return { status: 'unsupported-schema', schema: protocolSchema };
    }

    const campaignSchema = Number(normalize(campaignRaw));
    if (!Number.isInteger(campaignSchema)) {
        return { status: 'invalid', reason: `campaign schema is not an integer: "${campaignRaw}"` };
    }
    if (campaignSchema !== TIMELINE_CAMPAIGN_SCHEMA) {
        return { status: 'unsupported-schema', schema: campaignSchema };
    }

    const campaignIds = [aRaw, bRaw, cRaw, dRaw].map(raw => Number(normalize(raw)));
    if (campaignIds.some(id => !Number.isInteger(id) || id === 0)) {
        return { status: 'invalid', reason: `invalid campaign id: "${aRaw}/;/${bRaw}/;/${cRaw}/;/${dRaw}" (four non-zero integers required)` };
    }

    const bootstrapValue = normalize(bootstrapRaw);
    let campaignBootstrapKind = 0;
    if (bootstrapValue !== undefined) {
        const parsed = Number(bootstrapValue);
        if (!Number.isInteger(parsed) || parsed < 0) {
            return { status: 'invalid', reason: `campaign bootstrap kind is not a non-negative integer: "${bootstrapRaw}"` };
        }
        campaignBootstrapKind = parsed;
    }

    const playerSchemaValue = normalize(playerSchemaRaw);
    let playerTimelineSchema = 0;
    if (playerSchemaValue !== undefined) {
        const parsed = Number(playerSchemaValue);
        if (!Number.isInteger(parsed) || parsed < 0) {
            return { status: 'invalid', reason: `player timeline schema is not a non-negative integer: "${playerSchemaRaw}"` };
        }
        playerTimelineSchema = parsed;
    }

    return {
        status: 'tail',
        tail: {
            protocolSchema,
            campaignSchema,
            campaignIdA: campaignIds[0],
            campaignIdB: campaignIds[1],
            campaignIdC: campaignIds[2],
            campaignIdD: campaignIds[3],
            campaignBootstrapKind,
            playerTimelineSchema
        }
    };
}

export function parseTimelineSnapshot(
    fields: readonly (string | undefined)[],
    source: TimelineSnapshotSource
): TimelineParseResult {
    const layout = SOURCE_LAYOUTS[source];
    const input = fields ?? [];

    if (layout.strictCore && input.length < layout.coreFieldCount) {
        return { status: 'truncated', expected: layout.coreFieldCount, actual: input.length };
    }

    const at = (index: number): string | undefined => input[index];

    const epoch = parseEpoch(at(layout.epoch), layout.strictEpoch);
    if (!epoch.ok) return { status: 'invalid', reason: epoch.reason };

    const nodeA = parseComponent(at(layout.nodeA), 'timeline node a');
    if (!nodeA.ok) return { status: 'invalid', reason: nodeA.reason };
    const nodeB = parseComponent(at(layout.nodeB), 'timeline node b');
    if (!nodeB.ok) return { status: 'invalid', reason: nodeB.reason };
    if ((nodeA.value === undefined) !== (nodeB.value === undefined)) {
        return { status: 'invalid', reason: `incomplete timeline node pair: a="${at(layout.nodeA)}", b="${at(layout.nodeB)}"` };
    }

    const parentA = parseComponent(at(layout.parentA), 'timeline parent a');
    if (!parentA.ok) return { status: 'invalid', reason: parentA.reason };
    const parentB = parseComponent(at(layout.parentB), 'timeline parent b');
    if (!parentB.ok) return { status: 'invalid', reason: parentB.reason };
    if ((parentA.value === undefined) !== (parentB.value === undefined)) {
        return { status: 'invalid', reason: `incomplete timeline parent pair: a="${at(layout.parentA)}", b="${at(layout.parentB)}"` };
    }

    const token = parseComponent(at(layout.token), 'checkpoint token');
    if (!token.ok) return { status: 'invalid', reason: token.reason };
    const pendingToken = parseComponent(at(layout.pendingToken), 'pending checkpoint token');
    if (!pendingToken.ok) return { status: 'invalid', reason: pendingToken.reason };

    const core: ObservedTimelineState & { playerId?: string; playerName?: string; source: TimelineSnapshotSource } = {
        playerId: layout.playerId !== undefined ? normalize(at(layout.playerId)) : undefined,
        playerName: layout.playerName !== undefined ? normalize(at(layout.playerName)) : undefined,
        epoch: epoch.value,
        nodeA: nodeA.value,
        nodeB: nodeB.value,
        parentA: parentA.value,
        parentB: parentB.value,
        checkpointToken: token.value,
        pendingCheckpointToken: pendingToken.value,
        source
    };

    const tail = parseProtocolTail(input.slice(layout.tailStart), layout.tailStart);
    if (tail.status !== 'tail') {
        return tail;
    }

    if (tail.tail === undefined) {
        return { status: 'legacy', snapshot: core };
    }

    return { status: 'valid', snapshot: { ...core, protocol: tail.tail } };
}
