import { ipcRenderer } from 'electron';

class LanguageSelector extends HTMLElement {
    constructor() {
        super();
    }

    async connectedCallback() {
        this.innerHTML = `
            <li class="language-selector">
                <div class="dropdown">
                    <button class="dropbtn" id="current-language-btn">🇺🇸 English</button>
                    <div class="dropdown-content" id="language-dropdown">
                        <a href="#" data-lang="en">🇺🇸 English</a>
                        <a href="#" data-lang="zh">🇨🇳 中文</a>
                    </div>
                </div>
            </li>
        `;

        const currentLanguageBtn = this.querySelector('#current-language-btn') as HTMLElement;
        const languageDropdown = this.querySelector('#language-dropdown') as HTMLElement;

        const config = await ipcRenderer.invoke('get-config');
        const lang = config.language || 'en';
        this.updateButtonText(currentLanguageBtn, lang);

        languageDropdown.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const selectedLang = link.getAttribute('data-lang') as 'en' | 'zh';
                this.updateLanguage(selectedLang, currentLanguageBtn);
            });
        });
    }

    updateButtonText(btn: HTMLElement, lang: string) {
        btn.innerText = lang === 'en' ? '🇺🇸 English' : '🇨🇳 中文';
    }

    async updateLanguage(lang: 'en' | 'zh', btn: HTMLElement) {
        this.updateButtonText(btn, lang);
        ipcRenderer.send('config-change', 'language', lang);

        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            await window.LocalizationManager.loadTranslations(lang);
        }
    }
}

customElements.define('language-selector', LanguageSelector);