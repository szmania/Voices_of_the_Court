import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface ChatGPTCredentials {
    clientId: string;
    subject: string;
    email?: string;
    accessToken: string;
    refreshToken?: string;
    idToken: string;
    scopes: string[];
    expiresAt: number;
    earliestRefreshAt: number;
}
export interface ChatGPTRecord {
    hostId: string;
    registration?: { clientId: string; subject: string; email?: string };
    credentials?: ChatGPTCredentials;
    welcomed?: boolean;
}
export interface CredentialStore {
    persistent: boolean;
    read(): Promise<ChatGPTRecord>;
    write(record: ChatGPTRecord): Promise<void>;
}
export interface Encryption {
    isEncryptionAvailable(): boolean;
    getSelectedStorageBackend?(): string;
    encryptString(value: string): Buffer;
    decryptString(value: Buffer): string;
}
/** A serialized atomic store outside campaign/config export directories. */
export class ChatGPTStore implements CredentialStore {
    readonly persistent: boolean;
    private queue: Promise<void> = Promise.resolve();
    private memory?: ChatGPTRecord;
    constructor(private readonly directory: string, private readonly encryption: Encryption,
        platform = process.platform) {
        this.persistent = encryption.isEncryptionAvailable() &&
            !(platform === 'linux' && encryption.getSelectedStorageBackend?.() === 'basic_text');
    }
    async read(): Promise<ChatGPTRecord> {
        if (this.memory) return this.memory;
        let metadata: ChatGPTRecord;
        try {
            metadata = JSON.parse(await fs.readFile(path.join(this.directory, 'registration.json'), 'utf8'));
            if (!metadata || typeof metadata.hostId !== 'string' || !metadata.hostId.startsWith('urn:uuid:')) throw new Error('Invalid registration');
            metadata = { hostId: metadata.hostId, registration: metadata.registration, welcomed: metadata.welcomed };
        } catch (error: any) {
            if (error.code !== 'ENOENT') throw error;
            metadata = { hostId: `urn:uuid:${randomUUID()}` };
        }
        // Registration metadata contains no tokens and survives memory-only sessions.
        this.memory = metadata;
        if (this.persistent) {
            try {
                metadata.credentials = JSON.parse(this.encryption.decryptString(
                    await fs.readFile(path.join(this.directory, 'credentials.bin'))));
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    // An unavailable key or damaged credential file requires a new login.
                    delete metadata.credentials;
                }
            }
        }
        return metadata;
    }
    write(record: ChatGPTRecord): Promise<void> {
        // Snapshot before scheduling: logout must not resurrect an older token set.
        const snapshot: ChatGPTRecord = JSON.parse(JSON.stringify(record));
        this.memory = snapshot;
        const next = this.queue.catch(() => {}).then(async () => {
            await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
            const { credentials, ...metadata } = snapshot;
            if (this.persistent && credentials) {
                await this.atomic('credentials.bin', this.encryption.encryptString(JSON.stringify(credentials)));
            } else {
                await fs.unlink(path.join(this.directory, 'credentials.bin')).catch((e: any) => { if (e.code !== 'ENOENT') throw e; });
            }
            await this.atomic('registration.json', Buffer.from(JSON.stringify(metadata)));
        });
        this.queue = next;
        return next;
    }
    private async atomic(name: string, value: Buffer): Promise<void> {
        const target = path.join(this.directory, name);
        const temporary = `${target}.${randomUUID()}.tmp`;
        try {
            await fs.writeFile(temporary, value, { mode: 0o600 });
            await fs.rename(temporary, target);
        } finally {
            await fs.unlink(temporary).catch(() => {});
        }
    }
}
