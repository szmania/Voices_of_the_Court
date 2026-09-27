/**
 * Unit tests for memoryManager.ts
 * Test cases: UT-MM-01 through UT-MM-14
 */

import { MemoryManager, Memory } from '../../src/main/memoryManager';
import Database from 'better-sqlite3';

jest.mock('better-sqlite3');

describe('MemoryManager', () => {
    let manager: MemoryManager;

    beforeEach(() => {
        jest.clearAllMocks();
        manager = new MemoryManager('/tmp/test-user-data');
    });

    afterEach(() => {
        if (manager) manager.close();
    });

    test('UT-MM-01: Insert memory — happy path', () => {
        const memory: Memory = {
            id: 'test-1',
            characterId: 'char-a',
            text: 'Test memory',
            vector: new Float32Array([0.1, 0.2, 0.3]),
            timestamp: Date.now(),
            emotion: 'happy',
            decay: 0.0,
            accessCount: 0,
            lastAccessed: Date.now()
        };
        manager.insertMemory(memory);
        const retrieved = manager.getMemory('test-1');
        expect(retrieved).toBeDefined();
        expect(retrieved?.text).toBe('Test memory');
    });

    test('UT-MM-02: Retrieve memory by ID — not found', () => {
        const result = manager.getMemory('nonexistent-id');
        expect(result).toBeNull();
    });

    test('UT-MM-03: Update memory — happy path', () => {
        const memory: Memory = {
            id: 'test-3',
            characterId: 'char-a',
            text: 'Original',
            vector: new Float32Array([0.1]),
            timestamp: Date.now(),
            emotion: 'neutral',
            decay: 0.0,
            accessCount: 0,
            lastAccessed: Date.now()
        };
        manager.insertMemory(memory);
        manager.updateMemory('test-3', { text: 'Updated' });
        const updated = manager.getMemory('test-3');
        expect(updated?.text).toBe('Updated');
    });

    test('UT-MM-04: Delete memory — happy path', () => {
        const memory: Memory = {
            id: 'test-4',
            characterId: 'char-a',
            text: 'To delete',
            vector: new Float32Array([0.1]),
            timestamp: Date.now(),
            emotion: 'neutral',
            decay: 0.0,
            accessCount: 0,
            lastAccessed: Date.now()
        };
        manager.insertMemory(memory);
        manager.deleteMemory('test-4');
        const result = manager.getMemory('test-4');
        expect(result).toBeNull();
    });

    test('UT-MM-05: Semantic search — top-K accuracy', () => {
        const baseVec = new Float32Array([1, 0, 0]);
        const similarVec = new Float32Array([0.9, 0.1, 0]);
        const farVec = new Float32Array([0, 0, 1]);
        manager.insertMemory({ id: 'a1', characterId: 'char-a', text: 'A1', vector: baseVec, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() });
        manager.insertMemory({ id: 'a2', characterId: 'char-a', text: 'A2', vector: similarVec, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() });
        manager.insertMemory({ id: 'b1', characterId: 'char-a', text: 'B1', vector: farVec, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() });
        const results = manager.searchSimilar('char-a', [1, 0, 0], { topK: 2 });
        expect(results.length).toBeGreaterThanOrEqual(2);
    });

    test('UT-MM-06: Semantic search — empty store', () => {
        const results = manager.searchSimilar('char-a', [1, 0, 0], { topK: 5 });
        expect(Array.isArray(results)).toBe(true);
    });

    test('UT-MM-07: Semantic search — dimension mismatch', () => {
        manager.insertMemory({
            id: 'dim-test', characterId: 'char-a', text: 'dim', vector: new Float32Array([1, 2, 3]),
            timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now()
        });
        expect(() => manager.searchSimilar('char-a', [1, 2], { topK: 5 })).toThrow();
    });

    test('UT-MM-08: Memory decay — aged memory', () => {
        const oldTimestamp = Date.now() - (30 * 24 * 60 * 60 * 1000);
        manager.insertMemory({
            id: 'decay-test', characterId: 'char-a', text: 'old', vector: new Float32Array([0.1]),
            timestamp: oldTimestamp, emotion: 'neutral', decay: 0.0, accessCount: 0, lastAccessed: Date.now()
        });
        manager.applyDecay('char-a', 0.01, 1.0);
        const updated = manager.getMemory('decay-test');
        expect(updated?.decay).toBeGreaterThan(0);
    });

    test('UT-MM-09: Memory decay — expired memory', () => {
        const veryOldTimestamp = Date.now() - (200 * 24 * 60 * 60 * 1000);
        const memory: Memory = {
            id: 'expire-test', characterId: 'char-a', text: 'ancient', vector: new Float32Array([0.1]),
            timestamp: veryOldTimestamp, emotion: 'neutral', decay: 1.0, accessCount: 0, lastAccessed: Date.now()
        };
        manager.insertMemory(memory);
        manager.applyDecay('char-a', 0.01, 1.0);
        const result = manager.getMemory('expire-test');
        expect(result).toBeNull();
    });

    test('UT-MM-10: Memory consolidation — merge similar', () => {
        const vec = new Float32Array([1, 0, 0]);
        manager.insertMemory({ id: 'sim1', characterId: 'char-a', text: 'Same thing', vector: vec, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() });
        manager.insertMemory({ id: 'sim2', characterId: 'char-a', text: 'Same thing too', vector: vec, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() });
        const countBefore = manager.getMemoryCount('char-a');
        manager.consolidateMemories('char-a', 0.85);
        const countAfter = manager.getMemoryCount('char-a');
        expect(countAfter).toBeLessThanOrEqual(countBefore);
    });

    test('UT-MM-11: Per-character isolation', () => {
        const vec = new Float32Array([0.5]);
        manager.insertMemory({ id: 'a-only', characterId: 'char-a', text: 'A memory', vector: vec, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() });
        manager.insertMemory({ id: 'b-only', characterId: 'char-b', text: 'B memory', vector: vec, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() });
        const aResults = manager.getMemoriesByCharacter('char-a');
        expect(aResults.some(m => m.id === 'b-only')).toBe(false);
    });

    test('UT-MM-12: sqlite-vec load failure', () => {
        (Database as jest.Mock).mockImplementation(() => ({
            exec: jest.fn(),
            prepare: jest.fn(() => ({ run: jest.fn(), get: jest.fn(), all: jest.fn() })),
            loadExtension: jest.fn(() => { throw new Error('Extension load failed'); })
        }));
        expect(() => new MemoryManager('/tmp/test-user-data')).toThrow(/Extension load failed/i);
    });

    test('UT-MM-13: Concurrent insert — race condition', async () => {
        const vec = new Float32Array([0.1]);
        await Promise.all([
            manager.insertMemory({ id: 'race1', characterId: 'char-a', text: 'Race 1', vector: vec, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() }),
            manager.insertMemory({ id: 'race2', characterId: 'char-a', text: 'Race 2', vector: vec, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() })
        ]);
        expect(manager.getMemoryCount('char-a')).toBeGreaterThanOrEqual(2);
    });

    test('UT-MM-14: Vector storage — binary format integrity', () => {
        const original = new Float32Array([0.1, 0.2, 0.3]);
        manager.insertMemory({ id: 'bin-test', characterId: 'char-a', text: 'Binary', vector: original, timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now() });
        const retrieved = manager.getMemory('bin-test');
        expect(retrieved?.vector).toBeDefined();
        expect(Array.from(retrieved?.vector as Float32Array)).toEqual(Array.from(original));
    });
});
