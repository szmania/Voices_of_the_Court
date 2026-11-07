import {
    buildIdentityFromParts,
    buildIdentityFromSnapshot,
    CampaignIdentityError,
    type CampaignIdParts,
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
    /**
     * §44 Change B: raw campaign-id components from the init line, used to
     * salvage a partial identity when the snapshot parse degraded to
     * 'invalid'/'truncated' (those statuses carry no snapshot object). Callers
     * that re-parsed the log populate this from GameData.votcCampaignIdA..D.
     */
    campaignIdParts?: CampaignIdParts;
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
 *   - 'truncated'/'invalid' -> ok when a partial identity can be salvaged from
 *     the raw campaign-id components (§44 Change B), otherwise invalid
 *     (fail closed)
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
        case 'truncated': {
            // §44 Change B: a truncated tail often still carries the campaign-id
            // prefix intact. Salvage a partial identity from the raw components
            // before declaring the snapshot unusable, so read/delivery paths
            // keep a usable campaignId instead of misclassifying it as legacy.
            const salvaged = trySalvagePartialIdentity(source, playerId);
            if (salvaged) return { status: 'ok', identity: salvaged };
            return {
                status: 'invalid',
                reason: `truncated timeline snapshot: expected ${snapshotResult.expected} fields, got ${snapshotResult.actual}`
            };
        }
        case 'invalid': {
            const salvaged = trySalvagePartialIdentity(source, playerId);
            if (salvaged) return { status: 'ok', identity: salvaged };
            return { status: 'invalid', reason: snapshotResult.reason };
        }
    }
}

/**
 * §44 Change B helper: build a partial identity from the raw campaign-id
 * components when the snapshot parse degraded. Returns undefined when the
 * components are absent or malformed (the caller then reports 'invalid').
 */
function trySalvagePartialIdentity(source: CampaignIdentitySource, playerId: string): CampaignPlayerIdentity | undefined {
    const parts = source.campaignIdParts;
    if (!parts) return undefined;
    try {
        return buildIdentityFromParts(parts, playerId);
    } catch {
        return undefined;
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

/**
 * §44 Change B: OPTIONAL identity accessor for read/delivery paths. Returns
 * undefined instead of throwing for every failure mode (legacy-mod,
 * unsupported-schema, invalid), so a caller that can degrade — e.g. the
 * letter fallback delivery gate — does not have to wrap requireCampaignIdentity
 * in a try/catch. Write paths MUST keep using requireCampaignIdentity so they
 * fail closed on a missing identity.
 */
export function tryResolveCampaignIdentity(source: CampaignIdentitySource): CampaignPlayerIdentity | undefined {
    const result = resolveCampaignIdentity(source);
    return result.status === 'ok' ? result.identity : undefined;
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
