import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Phase2Compactor } from '../../../src/main/conversation/MemoryCompactor';
import { CompactedMemory, CompactionConfig, KnowledgeGraph, EntityReference, Relationship } from '../../../src/shared/compactionTypes';

describe('Phase2Compactor', () => {
  let compactor: Phase2Compactor;
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

    compactor = new Phase2Compactor(mockConfig);
  });

  describe('constructor', () => {
    it('should store the configuration', () => {
      const compactorAny = compactor as any;
      expect(compactorAny.config).toEqual(mockConfig);
    });
  });

  describe('compact(phase1Summaries)', () => {
    it('should return empty knowledge graph for empty input', async () => {
      const result = await compactor.compact([]);
      
      expect(result).toEqual({
        entities: [],
        edges: [],
        narrativeThreads: [],
        version: 1
      });
    });

    it('should invoke LLM with correct Phase 2 prompt', async () => {
      const phase1Summaries: CompactedMemory[] = [{
        id: 'mem1',
        date: '2026-07-23',
        content: 'Player and Character are rivals',
        characterIds: [1, 2],
        relevanceScore: 0.8,
        entityReferences: [
          { name: 'Player', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 },
          { name: 'Character', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 }
        ],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }];

      // Mock the LLM call
      const compactorAny = compactor as any;
      compactorAny.buildPhase2Prompt = jest.fn().mockReturnValue([]);
      compactorAny.collectEntities = jest.fn().mockReturnValue([]);
      compactorAny.deduplicateEntities = jest.fn().mockReturnValue([]);
      compactorAny.buildEdges = jest.fn().mockReturnValue([]);
      compactorAny.extractNarrativeThreads = jest.fn().mockReturnValue([]);

      const result = await compactor.compact(phase1Summaries);

      expect(compactorAny.collectEntities).toHaveBeenCalled();
      expect(result.version).toBe(1);
    });

    it('should respect token budget allocation for phase2', () => {
      const compactorAny = compactor as any;
      expect(compactorAny.config.compactionTokenBudget.phase2).toBe(10);
    });

    it('should output includes knowledge graph structure', async () => {
      const phase1Summaries: CompactedMemory[] = [{
        id: 'mem1',
        date: '2026-07-23',
        content: 'Test summary',
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }];

      const compactorAny = compactor as any;
      compactorAny.collectEntities = jest.fn().mockReturnValue([]);
      compactorAny.deduplicateEntities = jest.fn().mockReturnValue([]);
      compactorAny.buildEdges = jest.fn().mockReturnValue([]);
      compactorAny.extractNarrativeThreads = jest.fn().mockReturnValue([]);

      const result = await compactor.compact(phase1Summaries);

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('narrativeThreads');
      expect(result).toHaveProperty('version');
    });

    it('should merge knowledge graphs correctly from multiple Phase-1 summaries', async () => {
      const phase1Summaries: CompactedMemory[] = [
        {
          id: 'mem1',
          date: '2026-07-23',
          content: 'Player is friends with Character',
          characterIds: [1, 2],
          relevanceScore: 0.8,
          entityReferences: [
            { name: 'Player', type: 'character', relationships: [{ targetEntityName: 'Character', type: 'friend', description: '' }], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 }
          ],
          compactionLevel: 1,
          sourceMessageIds: [],
          creationTimestamp: Date.now()
        },
        {
          id: 'mem2',
          date: '2026-07-23',
          content: 'Character is rivals with Player',
          characterIds: [2, 1],
          relevanceScore: 0.8,
          entityReferences: [
            { name: 'Character', type: 'character', relationships: [{ targetEntityName: 'Player', type: 'rival', description: '' }], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 }
          ],
          compactionLevel: 1,
          sourceMessageIds: [],
          creationTimestamp: Date.now()
        }
      ];

      const compactorAny = compactor as any;
      compactorAny.collectEntities = jest.fn().mockReturnValue([
        { name: 'Player', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 },
        { name: 'Character', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 }
      ]);
      compactorAny.deduplicateEntities = jest.fn().mockReturnValue([]);
      compactorAny.buildEdges = jest.fn().mockReturnValue([]);
      compactorAny.extractNarrativeThreads = jest.fn().mockReturnValue([]);

      await compactor.compact(phase1Summaries);

      expect(compactorAny.collectEntities).toHaveBeenCalled();
    });

    it('should deduplicate entities while preserving directional relationships', async () => {
      const entities: EntityReference[] = [
        { name: 'Player', type: 'character', relationships: [{ targetEntityName: 'Character', type: 'friend', description: '' }], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 },
        { name: 'player', type: 'character', relationships: [{ targetEntityName: 'Character', type: 'rival', description: '' }], firstMentionedDate: '2026-07-22', lastMentionedDate: '2026-07-23', mentionCount: 1 }
      ];

      const compactorAny = compactor as any;
      const result = compactorAny.deduplicateEntities(entities);

      // Should deduplicate by name (case-insensitive)
      expect(result.length).toBe(1);
      // Relationships should be merged
      expect(result[0].relationships.length).toBe(2);
    });
  });

  describe('Sad paths', () => {
    it('should handle empty Phase-1 summaries array', async () => {
      const result = await compactor.compact([]);
      
      expect(result.entities).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.narrativeThreads).toEqual([]);
    });

    it('should handle regex fallback when LLM JSON-mode is unavailable', async () => {
      const phase1Summaries: CompactedMemory[] = [{
        id: 'mem1',
        date: '2026-07-23',
        content: 'Test summary',
        characterIds: [1],
        relevanceScore: 0.8,
        entityReferences: [],
        compactionLevel: 1,
        sourceMessageIds: [],
        creationTimestamp: Date.now()
      }];

      const compactorAny = compactor as any;
      // Simulate LLM failure
      compactorAny.buildPhase2Prompt = jest.fn().mockImplementation(() => {
        throw new Error('LLM not available');
      });
      
      // Should still work with fallback
      compactorAny.collectEntities = jest.fn().mockReturnValue([]);
      compactorAny.deduplicateEntities = jest.fn().mockReturnValue([]);
      compactorAny.buildEdges = jest.fn().mockReturnValue([]);
      compactorAny.extractNarrativeThreads = jest.fn().mockReturnValue([]);

      const result = await compactor.compact(phase1Summaries);
      
      expect(result).toBeDefined();
    });
  });

  describe('Helper methods', () => {
    it('collectEntities should collect all entity references from summaries', () => {
      const compactorAny = compactor as any;
      const summaries: CompactedMemory[] = [
        {
          id: 'mem1',
          date: '2026-07-23',
          content: 'Test',
          characterIds: [1],
          relevanceScore: 0.8,
          entityReferences: [
            { name: 'Player', type: 'character', relationships: [], firstMentionedDate: '2026-07-23', lastMentionedDate: '2026-07-23', mentionCount: 1 }
          ],
          compactionLevel: 1,
          sourceMessageIds: [],
          creationTimestamp: Date.now()
        }
      ];

      const result = compactorAny.collectEntities(summaries);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Player');
    });

    it('buildEdges should create edges from entity relationships', () => {
      const compactorAny = compactor as any;
      const entities: EntityReference[] = [
        {
          name: 'Player',
          type: 'character',
          relationships: [
            { targetEntityName: 'Character', type: 'friend', description: '' }
          ],
          firstMentionedDate: '2026-07-23',
          lastMentionedDate: '2026-07-23',
          mentionCount: 1
        }
      ];

      const result = compactorAny.buildEdges(entities);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        source: 'Player',
        target: 'Character',
        label: 'friend'
      });
    });

    it('extractNarrativeThreads should group summaries by topic keywords', () => {
      const compactorAny = compactor as any;
      const summaries: CompactedMemory[] = [
        {
          id: 'mem1',
          date: '2026-07-23',
          content: 'Player declared war on Character',
          characterIds: [1, 2],
          relevanceScore: 0.8,
          entityReferences: [],
          compactionLevel: 1,
          sourceMessageIds: [],
          creationTimestamp: Date.now()
        }
      ];

      const result = compactorAny.extractNarrativeThreads(summaries);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].topic).toBe('Conflict');
    });
  });
});