import { app } from 'electron';
import * as fs from "fs";
import * as path from "path";
import { Character } from "../../shared/gameData/Character.js";
import { GameData } from '../../shared/gameData/GameData.js';
import { Letter as ILetter, LetterType, StoredLetter, LetterSummary } from "./letterInterfaces.js";
import { randomUUID } from 'crypto';
import { Config } from '../../shared/Config.js';
import { parseLettersFromLog } from './parseLogForLetters.js';

export class LetterManager {
    private static instance: LetterManager;
    private letterHistoryPath: string;
    private letterSummaryPath: string;

    private constructor() {
        this.letterHistoryPath = path.join(app.getPath('userData'), 'votc_data', 'letter_history');
        if (!fs.existsSync(this.letterHistoryPath)) {
            fs.mkdirSync(this.letterHistoryPath, { recursive: true });
        }
        this.letterSummaryPath = path.join(app.getPath('userData'), 'votc_data', 'letter_summaries');
        if (!fs.existsSync(this.letterSummaryPath)) {
            fs.mkdirSync(this.letterSummaryPath, { recursive: true });
        }
    }

    public static getInstance(): LetterManager {
        if (!LetterManager.instance) {
            LetterManager.instance = new LetterManager();
        }
        return LetterManager.instance;
    }

    public getLetterFilePath(playerId: string, characterId: string): string {
        const playerFolderPath = path.join(this.letterHistoryPath, playerId);
        if (!fs.existsSync(playerFolderPath)) {
            fs.mkdirSync(playerFolderPath, { recursive: true });
        }
        return path.join(playerFolderPath, `${characterId}.json`);
    }

    public getLetters(playerId: string, characterId: string): ILetter[] {
        const filePath = this.getLetterFilePath(playerId, characterId);
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                const letters = JSON.parse(data) as ILetter[];
                const playerNumericId = Number(playerId);
                // Re-hydrate dates
                return letters.map(l => ({
                    ...l,
                    timestamp: new Date(l.timestamp),
                    creationTimestamp: l.creationTimestamp ? new Date(l.creationTimestamp) : new Date(l.timestamp),
                    isPlayerSender: l.sender.id === playerNumericId,
                    totalDays: l.totalDays || 0 // Ensure totalDays has a default value
                }));
            } catch (error) {
                console.error(`Error reading letter history for player ${playerId}, character ${characterId}:`, error);
                return [];
            }
        }
        return [];
    }

    public getAllLetters(playerId: string): ILetter[] {
        const playerFolderPath = path.join(this.letterHistoryPath, playerId);
        if (!fs.existsSync(playerFolderPath)) {
            return [];
        }

        let allLetters: ILetter[] = [];
        const files = fs.readdirSync(playerFolderPath);

        for (const file of files) {
            if (file.endsWith('.json')) {
                const characterId = file.replace('.json', '');
                const letters = this.getLetters(playerId, characterId);
                allLetters.push(...letters);
            }
        }

        // Sort all letters by date, most recent first
        allLetters.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return allLetters;
    }

    public getAllPlayerIdsWithLetters(): { id: string, name: string }[] {
        const playerFolderPath = this.letterSummaryPath;
        if (!fs.existsSync(playerFolderPath)) {
            return [];
        }

        const playerDirs = fs.readdirSync(playerFolderPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                const playerId = dirent.name;
                const mapPath = path.join(this.letterSummaryPath, '..', 'conversation_summaries', playerId, '_character_map.json');
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

        return playerDirs.sort((a, b) => a.name.localeCompare(b.name));
    }

    public getCorrespondedCharacters(playerId: string): {id: string, name: string}[] {
        const allLetters = this.getAllLetters(playerId);
        const characterInfo = new Map<string, string>();
        
        const playerNumericId = Number(playerId);

        allLetters.forEach(letter => {
            if (letter.sender && letter.sender.id !== playerNumericId) {
                characterInfo.set(String(letter.sender.id), letter.sender.fullName);
            }
            if (letter.recipient && letter.recipient.id !== playerNumericId) {
                characterInfo.set(String(letter.recipient.id), letter.recipient.fullName);
            }
        });
        
        return Array.from(characterInfo.entries()).map(([id, name]) => ({ id, name }));
    }
    
    public saveLetter(letter: ILetter, playerId: string): void {
        // Letters are stored based on the conversation between player and another character.
        // The file is named after the other character.
        const otherCharacterId = letter.sender.id === Number(playerId) ? String(letter.recipient.id) : String(letter.sender.id);
        
        const filePath = this.getLetterFilePath(playerId, otherCharacterId);
        
        let history: ILetter[] = [];
        if (fs.existsSync(filePath)) {
            history = this.getLetters(playerId, otherCharacterId);
        }

        // Avoid duplicates
        if (!history.find(l => l.id === letter.id)) {
            history.push(letter);
            // Sort by date
            history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }

        try {
            fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');
        } catch (error) {
            console.error(`Error saving letter for player ${playerId}, character ${otherCharacterId}:`, error);
        }
    }

    public markAsRead(playerId: string, characterId: string, letterId: string): void {
        const letters = this.getLetters(playerId, characterId);
        const letterIndex = letters.findIndex(l => l.id === letterId);
        if (letterIndex > -1) {
            letters[letterIndex].isRead = true;
            const filePath = this.getLetterFilePath(playerId, characterId);
            try {
                fs.writeFileSync(filePath, JSON.stringify(letters, null, 2), 'utf8');
            } catch (error) {
                console.error(`Error updating letter status for letter ${letterId}:`, error);
            }
        }
    }

    public getLetterSummaryFilePath(playerId: string, characterId: string): string {
        const playerFolderPath = path.join(this.letterSummaryPath, playerId);
        if (!fs.existsSync(playerFolderPath)) {
            fs.mkdirSync(playerFolderPath, { recursive: true });
        }
        return path.join(playerFolderPath, `${characterId}.json`);
    }

    public getLetterSummaries(playerId: string, characterId: string): LetterSummary[] {
        const filePath = this.getLetterSummaryFilePath(playerId, characterId);
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                const summaries = JSON.parse(data) as any[];
                return summaries.map(s => ({
                    id: s.id || randomUUID(), // Add UUID if missing
                    ...s
                }));
            } catch (error) {
                console.error(`Error reading letter summary for player ${playerId}, character ${characterId}:`, error);
                return [];
            }
        }
        return [];
    }

    public saveLetterSummaries(playerId: string, characterId: string, summaries: LetterSummary[]): void {
        const filePath = this.getLetterSummaryFilePath(playerId, characterId);
        try {
            fs.writeFileSync(filePath, JSON.stringify(summaries, null, 2), 'utf8');
        } catch (error) {
            console.error(`Error saving letter summaries for player ${playerId}, character ${characterId}:`, error);
        }
    }

    public getAllLetterSummaries(playerId: string): (LetterSummary & { characterId: string, characterName: string })[] {
        const playerFolderPath = path.join(this.letterSummaryPath, playerId);
        if (!fs.existsSync(playerFolderPath)) {
            return [];
        }

        const characterMapPath = path.join(this.letterHistoryPath, '..', 'conversation_summaries', playerId, '_character_map.json');
        let characterMap: {[key: string]: string} = {};
        if (fs.existsSync(characterMapPath)) {
            try {
                characterMap = JSON.parse(fs.readFileSync(characterMapPath, 'utf8'));
            } catch (e) {
                console.error('Error reading character map for letters:', e);
            }
        }

        let allSummaries: (LetterSummary & { characterId: string, characterName: string })[] = [];
        const files = fs.readdirSync(playerFolderPath);

        for (const file of files) {
            if (file.endsWith('.json') && file !== '_character_map.json') {
                const characterId = file.replace('.json', '');
                const summaries = this.getLetterSummaries(playerId, characterId);
                const characterName = characterMap[characterId] || `Character ${characterId}`;
                const summariesWithCharId = summaries.map(s => ({...s, characterId, characterName}));
                allSummaries.push(...summariesWithCharId);
            }
        }

        allSummaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return allSummaries;
    }

    public markAsDelivered(playerId: string, characterId: string, letterId: string): void {
        const letters = this.getLetters(playerId, characterId);
        const letterIndex = letters.findIndex(l => l.id === letterId);
        if (letterIndex > -1) {
            letters[letterIndex].delivered = true;
            const filePath = this.getLetterFilePath(playerId, characterId);
            try {
                fs.writeFileSync(filePath, JSON.stringify(letters, null, 2), 'utf8');
                console.log(`Marked letter ${letterId} as delivered.`);
            } catch (error) {
                console.error(`Error updating delivered status for letter ${letterId}:`, error);
            }
        }
    }

    public deliverLetter(storedLetter: StoredLetter, config: Config, gameDate: string) {
        const userFolderPath = config.userFolderPath;
        if (!userFolderPath) {
            console.error("Cannot deliver letter, user folder path is not set.");
            return;
        }
    
        const letter = storedLetter.originalLetter;
        const replyContent = storedLetter.letter.content;
        const letterId = letter.subject; // This is 'letter_5' etc.
    
        const runFolderPath = path.join(userFolderPath, "run");
        if (!fs.existsSync(runFolderPath)) {
            fs.mkdirSync(runFolderPath, { recursive: true });
        }
    
        const letterFilePath = path.join(runFolderPath, "letters.txt");
    
        const escapedReply = replyContent.replace(/"/g, '\\"');
        
        const gameCommand = `debug_log = "[Localize('talk_event.9999.desc')]"
remove_global_variable ?= votc_${letterId}
create_artifact = {
\tname = votc_huixin_title${letterId.replace(/letter_/, "")}
\tdescription = "${escapedReply}"
\ttype = journal
\tvisuals = scroll
\tcreator = global_var:message_second_scope_${letterId}
\tmodifier = artifact_monthly_minor_prestige_1_modifier
\twealth = scope:wealth
\tsave_scope_as = votc_latest_letter
}
scope:votc_latest_letter = {
set_variable = { name = votc_letter_artifact value = yes}
}
set_global_variable = {
\tname = votc_latest_letter
\tvalue = scope:votc_latest_letter
}
trigger_event = message_event.362`;
    
        fs.writeFileSync(letterFilePath, gameCommand, 'utf8');
        console.log(`Delivered letter ${letter.id} by writing to: ${letterFilePath}`);
    }

    public clearLettersFile(config: Config): void {
        const ck3Folder = config.userFolderPath;
        console.log(`LetterManager.clearLettersFile: CK3 user path: ${ck3Folder}`);
        
        if (!ck3Folder) {
          console.warn("LetterManager.clearLettersFile: CK3 user folder is not configured; cannot clear letters file.");
          return;
        }
    
        const runFolder = path.join(ck3Folder, "run");
        const letterFilePath = path.join(runFolder, "letters.txt");
        console.log(`LetterManager.clearLettersFile: Letter file path: ${letterFilePath}`);
    
        if (fs.existsSync(letterFilePath)) {
          fs.writeFileSync(letterFilePath, "debug_log = \"[Localize('talk_event.9999.desc')]\"", "utf-8");
          console.log("Cleared letters.txt file");
        } else {
          console.log("letters.txt file does not exist, nothing to clear");
        }
    }

    public async importLettersFromLog(config: Config, gameData: GameData, playerId: string, gameDate: string, recipientId?: string): Promise<void> {
        const ck3Folder = config.userFolderPath;
        if (!ck3Folder) {
            console.warn("LetterManager.importLettersFromLog: CK3 user folder is not configured.");
            return;
        }
        const debugLogPath = path.join(ck3Folder, 'logs', 'debug.log');

        // Pass gameData to parseLettersFromLog so it can save letters immediately.
        const newLetters = await parseLettersFromLog(debugLogPath, gameData, gameDate, playerId, recipientId);

        if (newLetters.length > 0) {
            console.log(`Imported and saved ${newLetters.length} new letters.`);
        }
    }

    public getLatestLetter(playerId: string): ILetter | null {
        const allLetters = this.getAllLetters(playerId);
        if (allLetters.length === 0) {
            return null;
        }
    
        // Sort by real-world creation timestamp, most recent first
        allLetters.sort((a, b) => {
            const timeA = a.creationTimestamp ? new Date(a.creationTimestamp).getTime() : 0;
            const timeB = b.creationTimestamp ? new Date(b.creationTimestamp).getTime() : 0;
            return timeB - timeA;
        });
    
        return allLetters[0];
    }
}
