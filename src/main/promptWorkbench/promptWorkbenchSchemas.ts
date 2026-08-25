import { Message } from "../ts/conversation_interfaces";
import { validateCk3GameDate } from "../../shared/gameData/gameDate";
import type {
    CharacterSnapshotV1,
    CreateExperimentInputV1,
    FixtureScopeV1,
    GameDataSnapshotV1,
    MilitarySnapshotSnapshotV1,
    NormalizedUsageV1,
    ParticipantDescriptionVariantV1,
    PromptBuildArtifactV1,
    PromptExperimentV1,
    PromptFixtureAnyVersion,
    PromptFixtureV1,
    PromptFixtureV2,
    PromptProgramCandidateV2,
    PromptRelevantConfigV1,
    PromptRequestInputV1,
    PromptSectionKind,
    PromptVariantV1,
    ResolvedGameFactsV1,
    ResolvedPromptInputV1,
    ResolvedTextPoolV1,
    ScheduledRunV1,
    WorkbenchErrorCategory,
    WorkbenchErrorV1,
    WorkbenchExperimentState,
    WorkbenchHardFailure,
    WorkbenchRatingsV1,
    WorkbenchRunResultV1,
    WorkbenchRunStatus,
    WorkbenchSamplingParametersV1,
    WorkbenchSettingsV1
} from "./promptWorkbenchTypes";
import {
    WORKBENCH_EXPERIMENT_ID_PATTERN,
    WORKBENCH_HARD_FAILURES,
    WORKBENCH_MAX_OUTPUT_TOKENS_MAX,
    WORKBENCH_REPETITIONS_MAX,
    WORKBENCH_REPETITIONS_MIN,
    WORKBENCH_RETAIN_COUNT_MAX,
    WORKBENCH_RETAIN_COUNT_MIN,
    WORKBENCH_VARIANT_TOKEN_BUDGET_MAX,
    WORKBENCH_VARIANT_TOKEN_BUDGET_MIN,
    WORKBENCH_DEFAULT_MODE_VALUES
} from "./promptWorkbenchTypes";
import type {
    ArmyInfo,
    ArmyRegimentInfo,
    ArmyState,
    CharacterRef,
    CharacterScheme,
    ExposedTargetingScheme,
    KnownSecretV1,
    Memory,
    MilitaryAttendee,
    MilitaryAttendeeRole,
    OpinionModifier,
    OwnedSecret,
    ProvinceRef,
    Secret,
    SiegeInfo,
    TitleRef,
    Trait,
    TruncationInfo,
    WarEvent,
    WarInfo,
    WarParticipant,
    WarScore,
    WarSide
} from "../../shared/gameData/GameData";

/**
 * Runtime validators for every persisted Prompt Workbench DTO (design doc
 * section 5). Hand-rolled, no external dependency.
 *
 * Unknown-field policy: unknown fields are IGNORED and stripped from the
 * returned value (validators build fresh objects from known keys only), so
 * newer writers can add fields without breaking older readers. Everything
 * else is strict: missing required fields, wrong types, illegal enums,
 * out-of-range arrays (duplicates/unknown entries in contextOrder,
 * retainCount outside 1..200, absurd array sizes) and over-deep or cyclic
 * objects are REJECTED with a descriptive PromptWorkbenchValidationError
 * that names the offending path.
 */

export class PromptWorkbenchValidationError extends Error {
    readonly path: string;

    constructor(path: string, message: string) {
        super(`${path}: ${message}`);
        this.name = 'PromptWorkbenchValidationError';
        this.path = path;
    }
}

type Obj = Record<string, unknown>;

/** Structural depth limit for any persisted DTO. */
export const MAX_DTO_DEPTH = 24;
/** Sanity cap on any single array inside a persisted DTO. */
export const MAX_DTO_ARRAY_LENGTH = 100000;

export function fail(path: string, message: string): never {
    throw new PromptWorkbenchValidationError(path, message);
}

function isPlainObject(value: unknown): value is Obj {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reject cyclic structures, over-deep nesting and absurdly large arrays
 * before any per-field validation runs.
 */
export function assertStructurallySafe(value: unknown, path: string): void {
    const seen = new Set<unknown>();
    const walk = (v: unknown, depth: number, p: string): void => {
        if (!isPlainObject(v) && !Array.isArray(v)) return;
        if (seen.has(v)) fail(p, 'cyclic structure is not allowed');
        if (depth > MAX_DTO_DEPTH) fail(p, `object nesting exceeds maximum depth ${MAX_DTO_DEPTH}`);
        if (Array.isArray(v) && v.length > MAX_DTO_ARRAY_LENGTH) {
            fail(p, `array length ${v.length} exceeds maximum ${MAX_DTO_ARRAY_LENGTH}`);
        }
        seen.add(v);
        if (Array.isArray(v)) {
            for (let i = 0; i < v.length; i++) walk(v[i], depth + 1, `${p}[${i}]`);
        } else {
            for (const key of Object.keys(v)) walk(v[key], depth + 1, `${p}.${key}`);
        }
        seen.delete(v);
    };
    walk(value, 0, path);
}

export function reqObject(value: unknown, path: string): Obj {
    if (!isPlainObject(value)) fail(path, 'expected an object');
    return value;
}

export function reqString(obj: Obj, key: string, path: string): string {
    const value = obj[key];
    if (typeof value !== 'string') fail(`${path}.${key}`, 'expected a string');
    return value;
}

export function optString(obj: Obj, key: string, path: string): string | undefined {
    const value = obj[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') fail(`${path}.${key}`, 'expected a string or undefined');
    return value;
}

export function optNullableString(obj: Obj, key: string, path: string): string | null | undefined {
    const value = obj[key];
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') fail(`${path}.${key}`, 'expected a string, null or undefined');
    return value;
}

export function reqNumber(obj: Obj, key: string, path: string): number {
    const value = obj[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(`${path}.${key}`, 'expected a finite number');
    }
    return value;
}

export function optNumber(obj: Obj, key: string, path: string): number | undefined {
    const value = obj[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(`${path}.${key}`, 'expected a finite number or undefined');
    }
    return value;
}

function optNonNegativeInteger(obj: Obj, key: string, path: string): number | undefined {
    const value = optNumber(obj, key, path);
    if (value === undefined) return undefined;
    if (!Number.isInteger(value) || value < 0) {
        fail(`${path}.${key}`, 'expected a non-negative integer or undefined');
    }
    return value;
}

export function reqBoolean(obj: Obj, key: string, path: string): boolean {
    const value = obj[key];
    if (typeof value !== 'boolean') fail(`${path}.${key}`, 'expected a boolean');
    return value;
}

export function optBoolean(obj: Obj, key: string, path: string): boolean | undefined {
    const value = obj[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') fail(`${path}.${key}`, 'expected a boolean or undefined');
    return value;
}

export function reqEnum<T extends string>(obj: Obj, key: string, path: string, allowed: readonly T[]): T {
    const value = obj[key];
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
        fail(`${path}.${key}`, `expected one of ${allowed.map(a => `'${a}'`).join(', ')}`);
    }
    return value as T;
}

function optEnum<T extends string>(obj: Obj, key: string, path: string, allowed: readonly T[]): T | undefined {
    const value = obj[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
        fail(`${path}.${key}`, `expected one of ${allowed.map(a => `'${a}'`).join(', ')} or undefined`);
    }
    return value as T;
}

function reqArray(obj: Obj, key: string, path: string): unknown[] {
    const value = obj[key];
    if (!Array.isArray(value)) fail(`${path}.${key}`, 'expected an array');
    return value;
}

function optArray(obj: Obj, key: string, path: string): unknown[] | undefined {
    const value = obj[key];
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) fail(`${path}.${key}`, 'expected an array or undefined');
    return value;
}

export function reqStringArray(obj: Obj, key: string, path: string): string[] {
    return reqArray(obj, key, path).map((item, i) => {
        if (typeof item !== 'string') fail(`${path}.${key}[${i}]`, 'expected a string');
        return item;
    });
}

export function copyDefined<T extends object>(target: T, key: keyof T, value: T[keyof T] | undefined): void {
    if (value !== undefined) target[key] = value;
}

// ---------------------------------------------------------------------------
// Message (conversation_interfaces) - used inside requests and frozen input.
// ---------------------------------------------------------------------------

const MESSAGE_ROLES = ['system', 'user', 'assistant'] as const;

function validateMessage(value: unknown, path: string): Message {
    const obj = reqObject(value, path);
    const message: Message = {
        role: reqEnum(obj, 'role', path, MESSAGE_ROLES),
        content: reqString(obj, 'content', path)
    };
    copyDefined(message, 'name', optString(obj, 'name', path));
    copyDefined(message, 'narrative', optString(obj, 'narrative', path));
    return message;
}

function validateMessages(value: unknown, path: string): Message[] {
    if (!Array.isArray(value)) fail(path, 'expected an array of messages');
    return value.map((item, i) => validateMessage(item, `${path}[${i}]`));
}

// ---------------------------------------------------------------------------
// Character sub-DTOs (runtime shapes produced by parseLog).
// ---------------------------------------------------------------------------

function validateSecret(value: unknown, path: string): Secret {
    const obj = reqObject(value, path);
    return {
        name: reqString(obj, 'name', path),
        desc: reqString(obj, 'desc', path),
        category: reqString(obj, 'category', path)
    };
}

function validateOwnedSecret(value: unknown, path: string): OwnedSecret {
    const obj = reqObject(value, path);
    return {
        name: reqString(obj, 'name', path),
        type: reqString(obj, 'type', path),
        category: reqString(obj, 'category', path),
        description: reqString(obj, 'description', path)
    };
}

function validateCharacterKnowledgeRef(value: unknown, path: string): CharacterRef {
    const obj = reqObject(value, path);
    return {
        id: reqNumber(obj, 'id', path),
        name: reqString(obj, 'name', path)
    };
}

function validateKnownSecret(value: unknown, path: string): KnownSecretV1 {
    const obj = reqObject(value, path);
    return {
        ...validateOwnedSecret(obj, path),
        owner: validateCharacterKnowledgeRef(obj.owner, `${path}.owner`)
    };
}

function validateCharacterScheme(value: unknown, path: string): CharacterScheme {
    const obj = reqObject(value, path);
    const scheme: CharacterScheme = {
        type: reqString(obj, 'type', path),
        description: reqString(obj, 'description', path),
        isExposed: reqBoolean(obj, 'isExposed', path)
    };
    if (obj.target !== undefined) {
        scheme.target = validateCharacterKnowledgeRef(obj.target, `${path}.target`);
    }
    copyDefined(scheme, 'progress', optNumber(obj, 'progress', path));
    copyDefined(scheme, 'progressGoal', optNumber(obj, 'progressGoal', path));
    copyDefined(scheme, 'agentCharges', optNumber(obj, 'agentCharges', path));
    copyDefined(scheme, 'breaches', optNumber(obj, 'breaches', path));
    return scheme;
}

function validateExposedTargetingScheme(value: unknown, path: string): ExposedTargetingScheme {
    const obj = reqObject(value, path);
    return {
        ...validateCharacterScheme(obj, path),
        owner: validateCharacterKnowledgeRef(obj.owner, `${path}.owner`)
    };
}

const MEMORY_TYPE_TOKEN_SOURCES = ['raw_type', 'localized_name'] as const;

function validateMemory(value: unknown, path: string): Memory {
    const obj = reqObject(value, path);
    const memory: Memory = {
        type: reqString(obj, 'type', path),
        creationDate: reqString(obj, 'creationDate', path),
        desc: reqString(obj, 'desc', path),
        relevanceWeight: reqNumber(obj, 'relevanceWeight', path),
        participantIds: reqArray(obj, 'participantIds', path).map((item, i) => {
            if (typeof item !== 'number' || !Number.isFinite(item)) {
                fail(`${path}.participantIds[${i}]`, 'expected a finite number');
            }
            return item;
        }),
        identityComplete: reqBoolean(obj, 'identityComplete', path)
    };
    if (obj.creationGameDate !== undefined) {
        const check = validateCk3GameDate(obj.creationGameDate);
        if (!check.valid) fail(`${path}.creationGameDate`, check.reason);
        memory.creationGameDate = obj.creationGameDate as Memory['creationGameDate'];
    }
    copyDefined(memory, 'memoryTypeToken', optString(obj, 'memoryTypeToken', path));
    copyDefined(memory, 'memoryTypeTokenSource', optEnum(obj, 'memoryTypeTokenSource', path, MEMORY_TYPE_TOKEN_SOURCES));
    copyDefined(memory, 'snapshotOrdinal', optNumber(obj, 'snapshotOrdinal', path));
    copyDefined(memory, 'expectedParticipantCount', optNumber(obj, 'expectedParticipantCount', path));
    return memory;
}

function validateTrait(value: unknown, path: string): Trait {
    const obj = reqObject(value, path);
    return {
        category: reqString(obj, 'category', path),
        name: reqString(obj, 'name', path),
        desc: reqString(obj, 'desc', path)
    };
}

function validateOpinionModifier(value: unknown, path: string): OpinionModifier {
    const obj = reqObject(value, path);
    return {
        reason: reqString(obj, 'reason', path),
        value: reqNumber(obj, 'value', path)
    };
}

function validateRelationsEntry(value: unknown, path: string): { id: number; relations: string[] } {
    const obj = reqObject(value, path);
    return {
        id: reqNumber(obj, 'id', path),
        relations: reqStringArray(obj, 'relations', path)
    };
}

function validateOpinionEntry(value: unknown, path: string): { id: number; opinion: number } {
    const obj = reqObject(value, path);
    return {
        id: reqNumber(obj, 'id', path),
        // Aligned to the CE producer (parseLog) field name; 1.x used the misspelled 'opinon'.
        opinion: reqNumber(obj, 'opinion', path)
    };
}

export function mapArray<T>(value: unknown, path: string, itemValidator: (item: unknown, itemPath: string) => T): T[] {
    if (!Array.isArray(value)) fail(path, 'expected an array');
    return value.map((item, i) => itemValidator(item, `${path}[${i}]`));
}

// ---------------------------------------------------------------------------
// Design doc section 5.2 - snapshots.
// ---------------------------------------------------------------------------

export function validateCharacterSnapshotV1(value: unknown, path = 'character'): CharacterSnapshotV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    return {
        id: reqNumber(obj, 'id', path),
        shortName: reqString(obj, 'shortName', path),
        fullName: reqString(obj, 'fullName', path),
        firstName: reqString(obj, 'firstName', path),
        primaryTitle: reqString(obj, 'primaryTitle', path),
        titleRankConcept: reqString(obj, 'titleRankConcept', path),
        sheHe: reqString(obj, 'sheHe', path),
        age: reqNumber(obj, 'age', path),
        gold: reqNumber(obj, 'gold', path),
        opinionOfPlayer: reqNumber(obj, 'opinionOfPlayer', path),
        sexuality: reqString(obj, 'sexuality', path),
        personality: reqString(obj, 'personality', path),
        greed: reqNumber(obj, 'greed', path),
        isIndependentRuler: reqBoolean(obj, 'isIndependentRuler', path),
        isRuler: reqBoolean(obj, 'isRuler', path),
        isLandedRuler: reqBoolean(obj, 'isLandedRuler', path),
        isKnight: reqBoolean(obj, 'isKnight', path),
        prowess: reqNumber(obj, 'prowess', path),
        liege: reqString(obj, 'liege', path),
        topLiege: reqString(obj, 'topLiege', path),
        consort: reqString(obj, 'consort', path),
        culture: reqString(obj, 'culture', path),
        faith: reqString(obj, 'faith', path),
        house: reqString(obj, 'house', path),
        capitalLocation: reqString(obj, 'capitalLocation', path),
        liegeRealmLaw: reqString(obj, 'liegeRealmLaw', path),
        heldCourtAndCouncilPositions: reqString(obj, 'heldCourtAndCouncilPositions', path),
        secrets: mapArray(obj.secrets, `${path}.secrets`, validateSecret),
        ownedSecrets: mapArray(obj.ownedSecrets, `${path}.ownedSecrets`, validateOwnedSecret),
        knownSecrets: mapArray(obj.knownSecrets, `${path}.knownSecrets`, validateKnownSecret),
        ownedSchemes: mapArray(obj.ownedSchemes, `${path}.ownedSchemes`, validateCharacterScheme),
        exposedTargetingSchemes: mapArray(obj.exposedTargetingSchemes, `${path}.exposedTargetingSchemes`, validateExposedTargetingScheme),
        memories: mapArray(obj.memories, `${path}.memories`, validateMemory),
        traits: mapArray(obj.traits, `${path}.traits`, validateTrait),
        relationsToPlayer: reqStringArray(obj, 'relationsToPlayer', path),
        relationsToCharacters: mapArray(obj.relationsToCharacters, `${path}.relationsToCharacters`, validateRelationsEntry),
        opinionBreakdownToPlayer: mapArray(obj.opinionBreakdownToPlayer, `${path}.opinionBreakdownToPlayer`, validateOpinionModifier),
        opinions: mapArray(obj.opinions, `${path}.opinions`, validateOpinionEntry)
    };
}

const WAR_SIDES: readonly WarSide[] = ['attacker', 'defender'];
const MILITARY_ATTENDEE_ROLES: readonly MilitaryAttendeeRole[] = [
    'marshal',
    'field_commander',
    'knight',
    'commander_candidate',
    'war_leader_adviser'
];

function validateCharacterRef(value: unknown, path: string): CharacterRef {
    return validateCharacterKnowledgeRef(value, path);
}

function validateTitleRef(value: unknown, path: string): TitleRef {
    const obj = reqObject(value, path);
    return {
        id: reqString(obj, 'id', path),
        name: reqString(obj, 'name', path)
    };
}

function validateProvinceRef(value: unknown, path: string): ProvinceRef {
    const obj = reqObject(value, path);
    return {
        id: reqNumber(obj, 'id', path),
        name: reqString(obj, 'name', path)
    };
}

function validateTruncationInfo(value: unknown, path: string): TruncationInfo {
    const obj = reqObject(value, path);
    return {
        total: reqNumber(obj, 'total', path),
        omitted: reqNumber(obj, 'omitted', path)
    };
}

function validateWarScore(value: unknown, path: string): WarScore {
    const obj = reqObject(value, path);
    const score: WarScore = {
        total: reqNumber(obj, 'total', path),
        perspective: 'attacker'
    };
    const perspective = reqEnum(obj, 'perspective', path, ['attacker'] as const);
    score.perspective = perspective;
    copyDefined(score, 'battles', optNumber(obj, 'battles', path));
    copyDefined(score, 'occupation', optNumber(obj, 'occupation', path));
    copyDefined(score, 'imprisonment', optNumber(obj, 'imprisonment', path));
    copyDefined(score, 'ticking', optNumber(obj, 'ticking', path));
    return score;
}

function validateWarParticipant(value: unknown, path: string): WarParticipant {
    const obj = reqObject(value, path);
    const participant: WarParticipant = {
        character: validateCharacterRef(obj.character, `${path}.character`),
        side: reqEnum(obj, 'side', path, WAR_SIDES)
    };
    copyDefined(participant, 'militaryStrength', optNumber(obj, 'militaryStrength', path));
    return participant;
}

function validateArmyState(value: unknown, path: string): ArmyState {
    const obj = reqObject(value, path);
    return {
        gathering: reqBoolean(obj, 'gathering', path),
        moving: reqBoolean(obj, 'moving', path),
        embarked: reqBoolean(obj, 'embarked', path),
        retreating: reqBoolean(obj, 'retreating', path),
        inCombat: reqBoolean(obj, 'inCombat', path),
        inSiege: reqBoolean(obj, 'inSiege', path)
    };
}

function validateArmyRegimentInfo(value: unknown, path: string): ArmyRegimentInfo {
    const obj = reqObject(value, path);
    const regiment: ArmyRegimentInfo = {
        typeName: reqString(obj, 'typeName', path),
        count: reqNumber(obj, 'count', path)
    };
    copyDefined(regiment, 'max', optNumber(obj, 'max', path));
    copyDefined(regiment, 'isLevies', optBoolean(obj, 'isLevies', path));
    copyDefined(regiment, 'isMAA', optBoolean(obj, 'isMAA', path));
    copyDefined(regiment, 'isKnight', optBoolean(obj, 'isKnight', path));
    copyDefined(regiment, 'name', optString(obj, 'name', path));
    return regiment;
}

function validateArmyInfo(value: unknown, path: string): ArmyInfo {
    const obj = reqObject(value, path);
    const army: ArmyInfo = {
        id: reqNumber(obj, 'id', path),
        owner: validateCharacterRef(obj.owner, `${path}.owner`),
        side: reqEnum(obj, 'side', path, WAR_SIDES),
        isPlayerOwned: reqBoolean(obj, 'isPlayerOwned', path),
        possibleWarAssociation: true,
        soldiers: reqNumber(obj, 'soldiers', path),
        location: validateProvinceRef(obj.location, `${path}.location`),
        state: validateArmyState(obj.state, `${path}.state`),
        regiments: mapArray(obj.regiments, `${path}.regiments`, validateArmyRegimentInfo)
    };
    if (obj.possibleWarAssociation !== true) {
        fail(`${path}.possibleWarAssociation`, 'expected literal true');
    }
    copyDefined(army, 'commandSlot', optNumber(obj, 'commandSlot', path));
    copyDefined(army, 'name', optString(obj, 'name', path));
    if (obj.commander !== undefined) {
        army.commander = validateCharacterRef(obj.commander, `${path}.commander`);
    }
    copyDefined(army, 'maxSoldiers', optNumber(obj, 'maxSoldiers', path));
    copyDefined(army, 'levies', optNumber(obj, 'levies', path));
    copyDefined(army, 'menAtArms', optNumber(obj, 'menAtArms', path));
    copyDefined(army, 'quality', optString(obj, 'quality', path));
    copyDefined(army, 'supply', optNumber(obj, 'supply', path));
    copyDefined(army, 'supplyChange', optNumber(obj, 'supplyChange', path));
    copyDefined(army, 'attrition', optNumber(obj, 'attrition', path));
    return army;
}

function validateSiegeInfo(value: unknown, path: string): SiegeInfo {
    const obj = reqObject(value, path);
    const siege: SiegeInfo = {
        id: reqNumber(obj, 'id', path),
        warId: reqNumber(obj, 'warId', path),
        location: validateProvinceRef(obj.location, `${path}.location`)
    };
    if (obj.commander !== undefined) {
        siege.commander = validateCharacterRef(obj.commander, `${path}.commander`);
    }
    copyDefined(siege, 'attackerMen', optNumber(obj, 'attackerMen', path));
    copyDefined(siege, 'defenderMen', optNumber(obj, 'defenderMen', path));
    copyDefined(siege, 'progress', optNumber(obj, 'progress', path));
    return siege;
}

function validateWarEvent(value: unknown, path: string): WarEvent {
    const obj = reqObject(value, path);
    return {
        date: reqString(obj, 'date', path),
        type: reqString(obj, 'type', path),
        payload: reqString(obj, 'payload', path)
    };
}

function validateMilitaryAttendee(value: unknown, path: string): MilitaryAttendee {
    const obj = reqObject(value, path);
    return {
        character: validateCharacterRef(obj.character, `${path}.character`),
        roles: reqArray(obj, 'roles', path).map((item, i) => {
            if (typeof item !== 'string' || !MILITARY_ATTENDEE_ROLES.includes(item as MilitaryAttendeeRole)) {
                fail(`${path}.roles[${i}]`, `expected one of ${MILITARY_ATTENDEE_ROLES.map(r => `'${r}'`).join(', ')}`);
            }
            return item as MilitaryAttendeeRole;
        }),
        commandSlots: reqArray(obj, 'commandSlots', path).map((item, i) => {
            if (typeof item !== 'number' || !Number.isFinite(item)) {
                fail(`${path}.commandSlots[${i}]`, 'expected a finite number');
            }
            return item;
        }),
        canCommandPlayerArmies: reqBoolean(obj, 'canCommandPlayerArmies', path)
    };
}

function validateWarInfo(value: unknown, path: string): WarInfo {
    const obj = reqObject(value, path);
    const war: WarInfo = {
        id: reqNumber(obj, 'id', path),
        name: reqString(obj, 'name', path),
        playerSide: reqEnum(obj, 'playerSide', path, WAR_SIDES),
        primaryAttacker: validateCharacterRef(obj.primaryAttacker, `${path}.primaryAttacker`),
        primaryDefender: validateCharacterRef(obj.primaryDefender, `${path}.primaryDefender`),
        score: validateWarScore(obj.score, `${path}.score`),
        participants: mapArray(obj.participants, `${path}.participants`, validateWarParticipant),
        armies: mapArray(obj.armies, `${path}.armies`, validateArmyInfo),
        sieges: mapArray(obj.sieges, `${path}.sieges`, validateSiegeInfo),
        truncation: validateTruncationInfo(obj.truncation, `${path}.truncation`)
    };
    copyDefined(war, 'startDate', optString(obj, 'startDate', path));
    copyDefined(war, 'casusBelli', optString(obj, 'casusBelli', path));
    if (obj.targetTitle !== undefined) {
        war.targetTitle = validateTitleRef(obj.targetTitle, `${path}.targetTitle`);
    }
    return war;
}

function validateMilitarySnapshotSnapshotV1(value: unknown, path: string): MilitarySnapshotSnapshotV1 {
    const obj = reqObject(value, path);
    return {
        snapshotId: reqString(obj, 'snapshotId', path),
        snapshotDate: reqString(obj, 'snapshotDate', path),
        wars: mapArray(obj.wars, `${path}.wars`, validateWarInfo),
        armies: mapArray(obj.armies, `${path}.armies`, validateArmyInfo),
        attendees: mapArray(obj.attendees, `${path}.attendees`, validateMilitaryAttendee),
        events: mapArray(obj.events, `${path}.events`, validateWarEvent),
        complete: reqBoolean(obj, 'complete', path)
    };
}

export function validateGameDataSnapshotV1(value: unknown, path = 'gameData'): GameDataSnapshotV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);

    const timelineObj = reqObject(obj.timeline, `${path}.timeline`);
    const timeline: GameDataSnapshotV1['timeline'] = {
        checkpointEpoch: reqNumber(timelineObj, 'checkpointEpoch', `${path}.timeline`)
    };
    copyDefined(timeline, 'nodeA', optNumber(timelineObj, 'nodeA', `${path}.timeline`));
    copyDefined(timeline, 'nodeB', optNumber(timelineObj, 'nodeB', `${path}.timeline`));
    copyDefined(timeline, 'parentA', optNumber(timelineObj, 'parentA', `${path}.timeline`));
    copyDefined(timeline, 'parentB', optNumber(timelineObj, 'parentB', `${path}.timeline`));
    copyDefined(timeline, 'checkpointToken', optNumber(timelineObj, 'checkpointToken', `${path}.timeline`));
    copyDefined(timeline, 'pendingCheckpointToken', optNumber(timelineObj, 'pendingCheckpointToken', `${path}.timeline`));
    copyDefined(timeline, 'protocolSchema', optNumber(timelineObj, 'protocolSchema', `${path}.timeline`));
    copyDefined(timeline, 'campaignSchema', optNumber(timelineObj, 'campaignSchema', `${path}.timeline`));
    if (timelineObj.campaignIdParts !== undefined) {
        const parts = timelineObj.campaignIdParts;
        if (!Array.isArray(parts) || parts.length !== 4 || parts.some(p => typeof p !== 'number' || !Number.isFinite(p))) {
            fail(`${path}.timeline.campaignIdParts`, 'expected an array of exactly 4 finite numbers');
        }
        timeline.campaignIdParts = [parts[0], parts[1], parts[2], parts[3]];
    }
    copyDefined(timeline, 'campaignBootstrapKind', optNumber(timelineObj, 'campaignBootstrapKind', `${path}.timeline`));
    copyDefined(timeline, 'playerTimelineSchema', optNumber(timelineObj, 'playerTimelineSchema', `${path}.timeline`));

    const snapshot: GameDataSnapshotV1 = {
        date: reqString(obj, 'date', path),
        scene: reqString(obj, 'scene', path),
        location: reqString(obj, 'location', path),
        locationController: reqString(obj, 'locationController', path),
        playerID: reqNumber(obj, 'playerID', path),
        playerName: reqString(obj, 'playerName', path),
        aiID: reqNumber(obj, 'aiID', path),
        aiName: reqString(obj, 'aiName', path),
        character1Name: reqString(obj, 'character1Name', path),
        character2Name: reqString(obj, 'character2Name', path),
        timeline,
        characters: mapArray(obj.characters, `${path}.characters`, (item, p) => validateCharacterSnapshotV1(item, p))
    };
    copyDefined(snapshot, 'saveSnapshotProtocolVersion', optNonNegativeInteger(obj, 'saveSnapshotProtocolVersion', path));
    copyDefined(snapshot, 'saveSnapshotSequence', optNonNegativeInteger(obj, 'saveSnapshotSequence', path));
    const saveSnapshotSlot = optNumber(obj, 'saveSnapshotSlot', path);
    if (saveSnapshotSlot !== undefined) {
        if (saveSnapshotSlot !== 0 && saveSnapshotSlot !== 1) {
            fail(`${path}.saveSnapshotSlot`, 'expected 0, 1 or undefined');
        }
        snapshot.saveSnapshotSlot = saveSnapshotSlot;
    }
    if (obj.gameDate !== undefined) {
        const check = validateCk3GameDate(obj.gameDate);
        if (!check.valid) fail(`${path}.gameDate`, check.reason);
        snapshot.gameDate = obj.gameDate as GameDataSnapshotV1['gameDate'];
    }
    if (obj.militarySnapshot !== undefined) {
        snapshot.militarySnapshot = validateMilitarySnapshotSnapshotV1(obj.militarySnapshot, `${path}.militarySnapshot`);
    }
    return snapshot;
}

// ---------------------------------------------------------------------------
// Design doc sections 4.1 / 5.1 / 5.3 - frozen input and build artifact.
// ---------------------------------------------------------------------------

const CONVERSATION_PROMPT_MODES = ['conversation', 'selfTalk', 'aiToAiInitiate', 'aiToAiReply'] as const;
const HISTORY_MODES = ['live', 'empty'] as const;

function validateGenerationContext(value: unknown, path: string): ResolvedPromptInputV1['generation'] {
    const obj = reqObject(value, path);
    const context: ResolvedPromptInputV1['generation'] = {
        requestId: reqString(obj, 'requestId', path),
        mode: reqEnum(obj, 'mode', path, CONVERSATION_PROMPT_MODES),
        speakerCharacterId: reqNumber(obj, 'speakerCharacterId', path),
        historyMode: reqEnum(obj, 'historyMode', path, HISTORY_MODES)
    };
    copyDefined(context, 'replyToCharacterId', optNumber(obj, 'replyToCharacterId', path));
    return context;
}

function validateVariableValues(value: unknown, path: string): ResolvedPromptInputV1['variableValues'] {
    const obj = reqObject(value, path);
    const out: ResolvedPromptInputV1['variableValues'] = {};
    for (const key of Object.keys(obj)) {
        const item = obj[key];
        if (item !== null && typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean') {
            fail(`${path}.${key}`, 'expected a string, number, boolean or null');
        }
        out[key] = item;
    }
    return out;
}

function validateResolvedTextPoolV1(value: unknown, path: string): ResolvedTextPoolV1 {
    const obj = reqObject(value, path);
    const capturedRenderedText = optNullableString(obj, 'capturedRenderedText', path);
    if (capturedRenderedText === undefined) {
        fail(`${path}.capturedRenderedText`, 'expected a string or null');
    }
    return {
        header: reqString(obj, 'header', path),
        itemsInSelectionOrder: reqStringArray(obj, 'itemsInSelectionOrder', path),
        capturedRenderedText,
        capturedBudgetTokens: reqNumber(obj, 'capturedBudgetTokens', path)
    };
}

export function validateResolvedPromptInputV1(value: unknown, path = 'resolved'): ResolvedPromptInputV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const resolved: ResolvedPromptInputV1 = {
        generation: validateGenerationContext(obj.generation, `${path}.generation`),
        variableValues: validateVariableValues(obj.variableValues, `${path}.variableValues`),
        policies: (() => {
            const policiesPath = `${path}.policies`;
            const policies = reqObject(obj.policies, policiesPath);
            const primary = optNullableString(policies, 'primary', policiesPath);
            const suffix = optNullableString(policies, 'suffix', policiesPath);
            if (primary === undefined) fail(`${policiesPath}.primary`, 'expected a string or null');
            if (suffix === undefined) fail(`${policiesPath}.suffix`, 'expected a string or null');
            return { primary, suffix };
        })(),
        roleInstruction: reqString(obj, 'roleInstruction', path),
        exampleMessages: validateMessages(obj.exampleMessages, `${path}.exampleMessages`),
        summaries: validateResolvedTextPoolV1(obj.summaries, `${path}.summaries`),
        memories: validateResolvedTextPoolV1(obj.memories, `${path}.memories`),
        intelligence: reqString(obj, 'intelligence', path),
        description: reqString(obj, 'description', path),
        currentSummary: reqString(obj, 'currentSummary', path),
        history: validateMessages(obj.history, `${path}.history`),
        turnMessages: validateMessages(obj.turnMessages, `${path}.turnMessages`)
    };
    // Task 17 step 8: gameFacts is OPTIONAL. Fixtures captured by resolver v1
    // never carry it and keep loading through the builder-v1 dispatch; a
    // builder-v2 fixture may also omit it, in which case builder v2 treats
    // the section as 'unavailable' (explicit no-facts semantics, never an
    // error). When present, the DTO is fully validated.
    if (obj.gameFacts !== undefined) {
        resolved.gameFacts = validateResolvedGameFactsV1(obj.gameFacts, `${path}.gameFacts`);
    }
    copyDefined(resolved, 'agencyProjection', optString(obj, 'agencyProjection', path));
    return resolved;
}

// Task 17 step 8: bounds for the frozen game-facts DTO. Lines are fixed
// template output (values pre-capped at 160 chars by the renderer), so a
// line beyond 512 chars or a header beyond 2048 chars indicates corruption;
// the pools are bounded by the candidate cap and the whole DTO by a byte cap.
export const MAX_GAME_FACT_LINE_LENGTH = 512;
export const MAX_GAME_FACT_LINES = 1000;
export const MAX_GAME_FACT_AS_OF_LENGTH = 128;
export const MAX_GAME_FACT_BLOCK_HEADER_LENGTH = 2048;
export const MAX_GAME_FACTS_DTO_BYTES = 256 * 1024;

export function validateResolvedGameFactsV1(value: unknown, path = 'resolved.gameFacts'): ResolvedGameFactsV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);

    const status = reqEnum(obj, 'status', path, ['available', 'unavailable'] as const);
    const source = reqEnum(obj, 'source', path, ['ck3_snapshot'] as const);

    const asOfDisplay = reqString(obj, 'asOfDisplay', path);
    if (asOfDisplay.length > MAX_GAME_FACT_AS_OF_LENGTH) {
        fail(`${path}.asOfDisplay`, `exceeds maximum length ${MAX_GAME_FACT_AS_OF_LENGTH}`);
    }
    const blockHeader = reqString(obj, 'blockHeader', path);
    if (blockHeader.length > MAX_GAME_FACT_BLOCK_HEADER_LENGTH) {
        fail(`${path}.blockHeader`, `exceeds maximum length ${MAX_GAME_FACT_BLOCK_HEADER_LENGTH}`);
    }
    const validateLines = (key: 'baselineItemsInSelectionOrder' | 'dynamicItemsInSelectionOrder'): string[] => {
        const lines = reqStringArray(obj, key, path);
        if (lines.length > MAX_GAME_FACT_LINES) {
            fail(`${path}.${key}`, `array length ${lines.length} exceeds maximum ${MAX_GAME_FACT_LINES}`);
        }
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length > MAX_GAME_FACT_LINE_LENGTH) {
                fail(`${path}.${key}[${i}]`, `exceeds maximum length ${MAX_GAME_FACT_LINE_LENGTH}`);
            }
        }
        return lines;
    };

    const dto: ResolvedGameFactsV1 = {
        status,
        source,
        asOfDisplay,
        blockHeader,
        baselineItemsInSelectionOrder: validateLines('baselineItemsInSelectionOrder'),
        dynamicItemsInSelectionOrder: validateLines('dynamicItemsInSelectionOrder'),
        capturedBaselineBudgetTokens: reqNonNegativeCappedInteger(obj, 'capturedBaselineBudgetTokens', path),
        capturedDynamicBudgetTokens: reqNonNegativeCappedInteger(obj, 'capturedDynamicBudgetTokens', path)
    };

    const serializedBytes = JSON.stringify(dto).length;
    if (serializedBytes > MAX_GAME_FACTS_DTO_BYTES) {
        fail(path, `serialized size ${serializedBytes} exceeds maximum ${MAX_GAME_FACTS_DTO_BYTES} bytes`);
    }
    return dto;
}

/** Captured token budgets share the variant budget bounds (0 .. hard cap). */
function reqNonNegativeCappedInteger(obj: Obj, key: string, path: string): number {
    const value = reqNumber(obj, key, path);
    if (!Number.isInteger(value) || value < WORKBENCH_VARIANT_TOKEN_BUDGET_MIN || value > WORKBENCH_VARIANT_TOKEN_BUDGET_MAX) {
        fail(`${path}.${key}`, `expected an integer between ${WORKBENCH_VARIANT_TOKEN_BUDGET_MIN} and ${WORKBENCH_VARIANT_TOKEN_BUDGET_MAX}`);
    }
    return value;
}

const PROMPT_SECTION_KINDS: readonly PromptSectionKind[] = [
    'policy',
    'roleInstruction',
    'examples',
    'summaries',
    'memories',
    'intelligence',
    'agencyProjection',
    'description',
    'gameFacts',
    'currentSummary',
    'history',
    'turnCue'
];

export function validatePromptRequestInputV1(value: unknown, path = 'request'): PromptRequestInputV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const kind = reqEnum(obj, 'kind', path, ['chat', 'completion'] as const);
    if (kind === 'chat') {
        return { kind, messages: validateMessages(obj.messages, `${path}.messages`) };
    }
    return { kind, text: reqString(obj, 'text', path) };
}

export function validatePromptBuildArtifactV1(value: unknown, path = 'artifact'): PromptBuildArtifactV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const sections = reqArray(obj, 'sections', path).map((item, i) => {
        const sectionPath = `${path}.sections[${i}]`;
        const sectionObj = reqObject(item, sectionPath);
        const section: PromptBuildArtifactV1['sections'][number] = {
            kind: reqEnum(sectionObj, 'kind', sectionPath, PROMPT_SECTION_KINDS),
            label: reqString(sectionObj, 'label', sectionPath),
            renderedText: reqString(sectionObj, 'renderedText', sectionPath),
            estimatedTokens: reqNumber(sectionObj, 'estimatedTokens', sectionPath)
        };
        copyDefined(section, 'sourceItemCount', optNumber(sectionObj, 'sourceItemCount', sectionPath));
        copyDefined(section, 'includedItemCount', optNumber(sectionObj, 'includedItemCount', sectionPath));
        copyDefined(section, 'truncated', optBoolean(sectionObj, 'truncated', sectionPath));
        copyDefined(section, 'source', optString(sectionObj, 'source', sectionPath));
        return section;
    });
    const estimatorObj = reqObject(obj.estimator, `${path}.estimator`);
    return {
        logicalRequest: validatePromptRequestInputV1(obj.logicalRequest, `${path}.logicalRequest`),
        logicalRequestHash: reqString(obj, 'logicalRequestHash', path),
        sections,
        estimatedInputTokens: reqNumber(obj, 'estimatedInputTokens', path),
        estimator: {
            id: reqString(estimatorObj, 'id', `${path}.estimator`),
            version: reqNumber(estimatorObj, 'version', `${path}.estimator`)
        }
    };
}

// ---------------------------------------------------------------------------
// Design doc section 4.2 - fixture V2.
// (The description DTO validators and their sanity caps stay in 1.x; only the
// snapshot-hash field of fixture V2 is ported here.)
// ---------------------------------------------------------------------------

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export function reqSha256Hex(obj: Obj, key: string, path: string): string {
    const value = reqString(obj, key, path);
    if (!SHA256_HEX_PATTERN.test(value)) {
        fail(`${path}.${key}`, 'expected a sha256 hex string (64 lowercase hex chars)');
    }
    return value;
}

export function optSha256Hex(obj: Obj, key: string, path: string): string | undefined {
    const value = optString(obj, key, path);
    if (value === undefined) return undefined;
    if (!SHA256_HEX_PATTERN.test(value)) {
        fail(`${path}.${key}`, 'expected a sha256 hex string (64 lowercase hex chars) or undefined');
    }
    return value;
}

// ---------------------------------------------------------------------------
// Design doc section 5.4 - scope, config and fixture.
// ---------------------------------------------------------------------------

export function validateFixtureScopeV1(value: unknown, path = 'scope'): FixtureScopeV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const kind = reqEnum(obj, 'kind', path, ['campaign', 'legacy-player'] as const);
    if (kind === 'campaign') {
        return {
            kind,
            campaignId: reqString(obj, 'campaignId', path),
            playerId: reqString(obj, 'playerId', path)
        };
    }
    return { kind, playerId: reqString(obj, 'playerId', path) };
}

export function validateWorkbenchSamplingParametersV1(value: unknown, path = 'sampling'): WorkbenchSamplingParametersV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const sampling: WorkbenchSamplingParametersV1 = {
        temperature: reqNumber(obj, 'temperature', path),
        topP: reqNumber(obj, 'topP', path),
        thinkingEnabled: reqBoolean(obj, 'thinkingEnabled', path)
    };
    copyDefined(sampling, 'frequencyPenalty', optNumber(obj, 'frequencyPenalty', path));
    copyDefined(sampling, 'presencePenalty', optNumber(obj, 'presencePenalty', path));
    copyDefined(sampling, 'seed', optNumber(obj, 'seed', path));
    return sampling;
}

export function validatePromptRelevantConfigV1(value: unknown, path = 'effectiveConfig'): PromptRelevantConfigV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const transport = reqObject(obj.transport, `${path}.transport`);
    const prompts = reqObject(obj.prompts, `${path}.prompts`);
    const scripts = reqObject(obj.scripts, `${path}.scripts`);
    const budgets = reqObject(obj.budgets, `${path}.budgets`);
    const responseProcessing = reqObject(obj.responseProcessing, `${path}.responseProcessing`);
    return {
        transport: {
            kind: reqEnum(transport, 'kind', `${path}.transport`, ['chat', 'completion'] as const),
            inputSequence: reqString(transport, 'inputSequence', `${path}.transport`),
            outputSequence: reqString(transport, 'outputSequence', `${path}.transport`)
        },
        prompts: {
            mainPrompt: reqString(prompts, 'mainPrompt', `${path}.prompts`),
            selfTalkPrompt: reqString(prompts, 'selfTalkPrompt', `${path}.prompts`),
            memoriesPrompt: reqString(prompts, 'memoriesPrompt', `${path}.prompts`),
            suffixPrompt: reqString(prompts, 'suffixPrompt', `${path}.prompts`),
            enableSuffixPrompt: reqBoolean(prompts, 'enableSuffixPrompt', `${path}.prompts`)
        },
        scripts: {
            descriptionFileName: reqString(scripts, 'descriptionFileName', `${path}.scripts`),
            exampleMessagesFileName: reqString(scripts, 'exampleMessagesFileName', `${path}.scripts`)
        },
        budgets: {
            maxInputContextTokens: reqNumber(budgets, 'maxInputContextTokens', `${path}.budgets`),
            maxOutputTokens: reqNumber(budgets, 'maxOutputTokens', `${path}.budgets`),
            maxSummaryTokens: reqNumber(budgets, 'maxSummaryTokens', `${path}.budgets`),
            maxMemoryTokens: reqNumber(budgets, 'maxMemoryTokens', `${path}.budgets`)
        },
        responseProcessing: {
            cleanMessages: reqBoolean(responseProcessing, 'cleanMessages', `${path}.responseProcessing`)
        },
        sampling: validateWorkbenchSamplingParametersV1(obj.sampling, `${path}.sampling`)
    };
}

const PROMPT_CONTEXT_SECTION_KINDS = ['summaries', 'memories', 'intelligence', 'description', 'gameFacts', 'currentSummary'] as const;

/**
 * Variant budgets follow Config's lower bound (0 disables the section) with
 * an additional hard upper cap (design doc section 6.1).
 */
function optTokenBudget(obj: Obj, key: string, path: string): number | undefined {
    const value = optNumber(obj, key, path);
    if (value === undefined) return undefined;
    if (!Number.isInteger(value) || value < WORKBENCH_VARIANT_TOKEN_BUDGET_MIN || value > WORKBENCH_VARIANT_TOKEN_BUDGET_MAX) {
        fail(`${path}.${key}`, `expected an integer between ${WORKBENCH_VARIANT_TOKEN_BUDGET_MIN} and ${WORKBENCH_VARIANT_TOKEN_BUDGET_MAX}`);
    }
    return value;
}

export function validatePromptVariantV1(value: unknown, path = 'variant'): PromptVariantV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    if (obj.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'expected literal 1');
    const base = reqEnum(obj, 'base', path, ['literal-baseline', 'frozen-input'] as const);

    const variant: PromptVariantV1 = {
        schemaVersion: 1,
        id: reqString(obj, 'id', path),
        name: reqString(obj, 'name', path),
        description: reqString(obj, 'description', path),
        base
    };

    if (obj.policy !== undefined) {
        const policy = reqObject(obj.policy, `${path}.policy`);
        const validated: NonNullable<PromptVariantV1['policy']> = {
            mode: reqEnum(policy, 'mode', `${path}.policy`, ['inherit', 'replace'] as const)
        };
        copyDefined(validated, 'template', optString(policy, 'template', `${path}.policy`));
        variant.policy = validated;
    }
    if (obj.suffixPolicy !== undefined) {
        const suffixPolicy = reqObject(obj.suffixPolicy, `${path}.suffixPolicy`);
        const validated: NonNullable<PromptVariantV1['suffixPolicy']> = {
            mode: reqEnum(suffixPolicy, 'mode', `${path}.suffixPolicy`, ['inherit', 'remove', 'replace'] as const)
        };
        copyDefined(validated, 'template', optString(suffixPolicy, 'template', `${path}.suffixPolicy`));
        variant.suffixPolicy = validated;
    }
    copyDefined(variant, 'maxSummaryTokens', optTokenBudget(obj, 'maxSummaryTokens', path));
    copyDefined(variant, 'maxMemoryTokens', optTokenBudget(obj, 'maxMemoryTokens', path));
    copyDefined(variant, 'maxGameFactBaselineTokens', optTokenBudget(obj, 'maxGameFactBaselineTokens', path));
    copyDefined(variant, 'maxGameFactDynamicTokens', optTokenBudget(obj, 'maxGameFactDynamicTokens', path));
    if (obj.contextOrder !== undefined) {
        const entries = reqArray(obj, 'contextOrder', path).map((item, i) => {
            if (typeof item !== 'string' || !(PROMPT_CONTEXT_SECTION_KINDS as readonly string[]).includes(item)) {
                fail(`${path}.contextOrder[${i}]`, `expected one of ${PROMPT_CONTEXT_SECTION_KINDS.map(k => `'${k}'`).join(', ')}`);
            }
            return item as (typeof PROMPT_CONTEXT_SECTION_KINDS)[number];
        });
        if (new Set(entries).size !== entries.length) {
            fail(`${path}.contextOrder`, 'must not contain duplicate sections');
        }
        variant.contextOrder = entries;
    }
    copyDefined(variant, 'includeShortTurnCue', optBoolean(obj, 'includeShortTurnCue', path));

    // Design doc section 6.1: literal-baseline carries no modification fields.
    if (base === 'literal-baseline') {
        const modifications = ['policy', 'suffixPolicy', 'maxSummaryTokens', 'maxMemoryTokens', 'maxGameFactBaselineTokens', 'maxGameFactDynamicTokens', 'contextOrder', 'includeShortTurnCue']
            .filter(key => obj[key] !== undefined);
        if (modifications.length > 0) {
            fail(path, `literal-baseline variants must not set modification fields: ${modifications.join(', ')}`);
        }
    }
    return variant;
}

// ---------------------------------------------------------------------------
// Design doc section 7.5.5 - participant description variants and the
// program candidate (prompt-benchmark plan Task 2.9). Strict dispatch on the
// mode: 'inherit-captured' carries no extra fields, and 'trusted-script' pins
// a manifest id plus its sha256. (The 1.x 'profile' mode is not ported: it
// belongs to the description subsystem that stays in 1.x.) Unknown modes are
// rejected.
// ---------------------------------------------------------------------------

const PARTICIPANT_DESCRIPTION_MODES = ['inherit-captured', 'trusted-script'] as const;

export function validateParticipantDescriptionVariantV1(
    value: unknown,
    path = 'participantDescription'
): ParticipantDescriptionVariantV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const mode = reqEnum(obj, 'mode', path, PARTICIPANT_DESCRIPTION_MODES);
    if (mode === 'inherit-captured') {
        return { mode };
    }
    const rendererManifestId = reqString(obj, 'rendererManifestId', path);
    if (rendererManifestId.length === 0) {
        fail(`${path}.rendererManifestId`, 'expected a non-empty string');
    }
    return {
        mode,
        rendererManifestId,
        rendererManifestHash: reqSha256Hex(obj, 'rendererManifestHash', path)
    };
}

export function validatePromptProgramCandidateV2(value: unknown, path = 'candidate'): PromptProgramCandidateV2 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    if (obj.schemaVersion !== 2) fail(`${path}.schemaVersion`, 'expected literal 2');
    const id = reqString(obj, 'id', path);
    if (!WORKBENCH_EXPERIMENT_ID_PATTERN.test(id)) {
        fail(`${path}.id`, 'does not match the safe id pattern (ASCII letter/digit, then letter/digit/_/-, 1-128 chars)');
    }
    const name = reqString(obj, 'name', path);
    if (name.length === 0) {
        fail(`${path}.name`, 'expected a non-empty string');
    }
    return {
        schemaVersion: 2,
        id,
        name,
        promptVariant: validatePromptVariantV1(obj.promptVariant, `${path}.promptVariant`),
        participantDescription: validateParticipantDescriptionVariantV1(obj.participantDescription, `${path}.participantDescription`)
    };
}

export type PromptFixtureCommon = Omit<PromptFixtureV1, 'schemaVersion'>;

/**
 * Validates everything shared between fixture schema versions EXCEPT
 * schemaVersion (which each version-specific validator checks with a literal
 * comparison first). Unknown fields are stripped here, so a V2 fixture may
 * carry its provenance/artifact fields without breaking V1 reads.
 */
function validatePromptFixtureCommon(value: unknown, path: string): PromptFixtureCommon {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);

    const versionsObj = reqObject(obj.versions, `${path}.versions`);
    const connectionObj = reqObject(obj.sourceConnection, `${path}.sourceConnection`);

    const fixture: PromptFixtureCommon = {
        id: reqString(obj, 'id', path),
        sourceRequestId: reqString(obj, 'sourceRequestId', path),
        capturedAt: reqString(obj, 'capturedAt', path),
        scope: validateFixtureScopeV1(obj.scope, `${path}.scope`),
        checkpointEpoch: reqNumber(obj, 'checkpointEpoch', path),
        gameDate: reqString(obj, 'gameDate', path),
        versions: {
            resolver: reqNumber(versionsObj, 'resolver', `${path}.versions`),
            builder: reqNumber(versionsObj, 'builder', `${path}.versions`),
            providerNormalizer: reqNumber(versionsObj, 'providerNormalizer', `${path}.versions`),
            tokenEstimator: reqNumber(versionsObj, 'tokenEstimator', `${path}.versions`),
            app: reqString(versionsObj, 'app', `${path}.versions`)
        },
        sourceHash: reqString(obj, 'sourceHash', path),
        gameData: validateGameDataSnapshotV1(obj.gameData, `${path}.gameData`),
        resolved: validateResolvedPromptInputV1(obj.resolved, `${path}.resolved`),
        effectiveConfig: validatePromptRelevantConfigV1(obj.effectiveConfig, `${path}.effectiveConfig`),
        scriptSources: reqArray(obj, 'scriptSources', path).map((item, i) => {
            const itemPath = `${path}.scriptSources[${i}]`;
            const itemObj = reqObject(item, itemPath);
            return {
                kind: reqEnum(itemObj, 'kind', itemPath, ['description', 'exampleMessages'] as const),
                fileName: reqString(itemObj, 'fileName', itemPath),
                sha256: reqString(itemObj, 'sha256', itemPath)
            };
        }),
        baseline: validatePromptBuildArtifactV1(obj.baseline, `${path}.baseline`),
        sourceConnection: {
            provider: reqString(connectionObj, 'provider', `${path}.sourceConnection`),
            model: reqString(connectionObj, 'model', `${path}.sourceConnection`),
            connectionFingerprint: reqString(connectionObj, 'connectionFingerprint', `${path}.sourceConnection`)
        }
    };

    copyDefined(fixture, 'timelineNodeId', optString(obj, 'timelineNodeId', path));
    if (obj.sourceOutcome !== undefined) {
        const outcomeObj = reqObject(obj.sourceOutcome, `${path}.sourceOutcome`);
        const outcome: NonNullable<PromptFixtureV1['sourceOutcome']> = {
            status: reqEnum(outcomeObj, 'status', `${path}.sourceOutcome`, ['pending', 'succeeded', 'failed'] as const)
        };
        copyDefined(outcome, 'completedAt', optString(outcomeObj, 'completedAt', `${path}.sourceOutcome`));
        copyDefined(outcome, 'errorCategory', optString(outcomeObj, 'errorCategory', `${path}.sourceOutcome`));
        copyDefined(outcome, 'providerRequestHash', optString(outcomeObj, 'providerRequestHash', `${path}.sourceOutcome`));
        fixture.sourceOutcome = outcome;
    }
    copyDefined(fixture, 'pinned', optBoolean(obj, 'pinned', path));
    copyDefined(fixture, 'tags', optArray(obj, 'tags', path)?.map((item, i) => {
        if (typeof item !== 'string') fail(`${path}.tags[${i}]`, 'expected a string');
        return item;
    }));
    // Post-promotion observation marker (plan Task 7.5): promotionId must be a
    // safe id shape; candidateHash, when present, must be a sha256 hex string.
    const promotionId = optString(obj, 'promotionId', path);
    if (promotionId !== undefined && !WORKBENCH_EXPERIMENT_ID_PATTERN.test(promotionId)) {
        fail(`${path}.promotionId`, 'does not match the safe promotion id pattern');
    }
    copyDefined(fixture, 'promotionId', promotionId);
    copyDefined(fixture, 'candidateHash', optSha256Hex(obj, 'candidateHash', path));
    return fixture;
}

export function validatePromptFixtureV1(value: unknown, path = 'fixture'): PromptFixtureV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    if (obj.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'expected literal 1');
    return { schemaVersion: 1, ...validatePromptFixtureCommon(value, path) };
}

export function validatePromptFixtureV2(value: unknown, path = 'fixture'): PromptFixtureV2 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    if (obj.schemaVersion !== 2) fail(`${path}.schemaVersion`, 'expected literal 2');
    return {
        schemaVersion: 2,
        ...validatePromptFixtureCommon(value, path),
        gameDataSnapshotHash: reqSha256Hex(obj, 'gameDataSnapshotHash', path)
    };
}

export function validatePromptFixtureAnyVersion(value: unknown, path = 'fixture'): PromptFixtureAnyVersion {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    if (obj.schemaVersion === 1) return validatePromptFixtureV1(value, path);
    if (obj.schemaVersion === 2) return validatePromptFixtureV2(value, path);
    fail(`${path}.schemaVersion`, 'expected 1 or 2 (unknown or unsupported fixture schema version)');
}

// ---------------------------------------------------------------------------
// Design doc section 7 - workbench settings.
// ---------------------------------------------------------------------------

export function validateWorkbenchSettingsV1(value: unknown, path = 'settings'): WorkbenchSettingsV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const retainCount = reqNumber(obj, 'retainCount', path);
    if (!Number.isInteger(retainCount) || retainCount < WORKBENCH_RETAIN_COUNT_MIN || retainCount > WORKBENCH_RETAIN_COUNT_MAX) {
        fail(`${path}.retainCount`, `expected an integer between ${WORKBENCH_RETAIN_COUNT_MIN} and ${WORKBENCH_RETAIN_COUNT_MAX}`);
    }
    const scopeQuotaBytes = reqNumber(obj, 'scopeQuotaBytes', path);
    if (!Number.isInteger(scopeQuotaBytes) || scopeQuotaBytes < 1) {
        fail(`${path}.scopeQuotaBytes`, 'expected a positive integer byte count');
    }
    const settings: WorkbenchSettingsV1 = {
        captureEnabled: reqBoolean(obj, 'captureEnabled', path),
        retainCount,
        scopeQuotaBytes
    };
    copyDefined(settings, 'noticeAcknowledged', optBoolean(obj, 'noticeAcknowledged', path));
    copyDefined(settings, 'onboardingCompleted', optBoolean(obj, 'onboardingCompleted', path));
    copyDefined(settings, 'onboardingDismissed', optBoolean(obj, 'onboardingDismissed', path));
    copyDefined(settings, 'fixtureImportEnabled', optBoolean(obj, 'fixtureImportEnabled', path));
    const onboardingStep = optNumber(obj, 'onboardingStep', path);
    if (onboardingStep !== undefined) {
        if (!Number.isInteger(onboardingStep) || onboardingStep < 1 || onboardingStep > 9) {
            fail(`${path}.onboardingStep`, 'expected an integer between 1 and 9');
        }
        settings.onboardingStep = onboardingStep;
    }
    // PR C16.1: the binary default-mode group (plan §16.1) is a string
    // in WORKBENCH_DEFAULT_MODE_VALUES. Old settings files without this
    // field are allowed to fall through to the compile-time default in
    // DEFAULT_WORKBENCH_SETTINGS.
    const defaultModeRaw = optString(obj, 'promptWorkbenchDefaultMode', path);
    if (defaultModeRaw !== undefined) {
        if (!(WORKBENCH_DEFAULT_MODE_VALUES as readonly string[]).includes(defaultModeRaw)) {
            fail(`${path}.promptWorkbenchDefaultMode`,
                `expected one of ${WORKBENCH_DEFAULT_MODE_VALUES.join(', ')}`);
        }
        settings.promptWorkbenchDefaultMode = defaultModeRaw as 'simple' | 'advanced';
    }
    return settings;
}

// ---------------------------------------------------------------------------
// Design doc sections 6.2 / 6.3 - usage, errors, ratings, experiments, runs.
// ---------------------------------------------------------------------------

export function optNonNegativeNumber(obj: Obj, key: string, path: string): number | undefined {
    const value = optNumber(obj, key, path);
    if (value === undefined) return undefined;
    if (value < 0) fail(`${path}.${key}`, 'expected a non-negative number or undefined');
    return value;
}

/**
 * providerRaw is the only place where provider-chosen key names persist. It
 * must be a plain JSON object: the adapter has already whitelisted and
 * size-capped it, and here we only guarantee JSON round-trip safety so a
 * hostile payload cannot smuggle in non-serializable values.
 */
function optJsonRecord(obj: Obj, key: string, path: string): Record<string, unknown> | undefined {
    const value = obj[key];
    if (value === undefined) return undefined;
    if (!isPlainObject(value)) fail(`${path}.${key}`, 'expected an object or undefined');
    try {
        return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    } catch {
        fail(`${path}.${key}`, 'expected a JSON-serializable object');
    }
}

export function validateNormalizedUsageV1(value: unknown, path = 'usage'): NormalizedUsageV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const usage: NormalizedUsageV1 = {};
    copyDefined(usage, 'inputTokens', optNonNegativeNumber(obj, 'inputTokens', path));
    copyDefined(usage, 'outputTokens', optNonNegativeNumber(obj, 'outputTokens', path));
    copyDefined(usage, 'cacheReadInputTokens', optNonNegativeNumber(obj, 'cacheReadInputTokens', path));
    copyDefined(usage, 'cacheWriteInputTokens', optNonNegativeNumber(obj, 'cacheWriteInputTokens', path));
    copyDefined(usage, 'cacheMissInputTokens', optNonNegativeNumber(obj, 'cacheMissInputTokens', path));
    copyDefined(usage, 'providerRaw', optJsonRecord(obj, 'providerRaw', path));
    return usage;
}

const WORKBENCH_ERROR_CATEGORIES: readonly WorkbenchErrorCategory[] = [
    'validation',
    'connection',
    'timeout',
    'rateLimit',
    'provider',
    'cancelled',
    'internal'
];

export function validateWorkbenchErrorV1(value: unknown, path = 'error'): WorkbenchErrorV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const error: WorkbenchErrorV1 = {
        category: reqEnum(obj, 'category', path, WORKBENCH_ERROR_CATEGORIES),
        retryable: reqBoolean(obj, 'retryable', path),
        safeMessage: reqString(obj, 'safeMessage', path)
    };
    copyDefined(error, 'statusCode', optNumber(obj, 'statusCode', path));
    return error;
}

const WORKBENCH_SCORE_KEYS = [
    'characterConsistency',
    'factAccuracy',
    'targetCharacterOnly',
    'latestTurnRelevance',
    'styleCompliance',
    'dramaticAgency',
    'repetition'
] as const;

/**
 * Ratings are strict: every score must be an integer 1-5 (section 6.3), hard
 * failures only from the known enum, duplicates rejected. ratedAt is a
 * required string on the persisted DTO; the store assigns it server-side
 * before validating, so renderer-supplied ratedAt values never persist.
 */
export function validateWorkbenchRatingsV1(value: unknown, path = 'ratings'): WorkbenchRatingsV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const scoresObj = reqObject(obj.scores, `${path}.scores`);
    const scores = {} as WorkbenchRatingsV1['scores'];
    for (const key of WORKBENCH_SCORE_KEYS) {
        const score = reqNumber(scoresObj, key, `${path}.scores`);
        if (!Number.isInteger(score) || score < 1 || score > 5) {
            fail(`${path}.scores.${key}`, 'expected an integer score between 1 and 5');
        }
        scores[key] = score;
    }
    const seenFailures = new Set<string>();
    const hardFailures = reqArray(obj, 'hardFailures', path).map((item, i) => {
        if (typeof item !== 'string' || !(WORKBENCH_HARD_FAILURES as readonly string[]).includes(item)) {
            fail(`${path}.hardFailures[${i}]`, `expected one of ${WORKBENCH_HARD_FAILURES.map(f => `'${f}'`).join(', ')}`);
        }
        if (seenFailures.has(item)) {
            fail(`${path}.hardFailures[${i}]`, 'duplicate hard failure entries are not allowed');
        }
        seenFailures.add(item);
        return item as WorkbenchHardFailure;
    });
    const ratings: WorkbenchRatingsV1 = {
        ratedAt: reqString(obj, 'ratedAt', path),
        scores,
        hardFailures
    };
    copyDefined(ratings, 'reviewerLabel', optString(obj, 'reviewerLabel', path));
    copyDefined(ratings, 'note', optString(obj, 'note', path));
    return ratings;
}

const WORKBENCH_EXPERIMENT_STATES: readonly WorkbenchExperimentState[] = [
    'draft',
    'running',
    'completed',
    'cancelled',
    'partial'
];

const WORKBENCH_RUN_STATUSES: readonly WorkbenchRunStatus[] = [
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled',
    'interrupted'
];

function validateScheduledRunV1(value: unknown, path: string): ScheduledRunV1 {
    const obj = reqObject(value, path);
    const position = reqNumber(obj, 'position', path);
    if (!Number.isInteger(position) || position < 0) {
        fail(`${path}.position`, 'expected a non-negative integer');
    }
    const repetition = reqNumber(obj, 'repetition', path);
    if (!Number.isInteger(repetition) || repetition < WORKBENCH_REPETITIONS_MIN || repetition > WORKBENCH_REPETITIONS_MAX) {
        fail(`${path}.repetition`, `expected an integer between ${WORKBENCH_REPETITIONS_MIN} and ${WORKBENCH_REPETITIONS_MAX}`);
    }
    return {
        runId: reqString(obj, 'runId', path),
        variantId: reqString(obj, 'variantId', path),
        repetition,
        position
    };
}

export function validatePromptExperimentV1(value: unknown, path = 'experiment'): PromptExperimentV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    if (obj.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'expected literal 1');

    const repetitions = reqNumber(obj, 'repetitions', path);
    if (!Number.isInteger(repetitions) || repetitions < WORKBENCH_REPETITIONS_MIN || repetitions > WORKBENCH_REPETITIONS_MAX) {
        fail(`${path}.repetitions`, `expected an integer between ${WORKBENCH_REPETITIONS_MIN} and ${WORKBENCH_REPETITIONS_MAX}`);
    }
    const maxOutputTokens = reqNumber(obj, 'maxOutputTokens', path);
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > WORKBENCH_MAX_OUTPUT_TOKENS_MAX) {
        fail(`${path}.maxOutputTokens`, `expected an integer between 1 and ${WORKBENCH_MAX_OUTPUT_TOKENS_MAX}`);
    }

    const variantSnapshots = mapArray(obj.variantSnapshots, `${path}.variantSnapshots`, validatePromptVariantV1);
    if (variantSnapshots.length === 0) {
        fail(`${path}.variantSnapshots`, 'expected at least one variant snapshot');
    }
    const variantIds = new Set<string>();
    for (const variant of variantSnapshots) {
        if (variantIds.has(variant.id)) {
            fail(`${path}.variantSnapshots`, `duplicate variant id '${variant.id}'`);
        }
        variantIds.add(variant.id);
    }

    const scheduledRuns = mapArray(obj.scheduledRuns, `${path}.scheduledRuns`, validateScheduledRunV1);
    if (scheduledRuns.length !== variantSnapshots.length * repetitions) {
        fail(`${path}.scheduledRuns`, `expected ${variantSnapshots.length * repetitions} scheduled runs, got ${scheduledRuns.length}`);
    }
    const runIds = new Set<string>();
    const positions = new Set<number>();
    for (const run of scheduledRuns) {
        if (!variantIds.has(run.variantId)) {
            fail(`${path}.scheduledRuns`, `run '${run.runId}' references unknown variant '${run.variantId}'`);
        }
        if (runIds.has(run.runId)) {
            fail(`${path}.scheduledRuns`, `duplicate run id '${run.runId}'`);
        }
        if (positions.has(run.position)) {
            fail(`${path}.scheduledRuns`, `duplicate position ${run.position}`);
        }
        runIds.add(run.runId);
        positions.add(run.position);
    }

    const experiment: PromptExperimentV1 = {
        schemaVersion: 1,
        id: reqString(obj, 'id', path),
        createdAt: reqString(obj, 'createdAt', path),
        updatedAt: reqString(obj, 'updatedAt', path),
        fixtureId: reqString(obj, 'fixtureId', path),
        state: reqEnum(obj, 'state', path, WORKBENCH_EXPERIMENT_STATES),
        provider: reqString(obj, 'provider', path),
        model: reqString(obj, 'model', path),
        connectionFingerprint: reqString(obj, 'connectionFingerprint', path),
        parameters: validateWorkbenchSamplingParametersV1(obj.parameters, `${path}.parameters`),
        maxOutputTokens,
        repetitions,
        orderingSeed: reqString(obj, 'orderingSeed', path),
        variantSnapshots,
        scheduledRuns
    };
    copyDefined(experiment, 'conclusion', optString(obj, 'conclusion', path));
    copyDefined(experiment, 'recommendForProduction', optBoolean(obj, 'recommendForProduction', path));
    return experiment;
}

export function validateWorkbenchRunResultV1(value: unknown, path = 'run'): WorkbenchRunResultV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    if (obj.schemaVersion !== 1) fail(`${path}.schemaVersion`, 'expected literal 1');

    const repetition = reqNumber(obj, 'repetition', path);
    if (!Number.isInteger(repetition) || repetition < WORKBENCH_REPETITIONS_MIN || repetition > WORKBENCH_REPETITIONS_MAX) {
        fail(`${path}.repetition`, `expected an integer between ${WORKBENCH_REPETITIONS_MIN} and ${WORKBENCH_REPETITIONS_MAX}`);
    }
    const position = reqNumber(obj, 'position', path);
    if (!Number.isInteger(position) || position < 0) {
        fail(`${path}.position`, 'expected a non-negative integer');
    }
    const rawResponse = optNullableString(obj, 'rawResponse', path);
    if (rawResponse === undefined) fail(`${path}.rawResponse`, 'expected a string or null');
    const cleanedResponse = optNullableString(obj, 'cleanedResponse', path);
    if (cleanedResponse === undefined) fail(`${path}.cleanedResponse`, 'expected a string or null');

    let error: WorkbenchErrorV1 | null = null;
    if (obj.error !== undefined && obj.error !== null) {
        error = validateWorkbenchErrorV1(obj.error, `${path}.error`);
    }

    const run: WorkbenchRunResultV1 = {
        schemaVersion: 1,
        runId: reqString(obj, 'runId', path),
        experimentId: reqString(obj, 'experimentId', path),
        fixtureId: reqString(obj, 'fixtureId', path),
        variantId: reqString(obj, 'variantId', path),
        repetition,
        position,
        status: reqEnum(obj, 'status', path, WORKBENCH_RUN_STATUSES),
        provider: reqString(obj, 'provider', path),
        model: reqString(obj, 'model', path),
        parameters: validateWorkbenchSamplingParametersV1(obj.parameters, `${path}.parameters`),
        rawResponse,
        cleanedResponse,
        error
    };
    copyDefined(run, 'startedAt', optString(obj, 'startedAt', path));
    copyDefined(run, 'completedAt', optString(obj, 'completedAt', path));
    if (obj.request !== undefined) {
        run.request = validatePromptBuildArtifactV1(obj.request, `${path}.request`);
    }
    copyDefined(run, 'providerRequestHash', optString(obj, 'providerRequestHash', path));
    copyDefined(run, 'durationMs', optNonNegativeNumber(obj, 'durationMs', path));
    copyDefined(run, 'firstTokenMs', optNonNegativeNumber(obj, 'firstTokenMs', path));
    copyDefined(run, 'retryCount', optNonNegativeNumber(obj, 'retryCount', path));
    if (obj.usage !== undefined) {
        run.usage = validateNormalizedUsageV1(obj.usage, `${path}.usage`);
    }
    copyDefined(run, 'seedSent', optBoolean(obj, 'seedSent', path));
    copyDefined(run, 'determinismAvailable', optBoolean(obj, 'determinismAvailable', path));
    if (obj.ratings !== undefined) {
        run.ratings = validateWorkbenchRatingsV1(obj.ratings, `${path}.ratings`);
    }
    return run;
}

/**
 * The prompt-workbench:create-experiment payload (IPC boundary). Everything
 * the renderer sends is validated here before the main process compares the
 * connection identity and resolves fixture/variants.
 */
export function validateCreateExperimentInputV1(value: unknown, path = 'createExperiment'): CreateExperimentInputV1 {
    assertStructurallySafe(value, path);
    const obj = reqObject(value, path);
    const repetitions = reqNumber(obj, 'repetitions', path);
    if (!Number.isInteger(repetitions) || repetitions < WORKBENCH_REPETITIONS_MIN || repetitions > WORKBENCH_REPETITIONS_MAX) {
        fail(`${path}.repetitions`, `expected an integer between ${WORKBENCH_REPETITIONS_MIN} and ${WORKBENCH_REPETITIONS_MAX}`);
    }
    const maxOutputTokens = reqNumber(obj, 'maxOutputTokens', path);
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > WORKBENCH_MAX_OUTPUT_TOKENS_MAX) {
        fail(`${path}.maxOutputTokens`, `expected an integer between 1 and ${WORKBENCH_MAX_OUTPUT_TOKENS_MAX}`);
    }
    const variantIds = reqStringArray(obj, 'variantIds', path);
    if (variantIds.length === 0) {
        fail(`${path}.variantIds`, 'expected at least one variant id');
    }
    if (new Set(variantIds).size !== variantIds.length) {
        fail(`${path}.variantIds`, 'duplicate variant ids are not allowed');
    }
    const input: CreateExperimentInputV1 = {
        fixtureId: reqString(obj, 'fixtureId', path),
        variantIds,
        repetitions,
        provider: reqString(obj, 'provider', path),
        model: reqString(obj, 'model', path),
        connectionFingerprint: reqString(obj, 'connectionFingerprint', path),
        parameters: validateWorkbenchSamplingParametersV1(obj.parameters, `${path}.parameters`),
        maxOutputTokens
    };
    copyDefined(input, 'orderingSeed', optString(obj, 'orderingSeed', path));
    return input;
}
