import { ipcRenderer } from 'electron';

declare global {
    interface Window {
        LocalizationManager: any;
    }
}

// Main page elements
const useConnectionAPI: HTMLInputElement = document.querySelector<HTMLInputElement>("#use-connection-api")!;
const apiSelector: HTMLElement = document.querySelector("#api-selector")!;

// Summary Manager Elements
const playerIdSelect = document.getElementById('summary-manager-playerIdSelect') as HTMLSelectElement;
const characterSelect = document.getElementById('summary-manager-characterSelect') as HTMLSelectElement;
const summaryPathInput = document.getElementById('summary-manager-summaryPath') as HTMLInputElement;
const summaryList = document.getElementById('summary-manager-summaryList') as HTMLDivElement;
const statusMessage = document.getElementById('summary-manager-statusMessage') as HTMLDivElement;
const summaryLoader = document.getElementById('summary-manager-loader') as HTMLDivElement;
const summarySearchInput = document.getElementById('summary-manager-search') as HTMLInputElement;

// Summary Manager Buttons
const refreshBtn = document.getElementById('summary-manager-refreshBtn') as HTMLButtonElement;
const saveBtn = document.getElementById('summary-manager-saveBtn') as HTMLButtonElement;
const addSummaryBtn = document.getElementById('summary-manager-addSummaryBtn') as HTMLButtonElement;
const saveSummaryBtn = document.getElementById('summary-manager-saveSummaryBtn') as HTMLButtonElement;
const deleteItemBtn = document.getElementById('summary-manager-deleteItemBtn') as HTMLButtonElement;

// Month names for date formatting
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// State variables
let allSummaries: any[] = [];
let filteredSummaries: any[] = [];
let currentSummaryIndex = -1;
let selectedPlayerId = '';
let selectedCharacterId = 'all';
let userDataPath = '';
let currentHighlightIndex = -1;
let allHighlightMarks: HTMLElement[] = [];
let editingSummaryIndex = -1;

//init
document.getElementById("container")!.style.display = "block";
init();

// Apply theme function
function applyTheme(theme: string) {
    const body = document.querySelector('body');
    if (body) {
        body.classList.remove('theme-original', 'theme-chinese', 'theme-west');
        body.classList.add(`theme-${theme}`);
    }
}

// Listen for theme updates
ipcRenderer.on('update-theme', (event, theme) => {
    applyTheme(theme);
    localStorage.setItem('selectedTheme', theme);
});

// Listen for language updates
ipcRenderer.on('update-language', async (event, lang) => {
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(lang);
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
        if (characterSelect) {
            populateCharacterSelect();
        }
        if (summaryList) {
            renderSummaryList();
        }
    }
});

async function init() {
    addExternalLinks();
    // Apply initial theme
    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    applyTheme(savedTheme);

    const config = await ipcRenderer.invoke('get-config');

    // Initialize language
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(config.language || 'en');
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }

    toggleApiSelector();

    useConnectionAPI.addEventListener('change', () => {
        toggleApiSelector();
    });

    initSummaryManager();
}

function toggleApiSelector() {
    //@ts-ignore
    if (useConnectionAPI.checked) {
        apiSelector.style.opacity = "0.5";
        apiSelector.style.pointerEvents = "none";
    } else {
        apiSelector.style.opacity = "1";
        apiSelector.style.pointerEvents = "auto";
    }
}

function addExternalLinks() {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        if (navbar.querySelector('.social-links')) return;
        const socialLinks = document.createElement('div');
        socialLinks.className = 'social-links';
        socialLinks.innerHTML = `
            <a href="https://discord.gg/UQpE4mJSqZ" target="_blank" class="social-link" data-i18n-title="nav.discord_tooltip">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 512 512" fill="currentColor"><path d="m386 137c-24-11-49.5-19-76.3-23.7c-.5 0-1 0-1.2.6c-3.3 5.9-7 13.5-9.5 19.5c-29-4.3-57.5-4.3-85.7 0c-2.6-6.2-6.3-13.7-10-19.5c-.3-.4-.7-.7-1.2-.6c-23 4.6-52.4 13-76 23.7c-.2 0-.4.2-.5.4c-49 73-62 143-55 213c0 .3.2.7.5 1c32 23.6 63 38 93.6 47.3c.5 0 1 0 1.3-.4c7.2-9.8 13.6-20.2 19.2-31.2c.3-.6 0-1.4-.7-1.6c-10-4-20-8.6-29.3-14c-.7-.4-.8-1.5 0-2c2-1.5 4-3 5.8-4.5c.3-.3.8-.3 1.2-.2c61.4 28 128 28 188 0c.4-.2.9-.1 1.2.1c1.9 1.6 3.8 3.1 5.8 4.6c.7.5.6 1.6 0 2c-9.3 5.5-19 10-29.3 14c-.7.3-1 1-.6 1.7c5.6 11 12.1 21.3 19 31c.3.4.8.6 1.3.4c30.6-9.5 61.7-23.8 93.8-47.3c.3-.2.5-.5.5-1c7.8-80.9-13.1-151-55.4-213c0-.2-.3-.4-.5-.4Zm-192 171c-19 0-34-17-34-38c0-21 15-38 34-38c19 0 34 17 34 38c0 21-15 38-34 38zm125 0c-19 0-34-17-34-38c0-21 15-38 34-38c19 0 34 17 34 38c0 21-15 38-34 38z"/></svg>
            </a>
            <a href="https://votc-ce.vercel.app/" target="_blank" class="social-link" data-i18n-title="nav.website_tooltip">🌐</a>
        `;
        navbar.prepend(socialLinks);
    }
}

// Summary Manager Logic
async function initSummaryManager() {
    try {
        userDataPath = await ipcRenderer.invoke('get-userdata-path');
        await loadPlayerIds(); // Load player IDs first
        setupEventListeners();
    } catch (error: any) {
        const errorMsg = window.LocalizationManager ? window.LocalizationManager.getTranslation('summary_manager.load_fail', 'Initialization failed: ') : 'Initialization failed: ';
        showStatusMessage(errorMsg + error.message, 'error');
        console.error('Initialization error:', error);
    }
}

function setupEventListeners() {
    refreshBtn.addEventListener('click', loadPlayerIds);
    saveBtn.addEventListener('click', saveSummaries);
    addSummaryBtn.addEventListener('click', addNewSummary);
    playerIdSelect.addEventListener('change', loadSummaryData);
    characterSelect.addEventListener('change', filterSummariesByCharacter);
    summarySearchInput.addEventListener('input', () => {
        currentHighlightIndex = -1; // Reset highlight on new search
        renderSummaryList();
    });
    summarySearchInput.addEventListener('keydown', handleSearchKeydown);
    
    // In-place editing buttons
    if (saveSummaryBtn) {
        saveSummaryBtn.addEventListener('click', saveInPlaceEdit);
    }
    if (deleteItemBtn) {
        deleteItemBtn.addEventListener('click', deleteCurrentSummary);
    }
}

async function loadPlayerIds() {
    summaryLoader.style.display = 'block';
    try {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.loading_players', 'Loading player IDs...'), 'info');
        const { success, ids, error } = await ipcRenderer.invoke('get-all-summary-player-ids');
        if (!success) {
            throw new Error(error || 'Unknown error');
        }
        
        playerIdSelect.innerHTML = '';
        if (ids && ids.length > 0) {
            ids.forEach((id: string) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = id;
                playerIdSelect.appendChild(option);
            });
            await loadSummaryData(); // Load data for the first player
        } else {
            showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.no_players_found', 'No player summary directories found.'), 'info');
            summaryList.innerHTML = '';
            characterSelect.innerHTML = '';
            allSummaries = [];
            filteredSummaries = [];
        }
    } catch (error: any) {
        const errorMsg = window.LocalizationManager.getTranslation('summary_manager.load_players_fail', 'Failed to load player IDs: ');
        showStatusMessage(errorMsg + error.message, 'error');
        console.error('Error loading player IDs:', error);
    } finally {
        summaryLoader.style.display = 'none';
    }
}

async function loadSummaryData() {
    summaryLoader.style.display = 'block';
    summaryList.innerHTML = '';
    selectedPlayerId = playerIdSelect.value;

    if (!selectedPlayerId) {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.no_player_selected', 'No player selected.'), 'info');
        summaryLoader.style.display = 'none';
        return;
    }

    try {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.loading_data', 'Loading summary data...'), 'info');
        
        allSummaries = await ipcRenderer.invoke('read-summary-file', selectedPlayerId);
        populateCharacterSelect();
        filterSummariesByCharacter();
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.load_success', 'Summary data loaded successfully'), 'success');
    } catch (error: any) {
        const errorMsg = window.LocalizationManager.getTranslation('summary_manager.load_fail_generic', 'Failed to load summary data: ');
        showStatusMessage(errorMsg + error.message, 'error');
        console.error('Error loading summary data:', error);
    } finally {
        summaryLoader.style.display = 'none';
    }
}

function populateCharacterSelect() {
    const allCharsText = window.LocalizationManager ? window.LocalizationManager.getTranslation('summary_manager.all_characters', 'All Characters') : 'All Characters';
    characterSelect.innerHTML = `<option value="all">${allCharsText}</option>`;
    const characterIds = [...new Set(allSummaries.map(summary => summary.characterId || 'Unknown'))];
    characterIds.forEach(characterId => {
        const option = document.createElement('option');
        option.value = characterId;
        option.textContent = characterId;
        characterSelect.appendChild(option);
    });
    characterSelect.value = selectedCharacterId;
}

function filterSummariesByCharacter() {
    selectedCharacterId = characterSelect.value;
    if (selectedCharacterId === 'all') {
        filteredSummaries = [...allSummaries];
    } else {
        filteredSummaries = allSummaries.filter(summary => (summary.characterId || 'Unknown') === selectedCharacterId);
    }
    filteredSummaries.sort((a, b) => {
        const extractDate = (dateStr: string) => {
            const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
            if (match) {
                return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
            }
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
            }
            return { year: 0, month: 1, day: 1 };
        };
        const dateA = extractDate(a.date);
        const dateB = extractDate(b.date);
        if (dateB.year !== dateA.year) return dateB.year - dateA.year;
        if (dateB.month !== dateA.month) return dateB.month - dateA.month;
        return dateB.day - dateA.day;
    });
    currentSummaryIndex = -1;
    resetEditor();
    renderSummaryList();

    if (selectedCharacterId !== 'all') {
        const summaryFilePath = `${userDataPath}/conversation_summaries/${selectedPlayerId}/${selectedCharacterId}.json`;
        summaryPathInput.value = summaryFilePath.replace(/\\\\/g, '/');
    } else {
        summaryPathInput.value = '';
    }
}

function renderSummaryList() {
    const searchTerm = summarySearchInput.value;
    summaryList.innerHTML = '';
    allHighlightMarks = []; // Clear previous marks

    const summariesToRender = searchTerm
        ? filteredSummaries.filter(summary => {
            const content = summary.content || '';
            const date = summary.date || '';
            const characterId = summary.characterId || 'Unknown';
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            return content.toLowerCase().includes(lowerCaseSearchTerm) ||
                   date.toLowerCase().includes(lowerCaseSearchTerm) ||
                   characterId.toLowerCase().includes(lowerCaseSearchTerm);
        })
        : filteredSummaries;

    if (!summariesToRender || summariesToRender.length === 0) {
        const noDataText = window.LocalizationManager ? window.LocalizationManager.getTranslation('summary_manager.no_data', 'No summary data') : 'No summary data';
        summaryList.innerHTML = `<div class="no-summaries">${noDataText}</div>`;
        return;
    }

    const highlightRegex = searchTerm ? new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi') : null;

    summariesToRender.forEach((summary, index) => {
        const originalIndex = filteredSummaries.indexOf(summary);
        
        if (originalIndex === editingSummaryIndex) {
            // Render in edit mode
            const editItem = document.createElement('div');
            editItem.className = 'summary-item-edit';
            
            const characterId = summary.characterId || 'Unknown';
            const characterText = window.LocalizationManager.getTranslation('summary_manager.character', 'Character');
            
            editItem.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">${characterText}: ${characterId}</div>
                <input type="date" id="summary-edit-date-${originalIndex}" value="${formatDateForInput(summary.date)}">
                <textarea id="summary-edit-content-${originalIndex}" rows="3">${summary.content || ''}</textarea>
            `;
            
            // Add event listeners for input changes
            const dateInput = editItem.querySelector(`#summary-edit-date-${originalIndex}`) as HTMLInputElement;
            const contentInput = editItem.querySelector(`#summary-edit-content-${originalIndex}`) as HTMLTextAreaElement;
            
            if (dateInput && contentInput) {
                dateInput.addEventListener('input', () => handleInPlaceInputChange(originalIndex));
                contentInput.addEventListener('input', () => handleInPlaceInputChange(originalIndex));
            }
            
            summaryList.appendChild(editItem);
        } else {
            // Render in display mode
            const summaryItem = document.createElement('div');
            summaryItem.className = 'summary-item';

            if (originalIndex === currentSummaryIndex) {
                summaryItem.classList.add('selected');
            }

            const characterId = summary.characterId || 'Unknown';
            const characterText = window.LocalizationManager.getTranslation('summary_manager.character', 'Character');
            
            // Format date for display
            const displayDate = formatDateForDisplay(summary.date);
            const headerText = `${displayDate} - ${characterText}: ${characterId}`;
            const headerHTML = highlightRegex ? headerText.replace(highlightRegex, '<mark>$1</mark>') : headerText;
            const contentHTML = highlightRegex ? (summary.content || '').replace(highlightRegex, '<mark>$1</mark>') : (summary.content || '');

            summaryItem.innerHTML = `
                <div class="summary-date">${headerHTML}</div>
                <div class="summary-content">${contentHTML}</div>
            `;
            summaryItem.addEventListener('click', () => selectSummary(originalIndex));
            summaryItem.addEventListener('dblclick', () => enterEditMode(originalIndex));
            summaryList.appendChild(summaryItem);
        }
    });

    // After rendering, collect all mark elements for 'Enter' key navigation
    allHighlightMarks = Array.from(summaryList.querySelectorAll('mark'));
    
    // Update save item button state
    if (saveSummaryBtn) {
        saveSummaryBtn.disabled = editingSummaryIndex === -1;
    }
    if (deleteItemBtn) {
        deleteItemBtn.disabled = currentSummaryIndex === -1 || editingSummaryIndex !== -1;
    }
}

function selectSummary(index: number) {
    if (index < 0 || index >= filteredSummaries.length) return;
    
    // Don't allow selection while editing
    if (editingSummaryIndex !== -1) return;
    
    currentSummaryIndex = index;
    const summary = filteredSummaries[index];
    
    // Update file path
    const characterId = summary.characterId || 'Unknown';
    const summaryFilePath = `${userDataPath}/conversation_summaries/${selectedPlayerId}/${characterId}.json`;
    summaryPathInput.value = summaryFilePath.replace(/\\\\/g, '/'); // Normalize path separators

    if (deleteItemBtn) deleteItemBtn.disabled = false; // Enable delete button

    renderSummaryList(); // Re-render to update selection highlight
}

function addNewSummary() {
    if (selectedCharacterId === 'all') {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.select_character_to_add_error', 'Please select a character before adding a new summary.'), 'error');
        return;
    }
    const characterId = selectedCharacterId;
    const newSummary = {
        date: new Date().toISOString().split('T')[0], // Default to today in YYYY-MM-DD format
        content: 'New summary content',
        characterId: characterId
    };
    allSummaries.unshift(newSummary);
    filterSummariesByCharacter();
    
    // Enter edit mode for the new summary
    enterEditMode(0);
    
    showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.add_success', 'New summary added'), 'success');
}


async function deleteCurrentSummary() {
    if (currentSummaryIndex < 0 || currentSummaryIndex >= filteredSummaries.length) {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.select_to_delete_error', 'Please select a summary to delete first'), 'error');
        return;
    }
    const confirmDeleteMsg = window.LocalizationManager.getTranslation('summary_manager.confirm_delete', 'Are you sure you want to delete this summary?');
    if (confirm(confirmDeleteMsg)) {
        const summary = filteredSummaries[currentSummaryIndex];
        const originalIndex = allSummaries.findIndex(s => s === summary);
        if (originalIndex !== -1) {
            allSummaries.splice(originalIndex, 1);
        }
        filterSummariesByCharacter();
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.delete_success', 'Summary deleted'), 'success');
    }
}

function resetEditor() {
    currentSummaryIndex = -1;
    summaryPathInput.value = ''; // Clear path
    if (deleteItemBtn) deleteItemBtn.disabled = true; // Disable delete button
    renderSummaryList();
}

async function saveSummaries() {
    if (!selectedPlayerId) {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.no_player_selected_save', 'No player selected. Cannot save.'), 'error');
        return;
    }
    try {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.saving', 'Saving summaries...'), 'info');
        await ipcRenderer.invoke('save-summary-file', selectedPlayerId, allSummaries);
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.save_success', 'Summaries saved successfully'), 'success');
    } catch (error: any) {
        const errorMsg = window.LocalizationManager.getTranslation('summary_manager.save_fail', 'Failed to save summaries: ');
        showStatusMessage(errorMsg + error.message, 'error');
        console.error('Error saving summaries:', error);
    }
}

function showStatusMessage(message: string, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}

function formatDateForDisplay(dateStr: string): string {
    if (!dateStr) return '';
    
    // If already in DD MMM YYYY format, return as is
    const dmyMatch = dateStr.match(/^(\d{1,2})\s+(\w{3})\s+(\d{1,4})$/i);
    if (dmyMatch) {
        return dateStr;
    }
    
    // Try to parse as YYYY-MM-DD
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        const day = date.getDate();
        const monthIndex = date.getMonth();
        const year = date.getFullYear();
        return `${day} ${monthNames[monthIndex]} ${year}`;
    }
    
    // Return original if parsing fails
    return dateStr;
}

function formatDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    // Handle "DD MMM YYYY" format (e.g., "14 Oct 867")
    const months: { [key: string]: number } = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    
    const dmyMatch = dateStr.match(/^(\d{1,2})\s+(\w{3})\s+(\d{1,4})$/i);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const monthStr = dmyMatch[2].toLowerCase();
        const month = months[monthStr];
        const year = dmyMatch[3];
        
        if (month !== undefined) {
            const monthFormatted = (month + 1).toString().padStart(2, '0');
            return `${year.padStart(4, '0')}-${monthFormatted}-${day}`;
        }
    }
    
    // Attempt to handle YYYY年MM月DD日 format
    const match = dateStr.match(/(\d{1,4})年(\d{1,2})月(\d{1,2})日/);
    if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year.padStart(4, '0')}-${month}-${day}`;
    }
    
    // Attempt to parse with Date constructor for other formats like YYYY-MM-DD
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        // Check if the original string was just a year, which Date might misinterpret
        if (/^\d{1,4}$/.test(dateStr.trim())) {
             return '';
        }
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year.padStart(4, '0')}-${month}-${day}`;
    }
    return ''; // Return empty if parsing fails
}

function handleInPlaceInputChange(index: number) {
    if (index < 0 || index >= filteredSummaries.length) return;
    
    const summary = filteredSummaries[index];
    const dateInput = document.getElementById(`summary-edit-date-${index}`) as HTMLInputElement;
    const contentInput = document.getElementById(`summary-edit-content-${index}`) as HTMLTextAreaElement;
    
    if (!dateInput || !contentInput || !summary) return;
    
    const originalDate = formatDateForInput(summary.date);
    const originalContent = summary.content || '';
    
    const dateChanged = originalDate !== dateInput.value;
    const contentChanged = originalContent !== contentInput.value;
    
    // Enable save button only if changes were made
    if (saveSummaryBtn) {
        saveSummaryBtn.disabled = !(dateChanged || contentChanged);
    }
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

function enterEditMode(index: number) {
    if (index < 0 || index >= filteredSummaries.length) return;
    
    // Exit any existing edit mode without saving
    if (editingSummaryIndex !== -1) {
        // Just cancel the previous edit
    }
    
    editingSummaryIndex = index;
    
    // Disable delete button during edit
    if (deleteItemBtn) deleteItemBtn.disabled = true;
    
    // Enable save summary button
    if (saveSummaryBtn) {
        saveSummaryBtn.disabled = false;
    }
    
    renderSummaryList();
}

function saveInPlaceEdit() {
    if (editingSummaryIndex < 0 || editingSummaryIndex >= filteredSummaries.length) return;
    
    const summary = filteredSummaries[editingSummaryIndex];
    const originalIndex = allSummaries.findIndex(s => s === summary);
    
    const dateInput = document.getElementById(`summary-edit-date-${editingSummaryIndex}`) as HTMLInputElement;
    const contentInput = document.getElementById(`summary-edit-content-${editingSummaryIndex}`) as HTMLTextAreaElement;
    
    if (!dateInput || !contentInput) return;
    
    const newDate = dateInput.value;
    const newContent = contentInput.value;
    
    if (originalIndex !== -1) {
        allSummaries[originalIndex].date = newDate;
        allSummaries[originalIndex].content = newContent;
    }
    
    const justEditedIndex = editingSummaryIndex;
    editingSummaryIndex = -1;
    
    // Disable save summary button
    if (saveSummaryBtn) {
        saveSummaryBtn.disabled = true;
    }
    
    // Enable delete button
    if (deleteItemBtn) {
        deleteItemBtn.disabled = false;
    }
    
    // Refresh the list
    filterSummariesByCharacter();
    
    // Re-select the item that was just edited
    selectSummary(justEditedIndex);
    
    showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.update_success', 'Summary updated'), 'success');
}
