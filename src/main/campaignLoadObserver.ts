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
import fs from 'fs';
import { t } from '../shared/i18n.js';
import { parseCampaignLoadedLine, parseTimelineCheckpointSetLine, type CampaignLoadedLine } from '../shared/gameData/parseLog.js';
import { buildIdentityFromParts } from '../shared/gameData/CampaignIdentity.js';

export interface ObservedCampaignLoad {
    campaignId: string;
    playerId: string;
    bootstrapKind?: number;
    checkpointEpoch?: number;
    /** Current timeline node of the loaded save, when the mod reported one. */
    nodeId?: string;
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
        checkpointEpoch: parsed.checkpointEpoch,
        ...(parsed.nodeA !== undefined && parsed.nodeB !== undefined
            ? {nodeId: `${parsed.nodeA}-${parsed.nodeB}`}
            : {})
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

export interface DeliverySnapshotEvidence {
    /**
     * Which evidence was freshest in the log: a save-load line, an init
     * block, a checkpoint receipt, or neither (observer/memory).
     */
    source: 'load' | 'init' | 'checkpoint' | 'observed' | 'none';
    campaignId?: string;
    nodeId?: string;
    playerId?: string;
    checkpointEpoch?: number;
}

const LOAD_MARKER = 'VOTC:CAMPAIGN/;/loaded/;/';
const INIT_MARKER = 'VOTC:IN/;/init/;/';
const CHECKPOINT_SET_MARKER = 'VOTC:CHECKPOINT/;/set/;/';

/**
 * Resolve the current delivery identity from the game log by file order.
 *
 * The log survives save loads, so after loading save B the last `VOTC:IN`
 * init block can still describe abandoned campaign A while the `loaded` line
 * already reports B. Comparing the byte offsets of the markers tells which
 * evidence is actually newer; a fresh load wins over a stale init block.
 * Checkpoint receipts (`VOTC:CHECKPOINT/;/set`) are written when the game
 * applies a transition — i.e. AFTER the load/init that scheduled it — so a
 * receipt fresher than both describes the save's post-conversation state and
 * must win for node/player/epoch: the last init block reports the node a
 * conversation STARTED on, never the node it committed. Scanning backwards in
 * chunks keeps this cheap on large logs.
 *
 * Field-wise, each value comes from the newest evidence that carries it:
 *   - campaignId: only load lines carry a campaign id; a load that outranks
 *     the init decides (failing to parse it fails closed rather than trust
 *     the stale init identity). Checkpoint receipts never carry one.
 *   - playerId/nodeId/checkpointEpoch: taken from the freshest marker
 *     overall (checkpoint > load > init). An init-win leaves them undefined;
 *     the caller's freshly parsed gameData describes that same init block.
 *
 * `nodeId` is populated only when the winning load line or checkpoint
 * receipt reports the save's current timeline node. When an init block wins,
 * callers should prefer the node components on their freshly parsed gameData.
 */
export function scanDeliverySnapshotEvidence(logPath: string): DeliverySnapshotEvidence {
    let loadOffset = -1;
    let loadLine: string | undefined;
    let initOffset = -1;
    let checkpointOffset = -1;
    let checkpointLine: string | undefined;
    try {
        if (!fs.existsSync(logPath)) {
            return observedFallback();
        }
        const stat = fs.statSync(logPath);
        const CHUNK = 512 * 1024;
        const OVERLAP = 1024; // markers are short; a 1KB overlap covers straddles
        const fd = fs.openSync(logPath, 'r');
        try {
            let end = stat.size;
            while (end > 0 && (loadOffset < 0 || initOffset < 0 || checkpointOffset < 0)) {
                const start = Math.max(0, end - CHUNK);
                const readEnd = Math.min(stat.size, end + OVERLAP);
                const buffer = Buffer.alloc(readEnd - start);
                fs.readSync(fd, buffer, 0, buffer.length, start);
                const text = buffer.toString('utf8');
                // Only consider markers starting inside [start, end); the overlap
                // exists so a marker straddling the chunk edge is still complete.
                const own = text.slice(0, end - start);
                if (initOffset < 0) {
                    const idx = own.lastIndexOf(INIT_MARKER);
                    if (idx >= 0) {
                        initOffset = start + idx;
                    }
                }
                if (loadOffset < 0) {
                    const idx = own.lastIndexOf(LOAD_MARKER);
                    if (idx >= 0) {
                        // Read the full line containing the marker (may extend into the overlap).
                        const eol = text.indexOf('\n', idx);
                        loadLine = text.slice(idx, eol >= 0 ? eol : text.length);
                        loadOffset = start + idx;
                    }
                }
                if (checkpointOffset < 0) {
                    const idx = own.lastIndexOf(CHECKPOINT_SET_MARKER);
                    if (idx >= 0) {
                        // Read the full line containing the marker (may extend into the overlap).
                        const eol = text.indexOf('\n', idx);
                        checkpointLine = text.slice(idx, eol >= 0 ? eol : text.length);
                        checkpointOffset = start + idx;
                    }
                }
                end = start;
            }
        } finally {
            fs.closeSync(fd);
        }
    } catch (error) {
        console.warn(`[timeline] Delivery evidence scan failed for ${logPath}:`, error);
        return observedFallback();
    }

    // Campaign: the newest campaign-carrying evidence decides. Only the load
    // line can outrank an init block here; a load that won the ordering but
    // cannot be parsed fails closed (no fallback to the stale init identity).
    let loadParsed: CampaignLoadedLine | undefined;
    let campaignId: string | undefined;
    if (loadOffset >= 0 && (initOffset < 0 || loadOffset > initOffset)) {
        loadParsed = loadLine ? parseCampaignLoadedLine(loadLine) : undefined;
        if (!loadParsed) {
            console.warn('[timeline] Malformed save-load identity line during delivery evidence scan.');
            return {source: 'load'};
        }
        try {
            campaignId = buildIdentityFromParts(loadParsed.campaignParts, loadParsed.playerId).campaignId;
        } catch (error) {
            console.warn('[timeline] Malformed save-load identity line during delivery evidence scan:', error);
            return {source: 'load'};
        }
    }

    const checkpointParsed = checkpointLine ? parseTimelineCheckpointSetLine(checkpointLine) : undefined;

    if (checkpointOffset >= 0 && checkpointOffset > initOffset && checkpointOffset > loadOffset) {
        return {
            source: 'checkpoint',
            campaignId,
            ...(checkpointParsed?.playerId !== undefined ? {playerId: checkpointParsed.playerId} : {}),
            ...(checkpointParsed?.nodeA !== undefined && checkpointParsed?.nodeB !== undefined
                ? {nodeId: `${checkpointParsed.nodeA}-${checkpointParsed.nodeB}`}
                : {}),
            ...(checkpointParsed?.checkpointEpoch !== undefined ? {checkpointEpoch: checkpointParsed.checkpointEpoch} : {})
        };
    }
    if (loadParsed) {
        return {
            source: 'load',
            campaignId,
            playerId: loadParsed.playerId,
            ...(loadParsed.nodeA !== undefined && loadParsed.nodeB !== undefined
                ? {nodeId: `${loadParsed.nodeA}-${loadParsed.nodeB}`}
                : {}),
            ...(loadParsed.checkpointEpoch !== undefined ? {checkpointEpoch: loadParsed.checkpointEpoch} : {})
        };
    }
    if (initOffset >= 0) {
        return {source: 'init'};
    }
    return observedFallback();
}

function observedFallback(): DeliverySnapshotEvidence {
    if (observedLoad) {
        return {
            source: 'observed',
            campaignId: observedLoad.campaignId,
            playerId: observedLoad.playerId,
            ...(observedLoad.nodeId !== undefined ? {nodeId: observedLoad.nodeId} : {})
        };
    }
    return {source: 'none'};
}
