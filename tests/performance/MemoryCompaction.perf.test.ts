import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MemoryCompactor } from '../../../src/main/conversation/MemoryCompactor';
import { CompactedMemory, CompactionConfig, CompactionResult } from '../../../src/shared/compactionTypes';
import { Message } from '../../../src/shared/apiConnection';
import { Conversation } from '../../../src/main/conversation/Conversation';
import { GameData } from '../../../src/shared/gameData/GameData';
import { Config } from '../../../src/shared/Config';
import { ChatWindow } from '../../../src/main/windows/ChatWindow';
import { Tiktoken } from 'js-tiktoken';

// Mock the entire compactedMemoryStore module
jest.mock('../../../src/main/compactedMemoryStore', () => ({
  compactedMemoryStore: {
    saveCompactedMemory: jest.fn().mockResolvedValue({ serializationTimeMs: 10, diskWriteTimeMs: 5 }),
    getAllCompactedMemories: jest.fn().mockResolvedValue({ memories: [] }),
    migrateDataDirectory: jest.fn(),
  },
}));

// Mock the ApiConnection to control token calculation and API responses
const mockApiConnection = {
  calculateTokensFromChat: jest.fn(),
  calculateTokensFromMessage: jest.fn(),
  complete: jest.fn(),
  context: 8192,
};

// Mock the Phase1Compactor and Phase2Compactor to control their behavior
const mockPhase1Compactor = {
  compact: jest.fn(),
};

const mockPhase2Compactor = {
  compact: jest.fn(),
};

// Mock the CompactionScheduler
const mockCompactionScheduler = {
  shouldRunPhase1: jest.fn(),
  shouldRunPhase2: jest.fn(),
  getCompactionStats: jest.fn().mockReturnValue({ cooldownRemaining: 0 }),
};

// Mock the ContextAccuracyValidator
const mockAccuracyValidator = {
  validate: jest.fn().mockReturnValue(1.0), // Always 100% accurate for performance tests
};

// Mock the CompactionMetricsTracker
const mockMetricsTracker = {
  start: jest.fn(),
  end: jest.fn(),
  addMetric: jest.fn(),
  getMetrics: jest.fn().mockReturnValue({}),
};

// Mock the CompactionLocalizationValidator
const mockLocalizationValidator = {
  validate: jest.fn().mockReturnValue(true),
};

// Mock the Tiktoken encoder
const mockTiktokenEncoder: Tiktoken = {
  encode: jest.fn((text: string) => Array(Math.ceil(text.length / 4)).fill(0)), // 4 chars per token
  decode: jest.fn(),
  decodeAsync: jest.fn(),
  free: jest.fn(),
};

describe('MemoryCompactor Performance', () => {
  let compactor: MemoryCompactor;
  let mockConfig: CompactionConfig;
  let mockConversation: Conversation;
  let mockGameData: GameData;
  let mockChatWindow: ChatWindow;
  let longMessageContent: string;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    mockConfig = {
      enableMemoryCompaction: true,
      compactionPhase1Threshold: 70, // Trigger compaction when 70% of context is used
      compactionPhase2Threshold: 5,
      compactionTokenBudget: { phase1: 30, phase2: 10 },
      compactionCooldownMinutes: 0, // No cooldown for performance tests
      compactionPriorityElements: [],
      compactionEntityExtractionMode: 'none',
      compactionRelationshipsDirectional: false,
      compactionApiConnectionConfig: {}, // This will be ignored as per plan
    };

    // Manually inject mocks into the MemoryCompactor instance
    compactor = new MemoryCompactor(mockConfig);
    (compactor as any).phase1Compactor = mockPhase1Compactor;
    (compactor as any).phase2Compactor = mockPhase2Compactor;
    (compactor as any).scheduler = mockCompactionScheduler;
    (compactor as any).accuracyValidator = mockAccuracyValidator;
    (compactor as any).metricsTracker = mockMetricsTracker;
    (compactor as any).localizationValidator = mockLocalizationValidator;

    // Setup mock GameData
    mockGameData = new GameData();
    mockGameData.playerID = 1;
    mockGameData.aiID = 2;
    mockGameData.characters.set(1, { id: 1, fullName: 'Player', shortName: 'Player', isPlayer: true } as any);
    mockGameData.characters.set(2, { id: 2, fullName: 'AI Character', shortName: 'AI', isPlayer: false } as any);
    mockGameData.date = '1066.1.1';
    mockGameData.totalDays = 100;

    // Setup mock ChatWindow
    mockChatWindow = {
      window: {
        webContents: {
          send: jest.fn(),
        },
      },
    } as any;

    // Setup mock Conversation
    mockConversation = new Conversation(mockGameData, new Config(), mockChatWindow, 'mock/user/data', mockTiktokenEncoder);
    mockConversation.textGenApiConnection = mockApiConnection as any;
    mockConversation.summarizationApiConnection = mockApiConnection as any; // Compaction uses summarization API
    mockConversation.actionsApiConnection = mockApiConnection as any;
    mockConversation.calculateBasePromptTokens = jest.fn().mockImplementation(async () => {
      const chatTokens = mockApiConnection.calculateTokensFromChat(mockConversation.messages);
      return chatTokens;
    });

    // Generate a long message content string
    longMessageContent = 'a'.repeat(100); // 100 characters per message

    // Mock token calculation for messages
    mockApiConnection.calculateTokensFromMessage.mockImplementation((msg: Message) => {
      return Math.ceil((msg.content?.length || 0) / 4);
    });
    mockApiConnection.calculateTokensFromChat.mockImplementation((messages: Message[]) => {
      return messages.reduce((sum, msg) => sum + mockApiConnection.calculateTokensFromMessage(msg), 0);
    });
  });

  afterEach(() => {
    compactor.cleanup();
  });

  // Helper to generate messages
  const generateMessages = (count: number, content: string): Message[] => {
    const messages: Message[] = [];
    for (let i = 0; i < count; i++) {
      messages.push({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        name: i % 2 === 0 ? 'Player' : 'AI Character',
        content: `${content} ${i}`,
      });
    }
    return messages;
  };

  // Helper to generate mock compacted memories
  const generateCompactedMemories = (count: number, level: 1 | 2, gameDate: string = '1066.1.1'): CompactedMemory[] => {
    const memories: CompactedMemory[] = [];
    for (let i = 0; i < count; i++) {
      memories.push({
        id: `mem-${level}-${i}`,
        date: gameDate,
        gameDate: gameDate, // Add gameDate for time-travel resilience tests
        content: `Compacted memory content ${i}`,
        characterIds: [1, 2],
        relevanceScore: 0.5,
        entityReferences: [],
        compactionLevel: level,
        sourceMessageIds: [`msg-${i * 2}`, `msg-${i * 2 + 1}`],
        creationTimestamp: Date.now(),
      });
    }
    return memories;
  };

  describe('Performance: Token Reduction and Execution Time', () => {
    it('should achieve significant token reduction after Phase 1 compaction', async () => {
      const numMessages = 500;
      mockConversation.messages = generateMessages(numMessages, longMessageContent);
      const initialTokens = mockApiConnection.calculateTokensFromChat(mockConversation.messages);

      // Mock scheduler to always trigger Phase 1
      mockCompactionScheduler.shouldRunPhase1.mockReturnValue(true);
      mockCompactionScheduler.shouldRunPhase2.mockReturnValue(false);

      // Mock Phase1Compactor to return a single compacted memory for every 10 messages
      const phase1Results = generateCompactedMemories(numMessages / 10, 1);
      mockPhase1Compactor.compact.mockResolvedValue(phase1Results);

      // Mock token calculation for compacted memories (e.g., 20 tokens per compacted memory)
      mockApiConnection.calculateTokensFromMessage.mockImplementation((msg: Message | CompactedMemory) => {
        if ('compactionLevel' in msg) {
          return 20; // Compacted memory is smaller
        }
        return Math.ceil((msg.content?.length || 0) / 4);
      });

      const result = await compactor.compact(mockConversation);

      expect(result.phase1Run).toBe(true);
      expect(result.memoriesCreated).toBe(phase1Results.length);

      // Calculate tokens after compaction (remaining messages + new compacted memories)
      const remainingMessagesTokens = mockApiConnection.calculateTokensFromChat(mockConversation.messages);
      const compactedMemoriesTokens = phase1Results.reduce((sum, mem) => sum + mockApiConnection.calculateTokensFromMessage(mem as any), 0);
      const finalTokens = remainingMessagesTokens + compactedMemoriesTokens;

      const reductionPercentage = ((initialTokens - finalTokens) / initialTokens) * 100;
      console.log(`Initial Tokens: ${initialTokens}, Final Tokens: ${finalTokens}, Reduction: ${reductionPercentage.toFixed(2)}%`);

      // Expect at least 40% reduction as per plan
      expect(reductionPercentage).toBeGreaterThanOrEqual(40);
    });

    it('should complete Phase 1 compaction within a reasonable time for 500 messages', async () => {
      const numMessages = 500;
      mockConversation.messages = generateMessages(numMessages, longMessageContent);
      mockConversation.calculateBasePromptTokens.mockResolvedValue(mockApiConnection.context * 0.8); // Ensure threshold is met

      mockCompactionScheduler.shouldRunPhase1.mockReturnValue(true);
      mockCompactionScheduler.shouldRunPhase2.mockReturnValue(false);

      const phase1Results = generateCompactedMemories(numMessages / 10, 1);
      mockPhase1Compactor.compact.mockResolvedValue(phase1Results);

      const startTime = process.hrtime.bigint();
      await compactor.compact(mockConversation);
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      console.log(`Phase 1 compaction for ${numMessages} messages took ${durationMs.toFixed(2)} ms`);

      // Expect completion within 30 seconds (30000 ms) as per plan
      expect(durationMs).toBeLessThan(30000);
    });

    it('should complete Phase 2 compaction within a reasonable time for 50 Phase 1 summaries', async () => {
      const numPhase1Summaries = 50;
      const existingMemories = generateCompactedMemories(numPhase1Summaries, 1);
      (compactor as any).compactedMemories.set('1', existingMemories); // Manually add memories

      mockCompactionScheduler.shouldRunPhase1.mockReturnValue(false);
      mockCompactionScheduler.shouldRunPhase2.mockReturnValue(true);

      const mockKnowledgeGraph = {
        entities: [],
        edges: [],
        narrativeThreads: generateCompactedMemories(numPhase1Summaries / 5, 2).map(m => ({ id: m.id, topic: 'Test', summary: m.content })),
        version: 1
      };
      mockPhase2Compactor.compact.mockResolvedValue(mockKnowledgeGraph);

      const startTime = process.hrtime.bigint();
      await compactor.compact(mockConversation);
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      console.log(`Phase 2 compaction for ${numPhase1Summaries} summaries took ${durationMs.toFixed(2)} ms`);

      // Expect completion within 30 seconds (30000 ms) as per plan
      expect(durationMs).toBeLessThan(30000);
    });

    it('should handle very large conversation histories (1000+ messages) without crashing', async () => {
      const numMessages = 1500;
      mockConversation.messages = generateMessages(numMessages, longMessageContent);
      mockConversation.calculateBasePromptTokens.mockResolvedValue(mockApiConnection.context * 0.9); // Ensure threshold is met

      mockCompactionScheduler.shouldRunPhase1.mockReturnValue(true);
      mockCompactionScheduler.shouldRunPhase2.mockReturnValue(false);

      const phase1Results = generateCompactedMemories(numMessages / 10, 1);
      mockPhase1Compactor.compact.mockResolvedValue(phase1Results);

      await expect(compactor.compact(mockConversation)).resolves.toBeDefined();
      expect(mockPhase1Compactor.compact).toHaveBeenCalled();
    });
  });
});
