import { ipcRenderer} from 'electron';

//@ts-ignore
let useConnectionAPI: HTMLElement = document.querySelector("#use-connection-api")!.checkbox;

let apiSelector: HTMLElement = document.querySelector("#api-selector")!;


//init
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

async function init(){
    // 应用初始主题
    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    applyTheme(savedTheme);

    let config = await ipcRenderer.invoke('get-config');

    toggleApiSelector();

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