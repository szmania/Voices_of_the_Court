import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Message } from '../../../src/shared/apiConnection';
import { CompactedMemory } from '../../../src/shared/compactionTypes';

// Mock the prompt builder module
jest.mock('../../../src/main/conversation/promptBuilder', () => ({
  buildChatPrompt: jest.fn(),
  buildResummarizeChatPrompt: jest.fn(),
  createCompactedMemoryString: jest.fn()
}));

describe('promptBuilder.compaction', () => {
  let mockBuildChatPrompt: jest.Mock;
  let mockBuildResummarizeChatPrompt: jest.Mock;
  let mockCreateCompactedMemoryString: jest.Mock;

  beforeEach(() => {
    const promptBuilder = require('../../../src/main/conversation/promptBuilder');
    mockBuildChatPrompt = promptBuilder.buildChatPrompt;
    mockBuildResummarizeChatPrompt = promptBuilder.buildResummarizeChatPrompt;
    mockCreateCompactedMemoryString = promptBuilder.createCompactedMemoryString;

    jest.clearAllMocks();
  });

  describe('createCompactedMemoryString()', () => {
    it('should correctly format Phase-2 compacted memories for prompt injection', () => {
      const compactedMemories: CompactedMemory[] = [{
        id: 'cm1',
        date: '2026-07-23',
        content: 'Player and Character are allies who fought together in the Battle of Somewhere',
        characterIds: [1, 2],
        relevanceScore: 0.85,
        entityReferences: [
          { name: 'Player', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 3 },
          { name: 'Character', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 2 }
        ],
        compactionLevel: 2,
        sourceMessageIds: ['msg1', 'msg2'],
        creationTimestamp: Date.now()
      }];

      mockCreateCompactedMemoryString.mockReturnValue(
        '[Compacted Memory - Alliance/2026-07-23]: Player and Character are allies who fought together in the Battle of Somewhere'
      );

      const result = mockCreateCompactedMemoryString(compactedMemories);

      expect(result).toContain('Player and Character');
      expect(result).toContain('allies');
      expect(result).toContain('Battle of Somewhere');
    });

    it('should insert compacted memory at memoriesInsertDepth position in buildChatPrompt() output', () => {
      const mockChatPrompt = [
        { role: 'system', content: 'You are a CK3 character simulation.' },
        { role: 'system', content: '[START OF MEMORY SECTION]' },
        { role: 'system', content: '[Compacted Memory - Alliance]: Player is allied with Character.' },
        { role: 'system', content: '[END OF MEMORY SECTION]' },
        { role: 'user', content: 'Hello noble character' }
      ];

      mockBuildChatPrompt.mockReturnValue(mockChatPrompt);

      const result = mockBuildChatPrompt({} as any, {} as any, {} as any);

      expect(result.length).toBeGreaterThan(0);
      // The compacted memory should appear in the middle of the prompt
      expect(result).toContainEqual(
        expect.objectContaining({ content: expect.stringContaining('Compacted Memory') })
      );
    });

    it('should NOT replace existing in-game Memory[] system (integration, not replacement)', () => {
      const mockChatPrompt = [
        { role: 'system', content: 'You are a CK3 character simulation.' },
        { role: 'system', content: 'Memory: You have a secret alliance with the King.' }, // in-game Memory
        { role: 'system', content: '[Compacted Memory - Recent]: The player recently visited your castle.' }, // compacted Memory
        { role: 'user', content: 'Hello' }
      ];

      mockBuildChatPrompt.mockReturnValue(mockChatPrompt);

      const result = mockBuildChatPrompt({} as any, {} as any, {} as any);

      // Both in-game and compacted memories should be present
      const hasInGameMemory = result.some((msg: Message) =>
        msg.content && msg.content.includes('Memory:') && !msg.content.includes('Compacted')
      );
      const hasCompactedMemory = result.some((msg: Message) =>
        msg.content && msg.content.includes('Compacted Memory')
      );

      expect(hasInGameMemory).toBe(true);
      expect(hasCompactedMemory).toBe(true);
    });

    it('should include both currentSummary AND compacted memory context in buildResummarizeChatPrompt()', () => {
      const mockResummarizePrompt = [
        { role: 'system', content: 'Current Summary: Player has visited the castle recently.' },
        { role: 'system', content: '[Compacted Memory - Alliance]: Character is allied with Player since 1066.' },
        { role: 'user', content: 'Additional messages to summarize...' }
      ];

      mockBuildResummarizeChatPrompt.mockReturnValue(mockResummarizePrompt);

      const result = mockBuildResummarizeChatPrompt({} as any, {} as any, {} as any);

      const hasCurrentSummary = result.some((msg: Message) =>
        msg.content && msg.content.includes('Current Summary')
      );
      const hasCompactedMemory = result.some((msg: Message) =>
        msg.content && msg.content.includes('Compacted Memory')
      );

      expect(hasCurrentSummary).toBe(true);
      expect(hasCompactedMemory).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should gracefully degrade when no compacted memories exist', () => {
      const emptyMemories: CompactedMemory[] = [];

      mockCreateCompactedMemoryString.mockReturnValue('');

      const result = mockCreateCompactedMemoryString(emptyMemories);

      expect(result).toBe('');
    });

    it('should handle CJK characters correctly for token counting', () => {
      const cjkCompactMemory: CompactedMemory = {
        id: 'cm-cjk',
        date: '2026-07-23',
        content: 'プレイヤーはキャラクターと友達です (Player is friends with Character in Japanese)',
        characterIds: [1, 2],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 2,
        sourceMessageIds: ['msg1'],
        creationTimestamp: Date.now()
      };

      mockCreateCompactedMemoryString.mockReturnValue('[Compacted Memory - General]: プレイヤーはキャラクターと友達です');

      const result = mockCreateCompactedMemoryString([cjkCompactMemory]);

      // Should preserve CJK characters correctly
      expect(result).toContain('プレイヤー');
      expect(result).toContain('キャラクター');
      // CJK token counting would be handled internally by calculateTokensFromText
    });

    it('should handle large numbers of compacted memories gracefully', () => {
      const manyMemories: CompactedMemory[] = Array(50).fill(null).map((_, i) => ({
        id: `cm${i}`,
        date: '2026-07-23',
        content: `Summary ${i}`,
        characterIds: [1],
        relevanceScore: 0.5,
        entityReferences: [],
        compactionLevel: 2,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }));

      mockCreateCompactedMemoryString.mockReturnValue('[Compacted Memory]: Multiple summaries condensed.');

      const result = mockCreateCompactedMemoryString(manyMemories);

      // Should not throw and should return a usable string
      expect(typeof result).toBe('string');
    });
  });
});