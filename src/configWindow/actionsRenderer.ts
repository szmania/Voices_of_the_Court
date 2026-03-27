import { ipcRenderer} from 'electron';
import fs, { createReadStream } from 'fs';
import path from 'path';
import { Config } from '../shared/Config';

//@ts-ignore
let enableActions: HTMLElement = document.querySelector("#enable-actions").checkbox;
let actions: HTMLElement = document.querySelector("#actions")!;
//@ts-ignore
let useConnectionAPI: HTMLElement = document.querySelector("#use-connection-api")!.checkbox;
let apiSelector: HTMLElement = document.querySelector("#api-selector")!;

let actionsDiv: HTMLDivElement = document.querySelector("#actions-group")!;
let actionDescriptorDiv: HTMLDivElement = document.querySelector("#action-descriptor")!;

let refreshactionsButton: HTMLButtonElement = document.querySelector("#refresh-actions")!;

let config: Config;
let disabledActions:string[];
let actionsPath: string;

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
    if (config) {
        config.language = lang;
        loadactions();
    }
});

async function init(){
    addExternalLinks();
    // 应用初始主题
    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    applyTheme(savedTheme);

    config = await ipcRenderer.invoke('get-config');

    // 初始化语言
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(config.language || 'en');
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }

    
     disabledActions= config!.disabledActions;

    loadactions();

    refreshactionsButton.addEventListener('click', ()=>{
        loadactions();
    })

    let userDataPath = await ipcRenderer.invoke('get-userdata-path');
    
    actionsPath = path.join(userDataPath, 'scripts', 'actions');


        //init
    toggleApiSelector();
    toggleActions();

    enableActions.addEventListener('change', () =>{
        
        toggleActions();
    })

    useConnectionAPI.addEventListener('change', () =>{
        
        toggleApiSelector();
    })

}




function toggleApiSelector(){
    //@ts-ignore
    if(useConnectionAPI.checked){
        apiSelector.style.opacity = "0.5";
        apiSelector.style.pointerEvents = "none";
    }
    else{
        apiSelector.style.opacity = "1";
        apiSelector.style.pointerEvents = "auto";
    }
}

function toggleActions(){
    //@ts-ignore
    if(!enableActions.checked){
        actions.style.opacity = "0.5";
        actions.style.pointerEvents = "none";
    }
    else{
        actions.style.opacity = "1";
        actions.style.pointerEvents = "auto";
    }
}


//interaction selects







async function loadactions(){

    actionsDiv.replaceChildren();

    await sleep(250)
    let standardFileNames = fs.readdirSync(path.join(actionsPath, 'standard')).filter(file => path.extname(file) === '.js'); 
    let customFileNames = fs.readdirSync(path.join(actionsPath, 'custom')).filter(file => path.extname(file) === '.js'); 
    
    for(const fileName of standardFileNames){   
        let file  = require(path.join(actionsPath, 'standard', fileName));
        
        let element = document.createElement("div");

        let isChecked = !disabledActions.includes(file.signature);

        let title = file.signature;
        if (file.titleKey) {
            title = (window as any).LocalizationManager?.getNestedTranslation(file.titleKey) || file.signature;
        } else if (file.title) {
            if (typeof file.title === 'object') {
                title = file.title[config.language] || file.title['en'] || file.signature;
            } else {
                title = file.title;
            }
        }

        element.innerHTML = `
        <input type="checkbox" id="${file.signature}" ${isChecked? "checked" : ""}>
        <label>${title}</label>
        `

        actionsDiv.appendChild(element);

        element.addEventListener("change", (e: any)=>{
            //@ts-ignore
            if(element.querySelector(`#${file.signature}`)!.checked == false){
                console.log("dsa")
                if(!disabledActions.includes(file.signature)){
                    disabledActions.push(file.signature);
                }
            }
            else{
                //@ts-ignore
                disabledActions = disabledActions.filter(e => e !== file.signature);
            }
            console.log(disabledActions)
            ipcRenderer.send('config-change', "disabledActions", disabledActions);
        });

        let creatorString = "";
        
        element.addEventListener("mouseenter", (e: any)=>{
            let description = file.description;
            if (typeof description === 'object') {
                description = description[config.language] || description['en'] || Object.values(description)[0];
            }

            let title = file.signature;
            if (file.titleKey) {
                title = (window as any).LocalizationManager?.getNestedTranslation(file.titleKey) || file.signature;
            } else if (file.title) {
                if (typeof file.title === 'object') {
                    title = file.title[config.language] || file.title['en'] || file.signature;
                } else {
                    title = file.title;
                }
            }

            const descLabel = (window as any).LocalizationManager?.getNestedTranslation('actions.description') || "Description:";
            const madeByLabel = (window as any).LocalizationManager?.getNestedTranslation('actions.made_by') || "Made by:";
            
            if(file.creator){
                creatorString = `<li class="action-item"><b>${madeByLabel}</b> ${file.creator}</li>`;
            }

            actionDescriptorDiv.innerHTML = `
            <div id="action-descriptor-content">
                <h3>${title}</h3>
                <ul>
                    <li class="action-item"><b>${descLabel}</b> ${description}</li>
                    ${creatorString}
                </ul>
            </div>
            <div class="action-file-opener">
                <button id="open-action-file-btn"></button>
            </div>
            `;

            const openFileBtn = document.getElementById('open-action-file-btn') as HTMLButtonElement;
            if (openFileBtn) {
                openFileBtn.textContent = (window as any).LocalizationManager?.getNestedTranslation('actions.open_file') || "Open File";
                openFileBtn.addEventListener('click', () => {
                    ipcRenderer.send('open-action-file', path.join(actionsPath, 'standard', fileName));
                });
            }
        });
    }

    for(const fileName of customFileNames){   
        let file  = require(path.join(actionsPath, 'custom', fileName));
        
        let element = document.createElement("div");

        let isChecked = !disabledActions.includes(file.signature);

        let title = file.signature;
        if (file.titleKey) {
            title = (window as any).LocalizationManager?.getNestedTranslation(file.titleKey) || file.signature;
        } else if (file.title) {
            if (typeof file.title === 'object') {
                title = file.title[config.language] || file.title['en'] || file.signature;
            } else {
                title = file.title;
            }
        }

        element.innerHTML = `
        <input type="checkbox" id="${file.signature}" ${isChecked? "checked" : ""}>
        <label>${title}</label>
        `

        actionsDiv.appendChild(element);

        element.addEventListener("change", (e: any)=>{
            //@ts-ignore
            if(element.querySelector(`#${file.signature}`)!.checked == false){
                console.log("dsa")
                if(!disabledActions.includes(file.signature)){
                    disabledActions.push(file.signature);
                }
            }
            else{
                //@ts-ignore
                disabledActions = disabledActions.filter(e => e !== file.signature);
            }
            console.log(disabledActions)
            ipcRenderer.send('config-change', "disabledActions", disabledActions);
        });     

        let creatorString = "";
        
        element.addEventListener("mouseenter", (e: any)=>{
            let description = file.description;
            if (typeof description === 'object') {
                description = description[config.language] || description['en'] || Object.values(description)[0];
            }

            let title = file.signature;
            if (file.titleKey) {
                title = (window as any).LocalizationManager?.getNestedTranslation(file.titleKey) || file.signature;
            } else if (file.title) {
                if (typeof file.title === 'object') {
                    title = file.title[config.language] || file.title['en'] || file.signature;
                } else {
                    title = file.title;
                }
            }

            const descLabel = (window as any).LocalizationManager?.getNestedTranslation('actions.description') || "Description:";
            const madeByLabel = (window as any).LocalizationManager?.getNestedTranslation('actions.made_by') || "Made by:";
            
            if(file.creator){
                creatorString = `<li class="action-item"><b>${madeByLabel}</b> ${file.creator}</li>`;
            }

            actionDescriptorDiv.innerHTML = `
            <div id="action-descriptor-content">
                <h3>${title}</h3>
                <ul>
                    <li class="action-item"><b>${descLabel}</b> ${description}</li>
                    ${creatorString}
                </ul>
            </div>
            <div class="action-file-opener">
                <button id="open-action-file-btn"></button>
            </div>
            `;

            const openFileBtn = document.getElementById('open-action-file-btn') as HTMLButtonElement;
            if (openFileBtn) {
                openFileBtn.textContent = (window as any).LocalizationManager?.getNestedTranslation('actions.open_file') || "Open File";
                openFileBtn.addEventListener('click', () => {
                    ipcRenderer.send('open-action-file', path.join(actionsPath, 'custom', fileName));
                });
            }
        });
    }
}



function sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

function addExternalLinks() {
    const navbarUl = document.querySelector('.navbar ul');
    if (navbarUl) {
        if (navbarUl.querySelector('.social-links-li')) return;
        const socialLinksLi = document.createElement('li');
        socialLinksLi.className = 'social-links-li';
        socialLinksLi.innerHTML = `
            <a href="https://discord.gg/UQpE4mJSqZ" target="_blank" class="social-link discord-link" data-i18n-title="nav.discord_tooltip">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512" fill="currentColor"><path d="m386 137c-24-11-49.5-19-76.3-23.7c-.5 0-1 0-1.2.6c-3.3 5.9-7 13.5-9.5 19.5c-29-4.3-57.5-4.3-85.7 0c-2.6-6.2-6.3-13.7-10-19.5c-.3-.4-.7-.7-1.2-.6c-23 4.6-52.4 13-76 23.7c-.2 0-.4.2-.5.4c-49 73-62 143-55 213c0 .3.2.7.5 1c32 23.6 63 38 93.6 47.3c.5 0 1 0 1.3-.4c7.2-9.8 13.6-20.2 19.2-31.2c.3-.6 0-1.4-.7-1.6c-10-4-20-8.6-29.3-14c-.7-.4-.8-1.5 0-2c2-1.5 4-3 5.8-4.5c.3-.3.8-.3 1.2-.2c61.4 28 128 28 188 0c.4-.2.9-.1 1.2.1c1.9 1.6 3.8 3.1 5.8 4.6c.7.5.6 1.6 0 2c-9.3 5.5-19 10-29.3 14c-.7.3-1 1-.6 1.7c5.6 11 12.1 21.3 19 31c.3.4.8.6 1.3.4c30.6-9.5 61.7-23.8 93.8-47.3c.3-.2.5-.5.5-1c7.8-80.9-13.1-151-55.4-213c0-.2-.3-.4-.5-.4Zm-192 171c-19 0-34-17-34-38c0-21 15-38 34-38c19 0 34 17 34 38c0 21-15 38-34 38zm125 0c-19 0-34-17-34-38c0-21 15-38 34-38c19 0 34 17 34 38c0 21-15 38-34 38z"/></svg>
            </a>
            <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139" target="_blank" class="social-link steam-link" data-i18n-title="nav.steam_tooltip">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M8.15,8.15L11.85,9.5L11.25,11.25L10.5,11.5L9.6,10.65L8.15,11.4L9,12.25L8.25,13.05L6,12.25V11.5L8.15,8.15M14.5,9.5A2.5,2.5 0 0,1 17,12A2.5,2.5 0 0,1 14.5,14.5A2.5,2.5 0 0,1 12,12A2.5,2.5 0 0,1 14.5,9.5M14.5,11A1,1 0 0,0 13.5,12A1,1 0 0,0 14.5,13A1,1 0 0,0 15.5,12A1,1 0 0,0 14.5,11Z" /></svg>
            </a>
            <a href="https://votc-ce.vercel.app/" target="_blank" class="social-link website-link" data-i18n-title="nav.website_tooltip">🌐</a>
        `;
        navbarUl.prepend(socialLinksLi);
    }
}
