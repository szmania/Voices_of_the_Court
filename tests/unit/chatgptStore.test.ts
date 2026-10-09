import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ChatGPTStore, ChatGPTRecord } from '../../src/main/auth/chatgptStore';
let directory: string;
const encryption = { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString: (text: string) => Buffer.from(text.split('').reverse().join('')),
    decryptString: (buffer: Buffer) => buffer.toString().split('').reverse().join('') };
const record: ChatGPTRecord = { hostId: 'urn:uuid:test', registration: { clientId: 'client', subject: 'user' }, credentials: {
    clientId: 'client', subject: 'user', accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh',
    idToken: 'synthetic-id', scopes: ['chatgpt.tokens.use.direct'], expiresAt: 100, earliestRefreshAt: 0 } };
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'votc-chatgpt-test-')); });
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });
it('persists encrypted credentials separately from token-free registration metadata', async () => {
    const store = new ChatGPTStore(directory, encryption);
    await store.write(record);
    expect(await fs.readFile(path.join(directory, 'registration.json'), 'utf8')).not.toMatch(/synthetic|Token/);
    expect((await fs.readFile(path.join(directory, 'credentials.bin'))).toString()).not.toContain('synthetic-access');
    expect((await new ChatGPTStore(directory, encryption).read()).credentials).toEqual(record.credentials);
    expect((await fs.readdir(directory)).some(name => name.endsWith('.tmp'))).toBe(false);
});
it.each([false, true])('uses memory-only credentials without a secure backend (Linux basic_text=%s)', async basic => {
    const store = new ChatGPTStore(directory, { ...encryption, isEncryptionAvailable: () => basic,
        getSelectedStorageBackend: () => 'basic_text' }, 'linux');
    expect(store.persistent).toBe(false);
    await store.write(record);
    expect((await store.read()).credentials).toEqual(record.credentials);
    expect(await fs.readdir(directory)).toEqual(['registration.json']);
    expect((await new ChatGPTStore(directory, encryption).read()).credentials).toBeUndefined();
});
it('serializes refresh then sign-out without retaining credentials on disk', async () => {
    const store = new ChatGPTStore(directory, encryption);
    await Promise.all([store.write(record), store.write({ hostId: record.hostId, registration: record.registration })]);
    expect((await store.read()).credentials).toBeUndefined();
    expect(await fs.readdir(directory)).toEqual(['registration.json']);
});
it('does not load plaintext credentials from registration metadata', async () => {
    await fs.writeFile(path.join(directory, 'registration.json'), JSON.stringify(record));
    expect((await new ChatGPTStore(directory, encryption).read()).credentials).toBeUndefined();
});
it('never writes plaintext tokens when encryption fails', async () => {
    const store = new ChatGPTStore(directory, { ...encryption, encryptString: () => { throw new Error('Locked keychain'); } });
    await expect(store.write(record)).rejects.toThrow('Locked keychain');
    expect(await fs.readdir(directory)).toEqual([]);
});
