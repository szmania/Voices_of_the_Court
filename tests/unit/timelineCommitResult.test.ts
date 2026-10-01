import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    consumeTimelineCommitResults,
    consumeTimelineCommitResultsFromLog,
    computeCommitResultId,
    formatRegistryRecoveryLine,
    parseTimelineDiagnosticLine,
    type TimelineCommitResultEvent
} from '../../src/main/timelineCommitResult';

const SEP = '/;/';

function commitResultLine(overrides: Record<string, string> = {}): string {
    const fields: Record<string, string> = {
        attemptId: 'att-1',
        code: 'applied',
        schema: '2',
        campaign: '1',
        player: '1001',
        source: 'battle',
        slot: '1',
        delivery: '0',
        obsEpoch: '5',
        obsNA: '11',
        obsNB: '22',
        obsPA: '1',
        obsPB: '2',
        obsTok: '111',
        gpA: '11',
        gpB: '22',
        tEpoch: '6',
        tNA: '101',
        tNB: '202',
        ck3Epoch: '6',
        ck3NA: '101',
        ck3NB: '202',
        ck3PA: '11',
        ck3PB: '22',
        ck3Tok: '222'
    };
    Object.assign(fields, overrides);
    return [
        'VOTC:TIMELINE', 'commit_result', fields.attemptId, fields.code, fields.schema,
        fields.campaign, fields.player, fields.source, fields.slot, fields.delivery,
        fields.obsEpoch, fields.obsNA, fields.obsNB, fields.obsPA, fields.obsPB, fields.obsTok,
        fields.gpA, fields.gpB, fields.tEpoch, fields.tNA, fields.tNB,
        fields.ck3Epoch, fields.ck3NA, fields.ck3NB, fields.ck3PA, fields.ck3PB, fields.ck3Tok
    ].join(SEP);
}

function snapshotLine(overrides: Record<string, string> = {}): string {
    const fields: Record<string, string> = {
        schema: '2',
        campaign: '1',
        player: '1001',
        source: 'battle',
        epoch: '6',
        nodeA: '101',
        nodeB: '202',
        parentA: '11',
        parentB: '22',
        token: '222',
        pendingToken: '333'
    };
    Object.assign(fields, overrides);
    return [
        'VOTC:TIMELINE', 'snapshot', fields.schema, fields.campaign, fields.player, fields.source,
        fields.epoch, fields.nodeA, fields.nodeB, fields.parentA, fields.parentB,
        fields.token, fields.pendingToken
    ].join(SEP);
}

function historyRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'sig-1',
        dedupKey: 'sig-1@101-202',
        createdAt: '2026-07-01T00:00:00Z',
        votcCheckpointEpoch: 6,
        votcTimelineNodeId: '101-202',
        votcTimelineParentId: '11-22',
        votcCommitAttemptId: 'att-1',
        content: 'report',
        ...overrides
    };
}

function makeHistoryDir(recordsByPlayer: Record<string, Record<string, unknown>[]>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-commit-result-'));
    for (const [playerId, records] of Object.entries(recordsByPlayer)) {
        fs.writeFileSync(path.join(dir, `player_${playerId}.json`), JSON.stringify(records, null, 2), 'utf8');
    }
    return dir;
}

function readHistory(dir: string, playerId: string): Record<string, unknown>[] {
    return JSON.parse(fs.readFileSync(path.join(dir, `player_${playerId}.json`), 'utf8'));
}

describe('parseTimelineDiagnosticLine', () => {
    it('parses a full commit_result line with all structured fields', () => {
        const event = parseTimelineDiagnosticLine(commitResultLine());
        expect(event).toMatchObject({
            type: 'commit_result',
            format: 'full',
            attemptId: 'att-1',
            resultCode: 'applied',
            protocolSchema: 2,
            campaign: '1',
            playerId: '1001',
            source: 'battle',
            slot: '1',
            deliveryId: '0',
            observed: { epoch: 5, nodeA: 11, nodeB: 22, parentA: 1, parentB: 2, checkpointToken: 111 },
            graphParentA: 11,
            graphParentB: 22,
            targetEpoch: 6,
            targetNodeA: 101,
            targetNodeB: 202,
            ck3State: { epoch: 6, nodeA: 101, nodeB: 202, parentA: 11, parentB: 22, checkpointToken: 222 }
        });
    });

    it('tolerates the P1.2 legacy commit_result line without crashing', () => {
        const event = parseTimelineDiagnosticLine('VOTC:TIMELINE/;/commit_result/;/att-1/;/skipped_advanced');
        expect(event).toMatchObject({
            type: 'commit_result',
            format: 'legacy',
            attemptId: 'att-1',
            resultCode: 'skipped_advanced'
        });
    });

    it('parses snapshot lines emitted before a checkpoint bump', () => {
        const event = parseTimelineDiagnosticLine(snapshotLine());
        expect(event).toMatchObject({
            type: 'snapshot',
            protocolSchema: 2,
            campaign: '1',
            playerId: '1001',
            source: 'battle',
            epoch: 6,
            nodeA: 101,
            nodeB: 202,
            parentA: 11,
            parentB: 22,
            checkpointToken: 222,
            pendingCheckpointToken: 333
        });
    });

    it('parses bump lines with the post-bump epoch and date', () => {
        const event = parseTimelineDiagnosticLine(
            'VOTC:TIMELINE/;/bump/;/2/;/1/;/1001/;/letter/;/7/;/0/;/0/;/0/;/0/;/333/;/1066.10.14'
        );
        expect(event).toMatchObject({
            type: 'bump',
            playerId: '1001',
            source: 'letter',
            epoch: 7,
            checkpointToken: 333,
            date: '1066.10.14'
        });
        if (event?.type !== 'bump') throw new Error('expected bump event');
        expect(event.nodeA).toBeUndefined();
    });

    it('parses commit attempt lines with the target state', () => {
        const event = parseTimelineDiagnosticLine(
            'VOTC:TIMELINE/;/commit/;/att-1/;/2/;/1/;/1001/;/battle/;/1/;/0/;/6/;/101/;/202/;/11/;/22'
        );
        expect(event).toMatchObject({
            type: 'commit',
            attemptId: 'att-1',
            playerId: '1001',
            source: 'battle',
            slot: '1',
            targetEpoch: 6,
            targetNodeA: 101,
            targetNodeB: 202,
            graphParentA: 11,
            graphParentB: 22
        });
    });

    it('parses guard and registry_recovery lines as raw field events', () => {
        expect(parseTimelineDiagnosticLine('VOTC:TIMELINE/;/skip_advanced/;/a/;/b')).toEqual({
            type: 'skip_advanced',
            fields: ['a', 'b']
        });
        expect(parseTimelineDiagnosticLine('VOTC:TIMELINE/;/skip_delivery_mismatch/;/x')).toEqual({
            type: 'skip_delivery_mismatch',
            fields: ['x']
        });
        expect(parseTimelineDiagnosticLine('VOTC:TIMELINE/;/ambiguous/;/reason')).toEqual({
            type: 'ambiguous',
            fields: ['reason']
        });
        expect(parseTimelineDiagnosticLine('VOTC:TIMELINE/;/registry_recovery/;/corrupt/;/file.json')).toEqual({
            type: 'registry_recovery',
            kind: 'corrupt',
            fields: ['file.json']
        });
    });

    it('finds the marker inside a timestamped debug.log line', () => {
        const event = parseTimelineDiagnosticLine(`[15:20:33][some.cpp:1]: ${commitResultLine()}`);
        expect(event?.type).toBe('commit_result');
    });

    it('returns null for unrelated lines and invalid for unknown types', () => {
        expect(parseTimelineDiagnosticLine('VOTC:IN/;/init/;/111')).toBeNull();
        expect(parseTimelineDiagnosticLine('no marker here')).toBeNull();
        expect(parseTimelineDiagnosticLine('VOTC:TIMELINE/;/bogus/;/x')).toMatchObject({ type: 'invalid' });
    });

    it('rejects commit_result lines with a missing attempt id or result code', () => {
        expect(parseTimelineDiagnosticLine('VOTC:TIMELINE/;/commit_result/;//;/applied')).toMatchObject({ type: 'invalid' });
        expect(parseTimelineDiagnosticLine('VOTC:TIMELINE/;/commit_result/;/att-1')).toMatchObject({ type: 'invalid' });
    });
});

describe('computeCommitResultId', () => {
    it('is deterministic for the same attempt, code and ck3 state', () => {
        const state = { epoch: 6, nodeA: 101, nodeB: 202, parentA: 11, parentB: 22, checkpointToken: 222 };
        expect(computeCommitResultId('att-1', 'applied', state)).toBe(computeCommitResultId('att-1', 'applied', state));
    });

    it('changes when any input changes', () => {
        const state = { epoch: 6, nodeA: 101, nodeB: 202, parentA: 11, parentB: 22, checkpointToken: 222 };
        const base = computeCommitResultId('att-1', 'applied', state);
        expect(computeCommitResultId('att-2', 'applied', state)).not.toBe(base);
        expect(computeCommitResultId('att-1', 'ambiguous_node', state)).not.toBe(base);
        expect(computeCommitResultId('att-1', 'applied', { ...state, nodeA: 555 })).not.toBe(base);
        expect(computeCommitResultId('att-1', 'applied', {})).not.toBe(base);
    });
});

describe('formatRegistryRecoveryLine', () => {
    it('formats a structured registry_recovery line that round-trips through the parser', () => {
        const line = formatRegistryRecoveryLine('corrupt', 'C:\\data\\player_1001.json', 'C:\\data\\player_1001.quarantine.json');
        const event = parseTimelineDiagnosticLine(line);
        expect(event).toEqual({
            type: 'registry_recovery',
            kind: 'corrupt',
            fields: ['C:\\data\\player_1001.json', 'C:\\data\\player_1001.quarantine.json']
        });
    });
});

describe('consumeTimelineCommitResults', () => {
    it('updates the battle history record matching the attempt id', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        const summary = consumeTimelineCommitResults(commitResultLine(), { historyDir: dir });
        expect(summary.appliedUpdates).toBe(1);
        const [record] = readHistory(dir, '1001');
        expect(record.votcCommitOutcome).toBe('applied');
        expect(record.votcCommitOutcomeSource).toBe('log');
        expect(record.votcCommitResultId).toBe(
            computeCommitResultId('att-1', 'applied', { epoch: 6, nodeA: 101, nodeB: 202, parentA: 11, parentB: 22, checkpointToken: 222 })
        );
    });

    it('is idempotent when the same log is scanned twice', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        consumeTimelineCommitResults(commitResultLine(), { historyDir: dir });
        const before = readHistory(dir, '1001');
        const summary = consumeTimelineCommitResults(commitResultLine(), { historyDir: dir });
        expect(summary.appliedUpdates).toBe(0);
        expect(summary.duplicateResults).toBe(1);
        expect(readHistory(dir, '1001')).toEqual(before);
    });

    it('keeps the first logged outcome when a conflicting result for the same attempt appears', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        consumeTimelineCommitResults(commitResultLine(), { historyDir: dir });
        const summary = consumeTimelineCommitResults(commitResultLine({ code: 'ambiguous_node' }), { historyDir: dir });
        expect(summary.appliedUpdates).toBe(0);
        expect(summary.duplicateResults).toBe(1);
        expect(readHistory(dir, '1001')[0].votcCommitOutcome).toBe('applied');
    });

    it('consumes legacy commit_result lines and marks them as legacy format', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        const summary = consumeTimelineCommitResults('VOTC:TIMELINE/;/commit_result/;/att-1/;/skipped_advanced', { historyDir: dir });
        expect(summary.appliedUpdates).toBe(1);
        const [record] = readHistory(dir, '1001');
        expect(record.votcCommitOutcome).toBe('skipped_advanced');
        expect(record.votcCommitOutcomeSource).toBe('log');
        expect(record.votcCommitResultId).toBe(computeCommitResultId('att-1', 'skipped_advanced', {}));
    });

    it('reports unmatched attempt ids without writing any file', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord({ votcCommitAttemptId: 'att-other' })] });
        const before = readHistory(dir, '1001');
        const summary = consumeTimelineCommitResults(commitResultLine(), { historyDir: dir });
        expect(summary.unmatchedResults).toBe(1);
        expect(summary.appliedUpdates).toBe(0);
        expect(readHistory(dir, '1001')).toEqual(before);
    });

    it('locates the history record across player files when the result line has no player id', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        const summary = consumeTimelineCommitResults('VOTC:TIMELINE/;/commit_result/;/att-1/;/applied', { historyDir: dir });
        expect(summary.appliedUpdates).toBe(1);
        expect(readHistory(dir, '1001')[0].votcCommitOutcome).toBe('applied');
    });
});

describe('synthetic already-applied proofs', () => {
    it('proves already_applied when a snapshot shows the target node at a self-consistent epoch', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        const summary = consumeTimelineCommitResults(snapshotLine(), { historyDir: dir });
        expect(summary.syntheticProofs).toBe(1);
        const [record] = readHistory(dir, '1001');
        expect(record.votcCommitOutcome).toBe('already_applied');
        expect(record.votcCommitOutcomeSource).toBe('synthetic');
        expect(typeof record.votcCommitResultId).toBe('string');
    });

    it('stays ambiguous when the snapshot shows a different node', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        const summary = consumeTimelineCommitResults(snapshotLine({ nodeA: '555', nodeB: '666' }), { historyDir: dir });
        expect(summary.syntheticProofs).toBe(0);
        expect(summary.ambiguousAttempts).toBe(1);
        expect(readHistory(dir, '1001')[0].votcCommitOutcome).toBeUndefined();
    });

    it('stays ambiguous when the snapshot epoch is older than the attempt target epoch', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        const summary = consumeTimelineCommitResults(snapshotLine({ epoch: '5' }), { historyDir: dir });
        expect(summary.syntheticProofs).toBe(0);
        expect(summary.ambiguousAttempts).toBe(1);
        expect(readHistory(dir, '1001')[0].votcCommitOutcome).toBeUndefined();
    });

    it('stays ambiguous when the snapshot belongs to a different player', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        const summary = consumeTimelineCommitResults(snapshotLine({ player: '2002' }), { historyDir: dir });
        expect(summary.syntheticProofs).toBe(0);
        expect(readHistory(dir, '1001')[0].votcCommitOutcome).toBeUndefined();
    });

    it('never overwrites a logged outcome with a synthetic proof', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        const content = `${commitResultLine({ code: 'ambiguous_node' })}\n${snapshotLine()}`;
        consumeTimelineCommitResults(content, { historyDir: dir });
        const [record] = readHistory(dir, '1001');
        expect(record.votcCommitOutcome).toBe('ambiguous_node');
        expect(record.votcCommitOutcomeSource).toBe('log');
    });

    it('upgrades a synthetic proof when the real result arrives later', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        consumeTimelineCommitResults(snapshotLine(), { historyDir: dir });
        const summary = consumeTimelineCommitResults(commitResultLine(), { historyDir: dir });
        expect(summary.appliedUpdates).toBe(1);
        const [record] = readHistory(dir, '1001');
        expect(record.votcCommitOutcome).toBe('applied');
        expect(record.votcCommitOutcomeSource).toBe('log');
    });

    it('does not re-prove a record that already has a synthetic outcome', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        consumeTimelineCommitResults(snapshotLine(), { historyDir: dir });
        const before = readHistory(dir, '1001');
        const summary = consumeTimelineCommitResults(snapshotLine(), { historyDir: dir });
        expect(summary.syntheticProofs).toBe(0);
        expect(readHistory(dir, '1001')).toEqual(before);
    });

    it('uses the latest matching snapshot for the synthetic proof', () => {
        const dir = makeHistoryDir({ '1001': [historyRecord()] });
        const older = snapshotLine({ epoch: '6', token: '222' });
        const newer = snapshotLine({ epoch: '9', token: '999', pendingToken: '111' });
        consumeTimelineCommitResults(`${older}\n${newer}`, { historyDir: dir });
        const [record] = readHistory(dir, '1001');
        expect(record.votcCommitResultId).toBe(
            computeCommitResultId('att-1', 'already_applied', { epoch: 9, nodeA: 101, nodeB: 202, parentA: 11, parentB: 22, checkpointToken: 999 })
        );
    });
});

describe('error paths', () => {
    it('reports a write failure and continues processing other dirty files', () => {
        const dir = makeHistoryDir({
            '1001': [historyRecord()],
            '1002': [historyRecord({ votcCommitAttemptId: 'att-2' })]
        });
        const file1001 = path.join(dir, 'player_1001.json');
        fs.chmodSync(file1001, 0o444);
        try {
            const summary = consumeTimelineCommitResults(
                `${commitResultLine()}\n${commitResultLine({ attemptId: 'att-2', player: '1002' })}`,
                { historyDir: dir }
            );
            expect(summary.writeFailures).toBe(1);
            expect(summary.appliedUpdates).toBe(2);
            expect(readHistory(dir, '1002')[0].votcCommitOutcome).toBe('applied');
            const unchanged = JSON.parse(fs.readFileSync(file1001, 'utf8'));
            expect(unchanged[0].votcCommitOutcome).toBeUndefined();
        } finally {
            fs.chmodSync(file1001, 0o666);
        }
    });

    it('returns null when the debug.log file is missing', () => {
        const summary = consumeTimelineCommitResultsFromLog(
            path.join(os.tmpdir(), 'nonexistent-votc-debug.log'),
            os.tmpdir()
        );
        expect(summary).toBeNull();
    });

    it('skips malformed history files and continues processing the rest', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-commit-result-'));
        fs.writeFileSync(path.join(dir, 'player_1001.json'), 'not json', 'utf8');
        fs.writeFileSync(path.join(dir, 'player_1002.json'), JSON.stringify([historyRecord({ votcCommitAttemptId: 'att-2' })]), 'utf8');
        const summary = consumeTimelineCommitResults(
            commitResultLine({ attemptId: 'att-2', player: '1002' }),
            { historyDir: dir }
        );
        expect(summary.appliedUpdates).toBe(1);
        const [record] = JSON.parse(fs.readFileSync(path.join(dir, 'player_1002.json'), 'utf8'));
        expect(record.votcCommitOutcome).toBe('applied');
    });
});

describe('formatRegistryRecoveryLine escaping', () => {
    it('escapes and unescapes the field delimiter inside registry_recovery paths', () => {
        const line = formatRegistryRecoveryLine('corrupt', 'C:\\data\\foo/;/bar.json', 'C:\\data\\qux.json');
        expect(line).not.toContain('/;/bar.json');
        const event = parseTimelineDiagnosticLine(line);
        expect(event).toEqual({
            type: 'registry_recovery',
            kind: 'corrupt',
            fields: ['C:\\data\\foo/;/bar.json', 'C:\\data\\qux.json']
        });
    });
});
