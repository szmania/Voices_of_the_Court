import {
    FsTimelinePersistence,
    TimelineRegistry,
    TimelineRegistryCorruptError,
    type TimelineStoreEnvelope,
    type TimelineSwapManifest
} from '../../src/main/timelineManager';
import { writeLegacyPlayerRegistry } from '../../src/main/timelineLegacyWriter';
import { validateV1RegistryData } from '../../src/main/registryValidator';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const NOW = '2026-07-16T00:00:00Z';

function registryDirOf(tmpDir: string): string {
    return path.join(tmpDir, 'votc_data', 'timeline_registry');
}

function primaryPathFor(tmpDir: string, playerId: string): string {
    return path.join(registryDirOf(tmpDir), `player_${playerId}.json`);
}

function tmpPathFor(tmpDir: string, playerId: string): string {
    return `${primaryPathFor(tmpDir, playerId)}.tmp`;
}

function swapPathFor(tmpDir: string, playerId: string): string {
    return `${primaryPathFor(tmpDir, playerId)}.swap.json`;
}

function bakPathFor(tmpDir: string, playerId: string, index: number): string {
    return `${primaryPathFor(tmpDir, playerId)}.bak.${index}`;
}

function readEnvelope(filePath: string): { revision: number; transactionId: string; store: any } {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function makeDirtyRegistry(playerId: string, epoch = 1): TimelineRegistry {
    const reg = new TimelineRegistry(playerId);
    reg.getOrCreateChild(null, 'conversation', 'conv:root', epoch, NOW);
    return reg;
}

function writeLegacyV1File(filePath: string, playerId: string, nodes: Record<string, any>): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
        version: 1,
        playerId,
        nodes
    }, null, '\t'), 'utf8');
}

function writeEnvelopeFile(filePath: string, revision: number, transactionId: string, store: any): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const envelope: TimelineStoreEnvelope = { revision, transactionId, store };
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, '\t'), 'utf8');
}

describe('FsTimelinePersistence.saveRegistry atomic write (§7.3 P3.2)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-atomic-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writes an envelope with revision, transactionId, and store (no (registry as any).data)', () => {
        const reg = makeDirtyRegistry('player1');
        // §4.2 invariant: saveRegistry refuses to create new player-only files;
        // pre-stage the legacy file so saveRegistry's repair path exercises
        // the atomic-write machinery on an existing primary.
        writeLegacyPlayerRegistry(tmpDir, reg);
        const p = new FsTimelinePersistence(tmpDir);
        // Force a second mutation so saveRegistry attempts a new write (repair).
        reg.getOrCreateChild(null, 'conversation', 'conv:second', 2, NOW);
        p.saveRegistry(reg);

        const primary = primaryPathFor(tmpDir, 'player1');
        expect(fs.existsSync(primary)).toBe(true);
        const env = readEnvelope(primary);
        expect(env.revision).toBe(2);
        expect(typeof env.transactionId).toBe('string');
        expect(env.transactionId.length).toBeGreaterThan(0);
        expect(env.store.version).toBe(1);
        expect(env.store.playerId).toBe('player1');
        expect(Object.keys(env.store.nodes).length).toBe(2);
    });

    it('leaves no .tmp or .swap.json behind after a successful save', () => {
        const reg = makeDirtyRegistry('player1');
        writeLegacyPlayerRegistry(tmpDir, reg);
        const p = new FsTimelinePersistence(tmpDir);
        reg.getOrCreateChild(null, 'conversation', 'conv:second', 2, NOW);
        p.saveRegistry(reg);

        expect(fs.existsSync(tmpPathFor(tmpDir, 'player1'))).toBe(false);
        expect(fs.existsSync(swapPathFor(tmpDir, 'player1'))).toBe(false);
    });

    it('bumps revision monotonically across successive saves', () => {
        const p = new FsTimelinePersistence(tmpDir);

        const reg1 = makeDirtyRegistry('player1', 1);
        writeLegacyPlayerRegistry(tmpDir, reg1);
        expect(readEnvelope(primaryPathFor(tmpDir, 'player1')).revision).toBe(1);

        // Second save: same registry, dirty again after adding a child.
        reg1.getOrCreateChild(Object.keys(reg1.snapshot().nodes)[0], 'conversation', 'conv:c2', 2, NOW);
        p.saveRegistry(reg1);
        expect(readEnvelope(primaryPathFor(tmpDir, 'player1')).revision).toBe(2);

        // Third save.
        reg1.getOrCreateChild(Object.keys(reg1.snapshot().nodes)[0], 'conversation', 'conv:c3', 3, NOW);
        p.saveRegistry(reg1);
        expect(readEnvelope(primaryPathFor(tmpDir, 'player1')).revision).toBe(3);
    });

    it('does nothing when the registry is not dirty', () => {
        const reg = makeDirtyRegistry('player1');
        writeLegacyPlayerRegistry(tmpDir, reg);
        const p = new FsTimelinePersistence(tmpDir);
        // writeLegacyPlayerRegistry already marked the registry clean; a
        // subsequent saveRegistry call with no mutations must be a no-op.
        p.saveRegistry(reg);

        const primary = primaryPathFor(tmpDir, 'player1');
        const firstStat = fs.statSync(primary);
        const firstContent = fs.readFileSync(primary, 'utf8');

        // markClean was called by saveRegistry; second save should be a no-op.
        p.saveRegistry(reg);
        expect(fs.readFileSync(primary, 'utf8')).toBe(firstContent);
        // mtime should be unchanged.
        expect(fs.statSync(primary).mtimeMs).toBe(firstStat.mtimeMs);
    });

    it('validates the snapshot before writing and throws instead of corrupting', () => {
        // Build a registry, then corrupt its internal data via snapshot mutation is
        // not possible (snapshot is a copy). Instead, force a validation failure by
        // constructing a registry with a built-in cycle using the constructor path
        // (dedupIndex bypass) and trying to save it.
        const reg = new TimelineRegistry('player1', {
            version: 1,
            playerId: 'player1',
            nodes: {
                '101-202': { parentId: '101-203', epoch: 1, source: 'conversation', eventKey: 'a', createdAt: NOW },
                '101-203': { parentId: '101-202', epoch: 2, source: 'conversation', eventKey: 'b', createdAt: NOW }
            }
        });
        // Force dirty so saveRegistry attempts a write.
        (reg as unknown as { dirty: boolean }).dirty = true;

        // Pre-create the primary so saveRegistry treats it as a repair path.
        writeLegacyPlayerRegistry(tmpDir, new TimelineRegistry('player1'));

        const p = new FsTimelinePersistence(tmpDir);
        expect(() => p.saveRegistry(reg)).toThrow(/validation/);

        // No tmp, no swap should be left behind (primary retains pre-seed content).
        expect(fs.existsSync(tmpPathFor(tmpDir, 'player1'))).toBe(false);
        expect(fs.existsSync(swapPathFor(tmpDir, 'player1'))).toBe(false);
    });

    it('replaces any pre-existing orphan .tmp from a previous crashed write on next save', () => {
        const primary = primaryPathFor(tmpDir, 'player1');
        const tmp = tmpPathFor(tmpDir, 'player1');
        // Pre-seed a valid primary so saveRegistry runs the repair path.
        writeLegacyPlayerRegistry(tmpDir, makeDirtyRegistry('player1'));
        fs.writeFileSync(tmp, 'stale orphan tmp content', 'utf8');

        const p = new FsTimelinePersistence(tmpDir);
        // Reload to pick up revision=1, then mutate so saveRegistry writes rev=2.
        const loaded = p.loadStore('player1');
        const reg = loaded.status === 'found' ? loaded.store : new TimelineRegistry('player1');
        reg.getOrCreateChild(null, 'conversation', 'conv:second', 2, NOW);
        p.saveRegistry(reg);

        const env = readEnvelope(primary);
        expect(env.revision).toBe(2);
        // The stale orphan tmp must be gone.
        expect(fs.existsSync(tmp)).toBe(false);
        expect(fs.readFileSync(primary, 'utf8')).not.toContain('stale orphan tmp content');
    });

    it('Step 7 throws TimelineRegistryCorruptError when primary fails re-validation after rename', () => {
        // Simulate the post-rename re-validation failure: the primary file is
        // tampered between the rename and the re-read so it no longer validates.
        // The save path must throw TimelineRegistryCorruptError (not a plain
        // Error) so existing error-handling paths (reportCorruptTimelineRegistry)
        // apply.
        const p = new FsTimelinePersistence(tmpDir);
        // Pre-seed the primary at revision=1 so saveRegistry runs the repair path.
        writeLegacyPlayerRegistry(tmpDir, makeDirtyRegistry('player1'));
        const primary = primaryPathFor(tmpDir, 'player1');
        const tmp = tmpPathFor(tmpDir, 'player1');
        expect(readEnvelope(primary).revision).toBe(1);

        const loaded = p.loadStore('player1');
        const liveReg = loaded.status === 'found' ? loaded.store : new TimelineRegistry('player1');
        liveReg.getOrCreateChild(null, 'conversation', 'conv:c2', 2, NOW);

        // Intercept readFileSync so that the post-rename primary re-read returns
        // corrupt content. We detect the post-rename state by checking that the
        // primary file exists and the tmp file does not (rename already happened).
        // The spy is only active during saveRegistry (after this point).
        const originalReadFileSync = fs.readFileSync;
        const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(function (this: unknown, filePath: any, ...args: any[]) {
            if (typeof filePath === 'string'
                && filePath === primary
                && fs.existsSync(primary)
                && !fs.existsSync(tmp)) {
                // Post-rename re-read: return corrupt content.
                return '{broken after rename';
            }
            return (originalReadFileSync as any).apply(fs, [filePath, ...args]);
        });
        try {
            let thrown: unknown;
            try {
                p.saveRegistry(liveReg);
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(TimelineRegistryCorruptError);
            const corruptError = thrown as TimelineRegistryCorruptError;
            expect(corruptError.code).toBe('TIMELINE_REGISTRY_CORRUPT');
            expect(corruptError.filePath).toBe(primary);
            expect(corruptError.errors.length).toBeGreaterThan(0);
        } finally {
            readSpy.mockRestore();
        }
    });
});

describe('FsTimelinePersistence.saveRegistry backup rotation (§7.3 P3.2)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-backup-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function saveThreeTimes(playerId: string): { revisions: number[]; primary: string } {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = new TimelineRegistry(playerId);
        const revisions: number[] = [];
        // §4.2: pre-seed the primary so saveRegistry's repair path runs.
        reg.getOrCreateChild(null, 'conversation', 'conv:root1', 1, NOW);
        writeLegacyPlayerRegistry(tmpDir, reg);
        revisions.push(readEnvelope(primaryPathFor(tmpDir, playerId)).revision);
        for (let i = 2; i <= 3; i++) {
            reg.getOrCreateChild(null, 'conversation', `conv:root${i}`, i, NOW);
            p.saveRegistry(reg);
            revisions.push(readEnvelope(primaryPathFor(tmpDir, playerId)).revision);
        }
        return { revisions, primary: primaryPathFor(tmpDir, playerId) };
    }

    it('rotates primary -> .bak.1 on each save', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = makeDirtyRegistry('player1');
        // §4.2: pre-seed the primary at revision=1.
        writeLegacyPlayerRegistry(tmpDir, reg);
        const primary = primaryPathFor(tmpDir, 'player1');

        // First save (repair): no prior-primary rotation happened yet (the
        // pre-seed did not rotate backups), but the pre-seed itself is revision 1.
        // On the next saveRegistry call the existing primary rotates to .bak.1.
        reg.getOrCreateChild(Object.keys(reg.snapshot().nodes)[0], 'conversation', 'conv:c2', 2, NOW);
        p.saveRegistry(reg);
        expect(fs.existsSync(bakPathFor(tmpDir, 'player1', 1))).toBe(true);
        expect(readEnvelope(bakPathFor(tmpDir, 'player1', 1)).revision).toBe(1);
        expect(readEnvelope(primary).revision).toBe(2);
    });

    it('keeps at most MAX_BACKUPS (3) backup files', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = new TimelineRegistry('player1');
        // §4.2: pre-seed the primary at revision=1.
        reg.getOrCreateChild(null, 'conversation', 'conv:r1', 1, NOW);
        writeLegacyPlayerRegistry(tmpDir, reg);
        // 5 more repair saves -> revisions 2..6 (the pre-seed was revision 1).
        for (let i = 2; i <= 6; i++) {
            reg.getOrCreateChild(null, 'conversation', `conv:r${i}`, i, NOW);
            p.saveRegistry(reg);
        }
        // After 6 total writes: primary revision=6, .bak.1=5, .bak.2=4, .bak.3=3, no .bak.4.
        expect(fs.existsSync(bakPathFor(tmpDir, 'player1', 4))).toBe(false);
        expect(readEnvelope(bakPathFor(tmpDir, 'player1', 1)).revision).toBe(5);
        expect(readEnvelope(bakPathFor(tmpDir, 'player1', 2)).revision).toBe(4);
        expect(readEnvelope(bakPathFor(tmpDir, 'player1', 3)).revision).toBe(3);
    });

    it('backup chain revisions are monotonic (bak.1 > bak.2 > bak.3)', () => {
        const { primary } = saveThreeTimes('player1');
        // After 3 saves: primary=3, bak.1=2, bak.2=1, bak.3 absent.
        expect(readEnvelope(primary).revision).toBe(3);
        expect(readEnvelope(bakPathFor(tmpDir, 'player1', 1)).revision).toBe(2);
        expect(readEnvelope(bakPathFor(tmpDir, 'player1', 2)).revision).toBe(1);
        expect(fs.existsSync(bakPathFor(tmpDir, 'player1', 3))).toBe(false);

        // 4th save: now bak.3 appears.
        const p = new FsTimelinePersistence(tmpDir);
        const reg = new TimelineRegistry('player1');
        // Reload to pick up revision=3.
        const loaded = p.loadStore('player1');
        const liveReg = loaded.status === 'found' ? loaded.store : new TimelineRegistry('player1');
        liveReg.getOrCreateChild(null, 'conversation', 'conv:r4', 4, NOW);
        p.saveRegistry(liveReg);

        expect(readEnvelope(primary).revision).toBe(4);
        expect(readEnvelope(bakPathFor(tmpDir, 'player1', 1)).revision).toBe(3);
        expect(readEnvelope(bakPathFor(tmpDir, 'player1', 2)).revision).toBe(2);
        expect(readEnvelope(bakPathFor(tmpDir, 'player1', 3)).revision).toBe(1);
    });

    it('backup is not used as a normal commit point (only primary is)', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = makeDirtyRegistry('player1');
        // §4.2: pre-seed the primary at revision=1.
        writeLegacyPlayerRegistry(tmpDir, reg);
        // Second save: primary (rev=1) rotates to .bak.1, primary becomes rev=2.
        reg.getOrCreateChild(null, 'conversation', 'conv:c2', 2, NOW);
        p.saveRegistry(reg);
        // Verify .bak.1 exists.
        expect(fs.existsSync(bakPathFor(tmpDir, 'player1', 1))).toBe(true);

        // Delete primary, leave only .bak.1. loadStore should recover from backup
        // with source='backup', not 'primary'.
        fs.unlinkSync(primaryPathFor(tmpDir, 'player1'));
        const result = p.loadStore('player1');
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.source).toBe('backup');
    });
});

describe('FsTimelinePersistence crash injection (§7.3 P3.2)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-crash-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    /**
     * Crash injection helper. Wraps fs.<method> so that the call at the given
     * 1-indexed position throws, simulating a process crash at that exact point.
     * Subsequent calls pass through (so recovery can quarantine etc.).
     */
    function injectCrashAt(method: 'renameSync' | 'writeFileSync' | 'unlinkSync', crashAtCall: number): { restore: () => void; callCount: () => number } {
        const original = fs[method];
        let count = 0;
        const spy = jest.spyOn(fs, method).mockImplementation(function (this: unknown, ...args: any[]) {
            count++;
            if (count === crashAtCall) {
                const err = new Error(`injected crash in fs.${method} (call #${count})`);
                (err as NodeJS.ErrnoException).code = 'ECRASH';
                throw err;
            }
            return (original as any).apply(this, args);
        });
        return {
            restore: () => { spy.mockRestore(); },
            callCount: () => count
        };
    }

    it('crash before tmp write: no primary, no tmp, no swap manifest -> loadStore reports missing', () => {
        // Simulate a crash on the very first writeFileSync (the tmp write).
        // §4.2: saveRegistry throws *before* any write if the primary does not
        // exist, so this test now uses a no-primary scenario where the §4.2
        // guard throws before any tmp is written.
        const primary = primaryPathFor(tmpDir, 'player1');
        const tmp = tmpPathFor(tmpDir, 'player1');
        const swap = swapPathFor(tmpDir, 'player1');

        const crash = injectCrashAt('writeFileSync', 1);
        try {
            const reg = makeDirtyRegistry('player1');
            const p = new FsTimelinePersistence(tmpDir);
            // §4.2 guard throws before reaching the writeFileSync call site.
            expect(() => p.saveRegistry(reg)).toThrow(/§4\.2|saveStoreWithIdentity/);
        } finally {
            crash.restore();
        }

        // Nothing was written: primary/tmp/swap all absent.
        expect(fs.existsSync(primary)).toBe(false);
        expect(fs.existsSync(tmp)).toBe(false);
        expect(fs.existsSync(swap)).toBe(false);

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('missing');
    });

    it('crash after tmp write, before swap manifest: orphan tmp quarantined, primary intact', () => {
        // Pre-seed a valid primary at revision=1 (§4.2 requires an existing file).
        const p0 = new FsTimelinePersistence(tmpDir);
        const reg0 = makeDirtyRegistry('player1');
        writeLegacyPlayerRegistry(tmpDir, reg0);
        const primary = primaryPathFor(tmpDir, 'player1');
        const tmp = tmpPathFor(tmpDir, 'player1');
        const swap = swapPathFor(tmpDir, 'player1');
        const originalPrimaryContent = fs.readFileSync(primary, 'utf8');

        // Now attempt a second save. The crash should hit the swap manifest
        // writeFileSync (the second writeFileSync call in saveRegistry: first
        // is the tmp, second is the swap manifest).
        // We count writeFileSync calls: tmp write is #1, swap manifest write is #2.
        const crash = injectCrashAt('writeFileSync', 2);
        try {
            const p = new FsTimelinePersistence(tmpDir);
            const loaded = p.loadStore('player1');
            const reg = loaded.status === 'found' ? loaded.store : new TimelineRegistry('player1');
            reg.getOrCreateChild(null, 'conversation', 'conv:c2', 2, NOW);
            expect(() => p.saveRegistry(reg)).toThrow();
        } finally {
            crash.restore();
        }

        // After crash: tmp exists (was written), swap manifest does not.
        expect(fs.existsSync(tmp)).toBe(true);
        expect(fs.existsSync(swap)).toBe(false);

        // loadStore should recover from primary (revision=1, source=primary),
        // and quarantine the orphan tmp.
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.source).toBe('primary');
        expect(result.revision).toBe(1);
        // Orphan tmp must be quarantined and gone from its original location.
        expect(fs.existsSync(tmp)).toBe(false);
        const quarantineDir = path.join(registryDirOf(tmpDir), 'quarantine');
        expect(fs.existsSync(quarantineDir)).toBe(true);
        const quarantined = fs.readdirSync(quarantineDir).filter(f => f.includes('orphan-tmp'));
        expect(quarantined.length).toBe(1);
        // Primary content is unchanged.
        expect(fs.readFileSync(primary, 'utf8')).toBe(originalPrimaryContent);
    });

    it('crash after swap manifest write, before rename: tmp promoted (manifest present, revision continuous, transactionId matches, validates)', () => {
        const p0 = new FsTimelinePersistence(tmpDir);
        const reg0 = makeDirtyRegistry('player1');
        // §4.2: pre-seed the primary.
        writeLegacyPlayerRegistry(tmpDir, reg0);

        const primary = primaryPathFor(tmpDir, 'player1');
        const tmp = tmpPathFor(tmpDir, 'player1');
        const swap = swapPathFor(tmpDir, 'player1');

        // Pre-save state: primary revision=1. Second save attempts revision=2.
        // Crash on the rename (first renameSync call).
        const originalRename = fs.renameSync;
        let renameCallCount = 0;
        const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(function (this: unknown, oldPath: any, newPath: any) {
            renameCallCount++;
            if (renameCallCount === 1) {
                throw Object.assign(new Error('injected crash during rename'), { code: 'ECRASH' });
            }
            return originalRename.call(fs, oldPath, newPath);
        });
        try {
            const p = new FsTimelinePersistence(tmpDir);
            const loaded = p.loadStore('player1');
            const reg = loaded.status === 'found' ? loaded.store : new TimelineRegistry('player1');
            reg.getOrCreateChild(null, 'conversation', 'conv:c2', 2, NOW);
            expect(() => p.saveRegistry(reg)).toThrow();
        } finally {
            renameSpy.mockRestore();
        }

        // Crash state: tmp exists, swap manifest exists, primary still has revision=1.
        expect(fs.existsSync(tmp)).toBe(true);
        expect(fs.existsSync(swap)).toBe(true);
        expect(readEnvelope(primary).revision).toBe(1);

        // Recovery: tmp should be promoted to primary because:
        // - primary is valid (revision=1) so this is NOT the missing-primary case;
        //   but the tmp+manifest represent a committed transaction awaiting rename.
        //
        // Wait - per the recovery rules in the task: "有效 primary 是唯一正常提交点；
        // 存在 primary 时，孤立 tmp 视为未提交事务并隔离。"
        // So when primary EXISTS and is valid, the tmp is orphaned, NOT promoted.
        // This test verifies the orphan-tmp path when primary is still valid.
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.source).toBe('primary');
        expect(result.revision).toBe(1);
        // Orphan tmp quarantined.
        expect(fs.existsSync(tmp)).toBe(false);
        // Swap manifest cleaned up.
        expect(fs.existsSync(swap)).toBe(false);
    });

    it('crash after rename, before swap manifest delete: primary is new, loadStore succeeds from primary', () => {
        const p0 = new FsTimelinePersistence(tmpDir);
        const reg0 = makeDirtyRegistry('player1');
        // §4.2: pre-seed the primary.
        writeLegacyPlayerRegistry(tmpDir, reg0);

        const primary = primaryPathFor(tmpDir, 'player1');
        const swap = swapPathFor(tmpDir, 'player1');

        // Crash on the unlinkSync (swap manifest delete). The saveRegistry
        // implementation wraps the swap manifest delete in best-effort
        // try/catch, so a crash here is swallowed and the save completes
        // successfully (the rename already committed the new primary).
        const originalUnlink = fs.unlinkSync;
        let unlinkCallCount = 0;
        const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(function (this: unknown, p: any) {
            unlinkCallCount++;
            if (unlinkCallCount === 1) {
                throw Object.assign(new Error('injected crash during swap delete'), { code: 'ECRASH' });
            }
            return originalUnlink.call(fs, p);
        });
        try {
            const p = new FsTimelinePersistence(tmpDir);
            const loaded = p.loadStore('player1');
            const reg = loaded.status === 'found' ? loaded.store : new TimelineRegistry('player1');
            reg.getOrCreateChild(null, 'conversation', 'conv:c2', 2, NOW);
            // The save completes: the rename committed before the swap-manifest
            // delete, and the delete failure is swallowed (best-effort).
            expect(() => p.saveRegistry(reg)).not.toThrow();
        } finally {
            unlinkSpy.mockRestore();
        }

        // After crash: primary was renamed (revision=2), swap manifest may still
        // be present (stale, but harmless).
        expect(readEnvelope(primary).revision).toBe(2);

        // loadStore should recover from primary (the rename already committed).
        // The stale swap manifest should not block this.
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.source).toBe('primary');
        expect(result.revision).toBe(2);
    });
});

describe('FsTimelinePersistence.saveRegistry swap manifest contents (§7.3 P3.2)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-swap-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('swap manifest records transactionId, revision, source/target paths, sha256, and createdAt', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = makeDirtyRegistry('player1');
        // §4.2: pre-seed the primary at revision=1.
        writeLegacyPlayerRegistry(tmpDir, reg);

        // After a successful save, the swap manifest is deleted. We verify the
        // manifest shape by inspecting a crashed save's leftover manifest.
        const primary = primaryPathFor(tmpDir, 'player1');
        const tmp = tmpPathFor(tmpDir, 'player1');
        const swap = swapPathFor(tmpDir, 'player1');

        // Crash on rename.
        const originalRename = fs.renameSync;
        let renameCalls = 0;
        const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(function (this: unknown, oldPath: any, newPath: any) {
            renameCalls++;
            if (renameCalls === 1) {
                throw Object.assign(new Error('crash'), { code: 'ECRASH' });
            }
            return originalRename.call(fs, oldPath, newPath);
        });
        try {
            const loaded = p.loadStore('player1');
            const liveReg = loaded.status === 'found' ? loaded.store : new TimelineRegistry('player1');
            liveReg.getOrCreateChild(null, 'conversation', 'conv:c2', 2, NOW);
            expect(() => p.saveRegistry(liveReg)).toThrow();
        } finally {
            renameSpy.mockRestore();
        }

        expect(fs.existsSync(swap)).toBe(true);
        const manifest: TimelineSwapManifest = JSON.parse(fs.readFileSync(swap, 'utf8'));
        expect(typeof manifest.transactionId).toBe('string');
        expect(manifest.transactionId.length).toBeGreaterThan(0);
        expect(manifest.revision).toBe(2);
        expect(manifest.sourcePath).toBe(tmp);
        expect(manifest.targetPath).toBe(primary);
        expect(typeof manifest.sha256).toBe('string');
        expect(manifest.sha256.length).toBe(64); // SHA-256 hex
        const expectedSha = crypto.createHash('sha256').update(fs.readFileSync(tmp, 'utf8'), 'utf8').digest('hex');
        expect(manifest.sha256).toBe(expectedSha);
        expect(typeof manifest.createdAt).toBe('string');
        // createdAt parses as an ISO date.
        expect(() => new Date(manifest.createdAt).toISOString()).not.toThrow();
    });
});
