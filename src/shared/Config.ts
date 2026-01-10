import fs from 'fs';
import { Parameters, Connection} from './apiConnection';
import path from 'path';
import {app} from 'electron';

       

export interface ApiConnectionConfig{
    connection: Connection;
    parameters: Parameters;
}

export class Config{
    userFolderPath!: string;

    stream!: boolean;
    maxTokens!: number;
    maxMemoryTokens!: number;
    percentOfContextToSummarize!: number;
    aiFirstSpeakerChance!: number;

    

    selectedDescScript!: string;
    selectedExMsgScript!: string;

    inputSequence!: string;
    outputSequence!: string;

    textGenerationApiConnectionConfig!: ApiConnectionConfig;
    summarizationApiConnectionConfig!: ApiConnectionConfig;
    actionsApiConnectionConfig!: ApiConnectionConfig;

    summarizationUseTextGenApi!: boolean;
    actionsUseTextGenApi!: boolean;

    actionsEnableAll!: boolean;
    disabledActions!: string[];

    cleanMessages!: boolean;
    debugMode!: boolean;
    checkForUpdatesOnStartup!: boolean;

    summariesInsertDepth!: number;
    memoriesInsertDepth!: number;
    descInsertDepth!: number;

    mainPrompt!: string;
    summarizePrompt!: string;
    memoriesPrompt!: string;
    suffixPrompt!: string;
    enableSuffixPrompt!: boolean;
    selfTalkPrompt!: string;
    selectedSelfTalkExMsgScript!: string;
    selfTalkSummarizePrompt!: string;
    
    lastRunVersion!: string;

    constructor(configPath: string){  
        const obj = JSON.parse(fs.readFileSync(configPath).toString());
        Object.assign(this, obj);
    }

    export(){
        fs.writeFileSync(path.join(app.getPath('userData'), 'votc_data', 'configs', 'config.json'), JSON.stringify(this, null, '\t'))
    }

    toSafeConfig(): Config{
        //pass by value
        let output: Config = JSON.parse(JSON.stringify(this));
        output.textGenerationApiConnectionConfig.connection.key= "<hidden>";
        output.actionsApiConnectionConfig.connection.key = "<hidden>";
        output.summarizationApiConnectionConfig.connection.key = "<hidden>";
        output.textGenerationApiConnectionConfig.connection.baseUrl= "<hidden>";
        output.actionsApiConnectionConfig.connection.baseUrl = "<hidden>";
        output.summarizationApiConnectionConfig.connection.baseUrl = "<hidden>";

        return output;
    }

}

