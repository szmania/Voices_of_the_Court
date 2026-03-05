//this file checks the app's userdata folder.

import { app} from "electron";
import path from 'path';
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
                mergedConfig[conf].connection.apiKeys.player2.key = "019cb2bb-6704-7d22-89e5-41ce7c765942";
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
                defaultConfig[conf].connection.apiKeys.player2.key = "019cb2bb-6704-7d22-89e5-41ce7c765942";
            }
        }
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, '\t'));
    }

    console.log('User data check and synchronization completed successfully.');
    return true;
}
