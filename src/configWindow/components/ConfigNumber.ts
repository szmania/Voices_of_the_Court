import { ipcRenderer } from 'electron';
import { Config } from '../../shared/Config';

const template = document.createElement("template");

function defineTemplate(label: string, min: number, max: number, step: number){
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <style>
        input {
            width: 100%;
            box-sizing: border-box;
        }
    </style>
    <label for="awd">${label}</label><br>
    <input type="number" name="awd" min=${min} max=${max} step=${step}>`
    
}

    

class ConfigNumber extends HTMLElement{
    label: string;
    confID: string;
    shadow: any;
    input: any;
    labelElement: any;
    min: number;
    max: number;
    step: number;

    constructor(){
        super();
        this.label = this.getAttribute("label") || "";
        this.confID = this.getAttribute("confID")!;
        this.min =  parseFloat(this.getAttribute("min")!);
        this.max = parseFloat(this.getAttribute("max")!);
        this.step = parseFloat(this.getAttribute("step")!) || 1;

        this.shadow = this.attachShadow({mode: "open"});
        template.innerHTML = defineTemplate(this.label, this.min, this.max, this.step);
        this.shadow.append(template.content.cloneNode(true));
        this.input = this.shadow.querySelector("input");
        this.labelElement = this.shadow.querySelector("label");
    }


    static get observedAttributes(){
        return ["name", "confID", "label", "min", "max", "data-i18n"]
    }

    async connectedCallback(){
        const confID: string = this.confID;

        let config = await ipcRenderer.invoke('get-config');

        //@ts-ignore
        this.input.value = config[confID];

        this.input.addEventListener("change", (e: any) => {
            console.log(confID)

            ipcRenderer.send('config-change', confID, parseFloat(this.input.value));
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




customElements.define("config-number", ConfigNumber);