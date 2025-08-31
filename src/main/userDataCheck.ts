//this file checks the app's userdata folder.

import { app} from "electron";
import path from 'path';
import { existsSync } from "original-fs";
import fs from 'fs';

export async function checkUserData(){
    console.log('Starting user data check...');
    const userPath = path.join(app.getPath('userData'), "votc_data");
    console.log(`User data path: ${userPath}`);

    if(!existsSync(userPath)){
        console.log('User data votc folder not found! Creating default folder.');
        fs.cpSync(path.join(__dirname, "..", "..", "default_userdata"), userPath, {recursive: true});
        console.log('User data votc default folder created!');

        return;
    }

    console.log('User data votc folder already exists. Validating contents.');

    //folder already exist:

    // Copy default_config.json to ensure it's always present for validation
    const defaultConfigSourcePath = path.join(__dirname, "..", "..", "default_userdata", 'configs', 'default_config.json');
    const defaultConfigDestPath = path.join(userPath, 'configs', 'default_config.json');
    fs.cpSync(defaultConfigSourcePath, defaultConfigDestPath);
    console.log(`Copied default_config.json from ${defaultConfigSourcePath} to ${defaultConfigDestPath}`);

    //validate config
    const configPath = path.join(userPath, "configs", "config.json");
    console.log(`Validating config file at: ${configPath}`);
    
    if(existsSync(configPath)){
        const config = JSON.parse(fs.readFileSync(configPath).toString());
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigDestPath).toString());
        const configKeys = Object.keys(config);
        const defaultConfigKeys = Object.keys(defaultConfig);

        if(JSON.stringify(configKeys) !== JSON.stringify(defaultConfigKeys)){
            console.log("User data config file didn't match default config file. Deleting config file.");
            fs.unlinkSync(configPath);
            console.log(`Deleted invalid config file: ${configPath}`);
        } else {
            console.log("User data config file is valid.");
        }
    } else {
        console.log(`Config file not found at ${configPath}. It will be created from default_config.json later.`);
    }

    //validate conv summaries - No specific validation logic here, just ensuring folder structure.
    // This section doesn't perform file operations, so no new logs needed beyond existing ones in Conversation.ts

    //validate script files
    console.log('Validating script files...');
    const defaultScriptsPath = path.join(__dirname, "..", "..", "default_userdata", "scripts");
    const userDataScriptsPath= path.join(userPath, "scripts");

    //actions
    console.log('Updating action scripts...');
    const standardActionsPath = path.join(userDataScriptsPath, 'actions', 'standard');
    if(fs.existsSync(standardActionsPath)){
        fs.rmdirSync(standardActionsPath, {recursive: true});
        console.log(`Removed old standard actions directory: ${standardActionsPath}`);
    } 
    fs.cp(path.join(defaultScriptsPath, 'actions', 'standard'), standardActionsPath, {recursive: true}, (err) => {
        if(err) {
            console.error(`Error copying standard actions: ${err}`);
            throw err;
        }
        console.log(`Copied standard actions to: ${standardActionsPath}`);
    });

    //description
    console.log('Updating description scripts...');
    const standardDescriptionPath = path.join(userDataScriptsPath, 'prompts', 'description', 'standard');
    if(fs.existsSync(standardDescriptionPath)){
        fs.rmdirSync(standardDescriptionPath, {recursive: true});
        console.log(`Removed old standard description directory: ${standardDescriptionPath}`);
    }
    fs.cp(path.join(defaultScriptsPath, 'prompts', 'description', 'standard'), standardDescriptionPath, {recursive: true}, (err) => {
        if(err) {
            console.error(`Error copying standard description: ${err}`);
            throw err;
        }
        console.log(`Copied standard description to: ${standardDescriptionPath}`);
    });

    //example messages
    console.log('Updating example messages scripts...');
    const standardExampleMessagesPath = path.join(userDataScriptsPath, 'prompts', 'example messages', 'standard');
    if(fs.existsSync(standardExampleMessagesPath)){
        fs.rmdirSync(standardExampleMessagesPath, {recursive: true});
        console.log(`Removed old standard example messages directory: ${standardExampleMessagesPath}`);
    }
    fs.cp(path.join(defaultScriptsPath, 'prompts', 'example messages', 'standard'), standardExampleMessagesPath, {recursive: true}, (err) => {
        if(err) {
            console.error(`Error copying standard example messages: ${err}`);
            throw err;
        }
        console.log(`Copied standard example messages to: ${standardExampleMessagesPath}`);
    });

    //copy typedefs
    console.log('Updating gamedata_typedefs.js...');
    const typedefsSourcePath = path.join(defaultScriptsPath, 'gamedata_typedefs.js');
    const typedefsDestPath = path.join(userDataScriptsPath, 'gamedata_typedefs.js');
    fs.cp(typedefsSourcePath, typedefsDestPath, {}, (err) => {
        if(err) {
            console.error(`Error copying gamedata_typedefs.js: ${err}`);
            throw err;
        }
        console.log(`Copied gamedata_typedefs.js from ${typedefsSourcePath} to ${typedefsDestPath}`);
    });

    console.log('User data check completed successfully.');
    return true;
}
