import { ipcRenderer, IpcRendererEvent } from 'electron';
import "./components/configCheckbox";
import "./components/ConfigSlider";
import "./components/ConfigNumber";
import "./components/ConfigSelect";
import "./components/configTextarea";

let config: any;
let selectedPlayerId: string = '';
let selectedCharacterId: string = 'all';
let characterMap: Record<string, string> = {};
let memoryConstellation: any = null;

const playerIdSelect = document.getElementById('mc-playerIdSelect') as HTMLSelectElement;
const characterSelect = document.getElementById('mc-characterSelect') as HTMLSelectElement;
const statusMessage = document.getElementById('mc-statusMessage') as HTMLDivElement;
const legacyMemoryStatus = document.getElementById('legacy-memory-status') as HTMLSpanElement;

// Persisted player/character filter selection, restored across tab switches (page reloads).
const LAST_FILTER_KEY = 'mc-lastFilter';

// Periodic auto-refresh: reload the Memory Constellation and the Total Memories
// count every 20s so memories written in the background appear without user action.
const AUTO_REFRESH_MS = 20_000;
let autoRefreshIntervalId: number | undefined;

function readPersisted(): { playerId?: string; characterId?: string } {
    try {
        return JSON.parse(localStorage.getItem(LAST_FILTER_KEY) || '{}') || {};
    } catch (e) {
        return {};
    }
}

function savePersisted() {
    try {
        localStorage.setItem(LAST_FILTER_KEY, JSON.stringify({ playerId: selectedPlayerId, characterId: selectedCharacterId }));
    } catch (e) {
        // Best-effort persistence; storage failures are non-fatal.
    }
}

document.getElementById("container")!.style.display = "block";

init();

async function updateMemoryCount() {
    const memoryCountDisplay = document.getElementById('memory-count-display');
    if (!memoryCountDisplay) return;
    
    // Default fallback UI if no player/data
    if (!selectedPlayerId) {
        memoryCountDisplay.textContent = '';
        return;
    }

    try {
        const idToCount = selectedCharacterId === 'all' ? '' : selectedCharacterId;
        const response = await ipcRenderer.invoke('get-memory-count', {
            playerId: selectedPlayerId,
            characterId: idToCount
        });
        let count = 0;
        if (response && response.success && typeof response.count === 'number') {
            count = response.count;
        } else {
            // Mild fallback: actually fetch the memories if `get-memory-count` fails or returns malformed
            const memResponse = await ipcRenderer.invoke('get-memories', {
                playerId: selectedPlayerId,
                characterId: idToCount
            });
            if (memResponse && memResponse.success && Array.isArray(memResponse.memories)) {
                count = memResponse.memories.length;
            }
        }
        
        let countText = '';
        // @ts-ignore
        const t = (key: string, def: string) => window.LocalizationManager?.getTranslation(key, def) || def;
        
        countText = t('memory_constellation.total_memories', 'Player Character Total Memories: {count}').replace('{count}', String(count));
        memoryCountDisplay.textContent = countText;
    } catch (err) {
        console.error('Error updating memory count:', err);
    }
}

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

const languageUpdateHandler = async (event: IpcRendererEvent, lang: string) => {
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(lang);
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }
};
ipcRenderer.on('update-language', languageUpdateHandler);

// Auto-refresh: main broadcasts this whenever new memories are inserted into the vector DB.
const memoriesChangedHandler = () => {
    updateMemoryConstellation();
    updateMemoryCount();
};
ipcRenderer.on('memory-constellation:memories-changed', memoriesChangedHandler);

function startAutoRefresh() {
    if (autoRefreshIntervalId !== undefined) return;
    autoRefreshIntervalId = window.setInterval(() => {
        updateMemoryConstellation();
        updateMemoryCount();
    }, AUTO_REFRESH_MS);
}

function stopAutoRefresh() {
    if (autoRefreshIntervalId !== undefined) {
        clearInterval(autoRefreshIntervalId);
        autoRefreshIntervalId = undefined;
    }
}

window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
    ipcRenderer.removeListener('update-language', languageUpdateHandler);
    ipcRenderer.removeListener('memory-constellation:memories-changed', memoriesChangedHandler);
}, { once: true });

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('source') === 'chat') {
        const closeMenu = document.querySelector('.close-menu');
        if (closeMenu) (closeMenu as HTMLElement).style.display = 'block';

        const closeButton = document.getElementById('close-config-window');
        closeButton?.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.send('request-config-close');
        });
    }

    // Apply initial theme
    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    applyTheme(savedTheme);

    //@ts-ignore
    config = await ipcRenderer.invoke('get-config');

    // Initialize language
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(config.language || 'en');
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }

    const memoryConstellationBox = document.getElementById('memory-constellation-box');
    if (memoryConstellationBox) {
    memoryConstellation = document.createElement('memory-constellation');
        // Pass character ID from URL params if available
        const characterId = urlParams.get('characterId') || '';
        if (characterId) {
            memoryConstellation.setAttribute('character-id', characterId);
        }
        memoryConstellationBox.appendChild(memoryConstellation);
    }

    // Set up player ID and character filter dropdowns
    setupFilterDropdowns();

    // Load player IDs and populate dropdowns
    await loadPlayerIds();
    // Start the periodic auto-refresh once the initial player/filter load has completed.
    startAutoRefresh();
    await updateLegacyMemoryStatus();
    updateMemoryCount();
    await updateLegacyMemoryStatus();

    // Warn if existing memories use a specific embedding dimension
    await checkExistingMemoryDimensions();



    const manualCompactionBtn = document.getElementById('manual-compaction-trigger');
    if (manualCompactionBtn) {
        manualCompactionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.send('manual-compaction-trigger');
        });
    }

    const importLegacyBtn = document.getElementById('import-legacy-memories');
    if (importLegacyBtn) {
        importLegacyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!selectedPlayerId || selectedPlayerId === '') {
                // @ts-ignore
                showStatusMessage(window.LocalizationManager?.getTranslation('summary_manager.no_player_selected', 'Please select a player ID first.'), 'error');
                return;
            }
            
            // @ts-ignore
            showStatusMessage(window.LocalizationManager?.getTranslation('memory_constellation.importing_legacy', 'Importing legacy memories. Please wait...'), 'info');
            try {
                const result = await ipcRenderer.invoke('import-legacy-memories', selectedPlayerId);
                if (result.success) {
                    // @ts-ignore
                    showStatusMessage(window.LocalizationManager?.getTranslation('memory_constellation.import_success', 'Successfully imported {count} legacy memories.').replace('{count}', String(result.count)), 'success');
                    updateLegacyMemoryStatus();
                    updateMemoryConstellation();
                    updateMemoryCount();
                } else {
                    // @ts-ignore
                    showStatusMessage(window.LocalizationManager?.getTranslation('memory_constellation.import_fail', 'Import failed: {error}').replace('{error}', result.error), 'error');
                }
            } catch (err: any) {
                // @ts-ignore
                showStatusMessage(window.LocalizationManager?.getTranslation('memory_constellation.import_error', 'Import error: {error}').replace('{error}', err.message), 'error');
            }
        });
    }

    const exportBtn = document.getElementById('export-player-data');
    if (exportBtn) {
        exportBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const result = await ipcRenderer.invoke('export-player-data');
            if (result.success) {
                console.log('Player data exported to:', result.filePath);
            } else {
                console.error('Export failed:', result.error);
            }
        });
    }

    const importBtn = document.getElementById('import-player-data');
    if (importBtn) {
        importBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const result = await ipcRenderer.invoke('import-player-data');
            if (result.success) {
                console.log('Player data imported from:', result.filePath);
            } else {
                console.error('Import failed:', result.error);
            }
        });
    }

    const mcRefreshBtn = document.getElementById('mc-refresh-button') as HTMLButtonElement | null;
    if (mcRefreshBtn) {
        mcRefreshBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            // Disable while the refresh is in flight to prevent rapid replays.
            mcRefreshBtn.disabled = true;
            try {
                updateMemoryConstellation();
                await updateMemoryCount();
            } finally {
                mcRefreshBtn.disabled = false;
            }
        });
    }

    const reindexBtn = document.getElementById('reindex-embedding-dimensions');
    if (reindexBtn) {
        reindexBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            // @ts-ignore
            showStatusMessage(window.LocalizationManager?.getTranslation('memory_constellation.reindex_start', 'Re-indexing vector database. Please wait...'), 'info');
            try {
                const result = await ipcRenderer.invoke('reindex-embedding-dimensions');
                if (result.success) {
                    // @ts-ignore
                    showStatusMessage(window.LocalizationManager?.getTranslation('memory_constellation.reindex_complete', 'Re-index complete: {embedded}/{total} memories embedded.').replace('{embedded}', String(result.embedded)).replace('{total}', String(result.total)), 'success');
                    updateLegacyMemoryStatus();
                    updateMemoryConstellation();
                    updateMemoryCount();
                    checkExistingMemoryDimensions();
                } else {
                    // @ts-ignore
                    showStatusMessage(window.LocalizationManager?.getTranslation('memory_constellation.reindex_fail', 'Re-index failed: {error}').replace('{error}', result.error), 'error');
                }
            } catch (err: any) {
                // @ts-ignore
                showStatusMessage(window.LocalizationManager?.getTranslation('memory_constellation.reindex_fail', 'Re-index failed: {error}').replace('{error}', err.message), 'error');
            }
        });
    }

    let statusPollInterval: NodeJS.Timeout | null = null;

    async function updateCompactionStatus() {
        try {
            const status = await ipcRenderer.invoke('get-compaction-status');
            const progressBar = document.getElementById('compaction-progress-bar') as HTMLDivElement;
            const phase1Line = document.getElementById('compaction-phase1-line') as HTMLDivElement;
            const usageText = document.getElementById('compaction-context-usage-text') as HTMLSpanElement;
            const statusDisplay = document.getElementById('compaction-status-display') as HTMLSpanElement;
            const lastResult = document.getElementById('compaction-last-result') as HTMLSpanElement;
            const phase1Count = document.getElementById('compaction-phase1-count') as HTMLSpanElement;

            if (progressBar) {
                const pct = Math.min(status.contextUsagePct, 100);
                progressBar.style.width = `${pct}%`;
                progressBar.className = 'compaction-progress-bar';
                if (pct >= status.phase1ThresholdPct) {
                    progressBar.classList.add('danger');
                } else if (pct >= status.phase1ThresholdPct * 0.85) {
                    progressBar.classList.add('warning');
                }
            }
            if (phase1Line) {
                phase1Line.style.left = `${status.phase1ThresholdPct}%`;
            }
            const phase1Label = document.getElementById('compaction-phase1-label') as HTMLSpanElement;
            if (phase1Label) {
                phase1Label.style.left = `${status.phase1ThresholdPct}%`;
                // @ts-ignore
                const thresholdText = window.LocalizationManager ? window.LocalizationManager.getTranslation('settings.compaction_phase1_threshold_label', 'Threshold') : 'Threshold';
                phase1Label.textContent = `${thresholdText} (${status.phase1ThresholdPct}%)`;
            }
            if (usageText) {
                usageText.textContent = `${status.tokenCount} / ${status.contextSize} tokens (${status.contextUsagePct}%)`;
            }
            if (statusDisplay) {
                // @ts-ignore
                const t = (key, def) => window.LocalizationManager?.getTranslation(key, def) || def;
                if (status.isCompacting) {
                    statusDisplay.textContent = t('settings.compaction_status_running', 'Compacting...');
                    statusDisplay.style.color = '#3498db';
                } else if (!status.enableCompaction) {
                    statusDisplay.textContent = 'Disabled';
                    statusDisplay.style.color = '#888';
                } else if (status.cooldownRemaining > 0) {
                    const secs = Math.ceil(status.cooldownRemaining / 1000);
                    statusDisplay.textContent = `Cooldown (${secs}s remaining)`;
                    statusDisplay.style.color = '#ffab00';
                } else {
                    statusDisplay.textContent = t('settings.compaction_status_idle', 'Idle');
                    statusDisplay.style.color = '#4caf50';
                }
            }
            if (phase1Count) {
                // @ts-ignore
                const label = window.LocalizationManager?.getTranslation('settings.compaction_phase1_summaries', 'Phase 1 Summaries:') || 'Phase 1 Summaries:';
                phase1Count.textContent = `${label} ${status.phase1SummaryCount} / ${status.phase2Threshold}`;
            }
            if (lastResult) {
                lastResult.textContent = '';
            }
        } catch (err) {
            // Silently ignore
        }
    }

    ipcRenderer.on('compaction-status-update', (event, result) => {
        const statusDisplay = document.getElementById('compaction-status-display') as HTMLSpanElement;
        const lastResult = document.getElementById('compaction-last-result') as HTMLSpanElement;
        if (statusDisplay) {
            if (result.error) {
                statusDisplay.textContent = 'Error';
                statusDisplay.style.color = '#f44336';
            } else {
                statusDisplay.textContent = 'Completed';
                statusDisplay.style.color = '#4caf50';
                setTimeout(updateCompactionStatus, 2000);
            }
        }
        if (lastResult) {
            if (result.error) {
                lastResult.textContent = `Failed: ${result.error}`;
                lastResult.style.color = '#f44336';
            } else {
                lastResult.textContent = `Last: Phase1=${result.phase1Run ? 'Yes' : 'No'}, Phase2=${result.phase2Run ? 'Yes' : 'No'}, Memories=${result.memoriesCreated}`;
                lastResult.style.color = '#aaa';
            }
        }
    });

    function startCompactionPolling() {
        updateCompactionStatus();
        statusPollInterval = setInterval(updateCompactionStatus, 3000);
    }
    function stopCompactionPolling() {
        if (statusPollInterval) {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
        }
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopCompactionPolling();
        } else {
            startCompactionPolling();
        }
    });
    startCompactionPolling();
}

async function checkExistingMemoryDimensions() {
    const warningEl = document.getElementById('embedding-dimension-warning');
    if (!warningEl) return;
    try {
        const response = await ipcRenderer.invoke('get-memories', { playerId: '', characterId: '', limit: 1 });
        if (response && response.success && Array.isArray(response.memories) && response.memories.length > 0) {
            const firstMemory = response.memories[0];
            const dimension = Array.isArray(firstMemory.vector) ? firstMemory.vector.length : 0;
            if (dimension > 0) {
                // @ts-ignore
                const t = (key: string, def: string) => window.LocalizationManager?.getTranslation(key, def) || def;
                warningEl.textContent = t('memory_constellation.existing_memories_warning', 'Existing memories were found. Your embedding model must produce {dimensions}-dimensional vectors to retain them.').replace('{dimensions}', String(dimension));
                warningEl.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error checking existing memory dimensions:', error);
    }
}




function setupFilterDropdowns() {
    playerIdSelect.addEventListener('change', async () => {
        selectedPlayerId = playerIdSelect.value;
        // Await so the count is computed after the character filter settles on the new player.
        await loadCharactersForPlayer();
        updateMemoryCount();
        savePersisted();
    });

    characterSelect.addEventListener('change', () => {
        selectedCharacterId = characterSelect.value;
        updateMemoryConstellation();
        updateMemoryCount();
        savePersisted();
    });
}

async function loadPlayerIds() {
    try {
        showStatusMessage(
            // @ts-ignore
            window.LocalizationManager?.getTranslation('summary_manager.loading_players', 'Loading player IDs...') || 'Loading player IDs...',
            'info'
        );
        const { success, ids, error } = await ipcRenderer.invoke('get-all-summary-player-ids');
        if (!success) {
            throw new Error(error || 'Unknown error');
        }

        playerIdSelect.innerHTML = '';
        if (ids && ids.length > 0) {
            ids.forEach((player: { id: string; name: string }) => {
                const option = document.createElement('option');
                option.value = player.id;
                option.textContent = player.name === `Player ${player.id}` ? player.id : `${player.name} (${player.id})`;
                playerIdSelect.appendChild(option);
            });

            // Restore the persisted player selection if it still exists; otherwise keep the default (most recent).
            const persisted = readPersisted();
            if (persisted.playerId && ids.some((p: { id: string }) => p.id === persisted.playerId)) {
                selectedPlayerId = persisted.playerId;
                playerIdSelect.value = persisted.playerId;
            } else {
                selectedPlayerId = playerIdSelect.value;
            }
            await loadCharactersForPlayer(persisted.characterId);
            updateMemoryCount();
        } else {
            showStatusMessage(
                // @ts-ignore
                window.LocalizationManager?.getTranslation('summary_manager.no_players_found', 'No player data found.') || 'No player data found.',
                'info'
            );
            characterSelect.innerHTML = '';
            const allCharsText =
                // @ts-ignore
                window.LocalizationManager?.getTranslation('summary_manager.all_characters', 'All Characters') || 'All Characters';
            characterSelect.innerHTML = `<option value="all">${allCharsText}</option>`;
        }
    } catch (error: any) {
        const errorMsg =
            // @ts-ignore
            window.LocalizationManager?.getTranslation('summary_manager.load_players_fail', 'Failed to load player IDs: ') || 'Failed to load player IDs: ';
        showStatusMessage(errorMsg + error.message, 'error');
        console.error('Error loading player IDs:', error);
    }
}

async function loadCharactersForPlayer(preserveCharacterId?: string) {
    if (!selectedPlayerId) {
        showStatusMessage(
            // @ts-ignore
            window.LocalizationManager?.getTranslation('summary_manager.no_player_selected', 'No player selected.') || 'No player selected.',
            'info'
        );
        return;
    }

    try {
        showStatusMessage(
            // @ts-ignore
            window.LocalizationManager?.getTranslation('summary_manager.loading_data', 'Loading characters...') || 'Loading characters...',
            'info'
        );

        // Load character map
        const { success, map, error } = await ipcRenderer.invoke('get-character-map', selectedPlayerId);
        if (success) {
            characterMap = map;
        } else {
            console.warn('Could not load character map:', error);
            characterMap = {};
        }

        memoryConstellation?.setCharacterMap(characterMap);
        // populateCharacterSelect restores preserveCharacterId when present in the options, else defaults to 'all'.
        populateCharacterSelect(preserveCharacterId);
        updateMemoryConstellation();
        updateMemoryCount();
        savePersisted();
    } catch (error: any) {
        const errorMsg =
            // @ts-ignore
            window.LocalizationManager?.getTranslation('summary_manager.load_data_fail', 'Failed to load data: ') || 'Failed to load data: ';
        showStatusMessage(errorMsg + error.message, 'error');
        console.error('Error loading characters:', error);
    }
}

function populateCharacterSelect(preserveCharacterId?: string) {
    const allCharsText =
        // @ts-ignore
        window.LocalizationManager?.getTranslation('summary_manager.all_characters', 'All Characters') || 'All Characters';
    characterSelect.innerHTML = `<option value="all">${allCharsText}</option>`;

    const sortedCharacters = Object.entries(characterMap).sort((a, b) => a[1].localeCompare(b[1]));
    sortedCharacters.forEach(([characterId, characterName]) => {
        const option = document.createElement('option');
        option.value = characterId;
        option.textContent = `${characterName} (${characterId})`;
        characterSelect.appendChild(option);
    });

    if (preserveCharacterId && Array.from(characterSelect.options).some(opt => opt.value === preserveCharacterId)) {
        characterSelect.value = preserveCharacterId;
    } else {
        characterSelect.value = 'all';
    }
    selectedCharacterId = characterSelect.value;
}

async function updateLegacyMemoryStatus() {
    if (!legacyMemoryStatus) return;
    if (!selectedPlayerId) {
        legacyMemoryStatus.textContent = '';
        return;
    }
    // @ts-ignore
    const t = (key: string, def: string) => window.LocalizationManager?.getTranslation(key, def) || def;
    try {
        const result = await ipcRenderer.invoke('get-legacy-memory-status', selectedPlayerId);
        if (!result.success) {
            legacyMemoryStatus.textContent = t('memory_constellation.legacy_status_error', 'Error checking legacy memory status');
            legacyMemoryStatus.style.color = '#f44336';
            return;
        }
        if (!result.hasLegacy) {
            legacyMemoryStatus.textContent = t('memory_constellation.legacy_status_no_legacy', 'No legacy memories found');
            legacyMemoryStatus.style.color = '#888';
            return;
        }
        if (result.allLoaded) {
            legacyMemoryStatus.textContent = t('memory_constellation.legacy_status_loaded', 'Legacy memories loaded ({count})').replace('{count}', String(result.loadedCount));
            legacyMemoryStatus.style.color = '#4caf50';
        } else if (result.loadedCount > 0) {
            legacyMemoryStatus.textContent = t('memory_constellation.legacy_status_partial', 'Legacy memories partially loaded ({loaded}/{total})')
                .replace('{loaded}', String(result.loadedCount)).replace('{total}', String(result.totalLegacy));
            legacyMemoryStatus.style.color = '#ffab00';
        } else {
            legacyMemoryStatus.textContent = t('memory_constellation.legacy_status_not_loaded', 'Legacy memories not loaded ({loaded}/{total})')
                .replace('{loaded}', String(result.loadedCount)).replace('{total}', String(result.totalLegacy));
            legacyMemoryStatus.style.color = '#ffab00';
        }
    } catch (err) {
        legacyMemoryStatus.textContent = t('memory_constellation.legacy_status_error', 'Error checking legacy memory status');
        legacyMemoryStatus.style.color = '#f44336';
    }
}

function updateMemoryConstellation() {
    const memoryConstellation = document.querySelector('memory-constellation') as any;
    if (memoryConstellation && typeof memoryConstellation.reloadWithFilter === 'function') {
        const characterId = selectedCharacterId === 'all' ? undefined : selectedCharacterId;
        memoryConstellation.reloadWithFilter(selectedPlayerId, characterId);
    }
}

function showStatusMessage(message: string, type: string = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 5000);
}
