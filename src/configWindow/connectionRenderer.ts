import { ipcRenderer} from 'electron';
import os from 'os';
import fs from 'fs';
import path from 'path';

let runPathButton: HTMLSelectElement = document.querySelector("#run-path-button")!;
let runPathInput: HTMLSelectElement = document.querySelector("#run-path-input")!;

let config;

document.getElementById("container")!.style.display = "block";

init();

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

async function init(){
    // 应用初始主题
    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    applyTheme(savedTheme);

    //@ts-ignore
    config = await ipcRenderer.invoke('get-config');

    // 初始化语言
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(config.language || 'en');
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }
    console.log(await ipcRenderer.invoke('get-config'))

    console.log(config)
    //init
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

}










