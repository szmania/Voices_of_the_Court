import { createHash } from 'crypto';
import type { CampaignPlayerIdentity } from '../../shared/gameData/CampaignIdentity.js';
import type { Message } from '../ts/conversation_interfaces.js';
import { chronicleSourceDigestsPath } from '../campaignDataPaths.js';
import {
    readChronicleJson,
    writeChronicleJsonAtomic
} from './chronicleAtomicJson.js';
import type {
    ChronicleBudget,
    ChronicleDigestCacheEntry,
    ChronicleDigestCacheFile,
    ChronicleRepresentationMode,
    ChronicleSelectedSource,
    ChronicleSourceManifestItem,
    ChronicleSourceRecord,
    ChronicleSourceKind
} from './chronicleTypes.js';

export const CHRONICLE_CONTEXT_SAFETY_RATIO = 0.70;
export const DIGEST_PROMPT_VERSION = 1;
export const DIGEST_CHUNK_CHAR_SIZE = 4000;
export const DIGEST_INPUT_SAFETY_RATIO = 0.5;

export const DIGEST_SYSTEM_PROMPT =
    '请把以下单项 VOTC 记录压缩为可供史官引用的事实摘要。\n' +
    '保留人物、主张、决定、承诺、冲突、行动和明确结果。\n' +
    '不得补充动机、结果或数字，不得评价人物。\n' +
    '只输出摘要正文。';

export interface ChroniclePlannerApi {
    calculateTokensFromText(text: string): number;
    complete(
        prompt: string | Message[],
        stream: boolean,
        otherArgs: object
    ): Promise<string>;
    context: number;
    isChat(): boolean;
}

const DIGEST_CACHE_SCHEMA_VERSION = 1;

export interface SelectChronicleRepresentationsOptions {
    userDataDir: string;
    identity: CampaignPlayerIdentity;
    modelCategory: string;
    digestPromptVersion?: number;
    promptOverheadText?: string;
}

function normalizeNewlines(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function visibleCharCount(text: string): number {
    return Array.from(normalizeNewlines(text).trim()).length;
}

function sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

function buildDigestCacheKey(
    rawHash: string,
    promptVersion: number,
    modelCategory: string,
    sourceKind: ChronicleSourceKind
): string {
    return `${rawHash}|v${promptVersion}|${modelCategory}|${sourceKind}`;
}

function loadDigestCache(filePath: string): ChronicleDigestCacheFile {
    try {
        const raw = readChronicleJson(filePath);
        if (raw === undefined) {
            return { schemaVersion: DIGEST_CACHE_SCHEMA_VERSION, entries: {} };
        }
        if (typeof raw !== 'object' || raw === null) {
            return { schemaVersion: DIGEST_CACHE_SCHEMA_VERSION, entries: {} };
        }
        const obj = raw as Record<string, unknown>;
        if (
            typeof obj.schemaVersion !== 'number' ||
            typeof obj.entries !== 'object' ||
            obj.entries === null
        ) {
            return { schemaVersion: DIGEST_CACHE_SCHEMA_VERSION, entries: {} };
        }
        return obj as unknown as ChronicleDigestCacheFile;
    } catch {
        return { schemaVersion: DIGEST_CACHE_SCHEMA_VERSION, entries: {} };
    }
}

function flushDigestCache(
    filePath: string,
    cache: ChronicleDigestCacheFile,
    options: SelectChronicleRepresentationsOptions
): void {
    try {
        writeChronicleJsonAtomic(options.userDataDir, options.identity, filePath, cache);
    } catch {
        // Cache write failure is non-fatal; digests will be regenerated next time.
    }
}

function makeManifestItem(
    record: ChronicleSourceRecord,
    mode: ChronicleRepresentationMode,
    text: string
): ChronicleSourceManifestItem {
    return {
        sourceId: record.id,
        kind: record.kind,
        title: record.title,
        gameDate: record.gameDate,
        content: record.rawText,
        representation: mode,
        rawCharCount: visibleCharCount(record.rawText),
        selectedCharCount: visibleCharCount(text),
        rawHash: sha256(record.rawText),
        selectedTextHash: sha256(text),
        votcCheckpointEpoch: record.votcCheckpointEpoch,
        votcTimelineNodeId: record.votcTimelineNodeId
    };
}

function makeSelected(
    record: ChronicleSourceRecord,
    mode: ChronicleRepresentationMode,
    text: string
): ChronicleSelectedSource {
    return {
        record,
        mode,
        text,
        manifestItem: makeManifestItem(record, mode, text)
    };
}

function computeInputTokenLimit(budget: ChronicleBudget): number {
    const limit =
        Math.floor(budget.contextTokens * budget.contextSafetyRatio) -
        budget.outputMaxTokens;
    return limit < 1 ? 1 : limit;
}

export function fits(
    selected: ChronicleSelectedSource[],
    budget: ChronicleBudget,
    api: ChroniclePlannerApi,
    promptOverheadText: string
): boolean {
    const totalChars = selected.reduce(
        (sum, s) => sum + visibleCharCount(s.text),
        0
    );
    if (totalChars > budget.rawSourceCharLimit) return false;

    const fullPromptText =
        promptOverheadText + selected.map(s => s.text).join('\n\n');
    const tokens = api.calculateTokensFromText(fullPromptText);
    const tokenLimit = computeInputTokenLimit(budget);
    return tokens <= tokenLimit;
}

function buildDigestMessages(record: ChronicleSourceRecord): Message[] {
    return [
        { role: 'system', content: DIGEST_SYSTEM_PROMPT },
        { role: 'user', content: record.rawText }
    ];
}

function buildDigestPromptText(record: ChronicleSourceRecord): string {
    return `${DIGEST_SYSTEM_PROMPT}\n\n---\n${record.rawText}`;
}

async function callDigestApi(
    record: ChronicleSourceRecord,
    api: ChroniclePlannerApi
): Promise<string> {
    const result = api.isChat()
        ? await api.complete(buildDigestMessages(record), false, {__purpose: 'chronicleDigest'})
        : await api.complete(buildDigestPromptText(record), false, {__purpose: 'chronicleDigest'});
    return (result ?? '').trim();
}

async function generateDigest(
    record: ChronicleSourceRecord,
    api: ChroniclePlannerApi
): Promise<string> {
    return callDigestApi(record, api);
}

function chunkText(text: string, chunkSize: number): string[] {
    const chars = Array.from(text);
    const chunks: string[] = [];
    for (let i = 0; i < chars.length; i += chunkSize) {
        chunks.push(chars.slice(i, i + chunkSize).join(''));
    }
    return chunks;
}

async function generateChunkDigest(
    record: ChronicleSourceRecord,
    api: ChroniclePlannerApi
): Promise<string> {
    const chunks = chunkText(record.rawText, DIGEST_CHUNK_CHAR_SIZE);
    const digests: string[] = [];
    for (const chunk of chunks) {
        const chunkRecord: ChronicleSourceRecord = {
            ...record,
            rawText: chunk
        };
        digests.push(await callDigestApi(chunkRecord, api));
    }
    return digests.join('\n\n');
}

function needsChunkDigest(
    record: ChronicleSourceRecord,
    api: ChroniclePlannerApi
): boolean {
    const inputTokens = api.calculateTokensFromText(
        buildDigestPromptText(record)
    );
    return inputTokens > Math.floor(api.context * DIGEST_INPUT_SAFETY_RATIO);
}

export interface DigestResult {
    text: string;
    mode: 'generated_digest' | 'chunk_digest';
}

export async function loadOrGenerateDigest(
    record: ChronicleSourceRecord,
    api: ChroniclePlannerApi,
    cache: ChronicleDigestCacheFile,
    options: {
        modelCategory: string;
        digestPromptVersion: number;
    }
): Promise<DigestResult> {
    const rawHash = sha256(record.rawText);
    const key = buildDigestCacheKey(
        rawHash,
        options.digestPromptVersion,
        options.modelCategory,
        record.kind
    );

    const cached = cache.entries[key];
    if (
        cached &&
        cached.rawHash === rawHash &&
        cached.digestPromptVersion === options.digestPromptVersion &&
        cached.modelCategory === options.modelCategory &&
        cached.digestText
    ) {
        return { text: cached.digestText, mode: cached.mode };
    }

    let text: string;
    let mode: 'generated_digest' | 'chunk_digest';

    if (needsChunkDigest(record, api)) {
        text = await generateChunkDigest(record, api);
        mode = 'chunk_digest';
    } else {
        text = await generateDigest(record, api);
        mode = 'generated_digest';
    }

    if (!text) {
        throw new Error(
            `chronicle budget planner: digest generation returned empty text for source ${record.id} (${record.kind})`
        );
    }

    cache.entries[key] = {
        rawHash,
        sourceKind: record.kind,
        digestPromptVersion: options.digestPromptVersion,
        modelCategory: options.modelCategory,
        digestText: text,
        mode,
        generatedAt: new Date().toISOString()
    };

    return { text, mode };
}

function byRawLengthDescThenDateAsc(
    a: ChronicleSelectedSource,
    b: ChronicleSelectedSource
): number {
    const lenA = visibleCharCount(a.record.rawText);
    const lenB = visibleCharCount(b.record.rawText);
    if (lenA !== lenB) return lenB - lenA;
    const dayA = a.record.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
    const dayB = b.record.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
    return dayA - dayB;
}

function byOwnerThenDate(
    a: ChronicleSelectedSource,
    b: ChronicleSelectedSource
): number {
    const ownerA = a.record.memoryOwnerId ?? '';
    const ownerB = b.record.memoryOwnerId ?? '';
    if (ownerA !== ownerB) return ownerA.localeCompare(ownerB);
    const dayA = a.record.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
    const dayB = b.record.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
    return dayA - dayB;
}

function byDateThenKindThenId(
    a: ChronicleSelectedSource,
    b: ChronicleSelectedSource
): number {
    const dayA = a.record.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
    const dayB = b.record.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
    if (dayA !== dayB) return dayA - dayB;
    if (a.record.kind !== b.record.kind)
        return a.record.kind.localeCompare(b.record.kind);
    return a.record.id.localeCompare(b.record.id);
}

function sortChronologically(
    selected: ChronicleSelectedSource[]
): ChronicleSelectedSource[] {
    return selected.sort((a, b) => {
        const dayA = a.record.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
        const dayB = b.record.gameDate?.totalDays ?? Number.POSITIVE_INFINITY;
        if (dayA !== dayB) return dayA - dayB;

        const epochA = a.record.votcCheckpointEpoch ?? -1;
        const epochB = b.record.votcCheckpointEpoch ?? -1;
        if (epochA !== epochB) return epochA - epochB;

        const createdA = a.record.createdAt ?? '';
        const createdB = b.record.createdAt ?? '';
        if (createdA !== createdB) return createdA.localeCompare(createdB);

        return a.record.id.localeCompare(b.record.id);
    });
}

async function degradeSource(
    item: ChronicleSelectedSource,
    record: ChronicleSourceRecord,
    api: ChroniclePlannerApi,
    cache: ChronicleDigestCacheFile,
    options: {
        modelCategory: string;
        digestPromptVersion: number;
    }
): Promise<boolean> {
    if (record.existingSummary) {
        item.mode = 'existing_summary';
        item.text = record.existingSummary;
    } else {
        const result = await loadOrGenerateDigest(record, api, cache, options);
        item.mode = result.mode;
        item.text = result.text;
    }
    item.manifestItem = makeManifestItem(item.record, item.mode, item.text);
    return item.mode !== 'existing_summary';
}

export async function selectChronicleRepresentations(
    records: ChronicleSourceRecord[],
    budget: ChronicleBudget,
    api: ChroniclePlannerApi,
    options: SelectChronicleRepresentationsOptions
): Promise<ChronicleSelectedSource[]> {
    const digestPromptVersion =
        options.digestPromptVersion ?? DIGEST_PROMPT_VERSION;
    const promptOverheadText = options.promptOverheadText ?? '';

    const cachePath = chronicleSourceDigestsPath(
        options.userDataDir,
        options.identity
    );
    const cache = loadDigestCache(cachePath);
    let cacheDirty = false;

    const digestOptions = {
        modelCategory: options.modelCategory,
        digestPromptVersion
    };

    const selected: ChronicleSelectedSource[] = records.map(r =>
        makeSelected(r, 'raw', r.rawText)
    );

    const checkFit = () =>
        fits(selected, budget, api, promptOverheadText);

    const tokenLimit = computeInputTokenLimit(budget);

    try {
        if (checkFit()) {
            return sortChronologically(selected);
        }

        const runPass = async (
            pool: ChronicleSelectedSource[]
        ): Promise<boolean> => {
            for (const item of pool) {
                try {
                    const dirtied = await degradeSource(item, item.record, api, cache, digestOptions);
                    if (dirtied) cacheDirty = true;
                    if (checkFit()) return true;
                } catch (error) {
                    const singleSourceTokens = api.calculateTokensFromText(
                        item.record.rawText
                    );
                    if (singleSourceTokens > tokenLimit) {
                        throw error;
                    }
                    // Non-oversized digest failure: surface it on the item so
                    // the caller can decide whether to fail or proceed with
                    // partial degradation. The source stays as `raw`.
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    item.degradationFailed = true;
                    item.degradationError = errorMsg;
                    item.manifestItem.degradationFailed = true;
                    item.manifestItem.degradationError = errorMsg;
                }
            }
            return false;
        };

        const conversations = selected
            .filter(s => s.record.kind === 'conversation' && s.mode === 'raw')
            .sort(byRawLengthDescThenDateAsc);
        if (await runPass(conversations)) {
            return sortChronologically(selected);
        }

        const memories = selected
            .filter(
                s => s.record.kind === 'character_memory' && s.mode === 'raw'
            )
            .sort(byOwnerThenDate);
        if (await runPass(memories)) {
            return sortChronologically(selected);
        }

        const lettersAndBattles = selected
            .filter(
                s =>
                    (s.record.kind === 'outgoing_letter' ||
                        s.record.kind === 'incoming_letter' ||
                        s.record.kind === 'battle_report') &&
                    s.mode === 'raw'
            )
            .sort(byDateThenKindThenId);
        if (await runPass(lettersAndBattles)) {
            return sortChronologically(selected);
        }

        const remainingRaw = selected
            .filter(s => s.mode === 'raw')
            .sort(byRawLengthDescThenDateAsc);
        if (await runPass(remainingRaw)) {
            return sortChronologically(selected);
        }

        const failedCount = selected.filter(item => item.degradationFailed).length;
        throw new Error(
            'chronicle budget planner: selected sources remain over budget ' +
            `after degradation (${failedCount} degradation failures)`
        );
    } finally {
        if (cacheDirty) {
            flushDigestCache(cachePath, cache, options);
        }
    }
}
