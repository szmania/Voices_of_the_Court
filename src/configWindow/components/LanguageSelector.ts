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
                <button class="dropbtn" id="current-language-btn">${lang === 'en' ? '🇬🇧 English' : '🇨🇳 中文'}</button>
                <div class="dropdown-content" id="language-dropdown">
                    <a href="#" data-lang="en">🇬🇧 English</a>
                    <a href="#" data-lang="zh">🇨🇳 中文</a>
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
        btn.innerHTML = lang === 'en' ? '🇬🇧 English' : '🇨🇳 中文';
    }

    async updateLanguage(lang: 'en' | 'zh', btn: HTMLElement) {
        this.updateButtonText(btn, lang);
        ipcRenderer.send('config-change', 'language', lang);
        ipcRenderer.send('language-changed', lang);

        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            await window.LocalizationManager.loadTranslations(lang);
        }
    }
}

customElements.define('language-selector', LanguageSelector);