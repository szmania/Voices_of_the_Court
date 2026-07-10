import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CompactedMemory } from '../shared/compactionTypes';
import { app } from 'electron';

// IMPORTANT: Key must be 32 bytes for AES-256
const ENCRYPTION_KEY = process.env.COMPACTION_ENCRYPTION_KEY || 'a_default_32_byte_encryption_key';
const IV_LENGTH = 16;
const DATA_DIR = path.join(app.getPath('userData'), 'votc_data', 'compacted_memory');

class CompactedMemoryStore {
    public initializeStorage(): void {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
                console.log(`Created compacted memory directory at: ${DATA_DIR}`);
            }
        } catch (error) {
            console.error('Failed to create compacted memory directory:', error);
        }
    }

    public async saveCompactedMemory(playerId: string, characterId: string, memories: CompactedMemory[]): Promise<void> {
        const playerDir = path.join(DATA_DIR, playerId);
        const filePath = path.join(playerDir, `${characterId}.json`);

        try {
            if (!fs.existsSync(playerDir)) {
                fs.mkdirSync(playerDir, { recursive: true, mode: 0o700 });
            }

            const data = JSON.stringify(memories, null, 2);
            const encryptedData = this.encrypt(data);
            fs.writeFileSync(filePath, encryptedData, { mode: 0o600 });
        } catch (error) {
            console.error(`Failed to save compacted memory for character ${characterId}:`, error);
            throw error;
        }
    }

    public async readCompactedMemory(playerId: string, characterId: string): Promise<CompactedMemory[]> {
        const filePath = path.join(DATA_DIR, playerId, `${characterId}.json`);

        if (!fs.existsSync(filePath)) {
            return [];
        }

        try {
            const encryptedContent = fs.readFileSync(filePath, 'utf8');
            if (!encryptedContent) {
                return [];
            }
            const decryptedContent = this.decrypt(encryptedContent);
            return JSON.parse(decryptedContent) as CompactedMemory[];
        } catch (error) {
            console.error(`Failed to read or decrypt compacted memory for character ${characterId}:`, error);
            return [];
        }
    }

    public async getAllCompactedMemories(playerId: string): Promise<CompactedMemory[]> {
        const playerDir = path.join(DATA_DIR, playerId);

        if (!fs.existsSync(playerDir)) {
            return [];
        }

        try {
            const allMemories: CompactedMemory[] = [];
            const files = fs.readdirSync(playerDir);

            for (const file of files) {
                if (path.extname(file) === '.json') {
                    const characterId = path.basename(file, '.json');
                    const memories = await this.readCompactedMemory(playerId, characterId);
                    allMemories.push(...memories);
                }
            }
            return allMemories;
        } catch (error) {
            console.error(`Failed to get all compacted memories for player ${playerId}:`, error);
            return [];
        }
    }

    private encrypt(text: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    private decrypt(text: string): string {
        try {
            const textParts = text.split(':');
            if (textParts.length !== 2) throw new Error('Invalid encrypted text format');
            const iv = Buffer.from(textParts.shift()!, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (error) {
            console.error('Decryption failed:', error);
            return '';
        }
    }
}

export const compactedMemoryStore = new CompactedMemoryStore();