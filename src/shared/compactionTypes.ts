export interface CompactedMemory {
    id: string;
    date: string;
    content: string;
    characterIds: number[];
    relevanceScore: number;
    entityReferences: EntityReference[];
    compactionLevel: 1 | 2;
    sourceMessageIds: string[];
    creationTimestamp: number;
}

export interface EntityReference {
    name: string;
    type: EntityType;
    relationships: Relationship[];
    firstMentionedDate: string;
    lastMentionedDate: string;
    mentionCount: number;
}

export type EntityType = 'character' | 'relationship' | 'event' | 'title' | 'artifact' | 'custom';

export interface Relationship {
    targetEntityName: string;
    type: RelationshipType;
    description: string;
}

export type RelationshipType = 'friend' | 'rival' | 'lover' | 'ally' | 'enemy' | 'family' | 'custom';

export interface KnowledgeEdge {
    source: string;
    target: string;
    label: string;
}

export interface NarrativeThread {
    id: string;
    topic: string;
    summary: string;
}

export interface KnowledgeGraph {
    entities: EntityReference[];
    edges: KnowledgeEdge[];
    narrativeThreads: NarrativeThread[];
    version: number;
}

export interface CompactionConfig {
    enableMemoryCompaction: boolean;
    compactionPhase1Threshold: number; // % of context
    compactionPhase2Threshold: number; // max phase-1 summaries
    compactionTokenBudget: { phase1: number, phase2: number }; // % of context
    compactionCooldownMinutes: number;
    compactionPriorityElements: string[];
    compactionEntityExtractionMode: 'llm' | 'regex' | 'hybrid';
    compactionRelationshipsDirectional: boolean;
    compactionApiConnectionConfig: any; // Will be ApiConnectionConfig
}

/** Performance metrics collected during a compaction operation. */
export interface CompactionMetrics {
    /** Heap memory used before compaction (bytes). */
    memoryBeforeBytes: number;
    /** Heap memory used after compaction (bytes). */
    memoryAfterBytes: number;
    /** Total compaction duration in milliseconds. */
    totalDurationMs: number;
    /** Phase 1 compaction duration in milliseconds (0 if not run). */
    phase1DurationMs: number;
    /** Phase 2 compaction duration in milliseconds (0 if not run). */
    phase2DurationMs: number;
    /** Time spent serializing and encrypting compacted data (ms). */
    serializationTimeMs: number;
    /** Time spent writing compacted data to disk (ms). */
    diskWriteTimeMs: number;
    /** Time spent reading compacted data from disk (ms). */
    diskReadTimeMs: number;
    /** Context accuracy score (0-1) from validation. */
    accuracyScore: number;
    /** Number of messages compacted in Phase 1. */
    messagesCompacted: number;
    /** Number of Phase-1 summaries consolidated in Phase 2. */
    phase1SummariesConsolidated: number;
    /** Timestamp when compaction started (epoch ms). */
    startTimestamp: number;
    /** Timestamp when compaction completed (epoch ms). */
    endTimestamp: number;
}