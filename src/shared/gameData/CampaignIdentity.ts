import {
    MAX_NODE_COMPONENT,
    TIMELINE_PROTOCOL_SCHEMA,
    TIMELINE_CAMPAIGN_SCHEMA
} from './timelineProtocol.js';
import type { TimelineSnapshot } from './timelineProtocol.js';

export interface CampaignIdParts {
    a: number;
    b: number;
    c: number;
    d: number;
}

export interface CampaignPlayerIdentity {
    protocolSchema: 2;
    campaignSchema: 1;
    campaignId: string;
    campaignParts: CampaignIdParts;
    playerId: string;
}

export type CampaignIdentityErrorCode =
    | 'invalid_campaign_id'
    | 'unsupported_protocol_schema'
    | 'unsupported_campaign_schema'
    | 'missing_protocol_tail'
    | 'invalid_player_id';

export class CampaignIdentityError extends Error {
    readonly code: CampaignIdentityErrorCode;

    constructor(message: string, code: CampaignIdentityErrorCode) {
        super(message);
        this.name = 'CampaignIdentityError';
        this.code = code;
    }
}

function validatePart(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new CampaignIdentityError(
            `campaign id part ${label} must be an integer, got ${String(value)}`,
            'invalid_campaign_id'
        );
    }
    if (value <= 0) {
        throw new CampaignIdentityError(
            `campaign id part ${label} must be a non-zero positive integer, got ${value}`,
            'invalid_campaign_id'
        );
    }
    if (value > MAX_NODE_COMPONENT) {
        throw new CampaignIdentityError(
            `campaign id part ${label} exceeds the 28-bit maximum (${MAX_NODE_COMPONENT}): ${value}`,
            'invalid_campaign_id'
        );
    }
    return value;
}

export function normalizeCampaignId(parts: CampaignIdParts): string {
    const a = validatePart(parts.a, 'a');
    const b = validatePart(parts.b, 'b');
    const c = validatePart(parts.c, 'c');
    const d = validatePart(parts.d, 'd');
    return `${a}-${b}-${c}-${d}`;
}

export function parseCampaignId(value: string): CampaignIdParts {
    if (typeof value !== 'string' || value.length === 0) {
        throw new CampaignIdentityError(
            'campaign id must be a non-empty string',
            'invalid_campaign_id'
        );
    }
    const segments = value.split('-');
    if (segments.length !== 4) {
        throw new CampaignIdentityError(
            `campaign id must have exactly 4 segments separated by "-": "${value}"`,
            'invalid_campaign_id'
        );
    }
    const parsed = segments.map(seg => Number(seg));
    if (parsed.some(n => !Number.isInteger(n))) {
        throw new CampaignIdentityError(
            `campaign id segments must be integers: "${value}"`,
            'invalid_campaign_id'
        );
    }
    const [a, b, c, d] = parsed;
    return {
        a: validatePart(a, 'a'),
        b: validatePart(b, 'b'),
        c: validatePart(c, 'c'),
        d: validatePart(d, 'd')
    };
}

export function buildIdentityFromParts(
    parts: CampaignIdParts,
    playerId: string
): CampaignPlayerIdentity {
    if (typeof playerId !== 'string' || playerId.length === 0) {
        throw new CampaignIdentityError(
            'playerId must be a non-empty string',
            'invalid_player_id'
        );
    }
    const campaignId = normalizeCampaignId(parts);
    const validatedParts: CampaignIdParts = {
        a: validatePart(parts.a, 'a'),
        b: validatePart(parts.b, 'b'),
        c: validatePart(parts.c, 'c'),
        d: validatePart(parts.d, 'd')
    };
    return Object.freeze({
        protocolSchema: TIMELINE_PROTOCOL_SCHEMA as 2,
        campaignSchema: TIMELINE_CAMPAIGN_SCHEMA as 1,
        campaignId,
        campaignParts: Object.freeze({ ...validatedParts }),
        playerId
    });
}

export function buildIdentityFromSnapshot(
    snapshot: TimelineSnapshot,
    playerId: string
): CampaignPlayerIdentity {
    if (snapshot.protocol === undefined) {
        throw new CampaignIdentityError(
            'snapshot is missing the protocol tail (legacy v1 snapshot)',
            'missing_protocol_tail'
        );
    }
    const tail = snapshot.protocol;
    if (tail.protocolSchema !== TIMELINE_PROTOCOL_SCHEMA) {
        throw new CampaignIdentityError(
            `unsupported protocol schema: ${tail.protocolSchema}`,
            'unsupported_protocol_schema'
        );
    }
    if (tail.campaignSchema !== TIMELINE_CAMPAIGN_SCHEMA) {
        throw new CampaignIdentityError(
            `unsupported campaign schema: ${tail.campaignSchema}`,
            'unsupported_campaign_schema'
        );
    }
    return buildIdentityFromParts(
        {
            a: tail.campaignIdA,
            b: tail.campaignIdB,
            c: tail.campaignIdC,
            d: tail.campaignIdD
        },
        playerId
    );
}

export function identityEquals(
    left: CampaignPlayerIdentity | undefined,
    right: CampaignPlayerIdentity | undefined
): boolean {
    if (left === undefined || right === undefined) return false;
    if (left === right) return true;
    return left.campaignId === right.campaignId && left.playerId === right.playerId;
}

export function isCampaignPlayerIdentity(value: unknown): value is CampaignPlayerIdentity {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    if (v.protocolSchema !== TIMELINE_PROTOCOL_SCHEMA) return false;
    if (v.campaignSchema !== TIMELINE_CAMPAIGN_SCHEMA) return false;
    if (typeof v.campaignId !== 'string' || v.campaignId.length === 0) return false;
    if (typeof v.playerId !== 'string' || v.playerId.length === 0) return false;
    const parts = v.campaignParts;
    if (typeof parts !== 'object' || parts === null) return false;
    const p = parts as Record<string, unknown>;
    if (!['a', 'b', 'c', 'd'].every(key => typeof p[key] === 'number' && Number.isInteger(p[key]))) {
        return false;
    }
    // Defense-in-depth: campaignId must be the canonical normalized form of
    // campaignParts. A hand-constructed object with mismatched id/parts
    // (even if every individual field looks valid) must be rejected so a
    // caller cannot smuggle in an inconsistent identity that the rest of
    // the system assumes is internally consistent. normalizeCampaignId
    // re-validates range (non-zero, <= MAX_NODE_COMPONENT), so a parts
    // value that is out of range is also rejected here.
    let normalized: string;
    try {
        normalized = normalizeCampaignId({
            a: p.a as number,
            b: p.b as number,
            c: p.c as number,
            d: p.d as number
        });
    } catch {
        return false;
    }
    return v.campaignId === normalized;
}
