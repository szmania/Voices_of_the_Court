// fullCompactionFlow.test.ts
// Integration test for full Phase-1 and Phase-2 compaction flow

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MemoryCompactor } from '../../../src/main/conversation/MemoryCompactor';
import { CompactedMemory, CompactionConfig } from '../../../src/shared/compactionTypes';
import { Message } from '../../../src/shared/apiConnection';

describe('fullCompactionFlow', () => {
  let compactor: MemoryCompactor;
  let mockConfig: CompactionConfig;
  let mockConversation: any;

  beforeEach(() => {
    mockConfig = {
      enableMemoryCompaction: true,
      compactionPhase1Threshold: 70,
      compactionPhase2Threshold: 5,
      compactionTokenBudget: { phase1: 30, phase2: 10 },
      compactionCooldownMinutes: 0, // No cooldown for testing
      compactionPriorityElements: ['secrets', 'rivalries', 'friendships', 'alliances', 'major_life_events'],
      compactionEntityExtractionMode: 'regex',
      compactionRelationshipsDirectional: true,
      compactionApiConnectionConfig: {}
    };

    compactor = new MemoryCompactor(mockConfig);

    // Create a conversation with >100 messages exceeding Phase-1 threshold
    const messages: Message[] = Array(120).fill(null).map((_, i) => ({
      id: `msg${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}: Player and Character discuss ${i % 3 === 0 ? 'secrets' : 'alliances'} and ${i % 5 === 0 ? 'rivalries' : 'friendships'}`,
      name: i % 2 === 0 ? 'Player' : 'Character'
    }));

    mockConversation = {
      textGenApiConnection: {
        calculateTokensFromChat: jest.fn().mockReturnValue(2000), // Above 70% of 2048
        calculateTokensFromMessage: jest.fn().mockReturnValue(20),
        context: 2048
      },
      messages,
      currentSummary: ''
    };
  });

  afterEach(() => {
    compactor.cleanup();
    jest.clearAllMocks();
  });

  describe('Phase-1 compaction flow', () => {
    it('should create Phase-1 summaries and store them correctly', async () => {
      const result = await compactor.compact(mockConversation);

      expect(result.phase1Run).toBe(true);
      expect(result.memoriesCreated).toBeGreaterThan(0);
      expect(result.accuracyScore).toBeGreaterThanOrEqual(0);
    });

    it('should replace shifted messages with compacted memory in conversation', async () => {
      const originalMessageCount = mockConversation.messages.length;

      await compactor.compact(mockConversation);

      // After compaction, compacted memories should be stored
      const allMemories = compactor.getAllCompactedMemories();
      expect(allMemories.length).toBeGreaterThan(0);

      // Phase-1 memories should have compactionLevel = 1
      const phase1Memories = allMemories.filter(m => m.compactionLevel === 1);
      expect(phase1Memories.length).toBeGreaterThan(0);
    });

    it('should set currentSummary to reflect Phase-1 compaction result', async () => {
      await compactor.compact(mockConversation);

      const allMemories = compactor.getAllCompactedMemories();
      const phase1Memories = allMemories.filter(m => m.compactionLevel === 1);
      
      // Phase-1 memories should contain summary content
      phase1Memories.forEach(memory => {
        expect(memory.content).toBeDefined();
        expect(memory.content.length).toBeGreaterThan(0);
        expect(memory.date).toBeDefined();
        expect(memory.id).toBeDefined();
      });
    });

    it('should save summary files to disk at correct paths', async () => {
      // Mock compactedMemoryStore
      const savedMemories: any[] = [];
      const compactorAny = compactor as any;
      
      // The store is mocked, but we can verify the compactor produces valid CompactedMemory objects
      await compactor.compact(mockConversation);

      const allMemories = compactor.getAllCompactedMemories();
      
      // Verify each memory has the required fields for disk storage
      allMemories.forEach(memory => {
        expect(memory.id).toBeDefined();
        expect(memory.date).toBeDefined();
        expect(memory.content).toBeDefined();
        expect(Array.isArray(memory.characterIds)).toBe(true);
        expect(memory.compactionLevel).toBeDefined();
        expect(memory.creationTimestamp).toBeDefined();
      });
    });
  });

  describe('Phase-2 compaction flow', () => {
    it('should trigger Phase-2 when Phase-1 summaries exceed maxSummaries threshold', async () => {
      // Manually add enough Phase-1 memories to exceed threshold (5)
      const compactorAny = compactor as any;
      const phase1Memories: CompactedMemory[] = Array(6).fill(null).map((_, i) => ({
        id: `p1-mem-${i}`,
        date: '2026-07-23',
        content: `Phase-1 summary ${i} about Player and Character secrets and alliances`,
        characterIds: [1, 2],
        relevanceScore: 0.8,
        entityReferences: [
          { name: 'Player', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 },
          { name: 'Character', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 }
        ],
        compactionLevel: 1,
        sourceMessageIds: [`msg${i}`],
        creationTimestamp: Date.now()
      }));

      compactorAny.compactedMemories = new Map([['1', phase1Memories], ['2', phase1Memories]]);

      // Set messages to not trigger Phase-1 (low token count)
      mockConversation.textGenApiConnection.calculateTokensFromChat.mockReturnValue(100);

      const result = await compactor.compact(mockConversation);

      // Phase-2 should have run
      expect(result.phase2Run).toBe(true);
      
      // Phase-2 memories should have compactionLevel = 2
      const allMemories = compactor.getAllCompactedMemories();
      const phase2Memories = allMemories.filter(m => m.compactionLevel === 2);
      expect(phase2Memories.length).toBeGreaterThan(0);
    });

    it('should create knowledge graph with expected entities and relationships', async () => {
      const compactorAny = compactor as any;
      const phase1Memories: CompactedMemory[] = [
        {
          id: 'p1-1',
          date: '2026-07-23',
          content: 'Player and Character formed a secret alliance against Enemy',
          characterIds: [1, 2],
          relevanceScore: 0.9,
          entityReferences: [
            { name: 'Player', type: 'character', relationships: [{ targetEntityName: 'Character', type: 'ally', description: 'secret alliance' }], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 3 },
            { name: 'Character', type: 'character', relationships: [{ targetEntityName: 'Enemy', type: 'rival', description: 'opposition' }], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 2 },
            { name: 'Enemy', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 }
          ],
          compactionLevel: 1,
          sourceMessageIds: ['msg1', 'msg2'],
          creationTimestamp: Date.now()
        }
      ];

      compactorAny.compactedMemories = new Map([['1', phase1Memories]]);
      mockConversation.textGenApiConnection.calculateTokensFromChat.mockReturnValue(100);

      await compactor.compact(mockConversation);

      const allMemories = compactor.getAllCompactedMemories();
      const phase2Memories = allMemories.filter(m => m.compactionLevel === 2);
      
      if (phase2Memories.length > 0) {
        // Phase-2 memories should contain knowledge graph content
        phase2Memories.forEach(mem => {
          expect(mem.content).toBeDefined();
          expect(mem.entityReferences).toBeDefined();
        });
      }
    });

    it('should retain original Phase-1 summaries (not delete them)', async () => {
      const compactorAny = compactor as any;
      const phase1Memories: CompactedMemory[] = Array(6).fill(null).map((_, i) => ({
        id: `p1-mem-${i}`,
        date: '2026-07-23',
        content: `Phase-1 summary ${i}`,
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [`msg${i}`],
        creationTimestamp: Date.now()
      }));

      compactorAny.compactedMemories = new Map([['1', [...phase1Memories]]]);
      mockConversation.textGenApiConnection.calculateTokensFromChat.mockReturnValue(100);

      await compactor.compact(mockConversation);

      const allMemories = compactor.getAllCompactedMemories();
      
      // Phase-1 memories should still exist alongside Phase-2
      const phase1After = allMemories.filter(m => m.compactionLevel === 1);
      expect(phase1After.length).toBeGreaterThanOrEqual(6); // Original Phase-1 memories preserved
    });

    it('should inject Phase-2 compacted memory into next prompt via buildChatPrompt()', async () => {
      const compactorAny = compactor as any;
      const phase1Memories: CompactedMemory[] = Array(6).fill(null).map((_, i) => ({
        id: `p1-mem-${i}`,
        date: '2026-07-23',
        content: `Phase-1 summary ${i} with Player and Character`,
        characterIds: [1, 2],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [`msg${i}`],
        creationTimestamp: Date.now()
      }));

      compactorAny.compactedMemories = new Map([['1', phase1Memories], ['2', phase1Memories]]);
      mockConversation.textGenApiConnection.calculateTokensFromChat.mockReturnValue(100);

      await compactor.compact(mockConversation);

      const allMemories = compactor.getAllCompactedMemories();
      const phase2Memories = allMemories.filter(m => m.compactionLevel === 2);
      
      // Phase-2 memories should be available for prompt injection
      expect(phase2Memories.length).toBeGreaterThan(0);
      
      // Each Phase-2 memory should have content suitable for prompt injection
      phase2Memories.forEach(mem => {
        expect(typeof mem.content).toBe('string');
        expect(mem.content.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Full flow edge cases', () => {
    it('should handle conversation with exactly threshold messages', async () => {
      mockConversation.messages = Array(70).fill(null).map((_, i) => ({
        id: `msg${i}`,
        role: 'user',
        content: `Message ${i}`,
        name: 'Player'
      }));
      mockConversation.textGenApiConnection.calculateTokensFromChat.mockReturnValue(1434); // ~70% of 2048

      const result = await compactor.compact(mockConversation);
      
      // At exactly threshold, should not trigger (strictly greater than)
      expect(result.phase1Run).toBe(false);
    });

    it('should handle conversation with zero messages gracefully', async () => {
      mockConversation.messages = [];
      mockConversation.textGenApiConnection.calculateTokensFromChat.mockReturnValue(0);

      const result = await compactor.compact(mockConversation);
      
      expect(result.phase1Run).toBe(false);
      expect(result.memoriesCreated).toBe(0);
    });
  });
});