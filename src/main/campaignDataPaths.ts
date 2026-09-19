import path from 'path';
import type { CampaignPlayerIdentity } from '../shared/gameData/CampaignIdentity.js';

export class CampaignPathError extends Error {
    readonly code = 'CAMPAIGN_PATH_INVALID';

    constructor(message: string) {
        super(message);
        this.name = 'CampaignPathError';
    }
}

const FORBIDDEN_NAME_PATTERNS = [
    /[/\\]/,
    /^\.\.?$/,
    /\.\./,
    /[\u0000-\u001F]/
];

export function validatePathSafeName(value: string, label: string): void {
    if (typeof value !== 'string' || value.length === 0) {
        throw new CampaignPathError(`${label} must be a non-empty string`);
    }
    for (const pattern of FORBIDDEN_NAME_PATTERN_LIST) {
        if (pattern.test(value)) {
            throw new CampaignPathError(`${label} contains forbidden path characters: "${value}"`);
        }
    }
}

const FORBIDDEN_NAME_PATTERN_LIST = FORBIDDEN_NAME_PATTERNS;

function assertIdentity(identity: CampaignPlayerIdentity): void {
    validatePathSafeName(identity.campaignId, 'campaignId');
    validatePathSafeName(identity.playerId, 'playerId');
}

function campaignRootOf(userDataDir: string, identity: CampaignPlayerIdentity): string {
    assertIdentity(identity);
    // Idempotent against callers that hand in a userData dir which already
    // ends in votc_data (the app's <userData>/votc_data): collapse the duplicate
    // so every entry point resolves to the same campaign root.
    const segments = userDataDir.split(/[\\/]/);
    if (segments.length > 1 && segments[segments.length - 1] === 'votc_data') {
        segments.pop();
    }
    return path.join(...segments, 'votc_data', 'campaigns', identity.campaignId);
}

export function campaignRoot(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return campaignRootOf(userDataDir, identity);
}

export function campaignMetaPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignRootOf(userDataDir, identity), 'campaign.json');
}

export function campaignPlayerDir(userDataDir: string, identity: CampaignPlayerIdentity): string {
    assertIdentity(identity);
    return path.join(
        campaignRootOf(userDataDir, identity),
        'players',
        identity.playerId
    );
}

export function timelineRegistryPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'timeline_registry.json');
}

export function timelineRegistryTmpPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return `${timelineRegistryPath(userDataDir, identity)}.tmp`;
}

export function timelineRegistrySwapManifestPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return `${timelineRegistryPath(userDataDir, identity)}.swap.json`;
}

export function timelineRegistryBackupPath(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    index: number
): string {
    return `${timelineRegistryPath(userDataDir, identity)}.bak.${index}`;
}

export function timelineTransactionsDir(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'timeline_transactions');
}

export function conversationSummariesDir(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'conversation_summaries');
}

export function conversationHistoryDir(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'conversation_history');
}

export function letterHistoryDir(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'letter_history');
}

export function letterHistoryArchivedDir(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'letter_history_archived');
}

export function battleReportHistoryPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'battle_report_history.json');
}

export function battleReportHistoryArchivedPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'battle_report_history_archived.json');
}

export function summaryOverridesPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'summary_overrides.json');
}

export function migrationManifestPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'migration.json');
}

/**
 * Chronicle directory under the campaign/player namespace. All chronicle
 * artifacts (entries, attempts, memory observations, source digests) live
 * here and nowhere else.
 *
 * Path shape:
 *   <userData>/votc_data/campaigns/<campaignId>/players/<playerId>/chronicle/
 */
export function chronicleDir(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'chronicle');
}

export function chronicleEntriesPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(chronicleDir(userDataDir, identity), 'entries.json');
}

export function chronicleAttemptsPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(chronicleDir(userDataDir, identity), 'attempts.json');
}

export function chronicleMemoryStorePath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(chronicleDir(userDataDir, identity), 'memory_observations.json');
}

export function chronicleMemoryBackupPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(chronicleDir(userDataDir, identity), 'memory_observations.json.bak');
}

export function chronicleSourceDigestsPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(chronicleDir(userDataDir, identity), 'source_digests.json');
}

/**
 * Save-fact cache directory under the campaign/player namespace (save game
 * fact source plan, Task 12 step 1). All save-fact artifacts (current snapshot
 * cache, diagnostics snapshots, diagnostics export, entity-name cache) live
 * here and nowhere else.
 *
 * Path shape:
 *   <userData>/votc_data/campaigns/<campaignId>/players/<playerId>/save_facts/
 */
export function saveFactsDir(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'save_facts');
}

export function saveFactsCurrentPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(saveFactsDir(userDataDir, identity), 'current.json');
}

export function saveFactsSnapshotsDir(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(saveFactsDir(userDataDir, identity), 'snapshots');
}

export function saveFactsDiagnosticsPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(saveFactsDir(userDataDir, identity), 'diagnostics.json');
}

export function saveFactsEntityNamesPath(userDataDir: string, identity: CampaignPlayerIdentity): string {
    return path.join(saveFactsDir(userDataDir, identity), 'entity_names.json');
}

/**
 * Agency Ledger directory under the campaign/player namespace.
 * All Agency artifacts (events, attempts, sources, transcript) live here
 * and nowhere else. See plan §5.1.
 *
 * Path shape:
 *   <userData>/votc_data/campaigns/<campaignId>/players/<playerId>/agency/
 */
export function agencyDir(
    userDataDir: string,
    identity: CampaignPlayerIdentity
): string {
    return path.join(campaignPlayerDir(userDataDir, identity), 'agency');
}

/**
 * Per-conversation append-only transcript JSON file.
 *
 * Path shape:
 *   <userData>/votc_data/campaigns/<campaignId>/players/<playerId>/
 *     conversation_history/<nodeId>/transcript.json
 *
 * The directory is keyed by the timeline node id so that re-opening the
 * conversation under a different node does not collide with prior branches.
 * `nodeId` is the same string format as `TimelineRegistry` (e.g. "1655919824-1896577781").
 */
export function conversationTranscriptPath(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    nodeId: string
): string {
    validatePathSafeName(nodeId, 'nodeId');
    return path.join(
        conversationHistoryDir(userDataDir, identity),
        nodeId,
        'transcript.json'
    );
}

/**
 * Per-conversation canonical history record (schema v1).
 *
 * Path shape:
 *   <userData>/votc_data/campaigns/<campaignId>/players/<playerId>/
 *     conversation_history/<nodeId>/conversation.json
 *
 * Sits next to the per-node Agency `transcript.json`; the two files have
 * distinct responsibilities and must not be merged.
 */
export function conversationHistoryRecordPath(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    nodeId: string
): string {
    validatePathSafeName(nodeId, 'nodeId');
    return path.join(
        conversationHistoryDir(userDataDir, identity),
        nodeId,
        'conversation.json'
    );
}

/**
 * Plan §5.1 path: events.json — the Agency domain-state source of
 * truth. Sits at the campaign/player agency directory.
 */
export function agencyEventsPath(
    userDataDir: string,
    identity: CampaignPlayerIdentity
): string {
    return path.join(agencyDir(userDataDir, identity), 'events.json');
}

/** Single .bak companion (plan §5.1 / §5.3). */
export function agencyEventsBackupPath(
    userDataDir: string,
    identity: CampaignPlayerIdentity
): string {
    return `${agencyEventsPath(userDataDir, identity)}.bak`;
}

/** Plan §5.1: attempts.json — extraction working-state source of truth. */
export function agencyAttemptsPath(
    userDataDir: string,
    identity: CampaignPlayerIdentity
): string {
    return path.join(agencyDir(userDataDir, identity), 'attempts.json');
}

/** Single .bak companion for attempts. */
export function agencyAttemptsBackupPath(
    userDataDir: string,
    identity: CampaignPlayerIdentity
): string {
    return `${agencyAttemptsPath(userDataDir, identity)}.bak`;
}

/**
 * Plan §5.1: per-source immutable snapshot file. The directory is
 * keyed by `sourceRecordId`; the file is keyed by `sourceDigest`.
 * Same recordId with a different digest gets a separate file
 * (immutable, never overwritten).
 *
 * Path encoding note: the canonical `sourceRecordId` namespace
 * (defined in the brief §3.2.3 task 4) uses `:` as a separator
 * (e.g. `game_snapshot_log:conv:1:2:3:4:<key>:<ts>`). On Windows,
 * `fs.mkdirSync` refuses to create directories whose names contain
 * `:` in non-drive-letter positions. The on-disk file content
 * preserves the canonical recordId verbatim; only the on-disk
 * PATH component below substitutes `:` with `_` so the OS can
 * create the directory. Decoding back is a no-op (the recordId
 * is stored in the file body), so this is a one-way, lossy-only-for-the-
 * path-component encoding. See `encodeSourceRecordIdForPath`.
 */
export function agencySourcePath(
    userDataDir: string,
    identity: CampaignPlayerIdentity,
    sourceRecordId: string,
    sourceDigest: string
): string {
    validatePathSafeName(sourceRecordId, 'sourceRecordId');
    validatePathSafeName(sourceDigest, 'sourceDigest');
    return path.join(
        agencyDir(userDataDir, identity),
        'sources',
        encodeSourceRecordIdForPath(sourceRecordId),
        `${sourceDigest}.json`
    );
}

/**
 * Encode a canonical `sourceRecordId` for use as a directory name
 * on disk. Replaces `:` with `_` (path-safe on all OSes including
 * Windows, where `:` is reserved for drive letters).
 *
 * The canonical recordId in the on-disk file's top-level field is
 * unaffected by this transformation; consumers reading the file
 * see the brief's namespace verbatim. Only the on-disk path
 * component is encoded.
 */
export function encodeSourceRecordIdForPath(sourceRecordId: string): string {
    return sourceRecordId.replace(/:/g, '_');
}
