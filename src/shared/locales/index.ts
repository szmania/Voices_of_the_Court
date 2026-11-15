// Loaded from public/locales at runtime — the same files LocalizationManager uses.
// A static import is not possible here because tsconfig sets rootDir: "./src".
// eslint-disable-next-line @typescript-eslint/no-var-requires
const enData = require('../../../public/locales/en.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const zhData = require('../../../public/locales/zh.json');

function flattenJson(obj: any, prefix = ''): Record<string, string> {
    let result: Record<string, string> = {};
    for (const k of Object.keys(obj)) {
        const val = obj[k];
        const pre = prefix.length > 0 ? prefix + '.' + k : k;
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            Object.assign(result, flattenJson(val, pre));
        } else {
            result[pre] = String(val);
        }
    }
    return result;
}

export const en = flattenJson(enData);
export const zh = flattenJson(zhData);
export type I18nKey = keyof typeof en;
