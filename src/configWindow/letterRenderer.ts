import { ipcRenderer } from 'electron';
import { Letter } from '../main/letter/letterInterfaces.js';

const loader = document.getElementById('letter-loader') as HTMLDivElement;

function formatDate(date: Date): string {
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

// State
let allLetters: Letter[] = [];
let selectedPlayerId: string | null = null;
let selectedCharacterId: string | null = 'all';
let currentView: 'inbox' | 'outbox' = 'inbox';

const initLocalization = async (lang?: string) => {
    if (window.LocalizationManager) {
        // @ts-ignore
        let language = lang;
        if (!language) {
            // @ts-ignore
            const config = await ipcRenderer.invoke('get-config');
            language = config.language || 'en';
        }
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(language);
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }
};


function renderLetters() {
    const letterList = document.getElementById('letter-list');
    if (!letterList) return;

    letterList.innerHTML = ''; // Clear existing list

    if (!selectedPlayerId) {
        const noLettersItem = document.createElement('li');
        noLettersItem.setAttribute('data-i18n', 'letters.no_player');
        noLettersItem.textContent = 'Select a player to view letters.'; // Fallback text
        letterList.appendChild(noLettersItem);
        if (window.LocalizationManager) {
            // @ts-ignore
            window.LocalizationManager.applyTranslations();
        }
        return;
    }

    const filteredLetters = allLetters.filter(letter => {
        if (!letter.recipient || !letter.sender) return false;

        const isInbox = letter.recipient.id === Number(selectedPlayerId);
        const isOutbox = letter.sender.id === Number(selectedPlayerId);

        if (currentView === 'inbox' && !isInbox) return false;
        if (currentView === 'outbox' && !isOutbox) return false;

        if (selectedCharacterId && selectedCharacterId !== 'all') {
            const otherPartyId = isInbox ? letter.sender.id : letter.recipient.id;
            return String(otherPartyId) === selectedCharacterId;
        }

        return true;
    });

    if (filteredLetters.length === 0) {
        const noLettersItem = document.createElement('li');
        noLettersItem.setAttribute('data-i18n', 'letters.no_letters');
        noLettersItem.textContent = 'No letters found.'; // Fallback text
        letterList.appendChild(noLettersItem);
        if (window.LocalizationManager) {
            // @ts-ignore
            window.LocalizationManager.applyTranslations();
        }
        return;
    }

    filteredLetters.forEach(letter => {
        const li = document.createElement('li');
        li.dataset.letterId = letter.id;
        li.classList.add('letter-item');
        if (!letter.isRead && currentView === 'inbox') {
            li.classList.add('unread');
        }

        const otherParty = currentView === 'inbox' ? letter.sender : letter.recipient;

        li.innerHTML = `
            <div class="letter-item-header">
                <span class="letter-item-party">${otherParty.shortName}</span>
                <span class="letter-item-date">${formatDate(new Date(letter.timestamp))}</span>
            </div>
            <div class="letter-item-subject">${letter.subject}</div>
        `;

        li.addEventListener('click', () => {
            renderLetterContent(letter);
            // Mark as read if it's an inbox letter
            if (currentView === 'inbox' && !letter.isRead) {
                ipcRenderer.send('mark-letter-as-read', { playerId: selectedPlayerId, characterId: String(letter.sender.id), letterId: letter.id });
                letter.isRead = true; // Update local state
                li.classList.remove('unread');
            }
            // Highlight selected
            document.querySelectorAll('.letter-item.selected').forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
        });
        letterList.appendChild(li);
    });
}

function renderLetterContent(letter: Letter) {
    const letterViewContainer = document.getElementById('letter-view-container');
    if (!letterViewContainer) return;

    letterViewContainer.innerHTML = `
        <div class="letter-view-header">
            <h3>${letter.subject}</h3>
            <div class="letter-view-meta">
                <span><strong>From:</strong> ${letter.sender.fullName}</span>
                <span><strong>To:</strong> ${letter.recipient.fullName}</span>
                <span><strong>Date:</strong> ${formatDate(new Date(letter.timestamp))}</span>
            </div>
        </div>
        <div class="letter-view-body">
            ${letter.content.replace(/\n/g, '<br>')}
        </div>
    `;
}

async function loadPlayers() {
    loader.style.display = 'block';
    try {
        const playerSelect = document.getElementById('player-select') as HTMLSelectElement;
        const players = await ipcRenderer.invoke('get-letter-players');
        
        playerSelect.innerHTML = '';
        if (players.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No players found';
            playerSelect.appendChild(option);
            renderLetters();
            return;
        }

        players.forEach((player: {id: string, name: string}) => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = `${player.name} (${player.id})`;
            playerSelect.appendChild(option);
        });

        selectedPlayerId = playerSelect.value;
        await loadCharacters(selectedPlayerId);
        await loadLetters(selectedPlayerId);
    } catch (error) {
        console.error("Error loading players:", error);
    } finally {
        loader.style.display = 'none';
    }
}

async function loadCharacters(playerId: string) {
    const characterSelect = document.getElementById('character-select') as HTMLSelectElement;
    const characters = await ipcRenderer.invoke('get-corresponded-characters', playerId);

    characterSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Characters';
    allOption.setAttribute('data-i18n', 'letters.all_characters');
    characterSelect.appendChild(allOption);

    characters.forEach((char: {id: string, name: string}) => {
        const option = document.createElement('option');
        option.value = char.id;
        option.textContent = `${char.name} (${char.id})`;
        characterSelect.appendChild(option);
    });

    selectedCharacterId = 'all';
    characterSelect.value = 'all';
}

async function loadLetters(playerId: string) {
    allLetters = await ipcRenderer.invoke('get-all-letters-for-player', playerId);
    renderLetters();
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('container');
    if (container) {
        container.style.display = 'flex';
    }

    await initLocalization();

    const playerSelect = document.getElementById('player-select') as HTMLSelectElement;
    const characterSelect = document.getElementById('character-select') as HTMLSelectElement;
    const inboxBtn = document.getElementById('inbox-btn') as HTMLButtonElement;
    const outboxBtn = document.getElementById('outbox-btn') as HTMLButtonElement;
    const refreshBtn = document.getElementById('letter-refresh-btn') as HTMLButtonElement;

    refreshBtn.addEventListener('click', async () => {
        loader.style.display = 'block';
        try {
            await ipcRenderer.invoke('import-letters-from-log');
            await loadPlayers();
        } catch (error) {
            console.error("Error during manual letter import and refresh:", error);
        } finally {
            loader.style.display = 'none';
        }
    });

    playerSelect.addEventListener('change', async () => {
        selectedPlayerId = playerSelect.value;
        await loadCharacters(selectedPlayerId);
        await loadLetters(selectedPlayerId);
    });

    characterSelect.addEventListener('change', () => {
        selectedCharacterId = characterSelect.value;
        renderLetters();
    });

    inboxBtn.addEventListener('click', () => {
        currentView = 'inbox';
        inboxBtn.classList.add('active');
        outboxBtn.classList.remove('active');
        renderLetters();
    });

    outboxBtn.addEventListener('click', () => {
        currentView = 'outbox';
        outboxBtn.classList.add('active');
        inboxBtn.classList.remove('active');
        renderLetters();
    });

    loadPlayers();
});

ipcRenderer.on('update-theme', (event, theme: string) => {
    document.body.className = `theme-${theme}`;
});

ipcRenderer.on('update-language', (event, lang) => {
    initLocalization(lang);
});
