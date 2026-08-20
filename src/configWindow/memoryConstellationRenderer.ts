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
