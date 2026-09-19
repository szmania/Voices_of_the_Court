import fs from 'fs';
import path from 'path';

/**
 * Character descriptions are stored as one JSON file per player in a
 * `character_descriptions` subdirectory of the user data directory. Each file
 * is named `<playerId>.json` and contains `{ [characterId]: string }` (no
 * player nesting — the file name is the player id).
 *
 *   <userDataPath>/character_descriptions/<playerId>.json
 *
 * No description is set by default; an empty description removes the entry.
 */
export type CharacterDescriptions = { [playerId: string]: { [characterId: string]: string } };

const DIR_NAME = 'character_descriptions';
const OLD_FILE_NAME = 'character_descriptions.json';
const MIGRATED_SUFFIX = '.migrated';

function getDirPath(userDataPath: string): string {
    return path.join(userDataPath, DIR_NAME);
}

// Sanitize a player id into a safe filename stem (no path separators or
// traversal sequences) so arbitrary ids cannot escape the directory.
function sanitizePlayerId(playerId: string): string {
    return playerId.replace(/[\\/]/g, '_').replace(/\.\./g, '_');
}

function getPlayerFilePath(userDataPath: string, playerId: string): string {
    return path.join(getDirPath(userDataPath), `${sanitizePlayerId(playerId)}.json`);
}

// Read a single player's file -> { characterId: desc } or {} if missing/bad.
function readPlayerFile(filePath: string): { [characterId: string]: string } {
    if (!fs.existsSync(filePath)) return {};
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data && typeof data === 'object' ? data : {};
    } catch (error) {
        console.error(`Error reading character descriptions file ${filePath}:`, error);
        return {};
    }
}

// One-time migration: if the old single-file layout exists and the new
// directory has no files yet, split it into per-player files, then rename the
// old file so it is not re-migrated. A failed migration must not break
// operation, so it is wrapped in try/catch.
function ensureMigrated(userDataPath: string): void {
    const oldFilePath = path.join(userDataPath, OLD_FILE_NAME);
    if (!fs.existsSync(oldFilePath)) return;

    const dirPath = getDirPath(userDataPath);
    if (fs.existsSync(dirPath)) {
        const existing = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
        if (existing.length > 0) return;
    }

    try {
        const data = JSON.parse(fs.readFileSync(oldFilePath, 'utf8'));
        if (data && typeof data === 'object') {
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
            for (const playerId of Object.keys(data)) {
                const chars = data[playerId];
                if (chars && typeof chars === 'object' && Object.keys(chars).length > 0) {
                    fs.writeFileSync(getPlayerFilePath(userDataPath, playerId), JSON.stringify(chars, null, '\t'), 'utf8');
                }
            }
        }
        fs.renameSync(oldFilePath, `${oldFilePath}${MIGRATED_SUFFIX}`);
        console.log(`Migrated character descriptions from ${OLD_FILE_NAME} to per-player files in ${DIR_NAME}.`);
    } catch (error) {
        console.error('Character description migration failed (non-fatal):', error);
    }
}

/**
 * Reads all character descriptions, merging every per-player file into the
 * `{ [playerId]: { [characterId]: string } }` shape. Returns an empty object
 * if the directory does not exist or cannot be read.
 */
export function getCharacterDescriptions(userDataPath: string): CharacterDescriptions {
    ensureMigrated(userDataPath);
    const dirPath = getDirPath(userDataPath);
    if (!fs.existsSync(dirPath)) return {};

    let files: string[];
    try {
        files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    } catch (error) {
        console.error('Error reading character descriptions directory:', error);
        return {};
    }

    const all: CharacterDescriptions = {};
    for (const file of files) {
        const playerId = path.basename(file, '.json');
        const chars = readPlayerFile(path.join(dirPath, file));
        if (Object.keys(chars).length > 0) {
            all[playerId] = chars;
        }
    }
    return all;
}

/**
 * Gets the description for a specific player/character, or an empty string if
 * none is set. Reads only the relevant player file.
 */
export function getCharacterDescription(userDataPath: string, playerId: string, characterId: string): string {
    ensureMigrated(userDataPath);
    const chars = readPlayerFile(getPlayerFilePath(userDataPath, playerId));
    return chars[characterId] || '';
}

/**
 * Gets the effective description for a specific player/character, falling back
 * to the 'global' (All Characters) description when no player-scoped one is
 * set. Reads only the player file and the global file.
 */
export function getEffectiveCharacterDescription(userDataPath: string, playerId: string, characterId: string): string {
    ensureMigrated(userDataPath);
    const playerChars = readPlayerFile(getPlayerFilePath(userDataPath, playerId));
    if (playerChars[characterId]) return playerChars[characterId];
    const globalChars = readPlayerFile(getPlayerFilePath(userDataPath, 'global'));
    return globalChars[characterId] || '';
}

/**
 * Saves a description for a specific player/character. An empty (or
 * whitespace-only) description removes the entry; if no keys remain the
 * player's file is deleted. Creates the directory if missing.
 */
export function saveCharacterDescription(userDataPath: string, playerId: string, characterId: string, description: string): void {
    ensureMigrated(userDataPath);
    const dirPath = getDirPath(userDataPath);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    const filePath = getPlayerFilePath(userDataPath, playerId);
    const chars = readPlayerFile(filePath);

    if (description && description.trim()) {
        chars[characterId] = description;
        fs.writeFileSync(filePath, JSON.stringify(chars, null, '\t'), 'utf8');
    } else {
        delete chars[characterId];
        if (Object.keys(chars).length === 0) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(chars, null, '\t'), 'utf8');
        }
    }
}

/**
 * Lists the players that currently have at least one character description.
 * Player id is the file stem (preserved exactly, including 'global').
 */
export function getCharacterDescriptionPlayers(userDataPath: string): { id: string, name: string }[] {
    ensureMigrated(userDataPath);
    const dirPath = getDirPath(userDataPath);
    if (!fs.existsSync(dirPath)) return [];

    let files: string[];
    try {
        files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    } catch (error) {
        console.error('Error reading character descriptions directory:', error);
        return [];
    }

    return files.map(file => {
        const playerId = path.basename(file, '.json');
        return { id: playerId, name: `Player ${playerId}` };
    });
}

/**
 * Lists the characters that currently have a description for the given player.
 * Reads only that single player's file.
 */
export function getCharacterDescriptionCharacters(userDataPath: string, playerId: string): { id: string, name: string }[] {
    ensureMigrated(userDataPath);
    const chars = readPlayerFile(getPlayerFilePath(userDataPath, playerId));
    return Object.keys(chars).map(characterId => ({ id: characterId, name: `Character ${characterId}` }));
}