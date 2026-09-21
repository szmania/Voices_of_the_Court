import { validateCk3GameDate } from '../../shared/gameData/gameDate.js';
import { validateCharacterSnapshotV1 } from '../promptWorkbench/promptWorkbenchSchemas.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import type { CharacterSnapshotV1 } from '../promptWorkbench/promptWorkbenchTypes.js';
import type { ConversationTurn } from '../agency/agencyTypes.js';
import {
    HISTORY_CHARACTER_ROLES,
    HISTORY_RECORD_SCHEMA_VERSION,
    type AnyHistoryRecordV1,
    type BattleReportHistoryRecordV1,
    type ConversationHistoryRecordV1,
    type HistoryCharacterRole,
    type HistoryCharacterSnapshotStatus,
    type HistoryCharacterSnapshotV1,
    type HistoryRecordBaseV1,
    type HistorySourceKind,
    type HistoryTimelineAnchorV1,
    type IncomingLetterHistoryRecordV1,
    type LetterHistoryRecordV1
} from './historyRecordTypes.js';

/**
 * Runtime parsers for versioned history records (plan section 6). Hand-rolled,
 * no external dependency. Parsers are strict: they either return a fully
 * validated record or throw a HistoryRecordValidationError whose message names
 * the offending field path. Error messages never echo record body text.
 *
 * Unknown extra fields are ignored, except keys that risk prototype pollution.
 */

export class HistoryRecordValidationError extends Error {
    readonly code: 'unsupported_schema' | 'invalid_record';
    readonly recordType: string;
    readonly issues: string[];

    constructor(code: 'unsupported_schema' | 'invalid_record', recordType: string, issues: string[]) {
        super(`${recordType}: ${issues.join('; ')}`);
        this.name = 'HistoryRecordValidationError';
        this.code = code;
        this.recordType = recordType;
        this.issues = issues;
    }
}

type Obj = Record<string, unknown>;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

const MAX_RECORD_DEPTH = 24;
const MAX_RECORD_ARRAY_LENGTH = 100000;

/**
 * Rejects cyclic structures, over-deep nesting and absurdly large arrays
 * before any per-field validation runs (plan section 13.3).
 */
function assertStructurallySafe(value: unknown, path: string): void {
    const seen = new Set<unknown>();
    const walk = (v: unknown, depth: number, p: string): void => {
        if (!isPlainObject(v) && !Array.isArray(v)) return;
        if (seen.has(v)) throw invalid(p, 'cyclic structure is not allowed');
        if (depth > MAX_RECORD_DEPTH) throw invalid(p, `object nesting exceeds maximum depth ${MAX_RECORD_DEPTH}`);
        if (Array.isArray(v) && v.length > MAX_RECORD_ARRAY_LENGTH) {
            throw invalid(p, `array length exceeds maximum ${MAX_RECORD_ARRAY_LENGTH}`);
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

function isPlainObject(value: unknown): value is Obj {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectForbiddenKeys(value: unknown, path: string): void {
    if (!isPlainObject(value)) return;
    for (const key of Object.keys(value)) {
        if (FORBIDDEN_KEYS.has(key)) {
            throw invalid(`${path}.${key}`, 'is not an allowed protocol field');
        }
    }
}

function reqObject(value: unknown, path: string): Obj {
    if (!isPlainObject(value)) throw invalid(path, 'expected an object');
    return value;
}

function reqString(obj: Obj, key: string, path: string): string {
    const value = obj[key];
    if (typeof value !== 'string') throw invalid(`${path}.${key}`, 'expected a string');
    return value;
}

function reqNonEmptyString(obj: Obj, key: string, path: string): string {
    const value = reqString(obj, key, path);
    if (value.length === 0) throw invalid(`${path}.${key}`, 'must not be empty');
    return value;
}

function optString(obj: Obj, key: string, path: string): string | undefined {
    const value = obj[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw invalid(`${path}.${key}`, 'expected a string or undefined');
    return value;
}

function reqInt(obj: Obj, key: string, path: string, min: number): number {
    const value = obj[key];
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw invalid(`${path}.${key}`, 'expected an integer');
    }
    if (value < min) throw invalid(`${path}.${key}`, `must be >= ${min}`);
    return value;
}

function reqBoolean(obj: Obj, key: string, path: string): boolean {
    const value = obj[key];
    if (typeof value !== 'boolean') throw invalid(`${path}.${key}`, 'expected a boolean');
    return value;
}

function reqArray(obj: Obj, key: string, path: string): unknown[] {
    const value = obj[key];
    if (!Array.isArray(value)) throw invalid(`${path}.${key}`, 'expected an array');
    return value;
}

function reqStringArray(obj: Obj, key: string, path: string, allowEmptyItems = false): string[] {
    return reqArray(obj, key, path).map((item, i) => {
        const itemPath = `${path}.${key}[${i}]`;
        if (typeof item !== 'string') throw invalid(itemPath, 'expected a string');
        if (!allowEmptyItems && item.length === 0) throw invalid(itemPath, 'must not be empty');
        return item;
    });
}

function reqEnum<T extends string>(obj: Obj, key: string, path: string, allowed: readonly T[]): T {
    const value = reqString(obj, key, path);
    if (!(allowed as readonly string[]).includes(value)) {
        throw invalid(`${path}.${key}`, 'has an unsupported value');
    }
    return value as T;
}

function reqIsoUtcString(obj: Obj, key: string, path: string): string {
    const value = reqString(obj, key, path);
    if (!ISO_UTC_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
        throw invalid(`${path}.${key}`, 'expected a UTC ISO-8601 timestamp');
    }
    return value;
}

function reqCk3GameDate(obj: Obj, key: string, path: string): Ck3GameDate {
    const value = obj[key];
    const result = validateCk3GameDate(value);
    if (!result.valid) throw invalid(`${path}.${key}`, `expected a valid Ck3GameDate (${result.reason})`);
    return value as Ck3GameDate;
}

function invalid(path: string, message: string): HistoryRecordValidationError {
    return new HistoryRecordValidationError('invalid_record', path, [`${path}: ${message}`]);
}

function assertSchemaVersion(obj: Obj, recordType: string): void {
    const value = obj.schemaVersion;
    if (typeof value !== 'number') {
        throw new HistoryRecordValidationError('invalid_record', recordType, [
            `${recordType}.schemaVersion: expected a number`
        ]);
    }
    if (value !== HISTORY_RECORD_SCHEMA_VERSION) {
        throw new HistoryRecordValidationError('unsupported_schema', recordType, [
            `${recordType}.schemaVersion: unsupported schema version ${value}`
        ]);
    }
}

// ---------------------------------------------------------------------------
// Character snapshots
// ---------------------------------------------------------------------------

export function parseHistoryCharacterSnapshot(value: unknown, path = 'character'): HistoryCharacterSnapshotV1 {
    assertStructurallySafe(value, path);
    rejectForbiddenKeys(value, path);
    const obj = reqObject(value, path);
    assertSchemaVersion(obj, `${path}`);

    const characterIdValue = obj.characterId;
    if (characterIdValue !== null && (typeof characterIdValue !== 'string' || characterIdValue.length === 0)) {
        throw invalid(`${path}.characterId`, 'expected a non-empty string or null');
    }
    const characterId = characterIdValue as string | null;

    const displayName = reqNonEmptyString(obj, 'displayName', path);
    const rolesValue = reqArray(obj, 'roles', path);
    if (rolesValue.length === 0) throw invalid(`${path}.roles`, 'must not be empty');
    const roles = rolesValue.map((item, i): HistoryCharacterRole => {
        const itemPath = `${path}.roles[${i}]`;
        if (typeof item !== 'string' || !(HISTORY_CHARACTER_ROLES as readonly string[]).includes(item)) {
            throw invalid(itemPath, 'has an unsupported role');
        }
        return item as HistoryCharacterRole;
    });
    if (new Set(roles).size !== roles.length) throw invalid(`${path}.roles`, 'must not contain duplicates');

    const status = reqEnum<HistoryCharacterSnapshotStatus>(obj, 'status', path, [
        'full',
        'reference_only',
        'missing_legacy'
    ]);

    let capturedAt: string | null;
    let capturedGameDate: Ck3GameDate | null;
    let snapshotHash: string | null;
    let snapshot: CharacterSnapshotV1 | null;

    if (status === 'full') {
        capturedAt = reqIsoUtcString(obj, 'capturedAt', path);
        capturedGameDate = reqCk3GameDate(obj, 'capturedGameDate', path);
        snapshotHash = reqString(obj, 'snapshotHash', path);
        if (!SHA256_HEX_PATTERN.test(snapshotHash)) {
            throw invalid(`${path}.snapshotHash`, 'expected a lowercase SHA-256 hex digest');
        }
        if (characterId === null) {
            throw invalid(`${path}.characterId`, 'must not be null for a full snapshot');
        }
        const rawSnapshot = obj.snapshot;
        try {
            snapshot = validateCharacterSnapshotV1(rawSnapshot, `${path}.snapshot`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'invalid snapshot';
            throw invalid(`${path}.snapshot`, `failed inner snapshot validation (${message})`);
        }
        if (snapshot.id !== Number(characterId)) {
            throw invalid(`${path}.snapshot.id`, `does not match characterId ${characterId}`);
        }
    } else {
        if (obj.snapshot !== null || obj.snapshotHash !== null) {
            throw invalid(`${path}.snapshot`, `must be null for a ${status} snapshot`);
        }
        snapshot = null;
        snapshotHash = null;
        if (status === 'reference_only') {
            capturedAt = reqIsoUtcString(obj, 'capturedAt', path);
            capturedGameDate = reqCk3GameDate(obj, 'capturedGameDate', path);
        } else {
            if (obj.capturedAt !== null) {
                throw invalid(`${path}.capturedAt`, 'must be null for a missing_legacy snapshot');
            }
            if (obj.capturedGameDate !== null) {
                throw invalid(`${path}.capturedGameDate`, 'must be null for a missing_legacy snapshot');
            }
            capturedAt = null;
            capturedGameDate = null;
        }
    }

    const unavailableReason = optString(obj, 'unavailableReason', path);

    const result: HistoryCharacterSnapshotV1 = {
        schemaVersion: 1,
        characterId,
        displayName,
        roles,
        status,
        capturedAt,
        capturedGameDate,
        snapshotHash,
        snapshot
    };
    if (unavailableReason !== undefined) {
        result.unavailableReason = unavailableReason;
    }
    return result;
}

// ---------------------------------------------------------------------------
// Anchor + common header
// ---------------------------------------------------------------------------

export function parseHistoryTimelineAnchor(value: unknown, path = 'anchor'): HistoryTimelineAnchorV1 {
    rejectForbiddenKeys(value, path);
    const obj = reqObject(value, path);
    const anchor: HistoryTimelineAnchorV1 = {
        campaignId: reqNonEmptyString(obj, 'campaignId', path),
        playerId: reqNonEmptyString(obj, 'playerId', path),
        votcCheckpointEpoch: reqInt(obj, 'votcCheckpointEpoch', path, 0),
        votcTimelineNodeId: reqNonEmptyString(obj, 'votcTimelineNodeId', path)
    };
    const parentId = optString(obj, 'votcTimelineParentId', path);
    if (parentId !== undefined) {
        if (parentId.length === 0) throw invalid(`${path}.votcTimelineParentId`, 'must not be empty');
        anchor.votcTimelineParentId = parentId;
    }
    return anchor;
}

function parseHistoryRecordBase(value: unknown, kind: HistorySourceKind, recordType: string): HistoryRecordBaseV1 {
    rejectForbiddenKeys(value, recordType);
    const obj = reqObject(value, recordType);
    assertSchemaVersion(obj, recordType);

    if (reqString(obj, 'kind', recordType) !== kind) {
        throw invalid(`${recordType}.kind`, `expected '${kind}'`);
    }

    const anchor = parseHistoryTimelineAnchor(obj.anchor, `${recordType}.anchor`);

    const votcCheckpointEpoch = reqInt(obj, 'votcCheckpointEpoch', recordType, 0);
    const votcTimelineNodeId = reqNonEmptyString(obj, 'votcTimelineNodeId', recordType);
    if (votcCheckpointEpoch !== anchor.votcCheckpointEpoch) {
        throw invalid(`${recordType}.votcCheckpointEpoch`, 'does not match anchor.votcCheckpointEpoch');
    }
    if (votcTimelineNodeId !== anchor.votcTimelineNodeId) {
        throw invalid(`${recordType}.votcTimelineNodeId`, 'does not match anchor.votcTimelineNodeId');
    }

    const base: HistoryRecordBaseV1 = {
        schemaVersion: 1,
        sourceRecordId: reqNonEmptyString(obj, 'sourceRecordId', recordType),
        kind,
        createdAt: reqIsoUtcString(obj, 'createdAt', recordType),
        gameDate: reqCk3GameDate(obj, 'gameDate', recordType),
        displayDate: reqString(obj, 'displayDate', recordType),
        anchor,
        characters: reqArray(obj, 'characters', recordType).map((item, i) =>
            parseHistoryCharacterSnapshot(item, `${recordType}.characters[${i}]`)
        ),
        votcCheckpointEpoch,
        votcTimelineNodeId
    };

    const seenCharacterIds = new Set<string>();
    for (const character of base.characters) {
        if (character.characterId === null) continue;
        if (seenCharacterIds.has(character.characterId)) {
            throw invalid(`${recordType}.characters`, `contains duplicate characterId ${character.characterId}`);
        }
        seenCharacterIds.add(character.characterId);
    }

    const parentIdProjection = obj.votcTimelineParentId;
    const parentInAnchor = anchor.votcTimelineParentId;
    if (parentIdProjection === undefined) {
        if (parentInAnchor !== undefined) {
            throw invalid(`${recordType}.votcTimelineParentId`, 'missing but present on anchor');
        }
    } else {
        if (typeof parentIdProjection !== 'string' || parentIdProjection.length === 0) {
            throw invalid(`${recordType}.votcTimelineParentId`, 'expected a non-empty string');
        }
        if (parentIdProjection !== parentInAnchor) {
            throw invalid(`${recordType}.votcTimelineParentId`, 'does not match anchor.votcTimelineParentId');
        }
        base.votcTimelineParentId = parentIdProjection;
    }

    return base;
}

// ---------------------------------------------------------------------------
// Kind-specific parsers
// ---------------------------------------------------------------------------

function parseConversationTurnStructural(value: unknown, path: string): ConversationTurn {
    rejectForbiddenKeys(value, path);
    const obj = reqObject(value, path);
    const speakerId = obj.speakerCharacterId;
    if (speakerId !== null && (typeof speakerId !== 'string' || speakerId.length === 0)) {
        throw invalid(`${path}.speakerCharacterId`, 'expected a non-empty string or null');
    }
    return {
        messageId: reqNonEmptyString(obj, 'messageId', path),
        speakerCharacterId: speakerId as string | null,
        speakerName: reqNonEmptyString(obj, 'speakerName', path),
        audienceCharacterIds: reqStringArray(obj, 'audienceCharacterIds', path),
        deliveryKind: reqNonEmptyString(obj, 'deliveryKind', path) as ConversationTurn['deliveryKind'],
        isSynthetic: reqBoolean(obj, 'isSynthetic', path),
        content: reqString(obj, 'content', path),
        createdAt: reqString(obj, 'createdAt', path),
        sequence: reqInt(obj, 'sequence', path, 0)
    };
}

export function parseConversationHistoryRecord(value: unknown): ConversationHistoryRecordV1 {
    const recordType = 'conversation_history_record';
    assertStructurallySafe(value, recordType);
    const base = parseHistoryRecordBase(value, 'conversation', recordType);
    const obj = value as Obj;

    const participantCharacterIds = reqStringArray(obj, 'participantCharacterIds', recordType);
    if (new Set(participantCharacterIds).size !== participantCharacterIds.length) {
        throw invalid(`${recordType}.participantCharacterIds`, 'must not contain duplicates');
    }

    const humanReadableTranscriptFile = reqNonEmptyString(obj, 'humanReadableTranscriptFile', recordType);
    if (
        humanReadableTranscriptFile.includes('/') ||
        humanReadableTranscriptFile.includes('\\') ||
        humanReadableTranscriptFile.includes('..')
    ) {
        throw invalid(`${recordType}.humanReadableTranscriptFile`, 'must be a plain basename');
    }

    return {
        ...base,
        kind: 'conversation',
        title: reqString(obj, 'title', recordType),
        participantCharacterIds,
        turns: reqArray(obj, 'turns', recordType).map((item, i) => {
            const turnPath = `${recordType}.turns[${i}]`;
            rejectForbiddenKeys(item, turnPath);
            const turnObj = reqObject(item, turnPath);
            return {
                turn: parseConversationTurnStructural(turnObj.turn, `${turnPath}.turn`),
                narratives: reqStringArray(turnObj, 'narratives', turnPath, true)
            };
        }),
        renderedText: reqString(obj, 'renderedText', recordType),
        humanReadableTranscriptFile
    };
}

export function parseLetterHistoryRecord(value: unknown): LetterHistoryRecordV1 {
    const recordType = 'letter_history_record';
    assertStructurallySafe(value, recordType);
    const base = parseHistoryRecordBase(value, 'outgoing_letter', recordType);
    const obj = value as Obj;

    const senderId = reqNonEmptyString(obj, 'senderId', recordType);
    const receiverId = reqNonEmptyString(obj, 'receiverId', recordType);
    const senderName = reqNonEmptyString(obj, 'senderName', recordType);
    const receiverName = reqNonEmptyString(obj, 'receiverName', recordType);
    const outgoingBody = reqString(obj, 'outgoingBody', recordType);
    const replyBody = reqString(obj, 'replyBody', recordType);

    reqEnum(obj, 'sourceType', recordType, ['letter']);
    const playerName = reqNonEmptyString(obj, 'playerName', recordType);
    const aiName = reqNonEmptyString(obj, 'aiName', recordType);
    const playerLetter = reqString(obj, 'playerLetter', recordType);
    const aiReply = reqString(obj, 'aiReply', recordType);

    if (playerName !== senderName) {
        throw invalid(`${recordType}.playerName`, 'does not match senderName');
    }
    if (aiName !== receiverName) {
        throw invalid(`${recordType}.aiName`, 'does not match receiverName');
    }
    if (playerLetter !== outgoingBody) {
        throw invalid(`${recordType}.playerLetter`, 'does not match outgoingBody');
    }
    if (aiReply !== replyBody) {
        throw invalid(`${recordType}.aiReply`, 'does not match replyBody');
    }

    return {
        ...base,
        kind: 'outgoing_letter',
        letterId: reqNonEmptyString(obj, 'letterId', recordType),
        deliveryId: reqInt(obj, 'deliveryId', recordType, 0),
        senderId,
        senderName,
        receiverId,
        receiverName,
        outgoingBody,
        replyBody,
        sourceType: 'letter',
        playerName,
        aiName,
        playerLetter,
        aiReply
    };
}

export function parseIncomingLetterHistoryRecord(value: unknown): IncomingLetterHistoryRecordV1 {
    const recordType = 'incoming_letter_history_record';
    assertStructurallySafe(value, recordType);
    const base = parseHistoryRecordBase(value, 'incoming_letter', recordType);
    const obj = value as Obj;

    reqEnum(obj, 'direction', recordType, ['incoming']);
    reqEnum(obj, 'chronicleSourceKind', recordType, ['incoming_letter']);

    const body = reqString(obj, 'body', recordType);
    const content = reqString(obj, 'content', recordType);
    if (content !== body) {
        throw invalid(`${recordType}.content`, 'does not match body');
    }

    return {
        ...base,
        kind: 'incoming_letter',
        id: reqNonEmptyString(obj, 'id', recordType),
        senderId: reqNonEmptyString(obj, 'senderId', recordType),
        senderName: reqNonEmptyString(obj, 'senderName', recordType),
        receiverId: reqNonEmptyString(obj, 'receiverId', recordType),
        receiverName: reqNonEmptyString(obj, 'receiverName', recordType),
        topic: reqString(obj, 'topic', recordType),
        body,
        direction: 'incoming',
        sourceType: reqString(obj, 'sourceType', recordType),
        chronicleSourceKind: 'incoming_letter',
        content
    };
}

export function parseBattleReportHistoryRecord(value: unknown): BattleReportHistoryRecordV1 {
    const recordType = 'battle_report_history_record';
    assertStructurallySafe(value, recordType);
    const base = parseHistoryRecordBase(value, 'battle_report', recordType);
    const obj = value as Obj;

    const terrain = optString(obj, 'terrain', recordType);
    const winter = optString(obj, 'winter', recordType);

    let result: BattleReportHistoryRecordV1['result'];
    if (obj.result !== undefined) {
        result = reqEnum(obj, 'result', recordType, ['victory', 'defeat'] as const);
    }
    let winningSide: BattleReportHistoryRecordV1['winningSide'];
    if (obj.winningSide !== undefined) {
        winningSide = reqEnum(obj, 'winningSide', recordType, ['attacker', 'defender'] as const);
    }

    const sideResults = reqArray(obj, 'sideResults', recordType).map((item, i) => {
        const sidePath = `${recordType}.sideResults[${i}]`;
        rejectForbiddenKeys(item, sidePath);
        const sideObj = reqObject(item, sidePath);
        return {
            participantId: reqNonEmptyString(sideObj, 'participantId', sidePath),
            initialTroops: reqInt(sideObj, 'initialTroops', sidePath, 0),
            lostTroops: reqInt(sideObj, 'lostTroops', sidePath, 0),
            survivingTroops: reqInt(sideObj, 'survivingTroops', sidePath, 0)
        };
    });

    const commanders = reqArray(obj, 'commanders', recordType).map((item, i) => {
        const commanderPath = `${recordType}.commanders[${i}]`;
        rejectForbiddenKeys(item, commanderPath);
        const commanderObj = reqObject(item, commanderPath);
        return {
            side: reqEnum(commanderObj, 'side', commanderPath, ['winner', 'loser']),
            id: reqNonEmptyString(commanderObj, 'id', commanderPath),
            name: reqNonEmptyString(commanderObj, 'name', commanderPath)
        };
    });

    const notableCharacters = reqArray(obj, 'notableCharacters', recordType).map((item, i) => {
        const notablePath = `${recordType}.notableCharacters[${i}]`;
        rejectForbiddenKeys(item, notablePath);
        const notableObj = reqObject(item, notablePath);
        return {
            type: reqEnum(notableObj, 'type', notablePath, [
                'slain_loser_side',
                'slain_winner_side',
                'captured_loser_side'
            ]),
            id: reqNonEmptyString(notableObj, 'id', notablePath),
            name: reqNonEmptyString(notableObj, 'name', notablePath)
        };
    });

    return {
        ...base,
        kind: 'battle_report',
        id: reqNonEmptyString(obj, 'id', recordType),
        dedupKey: reqNonEmptyString(obj, 'dedupKey', recordType),
        location: reqNonEmptyString(obj, 'location', recordType),
        ...(terrain !== undefined ? { terrain } : {}),
        ...(winter !== undefined ? { winter } : {}),
        ...(result !== undefined ? { result } : {}),
        ...(winningSide !== undefined ? { winningSide } : {}),
        winnerId: reqNonEmptyString(obj, 'winnerId', recordType),
        winnerName: reqNonEmptyString(obj, 'winnerName', recordType),
        loserId: reqNonEmptyString(obj, 'loserId', recordType),
        loserName: reqNonEmptyString(obj, 'loserName', recordType),
        sideResults,
        commanders,
        notableCharacters,
        tags: reqStringArray(obj, 'tags', recordType, true),
        content: reqString(obj, 'content', recordType),
        generationStatus: reqEnum(obj, 'generationStatus', recordType, ['fallback', 'generated'])
    };
}

/**
 * Parses any history record by inspecting its `kind`. Useful for readers that
 * handle mixed arrays of records.
 */
export function parseAnyHistoryRecord(value: unknown): AnyHistoryRecordV1 {
    const obj = reqObject(value, 'history_record');
    const kind = reqEnum<HistorySourceKind>(obj, 'kind', 'history_record', [
        'conversation',
        'outgoing_letter',
        'incoming_letter',
        'battle_report'
    ]);
    switch (kind) {
        case 'conversation':
            return parseConversationHistoryRecord(value);
        case 'outgoing_letter':
            return parseLetterHistoryRecord(value);
        case 'incoming_letter':
            return parseIncomingLetterHistoryRecord(value);
        case 'battle_report':
            return parseBattleReportHistoryRecord(value);
    }
}
