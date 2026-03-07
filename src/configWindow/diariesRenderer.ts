import { ipcRenderer } from 'electron';

declare global {
    interface Window {
        LocalizationManager: any;
    }
}

// Elements
let container: HTMLElement;
let loader: HTMLElement;
let refreshBtn: HTMLButtonElement;
let saveBtn: HTMLButtonElement;
let playerIdSelect: HTMLSelectElement;
let characterSelect: HTMLSelectElement;
let diaryPathInput: HTMLInputElement;
let searchInput: HTMLInputElement;
let diaryList: HTMLElement;
let deleteItemBtn: HTMLButtonElement;
let addDiaryBtn: HTMLButtonElement;
let statusMessage: HTMLElement;

// State
let allDiaries: { [characterId: string]: any[] } = {};
let currentPlayerId: string | null = null;
let selectedCharacterId: string = 'all';
let unsavedChanges = false;
let userDataPath = '';

document.addEventListener('DOMContentLoaded', () => {
    container = document.getElementById('container')!;
    if (container) {
        container.style.display = 'block';
    }
    init();
});

async function init() {
    // Assign elements
    loader = document.getElementById('diary-manager-loader') as HTMLElement;
    refreshBtn = document.getElementById('diary-manager-refreshBtn') as HTMLButtonElement;
    saveBtn = document.getElementById('diary-manager-saveBtn') as HTMLButtonElement;
    playerIdSelect = document.getElementById('diary-manager-playerIdSelect') as HTMLSelectElement;
    characterSelect = document.getElementById('diary-manager-characterSelect') as HTMLSelectElement;
    diaryPathInput = document.getElementById('diary-manager-diaryPath') as HTMLInputElement;
    searchInput = document.getElementById('diary-manager-search') as HTMLInputElement;
    diaryList = document.getElementById('diary-manager-diaryList') as HTMLElement;
    deleteItemBtn = document.getElementById('diary-manager-deleteItemBtn') as HTMLButtonElement;
    addDiaryBtn = document.getElementById('diary-manager-addDiaryBtn') as HTMLButtonElement;
    statusMessage = document.getElementById('diary-manager-statusMessage') as HTMLElement;

    // Apply theme
    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    applyTheme(savedTheme);

    // Get config and init localization
    const config = await ipcRenderer.invoke('get-config');
    if (window.LocalizationManager) {
        await window.LocalizationManager.loadTranslations(config.language || 'en');
        window.LocalizationManager.applyTranslations();
    }
    
    userDataPath = await ipcRenderer.invoke('get-userdata-path');

    setupEventListeners();
    await loadPlayerIds();
}

function setupEventListeners() {
    refreshBtn.addEventListener('click', loadPlayerIds);
    saveBtn.addEventListener('click', saveAllDiaries);
    playerIdSelect.addEventListener('change', () => {
        currentPlayerId = playerIdSelect.value;
        loadDiaries();
    });
    characterSelect.addEventListener('change', () => {
        selectedCharacterId = characterSelect.value;
        renderDiaryList();
    });
    searchInput.addEventListener('input', renderDiaryList);
    
    // Add listeners for add/delete if they exist
    if (addDiaryBtn) {
        // addDiaryBtn.addEventListener('click', addNewDiaryEntry);
    }
    if (deleteItemBtn) {
        // deleteItemBtn.addEventListener('click', deleteSelectedDiaryEntry);
    }
}

function applyTheme(theme: string) {
    const body = document.querySelector('body');
    if (body) {
        body.classList.remove('theme-original', 'theme-chinese', 'theme-west');
        body.classList.add(`theme-${theme}`);
    }
}

ipcRenderer.on('update-theme', (event, theme) => {
    applyTheme(theme);
    localStorage.setItem('selectedTheme', theme);
});

ipcRenderer.on('update-language', async (event, lang) => {
    if (window.LocalizationManager) {
        await window.LocalizationManager.loadTranslations(lang);
        window.LocalizationManager.applyTranslations();
        if (characterSelect) {
            loadCharacters();
        }
        if (diaryList) {
            renderDiaryList();
        }
    }
});

const showLoader = (show: boolean) => {
    if (loader) loader.style.display = show ? 'block' : 'none';
};

const showStatus = (message: string, type: 'success' | 'error' | 'info') => {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
};

async function loadPlayerIds() {
    showLoader(true);
    try {
        const result = await ipcRenderer.invoke('get-all-diary-player-ids');
        if (result.success) {
            playerIdSelect.innerHTML = '';
            if (result.ids.length > 0) {
                result.ids.forEach((id: string) => {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = id;
                    playerIdSelect.appendChild(option);
                });
                currentPlayerId = result.ids[0];
                playerIdSelect.value = currentPlayerId!;
                await loadDiaries();
            } else {
                showStatus(window.LocalizationManager.getTranslation('diary_manager.no_data', 'No diary data available'), 'info');
                diaryList.innerHTML = `<div class="no-summaries" data-i18n="diary_manager.no_data">No diary data available</div>`;
                window.LocalizationManager.applyTranslations();
            }
        } else {
            showStatus(result.error, 'error');
        }
    } catch (error: any) {
        showStatus(window.LocalizationManager.getTranslation('diary_manager.load_fail', 'Failed to load diary data: ') + error.message, 'error');
    } finally {
        showLoader(false);
    }
}

async function loadDiaries() {
    if (!currentPlayerId) return;
    showLoader(true);
    allDiaries = {};
    try {
        const characterIds: string[] = await ipcRenderer.invoke('get-diary-files', currentPlayerId);
        for (const charId of characterIds) {
            const data = await ipcRenderer.invoke('read-diary-file', currentPlayerId, charId);
            if (data && data.diary_entries) {
                allDiaries[charId] = data.diary_entries;
            }
        }
        await loadCharacters();
        renderDiaryList();
        showStatus(window.LocalizationManager.getTranslation('diary_manager.load_success', 'Diary data loaded successfully'), 'success');
    } catch (error: any) {
        showStatus(window.LocalizationManager.getTranslation('diary_manager.load_fail', 'Failed to load diary data: ') + error.message, 'error');
    } finally {
        showLoader(false);
    }
}

async function loadCharacters() {
    if (!currentPlayerId) return;
    const characterIds: string[] = await ipcRenderer.invoke('get-diary-files', currentPlayerId);
    
    const allCharsText = window.LocalizationManager.getTranslation('diary_manager.all_characters', 'All Characters');
    characterSelect.innerHTML = `<option value="all">${allCharsText}</option>`;
    
    characterIds.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = id;
        characterSelect.appendChild(option);
    });
    characterSelect.value = selectedCharacterId;
}

function renderDiaryList() {
    if (!diaryList) return;
    diaryList.innerHTML = '';
    const searchTerm = searchInput.value.toLowerCase();
    
    let entriesToShow: any[] = [];
    if (selectedCharacterId === 'all') {
        Object.keys(allDiaries).forEach(charId => {
            allDiaries[charId].forEach(entry => {
                entriesToShow.push({ ...entry, character_id: charId });
            });
        });
    } else if (selectedCharacterId && allDiaries[selectedCharacterId]) {
        entriesToShow = allDiaries[selectedCharacterId].map((entry: any) => ({ ...entry, character_id: selectedCharacterId }));
    }

    entriesToShow = entriesToShow.filter(entry => {
        const content = entry.content?.toLowerCase() || '';
        const date = entry.date?.toLowerCase() || '';
        return content.includes(searchTerm) || date.includes(searchTerm);
    });

    if (entriesToShow.length === 0) {
        diaryList.innerHTML = `<div class="no-summaries" data-i18n="diary_manager.no_data">No diary data available</div>`;
        window.LocalizationManager.applyTranslations();
        return;
    }

    entriesToShow.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.dataset.index = index.toString();
        item.dataset.characterId = entry.character_id; 

        item.innerHTML = `
            <div class="summary-date">${entry.date || 'No Date'}</div>
            <div class="summary-content">${entry.content || 'No Content'}</div>
        `;
        item.addEventListener('click', () => {
            console.log('Selected diary entry:', entry);
            // Here you can implement logic to show entry details
        });
        diaryList.appendChild(item);
    });
}

async function saveAllDiaries() {
    if (!unsavedChanges) {
        showStatus(window.LocalizationManager.getTranslation('diary_manager.no_changes', 'No changes to save.'), 'info');
        return;
    }
    showLoader(true);
    try {
        for (const charId in allDiaries) {
            const diaryData = { diary_entries: allDiaries[charId] };
            await ipcRenderer.invoke('save-diary-file', currentPlayerId, charId, diaryData);
        }
        unsavedChanges = false;
        showStatus(window.LocalizationManager.getTranslation('diary_manager.save_success', 'All diaries saved successfully!'), 'success');
    } catch (error: any) {
        showStatus(window.LocalizationManager.getTranslation('diary_manager.save_fail', 'Failed to save diaries: ') + error.message, 'error');
    } finally {
        showLoader(false);
    }
}
