import { ipcRenderer } from 'electron';
import { Config } from '../../shared/Config';

const template = document.createElement("template");

function defineTemplate(tempDefault: number, freqPenDefault: number, presPenDefault: number, topPDefault: number, ){
    return `
    <div id="div" class="border">
        <link rel="stylesheet" href="../../public/configWindow/config.css">
        <style>
            .param-group { display: flex; align-items: center; justify-content: space-between; }
            .param-group config-slider { flex-grow: 1; }
            .param-group input[type="checkbox"] { margin-left: 15px; transform: scale(1.2); }
        </style>
        <div class="param-group">
            <config-slider id="temp" confID="temperature" label="Temperature"  min="0" max="2" step="0.01" default="${tempDefault}"></config-slider>
            <input type="checkbox" id="temp-enabled" />
        </div>
        <div class="param-group">
            <config-slider id="freqPen" confID="frequency_penalty" label="Frequency Penalty"  min="-2" max="2" step="0.01" default="${freqPenDefault}"></config-slider>
            <input type="checkbox" id="freqPen-enabled" />
        </div>
        <div class="param-group">
            <config-slider id="presPen" confID="presence_penalty" label="Presence Penalty"  min="-2" max="2" step="0.01" default="${presPenDefault}"></config-slider>
            <input type="checkbox" id="presPen-enabled" />
        </div>
        <div class="param-group">
            <config-slider id="topP" confID="top_p" label="Top P"  min="0" max="1" step="0.01" default="${topPDefault}"></config-slider>
            <input type="checkbox" id="topP-enabled" />
        </div>
    </div>
    `
    
}

    

class ParametersBox extends HTMLElement{
    confID: string;
    shadow: any;

    tempDefault: number;
    freqPenDefault: number;
    presPenDefault: number;
    topPDefault: number;

    tempSlider: any;
    freqPenSlider: any;
    presPenSlider: any;
    topPSlider: any;

    tempEnabledCheckbox: HTMLInputElement;
    freqPenEnabledCheckbox: HTMLInputElement;
    presPenEnabledCheckbox: HTMLInputElement;
    topPEnabledCheckbox: HTMLInputElement;

    div: HTMLDivElement;

    constructor(){
        super();
        this.confID = this.getAttribute("confID")!;

        this.tempDefault = parseFloat(this.getAttribute("tempDefault")!);
        this.freqPenDefault = parseFloat(this.getAttribute("freqPenDefault")!);
        this.presPenDefault = parseFloat(this.getAttribute("presPenDefault")!);
        this.topPDefault = parseFloat(this.getAttribute("topPDefault")!);

        this.shadow = this.attachShadow({mode: "open"});
        template.innerHTML = defineTemplate(this.tempDefault, this.freqPenDefault, this.presPenDefault, this.topPDefault);
        this.shadow.append(template.content.cloneNode(true));

        this.tempSlider = this.shadow.querySelector("#temp");
        this.freqPenSlider = this.shadow.querySelector("#freqPen");
        this.presPenSlider = this.shadow.querySelector("#presPen");
        this.topPSlider = this.shadow.querySelector("#topP");

        this.tempEnabledCheckbox = this.shadow.querySelector('#temp-enabled');
        this.freqPenEnabledCheckbox = this.shadow.querySelector('#freqPen-enabled');
        this.presPenEnabledCheckbox = this.shadow.querySelector('#presPen-enabled');
        this.topPEnabledCheckbox = this.shadow.querySelector('#topP-enabled');

        this.div = this.shadow.querySelector("#div");

        

    }


    static get observedAttributes(){
        return ["confID", "tempDefault", "freqPenDefault", "presPenDefault", "topPDefault"]
    }

    async connectedCallback(){
        const confID: string = this.confID;

        let config = await ipcRenderer.invoke('get-config');

        //@ts-ignore
        let values = config[confID]["parameters"];

        this.tempSlider.changeValue(values.temperature);
        this.freqPenSlider.changeValue(values.frequency_penalty);
        this.presPenSlider.changeValue(values.presence_penalty);
        this.topPSlider.changeValue(values.top_p);

        this.tempEnabledCheckbox.checked = values.enableTemperature;
        this.freqPenEnabledCheckbox.checked = values.enableFrequencyPenalty;
        this.presPenEnabledCheckbox.checked = values.enablePresencePenalty;
        this.topPEnabledCheckbox.checked = values.enableTopP;

        this.toggleSlider(this.tempSlider, this.tempEnabledCheckbox.checked);
        this.toggleSlider(this.freqPenSlider, this.freqPenEnabledCheckbox.checked);
        this.toggleSlider(this.presPenSlider, this.presPenEnabledCheckbox.checked);
        this.toggleSlider(this.topPSlider, this.topPEnabledCheckbox.checked);

        const allSliders = [this.tempSlider, this.freqPenSlider, this.presPenSlider, this.topPSlider];
        allSliders.forEach(slider => {
            slider.slider.addEventListener("change", () => this.saveParameters());
            slider.number.addEventListener("change", () => this.saveParameters());
            slider.button.addEventListener("click", () => this.saveParameters());
        });

        this.tempEnabledCheckbox.addEventListener('change', () => {
            this.toggleSlider(this.tempSlider, this.tempEnabledCheckbox.checked);
            this.saveParameters();
        });
        this.freqPenEnabledCheckbox.addEventListener('change', () => {
            this.toggleSlider(this.freqPenSlider, this.freqPenEnabledCheckbox.checked);
            this.saveParameters();
        });
        this.presPenEnabledCheckbox.addEventListener('change', () => {
            this.toggleSlider(this.presPenSlider, this.presPenEnabledCheckbox.checked);
            this.saveParameters();
        });
        this.topPEnabledCheckbox.addEventListener('change', () => {
            this.toggleSlider(this.topPSlider, this.topPEnabledCheckbox.checked);
            this.saveParameters();
        });
    }

    toggleSlider(sliderElement: any, isEnabled: boolean) {
        sliderElement.style.opacity = isEnabled ? "1" : "0.5";
        sliderElement.slider.disabled = !isEnabled;
        sliderElement.number.disabled = !isEnabled;
    }

    saveParameters() {
        const newParameters = {
            temperature: parseFloat(this.tempSlider.slider.value),
            enableTemperature: this.tempEnabledCheckbox.checked,
            frequency_penalty: parseFloat(this.freqPenSlider.slider.value),
            enableFrequencyPenalty: this.freqPenEnabledCheckbox.checked,
            presence_penalty: parseFloat(this.presPenSlider.slider.value),
            enablePresencePenalty: this.presPenEnabledCheckbox.checked,
            top_p: parseFloat(this.topPSlider.slider.value),
            enableTopP: this.topPEnabledCheckbox.checked,
        };
        ipcRenderer.send('config-change-nested', this.confID, "parameters", newParameters);
    }
}




customElements.define("parameters-box", ParametersBox);
