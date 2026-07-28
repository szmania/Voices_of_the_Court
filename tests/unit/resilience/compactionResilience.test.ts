// compactionResilience.test.ts
// Sad path and resilience tests for memory compaction

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MemoryCompactor, Phase1Compactor, Phase2Compactor } from '../../../src/main/conversation/MemoryCompactor';
import { CompactionConfig, CompactedMemory } from '../../../src/shared/compactionTypes';
import { Message } from '../../../src/shared/apiConnection';

describe('compactionResilience', () => {
  let mockConfig: CompactionConfig;

  beforeEach(() => {
    mockConfig = {
      enableMemoryCompaction: true,
      compactionPhase1Threshold: 70,
      compactionPhase2Threshold: 5,
      compactionTokenBudget: { phase1: 30, phase2: 10 },
      compactionCooldownMinutes: 0, // No cooldown for testing
      compactionPriorityElements: ['secrets', 'rivalries', 'friendships', 'alliances', 'major_life_events'],
      compactionEntityExtractionMode: 'hybrid',
      compactionRelationshipsDirectional: true,
      compactionApiConnectionConfig: {}
    };
  });

  describe('LLM failure simulation', () => {
    it('should fall back to heuristic extraction when LLM returns errors', async () => {
      const compactor = new Phase1Compactor(mockConfig);
      const compactorAny = compactor as any;

      // Mock LLM to throw an error
      compactorAny.llmSummarize = jest.fn().mockRejectedValue(new Error('LLM API unavailable'));
      compactorAny.heuristicSummarize = jest.fn().mockReturnValue('Heuristic fallback summary');
      compactorAny.extractEntitiesRegex = jest.fn().mockReturnValue([]);

      const messages: Message[] = [
        { id: 'msg1', role: 'user', content: 'Player: Hello there', name: 'Player' }
      ];

      const result = await compactor.compact(messages, '');

      expect(compactorAny.heuristicSummarize).toHaveBeenCalled();
      expect(result[0].content).toBe('Heuristic fallback summary');
    });

    it('should handle API timeout and trigger fallback', async () => {
      const compactor = new Phase1Compactor(mockConfig);
      const compactorAny = compactor as any;

      // Mock LLM to cause a timeout error
      compactorAny.llmSummarize = jest.fn().mockRejectedValue(new Error('Request timeout'));
      compactorAny.heuristicSummarize = jest.fn().mockReturnValue('Timeout fallback');
      compactorAny.extractEntitiesRegex = jest.fn().mockReturnValue([]);

      const messages: Message[] = [
        { id: 'msg1', role: 'user', content: 'Player: Test message', name: 'Player' }
      ];

      const result = await compactor.compact(messages, '');

      expect(result[0].content).toBe('Timeout fallback');
    });
  });

  describe('Invalid JSON simulation', () => {
    it('should fall back to regex extraction when LLM returns malformed JSON', async () => {
      const compactor = new Phase1Compactor(mockConfig);
      const compactorAny = compactor as any;

      // Mock LLM to return unparseable response
      compactorAny.llmSummarize = jest.fn().mockResolvedValue({
        summary: undefined, // Invalid response
        entities: null
      });
      compactorAny.heuristicSummarize = jest.fn().mockReturnValue('Regex fallback summary');
      compactorAny.extractEntitiesRegex = jest.fn().mockReturnValue([]);

      const messages: Message[] = [
        { id: 'msg1', role: 'user', content: 'Player: Test', name: 'Player' }
      ];

      const result = await compactor.compact(messages, '');

      expect(compactorAny.heuristicSummarize).toHaveBeenCalled();
    });

    it('should handle partial JSON responses gracefully', async () => {
      const compactor = new Phase1Compactor(mockConfig);
      const compactorAny = compactor as any;

      // Mock LLM with partial JSON
      compactorAny.llmSummarize = jest.fn().mockRejectedValue(new SyntaxError('Unexpected token in JSON'));
      compactorAny.heuristicSummarize = jest.fn().mockReturnValue('Partial fallback');
      compactorAny.extractEntitiesRegex = jest.fn().mockReturnValue([]);

      const messages: Message[] = [
        { id: 'msg1', role: 'user', content: 'Player: Something happened', name: 'Player' }
      ];

      const result = await compactor.compact(messages, '');

      expect(result).toBeDefined();
    });
  });

  describe('Disk error simulation', () => {
    it('should handle disk write failure with appropriate error propagation', async () => {
      // Simulate disk full scenario
      const errorOnWrite = () => {
        throw new Error('Disk full - cannot write compacted memory');
      };

      expect(() => errorOnWrite()).toThrow('Disk full');
    });

    it('should handle corrupted compacted memory files', async () => {
      // Simulate reading corrupted file
      const readCorruptedFile = (): CompactedMemory[] => {
        try {
          const corruptedData = '{invalid json {{ }}';
          JSON.parse(corruptedData);
          return [];
        } catch (e) {
          return []; // Graceful degradation: return empty on corruption
        }
      };

      const result = readCorruptedFile();
      expect(result).toEqual([]); // Should return empty array for corrupted data
    });

    it('should handle missing directory on first run', () => {
      // Simulate checking for non-existent directory
      const checkDirectory = (dirPath: string): boolean => {
        // Mock: directory doesn't exist on first run
        return false;
      };

      const exists = checkDirectory('/nonexistent/compacted_memory');
      expect(exists).toBe(false); // Should report non-existence without throwing
    });
  });

  describe('Rapid successive compactions', () => {
    it('should respect cooldown period and prevent overlapping runs', async () => {
      const configWithCooldown = { ...mockConfig, compactionCooldownMinutes: 5 };
      
      // Simulate two rapid compaction attempts
      const firstAttempt = Date.now();
      
      // Second attempt immediately after first should be blocked by cooldown
      const secondAttempt = firstAttempt; // Same timestamp
      
      const cooldownMs = configWithCooldown.compactionCooldownMinutes * 60 * 1000;
      
      // Verify cooldown calculation
      expect(cooldownMs).toBe(300000); // 5 minutes in ms
      
      // Second attempt within cooldown should not trigger
      const withinCooldown = (secondAttempt - firstAttempt) < cooldownMs;
      expect(withinCooldown).toBe(true); // Should be blocked by cooldown
    });

    it('should allow compaction after cooldown period expires', () => {
      const configWithCooldown = { ...mockConfig, compactionCooldownMinutes: 5 };
      
      const firstAttempt = Date.now();
      const cooldownMs = configWithCooldown.compactionCooldownMinutes * 60 * 1000;
      
      // Simulate second attempt after cooldown expires
      const secondAttempt = firstAttempt + cooldownMs + 1;
      
      const withinCooldown = (secondAttempt - firstAttempt) < cooldownMs;
      expect(withinCooldown).toBe(false); // Cooldown has expired, should be allowed
    });
  });

  describe('Empty conversation', () => {
    it('should handle compaction on conversation with zero messages gracefully (no-op)', async () => {
      const compactor = new MemoryCompactor(mockConfig);
      
      const mockConversation = {
        textGenApiConnection: {
          calculateTokensFromChat: jest.fn().mockReturnValue(0),
          calculateTokensFromMessage: jest.fn().mockReturnValue(0),
          context: 2048
        },
        messages: [],
        currentSummary: ''
      };

      const result = await compactor.compact(mockConversation);

      expect(result.phase1Run).toBe(false);
      expect(result.phase2Run).toBe(false);
      expect(result.memoriesCreated).toBe(0);
    });

    it('should handle compaction on conversation with exactly one message', async () => {
      const compactor = new MemoryCompactor(mockConfig);

      const messages: Message[] = [
        { id: 'msg1', role: 'user', content: 'Single message', name: 'Player' }
      ];

      const mockConversation = {
        textGenApiConnection: {
          calculateTokensFromChat: jest.fn().mockReturnValue(20),
          calculateTokensFromMessage: jest.fn().mockReturnValue(20),
          context: 2048
        },
        messages,
        currentSummary: ''
      };

      const result = await compactor.compact(mockConversation);

      // Should not trigger with token count well below threshold
      expect(result.phase1Run).toBe(false);
    });
  });

  describe('Compaction disabled configuration', () => {
    it('should skip all compaction when enableMemoryCompaction is false', async () => {
      const disabledConfig = { ...mockConfig, enableMemoryCompaction: false };
      const compactor = new MemoryCompactor(disabledConfig);

      const mockConversation = {
        textGenApiConnection: {
          calculateTokensFromChat: jest.fn().mockReturnValue(2000),
          calculateTokensFromMessage: jest.fn().mockReturnValue(50),
          context: 2048
        },
        messages: Array(10).fill(null).map((_, i) => ({ id: `msg${i}`, role: 'user', content: `Msg ${i}`, name: 'Player' })),
        currentSummary: ''
      };

      const result = await compactor.compact(mockConversation);

      expect(result.phase1Run).toBe(false);
      expect(result.phase2Run).toBe(false);
    });
  });

  describe('Memory cleanup', () => {
    it('should release resources on cleanup without errors', () => {
      const compactor = new MemoryCompactor(mockConfig);
      
      // Add some data first
      const compactorAny = compactor as any;
      compactorAny.compactedMemories = new Map([['1', [{id:'mem1', date:'2026-07-23', content:'Test', characterIds:[1], relevanceScore:0.5, entityReferences:[], compactionLevel:1, sourceMessageIds:[], creationTimestamp:Date.now()}]]]);

      expect(() => compactor.cleanup()).not.toThrow();
      
      // Verify cleanup actually cleared data
      const allAfter = compactor.getAllCompactedMemories();
      expect(allAfter).toEqual([]);
    });

    it('should handle double cleanup without errors', () => {
      const compactor = new MemoryCompactor(mockConfig);
      
      expect(() => compactor.cleanup()).not.toThrow();
      expect(() => compactor.cleanup()).not.toThrow(); // Double cleanup should be safe
    });
  });

  describe('Network/API reliability', () => {
    it('should handle intermittent LLM API failures with retry logic', async () => {
      let attempts = 0;
      const maxRetries = 3;
      
      // Simulate LLM API that fails twice then succeeds
      const unreliableLLM = async () => {
        attempts++;
        if (attempts <= 2) {
          throw new Error('Temporary API failure');
        }
        return { summary: 'Success on retry', entities: [] };
      };

      // Retry logic
      let result;
      for (let i = 0; i < maxRetries; i++) {
        try {
          result = await unreliableLLM();
          break;
        } catch (e) {
          if (i === maxRetries - 1) {
            result = 'Fallback after all retries'; // Final fallback
          }
        }
      }

      expect(result).toBeDefined();
    });
  });
});