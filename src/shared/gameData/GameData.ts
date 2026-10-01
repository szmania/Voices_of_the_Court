import { Character } from "./Character";
import { removeTooltip } from "./parseLog";
import { parseSaveSnapshotExtra, type SaveSnapshotExtraParseResult } from "./saveSnapshotProtocol";
import {
    parseTimelineSnapshot,
    type TimelineParseResult,
    INIT_DATE_EXTRA_START_INDEX,
    INIT_DATE_EXTRA_FIELD_COUNT
} from "./timelineProtocol";
import { validateCk3GameDate, type Ck3GameDate } from "./gameDate";

/**@typedef {import('./Character').Character} Character */

export type Trait = {
    category: string,
    name: string,
    desc: string
}

export type MemoryTypeTokenSource = 'raw_type' | 'localized_name';

export type Memory = {
    type: string,
    creationDate: string,
    desc: string,
    /**@property {number} relevanceWeight - how relevant the memory to the current conversation. The higher, the more relevant. */
    relevanceWeight: number,
    creationGameDate?: Ck3GameDate,
    memoryTypeToken?: string,
    memoryTypeTokenSource?: MemoryTypeTokenSource,
    snapshotOrdinal?: number,
    expectedParticipantCount?: number,
    participantIds?: number[],
    identityComplete?: boolean
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

export interface CharacterKnowledgeRef {
    id: number;
    name: string;
}

export interface OwnedSecret {
    name: string;
    type: string;
    category: string;
    description: string;
}

/**
 * Known-secret shape of the 1.x v1 snapshot schema, preserved for the
 * promptWorkbench validators. Distinct from the CE log-side KnownSecret above.
 */
export type KnownSecretV1 = {
    name: string;
    type: string;
    category: string;
    description: string;
    owner: CharacterKnowledgeRef;
};

export interface CharacterScheme {
    type: string;
    description: string;
    target?: CharacterKnowledgeRef;
    progress?: number;
    progressGoal?: number;
    agentCharges?: number;
    breaches?: number;
    isExposed: boolean;
}

export interface ExposedTargetingScheme extends CharacterScheme {
    owner: CharacterKnowledgeRef;
}

export type WarSide = 'attacker' | 'defender';

export type MilitaryAttendeeRole =
    | 'marshal'
    | 'field_commander'
    | 'knight'
    | 'commander_candidate'
    | 'war_leader_adviser';

export interface CharacterRef {
    id: number;
    name: string;
}

export interface TitleRef {
    id: string;
    name: string;
}

export interface ProvinceRef {
    id: number;
    name: string;
}

export interface TruncationInfo {
    total: number;
    omitted: number;
}

export interface WarScore {
    total: number;
    battles?: number;
    occupation?: number;
    imprisonment?: number;
    ticking?: number;
    perspective: 'attacker';
}

export interface WarParticipant {
    character: CharacterRef;
    side: WarSide;
    militaryStrength?: number;
    // contribution and contributionPercent removed in Phase 1: war_contribution is a
    // trigger (war_contribution = { target = X value > N }), not a value getter, so it
    // cannot be written to debug_log.
}

export interface ArmyState {
    gathering: boolean;
    moving: boolean;
    embarked: boolean;
    retreating: boolean;
    inCombat: boolean;
    inSiege: boolean;
}

export interface ArmyRegimentInfo {
    typeName: string;
    count: number;
    max?: number;
    isLevies?: boolean;
    isMAA?: boolean;
    isKnight?: boolean;
    name?: string;
}

export interface ArmyInfo {
    commandSlot?: number;
    id: number;
    name?: string;
    owner: CharacterRef;
    commander?: CharacterRef;
    side: WarSide;
    isPlayerOwned: boolean;
    possibleWarAssociation: true;
    soldiers: number;
    maxSoldiers?: number;
    levies?: number;
    menAtArms?: number;
    quality?: string;
    location: ProvinceRef;
    supply?: number;
    supplyChange?: number;
    attrition?: number;
    state: ArmyState;
    regiments: ArmyRegimentInfo[];
}

export interface SiegeInfo {
    id: number;
    warId: number;
    location: ProvinceRef;
    commander?: CharacterRef;
    attackerMen?: number;
    defenderMen?: number;
    progress?: number;
}

export interface WarEvent {
    date: string;
    type: string;
    payload: string;
}

export interface MilitaryAttendee {
    character: CharacterRef;
    roles: MilitaryAttendeeRole[];
    commandSlots: number[];
    canCommandPlayerArmies: boolean;
}

export interface WarInfo {
    id: number;
    name: string;
    startDate?: string;
    playerSide: WarSide;
    primaryAttacker: CharacterRef;
    primaryDefender: CharacterRef;
    casusBelli?: string;
    targetTitle?: TitleRef;
    score: WarScore;
    participants: WarParticipant[];
    armies: ArmyInfo[];
    sieges: SiegeInfo[];
    truncation: TruncationInfo;
}

export interface MilitarySnapshot {
    snapshotId: string;
    snapshotDate: string;
    wars: Map<number, WarInfo>;
    armies: ArmyInfo[];
    attendees: MilitaryAttendee[];
    events: WarEvent[];
    complete: boolean;
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

export type StressInfo = {
    value: number;
    level: string;
    progress: number;
}

export type LegitimacyInfo = {
    value: number;
    level: number;
    type: string;
    powerfulVassalExpectation?: string;
    vassalExpectation?: string;
    liegeExpectation?: string;
}

export type MaaRegiment = {
    name: string;
    isPersonal: boolean;
    menAlive: number;
}

export type KnownSecret = {
    name: string;
    desc: string;
    category: string;
    type: string;
    ownerId?: number;
    ownerName?: string;
    targetId?: number;
    targetName?: string;
    isCriminal?: boolean;
    isShunned?: boolean;
    spent?: boolean;
    canBeExposed?: boolean;
    otherKnowers: { id: number; name: string }[];
}

export type CharacterModifier = {
    id: string;
    name: string;
    desc: string;
}

export type PersonaNumbers = {
    boldness: number; compassion: number; energy: number; greed: number; honor: number;
    rationality: number; sociability: number; vengefulness: number; zeal: number;
}

/** 
 * @class
*/
export class GameData {
    date: string;
    /** Numeric CK3 game date, present only when the mod emits the v2 date extra block. */
    gameDate?: Ck3GameDate;
    /**
     * Legacy letter-scheduling field maintained by main.ts (assigned from its own
     * currentTotalDays). No longer parsed from the init line: under protocol v2,
     * index 8 is the checkpoint epoch, not totalDays.
     */
    totalDays!: number;
    votcCheckpointEpoch: number;
    votcTimelineNodeA?: number;
    votcTimelineNodeB?: number;
    votcTimelineParentA?: number;
    votcTimelineParentB?: number;
    /** Active checkpoint token, generated by the mod for branch reconciliation. */
    votcCheckpointToken?: number;
    /** Token reserved by the mod for the checkpoint that is about to be advanced. */
    votcPendingCheckpointToken?: number;

    votcProtocolSchema?: number;
    votcCampaignSchema?: number;
    votcCampaignIdA?: number;
    votcCampaignIdB?: number;
    votcCampaignIdC?: number;
    votcCampaignIdD?: number;
    votcCampaignBootstrapKind?: number;
    votcPlayerTimelineSchema?: number;

    /** Authoritative parse of the init line's timeline fields (protocol v2 aware). */
    timelineSnapshotResult?: TimelineParseResult;

    /** Save snapshot protocol version from the init tail; only set when the extra block parses as available. */
    saveSnapshotProtocolVersion?: number;
    /** Monotonic save snapshot sequence from the init tail; only set when available. */
    saveSnapshotSequence?: number;
    /** Save snapshot double-buffer slot from the init tail; only set when available. */
    saveSnapshotSlot?: 0 | 1;
    /** Authoritative parse of the init line's save snapshot extra block, kept in every status for Coordinator decisions. */
    saveSnapshotExtraResult?: SaveSnapshotExtraParseResult;

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
    militarySnapshot?: MilitarySnapshot;

    constructor(data: string[]){
            this.playerID = Number(data[0]),
            this.playerName = removeTooltip(data[1]),
            this.aiID = Number(data[2]),
            this.aiName = removeTooltip(data[3]),
            this.date = data[4],
            this.votcCheckpointEpoch = Number(data[8]) || 0,
            this.scene = data[5].substring(11),
            this.location = data[6],
            this.locationController = data[7],

            this.timelineSnapshotResult = parseTimelineSnapshot(data, 'init');
            const timelineParse = this.timelineSnapshotResult;
            if (timelineParse.status === 'valid' || timelineParse.status === 'legacy') {
                const snapshot = timelineParse.snapshot;
                this.votcTimelineNodeA = snapshot.nodeA;
                this.votcTimelineNodeB = snapshot.nodeB;
                this.votcTimelineParentA = snapshot.parentA;
                this.votcTimelineParentB = snapshot.parentB;
                this.votcCheckpointToken = snapshot.checkpointToken;
                this.votcPendingCheckpointToken = snapshot.pendingCheckpointToken;
            }
            if (timelineParse.status === 'valid') {
                const protocol = timelineParse.snapshot.protocol;
                this.votcProtocolSchema = protocol.protocolSchema;
                this.votcCampaignSchema = protocol.campaignSchema;
                this.votcCampaignIdA = protocol.campaignIdA;
                this.votcCampaignIdB = protocol.campaignIdB;
                this.votcCampaignIdC = protocol.campaignIdC;
                this.votcCampaignIdD = protocol.campaignIdD;
                this.votcCampaignBootstrapKind = protocol.campaignBootstrapKind;
                this.votcPlayerTimelineSchema = protocol.playerTimelineSchema;
            }

        this.gameDate = parseGameDateExtra(data);

        this.saveSnapshotExtraResult = parseSaveSnapshotExtra(data);
        const saveSnapshotParse = this.saveSnapshotExtraResult;
        if (saveSnapshotParse.status === 'available') {
            this.saveSnapshotProtocolVersion = saveSnapshotParse.protocolVersion;
            this.saveSnapshotSequence = saveSnapshotParse.sequence;
            this.saveSnapshotSlot = saveSnapshotParse.slot;
        }

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
        this.characters.set(id, character);
    }

    /**
     * Gets all character IDs with the player character first
     * @returns {number[]} Array of character IDs with player ID first
     */
    getCharacterIds(): number[] {
        const allIds = Array.from(this.characters.keys());
        console.log(`[GameData.getCharacterIds] Returning character IDs in map order: ${allIds.join(', ')}`);
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
                characterMap.set(numericId, characterInstance);
            }
            instance.characters = characterMap;
        } else {
            console.log(`[GameData.fromPlainObject] No characters found in obj.characters`);
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

function parseGameDateExtra(data: readonly string[]): Ck3GameDate | undefined {
    const start = INIT_DATE_EXTRA_START_INDEX;
    const end = start + INIT_DATE_EXTRA_FIELD_COUNT;
    if (data.length < end) return undefined;

    const rawTotalDays = data[start];
    const rawYear = data[start + 1];
    const rawMonth = data[start + 2];
    const rawDay = data[start + 3];
    const display = data[start + 4];

    if (!rawTotalDays || !rawYear || !rawMonth || !rawDay) return undefined;

    const gameDate: Ck3GameDate = {
        totalDays: Number(rawTotalDays),
        year: Number(rawYear),
        month: Number(rawMonth),
        day: Number(rawDay),
        display: display ?? ''
    };

    const validation = validateCk3GameDate(gameDate);
    return validation.valid ? gameDate : undefined;
}
