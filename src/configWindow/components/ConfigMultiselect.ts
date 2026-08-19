import { ipcRenderer } from 'electron';

const multiSelectTemplate = document.createElement("template");

function defineMultiSelectTemplate(label: string, options: string[]) {
    const optionsHtml = options.map(opt => `
        <div>
            <input type="checkbox" id="checkbox-${opt}" value="${opt}">
            <label for="checkbox-${opt}">${opt}</label>
        </div>
    `).join('');
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <div>
        <label>${label}</label><br>
        <div id="checkbox-container">${optionsHtml}</div>
    </div>
    `;
}

class ConfigMultiselect extends HTMLElement {
    shadow: ShadowRoot;
    confID: string;
    options: string[];

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: "open" });
        const label = this.getAttribute("label") || "";
        this.options = (this.getAttribute("options") || "").split(',');
        this.confID = this.getAttribute("confID")!;
        
        multiSelectTemplate.innerHTML = defineMultiSelectTemplate(label, this.options);
        this.shadow.append(multiSelectTemplate.content.cloneNode(true));
    }

    async connectedCallback() {
        let config = await ipcRenderer.invoke('get-config');
        
        //@ts-ignore
        const values = config[this.confID] || [];
        this.options.forEach(opt => {
            const checkbox = this.shadow.querySelector(`#checkbox-${opt}`) as HTMLInputElement;
            if (checkbox) {
                checkbox.checked = values.includes(opt);
                checkbox.addEventListener("change", () => this.onSelectionChange());
            }
        });
    }

    onSelectionChange() {
        const selectedValues = this.options.filter(opt => {
            const checkbox = this.shadow.querySelector(`#checkbox-${opt}`) as HTMLInputElement;
            return checkbox && checkbox.checked;
        });
        ipcRenderer.send('config-change', this.confID, selectedValues);
    }
}

customElements.define("config-multiselect", ConfigMultiselect);