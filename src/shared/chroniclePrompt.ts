const CHRONICLE_LANGUAGES = new Set(['en', 'zh', 'ru', 'fr', 'es', 'de', 'ja', 'ko', 'pl', 'pt', 'tr']);

// This exact text was copied into existing configs before localized defaults.
// Treat it as a default without replacing any user-edited prompt.
export const LEGACY_CHRONICLE_PROMPT = 'You are a court historian. Based on the following source materials, write a concise chronicle entry in a historical narrative style. Requirements: 1. Stay faithful to the sources; 2. Highlight important figures and events; 3. Keep it concise.';

export function getDefaultChroniclePrompt(language = 'en'): string {
    const base = language.toLowerCase().replace('_', '-').split('-')[0];
    const code = CHRONICLE_LANGUAGES.has(base) ? base : 'en';
    // Use the same language files as the existing default-prompt editor.
    const defaults = require(`../../default_userdata/configs/prompts/${code}.json`);
    const prompt = defaults.prompts?.chroniclePrompt;
    if (typeof prompt !== 'string' || !prompt.trim()) {
        throw new Error(`Missing default chronicle prompt for language: ${code}`);
    }
    return prompt;
}

export function resolveChroniclePrompt(value: string | undefined, language = 'en'): string {
    if (typeof value === 'string' && value.trim() && value !== LEGACY_CHRONICLE_PROMPT) return value;
    return getDefaultChroniclePrompt(language);
}

export const DEFAULT_CHRONICLE_PROMPT = getDefaultChroniclePrompt('en');
