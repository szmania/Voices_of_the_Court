import { createHash } from "node:crypto";

/**
 * Canonical JSON (design doc section 5.1): object keys sorted recursively,
 * arrays kept in order, hashed as UTF-8. Never use incidental
 * JSON.stringify() output as the cross-version hashing protocol.
 *
 * Semantics match JSON.stringify after key normalization: `undefined` object
 * properties are dropped, `undefined`/`function` array entries become null,
 * and non-JSON values (Map, class instances, functions) are NOT supported -
 * callers must pass plain data (ResolvedPromptInputV1 / PromptRequestInputV1
 * are plain by construction).
 */

type JsonCompatible = unknown;

function normalize(value: JsonCompatible): JsonCompatible {
    if (value === null || typeof value !== 'object') {
        // Functions and undefined are not valid JSON values; JSON.stringify
        // turns them into null inside arrays and drops them inside objects.
        if (typeof value === 'function' || value === undefined) {
            return undefined;
        }
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(item => {
            const normalized = normalize(item);
            return normalized === undefined ? null : normalized;
        });
    }
    const output: Record<string, JsonCompatible> = {};
    const keys = Object.keys(value as Record<string, JsonCompatible>).sort();
    for (const key of keys) {
        const normalized = normalize((value as Record<string, JsonCompatible>)[key]);
        if (normalized !== undefined) {
            output[key] = normalized;
        }
    }
    return output;
}

/** Stable stringify: same logical value -> same bytes, regardless of key insertion order. */
export function canonicalJsonStringify(value: JsonCompatible): string {
    return JSON.stringify(normalize(value));
}

/** sha256 hex over the UTF-8 canonical JSON bytes. */
export function logicalRequestHash(value: JsonCompatible): string {
    return createHash('sha256').update(canonicalJsonStringify(value), 'utf8').digest('hex');
}

/** sha256 hex over UTF-8 text. */
export function sha256Hex(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}
