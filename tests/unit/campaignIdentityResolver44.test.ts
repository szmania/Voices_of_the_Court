/**
 * §44 Change B: campaign-identity resolution from a degraded snapshot.
 *
 * A snapshot whose parse status is 'invalid'/'truncated' no longer forces the
 * resolver into the fail-closed 'invalid' branch when the caller can supply the
 * raw campaign-id components (GameData.votcCampaignIdA..D): the identity is
 * salvaged for READ/delivery paths. `tryResolveCampaignIdentity` is the
 * non-throwing accessor those paths use; write paths keep using
 * `requireCampaignIdentity`, which still fails closed on an un-salvageable
 * degraded snapshot and on a legacy (no campaign tail) mod.
 */
import {
    resolveCampaignIdentity,
    requireCampaignIdentity,
    tryResolveCampaignIdentity
} from '../../src/main/campaignIdentityResolver';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';

const PLAYER_ID = 1001;
const PARTS = { a: 7, b: 8, c: 9, d: 10 };
const EXPECTED_CAMPAIGN_ID = buildIdentityFromParts(PARTS, String(PLAYER_ID)).campaignId;

describe('resolveCampaignIdentity - §44 Change B partial salvage', () => {
    it('salvages a partial identity from a truncated snapshot with raw campaign-id components', () => {
        const result = resolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'truncated', expected: 23, actual: 19 },
            campaignIdParts: PARTS
        });
        expect(result.status).toBe('ok');
        if (result.status === 'ok') {
            expect(result.identity.campaignId).toBe(EXPECTED_CAMPAIGN_ID);
            expect(result.identity.playerId).toBe(String(PLAYER_ID));
        }
    });

    it('salvages a partial identity from an invalid snapshot with raw campaign-id components', () => {
        const result = resolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'invalid', reason: 'incomplete timeline node pair' },
            campaignIdParts: PARTS
        });
        expect(result.status).toBe('ok');
    });

    it('reports invalid (NOT legacy-mod) when a degraded snapshot cannot be salvaged', () => {
        const result = resolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'truncated', expected: 23, actual: 3 }
        });
        expect(result.status).toBe('invalid');
    });

    it('still reports legacy-mod for a legacy snapshot (unchanged)', () => {
        const result = resolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'legacy', snapshot: { source: 'init' } },
            campaignIdParts: PARTS
        });
        expect(result.status).toBe('legacy-mod');
    });

    it('reports invalid when the raw components are malformed (non-positive)', () => {
        const result = resolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'invalid', reason: 'bad tail' },
            campaignIdParts: { a: 0, b: 8, c: 9, d: 10 }
        });
        expect(result.status).toBe('invalid');
    });
});

describe('tryResolveCampaignIdentity - §44 Change B optional accessor', () => {
    it('returns the identity for a valid snapshot', () => {
        const identity = tryResolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: {
                status: 'valid',
                snapshot: {
                    playerId: String(PLAYER_ID),
                    source: 'init',
                    protocol: {
                        protocolSchema: 2,
                        campaignSchema: 1,
                        campaignIdA: 7,
                        campaignIdB: 8,
                        campaignIdC: 9,
                        campaignIdD: 10,
                        campaignBootstrapKind: 1,
                        playerTimelineSchema: 1
                    }
                }
            }
        });
        expect(identity?.campaignId).toBe(EXPECTED_CAMPAIGN_ID);
    });

    it('returns the salvaged identity for a degraded snapshot with components', () => {
        const identity = tryResolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'invalid', reason: 'bad tail' },
            campaignIdParts: PARTS
        });
        expect(identity?.campaignId).toBe(EXPECTED_CAMPAIGN_ID);
    });

    it('returns undefined (never throws) for every failure mode', () => {
        expect(tryResolveCampaignIdentity({ playerID: PLAYER_ID })).toBeUndefined();
        expect(tryResolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'legacy', snapshot: { source: 'init' } }
        })).toBeUndefined();
        expect(tryResolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'unsupported-schema', schema: 9 }
        })).toBeUndefined();
        expect(tryResolveCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'invalid', reason: 'bad tail' }
        })).toBeUndefined();
    });
});

describe('requireCampaignIdentity - §44 write paths still fail closed', () => {
    it('throws for an un-salvageable degraded snapshot', () => {
        expect(() => requireCampaignIdentity({
            playerID: PLAYER_ID,
            timelineSnapshotResult: { status: 'truncated', expected: 23, actual: 3 }
        })).toThrow(/Campaign identity unavailable/);
    });

    it('throws for a legacy mod (no campaign tail)', () => {
        expect(() => requireCampaignIdentity({ playerID: PLAYER_ID })).toThrow(/legacy-mod|does not emit a v2 campaign id/);
    });
});