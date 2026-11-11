import crypto from 'crypto';
import type { ChronicleMemoryTimelineAnchor } from './chronicleTypes.js';

/**
 * Stable memory identity helpers.
 *
 * Identity is composed ONLY of stable fields:
 *  - ownerId
 *  - creationDate.totalDays (legacy: creationDate.display)
 *  - tokenSource (so tokens from different algorithms are never compared)
 *  - normalized memoryTypeToken
 *  - sorted unique participant IDs
 *
 * Explicitly excluded (dynamic, re-rendered by CK3 each snapshot):
 *  description, ownerName, memoryName, title, localized third-person text,
 *  latest relevanceWeight.
 */

/**
 * Normalize a memory type token for identity. Trims and collapses internal
 * whitespace so cosmetic differences do not create duplicate records. Does
 * NOT lowercase: CK3 memory names are case-sensitive localization keys.
 */
export function normalizeMemoryTypeToken(token: string | undefined): string {
    if (token === undefined) return '';
    return token.trim().replace(/\s+/g, ' ');
}

/**
 * Normalize a participant ID. Participant IDs from CK3 are integers; we sort
 * and dedupe them as strings for stable hashing.
 */
function normalizeParticipantId(id: string | number): string {
    return String(id).trim();
}

/**
 * Sort and deduplicate participant IDs for identity. CK3 may emit the same
 * participant multiple times in one memory (verified in Task 0 probes); the
 * identity anchor uses the unique sorted set.
 */
export function canonicalParticipantIds(participantIds: readonly (string | number)[]): string[] {
    const seen = new Set<string>();
    for (const id of participantIds) {
        const normalized = normalizeParticipantId(id);
        if (normalized.length > 0) {
            seen.add(normalized);
        }
    }
    return Array.from(seen).sort();
}

/**
 * Compute the identity anchor for a memory.
 *
 *   identityAnchor = SHA-256(
 *     ownerId
 *     + creationDate.totalDays (legacy: creationDate.display)
 *     + tokenSource
 *     + normalized memoryTypeToken
 *     + sorted unique participant IDs
 *   )
 *
 * The hash is returned as lowercase hex.
 */
export function computeIdentityAnchor(params: {
    ownerId: string;
    creationTotalDays?: number;
    creationDateDisplay?: string;
    tokenSource: string;
    memoryTypeToken: string | undefined;
    participantIds: readonly (string | number)[];
}): string {
    const ownerId = String(params.ownerId).trim();
    if (ownerId.length === 0) {
        throw new Error('computeIdentityAnchor: ownerId must be a non-empty string');
    }

    // Prefer totalDays; fall back to the display string for legacy records.
    const creationKey = params.creationTotalDays !== undefined && Number.isFinite(params.creationTotalDays)
        ? `d:${params.creationTotalDays}`
        : `s:${params.creationDateDisplay ?? ''}`;

    const tokenSource = String(params.tokenSource);
    const token = normalizeMemoryTypeToken(params.memoryTypeToken);
    const participants = canonicalParticipantIds(params.participantIds);

    const parts = [
        ownerId,
        creationKey,
        tokenSource,
        token,
        participants.join(',')
    ];

    const material = parts.join('\u0001');
    return crypto.createHash('sha256').update(material, 'utf8').digest('hex');
}

/**
 * Resolve the first-visible timeline anchor for a memory. Prefers the timeline
 * node; legacy data (no node) falls back to the checkpoint epoch.
 */
export function resolveFirstVisibleTimelineAnchor(
    anchor: ChronicleMemoryTimelineAnchor
): string {
    if (anchor.timelineNodeId !== undefined && anchor.timelineNodeId !== '') {
        return `n:${anchor.timelineNodeId}`;
    }
    if (anchor.checkpointEpoch !== undefined) {
        return `c:${anchor.checkpointEpoch}`;
    }
    // No timeline context at all (should not happen for chronicle inputs;
    // treat as a legacy root anchor).
    return 'legacy';
}

/**
 * Compute the memoryKey.
 *
 *   memoryKey = SHA-256(identityAnchor + firstVisibleTimelineAnchor + collisionSlot)
 *
 * The collisionSlot disambiguates same-owner/same-date/same-type memories that
 * differ only by participants or snapshot ordinal within one snapshot.
 */
export function computeMemoryKey(
    identityAnchor: string,
    firstVisibleTimelineAnchor: string,
    collisionSlot: number
): string {
    const material = `${identityAnchor}\u0001${firstVisibleTimelineAnchor}\u0001${collisionSlot}`;
    return crypto.createHash('sha256').update(material, 'utf8').digest('hex');
}

/**
 * Compute the render hash of a memory description. Used to detect whether the
 * dynamic text has changed between observations, without storing the new text.
 */
export function computeRenderedDescriptionHash(description: string): string {
    return crypto.createHash('sha256').update(description, 'utf8').digest('hex');
}

/**
 * Short prefix of the render hash, for safe logging that does not leak the
 * full description (the hash itself is one-way, but a short prefix is enough
 * for correlation in logs and is less identifying).
 */
export function shortRenderHashPrefix(description: string, length = 8): string {
    return computeRenderedDescriptionHash(description).slice(0, length);
}
