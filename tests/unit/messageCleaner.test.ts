/**
 * VOTC-190: Unit tests for stripAsterisks() in src/main/conversation/messageCleaner.ts
 *
 * Implements the unit matrix TC-190-U1..U10 from .cecli.plans.md Section 10/11.
 * stripAsterisks and cleanMessageContent are pure functions - no mocks required.
 *
 * Conventions follow tests/votc146.test.ts: console spies to silence log noise,
 * Arrange/Act/Assert style. Skip linting for test files per project rules.
 */
import { stripAsterisks, cleanMessageContent } from '../../src/main/conversation/messageCleaner';

describe('VOTC-190: stripAsterisks unit matrix', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    // Fixture data table (plan item 10.4): the exact input -> expected-output
    // matrix from Section 10 re-runs on every future change to the cleaner.
    // U9 is built with Unicode escapes (two CJK ideographs + *action* + two CJK
    // ideographs) so the file stays ASCII-safe.
    const matrix: Array<{ id: string; input: string; expected: string; notes: string }> = [
        { id: 'U1', input: '*waves*', expected: 'waves', notes: 'paired emphasis' },
        { id: 'U2', input: '**bold**', expected: 'bold', notes: '** runs collapse' },
        { id: 'U3', input: 'don*t know *why*', expected: 'don t know why', notes: 'mid-word artifact; never glues' },
        { id: 'U4', input: '*waves* and*smiles*', expected: 'waves and smiles', notes: 'adjacent runs' },
        { id: 'U5', input: '***', expected: '', notes: 'asterisk-only input trims to empty' },
        { id: 'U6', input: '*waves*\n*smiles*', expected: 'waves \n smiles', notes: 'newline preserved; single interior boundary spaces are accepted spec behavior of the space-replacement design' },
        { id: 'U7', input: 'hello world', expected: 'hello world', notes: 'no-asterisk passthrough' },
        { id: 'U8', input: '', expected: '', notes: 'empty string; never throws' },
        { id: 'U8b', input: '   ', expected: '', notes: 'whitespace-only; never throws' },
        { id: 'U9', input: '\u4f60\u597d*action*\u518d\u89c1', expected: '\u4f60\u597d action \u518d\u89c1', notes: 'CJK/Unicode: one space introduced between ideograph runs; words never glued (accepted trade-off per Phase 2)' },
    ];

    it.each(matrix)('$id: $notes', ({ input, expected }) => {
        // Act
        const result = stripAsterisks(input);

        // Assert: exact expected output from the plan matrix
        expect(result).toBe(expected);
        // Global invariant: no asterisk ever survives the strip
        expect(result).not.toContain('*');
    });

    it('U10: idempotency property - strip(strip(x)) === strip(x) for U1-U4 inputs', () => {
        // Arrange: the paired/unpaired/run inputs from the matrix
        const inputs = ['*waves*', '**bold**', 'don*t know *why*', '*waves* and*smiles*'];

        for (const input of inputs) {
            // Act
            const once = stripAsterisks(input);
            const twice = stripAsterisks(once);

            // Assert: stripping an already-stripped string changes nothing
            expect(twice).toBe(once);
        }
    });

    it('U10b: idempotency property holds for every matrix row', () => {
        for (const { input } of matrix) {
            const once = stripAsterisks(input);
            expect(stripAsterisks(once)).toBe(once);
        }
    });

    it('U11: multiline paragraph structure is preserved (no newlines collapsed)', () => {
        // Arrange: multi-paragraph shape with asterisk runs at boundaries
        const input = '*waves*\n\nand then\n*smiles*';

        // Act
        const result = stripAsterisks(input);

        // Assert: paragraph break (double newline) survives the strip;
        // interior boundary spaces after 'waves' and before 'smiles' are the
        // same accepted spec behavior as U6 (space-replacement design).
        expect(result).toBe('waves \n\nand then\n smiles');
        expect(result).not.toContain('*');
    });
});

describe('VOTC-190: cleanMessageContent baseline (TC-190-R2 interplay guard)', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('removes bracketed text like [laughs] and trims', () => {
        // Act
        const result = cleanMessageContent('[laughs] Hello there!');

        // Assert
        expect(result).toBe('Hello there!');
    });

    it('removes emojis', () => {
        // Act
        const result = cleanMessageContent('Hello \u{1F600} world');

        // Assert
        expect(result).toBe('Hello  world');
    });

    it('does NOT touch asterisks - that is stripAsterisks\' job (separation of concerns)', () => {
        // Act
        const result = cleanMessageContent('*waves* hello');

        // Assert: cleanMessageContent leaves asterisks alone; the pipeline
        // order in Conversation.ts is cleanMessageContent -> stripAsterisks.
        expect(result).toBe('*waves* hello');
    });
});