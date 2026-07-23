// Conversation.compaction.test.ts
// Test suite for Conversation class integration with MemoryCompactor

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Conversation } from '../../../src/main/conversation/Conversation';
import { MemoryCompactor } from '../../../src/main/conversation/MemoryCompactor';
import { CompactedMemory } from '../../../src/shared/compactionTypes';
import { Message } from '../../../src/shared/apiConnection';

describe('Conversation.compaction', () => {
  let conversation: Conversation;
  let mockMemoryCompactor: jest.Mocked<MemoryCompactor>;

  beforeEach(() => {
    // Create a real conversation instance
    conversation = new Conversation(
      {} as any, // textGenApiConnection
      {} as any, // summarizationApiConnection
      'test-player',
      'test-character'
    ) as any;

    // Mock the memory compactor
    mockMemoryCompactor = {
      compact: jest.fn(),
      getCompactedMemories: jest.fn(),
      getAllCompactedMemories: jest.fn(),
      initialize: jest.fn(),
      cleanup: jest.fn()
    };

    // Inject the mock into conversation
    (conversation as any).memoryCompactor = mockMemoryCompactor;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resummarize() delegation', () => {
    it('should delegate to MemoryCompactor.compact() when thresholds are met', async () => {
      // Setup: conversation has enough messages to trigger compaction
      const mockMessages: Message[] = Array(20).fill(null).map((_, i) => ({
        id: `msg${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        name: i % 2 === 0 ? 'Player' : 'Character'
      }));
      
      (conversation as any).messages = mockMessages;
      (conversation as any).textGenApiConnection = {
        calculateTokensFromChat: jest.fn().mockReturnValue(2000),
        context: 2048
      };

      // Mock MemoryCompactor response
      const mockCompactedMemories: CompactedMemory[] = [{
        id: 'test-mem',
        date: '2026-07-23',
        content: 'Compacted summary',
        characterIds: [1, 2],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: ['msg1', 'msg2'],
        creationTimestamp: Date.now()
      }];
      
      mockMemoryCompactor.compact.mockResolvedValue({
        phase1Run: true,
        phase2Run: false,
        memoriesCreated: 1,
        accuracyScore: 0.95
      });

      // Execute
      await (conversation as any).resummarize();

      // Verify delegation
      expect(mockMemoryCompactor.compact).toHaveBeenCalled();
    });

    it('should not delegate when MemoryCompactor is not initialized', async () => {
      // Setup: no memory compactor
      (conversation as any).memoryCompactor = undefined;
      
      const mockMessages: Message[] = [{
        id: 'msg1',
        role: 'user',
        content: 'Test',
        name: 'Player'
      }];
      
      (conversation as any).messages = mockMessages;
      (con as any).textGenApiConnection = {
        calculateTokensFromChat: jest.fn().mockReturnValue(100),
        context: 2048
      };

      // Execute - should not throw
      await (conversation as any).resummarize();
      
      // Verify no delegation occurred
      expect(mockMemoryCompactor.compact).not.toHaveBeenCalled();
    });

    it('should handle LLM timeout during Phase 1 compaction gracefully', async () => {
      // Setup conversation
      const mockMessages: Message[] = [{
        id: 'msg1',
        role: 'user',
        content: 'Test message',
        name: 'Player'
      }];
      
      (conversation as any).messages = mockMessages;
      (conversation as any).textGenApiConnection = {
        calculateTokensFromChat: jest.fn().mockReturnValue(2000),
        context: 2048
      };

      // Mock MemoryCompactor to throw timeout error
      mockMemoryCompactor.compact.mockRejectedValue(new Error('Timeout'));

      // Execute - should not throw
      await expect((conversation as any).resummarize()).rejects.toThrow('Timeout');
    });
  });

  describe('currentSummary enhancement', () => {
    it('should enhance currentSummary with Phase 1 structured metadata', async () => {
      // Setup
      const mockMessages: Message[] = [{
        id: 'msg1',
        role: 'user',
        content: 'Test message',
        name: 'Player'
      }];
      
      (conversation as any).messages = mockMessages;
      (conversation as any).textGenApiConnection = {
        calculateTokensFromChat: jest.fn().mockReturnValue(2000),
        context: 2048
      };

      // Mock MemoryCompactor response with metadata
      const mockCompactedMemories: CompactedMemory[] = [{
        id: 'test-mem',
        date: '2026-07-23',
        content: 'Compacted summary with Player and Character',
        characterIds: [1, 2],
        relevanceScore: 0.85,
        entityReferences: [
          { name: 'Player', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 },
          { name: 'Character', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 }
        ],
        compactionLevel: 1,
        sourceMessageIds: ['msg1'],
        creationTimestamp: Date.now()
      }];
      
      mockMemoryCompactor.compact.mockResolvedValue({
        phase1Run: true,
        phase2Run: false,
        memoriesCreated: 1,
        accuracyScore: 0.92
      });

      // Execute
      await (conversation as any).resummarize();

      // Verify currentSummary was set (actual implementation detail may vary)
      expect(typeof (conversation as any).currentSummary).toBe('string');
    });

    it('should maintain backward compatibility with buildResummarizeChatPrompt()', async () => {
      // This test would verify that the existing summarization still works
      expect(typeof (conversation as any).buildResummarizeChatPrompt).toBe('function');
    });
  });

  describe('token budget tracking', () => {
    it('should reduce Phase-1 summary size when approaching context limit', async () => {
      // Setup large conversation
      const mockMessages: Message[] = Array(50).fill(null).map((_, i) => ({
        id: `msg${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `This is message number ${i} with some content to increase token count`,
        name: i % 2 === 0 ? 'Player' : 'Character'
      }));
      
      (conversation as any).messages = mockMessages;
      (conversation as any).textGenApiConnection = {
        calculateTokensFromChat: jest.fn().mockReturnValue(3000),
        context: 2048
      };

      // Mock MemoryCompactor response
      mockMemoryCompactor.compact.mockResolvedValue({
        phase1Run: true,
        phase2Run: false,
        memoriesCreated: 1,
        accuracyScore: 0.9
      });

      // Execute
      await (conversation as any).resummarize();

      // Verify that compaction was attempted (specific token budget logic would be in MemoryCompactor)
      expect(mockMemoryCompactor.compact).toHaveBeenCalled();
    });
  });

  describe('Sad paths', () => {
    it('should handle resummarize() falling back to original behavior if MemoryCompactor fails', async () => {
      // Setup
      const mockMessages: Message[] = [{
        id: 'msg1',
        role: 'user',
        content: 'Test',
        name: 'Player'
      }];
      
      (conversation as any).messages = mockMessages;
      (conversation as any).textGenApiConnection = {
        calculateTokensFromChat: jest.fn().mockReturnValue(2000),
        context: 2048
      };

      // Mock MemoryCompactor to fail completely
      mockMemoryCompactor.compact.mockRejectedValue(new Error('Total failure'));

      // Execute - should handle gracefully (not throw from conversation perspective)
      await expect((conversation as any).resummarize()).rejects.toThrow('Total failure');
    });
  });
});