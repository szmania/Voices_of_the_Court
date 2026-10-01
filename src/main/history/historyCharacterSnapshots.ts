import type { Character } from '../../shared/gameData/Character.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import { characterToSnapshot } from '../promptWorkbench/GameDataSnapshotCodec.js';
import { logicalRequestHash } from '../promptWorkbench/canonicalJson.js';
import { validateCharacterSnapshotV1 } from '../promptWorkbench/promptWorkbenchSchemas.js';
import {
    HISTORY_CHARACTER_ROLES,
    type HistoryCharacterRole,
    type HistoryCharacterSnapshotV1
} from './historyRecordTypes.js';

/**
 * Single capture entry point for history character snapshots (plan section
 * 6.2 / task T2). All history writers must build their character snapshots
 * through this module instead of calling characterToSnapshot() directly, so
 * dedup, role merging, hashing and status semantics stay identical everywhere.
 */

export interface HistoryCharacterCandidate {
    /** CK3 character id in string form, or null when only a name is known. */
    characterId: string | null;
    displayName: string;
    roles: HistoryCharacterRole[];
    /** Full character object loaded in the current GameData, if available. */
    character?: Character | null;
    capturedAt: string;
    capturedGameDate?: Ck3GameDate;
    /**
     * - `required_full`: the record is invalid without a full snapshot
     *   (player, conversation roster, letter parties).
     * - `reference_allowed`: id/name-only references are acceptable
     *   (battle report log references).
     */
    completeness: 'required_full' | 'reference_allowed';
    unavailableReason?: string;
}

export class HistoryCharacterCaptureError extends Error {
    readonly issues: string[];

    constructor(issues: string[]) {
        super(`history character capture failed: ${issues.join('; ')}`);
        this.name = 'HistoryCharacterCaptureError';
        this.issues = issues;
    }
}

interface CapturedEntry {
    ordinal: number;
    snapshot: HistoryCharacterSnapshotV1;
}

function describeCandidate(candidate: HistoryCharacterCandidate, index: number): string {
    const id = candidate.characterId ?? '<no-id>';
    return `candidates[${index}] (${id}, ${candidate.displayName})`;
}

function roleSortValue(role: HistoryCharacterRole): number {
    return HISTORY_CHARACTER_ROLES.indexOf(role);
}

function mergeRoles(a: HistoryCharacterRole[], b: HistoryCharacterRole[]): HistoryCharacterRole[] {
    return [...a, ...b]
        .filter((role, index, all) => all.indexOf(role) === index)
        .sort((x, y) => roleSortValue(x) - roleSortValue(y));
}

function compareCharacterIds(a: string, b: string): number {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
}

function captureFull(
    candidate: HistoryCharacterCandidate,
    describedAs: string
): { snapshot: HistoryCharacterSnapshotV1 } | { issue: string } {
    if (!candidate.character) {
        return { issue: `${describedAs}: required full snapshot but no character object was available` };
    }
    if (!candidate.capturedGameDate) {
        return { issue: `${describedAs}: required full snapshot but capturedGameDate was not provided` };
    }
    let snapshot;
    try {
        snapshot = validateCharacterSnapshotV1(characterToSnapshot(candidate.character), `${describedAs}.snapshot`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown validation failure';
        return { issue: `${describedAs}: snapshot validation failed (${message})` };
    }
    if (candidate.characterId !== null && snapshot.id !== Number(candidate.characterId)) {
        return {
            issue: `${describedAs}: snapshot id ${snapshot.id} does not match candidate characterId ${candidate.characterId}`
        };
    }
    return {
        snapshot: {
            schemaVersion: 1,
            characterId: candidate.characterId,
            displayName: candidate.displayName,
            roles: [...candidate.roles],
            status: 'full',
            capturedAt: candidate.capturedAt,
            capturedGameDate: candidate.capturedGameDate,
            snapshotHash: logicalRequestHash(snapshot),
            snapshot
        }
    };
}

function captureReferenceOnly(candidate: HistoryCharacterCandidate, describedAs: string): HistoryCharacterSnapshotV1 {
    if (!candidate.capturedGameDate) {
        throw new HistoryCharacterCaptureError([
            `${describedAs}: reference_only snapshot requires capturedGameDate`
        ]);
    }
    return {
        schemaVersion: 1,
        characterId: candidate.characterId,
        displayName: candidate.displayName,
        roles: [...candidate.roles],
        status: 'reference_only',
        capturedAt: candidate.capturedAt,
        capturedGameDate: candidate.capturedGameDate,
        snapshotHash: null,
        snapshot: null,
        unavailableReason: candidate.unavailableReason ?? 'character_object_unavailable'
    };
}

/**
 * Captures versioned character snapshots from the current record context.
 *
 * - Candidates sharing one non-empty characterId are merged into a single
 *   entry with united roles; entries without an id are never merged.
 * - `required_full` candidates that cannot produce a valid full snapshot make
 *   the whole capture fail with a structured error (never a lenient status).
 * - `reference_allowed` candidates degrade to `reference_only`.
 * - Output is deterministically ordered: entries with an id first (ascending
 *   numeric id), id-less entries last in input order; roles follow the fixed
 *   enum order.
 */
export function captureHistoryCharacterSnapshots(
    candidates: readonly HistoryCharacterCandidate[]
): HistoryCharacterSnapshotV1[] {
    const issues: string[] = [];
    const captured: CapturedEntry[] = [];
    const byId = new Map<string, CapturedEntry>();

    candidates.forEach((candidate, index) => {
        const describedAs = describeCandidate(candidate, index);
        let entry: CapturedEntry;

        if (candidate.character) {
            const result = captureFull(candidate, describedAs);
            if ('issue' in result) {
                if (candidate.completeness === 'required_full') {
                    issues.push(result.issue);
                    return;
                }
                entry = {
                    ordinal: index,
                    snapshot: captureReferenceOnly(candidate, describedAs)
                };
            } else {
                entry = { ordinal: index, snapshot: result.snapshot };
            }
        } else if (candidate.completeness === 'required_full') {
            issues.push(`${describedAs}: required full snapshot but no character object was available`);
            return;
        } else {
            entry = {
                ordinal: index,
                snapshot: captureReferenceOnly(candidate, describedAs)
            };
        }

        if (entry.snapshot.characterId !== null) {
            const existing = byId.get(entry.snapshot.characterId);
            if (existing) {
                existing.snapshot.roles = mergeRoles(existing.snapshot.roles, entry.snapshot.roles);
                if (
                    existing.snapshot.status === 'reference_only' &&
                    entry.snapshot.status === 'full'
                ) {
                    // A full capture supersedes a bare reference of the same character.
                    entry.snapshot.roles = existing.snapshot.roles;
                    captured[captured.indexOf(existing)] = entry;
                }
                return;
            }
            byId.set(entry.snapshot.characterId, entry);
        }
        captured.push(entry);
    });

    if (issues.length > 0) {
        throw new HistoryCharacterCaptureError(issues);
    }

    return captured
        .sort((a, b) => {
            const aId = a.snapshot.characterId;
            const bId = b.snapshot.characterId;
            if ((aId === null) !== (bId === null)) return aId === null ? 1 : -1;
            if (aId !== null && bId !== null) {
                const byIdCompare = compareCharacterIds(aId, bId);
                if (byIdCompare !== 0) return byIdCompare;
            }
            return a.ordinal - b.ordinal;
        })
        .map(entry => ({
            ...entry.snapshot,
            roles: [...entry.snapshot.roles].sort((x, y) => roleSortValue(x) - roleSortValue(y))
        }));
}
