import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CompactionScheduler } from '../../../src/main/conversation/MemoryCompactor';
import { CompactedMemory, CompactionConfig } from '../../../src/shared/compactionTypes';
import { Message } from '../../../src/shared/apiConnection';

describe('CompactionScheduler', () => {
  let scheduler: CompactionScheduler;
  let mockConfig: CompactionConfig;

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

    scheduler = new CompactionScheduler(mockConfig);
  });

  describe('constructor', () => {
    it('should store the configuration', () => {
      const schedulerAny = scheduler as any;
      expect(schedulerAny.config).toEqual(mockConfig);
    });

    it('should initialize lastCompactionTime to 0', () => {
      const schedulerAny = scheduler as any;
      expect(schedulerAny.lastCompactionTime).toBe(0);
    });
  });

  describe('shouldRunPhase1(messages, tokenCount, contextSize)', () => {
    it('should return true when token count exceeds compactionPhase1Threshold%', () => {
      const messages: Message[] = [];
      const tokenCount = 2000;
      const contextSize = 2048;

      // 2000/2048 = 97.6% > 70% threshold
      const result = scheduler.shouldRunPhase1(messages, tokenCount, contextSize);
      expect(result).toBe(true);
    });

    it('should return false when token count is below threshold', () => {
      const messages: Message[] = [];
      const tokenCount = 500;
      const contextSize = 2048;

      // 500/2048 = 24.4% < 70% threshold
      const result = scheduler.shouldRunPhase1(messages, tokenCount, contextSize);
      expect(result).toBe(false);
    });

    it('should return false when compaction is disabled', () => {
      const disabledConfig = { ...mockConfig, enableMemoryCompaction: false };
      const disabledScheduler = new CompactionScheduler(disabledConfig);
      
      const messages: Message[] = [];
      const tokenCount = 2000;
      const contextSize = 2048;

      const result = disabledScheduler.shouldRunPhase1(messages, tokenCount, contextSize);
      expect(result).toBe(false);
    });

    it('should return false when within cooldown period', () => {
      const schedulerAny = scheduler as any;
      // Set last compaction time to now (within cooldown)
      schedulerAny.lastCompactionTime = Date.now();
      
      const messages: Message[] = [];
      const tokenCount = 2000;
      const contextSize = 2048;

      const result = scheduler.shouldRunPhase1(messages, tokenCount, contextSize);
      expect(result).toBe(false);
    });

    it('should update lastCompactionTime when returning true', () => {
      const schedulerAny = scheduler as any;
      const before = Date.now();
      
      const messages: Message[] = [];
      const tokenCount = 2000;
      const contextSize = 2048;

      scheduler.shouldRunPhase1(messages, tokenCount, contextSize);
      
      expect(schedulerAny.lastCompactionTime).toBeGreaterThanOrEqual(before);
    });

    it('should handle edge case: tokenCount exactly at threshold boundary', () => {
      const messages: Message[] = [];
      const contextSize = 2048;
      const exactThreshold = contextSize * (mockConfig.compactionPhase1Threshold / 100);
      
      // At exactly 70% - should NOT trigger (strictly greater than)
      const result = scheduler.shouldRunPhase1(messages, exactThreshold, contextSize);
      expect(result).toBe(false);
      
      // Just above 70% - should trigger
      const resultAbove = scheduler.shouldRunPhase1(messages, exactThreshold + 1, contextSize);
      expect(resultAbove).toBe(true);
    });
  });

  describe('shouldRunPhase2(phase1Summaries)', () => {
    it('should return true when summary count exceeds compactionPhase2Threshold', () => {
      const phase1Summaries: CompactedMemory[] = Array(6).fill(null).map((_, i) => ({
        id: `mem${i}`,
        date: '2026-07-23',
        content: `Summary ${i}`,
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }));

      // 6 summaries > 5 threshold
      const result = scheduler.shouldRunPhase2(phase1Summaries);
      expect(result).toBe(true);
    });

    it('should return false when summary count is below threshold', () => {
      const phase1Summaries: CompactedMemory[] = Array(3).fill(null).map((_, i) => ({
        id: `mem${i}`,
        date: '2026-07-23',
        content: `Summary ${i}`,
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }));

      // 3 summaries < 5 threshold
      const result = scheduler.shouldRunPhase2(phase1Summaries);
      expect(result).toBe(false);
    });

    it('should return false when compaction is disabled', () => {
      const disabledConfig = { ...mockConfig, enableMemoryCompaction: false };
      const disabledScheduler = new CompactionScheduler(disabledConfig);
      
      const phase1Summaries: CompactedMemory[] = Array(10).fill(null).map((_, i) => ({
        id: `mem${i}`,
        date: '2026-07-23',
        content: `Summary ${i}`,
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }));

      const result = disabledScheduler.shouldRunPhase2(phase1Summaries);
      expect(result).toBe(false);
    });

    it('should handle edge case: phase1Summaries count exactly at maxSummaries boundary', () => {
      const phase1Summaries: CompactedMemory[] = Array(5).fill(null).map((_, i) => ({
        id: `mem${i}`,
        date: '2026-07-23',
        content: `Summary ${i}`,
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }));

      // Exactly 5 summaries - should NOT trigger (strictly greater than)
      const result = scheduler.shouldRunPhase2(phase1Summaries);
      expect(result).toBe(false);
    });
  });

  describe('scheduleNextCompaction()', () => {
    it('should return correct delay based on compactionCooldownMinutes', () => {
      const result = scheduler.scheduleNextCompaction();
      expect(result).toBe(5 * 60 * 1000); // 5 minutes in ms
    });

    it('should return different delay for different cooldown config', () => {
      const customConfig = { ...mockConfig, compactionCooldownMinutes: 10 };
      const customScheduler = new CompactionScheduler(customConfig);
      
      const result = customScheduler.scheduleNextCompaction();
      expect(result).toBe(10 * 60 * 1000); // 10 minutes in ms
    });
  });

  describe('getCompactionStats()', () => {
    it('should return accurate statistics', () => {
      const schedulerAny = scheduler as any;
      schedulerAny.lastCompactionTime = Date.now() - 60000; // 1 minute ago
      
      const stats = scheduler.getCompactionStats();
      
      expect(stats).toHaveProperty('lastCompactionTime');
      expect(stats).toHaveProperty('cooldownRemaining');
      expect(stats.lastCompactionTime).toBe(schedulerAny.lastCompactionTime);
      expect(stats.cooldownRemaining).toBeGreaterThan(0);
    });

    it('should return zero cooldownRemaining when cooldown has expired', () => {
      const schedulerAny = scheduler as any;
      // Set last compaction time to 10 minutes ago (cooldown is 5 minutes)
      schedulerAny.lastCompactionTime = Date.now() - 10 * 60 * 1000;
      
      const stats = scheduler.getCompactionStats();
      
      expect(stats.cooldownRemaining).toBe(0);
    });
  });
});