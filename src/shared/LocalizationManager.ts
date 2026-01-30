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

    static applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const translation = this.getNestedTranslation(key);
                if (translation) {
                    el.textContent = translation;
                }
            }
        });

        const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
        placeholders.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                const translation = this.getNestedTranslation(key);
                if (translation) {
                    (el as HTMLInputElement).placeholder = translation;
                }
            }
        });

        const titles = document.querySelectorAll('[data-i18n-title]');
        titles.forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                const translation = this.getNestedTranslation(key);
                if (translation) {
                    (el as HTMLElement).title = translation;
                }
            }
        });
    }

    private static getNestedTranslation(key: string) {
        return key.split('.').reduce((obj, i) => (obj ? obj[i] : null), this.translations);
    }
}
