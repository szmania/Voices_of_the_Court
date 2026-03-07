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
let allDiaryEntries: any[] = [];
let filteredDiaries: any[] = [];
let currentPlayerId: string | null = null;
let selectedCharacterId: string = 'all';
let unsavedChanges = false;
let userDataPath = '';
let currentDiaryIndex = -1;
let editingDiaryIndex = -1;

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

document.addEventListener('DOMContentLoaded', () => {
    container = document.getElementById('container')!;
    if (container) {
        container.style.display = 'block';
    }
    init();
});

async function init() {
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

    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    applyTheme(savedTheme);

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
    addDiaryBtn.addEventListener('click', addNewDiaryEntry);
    deleteItemBtn.addEventListener('click', deleteSelectedDiaryEntry);
    playerIdSelect.addEventListener('change', () => {
        currentPlayerId = playerIdSelect.value;
        loadDiaries();
    });
    characterSelect.addEventListener('change', () => {
        selectedCharacterId = characterSelect.value;
        filterAndRenderDiaries();
    });
    searchInput.addEventListener('input', filterAndRenderDiaries);
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
                showStatus('No diary data available', 'info');
                diaryList.innerHTML = `<div class="no-summaries">No diary data available</div>`;
            }
        } else {
            showStatus(result.error, 'error');
        }
    } catch (error: any) {
        showStatus('Failed to load diary data: ' + error.message, 'error');
    } finally {
        showLoader(false);
    }
}

async function loadDiaries() {
    if (!currentPlayerId) return;
    showLoader(true);
    allDiaryEntries = [];
    try {
        const characterIds: string[] = await ipcRenderer.invoke('get-diary-files', currentPlayerId);
        for (const charId of characterIds) {
            const data = await ipcRenderer.invoke('read-diary-file', currentPlayerId, charId);
            if (data) {
                let entries: any[] = [];
                if (data.diary_entries && Array.isArray(data.diary_entries)) {
                    entries = data.diary_entries;
                } else if (typeof data === 'object' && !Array.isArray(data) && data.date && data.content) {
                    entries = [data];
                }
                entries.forEach(entry => {
                    allDiaryEntries.push({ ...entry, character_id: charId });
                });
            }
        }
        await loadCharacters();
        filterAndRenderDiaries();
        showStatus('Diary data loaded successfully', 'success');
        unsavedChanges = false;
        updateSaveButtonState();
    } catch (error: any) {
        showStatus('Failed to load diary data: ' + error.message, 'error');
    } finally {
        showLoader(false);
    }
}

async function loadCharacters() {
    if (!currentPlayerId) return;
    const characterIds = [...new Set(allDiaryEntries.map(entry => entry.character_id))];
    
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

function filterAndRenderDiaries() {
    if (selectedCharacterId === 'all') {
        filteredDiaries = [...allDiaryEntries];
    } else {
        filteredDiaries = allDiaryEntries.filter(entry => entry.character_id === selectedCharacterId);
    }

    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filteredDiaries = filteredDiaries.filter(entry => {
            const content = entry.content?.toLowerCase() || '';
            const date = entry.date?.toLowerCase() || '';
            const charId = entry.character_id?.toLowerCase() || '';
            return content.includes(searchTerm) || date.includes(searchTerm) || charId.includes(searchTerm);
        });
    }

    filteredDiaries.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    currentDiaryIndex = -1;
    editingDiaryIndex = -1;

    if (selectedCharacterId !== 'all' && currentPlayerId) {
        diaryPathInput.value = `${userDataPath}/diaries/${currentPlayerId}/${selectedCharacterId}.json`.replace(/\\/g, '/');
    } else {
        diaryPathInput.value = '';
    }
    
    renderDiaryList();
}

function handleInPlaceInputChange(index: number) {
    const entry = filteredDiaries[index];
    const dateInput = document.getElementById(`diary-edit-date-${index}`) as HTMLInputElement;
    const contentInput = document.getElementById(`diary-edit-content-${index}`) as HTMLTextAreaElement;
    const editItem = dateInput.closest('.summary-item-edit');
    const saveButton = editItem?.querySelector('.save-inplace-btn') as HTMLButtonElement;

    if (!dateInput || !contentInput || !entry || !saveButton) return;

    const originalDate = formatDateForInput(entry.date);
    const originalContent = entry.content || '';

    const dateChanged = originalDate !== dateInput.value;
    const contentChanged = originalContent !== contentInput.value;

    const hasChanges = dateChanged || contentChanged;
    saveButton.disabled = !hasChanges;

    if (hasChanges) {
        saveButton.classList.add('blinking');
    } else {
        saveButton.classList.remove('blinking');
    }
}

function renderDiaryList() {
    if (!diaryList) return;
    diaryList.innerHTML = '';

    if (filteredDiaries.length === 0) {
        diaryList.innerHTML = `<div class="no-summaries" data-i18n="diary_manager.no_data">No diary data available</div>`;
        window.LocalizationManager.applyTranslations();
        return;
    }

    filteredDiaries.forEach((entry, index) => {
        if (index === editingDiaryIndex) {
            const editItem = document.createElement('div');
            editItem.className = 'summary-item-edit';
            
            const characterId = entry.character_id || 'Unknown';
            
            editItem.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">Character: ${characterId}</div>
                <input type="date" id="diary-edit-date-${index}" value="${formatDateForInput(entry.date)}">
                <textarea id="diary-edit-content-${index}" rows="5">${entry.content || ''}</textarea>
                <div class="edit-controls">
                    <button class="btn save-inplace-btn" disabled>Save</button>
                    <button class="btn cancel-inplace-btn">Cancel</button>
                </div>
            `;
            
            diaryList.appendChild(editItem);

            editItem.querySelector('.save-inplace-btn')?.addEventListener('click', () => saveInPlaceEdit(index));
            editItem.querySelector('.cancel-inplace-btn')?.addEventListener('click', () => cancelInPlaceEdit());

            const dateInput = editItem.querySelector(`#diary-edit-date-${index}`) as HTMLInputElement;
            const contentInput = editItem.querySelector(`#diary-edit-content-${index}`) as HTMLTextAreaElement;
            dateInput?.addEventListener('input', () => handleInPlaceInputChange(index));
            contentInput?.addEventListener('input', () => handleInPlaceInputChange(index));

        } else {
            const item = document.createElement('div');
            item.className = 'summary-item';
            if (index === currentDiaryIndex) {
                item.classList.add('selected');
            }
            item.dataset.index = index.toString();
            
            const displayDate = formatDateForDisplay(entry.date);
            const headerText = `${displayDate} - Character: ${entry.character_id}`;
            
            item.innerHTML = `
                <div class="summary-date">${headerText}</div>
                <div class="summary-content">${entry.content || 'No Content'}</div>
            `;
            item.addEventListener('click', () => selectDiary(index));
            item.addEventListener('dblclick', () => enterEditMode(index));
            diaryList.appendChild(item);
        }
    });
    deleteItemBtn.disabled = currentDiaryIndex === -1;
}

function selectDiary(index: number) {
    if (editingDiaryIndex !== -1) return;
    currentDiaryIndex = index;

    const entry = filteredDiaries[index];
    if (entry && entry.character_id && currentPlayerId) {
        diaryPathInput.value = `${userDataPath}/diaries/${currentPlayerId}/${entry.character_id}.json`.replace(/\\/g, '/');
    }

    renderDiaryList();
}

function enterEditMode(index: number) {
    if (editingDiaryIndex !== -1) {
        cancelInPlaceEdit();
    }
    editingDiaryIndex = index;
    currentDiaryIndex = -1;
    renderDiaryList();
}

function cancelInPlaceEdit() {
    const entry = filteredDiaries[editingDiaryIndex];
    if (entry && entry._isNew) {
        const originalIndex = allDiaryEntries.findIndex(e => e === entry);
        if (originalIndex !== -1) {
            allDiaryEntries.splice(originalIndex, 1);
        }
    }
    editingDiaryIndex = -1;
    filterAndRenderDiaries();
}

function saveInPlaceEdit(index: number) {
    const entry = filteredDiaries[index];
    const originalIndex = allDiaryEntries.findIndex(e => e === entry);

    const dateInput = document.getElementById(`diary-edit-date-${index}`) as HTMLInputElement;
    const contentInput = document.getElementById(`diary-edit-content-${index}`) as HTMLTextAreaElement;

    if (originalIndex !== -1) {
        allDiaryEntries[originalIndex].date = dateInput.value;
        allDiaryEntries[originalIndex].content = contentInput.value;
        delete allDiaryEntries[originalIndex]._isNew;
    }

    editingDiaryIndex = -1;
    unsavedChanges = true;
    updateSaveButtonState();
    filterAndRenderDiaries();
    currentDiaryIndex = index;
    renderDiaryList();
    showStatus('Diary entry updated. Click "Save All Diaries" to persist.', 'info');
}

function addNewDiaryEntry() {
    if (editingDiaryIndex !== -1) return;
    if (selectedCharacterId === 'all') {
        showStatus('Please select a character before adding a new diary entry.', 'error');
        return;
    }
    const newEntry = {
        date: new Date().toISOString().split('T')[0],
        content: 'New diary entry...',
        character_id: selectedCharacterId,
        _isNew: true
    };
    allDiaryEntries.unshift(newEntry);
    filterAndRenderDiaries();
    enterEditMode(0);
}

function deleteSelectedDiaryEntry() {
    if (currentDiaryIndex === -1) return;
    if (confirm('Are you sure you want to delete this diary entry?')) {
        const entryToDelete = filteredDiaries[currentDiaryIndex];
        const originalIndex = allDiaryEntries.findIndex(e => e === entryToDelete);
        if (originalIndex !== -1) {
            allDiaryEntries.splice(originalIndex, 1);
        }
        unsavedChanges = true;
        updateSaveButtonState();
        filterAndRenderDiaries();
        showStatus('Diary entry deleted. Click "Save All Diaries" to persist.', 'info');
    }
}

async function saveAllDiaries() {
    if (!unsavedChanges) {
        showStatus('No changes to save.', 'info');
        return;
    }
    showLoader(true);
    try {
        const diariesByChar = allDiaryEntries.reduce((acc, entry) => {
            const charId = entry.character_id;
            if (!acc[charId]) acc[charId] = [];
            const { character_id, _isNew, ...rest } = entry;
            acc[charId].push(rest);
            return acc;
        }, {} as { [key: string]: any[] });

        for (const charId in diariesByChar) {
            diariesByChar[charId].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const diaryData = { diary_entries: diariesByChar[charId] };
            await ipcRenderer.invoke('save-diary-file', currentPlayerId, charId, diaryData);
        }
        
        unsavedChanges = false;
        updateSaveButtonState();
        showStatus('All diaries saved successfully!', 'success');
    } catch (error: any) {
        showStatus('Failed to save diaries: ' + error.message, 'error');
    } finally {
        showLoader(false);
    }
}

function updateSaveButtonState() {
    if (saveBtn) {
        if (unsavedChanges) {
            saveBtn.classList.add('blinking');
        } else {
            saveBtn.classList.remove('blinking');
        }
    }
}

function formatDateForInput(dateStr: string): string {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    try {
        return new Date(dateStr).toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
}

function formatDateForDisplay(dateStr: string): string {
    if (!dateStr) return 'No Date';
    try {
        const date = new Date(dateStr);
        return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    } catch (e) {
        return dateStr;
    }
}
