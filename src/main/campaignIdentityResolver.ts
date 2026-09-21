import {
    buildIdentityFromSnapshot,
    CampaignIdentityError,
    type CampaignPlayerIdentity
} from '../shared/gameData/CampaignIdentity.js';
import {
    TIMELINE_PROTOCOL_SCHEMA,
    TIMELINE_CAMPAIGN_SCHEMA,
    type TimelineParseResult,
    type TimelineSnapshot,
    UnsupportedTimelineSchemaError
} from '../shared/gameData/timelineProtocol.js';

export interface CampaignIdentitySource {
    playerID: number;
    timelineSnapshotResult?: TimelineParseResult;
}

export type ResolveCampaignIdentityResult =
    | { status: 'ok'; identity: CampaignPlayerIdentity }
    | { status: 'legacy-mod' }
    | { status: 'unsupported-schema'; schema: number }
    | { status: 'invalid'; reason: string };

/**
 * §4.1, §9: Resolve an immutable campaign/player identity from a parsed
 * snapshot. Per §9 compat boundary: new App + old Mod (no campaign identity
 * in snapshot) -> legacy-mod; the caller MUST fail closed at the business
 * entry and must NOT silently fall back to the player-only path. This is
 * the single source of truth for identity capture at business-operation
 * start; the returned identity is used immutably for the whole operation.
 *
 * snapshotResult of:
 *   - 'valid'   -> ok (build identity from the v2 protocol tail)
 *   - 'legacy'  -> legacy-mod (old Mod, no campaign tail)
 *   - undefined -> legacy-mod (Phase 2 parse fields absent)
 *   - 'unsupported-schema' -> unsupported-schema (fail closed)
 *   - 'truncated'/'invalid' -> invalid (fail closed)
 */
export function resolveCampaignIdentity(source: CampaignIdentitySource): ResolveCampaignIdentityResult {
    const playerId = String(source.playerID);
    const snapshotResult = source.timelineSnapshotResult;
    if (snapshotResult === undefined) {
        return { status: 'legacy-mod' };
    }
    switch (snapshotResult.status) {
        case 'valid': {
            try {
                const identity = buildIdentityFromSnapshot(snapshotResult.snapshot, playerId);
                return { status: 'ok', identity };
            } catch (error) {
                if (error instanceof CampaignIdentityError) {
                    return { status: 'invalid', reason: error.message };
                }
                return { status: 'invalid', reason: `identity construction failed: ${String(error)}` };
            }
        }
        case 'legacy':
            return { status: 'legacy-mod' };
        case 'unsupported-schema':
            return { status: 'unsupported-schema', schema: snapshotResult.schema };
        case 'truncated':
            return {
                status: 'invalid',
                reason: `truncated timeline snapshot: expected ${snapshotResult.expected} fields, got ${snapshotResult.actual}`
            };
        case 'invalid':
            return { status: 'invalid', reason: snapshotResult.reason };
    }
}

/**
 * Convenience guard for business entry points that must fail closed when the
 * snapshot does not carry a valid v2 campaign identity. Throws a typed error
 * for legacy-mod and unsupported-schema so the caller can surface an i18n
 * message instead of silently writing to a player-only path.
 */
export class CampaignIdentityUnavailableError extends Error {
    readonly code: 'legacy-mod' | 'unsupported-schema' | 'invalid';
    readonly schema?: number;

    constructor(
        code: 'legacy-mod' | 'unsupported-schema' | 'invalid',
        message: string,
        schema?: number
    ) {
        super(message);
        this.name = 'CampaignIdentityUnavailableError';
        this.code = code;
        this.schema = schema;
    }
}

export function requireCampaignIdentity(source: CampaignIdentitySource): CampaignPlayerIdentity {
    const result = resolveCampaignIdentity(source);
    if (result.status === 'ok') {
        return result.identity;
    }
    if (result.status === 'legacy-mod') {
        throw new CampaignIdentityUnavailableError(
            'legacy-mod',
            'Campaign identity unavailable: the mod does not emit a v2 campaign id. Update the mod to a matching version.'
        );
    }
    if (result.status === 'unsupported-schema') {
        throw new CampaignIdentityUnavailableError(
            'unsupported-schema',
            `Campaign identity unavailable: unsupported timeline protocol schema ${result.schema}. Update the app and the mod to matching versions.`,
            result.schema
        );
    }
    throw new CampaignIdentityUnavailableError(
        'invalid',
        `Campaign identity unavailable: ${result.reason}`
    );
}

export {
    TIMELINE_PROTOCOL_SCHEMA,
    TIMELINE_CAMPAIGN_SCHEMA,
    UnsupportedTimelineSchemaError
};
export type { TimelineParseResult, TimelineSnapshot };
