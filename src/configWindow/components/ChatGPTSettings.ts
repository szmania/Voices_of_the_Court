import { ipcRenderer } from 'electron';
import { CHATGPT_PROVIDER, CHATGPT_USAGE_URL, ChatGPTStatus, ChatGPTModel } from '../../shared/chatgptSubscription';

export class ChatGPTSettings extends HTMLElement {
    private root = this.attachShadow({ mode: 'open' });
    private status?: ChatGPTStatus;
    private confID = '';
    private loadingModels = false;
    private changed = (_event: unknown, status: ChatGPTStatus) => { void this.renderStatus(status); };
    private language = () => this.updateTranslation();
    get model(): string { return (this.root.querySelector('select') as HTMLSelectElement).value; }
    constructor() {
        super();
        this.root.innerHTML = `<link rel="stylesheet" href="../../public/configWindow/config.css">
            <h2 data-i18n="chatgpt.provider">OpenAI (ChatGPT subscription)</h2>
            <p id="status" role="status" aria-live="polite"></p>
            <p id="error" role="alert"></p>
            <p id="memory" data-i18n="chatgpt.memory_only" hidden>Secure storage is unavailable. Sign-in lasts until VOTC closes.</p>
            <button id="login" data-i18n="chatgpt.continue">Continue with ChatGPT</button>
            <button id="different" data-i18n="chatgpt.different">Use a different account or workspace</button>
            <button id="cancel" data-i18n="chatgpt.cancel" hidden>Cancel sign-in</button>
            <button id="logout" data-i18n="chatgpt.sign_out" hidden>Sign out</button>
            <div class="input-group"><label for="model" data-i18n="connection.model">Model</label>
            <select id="model" disabled></select>
            <button id="refresh" data-i18n="chatgpt.refresh">Refresh models</button></div>
            <p data-i18n="chatgpt.limitations">Your ChatGPT plan controls usage. Sampling settings and the output-token limit are unavailable for this provider. Embeddings use a separate provider.</p>
            <a id="usage" href="${CHATGPT_USAGE_URL}" data-i18n="chatgpt.manage_usage">Manage usage</a>`;
        this.root.querySelector('#login')!.addEventListener('click', () => { void this.operation('start-login'); });
        this.root.querySelector('#different')!.addEventListener('click', () => { void this.operation('start-login', { differentAccount: true }); });
        this.root.querySelector('#cancel')!.addEventListener('click', () => { void this.operation('cancel-login'); });
        this.root.querySelector('#logout')!.addEventListener('click', () => { void this.operation('logout'); });
        this.root.querySelector('#refresh')!.addEventListener('click', () => { void this.refreshModels(); });
        this.root.querySelector('#model')!.addEventListener('change', () => { void this.persistModel(); });
        this.root.querySelector('#usage')!.addEventListener('click', event => {
            event.preventDefault(); ipcRenderer.send('open-external-link', CHATGPT_USAGE_URL);
        });
    }
    async connectedCallback(): Promise<void> {
        this.confID = (this.getRootNode() as ShadowRoot & { host: any }).host?.confID || '';
        ipcRenderer.on('openai-chatgpt:changed', this.changed);
        ipcRenderer.on('update-language', this.language);
        this.updateTranslation();
        await this.operation('status');
    }
    disconnectedCallback(): void {
        ipcRenderer.removeListener('openai-chatgpt:changed', this.changed);
        ipcRenderer.removeListener('update-language', this.language);
    }
    private updateTranslation(): void {
        (window as any).LocalizationManager?.applyTranslations(this.root);
        if (this.status) void this.renderStatus(this.status);
    }
    private t(key: string, fallback: string): string {
        return (window as any).LocalizationManager?.getNestedTranslation(`chatgpt.${key}`) || fallback;
    }
    private async operation(name: string, arg?: unknown): Promise<void> {
        try {
            const result = arg === undefined ? await ipcRenderer.invoke(`openai-chatgpt:${name}`) :
                await ipcRenderer.invoke(`openai-chatgpt:${name}`, arg);
            if (!this.isConnected) return;
            if (!result.ok) { this.error(result.error); return; }
            if (name === 'logout') {
                await this.renderStatus(result.value.status);
                if (!result.value.revocationConfirmed) this.error(this.t('revocation_unconfirmed', 'Signed out locally. Remote revocation was not confirmed; disconnect VOTC in ChatGPT settings.'));
            } else await this.renderStatus(result.value);
        } catch { this.error(this.t('connection_failed', 'ChatGPT connection failed. Try again.')); }
    }
    private async renderStatus(status: ChatGPTStatus): Promise<void> {
        const wasReady = this.status?.signedIn && this.status?.planEnabled;
        const wasAccount = this.status?.accountKey;
        this.status = status;
        const ready = status.signedIn && status.planEnabled;
        this.root.querySelector('#status')!.textContent = status.pending ? this.t('waiting', 'Complete sign-in in your browser.') :
            ready ? `${this.t('using_plan', 'Using ChatGPT plan')}${status.email ? ` — ${status.email}` : ''}` :
            status.signedIn ? this.t('plan_disabled', 'Signed in; ChatGPT plan permission is disabled. Continue with ChatGPT to enable it.') :
            this.t('signed_out', 'Sign in to use your ChatGPT plan.');
        (this.root.querySelector('#memory') as HTMLElement).hidden = status.persistent;
        (this.root.querySelector('#login') as HTMLElement).hidden = status.pending || ready;
        (this.root.querySelector('#different') as HTMLButtonElement).disabled = status.pending;
        (this.root.querySelector('#cancel') as HTMLElement).hidden = !status.pending;
        (this.root.querySelector('#logout') as HTMLElement).hidden = !status.signedIn;
        (this.root.querySelector('#refresh') as HTMLButtonElement).disabled = !ready || status.pending;
        const select = this.root.querySelector('select') as HTMLSelectElement;
        select.disabled = !ready;
        this.error(status.error || (status.usageLimited ? this.t('usage_limit', 'ChatGPT usage limit reached. Manage usage, then use Test Connection to retry.') : ''));
        if (!ready) select.replaceChildren();
        else if (!wasReady || wasAccount !== status.accountKey) await this.refreshModels();
    }
    private error(message: string): void { this.root.querySelector('#error')!.textContent = message; }
    async refreshModels(): Promise<void> {
        if (this.loadingModels || !this.status?.planEnabled) return;
        const account = this.status.accountKey;
        this.loadingModels = true;
        try {
            const result = await ipcRenderer.invoke('openai-chatgpt:models');
            if (!this.isConnected) return;
            if (!result.ok) { this.error(result.error); return; }
            const config = await ipcRenderer.invoke('get-config');
            if (!this.isConnected || !this.status?.planEnabled || this.status.accountKey !== account) return;
            const connection = config[this.confID]?.connection;
            const saved = connection?.type === CHATGPT_PROVIDER ? connection.model : connection?.apiKeys?.[CHATGPT_PROVIDER]?.model;
            const select = this.root.querySelector('select') as HTMLSelectElement;
            const models = result.value as ChatGPTModel[];
            select.replaceChildren(...models.map(model => {
                const option = document.createElement('option'); option.value = model.id; option.textContent = model.name; return option;
            }));
            select.value = models.some(m => m.id === saved) ? saved : models[0]?.id || '';
            if (saved && saved !== select.value) this.error(this.t('model_changed', 'The saved model is unavailable. The first available model is now selected.'));
            if (!models.length) this.error(this.t('no_models', 'No models are available for this account.'));
            await this.persistModel();
        } catch { this.error(this.t('connection_failed', 'ChatGPT connection failed. Try again.')); }
        finally {
            this.loadingModels = false;
            if (this.isConnected && this.status?.planEnabled && this.status.accountKey !== account) void this.refreshModels();
        }
    }
    private async persistModel(): Promise<void> {
        const config = await ipcRenderer.invoke('get-config');
        if (!this.isConnected || config[this.confID]?.connection?.type !== CHATGPT_PROVIDER) return;
        ipcRenderer.send('config-change-nested-nested', this.confID, 'connection', 'model', this.model);
        ipcRenderer.send('api-config-change', this.confID, CHATGPT_PROVIDER, { model: this.model });
    }
}
customElements.define('chatgpt-settings', ChatGPTSettings);
