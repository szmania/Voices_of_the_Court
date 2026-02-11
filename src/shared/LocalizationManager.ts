import { ipcRenderer } from 'electron';

export class LocalizationManager {
    private static translations: any = {};

    static async loadTranslations(lang: string) {
        try {
            // Use require for local JSON files to avoid fetch/file protocol issues
            this.translations = require(`../../public/locales/${lang}.json`);
            this.applyTranslations();
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
    }

    static applyTranslations(root: Document | ShadowRoot = document) {
        const elements = root.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const translation = this.getNestedTranslation(key);
                if (translation) {
                    // If it's one of our custom elements, call its updateTranslation method
                    // @ts-ignore
                    if (typeof el.updateTranslation === 'function') {
                        // @ts-ignore
                        el.updateTranslation(key);
                    } else {
                        el.textContent = translation;
                    }
                }
            }
        });

        const placeholders = root.querySelectorAll('[data-i18n-placeholder]');
        placeholders.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                const translation = this.getNestedTranslation(key);
                if (translation) {
                    // If it's one of our custom elements, call its updateTranslation method
                    // @ts-ignore
                    if (typeof el.updateTranslation === 'function') {
                        // @ts-ignore
                        el.updateTranslation(key);
                    } else {
                        (el as HTMLInputElement).placeholder = translation;
                    }
                }
            }
        });

        const titles = root.querySelectorAll('[data-i18n-title]');
        titles.forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                const translation = this.getNestedTranslation(key);
                if (translation) {
                    (el as HTMLElement).title = translation;
                }
            }
        });

        // If this is the main document, also try to translate shadow roots of custom elements
        if (root === document) {
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                // Handle custom elements that might not have data-i18n but need translation (like ApiSelector)
                // @ts-ignore
                if (typeof el.updateTranslation === 'function' && !el.hasAttribute('data-i18n') && !el.hasAttribute('data-i18n-placeholder')) {
                    // @ts-ignore
                    el.updateTranslation();
                }
                
                if (el.shadowRoot) {
                    this.applyTranslations(el.shadowRoot);
                }
            });
        }
    }

    private static getNestedTranslation(key: string) {
        return key.split('.').reduce((obj, i) => (obj ? obj[i] : null), this.translations);
    }
}
