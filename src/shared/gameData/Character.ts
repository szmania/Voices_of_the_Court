import {Memory, Trait, OpinionModifier, Secret, Relative} from "./GameData"
import { removeTooltip } from "./parseLog";

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

