import enData from './en.json';
import zhData from './zh.json';

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
