import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MemoryCompactor } from '../../../src/main/conversation/MemoryCompactor';
import { CompactedMemory, CompactionConfig, CompactionResult } from '../../../src/shared/compactionTypes';
import { Message } from '../../../src/shared/apiConnection';

describe('MemoryCompactor', () => {
  let compactor: MemoryCompactor;
  let mockConfig: CompactionConfig;
  let mockConversation: any;

  beforeEach(() => {
    mockConfig = {
      enableMemoryCompaction: true,
      compactionPhase1Threshold: 70,
      compactionPhase2Threshold: 5,
      compactionTokenBudget: { phase1: 30, phase2: 10 },
      compactionCooldownMinutes: 5,
      compactionPriorityElements: ['secrets', 'rivalries', 'friendships', 'alliances', 'major_life_events'],
      compactionEntityExtractionMode: 'hybrid',
      compactionRelationshipsDirectional: true,
      compactionApiConnectionConfig: {}
    };

    compactor = new MemoryCompactor(mockConfig);

    mockConversation = {
      textGenApiConnection: {
        calculateTokensFromChat: jest.fn().mockReturnValue(1000),
        calculateTokensFromMessage: jest.fn().mockReturnValue(50),
        context: 2048
      },
      messages: [],
      currentSummary: ''
    };
  });

  afterEach(() => {
    compactor.cleanup();
  });

  describe('constructor', () => {
    it('should initialize all sub-components', () => {
      expect(compactor).toBeDefined();
      // Access private properties via type assertion for testing
      const compactorAny = compactor as any;
      expect(compactorAny.phase1Compactor).toBeDefined();
      expect(compactorAny.phase2Compactor).toBeDefined();
      expect(compactorAny.scheduler).toBeDefined();
      expect(compactorAny.accuracyValidator).toBeDefined();
    });

    it('should store the configuration', () => {
      const compactorAny = compactor as any;
      expect(compactorAny.config).toEqual(mockConfig);
    });
  });

  describe('initialize(config)', () => {
    it('should update configuration and reinitialize sub-components', () => {
      const newConfig: CompactionConfig = {
        ...mockConfig,
        enableMemoryCompaction: false,
        compactionPhase1Threshold: 80
      };

      compactor.initialize(newConfig);
      
      const compactorAny = compactor as any;
      expect(compactorAny.config).toEqual(newConfig);
      expect(compactorAny.phase1Compactor).toBeDefined();
      expect(compactorAny.phase2Compactor).toBeDefined();
      expect(compactorAny.scheduler).toBeDefined();
    });
  });

  describe('compact(conv)', () => {
    it('should return empty result when compaction is disabled', async () => {
      const disabledConfig = { ...mockConfig, enableMemoryCompaction: false };
      const disabledCompactor = new MemoryCompactor(disabledConfig);
      
      const result = await disabledCompactor.compact(mockConversation);
      
      expect(result).toEqual({
        phase1Run: false,
        phase2Run: false,
        memoriesCreated: 0
      });
    });

    it('should delegate to Phase1 when scheduler threshold is exceeded', async () => {
      // Set up conversation with high token count
      mockConversation.messages = [
        { id: 'msg1', role: 'user', content: 'Test message 1', name: 'Player' },
        { id: 'msg2', role: 'assistant', content: 'Test response 1', name: 'Character' }
      ];
      mockConversation.textGenApiConnection.calculateTokensFromChat.mockReturnValue(2000);

      const phase1Result: CompactedMemory[] = [{
        id: 'test-mem-1',
        date: '2026-07-23',
        content: 'Test summary',
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: ['msg1', 'msg2'],
        creationTimestamp: Date.now()
      }];

      // Mock the phase1Compactor
      const compactorAny = compactor as any;
      compactorAny.phase1Compactor.compact = jest.fn().mockResolvedValue(phase1Result);
      compactorAny.accuracyValidator.validate = jest.fn().mockReturnValue(0.95);
      compactorAny.scheduler.shouldRunPhase1 = jest.fn().mockReturnValue(true);
      compactorAny.scheduler.shouldRunPhase2 = jest.fn().mockReturnValue(false);

      const result = await compactor.compact(mockConversation);
      
      expect(result.phase1Run).toBe(true);
      expect(result.phase2Run).toBe(false);
      expect(result.memoriesCreated).toBe(1);
      expect(result.accuracyScore).toBe(0.95);
      expect(compactorAny.phase1Compactor.compact).toHaveBeenCalled();
    });

    it('should delegate to Phase2 when Phase1 summaries exceed threshold', async () => {
      const compactorAny = compactor as any;
      
      // Set up existing Phase-1 memories
      const existingMemories: CompactedMemory[] = [{
        id: 'existing-1',
        date: '2026-07-23',
        content: 'Existing summary',
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }];
      
      compactorAny.compactedMemories = new Map([['1', existingMemories]]);
      compactorAny.scheduler.shouldRunPhase1 = jest.fn().mockReturnValue(false);
      compactorAny.scheduler.shouldRunPhase2 = jest.fn().mockReturnValue(true);
      
      const mockKnowledgeGraph = {
        entities: [],
        edges: [],
        narrativeThreads: [{ id: 'thread-1', topic: 'Test', summary: 'Test summary' }],
        version: 1
      };
      
      compactorAny.phase2Compactor.compact = jest.fn().mockResolvedValue(mockKnowledgeGraph);

      const result = await compactor.compact(mockConversation);
      
      expect(result.phase1Run).toBe(false);
      expect(result.phase2Run).toBe(true);
      expect(compactorAny.phase2Compactor.compact).toHaveBeenCalled();
    });
  });

  describe('getCompactedMemories(characterId)', () => {
    it('should return correct per-character compacted memories', () => {
      const testMemories: CompactedMemory[] = [{
        id: 'mem1',
        date: '2026-07-23',
        content: 'Test memory',
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }];

      const compactorAny = compactor as any;
      compactorAny.compactedMemories = new Map([['1', testMemories]]);

      const result = compactor.getCompactedMemories('1');
      expect(result).toEqual(testMemories);
    });

    it('should return empty array for non-existent character', () => {
      const result = compactor.getCompactedMemories('999');
      expect(result).toEqual([]);
    });
  });

  describe('getAllCompactedMemories()', () => {
    it('should aggregate all characters compacted memories', () => {
      const memories1: CompactedMemory[] = [{
        id: 'mem1',
        date: '2026-07-23',
        content: 'Memory 1',
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }];

      const memories2: CompactedMemory[] = [{
        id: 'mem2',
        date: '2026-07-23',
        content: 'Memory 2',
        characterIds: [2],
        relevanceScore: 0.9,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }];

      const compactorAny = compactor as any;
      compactorAny.compactedMemories = new Map([
        ['1', memories1],
        ['2', memories2]
      ]);

      const result = compactor.getAllCompactedMemories();
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(memories1[0]);
      expect(result).toContainEqual(memories2[0]);
    });

    it('should return empty array when no memories exist', () => {
      const result = compactor.getAllCompactedMemories();
      expect(result).toEqual([]);
    });
  });

  describe('cleanup()', () => {
    it('should clear all compacted memories', () => {
      const compactorAny = compactor as any;
      compactorAny.compactedMemories = new Map([['1', []]]);
      
      compactor.cleanup();
      
      expect(compactorAny.compactedMemories.size).toBe(0);
    });

    it('should not throw when called multiple times', () => {
      expect(() => compactor.cleanup()).not.toThrow();
      expect(() => compactor.cleanup()).not.toThrow();
    });
  });
});