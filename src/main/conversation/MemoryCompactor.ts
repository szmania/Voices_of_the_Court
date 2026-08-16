import { Conversation } from './Conversation';
import { CompactedMemory, CompactionConfig, CompactionMetrics, KnowledgeGraph, EntityReference, Relationship, KnowledgeEdge, NarrativeThread } from '../../shared/compactionTypes';
import { Message } from '../../main/ts/conversation_interfaces';
import { compactedMemoryStore } from '../compactedMemoryStore';
import { randomUUID } from 'crypto';
import { CompactionMetrics as CompactionMetricsTracker } from './CompactionMetrics';
import { CompactionLocalizationValidator } from './CompactionLocalizationValidator';

/**
 * MemoryCompactor - Orchestrates two-phase memory compaction for long-running conversations.
 * Phase 1: Summarizes recent message blocks into structured CompactedMemory entries.
 * Phase 2: Consolidates multiple Phase-1 summaries into a long-term KnowledgeGraph.
 */
export class MemoryCompactor {
    private phase1Compactor: Phase1Compactor;
    private phase2Compactor: Phase2Compactor;
    private scheduler: CompactionScheduler;
    private accuracyValidator: ContextAccuracyValidator;
    private compactedMemories: Map<string, CompactedMemory[]> = new Map();
    private metricsTracker: CompactionMetricsTracker;
    private localizationValidator: CompactionLocalizationValidator;
    private config: CompactionConfig;

    /**
     * Promise-based lock to serialize compaction operations.
     * When non-null, a compaction is in progress. Concurrent callers receive
     * the same promise, ensuring only one compaction runs at a time.
     */
    private _compactionLock: Promise<CompactionResult> | null = null;

    constructor(config: CompactionConfig) {
        this.config = config;
        this.phase1Compactor = new Phase1Compactor(config);
        this.phase2Compactor = new Phase2Compactor(config);
        this.scheduler = new CompactionScheduler(config);
        this.accuracyValidator = new ContextAccuracyValidator();
        this.metricsTracker = new CompactionMetricsTracker();
        this.localizationValidator = new CompactionLocalizationValidator();
    }

    /**
        this.metricsTracker = new CompactionMetricsTracker();
        this.localizationValidator = new CompactionLocalizationValidator();
    }

    /**
     * Main compaction entry point. Checks scheduler thresholds and runs appropriate phase.
     */
    /**
     * Returns true if a compaction is currently in progress.
     */
    public get isCompacting(): boolean {
        return this._compactionLock !== null;
    }

    /**
     * Checks if Phase 1 compaction should be triggered based on context usage.
     */
    public shouldTriggerCompaction(messages: Message[], tokenCount: number, contextSize: number): boolean {
        return this.scheduler.shouldRunPhase1(messages, tokenCount, contextSize);
    }

    /**
     * Main compaction entry point. Serialized via promise-based locking to prevent
     * race conditions. If a compaction is already in progress, concurrent callers
     * receive the same promise and wait for the ongoing operation to complete.
     */
    public async compact(conv: Conversation): Promise<CompactionResult> {
        // If a compaction is already in progress, return the existing promise.
        // This serializes all compaction calls: concurrent triggers wait for the
        // ongoing compaction to finish rather than starting a parallel one.
        if (this._compactionLock) {
            console.log('[MemoryCompactor] Compaction already in progress. Waiting for existing operation to complete.');
            return this._compactionLock;
        }

        // Create the lock promise and store it so concurrent callers can await it.
        this._compactionLock = this._executeCompaction(conv);

        try {
            const result = await this._compactionLock;
            return result;
        } finally {
            // Always clear the lock, even if compaction throws.
            this._compactionLock = null;
        }
    }

    /**
     * Internal implementation of the compaction logic. Separated from compact()
     * so the lock management (set/clear) is cleanly isolated from the work.
     */
    private async _executeCompaction(conv: Conversation): Promise<CompactionResult> {
        const startTimestamp = Date.now();
        const memoryBeforeBytes = process.memoryUsage().heapUsed;
        let serializationTimeMs = 0;
        let diskWriteTimeMs = 0;
        let diskReadTimeMs = 0;
        let phase1DurationMs = 0;
        let phase2DurationMs = 0;

        const result: CompactionResult = { phase1Run: false, phase2Run: false, memoriesCreated: 0 };
        let compactedMessageIds: string[] = [];

        if (!this.config.enableMemoryCompaction) {
            return result;
        }

        const tokenCount = await conv.calculateBasePromptTokens();
        const contextSize = conv.textGenApiConnection.context || 8192;

        // Phase 1: Check if we need to compact recent messages
        if (this.scheduler.shouldRunPhase1(conv.messages, tokenCount, contextSize)) {
            const messagesToCompact = this.selectMessagesForCompaction(conv, tokenCount, contextSize);
            if (messagesToCompact.length > 0) {
                const phase1Start = Date.now();
                const phase1Results = await this.phase1Compactor.compact(
                    messagesToCompact,
                    conv.currentSummary || ''
                );
                phase1DurationMs = Date.now() - phase1Start;

                // Validate accuracy
                const accuracyScore = this.accuracyValidator.validate(
                    messagesToCompact,
                    phase1Results
                );
                console.log(`Phase 1 compaction accuracy: ${(accuracyScore * 100).toFixed(1)}%`);

                // Track which message IDs were compacted so we can remove them from conv.messages
                compactedMessageIds = messagesToCompact.filter(m => m.id).map(m => m.id!);

                // Store results per character in memory
                for (const memory of phase1Results) {
                    for (const charId of memory.characterIds) {
                        const key = String(charId);
                        const existing = this.compactedMemories.get(key) || [];
                        existing.push(memory);
                        this.compactedMemories.set(key, existing);
                    }
                }

                // Persist compacted memories to disk for each character
                const playerId = String((conv as any).gameData?.playerID || 'default');
                const charGroups = new Map<string, CompactedMemory[]>();
                for (const memory of phase1Results) {
                    for (const charId of memory.characterIds) {
                        const key = String(charId);
                        if (!charGroups.has(key)) charGroups.set(key, []);
                        charGroups.get(key)!.push(memory);
                    }
                }
                for (const [charId, memories] of charGroups) {
                    try {
                        const storeResult = await compactedMemoryStore.saveCompactedMemory(playerId, charId, memories);
                        serializationTimeMs += storeResult.serializationTimeMs;
                        diskWriteTimeMs += storeResult.diskWriteTimeMs;
                    } catch (err) {
                        console.error(`Failed to persist compacted memory for character ${charId}:`, err);
                    }
                }

                // Remove compacted messages from conv.messages to shrink context
                const compactedIdSet = new Set(compactedMessageIds);
                conv.messages = conv.messages.filter(m => !m.id || !compactedIdSet.has(m.id));
                console.log(`Removed ${compactedMessageIds.length} compacted messages from conversation. Remaining: ${conv.messages.length}`);

                result.phase1Run = true;
                result.memoriesCreated += phase1Results.length;
                result.accuracyScore = accuracyScore;
            }
        }

        // Phase 2: Check if we need to consolidate Phase-1 summaries
        const allPhase1Memories = this.getAllCompactedMemories().filter(
            m => m.compactionLevel === 1
        );
        if (this.scheduler.shouldRunPhase2(allPhase1Memories)) {
            const phase2Start = Date.now();
            const knowledgeGraph = await this.phase2Compactor.compact(allPhase1Memories);
            phase2DurationMs = Date.now() - phase2Start;

            // Convert knowledge graph entities into CompactedMemory entries
            const phase2Memories = this.knowledgeGraphToCompactedMemories(knowledgeGraph);

            // Store Phase-2 results in memory
            for (const memory of phase2Memories) {
                for (const charId of memory.characterIds) {
                    const key = String(charId);
                    const existing = this.compactedMemories.get(key) || [];
                    existing.push(memory);
                    this.compactedMemories.set(key, existing);
                }
            }

            // Persist Phase-2 memories to disk
            const playerId = String((conv as any).gameData?.playerID || 'default');
            const charGroups = new Map<string, CompactedMemory[]>();
            for (const memory of phase2Memories) {
                for (const charId of memory.characterIds) {
                    const key = String(charId);
                    if (!charGroups.has(key)) charGroups.set(key, []);
                    charGroups.get(key)!.push(memory);
                }
            }
            for (const [charId, memories] of charGroups) {
                try {
                    const storeResult = await compactedMemoryStore.saveCompactedMemory(playerId, charId, memories);
                    serializationTimeMs += storeResult.serializationTimeMs;
                    diskWriteTimeMs += storeResult.diskWriteTimeMs;
                } catch (err) {
                    console.error(`Failed to save Phase-2 compacted memory for character ${charId}:`, err);
                }
            }

            result.phase2Run = true;
            result.memoriesCreated += phase2Memories.length;
        }

        const totalDurationMs = Date.now() - startTimestamp;
        const memoryAfterBytes = process.memoryUsage().heapUsed;

        result.metrics = {
            memoryBeforeBytes,
            memoryAfterBytes,
            totalDurationMs,
            phase1DurationMs,
            phase2DurationMs,
            serializationTimeMs,
            diskWriteTimeMs,
            diskReadTimeMs,
            accuracyScore: result.accuracyScore ?? 0,
            messagesCompacted: result.phase1Run ? compactedMessageIds.length : 0,
            phase1SummariesConsolidated: result.phase2Run ? allPhase1Memories.length : 0,
            startTimestamp,
            endTimestamp: Date.now(),
        };

        return result;
    }

    /**
     * Selects messages that should be compacted based on token budget.
     */
    private selectMessagesForCompaction(
        conv: Conversation,
        tokenCount: number,
        contextSize: number
    ): Message[] {
        const threshold = contextSize * (this.config.compactionPhase1Threshold / 100);
        const excessTokens = tokenCount - threshold;
        if (excessTokens <= 0) return [];

        const messagesToCompact: Message[] = [];
        let accumulatedTokens = 0;

        // Take oldest messages first until we've covered the excess
        for (const msg of conv.messages) {
            if (accumulatedTokens >= excessTokens) break;
            const msgTokens = conv.textGenApiConnection.calculateTokensFromMessage(msg);
            messagesToCompact.push(msg);
            accumulatedTokens += msgTokens;
        }

        return messagesToCompact;
    }

    /**
     * Converts a KnowledgeGraph into CompactedMemory entries for storage.
     */
    private knowledgeGraphToCompactedMemories(graph: KnowledgeGraph): CompactedMemory[] {
        const memories: CompactedMemory[] = [];
        const now = Date.now();
        const dateStr = new Date().toISOString().split('T')[0];

        // Create one memory per narrative thread
        for (const thread of graph.narrativeThreads) {
            const memory: CompactedMemory = {
                id: randomUUID(),
                date: dateStr,
                content: `[${thread.topic}] ${thread.summary}`,
                characterIds: this.extractCharacterIdsFromEntities(graph.entities),
                relevanceScore: 0.8, // Phase-2 memories are highly relevant
                entityReferences: graph.entities,
                compactionLevel: 2,
                sourceMessageIds: [],
                creationTimestamp: now,
            };
            memories.push(memory);
        }

        return memories;
    }

    private extractCharacterIdsFromEntities(entities: EntityReference[]): number[] {
        const ids = new Set<number>();
        for (const entity of entities) {
            if (entity.type === 'character') {
                const numId = Number(entity.name);
                if (!isNaN(numId)) ids.add(numId);
            }
        }
        return Array.from(ids);
    }

    public getCompactedMemories(characterId: string): CompactedMemory[] {
        return this.compactedMemories.get(characterId) || [];
    }

    public getAllCompactedMemories(): CompactedMemory[] {
        const allMemories: CompactedMemory[] = [];
        for (const memories of this.compactedMemories.values()) {
            allMemories.push(...memories);
        }
        return allMemories;
    }

    public initialize(config: CompactionConfig): void {
        this.config = config;
        this.phase1Compactor = new Phase1Compactor(config);
        this.phase2Compactor = new Phase2Compactor(config);
        this.scheduler = new CompactionScheduler(config);
    }

    /** Returns the metrics tracker for external performance monitoring. */
    public getMetricsTracker(): CompactionMetricsTracker {
        return this.metricsTracker;
    }

    /** Returns the localization validator for external cross-language checks. */
    public getLocalizationValidator(): CompactionLocalizationValidator {
        return this.localizationValidator;
    }

    /**
     * Loads compacted memories from disk for a given player and merges them into the in-memory map.
     * Should be called during conversation initialization to restore persisted state.
     */
    public async loadFromDisk(playerId: string): Promise<void> {
        try {
            const diskReadStart = Date.now();
            const result = await compactedMemoryStore.getAllCompactedMemories(playerId);
            const diskReadTimeMs = Date.now() - diskReadStart;
            console.log(`Loaded ${result.memories.length} compacted memories from disk for player ${playerId} in ${diskReadTimeMs}ms`);

            // Merge disk memories into in-memory map, grouped by character
            for (const memory of result.memories) {
                for (const charId of memory.characterIds) {
                    const key = String(charId);
                    const existing = this.compactedMemories.get(key) || [];
                    // Avoid duplicates by checking IDs
                    if (!existing.some(m => m.id === memory.id)) {
                        existing.push(memory);
                    }
                }
            }
        } catch (err) {
            console.error(`Failed to load compacted memories from disk for player ${playerId}:`, err);
        }
    }
    public cleanup(): void {
        // Clear the lock to unblock any waiters. The lock promise will
        // eventually resolve/reject on its own; clearing the reference
        // allows new compaction calls to proceed after cleanup.
        this._compactionLock = null;
        this.compactedMemories.clear();
    }

    /**
     * Gathers and returns the current status of the memory compactor.
     * @param tokenCount The current token count of the conversation.
     * @param contextSize The context size of the current model.
     * @returns An object containing detailed compaction status.
     */
    public getCompactionStatus(tokenCount: number, contextSize: number): any {
        const phase1Summaries = this.getAllCompactedMemories().filter(m => m.compactionLevel === 1);
        const schedulerStats = this.scheduler.getCompactionStats();

        return {
            contextUsagePct: contextSize > 0 ? Math.round((tokenCount / contextSize) * 100) : 0,
            phase1ThresholdPct: this.config.compactionPhase1Threshold,
            tokenCount: tokenCount,
            contextSize: contextSize,
            isCompacting: this.isCompacting,
            enableCompaction: this.config.enableMemoryCompaction,
            cooldownRemaining: schedulerStats.cooldownRemaining,
            phase1SummaryCount: phase1Summaries.length,
            phase2Threshold: this.config.compactionPhase2Threshold,
        };
    }
}

/**
 * Phase1Compactor - Short-term compaction.
 * Summarizes recent message blocks into concise narrative summaries,
 * preserving character names, key events, and emotional arcs.
 */
class Phase1Compactor {
    private config: CompactionConfig;

    constructor(config: CompactionConfig) {
        this.config = config;
    }

    /**
     * Compacts a set of messages into structured CompactedMemory entries.
     * Uses LLM-based summarization with regex fallback for entity extraction.
     */
    public async compact(
        messages: Message[],
        currentSummary: string
    ): Promise<CompactedMemory[]> {
        const now = Date.now();
        const dateStr = new Date().toISOString().split('T')[0];

        // Build the conversation text for summarization
        const conversationText = this.messagesToText(messages);

        // Try LLM-based extraction first, fall back to regex
        let entities: EntityReference[] = [];
        let summaryContent = '';

        if (this.config.compactionEntityExtractionMode !== 'regex') {
            try {
                const llmResult = await this.llmSummarize(conversationText, currentSummary);
                summaryContent = llmResult.summary;
                entities = llmResult.entities;
            } catch (error) {
                console.warn('LLM summarization failed, falling back to regex:', error);
                summaryContent = this.heuristicSummarize(conversationText, currentSummary);
                entities = this.extractEntitiesRegex(conversationText);
            }
        } else {
            summaryContent = this.heuristicSummarize(conversationText, currentSummary);
            entities = this.extractEntitiesRegex(conversationText);
        }

        // Calculate relevance score based on priority elements
        const relevanceScore = this.calculateRelevance(summaryContent);

        // Extract character IDs from the messages
        const characterIds = this.extractCharacterIds(messages);

        const compactedMemory: CompactedMemory = {
            id: randomUUID(),
            date: dateStr,
            content: summaryContent,
            characterIds,
            relevanceScore,
            entityReferences: entities,
            compactionLevel: 1,
            sourceMessageIds: messages.filter(m => m.id).map(m => m.id!),
            creationTimestamp: now,
        };

        return [compactedMemory];
    }

    /**
     * Converts messages to a plain text format for summarization.
     */
    private messagesToText(messages: Message[]): string {
        return messages
            .map(m => `${m.name || m.role}: ${m.content}`)
            .join('\n');
    }

    /**
     * LLM-based summarization. Returns structured summary and entities.
     * NOTE: This is a stub that uses heuristic fallback until LLM integration is wired.
     */
    private async llmSummarize(
        conversationText: string,
        currentSummary: string
    ): Promise<{ summary: string; entities: EntityReference[] }> {
        // TODO: Wire up to compactionApiConnectionConfig when LLM integration is ready.
        // For now, fall back to heuristic summarization.
        throw new Error('LLM summarization not yet wired');
    }

    /**
     * Heuristic/regex-based summarization as fallback.
     */
    private heuristicSummarize(
        conversationText: string,
        currentSummary: string
    ): string {
        const lines = conversationText.split('\n').filter(l => l.trim());
        if (lines.length === 0) return '';

        // Extract key sentences: first line, lines with emotional/action markers, last line
        const keyLines: string[] = [];
        const emotionPattern = /\*[^*]+\*|\b(angry|happy|sad|furious|joyful|worried|excited|afraid|grateful)\b/i;
        const actionPattern = /\b(decided|agreed|refused|promised|threatened|confessed|revealed|planned)\b/i;

        for (const line of lines) {
            if (emotionPattern.test(line) || actionPattern.test(line)) {
                keyLines.push(line);
            }
        }

        // Always include first and last substantive lines
        const firstLine = lines[0];
        const lastLine = lines[lines.length - 1];

        const summaryParts: string[] = [];
        if (currentSummary) {
            summaryParts.push(`[Previous: ${currentSummary.substring(0, 100)}]`);
        }
        summaryParts.push(firstLine);
        if (keyLines.length > 0) {
            summaryParts.push(...keyLines.slice(0, 3)); // Max 3 key lines
        }
        if (lastLine !== firstLine) {
            summaryParts.push(lastLine);
        }

        return summaryParts.join(' | ');
    }

    /**
     * Regex-based entity extraction from conversation text.
     */
    private extractEntitiesRegex(text: string): EntityReference[] {
        const entities: EntityReference[] = [];

        // Extract character names (capitalized words that appear as speakers)
        const speakerPattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*):/gm;
        const speakerNames = new Set<string>();
        let match;
        while ((match = speakerPattern.exec(text)) !== null) {
            speakerNames.add(match[1]);
        }

        for (const name of speakerNames) {
            entities.push({
                name,
                type: 'character',
                relationships: [],
                firstMentionedDate: new Date().toISOString().split('T')[0],
                lastMentionedDate: new Date().toISOString().split('T')[0],
                mentionCount: (text.match(new RegExp(name, 'g')) || []).length,
            });
        }

        // Extract relationship keywords
        const relationshipPatterns: { regex: RegExp; type: Relationship['type'] }[] = [
            { regex: /\b(rival|enemy|hates|despises)\b/gi, type: 'rival' },
            { regex: /\b(friend|ally|companion|trusts)\b/gi, type: 'friend' },
            { regex: /\b(lover|love|romance|affair)\b/gi, type: 'lover' },
            { regex: /\b(family|brother|sister|mother|father|son|daughter|cousin|uncle|aunt)\b/gi, type: 'family' },
        ];

        for (const { regex, type } of relationshipPatterns) {
            let relMatch;
            while ((relMatch = regex.exec(text)) !== null) {
                entities.push({
                    name: relMatch[1],
                    type: 'relationship',
                    relationships: [],
                    firstMentionedDate: new Date().toISOString().split('T')[0],
                    lastMentionedDate: new Date().toISOString().split('T')[0],
                    mentionCount: 1,
                });
            }
        }

        return entities;
    }

    /**
     * Calculates relevance score based on presence of priority elements.
     */
    private calculateRelevance(summary: string): number {
        const priorityElements = this.config.compactionPriorityElements;
        if (!priorityElements || priorityElements.length === 0) return 0.5;

        let matchCount = 0;
        const lowerSummary = summary.toLowerCase();

        for (const element of priorityElements) {
            if (lowerSummary.includes(element.toLowerCase())) {
                matchCount++;
            }
        }

        return Math.min(1.0, matchCount / priorityElements.length);
    }

    /**
     * Extracts unique character IDs from messages.
     */
    private extractCharacterIds(messages: Message[]): number[] {
        const ids = new Set<number>();
        for (const msg of messages) {
            if ((msg as any).characterId && typeof (msg as any).characterId === 'number') {
                ids.add((msg as any).characterId);
            }
        }
        return Array.from(ids);
    }
}

/**
 * Phase2Compactor - Long-term compaction.
 * Extracts structured entities (relationships, plot points, character development)
 * from multiple Phase-1 summaries into a compact knowledge graph representation.
 */
class Phase2Compactor {
    private config: CompactionConfig;

    constructor(config: CompactionConfig) {
        this.config = config;
    }

    /**
     * Consolidates multiple Phase-1 summaries into a KnowledgeGraph.
     */
    public async compact(phase1Summaries: CompactedMemory[]): Promise<KnowledgeGraph> {
        if (phase1Summaries.length === 0) {
            return { entities: [], edges: [], narrativeThreads: [], version: 1 };
        }

        // Collect all entities from Phase-1 summaries
        const allEntities = this.collectEntities(phase1Summaries);

        // Deduplicate entities
        const deduplicatedEntities = this.deduplicateEntities(allEntities);

        // Build edges from entity relationships
        const edges = this.buildEdges(deduplicatedEntities);

        // Extract narrative threads from summary content
        const narrativeThreads = this.extractNarrativeThreads(phase1Summaries);

        return {
            entities: deduplicatedEntities,
            edges,
            narrativeThreads,
            version: 1,
        };
    }

    /**
     * Collects all entity references from Phase-1 summaries.
     */
    private collectEntities(summaries: CompactedMemory[]): EntityReference[] {
        const entities: EntityReference[] = [];
        for (const summary of summaries) {
            if (summary.entityReferences) {
                entities.push(...summary.entityReferences);
            }
        }
        return entities;
    }

    /**
     * Deduplicates entities by name, merging their relationships and updating mention counts.
     */
    private deduplicateEntities(entities: EntityReference[]): EntityReference[] {
        const entityMap = new Map<string, EntityReference>();

        for (const entity of entities) {
            const key = `${entity.type}:${entity.name.toLowerCase()}`;
            const existing = entityMap.get(key);

            if (existing) {
                // Merge: update mention count, extend date range, merge relationships
                existing.mentionCount += entity.mentionCount;

                if (entity.firstMentionedDate < existing.firstMentionedDate) {
                    existing.firstMentionedDate = entity.firstMentionedDate;
                }
                if (entity.lastMentionedDate > existing.lastMentionedDate) {
                    existing.lastMentionedDate = entity.lastMentionedDate;
                }

                // Merge relationships, deduplicating by target+type
                const relMap = new Map<string, Relationship>();
                for (const rel of [...existing.relationships, ...entity.relationships]) {
                    const relKey = `${rel.targetEntityName}:${rel.type}`;
                    if (!relMap.has(relKey)) {
                        relMap.set(relKey, rel);
                    }
                }
                existing.relationships = Array.from(relMap.values());
            } else {
                entityMap.set(key, { ...entity });
            }
        }

        return Array.from(entityMap.values());
    }

    /**
     * Builds knowledge graph edges from entity relationships.
     */
    private buildEdges(entities: EntityReference[]): KnowledgeEdge[] {
        const edges: KnowledgeEdge[] = [];
        const edgeSet = new Set<string>();

        for (const entity of entities) {
            for (const rel of entity.relationships) {
                const edgeKey = `${entity.name}:${rel.targetEntityName}:${rel.type}`;
                if (!edgeSet.has(edgeKey)) {
                    edgeSet.add(edgeKey);
                    edges.push({
                        source: entity.name,
                        target: rel.targetEntityName,
                        label: rel.type,
                    });
                }
            }
        }

        return edges;
    }

    /**
     * Extracts narrative threads from Phase-1 summary content.
     */
    private extractNarrativeThreads(summaries: CompactedMemory[]): NarrativeThread[] {
        const threads: NarrativeThread[] = [];

        // Group summaries by topic keywords
        const topicKeywords: { topic: string; keywords: string[] }[] = [
            { topic: 'Conflict', keywords: ['war', 'battle', 'fight', 'attack', 'defend', 'rival', 'enemy'] },
            { topic: 'Alliance', keywords: ['alliance', 'ally', 'treaty', 'pact', 'marriage', 'betrothal'] },
            { topic: 'Intrigue', keywords: ['secret', 'plot', 'scheme', 'conspiracy', 'betray', 'murder'] },
            { topic: 'Development', keywords: ['born', 'died', 'inherited', 'title', 'crowned', 'usurp'] },
        ];

        for (const { topic, keywords } of topicKeywords) {
            const relevantSummaries = summaries.filter(s =>
                keywords.some(kw => s.content.toLowerCase().includes(kw))
            );

            if (relevantSummaries.length > 0) {
                const combinedSummary = relevantSummaries
                    .map(s => s.content)
                    .join('; ');

                threads.push({
                    id: randomUUID(),
                    topic,
                    summary: combinedSummary.substring(0, 500), // Truncate to reasonable length
                });
            }
        }

        // If no topic threads found, create a general thread
        if (threads.length === 0 && summaries.length > 0) {
            threads.push({
                id: randomUUID(),
                topic: 'General',
                summary: summaries.map(s => s.content).join('; ').substring(0, 500),
            });
        }

        return threads;
    }
}

/**
 * CompactionScheduler - Monitors conversation state and determines when compaction should run.
 */
class CompactionScheduler {
    private config: CompactionConfig;
    private lastCompactionTime: number = 0;

    constructor(config: CompactionConfig) {
        this.config = config;
    }

    /**
     * Determines if Phase 1 compaction should run based on token count vs threshold.
     */
    public shouldRunPhase1(messages: Message[], tokenCount: number, contextSize: number): boolean {
        if (!this.config.enableMemoryCompaction) {
            return false;
        }

        const now = Date.now();
        if (now - this.lastCompactionTime < this.config.compactionCooldownMinutes * 60 * 1000) {
            return false;
        }

        const threshold = contextSize * (this.config.compactionPhase1Threshold / 100);
        const shouldRun = tokenCount > threshold;

        if (shouldRun) {
            this.lastCompactionTime = now;
        }

        return shouldRun;
    }

    /**
     * Determines if Phase 2 compaction should run based on Phase-1 summary count.
     */
    public shouldRunPhase2(phase1Summaries: CompactedMemory[]): boolean {
        if (!this.config.enableMemoryCompaction) {
            return false;
        }

        return phase1Summaries.length > this.config.compactionPhase2Threshold;
    }

    /**
     * Returns the next scheduled compaction time in ms from now.
     */
    public scheduleNextCompaction(): number {
        return this.config.compactionCooldownMinutes * 60 * 1000;
    }

    /**
     * Returns current compaction statistics.
     */
    public getCompactionStats(): CompactionStats {
        return {
            lastCompactionTime: this.lastCompactionTime,
            cooldownRemaining: Math.max(
                0,
                this.lastCompactionTime +
                    this.config.compactionCooldownMinutes * 60 * 1000 -
                    Date.now()
            ),
        };
    }
}

/**
 * ContextAccuracyValidator - Validates that compacted content preserves key narrative elements.
 */
class ContextAccuracyValidator {
    /**
     * Validates compaction accuracy by comparing original messages to compacted output.
     * Returns a score between 0 and 1, where 1 means perfect preservation.
     */
    public validate(
        originalMessages: Message[],
        compactedMemories: CompactedMemory[]
    ): number {
        if (originalMessages.length === 0 || compactedMemories.length === 0) {
            return 0;
        }

        // Extract key entities from original messages
        const originalEntities = this.extractKeyEntities(originalMessages);

        // Check how many original entities are preserved in compacted output
        const compactedText = compactedMemories.map(m => m.content).join(' ');
        const compactedTextLower = compactedText.toLowerCase();

        let preservedCount = 0;
        for (const entity of originalEntities) {
            if (compactedTextLower.includes(entity.toLowerCase())) {
                preservedCount++;
            }
        }

        return originalEntities.length > 0
            ? preservedCount / originalEntities.length
            : 0;
    }

    /**
     * Extracts key entities (names, significant terms) from messages.
     */
    private extractKeyEntities(messages: Message[]): string[] {
        const entities = new Set<string>();

        for (const msg of messages) {
            // Extract speaker names
            if (msg.name) {
                entities.add(msg.name);
            }

            // Extract capitalized proper nouns (potential character/place names)
            const properNouns = msg.content.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g);
            if (properNouns) {
                for (const noun of properNouns) {
                    if (noun.length > 3) {
                        entities.add(noun);
                    }
                }
            }
        }

        return Array.from(entities);
    }
}

/** Result of a compaction operation. */
export interface CompactionResult {
    phase1Run: boolean;
    phase2Run: boolean;
    memoriesCreated: number;
    accuracyScore?: number;
    metrics?: CompactionMetrics;
}

/** Statistics about the compaction scheduler state. */
export interface CompactionStats {
    lastCompactionTime: number;
    cooldownRemaining: number;
}
