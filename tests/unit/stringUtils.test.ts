import { escapeRegExp } from '../../src/shared/stringUtils';

describe('escapeRegExp', () => {
    it('leaves plain text unchanged', () => {
        expect(escapeRegExp('Crusader Kings III')).toBe('Crusader Kings III');
    });

    it.each([
        'a.b',
        'a+b',
        'a?b',
        'a*b',
        'a^b',
        'a$b',
        'a|b',
        '(a)',
        '[a]',
        '{a}',
        'a\\b',
    ])('escapes %s so it matches literally', (value) => {
        const regex = new RegExp(escapeRegExp(value), 'g');
        expect(`${value} ${value}`.match(regex)).toHaveLength(2);
    });

    it('does not treat a user-entered bracket as a character class', () => {
        const regex = new RegExp(escapeRegExp('[abc]'), 'g');
        expect('text [abc] text'.match(regex)).toEqual(['[abc]']);
    });
});
