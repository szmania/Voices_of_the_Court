import { ipcRenderer } from 'electron';
import { Letter } from '../main/letter/letterInterfaces.js';

// State
let allLetters: Letter[] = [];
let selectedPlayerId: string | null = null;
let selectedCharacterId: string | null = 'all';
let currentView: 'inbox' | 'outbox' = 'inbox';

const initLocalization = () => {
    if (window.LocalizationManager) {
        window.LocalizationManager.instance.loadTranslations().then(() => {
            window.LocalizationManager.instance.applyLocalization();
        });
    }
};

function createControls() {
    const container = document.body;
    const controls = document.createElement('div');
    controls.id = 'letter-controls';
    controls.innerHTML = `
        <div class="control-group">
            <label for="player-select" data-i18n="letters.player">Player:</label>
            <select id="player-select"></select>
        </div>
        <div class="control-group">
            <label for="character-select" data-i18n="letters.character">Character:</label>
            <select id="character-select"></select>
        </div>
        <div id="letter-view-tabs">
            <button id="inbox-btn" class="active" data-i18n="letters.inbox">Inbox</button>
            <button id="outbox-btn" data-i18n="letters.outbox">Outbox</button>
        </div>
    `;
    
    const letterList = document.createElement('ul');
    letterList.id = 'letter-list';

    // Insert controls at the top, and list after it
    container.insertBefore(controls, container.firstChild);
    container.appendChild(letterList);


    const style = document.createElement('style');
    style.textContent = `
        #letter-controls {
            display: flex;
            gap: 20px;
            padding: 10px;
            align-items: center;
            border-bottom: 1px solid #ccc;
            flex-wrap: wrap;
        }
        .control-group {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        #letter-view-tabs button {
            padding: 5px 10px;
            border: 1px solid #ccc;
            background-color: #f0f0f0;
            cursor: pointer;
        }
        #letter-view-tabs button.active {
            background-color: #fff;
            border-bottom-color: #fff;
        }
    `;
    document.head.appendChild(style);
}

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
            window.LocalizationManager.instance.applyLocalization();
        }
        return;
    }

    const filteredLetters = allLetters.filter(letter => {
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
            window.LocalizationManager.instance.applyLocalization();
        }
        return;
    }

    filteredLetters.forEach(letter => {
        const li = document.createElement('li');
        li.dataset.letterId = letter.id;
        if (!letter.isRead) {
            li.classList.add('unread');
        }

        li.innerHTML = `
            <div class="letter-header">
                <span><strong>From:</strong> ${letter.sender.fullName} (${letter.sender.id})</span>
                <span><strong>To:</strong> ${letter.recipient.fullName} (${letter.recipient.id})</span>
                <span class="letter-date"><strong>Date:</strong> ${new Date(letter.timestamp).toLocaleString()}</span>
            </div>
            <div class="letter-body">
                <p><strong>Subject:</strong> ${letter.subject}</p>
                <p>${letter.content.replace(/\n/g, '<br>')}</p>
            </div>
        `;

        li.addEventListener('click', () => {
            const otherCharacterId = letter.sender.id === Number(selectedPlayerId) ? String(letter.recipient.id) : String(letter.sender.id);
            ipcRenderer.send('mark-letter-as-read', { playerId: selectedPlayerId, characterId: otherCharacterId, letterId: letter.id });
            li.classList.remove('unread');
        });
        letterList.appendChild(li);
    });
}

async function loadPlayers() {
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

document.addEventListener('DOMContentLoaded', () => {
    initLocalization();
    createControls();

    const playerSelect = document.getElementById('player-select') as HTMLSelectElement;
    const characterSelect = document.getElementById('character-select') as HTMLSelectElement;
    const inboxBtn = document.getElementById('inbox-btn') as HTMLButtonElement;
    const outboxBtn = document.getElementById('outbox-btn') as HTMLButtonElement;

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

ipcRenderer.on('update-language', () => {
    initLocalization();
});
