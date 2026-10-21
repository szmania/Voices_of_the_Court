import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { RunFileManager } from '../RunFileManager.js';

/** One persisted Whisper Ledger section report. */
export interface WhisperRecord {
    id: string;
    playerId: string;
    section: 'WORLD' | 'REALM' | 'COURT' | 'CIRCLE';
    sectionLabel: string;
    cadenceDays: number;
    gameDateTotalDays: number;
    gameDate: string;
    realDate: string;
    text: string;
    materialCharacters: { id: number, name: string }[];
}

const userDataPath = app.getPath('userData');
const votcDataPath = path.join(userDataPath, 'votc_data');
const whispersDir = path.join(votcDataPath, 'whisper_history');

function getPlayerWhisperDir(playerId: string): string {
    return path.join(whispersDir, playerId);
}

function getWhisperFilePath(playerId: string): string {
    return path.join(getPlayerWhisperDir(playerId), 'whispers.json');
}

/**
 * Persists one generated whisper section report for a player.
 * Creates the whisper_history/<playerId> directory when missing.
 */
export function saveWhisperSection(playerId: string, record: WhisperRecord): void {
    const playerDir = getPlayerWhisperDir(playerId);
    if (!fs.existsSync(playerDir)) {
        fs.mkdirSync(playerDir, { recursive: true });
    }
    const filePath = getWhisperFilePath(playerId);

    let records: WhisperRecord[] = [];
    if (fs.existsSync(filePath)) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(fileContent);
            if (Array.isArray(parsed)) {
                records = parsed;
            }
        } catch (error) {
            console.error(`Error parsing whisper file ${filePath}, it will be overwritten.`, error);
        }
    }

    // Prepend the new record so the array is newest-first.
    records.unshift(record);
    fs.writeFileSync(filePath, JSON.stringify(records, null, '\t'));
}

/**
 * Returns all persisted whisper records for a player, newest-first.
 */
export function getWhispersForPlayer(playerId: string): WhisperRecord[] {
    const filePath = getWhisperFilePath(playerId);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (!Array.isArray(parsed)) {
            return [];
        }
        const records: WhisperRecord[] = parsed.filter((r: any) => r && typeof r === 'object' && r.id);
        // Newest-first by realDate (ISO strings sort lexicographically).
        records.sort((a, b) => (b.realDate || '').localeCompare(a.realDate || ''));
        return records;
    } catch (error) {
        console.error(`Error reading whisper file for player ${playerId}:`, error);
        return [];
    }
}

/**
 * Lists every player that has at least one persisted whisper record.
 */
export function getWhisperPlayerIds(): { id: string }[] {
    if (!fs.existsSync(whispersDir)) {
        return [];
    }
    const playerDirs = fs.readdirSync(whispersDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => ({ id: dirent.name }));
    return playerDirs.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Deletes one whisper record by id. Returns true when a record was removed.
 */
export function deleteWhisper(playerId: string, whisperId: string, userFolderPath?: string): boolean {
    const filePath = getWhisperFilePath(playerId);
    if (!fs.existsSync(filePath)) {
        return false;
    }
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (!Array.isArray(parsed)) {
            return false;
        }
        // Capture the deleted record's section BEFORE filtering so the CK3
        // artifact for that section can be destroyed in-game.
        const deleted = parsed.find((r: any) => r && r.id === whisperId);
        const remaining = parsed.filter((r: any) => !(r && r.id === whisperId));
        if (remaining.length === parsed.length) {
            return false;
        }
        fs.writeFileSync(filePath, JSON.stringify(remaining, null, '\t'));

        // Destroy exactly ONE artifact: the one the mod stored for this section
        // (votc_whisper_sec_<section>). The other three sections' vars are
        // untouched. NOTE: the artifact is destroyed in the CURRENTLY LOADED
        // save regardless of which player's record was deleted — the mod's
        // global vars only exist for the active save.
        if (deleted && deleted.section) {
            try {
                const sectionVar = `votc_whisper_sec_${String(deleted.section).toLowerCase()}`;
                const destroyScript = `global_var:${sectionVar} = { destroy_artifact = this }\nremove_global_variable = ${sectionVar}`;
                if (!userFolderPath) {
                    console.warn('[whisperManager] No userFolderPath provided; artifact destroy script not queued.');
                } else {
                    new RunFileManager(userFolderPath, 'votc_ce_whisper.txt').append(destroyScript);
                    console.log(`[whisperManager] Queued artifact destroy for section ${deleted.section} (var ${sectionVar}).`);
                }
            } catch (error) {
                console.error(`Failed to queue artifact destroy for whisper ${whisperId}:`, error);
            }
        }

        return true;
    } catch (error) {
        console.error(`Error deleting whisper ${whisperId} for player ${playerId}:`, error);
        return false;
    }
}