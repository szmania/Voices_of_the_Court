import { ipcRenderer } from 'electron';
import { Config } from '../../shared/Config';

const template = document.createElement("template");

function defineTemplate(label: string){
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <style>
    </style>
    <label for="awd">${label}</label><br>
    <input type="text" name="awd" style="width: 60%">`

}

class ConfigText extends HTMLElement{
    label: string;
    confID: string;
    shadow: any;
    input: any;
    default: string = '';

    constructor()

    constructor(){
        super();
        this.label = this.getAttribute("label") || "";
        this.confID = this.getAttribute("confID")!;

        this.shadow = this.attachShadow({mode: "open"});
        template.innerHTML = defineTemplate(this.label);
        this.shadow.append(template.content.cloneNode(true));
        this.input = this.shadow.querySelector("input");
    }


    static get observedAttributes(){
        return ["name", "confID", "label"]
    }
    private languageUpdateHandler: (() => void) | null = null;

    async connectedCallback(){
        const confID: string = this.confID;

        this.updateTranslation();

        this.languageUpdateHandler = () => this.updateTranslation();
        ipcRenderer.on('update-language', this.languageUpdateHandler);

        let config = await ipcRenderer.invoke('get-config');

        let value: any;
        if (confID.includes('.')) {
            const parts = confID.split('.');
            // @ts-ignore
            value = config[parts[0]] ? config[parts[0]][parts[1]] : undefined;
        } else {
            // @ts-ignore
            value = config[confID];
        }

        if(value !== undefined){
            this.changeValue(value);
        }
        else{
            this.changeValue(this.default);
        }

        this.input.addEventListener("change", (e: any) => {
            console.log(confID)

            ipcRenderer.send('config-change', confID, this.input.value);
        });
    }

    disconnectedCallback() {
        if (this.languageUpdateHandler) {
            ipcRenderer.removeListener('update-language', this.languageUpdateHandler);
        }
    }

    public changeValue(value: any): void {
        if (this.input) {
            this.input.value = value;
        }
    }
    public updateTranslation(key?: string) {
        const i18nKey = key || this.getAttribute('data-i18n');
        if (!i18nKey) return;

        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            const translation = window.LocalizationManager.getNestedTranslation(i18nKey);
            const labelElement = this.shadow.querySelector('label');
            if (translation) {
                if (labelElement) labelElement.textContent = translation;
            } else if (this.label) {
                if (labelElement) labelElement.textContent = this.label;
            }
        } else if (this.label) {
            const labelElement = this.shadow.querySelector('label');
            if (labelElement) labelElement.textContent = this.label;
        }
    }
}




customElements.define("config-text", ConfigText);
