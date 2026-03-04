import { ipcRenderer} from 'electron';
import os from 'os';
import fs from 'fs';
import path from 'path';

let appVersionSpan: HTMLElement = document.querySelector("#app-version")!;
let updateButton: HTMLElement = document.querySelector("#update-button")!;
let clearSummariesButton: HTMLElement = document.querySelector("#clear-summaries")!;
let themeSelector: HTMLSelectElement = document.querySelector("#theme-selector")!;
let runPathButton: HTMLSelectElement = document.querySelector("#run-path-button")!;
let runPathInput: HTMLSelectElement = document.querySelector("#run-path-input")!;


document.getElementById("container")!.style.display = "block";

const version = require('../../package.json').version;
appVersionSpan.innerText = "Current app version: " + version;

updateButton.addEventListener('click', ()=>{
    ipcRenderer.send('update-app');
})

clearSummariesButton.addEventListener('click', ()=>{
    ipcRenderer.send('clear-summaries');
})

// 主题选择功能
themeSelector.addEventListener('change', (event) => {
    const selectedTheme = (event.target as HTMLSelectElement).value;
    applyTheme(selectedTheme);
    // 保存主题选择
    localStorage.setItem('selectedTheme', selectedTheme);
});

// 应用主题函数
function applyTheme(theme: string, broadcast: boolean = true) {
    // 应用到当前窗口
    const currentWindow = document.querySelector('body');
    if (currentWindow) {
        currentWindow.classList.remove('theme-original', 'theme-chinese', 'theme-west');
        if (theme === 'original') {
            currentWindow.classList.add('theme-original');
        } else if (theme === 'chinese') {
            currentWindow.classList.add('theme-chinese');
        } else if (theme === 'west') {
            currentWindow.classList.add('theme-west');
        }
    }
    
    if (broadcast) {
        // 通知其他窗口更新主题
        ipcRenderer.send('theme-changed', theme);
    }
}

// 监听来自主进程的主题更新通知
ipcRenderer.on('update-theme', (event, theme) => {
    themeSelector.value = theme;
    applyTheme(theme, false);
    localStorage.setItem('selectedTheme', theme);
});

// 页面加载时恢复之前的主题和语言选择
document.addEventListener('DOMContentLoaded', async () => {
    addExternalLinks();
    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    themeSelector.value = savedTheme;
    applyTheme(savedTheme);
    
    const config = await ipcRenderer.invoke('get-config');

    let userFolderPath = config!.userFolderPath;

    if(userFolderPath){
        runPathInput.value = userFolderPath;
    }
    else{
        let defaultPath = path.join(os.homedir(), 'Documents', 'Paradox Interactive', 'Crusader Kings III');

        if (fs.existsSync(defaultPath)) {
            runPathInput.value = defaultPath;
            config!.userFolderPath = defaultPath;
            ipcRenderer.send('config-change', "userFolderPath", runPathInput.value);
        }
        
    }

    runPathInput.addEventListener("change", (e: any) => {
        ipcRenderer.send('config-change', "userFolderPath", runPathInput.value);
    });

    runPathButton.addEventListener("click", async ()=>{
        ipcRenderer.send('select-user-folder');
    })

    ipcRenderer.on('select-user-folder-success', (event, path) =>{
        if(!path || path == "") return;

        runPathInput.value = path;
        ipcRenderer.send('config-change', "userFolderPath", runPathInput.value);
    })
    
    const lang = config.language || 'en';
    
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(lang);
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
        
        // Update version text with translation
        // @ts-ignore
        const translatedPrefix = window.LocalizationManager.getNestedTranslation('system.current_version');
        if (translatedPrefix) {
            appVersionSpan.innerText = translatedPrefix + version;
        }
    }
});

function addExternalLinks() {
    const navbarUl = document.querySelector('.navbar ul');
    if (navbarUl) {
        if (navbarUl.querySelector('.social-links-li')) return;
        const socialLinksLi = document.createElement('li');
        socialLinksLi.className = 'social-links-li';
        socialLinksLi.innerHTML = `
            <a href="https://discord.gg/UQpE4mJSqZ" target="_blank" class="social-link" data-i18n-title="nav.discord_tooltip">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 512 512" fill="currentColor"><path d="m386 137c-24-11-49.5-19-76.3-23.7c-.5 0-1 0-1.2.6c-3.3 5.9-7 13.5-9.5 19.5c-29-4.3-57.5-4.3-85.7 0c-2.6-6.2-6.3-13.7-10-19.5c-.3-.4-.7-.7-1.2-.6c-23 4.6-52.4 13-76 23.7c-.2 0-.4.2-.5.4c-49 73-62 143-55 213c0 .3.2.7.5 1c32 23.6 63 38 93.6 47.3c.5 0 1 0 1.3-.4c7.2-9.8 13.6-20.2 19.2-31.2c.3-.6 0-1.4-.7-1.6c-10-4-20-8.6-29.3-14c-.7-.4-.8-1.5 0-2c2-1.5 4-3 5.8-4.5c.3-.3.8-.3 1.2-.2c61.4 28 128 28 188 0c.4-.2.9-.1 1.2.1c1.9 1.6 3.8 3.1 5.8 4.6c.7.5.6 1.6 0 2c-9.3 5.5-19 10-29.3 14c-.7.3-1 1-.6 1.7c5.6 11 12.1 21.3 19 31c.3.4.8.6 1.3.4c30.6-9.5 61.7-23.8 93.8-47.3c.3-.2.5-.5.5-1c7.8-80.9-13.1-151-55.4-213c0-.2-.3-.4-.5-.4Zm-192 171c-19 0-34-17-34-38c0-21 15-38 34-38c19 0 34 17 34 38c0 21-15 38-34 38zm125 0c-19 0-34-17-34-38c0-21 15-38 34-38c19 0 34 17 34 38c0 21-15 38-34 38z"/></svg>
            </a>
            <a href="https://votc-ce.vercel.app/" target="_blank" class="social-link" data-i18n-title="nav.website_tooltip">🌐</a>
        `;
        navbarUl.prepend(socialLinksLi);
    }
}
