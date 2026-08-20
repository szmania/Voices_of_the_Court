import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

/**
 * Represents a single memory entry stored in the vector database.
 */
export interface Memory {
    id: string;
    characterId: string;
    playerId?: string;
    text: string;
    vector: Float32Array | number[];
    timestamp: number;
    emotion: string;
    decay: number;
    accessCount: number;
    lastAccessed: number;
}

/**
 * Options for semantic search queries.
 */
export interface SearchOptions {
    topK?: number;
    minSimilarity?: number;
}

/**
 * MemoryManager provides a vector-based semantic memory store for characters.
 * Uses better-sqlite3 with the sqlite-vec extension for vector similarity search.
 *
 * Each character has an isolated memory space. Memories support:
 * - CRUD operations
 * - Semantic (vector) similarity search
 * - Decay over time
 * - Consolidation of similar memories
 */
export class MemoryManager {
    private db: Database.Database;
    private dbPath: string;
    private vecAvailable: boolean = false;

    /**
     * Initialize the memory database at the given path.
     * Creates the database file and tables if they don't exist.
     * @param userDataPath - Base path for user data storage.
     */
    constructor(userDataPath: string) {
        const memoryDir = path.join(userDataPath, 'memory');
        if (!fs.existsSync(memoryDir)) {
            fs.mkdirSync(memoryDir, { recursive: true });
        }

        this.dbPath = path.join(memoryDir, 'memories.db');
        this.db = new Database(this.dbPath);

        // Enable WAL mode for better concurrent performance
        this.db.pragma('journal_mode = WAL');

        this.initializeDatabase();
        this.loadVecExtension();
    }

    /**
     * Create the core tables for memory storage.
     */
    private initializeDatabase(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                character_id TEXT NOT NULL,
                player_id TEXT DEFAULT '',
                text TEXT NOT NULL,
                embedding BLOB,
                timestamp INTEGER NOT NULL,
                emotion TEXT DEFAULT 'neutral',
                decay REAL DEFAULT 0.0,
                access_count INTEGER DEFAULT 0,
                last_accessed INTEGER DEFAULT 0
            );
        `);

        // Backwards compatibility: Add player_id if it doesn't exist.
        try {
            const columns = this.db.pragma('table_info(memories)') as { name: string }[];
            if (columns.length > 0) {
                if (!columns.some(col => col.name === 'player_id')) {
                    console.log("MemoryManager: Old schema detected. Adding 'player_id' column to memories table for backward compatibility.");
                    this.db.exec("ALTER TABLE memories ADD COLUMN player_id TEXT DEFAULT ''");
                }
                // Migration from 'vector' to 'embedding'
                if (columns.some(col => col.name === 'vector') && !columns.some(col => col.name === 'embedding')) {
                    console.log("MemoryManager: Old schema detected. Renaming 'vector' column to 'embedding'.");
                    this.db.exec("ALTER TABLE memories RENAME COLUMN vector TO embedding");
                }
            }
        } catch (error) {
            // If pragma fails, table likely doesn't exist yet, which is fine as it will be created correctly.
            console.warn("MemoryManager: Could not check schema, proceeding with index creation.", error);
        }

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_memories_character
                ON memories(character_id);

            CREATE INDEX IF NOT EXISTS idx_memories_player
                ON memories(player_id);

            CREATE INDEX IF NOT EXISTS idx_memories_timestamp
                ON memories(timestamp);

            CREATE INDEX IF NOT EXISTS idx_memories_decay
                ON memories(decay);
        `);
    }

    /**
     * Attempt to load the sqlite-vec extension for vector similarity search.
     * Falls back gracefully if the extension is not available.
     */
    private loadVecExtension(): void {
        try {
            // sqlite-vec provides the vec0 virtual table for vector storage and search
            this.db.loadExtension('vec0');
            this.vecAvailable = true;

            // Create the vector virtual table for similarity search
            this.db.exec(`
                CREATE VIRTUAL TABLE IF NOT EXISTS memory_vectors USING vec0(
                    memory_id TEXT,
                    embedding FLOAT[1536]
                );
            `);

            console.log('MemoryManager: sqlite-vec extension loaded successfully.');
        } catch (error: any) {
            console.warn(
                'MemoryManager: sqlite-vec extension not available. ' +
                'Semantic search will fall back to exact text matching. ' +
                `Error: ${error?.message || String(error)}`
            );
            this.vecAvailable = false;
        }
    }

    /**
     * Check if vector similarity search is available.
     */
    isVecAvailable(): boolean {
        return this.vecAvailable;
    }

    /**
     * Insert a new memory into the store.
     * @param memory - The memory entry to insert.
     */
    insertMemory(memory: Memory): void {
        const vectorBlob = this.vectorToBlob(memory.vector);

        const stmt = this.db.prepare(`
            INSERT INTO memories (id, character_id, player_id, text, embedding, timestamp, emotion, decay, access_count, last_accessed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            memory.id,
            memory.characterId,
            memory.playerId || '',
            memory.text,
            vectorBlob,
            memory.timestamp,
            memory.emotion || 'neutral',
            memory.decay || 0.0,
            memory.accessCount || 0,
            memory.lastAccessed || Date.now()
        );

        // Also insert into the vector index if available
        if (this.vecAvailable && memory.vector) {
            this.insertVectorIndex(memory.id, memory.vector);
        }
    }

    /**
     * Retrieve a memory by its unique ID.
     * @param id - The memory ID.
     * @returns The memory entry or null if not found.
     */
    getMemory(id: string): Memory | null {
        const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;

        // Update access metadata
        this.db.prepare(
            'UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?'
        ).run(Date.now(), id);

        return this.rowToMemory(row);
    }

    /**
     * Get all memories for a specific character.
     * @param characterId - The character ID to filter by.
     * @param limit - Maximum number of memories to return (default: 100).
     * @returns Array of memory entries sorted by recency.
     */
    getMemoriesByCharacter(characterId: string, limit: number = 100, playerId?: string): Memory[] {
        let query: string;
        let params: any[];
        
        if (playerId) {
            query = 'SELECT * FROM memories WHERE character_id = ? AND player_id = ? ORDER BY timestamp DESC LIMIT ?';
            params = [characterId, playerId, limit];
        } else if (characterId) {
            query = 'SELECT * FROM memories WHERE character_id = ? ORDER BY timestamp DESC LIMIT ?';
            params = [characterId, limit];
        } else {
            query = 'SELECT * FROM memories ORDER BY timestamp DESC LIMIT ?';
            params = [limit];
        }
        
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as any[];
        return rows.map(row => this.rowToMemory(row));
    }

    /**
     * Search for semantically similar memories using vector similarity.
     * Falls back to text-based search if sqlite-vec is not available.
     * @param characterId - The character to search within.
     * @param queryVector - The query embedding vector.
     * @param options - Search options (topK, minSimilarity).
     * @returns Array of matching memories sorted by similarity.
     */
    searchSimilar(
        characterId: string,
        queryVector: number[],
        options: SearchOptions = {}
    ): Memory[] {
        const { topK = 10, minSimilarity = 0.0 } = options;

        if (this.vecAvailable) {
            return this.vectorSearch(characterId, queryVector, topK, minSimilarity);
        }

        // Fallback: text-based search using LIKE matching
        return this.textSearch(characterId, topK);
    }

    /**
     * Perform vector similarity search using sqlite-vec.
     */
    private vectorSearch(
        characterId: string,
        queryVector: number[],
        topK: number,
        minSimilarity: number
    ): Memory[] {
        const queryBlob = Buffer.from(new Float32Array(queryVector).buffer);

        // Use sqlite-vec's KNN-style search via the vec0 virtual table
        const stmt = this.db.prepare(`
            SELECT m.*, vec_distance_L2(mv.embedding, ?) as distance
            FROM memory_vectors mv
            JOIN memories m ON m.id = mv.memory_id
            WHERE m.character_id = ?
            ORDER BY distance ASC
            LIMIT ?
        `);

        const rows = stmt.all(queryBlob, characterId, topK) as any[];

        // Convert L2 distance to cosine similarity approximation
        // and filter by minimum similarity
        return rows
            .map(row => {
                const memory = this.rowToMemory(row);
                const similarity = 1.0 / (1.0 + (row.distance || 0));
                return { memory, similarity };
            })
            .filter(item => item.similarity >= minSimilarity)
            .map(item => item.memory);
    }

    /**
     * Fallback text-based search when vector search is unavailable.
     */
    private textSearch(characterId: string, limit: number): Memory[] {
        const stmt = this.db.prepare(
            'SELECT * FROM memories WHERE character_id = ? ORDER BY timestamp DESC LIMIT ?'
        );
        const rows = stmt.all(characterId, limit) as any[];
        return rows.map(row => this.rowToMemory(row));
    }

    /**
     * Update an existing memory's fields.
     * @param id - The memory ID to update.
     * @param updates - Partial memory fields to update.
     */
    updateMemory(id: string, updates: Partial<Memory>): void {
        const existing = this.getMemory(id);
        if (!existing) {
            throw new Error(`Memory with id '${id}' not found.`);
        }

        const fields: string[] = [];
        const values: any[] = [];

        if (updates.text !== undefined) {
            fields.push('text = ?');
            values.push(updates.text);
        }
        if (updates.vector !== undefined) {
            fields.push('embedding = ?');
            values.push(this.vectorToBlob(updates.vector));

            // Update vector index if available
            if (this.vecAvailable) {
                this.removeVectorIndex(id);
                this.insertVectorIndex(id, updates.vector);
            }
        }
        if (updates.emotion !== undefined) {
            fields.push('emotion = ?');
            values.push(updates.emotion);
        }
        if (updates.decay !== undefined) {
            fields.push('decay = ?');
            values.push(updates.decay);
        }
        if (updates.timestamp !== undefined) {
            fields.push('timestamp = ?');
            values.push(updates.timestamp);
        }

        if (fields.length === 0) return;

        values.push(id);
        const sql = `UPDATE memories SET ${fields.join(', ')} WHERE id = ?`;
        this.db.prepare(sql).run(...values);
    }

    /**
     * Delete a memory by its ID.
     * @param id - The memory ID to delete.
     */
    deleteMemory(id: string): void {
        this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);

        if (this.vecAvailable) {
            this.removeVectorIndex(id);
        }
    }

    /**
     * Delete all memories for a specific character.
     * @param characterId - The character whose memories should be deleted.
     */
    deleteMemoriesByCharacter(characterId: string): void {
        // Get IDs for vector index cleanup
        const ids = this.db.prepare(
            'SELECT id FROM memories WHERE character_id = ?'
        ).all(characterId) as any[];

        this.db.prepare('DELETE FROM memories WHERE character_id = ?').run(characterId);

        if (this.vecAvailable) {
            for (const row of ids) {
                this.removeVectorIndex(row.id);
            }
        }
    }

    /**
     * Apply time-based decay to memories for a character.
     * Memories older than the decay threshold have their decay score increased.
     * Memories that exceed the maximum decay threshold are removed.
     * @param characterId - The character whose memories to decay.
     * @param decayRate - Decay rate per day (default: 0.01).
     * @param maxDecay - Maximum decay before removal (default: 1.0).
     */
    applyDecay(
        characterId: string,
        decayRate: number = 0.01,
        maxDecay: number = 1.0
    ): void {
        const now = Date.now();
        const msPerDay = 24 * 60 * 60 * 1000;

        // Update decay for all memories of this character
        const stmt = this.db.prepare(`
            UPDATE memories
            SET decay = decay + ((? - last_accessed) / ?) * ?
            WHERE character_id = ?
        `);
        stmt.run(now, msPerDay, decayRate, characterId);

        // Remove memories that have exceeded the maximum decay
        this.db.prepare(`
            DELETE FROM memories
            WHERE character_id = ? AND decay >= ?
        `).run(characterId, maxDecay);
    }

    /**
     * Consolidate similar memories for a character.
     * Memories with high vector similarity are merged into a single entry.
     * @param characterId - The character whose memories to consolidate.
     * @param similarityThreshold - Cosine similarity threshold for merging (default: 0.85).
     */
    consolidateMemories(
        characterId: string,
        similarityThreshold: number = 0.85
    ): void {
        if (!this.vecAvailable) {
            console.warn('MemoryManager: Consolidation requires sqlite-vec. Skipping.');
            return;
        }

        const memories = this.getMemoriesByCharacter(characterId, 1000);
        if (memories.length < 2) return;

        const merged = new Set<string>();

        for (let i = 0; i < memories.length; i++) {
            if (merged.has(memories[i].id)) continue;

            for (let j = i + 1; j < memories.length; j++) {
                if (merged.has(memories[j].id)) continue;

                const similarity = this.cosineSimilarity(
                    memories[i].vector as number[],
                    memories[j].vector as number[]
                );

                if (similarity >= similarityThreshold) {
                    // Merge j into i: keep the more recent timestamp, combine text
                    const mergedText = memories[i].text + ' | ' + memories[j].text;
                    const mergedTimestamp = Math.max(memories[i].timestamp, memories[j].timestamp);
                    const mergedEmotion = memories[i].emotion || memories[j].emotion;

                    this.updateMemory(memories[i].id, {
                        text: mergedText,
                        timestamp: mergedTimestamp,
                        emotion: mergedEmotion
                    });

                    this.deleteMemory(memories[j].id);
                    merged.add(memories[j].id);
                }
            }
        }

        if (merged.size > 0) {
            console.log(
                `MemoryManager: Consolidated ${merged.size} memories for character ${characterId}.`
            );
        }
    }

    /**
     * Get the total count of memories for a character.
     */
    getMemoryCount(characterId: string): number {
        const stmt = this.db.prepare(
            'SELECT COUNT(*) as count FROM memories WHERE character_id = ?'
        );
        const row = stmt.get(characterId) as any;
        return row?.count || 0;
    }

    /**
     * Close the database connection.
     */
    close(): void {
        this.db.close();
    }

    // --- Private Helpers ---

    /**
     * Convert a vector (Float32Array or number[]) to a BLOB for storage.
     */
    private vectorToBlob(vector: Float32Array | number[]): Buffer {
        const arr = vector instanceof Float32Array ? vector : new Float32Array(vector);
        return Buffer.from(arr.buffer);
    }

    /**
     * Convert a BLOB back to a Float32Array.
     */
    private blobToVector(blob: Buffer): Float32Array {
        return new Float32Array(blob.buffer, blob.byteOffset, blob.length / 4);
    }

    /**
     * Convert a database row to a Memory object.
     */
    private rowToMemory(row: any): Memory {
        return {
            id: row.id,
            characterId: row.character_id,
            playerId: row.player_id || '',
            text: row.text,
            vector: row.embedding ? this.blobToVector(row.embedding) : new Float32Array(),
            timestamp: row.timestamp,
            emotion: row.emotion || 'neutral',
            decay: row.decay || 0.0,
            accessCount: row.access_count || 0,
            lastAccessed: row.last_accessed || 0
        };
    }

    /**
     * Insert a vector into the sqlite-vec virtual table.
     */
    private insertVectorIndex(memoryId: string, vector: Float32Array | number[]): void {
        if (!this.vecAvailable) return;

        try {
            const vecBlob = this.vectorToBlob(vector);
            this.db.prepare(
                'INSERT INTO memory_vectors (memory_id, embedding) VALUES (?, ?)'
            ).run(memoryId, vecBlob);
        } catch (error: any) {
            console.warn(`MemoryManager: Failed to insert vector index for ${memoryId}: ${error?.message}`);
        }
    }

    /**
     * Remove a vector from the sqlite-vec virtual table.
     */
    private removeVectorIndex(memoryId: string): void {
        if (!this.vecAvailable) return;

        try {
            this.db.prepare(
                'DELETE FROM memory_vectors WHERE memory_id = ?'
            ).run(memoryId);
        } catch (error: any) {
            console.warn(`MemoryManager: Failed to remove vector index for ${memoryId}: ${error?.message}`);
        }
    }

    /**
     * Calculate cosine similarity between two vectors.
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error(
                `Vector dimension mismatch: ${a.length} vs ${b.length}`
            );
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) return 0;

        return dotProduct / denominator;
    }

    /**
     * Efficiently inserts multiple memories in a single transaction.
     * @param memories - An array of memory objects to insert.
     */
    public batchInsertMemories(memories: Memory[]): void {
        if (!memories || memories.length === 0) {
            return;
        }

        const insertStmt = this.db.prepare(`
            INSERT OR REPLACE INTO memories (id, character_id, player_id, text, embedding, timestamp, emotion, decay, access_count, last_accessed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertVectorStmt = this.vecAvailable ? this.db.prepare(
            'INSERT OR REPLACE INTO memory_vectors (memory_id, embedding) VALUES (?, ?)'
        ) : null;

        const insertMany = this.db.transaction((mems: Memory[]) => {
            for (const memory of mems) {
                const vectorBlob = this.vectorToBlob(memory.vector);
                insertStmt.run(
                    memory.id,
                    memory.characterId,
                    memory.playerId || '',
                    memory.text,
                    vectorBlob,
                    memory.timestamp,
                    memory.emotion || 'neutral',
                    memory.decay || 0.0,
                    memory.accessCount || 0,
                    memory.lastAccessed || Date.now()
                );

                if (insertVectorStmt && memory.vector && memory.vector.length > 0) {
                    insertVectorStmt.run(memory.id, vectorBlob);
                }
            }
        });

        try {
            insertMany(memories);
            console.log(`MemoryManager: Batch inserted ${memories.length} memories.`);
        } catch (error) {
            console.error('MemoryManager: Batch memory insert failed:', error);
            // As a fallback, try inserting one by one to salvage what we can
            for (const memory of memories) {
                try {
                    this.insertMemory(memory);
                } catch (individualError) {
                    console.error(`MemoryManager: Failed to insert individual memory ${memory.id}:`, individualError);
                }
            }
        }
    }
}
