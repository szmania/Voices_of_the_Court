import type { ChatGPTAuth } from './chatgptAuth';
import type { ChatGPTProvider } from './chatgptProvider';
import { safeChatGPTError } from './chatgptErrors';
import { CHATGPT_PROVIDER } from '../../shared/chatgptSubscription';
import type { ApiConnection } from '../../shared/apiConnection';

export const TEXT_CONNECTIONS = ['textGenerationApiConnectionConfig', 'summarizationApiConnectionConfig',
    'actionsApiConnectionConfig', 'compactionApiConnectionConfig'];
export function registerChatGPTIpc(ipc: { handle(channel: string, listener: (...args: any[]) => any): any },
    auth: ChatGPTAuth, provider: ChatGPTProvider, allowed: (event: any) => boolean,
    connection: (id: string) => Promise<ApiConnection>): void {
    const handle = (name: string, operation: (arg?: any) => Promise<any> | any) => {
        ipc.handle(`openai-chatgpt:${name}`, async (event, arg, ...extra) => {
            if (!allowed(event)) return { ok: false, error: 'This operation is available only in Connection settings.' };
            if (extra.length) return { ok: false, error: 'Invalid ChatGPT settings request.' };
            try { return { ok: true, value: await operation(arg) }; }
            catch (error) { return { ok: false, error: safeChatGPTError(error) }; }
        });
    };
    const noArg = (arg: any) => { if (arg !== undefined) throw new Error('Unexpected argument'); };
    handle('status', arg => { noArg(arg); return auth.status(); });
    handle('start-login', arg => {
        if (arg !== undefined && (typeof arg !== 'object' || arg === null ||
            Object.keys(arg).some(k => k !== 'differentAccount') || typeof arg.differentAccount !== 'boolean')) throw new Error('Invalid login request');
        return auth.startLogin(arg?.differentAccount === true);
    });
    handle('cancel-login', arg => { noArg(arg); return auth.cancelLogin(); });
    handle('logout', arg => { noArg(arg); return auth.logout(); });
    handle('models', arg => { noArg(arg); return provider.models(); });
    handle('test-connection', async arg => {
        if (typeof arg !== 'string' || !TEXT_CONNECTIONS.includes(arg)) throw new Error('Invalid connection');
        const selected = await connection(arg);
        if (selected.type !== CHATGPT_PROVIDER) throw new Error('Not a subscription connection');
        auth.clearUsageLimit(); // An explicit user retry, never a background automatic retry.
        return selected.testConnection();
    });
}
