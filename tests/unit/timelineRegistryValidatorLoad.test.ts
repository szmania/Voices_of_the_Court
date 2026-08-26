import {
    FsTimelinePersistence,
    TimelineRegistryCorruptError,
    loadRegistryOrThrow
} from '../../src/main/timelineManager';
import type { RegistryValidationError } from '../../src/main/registryValidator';
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

describe('FsTimelinePersistence.loadStore (validator-aware corrupt detection)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-timeline-validator-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('populates errors[] with structured validator errors on a corrupt registry', () => {
        const filePath = writeRegistryFile(tmpDir, 'badnode', JSON.stringify({
            version: 1,
            playerId: 'badnode',
            nodes: {
                'not-a-node': { parentId: null, source: 'conversation', eventKey: 'x', createdAt: NOW }
            }
        }));

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('badnode');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        expect(result.filePath).toBe(filePath);
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
        const codes = result.errors.map(e => e.code);
        expect(codes).toContain('node_id_invalid');
    });

    it('populates errors[] with parent_missing when a child references a non-existent parent', () => {
        writeRegistryFile(tmpDir, 'orphan', JSON.stringify({
            version: 1,
            playerId: 'orphan',
            nodes: {
                '101-202': { parentId: null, epoch: 1, source: 'conversation', eventKey: 'root', createdAt: NOW },
                '101-203': { parentId: '999-999', epoch: 2, source: 'conversation', eventKey: 'child', createdAt: NOW }
            }
        }));

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('orphan');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        const codes = result.errors.map((e: RegistryValidationError) => e.code);
        expect(codes).toContain('parent_missing');
    });

    it('populates errors[] with cycle on a cyclic registry', () => {
        writeRegistryFile(tmpDir, 'cycle', JSON.stringify({
            version: 1,
            playerId: 'cycle',
            nodes: {
                '101-202': { parentId: '101-203', epoch: 1, source: 'conversation', eventKey: 'a', createdAt: NOW },
                '101-203': { parentId: '101-202', epoch: 2, source: 'conversation', eventKey: 'b', createdAt: NOW }
            }
        }));

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('cycle');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        const codes = result.errors.map((e: RegistryValidationError) => e.code);
        expect(codes).toContain('cycle');
    });

    it('populates errors[] with epoch_regression on a backwards-epoch child', () => {
        writeRegistryFile(tmpDir, 'regress', JSON.stringify({
            version: 1,
            playerId: 'regress',
            nodes: {
                '101-202': { parentId: null, epoch: 3, source: 'conversation', eventKey: 'root', createdAt: NOW },
                '101-203': { parentId: '101-202', epoch: 1, source: 'conversation', eventKey: 'child', createdAt: NOW }
            }
        }));

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('regress');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        const codes = result.errors.map((e: RegistryValidationError) => e.code);
        expect(codes).toContain('epoch_regression');
    });

    it('populates errors[] with version_unsupported on a wrong-schema registry', () => {
        writeRegistryFile(tmpDir, 'bad', JSON.stringify({ version: 999, playerId: 'bad', nodes: {} }));
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('bad');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        const codes = result.errors.map((e: RegistryValidationError) => e.code);
        expect(codes).toContain('version_unsupported');
    });

    it('populates errors[] with source_unknown on a bad source', () => {
        writeRegistryFile(tmpDir, 'badsrc', JSON.stringify({
            version: 1,
            playerId: 'badsrc',
            nodes: {
                '101-202': { parentId: null, epoch: 1, source: 'mystery', eventKey: 'x', createdAt: NOW }
            }
        }));
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('badsrc');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        const codes = result.errors.map((e: RegistryValidationError) => e.code);
        expect(codes).toContain('source_unknown');
    });

    it('populates errors[] with self_parent when a node parents itself', () => {
        writeRegistryFile(tmpDir, 'selfpar', JSON.stringify({
            version: 1,
            playerId: 'selfpar',
            nodes: {
                '101-202': { parentId: '101-202', epoch: 1, source: 'conversation', eventKey: 'self', createdAt: NOW }
            }
        }));
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('selfpar');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        const codes = result.errors.map((e: RegistryValidationError) => e.code);
        expect(codes).toContain('self_parent');
    });

    it('quarantines corrupt registry with structured errors (preserves P1.4 behavior)', () => {
        const filePath = writeRegistryFile(tmpDir, 'player1', JSON.stringify({
            version: 1,
            playerId: 'player1',
            nodes: {
                'bad': { parentId: null, source: 'conversation', eventKey: 'x', createdAt: NOW }
            }
        }));
        const originalContent = fs.readFileSync(filePath, 'utf8');

        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('player1');
        expect(result.status).toBe('corrupt');
        if (result.status !== 'corrupt') return;
        expect(result.quarantinePath).toBeDefined();
        expect(fs.existsSync(result.quarantinePath!)).toBe(true);
        expect(fs.readFileSync(result.quarantinePath!, 'utf8')).toBe(originalContent);
        expect(fs.existsSync(filePath)).toBe(true);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns found with source=primary and revision=0 for a valid registry', () => {
        writeRegistryFile(tmpDir, 'good', JSON.stringify({
            version: 1,
            playerId: 'good',
            nodes: {
                '101-202': { parentId: null, epoch: 1, source: 'conversation', eventKey: 'conv:root', createdAt: NOW },
                '101-203': { parentId: '101-202', epoch: 2, source: 'battle', eventKey: 'battle:sig-1', createdAt: NOW }
            }
        }));
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('good');
        expect(result.status).toBe('found');
        if (result.status !== 'found') return;
        expect(result.source).toBe('primary');
        expect(result.revision).toBe(0);
        expect(result.store.getAllNodes().length).toBe(2);
    });

    it('still reports missing when no file exists', () => {
        const p = new FsTimelinePersistence(tmpDir);
        const result = p.loadStore('never');
        expect(result.status).toBe('missing');
    });
});

describe('loadRegistryOrThrow (validator-aware)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-timeline-throw-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('throws TimelineRegistryCorruptError carrying the structured errors list', () => {
        writeRegistryFile(tmpDir, 'player1', JSON.stringify({
            version: 1,
            playerId: 'player1',
            nodes: {
                'bad': { parentId: null, source: 'conversation', eventKey: 'x', createdAt: NOW }
            }
        }));
        const p = new FsTimelinePersistence(tmpDir);

        let thrown: unknown;
        try {
            loadRegistryOrThrow(p, 'player1');
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBeInstanceOf(TimelineRegistryCorruptError);
        const err = thrown as TimelineRegistryCorruptError;
        expect(err.code).toBe('TIMELINE_REGISTRY_CORRUPT');
        expect(err.errors).toBeDefined();
        expect(err.errors.length).toBeGreaterThan(0);
        expect(err.errors[0].code).toBe('node_id_invalid');
    });
});
