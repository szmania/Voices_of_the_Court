import {
    TimelineRegistry,
    FsTimelinePersistence,
    TimelineRegistryCorruptError,
    TimelineParentNotFoundError,
    loadRegistryOrThrow
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

describe('FsTimelinePersistence.loadStore', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-timeline-corrupt-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('reports missing when no registry file exists', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('missing');
    });

    it('reports found for a valid registry file', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        // §4.2: use the test-only legacy writer (saveRegistry refuses to
        // create new player-only files).
        writeLegacyPlayerRegistry(tmpDir, reg);

        const result = p.loadStore('player1');
        expect(result.status).toBe('found');
        if (result.status === 'found') {
            expect(result.store.hasNode(aId)).toBe(true);
        }
    });

    it('reports corrupt for truncated JSON and quarantines a copy while keeping the original', () => {
        const filePath = writeRegistryFile(tmpDir, 'player1', '{"version":1,"playerId":"player1","no');
        const originalContent = fs.readFileSync(filePath, 'utf8');

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');

        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        expect(result.filePath).toBe(filePath);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.quarantinePath).toBeDefined();
        expect(fs.existsSync(result.quarantinePath!)).toBe(true);
        expect(fs.readFileSync(result.quarantinePath!, 'utf8')).toBe(originalContent);
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBe(originalContent);
    });

    it('reports corrupt for structurally invalid registries', () => {
        writeRegistryFile(tmpDir, 'bad', JSON.stringify({ version: 999, playerId: 'bad', nodes: {} }));
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('bad');
        expect(result.status).toBe('corrupt');
    });

    it('reports corrupt for registries with invalid node entries', () => {
        writeRegistryFile(tmpDir, 'badnode', JSON.stringify({
            version: 1,
            playerId: 'badnode',
            nodes: { 'not-a-node': { parentId: null, source: 'conversation', eventKey: 'x', createdAt: NOW } }
        }));
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('badnode');
        expect(result.status).toBe('corrupt');
    });

    it('does not create duplicate quarantine copies for identical corrupt content', () => {
        writeRegistryFile(tmpDir, 'player1', '{broken');
        const p = new FsTimelinePersistence(tmpDir);
        const first = p.loadStore('player1');
        const second = p.loadStore('player1');
        expect(first.status).toBe('corrupt');
        expect(second.status).toBe('corrupt');
        if (first.status !== 'corrupt' || second.status !== 'corrupt') return;
        expect(second.quarantinePath).toBe(first.quarantinePath);
        const quarantineDir = path.join(registryDirOf(tmpDir), 'quarantine');
        expect(fs.readdirSync(quarantineDir).length).toBe(1);
    });

    it('keeps both quarantine copies when different corrupt contents collide on the same timestamp', () => {
        const toISOStringSpy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-07-20T00:00:00.000Z');
        try {
            const filePath = writeRegistryFile(tmpDir, 'player1', '{broken A');
            const p = new FsTimelinePersistence(tmpDir);
            const first = p.loadStore('player1');
            expect(first.status).toBe('corrupt');

            fs.writeFileSync(filePath, '{broken B', 'utf8');
            const second = p.loadStore('player1');
            expect(second.status).toBe('corrupt');
            if (first.status !== 'corrupt' || second.status !== 'corrupt') return;

            expect(second.quarantinePath).toBeDefined();
            expect(second.quarantinePath).not.toBe(first.quarantinePath);
            expect(fs.readFileSync(first.quarantinePath!, 'utf8')).toBe('{broken A');
            expect(fs.readFileSync(second.quarantinePath!, 'utf8')).toBe('{broken B');
        } finally {
            toISOStringSpy.mockRestore();
        }
    });

    it('loadRegistry still returns null on corrupt after quarantining', () => {
        writeRegistryFile(tmpDir, 'player1', '{broken');
        const p = new FsTimelinePersistence(tmpDir);
        expect(p.loadRegistry('player1')).toBeNull();
        const quarantineDir = path.join(registryDirOf(tmpDir), 'quarantine');
        expect(fs.existsSync(quarantineDir)).toBe(true);
        expect(fs.readdirSync(quarantineDir).length).toBe(1);
    });
});

describe('loadRegistryOrThrow (fail closed)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-timeline-corrupt-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates a new empty registry when the file is missing', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const registry = loadRegistryOrThrow(p, 'player1');
        expect(registry.playerId).toBe('player1');
        expect(registry.getAllNodes().length).toBe(0);
    });

    it('throws TimelineRegistryCorruptError on corrupt files and never creates an empty registry', () => {
        const filePath = writeRegistryFile(tmpDir, 'player1', '{"version":1,"play');
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const p = new FsTimelinePersistence(tmpDir);

        let thrown: unknown;
        try {
            loadRegistryOrThrow(p, 'player1');
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(TimelineRegistryCorruptError);
        const corruptError = thrown as TimelineRegistryCorruptError;
        expect(corruptError.code).toBe('TIMELINE_REGISTRY_CORRUPT');
        expect(corruptError.filePath).toBe(filePath);
        expect(corruptError.quarantinePath).toBeDefined();
        expect(fs.existsSync(corruptError.quarantinePath!)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf8')).toBe(originalContent);
    });

    it('corrupt state blocks the business write path (no registry writes happen)', () => {
        const filePath = writeRegistryFile(tmpDir, 'player1', '{broken');
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const p = new FsTimelinePersistence(tmpDir);

        expect(() => loadRegistryOrThrow(p, 'player1')).toThrow(TimelineRegistryCorruptError);
        expect(fs.readFileSync(filePath, 'utf8')).toBe(originalContent);
        expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
    });

    it('returns the loaded registry for valid files', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const reg = new TimelineRegistry('player1');
        const aId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        // §4.2: use the test-only legacy writer.
        writeLegacyPlayerRegistry(tmpDir, reg);

        const loaded = loadRegistryOrThrow(p, 'player1');
        expect(loaded.hasNode(aId)).toBe(true);
    });
});

describe('TimelineRegistry.getOrCreateChild parent validation', () => {
    it('throws TimelineParentNotFoundError when the parent does not exist', () => {
        const reg = new TimelineRegistry('player1');
        let thrown: unknown;
        try {
            reg.getOrCreateChild('123-456', 'conversation', 'conv:orphan', 2, NOW);
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(TimelineParentNotFoundError);
        expect((thrown as TimelineParentNotFoundError).code).toBe('TIMELINE_PARENT_NOT_FOUND');
        expect((thrown as TimelineParentNotFoundError).parentId).toBe('123-456');
        expect(reg.getAllNodes().length).toBe(0);
    });

    it('still creates children for existing parents and roots', () => {
        const reg = new TimelineRegistry('player1');
        const rootId = reg.getOrCreateChild(null, 'conversation', 'conv:root', 1, NOW);
        const childId = reg.getOrCreateChild(rootId, 'conversation', 'conv:child', 2, NOW);
        expect(reg.getNode(childId)!.parentId).toBe(rootId);
    });

    it('dedup hit does not throw even if the parent went missing', () => {
        const reg = new TimelineRegistry('player1', {
            version: 1,
            playerId: 'player1',
            nodes: {
                '11-22': {
                    parentId: '99-88',
                    epoch: 2,
                    source: 'conversation',
                    eventKey: 'conv:child',
                    createdAt: NOW
                }
            }
        });
        const id = reg.getOrCreateChild('99-88', 'conversation', 'conv:child', 2, NOW);
        expect(id).toBe('11-22');
    });
});
