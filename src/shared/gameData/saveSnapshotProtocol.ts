import {
    INIT_DATE_EXTRA_START_INDEX,
    INIT_DATE_EXTRA_FIELD_COUNT
} from './timelineProtocol';

export const SAVE_SNAPSHOT_PROTOCOL_VERSION = 1;

// Init save snapshot tail layout. Core fields occupy indices 0-14, the timeline
// protocol tail 15-22 and the date extras 23-27. The 3-field save snapshot
// extra block starts at index 28 and is appended after the date extras.
export const INIT_SAVE_SNAPSHOT_EXTRA_START_INDEX = INIT_DATE_EXTRA_START_INDEX + INIT_DATE_EXTRA_FIELD_COUNT;
export const INIT_SAVE_SNAPSHOT_EXTRA_FIELD_COUNT = 3;

export const SAVE_SNAPSHOT_MIN_SLOT = 0;
export const SAVE_SNAPSHOT_MAX_SLOT = 1;

// Largest sequence value the app accepts. The mod wraps back to 1 (never 0)
// before reaching its own CK3-safe limit; the app only requires a positive
// safe integer.
export const SAVE_SNAPSHOT_MAX_SEQUENCE = Number.MAX_SAFE_INTEGER;

// Fixed snapshot file name written next to the CK3 save directory. The
// double-buffer alternates between the slot-suffixed names; whether the
// double buffer ships is still pending Task 0 on-device confirmation, so the
// first release only uses the fixed name (slot 0).
export const SAVE_SNAPSHOT_FIXED_FILE_NAME = 'votc_context.ck3';
export const SAVE_SNAPSHOT_SLOT_FILE_NAMES = ['votc_context_0.ck3', 'votc_context_1.ck3'] as const;

export type SaveSnapshotExtraParseResult =
    | { status: 'available'; protocolVersion: 1; sequence: number; slot: 0 | 1 }
    | { status: 'disabled' }
    | { status: 'legacy' }
    | { status: 'unsupported'; protocolVersion: number }
    | { status: 'truncated'; expected: number; actual: number }
    | { status: 'invalid'; reason: string };

function normalize(raw: string | undefined): string | undefined {
    if (raw === undefined) return undefined;
    const trimmed = raw.trim();
    return trimmed === '' ? undefined : trimmed;
}

function parseNonNegativeInteger(raw: string | undefined, label: string): { ok: true; value: number } | { ok: false; reason: string } {
    const value = normalize(raw);
    const parsed = Number(value);
    if (value === undefined || !Number.isInteger(parsed) || parsed < 0) {
        return { ok: false, reason: `${label} is not a non-negative integer: "${raw}"` };
    }
    return { ok: true, value: parsed };
}

export function parseSaveSnapshotExtra(fields: readonly string[]): SaveSnapshotExtraParseResult {
    const input = fields ?? [];
    if (input.length <= INIT_SAVE_SNAPSHOT_EXTRA_START_INDEX) {
        return { status: 'legacy' };
    }
    if (input.length < INIT_SAVE_SNAPSHOT_EXTRA_START_INDEX + INIT_SAVE_SNAPSHOT_EXTRA_FIELD_COUNT) {
        return {
            status: 'truncated',
            expected: INIT_SAVE_SNAPSHOT_EXTRA_START_INDEX + INIT_SAVE_SNAPSHOT_EXTRA_FIELD_COUNT,
            actual: input.length
        };
    }

    const at = (index: number): string | undefined => input[index];
    const protocolRaw = at(INIT_SAVE_SNAPSHOT_EXTRA_START_INDEX);
    const sequenceRaw = at(INIT_SAVE_SNAPSHOT_EXTRA_START_INDEX + 1);
    const slotRaw = at(INIT_SAVE_SNAPSHOT_EXTRA_START_INDEX + 2);

    const protocol = parseNonNegativeInteger(protocolRaw, 'save snapshot protocol version');
    if (!protocol.ok) return { status: 'invalid', reason: protocol.reason };
    const sequence = parseNonNegativeInteger(sequenceRaw, 'save snapshot sequence');
    if (!sequence.ok) return { status: 'invalid', reason: sequence.reason };
    const slot = parseNonNegativeInteger(slotRaw, 'save snapshot slot');
    if (!slot.ok) return { status: 'invalid', reason: slot.reason };

    if (protocol.value === 0) {
        // Snapshot capture is off for this save; the whole tail must read 0/0/0.
        if (sequence.value !== 0 || slot.value !== 0) {
            return { status: 'invalid', reason: `save snapshot disabled tail must be 0/0/0, got sequence=${sequenceRaw}, slot=${slotRaw}` };
        }
        return { status: 'disabled' };
    }

    if (protocol.value !== SAVE_SNAPSHOT_PROTOCOL_VERSION) {
        return { status: 'unsupported', protocolVersion: protocol.value };
    }

    if (sequence.value === 0) {
        return { status: 'invalid', reason: `save snapshot sequence must be a positive integer when the protocol is enabled: "${sequenceRaw}"` };
    }
    if (!Number.isSafeInteger(sequence.value) || sequence.value > SAVE_SNAPSHOT_MAX_SEQUENCE) {
        return { status: 'invalid', reason: `save snapshot sequence exceeds the supported range: "${sequenceRaw}"` };
    }

    if (slot.value < SAVE_SNAPSHOT_MIN_SLOT || slot.value > SAVE_SNAPSHOT_MAX_SLOT) {
        return { status: 'invalid', reason: `save snapshot slot must be ${SAVE_SNAPSHOT_MIN_SLOT} or ${SAVE_SNAPSHOT_MAX_SLOT}: "${slotRaw}"` };
    }

    return {
        status: 'available',
        protocolVersion: SAVE_SNAPSHOT_PROTOCOL_VERSION,
        sequence: sequence.value,
        slot: slot.value as 0 | 1
    };
}
