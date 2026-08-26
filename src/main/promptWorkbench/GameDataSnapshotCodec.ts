import { createHash } from "node:crypto";
import { Character } from "../../shared/gameData/Character";
import { GameData, MilitarySnapshot, KnownSecret, KnownSecretV1 } from "../../shared/gameData/GameData";
import { canonicalJsonStringify } from "./canonicalJson";
import type {
    CharacterSnapshotV1,
    GameDataSnapshotV1,
    MilitarySnapshotSnapshotV1
} from "./promptWorkbenchTypes";

/**
 * GameData snapshot codec (design doc section 5.2).
 *
 * GameData/Character are class instances with Maps and methods, so they
 * cannot be JSON serialized directly. This codec copies an explicit field
 * whitelist into plain DTOs; Maps become arrays sorted by stable key
 * (characters by id ascending, wars by war id ascending).
 *
 * Only gameDataToSnapshot() exists in Phase 1a. snapshotToGameData() (a
 * read-only compatibility facade rebuilding the characters/wars Maps and
 * getPlayer()/getAi()/getCharacter() accessors for snapshot re-resolve) is a
 * later phase; the exclusion lists and per-object function split below are
 * structured so it can be added without touching the capture path.
 *
 * New-field reminder contract: the codec tests enumerate the own properties
 * of a real GameData/Character instance and assert each one is either copied
 * here or listed in the exclusion constants below. Adding a field to
 * GameData/Character therefore fails the test until a maintainer decides
 * whether it belongs in the snapshot.
 */

/**
 * GameData own properties deliberately NOT persisted:
 * - timelineSnapshotResult: derived parse artifact of the init line; its
 *   data is already captured through the explicit timeline fields. A future
 *   restore facade re-derives it from those fields instead.
 * - saveSnapshotExtraResult: derived parse artifact of the init line's save
 *   snapshot tail; the persisted protocol/sequence/slot convenience fields
 *   carry the same information, and a restore facade can re-derive the
 *   result with parseSaveSnapshotExtra.
 * - totalDays: legacy letter-scheduling field superseded by gameDate and the
 *   explicit timeline fields. No longer parsed from the init line (protocol v2
 *   index 8 is the checkpoint epoch) nor assigned by the GameData constructor;
 *   main.ts maintains it in memory only.
 */
export const GAME_DATA_SNAPSHOT_EXCLUDED_FIELDS: readonly string[] = [
    'timelineSnapshotResult',
    'saveSnapshotExtraResult',
    'totalDays'
];

/**
 * Character own properties deliberately NOT persisted. Currently empty:
 * every Character data field is part of CharacterSnapshotV1.
 */
export const CHARACTER_SNAPSHOT_EXCLUDED_FIELDS: readonly string[] = [];

/** Deep-copy a plain-JSON value (drops functions/undefined, breaks sharing). */
function clonePlain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * CE log-side KnownSecret (GameData.ts) and the v1 snapshot-schema
 * KnownSecretV1 are genuinely different shapes. Map explicitly at this single
 * choke point: description comes from desc, owner from the optional
 * ownerId/ownerName pair (defaults preserve the non-optional V1 contract;
 * revisit when the capture path is wired to real log data).
 */
function knownSecretToV1(secret: KnownSecret): KnownSecretV1 {
    return {
        name: secret.name,
        type: secret.type,
        category: secret.category,
        description: secret.desc,
        owner: {
            id: secret.ownerId ?? 0,
            name: secret.ownerName ?? ''
        }
    };
}

export function characterToSnapshot(character: Character): CharacterSnapshotV1 {
    return {
        id: character.id,
        shortName: character.shortName,
        fullName: character.fullName,
        firstName: character.firstName,
        primaryTitle: character.primaryTitle,
        titleRankConcept: character.titleRankConcept,
        sheHe: character.sheHe,
        age: character.age,
        gold: character.gold,
        opinionOfPlayer: character.opinionOfPlayer,
        sexuality: character.sexuality,
        personality: character.personality,
        greed: character.greed,
        isIndependentRuler: character.isIndependentRuler,
        isRuler: character.isRuler,
        isLandedRuler: character.isLandedRuler,
        isKnight: character.isKnight,
        prowess: character.prowess,
        liege: character.liege,
        topLiege: character.topLiege,
        consort: character.consort,
        culture: character.culture,
        faith: character.faith,
        house: character.house,
        capitalLocation: character.capitalLocation,
        liegeRealmLaw: character.liegeRealmLaw,
        heldCourtAndCouncilPositions: character.heldCourtAndCouncilPositions,
        secrets: clonePlain(character.secrets),
        ownedSecrets: clonePlain(character.ownedSecrets),
        knownSecrets: character.knownSecrets.map(knownSecretToV1),
        ownedSchemes: clonePlain(character.ownedSchemes),
        exposedTargetingSchemes: clonePlain(character.exposedTargetingSchemes),
        memories: clonePlain(character.memories),
        traits: clonePlain(character.traits),
        relationsToPlayer: clonePlain(character.relationsToPlayer),
        relationsToCharacters: clonePlain(character.relationsToCharacters),
        opinionBreakdownToPlayer: clonePlain(character.opinionBreakdownToPlayer),
        opinions: clonePlain(character.opinions)
    };
}

export function militarySnapshotToSnapshot(snapshot: MilitarySnapshot): MilitarySnapshotSnapshotV1 {
    const wars = Array.from(snapshot.wars.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, war]) => clonePlain(war));
    return {
        snapshotId: snapshot.snapshotId,
        snapshotDate: snapshot.snapshotDate,
        wars,
        armies: clonePlain(snapshot.armies),
        attendees: clonePlain(snapshot.attendees),
        events: clonePlain(snapshot.events),
        complete: snapshot.complete
    };
}

export function gameDataToSnapshot(gameData: GameData): GameDataSnapshotV1 {
    const timeline: GameDataSnapshotV1['timeline'] = {
        checkpointEpoch: gameData.votcCheckpointEpoch
    };
    if (gameData.votcTimelineNodeA !== undefined) timeline.nodeA = gameData.votcTimelineNodeA;
    if (gameData.votcTimelineNodeB !== undefined) timeline.nodeB = gameData.votcTimelineNodeB;
    if (gameData.votcTimelineParentA !== undefined) timeline.parentA = gameData.votcTimelineParentA;
    if (gameData.votcTimelineParentB !== undefined) timeline.parentB = gameData.votcTimelineParentB;
    if (gameData.votcCheckpointToken !== undefined) timeline.checkpointToken = gameData.votcCheckpointToken;
    if (gameData.votcPendingCheckpointToken !== undefined) timeline.pendingCheckpointToken = gameData.votcPendingCheckpointToken;
    if (gameData.votcProtocolSchema !== undefined) timeline.protocolSchema = gameData.votcProtocolSchema;
    if (gameData.votcCampaignSchema !== undefined) timeline.campaignSchema = gameData.votcCampaignSchema;
    if (
        gameData.votcCampaignIdA !== undefined &&
        gameData.votcCampaignIdB !== undefined &&
        gameData.votcCampaignIdC !== undefined &&
        gameData.votcCampaignIdD !== undefined
    ) {
        timeline.campaignIdParts = [
            gameData.votcCampaignIdA,
            gameData.votcCampaignIdB,
            gameData.votcCampaignIdC,
            gameData.votcCampaignIdD
        ];
    }
    if (gameData.votcCampaignBootstrapKind !== undefined) timeline.campaignBootstrapKind = gameData.votcCampaignBootstrapKind;
    if (gameData.votcPlayerTimelineSchema !== undefined) timeline.playerTimelineSchema = gameData.votcPlayerTimelineSchema;

    const characters = Array.from(gameData.characters.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, character]) => characterToSnapshot(character));

    const snapshot: GameDataSnapshotV1 = {
        date: gameData.date,
        scene: gameData.scene,
        location: gameData.location,
        locationController: gameData.locationController,
        playerID: gameData.playerID,
        playerName: gameData.playerName,
        aiID: gameData.aiID,
        aiName: gameData.aiName,
        character1Name: gameData.character1Name,
        character2Name: gameData.character2Name,
        timeline,
        characters
    };
    if (gameData.gameDate !== undefined) snapshot.gameDate = clonePlain(gameData.gameDate);
    if (gameData.saveSnapshotProtocolVersion !== undefined) snapshot.saveSnapshotProtocolVersion = gameData.saveSnapshotProtocolVersion;
    if (gameData.saveSnapshotSequence !== undefined) snapshot.saveSnapshotSequence = gameData.saveSnapshotSequence;
    if (gameData.saveSnapshotSlot !== undefined) snapshot.saveSnapshotSlot = gameData.saveSnapshotSlot;
    if (gameData.militarySnapshot !== undefined) {
        snapshot.militarySnapshot = militarySnapshotToSnapshot(gameData.militarySnapshot);
    }
    return snapshot;
}

/**
 * Canonical SHA-256 hash over the whole GameDataSnapshotV1 DTO.
 *
 * Uses canonicalJsonStringify (object keys sorted recursively, arrays kept
 * in order) instead of plain JSON.stringify, so object key insertion order
 * never changes the hash while array order (the codec's stable sort of
 * characters/wars) does. This is the single source of truth for the V2
 * fixture gameDataSnapshotHash.
 */
export function gameDataSnapshotHash(snapshot: GameDataSnapshotV1): string {
    return createHash('sha256').update(canonicalJsonStringify(snapshot), 'utf8').digest('hex');
}
