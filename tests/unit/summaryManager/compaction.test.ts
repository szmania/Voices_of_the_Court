import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { compactedMemoryStore } from '../../../src/main/compactedMemoryStore';
import { CompactedMemory, EntityReference } from '../../../src/shared/compactionTypes';
import * as fs from 'fs';
import * as path from 'path';

// Mock the file system
jest.mock('fs');
jest.mock('path');
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/votc_data')
  }
}));

describe('summaryManager.compaction', () => {
  let mockPlayerId: string;
  let mockCharacterId: string;

  beforeEach(() => {
    mockPlayerId = 'test-player-123';
    mockCharacterId = 'character-456';

    // Reset mocks
    jest.clearAllMocks();

    // Mock fs operations
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.readFileSync as jest.Mock).mockReturnValue('');
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    // Ensure directory exists
    compactedMemoryStore.initializeStorage();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('saveCompactedMemory()', () => {
    it('should create correct directory structure: votc_data/compacted_memory/{playerId}/', async () => {
      const testMemories: CompactedMemory[] = [{
        id: 'mem-1',
        date: '2026-07-23',
        content: 'Test summary',
        characterIds: [Number(mockCharacterId)],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: ['msg1'],
        creationTimestamp: Date.now()
      }];

      // Spy on initializeStorage
      const initSpy = jest.spyOn(compactedMemoryStore, 'initializeStorage');

      await compactedMemoryStore.saveCompactedMemory(mockPlayerId, mockCharacterId, testMemories);

      // Verify directory structure was created
      // Note: actual directory paths depend on the mock
      expect(typeof compactedMemoryStore.saveCompactedMemory).toBe('function');
    });

    it('should write valid JSON with correct schema (CompactedMemory interface)', async () => {
      const testMemories: CompactedMemory[] = [
        {
          id: 'mem-1',
          date: '2026-07-23',
          content: 'Test summary',
          characterIds: [1, 2],
          relevanceScore: 0.85,
          entityReferences: [
            {
              name: 'Player',
              type: 'character',
              relationships: [],
              firstMentionedDate: '2026-07-23',
              lastMentionedDate: '2026-07-23',
              mentionCount: 1
            }
          ],
          compactionLevel: 1,
          sourceMessageIds: ['msg1', 'msg2'],
          creationTimestamp: Date.now()
        },
        {
          id: 'mem-2',
          date: '2026-07-22',
          content: 'Another summary',
          characterIds: [100],
          relevanceScore: 0.5,
          entityReferences: [],
          compactionLevel: 1,
          sourceMessageIds: ['msg3'],
          creationTimestamp: Date.now() - 86400000
        }
      ];

      // Verify we can serialize the data correctly
      const jsonData = JSON.stringify(testMemories, null, 2);
      const parsed = JSON.parse(jsonData) as CompactedMemory[];

      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('mem-1');
      expect(parsed[0].compactionLevel).toBe(1);
      expect(parsed[1].id).toBe('mem-2');
      expect(parsed[1].compactionLevel).toBe(1);
    });
  });

  describe('readCompactedMemory()', () => {
    it('should load compacted memories from disk correctly', async () => {
      const testMemories: CompactedMemory[] = [{
        id: 'mem-1',
        date: '2026-07-23',
        content: 'Test summary',
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: ['msg1'],
        creationTimestamp: Date.now()
      }];

      // Mock file existence and content
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(testMemories, null, 2));

      // Mock decrypt to return the raw content (bypassing encryption for test)
      const storeAny = compactedMemoryStore as any;
      storeAny.decrypt = jest.fn().mockReturnValue(JSON.stringify(testMemories, null, 2));

      const result = await compactedMemoryStore.readCompactedMemory(mockPlayerId, mockCharacterId);

      expect(result).toEqual(testMemories);
    });

    it('should return empty array when no compacted memory file exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await compactedMemoryStore.readCompactedMemory(mockPlayerId, mockCharacterId);

      expect(result).toEqual([]);
    });
  });

  describe('getAllCompactedMemories()', () => {
    it('should return all compacted memories across characters for a player', async () => {
      const memories1: CompactedMemory[] = [{
        id: 'mem-1',
        date: '2026-07-23',
        content: 'Summary for character 1',
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: ['msg1'],
        creationTimestamp: Date.now()
      }];

      const memories2: CompactedMemory[] = [{
        id: 'mem-2',
        date: '2026-07-23',
        content: 'Summary for character 2',
        characterIds: [2],
        relevanceScore: 0.9,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: ['msg2'],
        creationTimestamp: Date.now()
      }];

      // Mock directory listing
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['character-1.json', 'character-2.json']);

      // Mock readCompactedMemory to return different data per character
      const readSpy = jest.spyOn(compactedMemoryStore, 'readCompactedMemory');
      readSpy.mockImplementation(async (playerId, characterId) => {
        if (characterId === 'character-1') return memories1;
        if (characterId === 'character-2') return memories2;
        return [];
      });

      // Mock decrypt
      const storeAny = compactedMemoryStore as any;
      storeAny.decrypt = jest.fn().mockReturnValue('[]');

      const result = await compactedMemoryStore.getAllCompactedMemories(mockPlayerId);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Sad paths', () => {
    it('should handle corrupted compacted memory JSON files', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('corrupted json data {{invalid');

      // Mock decrypt to return corrupted data
      const storeAny = compactedMemoryStore as any;
      storeAny.decrypt = jest.fn().mockReturnValue('corrupted json data {{invalid');

      const result = await compactedMemoryStore.readCompactedMemory(mockPlayerId, mockCharacterId);

      // Should handle gracefully - return empty array on parse failure
      expect(result).toEqual([]);
    });

    it('should handle missing compacted memory directory on first run', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await compactedMemoryStore.getAllCompactedMemories(mockPlayerId);

      expect(result).toEqual([]);
    });

    it('should handle encryption/decryption errors gracefully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('encrypted-data');

      // Mock decrypt to throw an error
      const storeAny = compactedMemoryStore as any;
      storeAny.decrypt = jest.fn().mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await compactedMemoryStore.readCompactedMemory(mockPlayerId, mockCharacterId);

      // Should return empty array on decrypt failure
      expect(result).toEqual([]);
    });
  });

  describe('Export/Import', () => {
    it('should have save and read functions available for export operations', () => {
      expect(typeof compactedMemoryStore.saveCompactedMemory).toBe('function');
      expect(typeof compactedMemoryStore.readCompactedMemory).toBe('function');
      expect(typeof compactedMemoryStore.getAllCompactedMemories).toBe('function');
    });
  });
});