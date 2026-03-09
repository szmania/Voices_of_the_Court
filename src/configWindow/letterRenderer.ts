import { ipcRenderer } from 'electron';
import { Letter } from '../main/letter/letterInterfaces.js';

const loader = document.getElementById('letter-loader') as HTMLDivElement;
const statusMessage = document.getElementById('letter-status-message') as HTMLDivElement;
const letterThreadStatusContainer = document.getElementById('letter-thread-status-container') as HTMLDivElement;

function updateLetterThreadStatus(count: number) {
    if (!letterThreadStatusContainer) return;

    const statusEl = document.createElement('div');
    statusEl.id = 'letter-thread-status';
    // @ts-ignore
    statusEl.textContent = `${window.LocalizationManager.getTranslation('letters.thread_status', 'Letter Thread')}: ${count}/9`;
    statusEl.setAttribute('data-i18n-title', 'letters.tooltip_thread_status');

    if (count >= 9) {
        statusEl.classList.add('full');
    } else {
        statusEl.classList.remove('full');
    }
    
    letterThreadStatusContainer.innerHTML = ''; // Clear previous
    letterThreadStatusContainer.appendChild(statusEl);
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        window.LocalizationManager.applyTranslations(letterThreadStatusContainer);
    }
}

function showStatusMessage(message: string, type = 'info') {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}

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
let sortMode: 'gameDate' | 'realDate' = 'gameDate';
let sortMode: 'gameDate' | 'realDate' = 'gameDate';

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


function renderStatusSummary() {
    const summaryContainer = document.getElementById('letter-status-summary');
    if (!summaryContainer) return;

    const total = allLetters.length;
    const generating = allLetters.filter(l => l.status === 'generating').length;
    const pending = allLetters.filter(l => l.status === 'pending').length;
    const failed = allLetters.filter(l => l.status === 'failed').length;
    const completed = allLetters.filter(l => l.status === 'sent' || l.status === 'read').length;

    summaryContainer.innerHTML = `
        <div class="status-item" data-i18n-title="letters.tooltip_total">
            <div class="count">${total}</div>
            <div class="label" data-i18n="letters.status_total">Total</div>
        </div>
        <div class="status-item" data-i18n-title="letters.tooltip_generating">
            <div class="count">${generating}</div>
            <div class="label" data-i18n="letters.status_generating">Generating</div>
        </div>
        <div class="status-item" data-i18n-title="letters.tooltip_pending">
            <div class="count">${pending}</div>
            <div class="label" data-i18n="letters.status_pending">Pending</div>
        </div>
        <div class="status-item" data-i18n-title="letters.tooltip_failed">
            <div class="count">${failed}</div>
            <div class="label" data-i18n="letters.status_failed">Failed</div>
        </div>
        <div class="status-item" data-i18n-title="letters.tooltip_completed">
            <div class="count">${completed}</div>
            <div class="label" data-i18n="letters.status_completed">Completed</div>
        </div>
    `;
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        window.LocalizationManager.applyTranslations(summaryContainer);
    }
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
            // @ts-ignore
            window.LocalizationManager.applyTranslations();
        }
        return;
    }

    // Filter letters by selected character
    const characterFilteredLetters = selectedCharacterId === 'all'
        ? allLetters
        : allLetters.filter(letter => {
            const otherPartyId = letter.sender.id === Number(selectedPlayerId) ? letter.recipient.id : letter.sender.id;
            return String(otherPartyId) === selectedCharacterId;
        });

    const lettersToDisplay = characterFilteredLetters.filter(letter => {
        const isAiReply = letter.sender.id !== Number(selectedPlayerId);
        if (isAiReply) {
            return letter.delivered !== false; // Show if delivered is true or undefined (for old letters)
        }
        return true; // Always show player letters
    });

    const repliesMap = new Map<string, Letter>();
    const rootLetters: Letter[] = [];

    lettersToDisplay.forEach(l => {
        if (l.replyToId) {
            repliesMap.set(l.replyToId, l);
        } else {
            rootLetters.push(l);
        }
    });

    const letterPairs: {sent?: Letter, received?: Letter}[] = [];
    
    rootLetters.forEach(root => {
        const reply = repliesMap.get(root.id);
        if (root.sender.id === Number(selectedPlayerId)) {
            letterPairs.push({ sent: root, received: reply });
        } else {
            letterPairs.push({ received: root, sent: reply });
        }
    });

    // Identify and add orphaned replies
    repliesMap.forEach((reply, rootId) => {
        if (!rootLetters.some(root => root.id === rootId)) {
            if (reply.sender.id === Number(selectedPlayerId)) {
                letterPairs.push({ sent: reply });
            } else {
                letterPairs.push({ received: reply });
            }
        }
    });

    // Sort pairs by the timestamp of the most recent letter in the pair
    letterPairs.sort((a, b) => {
        const getTimestamp = (letter: Letter | undefined) => {
            if (!letter) return 0;
            // @ts-ignore
            return sortMode === 'gameDate'
                ? new Date(letter.timestamp).getTime()
                // @ts-ignore
                : new Date(letter.creationTimestamp || letter.timestamp).getTime();
        };

        const timeA = getTimestamp(a.sent || a.received);
        const timeB = getTimestamp(b.sent || b.received);
        return timeB - timeA;
    });


    if (letterPairs.length === 0) {
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

    letterPairs.forEach(pair => {
        const li = document.createElement('li');
        li.classList.add('letter-pair-item');

        let receivedHtml = '';
        if (pair.received) {
            const isUnread = !pair.received.isRead;
            li.classList.toggle('unread', isUnread);
            receivedHtml = `
                <div class="letter-item received" data-letter-id="${pair.received.id}">
                    <div class="letter-item-header">
                        <span class="letter-item-party">From: ${pair.received.sender.shortName}</span>
                        <span class="letter-item-date">${formatDate(new Date(pair.received.timestamp))}</span>
                    </div>
                    <div class="letter-item-subject">${pair.received.subject}</div>
                </div>
            `;
        }

        let sentHtml = '';
        if (pair.sent) {
            sentHtml = `
                <div class="letter-item sent" data-letter-id="${pair.sent.id}">
                    <div class="letter-item-header">
                        <span class="letter-item-party">To: ${pair.sent.recipient.shortName}</span>
                        <span class="letter-item-date">${formatDate(new Date(pair.sent.timestamp))}</span>
                    </div>
                    <div class="letter-item-subject">${pair.sent.subject}</div>
                </div>
            `;
        } else {
             // Case where we have a received letter but no reply from the player yet
            sentHtml = `<div class="letter-item-placeholder" data-i18n="letters.no_reply">No reply yet.</div>`;
        }

        let connectorHtml = '';
        if (pair.sent && pair.received) {
            connectorHtml = '<div class="letter-pair-connector"></div>';
        }

        li.innerHTML = receivedHtml + connectorHtml + sentHtml;
        letterList.appendChild(li);
    });

    // Add event listeners after rendering
    document.querySelectorAll('.letter-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const letterId = target.dataset.letterId;
            if (!letterId) return;

            const letter = allLetters.find(l => l.id === letterId);
            if (!letter) return;

            renderLetterContent(letter);

            // Mark as read if it's a received letter
            if (letter.recipient.id === Number(selectedPlayerId) && !letter.isRead) {
                ipcRenderer.send('mark-letter-as-read', { playerId: selectedPlayerId, characterId: String(letter.sender.id), letterId: letter.id });
                letter.isRead = true; // Update local state
                const pairElement = target.closest('.letter-pair-item');
                if (pairElement) pairElement.classList.remove('unread');
            }

            // Highlight selected
            document.querySelectorAll('.letter-item.selected').forEach(el => el.classList.remove('selected'));
            target.classList.add('selected');
        });
    });
    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        window.LocalizationManager.applyTranslations(letterList);
    }
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
    renderStatusSummary();
    renderLetters();
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('container');
    if (container) {
        container.style.display = 'flex';
    }

    await initLocalization();
    // @ts-ignore
    const successMsg = window.LocalizationManager.getTranslation('letters.load_success', 'Letters data successfully loaded');
    showStatusMessage(successMsg, 'success');

    const playerSelect = document.getElementById('player-select') as HTMLSelectElement;
    const characterSelect = document.getElementById('character-select') as HTMLSelectElement;
    const sortSelect = document.getElementById('letter-sort-select') as HTMLSelectElement;
    const refreshBtn = document.getElementById('letter-refresh-btn') as HTMLButtonElement;

    sortSelect.addEventListener('change', () => {
        sortMode = sortSelect.value as 'gameDate' | 'realDate';
        renderLetters();
    });

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

    loadPlayers();

    // Initial load of letter thread status
    ipcRenderer.invoke('get-letter-thread-status').then(count => {
        updateLetterThreadStatus(count);
    });
});

ipcRenderer.on('update-theme', (event, theme: string) => {
    document.body.className = `theme-${theme}`;
});

ipcRenderer.on('update-language', (event, lang) => {
    initLocalization(lang);
});

ipcRenderer.on('letter-status-changed', () => {
    console.log('Received letter-status-changed, reloading letters.');
    if (selectedPlayerId) {
        loadLetters(selectedPlayerId);
    }
});

ipcRenderer.on('letter-thread-status-update', (event, count: number) => {
    updateLetterThreadStatus(count);
});
