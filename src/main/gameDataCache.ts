import { GameData } from '../shared/gameData/GameData';

let cachedGameData: GameData | null = null;

export function setCachedGameData(gameData: GameData): void {
    console.debug('Setting cached game data.');
    cachedGameData = gameData;
}

export function getCachedGameData(): GameData | null {
    console.debug('Getting cached game data.');
    return cachedGameData;
}

export function clearCachedGameData(): void {
    console.debug('Clearing cached game data.');
    cachedGameData = null;
}
