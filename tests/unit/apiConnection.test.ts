
/**
 * Unit tests for apiConnection.ts embedding providers
 * Test cases: UT-EP-01 through UT-EP-10
 */
import { EmbeddingProvider } from '../../src/shared/apiConnection';

global.fetch = jest.fn();
const fetchMock = fetch as jest.Mock;

describe('EmbeddingProvider', () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    // UT-EP-01 & 10
    test('UT-EP-01 & 10: OpenAI happy path and testConnection', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.1] }] }) });
        const provider = new EmbeddingProvider('openai', 'text-embedding-3-small', 'https://api.openai.com/v1', 'sk-test');
        const result = await provider.generateEmbedding('hello');
        expect(result.provider).toBe('openai');
        expect(result.vector.length).toBe(1);
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(true);
    });

    // UT-EP-02
    test('UT-EP-02: OpenAI invalid API key', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
        const provider = new EmbeddingProvider('openai', 'text-embedding-3-small', 'https://api.openai.com/v1', 'bad-key');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow();
    });

    // UT-EP-03 & 10
    test('UT-EP-03 & 10: Ollama happy path and testConnection', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.2] }) });
        const provider = new EmbeddingProvider('ollama', 'nomic-embed-text', 'http://localhost:11434', '');
        const result = await provider.generateEmbedding('hello');
        expect(result.provider).toBe('ollama');
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(true);
    });
    
    // UT-EP-04
    test('UT-EP-04: Ollama server unreachable', async () => {
        fetchMock.mockRejectedValueOnce(new Error('connection refused'));
        const provider = new EmbeddingProvider('ollama', 'nomic-embed-text', 'http://localhost:11434', '');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow('connection refused');
    });

    // UT-EP-05, 06, 10
    test('UT-EP-05, 06, & 10: ONNX placeholder and testConnection', async () => {
        const provider = new EmbeddingProvider('onnx', 'model', 'file:///model', '');
        await expect(provider.generateEmbedding('hello')).rejects.toThrow(/onnxruntime-node/);
        const testResult = await provider.testConnection();
        expect(testResult.success).toBe(false);
    });

    // UT-EP-07
    test('UT-EP-07: Empty string input', async () => {
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('')).rejects.toThrow(/empty text/i);
    });

    // UT-EP-08
    test('UT-EP-08: Very long text', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.3] }] }) });
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('a'.repeat(10000))).resolves.toBeDefined();
    });
    
    // UT-EP-09
    test('UT-EP-09: Special characters in text', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ embedding: [0.4] }] }) });
        const provider = new EmbeddingProvider('openai', 'model', 'url', 'key');
        await expect(provider.generateEmbedding('\n🚀<script>')).resolves.toBeDefined();
    });
});
