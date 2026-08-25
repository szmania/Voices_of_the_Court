import {Memory, Trait, OpinionModifier, Secret, Relative, StressInfo, LegitimacyInfo, MaaRegiment, KnownSecret, CharacterModifier, PersonaNumbers, OwnedSecret, CharacterScheme, ExposedTargetingScheme} from "./GameData"
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
    ownedSecrets: OwnedSecret[];
    ownedSchemes: CharacterScheme[];
    exposedTargetingSchemes: ExposedTargetingScheme[];
    memories: Memory[];
    traits: Trait[];
    relationsToPlayer: string[];
    relationsToCharacters: { id: number, relations: string[]}[];
    opinionBreakdownToPlayer: OpinionModifier[];
    opinions: { id: number, opinion: number}[];
    relatives: Relative[];
    birthTotalDays?: number;
    // --- P0 extended facts ---
    stress?: StressInfo;
    legitimacy?: LegitimacyInfo;
    incomeGold?: number;
    incomeBalance?: number;
    incomeBreakdown?: string;
    treasuryAmount?: number;
    treasuryTooltip?: string;
    influenceAmount?: number;
    influenceTooltip?: string;
    herdAmount?: number;
    herdBreakdown?: string;
    vassalLeviesTotal?: number;
    domainLevyHoldings: number[];
    theocraticLeaseLevies?: number;
    maaRegiments: MaaRegiment[];
    laws: string[];
    modifiers: CharacterModifier[];
    knownSecrets: KnownSecret[];
    personaNumbers?: PersonaNumbers;
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
            this.ownedSecrets = [],
            this.ownedSchemes = [],
            this.exposedTargetingSchemes = [],
            this.memories = [],
            this.traits = [],
            this.relationsToPlayer = [],
            this.relationsToCharacters = [],
            this.opinionBreakdownToPlayer = []
            this.opinions = [];
            this.relatives = [];
            this.conversationSummaries = [];
            this.domainLevyHoldings = [];
            this.maaRegiments = [];
            this.laws = [];
            this.modifiers = [];
            this.knownSecrets = [];
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
     * Sum of all domain holding levy sizes logged this snapshot.
     */
    getTotalDomainLevies(): number {
        return this.domainLevyHoldings.reduce((sum, n) => sum + n, 0);
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

    /**
     * Compact, prompt-ready rendering of P0 extended facts.
     * Token budget uses the chars/4 heuristic (same as calculateTokensFromText fallback).
     * Sections are added in priority order; once the budget is hit, remaining sections are dropped.
     */
    getExtendedFactsDescription(maxTokens: number = 600): string {
        const trimText = (s: string | undefined, max = 240): string =>
            s && s.trim() ? s.trim().slice(0, max) : "";
        const isNum = (v: number | undefined): v is number =>
            typeof v === 'number' && Number.isFinite(v);

        const sections: string[] = [];

        if (this.stress) {
            const s = this.stress;
            const head = isNum(s.value) ? `Stress: ${s.value}` : 'Stress';
            if (!s.level) {
                sections.push(head);
            }
            else {
                const detail = isNum(s.progress) ? ` (${s.level}, ${s.progress}%)` : ` (${s.level})`;
                sections.push(head + detail);
            }
        }

        if (this.legitimacy && isNum(this.legitimacy.value)) {
            const l = this.legitimacy;
            const expectations = [
                l.powerfulVassalExpectation && `powerful vassals expect ${l.powerfulVassalExpectation}`,
                l.vassalExpectation && `vassals expect ${l.vassalExpectation}`,
                l.liegeExpectation && `liege expects ${l.liegeExpectation}`
            ].filter(Boolean) as string[];
            const legitimacyDetailParts = [
                isNum(l.level) ? `level ${l.level}` : '',
                l.type
            ].filter(Boolean);
            const legitimacyDetail = legitimacyDetailParts.length > 0 ? ` (${legitimacyDetailParts.join(', ')})` : '';
            sections.push(`Legitimacy: ${l.value}${legitimacyDetail}${expectations.length ? '; ' + expectations.join(', ') : ''}`);
        }

        const financeParts: string[] = [];
        const incomeParts: string[] = [];
        if (isNum(this.incomeGold)) incomeParts.push(`gold ${this.incomeGold}`);
        if (isNum(this.incomeBalance)) incomeParts.push(`monthly balance ${this.incomeBalance}`);
        if (incomeParts.length > 0) financeParts.push(incomeParts.join(', '));
        const balanceDetail = trimText(this.incomeBreakdown);
        if (balanceDetail) financeParts.push(`balance detail: ${balanceDetail}`);
        if (isNum(this.treasuryAmount)) {
            const tt = trimText(this.treasuryTooltip, 120);
            financeParts.push(`treasury ${this.treasuryAmount}${tt ? ' (' + tt + ')' : ''}`);
        }
        if (isNum(this.influenceAmount)) financeParts.push(`influence ${this.influenceAmount}`);
        if (isNum(this.herdAmount)) {
            const hb = trimText(this.herdBreakdown, 120);
            financeParts.push(`herd ${this.herdAmount}${hb ? ' (' + hb + ')' : ''}`);
        }
        if (financeParts.length > 0) sections.push(`Finances: ${financeParts.join('; ')}`);

        const troopParts: string[] = [];
        if (isNum(this.vassalLeviesTotal)) troopParts.push(`vassal levies ${this.vassalLeviesTotal}`);
        const validDomainLevies = this.domainLevyHoldings.filter(n => isNum(n));
        if (validDomainLevies.length > 0) troopParts.push(`domain levies ${validDomainLevies.reduce((sum, n) => sum + n, 0)}`);
        if (isNum(this.theocraticLeaseLevies)) troopParts.push(`theocratic lease ${this.theocraticLeaseLevies}`);
        const validMaa = this.maaRegiments.filter(r => isNum(r.menAlive));
        if (validMaa.length > 0) {
            const shownMaa = validMaa.slice(0, 8);
            const maaOverflow = validMaa.length - shownMaa.length;
            troopParts.push('men-at-arms: ' + shownMaa.map(r => `${r.name} (${r.isPersonal ? 'personal' : 'non-personal'}, ${r.menAlive})`).join(', ') + (maaOverflow > 0 ? `, …+${maaOverflow} more` : ''));
        }
        if (troopParts.length > 0) sections.push(`Troops: ${troopParts.join('; ')}`);

        if (this.laws.length > 0) sections.push(`Laws: ${this.laws.join('; ')}`);

        if (this.personaNumbers) {
            const axisText = Object.entries(this.personaNumbers)
                .filter(([, v]) => isNum(v))
                .map(([k, v]) => `${k} ${v}`)
                .join(', ');
            if (axisText) sections.push(`Personality axes (0-100): ${axisText}`);
        }

        if (this.knownSecrets.length > 0) {
            const secretLines = this.knownSecrets.slice(0, 5).map(ks => {
                const flags = [
                    ks.isCriminal ? 'criminal' : (ks.isShunned ? 'shunned' : ''),
                    ks.spent ? 'spent' : '',
                    ks.canBeExposed ? 'can be exposed' : ''
                ].filter(Boolean).join(', ');
                const who = [ks.targetId ? `targets ${ks.targetName ?? ks.targetId}` : '',
                             ks.ownerId ? `owned by ${ks.ownerName ?? ks.ownerId}` : ''].filter(Boolean).join(', ');
                const knowers = ks.otherKnowers.length > 0 ? `; also known by ${ks.otherKnowers.map(k => k.name).join(', ')}` : '';
                return `${ks.name}${who ? ' (' + who + ')' : ''}${flags ? ' [' + flags + ']' : ''}${knowers}`;
            });
            sections.push(`Known secrets: ${secretLines.join(' | ')}`);
            const secretOverflow = this.knownSecrets.length - secretLines.length;
            if (secretOverflow > 0) sections.push(`…+${secretOverflow} more secrets omitted`);
        }

        if (this.modifiers.length > 0) {
            const shownModifiers = this.modifiers.slice(0, 20);
            const modifierOverflow = this.modifiers.length - shownModifiers.length;
            sections.push(`Notable modifiers: ${shownModifiers.map(m => m.name).join(', ')}${modifierOverflow > 0 ? `, …+${modifierOverflow} more` : ''}`);
        }

        let output = "";
        let usedTokens = 0;
        for (const section of sections) {
            const cost = Math.ceil(section.length / 4) + 1; // +1 for newline
            if (usedTokens + cost > maxTokens) break;
            output += (output ? "\n" : "") + section;
            usedTokens += cost;
        }
        return output.trim();
    }

    static fromPlainObject(obj: any): Character {
        const instance = new Character(new Array(27).fill(''));
        Object.assign(instance, obj);
        instance.domainLevyHoldings ??= [];
        instance.maaRegiments ??= [];
        instance.laws ??= [];
        instance.modifiers ??= [];
        instance.knownSecrets ??= [];
        return instance;
    }
}

