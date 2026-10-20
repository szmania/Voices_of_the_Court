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
let playerIdSelect: HTMLSelectElement;
let characterSelect: HTMLSelectElement;
let searchInput: HTMLInputElement;
let whisperList: HTMLElement;
let statusMessage: HTMLElement;
let sortOrderSelect: HTMLSelectElement;
let refreshCountdownEl: HTMLElement;
let refreshInterval: ReturnType<typeof setInterval> | null = null;
let countdown = 20;

// State
let allWhispers: any[] = [];
let currentPlayerId: string | null = null;
let selectedCharacterId: string = 'all';
let currentSortOrder: 'gameDate' | 'realDate' = 'realDate';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const sectionLabels: { [key: string]: string } = {
    WORLD: 'Distant Lands',
    REALM: 'The Realm',
    COURT: 'Your Court',
    CIRCLE: 'Inner Circle'
};

function formatGameDate(totalDays?: number): string {
    if (!totalDays && totalDays !== 0) return 'Unknown';
    const year = Math.floor(totalDays / 365);
    const dayOfYear = (totalDays % 365) + 1;
    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let day = dayOfYear;
    let month = 1;
    for (let i = 0; i < monthDays.length; i++) {
        if (day <= monthDays[i]) {
            month = i + 1;
            break;
        }
        day -= monthDays[i];
    }
    return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

function formatRealDate(iso?: string): string {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Unknown';
    return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function showStatusMessage(message: string, type: 'success' | 'error' | 'info') {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}

function applyTheme(theme: string) {
    const body = document.querySelector('body');
    if (body) {
        body.classList.remove('theme-original', 'theme-chinese', 'theme-west');
        body.classList.add(`theme-${theme}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    container = document.getElementById('container')!;
    if (container) {
        container.style.display = 'block';
    }
    init();
});

async function init() {
    loader = document.getElementById('whisper-manager-loader') as HTMLElement;
    refreshBtn = document.getElementById('whisper-manager-refresh-btn') as HTMLButtonElement;
    playerIdSelect = document.getElementById('whisper-manager-playerIdSelect') as HTMLSelectElement;
    characterSelect = document.getElementById('whisper-manager-characterSelect') as HTMLSelectElement;
    searchInput = document.getElementById('whisper-manager-search') as HTMLInputElement;
    whisperList = document.getElementById('whisper-manager-diaryList') as HTMLElement;
    statusMessage = document.getElementById('whisper-manager-statusMessage') as HTMLElement;
    sortOrderSelect = document.getElementById('whisper-sort-order') as HTMLSelectElement;
    refreshCountdownEl = document.getElementById('whisper-refresh-countdown') as HTMLElement;

    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    applyTheme(savedTheme);

    const config = await ipcRenderer.invoke('get-config');
    if (window.LocalizationManager) {
        await window.LocalizationManager.loadTranslations(config.language || 'en');
        window.LocalizationManager.applyTranslations();
    }

    setupEventListeners();
    startRefreshInterval();
}

function setupEventListeners() {
    refreshBtn.addEventListener('click', () => refreshWhispers(false));
    playerIdSelect.addEventListener('change', () => {
        currentPlayerId = playerIdSelect.value;
        loadWhispers();
    });
    characterSelect.addEventListener('change', () => {
        selectedCharacterId = characterSelect.value;
        filterAndRenderWhispers();
    });
    searchInput.addEventListener('input', () => {
        filterAndRenderWhispers();
    });
    sortOrderSelect.addEventListener('change', () => {
        currentSortOrder = sortOrderSelect.value as 'gameDate' | 'realDate';
        filterAndRenderWhispers();
    });
}

// Manual refresh resets the countdown; auto refresh (interval tick) does not.
// Mirrors the letters tab: spin animation on the button, silent for auto ticks.
async function refreshWhispers(isAuto = false) {
    if (!isAuto) {
        if (refreshInterval) clearInterval(refreshInterval);
        countdown = 20;
        startRefreshInterval();
    }

    refreshBtn.classList.add('refreshing');
    if (!isAuto) {
        loader.style.display = 'block';
    }

    try {
        const currentPlayerId = playerIdSelect.value;
        const currentCharacterId = characterSelect.value;
        await loadPlayerIds(currentPlayerId, currentCharacterId);
    } catch (error) {
        console.error('Error during whisper refresh:', error);
    } finally {
        if (!isAuto) {
            loader.style.display = 'none';
        }
        // Give the spin animation time to be seen
        setTimeout(() => {
            refreshBtn.classList.remove('refreshing');
        }, 500);
    }
}

function startRefreshInterval() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        countdown--;
        if (refreshCountdownEl) {
            const refreshText = window.LocalizationManager
                ? window.LocalizationManager.getNestedTranslation('whispers.refreshing_in', { seconds: String(countdown) }, `Refreshing in ${countdown}s...`).replace('{seconds}', String(countdown))
                : `Refreshing in ${countdown}s...`;
            refreshCountdownEl.textContent = refreshText;
        }
        if (countdown <= 0) {
            countdown = 20;
            refreshWhispers(true);
        }
    }, 1000);
}

async function loadPlayerIds(preferPlayerId?: string, preferCharacterId?: string) {
    try {
        const result = await ipcRenderer.invoke('get-whisper-players');
        playerIdSelect.innerHTML = '';

        result.forEach((player: { id: string; name: string }) => {
            if (!player.id || !player.name) return;
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = `${player.name} (${player.id})`;
            playerIdSelect.appendChild(option);
        });

        if (preferPlayerId && playerIdSelect.querySelector(`option[value="${preferPlayerId}"]`)) {
            playerIdSelect.value = preferPlayerId;
        } else if (playerIdSelect.options.length > 0) {
            playerIdSelect.value = playerIdSelect.options[0].value;
        }

        currentPlayerId = playerIdSelect.value;

        // Rebuild character dropdown from whispers after loading player ids
        characterSelect.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = window.LocalizationManager
            ? window.LocalizationManager.getNestedTranslation('whispers.all_characters', null, 'All Characters')
            : 'All Characters';
        characterSelect.appendChild(allOption);

        loadWhispers();

        if (preferCharacterId && characterSelect.querySelector(`option[value="${preferCharacterId}"]`)) {
            characterSelect.value = preferCharacterId;
        } else {
            characterSelect.value = 'all';
        }
        selectedCharacterId = characterSelect.value;
    } catch (error) {
        console.error('Failed to load whisper players:', error);
        showStatusMessage('Failed to load player IDs', 'error');
    }
}

async function loadWhispers() {
    if (!currentPlayerId) return;
    whisperList.innerHTML = '';

    try {
        const records: any[] = await ipcRenderer.invoke('get-all-whispers-for-player', currentPlayerId);
        allWhispers = records;
        filterAndRenderWhispers();

        // Repopulate character dropdown with distinct material characters across this player's whispers
        const characters = new Map<number, string>();
        for (const rec of records) {
            for (const c of (rec.materialCharacters || [])) {
                if (!characters.has(c.id)) characters.set(c.id, c.name);
            }
        }
        // Keep existing options beyond index 0 (the 'all' option), rebuild if needed
        const existingCharValues = Array.from(characterSelect.options).map(o => o.value);
        for (const [id, name] of characters) {
            if (!existingCharValues.includes(String(id))) {
                const option = document.createElement('option');
                option.value = String(id);
                option.textContent = `${name} (${id})`;
                characterSelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Failed to load whispers:', error);
        showStatusMessage('Failed to load whispers', 'error');
    }
}

function filterAndRenderWhispers() {
    const search = searchInput?.value.toLowerCase() || '';
    const sortKey = currentSortOrder;

    let filtered = allWhispers.filter(rec => {
        if (selectedCharacterId !== 'all') {
            const ids = (rec.materialCharacters || []).map((c: any) => c.id);
            if (!ids.includes(Number(selectedCharacterId))) return false;
        }
        const text = `${rec.section} ${rec.sectionLabel} ${rec.text}`.toLowerCase();
        return text.includes(search);
    });

    filtered.sort((a, b) => {
        const va = sortKey === 'gameDate' ? a.gameDateTotalDays : new Date(a.realDate).getTime();
        const vb = sortKey === 'gameDate' ? b.gameDateTotalDays : new Date(b.realDate).getTime();
        return vb - va;
    });

    whisperList.innerHTML = '';

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'whisper-empty';
        empty.setAttribute('data-i18n', 'whispers.no_whispers');
        empty.textContent = 'No whispers found.';
        whisperList.appendChild(empty);
        if (window.LocalizationManager) {
            window.LocalizationManager.applyTranslations(whisperList);
        }
        return;
    }

    for (const rec of filtered) {
        const card = document.createElement('div');
        card.className = 'whisper-card';
        card.dataset.id = rec.id;
        card.dataset.playerId = rec.playerId;

        const charNames = (rec.materialCharacters || []).map((c: any) => c.name).join(', ') || '—';
        const sectionLabel = sectionLabels[rec.section] || rec.section;
        const gameDate = formatGameDate(rec.gameDateTotalDays);
        const realDate = formatRealDate(rec.realDate);

        card.innerHTML = `
            <div class="whisper-card-header">
                <div class="whisper-card-title">
                    <span class="whisper-section-badge">${sectionLabel}</span>
                    <span class="whisper-card-dates">${gameDate} &middot; ${realDate}</span>
                </div>
                <button type="button" class="whisper-card-delete" data-i18n-title="whispers.delete" title="Delete">&#128465;</button>
            </div>
            <div class="whisper-card-meta">
                <span>${rec.section}</span>
                <span>&middot;</span>
                <span>${rec.cadenceDays}d</span>
                <span>&middot;</span>
                <span>${charNames}</span>
            </div>
            <div class="whisper-card-text"></div>
        `;

        // Text is assigned via textContent so generated report content can never
        // inject markup into the ledger.
        const textEl = card.querySelector('.whisper-card-text') as HTMLElement;
        textEl.textContent = rec.text || '';

        const deleteBtn = card.querySelector('.whisper-card-delete') as HTMLButtonElement;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteWhisperById(rec.id, rec.playerId || currentPlayerId);
        });

        whisperList.appendChild(card);
    }

    if (window.LocalizationManager) {
        window.LocalizationManager.applyTranslations(whisperList);
    }
}

async function deleteWhisperById(id: string, playerId: string | null) {
    if (!id || !playerId) return;

    const confirmText = window.LocalizationManager
        ? window.LocalizationManager.getNestedTranslation('whispers.delete_confirm', null, 'Are you sure you want to delete this whisper?')
        : 'Are you sure you want to delete this whisper?';
    if (!confirm(confirmText)) return;

    try {
        const result = await ipcRenderer.invoke('delete-whisper', playerId, id);
        if (result.success) {
            const successText = window.LocalizationManager
                ? window.LocalizationManager.getNestedTranslation('whispers.delete_success', null, 'Whisper deleted')
                : 'Whisper deleted';
            showStatusMessage(successText, 'success');
            loadWhispers();
        } else {
            showStatusMessage('Failed to delete whisper', 'error');
        }
    } catch (error) {
        console.error('Failed to delete whisper:', error);
        showStatusMessage('Failed to delete whisper', 'error');
    }
}

window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});
