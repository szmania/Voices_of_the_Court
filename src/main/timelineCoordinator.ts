/**
 * §10.1 TimelineCoordinator: orders multi-battle batches by snapshot evidence.
 *
 * When several battle reports arrive in the same debug.log batch, the App
 * cannot trust the array order or the arrival order (the mod schedules
 * delayed arrivals independently). Instead, each battle carries its own
 * pre-bump `snapshot` evidence (epoch/node/token), and the coordinator:
 *
 *   1. Groups entries by observed snapshot key
 *      (node + epoch + token + pending token).
 *   2. Within a snapshot group, entries are processed in requestKey order
 *      (stable). They chain off each other: the first uses the snapshot as
 *      the parent, the next uses the first's target node as the parent, and
 *      so on (each increments the epoch).
 *   3. Across snapshot groups, groups are ordered by epoch ascending, then
 *      by observed node. A group whose observed snapshot cannot be placed
 *      relative to the others (missing intermediate snapshot evidence) is
 *      dropped and reported - the coordinator does NOT guess the order from
 *      array position or arrival timing.
 *
 * This implements the §10.1 contract: "多战报通过 TimelineCoordinator 按
 * snapshot 证据排序；缺中间 snapshot 时停止，不能按数组或 arrival 顺序猜。"
 *
 * The coordinator is pure: it returns an ordered plan plus a list of
 * dropped entries. The caller (BattleReportGenerator) feeds the plan into
 * runBattleTimelineBatchTransition in order.
 */
import type { TimelineContext } from './timelineManager.js';

export interface BattleCoordinatorEntry {
    /**
     * Battle facts signature (slot|playerId|date|location|...). Stored as
     * eventSignature on the v2 node; NOT used for ordering.
     */
    eventSignature: string;
    slotId: string;
    /**
     * Mod-emitted battle delivery id (occurrence evidence). Combined with
     * slotId to form the requestKey.
     */
    battleDeliveryId: string;
    /**
     * The observed CK3 snapshot for this battle (pre-bump state). The
     * coordinator keys ordering off this evidence.
     */
    context: TimelineContext;
    /**
     * Caller-suggested next epoch (observed + 1). Used as the floor; the
     * coordinator may raise it when chaining within a snapshot group.
     */
    nextEpoch: number | undefined;
}

export interface BattleCoordinatorPlannedEntry extends BattleCoordinatorEntry {
    /**
     * The snapshot group key this entry was grouped under.
     */
    snapshotGroupKey: string;
    /**
     * The index of this entry within its snapshot group (0-based).
     */
    chainIndex: number;
    /**
     * The resolved next epoch for this entry, after coordinator chaining.
     */
    resolvedNextEpoch: number;
    /**
     * True if this is the first entry in its snapshot group (parent is the
     * observed node itself, not a prior battle's target node).
     */
    isChainHead: boolean;
}

export interface BattleCoordinatorResult {
    /**
     * Ordered plan: process these entries in array order.
     */
    planned: BattleCoordinatorPlannedEntry[];
    /**
     * Entries dropped because their observed snapshot could not be placed
     * relative to the others (missing intermediate snapshot evidence).
     * Each carries a human-readable reason.
     */
    dropped: Array<{ entry: BattleCoordinatorEntry; reason: string }>;
}

function snapshotKeyOf(context: TimelineContext): string {
    return [
        context.timelineNodeId ?? '',
        context.checkpointEpoch ?? '',
        context.checkpointToken ?? '',
        context.pendingCheckpointToken ?? ''
    ].join('\u001f');
}

function epochOf(context: TimelineContext): number {
    return typeof context.checkpointEpoch === 'number' && Number.isFinite(context.checkpointEpoch)
        ? context.checkpointEpoch
        : 0;
}

function nodeLabelOf(context: TimelineContext): string {
    return context.timelineNodeId ?? '';
}

/**
 * Order multi-battle entries by snapshot evidence. See file header.
 *
 * Ordering algorithm:
 *   - Group entries by snapshot key (node+epoch+token+pending token).
 *   - Sort groups by (epoch asc, node label asc, snapshot key) so the
 *     lowest-epoch snapshot runs first; within the same epoch, node labels
 *     break ties deterministically.
 *   - Detect gaps: if the sorted group epochs are not contiguous (e.g.
 *     [3, 5] missing 4), or a group's parent node is not resolvable from
 *     any prior group's observed node, the coordinator stops and drops the
 *     unplaceable entries. It does not guess the order from array position.
 *   - Within a snapshot group, entries chain: the first entry's parent is
 *     the observed node; the next entry's parent is the first's target
 *     node (chained by runBattleTimelineBatchTransition), and its epoch is
 *     at least head_epoch + chainIndex + 1.
 */
export function coordinateBattlesBySnapshot(
    entries: readonly BattleCoordinatorEntry[]
): BattleCoordinatorResult {
    const planned: BattleCoordinatorPlannedEntry[] = [];
    const dropped: Array<{ entry: BattleCoordinatorEntry; reason: string }> = [];

    if (entries.length === 0) {
        return { planned, dropped };
    }

    // 1. Group by snapshot key.
    const groups = new Map<string, BattleCoordinatorEntry[]>();
    for (const entry of entries) {
        const key = snapshotKeyOf(entry.context);
        const arr = groups.get(key) ?? [];
        arr.push(entry);
        groups.set(key, arr);
    }

    // 2. Sort groups by (epoch asc, node label asc, snapshot key).
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
        const ea = epochOf(a[1][0].context);
        const eb = epochOf(b[1][0].context);
        if (ea !== eb) return ea - eb;
        const na = nodeLabelOf(a[1][0].context);
        const nb = nodeLabelOf(b[1][0].context);
        if (na !== nb) return na < nb ? -1 : 1;
        return a[0] < b[0] ? -1 : 1;
    });

    // 3. Detect gaps. We expect the group epochs to be a non-decreasing
    // run where each successive distinct epoch is exactly +1 from the
    // previous distinct epoch. Two groups at the same epoch are allowed
    // (different nodes observed at the same checkpoint - e.g. two players
    // in the same batch, or two battle slots recorded at the same save
    // state). A gap (e.g. [3, 5] missing 4) drops this and all subsequent
    // groups: the coordinator cannot prove the ordering without the
    // intermediate snapshot.
    let lastDistinctEpoch: number | undefined = undefined;
    const acceptedGroups: Array<{ key: string; entries: BattleCoordinatorEntry[]; epoch: number }> = [];
    for (const [key, groupEntries] of sortedGroups) {
        const epoch = epochOf(groupEntries[0].context);
        if (lastDistinctEpoch !== undefined && epoch !== lastDistinctEpoch && epoch !== lastDistinctEpoch + 1) {
            // Gap detected: drop this and all subsequent groups.
            for (const e of groupEntries) {
                dropped.push({
                    entry: e,
                    reason: `§10.1: missing intermediate snapshot; expected epoch ${lastDistinctEpoch + 1}, got ${epoch}`
                });
            }
            // Also drop remaining groups.
            const idx = sortedGroups.findIndex(([k]) => k === key);
            for (let i = idx + 1; i < sortedGroups.length; i++) {
                for (const e of sortedGroups[i][1]) {
                    dropped.push({
                        entry: e,
                        reason: `§10.1: dropped due to earlier missing intermediate snapshot`
                    });
                }
            }
            break;
        }
        acceptedGroups.push({ key, entries: groupEntries, epoch });
        if (epoch !== lastDistinctEpoch) {
            lastDistinctEpoch = epoch;
        }
    }

    // 4. Build the ordered plan. Within each snapshot group, entries chain
    //    off each other (chainIndex 0 is the head).
    for (const { key, entries: groupEntries, epoch } of acceptedGroups) {
        // Stable sort within the group by requestKey (slot + deliveryId)
        // so the plan is deterministic.
        const sortedEntries = [...groupEntries].sort((a, b) => {
            const ra = `${a.slotId}|${a.battleDeliveryId}`;
            const rb = `${b.slotId}|${b.battleDeliveryId}`;
            return ra < rb ? -1 : ra > rb ? 1 : 0;
        });
        for (let i = 0; i < sortedEntries.length; i++) {
            const entry = sortedEntries[i];
            const callerFloor = entry.nextEpoch ?? (epoch + 1);
            // Chain: head = epoch + 1; second = epoch + 2; etc.
            const chainedFloor = epoch + 1 + i;
            const resolvedNextEpoch = Math.max(callerFloor, chainedFloor);
            planned.push({
                ...entry,
                snapshotGroupKey: key,
                chainIndex: i,
                resolvedNextEpoch,
                isChainHead: i === 0
            });
        }
    }

    return { planned, dropped };
}
