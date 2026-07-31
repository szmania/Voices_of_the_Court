import {ipcRenderer } from 'electron';
import { Config } from '../../shared/Config';

const template = document.createElement("template");

function defineTemplate(label: string, min: number, max: number, step: number){
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <style>
    </style>
    <div>
        <label for="awd" id="label">${label}</label><br>
        <input type="range" id="slider"  min=${min} max=${max} step=${step}>
        <input type="number" id="number" min=${min} max=${max} />
        <button type="button" id="button">Reset</button>
    </div>
    
    `

    
}

    
class ConfigSlider extends HTMLElement{
    label: string;
    confID: string;
    shadow: any;
    slider: any;
    number: any;
    button: any;
    min: number;
    max: number;
    default: number;
    step: number;
    private languageUpdateHandler: (() => void) | null = null;

    constructor(){
        super();
        this.label = this.getAttribute("label") || "";
        this.confID = this.getAttribute("confID")!;
        this.min =  parseFloat(this.getAttribute("min")!);
        this.max = parseFloat(this.getAttribute("max")!);
        this.step = parseFloat(this.getAttribute("step")!);
        this.default = parseFloat(this.getAttribute("default")!);

        this.shadow = this.attachShadow({mode: "open"});
        template.innerHTML = defineTemplate(this.label, this.min, this.max, this.step);
        this.shadow.append(template.content.cloneNode(true));
        this.slider = this.shadow.querySelector('#slider');
        this.number = this.shadow.querySelector("#number");
        this.button = this.shadow.querySelector("#button");

        

    }


    static get observedAttributes(){
        return ["confID", "label", "min", "max", "step", "default"]
    }

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

        this.slider.addEventListener("input", (e: any) => {
            this.number.value = this.slider.value;
        });
        this.slider.addEventListener("change", (e: any) => {
            this.number.value = this.slider.value;
            this.sendValue(this.slider.value);
        });

        this.number.addEventListener("change", (e: any) => {
            this.slider.value = this.number.value;
            this.sendValue(this.number.value);
        });

        this.button.addEventListener("click", (e: any) => {
            this.changeValue(this.default)
        });
    }

    disconnectedCallback() {
        if (this.languageUpdateHandler) {
            ipcRenderer.removeListener('update-language', this.languageUpdateHandler);
        }
    }

    sendValue(value: any) {
        const confID = this.confID;
        if (confID.includes('.')) {
            const parts = confID.split('.');
            const outerConfID = parts[0];
            const innerConfID = parts[1];
            ipcRenderer.send('config-change-nested', outerConfID, innerConfID, value);
        } else {
            ipcRenderer.send('config-change', confID, value);
        }
    }
    changeValue(newValue: number){
        this.slider.value = newValue;
        this.number.value = newValue;
    }

    public updateTranslation() {
        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            const translatedLabel = window.LocalizationManager.getNestedTranslation(`parameters.${this.confID}`);
            if (translatedLabel) {
                this.shadow.querySelector('#label').textContent = translatedLabel;
            } else if (this.label) {
                this.shadow.querySelector('#label').textContent = this.label;
            }
            // @ts-ignore
            const translatedReset = window.LocalizationManager.getNestedTranslation('parameters.reset');
            if (translatedReset) {
                this.button.textContent = translatedReset;
            }
        } else if (this.label) {
            this.shadow.querySelector('#label').textContent = this.label;
        }
    }
}
class ConfigSlider extends HTMLElement{
    label: string;
    confID: string;
    shadow: any;
    slider: any;
    number: any;
    button: any;
    min: number;
    max: number;
    default: number;
    step: number;

    constructor(){
        super();
        this.label = this.getAttribute("label") || "";
        this.confID = this.getAttribute("confID")!;
        this.min =  parseFloat(this.getAttribute("min")!);
        this.max = parseFloat(this.getAttribute("max")!);
        this.step = parseFloat(this.getAttribute("step")!);
        this.default = parseFloat(this.getAttribute("default")!);

        this.shadow = this.attachShadow({mode: "open"});
        template.innerHTML = defineTemplate(this.label, this.min, this.max, this.step);
        this.shadow.append(template.content.cloneNode(true));
        this.slider = this.shadow.querySelector('#slider');
        this.number = this.shadow.querySelector("#number");
        this.button = this.shadow.querySelector("#button");

        

    }


    static get observedAttributes(){
        return ["confID", "label", "min", "max", "step", "default"]
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

        this.slider.addEventListener("input", (e: any) => {
            this.number.value = this.slider.value;
        });
        this.slider.addEventListener("change", (e: any) => {
            this.number.value = this.slider.value;
            this.sendValue(this.slider.value);
        });

        this.number.addEventListener("change", (e: any) => {
            this.slider.value = this.number.value;
            this.sendValue(this.number.value);
        });

        this.button.addEventListener("click", (e: any) => {
            this.changeValue(this.default)
        });
    }

    disconnectedCallback() {
        if (this.languageUpdateHandler) {
            ipcRenderer.removeListener('update-language', this.languageUpdateHandler);
        }
    }
    async connectedCallback(){
        const confID: string = this.confID;

        this.updateTranslation();
        
        // Listen for language changes
        ipcRenderer.on('update-language', () => {
            this.updateTranslation();
        });

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

        this.slider.addEventListener("input", (e: any) => {
            this.number.value = this.slider.value;
        this.slider.addEventListener("change", (e: any) => {
            this.number.value = this.slider.value;
            this.sendValue(this.slider.value);
        });

            this.number.value = this.slider.value;

        });

        this.number.addEventListener("change", (e: any) => {
            this.slider.value = this.number.value;
            this.sendValue(this.number.value);
        });

        this.button.addEventListener("click", (e: any) => {
            this.changeValue(this.default)

        })
    }

    sendValue(value: any) {
        const confID = this.confID;
        if (confID.includes('.')) {
            const parts = confID.split('.');
            const outerConfID = parts[0];
            const innerConfID = parts[1];
            ipcRenderer.send('config-change-nested', outerConfID, innerConfID, value);
        } else {
            ipcRenderer.send('config-change', confID, value);
        }
    }
    changeValue(newValue: number){
        this.slider.value = newValue;
        this.number.value = newValue;
    }

    public updateTranslation() {
        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            const translatedLabel = window.LocalizationManager.getNestedTranslation(`parameters.${this.confID}`);
            if (translatedLabel) {
                this.shadow.querySelector('#label').textContent = translatedLabel;
            } else if (this.label) {
                this.shadow.querySelector('#label').textContent = this.label;
            }
            // @ts-ignore
            const translatedReset = window.LocalizationManager.getNestedTranslation('parameters.reset');
            if (translatedReset) {
                this.button.textContent = translatedReset;
            }
        } else if (this.label) {
            this.shadow.querySelector('#label').textContent = this.label;
        }
    }
}




customElements.define("config-slider", ConfigSlider);
