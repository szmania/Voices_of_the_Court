import { createHash } from 'crypto';
import type { Tiktoken } from 'js-tiktoken';
import { ApiConnection } from '../../shared/apiConnection.js';
import type { Parameters } from '../../shared/apiConnection.js';
import type { ApiConnectionConfig } from '../../shared/Config.js';
import type { Message } from '../ts/conversation_interfaces.js';
import type { Ck3GameDate } from '../../shared/gameData/gameDate.js';
import {
    buildChroniclePrompt,
    DEFAULT_CHRONICLE_PROMPT,
    type PreviousChronicleRef
} from './ChroniclePromptBuilder.js';
import type {
    ChronicleSelectedSource
} from './chronicleTypes.js';

export interface ChronicleGeneratorConfig {
    chroniclePrompt: string;
    chronicleOutputMaxTokens: number;
    summarizationUseTextGenApi?: boolean;
    summarizationParameters: Parameters;
    textGenerationApiConnectionConfig?: ApiConnectionConfig;
    summarizationApiConnectionConfig?: ApiConnectionConfig;
    dumpPrompts?: boolean;
}

export interface ChronicleGeneratorApi {
    complete(
        prompt: string | Message[],
        stream: boolean,
        otherArgs: object,
        streamRelay?: (arg1: unknown) => void
    ): Promise<string>;
}

export interface GenerateChronicleParams {
    sources: ChronicleSelectedSource[];
    generatorConfig: ChronicleGeneratorConfig;
    api: ChronicleGeneratorApi;
    requestKey: string;
    playerName: string;
    periodStart: Ck3GameDate;
    periodEnd: Ck3GameDate;
    previousChronicleEntries?: PreviousChronicleRef[];
}

export type GenerateChronicleResult =
    | { ok: true; content: string }
    | { ok: false; errorCode: string; errorMessage: string };

export const CHRONICLE_HARD_STORAGE_LIMIT = 100000;

export interface ValidationResult {
    valid: boolean;
    content?: string;
    errorCode?: string;
    errorMessage?: string;
}

function hashPrefix(text: string): string {
    return createHash('sha256')
        .update(text, 'utf8')
        .digest('hex')
        .slice(0, 12);
}

export function validateChronicleOutput(
    content: string,
    maxStorageChars: number
): ValidationResult {
    if (!content) {
        return {
            valid: false,
            errorCode: 'empty_response',
            errorMessage: 'chronicle generator: model returned empty content'
        };
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
        return {
            valid: false,
            errorCode: 'whitespace_only',
            errorMessage: 'chronicle generator: model returned only whitespace'
        };
    }

    if (looksLikeJsonError(content)) {
        return {
            valid: false,
            errorCode: 'json_error_object',
            errorMessage: 'chronicle generator: model returned a JSON error object'
        };
    }

    if (content.length > maxStorageChars) {
        return {
            valid: false,
            errorCode: 'oversized_response',
            errorMessage: `chronicle generator: response ${content.length} chars exceeds hard storage limit ${maxStorageChars}`
        };
    }

    return { valid: true, content };
}

function looksLikeJsonError(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        return false;
    }
    try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== 'object' || parsed === null) return false;
        if ('error' in parsed) return true;
        if ('detail' in parsed && typeof (parsed as Record<string, unknown>).detail === 'object') {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export function createChronicleSummarizationConnection(
    config: ChronicleGeneratorConfig,
    encoder: Tiktoken | null = null
): ChronicleGeneratorApi & Pick<ApiConnection, 'context' | 'model' | 'parameters' | 'isChat' | 'calculateTokensFromText'> {
    if (config.summarizationUseTextGenApi) {
        const textGen = config.textGenerationApiConnectionConfig;
        if (!textGen) {
            throw new Error(
                'chronicle generator: summarizationUseTextGenApi is true but textGenerationApiConnectionConfig is missing'
            );
        }
        return adaptChronicleConnection(new ApiConnection(textGen.connection, config.summarizationParameters, encoder));
    }
    const summ = config.summarizationApiConnectionConfig;
    if (!summ) {
        throw new Error(
            'chronicle generator: summarizationApiConnectionConfig is missing'
        );
    }
    return adaptChronicleConnection(new ApiConnection(summ.connection, config.summarizationParameters, encoder));
}

/** Normalize the release provider API for generation and digest planning. */
function adaptChronicleConnection(connection: ApiConnection) {
    return {
        get context() { return connection.context; },
        get model() { return connection.model; },
        get parameters() { return connection.parameters; },
        isChat: () => connection.isChat(),
        calculateTokensFromText: (text: string) => connection.calculateTokensFromText(text),
        complete: async (prompt: string | Message[], stream: boolean, args: object): Promise<string> => {
            const request = typeof prompt === 'string' && connection.isChat()
                ? [{ role: 'user', content: prompt } as Message] : prompt;
            // Upstream sends otherArgs directly to several provider endpoints.
            const { __purpose, ...providerArgs } = args as Record<string, unknown>;
            const response = await connection.complete(request, stream, providerArgs);
            return typeof response === 'string' ? response : response?.content ?? '';
        }
    };
}

function logSafeMetadata(params: GenerateChronicleParams, prompt: string): void {
    const { sources, generatorConfig, requestKey } = params;
    const sourceCount = sources.length;
    const rawChars = sources.reduce(
        (sum, s) => sum + s.record.rawText.length,
        0
    );
    const selectedChars = sources.reduce(
        (sum, s) => sum + s.text.length,
        0
    );
    const representationCounts: Record<string, number> = {};
    for (const s of sources) {
        const mode = s.manifestItem.representation;
        representationCounts[mode] = (representationCounts[mode] ?? 0) + 1;
    }
    const promptHash = hashPrefix(prompt);
    const maxTokens = generatorConfig.chronicleOutputMaxTokens;

    console.debug(
        `[chronicle] requestKey=${requestKey}` +
        ` sources=${sourceCount}` +
        ` rawChars=${rawChars}` +
        ` selectedChars=${selectedChars}` +
        ` maxTokens=${maxTokens}` +
        ` representations=${JSON.stringify(representationCounts)}` +
        ` promptHash=${promptHash}`
    );
}

function sanitizeErrorCode(error: unknown): string {
    return error instanceof Error ? 'api_request_failed' : 'unknown_error';
}

const ERROR_MESSAGE_MAX_LENGTH = 500;
const API_KEY_PATTERN = /sk-[A-Za-z0-9_\-]{16,}/g;
const ANTHROPIC_KEY_PATTERN = /sk-ant-[A-Za-z0-9_\-]{16,}/g;
const GOOGLE_KEY_PATTERN = /AIza[A-Za-z0-9_\-]{16,}/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_\-\.]{16,}/gi;
const URL_PATTERN = /https?:\/\/[^\s"']+/gi;

export function sanitizeChronicleErrorMessage(text: string): string {
    let sanitized = text
        .replace(ANTHROPIC_KEY_PATTERN, '[REDACTED_KEY]')
        .replace(API_KEY_PATTERN, '[REDACTED_KEY]')
        .replace(GOOGLE_KEY_PATTERN, '[REDACTED_KEY]')
        .replace(BEARER_PATTERN, '[REDACTED_TOKEN]')
        .replace(URL_PATTERN, '[REDACTED_URL]')
        .replace(/[\r\n]+/g, ' ');
    if (sanitized.length > ERROR_MESSAGE_MAX_LENGTH) {
        sanitized = sanitized.slice(0, ERROR_MESSAGE_MAX_LENGTH) + '...[truncated]';
    }
    return sanitized;
}

export async function generateChronicle(
    params: GenerateChronicleParams
): Promise<GenerateChronicleResult> {
    const { sources, generatorConfig, api, requestKey } = params;

    const prompt = buildChroniclePrompt({
        promptTemplate: generatorConfig.chroniclePrompt || DEFAULT_CHRONICLE_PROMPT,
        playerName: params.playerName,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        sources,
        previousChronicleEntries: params.previousChronicleEntries
    });

    logSafeMetadata(params, prompt);

    try {
        const rawResponse = await api.complete(prompt, false, {
            max_tokens: generatorConfig.chronicleOutputMaxTokens,
            temperature: generatorConfig.summarizationParameters.temperature,
            __purpose: 'chronicle'
        });

        const result = validateChronicleOutput(
            rawResponse ?? '',
            CHRONICLE_HARD_STORAGE_LIMIT
        );

        if (!result.valid) {
            console.debug(
                `[chronicle] requestKey=${requestKey}` +
                ` errorCode=${result.errorCode}` +
                ` responseHash=${hashPrefix(rawResponse ?? '')}`
            );
            return {
                ok: false,
                errorCode: result.errorCode ?? 'validation_failed',
                errorMessage: result.errorMessage ?? 'validation failed'
            };
        }

        return { ok: true, content: result.content! };
    } catch (error) {
        const code = sanitizeErrorCode(error);
        console.debug(
            `[chronicle] requestKey=${requestKey}` +
            ` errorCode=${code}` +
            ` errorthrown=true`
        );
        return {
            ok: false,
            errorCode: code,
            errorMessage: 'chronicle generator: API request failed'
        };
    }
}
