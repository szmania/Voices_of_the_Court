//this file checks the app's userdata folder.

import { app} from "electron";
import path from 'path';
import { existsSync } from "original-fs";
import fs from 'fs';

// Helper function for deep merging configurations, prioritizing user settings
// and strictly adhering to the default configuration's structure.
function mergeConfigsStrict(defaultConfig: any, userConfig: any): any {
    const merged: any = {};

    for (const key in defaultConfig) {
        if (defaultConfig.hasOwnProperty(key)) {
            if (userConfig.hasOwnProperty(key)) {
                // Key exists in both default and user config
                if (
                    typeof defaultConfig[key] === 'object' && defaultConfig[key] !== null && !Array.isArray(defaultConfig[key]) &&
                    typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])
                ) {
                    // Both are objects, perform a deep merge for this nested object
                    merged[key] = mergeConfigsStrict(defaultConfig[key], userConfig[key]);
                } else {
                    // Otherwise, the user's value takes precedence
                    merged[key] = userConfig[key];
                }
            } else {
                // Key only exists in default config, use the default value
                merged[key] = defaultConfig[key];
            }
        }
    }
    
    // 保留用户配置中不在默认配置中的特殊字段（如apiKeys）
    // 这些字段对于API配置的持久化至关重要
    const specialFields = ['apiKeys'];
    for (const field of specialFields) {
        if (userConfig.hasOwnProperty(field)) {
            merged[field] = userConfig[field];
        }
    }
    
    return merged;
}


export async function checkUserData(){
    console.log('Starting user data check...');
    const userPath = path.join(app.getPath('userData'), "votc_data");
    console.log(`User data path: ${userPath}`);

    if(!existsSync(userPath)){
        const legacyPath = path.join(path.dirname(app.getPath('userData')), "Voices of the Court");
        
        if (existsSync(legacyPath)) {
            console.log(`Legacy data found at ${legacyPath}. Migrating to ${userPath}...`);
            try {
                fs.cpSync(legacyPath, userPath, { recursive: true });
                console.log('Migration from legacy folder completed successfully!');
                return;
            } catch (err) {
                console.error(`Migration failed: ${err}. Falling back to default initialization.`);
            }
        }

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
        // Step 3.1: Read Configurations
        const userConfigRaw = fs.readFileSync(configPath).toString();
        const userConfig = JSON.parse(userConfigRaw);
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigDestPath).toString());

        // Migration for selfTalkPrompt
        if (userConfig.selfTalkPrompt === "default.js") {
            userConfig.selfTalkPrompt = defaultConfig.selfTalkPrompt;
            console.log("Migrated selfTalkPrompt from 'default.js' to default prompt string.");
        }

        // Step 3.2: Perform a Deep Merge
        // This merges userConfig into defaultConfig, prioritizing user values
        // while ensuring the final structure matches defaultConfig.
        const mergedConfig = mergeConfigsStrict(defaultConfig, userConfig);

        // Step 3.3: Write Back Changes Conditionally
        const mergedConfigString = JSON.stringify(mergedConfig, null, '\t');
        if (userConfigRaw !== mergedConfigString) {
            fs.writeFileSync(configPath, mergedConfigString);
            console.log("User data config file updated to match default structure, preserving user settings.");
        } else {
            console.log("User data config file is valid and up-to-date.");
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
    /*
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
    */

    //description
    console.log('Updating description scripts...');
    /*
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
    */

    // Check and create custom description folder if it doesn't exist
    const customDescriptionPath = path.join(userDataScriptsPath, 'prompts', 'description', 'custom');
    if (!fs.existsSync(customDescriptionPath)){
        fs.mkdirSync(customDescriptionPath, {recursive: true});
        console.log(`Created custom description directory: ${customDescriptionPath}`);
    }
    // Copy any files from workspace custom folder to userdata custom folder if they exist
    const workspaceCustomDescriptionPath = path.join(defaultScriptsPath, 'prompts', 'description', 'custom');
    if (fs.existsSync(workspaceCustomDescriptionPath)) {
        fs.cp(workspaceCustomDescriptionPath, customDescriptionPath, {recursive: true, force: false}, (err) => {
             if(err) {
                console.error(`Error copying custom description files: ${err}`);
             } else {
                console.log(`Copied custom description files to: ${customDescriptionPath}`);
             }
        });
    }

    //example messages
    console.log('Updating example messages scripts...');
    /*
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
    */

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

    //bookmarks
    console.log('Updating bookmarks...');
    /*
    const standardBookmarksPath = path.join(userDataScriptsPath, 'bookmarks', 'standard');
    if(fs.existsSync(standardBookmarksPath)){
        fs.rmdirSync(standardBookmarksPath, {recursive: true});
        console.log(`Removed old standard bookmarks directory: ${standardBookmarksPath}`);
    }
    fs.cp(path.join(defaultScriptsPath, 'bookmarks', 'standard'), standardBookmarksPath, {recursive: true}, (err) => {
        if(err) {
            console.error(`Error copying standard bookmarks: ${err}`);
            throw err;
        }
        console.log(`Copied standard bookmarks to: ${standardBookmarksPath}`);
    });
    */

    console.log('User data check completed successfully.');
    return true;
}
