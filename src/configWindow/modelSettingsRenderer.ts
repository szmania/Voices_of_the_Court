
import { ipcRenderer } from 'electron';

document.getElementById("container")!.style.display = "block";

// 应用主题函数
function applyTheme(theme: string) {
    const body = document.querySelector('body');
    if (body) {
        body.classList.remove('theme-original', 'theme-chinese', 'theme-west');
        body.classList.add(`theme-${theme}`);
    }
}

// 监听主题更新
ipcRenderer.on('update-theme', (event, theme) => {
    applyTheme(theme);
    localStorage.setItem('selectedTheme', theme);
});

// 监听语言更新
ipcRenderer.on('update-language', async (event, lang) => {
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(lang);
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }
});

// 应用初始主题
const savedTheme = localStorage.getItem('selectedTheme') || 'original';
applyTheme(savedTheme);

addExternalLinks();

// 初始化语言
async function initLocalization() {
    const config = await ipcRenderer.invoke('get-config');
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(config.language || 'en');
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }
}

initLocalization();

function addExternalLinks() {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        if (navbar.querySelector('.social-links')) return;
        const socialLinks = document.createElement('div');
        socialLinks.className = 'social-links';
        socialLinks.innerHTML = `
            <a href="https://discord.gg/UQpE4mJSqZ" target="_blank" class="social-link" title="Join our Discord">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 127.14 96.36" fill="currentColor"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C-1.7,23.26-3.43,46.58,5.09,68.13A121.3,121.3,0,0,0,24.4,89.57,103.39,103.39,0,0,0,40.51,96.36c2.41-2.59,4.35-5.23,5.92-8-2.58-.53-5.1-1.12-7.52-1.85a72.28,72.28,0,0,1-14.52-7.4,81.23,81.23,0,0,1-10-9.45A77.33,77.33,0,0,1,9,68.13c-1.48-4.42-1.6-8.87-1.15-13.21,2.12-11.2,7.59-21.19,16.52-28.25,10.13-7.71,21.38-11.41,32.73-11.41,6.43,0,12.6.68,18.49,1.9,2.29-5.74,5-10.84,8.22-15.21-10.22-2.18-20.6-2.48-30.85-.83-1.82.3-3.65.64-5.45,1-2.58,3.4-4.8,7.13-6.58,11-1.27,2.73-2.4,5.54-3.43,8.44a53.13,53.13,0,0,1-3.19,7.87c-.45,1.12-.89,2.24-1.32,3.36a49.48,49.48,0,0,0-1.58,4.5,5.4,5.4,0,0,0-1.19,4.48,9.8,9.8,0,0,0,3.43,5.61c2.39,1.84,5.6,2.16,8.62,1.16,2.94-1,5.1-3.24,6.27-6.1,1.4-3.32,1.56-6.91.45-10.31a42.36,42.36,0,0,0-3.36-9.69,46.34,46.34,0,0,0-4.5-8.86,44.7,44.7,0,0,0-4.48-7.41,5.1,5.1,0,0,1-1.81-5.06,5,5,0,0,1,4.15-4.21c5.43-.93,10.89.3,15.8,2.2,1.79.7,3.54,1.45,5.28,2.24,10.53,4.82,19.09,12.46,24.4,22.52,3.43,6.52,5.16,13.8,5.16,21.34,0,10.44-2.58,20.43-7.66,29.58-2.84,5.16-6.45,9.68-10.74,13.45-11.58,9.9-26.5,15.39-42,15.82,3.51,2.52,7.32,4.36,11.36,5.42,1.8.48,3.62.92,5.45,1.3,3.13,2.4,6,5.16,8.28,8.29,9.25-2.16,18.06-5.4,26.1-9.81,2.29-1.27,4.5-2.6,6.63-4,1.81-1.2,3.54-2.48,5.16-3.8a95.64,95.64,0,0,0,19.42-20.53c.23-.42.44-.84.65-1.27,2.1-4.54,3.52-9.25,4.21-14.07.78-5.54.7-11.11-.23-16.61-1.49-8.7-5.16-16.86-10.74-24.09-2.37-3-5-5.8-7.8-8.37a105.8,105.8,0,0,0-19.45-10.4Z"/><path d="M45.8,45.62c-1.79,0-3.24-1.46-3.24-3.25s1.45-3.25,3.24-3.25,3.24,1.46,3.24,3.25S47.59,45.62,45.8,45.62Z"/><path d="M81.32,45.62c-1.79,0-3.24-1.46-3.24-3.25s1.45-3.25,3.24-3.25,3.24,1.46,3.24,3.25S83.11,45.62,81.32,45.62Z"/></svg>
            </a>
            <a href="https://votc-ce.vercel.app/" target="_blank" class="social-link" title="Visit our Website">🌐</a>
        `;
        navbar.prepend(socialLinks);
    }
}
