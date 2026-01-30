import { ipcRenderer, shell } from 'electron';
import { Config } from '../../shared/Config';
import path from 'path';

const template = document.createElement("template");

function defineTemplate(path: string, label: string){
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <style>
    </style>
    <button type="button">${label}</button>
    `
}

    

class openFolderButton extends HTMLElement{
    path: string;
    label: string;
    shadow: any;
    button: any;

    constructor(){
        super();
        this.path = this.getAttribute("path")!;
        this.label = this.getAttribute("label")!;

        this.shadow = this.attachShadow({mode: "open"});
        template.innerHTML = defineTemplate(this.path, this.label);
        this.shadow.append(template.content.cloneNode(true));
        this.button = this.shadow.querySelector("button");

        

    }


    static get observedAttributes(){
        return ["name", "confID", "path", "label"]
    }

    async connectedCallback(){

       let userdataPath = await ipcRenderer.invoke('get-userdata-path');

        this.button.addEventListener("click", (e: any) => {
            
            
            //ipcRenderer.send('open-folder', this.path);
            shell.openPath(path.resolve(path.join(userdataPath, this.path)));
        }); 

        // Handle localization
        const i18nKey = this.getAttribute('data-i18n');
        if (i18nKey) {
            this.updateTranslation(i18nKey);
            
            // Listen for language changes
            ipcRenderer.on('update-language', () => {
                this.updateTranslation(i18nKey);
            });
        }
    }

    private updateTranslation(key: string) {
        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            const translation = window.LocalizationManager.getNestedTranslation(key);
            if (translation) {
                this.button.textContent = translation;
            }
        }
    }
}




customElements.define("open-folder-button", openFolderButton);