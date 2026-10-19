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
let deleteItemBtn: HTMLButtonElement;
let statusMessage: HTMLElement;
let sortOrderSelect: HTMLSelectElement;

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
    deleteItemBtn = document.getElementById('whisper-manager-deleteItemBtn') as HTMLButtonElement;
    statusMessage = document.getElementById('whisper-manager-statusMessage') as HTMLElement;
    sortOrderSelect = document.getElementById('whisper-sort-order') as HTMLSelectElement;

    const savedTheme = localStorage.getItem('selectedTheme') || 'original';
    applyTheme(savedTheme);

    const config = await ipcRenderer.invoke('get-config');
    if (window.LocalizationManager) {
        await window.LocalizationManager.loadTranslations(config.language || 'en');
        window.LocalizationManager.applyTranslations();
    }

    setupEventListeners();
    await loadPlayerIds();
}

function setupEventListeners() {
    refreshBtn.addEventListener('click', () => {
        const currentPlayerId = playerIdSelect.value;
        const currentCharacterId = characterSelect.value;
        loadPlayerIds(currentPlayerId, currentCharacterId);
    });
    deleteItemBtn.addEventListener('click', deleteSelectedWhisper);
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
    deleteItemBtn.disabled = true;

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

        if (records.length > 0) {
            deleteItemBtn.disabled = false;
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
    for (const [index, rec] of filtered.entries()) {
        const item = document.createElement('div');
        item.className = 'summary-item';
        if (index === 0) {
            item.classList.add('selected');
            item.dataset.selected = 'true';
        }
        item.dataset.id = rec.id;
        item.dataset.playerId = rec.playerId;

        const charNames = (rec.materialCharacters || []).map((c: any) => c.name).join(', ') || '—';
        const sectionLabel = sectionLabels[rec.section] || rec.section;
        const gameDate = formatGameDate(rec.gameDateTotalDays);
        const realDate = formatRealDate(rec.realDate);

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; gap: 8px;">
                <div style="font-weight: 600;">${sectionLabel}</div>
                <div style="font-size: 0.85em; color: #8ab4f8;">${realDate}</div>
            </div>
            <div style="margin-top: 4px; font-size: 0.9em;">
                ${gameDate} · ${rec.section} · ${rec.cadenceDays}d · characters: ${charNames}
            </div>
        `;

        item.addEventListener('click', () => {
            document.querySelectorAll('.summary-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            deleteItemBtn.disabled = false;
        });

        whisperList.appendChild(item);
    }
}

async function deleteSelectedWhisper() {
    const selected = whisperList.querySelector('.summary-item.selected') as HTMLElement;
    if (!selected) return;
    const id = selected.dataset.id;
    const playerId = selected.dataset.playerId || currentPlayerId;
    if (!id) return;

    if (!confirm('Delete this whisper entry?')) return;

    try {
        const result = await ipcRenderer.invoke('delete-whisper', playerId, id);
        if (result.success) {
            showStatusMessage('Whisper deleted', 'success');
            loadWhispers();
        } else {
            showStatusMessage('Failed to delete whisper', 'error');
        }
    } catch (error) {
        console.error('Failed to delete whisper:', error);
        showStatusMessage('Failed to delete whisper', 'error');
    }
}