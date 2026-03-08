import { app } from 'electron';
import * as fs from "fs";
import * as path from "path";
import { Character } from "../../shared/gameData/Character.js";
import { Letter as ILetter, LetterType, StoredLetter, LetterSummary } from "./letterInterfaces.js";
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
                // Re-hydrate dates
                return letters.map(l => ({...l, timestamp: new Date(l.timestamp)}));
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

    public getAllPlayerIdsWithLetters(): string[] {
        const playerFolderPath = this.letterHistoryPath;
        if (!fs.existsSync(playerFolderPath)) {
            return [];
        }

        const playerDirs = fs.readdirSync(playerFolderPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                return {
                    name: dirent.name,
                    time: fs.statSync(path.join(playerFolderPath, dirent.name)).mtimeMs,
                };
            });

        if (playerDirs.length === 0) {
            return [];
        }

        // Sort by most recent modification time
        playerDirs.sort((a, b) => b.time - a.time);
        
        return playerDirs.map(dir => dir.name);
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
                return JSON.parse(data) as LetterSummary[];
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

    public deliverLetter(storedLetter: StoredLetter, config: Config, gameDate: string) {
        const userFolderPath = config.userFolderPath;
        if (!userFolderPath) {
            console.error("Cannot deliver letter, user folder path is not set.");
            return;
        }

        // Update the letter in the history file first
        const playerId = String(storedLetter.letter.recipient.id);
        const otherId = String(storedLetter.letter.sender.id);
        const filePath = this.getLetterFilePath(playerId, otherId);
        const lettersInFile = this.getLetters(playerId, otherId);
        
        const letterToUpdate = lettersInFile.find(l => l.replyToId === storedLetter.letter.id);

        if (letterToUpdate) {
            letterToUpdate.timestamp = new Date(gameDate.replace(/\./g, '-'));
            letterToUpdate.delivered = true;
            fs.writeFileSync(filePath, JSON.stringify(lettersInFile, null, 2), 'utf8');
            console.log(`Updated timestamp and delivered status for letter ${letterToUpdate.id} in ${filePath}`);
        }
    
        const letter = storedLetter.letter;
        const replyContent = storedLetter.reply;
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

    public async importLettersFromLog(config: Config, characterNameMap: Map<string, string>, playerId: string, gameDate: string, recipientId?: string): Promise<void> {
        const ck3Folder = config.userFolderPath;
        if (!ck3Folder) {
            console.warn("LetterManager.importLettersFromLog: CK3 user folder is not configured.");
            return;
        }
        const debugLogPath = path.join(ck3Folder, 'logs', 'debug.log');

        // Pass playerId and recipientId to parseLettersFromLog so it can save letters immediately.
        const newLetters = await parseLettersFromLog(debugLogPath, characterNameMap, gameDate, playerId, recipientId);

        if (newLetters.length > 0) {
            console.log(`Imported and saved ${newLetters.length} new letters.`);
        }
    }
}
