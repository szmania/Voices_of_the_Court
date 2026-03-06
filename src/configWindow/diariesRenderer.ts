import { ipcRenderer } from 'electron';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('diary-manager-container');
    if (!container) return;

    const loader = document.getElementById('diary-manager-loader') as HTMLElement;
    const refreshBtn = document.getElementById('diary-manager-refreshBtn') as HTMLButtonElement;
    const saveBtn = document.getElementById('diary-manager-saveBtn') as HTMLButtonElement;
    const playerIdSelect = document.getElementById('diary-manager-playerIdSelect') as HTMLSelectElement;
    const characterSelect = document.getElementById('diary-manager-characterSelect') as HTMLSelectElement;
    const diaryPathInput = document.getElementById('diary-manager-diaryPath') as HTMLInputElement;
    const searchInput = document.getElementById('diary-manager-search') as HTMLInputElement;
    const diaryList = document.getElementById('diary-manager-diaryList') as HTMLElement;
    const deleteItemBtn = document.getElementById('diary-manager-deleteItemBtn') as HTMLButtonElement;
    const addDiaryBtn = document.getElementById('diary-manager-addDiaryBtn') as HTMLButtonElement;
    const statusMessage = document.getElementById('diary-manager-statusMessage') as HTMLElement;

    let allDiaries: { [characterId: string]: any[] } = {};
    let currentPlayerId: string | null = null;
    let selectedCharacterId: string | null = 'all';
    let selectedEntryIndex: number | null = null;
    let unsavedChanges = false;

    const showLoader = (show: boolean) => {
        loader.style.display = show ? 'block' : 'none';
    };

    const showStatus = (message: string, type: 'success' | 'error' | 'info') => {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type} show`;
        setTimeout(() => {
            statusMessage.classList.remove('show');
        }, 3000);
    };

    const renderDiaryList = () => {
        diaryList.innerHTML = '';
        const searchTerm = searchInput.value.toLowerCase();
        
        let entriesToShow: any[] = [];
        if (selectedCharacterId === 'all') {
            Object.keys(allDiaries).forEach(charId => {
                allDiaries[charId].forEach(entry => {
                    entriesToShow.push({ ...entry, character_id: charId });
                });
            });
        } else if (allDiaries[selectedCharacterId]) {
            entriesToShow = allDiaries[selectedCharacterId].map(entry => ({ ...entry, character_id: selectedCharacterId }));
        }

        entriesToShow = entriesToShow.filter(entry => {
            const content = entry.content?.toLowerCase() || '';
            const date = entry.date?.toLowerCase() || '';
            return content.includes(searchTerm) || date.includes(searchTerm);
        });

        if (entriesToShow.length === 0) {
            diaryList.innerHTML = `<div class="no-summaries" data-i18n="diary_manager.no_data">No diary data available</div>`;
            // @ts-ignore
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
            });
            diaryList.appendChild(item);
        });
    };

    const loadCharacters = async () => {
        if (!currentPlayerId) return;
        const characterIds: string[] = await ipcRenderer.invoke('get-diary-files', currentPlayerId);
        
        characterSelect.innerHTML = '<option value="all" data-i18n="diary_manager.all_characters">All Characters</option>';
        characterIds.forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = id;
            characterSelect.appendChild(option);
        });
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    };

    const loadDiaries = async () => {
        if (!currentPlayerId) return;
        showLoader(true);
        allDiaries = {};
        const characterIds: string[] = await ipcRenderer.invoke('get-diary-files', currentPlayerId);
        for (const charId of characterIds) {
            const data = await ipcRenderer.invoke('read-diary-file', currentPlayerId, charId);
            if (data && data.diary_entries) {
                allDiaries[charId] = data.diary_entries;
            }
        }
        showLoader(false);
        renderDiaryList();
        await loadCharacters();
    };

    const loadPlayerIds = async () => {
        showLoader(true);
        const result = await ipcRenderer.invoke('get-all-diary-player-ids');
        if (result.success) {
            playerIdSelect.innerHTML = '';
            result.ids.forEach((id: string) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = id;
                playerIdSelect.appendChild(option);
            });
            if (result.ids.length > 0) {
                currentPlayerId = result.ids[0];
                playerIdSelect.value = currentPlayerId!;
                await loadDiaries();
            }
        } else {
            showStatus(result.error, 'error');
        }
        showLoader(false);
    };

    refreshBtn.addEventListener('click', loadPlayerIds);

    playerIdSelect.addEventListener('change', () => {
        currentPlayerId = playerIdSelect.value;
        loadDiaries();
    });

    characterSelect.addEventListener('change', () => {
        selectedCharacterId = characterSelect.value;
        renderDiaryList();
    });

    searchInput.addEventListener('input', renderDiaryList);

    saveBtn.addEventListener('click', async () => {
        if (!unsavedChanges) {
            showStatus('No changes to save.', 'info');
            return;
        }
        showLoader(true);
        for (const charId in allDiaries) {
            const diaryData = { diary_entries: allDiaries[charId] };
            await ipcRenderer.invoke('save-diary-file', currentPlayerId, charId, diaryData);
        }
        unsavedChanges = false;
        showLoader(false);
        showStatus('All diaries saved successfully!', 'success');
    });

    // Initial load
    loadPlayerIds();
});
