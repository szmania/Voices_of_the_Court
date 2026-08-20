import { ipcRenderer, IpcRendererEvent } from 'electron';

let config: any;
let selectedPlayerId: string = '';
let selectedCharacterId: string = 'all';
let characterMap: Record<string, string> = {};

const playerIdSelect = document.getElementById('mc-playerIdSelect') as HTMLSelectElement;
const characterSelect = document.getElementById('mc-characterSelect') as HTMLSelectElement;
const statusMessage = document.getElementById('mc-statusMessage') as HTMLDivElement;

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

window.addEventListener('beforeunload', () => {
    ipcRenderer.removeListener('update-language', languageUpdateHandler);
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

    const container = document.getElementById('container');
    if (container) {
        const memoryConstellation = document.createElement('memory-constellation');
        // Pass character ID from URL params if available
        const characterId = urlParams.get('characterId') || '';
        if (characterId) {
            memoryConstellation.setAttribute('character-id', characterId);
        }
        container.appendChild(memoryConstellation);
    }

    // Set up player ID and character filter dropdowns
    setupFilterDropdowns();

    // Load player IDs and populate dropdowns
    await loadPlayerIds();

    const manualCompactionBtn = document.getElementById('manual-compaction-trigger');
    if (manualCompactionBtn) {
        manualCompactionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.send('manual-compaction-trigger');
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

function setupFilterDropdowns() {
    playerIdSelect.addEventListener('change', () => {
        selectedPlayerId = playerIdSelect.value;
        loadCharactersForPlayer();
    });

    characterSelect.addEventListener('change', () => {
        selectedCharacterId = characterSelect.value;
        updateMemoryConstellation();
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

            selectedPlayerId = playerIdSelect.value;
            await loadCharactersForPlayer();
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

async function loadCharactersForPlayer() {
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

        populateCharacterSelect();
        updateMemoryConstellation();
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
