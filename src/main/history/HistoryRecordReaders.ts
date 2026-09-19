import fs from 'fs';
import path from 'path';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import { conversationHistoryDir } from '../campaignDataPaths.js';
import {
    parseConversationHistoryRecord,
    parseIncomingLetterHistoryRecord,
    parseLetterHistoryRecord,
    parseBattleReportHistoryRecord,
    HistoryRecordValidationError
} from './historyRecordSchemas.js';
import type {
    BattleReportHistoryRecordV1,
    ConversationHistoryRecordV1,
    HistoryCharacterSnapshotV1,
    HistoryRecordBaseV1,
    HistorySourceKind,
    IncomingLetterHistoryRecordV1,
    LetterHistoryRecordV1
} from './historyRecordTypes.js';

/**
 * Canonical + legacy record readers (plan task T8).
 *
 * Two read modes:
 *  - `tolerant_for_chronicle`: corrupted/unsupported records are skipped with
 *    a structured warning; the surrounding generation flow continues.
 *  - `strict_for_export`: any corruption of an authoritative v1 file aborts
 *    the whole read (fail closed); only genuinely legacy records are adapted.
 *
 * Legacy records are adapted into canonical memory models WITHOUT ever
 * querying current GameData state — missing snapshots stay missing
 * (`missing_legacy`), and missing timeline anchors surface as warnings.
 */

export type HistoryReadMode = 'tolerant_for_chronicle' | 'strict_for_export';

export const HISTORY_WARNING_CODES = {
    legacyMissingSnapshot: 'legacy_record_missing_snapshot',
    legacyMissingAnchor: 'legacy_record_missing_timeline_anchor',
    skippedInChronicleMode: 'record_skipped_in_chronicle_mode',
    unsupportedSchema: 'unsupported_history_schema'
} as const;

export interface HistoryReaderWarning {
    code: string;
    sourceKind?: HistorySourceKind;
    /** Logical relative path (never an absolute user path). */
    sourcePath?: string;
    sourceRecordId?: string;
    businessRecordId?: string;
    message: string;
}

export class HistoryReaderError extends Error {
    readonly code: 'source_corrupt' | 'unsupported_schema';
    readonly logicalPath: string;
    readonly issues: string[];

    constructor(code: 'source_corrupt' | 'unsupported_schema', logicalPath: string, issues: string[]) {
        super(`${logicalPath}: ${issues.join('; ')}`);
        this.name = 'HistoryReaderError';
        this.code = code;
        this.logicalPath = logicalPath;
        this.issues = issues;
    }
}

// ---------------------------------------------------------------------------
// Conversation dual-layout reader
// ---------------------------------------------------------------------------

export interface CanonicalConversationSource {
    origin: 'v1' | 'legacy';
    nodeId?: string;
    sourceRecordId?: string;
    title: string;
    rawText: string;
    gameDate: Ck3GameDate | null;
    displayDate: string;
    createdAt?: string;
    votcCheckpointEpoch?: number;
    votcTimelineNodeId?: string;
    votcTimelineParentId?: string;
    characters: HistoryCharacterSnapshotV1[];
    humanReadableTranscriptFile?: string;
    /** Raw header date fields for legacy files (date reconstruction). */
    gameDateTotalDays?: number;
    gameDateParts?: { year: number; month: number; day: number };
    /** Logical path relative to the campaign/player namespace root. */
    logicalPath: string;
}

interface ParsedTxtHeader {
    sourceRecordId?: string;
    gameDateTotalDays?: number;
    gameDateParts?: { year: number; month: number; day: number };
    displayDate?: string;
    checkpointEpoch?: number;
    timelineNode?: string;
    timelineParent?: string;
}

const TXT_SOURCE_RECORD_ID_PREFIX = 'VOTC source record id: ';
const TXT_GAME_DATE_TOTAL_DAYS_PREFIX = 'VOTC game date total days: ';
const TXT_GAME_DATE_PREFIX = 'VOTC game date: ';
const TXT_CHECKPOINT_PREFIX = 'VOTC checkpoint: ';
const TXT_TIMELINE_NODE_PREFIX = 'VOTC timeline node: ';
const TXT_TIMELINE_PARENT_PREFIX = 'VOTC timeline parent: ';

export function parseConversationTxtHeader(content: string, fileName?: string): { header: ParsedTxtHeader; body: string } {
    const lines = content.split('\n');
    const header: ParsedTxtHeader = {};
    let bodyStartIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === '') {
            bodyStartIndex = i + 1;
            break;
        }
        if (line.startsWith(TXT_SOURCE_RECORD_ID_PREFIX)) {
            header.sourceRecordId = line.slice(TXT_SOURCE_RECORD_ID_PREFIX.length).trim();
        } else if (line.startsWith(TXT_GAME_DATE_TOTAL_DAYS_PREFIX)) {
            const num = Number(line.slice(TXT_GAME_DATE_TOTAL_DAYS_PREFIX.length).trim());
            header.gameDateTotalDays = Number.isFinite(num) ? num : undefined;
        } else if (line.startsWith(TXT_GAME_DATE_PREFIX)) {
            const parts = line.slice(TXT_GAME_DATE_PREFIX.length).trim().split('-');
            if (parts.length === 3) {
                const y = Number(parts[0]);
                const m = Number(parts[1]);
                const d = Number(parts[2]);
                if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
                    header.gameDateParts = { year: y, month: m, day: d };
                }
            }
        } else if (line.startsWith(TXT_CHECKPOINT_PREFIX)) {
            const num = Number(line.slice(TXT_CHECKPOINT_PREFIX.length).trim());
            header.checkpointEpoch = Number.isFinite(num) ? num : undefined;
        } else if (line.startsWith(TXT_TIMELINE_NODE_PREFIX)) {
            const raw = line.slice(TXT_TIMELINE_NODE_PREFIX.length).trim();
            header.timelineNode = raw && raw !== 'unknown' ? raw : undefined;
        } else if (line.startsWith(TXT_TIMELINE_PARENT_PREFIX)) {
            const raw = line.slice(TXT_TIMELINE_PARENT_PREFIX.length).trim();
            header.timelineParent = raw && raw !== 'null' ? raw : undefined;
        } else if (line.includes(': ') && !line.startsWith('VOTC ') && !header.displayDate) {
            const colonIndex = line.indexOf(': ');
            if (colonIndex > 0) header.displayDate = line.slice(colonIndex + 2).trim();
        }
    }

    // Filename fallbacks mirror the historical collector behavior for .txt
    // files whose headers predate those header lines.
    if (fileName) {
        if (!header.timelineNode) {
            const match = fileName.match(/_tl_(\d+)(?:-|_)(\d+)_/);
            if (match) header.timelineNode = `${match[1]}-${match[2]}`;
        }
        if (header.checkpointEpoch === undefined) {
            const match = fileName.match(/_ckpt(\d+)_/);
            if (match) {
                const epoch = Number(match[1]);
                if (Number.isFinite(epoch)) header.checkpointEpoch = epoch;
            }
        }
    }

    return { header, body: lines.slice(bodyStartIndex).join('\n') };
}

function legacyCharactersFromParticipants(
    participants: Array<{ id?: string; name: string }>
): HistoryCharacterSnapshotV1[] {
    return participants.map(participant => ({
        schemaVersion: 1,
        characterId: participant.id ?? null,
        displayName: participant.name || 'unknown',
        roles: ['conversation_participant'],
        status: 'missing_legacy' as const,
        capturedAt: null,
        capturedGameDate: null,
        snapshotHash: null,
        snapshot: null,
        unavailableReason: 'record_predates_character_snapshots'
    }));
}

function extractParticipantsFromBody(body: string): Array<{ id?: string; name: string }> {
    const names = new Set<string>();
    for (const line of body.split('\n')) {
        const speaker = line.match(/^([^:]{1,64}):\s/);
        if (speaker && speaker[1].trim() !== '') names.add(speaker[1].trim());
    }
    return [...names].map(name => ({ name }));
}

/**
 * Reads every conversation in the campaign namespace, canonical-first:
 *  - `<nodeId>/conversation.json` wins over any `.txt`;
 *  - a root-level `.txt` whose node/sourceRecordId matches a loaded v1 record
 *    is skipped (no duplicates);
 *  - remaining `.txt` files are adapted as legacy records with
 *    `missing_legacy` characters;
 *  - a corrupt v1 JSON never falls back to its `.txt`: tolerant mode skips it
 *    with a warning, strict mode aborts.
 */
export function readCanonicalConversationSources(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    mode: HistoryReadMode
): { sources: CanonicalConversationSource[]; warnings: HistoryReaderWarning[] } {
    const warnings: HistoryReaderWarning[] = [];
    const dir = conversationHistoryDir(userDataDir, identity);
    if (!fs.existsSync(dir)) return { sources: [], warnings };

    const sources: CanonicalConversationSource[] = [];
    const claimedNodeIds = new Set<string>();
    const claimedSourceRecordIds = new Set<string>();
    const claimedTxtBasenames = new Set<string>();
    // Node directories whose canonical JSON exists but failed to load. Any
    // root-level .txt whose filename references such a node must be suppressed
    // entirely (plan section 3.3: never fall back to `.txt` for a broken v1
    // record, even in tolerant mode).
    const corruptNodeIds = new Set<string>();

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return { sources: [], warnings };
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const nodeId = entry.name;
        const jsonPath = path.join(dir, nodeId, 'conversation.json');
        if (!fs.existsSync(jsonPath)) continue;
        const logicalPath = `conversation_history/${nodeId}/conversation.json`;

        let raw: string;
        try {
            raw = fs.readFileSync(jsonPath, 'utf8');
        } catch (error) {
            if (mode === 'strict_for_export') {
                throw new HistoryReaderError('source_corrupt', logicalPath, [`cannot read: ${String(error)}`]);
            }
            warnings.push({
                code: HISTORY_WARNING_CODES.skippedInChronicleMode,
                sourceKind: 'conversation',
                sourcePath: logicalPath,
                message: `unreadable canonical conversation record skipped`
            });
            claimedNodeIds.add(nodeId);
            continue;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            if (mode === 'strict_for_export') {
                throw new HistoryReaderError('source_corrupt', logicalPath, [`invalid JSON: ${String(error)}`]);
            }
            warnings.push({
                code: HISTORY_WARNING_CODES.skippedInChronicleMode,
                sourceKind: 'conversation',
                sourcePath: logicalPath,
                message: 'canonical conversation record is not valid JSON; skipped'
            });
            corruptNodeIds.add(nodeId);
            claimCorruptRecordHints(nodeId, raw, claimedNodeIds, claimedSourceRecordIds, claimedTxtBasenames);
            continue;
        }

        try {
            const record = parseConversationHistoryRecord(parsed);
            sources.push(canonicalFromV1(record, logicalPath));
            claimedNodeIds.add(record.anchor.votcTimelineNodeId);
            claimedSourceRecordIds.add(record.sourceRecordId);
            claimedTxtBasenames.add(record.humanReadableTranscriptFile);
        } catch (error) {
            const issues = error instanceof HistoryRecordValidationError ? [error.message] : [String(error)];
            if (mode === 'strict_for_export') {
                throw new HistoryReaderError('source_corrupt', logicalPath, issues);
            }
            warnings.push({
                code: HISTORY_WARNING_CODES.skippedInChronicleMode,
                sourceKind: 'conversation',
                sourcePath: logicalPath,
                message: `canonical conversation record failed validation; skipped`
            });
            corruptNodeIds.add(nodeId);
            claimCorruptRecordHints(nodeId, raw, claimedNodeIds, claimedSourceRecordIds, claimedTxtBasenames);
        }
    }

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.txt')) continue;
        if (claimedTxtBasenames.has(entry.name)) continue;
        // A corrupt canonical record suppresses any .txt that references its
        // node id in the filename — the mirror must not be used instead.
        let referencedCorruptNode = false;
        for (const corruptNodeId of corruptNodeIds) {
            if (corruptNodeId !== '' && entry.name.includes(corruptNodeId)) {
                referencedCorruptNode = true;
                break;
            }
        }
        if (referencedCorruptNode) continue;
        const filePath = path.join(dir, entry.name);
        const logicalPath = `conversation_history/${entry.name}`;
        let content: string;
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch {
            continue;
        }
        const { header, body } = parseConversationTxtHeader(content, entry.name);

        // A .txt that mirrors an already-loaded v1 record must not create a
        // second source.
        if (
            (header.sourceRecordId && claimedSourceRecordIds.has(header.sourceRecordId)) ||
            (header.timelineNode !== undefined && claimedNodeIds.has(header.timelineNode))
        ) {
            continue;
        }

        const participants = extractParticipantsFromBody(body);
        const characters = legacyCharactersFromParticipants(participants);
        if (characters.length > 0) {
            warnings.push({
                code: HISTORY_WARNING_CODES.legacyMissingSnapshot,
                sourceKind: 'conversation',
                sourcePath: logicalPath,
                message: 'legacy conversation has no character snapshots'
            });
        }
        if (header.timelineNode === undefined && header.checkpointEpoch === undefined) {
            warnings.push({
                code: HISTORY_WARNING_CODES.legacyMissingAnchor,
                sourceKind: 'conversation',
                sourcePath: logicalPath,
                message: 'legacy conversation has no timeline anchor'
            });
        }

        sources.push({
            origin: 'legacy',
            nodeId: header.timelineNode,
            sourceRecordId: header.sourceRecordId,
            title: participants.length > 0 ? participants.map(p => p.name).join(', ') : 'Conversation',
            rawText: body.trim(),
            gameDate: null,
            displayDate: header.displayDate ?? '',
            createdAt: undefined,
            votcCheckpointEpoch: header.checkpointEpoch,
            votcTimelineNodeId: header.timelineNode,
            votcTimelineParentId: header.timelineParent,
            characters,
            ...(header.gameDateTotalDays !== undefined ? { gameDateTotalDays: header.gameDateTotalDays } : {}),
            ...(header.gameDateParts ? { gameDateParts: header.gameDateParts } : {}),
            logicalPath
        });
    }

    return { sources, warnings };
}

/**
 * Claims the node directory and any recoverable identity hints from a corrupt
 * canonical record so its mirrored `.txt` is never silently used as a
 * replacement (plan T8: "不得无提示降级到 .txt").
 */
function claimCorruptRecordHints(
    nodeId: string,
    raw: string,
    claimedNodeIds: Set<string>,
    claimedSourceRecordIds: Set<string>,
    claimedTxtBasenames: Set<string>
): void {
    claimedNodeIds.add(nodeId);
    const sourceIdMatch = raw.match(/"sourceRecordId"\s*:\s*"([^"]+)"/);
    if (sourceIdMatch) claimedSourceRecordIds.add(sourceIdMatch[1]);
    const nodeIdMatch = raw.match(/"votcTimelineNodeId"\s*:\s*"([^"]+)"/);
    if (nodeIdMatch) claimedNodeIds.add(nodeIdMatch[1]);
    const fileMatch = raw.match(/"humanReadableTranscriptFile"\s*:\s*"([^"]+)"/);
    if (fileMatch) claimedTxtBasenames.add(fileMatch[1]);
}

function canonicalFromV1(record: ConversationHistoryRecordV1, logicalPath: string): CanonicalConversationSource {    return {
        origin: 'v1',
        nodeId: record.anchor.votcTimelineNodeId,
        sourceRecordId: record.sourceRecordId,
        title: record.title,
        rawText: record.renderedText,
        gameDate: record.gameDate,
        displayDate: record.displayDate,
        createdAt: record.createdAt,
        votcCheckpointEpoch: record.votcCheckpointEpoch,
        votcTimelineNodeId: record.votcTimelineNodeId,
        votcTimelineParentId: record.votcTimelineParentId,
        characters: record.characters,
        humanReadableTranscriptFile: record.humanReadableTranscriptFile,
        logicalPath
    };
}

// ---------------------------------------------------------------------------
// Versioned-array readers (letters / incoming letters / battle reports)
// ---------------------------------------------------------------------------

export interface ClassifiedHistoryArray<T> {
    v1Records: T[];
    legacyEntries: unknown[];
    warnings: HistoryReaderWarning[];
}

function assertAnchorMatchesBoundIdentity(
    record: HistoryRecordBaseV1,
    identity: CampaignPlayerIdentity,
    logicalPath: string,
    index: number
): void {
    if (record.anchor.campaignId !== identity.campaignId || record.anchor.playerId !== identity.playerId) {
        throw new HistoryReaderError('source_corrupt', `${logicalPath}[${index}]`, [
            'record anchor identity does not match the namespace being read'
        ]);
    }
}

/**
 * Classifies a versioned history array into strictly parsed v1 records and
 * untouched legacy entries. Unknown higher schema versions produce
 * `unsupported_history_schema` warnings in tolerant mode and hard errors in
 * strict mode.
 */
export function classifyLetterHistoryArray(
    entries: unknown[],
    identity: CampaignPlayerIdentity,
    mode: HistoryReadMode,
    logicalPath: string
): ClassifiedHistoryArray<LetterHistoryRecordV1> {
    return classifyHistoryArrayEntries(entries, identity, mode, logicalPath, 'outgoing_letter', value =>
        parseLetterHistoryRecord(value)
    );
}

export function classifyIncomingLetterHistoryArray(
    entries: unknown[],
    identity: CampaignPlayerIdentity,
    mode: HistoryReadMode,
    logicalPath: string
): ClassifiedHistoryArray<IncomingLetterHistoryRecordV1> {
    return classifyHistoryArrayEntries(entries, identity, mode, logicalPath, 'incoming_letter', value =>
        parseIncomingLetterHistoryRecord(value)
    );
}

export function classifyBattleReportHistoryArray(
    entries: unknown[],
    identity: CampaignPlayerIdentity,
    mode: HistoryReadMode,
    logicalPath: string
): ClassifiedHistoryArray<BattleReportHistoryRecordV1> {
    return classifyHistoryArrayEntries(entries, identity, mode, logicalPath, 'battle_report', value =>
        parseBattleReportHistoryRecord(value)
    );
}

function classifyHistoryArrayEntries<T extends HistoryRecordBaseV1>(
    entries: unknown[],
    identity: CampaignPlayerIdentity,
    mode: HistoryReadMode,
    logicalPath: string,
    expectedKind: HistorySourceKind,
    parse: (value: unknown) => T
): ClassifiedHistoryArray<T> {
    const result: ClassifiedHistoryArray<T> = { v1Records: [], legacyEntries: [], warnings: [] };

    entries.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') {
            result.legacyEntries.push(entry);
            return;
        }
        const schemaVersion = (entry as { schemaVersion?: unknown }).schemaVersion;

        if (schemaVersion === undefined || schemaVersion === null) {
            // Legacy entry: kept verbatim for the existing consumers.
            result.legacyEntries.push(entry);
            return;
        }

        if (typeof schemaVersion !== 'number' || schemaVersion > 1) {
            const issue = `unsupported schemaVersion ${String(schemaVersion)}`;
            if (mode === 'strict_for_export') {
                throw new HistoryReaderError('unsupported_schema', `${logicalPath}[${index}]`, [issue]);
            }
            result.warnings.push({
                code: HISTORY_WARNING_CODES.unsupportedSchema,
                sourceKind: expectedKind,
                sourcePath: logicalPath,
                message: issue
            });
            return;
        }

        try {
            const parsed = parse(entry);
            if (parsed.kind !== expectedKind) {
                throw new HistoryReaderError('source_corrupt', `${logicalPath}[${index}]`, [
                    `kind mismatch: expected ${expectedKind}`
                ]);
            }
            assertAnchorMatchesBoundIdentity(parsed, identity, logicalPath, index);
            result.v1Records.push(parsed);
        } catch (error) {
            if (error instanceof HistoryReaderError) throw error;
            const issue = error instanceof Error ? error.message : String(error);
            if (mode === 'strict_for_export') {
                throw new HistoryReaderError('source_corrupt', `${logicalPath}[${index}]`, [issue]);
            }
            result.warnings.push({
                code: HISTORY_WARNING_CODES.skippedInChronicleMode,
                sourceKind: expectedKind,
                sourcePath: logicalPath,
                message: `schema v1 entry failed validation; skipped`
            });
        }
    });

    return result;
}
