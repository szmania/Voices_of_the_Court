import fs from 'fs';
import path from 'path';

/**
 * Character descriptions are stored in a single JSON file in the user data
 * directory, keyed by player ID then character ID:
 *
 *   { [playerId]: { [characterId]: string } }
 *
 * No description is set by default; an empty description removes the entry.
 */
export type CharacterDescriptions = { [playerId: string]: { [characterId: string]: string } };

const FILE_NAME = 'character_descriptions.json';

function getFilePath(userDataPath: string): string {
    return path.join(userDataPath, FILE_NAME);
}

/**
 * Reads all character descriptions. Returns an empty object if the file does
 * not exist or cannot be parsed.
 */
export function getCharacterDescriptions(userDataPath: string): CharacterDescriptions {
    const filePath = getFilePath(userDataPath);
    if (!fs.existsSync(filePath)) {
        return {};
    }
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data && typeof data === 'object' ? data : {};
    } catch (error) {
        console.error('Error reading character descriptions file:', error);
        return {};
    }
}

/**
 * Gets the description for a specific player/character, or an empty string if
 * none is set.
 */
export function getCharacterDescription(userDataPath: string, playerId: string, characterId: string): string {
    const all = getCharacterDescriptions(userDataPath);
    return all[playerId]?.[characterId] || '';
}

/**
 * Gets the effective description for a specific player/character, falling back
 * to the 'global' (All Characters) description when no player-scoped one is set.
 */
export function getEffectiveCharacterDescription(userDataPath: string, playerId: string, characterId: string): string {
    const all = getCharacterDescriptions(userDataPath);
    return all[playerId]?.[characterId] || all['global']?.[characterId] || '';
}

/**
 * Saves a description for a specific player/character. An empty (or
 * whitespace-only) description removes the entry so that no description is
 * stored by default.
 */
export function saveCharacterDescription(userDataPath: string, playerId: string, characterId: string, description: string): void {
    const all = getCharacterDescriptions(userDataPath);
    if (description && description.trim()) {
        if (!all[playerId]) {
            all[playerId] = {};
        }
        all[playerId][characterId] = description;
    } else {
        if (all[playerId]) {
            delete all[playerId][characterId];
            if (Object.keys(all[playerId]).length === 0) {
                delete all[playerId];
            }
        }
    }
    fs.writeFileSync(getFilePath(userDataPath), JSON.stringify(all, null, '\t'), 'utf8');
}

/**
 * Lists the players that currently have at least one character description.
 */
export function getCharacterDescriptionPlayers(userDataPath: string): { id: string, name: string }[] {
    const all = getCharacterDescriptions(userDataPath);
    return Object.keys(all).map(playerId => ({ id: playerId, name: `Player ${playerId}` }));
}

/**
 * Lists the characters that currently have a description for the given player.
 */
export function getCharacterDescriptionCharacters(userDataPath: string, playerId: string): { id: string, name: string }[] {
    const all = getCharacterDescriptions(userDataPath);
    const chars = all[playerId] || {};
    return Object.keys(chars).map(characterId => ({ id: characterId, name: `Character ${characterId}` }));
}