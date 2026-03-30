import { Character } from "./Character";
import { removeTooltip } from "./parseLog";

/**@typedef {import('./Character').Character} Character */

export type Trait = {
    category: string,
    name: string,
    desc: string
}

export type Memory = {
    type: string,
    creationDate: string,
    desc: string,
    /**@property {number} relevanceWeight - how relevant the memory to the current conversation. The higher, the more relevant. */
    relevanceWeight: number
}

export type OpinionModifier = {
    reason: string,
    value: number,
}

export type Secret = {
    name: string,
    desc: string,
    category: string
}

export type RelativePartner = {
    id: number;
    name: string;
    type: 'spouse' | 'concubine' | 'betrothed';
}

export type Relative = {
    id: number;
    name: string;
    relationship: string; // 'Child', 'Spouse', 'Parent', 'Sibling', or game-engine relation strings
    sheHe?: string;
    birthDate?: string;
    birthTotalDays?: number;
    isDeceased: boolean;
    deathDate?: string;
    deathReason?: string;
    traits: { category: string; name: string; desc: string }[];
    maritalStatus?: 'married' | 'is_concubine' | 'betrothed' | 'unmarried';
    partners: RelativePartner[];
    otherParentId?: number;
    otherParentName?: string;
}

/** 
 * @class
*/
export class GameData {
    date: string;
    totalDays: number;
    scene: string;
    location: string;
    locationController: string;
    recentEvent: { type: string; context: any } | null = null;

    playerID: number;
    playerName: string;
    aiID: number;
    aiName: string;

    // Used to store the shortName of non-player characters for use by parseVariables
    // @deprecated
    character1Name: string = "";
    // @deprecated
    character2Name: string = "";

    characters: Map<number,Character>

    constructor(data: string[]){
            this.playerID = Number(data[0]),
            this.playerName = removeTooltip(data[1]),
            this.aiID = Number(data[2]),
            this.aiName = removeTooltip(data[3]),
            this.date = data[4],
            this.totalDays = Number(data[8]),
            this.scene = data[5].substring(11),
            this.location = data[6],
            this.locationController = data[7],
    
            this.characters = new Map<number,Character>
    }

    getPlayer(): Character{
        return this.characters.get(this.playerID)!;
    }

    /**
     * 
     * @return {Character} ai
     */
    getAi(): Character{
        return this.characters.get(this.aiID)!;
    }

    getCharacter(characterID: number): Character | undefined {
        return this.characters.get(characterID);
    }

    getCharacterById(id: number): Character | undefined {
        return this.characters.get(id);
    }

    /**
     * Add a character to the characters map, ensuring player character is first
     * @param id - Character ID
     * @param character - Character object
     */
    addCharacter(id: number, character: Character): void {
        console.log(`[GameData.addCharacter] Adding character ID: ${id}, name: ${character.fullName}`);
        
        // If this is the player character and map is not empty, reorder
        if (id === this.playerID && this.characters.size > 0) {
            console.log(`[GameData.addCharacter] This is player character, reordering map`);
            const newMap = new Map<number, Character>();
            newMap.set(id, character);
            
            // Add all existing characters
            for (const [existingId, existingChar] of this.characters) {
                newMap.set(existingId, existingChar);
            }
            
            this.characters = newMap;
            console.log(`[GameData.addCharacter] New character ID order: ${Array.from(this.characters.keys()).join(', ')}`);
        } else {
            this.characters.set(id, character);
        }
    }

    /**
     * Gets all character IDs with the player character first
     * @returns {number[]} Array of character IDs with player ID first
     */
    getCharacterIdsWithPlayerFirst(): number[] {
        const allIds = Array.from(this.characters.keys());
        console.log(`[GameData.getCharacterIdsWithPlayerFirst] Raw character IDs: ${allIds.join(', ')}`);
        console.log(`[GameData.getCharacterIdsWithPlayerFirst] Player ID: ${this.playerID}`);
        
        // Move player ID to the front if it exists
        const playerIndex = allIds.indexOf(this.playerID);
        console.log(`[GameData.getCharacterIdsWithPlayerFirst] Player index: ${playerIndex}`);
        
        if (playerIndex > 0) {
            const playerId = allIds.splice(playerIndex, 1)[0];
            allIds.unshift(playerId);
            console.log(`[GameData.getCharacterIdsWithPlayerFirst] Moved player to front. New order: ${allIds.join(', ')}`);
        } else if (playerIndex === 0) {
            console.log(`[GameData.getCharacterIdsWithPlayerFirst] Player already at index 0`);
        } else {
            console.log(`[GameData.getCharacterIdsWithPlayerFirst] Player not found in character IDs`);
        }
        
        return allIds;
    }

    /**
     * Gets all character IDs in their current map order.
     * @returns {number[]} Array of character IDs.
     */
    getCharacterIds(): number[] {
        return Array.from(this.characters.keys());
    }

    /**
     * Gets all characters in the conversation except the player and the main AI.
     * @returns {Character[]} An array of other characters.
     */
    getOtherCharacters(): Character[] {
        return Array.from(this.characters.values()).filter(
            char => char.id !== this.playerID && char.id !== this.aiID
        );
    }

    static fromPlainObject(obj: any): GameData {
        // Create a dummy instance because constructor requires a string array
        const instance = new GameData(new Array(9).fill(''));
        Object.assign(instance, obj);

        // Revive the characters Map from the plain object
        const characterMap = new Map<number, Character>();
        if (obj.characters) {
            const playerId = instance.playerID;
            let playerChar: Character | undefined;
            
            console.log(`[GameData.fromPlainObject] Player ID: ${playerId}`);
            
            // Check if obj.characters is a Map or a plain object
            let entries: [any, any][];
            if (obj.characters.entries && typeof obj.characters.entries === 'function') {
                // It's a Map-like object
                entries = Array.from(obj.characters.entries());
            } else {
                // It's a plain object
                entries = Object.entries(obj.characters);
            }
            
            console.log(`[GameData.fromPlainObject] Characters entries count: ${entries.length}`);
            
            for (const [id, charObj] of entries) {
                const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
                const characterInstance = Character.fromPlainObject(charObj);
                console.log(`[GameData.fromPlainObject] Processing character ID: ${numericId}, name: ${characterInstance.fullName}`);
                if (numericId === playerId) {
                    console.log(`[GameData.fromPlainObject] Found player character: ${characterInstance.fullName}`);
                    playerChar = characterInstance;
                } else {
                    characterMap.set(numericId, characterInstance);
                }
            }
            
            // Add player character first if it was found
            if (playerChar) {
                const orderedMap = new Map<number, Character>();
                orderedMap.set(playerId, playerChar);
                console.log(`[GameData.fromPlainObject] Added player character ${playerChar.fullName} first to orderedMap`);
                
                // Add all other characters
                for (const [id, char] of characterMap) {
                    orderedMap.set(id, char);
                    console.log(`[GameData.fromPlainObject] Added character ${char.fullName} (ID: ${id}) to orderedMap`);
                }
                
                // Log the final order
                const finalIds = Array.from(orderedMap.keys());
                console.log(`[GameData.fromPlainObject] Final character ID order: ${finalIds.join(', ')}`);
                console.log(`[GameData.fromPlainObject] Player ID ${playerId} is at index: ${finalIds.indexOf(playerId)}`);
                
                instance.characters = orderedMap;
            } else {
                console.log(`[GameData.fromPlainObject] Player character not found in characters map`);
                instance.characters = characterMap;
            }
        } else {
            console.log(`[GameData.fromPlainObject] No characters found in obj.characters`);
        }
        
        // Ensure player is first
        instance.ensurePlayerFirst();
        
        return instance;
    }

    /**
     * Sets the names of non-player characters for use by parseVariables.
     * @deprecated This method is not scalable. Use getOtherCharacters() instead.
     */
    setCharacterNames(): void {
        // const nonPlayerCharacters = this.getOtherCharacters();
        
        // this.character1Name = nonPlayerCharacters[0]?.shortName || "someone";
        // this.character2Name = nonPlayerCharacters[1]?.shortName || "another person";
    }

    /**
     * Ensure the player character is first in the characters map
     */
    ensurePlayerFirst(): void {
        const playerId = this.playerID;
        const playerChar = this.characters.get(playerId);
        
        if (!playerChar) {
            console.log(`[GameData.ensurePlayerFirst] Player character ${playerId} not found in map`);
            return;
        }
        
        const currentIds = Array.from(this.characters.keys());
        if (currentIds.length > 0 && currentIds[0] !== playerId) {
            console.log(`[GameData.ensurePlayerFirst] Player is not first. Current order: ${currentIds.join(', ')}`);
            
            const newMap = new Map<number, Character>();
            newMap.set(playerId, playerChar);
            
            // Add all other characters
            for (const [id, char] of this.characters) {
                if (id !== playerId) {
                    newMap.set(id, char);
                }
            }
            
            this.characters = newMap;
            console.log(`[GameData.ensurePlayerFirst] New order: ${Array.from(this.characters.keys()).join(', ')}`);
        } else {
            console.log(`[GameData.ensurePlayerFirst] Player is already first or map is empty`);
        }
    }
}
