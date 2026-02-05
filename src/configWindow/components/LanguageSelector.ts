import { ipcRenderer } from 'electron';

class LanguageSelector extends HTMLElement {
    constructor() {
        super();
    }

    private getFlagSvg(lang: string): string {
        if (lang === 'en') {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" width="20" height="10" style="margin-right: 8px; vertical-align: middle;">
                <clipPath id="s"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
                <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
                <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>
                <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="4"/>
                <path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/>
                <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/>
            </svg>`;
        } else {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="20" height="13.3" style="margin-right: 8px; vertical-align: middle;">
                <path d="M0,0 h30 v20 h-30 z" fill="#ee1c25"/>
                <path d="M5,5 l-0.94,2.91 -2.47,-1.79 2.47,-1.79 0.94,2.91 z" fill="#ffff00" transform="translate(0,0) scale(1.5)"/>
                <path d="M10,2 l-0.31,0.95 -0.81,-0.59 0.81,-0.59 0.31,0.95 z" fill="#ffff00" transform="rotate(-36.9,10,2)"/>
                <path d="M12,4 l-0.31,0.95 -0.81,-0.59 0.81,-0.59 0.31,0.95 z" fill="#ffff00" transform="rotate(-8.1,12,4)"/>
                <path d="M12,7 l-0.31,0.95 -0.81,-0.59 0.81,-0.59 0.31,0.95 z" fill="#ffff00" transform="rotate(20.5,12,7)"/>
                <path d="M10,9 l-0.31,0.95 -0.81,-0.59 0.81,-0.59 0.31,0.95 z" fill="#ffff00" transform="rotate(45,10,9)"/>
            </svg>`;
        } else if (lang === 'ru') {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="20" height="13.3" style="margin-right: 8px; vertical-align: middle;">
                <rect width="900" height="600" fill="#fff"/>
                <rect width="900" height="400" y="200" fill="#0039a6"/>
                <rect width="900" height="200" y="400" fill="#d52b1e"/>
            </svg>`;
        } else {
            return '';
        }
    }

    async connectedCallback() {
        const config = await ipcRenderer.invoke('get-config');
        const lang = config.language || 'en';

        ipcRenderer.on('update-language', async (event, newLang) => {
            const btn = this.querySelector('#current-language-btn') as HTMLElement;
            if (btn) {
                this.updateButtonText(btn, newLang);
            }
            // @ts-ignore
            if (window.LocalizationManager) {
                // @ts-ignore
                await window.LocalizationManager.loadTranslations(newLang);
                // @ts-ignore
                window.LocalizationManager.applyTranslations();
            }
        });

        this.innerHTML = `
            <div class="dropdown">
                <button class="dropbtn" id="current-language-btn">
                    ${this.getFlagSvg(lang)}
                    <span class="lang-text">${lang === 'en' ? 'English' : lang === 'zh' ? '中文' : 'Русский'}</span>
                </button>
                <div class="dropdown-content" id="language-dropdown">
                    <a href="#" data-lang="en">
                        ${this.getFlagSvg('en')}
                        <span class="lang-text">English</span>
                    </a>
                    <a href="#" data-lang="zh">
                        ${this.getFlagSvg('zh')}
                        <span class="lang-text">中文</span>
                    </a>
                    <a href="#" data-lang="ru">
                        ${this.getFlagSvg('ru')}
                        <span class="lang-text">Русский</span>
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
        const text = lang === 'en' ? 'English' : lang === 'zh' ? '中文' : 'Русский';
        btn.innerHTML = `
            ${this.getFlagSvg(lang)}
            <span class="lang-text">${text}</span>
        `;
    }

    async updateLanguage(lang: 'en' | 'zh' | 'ru', btn: HTMLElement) {
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
