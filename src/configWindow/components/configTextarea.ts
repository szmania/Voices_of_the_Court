import {ipcRenderer } from 'electron';
import { Config } from '../../shared/Config';
const template = document.createElement("template");

function defineTemplate(rows: number, cols: number, placeholder: string){
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <style>
    </style>
    <textarea id="prompt" rows="${rows}" cols="${cols}" placeholder="${placeholder}">
        
    </textarea>
    
    `

    
}

    

class ConfigTextarea extends HTMLElement{
    confID: string;
    shadow: any;
    textarea: HTMLTextAreaElement;
    rows: number;
    cols: number;
    placeholder: string

    constructor(){
        super();
        this.confID = this.getAttribute("confID") || "";
        this.rows = parseInt(this.getAttribute("rows") || "4");
        this.cols = parseInt(this.getAttribute("cols") || "20");
        this.placeholder = this.getAttribute("placeholder") || "";

        this.shadow = this.attachShadow({mode: "open"});
        template.innerHTML = defineTemplate(this.rows, this.cols, this.placeholder);
        this.shadow.append(template.content.cloneNode(true));
        this.textarea = this.shadow.querySelector('#prompt');

        

    }


    static get observedAttributes(){
        return ["confID", "rows", "cols", "placeholder"]
    }

    async connectedCallback(){
        const confID: string = this.confID;
        const promptKeys = [
            'mainPrompt', 
            'summarizePrompt', 
            'memoriesPrompt', 
            'suffixPrompt', 
            'selfTalkPrompt', 
            'selfTalkSummarizePrompt', 
            'narrativePrompt', 
            'sceneDescriptionPrompt'
        ];

        let config = await ipcRenderer.invoke('get-config');

        //@ts-ignore
        if (promptKeys.includes(confID)) {
            this.textarea.value = config.prompts[config.language][confID];
        } else {
            this.textarea.value = config[confID];
        }

        this.textarea.addEventListener("change", (e: any) => {
            console.log(confID)

            ipcRenderer.send('config-change', confID, this.textarea.value);
        });

        // Listen for language changes to refresh prompt content
        ipcRenderer.on('update-language', async () => {
            let config = await ipcRenderer.invoke('get-config');
            //@ts-ignore
            if (promptKeys.includes(confID)) {
                this.textarea.value = config.prompts[config.language][confID];
            } else {
                this.textarea.value = config[confID];
            }
        });

        // Handle localization
        const i18nKey = this.getAttribute('data-i18n');
        if (i18nKey) {
            this.updateTranslation(i18nKey);
            
            // Listen for language changes for label/placeholder
            ipcRenderer.on('update-language', () => {
                this.updateTranslation(i18nKey);
            });
        }
    }

    public updateTranslation(key: string) {
        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            const translation = window.LocalizationManager.getNestedTranslation(key);
            if (translation) {
                this.textarea.placeholder = translation;
            } else if (this.placeholder) {
                this.textarea.placeholder = this.placeholder;
            }
        } else if (this.placeholder) {
            this.textarea.placeholder = this.placeholder;
        }
    }
}




customElements.define("config-textarea", ConfigTextarea);