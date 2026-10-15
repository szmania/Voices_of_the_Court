import type { GameData } from '../../shared/gameData/GameData.js';
import { requireCampaignIdentity } from '../campaignIdentityResolver.js';
import { markChronicleUnhealthy } from './chronicleHealth.js';
import { ChronicleStoreError } from './chronicleAtomicJson.js';

/** Observation failures disable chronicle generation without breaking the caller. */
export function reportChronicleObservationFailure(gameData: GameData, error: unknown): void {
    console.warn('[Chronicle] Could not observe parsed game data:', error);
    try {
        const identity = requireCampaignIdentity(gameData);
        markChronicleUnhealthy(identity, error instanceof ChronicleStoreError ? error.code : 'observation_failed');
    } catch { /* Legacy snapshots have no campaign store to mark. */ }
}
