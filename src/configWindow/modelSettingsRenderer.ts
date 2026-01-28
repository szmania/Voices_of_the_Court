
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

// 应用初始主题
const savedTheme = localStorage.getItem('selectedTheme') || 'original';
applyTheme(savedTheme);