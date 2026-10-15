import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';

/**
 * Chronicle health tracker.
 *
 * Per Task 6 Step 3: when a chronicle observe throws ChronicleStoreError,
 * the caller marks the campaign/player unhealthy. The Coordinator (later
 * task) consults this state to fail closed and surface a window prompt.
 *
 * The map is keyed by `${campaignId}:${playerId}` and lives for the
 * process lifetime. A chronicle write that later succeeds does NOT clear
 * the unhealthy flag: the failure may have left the store in a degraded
 * state and the Coordinator should still surface it for diagnosis.
 */

interface ChronicleHealthEntry {
    unhealthy: boolean;
    lastErrorCode?: string;
    lastErrorAt: string;
}

const healthMap = new Map<string, ChronicleHealthEntry>();

function keyOf(identity: CampaignPlayerIdentity): string {
    return `${identity.campaignId}:${identity.playerId}`;
}

export function markChronicleUnhealthy(
    identity: CampaignPlayerIdentity,
    errorCode?: string
): void {
    const key = keyOf(identity);
    healthMap.set(key, {
        unhealthy: true,
        lastErrorCode: errorCode,
        lastErrorAt: new Date().toISOString()
    });
}

export function isChronicleUnhealthy(identity: CampaignPlayerIdentity): boolean {
    const entry = healthMap.get(keyOf(identity));
    return entry?.unhealthy === true;
}

export function getChronicleHealth(identity: CampaignPlayerIdentity): ChronicleHealthEntry | undefined {
    return healthMap.get(keyOf(identity));
}

export function clearChronicleHealth(identity: CampaignPlayerIdentity): void {
    healthMap.delete(keyOf(identity));
}

/** Test-only: reset all health state. */
export function resetChronicleHealthForTests(): void {
    healthMap.clear();
}
