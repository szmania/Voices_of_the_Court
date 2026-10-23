const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Returns true when a URL is safe to hand to shell.openExternal.
 *
 * Only web and mail links are allowed. Without this check, a renderer can ask
 * the main process to launch arbitrary protocol handlers (file:, javascript:,
 * custom app schemes, etc.).
 */
export function isSafeExternalUrl(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) {
        return false;
    }

    try {
        return SAFE_EXTERNAL_PROTOCOLS.has(new URL(value).protocol);
    } catch {
        return false;
    }
}
