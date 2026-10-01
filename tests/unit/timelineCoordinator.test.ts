/**
 * §10.1 TimelineCoordinator tests.
 *
 * The coordinator orders multi-battle batches by snapshot evidence and
 * stops when an intermediate snapshot is missing (no guessing from array
 * or arrival order).
 */
import {
    coordinateBattlesBySnapshot,
    type BattleCoordinatorEntry
} from '../../src/main/timelineCoordinator';
import type { TimelineContext } from '../../src/main/timelineManager';

function ctx(epoch: number, nodeId: string, token = 42, pendingToken = 100): TimelineContext {
    return {
        playerId: '1001',
        checkpointEpoch: epoch,
        checkpointToken: token,
        timelineNodeId: nodeId,
        pendingCheckpointToken: pendingToken
    };
}

function entry(
    signature: string,
    slotId: string,
    deliveryId: string,
    context: TimelineContext,
    nextEpoch?: number
): BattleCoordinatorEntry {
    return {
        eventSignature: signature,
        slotId,
        battleDeliveryId: deliveryId,
        context,
        nextEpoch
    };
}

describe('§10.1 TimelineCoordinator: orders multi-battle by snapshot evidence', () => {
    it('single battle: planned with chainIndex 0, resolvedNextEpoch = epoch + 1', () => {
        const result = coordinateBattlesBySnapshot([
            entry('battle|sig-A', 'battle_report_1', 'bd-1', ctx(5, '11-22'))
        ]);
        expect(result.dropped).toEqual([]);
        expect(result.planned).toHaveLength(1);
        expect(result.planned[0].chainIndex).toBe(0);
        expect(result.planned[0].isChainHead).toBe(true);
        expect(result.planned[0].resolvedNextEpoch).toBe(6);
    });

    it('two battles same snapshot: chain (second chains off first, epoch+1 then epoch+2)', () => {
        const shared = ctx(5, '11-22');
        const result = coordinateBattlesBySnapshot([
            entry('battle|sig-A', 'battle_report_1', 'bd-1', shared),
            entry('battle|sig-B', 'battle_report_2', 'bd-2', shared)
        ]);
        expect(result.dropped).toEqual([]);
        expect(result.planned).toHaveLength(2);
        // Both in same snapshot group
        expect(result.planned[0].snapshotGroupKey).toBe(result.planned[1].snapshotGroupKey);
        // Head is chainIndex 0, second is chainIndex 1
        expect(result.planned[0].chainIndex).toBe(0);
        expect(result.planned[0].isChainHead).toBe(true);
        expect(result.planned[1].chainIndex).toBe(1);
        expect(result.planned[1].isChainHead).toBe(false);
        // Second chains: epoch + 2 (head = epoch + 1, second = epoch + 2)
        expect(result.planned[0].resolvedNextEpoch).toBe(6);
        expect(result.planned[1].resolvedNextEpoch).toBe(7);
    });

    it('two battles different snapshots at consecutive epochs: both planned (epoch asc order)', () => {
        const result = coordinateBattlesBySnapshot([
            entry('battle|sig-B', 'battle_report_2', 'bd-2', ctx(6, '33-44')),
            entry('battle|sig-A', 'battle_report_1', 'bd-1', ctx(5, '11-22'))
        ]);
        expect(result.dropped).toEqual([]);
        expect(result.planned).toHaveLength(2);
        // Ordered by epoch ascending: sig-A (epoch 5) first, sig-B (epoch 6) second
        expect(result.planned[0].eventSignature).toBe('battle|sig-A');
        expect(result.planned[1].eventSignature).toBe('battle|sig-B');
        // Each is the head of its own snapshot group
        expect(result.planned[0].isChainHead).toBe(true);
        expect(result.planned[1].isChainHead).toBe(true);
        // Each uses its own nextEpoch (epoch + 1)
        expect(result.planned[0].resolvedNextEpoch).toBe(6);
        expect(result.planned[1].resolvedNextEpoch).toBe(7);
    });

    it('missing intermediate snapshot (epoch 3 then epoch 5): drops the later group and stops', () => {
        const result = coordinateBattlesBySnapshot([
            entry('battle|sig-A', 'battle_report_1', 'bd-1', ctx(3, '11-22')),
            entry('battle|sig-B', 'battle_report_2', 'bd-2', ctx(5, '33-44'))
        ]);
        // The coordinator does NOT guess the order: it drops the later
        // group because the intermediate epoch 4 snapshot is missing.
        expect(result.planned).toHaveLength(1);
        expect(result.planned[0].eventSignature).toBe('battle|sig-A');
        expect(result.dropped).toHaveLength(1);
        expect(result.dropped[0].entry.eventSignature).toBe('battle|sig-B');
        expect(result.dropped[0].reason).toContain('missing intermediate snapshot');
    });

    it('three groups with gap in the middle: drops everything after the gap', () => {
        const result = coordinateBattlesBySnapshot([
            entry('battle|sig-A', 'battle_report_1', 'bd-1', ctx(3, '11-22')),
            entry('battle|sig-B', 'battle_report_2', 'bd-2', ctx(5, '33-44')),
            entry('battle|sig-C', 'battle_report_3', 'bd-3', ctx(6, '55-66'))
        ]);
        // Epoch 3 accepted, epoch 5 is a gap (expected 4), so B and C are dropped.
        expect(result.planned).toHaveLength(1);
        expect(result.planned[0].eventSignature).toBe('battle|sig-A');
        expect(result.dropped).toHaveLength(2);
        const droppedSigs = result.dropped.map(d => d.entry.eventSignature).sort();
        expect(droppedSigs).toEqual(['battle|sig-B', 'battle|sig-C']);
    });

    it('empty input: empty plan, no drops', () => {
        const result = coordinateBattlesBySnapshot([]);
        expect(result.planned).toEqual([]);
        expect(result.dropped).toEqual([]);
    });

    it('respects caller nextEpoch floor when chaining within a snapshot group', () => {
        const shared = ctx(5, '11-22');
        const result = coordinateBattlesBySnapshot([
            entry('battle|sig-A', 'battle_report_1', 'bd-1', shared, 10),  // caller wants epoch 10
            entry('battle|sig-B', 'battle_report_2', 'bd-2', shared)      // no caller floor
        ]);
        expect(result.dropped).toEqual([]);
        // Head: max(10, 6) = 10
        expect(result.planned[0].resolvedNextEpoch).toBe(10);
        // Second: max(undefined, 7) = 7 (chain floor wins)
        expect(result.planned[1].resolvedNextEpoch).toBe(7);
    });

    it('same snapshot group: entries sorted by requestKey (stable, deterministic)', () => {
        const shared = ctx(5, '11-22');
        const result = coordinateBattlesBySnapshot([
            entry('battle|sig-Z', 'battle_report_3', 'bd-3', shared),
            entry('battle|sig-A', 'battle_report_1', 'bd-1', shared),
            entry('battle|sig-M', 'battle_report_2', 'bd-2', shared)
        ]);
        expect(result.dropped).toEqual([]);
        expect(result.planned).toHaveLength(3);
        // Sorted by slot|delivery: bd-1, bd-2, bd-3
        expect(result.planned[0].battleDeliveryId).toBe('bd-1');
        expect(result.planned[1].battleDeliveryId).toBe('bd-2');
        expect(result.planned[2].battleDeliveryId).toBe('bd-3');
        // Chain indices 0, 1, 2
        expect(result.planned[0].chainIndex).toBe(0);
        expect(result.planned[1].chainIndex).toBe(1);
        expect(result.planned[2].chainIndex).toBe(2);
        // Epochs 6, 7, 8
        expect(result.planned[0].resolvedNextEpoch).toBe(6);
        expect(result.planned[1].resolvedNextEpoch).toBe(7);
        expect(result.planned[2].resolvedNextEpoch).toBe(8);
    });

    it('two groups same epoch different node: both planned, sorted by node label', () => {
        const result = coordinateBattlesBySnapshot([
            entry('battle|sig-B', 'battle_report_2', 'bd-2', ctx(5, '99-88')),
            entry('battle|sig-A', 'battle_report_1', 'bd-1', ctx(5, '11-22'))
        ]);
        // Same epoch, different nodes: both accepted (no gap), sorted by node label.
        expect(result.dropped).toEqual([]);
        expect(result.planned).toHaveLength(2);
        // '11-22' < '99-88', so sig-A first
        expect(result.planned[0].eventSignature).toBe('battle|sig-A');
        expect(result.planned[1].eventSignature).toBe('battle|sig-B');
    });
});
