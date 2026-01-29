import { ipcRenderer } from 'electron';

class LanguageSelector extends HTMLElement {
    constructor() {
        super();
    }

    async connectedCallback() {
        const config = await ipcRenderer.invoke('get-config');
        const lang = config.language || 'en';

        this.innerHTML = `
            <div class="dropdown">
                <button class="dropbtn" id="current-language-btn">
                    <span class="flag-icon" style="font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif; margin-right: 5px;">${lang === 'en' ? '🇬🇧' : '🇨🇳'}</span>
                    <span class="lang-text">${lang === 'en' ? 'English' : '中文'}</span>
                </button>
                <div class="dropdown-content" id="language-dropdown">
                    <a href="#" data-lang="en">
                        <span class="flag-icon" style="font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif; margin-right: 5px;">🇬🇧</span>
                        <span class="lang-text">English</span>
                    </a>
                    <a href="#" data-lang="zh">
                        <span class="flag-icon" style="font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif; margin-right: 5px;">🇨🇳</span>
                        <span class="lang-text">中文</span>
                    </a>
                </div>
            </div>
        `;

        const currentLanguageBtn = this.querySelector('#current-language-btn') as HTMLElement;
        const languageDropdown = this.querySelector('#language-dropdown') as HTMLElement;

        languageDropdown.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedLang = link.getAttribute('data-lang') as 'en' | 'zh';
                this.updateLanguage(selectedLang, currentLanguageBtn);
            });
        });
    }

    updateButtonText(btn: HTMLElement, lang: string) {
        const flag = lang === 'en' ? '🇬🇧' : '🇨🇳';
        const text = lang === 'en' ? 'English' : '中文';
        btn.innerHTML = `
            <span class="flag-icon" style="font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif; margin-right: 5px;">${flag}</span>
            <span class="lang-text">${text}</span>
        `;
    }

    async updateLanguage(lang: 'en' | 'zh', btn: HTMLElement) {
        this.updateButtonText(btn, lang);
        ipcRenderer.send('config-change', 'language', lang);
        ipcRenderer.send('language-changed', lang);

        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            await window.LocalizationManager.loadTranslations(lang);
            // @ts-ignore
            window.LocalizationManager.applyTranslations();
        }
    }
}

customElements.define('language-selector', LanguageSelector);