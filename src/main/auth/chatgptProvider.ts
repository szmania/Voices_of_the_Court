import type { Message, MessageChunk } from '../ts/conversation_interfaces';
import type { ChatGPTAdapter, ChatGPTModel } from '../../shared/chatgptSubscription';
import { ChatGPTAuth } from './chatgptAuth';
import { ChatGPTError } from './chatgptErrors';

const BASE = 'https://api.openai.com/v1';
export function subscriptionRequest(model: string, prompt: string | Message[]): object {
    const messages: Message[] = typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt;
    const instructions: string[] = [];
    const input: object[] = [];
    let leading = true;
    for (const message of messages) {
        const text = message.name ? `${message.name}: ${message.content}` : message.content;
        if (leading && message.role === 'system') { instructions.push(text); continue; }
        leading = false;
        input.push({ role: message.role === 'system' ? 'developer' : message.role, content: text });
    }
    if (!input.length) input.push({ role: 'user', content: 'Follow the instructions above.' });
    return { model, ...(instructions.length ? { instructions: instructions.join('\n\n') } : {}), input,
        store: false, stream: true };
}

/** Decode SSE across arbitrary byte boundaries; only a completed response commits text. */
export async function readSubscriptionStream(response: Response, relay?: (chunk: MessageChunk) => void): Promise<string> {
    if (!response.body) throw new ChatGPTError('malformed_stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', text = '', completed = false;
    const consume = (frame: string) => {
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (!data || data === '[DONE]') return;
        let event: any;
        try { event = JSON.parse(data); } catch { throw new ChatGPTError('malformed_stream'); }
        if (!event || typeof event.type !== 'string') throw new ChatGPTError('malformed_stream');
        if (event.type === 'response.output_text.delta') {
            if (completed || typeof event.delta !== 'string') throw new ChatGPTError('malformed_stream');
            text += event.delta;
            if (text.length > 8 * 1024 * 1024) throw new ChatGPTError('malformed_stream');
            if (event.delta) relay?.({ content: event.delta });
        } else if (event.type === 'response.completed') {
            if (completed || event.response?.status !== 'completed') throw new ChatGPTError('malformed_stream');
            completed = true;
        } else if (event.type === 'response.failed' || event.type === 'error') {
            const code = event.response?.error?.code || event.error?.code || event.code;
            throw new ChatGPTError(typeof code === 'string' ? code.slice(0, 150) : 'unavailable',
                undefined, response.headers.get('x-request-id') || undefined);
        } else if (event.type === 'response.incomplete') throw new ChatGPTError('incomplete');
    };
    try {
        for (;;) {
            const result = await reader.read();
            buffer += result.done ? decoder.decode() : decoder.decode(result.value, { stream: true });
            let match: RegExpExecArray | null;
            while ((match = /\r?\n\r?\n/.exec(buffer))) {
                consume(buffer.slice(0, match.index));
                buffer = buffer.slice(match.index + match[0].length);
            }
            if (buffer.length > 1024 * 1024) throw new ChatGPTError('malformed_stream');
            if (result.done) break;
            // Terminal completion is the commit point; do not wait for a lingering socket.
            if (completed) break;
        }
        if (buffer.trim()) consume(buffer);
        if (!completed || !text.trim()) throw new ChatGPTError('incomplete');
        return text;
    } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
    }
}

export class ChatGPTProvider implements ChatGPTAdapter {
    private catalog?: ChatGPTModel[];
    private catalogIdentity?: string;
    constructor(private readonly auth: ChatGPTAuth, private readonly request: typeof fetch = fetch) {}
    async models(): Promise<ChatGPTModel[]> {
        const signal = AbortSignal.any([this.auth.signal, AbortSignal.timeout(30_000)]);
        const credentials = await this.auth.access();
        signal.throwIfAborted();
        const response = await this.request(`${BASE}/models`, { redirect: 'error',
            headers: { Authorization: `Bearer ${credentials.accessToken}` },
            signal });
        if (!response.ok) throw await this.httpError(response);
        const data = await response.json();
        signal.throwIfAborted();
        if (!Array.isArray(data.models)) throw new ChatGPTError('model_unavailable');
        this.catalog = data.models.filter((m: any) => m.visibility === 'list' && typeof m.slug === 'string')
            .map((m: any) => ({ id: m.slug, name: typeof m.display_name === 'string' ? m.display_name : m.slug }));
        this.catalogIdentity = `${credentials.subject}/${credentials.clientId}`;
        return this.catalog!;
    }
    async complete(model: string, prompt: string | Message[], stream: boolean,
        relay?: (chunk: MessageChunk) => void, signal?: AbortSignal, timeoutMs = 120_000): Promise<string> {
        // Capture this session's lifetime before awaiting anything: logout cancels all its work.
        const requestSignal = AbortSignal.any([this.auth.signal, AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
        let refreshUsed = false, retries = 0;
        for (;;) {
            requestSignal.throwIfAborted();
            const credentials = await this.auth.access();
            requestSignal.throwIfAborted();
            if (this.catalogIdentity !== `${credentials.subject}/${credentials.clientId}`) await this.models();
            requestSignal.throwIfAborted();
            if (!this.catalog?.some(m => m.id === model)) throw new ChatGPTError('model_unavailable');
            const response = await this.request(`${BASE}/responses`, { method: 'POST', redirect: 'error',
                headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(subscriptionRequest(model, prompt)), signal: requestSignal });
            if (!response.ok) {
                const error = await this.httpError(response);
                if (error.status === 401 && !refreshUsed) {
                    refreshUsed = true; await this.auth.access(true); continue;
                }
                if (error.status === 503 && retries < 2) {
                    await this.backoff(250 * 2 ** retries++, requestSignal); continue;
                }
                throw error;
            }
            try {
                return await readSubscriptionStream(response, stream ? relay : undefined);
            } catch (error) {
                if (error instanceof ChatGPTError && error.code === 'subscription_sharing_usage_limit_exceeded') this.auth.pauseUsage();
                throw error; // A stream is never replayed, even after zero text deltas.
            }
        }
    }
    private async httpError(response: Response): Promise<ChatGPTError> {
        let data: any;
        try { data = await response.json(); } catch { /* Do not expose arbitrary response bodies. */ }
        const code = typeof data?.error?.code === 'string' ? data.error.code.slice(0, 150) : 'unavailable';
        if (code === 'subscription_sharing_usage_limit_exceeded') this.auth.pauseUsage();
        return new ChatGPTError(code, response.status, response.headers.get('x-request-id') || undefined);
    }
    private backoff(ms: number, signal: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason); };
            const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) abort();
        });
    }
}
