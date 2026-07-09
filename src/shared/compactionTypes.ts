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
    targetEntityId: string;
    type: RelationshipType;
    strength: number; // -1 to 1, where negative is negative relationship
}
export type RelationshipType = 'friend' | 'rival' | 'lover' | 'ally' | 'enemy' | 'family' | 'custom';

export interface KnowledgeGraph {
    entities: EntityReference[];
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