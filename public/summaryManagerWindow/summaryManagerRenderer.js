const { ipcRenderer } = require('electron');

// DOM Elements
const playerIdInput = document.getElementById('playerId');
const characterSelect = document.getElementById('characterSelect');
const summaryPathInput = document.getElementById('summaryPath');
const summaryList = document.getElementById('summaryList');
const summaryDateInput = document.getElementById('summaryDate');
const summaryContentInput = document.getElementById('summaryContent');
const statusMessage = document.getElementById('statusMessage');

// Buttons
const refreshBtn = document.getElementById('refreshBtn');
const saveBtn = document.getElementById('saveBtn');
const closeBtn = document.getElementById('closeBtn');
const addSummaryBtn = document.getElementById('addSummaryBtn');
const updateSummaryBtn = document.getElementById('updateSummaryBtn');
const deleteSummaryBtn = document.getElementById('deleteSummaryBtn');
const newSummaryBtn = document.getElementById('newSummaryBtn');

// State variables
let allSummaries = []; // Stores summaries for all characters
let filteredSummaries = []; // Currently displayed summaries (filtered by character)
let currentSummaryIndex = -1;
let playerId = '';
let selectedCharacterId = 'all'; // Currently selected character ID
let userDataPath = '';

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Apply theme
        const savedTheme = localStorage.getItem('selectedTheme') || 'original';
        applyTheme(savedTheme);

        // Initialize language
        const config = await ipcRenderer.invoke('get-config');
        if (window.LocalizationManager) {
            await window.LocalizationManager.loadTranslations(config.language || 'en');
            window.LocalizationManager.applyTranslations();
        }

        // Get user data path
        userDataPath = await ipcRenderer.invoke('get-userdata-path');
        
        // Initial data load
        await loadSummaryData();
        
        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        const errorMsg = window.LocalizationManager ? window.LocalizationManager.getTranslation('summary_manager.load_fail') : 'Initialization failed: ';
        showStatusMessage(errorMsg + error.message, 'error');
        console.error('Initialization error:', error);
    }
});

// Apply theme function
function applyTheme(theme) {
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
    if (window.LocalizationManager) {
        await window.LocalizationManager.loadTranslations(lang);
        window.LocalizationManager.applyTranslations();
        // Repopulate dropdown to update "All Characters" text
        populateCharacterSelect();
        // Rerender list to update "No data" text
        renderSummaryList();
    }
});

// Set up event listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', loadSummaryData);
    saveBtn.addEventListener('click', saveSummaries);
    closeBtn.addEventListener('click', () => ipcRenderer.send('close-summary-manager'));
    addSummaryBtn.addEventListener('click', addNewSummary);
    updateSummaryBtn.addEventListener('click', updateCurrentSummary);
    deleteSummaryBtn.addEventListener('click', deleteCurrentSummary);
    newSummaryBtn.addEventListener('click', resetEditor);
    
    // Character select dropdown change event
    characterSelect.addEventListener('change', filterSummariesByCharacter);
}

// Load summary data
async function loadSummaryData() {
    try {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.loading_data', 'Loading summary data...'), 'info');
        
        // Parse player ID from debug log
        const { playerId: pId } = await ipcRenderer.invoke('get-summary-ids');
        
        if (!pId) {
            throw new Error(window.LocalizationManager.getTranslation('summary_manager.error_parsing_player_id', 'Could not parse player ID from game log'));
        }
        
        playerId = pId;
        
        // Update UI display
        playerIdInput.value = playerId;
        
        const summaryFilePath = `${userDataPath}/conversation_summaries/${playerId}/`;
        summaryPathInput.value = summaryFilePath;
        
        // Read summary file
        allSummaries = await ipcRenderer.invoke('read-summary-file', playerId);
        
        // Get all character IDs and populate dropdown
        populateCharacterSelect();
        
        // Filter and display summaries
        filterSummariesByCharacter();
        
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.load_success', 'Summary data loaded successfully'), 'success');
    } catch (error) {
        const errorMsg = window.LocalizationManager.getTranslation('summary_manager.load_fail_generic', 'Failed to load summary data: ');
        showStatusMessage(errorMsg + error.message, 'error');
        console.error('Error loading summary data:', error);
    }
}

// Populate character select dropdown
function populateCharacterSelect() {
    // Clear existing options (keeping "All Characters")
    const allCharsText = window.LocalizationManager ? window.LocalizationManager.getTranslation('summary_manager.all_characters') : 'All Characters';
    characterSelect.innerHTML = `<option value="all">${allCharsText}</option>`;
    
    // Get all unique character IDs
    const characterIds = [...new Set(allSummaries.map(summary => summary.characterId || 'Unknown'))];
    
    // Add character options
    characterIds.forEach(characterId => {
        const option = document.createElement('option');
        option.value = characterId;
        option.textContent = characterId;
        characterSelect.appendChild(option);
    });
    
    // Restore previous selection
    characterSelect.value = selectedCharacterId;
}

// Filter summaries by selected character
function filterSummariesByCharacter() {
    selectedCharacterId = characterSelect.value;
    
    if (selectedCharacterId === 'all') {
        filteredSummaries = [...allSummaries];
    } else {
        filteredSummaries = allSummaries.filter(summary => 
            (summary.characterId || 'Unknown') === selectedCharacterId
        );
    }
    
    // Sort by date descending (newest first)
    filteredSummaries.sort((a, b) => {
        // Handle different date formats
        const extractDate = (dateStr) => {
            // Try parsing Chinese format first: "1128年2月7日"
            const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
            if (match) {
                return {
                    year: parseInt(match[1]),
                    month: parseInt(match[2]),
                    day: parseInt(match[3])
                };
            }
            // If not in Chinese format, try parsing as a standard date
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return {
                    year: date.getFullYear(),
                    month: date.getMonth() + 1,
                    day: date.getDate()
                };
            }
            // Return a very early date by default if parsing fails
            return { year: 0, month: 1, day: 1 };
        };
        
        const dateA = extractDate(a.date);
        const dateB = extractDate(b.date);
        
        // Compare years
        if (dateB.year !== dateA.year) {
            return dateB.year - dateA.year;
        }
        // Years are the same, compare months
        if (dateB.month !== dateA.month) {
            return dateB.month - dateA.month;
        }
        // Months are the same, compare days
        return dateB.day - dateA.day;
    });
    
    // Reset currently selected summary
    currentSummaryIndex = -1;
    resetEditor();
    
    // Render summary list
    renderSummaryList();
}

// Render summary list
function renderSummaryList() {
    summaryList.innerHTML = '';
    
    if (!filteredSummaries || filteredSummaries.length === 0) {
        const noDataText = window.LocalizationManager ? window.LocalizationManager.getTranslation('summary_manager.no_data') : 'No summary data';
        summaryList.innerHTML = `<div class="no-summaries">${noDataText}</div>`;
        return;
    }
    
    filteredSummaries.forEach((summary, index) => {
        const summaryItem = document.createElement('div');
        summaryItem.className = 'summary-item';
        if (index === currentSummaryIndex) {
            summaryItem.classList.add('selected');
        }
        
        const characterId = summary.characterId || 'Unknown';
        const characterText = window.LocalizationManager.getTranslation('summary_manager.character', 'Character');
        summaryItem.innerHTML = `
            <div class="summary-date">${summary.date} - ${characterText}: ${characterId}</div>
            <div class="summary-content">${summary.content}</div>
        `;
        
        summaryItem.addEventListener('click', () => selectSummary(index));
        summaryList.appendChild(summaryItem);
    });
}

// Select summary
function selectSummary(index) {
    if (index < 0 || index >= filteredSummaries.length) return;
    
    currentSummaryIndex = index;
    const summary = filteredSummaries[index];
    
    summaryDateInput.value = summary.date;
    summaryContentInput.value = summary.content;
    
    // Update selected state
    document.querySelectorAll('.summary-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Add new summary
function addNewSummary() {
    // Get currently selected character ID
    const characterId = selectedCharacterId === 'all' ? 'Default Character' : selectedCharacterId;
    
    const newSummary = {
        date: 'New Date',
        content: 'New summary content',
        characterId: characterId
    };
    
    // Add to all summaries list
    allSummaries.unshift(newSummary);
    
    // Re-filter and display
    filterSummariesByCharacter();
    
    showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.add_success', 'New summary added'), 'success');
}

// Update current summary
function updateCurrentSummary() {
    if (currentSummaryIndex < 0 || currentSummaryIndex >= filteredSummaries.length) {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.select_to_update_error', 'Please select a summary to update first'), 'error');
        return;
    }
    
    // Get original summary object
    const summary = filteredSummaries[currentSummaryIndex];
    
    // Find and update in allSummaries
    const originalIndex = allSummaries.findIndex(s => s === summary);
    if (originalIndex !== -1) {
        allSummaries[originalIndex].date = summaryDateInput.value;
        allSummaries[originalIndex].content = summaryContentInput.value;
    }
    
    // Re-filter and display
    filterSummariesByCharacter();
    
    showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.update_success', 'Summary updated'), 'success');
}

// Delete current summary
function deleteCurrentSummary() {
    if (currentSummaryIndex < 0 || currentSummaryIndex >= filteredSummaries.length) {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.select_to_delete_error', 'Please select a summary to delete first'), 'error');
        return;
    }
    
    const confirmDeleteMsg = window.LocalizationManager.getTranslation('summary_manager.confirm_delete', 'Are you sure you want to delete this summary?');
    if (confirm(confirmDeleteMsg)) {
        // Get original summary object
        const summary = filteredSummaries[currentSummaryIndex];
        
        // Find and delete in allSummaries
        const originalIndex = allSummaries.findIndex(s => s === summary);
        if (originalIndex !== -1) {
            allSummaries.splice(originalIndex, 1);
        }
        
        // Re-filter and display
        filterSummariesByCharacter();
        
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.delete_success', 'Summary deleted'), 'success');
    }
}

// Reset editor
function resetEditor() {
    currentSummaryIndex = -1;
    summaryDateInput.value = '';
    summaryContentInput.value = '';
    
    document.querySelectorAll('.summary-item').forEach(item => {
        item.classList.remove('selected');
    });
}

// Save summaries
async function saveSummaries() {
    try {
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.saving', 'Saving summaries...'), 'info');
        
        await ipcRenderer.invoke('save-summary-file', playerId, allSummaries);
        
        showStatusMessage(window.LocalizationManager.getTranslation('summary_manager.save_success', 'Summaries saved successfully'), 'success');
    } catch (error) {
        const errorMsg = window.LocalizationManager.getTranslation('summary_manager.save_fail', 'Failed to save summaries: ');
        showStatusMessage(errorMsg + error.message, 'error');
        console.error('Error saving summaries:', error);
    }
}

// Show status message
function showStatusMessage(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}
