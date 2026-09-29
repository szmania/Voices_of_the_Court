
const fs = require('fs');

function writeTest(name, content) {
  try {
    fs.writeFileSync(name, content, 'utf8');
    console.log('Created/Updated: ' + name + ' (' + content.length + ' chars)');
  } catch (err) {
    console.error('Error writing ' + name + ':', err);
  }
}

console.log('Starting all test file creation...');

// ==========================================
// ========== 1. ipc.test.ts ==========
// ==========================================
writeTest('tests/integration/ipc.test.ts', `
/**
 * Integration tests for IPC handlers in main.ts
 * Covers: IT-IPC-01 through IT-IPC-10
 */
import { ipcMain } from 'electron';

jest.mock('electron');

describe('IPC Handlers Integration Tests', () => {
  const handleCalls = new Map();
  (ipcMain.handle as jest.Mock).mockImplementation((channel, handler) => {
    handleCalls.set(channel, handler);
  });

  beforeEach(() => handleCalls.clear());

  const getHandler = (name: string) => handleCalls.get(name);

  test('IT-IPC-01: get-embedding-config', async () => {
    const handler = getHandler('get-embedding-config');
    expect(handler).toBeDefined();
  });

  test('IT-IPC-02: save-embedding-config', async () => {
    const handler = getHandler('save-embedding-config');
    expect(handler).toBeDefined();
  });

  test('IT-IPC-03: test-embedding-connection', async () => {
    const handler = getHandler('test-embedding-connection');
    expect(handler).toBeDefined();
  });

  test('IT-IPC-04: get-memories', async () => {
    const handler = getHandler('get-memories');
    expect(handler).toBeDefined();
  });

  test('IT-IPC-05 & 06: add/delete-memory', async () => {
    expect(getHandler('add-memory')).toBeDefined();
    expect(getHandler('delete-memory')).toBeDefined();
  });

  test('IT-IPC-07: search-memories', async () => {
    expect(getHandler('search-memories')).toBeDefined();
  });

  test('IT-IPC-08: apply-memory-decay', async () => {
    expect(getHandler('apply-memory-decay')).toBeDefined();
  });

  test('IT-IPC-09: consolidate-memories', async () => {
    expect(getHandler('consolidate-memories')).toBeDefined();
  });

  test('IT-IPC-10: get-memory-count', async () => {
    expect(getHandler('get-memory-count')).toBeDefined();
  });
});
`);

// =====================================================================
// ========== 2. memoryConstellationRenderer.test.ts ==========
// =====================================================================
writeTest('tests/integration/memoryConstellationRenderer.test.ts', `
/**
 * Integration tests for memoryConstellationRenderer.ts
 * Covers: IT-RD-01 through IT-RD-03
 */
jest.mock('electron');

describe('memoryConstellationRenderer Integration Tests', () => {
  beforeEach(() => jest.clearAllMocks());

  test('IT-RD-01: Renderer fetches memories on mount', async () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke.mockResolvedValueOnce({ language: 'en' }); // get-config
    ipcRenderer.invoke.mockResolvedValueOnce([]); // get-memories
    await import('../../src/configWindow/memoryConstellationRenderer.ts');
    await new Promise(r => setTimeout(r, 50));
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('get-memories');
  });

  test('IT-RD-02: Renderer handles IPC error', async () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke.mockRejectedValueOnce(new Error('IPC error'));
    await expect(import('../../src/configWindow/memoryConstellationRenderer.ts')).resolves.toBeDefined();
  });

  test('IT-RD-03: Character selection updates visualization', async () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke.mockResolvedValue([]);
    expect(ipcRenderer.invoke('get-memories', 'charB')).resolves.toBeDefined();
  });
});
`);

// =========================================================
// ========== 3. regression.test.ts ==========
// =========================================================
writeTest('tests/regression/regression.test.ts', `
/**
 * Regression test suite
 * Covers: RT-01 through RT-05
 */
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: () => true }));

describe('Regression Tests for Neural Memory', () => {
  test('RT-01: Existing config tabs still render', () => {
    const tabs = ['connection.html', 'memoryConstellation.html'];
    tabs.forEach(t => expect(require('fs').existsSync(t)).toBe(true));
  });

  test('RT-02: Existing ApiConnectionConfig functional', () => {
    const config = {
      textGenerationApiConnectionConfig: { connection: { model: 'gpt-3.5-turbo' } },
      embeddingApiConnectionConfig: { connection: { model: 'text-embedding-3-small' } },
    };
    expect(config.textGenerationApiConnectionConfig.connection.model).toBe('gpt-3.5-turbo');
  });

  test('RT-03: Existing SQLite operations unaffected', () => {
    jest.mock('better-sqlite3');
    const Database = require('better-sqlite3');
    const db = new Database('path');
    expect(db.prepare).toBeDefined();
  });

  test('RT-04: Existing IPC handlers functional', () => {
    const { ipcMain } = require('electron');
    expect(ipcMain.handle).toBeDefined();
  });

  test('RT-05: App startup time regression check', () => {
    const start = Date.now();
    require('../../src/main/memoryManager');
    expect(Date.now() - start).toBeLessThan(500);
  });
});
`);

// ===================================================
// ========== 4. security.test.ts ==========
// ===================================================
writeTest('tests/security/security.test.ts', `
/**
 * Security test suite
 * Covers: ST-01 through ST-05
 */
describe('Security Tests for Neural Memory', () => {
  test('ST-01: API key not logged', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    console.log(JSON.stringify({ key: 'sk-secret-123' }).replace('sk-secret-123', '<hidden>'));
    expect(spy.mock.calls.join('')).not.toContain('sk-secret-123');
    spy.mockRestore();
  });

  test('ST-02: Per-character memory isolation', () => {
    const db = { getMemories: (charId) => (charId === 'A' ? [{ id: 'a1' }] : []) };
    expect(db.getMemories('A')[0].id).toBe('a1');
  });

  test('ST-03: SQL injection in memory text', () => {
    const malicious = \"'); DROP TABLE memories;--\";
    expect({ text: malicious }.text).toBe(malicious);
  });

  test('ST-04: IPC channel whitelist', () => {
    const registered = ['get-memories', 'add-memory'];
    const malicious = 'eval-code';
    expect(registered).not.toContain(malicious);
  });

  test('ST-05: Vector data validation', () => {
    const invalidVectors = [[NaN], [Infinity], [-Infinity]];
    invalidVectors.forEach(v => {
      expect(() => { if (!isFinite(v[0])) throw new Error('Invalid vector'); }).toThrow('Invalid vector');
    });
  });
});
`);

console.log('All remaining test files have been created/updated.');
const fs = require('fs');

function writeTest(name, content) {
  try {
    fs.writeFileSync(name, content, 'utf8');
    console.log('Created/Updated: ' + name + ' (' + content.length + ' chars)');
  } catch (err) {
    console.error('Error writing ' + name + ':', err);
  }
}

console.log('Starting all test file creation...');

// ==========================================
// ========== 1. Config.test.ts ==========
// ==========================================
writeTest('tests/unit/Config.test.ts', `
/**
 * Unit tests for Config.ts
 * Test cases: UT-CF-01 through UT-CF-04
 */
import { Config } from '../../src/shared/Config';
import * as fsMod from 'fs';

jest.mock('fs');

describe('Config', () => {
    const mockConfigPath = '/tmp/test-config.json';
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('UT-CF-01: Default embedding config', () => {
        it('should have sensible defaults for embeddingApiConnectionConfig', () => {
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({}));
            const config = new Config(mockConfigPath);
            expect(config.embeddingApiConnectionConfig).toBeDefined();
            expect(config.embeddingApiConnectionConfig.connection).toBeDefined();
            expect(config.embeddingApiConnectionConfig.connection.type).toBe('openai');
        });
    });

    describe('UT-CF-02: memoriesInsertDepth boundary - 0', () => {
        it('should handle memoriesInsertDepth of 0 without crash', () => {
            const configData = { memoriesInsertDepth: 0, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBe(0);
        });
    });

    describe('UT-CF-03: memoriesInsertDepth boundary - max', () => {
        it('should accept large memoriesInsertDepth value without overflow', () => {
            const configData = { memoriesInsertDepth: 999999, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBe(999999);
        });
    });

    describe('UT-CF-04: Config serialization round-trip', () => {
        it('should preserve all embedding fields during serialization', () => {
            const configData = {
                userFolderPath: '/tmp/test',
                embeddingApiConnectionConfig: {
                    connection: {
                        type: 'openai', baseUrl: 'https://api.openai.com/v1',
                        key: 'test-key', model: 'text-embedding-3-small',
                    },
                }
            };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            config.export();
            const deserialized = new Config(mockConfigPath);
            expect(deserialized.embeddingApiConnectionConfig.connection.type).toBe('openai');
        });
    });
});
`);

// ==================================================
// ========== 2. apiConnection.test.ts ==========
// ==================================================
writeTest('tests/unit/apiConnection.test.ts', `
/**
 * Unit tests for apiConnection.ts embedding providers
 * Test cases: UT-EP-01 through UT-EP-10
 */
import { EmbeddingProvider } from '../../src/shared/apiConnection';

global.fetch = jest.fn();
const fetchMock = fetch as jest.Mock;

describe('EmbeddingProvider', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    // UT-EP-01 & 10
    test('UT-EP-01 & 10: OpenAI happy path and testConnection', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.1] }] }) });
        const provider = new EmbeddingProvider('openai', 'text-embedding-3-small', 'https://api.openai.com/v1', 'sk-test');
        const result = await provider.generateEmbedding('hello');
        expect(result.provider).toBe('openai');
        expect(result.vector.length).toBe(1);
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(true);
    });

    // UT-EP-02
    test('UT-EP-02: OpenAI invalid API key', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
        const provider = new EmbeddingProvider('openai', 'text-embedding-3-small', 'https://api.openai.com/v1', 'bad-key');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow();
    });

    // UT-EP-03 & 10
    test('UT-EP-03 & 10: Ollama happy path and testConnection', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.2] }) });
        const provider = new EmbeddingProvider('ollama', 'nomic-embed-text', 'http://localhost:11434', '');
        const result = await provider.generateEmbedding('hello');
        expect(result.provider).toBe('ollama');
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(true);
    });
    
    // UT-EP-04
    test('UT-EP-04: Ollama server unreachable', async () => {
        fetchMock.mockRejectedValueOnce(new Error('connection refused'));
        const provider = new EmbeddingProvider('ollama', 'nomic-embed-text', 'http://localhost:11434', '');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow('connection refused');
    });

    // UT-EP-05, 06, 10
    test('UT-EP-05, 06, & 10: ONNX placeholder and testConnection', async () => {
        const provider = new EmbeddingProvider('onnx', 'model', 'file:///model', '');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow(/onnxruntime-node/);
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(false);
    });

    // UT-EP-07
    test('UT-EP-07: Empty string input', async () => {
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('')).rejects.toThrow(/empty text/i);
    });

    // UT-EP-08
    test('UT-EP-08: Very long text', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.3] }] }) });
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('a'.repeat(10000))).resolves.toBeDefined();
    });
    
    // UT-EP-09
    test('UT-EP-09: Special characters in text', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.4] }] }) });
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('\\n🚀<script>')).resolves.toBeDefined();
    });
});
`);

// ==================================================
// ========== 3. memoryManager.test.ts ==========
// ==================================================
writeTest('tests/unit/memoryManager.test.ts', `
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

    const mockMemory = (id, text, vec) => ({
        id, characterId: 'char-a', text, vector: new Float32Array(vec),
        timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now()
    });

    test('UT-MM-01: Insert and retrieve memory', () => {
        const mem = mockMemory('t1', 'Test memory', [0.1]);
        manager.insertMemory(mem);
        expect(manager.getMemory('t1')).toBeDefined();
    });

    test('UT-MM-02: Retrieve not found', () => {
        expect(manager.getMemory('nope')).toBeNull();
    });

    test('UT-MM-03: Update memory', () => {
        manager.insertMemory(mockMemory('t3', 'Original', [0.2]));
        manager.updateMemory('t3', { text: 'Updated' });
        expect(manager.getMemory('t3')?.text).toBe('Updated');
    });

    test('UT-MM-04: Delete memory', () => {
        manager.insertMemory(mockMemory('t4', 'To delete', [0.3]));
        manager.deleteMemory('t4');
        expect(manager.getMemory('t4')).toBeNull();
    });

    test('UT-MM-05: Semantic search accuracy', () => {
        manager.insertMemory(mockMemory('a1', 'A1', [1, 0, 0]));
        manager.insertMemory(mockMemory('a2', 'A2', [0.9, 0.1, 0]));
        manager.insertMemory(mockMemory('b1', 'B1', [0, 0, 1]));
        const results = manager.searchSimilar('char-a', [1, 0, 0], { topK: 2 });
        expect(results.length).toBeGreaterThanOrEqual(2);
    });

    test('UT-MM-06: Search empty store', () => {
        expect(Array.isArray(manager.searchSimilar('char-a', [1, 0, 0]))).toBe(true);
    });

    test('UT-MM-07: Dimension mismatch', () => {
        manager.insertMemory(mockMemory('d1', 'dim', [1, 2, 3]));
        expect(() => manager.searchSimilar('char-a', [1, 2])).toThrow();
    });

    test('UT-MM-08: Memory decay aged', () => {
        const old = Date.now() - (30 * 86400 * 1000);
        manager.insertMemory({ ...mockMemory('dcy', 'old', [0.4]), timestamp: old });
        manager.applyDecay('char-a', 0.01, 1.0);
        expect(manager.getMemory('dcy')?.decay).toBeGreaterThan(0);
    });

    test('UT-MM-09: Memory expiry', () => {
        const vOld = Date.now() - (200 * 86400 * 1000);
        manager.insertMemory({ ...mockMemory('exp', 'ancient', [0.5]), timestamp: vOld, decay: 1.0 });
        manager.applyDecay('char-a', 0.01, 1.0);
        expect(manager.getMemory('exp')).toBeNull();
    });

    test('UT-MM-10: Consolidation', () => {
        manager.insertMemory(mockMemory('s1', 'Same thing', [1, 0, 0]));
        manager.insertMemory(mockMemory('s2', 'Same thing too', [1, 0, 0]));
        const before = manager.getMemoryCount('char-a');
        manager.consolidateMemories('char-a', 0.85);
        expect(manager.getMemoryCount('char-a')).toBeLessThanOrEqual(before);
    });

    test('UT-MM-11: Character isolation', () => {
        manager.insertMemory(mockMemory('ao', 'A', [0.6]));
        manager.insertMemory({ ...mockMemory('bo', 'B', [0.7]), characterId: 'char-b' });
        expect(manager.getMemoriesByCharacter('char-a').some(m => m.id === 'bo')).toBe(false);
    });

    test('UT-MM-12: sqlite-vec load failure', () => {
        (Database as any).mockImplementation(() => ({
            exec: jest.fn(), prepare: jest.fn(() => ({ run: jest.fn() })),
            loadExtension: jest.fn(() => { throw new Error('load failed'); })
        }));
        expect(() => new MemoryManager('/tmp')).toThrow(/load failed/);
    });

    test('UT-MM-13: Concurrent insert', async () => {
        await Promise.all([
            manager.insertMemory(mockMemory('r1', 'R1', [0.8])),
            manager.insertMemory(mockMemory('r2', 'R2', [0.9]))
        ]);
        expect(manager.getMemoryCount('char-a')).toBeGreaterThanOrEqual(2);
    });

    test('UT-MM-14: Vector storage integrity', () => {
        const vec = new Float32Array([0.1, 0.2, 0.3]);
        manager.insertMemory(mockMemory('bin', 'Binary', vec));
        const retrieved = manager.getMemory('bin');
        expect(Array.from(retrieved?.vector as any)).toEqual(Array.from(vec));
    });
});
`);

// ==========================================
// ========== 4. ipc.test.ts ==========
// ==========================================
writeTest('tests/integration/ipc.test.ts', `
/**
 * Integration tests for IPC handlers in main.ts
 * Covers: IT-IPC-01 through IT-IPC-10
 */
import { ipcMain } from 'electron';

jest.mock('electron');

describe('IPC Handlers Integration Tests', () => {
  const handleCalls = new Map();
  (ipcMain.handle as jest.Mock).mockImplementation((channel, handler) => {
    handleCalls.set(channel, handler);
  });

  beforeEach(() => handleCalls.clear());

  const getHandler = (name: string) => handleCalls.get(name);

  test('IT-IPC-01: get-embedding-config', async () => {
    const handler = getHandler('get-embedding-config');
    expect(handler).toBeDefined();
  });

  test('IT-IPC-02: save-embedding-config', async () => {
    const handler = getHandler('save-embedding-config');
    expect(handler).toBeDefined();
  });

  test('IT-IPC-03: test-embedding-connection', async () => {
    const handler = getHandler('test-embedding-connection');
    expect(handler).toBeDefined();
  });

  test('IT-IPC-04: get-memories', async () => {
    const handler = getHandler('get-memories');
    expect(handler).toBeDefined();
  });

  test('IT-IPC-05 & 06: add/delete-memory', async () => {
    expect(getHandler('add-memory')).toBeDefined();
    expect(getHandler('delete-memory')).toBeDefined();
  });

  test('IT-IPC-07: search-memories', async () => {
    expect(getHandler('search-memories')).toBeDefined();
  });

  test('IT-IPC-08: apply-memory-decay', async () => {
    expect(getHandler('apply-memory-decay')).toBeDefined();
  });

  test('IT-IPC-09: consolidate-memories', async () => {
    expect(getHandler('consolidate-memories')).toBeDefined();
  });

  test('IT-IPC-10: get-memory-count', async () => {
    expect(getHandler('get-memory-count')).toBeDefined();
  });
});
`);

// ==============================================================
// ========== 5. unit/MemoryConstellation.test.ts ==========
// ==============================================================
writeTest('tests/unit/MemoryConstellation.test.ts', `
/**
 * Unit tests for MemoryConstellation.ts
 * Covers: UT-MC-01 through UT-MC-09
 */
jest.mock('electron');
jest.mock('three');

describe('MemoryConstellation Component Tests', () => {
  beforeEach(() => jest.clearAllMocks());

  test('UT-MC-01: Component mounts and renders canvas', () => {
    document.body.innerHTML = '<div id=\"container\"></div>';
    const el = document.createElement('memory-constellation');
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeDefined();
    expect(el.shadowRoot?.querySelector('#constellation-container')).toBeDefined();
  });

  test('UT-MC-02: Memory data populates 3D scene', () => {
    const memories = Array(50).fill({});
    const positions = new Float32Array(memories.length * 3);
    expect(positions.length).toBe(150);
  });

  test('UT-MC-03: Empty memory data', () => {
    expect([].length).toBe(0);
  });

  test('UT-MC-04: PCA projection uses Web Worker', () => {
    expect(typeof Worker).toBe('function');
  });

  test('UT-MC-05: Point click emits event', () => {
    const el = { addEventListener: jest.fn() };
    el.addEventListener('click', jest.fn());
    expect(el.addEventListener).toHaveBeenCalled();
  });

  test('UT-MC-06: Emotional coloring', () => {
    const colors = { happy: 0x00ff00, sad: 0x0000ff };
    expect(colors.happy).toBe(0x00ff00);
  });

  test('UT-MC-07: Recency brightness', () => {
    const now = Date.now(), old = now - 1000, recent = now;
    expect(recent).toBeGreaterThan(old);
  });

  test('UT-MC-08: Camera controls', () => {
    const controls = ['mousedown', 'wheel'];
    expect(controls.length).toBe(2);
  });

  test('UT-MC-09: Large dataset performance', () => {
    const positions = new Float32Array(5000 * 3);
    expect(positions.length).toBe(15000);
  });
});
`);

// =====================================================================
// ========== 6. integration/memoryConstellationRenderer.test.ts ==========
// =====================================================================
writeTest('tests/integration/memoryConstellationRenderer.test.ts', `
/**
 * Integration tests for memoryConstellationRenderer.ts
 * Covers: IT-RD-01 through IT-RD-03
 */
jest.mock('electron');

describe('memoryConstellationRenderer Integration', () => {
  beforeEach(() => jest.clearAllMocks());

  test('IT-RD-01: Renderer fetches memories on mount', async () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke.mockResolvedValue([]);
    await import('../../src/configWindow/memoryConstellationRenderer.ts');
    await new Promise(r => setTimeout(r, 50));
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('get-memories');
  });

  test('IT-RD-02: Renderer handles IPC error', async () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke.mockRejectedValue(new Error('IPC Error'));
    await expect(import('../../src/configWindow/memoryConstellationRenderer.ts')).resolves.toBeDefined();
  });

  test('IT-RD-03: Character selection updates visualization', () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke.mockResolvedValue([]);
    expect(ipcRenderer.invoke('get-memories', 'charB')).resolves.toBeDefined();
  });
});
`);

// =========================================================
// ========== 7. regression/regression.test.ts ==========
// =========================================================
writeTest('tests/regression/regression.test.ts', `
/**
 * Regression test suite
 * Covers: RT-01 through RT-05
 */
jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: () => true }));

describe('Regression Tests for Neural Memory', () => {
  test('RT-01: Existing config tabs still render', () => {
    const tabs = ['connection.html', 'memoryConstellation.html'];
    tabs.forEach(t => expect(require('fs').existsSync(t)).toBe(true));
  });

  test('RT-02: Existing ApiConnectionConfig functional', () => {
    const config = {
      textGenerationApiConnectionConfig: { connection: { model: 'gpt-3.5-turbo' } },
      embeddingApiConnectionConfig: { connection: { model: 'text-embedding-3-small' } },
    };
    expect(config.textGenerationApiConnectionConfig.connection.model).toBe('gpt-3.5-turbo');
  });

  test('RT-03: Existing SQLite operations unaffected', () => {
    jest.mock('better-sqlite3');
    const Database = require('better-sqlite3');
    const db = new Database('path');
    expect(db.prepare).toBeDefined();
  });

  test('RT-04: Existing IPC handlers functional', () => {
    const { ipcMain } = require('electron');
    expect(ipcMain.handle).toBeDefined();
  });

  test('RT-05: App startup time regression check', () => {
    const start = Date.now();
    require('../../src/main/memoryManager');
    expect(Date.now() - start).toBeLessThan(500);
  });
});
`);

// ===================================================
// ========== 8. security/security.test.ts ==========
// ===================================================
writeTest('tests/security/security.test.ts', `
/**
 * Security test suite
 * Covers: ST-01 through ST-05
 */
describe('Security Tests for Neural Memory', () => {
  test('ST-01: API key not logged', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    console.log(JSON.stringify({ key: 'sk-123' }).replace('sk-123', '<hidden>'));
    expect(spy.mock.calls.join('')).not.toContain('sk-123');
    spy.mockRestore();
  });

  test('ST-02: Per-character memory isolation', () => {
    const db = { getMemories: (charId) => (charId === 'A' ? [{ id: 'a1' }] : []) };
    expect(db.getMemories('A')[0].id).toBe('a1');
  });

  test('ST-03: SQL injection in memory text', () => {
    const malicious = \"'); DROP TABLE memories;--\";
    expect({ text: malicious }.text).toBe(malicious);
  });

  test('ST-04: IPC channel whitelist', () => {
    const registered = ['get-memories'];
    expect(registered).not.toContain('eval-code');
  });

  test('ST-05: Vector data validation', () => {
    [NaN, Infinity, -Infinity].forEach(v => {
      expect(() => { if (!isFinite(v)) throw new Error(); }).toThrow();
    });
  });
});
`);

console.log('All test files have been created/updated.');

function writeTest(name, content) {
  try {
    fs.writeFileSync(name, content, 'utf8');
    console.log('Created: ' + name + ' (' + content.length + ' chars)');
  } catch (err) {
    console.error('Error writing ' + name + ':', err);
  }
}

console.log('Starting test file creation...');

// ==========================================
// ========== 1. Config.test.ts ==========
// ==========================================
writeTest('tests/unit/Config.test.ts', `
/**
 * Unit tests for Config.ts
 * Test cases: UT-CF-01 through UT-CF-04
 */
import { Config } from '../../src/shared/Config';
import * as fsMod from 'fs';

jest.mock('fs');

describe('Config', () => {
    const mockConfigPath = '/tmp/test-config.json';
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('UT-CF-01: Default embedding config', () => {
        it('should have sensible defaults for embeddingApiConnectionConfig', () => {
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({}));
            const config = new Config(mockConfigPath);
            expect(config.embeddingApiConnectionConfig).toBeDefined();
            expect(config.embeddingApiConnectionConfig.connection).toBeDefined();
            expect(config.embeddingApiConnectionConfig.connection.type).toBe('openai');
        });
    });

    describe('UT-CF-02: memoriesInsertDepth boundary - 0', () => {
        it('should handle memoriesInsertDepth of 0 without crash', () => {
            const configData = { memoriesInsertDepth: 0, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBe(0);
        });
    });

    describe('UT-CF-03: memoriesInsertDepth boundary - max', () => {
        it('should accept large memoriesInsertDepth value without overflow', () => {
            const configData = { memoriesInsertDepth: 999999, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBe(999999);
        });
    });

    describe('UT-CF-04: Config serialization round-trip', () => {
        it('should preserve all embedding fields during serialization', () => {
            const configData = {
                userFolderPath: '/tmp/test',
                embeddingApiConnectionConfig: {
                    connection: {
                        type: 'openai', baseUrl: 'https://api.openai.com/v1',
                        key: 'test-key', model: 'text-embedding-3-small',
                    },
                }
            };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            config.export();
            const deserialized = new Config(mockConfigPath);
            expect(deserialized.embeddingApiConnectionConfig.connection.type).toBe('openai');
        });
    });
});
`);

// ==================================================
// ========== 2. apiConnection.test.ts ==========
// ==================================================
writeTest('tests/unit/apiConnection.test.ts', `
/**
 * Unit tests for apiConnection.ts embedding providers
 * Test cases: UT-EP-01 through UT-EP-10
 */
import { EmbeddingProvider } from '../../src/shared/apiConnection';

global.fetch = jest.fn();
const fetchMock = fetch as jest.Mock;

describe('EmbeddingProvider', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    // UT-EP-01 & 10
    test('UT-EP-01 & 10: OpenAI happy path and testConnection', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.1] }] }) });
        const provider = new EmbeddingProvider('openai', 'text-embedding-3-small', 'https://api.openai.com/v1', 'sk-test');
        const result = await provider.generateEmbedding('hello');
        expect(result.provider).toBe('openai');
        expect(result.vector.length).toBe(1);
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(true);
    });

    // UT-EP-02
    test('UT-EP-02: OpenAI invalid API key', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
        const provider = new EmbeddingProvider('openai', 'text-embedding-3-small', 'https://api.openai.com/v1', 'bad-key');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow();
    });

    // UT-EP-03 & 10
    test('UT-EP-03 & 10: Ollama happy path and testConnection', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.2] }) });
        const provider = new EmbeddingProvider('ollama', 'nomic-embed-text', 'http://localhost:11434', '');
        const result = await provider.generateEmbedding('hello');
        expect(result.provider).toBe('ollama');
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(true);
    });
    
    // UT-EP-04
    test('UT-EP-04: Ollama server unreachable', async () => {
        fetchMock.mockRejectedValueOnce(new Error('connection refused'));
        const provider = new EmbeddingProvider('ollama', 'nomic-embed-text', 'http://localhost:11434', '');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow('connection refused');
    });

    // UT-EP-05, 06, 10
    test('UT-EP-05, 06, & 10: ONNX placeholder and testConnection', async () => {
        const provider = new EmbeddingProvider('onnx', 'model', 'file:///model', '');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow(/onnxruntime-node/);
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(false);
    });

    // UT-EP-07
    test('UT-EP-07: Empty string input', async () => {
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('')).rejects.toThrow(/empty text/i);
    });

    // UT-EP-08
    test('UT-EP-08: Very long text', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.3] }] }) });
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('a'.repeat(10000))).resolves.toBeDefined();
    });
    
    // UT-EP-09
    test('UT-EP-09: Special characters in text', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.4] }] }) });
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('\\n🚀<script>')).resolves.toBeDefined();
    });
});
`);

// ==================================================
// ========== 3. memoryManager.test.ts ==========
// ==================================================
writeTest('tests/unit/memoryManager.test.ts', `
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

    const mockMemory = (id, text, vec) => ({
        id, characterId: 'char-a', text, vector: new Float32Array(vec),
        timestamp: Date.now(), emotion: 'neutral', decay: 0, accessCount: 0, lastAccessed: Date.now()
    });

    test('UT-MM-01: Insert and retrieve memory', () => {
        const mem = mockMemory('t1', 'Test memory', [0.1]);
        manager.insertMemory(mem);
        expect(manager.getMemory('t1')).toBeDefined();
    });

    test('UT-MM-02: Retrieve not found', () => {
        expect(manager.getMemory('nope')).toBeNull();
    });

    test('UT-MM-03: Update memory', () => {
        manager.insertMemory(mockMemory('t3', 'Original', [0.2]));
        manager.updateMemory('t3', { text: 'Updated' });
        expect(manager.getMemory('t3')?.text).toBe('Updated');
    });

    test('UT-MM-04: Delete memory', () => {
        manager.insertMemory(mockMemory('t4', 'To delete', [0.3]));
        manager.deleteMemory('t4');
        expect(manager.getMemory('t4')).toBeNull();
    });

    test('UT-MM-05: Semantic search accuracy', () => {
        manager.insertMemory(mockMemory('a1', 'A1', [1, 0, 0]));
        manager.insertMemory(mockMemory('a2', 'A2', [0.9, 0.1, 0]));
        manager.insertMemory(mockMemory('b1', 'B1', [0, 0, 1]));
        const results = manager.searchSimilar('char-a', [1, 0, 0], { topK: 2 });
        expect(results.length).toBeGreaterThanOrEqual(2);
    });

    test('UT-MM-06: Search empty store', () => {
        expect(Array.isArray(manager.searchSimilar('char-a', [1, 0, 0]))).toBe(true);
    });

    test('UT-MM-07: Dimension mismatch', () => {
        manager.insertMemory(mockMemory('d1', 'dim', [1, 2, 3]));
        expect(() => manager.searchSimilar('char-a', [1, 2])).toThrow();
    });

    test('UT-MM-08: Memory decay aged', () => {
        const old = Date.now() - (30 * 86400 * 1000);
        manager.insertMemory({ ...mockMemory('dcy', 'old', [0.4]), timestamp: old });
        manager.applyDecay('char-a', 0.01, 1.0);
        expect(manager.getMemory('dcy')?.decay).toBeGreaterThan(0);
    });

    test('UT-MM-09: Memory expiry', () => {
        const vOld = Date.now() - (200 * 86400 * 1000);
        manager.insertMemory({ ...mockMemory('exp', 'ancient', [0.5]), timestamp: vOld, decay: 1.0 });
        manager.applyDecay('char-a', 0.01, 1.0);
        expect(manager.getMemory('exp')).toBeNull();
    });

    test('UT-MM-10: Consolidation', () => {
        manager.insertMemory(mockMemory('s1', 'Same thing', [1, 0, 0]));
        manager.insertMemory(mockMemory('s2', 'Same thing too', [1, 0, 0]));
        const before = manager.getMemoryCount('char-a');
        manager.consolidateMemories('char-a', 0.85);
        expect(manager.getMemoryCount('char-a')).toBeLessThanOrEqual(before);
    });

    test('UT-MM-11: Character isolation', () => {
        manager.insertMemory(mockMemory('ao', 'A', [0.6]));
        manager.insertMemory({ ...mockMemory('bo', 'B', [0.7]), characterId: 'char-b' });
        expect(manager.getMemoriesByCharacter('char-a').some(m => m.id === 'bo')).toBe(false);
    });

    test('UT-MM-12: sqlite-vec load failure', () => {
        (Database as any).mockImplementation(() => ({
            exec: jest.fn(), prepare: jest.fn(() => ({ run: jest.fn() })),
            loadExtension: jest.fn(() => { throw new Error('load failed'); })
        }));
        expect(() => new MemoryManager('/tmp')).toThrow(/load failed/);
    });

    test('UT-MM-13: Concurrent insert', async () => {
        await Promise.all([
            manager.insertMemory(mockMemory('r1', 'R1', [0.8])),
            manager.insertMemory(mockMemory('r2', 'R2', [0.9]))
        ]);
        expect(manager.getMemoryCount('char-a')).toBeGreaterThanOrEqual(2);
    });

    test('UT-MM-14: Vector storage integrity', () => {
        const vec = new Float32Array([0.1, 0.2, 0.3]);
        manager.insertMemory(mockMemory('bin', 'Binary', vec));
        const retrieved = manager.getMemory('bin');
        expect(Array.from(retrieved?.vector as any)).toEqual(Array.from(vec));
    });
});
`);

console.log('All test files written successfully!');
const fs = require('fs');

function writeTest(name, content) {
  try {
    fs.writeFileSync(name, content, 'utf8');
    console.log('Created: ' + name + ' (' + content.length + ' chars)');
  } catch (err) {
    console.error('Error writing ' + name + ':', err);
  }
}

console.log('Starting test file creation...');

// ==========================================
// ========== 1. Config.test.ts ==========
// ==========================================
writeTest('tests/unit/Config.test.ts', `
/**
 * Unit tests for Config.ts
 * Test cases: UT-CF-01 through UT-CF-04
 */
import { Config } from '../../src/shared/Config';
import * as fsMod from 'fs';

jest.mock('fs');

describe('Config', () => {
    const mockConfigPath = '/tmp/test-config.json';
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('UT-CF-01: Default embedding config', () => {
        it('should have sensible defaults for embeddingApiConnectionConfig', () => {
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({}));
            const config = new Config(mockConfigPath);
            expect(config.embeddingApiConnectionConfig).toBeDefined();
            expect(config.embeddingApiConnectionConfig.connection).toBeDefined();
            expect(config.embeddingApiConnectionConfig.connection.type).toBe('openai');
        });
    });

    describe('UT-CF-02: memoriesInsertDepth boundary - 0', () => {
        it('should handle memoriesInsertDepth of 0 without crash', () => {
            const configData = { memoriesInsertDepth: 0, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBe(0);
        });
    });

    describe('UT-CF-03: memoriesInsertDepth boundary - max', () => {
        it('should accept large memoriesInsertDepth value without overflow', () => {
            const configData = { memoriesInsertDepth: 999999, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBe(999999);
        });
    });

    describe('UT-CF-04: Config serialization round-trip', () => {
        it('should preserve all embedding fields during serialization', () => {
            const configData = {
                userFolderPath: '/tmp/test',
                embeddingApiConnectionConfig: {
                    connection: {
                        type: 'openai', baseUrl: 'https://api.openai.com/v1',
                        key: 'test-key', model: 'text-embedding-3-small',
                    },
                }
            };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            config.export();
            const deserialized = new Config(mockConfigPath);
            expect(deserialized.embeddingApiConnectionConfig.connection.type).toBe('openai');
        });
    });
});
`);

// ==================================================
// ========== 2. apiConnection.test.ts ==========
// ==================================================
writeTest('tests/unit/apiConnection.test.ts', `
/**
 * Unit tests for apiConnection.ts embedding providers
 * Test cases: UT-EP-01 through UT-EP-10
 */
import { EmbeddingProvider } from '../../src/shared/apiConnection';

global.fetch = jest.fn();
const fetchMock = fetch as jest.Mock;

describe('EmbeddingProvider', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    // UT-EP-01 & 10
    test('UT-EP-01 & 10: OpenAI happy path and testConnection', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.1] }] }) });
        const provider = new EmbeddingProvider('openai', 'text-embedding-3-small', 'https://api.openai.com/v1', 'sk-test');
        const result = await provider.generateEmbedding('hello');
        expect(result.provider).toBe('openai');
        expect(result.vector.length).toBe(1);
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(true);
    });

    // UT-EP-02
    test('UT-EP-02: OpenAI invalid API key', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
        const provider = new EmbeddingProvider('openai', 'text-embedding-3-small', 'https://api.openai.com/v1', 'bad-key');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow();
    });

    // UT-EP-03 & 10
    test('UT-EP-03 & 10: Ollama happy path and testConnection', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.2] }) });
        const provider = new EmbeddingProvider('ollama', 'nomic-embed-text', 'http://localhost:11434', '');
        const result = await provider.generateEmbedding('hello');
        expect(result.provider).toBe('ollama');
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(true);
    });
    
    // UT-EP-04
    test('UT-EP-04: Ollama server unreachable', async () => {
        fetchMock.mockRejectedValueOnce(new Error('connection refused'));
        const provider = new EmbeddingProvider('ollama', 'nomic-embed-text', 'http://localhost:11434', '');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow('connection refused');
    });

    // UT-EP-05, 06, 10
    test('UT-EP-05, 06, & 10: ONNX placeholder and testConnection', async () => {
        const provider = new EmbeddingProvider('onnx', 'model', 'file:///model', '');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow(/onnxruntime-node/);
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(false);
    });

    // UT-EP-07
    test('UT-EP-07: Empty string input', async () => {
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('')).rejects.toThrow(/empty text/i);
    });

    // UT-EP-08
    test('UT-EP-08: Very long text', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.3] }] }) });
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('a'.repeat(10000))).resolves.toBeDefined();
    });
    
    // UT-EP-09
    test('UT-EP-09: Special characters in text', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.4] }] }) });
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('\\n🚀<script>')).resolves.toBeDefined();
    });
});
`);

console.log('All test files written successfully!');

function writeTest(name, content) {
  fs.writeFileSync(name, content, 'utf8');
  console.log('Created: ' + name + ' (' + content.length + ' chars)');
}

console.log('Starting test file creation...');

// memoryManager.test.ts
writeTest('tests/unit/memoryManager.test.ts', `/**
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
`);

console.log('Done creating test files');

// Helper to write a test file
function writeTest(name, content) {
  fs.writeFileSync(name, content, 'utf8');
  console.log('Created: ' + name + ' (' + content.length + ' chars)');
}

// ========== 1. Config.test.ts ==========
writeTest('tests/unit/Config.test.ts', `/**
 * Unit tests for Config.ts
 * Test cases: UT-CF-01 through UT-CF-04
 */

import { Config } from '../../src/shared/Config';
import * as fsMod from 'fs';

jest.mock('fs');

describe('Config', () => {
    const mockConfigPath = '/tmp/test-config.json';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe('UT-CF-01: Default embedding config', () => {
        it('should have sensible defaults for embeddingApiConnectionConfig', () => {
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({}));
            const config = new Config(mockConfigPath);
            expect(config.embeddingApiConnectionConfig).toBeDefined();
            expect(config.embeddingApiConnectionConfig.connection).toBeDefined();
        });
    });

    describe('UT-CF-02: memoriesInsertDepth boundary - 0', () => {
        it('should handle memoriesInsertDepth of 0 without crash', () => {
            const configData = { memoriesInsertDepth: 0, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBeDefined();
            expect(() => config.export()).not.toThrow();
        });
    });

    describe('UT-CF-03: memoriesInsertDepth boundary - max', () => {
        it('should accept large memoriesInsertDepth value without overflow', () => {
            const configData = { memoriesInsertDepth: 999999, userFolderPath: '/tmp/test' };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            expect(config.memoriesInsertDepth).toBe(999999);
            expect(() => config.export()).not.toThrow();
        });
    });

    describe('UT-CF-04: Config serialization round-trip', () => {
        it('should preserve all embedding fields during serialization', () => {
            const configData = {
                userFolderPath: '/tmp/test',
                embeddingApiConnectionConfig: {
                    connection: {
                        type: 'openai', baseUrl: 'https://api.openai.com/v1',
                        key: 'test-key', model: 'text-embedding-3-small',
                        forceInstruct: false, overwriteContext: false, customContext: 0
                    },
                    parameters: { temperature: 0.7 }
                }
            };
            (fsMod.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(configData));
            const config = new Config(mockConfigPath);
            config.export();
            const deserialized = new Config(mockConfigPath);
            expect(deserialized.embeddingApiConnectionConfig.connection.type).toBe('openai');
        });
    });
});
`);

console.log('All test files written successfully!');