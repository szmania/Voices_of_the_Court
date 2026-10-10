export class ChatGPTError extends Error {
    constructor(public readonly code: string, public readonly status?: number,
        public readonly requestId?: string) {
        super(messages[code] || 'ChatGPT request failed. Check your connection and try again.');
        this.name = 'ChatGPTError';
    }
}
const messages: Record<string, string> = {
    signed_out: 'Continue with ChatGPT in Connection settings before generating text.',
    plan_disabled: 'Signed in, but permission to use your ChatGPT plan is disabled. Enable it in Connection settings.',
    invalid_identity: 'ChatGPT sign-in could not be verified. Start a new sign-in.',
    login_failed: 'ChatGPT sign-in failed. Start a new sign-in.',
    login_expired: 'ChatGPT sign-in expired. Start a new sign-in.',
    access_denied: 'ChatGPT sign-in was declined.',
    storage_failed: 'ChatGPT credentials could not be saved securely. Try signing in again.',
    reconnect: 'Your ChatGPT session has ended. Sign in again in Connection settings.',
    subscription_sharing_usage_limit_exceeded: 'ChatGPT usage limit reached. Manage usage in ChatGPT settings, then retry from Connection settings.',
    subscription_sharing_user_not_eligible: 'ChatGPT plan usage is unavailable for this account or workspace.',
    subscription_sharing_unsupported_capability: 'This model or request capability is unavailable through your ChatGPT plan.',
    subscription_sharing_route_not_supported: 'ChatGPT subscription routing is unavailable for this request.',
    incomplete: 'ChatGPT did not complete the response. Partial output was not saved.',
    malformed_stream: 'ChatGPT returned an invalid response stream. Partial output was not saved.',
    unavailable: 'ChatGPT is temporarily unavailable. Try again later.',
    model_unavailable: 'The selected model is unavailable. Refresh models in Connection settings.',
};
export function safeChatGPTError(error: unknown): string {
    return error instanceof ChatGPTError ? error.message : 'ChatGPT connection failed. Try again in Connection settings.';
}
export const terminalRefreshCodes = new Set(['invalid_grant', 'invalid_refresh_token', 'token_expired',
    'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused']);
