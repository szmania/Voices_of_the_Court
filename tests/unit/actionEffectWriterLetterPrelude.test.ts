/**
 * Unit tests for ActionEffectWriter.composeLetterScopePrelude scoping.
 *
 * CK3 throws "Scoped object is not valid" when set_global_variable runs at the
 * top level of a run file without a character scope. The prelude must wrap the
 * votcce_action_source / votcce_action_target assignments inside root = { ... }
 * (the player character scope the letters_runner executes the file under).
 */
import { ActionEffectWriter } from '../../src/main/conversation/ActionEffectWriter';

describe('ActionEffectWriter.composeLetterScopePrelude', () => {
    const playerId = 100;
    const otherId = 200;

    test('wraps votcce_action_source/target assignments in a root scope block', () => {
        const prelude = ActionEffectWriter.composeLetterScopePrelude(playerId, otherId, playerId, 'letter_1');

        // The two derived assignments must be inside a root = { ... } block, not
        // at the top level of the run file.
        const rootBlocks = prelude.match(/^root = \{$/gm) ?? [];
        expect(rootBlocks.length).toBe(2); // one for message_first_scope, one for the derived pair

        // No set_global_variable may sit at the top level (column 0) of the file.
        const topLevelSet = prelude.split('\n').filter(line => /^set_global_variable/.test(line));
        expect(topLevelSet).toEqual([]);

        // The derived pair block contains both assignments with the right values.
        const lastRootBlock = prelude.slice(prelude.lastIndexOf('root = {'));
        expect(lastRootBlock).toContain('name = votcce_action_source');
        expect(lastRootBlock).toContain('value = global_var:message_first_scope');
        expect(lastRootBlock).toContain('name = votcce_action_target');
        expect(lastRootBlock).toContain('value = global_var:message_second_scope_letter_1');
    });

    test('keeps the message scope assignments scoped as well', () => {
        const prelude = ActionEffectWriter.composeLetterScopePrelude(otherId, playerId, playerId, 'letter_2');

        expect(prelude).toContain('character:200 = {');
        expect(prelude).toContain('name = message_second_scope_letter_2');
        expect(prelude).toContain('name = message_first_scope');

        const topLevelSet = prelude.split('\n').filter(line => /^set_global_variable/.test(line));
        expect(topLevelSet).toEqual([]);
    });

    test('braces balance across the whole prelude', () => {
        const prelude = ActionEffectWriter.composeLetterScopePrelude(playerId, otherId, playerId, 'letter_3');
        const opens = (prelude.match(/\{/g) ?? []).length;
        const closes = (prelude.match(/\}/g) ?? []).length;
        expect(opens).toBe(closes);
    });
});