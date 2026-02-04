import fs from 'fs';
import path from 'path';

export interface BookmarkPlayer {
    id: string;
    name: string;
}

export interface BookmarkData {
    date: string;
    player: BookmarkPlayer;
    characters_in_bookmark: Map<string, string>; // id -> name
}

export async function parseLogForBookmarks(debugLogPath: string): Promise<BookmarkData | undefined> {
    console.log(`Starting to parse log file for bookmarks at: ${debugLogPath}`);
    
    if (!fs.existsSync(debugLogPath)) {
        console.error(`Error: Log file not found at ${debugLogPath}`);
        return undefined;
    }

    const fileContent = await fs.promises.readFile(debugLogPath, 'utf8');
    const lines = fileContent.split(/\r?\n/);
    
    // Find the last VOTC:BOOKMARK block
    let lastBookmarkBlockStart = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('VOTC:BOOKMARK') && lines[i].includes('hmd_start')) {
            lastBookmarkBlockStart = i;
            break;
        }
    }
    
    if (lastBookmarkBlockStart === -1) {
        console.log("No VOTC:BOOKMARK block found in the log file.");
        return undefined;
    }
    
    // Extract the bookmark block
    let bookmarkBlock: string[] = [];
    let inBookmarkBlock = false;
    
    for (let i = lastBookmarkBlockStart; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('VOTC:BOOKMARK') && line.includes('hmd_start')) {
            inBookmarkBlock = true;
        }
        
        if (inBookmarkBlock) {
            bookmarkBlock.push(line);
            
            if (line.includes('VOTC:BOOKMARK') && line.includes('hmd_end')) {
                break; // End of bookmark block
            }
        }
    }
    
    if (bookmarkBlock.length === 0) {
        console.log("Empty bookmark block found.");
        return undefined;
    }
    
    // Parse the bookmark block
    const bookmarkData: BookmarkData = {
        date: "",
        player: { id: "", name: "" },
        characters_in_bookmark: new Map<string, string>()
    };
    
    let inCharInfo = false;
    
    for (const line of bookmarkBlock) {
        if (!line.includes('VOTC:BOOKMARK')) continue;
        
        const data = line.split('/;/');
        
        // Extract date
        if (data.includes('time')) {
            const timeIndex = data.indexOf('time');
            if (timeIndex + 2 < data.length) {
                bookmarkData.date = data[timeIndex + 2];
            }
        }
        
        // Extract player info
        if (data.includes('playerdate')) {
            const playerIndex = data.indexOf('playerdate');
            if (playerIndex + 2 < data.length) {
                bookmarkData.player.id = data[playerIndex + 1];
                bookmarkData.player.name = data[playerIndex + 2];
            }
        }
        
        // Handle character info section
        if (data.includes('hmd_charinfo_start')) {
            inCharInfo = true;
            continue;
        }
        
        if (data.includes('hmd_charinfo_end')) {
            inCharInfo = false;
            continue;
        }
        
        // Extract character info
        if (inCharInfo && data.includes('character')) {
            const charIndex = data.indexOf('character');
            if (charIndex + 2 < data.length) {
                const charId = data[charIndex + 1];
                const charName = data[charIndex + 2];
                bookmarkData.characters_in_bookmark.set(charId, charName);
            }
        }
    }
    
    console.log(`Parsed bookmark data: date=${bookmarkData.date}, player=${bookmarkData.player.name}, characters=${bookmarkData.characters_in_bookmark.size}`);
    
    return bookmarkData;
}