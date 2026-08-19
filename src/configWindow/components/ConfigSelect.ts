import { ipcRenderer } from 'electron';

const selectTemplate = document.createElement("template");

function defineSelectTemplate(label: string, options: string[]) {
    const optionsHtml = options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <div>
        <label for="select-element">${label}</label><br>
        <select id="select-element">${optionsHtml}</select>
    </div>
    `;
}

class ConfigSelect extends HTMLElement {
    shadow: ShadowRoot;
    selectElement: HTMLSelectElement;
    confID: string;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: "open" });
        const label = this.getAttribute("label") || "";
        const options = (this.getAttribute("options") || "").split(',');
        this.confID = this.getAttribute("confID")!;
        
        selectTemplate.innerHTML = defineSelectTemplate(label, options);
        this.shadow.append(selectTemplate.content.cloneNode(true));
        this.selectElement = this.shadow.querySelector("#select-element") as HTMLSelectElement;
    }

    async connectedCallback() {
        let config = await ipcRenderer.invoke('get-config');
        
        //@ts-ignore
        const value = config[this.confID];
        if (value !== undefined) {
            this.selectElement.value = value;
        }

        this.selectElement.addEventListener("change", () => {
            ipcRenderer.send('config-change', this.confID, this.selectElement.value);
        });
    }
}

customElements.define("config-select", ConfigSelect);