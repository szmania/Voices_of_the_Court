import {
    normalizeMemoryTypeToken,
    canonicalParticipantIds,
    computeIdentityAnchor,
    computeMemoryKey,
    resolveFirstVisibleTimelineAnchor,
    computeRenderedDescriptionHash,
    shortRenderHashPrefix
} from '../../src/main/chronicle/chronicleMemoryIdentity';

describe('normalizeMemoryTypeToken', () => {
    it('trims surrounding whitespace', () => {
        expect(normalizeMemoryTypeToken('  hello  ')).toBe('hello');
    });

    it('collapses internal whitespace runs', () => {
        expect(normalizeMemoryTypeToken('a   b\tc')).toBe('a b c');
    });

    it('returns empty string for undefined', () => {
        expect(normalizeMemoryTypeToken(undefined)).toBe('');
    });

    it('does not lowercase (case-sensitive localization keys)', () => {
        expect(normalizeMemoryTypeToken('FooBar')).toBe('FooBar');
    });
});

describe('canonicalParticipantIds', () => {
    it('sorts and deduplicates participant IDs', () => {
        expect(canonicalParticipantIds([3, 1, 2, 1, 3])).toEqual(['1', '2', '3']);
    });

    it('accepts string IDs', () => {
        expect(canonicalParticipantIds(['b', 'a', 'b'])).toEqual(['a', 'b']);
    });

    it('mixes numbers and strings, deduping by string value', () => {
        expect(canonicalParticipantIds([10, '10', '2'])).toEqual(['10', '2']);
    });

    it('drops empty strings', () => {
        expect(canonicalParticipantIds(['', '  ', 'a'])).toEqual(['a']);
    });

    it('returns empty array for no participants (legal)', () => {
        expect(canonicalParticipantIds([])).toEqual([]);
    });
});

describe('computeIdentityAnchor', () => {
    const baseParams = {
        ownerId: '121441',
        creationTotalDays: 349638,
        tokenSource: 'localized_name',
        memoryTypeToken: '姑姨死亡',
        participantIds: [99247]
    } as const;

    it('is stable for identical inputs', () => {
        const a = computeIdentityAnchor(baseParams);
        const b = computeIdentityAnchor(baseParams);
        expect(a).toBe(b);
        expect(a).toHaveLength(64); // SHA-256 hex
    });

    it('changes when ownerId changes', () => {
        const a = computeIdentityAnchor(baseParams);
        const b = computeIdentityAnchor({ ...baseParams, ownerId: '99999' });
        expect(a).not.toBe(b);
    });

    it('changes when creationTotalDays changes', () => {
        const a = computeIdentityAnchor(baseParams);
        const b = computeIdentityAnchor({ ...baseParams, creationTotalDays: 349639 });
        expect(a).not.toBe(b);
    });

    it('changes when tokenSource changes (raw_type vs localized_name)', () => {
        const a = computeIdentityAnchor(baseParams);
        const b = computeIdentityAnchor({ ...baseParams, tokenSource: 'raw_type' });
        expect(a).not.toBe(b);
    });

    it('changes when memoryTypeToken changes', () => {
        const a = computeIdentityAnchor(baseParams);
        const b = computeIdentityAnchor({ ...baseParams, memoryTypeToken: '成了朋友' });
        expect(a).not.toBe(b);
    });

    it('changes when participant set changes', () => {
        const a = computeIdentityAnchor(baseParams);
        const b = computeMemoryKey2Participants();
        expect(a).not.toBe(b);
        function computeMemoryKey2Participants() {
            return computeIdentityAnchor({ ...baseParams, participantIds: [99247, 16898479] });
        }
    });

    it('ignores participant order and duplicates', () => {
        const a = computeIdentityAnchor({ ...baseParams, participantIds: [99247, 16898479] });
        const b = computeIdentityAnchor({ ...baseParams, participantIds: [16898479, 99247, 99247] });
        expect(a).toBe(b);
    });

    it('falls back to creationDateDisplay when totalDays is missing', () => {
        const withTotalDays = computeIdentityAnchor({ ...baseParams });
        const withDisplay = computeIdentityAnchor({
            ...baseParams,
            creationTotalDays: undefined,
            creationDateDisplay: '957.11.29'
        });
        // Different key material -> different anchor.
        expect(withTotalDays).not.toBe(withDisplay);
        // Stable.
        expect(computeIdentityAnchor({
            ...baseParams,
            creationTotalDays: undefined,
            creationDateDisplay: '957.11.29'
        })).toBe(withDisplay);
    });

    it('is NOT affected by description (dynamic text)', () => {
        // description is not a parameter at all; identity never sees it.
        const a = computeIdentityAnchor(baseParams);
        // Re-compute with same params: description never enters the hash.
        const b = computeIdentityAnchor(baseParams);
        expect(a).toBe(b);
    });

    it('throws on empty ownerId', () => {
        expect(() => computeIdentityAnchor({ ...baseParams, ownerId: '' })).toThrow();
    });

    it('produces same anchor for same token with different surrounding whitespace', () => {
        const a = computeIdentityAnchor({ ...baseParams, memoryTypeToken: '姑姨死亡' });
        const b = computeIdentityAnchor({ ...baseParams, memoryTypeToken: '  姑姨死亡  ' });
        expect(a).toBe(b);
    });
});

describe('computeMemoryKey', () => {
    it('is stable for identical inputs', () => {
        const a = computeMemoryKey('anchor-abc', 'n:1-1', 0);
        const b = computeMemoryKey('anchor-abc', 'n:1-1', 0);
        expect(a).toBe(b);
        expect(a).toHaveLength(64);
    });

    it('changes when identityAnchor changes', () => {
        expect(computeMemoryKey('a', 'n:1-1', 0)).not.toBe(computeMemoryKey('b', 'n:1-1', 0));
    });

    it('changes when timeline anchor changes', () => {
        expect(computeMemoryKey('a', 'n:1-1', 0)).not.toBe(computeMemoryKey('a', 'n:2-2', 0));
    });

    it('changes when collisionSlot changes', () => {
        expect(computeMemoryKey('a', 'n:1-1', 0)).not.toBe(computeMemoryKey('a', 'n:1-1', 1));
    });
});

describe('resolveFirstVisibleTimelineAnchor', () => {
    it('prefers timeline node id', () => {
        expect(resolveFirstVisibleTimelineAnchor({
            timelineNodeId: '1-1',
            checkpointEpoch: 5
        })).toBe('n:1-1');
    });

    it('falls back to checkpoint epoch when node is absent', () => {
        expect(resolveFirstVisibleTimelineAnchor({
            timelineNodeId: undefined,
            checkpointEpoch: 5
        })).toBe('c:5');
    });

    it('falls back to legacy when neither is present', () => {
        expect(resolveFirstVisibleTimelineAnchor({})).toBe('legacy');
    });

    it('ignores empty timeline node id', () => {
        expect(resolveFirstVisibleTimelineAnchor({
            timelineNodeId: '',
            checkpointEpoch: 3
        })).toBe('c:3');
    });
});

describe('computeRenderedDescriptionHash / shortRenderHashPrefix', () => {
    it('produces a stable SHA-256 hex', () => {
        const h = computeRenderedDescriptionHash('hello');
        expect(h).toHaveLength(64);
        expect(h).toBe(computeRenderedDescriptionHash('hello'));
    });

    it('changes when the description changes (dynamic text detection)', () => {
        expect(computeRenderedDescriptionHash('唐皇帝李某'))
            .not.toBe(computeRenderedDescriptionHash('乡绅李某'));
    });

    it('shortRenderHashPrefix returns the first N hex chars', () => {
        const full = computeRenderedDescriptionHash('hello');
        expect(shortRenderHashPrefix('hello', 8)).toBe(full.slice(0, 8));
        expect(shortRenderHashPrefix('hello', 12)).toBe(full.slice(0, 12));
    });
});
