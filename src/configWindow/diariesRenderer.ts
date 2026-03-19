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
let sortOrderSelect: HTMLSelectElement;

// State
let characterNameMap: { [key: string]: string } = {};
let allDiaryEntries: any[] = [];
let filteredDiaries: any[] = [];
let currentPlayerId: string | null = null;
let selectedCharacterId: string = 'all';
let unsavedChanges = false;
let userDataPath = '';
let currentDiaryIndex = -1;
let editingDiaryIndex = -1;
let dirtyEntries = new Map<string, any>();
let deletedEntries = new Map<string, any>();
let currentHighlightIndex = -1;
let allHighlightMarks: HTMLElement[] = [];
let currentSortOrder: 'gameDate' | 'realDate' = 'realDate';

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
    sortOrderSelect = document.getElementById('diary-sort-order') as HTMLSelectElement;

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
    refreshBtn.addEventListener('click', () => {
        const currentPlayerId = playerIdSelect.value;
        const currentCharacterId = characterSelect.value;
        loadPlayerIds(currentPlayerId, currentCharacterId);
    });
    saveBtn.addEventListener('click', saveAllDiaries);
    addDiaryBtn.addEventListener('click', addNewDiaryEntry);
    deleteItemBtn.addEventListener('click', deleteSelectedDiaryEntry);
    playerIdSelect.addEventListener('change', () => {
        currentPlayerId = playerIdSelect.value;
        loadDiaries('all');
    });
    characterSelect.addEventListener('change', () => {
        selectedCharacterId = characterSelect.value;
        filterAndRenderDiaries();
    });
    searchInput.addEventListener('input', () => {
        currentHighlightIndex = -1; // Reset highlight on new search
        filterAndRenderDiaries();
    });
    searchInput.addEventListener('keydown', handleSearchKeydown);
    sortOrderSelect.addEventListener('change', () => {
        currentSortOrder = sortOrderSelect.value as 'gameDate' | 'realDate';
        filterAndRenderDiaries();
    });
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

async function loadPlayerIds(persistedPlayerId?: string, persistedCharacterId?: string) {
    showLoader(true);
    refreshBtn.disabled = true;
    saveBtn.disabled = true;
    try {
        const result = await ipcRenderer.invoke('get-all-diary-player-ids');
        if (result.success) {
            playerIdSelect.innerHTML = '';
            if (result.ids.length > 0) {
                result.ids.sort((a: { name: string; }, b: { name: string; }) => a.name.localeCompare(b.name));
                result.ids.forEach((player: {id: string, name: string}) => {
                    const option = document.createElement('option');
                    option.value = player.id;
                    option.textContent = `${player.name} (${player.id})`;
                    playerIdSelect.appendChild(option);
                });

                if (persistedPlayerId && result.ids.some((p: { id: string; }) => p.id === persistedPlayerId)) {
                    playerIdSelect.value = persistedPlayerId;
                } else if (result.ids.length > 0) {
                    playerIdSelect.value = result.ids[0].id;
                }
                currentPlayerId = playerIdSelect.value;
                await loadDiaries(persistedCharacterId);
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
        refreshBtn.disabled = false;
        saveBtn.disabled = false;
    }
}

async function loadDiaries(persistedCharacterId?: string) {
    if (!currentPlayerId) return;
    showLoader(true);
    allDiaryEntries = [];
    try {
        const result = await ipcRenderer.invoke('get-diary-character-map', currentPlayerId);
        if (result.success) {
            characterNameMap = result.map;
        } else {
            throw new Error(result.error);
        }
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
        await loadCharacters(persistedCharacterId);
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

async function loadCharacters(persistedCharacterId?: string) {
    if (!currentPlayerId) return;
    const characterIds = [...new Set(allDiaryEntries.map(entry => entry.character_id))];
    
    const allCharsText = window.LocalizationManager.getTranslation('diary_manager.all_characters', 'All Characters');
    characterSelect.innerHTML = `<option value="all">${allCharsText}</option>`;
    
    characterIds.sort((a, b) => {
        const nameA = characterNameMap[a] || `Character ${a}`;
        const nameB = characterNameMap[b] || `Character ${b}`;
        return nameA.localeCompare(nameB);
    });
    characterIds.sort((a, b) => {
        const nameA = characterNameMap[a] || `Character ${a}`;
        const nameB = characterNameMap[b] || `Character ${b}`;
        return nameA.localeCompare(nameB);
    });
    characterIds.sort((a, b) => {
        const nameA = characterNameMap[a] || `Character ${a}`;
        const nameB = characterNameMap[b] || `Character ${b}`;
        return nameA.localeCompare(nameB);
    });
    characterIds.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        const charName = characterNameMap[id] || `Character ${id}`;
        option.textContent = `${charName} (${id})`;
        characterSelect.appendChild(option);
    });

    if (persistedCharacterId && Array.from(characterSelect.options).some(opt => opt.value === persistedCharacterId)) {
        characterSelect.value = persistedCharacterId;
    } else {
        characterSelect.value = 'all';
    }
    selectedCharacterId = characterSelect.value;
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
            const charName = (characterNameMap[entry.character_id] || '').toLowerCase();
            const location = (entry.location || '').toLowerCase();
            const scene = (entry.scene || '').toLowerCase();
            const participants = (entry.participants || []).map((id: string) => characterNameMap[id] || `ID ${id}`).join(', ').toLowerCase();

            return content.includes(searchTerm) ||
                   date.includes(searchTerm) ||
                   charId.includes(searchTerm) ||
                   charName.includes(searchTerm) ||
                   location.includes(searchTerm) ||
                   scene.includes(searchTerm) ||
                   participants.includes(searchTerm);
        });
    }

    if (currentSortOrder === 'gameDate') {
        filteredDiaries.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
        filteredDiaries.sort((a: any, b: any) => {
            const timeA = a.creationTimestamp ? new Date(a.creationTimestamp).getTime() : 0;
            const timeB = b.creationTimestamp ? new Date(b.creationTimestamp).getTime() : 0;
            return timeB - timeA;
        });
    }
    
    currentDiaryIndex = -1;
    editingDiaryIndex = -1;

    if (selectedCharacterId !== 'all' && currentPlayerId) {
        diaryPathInput.value = `${userDataPath}/diary_history/${currentPlayerId}/${selectedCharacterId}.json`.replace(/\\/g, '/');
    } else {
        diaryPathInput.value = '';
    }
    
    renderDiaryList();
}

function handleInPlaceInputChange(index: number) {
    const entry = filteredDiaries[index];
    const dateInput = document.getElementById(`diary-edit-date-${index}`) as HTMLInputElement;
    const locationInput = document.getElementById(`diary-edit-location-${index}`) as HTMLInputElement;
    const sceneInput = document.getElementById(`diary-edit-scene-${index}`) as HTMLInputElement;
    const participantsInput = document.getElementById(`diary-edit-participants-${index}`) as HTMLInputElement;
    const contentInput = document.getElementById(`diary-edit-content-${index}`) as HTMLTextAreaElement;
    const editItem = dateInput.closest('.summary-item-edit');
    const saveButton = editItem?.querySelector('.save-inplace-btn') as HTMLButtonElement;

    if (!dateInput || !contentInput || !entry || !saveButton) return;

    const originalDate = formatDateForInput(entry.date);
    const originalContent = entry.content || '';
    const originalLocation = entry.location || '';
    const originalScene = entry.scene || '';
    const originalParticipants = (entry.participants || []).join(', ');

    const dateChanged = originalDate !== dateInput.value;
    const contentChanged = originalContent !== contentInput.value;
    const locationChanged = originalLocation !== locationInput.value;
    const sceneChanged = originalScene !== sceneInput.value;
    const participantsChanged = originalParticipants !== participantsInput.value;

    const hasChanges = dateChanged || contentChanged || locationChanged || sceneChanged || participantsChanged;
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
    allHighlightMarks = []; // Clear previous marks

    const searchTerm = searchInput.value;
    const highlightRegex = searchTerm ? new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi') : null;

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
            const charName = characterNameMap[characterId] || `Character ${characterId}`;
            
            editItem.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">Character: ${charName} (${characterId})</div>
                <input type="date" id="diary-edit-date-${index}" value="${formatDateForInput(entry.date)}">
                <input type="text" id="diary-edit-location-${index}" value="${entry.location || ''}" placeholder="Location">
                <input type="text" id="diary-edit-scene-${index}" value="${entry.scene || ''}" placeholder="Scene">
                <input type="text" id="diary-edit-participants-${index}" value="${(entry.participants || []).join(', ')}" placeholder="Participants (comma-separated IDs)">
                <textarea id="diary-edit-content-${index}" rows="5">${entry.content || ''}</textarea>
                <div class="edit-controls">
                    <button class="btn cancel-inplace-btn" data-i18n="summary_manager.close_btn">Close</button>
                    <button class="btn save-inplace-btn" data-i18n="summary_manager.save_btn" disabled>Save</button>
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
            const charName = characterNameMap[entry.character_id] || `Character ${entry.character_id}`;
            const participants = (entry.participants || []).map((id: string) => characterNameMap[id] || `ID ${id}`).join(', ');
            const headerText = `${displayDate} - Character: ${charName} (${entry.character_id})`;
            const locationText = `Location: ${entry.location || 'N/A'}`;
            const sceneText = `Scene: ${entry.scene || 'N/A'}`;
            const participantsText = `Participants: ${participants || 'None'}`;
            const contentText = entry.content || 'No Content';

            const headerHTML = highlightRegex ? headerText.replace(highlightRegex, '<mark>$1</mark>') : headerText;
            const locationHTML = highlightRegex ? locationText.replace(highlightRegex, '<mark>$1</mark>') : locationText;
            const sceneHTML = highlightRegex ? sceneText.replace(highlightRegex, '<mark>$1</mark>') : sceneText;
            const participantsHTML = highlightRegex ? participantsText.replace(highlightRegex, '<mark>$1</mark>') : participantsText;
            const contentHTML = highlightRegex ? contentText.replace(highlightRegex, '<mark>$1</mark>') : contentText;
            
            item.innerHTML = `
                <div class="summary-date">${headerHTML}</div>
                <div class="summary-meta">${locationHTML} | ${sceneHTML}</div>
                <div class="summary-meta">Participants: ${participantsHTML}</div>
                <div class="summary-content">${contentHTML}</div>
            `;
            item.addEventListener('click', () => selectDiary(index));
            item.addEventListener('dblclick', () => enterEditMode(index));
            diaryList.appendChild(item);
        }
    });
    deleteItemBtn.disabled = currentDiaryIndex === -1;

    // After rendering, collect all mark elements for 'Enter' key navigation
    allHighlightMarks = Array.from(diaryList.querySelectorAll('mark'));
}

function selectDiary(index: number) {
    if (editingDiaryIndex !== -1) return;
    currentDiaryIndex = index;

    const entry = filteredDiaries[index];
    if (entry && entry.character_id && currentPlayerId) {
        diaryPathInput.value = `${userDataPath}/diary_history/${currentPlayerId}/${entry.character_id}.json`.replace(/\\/g, '/');
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

    // Focus the content textarea
    const contentInput = document.getElementById(`diary-edit-content-${index}`) as HTMLTextAreaElement;
    if (contentInput) {
        contentInput.focus();
    }
}

function cancelInPlaceEdit() {
    const entry = filteredDiaries[editingDiaryIndex];
    if (entry && entry._isNew) {
        const originalIndex = allDiaryEntries.findIndex(e => e.id === entry.id);
        if (originalIndex !== -1) {
            allDiaryEntries.splice(originalIndex, 1);
        }
        dirtyEntries.delete(entry.id);
    }
    editingDiaryIndex = -1;
    filterAndRenderDiaries();
}

async function saveInPlaceEdit(index: number) {
    const entry = filteredDiaries[index];
    const originalIndex = allDiaryEntries.findIndex(e => e.id === entry.id);

    const dateInput = document.getElementById(`diary-edit-date-${index}`) as HTMLInputElement;
    const locationInput = document.getElementById(`diary-edit-location-${index}`) as HTMLInputElement;
    const sceneInput = document.getElementById(`diary-edit-scene-${index}`) as HTMLInputElement;
    const participantsInput = document.getElementById(`diary-edit-participants-${index}`) as HTMLInputElement;
    const contentInput = document.getElementById(`diary-edit-content-${index}`) as HTMLTextAreaElement;

    if (originalIndex !== -1) {
        const updatedEntry = allDiaryEntries[originalIndex];
        updatedEntry.date = dateInput.value;
        updatedEntry.location = locationInput.value;
        updatedEntry.scene = sceneInput.value;
        updatedEntry.participants = participantsInput.value.split(',').map(s => s.trim()).filter(Boolean);
        updatedEntry.content = contentInput.value;
        delete updatedEntry._isNew;
        
        dirtyEntries.set(updatedEntry.id, updatedEntry);
    }

    editingDiaryIndex = -1;
    unsavedChanges = true;
    updateSaveButtonState();
    
    filterAndRenderDiaries();
    currentDiaryIndex = index;
    renderDiaryList();
    showStatus('Entry updated. Click "Save All Diaries" to persist changes and update summary.', 'info');
}

function addNewDiaryEntry() {
    if (editingDiaryIndex !== -1) return;
    if (selectedCharacterId === 'all') {
        showStatus('Please select a character before adding a new diary entry.', 'error');
        return;
    }
    const latestDate = filteredDiaries.length > 0 ? filteredDiaries[0].date : new Date().toISOString().split('T')[0];
    const newEntry = {
        id: window.crypto.randomUUID(),
        date: latestDate,
        content: 'New diary entry...',
        character_id: selectedCharacterId,
        location: '',
        scene: '',
        participants: [],
        creationTimestamp: new Date(),
        _isNew: true
    };
    allDiaryEntries.unshift(newEntry);
    dirtyEntries.set(newEntry.id, newEntry);
    unsavedChanges = true;
    updateSaveButtonState();
    filterAndRenderDiaries();
    
    // Find the index of the new entry in the filtered list after sorting
    const newIndex = filteredDiaries.findIndex(entry => entry === newEntry);

    if (newIndex !== -1) {
        enterEditMode(newIndex);
    } else {
        // Fallback, though this shouldn't happen if the entry is in the list
        enterEditMode(0);
    }
}

function deleteSelectedDiaryEntry() {
    if (currentDiaryIndex === -1) return;
    const confirmKey = 'diary_manager.delete_confirm';
    const confirmMessage = window.LocalizationManager.getTranslation(confirmKey, 'Are you sure you want to delete this diary entry?');
    if (confirm(confirmMessage)) {
        const entryToDelete = filteredDiaries[currentDiaryIndex];
        
        deletedEntries.set(entryToDelete.id, entryToDelete);
        dirtyEntries.delete(entryToDelete.id);

        const originalIndex = allDiaryEntries.findIndex(e => e.id === entryToDelete.id);
        if (originalIndex !== -1) {
            allDiaryEntries.splice(originalIndex, 1);
        }
        unsavedChanges = true;
        updateSaveButtonState();
        filterAndRenderDiaries();
        showStatus('Diary entry marked for deletion. Click "Save All Diaries" to persist.', 'info');
    }
}

async function saveAllDiaries() {
    if (!unsavedChanges) {
        showStatus('No changes to save.', 'info');
        return;
    }
    const saveBtnText = saveBtn.querySelector('.btn-text') as HTMLElement;
    const saveBtnLoader = saveBtn.querySelector('.loader-inline') as HTMLElement;

    showLoader(true);
    refreshBtn.disabled = true;
    saveBtn.disabled = true;

    try {
        const allCharacterIdsInvolved = [...new Set([
            ...allDiaryEntries.map(e => e.character_id),
            ...Array.from(deletedEntries.values()).map((e: any) => e.character_id),
            ...Object.keys(characterNameMap)
        ])];

        for (const charId of allCharacterIdsInvolved) {
            if (!charId) continue;
            const characterEntries = allDiaryEntries
                .filter(entry => entry.character_id === charId)
                .map(entry => {
                    const { _isNew, ...rest } = entry;
                    return rest;
                });

            characterEntries.sort((a: { date: string }, b: { date: string }) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            const diaryData = { diary_entries: characterEntries };
            await ipcRenderer.invoke('save-diary-file', currentPlayerId, charId, diaryData);
        }
        
        showStatus('All diaries saved successfully!', 'success');

        const edited = Array.from(dirtyEntries.values());
        const deleted = Array.from(deletedEntries.values());

        if (edited.length > 0 || deleted.length > 0) {
            if (saveBtnText) saveBtnText.style.display = 'none';
            if (saveBtnLoader) saveBtnLoader.style.display = 'inline-block';
            showStatus(window.LocalizationManager.getTranslation('diary_manager.regenerating_summaries'), 'info');

            await ipcRenderer.invoke('regenerate-diary-summaries', {
                playerId: currentPlayerId,
                editedEntries: edited,
                deletedEntries: deleted
            });

            dirtyEntries.clear();
            deletedEntries.clear();
            showStatus('Summaries updated successfully!', 'success');
        }
        
        unsavedChanges = false;
        updateSaveButtonState();

    } catch (error: any) {
        showStatus('Failed to save diaries or summaries: ' + error.message, 'error');
    } finally {
        showLoader(false);
        refreshBtn.disabled = false;
        saveBtn.disabled = false;
        if (saveBtnText) saveBtnText.style.display = 'inline-block';
        if (saveBtnLoader) saveBtnLoader.style.display = 'none';
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

    // If it's already in YYYY-MM-DD, just return it.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    // Handle YYYY.M.D format from the game
    const gameDateMatch = dateStr.match(/^(\d{1,4})\.(\d{1,2})\.(\d{1,2})$/);
    if (gameDateMatch) {
        const year = gameDateMatch[1].padStart(4, '0');
        const month = gameDateMatch[2].padStart(2, '0');
        const day = gameDateMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Attempt to handle YYYY年MM月DD日 format
    const cjkMatch = dateStr.match(/(\d{1,4})年(\d{1,2})月(\d{1,2})日/);
    if (cjkMatch) {
        return `${cjkMatch[1].padStart(4, '0')}-${cjkMatch[2].padStart(2, '0')}-${cjkMatch[3].padStart(2, '0')}`;
    }
    
    // As a last resort, try new Date(), but it's risky.
    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            // This will use the local timezone's year, month, day, which might be what we want if the string is ambiguous.
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
    } catch(e) {
        // ignore error and fall through
    }

    return new Date().toISOString().split('T')[0]; // Fallback to current date
}

function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        event.preventDefault();
        if (allHighlightMarks.length === 0) return;

        if (currentHighlightIndex !== -1) {
            allHighlightMarks[currentHighlightIndex].classList.remove('current-highlight');
        }

        currentHighlightIndex++;
        if (currentHighlightIndex >= allHighlightMarks.length) {
            currentHighlightIndex = 0;
        }

        const currentMark = allHighlightMarks[currentHighlightIndex];
        currentMark.classList.add('current-highlight');
        currentMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
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
