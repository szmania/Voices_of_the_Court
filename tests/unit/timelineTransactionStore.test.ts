import {
    TimelineTransactionStore,
    _serializePayload,
    parseTransactionDiagnosticLine,
    type TransactionManifest,
    type TransactionState,
    type PendingTransaction
} from '../../src/main/timelineTransactionStore';
import { TIMELINE_DIAGNOSTIC_MARKER } from '../../src/main/timelineCommitResult';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

function transactionsRoot(tmpDir: string): string {
    return path.join(tmpDir, 'votc_data', 'transactions');
}

function manifestPathOf(tmpDir: string, attemptId: string): string {
    return path.join(transactionsRoot(tmpDir), attemptId, 'manifest.json');
}

function readManifest(tmpDir: string, attemptId: string): TransactionManifest {
    const p = manifestPathOf(tmpDir, attemptId);
    return JSON.parse(fs.readFileSync(p, 'utf8')) as TransactionManifest;
}

function sha256Hex(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function payloadSha256(payload: unknown): string {
    return _serializePayload(payload).sha256;
}

describe('TimelineTransactionStore begin/stage/commit (§7.4 P3.3)', () => {
    let tmpDir: string;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-'));
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('beginTransaction preallocates target node, record IDs, and artifact path in the manifest', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-001';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a', 'rec-b'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.attemptId).toBe(attemptId);
        expect(manifest.targetNode).toBe('101-202');
        expect(manifest.recordIds).toEqual(['rec-a', 'rec-b']);
        expect(manifest.artifactPath).toBe(path.join(tmpDir, 'run', 'votc.txt'));
        expect(manifest.status).toBe('in_progress');
        expect(manifest.completedSteps).toEqual([]);
        expect(manifest.stagedRecords).toEqual({});
    });

    it('beginTransaction is idempotent: calling twice with same attemptId does not reset state', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-002';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.stageRecordPayload(attemptId, 'rec-a', { text: 'first' });
        store.markStepCompleted(attemptId, 'stage_records');

        // Re-begin should NOT overwrite the existing in-progress manifest.
        store.beginTransaction(attemptId, {
            targetNode: '303-404',
            recordIds: ['rec-z'],
            artifactPath: path.join(tmpDir, 'run', 'other.txt')
        });

        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.targetNode).toBe('101-202');
        expect(manifest.recordIds).toEqual(['rec-a']);
        expect(manifest.stagedRecords['rec-a'].payload).toEqual({ text: 'first' });
        expect(manifest.completedSteps).toEqual(['stage_records']);
    });

    it('beginTransaction throws when called with an already-committed attemptId', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-003';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.commitTransaction(attemptId);

        expect(() => store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        })).toThrow(/committed|terminal/);
    });

    it('stageRecordPayload stores payload and hash by record ID', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-010';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a', 'rec-b'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        const payloadA = { text: 'hello', n: 1 };
        store.stageRecordPayload(attemptId, 'rec-a', payloadA);

        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.stagedRecords['rec-a'].payload).toEqual(payloadA);
        expect(manifest.stagedRecords['rec-a'].sha256).toBe(payloadSha256(payloadA));
        expect(manifest.stagedRecords['rec-b']).toBeUndefined();
    });

    it('stageRecordPayload is idempotent for same recordId + same payload (no rewrite)', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-011';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        const payload = { text: 'same' };
        store.stageRecordPayload(attemptId, 'rec-a', payload);
        const mtimeAfterFirst = fs.statSync(manifestPathOf(tmpDir, attemptId)).mtimeMs;

        store.stageRecordPayload(attemptId, 'rec-a', payload);
        const mtimeAfterSecond = fs.statSync(manifestPathOf(tmpDir, attemptId)).mtimeMs;

        expect(mtimeAfterSecond).toBe(mtimeAfterFirst);
    });

    it('stageRecordPayload overwrites for same recordId + different payload (at-least-once)', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-012';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.stageRecordPayload(attemptId, 'rec-a', { text: 'first' });
        store.stageRecordPayload(attemptId, 'rec-a', { text: 'second' });

        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.stagedRecords['rec-a'].payload).toEqual({ text: 'second' });
        expect(manifest.stagedRecords['rec-a'].sha256).toBe(payloadSha256({ text: 'second' }));
    });

    it('markStepCompleted appends a step and persists it', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-020';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.markStepCompleted(attemptId, 'stage_records');
        store.markStepCompleted(attemptId, 'write_artifact');

        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.completedSteps).toEqual(['stage_records', 'write_artifact']);
    });

    it('markStepCompleted is idempotent for the same step name', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-021';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.markStepCompleted(attemptId, 'stage_records');
        const mtimeAfterFirst = fs.statSync(manifestPathOf(tmpDir, attemptId)).mtimeMs;
        store.markStepCompleted(attemptId, 'stage_records');
        const mtimeAfterSecond = fs.statSync(manifestPathOf(tmpDir, attemptId)).mtimeMs;

        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.completedSteps).toEqual(['stage_records']);
        expect(mtimeAfterSecond).toBe(mtimeAfterFirst);
    });

    it('commitTransaction marks the manifest as committed and appends the commit step', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-030';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.stageRecordPayload(attemptId, 'rec-a', { text: 'x' });
        store.markStepCompleted(attemptId, 'stage_records');
        store.commitTransaction(attemptId);

        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.status).toBe('committed');
        expect(manifest.completedSteps).toContain('commit');
    });

    it('commitTransaction throws when transaction was already aborted', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-031';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.abortTransaction(attemptId, 'test abort');

        expect(() => store.commitTransaction(attemptId)).toThrow(/aborted|terminal/);
    });
});

describe('TimelineTransactionStore artifact atomic write (§7.4 P3.3)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-art-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writeArtifactAtomic writes the artifact via tmp+rename and records path + SHA-256', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-100';
        const artifactPath = path.join(tmpDir, 'run', 'votc.txt');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath
        });

        const content = 'hello artifact';
        store.writeArtifactAtomic(attemptId, artifactPath, content);

        expect(fs.readFileSync(artifactPath, 'utf8')).toBe(content);
        // No leftover tmp file.
        expect(fs.existsSync(`${artifactPath}.tmp`)).toBe(false);

        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.artifact).toBeDefined();
        expect(manifest.artifact!.path).toBe(artifactPath);
        expect(manifest.artifact!.sha256).toBe(sha256Hex(content));
        expect(manifest.completedSteps).toContain('write_artifact');
    });

    it('writeArtifactAtomic is idempotent: same path + same content is a no-op', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-101';
        const artifactPath = path.join(tmpDir, 'run', 'votc.txt');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath
        });

        const content = 'hello artifact';
        store.writeArtifactAtomic(attemptId, artifactPath, content);
        const mtimeAfterFirst = fs.statSync(artifactPath).mtimeMs;

        store.writeArtifactAtomic(attemptId, artifactPath, content);
        const mtimeAfterSecond = fs.statSync(artifactPath).mtimeMs;

        expect(mtimeAfterSecond).toBe(mtimeAfterFirst);
    });

    it('writeArtifactAtomic overwrites when content differs (at-least-once)', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-102';
        const artifactPath = path.join(tmpDir, 'run', 'votc.txt');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath
        });

        store.writeArtifactAtomic(attemptId, artifactPath, 'first');
        store.writeArtifactAtomic(attemptId, artifactPath, 'second');

        expect(fs.readFileSync(artifactPath, 'utf8')).toBe('second');
        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.artifact!.sha256).toBe(sha256Hex('second'));
    });

    it('writeArtifactAtomic records a tmp path in the manifest for crash recovery', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-103';
        const artifactPath = path.join(tmpDir, 'run', 'votc.txt');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath
        });

        store.writeArtifactAtomic(attemptId, artifactPath, 'payload');

        const manifest = readManifest(tmpDir, attemptId);
        expect(typeof manifest.artifact!.tmpPath).toBe('string');
        expect(manifest.artifact!.tmpPath).not.toBe(artifactPath);
    });
});

describe('TimelineTransactionStore upsertRecord idempotent business writes (§7.4 P3.3)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-up-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('upsertRecord writes a business file at the given path for the record ID', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-200';
        const recordPath = path.join(tmpDir, 'summaries', 'player_1', 'char_42.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        const payload = { text: 'summary content' };
        store.upsertRecord(attemptId, 'rec-a', recordPath, payload);

        expect(fs.readFileSync(recordPath, 'utf8')).toBe(JSON.stringify(payload, null, '\t'));
        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.stagedRecords['rec-a'].path).toBe(recordPath);
        expect(manifest.stagedRecords['rec-a'].sha256).toBe(payloadSha256(payload));
        expect(manifest.completedSteps).toContain('record:rec-a');
    });

    it('upsertRecord is idempotent for same recordId + same path + same payload', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-201';
        const recordPath = path.join(tmpDir, 'summaries', 'char_42.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        const payload = { text: 'same' };
        store.upsertRecord(attemptId, 'rec-a', recordPath, payload);
        const fileMtimeAfterFirst = fs.statSync(recordPath).mtimeMs;
        const manifestMtimeAfterFirst = fs.statSync(manifestPathOf(tmpDir, attemptId)).mtimeMs;

        store.upsertRecord(attemptId, 'rec-a', recordPath, payload);
        const fileMtimeAfterSecond = fs.statSync(recordPath).mtimeMs;
        const manifestMtimeAfterSecond = fs.statSync(manifestPathOf(tmpDir, attemptId)).mtimeMs;

        expect(fileMtimeAfterSecond).toBe(fileMtimeAfterFirst);
        expect(manifestMtimeAfterSecond).toBe(manifestMtimeAfterFirst);
    });

    it('upsertRecord overwrites the file when payload differs (at-least-once)', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-202';
        const recordPath = path.join(tmpDir, 'summaries', 'char_42.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        store.upsertRecord(attemptId, 'rec-a', recordPath, { text: 'first' });
        store.upsertRecord(attemptId, 'rec-a', recordPath, { text: 'second' });

        expect(fs.readFileSync(recordPath, 'utf8')).toBe(JSON.stringify({ text: 'second' }, null, '\t'));
    });

    it('upsertRecord uses manifest hash to skip re-writing when the on-disk file already matches', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-203';
        const recordPath = path.join(tmpDir, 'summaries', 'char_42.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        const payload = { text: 'persisted' };
        store.upsertRecord(attemptId, 'rec-a', recordPath, payload);
        // Simulate a crash after the file was written but before manifest update.
        // For this test we just call upsertRecord again: it should detect the
        // file already matches and not rewrite it.
        const fileMtimeAfterFirst = fs.statSync(recordPath).mtimeMs;
        store.upsertRecord(attemptId, 'rec-a', recordPath, payload);
        const fileMtimeAfterSecond = fs.statSync(recordPath).mtimeMs;
        expect(fileMtimeAfterSecond).toBe(fileMtimeAfterFirst);
    });
});

describe('TimelineTransactionStore crash recovery (§7.4 P3.3)', () => {
    let tmpDir: string;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-rec-'));
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('recoverPendingTransactions returns in-progress manifests that have not committed', () => {
        const store = new TimelineTransactionStore(tmpDir);
        store.beginTransaction('att-300', {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.beginTransaction('att-301', {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.commitTransaction('att-301');

        const pending = store.recoverPendingTransactions();
        const attemptIds = pending.map(p => p.attemptId);
        expect(attemptIds).toContain('att-300');
        expect(attemptIds).not.toContain('att-301');
    });

    it('recoverPendingTransactions returns completedSteps so the caller can replay remaining steps', () => {
        const store = new TimelineTransactionStore(tmpDir);
        store.beginTransaction('att-310', {
            targetNode: '101-202',
            recordIds: ['rec-a', 'rec-b'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.markStepCompleted('att-310', 'stage_records');
        store.markStepCompleted('att-310', 'record:rec-a');

        const pending = store.recoverPendingTransactions();
        const entry = pending.find(p => p.attemptId === 'att-310');
        expect(entry).toBeDefined();
        if (!entry) return;
        expect(entry.completedSteps).toEqual(['stage_records', 'record:rec-a']);
        expect(entry.recordIds).toEqual(['rec-a', 'rec-b']);
    });

    it('recovery replays remaining step: manifest has stage_records + record:rec-a, record:rec-b is missing -> caller can write rec-b', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-320';
        const recBPath = path.join(tmpDir, 'summaries', 'rec-b.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a', 'rec-b'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.upsertRecord(attemptId, 'rec-a', path.join(tmpDir, 'summaries', 'rec-a.json'), { text: 'A' });
        // Crash before writing rec-b.

        // Recovery scan.
        const pending = store.recoverPendingTransactions();
        const entry = pending.find(p => p.attemptId === attemptId);
        expect(entry).toBeDefined();
        if (!entry) return;
        expect(entry.completedSteps).toContain('record:rec-a');
        expect(entry.completedSteps).not.toContain('record:rec-b');

        // Caller replays the missing step using the same store API.
        const store2 = new TimelineTransactionStore(tmpDir);
        store2.upsertRecord(attemptId, 'rec-b', recBPath, { text: 'B' });
        expect(fs.existsSync(recBPath)).toBe(true);
        expect(fs.readFileSync(recBPath, 'utf8')).toBe(JSON.stringify({ text: 'B' }, null, '\t'));
    });

    it('abortTransaction marks the manifest as aborted and records the reason', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-330';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.abortTransaction(attemptId, 'business validation failed');

        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.status).toBe('aborted');
        expect(manifest.abortReason).toBe('business validation failed');
    });

    it('aborted transactions are not returned by recoverPendingTransactions', () => {
        const store = new TimelineTransactionStore(tmpDir);
        store.beginTransaction('att-340', {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.abortTransaction('att-340', 'rollback');

        const pending = store.recoverPendingTransactions();
        expect(pending.map(p => p.attemptId)).not.toContain('att-340');
    });

    it('getTransactionState returns current manifest state without mutating it', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-350';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.stageRecordPayload(attemptId, 'rec-a', { text: 'x' });
        const before = fs.statSync(manifestPathOf(tmpDir, attemptId)).mtimeMs;

        const state = store.getTransactionState(attemptId);
        const after = fs.statSync(manifestPathOf(tmpDir, attemptId)).mtimeMs;
        expect(state).toBeDefined();
        if (!state) return;
        expect(state.attemptId).toBe(attemptId);
        expect(state.status).toBe('in_progress');
        expect(state.stagedRecords['rec-a'].payload).toEqual({ text: 'x' });
        expect(after).toBe(before);
    });

    it('getTransactionState returns undefined for an unknown attemptId', () => {
        const store = new TimelineTransactionStore(tmpDir);
        expect(store.getTransactionState('never-began')).toBeUndefined();
    });

    it('recoverPendingTransactions does NOT use fs.existsSync on business files to infer state', () => {
        // The recovery scan must read manifest.completedSteps only. We verify
        // this by deleting a business file that was already marked complete in
        // the manifest: recovery must still report the step as completed,
        // without re-checking the file.
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-360';
        const recPath = path.join(tmpDir, 'summaries', 'rec-a.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.upsertRecord(attemptId, 'rec-a', recPath, { text: 'A' });
        // Delete the business file (simulate a partial cleanup or external removal).
        fs.unlinkSync(recPath);

        const pending = store.recoverPendingTransactions();
        const entry = pending.find(p => p.attemptId === attemptId);
        expect(entry).toBeDefined();
        if (!entry) return;
        // The step is still marked complete in the manifest - recovery must
        // respect the manifest, not re-stat the file.
        expect(entry.completedSteps).toContain('record:rec-a');
    });
});

describe('TimelineTransactionStore multi-transaction isolation (§7.4 P3.3)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-iso-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('two concurrent transactions do not share staged records or completed steps', () => {
        const store = new TimelineTransactionStore(tmpDir);
        store.beginTransaction('att-A', {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'a.txt')
        });
        store.beginTransaction('att-B', {
            targetNode: '101-202',
            recordIds: ['rec-b'],
            artifactPath: path.join(tmpDir, 'run', 'b.txt')
        });

        store.stageRecordPayload('att-A', 'rec-a', { text: 'A-payload' });
        store.markStepCompleted('att-A', 'stage_records');

        const manifestA = readManifest(tmpDir, 'att-A');
        const manifestB = readManifest(tmpDir, 'att-B');
        expect(manifestA.stagedRecords['rec-a']).toBeDefined();
        expect(manifestA.stagedRecords['rec-b']).toBeUndefined();
        expect(manifestB.stagedRecords['rec-b']).toBeUndefined();
        expect(manifestA.completedSteps).toEqual(['stage_records']);
        expect(manifestB.completedSteps).toEqual([]);
    });

    it('committing one transaction does not commit the other', () => {
        const store = new TimelineTransactionStore(tmpDir);
        store.beginTransaction('att-A', {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'a.txt')
        });
        store.beginTransaction('att-B', {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'b.txt')
        });

        store.commitTransaction('att-A');

        const manifestA = readManifest(tmpDir, 'att-A');
        const manifestB = readManifest(tmpDir, 'att-B');
        expect(manifestA.status).toBe('committed');
        expect(manifestB.status).toBe('in_progress');
    });
});

describe('TimelineTransactionStore diagnostic logging (§7.4 P3.3)', () => {
    let tmpDir: string;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-log-'));
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function capturedDiagnosticLines(): string[] {
        const all: string[] = [];
        for (const spy of [consoleErrorSpy, consoleWarnSpy, consoleLogSpy]) {
            for (const call of spy.mock.calls) {
                const arg = call[0];
                if (typeof arg === 'string' && arg.includes(TIMELINE_DIAGNOSTIC_MARKER)) {
                    all.push(arg);
                }
            }
        }
        return all;
    }

    it('structured diagnostic logs do NOT contain manifest payload content', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-500';
        const secretPayload = 'SECRET-BUSINESS-CONTENT-DO-NOT-LEAK';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.stageRecordPayload(attemptId, 'rec-a', { text: secretPayload });

        // Trigger a diagnostic emission - abortTransaction should emit a
        // structured diagnostic line for observability.
        store.abortTransaction(attemptId, 'rollback test');

        const diagnostics = capturedDiagnosticLines();
        expect(diagnostics.length).toBeGreaterThan(0);
        for (const line of diagnostics) {
            expect(line).not.toContain(secretPayload);
        }
    });

    it('structured diagnostic logs do NOT contain artifact content', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-501';
        const secretArtifact = 'SECRET-ARTIFACT-RUN-SCRIPT';
        const artifactPath = path.join(tmpDir, 'run', 'votc.txt');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath
        });
        store.writeArtifactAtomic(attemptId, artifactPath, secretArtifact);
        store.abortTransaction(attemptId, 'after artifact written');

        const diagnostics = capturedDiagnosticLines();
        expect(diagnostics.length).toBeGreaterThan(0);
        for (const line of diagnostics) {
            expect(line).not.toContain(secretArtifact);
        }
    });

    it('structured diagnostic logs include metadata (attemptId, status, step counts) without payload', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-502';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a', 'rec-b'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.upsertRecord(attemptId, 'rec-a', path.join(tmpDir, 's', 'a.json'), { text: 'A' });
        store.abortTransaction(attemptId, 'test');

        const diagnostics = capturedDiagnosticLines();
        const abortLine = diagnostics.find(l => l.includes('transaction_abort') || l.includes('abort'));
        expect(abortLine).toBeDefined();
        if (!abortLine) return;
        // Metadata is present.
        expect(abortLine).toContain(attemptId);
        // Payload content is absent.
        expect(abortLine).not.toContain('"text"');
        expect(abortLine).not.toContain('"A"');
    });
});

describe('TimelineTransactionStore manifest journal placeholder (§7.4 P3.3 scope)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-jp-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('manifest reserves a journal field position but does not fabricate journal entries', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-600';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        const manifest = readManifest(tmpDir, attemptId);
        // The journal field is reserved (optional, undefined in Phase 3).
        // Phase 5 will populate it. We assert it is not a fake placeholder
        // object pretending to be a real journal entry.
        if (manifest.journal !== undefined) {
            // If present, it must be null or a clearly-marked placeholder,
            // not an object with attemptId/phase fields that looks like a real
            // journal entry.
            expect(manifest.journal).toBeNull();
        }
    });
});

describe('TimelineTransactionStore stage/upsert cross-use rejection (I-1)', () => {
    let tmpDir: string;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-x-'));
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('stageRecordPayload throws when recordId was already upserted (has a path)', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-i1-a';
        const recordPath = path.join(tmpDir, 'summaries', 'rec-a.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.upsertRecord(attemptId, 'rec-a', recordPath, { text: 'on-disk' });

        // stageRecordPayload on the same recordId would drop the path field
        // and desync the manifest from the on-disk file. It must throw.
        expect(() => store.stageRecordPayload(attemptId, 'rec-a', { text: 'staged' })).toThrow(/path|upsert|stage/i);

        // Manifest is unchanged: the staged record still has the path + payload
        // from the upsert.
        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.stagedRecords['rec-a'].path).toBe(recordPath);
        expect(manifest.stagedRecords['rec-a'].payload).toEqual({ text: 'on-disk' });
    });

    it('upsertRecord throws when recordId was already staged without a path and payload differs', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-i1-b';
        const recordPath = path.join(tmpDir, 'summaries', 'rec-a.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.stageRecordPayload(attemptId, 'rec-a', { text: 'staged' });

        // upsertRecord with a DIFFERENT payload after staging would create an
        // inconsistency between the staged payload and the on-disk file. Throw.
        expect(() => store.upsertRecord(attemptId, 'rec-a', recordPath, { text: 'on-disk-different' }))
            .toThrow(/stage|payload|consistent/i);
    });

    it('upsertRecord after stageRecordPayload with SAME payload is allowed (promotes staged to on-disk)', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-i1-c';
        const recordPath = path.join(tmpDir, 'summaries', 'rec-a.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        const payload = { text: 'same payload' };
        store.stageRecordPayload(attemptId, 'rec-a', payload);
        // Same payload: upsert should be allowed - it writes the staged content
        // to disk and records the path.
        store.upsertRecord(attemptId, 'rec-a', recordPath, payload);

        expect(fs.readFileSync(recordPath, 'utf8')).toBe(JSON.stringify(payload, null, '\t'));
        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.stagedRecords['rec-a'].path).toBe(recordPath);
        expect(manifest.stagedRecords['rec-a'].payload).toEqual(payload);
    });

    it('stageRecordPayload after upsertRecord with SAME payload is a no-op (does not throw, does not drop path)', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-i1-d';
        const recordPath = path.join(tmpDir, 'summaries', 'rec-a.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        const payload = { text: 'same payload' };
        store.upsertRecord(attemptId, 'rec-a', recordPath, payload);

        // Same payload: stage is a no-op (idempotent), path is preserved.
        store.stageRecordPayload(attemptId, 'rec-a', payload);
        const manifest = readManifest(tmpDir, attemptId);
        expect(manifest.stagedRecords['rec-a'].path).toBe(recordPath);
        expect(manifest.stagedRecords['rec-a'].payload).toEqual(payload);
    });
});

describe('TimelineTransactionStore fsync durability (I-2)', () => {
    let tmpDir: string;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-fsync-'));
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writeManifest calls fsyncSync on the tmp file before rename', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const fsyncSpy = jest.spyOn(fs, 'fsyncSync');

        store.beginTransaction('att-fsync-1', {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        expect(fsyncSpy.mock.calls.length).toBeGreaterThan(0);
        fsyncSpy.mockRestore();
    });

    it('upsertRecord calls fsyncSync on the tmp file before rename', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const recordPath = path.join(tmpDir, 'summaries', 'rec-a.json');
        store.beginTransaction('att-fsync-2', {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        const fsyncSpy = jest.spyOn(fs, 'fsyncSync');
        store.upsertRecord('att-fsync-2', 'rec-a', recordPath, { text: 'payload' });

        expect(fsyncSpy.mock.calls.length).toBeGreaterThan(0);
        fsyncSpy.mockRestore();
    });

    it('writeArtifactAtomic calls fsyncSync on the tmp file before rename', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const artifactPath = path.join(tmpDir, 'run', 'votc.txt');
        store.beginTransaction('att-fsync-3', {
            targetNode: '101-202',
            recordIds: [],
            artifactPath
        });

        const fsyncSpy = jest.spyOn(fs, 'fsyncSync');
        store.writeArtifactAtomic('att-fsync-3', artifactPath, 'artifact content');

        expect(fsyncSpy.mock.calls.length).toBeGreaterThan(0);
        fsyncSpy.mockRestore();
    });

    it('atomic write still produces correct content after fsync path', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-fsync-4';
        const artifactPath = path.join(tmpDir, 'run', 'votc.txt');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath
        });

        const content = 'durable artifact content';
        store.writeArtifactAtomic(attemptId, artifactPath, content);

        expect(fs.readFileSync(artifactPath, 'utf8')).toBe(content);
        // No leftover tmp file.
        expect(fs.existsSync(`${artifactPath}.tmp`)).toBe(false);
    });
});

describe('parseTransactionDiagnosticLine (M-1)', () => {
    it('parses a transaction/abort line into type and fields', () => {
        const line = `${TIMELINE_DIAGNOSTIC_MARKER}transaction/;/abort/;/att-500/;/rollback test/;/2/;/3/;/1`;
        const parsed = parseTransactionDiagnosticLine(line);
        expect(parsed).toBeDefined();
        if (!parsed) return;
        expect(parsed.type).toBe('transaction/abort');
        expect(parsed.fields).toEqual(['att-500', 'rollback test', '2', '3', '1']);
    });

    it('returns null for a non-transaction diagnostic line', () => {
        const line = `${TIMELINE_DIAGNOSTIC_MARKER}registry_recovery/;/corrupt/;/path`;
        expect(parseTransactionDiagnosticLine(line)).toBeNull();
    });

    it('returns null for a line without the timeline marker', () => {
        expect(parseTransactionDiagnosticLine('some random log line')).toBeNull();
    });

    it('returns null for a line with marker but no transaction type', () => {
        const line = `${TIMELINE_DIAGNOSTIC_MARKER}snapshot/;/1/;/campaign`;
        expect(parseTransactionDiagnosticLine(line)).toBeNull();
    });

    it('handles a transaction line with no subtype gracefully', () => {
        const line = `${TIMELINE_DIAGNOSTIC_MARKER}transaction`;
        const parsed = parseTransactionDiagnosticLine(line);
        expect(parsed).toBeDefined();
        if (!parsed) return;
        expect(parsed.type).toBe('transaction');
        expect(parsed.fields).toEqual([]);
    });

    it('unescapes /;/ sequences that were escaped in fields', () => {
        // A field containing the literal /;/ is escaped to %3B%3B on emit.
        // The parser must unescape it back.
        const escapedReason = 'rollback%3B%3Breason';
        const line = `${TIMELINE_DIAGNOSTIC_MARKER}transaction/;/abort/;/att-1/;/${escapedReason}`;
        const parsed = parseTransactionDiagnosticLine(line);
        expect(parsed).toBeDefined();
        if (!parsed) return;
        expect(parsed.fields[1]).toBe('rollback/;/reason');
    });

    it('round-trips: formatTransactionDiagnosticLine then parseTransactionDiagnosticLine', () => {
        const store = new TimelineTransactionStore(fs.mkdtempSync(path.join(os.tmpdir(), 'votc-rt-')));
        // Emit via abort so the line goes through console.warn spy.
        const captured: string[] = [];
        const spy = jest.spyOn(console, 'warn').mockImplementation((line: string) => {
            if (typeof line === 'string' && line.includes(TIMELINE_DIAGNOSTIC_MARKER)) captured.push(line);
        });
        try {
            store.beginTransaction('att-rt', {
                targetNode: '101-202',
                recordIds: [],
                artifactPath: '/tmp/artifact.txt'
            });
            store.abortTransaction('att-rt', 'round trip reason');
        } finally {
            spy.mockRestore();
        }
        expect(captured.length).toBe(1);
        const parsed = parseTransactionDiagnosticLine(captured[0]);
        expect(parsed).toBeDefined();
        if (!parsed) return;
        expect(parsed.type).toBe('transaction/abort');
        expect(parsed.fields[0]).toBe('att-rt');
        expect(parsed.fields[1]).toBe('round trip reason');
    });
});

describe('TimelineTransactionStore recovery edge cases (M-2)', () => {
    let tmpDir: string;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-edge-'));
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('recoverPendingTransactions skips a corrupted/garbage manifest without crashing', () => {
        // Manually create a transaction dir with garbage in manifest.json.
        const attemptId = 'att-garbage';
        const dir = path.join(transactionsRoot(tmpDir), attemptId);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'manifest.json'), '{not valid json', 'utf8');

        // Also create a valid in-progress transaction alongside it.
        const store = new TimelineTransactionStore(tmpDir);
        store.beginTransaction('att-valid', {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        const pending = store.recoverPendingTransactions();
        const attemptIds = pending.map(p => p.attemptId);
        expect(attemptIds).toContain('att-valid');
        expect(attemptIds).not.toContain('att-garbage');
    });

    it('recoverPendingTransactions skips a manifest that is valid JSON but wrong shape', () => {
        const attemptId = 'att-wrong-shape';
        const dir = path.join(transactionsRoot(tmpDir), attemptId);
        fs.mkdirSync(dir, { recursive: true });
        // Valid JSON but missing required fields.
        fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ foo: 'bar' }), 'utf8');

        const store = new TimelineTransactionStore(tmpDir);
        const pending = store.recoverPendingTransactions();
        expect(pending.map(p => p.attemptId)).not.toContain(attemptId);
    });

    it('recoverPendingTransactions skips a manifest whose status is not in_progress', () => {
        const attemptId = 'att-committed';
        const dir = path.join(transactionsRoot(tmpDir), attemptId);
        fs.mkdirSync(dir, { recursive: true });
        // Write a manifest with status 'committed' directly.
        const manifest = {
            attemptId,
            targetNode: '101-202',
            recordIds: [] as string[],
            artifactPath: '',
            status: 'committed',
            stagedRecords: {},
            completedSteps: ['commit'],
            createdAt: '2026-07-20T00:00:00Z',
            updatedAt: '2026-07-20T00:00:00Z'
        };
        fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, '\t'), 'utf8');

        const store = new TimelineTransactionStore(tmpDir);
        const pending = store.recoverPendingTransactions();
        expect(pending.map(p => p.attemptId)).not.toContain(attemptId);
    });

    it('abortTransaction with no prior manifest writes an aborted manifest and emits diagnostic', () => {
        const captured: string[] = [];
        const spy = jest.spyOn(console, 'warn').mockImplementation((line: string) => {
            if (typeof line === 'string' && line.includes(TIMELINE_DIAGNOSTIC_MARKER)) captured.push(line);
        });
        try {
            const store = new TimelineTransactionStore(tmpDir);
            store.abortTransaction('att-no-prior', 'never began');
            // A manifest was written.
            const manifest = readManifest(tmpDir, 'att-no-prior');
            expect(manifest.status).toBe('aborted');
            expect(manifest.abortReason).toBe('never began');
            // A diagnostic was emitted.
            expect(captured.length).toBe(1);
            expect(captured[0]).toContain('att-no-prior');
            expect(captured[0]).toContain('never began');
        } finally {
            spy.mockRestore();
        }
    });

    it('beginTransaction throws when called with an already-aborted attemptId', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-aborted-begin';
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.abortTransaction(attemptId, 'test abort');

        expect(() => store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: [],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        })).toThrow(/aborted|terminal/);
    });

    it('recoverPendingTransactions returns empty array when transactions dir does not exist', () => {
        const store = new TimelineTransactionStore(tmpDir);
        // No transactions have been created.
        const pending = store.recoverPendingTransactions();
        expect(pending).toEqual([]);
    });
});

describe('TimelineTransactionStore crash injection mid-writeManifest (M-6)', () => {
    let tmpDir: string;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-crash-'));
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('crash after manifest tmp write, before rename: recovery treats as no/partial manifest', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-crash-mid';
        // First, begin normally so the transaction dir exists.
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });

        const manifestDir = path.join(transactionsRoot(tmpDir), attemptId);
        const manifestPath = path.join(manifestDir, 'manifest.json');
        const manifestTmpPath = `${manifestPath}.tmp`;

        // Simulate a crash during markStepCompleted: the manifest tmp is written
        // but the rename does not happen. We do this by intercepting renameSync
        // to throw on the manifest tmp -> manifest rename, while still allowing
        // the tmp to be written.
        const originalRename = fs.renameSync;
        let renameCount = 0;
        const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(function (this: unknown, oldPath: any, newPath: any) {
            renameCount++;
            // The manifest tmp rename is the one whose target is manifest.json.
            // (upsertRecord also renames its record tmp, but those target the
            // summaries dir, not the manifest path.) We crash specifically on
            // the manifest rename to simulate mid-writeManifest crash.
            if (newPath === manifestPath) {
                throw Object.assign(new Error('injected crash during manifest rename'), { code: 'ECRASH' });
            }
            return originalRename.call(fs, oldPath, newPath);
        });
        try {
            expect(() => store.markStepCompleted(attemptId, 'stage_records')).toThrow();
        } finally {
            renameSpy.mockRestore();
        }

        // After crash: manifest.json is stale (still has the begin state),
        // manifest.json.tmp exists (written but not renamed).
        expect(fs.existsSync(manifestTmpPath)).toBe(true);
        // The stale manifest still exists and is valid (from beginTransaction).
        expect(fs.existsSync(manifestPath)).toBe(true);
        const staleManifest = readManifest(tmpDir, attemptId);
        expect(staleManifest.completedSteps).toEqual([]); // step was not persisted

        // Recovery: a new store instance should not crash, and should treat
        // the transaction as in_progress (using the stale manifest). The
        // orphan manifest tmp must not be promoted or cause a crash.
        const store2 = new TimelineTransactionStore(tmpDir);
        const pending = store2.recoverPendingTransactions();
        const entry = pending.find(p => p.attemptId === attemptId);
        expect(entry).toBeDefined();
        if (!entry) return;
        // The step was not persisted in the stale manifest.
        expect(entry.completedSteps).not.toContain('stage_records');

        // The orphan manifest tmp should be cleaned up (quarantined or deleted)
        // so it doesn't leak across recoveries.
        expect(fs.existsSync(manifestTmpPath)).toBe(false);
    });

    it('crash during beginTransaction manifest write: no manifest -> recovery skips the attempt', () => {
        const manifestPath = manifestPathOf(tmpDir, 'att-crash-begin');

        const originalRename = fs.renameSync;
        const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(function (this: unknown, oldPath: any, newPath: any) {
            if (newPath === manifestPath) {
                throw Object.assign(new Error('injected crash during begin manifest rename'), { code: 'ECRASH' });
            }
            return originalRename.call(fs, oldPath, newPath);
        });
        try {
            const store = new TimelineTransactionStore(tmpDir);
            expect(() => store.beginTransaction('att-crash-begin', {
                targetNode: '101-202',
                recordIds: [],
                artifactPath: path.join(tmpDir, 'run', 'votc.txt')
            })).toThrow();
        } finally {
            renameSpy.mockRestore();
        }

        // After crash: no manifest.json (rename failed), manifest.json.tmp exists.
        expect(fs.existsSync(manifestPath)).toBe(false);
        expect(fs.existsSync(`${manifestPath}.tmp`)).toBe(true);

        // Recovery: the orphan tmp must not be treated as a manifest. The
        // attempt should not appear in pending (no valid manifest).
        const store = new TimelineTransactionStore(tmpDir);
        const pending = store.recoverPendingTransactions();
        expect(pending.map(p => p.attemptId)).not.toContain('att-crash-begin');
    });
});

describe('TimelineTransactionStore PendingTransaction includes staged record paths (M-5)', () => {
    let tmpDir: string;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-tx-pending-'));
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('recoverPendingTransactions includes staged record paths and hashes for replay', () => {
        const store = new TimelineTransactionStore(tmpDir);
        const attemptId = 'att-m5';
        const recAPath = path.join(tmpDir, 'summaries', 'rec-a.json');
        const recBPath = path.join(tmpDir, 'summaries', 'rec-b.json');
        store.beginTransaction(attemptId, {
            targetNode: '101-202',
            recordIds: ['rec-a', 'rec-b'],
            artifactPath: path.join(tmpDir, 'run', 'votc.txt')
        });
        store.upsertRecord(attemptId, 'rec-a', recAPath, { text: 'A' });
        store.stageRecordPayload(attemptId, 'rec-b', { text: 'B' });

        const pending = store.recoverPendingTransactions();
        const entry = pending.find(p => p.attemptId === attemptId);
        expect(entry).toBeDefined();
        if (!entry) return;
        expect(entry.stagedRecords['rec-a']).toBeDefined();
        expect(entry.stagedRecords['rec-a'].path).toBe(recAPath);
        expect(typeof entry.stagedRecords['rec-a'].sha256).toBe('string');
        expect(entry.stagedRecords['rec-a'].sha256.length).toBe(64);
        // rec-b was staged (no path) but still has a hash.
        expect(entry.stagedRecords['rec-b']).toBeDefined();
        expect(entry.stagedRecords['rec-b'].path).toBeUndefined();
        expect(typeof entry.stagedRecords['rec-b'].sha256).toBe('string');
    });
});
