import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { GameData } from '../../shared/gameData/GameData.js';

/**
 * Loads the UI locale table for a language, falling back to English.
 *
 * The pList* description scripts under
 * default_userdata/scripts/prompts/description/standard/ resolve their labels
 * through gameData.localize(key, lang, vars), so every caller that runs one of
 * those scripts needs the same locale table the conversation flow uses.
 */
export function getTranslations(lang: string): any {
    const localePath = path.join(app.getAppPath(), 'public', 'locales', `${lang}.json`);
    try {
        if (fs.existsSync(localePath)) {
            return JSON.parse(fs.readFileSync(localePath, 'utf-8'));
        }
    } catch (error) {
        console.error(`Error reading locale file for ${lang}:`, error);
    }
    // Fallback to English
    const fallbackLocalePath = path.join(app.getAppPath(), 'public', 'locales', `en.json`);
    return JSON.parse(fs.readFileSync(fallbackLocalePath, 'utf-8'));
}

/**
 * Builds the localizer the description scripts call as
 * gameData.localize(key, lang, vars). Dot-path traversal over the locale table,
 * {{var}} substitution, and a fallback to the raw key when the path is missing
 * or does not resolve to a string.
 *
 * The `lang` argument the scripts pass is intentionally ignored: the table is
 * already the one for the requested language, matching the conversation flow.
 */
export function createGameDataLocalizer(translations: any): (key: string, lang: string, vars: any) => string {
    return (key: string, _lang: string, vars: any): string => {
        const keys = key.split('.');
        let result = translations;
        for (const k of keys) {
            if (result === undefined || result === null) {
                return key; // fallback to key if path is invalid
            }
            result = result[k];
        }

        if (typeof result === 'string') {
            if (vars) {
                for (const varKey in vars) {
                    result = result.replace(new RegExp(`{{${varKey}}}`, 'g'), vars[varKey]);
                }
            }
            return result;
        }

        return key; // fallback to key if not a string
    };
}

/**
 * Runs `fn` with a temporary localize function (and matching `lang`) attached to
 * gameData, then restores both properties.
 *
 * Why this exists: the pList* description scripts call
 * gameData.localize(key, lang, vars) for every label they emit. The
 * conversation flow injects that function in promptBuilder.ts before calling a
 * description script, but the letter flows (LetterReplyGenerator,
 * IncomingLetterGenerator) call the same scripts with the raw GameData, which
 * has no localize member - so every label fell back to its raw loc key and the
 * log filled with "gameData.localize is not a function. Falling back to key."
 *
 * Attaching and then removing the properties on the shared gameData object is
 * exactly what the conversation flow already does; GameData itself is left
 * untouched because the shared layer must not read main-process app paths.
 */
export function withGameDataLocalize<T>(gameData: GameData, lang: string, fn: () => T): T {
    const target = gameData as any;
    const hadLocalize = 'localize' in target;
    const previousLocalize = target.localize;
    const hadLang = 'lang' in target;
    const previousLang = target.lang;

    // Same resilience as the conversation flow (promptBuilder.ts attaches
    // localize only when translations loaded): if the locale table cannot be
    // read, run the script without it - the pList* scripts fall back to raw
    // keys on their own, and letter generation must never crash over a
    // missing locale file.
    let translations: any;
    try {
        translations = getTranslations(lang);
    } catch (error) {
        console.warn(`Could not load locale table for '${lang}'; description labels will fall back to raw keys.`, error);
    }

    target.lang = lang;
    if (translations) {
        target.localize = createGameDataLocalizer(translations);
    }

    try {
        return fn();
    } finally {
        if (hadLocalize) {
            target.localize = previousLocalize;
        } else {
            delete target.localize;
        }
        if (hadLang) {
            target.lang = previousLang;
        } else {
            delete target.lang;
        }
    }
}