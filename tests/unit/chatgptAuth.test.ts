import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import { ChatGPTAuth } from '../../src/main/auth/chatgptAuth';
import { ChatGPTRecord, CredentialStore } from '../../src/main/auth/chatgptStore';

const issuer = 'https://auth.openai.com';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig' };
const clients: ChatGPTAuth[] = [];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function harness(record?: ChatGPTRecord) {
    let saved = record || { hostId: 'urn:uuid:test-install' };
    const store: CredentialStore = { persistent: true, read: async () => clone(saved),
        write: jest.fn(async value => { saved = clone(value); }) };
    const browser = jest.fn(async (_url: string) => {});
    const changed = jest.fn();
    const welcome = jest.fn(async () => {});
    const identity = (nonce: string, subject = 'user-1', overrides: any = {}) => jwt.sign({ sub: subject, nonce, email: 'test@example.invalid', ...overrides },
        privateKey, { algorithm: 'RS256', keyid: 'test-key', audience: 'oaiapp_test', issuer, expiresIn: 3600 });
    const response = () => ({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', token_type: 'Bearer',
        expires_in: 3600, scope: 'openid offline_access resource.invoke chatgpt.tokens.use.direct',
        id_token: identity(new URL(browser.mock.calls[0][0]).searchParams.get('nonce')!) });
    const request = jest.fn(async (url: string, init?: RequestInit): Promise<Response> => {
        if (url.endsWith('openid-configuration')) return Response.json({ issuer,
            authorization_endpoint: `${issuer}/api/accounts/authorize`, token_endpoint: `${issuer}/api/accounts/oauth/token`,
            jwks_uri: `${issuer}/.well-known/jwks.json`, revocation_endpoint: `${issuer}/revoke` });
        if (url.endsWith('jwks.json')) return Response.json({ keys: [jwk] });
        if (url.endsWith('/revoke')) return new Response(null, { status: 200 });
        return Response.json(response());
    });
    const auth = new ChatGPTAuth({ store, fetch: request as any, openBrowser: browser, changed, welcome });
    clients.push(auth);
    const callback = async (extra: Record<string, string> = {}, issued = true) => {
        const url = new URL(browser.mock.calls[browser.mock.calls.length - 1][0]);
        const callbackUrl = new URL(url.searchParams.get('redirect_uri')!);
        callbackUrl.search = new URLSearchParams({ code: 'synthetic-code', state: url.searchParams.get('state')!,
            ...(issued ? { client_id: 'oaiapp_test' } : {}), ...extra }).toString();
        return fetch(callbackUrl);
    };
    return { auth, store, browser, request, changed, welcome, callback, response, identity, saved: () => saved };
}
afterEach(() => clients.splice(0).forEach(auth => auth.dispose()));

it('registers over an allocated loopback port with PKCE, verifies signed identity, and stores the issued client', async () => {
    const h = harness(); await h.auth.initialize(); await h.auth.startLogin();
    const url = new URL(h.browser.mock.calls[0][0]);
    expect(url.origin).toBe(issuer);
    expect(url.searchParams.get('client_id')).toBe('dynamic_agent_client');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);
    expect((await h.callback()).status).toBe(200);
    expect(h.auth.status()).toMatchObject({ signedIn: true, planEnabled: true, pending: false });
    expect(h.saved().registration).toMatchObject({ clientId: 'oaiapp_test', subject: 'user-1' });
    const token = h.request.mock.calls.find(([url]) => url.endsWith('/oauth/token'))![1]!;
    expect(new URLSearchParams(token.body as string).get('redirect_uri')).toBe(url.searchParams.get('redirect_uri'));
    expect(h.welcome).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.auth.status())).not.toMatch(/synthetic-access|synthetic-refresh|idToken/);
});
it('reconnects with saved registration and accepts omission of the callback client ID', async () => {
    const h = harness(); await h.auth.initialize(); await h.auth.startLogin(); await h.callback();
    await h.auth.startLogin();
    const url = new URL(h.browser.mock.calls[1][0]);
    expect(url.searchParams.get('client_id')).toBe('oaiapp_test');
    expect(url.searchParams.has('agent_name_hint')).toBe(false);
    // Issue the fresh nonce rather than the original attempt's nonce.
    h.request.mockImplementation(async (target: string) => target.endsWith('/oauth/token') ? Response.json({ ...h.response(),
        id_token: h.identity(url.searchParams.get('nonce')!) }) : target.endsWith('jwks.json') ? Response.json({ keys: [jwk] }) : new Response(null, { status: 200 }));
    expect((await h.callback({}, false)).status).toBe(200);
    expect(h.welcome).toHaveBeenCalledTimes(1);
});
it('declined consent closes the attempt without exchanging a code', async () => {
    const h = harness(); await h.auth.initialize(); await h.auth.startLogin();
    expect((await h.callback({ error: 'access_denied' })).status).toBe(400);
    expect(h.auth.status().signedIn).toBe(false);
    expect(h.request.mock.calls.some(([url]) => url.endsWith('/oauth/token'))).toBe(false);
});
it('an invalid state cannot consume a legitimate pending attempt', async () => {
    const h = harness(); await h.auth.initialize(); await h.auth.startLogin();
    expect((await h.callback({ state: 'wrong-state' })).status).toBe(400);
    expect(h.auth.status().pending).toBe(true);
    expect((await h.callback()).status).toBe(200);
});
it.each(['nonce', 'signature', 'expiry', 'subject', 'client', 'issuer', 'audience'])('rejects an invalid %s without publishing credentials', async kind => {
    const h = harness(kind === 'subject' ? { hostId: 'urn:uuid:test', registration: { clientId: 'oaiapp_test', subject: 'different-user' } } : undefined);
    await h.auth.initialize(); await h.auth.startLogin();
    const url = new URL(h.browser.mock.calls[0][0]);
    const valid = h.identity(url.searchParams.get('nonce')!);
    h.request.mockImplementation(async target => {
        if (target.endsWith('jwks.json')) return Response.json({ keys: [jwk] });
        let token = valid;
        if (kind === 'nonce') token = h.identity('wrong-nonce');
        if (kind === 'signature') {
            const parts = token.split('.'); parts[2] = 'invalid-signature'; token = parts.join('.');
        }
        if (kind === 'expiry') token = jwt.sign({ sub: 'user-1', nonce: url.searchParams.get('nonce'), exp: 1 }, privateKey,
            { algorithm: 'RS256', keyid: 'test-key', audience: 'oaiapp_test', issuer });
        if (kind === 'issuer' || kind === 'audience') token = jwt.sign({ sub: 'user-1', nonce: url.searchParams.get('nonce') }, privateKey,
            { algorithm: 'RS256', keyid: 'test-key', audience: kind === 'audience' ? 'another-client' : 'oaiapp_test',
                issuer: kind === 'issuer' ? 'https://other.example' : issuer, expiresIn: 3600 });
        return Response.json({ ...h.response(), id_token: token });
    });
    expect((await h.callback(kind === 'client' ? { client_id: 'oaiapp_different' } : {})).status).toBe(400);
    expect(h.auth.status().signedIn).toBe(false);
});
it('retains a verified identity when plan permission is not granted', async () => {
    const h = harness(); await h.auth.initialize(); await h.auth.startLogin();
    h.request.mockImplementation(async target => target.endsWith('jwks.json') ? Response.json({ keys: [jwk] }) :
        Response.json({ ...h.response(), scope: 'openid profile email offline_access' }));
    expect((await h.callback()).status).toBe(200);
    expect(h.auth.status()).toMatchObject({ signedIn: true, planEnabled: false });
    await expect(h.auth.access()).rejects.toMatchObject({ code: 'plan_disabled' });
});
it('cancel closes the callback listener and duplicate clicks share one attempt', async () => {
    const h = harness(); await h.auth.initialize();
    await Promise.all([h.auth.startLogin(), h.auth.startLogin()]);
    expect(h.browser).toHaveBeenCalledTimes(1);
    h.auth.cancelLogin();
    expect(h.auth.status().pending).toBe(false);
    await expect(h.callback()).rejects.toThrow();
});
it('a duplicate callback cannot exchange the authorization code twice', async () => {
    const h = harness(); await h.auth.initialize(); await h.auth.startLogin();
    const base = h.request.getMockImplementation()!;
    let finish!: (response: Response) => void;
    h.request.mockImplementation(async (url, init) => url.endsWith('/oauth/token') ?
        new Promise(resolve => { finish = resolve; }) : base(url, init));
    const first = h.callback();
    while (!finish) await new Promise(resolve => setImmediate(resolve));
    expect((await h.callback()).status).toBe(400);
    finish(Response.json(h.response()));
    expect((await first).status).toBe(200);
    expect(h.request.mock.calls.filter(([url]) => url.endsWith('/oauth/token'))).toHaveLength(1);
});
it('expires abandoned login attempts', async () => {
    const h = harness(); await h.auth.initialize();
    let expire!: () => void;
    const original = global.setTimeout;
    const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((callback: any, delay: number, ...args: any[]) => {
        if (delay === 10 * 60_000) expire = callback;
        return original(callback, delay, ...args);
    }) as any);
    try {
        await h.auth.startLogin(); expire();
        expect(h.auth.status()).toMatchObject({ pending: false });
        expect(h.auth.status().error).toContain('expired');
    } finally { spy.mockRestore(); }
});
function expired(): ChatGPTRecord {
    return { hostId: 'urn:uuid:test', registration: { clientId: 'oaiapp_test', subject: 'user-1' }, credentials: {
        clientId: 'oaiapp_test', subject: 'user-1', accessToken: 'old-access', refreshToken: 'old-refresh', idToken: 'retained-id',
        scopes: ['chatgpt.tokens.use.direct'], expiresAt: Date.now() - 1, earliestRefreshAt: 0 } };
}
it('serializes concurrent refreshes and rotates the complete token set', async () => {
    const h = harness(expired()); await h.auth.initialize();
    const base = h.request.getMockImplementation()!;
    h.request.mockImplementation(async (url, init) => url.endsWith('/oauth/token') ? Response.json({ access_token: 'new-access',
        refresh_token: 'new-refresh', token_type: 'Bearer', expires_in: 3600 }) : base(url, init));
    const [a, b] = await Promise.all([h.auth.access(), h.auth.access()]);
    expect(a).toEqual(b);
    expect(h.request.mock.calls.filter(([url]) => url.endsWith('/oauth/token'))).toHaveLength(1);
    expect(h.saved().credentials).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh', scopes: ['chatgpt.tokens.use.direct'] });
});
it('honors the earliest refresh time, including forced recovery', async () => {
    const record = expired(); record.credentials!.earliestRefreshAt = Date.now() + 60000;
    const h = harness(record); await h.auth.initialize();
    expect((await h.auth.access(true)).accessToken).toBe('old-access');
    expect(h.request).not.toHaveBeenCalled();
});
it('usage limits cancel current work and block new requests until explicit recovery', async () => {
    const h = harness(expired()); await h.auth.initialize();
    const signal = h.auth.signal; h.auth.pauseUsage();
    expect(signal.aborted).toBe(true);
    await expect(h.auth.access()).rejects.toMatchObject({ code: 'subscription_sharing_usage_limit_exceeded' });
    h.auth.clearUsageLimit();
    expect(h.auth.status().usageLimited).toBe(false);
});
it('does not resurrect tokens when logout races token refresh', async () => {
    const h = harness(expired()); await h.auth.initialize();
    let finish!: (response: Response) => void;
    const base = h.request.getMockImplementation()!;
    h.request.mockImplementation(async (url, init) => url.endsWith('/oauth/token') ? new Promise(resolve => { finish = resolve; }) : base(url, init));
    const refresh = h.auth.access().catch(error => error);
    while (!finish) await new Promise(resolve => setImmediate(resolve));
    await h.auth.logout();
    finish(Response.json({ access_token: 'late-access', refresh_token: 'late-refresh', token_type: 'Bearer', expires_in: 3600 }));
    expect((await refresh).code).toBe('signed_out');
    expect(h.saved().credentials).toBeUndefined();
});
it('terminal refresh errors clear unusable tokens while network failures preserve them', async () => {
    for (const terminal of [false, true]) {
        const h = harness(expired()); await h.auth.initialize();
        const base = h.request.getMockImplementation()!;
        h.request.mockImplementation(async (url, init) => url.endsWith('/oauth/token') ?
            Response.json({ error: terminal ? 'refresh_token_reused' : 'temporary_failure' }, { status: terminal ? 400 : 503 }) : base(url, init));
        await expect(h.auth.access()).rejects.toThrow();
        expect(h.auth.status().signedIn).toBe(!terminal);
        expect(h.saved().registration?.clientId).toBe('oaiapp_test');
    }
});
