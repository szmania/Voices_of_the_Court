import { ipcRenderer} from "electron";
import fs from 'fs';
import path from 'path';

let descScriptSelect: any = document.querySelector("#description-script-select")!;
let exMessagesScriptSelect: any = document.querySelector("#example-messages-script-select")!;
let bookmarkScriptSelect: any = document.querySelector("#bookmark-script-select")!;

let scriptSelectorsDiv: HTMLDivElement = document.querySelector("#script-selectors")!;

let suffixPromptCheckbox: any = document.querySelector("#suffix-prompt-checkbox")!;
let suffixPromptTextarea: any = document.querySelector("#suffix-prompt-textarea")!;

let restoreDefaultPromptsBtn: HTMLButtonElement = document.querySelector("#restore-default-prompts")!;

// Preset elements
let promptPresetSelect: HTMLSelectElement = document.querySelector("#prompt-preset-select")!;
let promptPresetNameInput: HTMLInputElement = document.querySelector("#prompt-preset-name-input")!;
let savePromptPresetBtn: HTMLButtonElement = document.querySelector("#save-prompt-preset")!;
let deletePromptPresetBtn: HTMLButtonElement = document.querySelector("#delete-prompt-preset")!;
let resetPresetToDefaultBtn: HTMLButtonElement = document.querySelector("#reset-preset-to-default")!;

const promptKeys = [
    "mainPrompt", "selfTalkPrompt", "summarizePrompt", "selfTalkSummarizePrompt", 
    "memoriesPrompt", "suffixPrompt", "narrativePrompt", "sceneDescriptionPrompt",
    "letterPrompt", "letterSummaryPrompt", "diaryPrompt", "diarySummarizePrompt", "diaryForLetterPrompt"
];

let promptTextareas: { [key: string]: any } = {};
promptKeys.forEach(key => {
    promptTextareas[key] = document.querySelector(`config-textarea[confID="${key}"]`);
});

// Add diary prompt key
promptTextareas["diaryPrompt"] = document.querySelector(`config-textarea[confID="diaryPrompt"]`);

// Add diary prompt key
promptTextareas["diaryPrompt"] = document.querySelector(`config-textarea[confID="diaryPrompt"]`);

let promptPresets: any = {};

function setSaveButtonState(enabled: boolean) {
    savePromptPresetBtn.disabled = !enabled;
    if (savePromptPresetBtn.disabled) {
        savePromptPresetBtn.style.opacity = '0.5';
        savePromptPresetBtn.style.cursor = 'not-allowed';
    } else {
        savePromptPresetBtn.style.opacity = '1';
        savePromptPresetBtn.style.cursor = 'pointer';
    }
}


//init
document.getElementById("container")!.style.display = "block";



init();

// 应用主题函数
function applyTheme(theme: string) {
    const body = document.querySelector('body');
    if (body) {
        body.classList.remove('theme-original', 'theme-chinese', 'theme-west');
        body.classList.add(`theme-${theme}`);
    }
}

// 监听主题更新
ipcRenderer.on('update-theme', (event, theme) => {
    applyTheme(theme);
    localStorage.setItem('selectedTheme', theme);
});

// 监听语言更新
ipcRenderer.on('update-language', async (event, lang) => {
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(lang);
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }
    // Reload prompts for the new language
    const config = await ipcRenderer.invoke('get-config');
    const promptsForLang = config.prompts[lang] || config.prompts.en;
    if (promptsForLang) {
        for (const key of promptKeys) {
            if (promptTextareas[key] && promptsForLang[key] !== undefined) {
                promptTextareas[key].textarea.value = promptsForLang[key];
                // Manually trigger the input event to notify the component
                promptTextareas[key].textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
});

async function init(){
    try {
        addExternalLinks();
        setSaveButtonState(false); // Initially disabled

        const handleInputChange = () => setSaveButtonState(true);

        promptPresetNameInput.addEventListener('input', handleInputChange);
        promptKeys.forEach(key => {
            if (promptTextareas[key] && promptTextareas[key].textarea) {
                // Ensure all prompt textareas are editable
                promptTextareas[key].textarea.disabled = false;
                promptTextareas[key].textarea.addEventListener('input', handleInputChange);
            }
        });
        
        // 应用初始主题
        const savedTheme = localStorage.getItem('selectedTheme') || 'original';
        applyTheme(savedTheme);

        let config = await ipcRenderer.invoke('get-config');
        promptPresets = await ipcRenderer.invoke('get-prompt-presets');

        await populatePresetSelector(config.activePromptPreset);
        console.log('Config loaded, selectedDescScript:', config.selectedDescScript);
        console.log('selectedExMsgScript:', config.selectedExMsgScript);
        console.log('selectedBookmarkScript:', config.selectedBookmarkScript);

        // 初始化语言
        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            await window.LocalizationManager.loadTranslations(config.language || 'en');
            // @ts-ignore
            window.LocalizationManager.applyTranslations();
        }

        const userDataPath = await ipcRenderer.invoke('get-userdata-path');
        console.log('userDataPath:', userDataPath);

        // Compute fallback paths from default_userdata (located two levels up from this file)
        const defaultScriptsBase = path.join(__dirname, '..', '..', 'default_userdata', 'scripts');
        console.log('Default scripts base:', defaultScriptsBase);
        console.log('Default scripts base exists?', fs.existsSync(defaultScriptsBase));

        const descPath = path.join(userDataPath, 'scripts', 'prompts', 'description');
        const fallbackDescPath = path.join(defaultScriptsBase, 'prompts', 'description');
        console.log('Populating desc scripts from:', descPath, 'fallback:', fallbackDescPath);
        console.log('Description folder exists?', fs.existsSync(descPath));
        console.log('Fallback description folder exists?', fs.existsSync(fallbackDescPath));
        populateSelectWithFileNames(descScriptSelect, descPath, '.js', fallbackDescPath, 'desc');
        descScriptSelect.value = config.selectedDescScript;
        console.log('Selected desc script:', config.selectedDescScript, 'options count:', descScriptSelect.options.length);

        const exMsgPath = path.join(userDataPath, 'scripts', 'prompts', 'example messages');
        const fallbackExMsgPath = path.join(defaultScriptsBase, 'prompts', 'example messages');
        console.log('Populating exMsg scripts from:', exMsgPath, 'fallback:', fallbackExMsgPath);
        console.log('Example messages folder exists?', fs.existsSync(exMsgPath));
        console.log('Fallback example messages folder exists?', fs.existsSync(fallbackExMsgPath));
        populateSelectWithFileNames(exMessagesScriptSelect, exMsgPath, '.js', fallbackExMsgPath, 'exMsg');
        exMessagesScriptSelect.value = config.selectedExMsgScript;
        console.log('Selected exMsg script:', config.selectedExMsgScript, 'options count:', exMessagesScriptSelect.options.length);

        const bookmarkPath = path.join(userDataPath, 'scripts', 'bookmarks');
        const fallbackBookmarkPath = path.join(defaultScriptsBase, 'bookmarks');
        console.log('Populating bookmark scripts from:', bookmarkPath, 'fallback:', fallbackBookmarkPath);
        console.log('Bookmarks folder exists?', fs.existsSync(bookmarkPath));
        console.log('Fallback bookmarks folder exists?', fs.existsSync(fallbackBookmarkPath));
        populateSelectWithFileNames(bookmarkScriptSelect, bookmarkPath, '.json', fallbackBookmarkPath, 'bookmark');
        bookmarkScriptSelect.value = config.selectedBookmarkScript;
        console.log('Selected bookmark script:', config.selectedBookmarkScript, 'options count:', bookmarkScriptSelect.options.length);

        togglePrompt(suffixPromptCheckbox.checkbox, suffixPromptTextarea.textarea);

        //events
        promptPresetSelect.addEventListener('change', handlePresetChange);
        savePromptPresetBtn.addEventListener('click', saveCurrentPreset);
        deletePromptPresetBtn.addEventListener('click', deleteSelectedPreset);
        resetPresetToDefaultBtn.addEventListener('click', resetCurrentPresetToDefault);

        descScriptSelect.addEventListener('change', () =>{
            ipcRenderer.send('config-change', "selectedDescScript", descScriptSelect.value);
        });

        exMessagesScriptSelect.addEventListener('change', () =>{
            ipcRenderer.send('config-change', "selectedExMsgScript", exMessagesScriptSelect.value);
        });

        bookmarkScriptSelect.addEventListener('change', () =>{
            ipcRenderer.send('config-change', "selectedBookmarkScript", bookmarkScriptSelect.value);
        });

        suffixPromptCheckbox.checkbox.addEventListener('change', () =>{
            togglePrompt(suffixPromptCheckbox.checkbox, suffixPromptTextarea.textarea);
        });

        // 恢复默认prompts按钮事件
        restoreDefaultPromptsBtn.addEventListener('click', () => restoreDefaultPrompts(true));
    } catch (error) {
        console.error('Error in init:', error);
        // @ts-ignore
        const errorMsg = window.LocalizationManager.getTranslation('dialog.init_error', {}, 'An error occurred while initializing the configuration page, please check the console log.');
        alert(errorMsg);
    }
}



//functions

function togglePrompt(checkbox: HTMLInputElement, textarea: HTMLTextAreaElement){
    
    if(checkbox.checked){
        textarea.style.opacity = "1";
        textarea.disabled = false;
    }
    else{
        textarea.style.opacity = "0.5";
        textarea.disabled = true;
    }
}

function populateSelectWithFileNames(selectElement: HTMLSelectElement, folderPath: string, fileExtension: string, fallbackFolderPath?: string, label?: string): void {
    const logPrefix = label ? `[${label}] ` : '';
    console.log(`${logPrefix}populateSelectWithFileNames: folderPath=${folderPath}, ext=${fileExtension}, fallback=${fallbackFolderPath}`);
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Helper to try populating from a given folder
    const tryPopulate = (targetPath: string, sourceLabel: string): boolean => {
        console.log(`${logPrefix}tryPopulate: targetPath=${targetPath}, sourceLabel=${sourceLabel}`);
        if (!fs.existsSync(targetPath)) {
            console.warn(`${logPrefix}Folder does not exist: ${targetPath}`);
            return false;
        }
        
        let added = false;
        let fileCount = 0;
        function walkDir(currentPath: string, relativePath: string = "") {
            try {
                const entries = fs.readdirSync(currentPath, { withFileTypes: true });
                console.log(`${logPrefix}walkDir: currentPath=${currentPath}, entries=${entries.length}`);
                
                for (const entry of entries) {
                    const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
                    const entryFullPath = path.join(currentPath, entry.name);
                    const entryExt = path.extname(entry.name).toLowerCase();
                    
                    console.log(`${logPrefix}  entry: ${entry.name}, isDirectory: ${entry.isDirectory()}, ext: ${entryExt}`);
                    
                    if (entry.isDirectory()) {
                        walkDir(entryFullPath, entryRelativePath);
                    } else if (entry.isFile() && entryExt === fileExtension.toLowerCase()) {
                        const el = document.createElement("option");
                        // Format display name: "folder / subfolder / filename"
                        const displayName = entryRelativePath
                            .replace(new RegExp(fileExtension + '$', 'i'), '')
                            .replace(/[\\/]/g, ' / ');
                        
                        el.textContent = displayName;
                        el.value = entryRelativePath.replace(/\\/g, '/');
                        selectElement.appendChild(el);
                        added = true;
                        fileCount++;
                        console.log(`${logPrefix}Added option: ${el.value}`);
                    }
                }
            } catch (error) {
                console.error(`${logPrefix}Error walking directory ${currentPath}:`, error);
            }
        }
        
        walkDir(targetPath);
        console.log(`${logPrefix}tryPopulate result: added=${added}, fileCount=${fileCount}`);
        return added;
    };
    
    // First try the primary folder
    let success = tryPopulate(folderPath, 'primary');
    
    // If primary folder yielded no files and a fallback is provided, try the fallback
    if (!success && fallbackFolderPath && fs.existsSync(fallbackFolderPath)) {
        console.log(`${logPrefix}Primary folder empty, trying fallback: ${fallbackFolderPath}`);
        success = tryPopulate(fallbackFolderPath, 'fallback');
    }
    
    // If still no options were added, add a placeholder
    if (!success) {
        const option = document.createElement('option');
        option.textContent = `No ${fileExtension} files found`;
        option.value = '';
        selectElement.appendChild(option);
        console.log(`${logPrefix}Added placeholder option because no files found`);
    } else {
        console.log(`${logPrefix}Total options added: ${selectElement.options.length}`);
    }
}

async function populatePresetSelector(activePreset?: string) {
    promptPresetSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = 'Default';
    defaultOption.textContent = 'Default';
    promptPresetSelect.appendChild(defaultOption);

    // Add custom presets
    for (const presetName in promptPresets) {
        const option = document.createElement('option');
        option.value = presetName;
        option.textContent = presetName;
        promptPresetSelect.appendChild(option);
    }

    promptPresetSelect.value = activePreset || 'Default';
    await handlePresetChange();
}

async function handlePresetChange() {
    const selectedPresetName = promptPresetSelect.value;
    console.log(`Preset changed to: ${selectedPresetName}`);
    promptPresetNameInput.value = selectedPresetName;

    if (selectedPresetName === 'Default') {
        const config = await ipcRenderer.invoke('get-config');
        const lang = config.language || 'en';
        const promptsForLang = config.prompts[lang] || config.prompts.en;
        if (promptsForLang) {
            for (const key of promptKeys) {
                if (promptTextareas[key] && promptsForLang[key] !== undefined) {
                    promptTextareas[key].textarea.value = promptsForLang[key];
                    promptTextareas[key].textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
    } else {
        const preset = promptPresets[selectedPresetName];
        if (preset) {
            for (const key of promptKeys) {
                if (promptTextareas[key] && preset[key] !== undefined) {
                    promptTextareas[key].textarea.value = preset[key];
                    // Manually trigger the input event to notify the component
                    promptTextareas[key].textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
    }
    
    ipcRenderer.send('config-change', 'activePromptPreset', selectedPresetName);
    deletePromptPresetBtn.disabled = (selectedPresetName === 'Default');
    if (deletePromptPresetBtn.disabled) {
        deletePromptPresetBtn.style.opacity = '0.5';
        deletePromptPresetBtn.style.cursor = 'not-allowed';
    } else {
        deletePromptPresetBtn.style.opacity = '1';
        deletePromptPresetBtn.style.cursor = 'pointer';
    }
    setSaveButtonState(false); // Reset on preset change
}

async function saveCurrentPreset() {
    const presetName = promptPresetNameInput.value.trim();
    // @ts-ignore
    const lang = window.LocalizationManager?.language || 'en';

    if (!presetName) {
        // @ts-ignore
        alert(window.LocalizationManager.getNestedTranslation('prompts.save_preset_empty_alert'));
        return;
    }

    if (promptPresets[presetName] && presetName !== promptPresetSelect.value) {
        // @ts-ignore
        const confirmMsg = window.LocalizationManager.getNestedTranslation('prompts.save_preset_overwrite_confirm', { presetName: presetName });
        if (!confirm(confirmMsg)) {
            return;
        }
    }

    const newPreset: any = {};
    for (const key of promptKeys) {
        newPreset[key] = promptTextareas[key].textarea.value;
    }

    promptPresets[presetName] = newPreset;
    await ipcRenderer.invoke('save-prompt-presets', promptPresets);

    await populatePresetSelector(presetName);
    // @ts-ignore
    const successMsg = window.LocalizationManager.getNestedTranslation('prompts.save_preset_success', { presetName: presetName });
    // @ts-ignore
    alert(successMsg.replace('{{presetName}}', presetName));
    setSaveButtonState(false);

    // Re-enable textareas after saving
    promptKeys.forEach(key => {
        if (promptTextareas[key] && promptTextareas[key].textarea) {
            promptTextareas[key].textarea.disabled = false;
        }
    });
    togglePrompt(suffixPromptCheckbox.checkbox, suffixPromptTextarea.textarea);

    // Re-enable textareas after saving
    promptKeys.forEach(key => {
        if (promptTextareas[key] && promptTextareas[key].textarea) {
            promptTextareas[key].textarea.disabled = false;
        }
    });
    togglePrompt(suffixPromptCheckbox.checkbox, suffixPromptTextarea.textarea);

    // Re-enable textareas after saving
    promptKeys.forEach(key => {
        if (promptTextareas[key] && promptTextareas[key].textarea) {
            promptTextareas[key].textarea.disabled = false;
        }
    });
    togglePrompt(suffixPromptCheckbox.checkbox, suffixPromptTextarea.textarea);
}

async function deleteSelectedPreset() {
    const selectedPresetName = promptPresetSelect.value;
    // @ts-ignore
    const lang = window.LocalizationManager?.language || 'en';

    if (selectedPresetName === 'Default') {
        // @ts-ignore
        alert(window.LocalizationManager.getNestedTranslation('prompts.delete_default_preset_alert'));
        return;
    }

    // @ts-ignore
    let confirmMsg = window.LocalizationManager.getNestedTranslation('prompts.delete_preset_confirm', { presetName: selectedPresetName });
    confirmMsg = confirmMsg.replace('{{presetName}}', selectedPresetName);
    if (confirm(confirmMsg)) {
        delete promptPresets[selectedPresetName];
        await ipcRenderer.invoke('save-prompt-presets', promptPresets);
        await populatePresetSelector('Default'); // Switch to default after deletion
        // @ts-ignore
        let successMsg = window.LocalizationManager.getNestedTranslation('prompts.delete_preset_success', { presetName: selectedPresetName });
        // @ts-ignore
        alert(successMsg.replace('{{presetName}}', selectedPresetName));

        // Re-enable textareas after deleting
        promptKeys.forEach(key => {
            if (promptTextareas[key] && promptTextareas[key].textarea) {
                promptTextareas[key].textarea.disabled = false;
            }
        });
        togglePrompt(suffixPromptCheckbox.checkbox, suffixPromptTextarea.textarea);
    }
}

async function restoreDefaultPrompts(showConfirmation = true): Promise<void> {
    try {
        // @ts-ignore
        const lang = window.LocalizationManager?.language || 'en';
        if (showConfirmation) {
            // @ts-ignore
            const confirmMsg = window.LocalizationManager.getNestedTranslation('prompts.restore_defaults_confirm');
            if (!confirm(confirmMsg)) {
                return;
            }
        }

        console.log('Restoring default prompts...');
        
        const defaultConfigPath = path.join(__dirname, '..', '..', 'default_userdata', 'configs', 'default_config.json');
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
        const defaultPrompts = defaultConfig.prompts;
        
        const promptsToApply = defaultPrompts[lang] || defaultPrompts.en;

        for (const [key, value] of Object.entries(promptsToApply)) {
            if (promptTextareas[key]) {
                promptTextareas[key].textarea.value = value;
                // Manually trigger the input event to notify the component
                promptTextareas[key].textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        
        console.log('All prompts restored to default values successfully');
        if (showConfirmation) {
            // @ts-ignore
            const successMsg = window.LocalizationManager.getNestedTranslation('prompts.restore_defaults_success');
            alert(successMsg);
            // 刷新页面以显示新的值
            location.reload();
        }
        
    } catch (error) {
        console.error('Error restoring default prompts:', error);
        // @ts-ignore
        const errorMsg = window.LocalizationManager.getNestedTranslation('prompts.restore_defaults_error', { error: error });
        alert(errorMsg);
    }
}

async function resetCurrentPresetToDefault() {
    // @ts-ignore
    const confirmMsg = window.LocalizationManager.getNestedTranslation('prompts.reset_preset_confirm', { presetName: promptPresetSelect.value });
    if (confirm(confirmMsg)) {
        await restoreDefaultPrompts(false);
        await saveCurrentPreset();
    }
}

function addExternalLinks() {
    const navbarUl = document.querySelector('.navbar ul');
    if (navbarUl) {
        if (navbarUl.querySelector('.social-links-li')) return;
        const socialLinksLi = document.createElement('li');
        socialLinksLi.className = 'social-links-li';
        socialLinksLi.innerHTML = `
            <a href="https://discord.gg/UQpE4mJSqZ" target="_blank" class="social-link discord-link" data-i18n-title="nav.discord_tooltip">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 512 512" fill="currentColor"><path d="m386 137c-24-11-49.5-19-76.3-23.7c-.5 0-1 0-1.2.6c-3.3 5.9-7 13.5-9.5 19.5c-29-4.3-57.5-4.3-85.7 0c-2.6-6.2-6.3-13.7-10-19.5c-.3-.4-.7-.7-1.2-.6c-23 4.6-52.4 13-76 23.7c-.2 0-.4.2-.5.4c-49 73-62 143-55 213c0 .3.2.7.5 1c32 23.6 63 38 93.6 47.3c.5 0 1 0 1.3-.4c7.2-9.8 13.6-20.2 19.2-31.2c.3-.6 0-1.4-.7-1.6c-10-4-20-8.6-29.3-14c-.7-.4-.8-1.5 0-2c2-1.5 4-3 5.8-4.5c.3-.3.8-.3 1.2-.2c61.4 28 128 28 188 0c.4-.2.9-.1 1.2.1c1.9 1.6 3.8 3.1 5.8 4.6c.7.5.6 1.6 0 2c-9.3 5.5-19 10-29.3 14c-.7.3-1 1-.6 1.7c5.6 11 12.1 21.3 19 31c.3.4.8.6 1.3.4c30.6-9.5 61.7-23.8 93.8-47.3c.3-.2.5-.5.5-1c7.8-80.9-13.1-151-55.4-213c0-.2-.3-.4-.5-.4Zm-192 171c-19 0-34-17-34-38c0-21 15-38 34-38c19 0 34 17 34 38c0 21-15 38-34 38zm125 0c-19 0-34-17-34-38c0-21 15-38 34-38c19 0 34 17 34 38c0 21-15 38-34 38z"/></svg>
            </a>
            <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139" target="_blank" class="social-link steam-link" data-i18n-title="nav.steam_tooltip">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M8.15,8.15L11.85,9.5L11.25,11.25L10.5,11.5L9.6,10.65L8.15,11.4L9,12.25L8.25,13.05L6,12.25V11.5L8.15,8.15M14.5,9.5A2.5,2.5 0 0,1 17,12A2.5,2.5 0 0,1 14.5,14.5A2.5,2.5 0 0,1 12,12A2.5,2.5 0 0,1 14.5,9.5M14.5,11A1,1 0 0,0 13.5,12A1,1 0 0,0 14.5,13A1,1 0 0,0 15.5,12A1,1 0 0,0 14.5,11Z" /></svg>
            </a>
            <a href="https://votc-ce.vercel.app/" target="_blank" class="social-link website-link" data-i18n-title="nav.website_tooltip">🌐</a>
        `;
        navbarUl.prepend(socialLinksLi);
    }
}
