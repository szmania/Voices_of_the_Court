import {
    FsTimelinePersistence,
    TimelineRegistry,
    type TimelineStoreLoadResult
} from '../../src/main/timelineManager';
import { writeLegacyPlayerRegistry } from '../../src/main/timelineLegacyWriter';
import fs from 'fs';
import path from 'path';
import os from 'os';

const NOW = '2026-07-16T00:00:00Z';

function registryDirOf(tmpDir: string): string {
    return path.join(tmpDir, 'votc_data', 'timeline_registry');
}

function writeRegistryFile(tmpDir: string, playerId: string, content: string): string {
    const dir = registryDirOf(tmpDir);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `player_${playerId}.json`);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
}

describe('FsTimelinePersistence.loadStore (§7.1 TimelineStoreLoadResult)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-timeline-store-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns found from primary with source=primary for a valid v1 registry', () => {
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        // §4.2 invariant: saveRegistry no longer creates new player-only files;
        // use the test-only legacy writer to stage pre-existing data.
        writeLegacyPlayerRegistry(tmpDir, reg);

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.source).toBe('primary');
        // P3.2: saveRegistry writes an envelope with revision=1 on the first write.
        expect(result.revision).toBe(1);
        expect(result.store.hasNode(aId)).toBe(true);
    });

    it('returns missing when no registry file exists', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('never');
        expect(result.status).toBe('missing');
    });

    it('returns corrupt with errors[] for a structurally invalid registry', () => {
        const filePath = writeRegistryFile(tmpDir, 'badnode', JSON.stringify({
            version: 1,
            playerId: 'badnode',
            nodes: { 'not-a-node': { parentId: null, source: 'conversation', eventKey: 'x', createdAt: NOW } }
        }));
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('badnode');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        expect(result.filePath).toBe(filePath);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.map(e => e.code)).toContain('node_id_invalid');
    });

    it('returns corrupt with errors[] for truncated JSON', () => {
        const filePath = writeRegistryFile(tmpDir, 'player1', '{"version":1,"playerId":"player1","no');
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        expect(result.filePath).toBe(filePath);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('loadStore found result is a TimelineRegistry instance (store is the registry)', () => {
        const reg = new TimelineRegistry('player1');
        reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        writeLegacyPlayerRegistry(tmpDir, reg);

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.store).toBeInstanceOf(TimelineRegistry);
    });

    it('quarantines corrupt registry and keeps the original file', () => {
        const filePath = writeRegistryFile(tmpDir, 'player1', '{broken');
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        expect(result.quarantinePath).toBeDefined();
        expect(fs.existsSync(result.quarantinePath!)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBe(originalContent);
    });
});

describe('TimelineStoreLoadResult type shape (§7.1)', () => {
    it('found variant carries source, revision and store', () => {
        const r: TimelineStoreLoadResult = { status: 'found', store: new TimelineRegistry('p'), source: 'primary', revision: 0 };
        if (r.status === 'found') {
            expect(r.source).toBe('primary');
            expect(r.revision).toBe(0);
            expect(r.store).toBeInstanceOf(TimelineRegistry);
        }
    });

    it('missing variant carries no extra fields', () => {
        const r: TimelineStoreLoadResult = { status: 'missing' };
        expect(r.status).toBe('missing');
    });

    it('corrupt variant carries filePath and errors', () => {
        const errors: import('../../src/main/registryValidator').RegistryValidationError[] = [];
        const r: TimelineStoreLoadResult = { status: 'corrupt', filePath: '/x', errors };
        expect(r.status).toBe('corrupt');
    });

    it('source field is forward-compatible with promotable-tmp and backup', () => {
        const tmp: TimelineStoreLoadResult = { status: 'found', store: new TimelineRegistry('p'), source: 'promotable-tmp', revision: 1 };
        const bak: TimelineStoreLoadResult = { status: 'found', store: new TimelineRegistry('p'), source: 'backup', revision: 2 };
        expect(tmp.source).toBe('promotable-tmp');
        expect(bak.source).toBe('backup');
    });
});

describe('FsTimelinePersistence.loadStore I/O and parse error codes (I-1)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-timeline-io-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('produces file_unreadable code when the registry path is a directory (readFileSync throws)', () => {
        const dir = registryDirOf(tmpDir);
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'player_unreadable.json');
        fs.mkdirSync(filePath);

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('unreadable');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        expect(result.filePath).toBe(filePath);
        const codes = result.errors.map(e => e.code);
        expect(codes).toContain('file_unreadable');
        const unreadable = result.errors.find(e => e.code === 'file_unreadable')!;
        expect(unreadable.message).toContain('EISDIR');
    });

    it('produces json_invalid code when JSON.parse throws', () => {
        const filePath = writeRegistryFile(tmpDir, 'badjson', '{not valid json');
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('badjson');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        expect(result.filePath).toBe(filePath);
        const codes = result.errors.map(e => e.code);
        expect(codes).toContain('json_invalid');
        const jsonErr = result.errors.find(e => e.code === 'json_invalid')!;
        expect(jsonErr.message.length).toBeGreaterThan(0);
    });

    it('Phase 5: loadStore does not call repairLegacyContinuity (no auto-repair on load)', () => {
        const validContent = JSON.stringify({
            version: 1,
            playerId: 'buildfail',
            nodes: {
                '101-202': { parentId: null, epoch: 1, source: 'conversation', eventKey: 'conv:root', createdAt: NOW }
            }
        });
        writeRegistryFile(tmpDir, 'buildfail', validContent);

        const spy = jest.spyOn(TimelineRegistry.prototype, 'repairLegacyContinuity');
        try {
            const p = new FsTimelinePersistence(tmpDir);
            const result = p.loadStore('buildfail');
            expect(result.status).toBe('found');
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it('still produces root_not_object when parsed JSON root is not an object (e.g. a bare number)', () => {
        writeRegistryFile(tmpDir, 'numroot', '42');
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('numroot');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        const codes = result.errors.map(e => e.code);
        expect(codes).toContain('root_not_object');
        expect(codes).not.toContain('file_unreadable');
        expect(codes).not.toContain('json_invalid');
    });

    it('produces registry_build_failed when TimelineRegistry construction throws during load', () => {
        // Phase 5 removed the repairLegacyContinuity call from tryLoadPrimary, so
        // the old spy-on-repair approach no longer exercises this catch. The
        // constructor is non-throwing on post-validation input, so we force a
        // throw via the dedupIndex build path: Object.entries(nodes) is called
        // twice during validation (collectNodeFieldErrors + validateRegistryGraph)
        // before the constructor calls it a third time to build dedupIndex. We spy
        // on Object.entries to throw on that third call.
        const validContent = JSON.stringify({
            version: 1,
            playerId: 'buildfail',
            nodes: {
                '101-202': { parentId: null, epoch: 1, source: 'conversation', eventKey: 'conv:root', createdAt: NOW }
            }
        });
        writeRegistryFile(tmpDir, 'buildfail', validContent);

        const realEntries = Object.entries;
        let callCount = 0;
        const spy = jest.spyOn(Object, 'entries').mockImplementation(function (this: unknown, ...args: Parameters<typeof realEntries>): ReturnType<typeof realEntries> {
            callCount++;
            // Call 1: collectNodeFieldErrors (validateV1RegistryData)
            // Call 2: validateRegistryGraph (entries used for knownIds + detectCycles)
            // Call 3: TimelineRegistry constructor dedupIndex build -> throw
            if (callCount === 3) {
                throw new Error('simulated build failure');
            }
            return realEntries.apply(this as object, args);
        });
        try {
            const p = new FsTimelinePersistence(tmpDir);
            const result = p.loadStore('buildfail');
            expect(result.status).toBe('corrupt');
            if (result.status !== 'corrupt') return;
            const codes = result.errors.map(e => e.code);
            expect(codes).toContain('registry_build_failed');
            const buildFailed = result.errors.find(e => e.code === 'registry_build_failed')!;
            expect(buildFailed.message).toContain('simulated build failure');
        } finally {
            spy.mockRestore();
        }
    });
});

describe('summarizeRegistryErrors cap (M-2)', () => {
    it('lists all errors when count is at or below the cap', async () => {
        const { summarizeRegistryErrors, RegistryValidationError } = await import('../../src/main/registryValidator');
        const errors = [
            new RegistryValidationError('node_id_invalid', 'e1', { nodeId: '1' }),
            new RegistryValidationError('epoch_negative', 'e2', { nodeId: '2' })
        ];
        const summary = summarizeRegistryErrors(errors);
        expect(summary).toContain('node_id_invalid');
        expect(summary).toContain('epoch_negative');
        expect(summary).not.toContain('more');
    });

    it('caps at the first 10 errors and appends an "and N more" suffix', async () => {
        const { summarizeRegistryErrors, RegistryValidationError } = await import('../../src/main/registryValidator');
        const errors: import('../../src/main/registryValidator').RegistryValidationError[] = [];
        for (let i = 0; i < 15; i++) {
            errors.push(new RegistryValidationError('node_id_invalid', `err${i}`, { nodeId: `n${i}` }));
        }
        const summary = summarizeRegistryErrors(errors);
        expect(summary).toContain('err0');
        expect(summary).toContain('err9');
        expect(summary).not.toContain('err10');
        expect(summary).not.toContain('err14');
        expect(summary).toContain('5 more');
        expect(summary.includes('\n')).toBe(false);
    });

    it('returns empty string for no errors', async () => {
        const { summarizeRegistryErrors } = await import('../../src/main/registryValidator');
        expect(summarizeRegistryErrors([])).toBe('');
    });
});
