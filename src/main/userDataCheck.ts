//this file checks the app's userdata folder.

import { app } from "electron";
import path from "path";
import fs from "fs";

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
    // Note: Keys present in userConfig but not in defaultConfig will be ignored,
    // ensuring the output structure matches defaultConfig.
    return merged;
}

async function recreateDir(
    targetDirPath: string, templateDirPath: string, always: boolean, description: string
): Promise<boolean> {
    let exists: boolean;
    try {
        const targetStat: fs.Stats = await fs.promises.stat(targetDirPath);
        exists = true;
        if (!targetStat.isDirectory()) {
            console.warn(`Non-directory exists at ${description} directory location`);
        }
    } catch (err: unknown) {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
            exists = false;
            console.log(`No existing ${description} directory found`);
        } else {
            throw err;
        }
    }

    if (exists) {
        if (always) {
            // Remove the existing directory and continue
            try {
                // Note: Using sync version because fs.promises.rm() may cause EPERM errors on Windows
                fs.rmSync(targetDirPath, {recursive: true});
            } catch (err) {
                console.error(`Failed to remove old ${description} directory: ${targetDirPath}`);
                throw err;
            }
            console.log(`Removed old ${description} directory: ${targetDirPath}`);
        } else {
            // Skip recreating the directory if it already exists
            console.log(`Existing ${description} directory found: not overwriting`);
            return false;
        }
    }

    try {
        await fs.promises.cp(templateDirPath, targetDirPath, {recursive: true});
    } catch (err) {
        console.error(`Error copying ${description}: ${err}`);
    }
    console.log(`Copied ${description} to: ${targetDirPath}`);

    return true;
}


export async function checkUserData(){
    console.log('Starting user data check...');
    const userPath = path.join(app.getPath('userData'), "votc_data");
    console.log(`User data path: ${userPath}`);

    if(!fs.existsSync(userPath)){
        console.log('User data votc folder not found! Creating default folder.');
        await fs.promises.cp(path.join(__dirname, "..", "..", "default_userdata"), userPath, {recursive: true});
        console.log('User data votc default folder created!');

        return;
    }

    console.log('User data votc folder already exists. Validating contents.');

    //folder already exist:

    // Copy default_config.json to ensure it's always present for validation
    const defaultConfigSourcePath = path.join(__dirname, "..", "..", "default_userdata", 'configs', 'default_config.json');
    const defaultConfigDestPath = path.join(userPath, 'configs', 'default_config.json');
    await fs.promises.cp(defaultConfigSourcePath, defaultConfigDestPath);
    console.log(`Copied default_config.json from ${defaultConfigSourcePath} to ${defaultConfigDestPath}`);

    //validate config
    const configPath = path.join(userPath, "configs", "config.json");
    console.log(`Validating config file at: ${configPath}`);
    
    if(fs.existsSync(configPath)){
        // Step 3.1: Read Configurations
        const userConfigRaw = (await fs.promises.readFile(configPath)).toString();
        const userConfig = JSON.parse(userConfigRaw);
        const defaultConfig = JSON.parse((await fs.promises.readFile(defaultConfigDestPath)).toString());

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
            await fs.promises.writeFile(configPath, mergedConfigString);
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

    console.log('Updating scripts...');
    for (const variant of ["standard", "custom"]) {
        const always: boolean = variant === "standard";

        const actionsPath = path.join(userDataScriptsPath, 'actions', variant);
        const actionsTemplatePath = path.join(defaultScriptsPath, 'actions', variant);
        await recreateDir(actionsPath, actionsTemplatePath, always, `${variant} actions`);

        const descriptionPath = path.join(userDataScriptsPath, 'prompts', 'description', variant);
        const descriptionTemplatePath = path.join(defaultScriptsPath, 'prompts', 'description', variant);
        await recreateDir(descriptionPath, descriptionTemplatePath, always, `${variant} description`);

        const exampleMessagesPath = path.join(userDataScriptsPath, 'prompts', 'example messages', variant);
        const exampleMessagesTemplatePath = path.join(defaultScriptsPath, 'prompts', 'example messages', variant);
        await recreateDir(exampleMessagesPath, exampleMessagesTemplatePath, always, `${variant} example messages`);
    }

    //copy typedefs
    console.log('Updating gamedata_typedefs.js...');
    const typedefsSourcePath = path.join(defaultScriptsPath, 'gamedata_typedefs.js');
    const typedefsDestPath = path.join(userDataScriptsPath, 'gamedata_typedefs.js');
    try {
        await fs.promises.cp(typedefsSourcePath, typedefsDestPath, {})
    } catch (err) {
        if (err) {
            console.error(`Error copying gamedata_typedefs.js: ${err}`);
            throw err;
        }
        console.log(`Copied gamedata_typedefs.js from ${typedefsSourcePath} to ${typedefsDestPath}`);
    }

    console.log('User data check completed successfully.');
    return true;
}
