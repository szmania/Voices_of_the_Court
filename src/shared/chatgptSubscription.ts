import type { Message, MessageChunk } from '../main/ts/conversation_interfaces';

export const CHATGPT_PROVIDER = 'openai_chatgpt';
export const CHATGPT_USAGE_URL = 'https://chatgpt.com/settings/usage';
export interface ChatGPTStatus {
    signedIn: boolean;
    planEnabled: boolean;
    pending: boolean;
    persistent: boolean;
    usageLimited: boolean;
    email?: string;
    accountKey?: string;
    error?: string;
}
export interface ChatGPTModel { id: string; name: string; }
export interface ChatGPTAdapter {
    complete(model: string, prompt: string | Message[], stream: boolean,
        relay?: (chunk: MessageChunk) => void, signal?: AbortSignal, timeoutMs?: number): Promise<string>;
    models(): Promise<ChatGPTModel[]>;
}
// Installed only by the main process. Renderers use the dedicated settings IPC.
let adapter: ChatGPTAdapter | undefined;
export function setChatGPTAdapter(value: ChatGPTAdapter): void { adapter = value; }
export function getChatGPTAdapter(): ChatGPTAdapter {
    if (!adapter) throw new Error('ChatGPT subscription requests must run in the main process.');
    return adapter;
}

/** OAuth secrets never belong to a portable connection config. */
export function sanitizeSubscriptionConnection(connection: any): void {
    if (!connection || typeof connection !== 'object') return;
    if (connection.type === CHATGPT_PROVIDER) {
        connection.key = '';
        connection.baseUrl = 'https://api.openai.com/v1';
        connection.forceInstruct = false;
        for (const field of ['access_token', 'refresh_token', 'id_token', 'accessToken', 'refreshToken', 'idToken']) delete connection[field];
    }
    if (connection.apiKeys?.[CHATGPT_PROVIDER]) {
        const saved = connection.apiKeys[CHATGPT_PROVIDER];
        connection.apiKeys[CHATGPT_PROVIDER] = { model: typeof saved.model === 'string' ? saved.model : '' };
    }
}
