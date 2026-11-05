import * as fs from "fs";
import * as path from "path";

// Per-locale incoming-letter prompt data, externalized from the hardcoded
// Chinese strings that used to live in IncomingLetterGenerator.ts.
// Files live at <votcDataPath>/configs/prompts/incoming_letters/<locale>.json
// and are synced to user data by userDataCheck.ts (shipped defaults only;
// user customization goes through config.categorizedIncomingLetterPrompts).

export interface IncomingLetterPromptData {
    types: Record<string, string>;
    factLabels: Record<string, string>;
    poetrySenderSourceLabels: Record<string, string>;
    greatProjectStageLabels: Record<string, string>;
    greatProjectReporterRoleLabels: Record<string, string>;
    greatProjectPlayerRoleLabels: Record<string, string>;
    siegeFortLevelDescriptions: Record<string, string>;
    siegePhaseProgressDescriptions: Record<string, string>;
    reasonTemplates: Record<string, string>;
    factionWarningParts: Record<string, string>;
    petitionLabels: Record<string, string>;
    factionTypeLabels: Record<string, string>;
    factionSizeLabels: Record<string, string>;
    deceasedCategoryLabels: Record<string, string>;
    misc: Record<string, string>; // fallback strings (enemyFallback, someone, ...)
    poetryCategoryInstruction: string;
    defaultPrompt: string;
    stablePolicy: string;
    summaryHeader: string;
    summaryPrefix: string;
    memoriesPrompt: string;
    requestTemplate: string;
    deceasedInfoTemplate: string;
    factLineTemplate: string;
}

const REQUIRED_MAP_KEYS = [
    "types", "factLabels", "poetrySenderSourceLabels", "greatProjectStageLabels",
    "greatProjectReporterRoleLabels", "greatProjectPlayerRoleLabels",
    "siegeFortLevelDescriptions", "siegePhaseProgressDescriptions", "reasonTemplates",
    "factionWarningParts", "petitionLabels", "factionTypeLabels", "factionSizeLabels",
    "deceasedCategoryLabels", "misc"
] as const;

const REQUIRED_STRING_KEYS = [
    "poetryCategoryInstruction", "defaultPrompt", "stablePolicy", "summaryHeader",
    "summaryPrefix", "memoriesPrompt", "requestTemplate", "deceasedInfoTemplate",
    "factLineTemplate"
] as const;

// All 25 IncomingLetterType values; a locale file must cover every one.
const REQUIRED_TYPES = [
    'vassal_memorial', 'siege_report', 'lost_holding', 'family_letter', 'poetry_letter',
    'courtier_petition', 'rival_taunt', 'dear_friend_greeting', 'letter_to_travelling_player',
    'ally_call_for_aid', 'revolt_urgent', 'deathbed_letter', 'pilgrimage_tales',
    'tour_tales', 'wedding_tales', 'hunt_tales', 'tournament_tales', 'travel_tales',
    'faction_warning', 'scheme_exposed', 'natural_disaster', 'tributary_letter',
    'liege_overlord_letter', 'great_work_notice', 'great_project_report'
];

const cache = new Map<string, IncomingLetterPromptData>();

function validate(data: any, sourcePath: string): IncomingLetterPromptData {
    if (!data || typeof data !== 'object') {
        throw new Error(`Incoming letter prompts at ${sourcePath} are not an object`);
    }
    for (const key of REQUIRED_MAP_KEYS) {
        if (!data[key] || typeof data[key] !== 'object' || Array.isArray(data[key])) {
            throw new Error(`Incoming letter prompts at ${sourcePath} are missing map "${key}"`);
        }
    }
    for (const key of REQUIRED_STRING_KEYS) {
        if (typeof data[key] !== 'string' || data[key].length === 0) {
            throw new Error(`Incoming letter prompts at ${sourcePath} are missing string "${key}"`);
        }
    }
    for (const t of REQUIRED_TYPES) {
        if (typeof data.types[t] !== 'string') {
            throw new Error(`Incoming letter prompts at ${sourcePath} are missing type "${t}"`);
        }
        if (typeof data.reasonTemplates[t] !== 'string') {
            throw new Error(`Incoming letter prompts at ${sourcePath} are missing reasonTemplate "${t}"`);
        }
    }
    return data as IncomingLetterPromptData;
}

function readLocaleFile(votcDataPath: string, locale: string): IncomingLetterPromptData | null {
    const filePath = path.join(votcDataPath, 'configs', 'prompts', 'incoming_letters', `${locale}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return validate(raw, filePath);
    } catch (error) {
        console.error(`[incomingLetterPromptsLoader] Failed to load/validate ${filePath}:`, error);
        return null;
    }
}

// Language fallback: config.language -> en -> zh (zh is the verbatim source of
// the original hardcoded strings). Result is cached per resolved locale.
export function loadIncomingLetterPrompts(votcDataPath: string, language: string | undefined): IncomingLetterPromptData {
    const lang = (language || 'en').toLowerCase();
    if (cache.has(lang)) return cache.get(lang)!;

    for (const candidate of [lang, 'en', 'zh']) {
        const data = readLocaleFile(votcDataPath, candidate);
        if (data) {
            cache.set(lang, data);
            return data;
        }
    }
    // Last resort: never return undefined — fall back to an empty-but-valid
    // skeleton so callers can degrade gracefully instead of crashing.
    console.error('[incomingLetterPromptsLoader] No incoming_letters locale file found for', lang, '- using empty skeleton');
    const skeleton: any = {};
    for (const key of REQUIRED_MAP_KEYS) skeleton[key] = {};
    for (const key of REQUIRED_STRING_KEYS) skeleton[key] = '';
    const data = skeleton as IncomingLetterPromptData;
    cache.set(lang, data);
    return data;
}

// Replace {{placeholder}} tokens. Unknown placeholders are left as-is so a
// missing fact never silently deletes text from a prompt.
export function substitute(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match
    );
}

// Resolve the instruction prompt for a letter type:
// per-type user override -> effectivePrompts.incomingLetterPrompt -> per-locale defaultPrompt.
export function resolveInstructionPrompt(
    data: IncomingLetterPromptData,
    type: string,
    categorizedOverrides: Record<string, string> | undefined,
    effectiveIncomingLetterPrompt: string | undefined
): string {
    return categorizedOverrides?.[type]
        || effectiveIncomingLetterPrompt
        || data.defaultPrompt;
}

export function clearIncomingLetterPromptsCache(): void {
    cache.clear();
}