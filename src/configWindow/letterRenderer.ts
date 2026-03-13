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

function getReplyStatus(letter: Letter): { text: string, overdue: boolean, expectedDate: Date } | null {
    // Only show for letters sent by the player that are not replies themselves
    if (!letter.isPlayerSender || letter.replyToId) {
        return null;
    }

    // Check if there's a reply to this letter
    const hasReply = allLetters.some(l => l.replyToId === letter.id);
    if (hasReply) {
        return null; // Don't show status if it's already replied to
    }

    if (currentGameDay === 0 || !letter.totalDays || !letter.delay) return null;

    const sentDay = letter.totalDays;
    const expectedReplyDay = sentDay + letter.delay;
    const daysDifference = expectedReplyDay - currentGameDay;

    const sentDate = new Date(letter.timestamp);
    const expectedReplyDate = new Date(sentDate.getTime());
    expectedReplyDate.setDate(sentDate.getDate() + letter.delay);

    if (daysDifference < 0) {
        return {
            // @ts-ignore
            text: `${window.LocalizationManager.getTranslation('letters.reply_overdue', 'Reply overdue by')} ${-daysDifference} ${window.LocalizationManager.getTranslation('letters.days', 'days')} (${window.LocalizationManager.getTranslation('letters.est', 'est.')} ${formatDate(expectedReplyDate)})`,
            overdue: true,
            expectedDate: expectedReplyDate
        };
    } else {
        return {
            // @ts-ignore
            text: `${window.LocalizationManager.getTranslation('letters.reply_expected_in', 'Reply expected in')} ${daysDifference} ${window.LocalizationManager.getTranslation('letters.days', 'days')} (${formatDate(expectedReplyDate)})`,
            overdue: false,
            expectedDate: expectedReplyDate
        };
    }
}

// State
let allLetters: Letter[] = [];
let selectedPlayerId: string | null = null;
let selectedCharacterId: string | null = 'all';
let sortMode: 'gameDate' | 'realDate' = 'gameDate';
let currentSearchTerm = '';
let currentMatchIndex = -1;
let matches: HTMLElement[] = [];
let selectedLetter: Letter | null = null;
let currentGameDay = 0;
let statusFilter: 'total' | 'generating' | 'pending' | 'failed' | 'completed' = 'total';

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

    const statuses: (keyof typeof counts)[] = ['total', 'generating', 'pending', 'failed', 'completed'];
    const counts = {
        total: allLetters.length,
        generating: allLetters.filter(l => l.status === 'generating').length,
        pending: allLetters.filter(l => l.status === 'pending').length,
        failed: allLetters.filter(l => l.status === 'failed').length,
        completed: allLetters.filter(l => l.status === 'sent' || l.status === 'read').length
    };

    summaryContainer.innerHTML = ''; // Clear previous content

    statuses.forEach(status => {
        const statusItem = document.createElement('div');
        statusItem.classList.add('status-item');
        if (status === statusFilter) {
            statusItem.classList.add('selected');
        }
        // @ts-ignore
        const tooltipText = window.LocalizationManager.getTranslation(`letters.tooltip_${status}`);
        if (tooltipText) {
            statusItem.setAttribute('data-tooltip', tooltipText);
        }

        statusItem.innerHTML = `
            <div class="count">${counts[status]}</div>
            <div class="label" data-i18n="letters.status_${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</div>
        `;

        statusItem.addEventListener('click', () => {
            statusFilter = status as any;
            renderStatusSummary(); // Re-render summary to update selection
            renderLetters(); // Re-render letters with new filter
        });

        summaryContainer.appendChild(statusItem);
    });

    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        window.LocalizationManager.applyTranslations(summaryContainer);
    }
}

function clearHighlights() {
    const letterList = document.getElementById('letter-list');
    const letterView = document.getElementById('letter-view-container');
    if (!letterList || !letterView) return;

    // Remove marks but keep content
    letterList.innerHTML = letterList.innerHTML.replace(/<mark class="current-match">/g, '').replace(/<mark>/g, '').replace(/<\/mark>/g, '');
    letterView.innerHTML = letterView.innerHTML.replace(/<mark class="current-match">/g, '').replace(/<mark>/g, '').replace(/<\/mark>/g, '');
}

function highlightText(element: HTMLElement, term: string) {
    if (!term) return;
    const innerHTML = element.innerHTML;
    const regex = new RegExp(`(${term})`, 'gi');
    const newHTML = innerHTML.replace(regex, '<mark>$1</mark>');
    element.innerHTML = newHTML;
}

function performSearch(term: string) {
    clearHighlights();
    currentSearchTerm = term.trim();
    matches = [];
    currentMatchIndex = -1;

    if (!currentSearchTerm) {
        return;
    }

    const letterList = document.getElementById('letter-list');
    const letterView = document.getElementById('letter-view-container');

    if (letterList) {
        const items = letterList.querySelectorAll('.letter-item-subject, .letter-item-party');
        items.forEach(item => highlightText(item as HTMLElement, currentSearchTerm));
    }
    if (letterView) {
        highlightText(letterView, currentSearchTerm);
    }

    matches = Array.from(document.querySelectorAll('mark'));
    if (matches.length > 0) {
        currentMatchIndex = 0;
        const currentMatch = matches[currentMatchIndex];
        currentMatch.classList.add('current-match');
        currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function cycleSearch(direction: number) {
    if (matches.length === 0) return;

    // Remove highlight from current match
    if (currentMatchIndex !== -1) {
        matches[currentMatchIndex].classList.remove('current-match');
    }

    // Calculate next index
    currentMatchIndex += direction;
    if (currentMatchIndex < 0) {
        currentMatchIndex = matches.length - 1;
    } else if (currentMatchIndex >= matches.length) {
        currentMatchIndex = 0;
    }

    // Highlight new match and scroll to it
    const newMatch = matches[currentMatchIndex];
    newMatch.classList.add('current-match');
    newMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    let characterFilteredLetters = selectedCharacterId === 'all'
        ? allLetters
        : allLetters.filter(letter => {
            if (!letter || typeof letter.sender !== 'object' || letter.sender === null || typeof letter.recipient !== 'object' || letter.recipient === null) {
                console.warn('Skipping malformed or incomplete letter object:', letter);
                return false;
            }
            const otherPartyId = letter.sender.id === Number(selectedPlayerId) ? letter.recipient.id : letter.sender.id;
            return String(otherPartyId) === selectedCharacterId;
        });

    // Filter by status
    if (statusFilter !== 'total') {
        if (statusFilter === 'completed') {
            characterFilteredLetters = characterFilteredLetters.filter(l => l.status === 'sent' || l.status === 'read');
        } else {
            characterFilteredLetters = characterFilteredLetters.filter(l => l.status === statusFilter);
        }
    }

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
            const replyStatus = getReplyStatus(pair.sent);
            let statusHtml = '';
            if (replyStatus) {
                statusHtml = `<div class="letter-item-reply-status ${replyStatus.overdue ? 'overdue' : ''}">${replyStatus.text}</div>`;
            }
            sentHtml = `
                <div class="letter-item sent" data-letter-id="${pair.sent.id}">
                    <div class="letter-item-header">
                        <span class="letter-item-party">To: ${pair.sent.recipient.shortName}</span>
                        <span class="letter-item-date">${formatDate(new Date(pair.sent.timestamp))}</span>
                    </div>
                    <div class="letter-item-subject">${pair.sent.subject}</div>
                    ${statusHtml}
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

            selectedLetter = letter;
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

    // Re-apply search highlighting if there's an active search term
    if (currentSearchTerm) {
        performSearch(currentSearchTerm);
    }
}

function renderLetterContent(letter: Letter) {
    const letterViewContainer = document.getElementById('letter-view-container');
    if (!letterViewContainer) return;

    const replyStatus = getReplyStatus(letter);
    let statusHtml = '';
    if (replyStatus) {
        statusHtml = `<div class="letter-view-reply-status ${replyStatus.overdue ? 'overdue' : ''}">${replyStatus.text}</div>`;
    }

    letterViewContainer.innerHTML = `
        <div class="letter-view-header">
            <h3>${letter.subject}</h3>
            ${statusHtml}
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

    // Re-apply search highlighting if there's an active search term
    if (currentSearchTerm) {
        highlightText(letterViewContainer, currentSearchTerm);
        // Reset matches to only be in the current view if a letter is selected
        matches = Array.from(letterViewContainer.querySelectorAll('mark'));
        if (matches.length > 0) {
            currentMatchIndex = 0;
            matches[0].classList.add('current-match');
        }
    }
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

        players.sort((a: { name: string; }, b: { name: string; }) => a.name.localeCompare(b.name));
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

    characters.sort((a: { name: string; }, b: { name: string; }) => a.name.localeCompare(b.name));
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
    if (allLetters.length > 0) {
        currentGameDay = Math.max(...allLetters.map(l => l.totalDays || 0));
    } else {
        currentGameDay = 0;
    }
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
    const searchInput = document.getElementById('letter-search-input') as HTMLInputElement;

    searchInput.addEventListener('input', () => {
        const term = searchInput.value;
        if (term.trim() === '') {
            currentSearchTerm = '';
            matches = [];
            currentMatchIndex = -1;
            renderLetters();
            if (selectedLetter) {
                renderLetterContent(selectedLetter);
            } else {
                const letterView = document.getElementById('letter-view-container');
                if (letterView) {
                    // @ts-ignore
                    letterView.innerHTML = `<p data-i18n="letters.select">${window.LocalizationManager.getTranslation('letters.select', 'Select a letter to read.')}</p>`;
                }
            }
        } else {
            performSearch(term);
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && currentSearchTerm) {
            e.preventDefault();
            if (e.shiftKey) {
                cycleSearch(-1); // Go to previous match
            } else {
                cycleSearch(1); // Go to next match
            }
        }
    });

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
