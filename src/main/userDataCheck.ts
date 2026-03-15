//this file checks the app's userdata folder.

import { app } from "electron";
import path from 'path';
import { player2GameKey } from "../shared/apiConnection";
import { existsSync } from "original-fs";
import fs from 'fs';
import crypto from 'crypto';

// Helper function to calculate file hash
function getFileHash(filePath: string): string {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    } catch (error) {
        console.error(`Error getting hash for file ${filePath}:`, error);
        return '';
    }
}

// Recursive function to synchronize directories
function synchronizeDirectory(sourceDir: string, destDir: string) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        console.log(`Created directory: ${destDir}`);
    }

    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            synchronizeDirectory(sourcePath, destPath);
        } else {
            // Do not overwrite user's main config file, just the default one.
            if (path.basename(sourcePath) === 'config.json') {
                continue;
            }
            if (!fs.existsSync(destPath) || getFileHash(sourcePath) !== getFileHash(destPath)) {
                fs.copyFileSync(sourcePath, destPath);
                console.log(`Synchronized file: ${destPath}`);
            }
        }
    }
}


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
    const defaultUserdataPath = path.join(__dirname, "..", "..", "default_userdata");
    console.log(`User data path: ${userPath}`);

    if(!existsSync(userPath)){
        const legacyPath = path.join(path.dirname(app.getPath('userData')), "Voices of the Court");
        
        if (existsSync(legacyPath)) {
            console.log(`Legacy data found at ${legacyPath}. Migrating to ${userPath}...`);
            try {
                fs.cpSync(legacyPath, userPath, { recursive: true });
                console.log('Migration from legacy folder completed successfully!');
                // After migration, still run sync to get latest updates
            } catch (err) {
                console.error(`Migration failed: ${err}. Falling back to default initialization.`);
            }
        } else {
            console.log('User data votc folder not found! Creating default folder.');
            fs.cpSync(defaultUserdataPath, userPath, {recursive: true});
            console.log('User data votc default folder created!');
            return; // First time creation, no need to sync further
        }
    }

    console.log('User data votc folder already exists. Synchronizing contents.');

    // Synchronize all default files to the user data directory
    synchronizeDirectory(defaultUserdataPath, userPath);

    // The old validation logic for config can still be useful
    const configPath = path.join(userPath, "configs", "config.json");
    const defaultConfigDestPath = path.join(userPath, 'configs', 'default_config.json');
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

        // Set Player2 as default for new users
        if (!userConfig.textGenerationApiConnectionConfig?.connection?.type) {
            defaultConfig.textGenerationApiConnectionConfig.connection.type = 'player2';
        }

        // Step 3.2: Perform a Deep Merge
        const mergedConfig = mergeConfigsStrict(defaultConfig, userConfig);

        // Hardcode Player2 API key
        const configsToUpdate = [
            'textGenerationApiConnectionConfig',
            'actionsApiConnectionConfig',
            'summarizationApiConnectionConfig'
        ];

        for (const conf of configsToUpdate) {
            if (mergedConfig[conf] && mergedConfig[conf].connection) {
                if (!mergedConfig[conf].connection.apiKeys) {
                    mergedConfig[conf].connection.apiKeys = {};
                }
                if (!mergedConfig[conf].connection.apiKeys.player2) {
                    mergedConfig[conf].connection.apiKeys.player2 = {};
                }
                mergedConfig[conf].connection.apiKeys.player2.key = player2GameKey;
            }
        }

        // Step 3.3: Write Back Changes Conditionally
        const mergedConfigString = JSON.stringify(mergedConfig, null, '\t');
        if (userConfigRaw !== mergedConfigString) {
            fs.writeFileSync(configPath, mergedConfigString);
            console.log("User data config file updated to match default structure, preserving user settings and setting Player2 defaults.");
        } else {
            console.log("User data config file is valid and up-to-date.");
        }
    } else {
        console.log(`Config file not found at ${configPath}. Creating new config with Player2 as default.`);
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigDestPath).toString());
        defaultConfig.textGenerationApiConnectionConfig.connection.type = 'player2';
        
        const configsToUpdate = [
            'textGenerationApiConnectionConfig',
            'actionsApiConnectionConfig',
            'summarizationApiConnectionConfig'
        ];

        for (const conf of configsToUpdate) {
            if (defaultConfig[conf] && defaultConfig[conf].connection) {
                if (!defaultConfig[conf].connection.apiKeys) {
                    defaultConfig[conf].connection.apiKeys = {};
                }
                if (!defaultConfig[conf].connection.apiKeys.player2) {
                    defaultConfig[conf].connection.apiKeys.player2 = {};
                }
                defaultConfig[conf].connection.apiKeys.player2.key = player2GameKey;
            }
        }
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, '\t'));
    }

    // Validate prompt_presets.json
    const presetsPath = path.join(userPath, "configs", "prompt_presets.json");
    console.log(`Validating prompt presets file at: ${presetsPath}`);
    if (!existsSync(presetsPath)) {
        fs.writeFileSync(presetsPath, JSON.stringify({}, null, '\t'));
        console.log(`Created empty prompt presets file at: ${presetsPath}`);
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
    const sourceActionsPath = path.join(defaultScriptsPath, 'actions', 'standard');
    if (fs.existsSync(sourceActionsPath)) {
        // Ensure parent directory exists
        const parentDir = path.dirname(standardActionsPath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
            console.log(`Created parent directory: ${parentDir}`);
        }
        if (fs.existsSync(standardActionsPath)) {
            fs.rmSync(standardActionsPath, { recursive: true, force: true });
            console.log(`Removed old standard actions directory: ${standardActionsPath}`);
        }
        fs.cpSync(sourceActionsPath, standardActionsPath, { recursive: true });
        console.log(`Copied standard actions to: ${standardActionsPath}`);
    } else {
        console.warn(`Source actions folder not found: ${sourceActionsPath}`);
    }

    //description
    console.log('Updating description scripts...');
    const standardDescriptionPath = path.join(userDataScriptsPath, 'prompts', 'description', 'standard');
    const sourceDescriptionPath = path.join(defaultScriptsPath, 'prompts', 'description', 'standard');
    if (fs.existsSync(sourceDescriptionPath)) {
        // Ensure parent directory exists
        const parentDir = path.dirname(standardDescriptionPath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
            console.log(`Created parent directory: ${parentDir}`);
        }
        if (fs.existsSync(standardDescriptionPath)) {
            fs.rmSync(standardDescriptionPath, { recursive: true, force: true });
            console.log(`Removed old standard description directory: ${standardDescriptionPath}`);
        }
        fs.cpSync(sourceDescriptionPath, standardDescriptionPath, { recursive: true });
        console.log(`Copied standard description to: ${standardDescriptionPath}`);
    } else {
        console.warn(`Source description folder not found: ${sourceDescriptionPath}`);
    }

    // Check and create custom description folder if it doesn't exist
    const customDescriptionPath = path.join(userDataScriptsPath, 'prompts', 'description', 'custom');
    if (!fs.existsSync(customDescriptionPath)){
        fs.mkdirSync(customDescriptionPath, {recursive: true});
        console.log(`Created custom description directory: ${customDescriptionPath}`);
    }
    // Copy any files from workspace custom folder to userdata custom folder if they exist
    const workspaceCustomDescriptionPath = path.join(defaultScriptsPath, 'prompts', 'description', 'custom');
    if (fs.existsSync(workspaceCustomDescriptionPath)) {
        try {
            fs.cpSync(workspaceCustomDescriptionPath, customDescriptionPath, {recursive: true, force: false});
            console.log(`Copied custom description files to: ${customDescriptionPath}`);
        } catch (err) {
            console.error(`Error copying custom description files: ${err}`);
        }
    }

    //example messages
    console.log('Updating example messages scripts...');
    const standardExampleMessagesPath = path.join(userDataScriptsPath, 'prompts', 'example messages', 'standard');
    const sourceExampleMessagesPath = path.join(defaultScriptsPath, 'prompts', 'example messages', 'standard');
    if (fs.existsSync(sourceExampleMessagesPath)) {
        // Ensure parent directory exists
        const parentDir = path.dirname(standardExampleMessagesPath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
            console.log(`Created parent directory: ${parentDir}`);
        }
        if (fs.existsSync(standardExampleMessagesPath)) {
            fs.rmSync(standardExampleMessagesPath, { recursive: true, force: true });
            console.log(`Removed old standard example messages directory: ${standardExampleMessagesPath}`);
        }
        fs.cpSync(sourceExampleMessagesPath, standardExampleMessagesPath, { recursive: true });
        console.log(`Copied standard example messages to: ${standardExampleMessagesPath}`);
    } else {
        console.warn(`Source example messages folder not found: ${sourceExampleMessagesPath}`);
    }

    //copy typedefs
    console.log('Updating gamedata_typedefs.js...');
    const typedefsSourcePath = path.join(defaultScriptsPath, 'gamedata_typedefs.js');
    const typedefsDestPath = path.join(userDataScriptsPath, 'gamedata_typedefs.js');
    fs.cpSync(typedefsSourcePath, typedefsDestPath);
    console.log(`Copied gamedata_typedefs.js from ${typedefsSourcePath} to ${typedefsDestPath}`);

    //bookmarks
    console.log('Updating bookmarks...');
    const standardBookmarksPath = path.join(userDataScriptsPath, 'bookmarks', 'standard');
    const sourceBookmarksPath = path.join(defaultScriptsPath, 'bookmarks', 'standard');
    if (fs.existsSync(sourceBookmarksPath)) {
        // Ensure parent directory exists
        const parentDir = path.dirname(standardBookmarksPath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
            console.log(`Created parent directory: ${parentDir}`);
        }
        if (fs.existsSync(standardBookmarksPath)) {
            fs.rmSync(standardBookmarksPath, { recursive: true, force: true });
            console.log(`Removed old standard bookmarks directory: ${standardBookmarksPath}`);
        }
        fs.cpSync(sourceBookmarksPath, standardBookmarksPath, { recursive: true });
        console.log(`Copied standard bookmarks to: ${standardBookmarksPath}`);
    } else {
        console.warn(`Source bookmarks folder not found: ${sourceBookmarksPath}`);
    }

    console.log('User data check and synchronization completed successfully.');
    return true;
}
