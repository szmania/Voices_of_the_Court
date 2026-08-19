import { CompactionConfig } from '../../shared/compactionTypes';

/**
 * CompactionLocalizationValidator - Validates cross-language equivalence for memory compaction.
 * Ensures compaction works correctly across all supported locales (EN, ZH, RU, FR, ES)
 * and that CJK/Cyrillic token counting is accurate.
 */
export class CompactionLocalizationValidator {
    /** Supported locales for cross-language validation. */
    private readonly SUPPORTED_LOCALES = ['en', 'zh', 'ru', 'fr', 'es'] as const;

    /**
     * Validates that a locale file contains all required compaction-related localization keys.
     * Returns missing keys if any are absent.
     */
    public validateLocaleKeys(localeData: Record<string, any>, locale: string): LocaleValidationResult {
        const requiredKeys = [
            'compaction.status.running',
            'compaction.status.complete',
            'compaction.status.failed',
            'compaction.settings.enable',
            'compaction.settings.phase1Threshold',
            'compaction.settings.phase2Threshold',
            'compaction.settings.tokenBudget',
            'compaction.settings.cooldown',
            'compaction.settings.priorityElements',
            'compaction.settings.entityExtractionMode',
            'compaction.settings.relationshipsDirectional',
            'compaction.settings.manualTrigger',
        ];

        const missingKeys: string[] = [];
        for (const key of requiredKeys) {
            if (!this.getNestedKey(localeData, key)) {
                missingKeys.push(key);
            }
        }

        return {
            locale,
            valid: missingKeys.length === 0,
            missingKeys,
            totalRequiredKeys: requiredKeys.length,
            presentKeys: requiredKeys.length - missingKeys.length,
        };
    }

    /**
     * Validates token counting accuracy for a given locale.
     * CJK scripts (zh) use ~1.5 tokens per character, Cyrillic (ru) uses ~1.2,
     * Latin scripts (en, fr, es) use ~0.75 tokens per character.
     * Returns whether the estimated token count falls within acceptable bounds.
     */
    public validateTokenCounting(
        text: string,
        locale: string,
        estimatedTokens: number
    ): TokenValidationResult {
        const charCount = text.length;
        const expectedTokensPerChar = this.getExpectedTokensPerChar(locale);
        const expectedTokens = charCount * expectedTokensPerChar;
        const tolerance = 0.3; // 30% tolerance for estimation variance
        const lowerBound = expectedTokens * (1 - tolerance);
        const upperBound = expectedTokens * (1 + tolerance);

        const withinBounds = estimatedTokens >= lowerBound && estimatedTokens <= upperBound;

        return {
            locale,
            charCount,
            estimatedTokens,
            expectedTokensPerChar,
            expectedTokens,
            lowerBound,
            upperBound,
            withinBounds,
            deviation: expectedTokens > 0
                ? Math.abs(estimatedTokens - expectedTokens) / expectedTokens
                : 0,
        };
    }

    /**
     * Validates that compaction prompts are properly localized for the given locale.
     * Checks that the prompt contains locale-specific markers and doesn't contain
     * markers from other locales.
     */
    public validatePromptLocalization(
        prompt: string,
        locale: string
    ): PromptLocalizationResult {
        const localeMarkers: Record<string, string[]> = {
            en: ['english', 'summarize', 'context', 'memory'],
            zh: ['中文', '摘要', '上下文', '记忆'],
            ru: ['русский', 'резюме', 'контекст', 'память'],
            fr: ['français', 'résumé', 'contexte', 'mémoire'],
            es: ['español', 'resumen', 'contexto', 'memoria'],
        };

        const expectedMarkers = localeMarkers[locale] || localeMarkers['en'];
        const otherLocales = this.SUPPORTED_LOCALES.filter(l => l !== locale);

        const foundExpectedMarkers: string[] = [];
        const missingExpectedMarkers: string[] = [];
        const foundOtherLocaleMarkers: string[] = [];

        const promptLower = prompt.toLowerCase();

        for (const marker of expectedMarkers) {
            if (promptLower.includes(marker.toLowerCase())) {
                foundExpectedMarkers.push(marker);
            } else {
                missingExpectedMarkers.push(marker);
            }
        }

        for (const otherLocale of otherLocales) {
            const otherMarkers = localeMarkers[otherLocale] || [];
            for (const marker of otherMarkers) {
                if (promptLower.includes(marker.toLowerCase())) {
                    foundOtherLocaleMarkers.push(`${otherLocale}:${marker}`);
                }
            }
        }

        return {
            locale,
            properlyLocalized: missingExpectedMarkers.length === 0 && foundOtherLocaleMarkers.length === 0,
            foundExpectedMarkers,
            missingExpectedMarkers,
            foundOtherLocaleMarkers,
        };
    }

    /**
     * Runs a comprehensive cross-language validation for all supported locales.
     * Validates locale keys, token counting, and prompt localization.
     */
    public validateAllLocales(
        localeDataMap: Record<string, Record<string, any>>,
        sampleTexts: Record<string, string>,
        tokenEstimates: Record<string, number>,
        prompts: Record<string, string>
    ): CrossLanguageValidationReport {
        const report: CrossLanguageValidationReport = {
            timestamp: Date.now(),
            localeResults: [],
            allLocalesValid: true,
        };

        for (const locale of this.SUPPORTED_LOCALES) {
            const keyResult = this.validateLocaleKeys(
                localeDataMap[locale] || {},
                locale
            );
            const tokenResult = this.validateTokenCounting(
                sampleTexts[locale] || '',
                locale,
                tokenEstimates[locale] || 0
            );
            const promptResult = this.validatePromptLocalization(
                prompts[locale] || '',
                locale
            );

            const localeValid = keyResult.valid && tokenResult.withinBounds && promptResult.properlyLocalized;

            report.localeResults.push({
                locale,
                keyValidation: keyResult,
                tokenValidation: tokenResult,
                promptValidation: promptResult,
                valid: localeValid,
            });

            if (!localeValid) {
                report.allLocalesValid = false;
            }
        }

        return report;
    }

    /**
     * Returns the expected tokens-per-character ratio for a given locale.
     * CJK scripts use more tokens per character due to logographic nature.
     */
    private getExpectedTokensPerChar(locale: string): number {
        switch (locale) {
            case 'zh': return 1.5;  // CJK: ~1.5 tokens per character
            case 'ru': return 1.2;  // Cyrillic: ~1.2 tokens per character
            case 'ja': return 1.4;  // Japanese: ~1.4 tokens per character
            case 'ko': return 1.5;  // Korean: ~1.5 tokens per character
            default: return 0.75;   // Latin scripts: ~0.75 tokens per character
        }
    }

    /** Safely retrieves a nested key from a locale object using dot notation. */
    private getNestedKey(obj: Record<string, any>, keyPath: string): any {
        const parts = keyPath.split('.');
        let current = obj;
        for (const part of parts) {
            if (current == null || typeof current !== 'object') return undefined;
            current = current[part];
        }
        return current;
    }
}

/** Result of validating locale keys for a single locale. */
export interface LocaleValidationResult {
    locale: string;
    valid: boolean;
    missingKeys: string[];
    totalRequiredKeys: number;
    presentKeys: number;
}

/** Result of validating token counting for a single locale. */
export interface TokenValidationResult {
    locale: string;
    charCount: number;
    estimatedTokens: number;
    expectedTokensPerChar: number;
    expectedTokens: number;
    lowerBound: number;
    upperBound: number;
    withinBounds: boolean;
    deviation: number;
}

/** Result of validating prompt localization for a single locale. */
export interface PromptLocalizationResult {
    locale: string;
    properlyLocalized: boolean;
    foundExpectedMarkers: string[];
    missingExpectedMarkers: string[];
    foundOtherLocaleMarkers: string[];
}

/** Single locale entry in a cross-language validation report. */
export interface LocaleReportEntry {
    locale: string;
    keyValidation: LocaleValidationResult;
    tokenValidation: TokenValidationResult;
    promptValidation: PromptLocalizationResult;
    valid: boolean;
}

/** Comprehensive cross-language validation report. */
export interface CrossLanguageValidationReport {
    timestamp: number;
    localeResults: LocaleReportEntry[];
    allLocalesValid: boolean;
}