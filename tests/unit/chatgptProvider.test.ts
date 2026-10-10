import { ChatGPTProvider, readSubscriptionStream, subscriptionRequest } from '../../src/main/auth/chatgptProvider';
import { ChatGPTError } from '../../src/main/auth/chatgptErrors';

const event = (value: any) => `data: ${JSON.stringify(value)}\r\n\r\n`;
function stream(events: any[], width = 11): Response {
    const bytes = new TextEncoder().encode(events.map(event).join(''));
    return new Response(new ReadableStream({ start(controller) {
        for (let i = 0; i < bytes.length; i += width) controller.enqueue(bytes.slice(i, i + width));
        controller.close();
    } }));
}
const completed = { type: 'response.completed', response: { status: 'completed' } };
const delta = (text: string) => ({ type: 'response.output_text.delta', delta: text });
function setup(response: () => Response) {
    const lifetime = new AbortController();
    const auth = { signal: lifetime.signal,
        access: jest.fn(async () => ({ accessToken: 'synthetic-access', subject: 'user-1', clientId: 'client-1' })),
        pauseUsage: jest.fn() };
    const fetcher = jest.fn(async (url: string) => url.endsWith('/models') ? Response.json({ models: [
        { slug: 'hidden', visibility: 'hide' }, { slug: 'model-1', display_name: 'First', visibility: 'list' },
        { slug: 'model-2', visibility: 'list' }] }) : response());
    const provider = new ChatGPTProvider(auth as any, fetcher as any);
    return { provider, auth, fetcher, lifetime };
}
it('converts instructions/history/names using only supported request fields', () => {
    expect(subscriptionRequest('model-1', [{ role: 'system', content: 'You are a king.' },
        { role: 'system', content: 'Speak briefly.' }, { role: 'user', name: 'Queen', content: 'Greetings.' },
        { role: 'system', content: 'An event occurred.' }, { role: 'assistant', name: 'King', content: 'Welcome.' }])).toEqual({
        model: 'model-1', instructions: 'You are a king.\n\nSpeak briefly.',
        input: [{ role: 'user', content: 'Queen: Greetings.' }, { role: 'developer', content: 'An event occurred.' },
            { role: 'assistant', content: 'King: Welcome.' }], store: false, stream: true });
    expect(subscriptionRequest('model-1', 'Say hello.')).toMatchObject({ input: [{ role: 'user', content: 'Say hello.' }] });
});
it('decodes fragmented Unicode SSE and commits only completed text', async () => {
    const relay = jest.fn();
    await expect(readSubscriptionStream(stream([delta('你好 👑'), delta('!'), completed], 1), relay)).resolves.toBe('你好 👑!');
    expect(relay.mock.calls.map(call => call[0].content).join('')).toBe('你好 👑!');
});
it.each([
    [delta('partial')], [delta('partial'), { type: 'response.incomplete' }],
    [delta('partial'), { type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }],
    [delta('partial'), { type: 'response.completed', response: { status: 'failed' } }],
])('rejects incomplete or failed streams rather than returning partial output %#', async (...events: any[]) => {
    await expect(readSubscriptionStream(stream(events))).rejects.toBeInstanceOf(ChatGPTError);
});
it('rejects malformed SSE and a DONE marker without completion', async () => {
    await expect(readSubscriptionStream(new Response('data: not-json\n\n'))).rejects.toMatchObject({ code: 'malformed_stream' });
    await expect(readSubscriptionStream(new Response('data: [DONE]\n\n'))).rejects.toMatchObject({ code: 'incomplete' });
});
it('buffers non-streaming callers, preserves model order, and always requests SSE', async () => {
    const h = setup(() => stream([delta('complete'), completed]));
    expect(await h.provider.models()).toEqual([{ id: 'model-1', name: 'First' }, { id: 'model-2', name: 'model-2' }]);
    const relay = jest.fn();
    expect(await h.provider.complete('model-1', 'Hi', false, relay)).toBe('complete');
    expect(relay).not.toHaveBeenCalled();
});
it('fails for an unavailable model before sending inference', async () => {
    const h = setup(() => stream([delta('unexpected'), completed]));
    await expect(h.provider.complete('missing', 'Hi', false)).rejects.toMatchObject({ code: 'model_unavailable' });
    expect(h.fetcher.mock.calls.filter(([url]) => url.endsWith('/responses'))).toHaveLength(0);
});
it('pauses usage after a late failure and never replays a stream', async () => {
    const h = setup(() => stream([delta('partial'), { type: 'response.failed',
        response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }]));
    await expect(h.provider.complete('model-1', 'Hi', true)).rejects.toThrow('usage limit');
    expect(h.auth.pauseUsage).toHaveBeenCalledTimes(1);
    expect(h.fetcher.mock.calls.filter(([url]) => url.endsWith('/responses'))).toHaveLength(1);
});
it('retries one pre-stream authentication failure after refresh', async () => {
    let attempts = 0;
    const h = setup(() => ++attempts === 1 ? Response.json({ error: { code: 'expired_access' } }, { status: 401 }) : stream([delta('OK'), completed]));
    await expect(h.provider.complete('model-1', 'Hi', false)).resolves.toBe('OK');
    expect(h.auth.access).toHaveBeenCalledWith(true);
    expect(attempts).toBe(2);
});
it('bounds pre-stream unavailability retries and does not switch billing endpoints', async () => {
    const h = setup(() => Response.json({ detail: 'Unavailable' }, { status: 503 }));
    await expect(h.provider.complete('model-1', 'Hi', false)).rejects.toMatchObject({ status: 503 });
    expect(h.fetcher.mock.calls.filter(([url]) => url.endsWith('/responses'))).toHaveLength(3);
    expect(h.fetcher.mock.calls.every(([url]) => url.startsWith('https://api.openai.com/v1/'))).toBe(true);
});
it('caller cancellation and sign-out prevent any request', async () => {
    const h = setup(() => stream([delta('unexpected'), completed]));
    const cancel = new AbortController(); cancel.abort();
    await expect(h.provider.complete('model-1', 'Hi', false, undefined, cancel.signal)).rejects.toMatchObject({ name: 'AbortError' });
    h.lifetime.abort();
    await expect(h.provider.complete('model-1', 'Hi', false)).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.fetcher).not.toHaveBeenCalled();
});
it.each(['cancel', 'logout', 'timeout'])('interrupts a partial stream on %s without replay', async kind => {
    const caller = new AbortController();
    const h = setup(() => { throw new Error('Unexpected request'); });
    const base = h.fetcher.getMockImplementation()!;
    (h.fetcher as jest.Mock).mockImplementation(async (url, init) => {
        if (url.endsWith('/models')) return base(url);
        return new Response(new ReadableStream({ start(controller) {
            controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify(delta('provisional')) + '\n\n'));
            init.signal.addEventListener('abort', () => controller.error(init.signal.reason), { once: true });
        } }));
    });
    const relay = jest.fn(() => {
        if (kind === 'cancel') caller.abort();
        if (kind === 'logout') h.lifetime.abort();
    });
    await expect(h.provider.complete('model-1', 'Hi', true, relay, caller.signal,
        kind === 'timeout' ? 30 : 1000)).rejects.toMatchObject({ name: kind === 'timeout' ? 'TimeoutError' : 'AbortError' });
    expect(relay).toHaveBeenCalledTimes(1);
    expect(h.fetcher.mock.calls.filter(([url]) => url.endsWith('/responses'))).toHaveLength(1);
});
