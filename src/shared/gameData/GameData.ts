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

export type FamilyMember = {
    id: number;
    name: string;
    relationship: string; // 'Child', 'Spouse', 'Parent', 'Sibling'
    characterId?: number;
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
     * Gets all character IDs with the player character first
     * @returns {number[]} Array of character IDs with player ID first
     */
    getCharacterIdsWithPlayerFirst(): number[] {
        const allIds = Array.from(this.characters.keys());
        // Move player ID to the front if it exists
        const playerIndex = allIds.indexOf(this.playerID);
        if (playerIndex > 0) {
            const playerId = allIds.splice(playerIndex, 1)[0];
            allIds.unshift(playerId);
        }
        return allIds;
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

        // Revive the characters Map from the plain object Map
        const characterMap = new Map<number, Character>();
        if (obj.characters && obj.characters.entries) { // Check if it's a Map-like object
            // First, add the player character if it exists
            const playerId = instance.playerID;
            let playerChar: Character | undefined;
            
            for (const [id, charObj] of obj.characters.entries()) {
                const characterInstance = Character.fromPlainObject(charObj);
                if (id === playerId) {
                    playerChar = characterInstance;
                } else {
                    characterMap.set(id, characterInstance);
                }
            }
            
            // Add player character first if it was found
            if (playerChar) {
                const orderedMap = new Map<number, Character>();
                orderedMap.set(playerId, playerChar);
                // Add all other characters
                for (const [id, char] of characterMap) {
                    orderedMap.set(id, char);
                }
                instance.characters = orderedMap;
            } else {
                instance.characters = characterMap;
            }
        }
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
}
