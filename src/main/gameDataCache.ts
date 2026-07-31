import { GameData } from '../shared/gameData/GameData';

let cachedGameData: GameData | null = null;

export function setCachedGameData(data: GameData): void {
  cachedGameData = data;
  console.log('GameData cached.');
}

export function getCachedGameData(): GameData | null {
  if (cachedGameData) {
    console.log('Retrieved cached GameData.');
  }
  return cachedGameData;
}

export function clearCachedGameData(): void {
  cachedGameData = null;
  console.log('GameData cache cleared.');
}