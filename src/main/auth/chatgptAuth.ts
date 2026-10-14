import { createServer, Server } from 'http';
import { createHash, createPublicKey, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { ChatGPTStatus } from '../../shared/chatgptSubscription';
import { ChatGPTCredentials, ChatGPTRecord, CredentialStore } from './chatgptStore';
import { ChatGPTError, safeChatGPTError, terminalRefreshCodes } from './chatgptErrors';

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
interface Discovery { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string; revocation_endpoint: string; }
interface Pending {
    server: Server; timer: ReturnType<typeof setTimeout>; state: string; nonce: string;
    verifier: string; redirect: string; clientId?: string; subject?: string;
    consumed: boolean; epoch: number;
}
export interface AuthDependencies {
    store: CredentialStore;
    fetch: typeof fetch;
    openBrowser(url: string): Promise<void>;
    changed(status: ChatGPTStatus): void;
    welcome(): Promise<void>;
    now?: () => number;
}
export class ChatGPTAuth {
    private record!: ChatGPTRecord;
    private pending?: Pending;
    private discovery?: Discovery;
    private keys: any[] = [];
    private keysAt = 0;
    private refreshInFlight?: Promise<ChatGPTCredentials>;
    private loginInFlight?: Promise<ChatGPTStatus>;
    private loginSequence = 0;
    private epoch = 0;
    private lifetime = new AbortController();
    private lastError?: string;
    private usageLimited = false;
    private readonly now: () => number;
    constructor(private readonly deps: AuthDependencies) { this.now = deps.now || Date.now; }
    async initialize(): Promise<void> {
        this.record = await this.deps.store.read();
        const c = this.record.credentials;
        if (c && (!c.accessToken || !c.idToken || !Array.isArray(c.scopes) || !Number.isFinite(c.expiresAt) ||
            c.clientId !== this.record.registration?.clientId || c.subject !== this.record.registration?.subject)) {
            delete this.record.credentials;
            await this.deps.store.write(this.record);
        }
    }
    get signal(): AbortSignal { return this.lifetime.signal; }
    status(): ChatGPTStatus {
        const c = this.record?.credentials;
        return { signedIn: !!c, planEnabled: !!c?.scopes.includes('chatgpt.tokens.use.direct'),
            pending: !!this.pending, persistent: this.deps.store.persistent, usageLimited: this.usageLimited,
            email: c?.email, accountKey: c ? `${c.subject}/${c.clientId}` : undefined, error: this.lastError };
    }
    private emit(): void { this.deps.changed(this.status()); }
    clearUsageLimit(): void { this.usageLimited = false; this.emit(); }
    pauseUsage(): void {
        this.usageLimited = true;
        this.lifetime.abort(); this.lifetime = new AbortController();
        this.emit();
    }
    assertUsable(): void {
        if (!this.record.credentials) throw new ChatGPTError('signed_out');
        if (!this.status().planEnabled) throw new ChatGPTError('plan_disabled');
        if (this.usageLimited) throw new ChatGPTError('subscription_sharing_usage_limit_exceeded', 429);
    }
    private async configuration(): Promise<Discovery> {
        if (this.discovery) return this.discovery;
        const data = await this.json(`${ISSUER}/.well-known/openid-configuration`);
        if (data.issuer !== ISSUER) throw new ChatGPTError('invalid_identity');
        for (const name of ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'revocation_endpoint']) {
            const url = new URL(data[name]);
            if (url.origin !== ISSUER || url.username || url.password) throw new ChatGPTError('invalid_identity');
        }
        return this.discovery = data;
    }
    private async json(url: string, init: RequestInit = {}): Promise<any> {
        const response = await this.deps.fetch(url, { ...init, redirect: 'error',
            signal: AbortSignal.any([this.signal, AbortSignal.timeout(30_000)]) });
        let data: any;
        try { data = await response.json(); } catch { throw new ChatGPTError('unavailable', response.status); }
        if (!response.ok) {
            const code = typeof data.error === 'string' ? data.error : data.error?.code;
            throw new ChatGPTError(typeof code === 'string' ? code : 'unavailable', response.status);
        }
        return data;
    }
    startLogin(differentAccount = false): Promise<ChatGPTStatus> {
        if (this.loginInFlight) return this.loginInFlight;
        const login = this.beginLogin(differentAccount).finally(() => {
            if (this.loginInFlight === login) this.loginInFlight = undefined;
        });
        this.loginInFlight = login;
        return login;
    }
    private async beginLogin(differentAccount: boolean): Promise<ChatGPTStatus> {
        if (this.pending) return this.status();
        this.lastError = undefined;
        const epoch = this.epoch;
        const sequence = this.loginSequence;
        const configuration = await this.configuration();
        if (epoch !== this.epoch || sequence !== this.loginSequence) throw new ChatGPTError('signed_out');
        // Multiple clicks can complete discovery concurrently.
        if (this.pending) return this.status();
        const state = randomBytes(32).toString('base64url');
        const nonce = randomBytes(32).toString('base64url');
        const verifier = randomBytes(64).toString('base64url');
        const registration = differentAccount ? undefined : this.record.registration;
        const server = createServer((request, response) => {
            void this.callback(request.url || '', response, pending).catch(() => {
                if (!response.writableEnded) { response.writeHead(400); response.end('Sign-in failed. Return to Voices of the Court.'); }
            });
        });
        // Assigned before the listener begins serving requests.
        const pending = { server, state, nonce, verifier, consumed: false, epoch,
            clientId: registration?.clientId, subject: registration?.subject } as Pending;
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
        });
        if (epoch !== this.epoch || sequence !== this.loginSequence) { server.close(); throw new ChatGPTError('signed_out'); }
        pending.redirect = `http://127.0.0.1:${(server.address() as any).port}/auth/callback`;
        pending.timer = setTimeout(() => {
            if (this.pending === pending) { this.lastError = new ChatGPTError('login_expired').message; this.cancelLogin(); }
        }, 10 * 60_000);
        pending.timer.unref();
        this.pending = pending;
        try {
            await this.deps.store.write(this.record); // Persist the installation ID before opening the browser.
            const url = new URL(configuration.authorization_endpoint);
            url.search = new URLSearchParams({ client_id: registration?.clientId || 'dynamic_agent_client',
                ext_agent_host_id: this.record.hostId, response_type: 'code', redirect_uri: pending.redirect,
                scope: SCOPES, resource: RESOURCE, state, nonce, code_challenge_method: 'S256',
                code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString();
            if (!registration) url.searchParams.set('agent_name_hint', 'Voices of the Court - Community Edition');
            else if (this.record.credentials?.idToken) url.searchParams.set('id_token_hint', this.record.credentials.idToken);
            if (!differentAccount && this.record.credentials && !this.status().planEnabled) url.searchParams.set('prompt', 'consent');
            if (epoch !== this.epoch || this.pending !== pending) throw new ChatGPTError('signed_out');
            await this.deps.openBrowser(url.toString());
            this.emit();
            return this.status();
        } catch (error) { this.cancelLogin(); throw new ChatGPTError('login_failed'); }
    }
    private async callback(rawUrl: string, response: import('http').ServerResponse, p: Pending): Promise<void> {
        const url = new URL(rawUrl, p.redirect);
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Security-Policy', "default-src 'none'");
        if (url.pathname !== '/auth/callback' || this.pending !== p || p.consumed ||
            url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== p.state) {
            response.writeHead(400); response.end('Invalid sign-in callback.'); return;
        }
        p.consumed = true;
        try {
            if (url.searchParams.has('error')) throw new ChatGPTError('access_denied');
            const issued = url.searchParams.get('client_id');
            if (issued && p.clientId && issued !== p.clientId) throw new ChatGPTError('invalid_identity');
            const clientId = p.clientId || issued;
            const code = url.searchParams.get('code');
            if (!clientId || clientId === 'dynamic_agent_client' || !code || url.searchParams.getAll('code').length !== 1) throw new ChatGPTError('invalid_identity');
            const configuration = await this.configuration();
            const data = await this.json(configuration.token_endpoint, { method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code,
                    code_verifier: p.verifier, redirect_uri: p.redirect, resource: RESOURCE }).toString() });
            const identity = await this.validateIdentity(data.id_token, clientId, p.nonce);
            if (p.subject && identity.sub !== p.subject) throw new ChatGPTError('invalid_identity');
            const credentials = this.credentials(data, clientId, identity.sub!, typeof identity.email === 'string' ? identity.email : undefined);
            if (p.epoch !== this.epoch || this.pending !== p) throw new ChatGPTError('signed_out');
            const next: ChatGPTRecord = { ...this.record,
                registration: { clientId, subject: credentials.subject, email: credentials.email }, credentials };
            const welcome = !next.welcomed && credentials.scopes.includes('chatgpt.tokens.use.direct');
            if (welcome) next.welcomed = true;
            await this.deps.store.write(next);
            if (p.epoch !== this.epoch || this.pending !== p) { await this.deps.store.write(this.record); throw new ChatGPTError('signed_out'); }
            ++this.epoch;
            this.lifetime.abort(); this.lifetime = new AbortController();
            this.refreshInFlight = undefined;
            this.record = next;
            this.usageLimited = false;
            this.lastError = undefined;
            response.end('Signed in. You can close this tab and return to Voices of the Court.');
            this.cancelLogin();
            if (welcome) await this.deps.welcome();
        } catch (error) {
            this.lastError = safeChatGPTError(error);
            if (!response.writableEnded) { response.writeHead(400); response.end('Sign-in failed. Return to Voices of the Court and try again.'); }
            if (this.pending === p) this.cancelLogin();
        }
    }
    private credentials(data: any, clientId: string, subject: string, email?: string,
        previous?: ChatGPTCredentials): ChatGPTCredentials {
        if (typeof data.access_token !== 'string' || !data.access_token ||
            typeof data.expires_in !== 'number' || data.expires_in <= 0 || !Number.isFinite(data.expires_in) ||
            data.token_type?.toLowerCase() !== 'bearer') throw new ChatGPTError('invalid_identity');
        return { clientId, subject, email, accessToken: data.access_token,
            refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : previous?.refreshToken,
            idToken: typeof data.id_token === 'string' ? data.id_token : previous!.idToken,
            scopes: typeof data.scope === 'string' ? data.scope.split(/\s+/).filter(Boolean) : previous?.scopes || [],
            expiresAt: this.now() + data.expires_in * 1000,
            earliestRefreshAt: typeof data.earliest_refresh_at === 'number' ? data.earliest_refresh_at * 1000 : 0 };
    }
    private async validateIdentity(token: unknown, clientId: string, nonce?: string): Promise<jwt.JwtPayload> {
        if (typeof token !== 'string') throw new ChatGPTError('invalid_identity');
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded || decoded.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string') throw new ChatGPTError('invalid_identity');
        const configuration = await this.configuration();
        if (this.now() - this.keysAt > 3600_000 || !this.keys.some(k => k.kid === decoded.header.kid)) {
            const data = await this.json(configuration.jwks_uri);
            this.keys = Array.isArray(data.keys) ? data.keys : [];
            this.keysAt = this.now();
        }
        const key = this.keys.find(k => k.kid === decoded.header.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig'));
        if (!key) throw new ChatGPTError('invalid_identity');
        try {
            const claims = jwt.verify(token, createPublicKey({ key, format: 'jwk' }), { algorithms: ['RS256'],
                issuer: ISSUER, audience: clientId, nonce, clockTimestamp: Math.floor(this.now() / 1000) });
            if (typeof claims === 'string' || !claims.sub || typeof claims.exp !== 'number') throw new Error();
            return claims;
        } catch { throw new ChatGPTError('invalid_identity'); }
    }
    cancelLogin(): ChatGPTStatus {
        ++this.loginSequence;
        if (this.pending) {
            clearTimeout(this.pending.timer);
            this.pending.server.close();
            this.pending = undefined;
        }
        this.emit();
        return this.status();
    }
    async access(force = false): Promise<ChatGPTCredentials> {
        this.assertUsable();
        const current = this.record.credentials!;
        if ((!force && current.expiresAt > this.now() + 60_000) || this.now() < current.earliestRefreshAt) return current;
        if (this.refreshInFlight) return this.refreshInFlight;
        const epoch = this.epoch;
        const refresh = this.refresh(current, epoch).finally(() => {
            if (this.refreshInFlight === refresh) this.refreshInFlight = undefined;
        });
        this.refreshInFlight = refresh;
        return refresh;
    }
    private async refresh(current: ChatGPTCredentials, epoch: number): Promise<ChatGPTCredentials> {
        try {
            if (!current.refreshToken) throw new ChatGPTError('invalid_refresh_token');
            const configuration = await this.configuration();
            const data = await this.json(configuration.token_endpoint, { method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ grant_type: 'refresh_token', client_id: current.clientId,
                    refresh_token: current.refreshToken, resource: RESOURCE }).toString() });
            if (data.id_token) {
                const identity = await this.validateIdentity(data.id_token, current.clientId);
                if (identity.sub !== current.subject) throw new ChatGPTError('invalid_identity');
            }
            const next = this.credentials(data, current.clientId, current.subject, current.email, current);
            if (epoch !== this.epoch) throw new ChatGPTError('signed_out');
            const record = { ...this.record, credentials: next };
            await this.deps.store.write(record);
            if (epoch !== this.epoch) { await this.deps.store.write(this.record); throw new ChatGPTError('signed_out'); }
            this.record = record;
            this.emit();
            this.assertUsable();
            return next;
        } catch (error) {
            if (epoch === this.epoch && error instanceof ChatGPTError && (terminalRefreshCodes.has(error.code) || error.code === 'invalid_identity')) {
                delete this.record.credentials;
                this.lifetime.abort(); this.lifetime = new AbortController();
                await this.deps.store.write(this.record);
                this.lastError = new ChatGPTError('reconnect').message;
                this.emit();
                throw new ChatGPTError('reconnect');
            }
            throw error;
        }
    }
    async logout(): Promise<{ status: ChatGPTStatus; revocationConfirmed: boolean }> {
        ++this.epoch;
        this.lifetime.abort(); this.lifetime = new AbortController();
        this.cancelLogin();
        const current = this.record.credentials;
        delete this.record.credentials;
        this.usageLimited = false;
        this.lastError = undefined;
        await this.deps.store.write(this.record);
        this.emit();
        let revocationConfirmed = !current?.refreshToken;
        if (current?.refreshToken) {
            try {
                const configuration = await this.configuration();
                for (let attempt = 0; attempt < 3; attempt++) {
                    const response = await this.deps.fetch(configuration.revocation_endpoint, { method: 'POST', redirect: 'error',
                        signal: AbortSignal.timeout(10_000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ token: current.refreshToken, token_type_hint: 'refresh_token', client_id: current.clientId }).toString() });
                    if (response.status === 200) { revocationConfirmed = true; break; }
                    if (response.status < 500) break;
                    await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
                }
            } catch { /* Local sign-out remains effective when remote revocation is unavailable. */ }
        }
        return { status: this.status(), revocationConfirmed };
    }
    dispose(): void { ++this.epoch; this.lifetime.abort(); this.cancelLogin(); }
}
