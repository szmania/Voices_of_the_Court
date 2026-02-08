import {ipcRenderer } from 'electron';
import { Config } from '../../shared/Config';
import { ApiConnection } from '../../shared/apiConnection';

const template = document.createElement("template");

function defineTemplate(label: string){
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <style>
    </style>
    
    <div class="input-group">
        <label for="connection-api" data-i18n="connection.api_label">API</label>
        <select name="connection-api" id="connection-api">
            <option value="openrouter" data-i18n="api.openrouter">OpenRouter</option>
            <option value="ooba" data-i18n="api.ooba">Text Gen WebUI (ooba)</option>
            <option value="openai" data-i18n="api.openai">OpenAI</option>
            <option value="gemini" data-i18n="api.gemini">Google Gemini</option>
            <option value="glm" data-i18n="api.glm">GLM</option>
            <option value="deepseek" data-i18n="api.deepseek">DeepSeek</option>
            <option value="grok" data-i18n="api.grok">Grok (xAI)</option>
            <option value="player2" data-i18n="api.player2">Player2</option>
            <option value="custom" data-i18n="api.custom">Custom (OpenAI-compatible)</option>
        </select> 
    </div>
    
    <div class="border">
        <div id="openrouter-menu">
            <h2 data-i18n="api.openrouter">OpenRouter</h2>

            <div class="input-group">
            <label for="api-key" data-i18n="connection.api_key">API Key</label>
            <br>
            <input type="password" id="openrouter-key">
            </div>
        
            <div class="input-group">
            <label for="openrouter-model" data-i18n="connection.model">Model</label>
            <input type="text" id="openrouter-model">
            <a href="https://openrouter.ai/models" target="_blank" data-i18n="connection.browse_models">Browse models..</a>
            </div>

            <div class="input-group">
            <input type="checkbox" id="openrouter-instruct-mode">
            <label for="openrouter-instruct-mode" data-i18n="connection.force_instruct">Force Instruct mode</label>
            </div>
        </div>

        <div id="ooba-menu">
            <h2 data-i18n="api.ooba">Text-Gen-WebUI (Ooba)</h2>

            <div class="input-group">
                <label for="ooba-url" data-i18n="connection.server_url">Server URL</label>
                <br>
                <input type="text" id="ooba-url">
                <br>
            </div>
        
        </div>

        <div id="openai-menu">
            <h2 data-i18n="api.openai">OpenAI</h2>

            <div class="input-group">
            <label for="api-key" data-i18n="connection.api_key">API Key</label>
            <br>
            <input type="password" id="openai-key">
            </div>
        
            <div class="input-group">
            <label for="openai-model-select" data-i18n="connection.model">Model</label>
            <select id="openai-model-select">
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Recommended)</option>
                <option value="gpt-4o">GPT-4-o</option>
            </select>
            </div>
        </div>

        <div id="gemini-menu">
            <h2 data-i18n="api.gemini">Google Gemini</h2>

            <div class="input-group">
            <label for="api-key" data-i18n="connection.api_key">API Key</label>
            <br>
            <input type="password" id="gemini-key">
            </div>
        
            <div class="input-group">
            <label for="gemini-model" data-i18n="connection.model">Model</label>
            <input type="text" id="gemini-model" placeholder="e.g. gemini-2.5-pro">
            </div>
        </div>

        <div id="glm-menu">
            <h2 data-i18n="api.glm">GLM</h2>

            <div class="input-group">
            <label for="api-key" data-i18n="connection.api_key">API Key</label>
            <br>
            <input type="password" id="glm-key">
            </div>
        
            <div class="input-group">
            <label for="glm-model-select" data-i18n="connection.model">Model</label>
            <select id="glm-model-select">
                <option value="glm-4.6">GLM-4.6</option>
                <option value="glm-4.5">GLM-4.5</option>
                <option value="glm-4.5-x">GLM-4.5-X</option>
                <option value="glm-4.5-flash">GLM-4.5-Flash</option>
                <option value="glm-4.5-air">GLM-4.5-Air</option>
                <option value="glm-4.5-airx">GLM-4.5-AirX</option>
            </select>
            </div>
        </div>

        <div id="deepseek-menu">
            <h2 data-i18n="api.deepseek">DeepSeek</h2>
            <div class="input-group">
            <label for="api-key" data-i18n="connection.api_key">API Key</label>
            <br>
            <input type="password" id="deepseek-key">
            </div>
        </div>

        <div id="grok-menu">
            <h2 data-i18n="api.grok">Grok (xAI)</h2>
            <div class="input-group">
            <label for="api-key" data-i18n="connection.api_key">API Key</label>
            <br>
            <input type="password" id="grok-key">
            </div>
            <div class="input-group">
            <label for="grok-model-select" data-i18n="connection.model">Model</label>
            <select id="grok-model-select">
                <option value="grok-4-1-fast-reasoning">Grok-4.1 Fast Reasoning</option>
                <option value="grok-4-1-fast-non-reasoning">Grok-4.1 Fast Non-Reasoning</option>
                <option value="grok-4-fast-reasoning">Grok-4 Fast Reasoning</option>
                <option value="grok-4-fast-non-reasoning">Grok-4 Fast Non-Reasoning</option>
                <option value="grok-4-0709">Grok-4 (0709)</option>
                <option value="grok-3">Grok-3</option>
                <option value="grok-3-mini">Grok-3 Mini</option>
                <option value="grok-code-fast-1">Grok Code Fast 1</option>
                <option value="grok-2-vision-1212">Grok-2 Vision</option>
                <option value="grok-2-1212">Grok-2</option>
                <option value="grok-2-latest">Grok-2 (Latest)</option>
                <option value="grok-beta">Grok Beta (Fast)</option>
            </select>
            </div>
        </div>

        <div id="player2-menu">
            <h2 data-i18n="api.player2">Player2</h2>
            <div class="input-group">
            <label for="api-key" data-i18n="connection.api_key">API Key</label>
            <br>
            <input type="password" id="player2-key">
            </div>
            <div class="input-group">
            <label for="player2-model-select" data-i18n="connection.model">Model</label>
            <select id="player2-model-select">
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4o">GPT-4o</option>
            </select>
            </div>
        </div>

        <div id="custom-menu">
            <h2 data-i18n="api.custom">Custom (Openai-compatible) endpoint</h2>

            <div class="input-group">
                <label for="custom-url" data-i18n="connection.server_url">Server URL</label>
                <br>
                <input type="text" id="custom-url">
            </div>
            <div class="input-group">
                <label for="custom-key" data-i18n="connection.api_key">API Key</label>
                <br>
                <input type="password" id="custom-key">
            </div>
            <div class="input-group">
                <label for="custom-model" data-i18n="connection.model">Model</label>
                <br>
                <input type="text" id="custom-model">
            </div>
    
        </div>

        <hr>
        <input type="checkbox" id="overwrite-context"/>
        <label data-i18n="connection.overwrite_context">Overwrite context size</label> <br>
        <input type="number" id="custom-context" min="0" style="width: 10%;"/>
    </div>

  <button type="button" id="connection-test-button" data-i18n="connection.test_connection">Test Connection</button> <span id="connection-test-span"></span>`
}

    

class ApiSelector extends HTMLElement{
    label: string;
    confID: string;
    shadow: any;
    typeSelector
    checkbox: any;

    openaiDiv: HTMLDivElement
    oobaDiv: HTMLDivElement
    openrouterDiv: HTMLDivElement 
    customDiv: HTMLDivElement 
    geminiDiv: HTMLDivElement
    glmDiv: HTMLDivElement
    deepseekDiv: HTMLDivElement
    grokDiv: HTMLDivElement
    player2Div: HTMLDivElement

    openaiKeyInput: HTMLInputElement 
    openaiModelSelect: HTMLSelectElement 

    geminiKeyInput: HTMLInputElement 
    geminiModelInput: HTMLInputElement 

    glmKeyInput: HTMLInputElement 
    glmModelSelect: HTMLSelectElement 
    deepseekKeyInput: HTMLInputElement
    grokKeyInput: HTMLInputElement
    grokModelSelect: HTMLSelectElement
    player2KeyInput: HTMLInputElement
    player2ModelSelect: HTMLSelectElement

    oobaUrlInput: HTMLSelectElement 
    oobaUrlConnectButton: HTMLInputElement 

    openrouterKeyInput: HTMLSelectElement 
    openrouterModelInput: HTMLInputElement 
    openrouterInstructModeCheckbox: HTMLInputElement 

    customUrlInput: HTMLSelectElement 
    customKeyInput: HTMLInputElement 
    customModelInput: HTMLSelectElement 

    testConnectionButton: HTMLButtonElement 
    testConnectionSpan: HTMLButtonElement 

    overwriteContextCheckbox: HTMLInputElement;
    customContextNumber: HTMLInputElement;


    constructor(){
        super();
        this.label = this.getAttribute("label")!;
        this.confID = this.getAttribute("confID")!;

        

        this.shadow = this.attachShadow({mode: "open"});
        template.innerHTML = defineTemplate(this.label);
        this.shadow.append(template.content.cloneNode(true));
        this.checkbox = this.shadow.querySelector("input");
        
        this.typeSelector = this.shadow.querySelector("#connection-api")!;

        this.openaiDiv = this.shadow.querySelector("#openai-menu")!;
        this.oobaDiv = this.shadow.querySelector("#ooba-menu")!;
        this.openrouterDiv = this.shadow.querySelector("#openrouter-menu")!;
        this.customDiv = this.shadow.querySelector("#custom-menu")!;
        this.geminiDiv = this.shadow.querySelector("#gemini-menu")!;
        this.glmDiv = this.shadow.querySelector("#glm-menu")!;
        this.deepseekDiv = this.shadow.querySelector("#deepseek-menu")!;
        this.grokDiv = this.shadow.querySelector("#grok-menu")!;
        this.player2Div = this.shadow.querySelector("#player2-menu")!;

        this.openaiKeyInput = this.shadow.querySelector("#openai-key")!;
        this.openaiModelSelect = this.shadow.querySelector("#openai-model-select")!;

        this.geminiKeyInput = this.shadow.querySelector("#gemini-key")!;
        this.geminiModelInput = this.shadow.querySelector("#gemini-model")!;

        this.glmKeyInput = this.shadow.querySelector("#glm-key")!;
        this.glmModelSelect = this.shadow.querySelector("#glm-model-select")!;
        this.deepseekKeyInput = this.shadow.querySelector("#deepseek-key")!;
        this.grokKeyInput = this.shadow.querySelector("#grok-key")!;
        this.grokModelSelect = this.shadow.querySelector("#grok-model-select")!;
        this.player2KeyInput = this.shadow.querySelector("#player2-key")!;
        this.player2ModelSelect = this.shadow.querySelector("#player2-model-select")!;

        this.oobaUrlInput = this.shadow.querySelector("#ooba-url")!;
        this.oobaUrlConnectButton = this.shadow.querySelector("#ooba-url-connect")!;

        this.openrouterKeyInput = this.shadow.querySelector("#openrouter-key")!;
        this.openrouterModelInput = this.shadow.querySelector("#openrouter-model")!;
        this.openrouterInstructModeCheckbox = this.shadow.querySelector("#openrouter-instruct-mode")!;

        this.customUrlInput = this.shadow.querySelector("#custom-url")!;
        this.customKeyInput = this.shadow.querySelector("#custom-key")!;
        this.customModelInput = this.shadow.querySelector("#custom-model")!;

        this.testConnectionButton = this.shadow.querySelector("#connection-test-button")!;
        this.testConnectionSpan = this.shadow.querySelector("#connection-test-span")!;

        this.overwriteContextCheckbox = this.shadow.querySelector("#overwrite-context")!;
        this.customContextNumber = this.shadow.querySelector("#custom-context")!;
    }


    static get observedAttributes(){
        return ["name", "confID", "label", "data-i18n"]
    }

    async connectedCallback(){
        const confID: string = this.confID;

        let config = await ipcRenderer.invoke('get-config');

        // Handle localization
        this.applyTranslations();
        
        // Listen for language changes
        ipcRenderer.on('update-language', () => {
            this.applyTranslations();
        });

        let apiConfig = config[confID].connection;

        
        this.typeSelector.value = apiConfig.type;
        this.displaySelectedApiBox();

        // 从apiKeys字段中加载所有API类型的配置（如果存在）
        const apiKeys = apiConfig.apiKeys || {};
        
        // 加载OpenAI配置
        if (apiKeys.openai) {
            this.openaiKeyInput.value = apiKeys.openai.key || "";
            this.openaiModelSelect.value = apiKeys.openai.model || "";
        } else if(apiConfig.type == "openai"){
            this.openaiKeyInput.value = apiConfig.key;
            this.openaiModelSelect.value = apiConfig.model;
        }
        
        // 加载OOBA配置
        if (apiKeys.ooba) {
            this.oobaUrlInput.value = apiKeys.ooba.baseUrl || "";
        } else if(apiConfig.type == "ooba"){
            this.oobaUrlInput.value = apiConfig.key;
        }
        
        // 加载OpenRouter配置
        if (apiKeys.openrouter) {
            this.openrouterKeyInput.value = apiKeys.openrouter.key || "";
            this.openrouterModelInput.value = apiKeys.openrouter.model || "";
        } else if(apiConfig.type == "openrouter"){
            this.openrouterKeyInput.value = apiConfig.key;
            this.openrouterModelInput.value = apiConfig.model;
        }
        
        // 加载Custom配置
        if (apiKeys.custom) {
            this.customUrlInput.value = apiKeys.custom.baseUrl || "";
            this.customKeyInput.value = apiKeys.custom.key || "";
            this.customModelInput.value = apiKeys.custom.model || "";
        } else if(apiConfig.type == "custom"){
            this.customUrlInput.value = apiConfig.baseUrl;
            this.customKeyInput.value = apiConfig.key;
            this.customModelInput.value = apiConfig.model;
        }
        
        // 加载Gemini配置
        if (apiKeys.gemini) {
            this.geminiKeyInput.value = apiKeys.gemini.key || "";
            this.geminiModelInput.value = apiKeys.gemini.model || "";
        } else if(apiConfig.type == "gemini"){
            this.geminiKeyInput.value = apiConfig.key;
            this.geminiModelInput.value = apiConfig.model;
        }
        
        // 加载GLM配置
        if (apiKeys.glm) {
            this.glmKeyInput.value = apiKeys.glm.key || "";
            this.glmModelSelect.value = apiKeys.glm.model || "";
        } else if(apiConfig.type == "glm"){
            this.glmKeyInput.value = apiConfig.key;
            this.glmModelSelect.value = apiConfig.model;
        }
        
        // 加载DeepSeek配置
        if (apiKeys.deepseek) {
            this.deepseekKeyInput.value = apiKeys.deepseek.key || "";
        } else if(apiConfig.type == "deepseek"){
            this.deepseekKeyInput.value = apiConfig.key;
        }

        // 加载Grok配置
        if (apiKeys.grok) {
            this.grokKeyInput.value = apiKeys.grok.key || "";
            this.grokModelSelect.value = apiKeys.grok.model || "";
        } else if(apiConfig.type == "grok"){
            this.grokKeyInput.value = apiConfig.key;
            this.grokModelSelect.value = apiConfig.model;
        }

        // 加载Player2配置
        if (apiKeys.player2) {
            this.player2KeyInput.value = apiKeys.player2.key || "";
            this.player2ModelSelect.value = apiKeys.player2.model || "";
        } else if(apiConfig.type == "player2"){
            this.player2KeyInput.value = apiConfig.key;
            this.player2ModelSelect.value = apiConfig.model;
        }
        
        this.openrouterInstructModeCheckbox.checked = apiConfig.forceInstruct;

        this.overwriteContextCheckbox.checked = apiConfig.overwriteContext;
        this.customContextNumber.value = apiConfig.customContext;

        

        this.typeSelector.addEventListener("change", (e: any) => {
            console.debug(confID)

            this.displaySelectedApiBox();

            switch(this.typeSelector.value){
                case 'openai': 
                    this.saveOpenaiConfig();
                break;
                case 'ooba': 
                    this.saveOobaConfig();
                break;
                case 'openrouter': 
                    this.saveOpenrouterConfig();
                break;
                case 'gemini': 
                    this.saveGeminiConfig();
                break;
                case 'glm': 
                    this.saveGlmConfig();
                break;
                case 'deepseek':
                    this.saveDeepseekConfig();
                break;
                case 'grok':
                    this.saveGrokConfig();
                break;
                case 'player2':
                    this.savePlayer2Config();
                break;
                case 'custom': 
                    this.saveCustomConfig();
                break;
            }

        });

        this.openaiDiv.addEventListener("change", (e:any) =>{
            this.saveOpenaiConfig();
        })

        this.oobaDiv.addEventListener("change", (e:any) =>{
            this.saveOobaConfig();
        })

        this.openrouterDiv.addEventListener("change", (e:any) =>{
            this.saveOpenrouterConfig();
        })

        this.customDiv.addEventListener("change", (e:any) =>{
            this.saveCustomConfig();
        })

        this.geminiDiv.addEventListener("change", (e:any) =>{
            this.saveGeminiConfig();
        })

        this.glmDiv.addEventListener("change", (e:any) =>{
            this.saveGlmConfig();
        })

        this.deepseekDiv.addEventListener("change", (e:any) =>{
            this.saveDeepseekConfig();
        })

        this.grokDiv.addEventListener("change", (e:any) =>{
            this.saveGrokConfig();
        })

        this.player2Div.addEventListener("change", (e:any) =>{
            this.savePlayer2Config();
        })

        this.testConnectionButton.addEventListener('click', async (e:any) =>{
            //@ts-ignore
            config = await ipcRenderer.invoke('get-config');
            console.debug("--- API SELECTOR: Testing Connection ---");

            // Create a deep copy to avoid modifying the actual config object
            const configToLog = JSON.parse(JSON.stringify(config[this.confID]));
            // Redact sensitive information
            if (configToLog.connection && configToLog.connection.key) {
                configToLog.connection.key = "[REDACTED]";
            }
            console.debug("Using config:", configToLog);
            
            let con = new ApiConnection(config[this.confID].connection, config[this.confID].parameters);

            this.testConnectionSpan.innerText = "...";
            this.testConnectionSpan.style.color = "white";


            con.testConnection().then( (result) =>{

                console.debug("--- API SELECTOR: Test Result ---");
                console.debug(result)

                if(result.success){
                    this.testConnectionSpan.style.color = "green";

                    if(result.overwriteWarning){
                        this.testConnectionSpan.innerText = "Connection valid! Warning: context size couldn't be detected, overwrite context size will be used! (even if disabled!)";
                    }else{
                        this.testConnectionSpan.innerText = "Connection valid!";
                    }
                    


                }
                else{
                    this.testConnectionSpan.innerText = result.errorMessage!;
                    this.testConnectionSpan.style.color = "red";
                }
                
            });
        })

        this.toggleCustomContext();

        this.overwriteContextCheckbox.addEventListener('change', ()=>{
            this.toggleCustomContext();

            ipcRenderer.send('config-change-nested-nested', this.confID, "connection", "overwriteContext", this.overwriteContextCheckbox.checked);
        });

        this.customContextNumber.addEventListener('change', ()=>{
            ipcRenderer.send('config-change-nested-nested', this.confID, "connection", "customContext", this.customContextNumber.value);
        })

         
        
    }

    toggleCustomContext(){
        if(this.overwriteContextCheckbox.checked){
            this.customContextNumber.style.opacity = "1";
            this.customContextNumber.disabled = false;
        }
        else{
            this.customContextNumber.style.opacity = "0.5";
            this.customContextNumber.disabled = true;
        }
    }    

    displaySelectedApiBox(){
        // Hide all divs first for simplicity and to prevent bugs
        this.openaiDiv.style.display = "none";
        this.oobaDiv.style.display = "none";
        this.openrouterDiv.style.display = "none";
        this.customDiv.style.display = "none";
        this.geminiDiv.style.display = "none";
        this.glmDiv.style.display = "none";
        this.deepseekDiv.style.display = "none";
        this.grokDiv.style.display = "none";
        this.player2Div.style.display = "none";

        switch (this.typeSelector.value) {
            case 'openai':  
                this.openaiDiv.style.display = "block";
                break;
            case 'ooba':
                this.oobaDiv.style.display = "block";
                break;
            case 'openrouter':
                this.openrouterDiv.style.display = "block";
                break;
            case 'custom':
                this.customDiv.style.display = "block";
                break;
            case 'gemini':
                this.geminiDiv.style.display = "block";
                break;
            case 'glm':
                this.glmDiv.style.display = "block";
                break;
            case 'deepseek':
                this.deepseekDiv.style.display = "block";
                break;
            case 'grok':
                this.grokDiv.style.display = "block";
                break;
            case 'player2':
                this.player2Div.style.display = "block";
                break;
        }
    }

    saveAllApiConfigs() {
        console.log('Saving all API configurations...');
        
        // 保存所有API类型的配置
        this.saveOpenaiConfig();
        this.saveOobaConfig();
        this.saveOpenrouterConfig();
        this.saveGeminiConfig();
        this.saveGlmConfig();
        this.saveDeepseekConfig();
        this.saveGrokConfig();
        this.savePlayer2Config();
        this.saveCustomConfig();
        
        // 通知主进程所有API配置已更新
        const allConfigs = {
            openai: {
                key: this.openaiKeyInput.value,
                baseUrl: "https://api.openai.com/v1",
                model: this.openaiModelSelect.value
            },
            ooba: {
                key: this.oobaUrlInput.value ? 'ooba-placeholder-key' : '',
                baseUrl: this.oobaUrlInput.value,
                model: "string"
            },
            openrouter: {
                key: this.openrouterKeyInput.value,
                baseUrl: "https://openrouter.ai/api/v1",
                model: this.openrouterModelInput.value,
                forceInstruct: this.openrouterInstructModeCheckbox.checked
            },
            gemini: {
                key: this.geminiKeyInput.value,
                baseUrl: "https://generativelanguage.googleapis.com/v1beta",
                model: this.geminiModelInput.value
            },
            glm: {
                key: this.glmKeyInput.value,
                baseUrl: "https://open.bigmodel.cn/api/paas/v4",
                model: this.glmModelSelect.value
            },
            deepseek: {
                key: this.deepseekKeyInput.value,
                baseUrl: "https://api.deepseek.com",
                model: "deepseek-chat"
            },
            grok: {
                key: this.grokKeyInput.value,
                baseUrl: "https://api.x.ai/v1",
                model: this.grokModelSelect.value
            },
            player2: {
                key: this.player2KeyInput.value,
                baseUrl: "https://api.player2.game/v1",
                model: this.player2ModelSelect.value
            },
            custom: {
                key: this.customKeyInput.value,
                baseUrl: this.customUrlInput.value,
                model: this.customModelInput.value
            }
        };
        
        // 发送所有API配置到主进程
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'all', allConfigs);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'all', allConfigs);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'all', allConfigs);
        
        console.log('All API configurations saved and sent to main process');
    }

    saveOpenaiConfig(){
        const config = {
            type: "openai",
            baseUrl: "https://api.openai.com/v1",
            key: this.openaiKeyInput.value,
            model: this.openaiModelSelect.value,
            forceInstruct: this.openrouterInstructModeCheckbox.checked,
            overwriteContext: this.overwriteContextCheckbox.checked,
            customContext: this.customContextNumber.value
        };
        
        // 保存当前配置
        ipcRenderer.send('config-change-nested', this.confID, "connection", config);
        
        // 发送配置到主进程
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'openai', config);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'openai', config);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'openai', config);
    }
    

    //OOBA DIV
    saveOobaConfig(){
        const config = {
            type: "ooba",
            baseUrl: this.oobaUrlInput.value,
            key: this.oobaUrlInput.value ? "ooba-placeholder-key" : "",
            model: "string",
            forceInstruct: this.openrouterInstructModeCheckbox.checked,
            overwriteContext: this.overwriteContextCheckbox.checked,
            customContext: this.customContextNumber.value
        };

        // 保存当前配置
        ipcRenderer.send('config-change-nested', this.confID, "connection", config);
        
        // 发送配置到主进程
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'ooba', config);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'ooba', config);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'ooba', config);
    }
    

    //OPENROUTER DIV
    saveOpenrouterConfig(){
        const config = {
            type: "openrouter",
            baseUrl: "https://openrouter.ai/api/v1",
            key: this.openrouterKeyInput.value,
            model: this.openrouterModelInput.value,
            forceInstruct: this.openrouterInstructModeCheckbox.checked,
            overwriteContext: this.overwriteContextCheckbox.checked,
            customContext: this.customContextNumber.value
        };
        // 保存当前配置
        ipcRenderer.send('config-change-nested', this.confID, "connection", config);
        
        // 发送配置到主进程
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'openrouter', config);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'openrouter', config);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'openrouter', config);
    }   

    saveCustomConfig(){
        const config = {
            type: "custom",
            baseUrl: this.customUrlInput.value,
            key: this.customKeyInput.value,
            model: this.customModelInput.value,
            forceInstruct: false,
            overwriteContext: this.overwriteContextCheckbox.checked,
            customContext: this.customContextNumber.value
        };
        // 保存当前配置
        ipcRenderer.send('config-change-nested', this.confID, "connection", config);
        
        // 发送配置到主进程
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'custom', config);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'custom', config);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'custom', config);
    }  

    saveGeminiConfig(){
        const config = {
            type: "gemini",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta",
            key: this.geminiKeyInput.value,
            model: this.geminiModelInput.value,
            forceInstruct: false,
            overwriteContext: this.overwriteContextCheckbox.checked,
            customContext: this.customContextNumber.value
        };
        // 保存当前配置
        ipcRenderer.send('config-change-nested', this.confID, "connection", config);
        
        // 发送配置到主进程
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'gemini', config);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'gemini', config);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'gemini', config);
    }

    saveGlmConfig(){
        const config = {
            type: "glm",
            baseUrl: "https://open.bigmodel.cn/api/paas/v4",
            key: this.glmKeyInput.value,
            model: this.glmModelSelect.value,
            forceInstruct: false,
            overwriteContext: this.overwriteContextCheckbox.checked,
            customContext: this.customContextNumber.value
        };
        // 保存当前配置
        ipcRenderer.send('config-change-nested', this.confID, "connection", config);
        
        // 发送配置到主进程
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'glm', config);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'glm', config);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'glm', config);
    }
    
    saveDeepseekConfig(){
        const config = {
            type: "deepseek",
            baseUrl: "https://api.deepseek.com",
            key: this.deepseekKeyInput.value,
            model: "deepseek-chat",
            forceInstruct: false,
            overwriteContext: this.overwriteContextCheckbox.checked,
            customContext: this.customContextNumber.value
        };
        ipcRenderer.send('config-change-nested', this.confID, "connection", config);
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'deepseek', config);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'deepseek', config);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'deepseek', config);
    }

    saveGrokConfig(){
        const config = {
            type: "grok",
            baseUrl: "https://api.x.ai/v1",
            key: this.grokKeyInput.value,
            model: this.grokModelSelect.value,
            forceInstruct: false,
            overwriteContext: this.overwriteContextCheckbox.checked,
            customContext: this.customContextNumber.value
        };
        ipcRenderer.send('config-change-nested', this.confID, "connection", config);
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'grok', config);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'grok', config);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'grok', config);
    }

    savePlayer2Config(){
        const config = {
            type: "player2",
            baseUrl: "https://api.player2.game/v1",
            key: this.player2KeyInput.value,
            model: this.player2ModelSelect.value,
            forceInstruct: false,
            overwriteContext: this.overwriteContextCheckbox.checked,
            customContext: this.customContextNumber.value
        };
        ipcRenderer.send('config-change-nested', this.confID, "connection", config);
        ipcRenderer.send('api-config-change', 'textGenerationApiConnectionConfig', 'player2', config);
        ipcRenderer.send('api-config-change', 'summarizationApiConnectionConfig', 'player2', config);
        ipcRenderer.send('api-config-change', 'actionsApiConnectionConfig', 'player2', config);
    }

    applyTranslations() {
        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            window.LocalizationManager.applyTranslations(this.shadow);
        }
    }
}




customElements.define("config-api-selector", ApiSelector);