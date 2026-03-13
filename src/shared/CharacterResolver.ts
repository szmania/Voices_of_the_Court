import { GameData } from './gameData/GameData.js';
import { Character } from './gameData/Character.js';

/**
 * Resolves character objects from IDs, with fallbacks to player and primary AI.
 * @param gameData The GameData object.
 * @param char1Id The ID of the first character (initiator).
 * @param char2Id The ID of the second character (target).
 * @returns An object containing character1 and character2.
 */
export function resolveCharacters(gameData: GameData, char1Id?: number, char2Id?: number): { character1: Character | undefined, character2: Character | undefined } {
    const character1 = char1Id ? gameData.getCharacterById(char1Id) : gameData.getPlayer();
    const character2 = char2Id ? gameData.getCharacterById(char2Id) : gameData.getAi();

    return { character1, character2 };
}
