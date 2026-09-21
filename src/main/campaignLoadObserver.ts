/**
 * Load-time campaign identity, as reported by the mod's save-load relay
 * (`VOTC:CAMPAIGN/;/loaded/;...`, see the mod's `votc_game_start_init_relay`).
 *
 * The identity the app works with otherwise only arrives with the first
 * conversation or incoming letter, because that is when the mod emits the
 * `VOTC:IN` init line. A save that was just loaded has no such line yet, so
 * without this observer every identity-dependent decision made before the first
 * conversation — pending reply delivery above all — has to be answered with
 * "unknown", which fails closed and strands the queue.
 *
 * The observer also announces an adopted save once per campaign: bootstrapKind 2
 * or 3 means the campaign identity was created during this load because the save
 * carried VOTC state from an older version, which is exactly the upgrade the
 * user should be told about instead of finding their old campaign under a new
 * id with no explanation.
 */
import { dialog } from 'electron';
import { t } from '../shared/i18n.js';
import { parseCampaignLoadedLine } from '../shared/gameData/parseLog.js';
import { buildIdentityFromParts } from '../shared/gameData/CampaignIdentity.js';

export interface ObservedCampaignLoad {
    campaignId: string;
    playerId: string;
    bootstrapKind?: number;
    checkpointEpoch?: number;
}

let observedLoad: ObservedCampaignLoad | undefined;
const announcedCampaigns = new Set<string>();

/** Test seam: drop this session's observations and announcements. */
export function _resetCampaignLoadObserver(): void {
    observedLoad = undefined;
    announcedCampaigns.clear();
}

export function getObservedCampaignLoad(): ObservedCampaignLoad | undefined {
    return observedLoad;
}

/** Campaign id of the save loaded in this session, if the mod reported one. */
export function getObservedCampaignId(): string | undefined {
    return observedLoad?.campaignId;
}

/**
 * Feeds one debug-log line to the observer. Returns true when the line was a
 * save-load identity line. A malformed one is reported and ignored: a wrong
 * campaign id would be worse than none, since it decides where replies may be
 * written.
 */
export function observeCampaignLoadLine(line: string): boolean {
    const parsed = parseCampaignLoadedLine(line);
    if (!parsed) {
        return false;
    }

    let campaignId: string;
    try {
        campaignId = buildIdentityFromParts(parsed.campaignParts, parsed.playerId).campaignId;
    } catch (error) {
        console.warn(`[timeline] Ignoring malformed save-load campaign identity: ${error}`);
        return true;
    }

    observedLoad = {
        campaignId,
        playerId: parsed.playerId,
        bootstrapKind: parsed.bootstrapKind,
        checkpointEpoch: parsed.checkpointEpoch
    };
    console.log(`[timeline] Save-load identity observed: campaign ${campaignId}, player ${parsed.playerId}, bootstrapKind ${parsed.bootstrapKind ?? 'unknown'}, checkpoint epoch ${parsed.checkpointEpoch ?? 'unknown'}.`);
    announceAdoptedSave(observedLoad);
    return true;
}

function announceAdoptedSave(load: ObservedCampaignLoad): void {
    const bootstrapKind = load.bootstrapKind;
    if (bootstrapKind !== 2 && bootstrapKind !== 3) {
        return;
    }
    if (announcedCampaigns.has(load.campaignId)) {
        return;
    }
    announcedCampaigns.add(load.campaignId);

    console.log(`[timeline] Save was adopted into campaign ${load.campaignId} (bootstrapKind=${bootstrapKind}); existing data stays readable under the new identity.`);
    void dialog.showMessageBox({
        type: 'info',
        title: t('info.legacySaveAdoptedTitle'),
        message: t('info.legacySaveAdopted', {campaignId: load.campaignId})
    });
}
