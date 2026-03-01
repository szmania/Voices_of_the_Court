import { ipcRenderer } from 'electron';

class LanguageSelector extends HTMLElement {
    private languages = [
        { code: 'en', name: 'English', flag: '🇬🇧' },
        { code: 'zh', name: '中文', flag: '🇨🇳' },
        { code: 'ru', name: 'Русский', flag: '🇷🇺' },
        { code: 'fr', name: 'Français', flag: '🇫🇷' },
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
        { code: 'ja', name: '日本語', flag: '🇯🇵' },
        { code: 'ko', name: '한국어', flag: '🇰🇷' },
        { code: 'pl', name: 'Polski', flag: '🇵🇱' }
    ];

    constructor() {
        super();
    }

    async connectedCallback() {
        const config = await ipcRenderer.invoke('get-config');
        const currentLangCode = config.language || 'en';
        const currentLang = this.languages.find(l => l.code === currentLangCode) || this.languages[0];

        this.innerHTML = `
            <div class="dropdown" data-i18n-title="nav.language_tooltip">
                <button class="dropbtn" id="current-language-btn">
                    ${this.getButtonContent(currentLang)}
                </button>
                <div class="dropdown-content" id="language-dropdown">
                    ${this.languages.map(lang => `
                        <a href="#" data-lang="${lang.code}">
                            <span class="lang-flag">${lang.flag}</span>
                            <span class="lang-text">${lang.name}</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.handleLanguageUpdates();
    }

    private getButtonContent(lang: { code: string; name: string; flag: string }): string {
        return `<span class="lang-flag">${lang.flag}</span> <span class="lang-text">${lang.name}</span>`;
    }

    private setupEventListeners() {
        const dropdown = this.querySelector('.dropdown');
        if (dropdown) {
            dropdown.addEventListener('click', () => dropdown.classList.toggle('active'));

            this.querySelectorAll('.dropdown-content a').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const langCode = link.getAttribute('data-lang');
                    if (langCode) {
                        this.updateLanguage(langCode);
                        dropdown.classList.remove('active');
                    }
                });
            });

            document.addEventListener('click', (e) => {
                if (!this.contains(e.target as Node)) {
                    dropdown.classList.remove('active');
                }
            });
        }
    }

    private handleLanguageUpdates() {
        ipcRenderer.on('update-language', (event, newLangCode: string) => {
            const btn = this.querySelector('#current-language-btn') as HTMLElement;
            const lang = this.languages.find(l => l.code === newLangCode) || this.languages[0];
            if (btn) {
                btn.innerHTML = this.getButtonContent(lang);
            }
        });
    }

    private async updateLanguage(langCode: string) {
        const lang = this.languages.find(l => l.code === langCode);
        if (lang) {
            const btn = this.querySelector('#current-language-btn') as HTMLElement;
            btn.innerHTML = this.getButtonContent(lang);

            ipcRenderer.send('config-change', 'language', lang.code);
            ipcRenderer.send('language-changed', lang.code);
        }
    }
}

customElements.define('language-selector', LanguageSelector);
