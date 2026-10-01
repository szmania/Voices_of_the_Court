import { en, zh } from './locales/index.js';

export type Lang = 'en' | 'zh';
export type I18nParams = Record<string, string | number>;
export type TranslationRoot = Document | DocumentFragment | ShadowRoot | Element;

const dictionaries = { en, zh };
let currentLanguage: Lang = 'en';
const listeners = new Set<() => void>();

export function detectLanguage(locale?: string): Lang {
    return locale?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function normalizeLanguage(value: unknown): Lang | null {
    return value === 'en' || value === 'zh' ? value : null;
}

export function t(key: string, params: I18nParams = {}): string {
    const dictionary = dictionaries[currentLanguage];
    const fallback = dictionaries.en;
    let value = dictionary[key as keyof typeof dictionary] || fallback[key as keyof typeof fallback] || key;

    for (const [paramKey, paramValue] of Object.entries(params)) {
        value = value.replace(new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g'), () => String(paramValue));
    }

    return value;
}

export function setLanguage(lang: Lang): void {
    if (currentLanguage === lang) return;
    currentLanguage = lang;
    for (const listener of listeners) {
        listener();
    }
}

export function getLanguage(): Lang {
    return currentLanguage;
}

export function onLanguageChange(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

export function translateDOM(root: TranslationRoot, options: { includeShadowRoots?: boolean } = {}): void {
    const includeShadowRoots = options.includeShadowRoots !== false;
    const visited = new Set<object>();

    if (isDocument(root)) {
        root.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
    }

    translateRoot(root, includeShadowRoots, visited);
}

function translateRoot(root: TranslationRoot, includeShadowRoots: boolean, visited: Set<object>): void {
    if (!root || visited.has(root as object)) return;
    visited.add(root as object);

    if (isElement(root)) {
        translateElement(root as Element);
        if (includeShadowRoots && (root as Element).shadowRoot) {
            translateRoot((root as Element).shadowRoot!, includeShadowRoots, visited);
        }
    }

    const queryRoot = root as ParentNode & { querySelectorAll?: (selectors: string) => NodeListOf<Element> };
    if (!queryRoot.querySelectorAll) return;

    const selectors = [
        '[data-i18n]',
        '[data-i18n-placeholder]',
        '[data-i18n-title]',
        '[data-i18n-aria-label]',
        '[data-i18n-html]'
    ].join(',');

    queryRoot.querySelectorAll(selectors).forEach(translateElement);

    if (!includeShadowRoots) return;

    queryRoot.querySelectorAll('*').forEach((element) => {
        if (element.shadowRoot) {
            translateRoot(element.shadowRoot, includeShadowRoots, visited);
        }
    });
}

function translateElement(element: Element): void {
    const textKey = element.getAttribute('data-i18n');
    if (textKey) {
        element.textContent = t(textKey);
    }

    const placeholderKey = element.getAttribute('data-i18n-placeholder');
    if (placeholderKey && 'placeholder' in element) {
        (element as HTMLInputElement | HTMLTextAreaElement).placeholder = t(placeholderKey);
    }

    const titleKey = element.getAttribute('data-i18n-title');
    if (titleKey) {
        (element as HTMLElement).title = t(titleKey);
    }

    const ariaLabelKey = element.getAttribute('data-i18n-aria-label');
    if (ariaLabelKey) {
        element.setAttribute('aria-label', t(ariaLabelKey));
    }

    const htmlKey = element.getAttribute('data-i18n-html');
    if (htmlKey) {
        element.innerHTML = t(htmlKey);
    }
}

function isElement(node: unknown): node is Element {
    return !!node && typeof node === 'object' && (node as Node).nodeType === 1;
}

function isDocument(node: unknown): node is Document {
    return !!node && typeof node === 'object' && (node as Node).nodeType === 9;
}
