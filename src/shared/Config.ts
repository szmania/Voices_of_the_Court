import fs from 'fs';
import { Parameters, Connection} from './apiConnection';
import path from 'path';
import {app} from 'electron';

       

export interface ApiConnectionConfig{
    connection: Connection;
    parameters: Parameters;
}

export interface PromptConfig {
    mainPrompt: string;
    summarizePrompt: string;
    memoriesPrompt: string;
    suffixPrompt: string;
    selfTalkPrompt: string;
    selfTalkSummarizePrompt: string;
    narrativePrompt: string;
    sceneDescriptionPrompt: string;
}

export class Config{
    userFolderPath!: string;
    language: 'en' | 'zh' | 'ru' | 'fr' | 'es' = 'en';

    stream!: boolean;
    maxTokens!: number;
    maxMemoryTokens!: number;
    percentOfContextToSummarize!: number;

    

    selectedDescScript!: string;
    selectedExMsgScript!: string;
    selectedBookmarkScript!: string;

    inputSequence!: string;
    outputSequence!: string;

    textGenerationApiConnectionConfig!: ApiConnectionConfig;
    summarizationApiConnectionConfig!: ApiConnectionConfig;
    actionsApiConnectionConfig!: ApiConnectionConfig;

    summarizationUseTextGenApi!: boolean;
    actionsUseTextGenApi!: boolean;

    actionsEnableAll!: boolean;
    narrativeEnable!: boolean;
    disabledActions!: string[];

    cleanMessages!: boolean;
    debugMode!: boolean;
    aiCanStartConversation!: boolean;
    aiStartConversationChance!: number;
    shuffleCharacterOrder!: boolean;
    dynamicCharacterSelection!: boolean;
    validateCharacterIdentity!: boolean;
    showSuggestionsButton!: boolean;
    generateSceneDescription!: boolean;
    autoGenerateSuggestions!: boolean;
    autoSendSuggestion!: boolean;
    checkForUpdatesOnStartup!: boolean;
    earlyAccessUpdates!: boolean;
    lastAnnouncementVersion!: string;

    summariesInsertDepth!: number;
    memoriesInsertDepth!: number;
    descInsertDepth!: number;

    prompts!: {
        en: PromptConfig;
        zh: PromptConfig;
        ru: PromptConfig;
        fr: PromptConfig;
        es: PromptConfig;
    };

    get mainPrompt(): string { return this.prompts[this.language].mainPrompt; }
    get summarizePrompt(): string { return this.prompts[this.language].summarizePrompt; }
    get memoriesPrompt(): string { return this.prompts[this.language].memoriesPrompt; }
    get suffixPrompt(): string { return this.prompts[this.language].suffixPrompt; }
    get selfTalkPrompt(): string { return this.prompts[this.language].selfTalkPrompt; }
    get selfTalkSummarizePrompt(): string { return this.prompts[this.language].selfTalkSummarizePrompt; }
    get narrativePrompt(): string { return this.prompts[this.language].narrativePrompt; }
    get sceneDescriptionPrompt(): string { return this.prompts[this.language].sceneDescriptionPrompt; }

    enableSuffixPrompt!: boolean;
    selectedSelfTalkExMsgScript!: string;

    constructor(configPath: string){  
        const obj = JSON.parse(fs.readFileSync(configPath).toString());
        Object.assign(this, obj);
    }

    export(){
        // 在保存配置前，确保apiKeys字段被正确保留
        const configData = JSON.parse(JSON.stringify(this));
        
        // 检查每个API连接配置中是否有apiKeys字段，如果有则保留
        const configTypes = ['textGenerationApiConnectionConfig', 'summarizationApiConnectionConfig', 'actionsApiConnectionConfig'];
        configTypes.forEach(configType => {
            if (configData[configType] && configData[configType].connection && 
                configData[configType].connection.apiKeys) {
                // 确保apiKeys字段被包含在导出的配置中
                console.log(`Preserving apiKeys for ${configType}`);
            }
        });
        
        fs.writeFileSync(path.join(app.getPath('userData'), 'votc_data', 'configs', 'config.json'), JSON.stringify(configData, null, '\t'))
    }

    toSafeConfig(): Config{
        //pass by value
        let output: Config = JSON.parse(JSON.stringify(this));
        
        // 隐藏敏感信息
        output.textGenerationApiConnectionConfig.connection.key= "<hidden>";
        output.actionsApiConnectionConfig.connection.key = "<hidden>";
        output.summarizationApiConnectionConfig.connection.key = "<hidden>";
        output.textGenerationApiConnectionConfig.connection.baseUrl= "<hidden>";
        output.actionsApiConnectionConfig.connection.baseUrl = "<hidden>";
        output.summarizationApiConnectionConfig.connection.baseUrl = "<hidden>";
        
        // 隐藏apiKeys中的敏感信息
        const configTypes = ['textGenerationApiConnectionConfig', 'summarizationApiConnectionConfig', 'actionsApiConnectionConfig'];
        configTypes.forEach(configType => {
            const config = output[configType as keyof Config] as any;
            if (config && config.connection && config.connection.apiKeys) {
                Object.keys(config.connection.apiKeys).forEach(apiType => {
                    if (config.connection.apiKeys[apiType].key) {
                        config.connection.apiKeys[apiType].key = "<hidden>";
                    }
                    if (config.connection.apiKeys[apiType].baseUrl) {
                        config.connection.apiKeys[apiType].baseUrl = "<hidden>";
                    }
                });
            }
        });

        return output;
    }

}
