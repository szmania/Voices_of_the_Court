

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DiaryEntry } from './ts/diary_interfaces';

const userDataPath = path.join(app.getPath('userData'), 'votc_data');
const diariesDir = path.join(userDataPath, 'diaries');

function getPlayerDiaryDir(playerId: string): string {
    return path.join(diariesDir, playerId);
}

function getDiaryFilePath(playerId: string, characterId: string): string {
    return path.join(getPlayerDiaryDir(playerId), `${characterId}.json`);
}

export async function parseDiaryIdsFromLog(logPath: string): Promise<{ playerId: string | null }> {
    // This function can be implemented similarly to how summary/conversation history IDs are parsed
    // For now, we'll just return a placeholder
    return { playerId: null };
}

export async function getAllDiaryPlayerIds(): Promise<{ id: string, name: string }[]> {
    if (!fs.existsSync(diariesDir)) {
        return [];
    }
    const playerDirs = fs.readdirSync(diariesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => {
            const playerId = dirent.name;
            const mapPath = path.join(diariesDir, playerId, '_character_map.json');
            let playerName = `Player ${playerId}`;
            if (fs.existsSync(mapPath)) {
                try {
                    const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
                    if (mapData[playerId]) {
                        playerName = mapData[playerId];
                    }
                } catch (e) {
                    console.error(`Error reading character map for player ${playerId}:`, e);
                }
            }
            return { id: playerId, name: playerName };
        });
    return playerDirs;
}

export async function getDiaryFiles(playerId: string): Promise<string[]> {
    const playerDir = getPlayerDiaryDir(playerId);
    if (!fs.existsSync(playerDir)) {
        return [];
    }
    return fs.readdirSync(playerDir).filter(file => file.endsWith('.json') && file !== '_character_map.json');
}

export async function readDiaryFile(playerId: string, characterId: string): Promise<DiaryEntry[]> {
    const filePath = getDiaryFilePath(playerId, characterId);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const entries: DiaryEntry[] = JSON.parse(content);
        return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
        console.error(`Error reading diary file for player ${playerId}, character ${characterId}:`, error);
        return [];
    }
}

export async function saveDiaryFile(playerId: string, characterId: string, newEntry: DiaryEntry): Promise<void> {
    const playerDir = getPlayerDiaryDir(playerId);
    if (!fs.existsSync(playerDir)) {
        fs.mkdirSync(playerDir, { recursive: true });
    }
    const filePath = getDiaryFilePath(playerId, characterId);
    let entries: DiaryEntry[] = [];
    if (fs.existsSync(filePath)) {
        try {
            entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`Error parsing existing diary file, it will be overwritten:`, error);
        }
    }
    entries.unshift(newEntry);
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    fs.writeFileSync(filePath, JSON.stringify(entries, null, '\t'), 'utf8');
}

export async function getCharacterMap(playerId: string): Promise<{ [key: string]: string }> {
    const mapPath = path.join(getPlayerDiaryDir(playerId), '_character_map.json');
    if (fs.existsSync(mapPath)) {
        try {
            return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        } catch (e) {
            console.error(`Error reading character map for player ${playerId}:`, e);
        }
    }
    return {};
}
