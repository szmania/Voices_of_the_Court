/**
 * VOTC-194 hotfix section 8.1.2 (Fix A regression tests).
 *
 * validateMemory previously REQUIRED participantIds (reqArray) and
 * identityComplete (reqBoolean) on every snapshot memory, but the shared
 * Memory type declares both optional and the only producer (parseLog's
 * parseMemory) never writes either. Any character with at least one
 * log-parsed memory therefore failed validateCharacterSnapshotV1, which
 * broke the incoming-letter history capture and hid letters from the
 * Letters tab. These tests pin the fixed contract:
 *   - a memory omitting both fields validates (the production regression);
 *   - malformed values, when present, still fail with the precise path.
 */
import { validateCharacterSnapshotV1, PromptWorkbenchValidationError } from '../../../src/main/promptWorkbench/promptWorkbenchSchemas';
import type { CharacterSnapshotV1 } from '../../../src/main/promptWorkbench/promptWorkbenchTypes';
import type { Memory } from '../../../src/shared/gameData/GameData';

/** Minimal valid memory: exactly what parseLog.parseMemory produces. */
function makeMemory(overrides: Partial<Memory> = {}): Memory {
    return {
        type: 'relationship',
        creationDate: '1066.1.1',
        desc: 'A remembered conversation.',
        relevanceWeight: 5,
        ...overrides
    };
}

/**
 * Factory for a valid CharacterSnapshotV1. Field set mirrors
 * characterToSnapshot output for a freshly parsed character: every required
 * scalar present, every collection empty except the configurable memory.
 */
function makeValidCharacterSnapshot(memory: Memory): CharacterSnapshotV1 {
    return {
        id: 1001,
        shortName: 'Player',
        fullName: 'Player FullName',
        firstName: 'Player',
        primaryTitle: 'Count of Somewhere',
        titleRankConcept: 'count',
        sheHe: 'he',
        age: 30,
        gold: 10,
        opinionOfPlayer: 0,
        sexuality: 'heterosexual',
        personality: 'Calm',
        greed: 0,
        isIndependentRuler: false,
        isRuler: true,
        isLandedRuler: true,
        isKnight: false,
        prowess: 5,
        liege: 'none',
        topLiege: 'none',
        consort: 'none',
        culture: 'French',
        faith: 'Catholic',
        house: 'house',
        capitalLocation: 'Paris',
        liegeRealmLaw: 'none',
        heldCourtAndCouncilPositions: 'none',
        secrets: [],
        ownedSecrets: [],
        knownSecrets: [],
        ownedSchemes: [],
        exposedTargetingSchemes: [],
        memories: [memory],
        traits: [],
        relationsToPlayer: [],
        relationsToCharacters: [],
        opinionBreakdownToPlayer: [],
        opinions: []
    };
}

function expectValidationError(snapshot: CharacterSnapshotV1, pathFragment: string): void {
    let caught: unknown;
    try {
        validateCharacterSnapshotV1(snapshot);
    } catch (error) {
        caught = error;
    }
    expect(caught).toBeInstanceOf(PromptWorkbenchValidationError);
    const validationError = caught as PromptWorkbenchValidationError;
    expect(validationError.path).toContain(pathFragment);
}

describe('validateCharacterSnapshotV1 memory fields (VOTC-194 hotfix 8.1.2)', () => {
    it('validates a memory that omits participantIds and identityComplete (production regression)', () => {
        // This is the exact shape parseLog.parseMemory produces and the shape
        // that failed in production before Fix A.
        const snapshot = makeValidCharacterSnapshot(makeMemory());
        const validated = validateCharacterSnapshotV1(snapshot);
        expect(validated.memories).toHaveLength(1);
        expect(validated.memories[0].participantIds).toBeUndefined();
        expect(validated.memories[0].identityComplete).toBeUndefined();
    });

    it('validates a memory that carries well-formed participantIds and identityComplete', () => {
        const snapshot = makeValidCharacterSnapshot(makeMemory({
            participantIds: [1001, 2002],
            identityComplete: true
        }));
        const validated = validateCharacterSnapshotV1(snapshot);
        expect(validated.memories[0].participantIds).toEqual([1001, 2002]);
        expect(validated.memories[0].identityComplete).toBe(true);
    });

    it('rejects a memory whose participantIds is not an array', () => {
        const snapshot = makeValidCharacterSnapshot(makeMemory({
            participantIds: 'x' as unknown as number[]
        }));
        expectValidationError(snapshot, 'memories[0].participantIds');
    });

    it('rejects a memory with a non-finite participant id', () => {
        const snapshot = makeValidCharacterSnapshot(makeMemory({
            participantIds: ['abc' as unknown as number]
        }));
        expectValidationError(snapshot, 'memories[0].participantIds[0]');
    });

    it('rejects a memory whose identityComplete is not a boolean', () => {
        const snapshot = makeValidCharacterSnapshot(makeMemory({
            identityComplete: 'yes' as unknown as boolean
        }));
        expectValidationError(snapshot, 'memories[0].identityComplete');
    });
});