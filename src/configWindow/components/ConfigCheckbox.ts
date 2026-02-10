import {ipcRenderer } from 'electron';
import { Config } from '../../shared/Config';

const template = document.createElement("template");

function defineTemplate(label: string){
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <style>
    </style>
    <input type="checkbox" name="awd" id="checkbox">
    <label for="awd">${label}</label>`
}

    

class ConfigCheckbox extends HTMLElement{
    label: string;
    confID: string;
    shadow: any;
    checkbox: any;
    labelElement: any;

    constructor(){
        super();
        this.label = this.getAttribute("label") || "";
        this.confID = this.getAttribute("confID")!;

        this.shadow = this.attachShadow({mode: "open"});
        template.innerHTML = defineTemplate(this.label);
        this.shadow.append(template.content.cloneNode(true));
        this.checkbox = this.shadow.querySelector("input");
        this.labelElement = this.shadow.querySelector("label");
    }


    static get observedAttributes(){
        return ["name", "confID", "label", "data-i18n"]
    }

    async connectedCallback(){
        const confID: string = this.confID;

        let config = await ipcRenderer.invoke('get-config');

        //@ts-ignore
        this.checkbox.checked = config[confID] !== undefined ? config[confID] : true; // Default to true

        this.checkbox.addEventListener("change", (e: any) => {
            console.log(confID)

            ipcRenderer.send('config-change', confID, this.checkbox.checked);
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
                this.labelElement.textContent = translation;
            }
        }
    }
}




customElements.define("config-checkbox", ConfigCheckbox);
