

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

/** @class */
export class Character {
    /**@property {number} id - the ID of the character */
    id: number; 
    /**@property {string} shortName - example: Count Janos*/
    shortName: string; 
    fullName: string;
    primaryTitle: string;
    sheHe: string;
    age: number;
    gold: number;
    opinionOfPlayer: number;
    sexuality: string;
    personality: string;
    greed: number;
    isIndependentRuler: boolean;
    liege: string;
    consort: string;
    culture: string;
    faith: string;
    house: string;
    isRuler: boolean;
    firstName: string;
    capitalLocation: string;
    topLiege: string;
    prowess: number; 
    isKnight: boolean;
    liegeRealmLaw: string //used for knowing landless camp purpose
    isLandedRuler: boolean;
    heldCourtAndCouncilPositions: string
    titleRankConcept: string;

    secrets: Secret[];
    memories: Memory[];
    traits: Trait[];
    relationsToPlayer: string[];
    relationsToCharacters: { id: number, relations: string[]}[];
    opinionBreakdownToPlayer: OpinionModifier[];
    opinions: { id: number, opinion: number}[];
    relatives: Relative[];
    birthTotalDays?: number;
    // TODO: Use a proper Summary type once it's available in a shared location.
    conversationSummaries: any[];

    constructor(data: string[]){
        this.id = Number(data[0]),
            this.shortName = data[1],
            this.fullName = data[2],
            this.primaryTitle = data[3] === "None of" ? data[25] : data[3],
            this.sheHe = data[4],
            this.age = Number(data[5]),
            this.gold = Math.floor(Number(data[6])),
            this.opinionOfPlayer = Number(data[7]),
            this.sexuality = removeTooltip(data[8]),
            this.personality = data[9],
            this.greed = Number(data[10]),
            this.isIndependentRuler = !!Number(data[11]),
            this.liege = data[12],
            this.consort = data[13],
            this.culture = data[14],
            this.faith = data[15],
            this.house = data[16],
            this.isRuler = !!Number(data[17]),
            this.firstName = data[18],
            this.capitalLocation = data[19],
            this.topLiege = data[20],
            this.prowess = Number(data[21]),
            this.isKnight = !!Number(data[22]),
            this.liegeRealmLaw = data[23],
            this.isLandedRuler = !!Number(data[24]),
            this.heldCourtAndCouncilPositions = data[25],
            this.titleRankConcept = data[26],
            this.secrets = [],
            this.memories = [],
            this.traits = [],
            this.relationsToPlayer = [],
            this.relationsToCharacters = [],
            this.opinionBreakdownToPlayer = []
            this.opinions = [];
            this.relatives = [];
            this.conversationSummaries = [];
    }

    /**
     * Check if the character has a trait with a given name.
     * @param name - the name of the trait
     * @return {boolean} 
     */
    hasTrait(name: string): boolean{
        return this.traits.some(trait => trait.name.toLowerCase() == name.toLowerCase())
    }

    /**
     * Append a new trait to the character.
     * @param {Trait }trait
     * @returns {void} 
     */
    addTrait(trait: Trait): void{
        this.traits.push(trait);
    }

    removeTrait(name: string): void{
        this.traits.filter( (trait) => {
            return trait.name.toLowerCase() !== name.toLowerCase();
        });
    }

    /**
     * Get the value of the opinion modifier with the given reason text
     * @param {string} reason - the opinion modifier's reason text
     * @returns {number} - opinion modifier's value. returns 0 if doesn't exist.
     */
    getOpinionModifierValue(reason: string): number{
        let target = this.opinionBreakdownToPlayer.find( modifier => modifier.reason === reason);

        if(target !== undefined){
            return target.value;
        }
        else{
            return 0;
        }
    }

    /**
     * Sets the opinion modifier's value. Creates a new opinion modifier if it doesn't exist. NOTE: this will also update the opinionOfPlayer property.
     * @param {string} reason - The opinion modifier's reason text.
     * @param {string} value - The value to set the opinion modifier.
     * @returns {void}
     */
    setOpinionModifierValue(reason: string, value: number): void{
        let targetIndex = this.opinionBreakdownToPlayer.findIndex( (om: OpinionModifier) =>{
            om.reason.toLowerCase() == reason.toLowerCase();
        })

        if(targetIndex != -1){
            this.opinionBreakdownToPlayer[targetIndex].value = value;
        }
        else{
            this.opinionBreakdownToPlayer.push({
                reason: "From conversations",
                value: value
            })
        }

        //recalculate opinionOfPlayer
        let sum = 0;
        for(const opinionModifier of this.opinionBreakdownToPlayer){
            if (!Number.isNaN(opinionModifier.value)) {
                sum += Number(opinionModifier.value);
            }
        }
        this.opinionOfPlayer = sum;
    }   

    /**
     * Get a detailed formatted description of the character's relatives, including age, death/marital/trait info.
     * @param gameTotalDays - current game date in total days (used to compute relative ages)
     * @returns {string} - Formatted relatives description or empty string if no relatives
     */
    getRelativesDescription(gameTotalDays: number): string {
        const structured = this.relatives.filter(r =>
            r.relationship === 'Parent' || r.relationship === 'Child' || r.relationship === 'Sibling'
        );
        if (structured.length === 0) return "";

        const byRelationship = new Map<string, Relative[]>();
        for (const rel of structured) {
            if (!byRelationship.has(rel.relationship)) byRelationship.set(rel.relationship, []);
            byRelationship.get(rel.relationship)!.push(rel);
        }

        const calcAge = (birthTotalDays: number): number =>
            Math.floor((gameTotalDays - birthTotalDays) / 365.25);

        const genderWord = (sheHe: string | undefined, word: string): string => {
            if (sheHe === 'she') return word === 'sibling' ? 'sister' : word;
            if (sheHe === 'he')  return word === 'sibling' ? 'brother' : word;
            return word;
        };

        const sectionOrder = ['Parent', 'Child', 'Sibling'];
        const sections: string[] = [];

        for (const relType of sectionOrder) {
            const members = byRelationship.get(relType);
            if (!members || members.length === 0) continue;

            const label = relType === 'Child' ? 'Children' : relType === 'Parent' ? 'Parents' : 'Siblings';
            const memberStrs = members.map(rel => {
                const parts: string[] = [];

                // Build the name prefix (e.g. "older brother Heardræd")
                if (relType === 'Sibling' && rel.birthTotalDays !== undefined && this.birthTotalDays !== undefined) {
                    const qualifier = rel.birthTotalDays < this.birthTotalDays ? 'older' : 'younger';
                    parts.push(`${qualifier} ${genderWord(rel.sheHe, 'sibling')} ${rel.name}`);
                } else {
                    parts.push(rel.name);
                }

                // Age (living relatives only)
                if (!rel.isDeceased && rel.birthTotalDays !== undefined) {
                    parts.push(`age ${calcAge(rel.birthTotalDays)}`);
                }

                // Death / marital status
                if (rel.isDeceased) {
                    parts.push(rel.deathDate ? `deceased ${rel.deathDate}` : 'deceased');
                } else if (rel.maritalStatus === 'is_concubine' && rel.partners.length > 0) {
                    parts.push(`concubine of ${rel.partners[0].name}`);
                } else if (rel.maritalStatus === 'betrothed' && rel.partners.length > 0) {
                    parts.push(`betrothed to ${rel.partners[0].name}`);
                } else if (rel.maritalStatus === 'unmarried') {
                    parts.push('unmarried');
                } else if (rel.partners.length > 0) {
                    const spouses = rel.partners.filter(p => p.type === 'spouse').map(p => p.name);
                    const concubines = rel.partners.filter(p => p.type === 'concubine').map(p => p.name);
                    if (spouses.length > 0) parts.push(`married to ${spouses.join(', ')}`);
                    if (concubines.length > 0) parts.push(`concubine(s): ${concubines.join(', ')}`);
                }

                if (rel.traits && rel.traits.length > 0) {
                    parts.push(`traits: ${rel.traits.map(t => t.name).join(', ')}`);
                }

                const name = parts[0];
                return parts.length > 1 ? `${name} (${parts.slice(1).join('; ')})` : name;
            });

            sections.push(`${label}: ${memberStrs.join(', ')}`);
        }

        return sections.join('; ');
    }

    static fromPlainObject(obj: any): Character {
        const instance = new Character(new Array(27).fill(''));
        Object.assign(instance, obj);
        return instance;
    }
}

