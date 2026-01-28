import { ipcRenderer} from 'electron';

let appVersionSpan: HTMLElement = document.querySelector("#app-version")!;
let updateButton: HTMLElement = document.querySelector("#update-button")!;
let clearSummariesButton: HTMLElement = document.querySelector("#clear-summaries")!;
let themeSelector: HTMLSelectElement = document.querySelector("#theme-selector")!;


document.getElementById("container")!.style.display = "block";

appVersionSpan.innerText = "Current app version: "+require('../../package.json').version;

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
    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    themeSelector.value = savedTheme;
    applyTheme(savedTheme);
    
    const config = await ipcRenderer.invoke('get-config');
    const lang = config.language || 'en';
    
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(lang);
    }
});