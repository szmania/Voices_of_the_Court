/**
 * Tests for the gameData.localize injection used by the pList* description
 * scripts (VOTC-194 hotfix: "gameData.localize is not a function").
 *
 * The letter flows (LetterReplyGenerator / IncomingLetterGenerator) call the
 * user-editable pListLetter.js script with the raw GameData, which has no
 * localize member. The shared helper attaches a temporary localizer (plus the
 * matching `lang`) around the script call and removes both afterwards.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('electron', () => ({ app: { getPath: jest.fn(() => os.tmpdir()), getAppPath: jest.fn(() => process.cwd()) } }));

import { createGameDataLocalizer, getTranslations, withGameDataLocalize } from '../../../src/main/conversation/gameDataLocalize';
import type { GameData } from '../../../src/shared/gameData/GameData';

// The real pListLetter.js is user-editable runtime content; load it from the
// default_userdata copy so the test exercises the actual script contract.
const pListLetter = require('../../../default_userdata/scripts/prompts/description/standard/pListLetter.js');

/**
 * Minimal fake gameData satisfying the fields pListLetter reads. The script
 * only needs player/ai characters, date, and the characters map.
 */
function makeFakeGameData(): any {
    const player = {
        id: 1001, firstName: 'Alice', shortName: 'Alice', fullName: 'Alice of Test',
        faith: 'Catholic', culture: 'French', age: 30, gold: 500, prowess: 10,
        traits: [], relationsToPlayer: [], relationsToCharacters: [], opinionOfPlayer: 0,
        opinionBreakdownToPlayer: [], sheHe: 'she', greed: 0
    };
    const ai = {
        id: 2002, firstName: 'Bob', shortName: 'Bob', fullName: 'Bob of Test',
        faith: 'Catholic', culture: 'French', age: 40, gold: 100, prowess: 12,
        traits: [], relationsToPlayer: [], relationsToCharacters: [], opinionOfPlayer: 10,
        opinionBreakdownToPlayer: [], sheHe: 'he', greed: 0
    };
    const characters = new Map<number, any>([[1001, player], [2002, ai]]);
    return {
        playerID: 1001,
        aiID: 2002,
        playerName: 'Alice',
        date: '1066.1.1',
        characters,
        getOtherCharacters: () => []
    } as unknown as GameData;
}

/**
 * Writes a locale file into a temp dir and points the mocked electron
 * getAppPath at it, so getTranslations resolves a controlled table.
 */
function installLocale(localeDir: string, lang: string, table: any): void {
    const localesDir = path.join(localeDir, 'public', 'locales');
    fs.mkdirSync(localesDir, { recursive: true });
    fs.writeFileSync(path.join(localesDir, `${lang}.json`), JSON.stringify(table), 'utf8');
}

describe('withGameDataLocalize + pListLetter', () => {
    let localeDir: string;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        localeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-locale-'));
        const electron = require('electron');
        (electron.app.getAppPath as jest.Mock).mockReturnValue(localeDir);
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        warnSpy.mockRestore();
        fs.rmSync(localeDir, { recursive: true, force: true });
    });

    test('renders localized labels when the helper is attached', () => {
        installLocale(localeDir, 'en', {
            name: 'Name',
            faith: 'Faith',
            culture: 'Culture',
            s_persona_user: "'s persona (user)",
            s_persona: "'s persona",
            letter_issue_date: 'Letter issued on',
            has_no_relation_to: 'has no relation to {{playerShortName}}',
            opinion_neutral: '{{charShortName}} is neutral toward {{playerShortName}}',
            years_old: 'years old',
            personality_trait_category: 'Personality Trait'
        });

        const gameData = makeFakeGameData();
        const output = withGameDataLocalize(gameData, 'en', () => pListLetter(gameData)) as string;

        // Localized values appear instead of raw keys...
        expect(output).toContain('Name: Alice');
        expect(output).toContain('Faith: Catholic');
        expect(output).toContain("Alice's persona (user)");
        expect(output).toContain("Bob's persona");
        expect(output).toContain('Letter issued on(1066.1.1)');
        // ...and the {{var}} substitution ran.
        expect(output).toContain('has no relation to Alice');
        expect(output).toContain('Bob is neutral toward Alice');
        // No raw keys leaked into the output.
        expect(output).not.toContain('s_persona_user');
        expect(output).not.toContain('letter_issue_date');
        // The warning must never fire when the helper is attached.
        expect(warnSpy).not.toHaveBeenCalledWith('gameData.localize is not a function. Falling back to key.');
    });

    test('cleans up localize and lang after the call', () => {
        installLocale(localeDir, 'en', { name: 'Name' });
        const gameData = makeFakeGameData();

        withGameDataLocalize(gameData, 'en', () => pListLetter(gameData));

        expect((gameData as any).localize).toBeUndefined();
        expect('localize' in (gameData as any)).toBe(false);
        expect((gameData as any).lang).toBeUndefined();
        expect('lang' in (gameData as any)).toBe(false);
    });

    test('restores pre-existing localize/lang values after the call', () => {
        installLocale(localeDir, 'en', { name: 'Name' });
        const gameData = makeFakeGameData();
        const preexistingLocalize = () => 'preexisting';
        (gameData as any).localize = preexistingLocalize;
        (gameData as any).lang = 'fr';

        withGameDataLocalize(gameData, 'en', () => 'unused');

        expect((gameData as any).localize).toBe(preexistingLocalize);
        expect((gameData as any).lang).toBe('fr');
    });

    test('raw gameData (no localize) still renders with raw keys - defensive contract', () => {
        // Documents the script's own fallback: without the helper the script
        // warns and emits raw keys, but never crashes.
        const gameData = makeFakeGameData();
        const output = pListLetter(gameData) as string;

        expect(typeof output).toBe('string');
        expect(output).toContain('s_persona_user'); // raw key leaked
        expect(warnSpy).toHaveBeenCalledWith('gameData.localize is not a function. Falling back to key.');
    });
});

describe('createGameDataLocalizer', () => {
    test('dot-path traversal resolves nested values', () => {
        const localize = createGameDataLocalizer({ a: { b: { c: 'deep value' } } });
        expect(localize('a.b.c', 'en', undefined)).toBe('deep value');
    });

    test('{{var}} substitution replaces all occurrences', () => {
        const localize = createGameDataLocalizer({ greeting: 'Hail {{name}}, {{name}} of {{realm}}' });
        expect(localize('greeting', 'en', { name: 'Alice', realm: 'Test' })).toBe('Hail Alice, Alice of Test');
    });

    test('missing key falls back to the raw key', () => {
        const localize = createGameDataLocalizer({ a: {} });
        expect(localize('a.missing', 'en', undefined)).toBe('a.missing');
        expect(localize('totally.missing.path', 'en', undefined)).toBe('totally.missing.path');
    });

    test('non-string leaf falls back to the raw key', () => {
        const localize = createGameDataLocalizer({ a: { number: 42, object: { x: 1 } } });
        expect(localize('a.number', 'en', undefined)).toBe('a.number');
        expect(localize('a.object', 'en', undefined)).toBe('a.object');
    });
});

describe('getTranslations', () => {
    test('loads the requested language and falls back to English', () => {
        const localeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-locale-fb-'));
        try {
            const electron = require('electron');
            (electron.app.getAppPath as jest.Mock).mockReturnValue(localeDir);
            fs.mkdirSync(path.join(localeDir, 'public', 'locales'), { recursive: true });
            fs.writeFileSync(path.join(localeDir, 'public', 'locales', 'en.json'), JSON.stringify({ name: 'Name' }), 'utf8');

            // Missing language falls back to en.json.
            expect(getTranslations('zz')).toEqual({ name: 'Name' });
            // Existing language loads directly.
            fs.writeFileSync(path.join(localeDir, 'public', 'locales', 'fr.json'), JSON.stringify({ name: 'Nom' }), 'utf8');
            expect(getTranslations('fr')).toEqual({ name: 'Nom' });
        } finally {
            fs.rmSync(localeDir, { recursive: true, force: true });
        }
    });
});