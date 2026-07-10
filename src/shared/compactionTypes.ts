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