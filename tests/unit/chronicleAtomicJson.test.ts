import {
    ChronicleStoreError,
    readChronicleJson,
    writeChronicleJsonAtomic,
    rotatePrimaryToBackup,
    quarantineCorruptChronicleFile,
    assertPathInsideChronicle
} from '../../src/main/chronicle/chronicleAtomicJson';
import {
    chronicleDir,
    chronicleMemoryStorePath,
    chronicleMemoryBackupPath
} from '../../src/main/campaignDataPaths';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import fs from 'fs';
import path from 'path';
import os from 'os';

const IDENTITY = buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, 'player-1001');
const OTHER_IDENTITY = buildIdentityFromParts({ a: 9, b: 8, c: 7, d: 6 }, 'player-2002');

function makeTmpUserData(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'votc-chronicle-atomic-'));
}

function storePath(userData: string): string {
    return chronicleMemoryStorePath(userData, IDENTITY);
}

function backupPath(userData: string): string {
    return chronicleMemoryBackupPath(userData, IDENTITY);
}

describe('writeChronicleJsonAtomic basic behavior (Task 4 Step 2)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('writes a JSON object and reads it back', () => {
        const target = storePath(userData);
        writeChronicleJsonAtomic(userData, IDENTITY, target, { schemaVersion: 1, records: [] });
        const parsed = readChronicleJson(target);
        expect(parsed).toEqual({ schemaVersion: 1, records: [] });
    });

    it('creates the chronicle directory if it does not exist', () => {
        const target = storePath(userData);
        expect(fs.existsSync(path.dirname(target))).toBe(false);
        writeChronicleJsonAtomic(userData, IDENTITY, target, { ok: true });
        expect(fs.existsSync(path.dirname(target))).toBe(true);
    });

    it('leaves no .tmp file behind after a successful write', () => {
        const target = storePath(userData);
        writeChronicleJsonAtomic(userData, IDENTITY, target, { ok: true });
        expect(fs.existsSync(`${target}.tmp`)).toBe(false);
    });

    it('overwrites the existing primary atomically on subsequent writes', () => {
        const target = storePath(userData);
        writeChronicleJsonAtomic(userData, IDENTITY, target, { revision: 1 });
        writeChronicleJsonAtomic(userData, IDENTITY, target, { revision: 2 });
        const parsed = readChronicleJson(target) as { revision: number };
        expect(parsed.revision).toBe(2);
    });

    it('readChronicleJson returns undefined when the file does not exist', () => {
        expect(readChronicleJson(storePath(userData))).toBeUndefined();
    });

    it('readChronicleJson throws ChronicleStoreError(parse_failed) on invalid JSON', () => {
        const target = storePath(userData);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, '{not valid json', 'utf8');
        let thrown: unknown;
        try {
            readChronicleJson(target);
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_parse_failed');
    });
});

describe('writeChronicleJsonAtomic path validation (Task 4 Step 2.5)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('rejects a target path outside the chronicle directory', () => {
        const outside = path.join(userData, 'escaped.json');
        let thrown: unknown;
        try {
            writeChronicleJsonAtomic(userData, IDENTITY, outside, { bad: true });
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_path_invalid');
        expect(fs.existsSync(outside)).toBe(false);
    });

    it('assertPathInsideChronicle accepts a path inside the chronicle dir', () => {
        const inside = storePath(userData);
        expect(() => assertPathInsideChronicle(userData, IDENTITY, inside, 'test')).not.toThrow();
    });

    it('assertPathInsideChronicle rejects a path in a different player dir', () => {
        const otherPlayer = chronicleMemoryStorePath(userData, OTHER_IDENTITY);
        let thrown: unknown;
        try {
            assertPathInsideChronicle(userData, IDENTITY, otherPlayer, 'cross-player');
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_path_invalid');
    });
});

describe('writeChronicleJsonAtomic fault injection (Task 4 Step 5)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    /**
     * Inject a throw at the Nth call of the given fs method. Subsequent calls
     * pass through so recovery / cleanup can run.
     */
    function injectFaultAt(method: 'writeFileSync' | 'renameSync' | 'openSync' | 'fsyncSync', crashAtCall: number): { restore: () => void; callCount: () => number } {
        const original = fs[method] as any;
        let count = 0;
        const spy = jest.spyOn(fs, method as any).mockImplementation(function (this: unknown, ...args: any[]) {
            count++;
            if (count === crashAtCall) {
                const err = new Error(`injected fault in fs.${method} (call #${count})`);
                (err as NodeJS.ErrnoException).code = 'EINJECT';
                throw err;
            }
            return (original as any).apply(this, args);
        });
        return { restore: () => { spy.mockRestore(); }, callCount: () => count };
    }

    it('tmp write failure: primary not created, tmp cleaned up, typed error thrown', () => {
        const target = storePath(userData);
        const fault = injectFaultAt('writeFileSync', 1);
        try {
            let thrown: unknown;
            try {
                writeChronicleJsonAtomic(userData, IDENTITY, target, { ok: true });
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(ChronicleStoreError);
            expect((thrown as ChronicleStoreError).code).toBe('chronicle_tmp_write_failed');
            expect(fs.existsSync(target)).toBe(false);
            expect(fs.existsSync(`${target}.tmp`)).toBe(false);
        } finally {
            fault.restore();
        }
    });

    it('fsync failure: primary not created, tmp cleaned up, typed error thrown', () => {
        const target = storePath(userData);
        // writeFileSync is intercepted internally by openSync + writeSync via the
        // fd path; the first fsyncSync call (on the tmp fd) is the target.
        const fault = injectFaultAt('fsyncSync', 1);
        try {
            let thrown: unknown;
            try {
                writeChronicleJsonAtomic(userData, IDENTITY, target, { ok: true });
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(ChronicleStoreError);
            expect((thrown as ChronicleStoreError).code).toBe('chronicle_fsync_failed');
            expect(fs.existsSync(target)).toBe(false);
            expect(fs.existsSync(`${target}.tmp`)).toBe(false);
        } finally {
            fault.restore();
        }
    });

    it('rename failure: primary not overwritten, tmp cleaned up, typed error thrown', () => {
        const target = storePath(userData);
        // Pre-seed a valid primary so we can prove it is not destroyed.
        writeChronicleJsonAtomic(userData, IDENTITY, target, { revision: 1 });
        const originalContent = fs.readFileSync(target, 'utf8');

        const fault = injectFaultAt('renameSync', 1);
        try {
            let thrown: unknown;
            try {
                writeChronicleJsonAtomic(userData, IDENTITY, target, { revision: 2 });
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(ChronicleStoreError);
            expect((thrown as ChronicleStoreError).code).toBe('chronicle_rename_failed');
            // Primary is intact.
            expect(fs.readFileSync(target, 'utf8')).toBe(originalContent);
            // Tmp cleaned up.
            expect(fs.existsSync(`${target}.tmp`)).toBe(false);
        } finally {
            fault.restore();
        }
    });
});

describe('rotatePrimaryToBackup (Task 4 Step 3)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('does nothing when the primary does not exist', () => {
        const primary = storePath(userData);
        const backup = backupPath(userData);
        rotatePrimaryToBackup(userData, IDENTITY, primary, backup);
        expect(fs.existsSync(backup)).toBe(false);
    });

    it('copies the primary content to .bak atomically', () => {
        const primary = storePath(userData);
        const backup = backupPath(userData);
        writeChronicleJsonAtomic(userData, IDENTITY, primary, { revision: 1, records: ['a'] });
        rotatePrimaryToBackup(userData, IDENTITY, primary, backup);
        expect(fs.existsSync(backup)).toBe(true);
        expect(readChronicleJson(backup)).toEqual({ revision: 1, records: ['a'] });
        // Primary is untouched.
        expect(readChronicleJson(primary)).toEqual({ revision: 1, records: ['a'] });
    });

    it('overwrites an existing .bak with the newer primary content', () => {
        const primary = storePath(userData);
        const backup = backupPath(userData);
        writeChronicleJsonAtomic(userData, IDENTITY, primary, { revision: 1 });
        rotatePrimaryToBackup(userData, IDENTITY, primary, backup);
        // Second primary + second rotation.
        writeChronicleJsonAtomic(userData, IDENTITY, primary, { revision: 2 });
        rotatePrimaryToBackup(userData, IDENTITY, primary, backup);
        expect(readChronicleJson(backup)).toEqual({ revision: 2 });
    });

    it('leaves no .tmp backup behind', () => {
        const primary = storePath(userData);
        const backup = backupPath(userData);
        writeChronicleJsonAtomic(userData, IDENTITY, primary, { ok: true });
        rotatePrimaryToBackup(userData, IDENTITY, primary, backup);
        expect(fs.existsSync(`${backup}.tmp`)).toBe(false);
    });

    it('rejects paths outside the chronicle dir', () => {
        const outside = path.join(userData, 'outside.json');
        const backup = backupPath(userData);
        let thrown: unknown;
        try {
            rotatePrimaryToBackup(userData, IDENTITY, outside, backup);
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(ChronicleStoreError);
        expect((thrown as ChronicleStoreError).code).toBe('chronicle_path_invalid');
    });
});

describe('quarantineCorruptChronicleFile (Task 4 Step 4)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('moves a corrupt primary to a .corrupt.<timestamp> sibling and removes the original', () => {
        const target = storePath(userData);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, '{broken', 'utf8');

        const quarantine = quarantineCorruptChronicleFile(target);
        expect(quarantine).toBeDefined();
        expect(fs.existsSync(quarantine!)).toBe(true);
        expect(fs.readFileSync(quarantine!, 'utf8')).toBe('{broken');
        // Original removed so a fresh file can be created.
        expect(fs.existsSync(target)).toBe(false);
    });

    it('returns undefined when the file does not exist and no content is provided', () => {
        const target = storePath(userData);
        expect(quarantineCorruptChronicleFile(target)).toBeUndefined();
    });

    it('quarantines raw content even when the file is already missing', () => {
        const target = storePath(userData);
        const quarantine = quarantineCorruptChronicleFile(target, '{also broken');
        expect(quarantine).toBeDefined();
        expect(fs.existsSync(quarantine!)).toBe(true);
        expect(fs.readFileSync(quarantine!, 'utf8')).toBe('{also broken');
    });

    it('produces a unique quarantine path when called repeatedly', () => {
        const target = storePath(userData);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'content1', 'utf8');
        const q1 = quarantineCorruptChronicleFile(target)!;
        fs.writeFileSync(target, 'content2', 'utf8');
        const q2 = quarantineCorruptChronicleFile(target)!;
        expect(q1).not.toBe(q2);
        expect(fs.existsSync(q1)).toBe(true);
        expect(fs.existsSync(q2)).toBe(true);
    });
});

describe('isolation between campaigns/players (Task 4 Step 5)', () => {
    let userData: string;

    beforeEach(() => { userData = makeTmpUserData(); });
    afterEach(() => { fs.rmSync(userData, { recursive: true, force: true }); });

    it('writes for one identity do not touch another identity chronicle dir', () => {
        const own = chronicleMemoryStorePath(userData, IDENTITY);
        const other = chronicleMemoryStorePath(userData, OTHER_IDENTITY);
        writeChronicleJsonAtomic(userData, IDENTITY, own, { owner: 'A' });
        expect(fs.existsSync(own)).toBe(true);
        expect(fs.existsSync(other)).toBe(false);
    });

    it('a chronicle dir for identity A does not contain identity B files', () => {
        const own = chronicleMemoryStorePath(userData, IDENTITY);
        writeChronicleJsonAtomic(userData, IDENTITY, own, { owner: 'A' });
        const ownDir = chronicleDir(userData, IDENTITY);
        const files = fs.readdirSync(ownDir);
        expect(files.length).toBe(1);
        expect(files[0]).toBe('memory_observations.json');
    });
});
