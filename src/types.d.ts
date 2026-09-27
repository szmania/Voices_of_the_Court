declare module 'argon2' {
  export function hash(plain: string | Buffer, options?: any): Promise<string>;
  export function verify(hash: string, plain: string | Buffer): Promise<boolean>;
  export const argon2id: number;
  export const argon2i: number;
  export const argon2d: number;
}

declare module 'gpt-tokenizer' {
  export function encode(text: string): number[];
  export function decode(tokens: number[]): string;
}

declare module 'llama-tokenizer-js' {
  const tokenizer: {
    encode(text: string): number[];
    decode(tokens: number[]): string;
  };
  export default tokenizer;
}

// --- Neural Memory System Types ---

/** Configuration for the embedding API connection, reusing the existing ApiConnectionConfig pattern */
interface MemoryEmbeddingConfig {
    provider: 'openai' | 'ollama' | 'onnx';
    model: string;
    baseUrl: string;
    apiKey: string;
}

/** A single memory entry stored in the vector database */
interface Memory {
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

/** Interface for interacting with the memory database */
interface MemoryStore {
    insert(memory: Memory): void;
    getById(id: string): Memory | null;
    getByCharacter(characterId: string, limit?: number): Memory[];
    searchSimilar(characterId: string, queryVector: number[], topK?: number): Memory[];
    update(id: string, updates: Partial<Memory>): void;
    delete(id: string): void;
    deleteByCharacter(characterId: string): void;
    applyDecay(characterId: string): void;
    consolidate(characterId: string, similarityThreshold?: number): void;
}
