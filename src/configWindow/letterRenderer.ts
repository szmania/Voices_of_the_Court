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
    // @ts-ignore
    const tooltipText = window.LocalizationManager.getTranslation('letters.tooltip_thread_status');
    if (tooltipText) {
        statusEl.setAttribute('data-tooltip', tooltipText);
    }

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
    if (!date || isNaN(date.getTime())) {
        // @ts-ignore
        return window.LocalizationManager.getTranslation('letters.invalid_date', 'Invalid Date');
    }
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

function dateToTotalDays(date: Date): number {
    if (!date || isNaN(date.getTime())) return 0;
    // Year 1, Month 0 (Jan), Day 1
    const startDate = new Date(Date.UTC(1, 0, 1, 0, 0, 0));
    // Get the date part of the target date in UTC
    const targetDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
    const diffTime = targetDate.getTime() - startDate.getTime();
    if (isNaN(diffTime)) return 0;
    // Get difference in days and add 1 because game days are 1-indexed
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
}

function getLetterStatus(letter: Letter): { text: string, overdue: boolean, journey?: { currentStage: number } } | null {
    // 1. Status for player-sent letters (OUTBOX)
    if (letter.isPlayerSender) {
        const reply = allLetters.find(l => l.replyToId === letter.id);

        if (letter.totalDays === undefined || typeof letter.delay === 'undefined') {
            return null;
        }

        if (reply && reply.delivered) {
            // Case B: Reply received and delivered.
            const replyDate = formatDate(new Date(reply.deliveryTimestamp || reply.timestamp));
            return {
                // @ts-ignore
                text: window.LocalizationManager.getTranslation('letters.reply_received_on', 'Reply received on {date}').replace('{date}', replyDate),
                overdue: false,
                journey: { currentStage: 4 } // Journey is complete
            };
        } else {
            // Case A: No reply yet, or reply not delivered. Show pending/overdue status.
            const deliveryDate = new Date(letter.deliveryTimestamp!);
            const sentDay = dateToTotalDays(deliveryDate);
            const expectedReplyDay = sentDay + letter.delay;
            const daysDifference = expectedReplyDay - currentGameDay;

            const expectedReplyDate = new Date(deliveryDate.getTime());
            expectedReplyDate.setDate(deliveryDate.getDate() + letter.delay);

            // @ts-ignore
            const estReplyText = `(${window.LocalizationManager.getTranslation('letters.estimated_reply', 'Est. Reply: {date}').replace('{date}', formatDate(expectedReplyDate))})`;

            if (currentGameDay > 0 && sentDay > 0 && daysDifference < 0) {
                // @ts-ignore
                const overdueText = window.LocalizationManager.getTranslation('letters.reply_overdue', 'Reply overdue');
                return {
                    // @ts-ignore
                    text: `${overdueText}. ${estReplyText}`,
                    overdue: true,
                    journey: { currentStage: 3 }
                };
            } else if (sentDay > 0) {
                const totalJourneyTime = letter.delay;
                const timeElapsed = currentGameDay - sentDay;
                const stage1End = Math.floor(totalJourneyTime * 4 / 9);
                const stage2End = Math.floor(totalJourneyTime * 5 / 9);

                let statusText = '';
                let currentStage = 0;
                if (timeElapsed <= stage1End) {
                    // @ts-ignore
                    statusText = window.LocalizationManager.getTranslation('letters.status_journey_began', 'Journey to {character} began').replace('{character}', letter.recipient.shortName);
                    currentStage = 1;
                } else if (timeElapsed <= stage2End) {
                    // @ts-ignore
                    statusText = window.LocalizationManager.getTranslation('letters.status_awaiting_reply', 'Awaiting reply from {character}').replace('{character}', letter.recipient.shortName);
                    currentStage = 2;
                } else {
                    // @ts-ignore
                    statusText = window.LocalizationManager.getTranslation('letters.status_reply_en_route', 'Reply is on its way');
                    currentStage = 3;
                }

                return {
                    text: `${statusText} ${estReplyText}`,
                    overdue: false,
                    journey: { currentStage }
                };
            }
        }
    }

    // 2. Status for AI-sent letters (INBOX) pending delivery
    if (!letter.isPlayerSender && letter.status === 'pending' && letter.delivered === false) {
        if (currentGameDay === 0 || !letter.totalDays || typeof letter.delay === 'undefined') return null;

        const generatedDay = letter.totalDays;
        const expectedDeliveryDay = generatedDay + letter.delay;
        const daysUntilDelivery = expectedDeliveryDay - currentGameDay;

        const generatedDate = new Date(letter.timestamp);
        const expectedDeliveryDate = new Date(generatedDate.getTime());
        expectedDeliveryDate.setDate(generatedDate.getDate() + letter.delay);

        if (daysUntilDelivery > 0) {
            return {
                // @ts-ignore
                text: `${window.LocalizationManager.getTranslation('letters.delivery_expected_in', 'Delivery expected in')} ${daysUntilDelivery} ${window.LocalizationManager.getTranslation('letters.days', 'days')} (${window.LocalizationManager.getTranslation('letters.est', 'est.')} ${formatDate(expectedDeliveryDate)})`,
                overdue: false
            };
        }
        // If delivery is overdue, we no longer show a message for inbox items.
    }

    return null;
}

// State
let allLetters: Letter[] = [];
let selectedPlayerId: string | null = null;
let selectedCharacterId: string | null = 'all';
let sortMode: 'gameDate' | 'realDate' = 'realDate';
let currentSearchTerm = '';
let currentMatchIndex = -1;
let matches: HTMLElement[] = [];
let selectedLetter: Letter | null = null;
let currentGameDay = 0;
let statusFilter: 'total' | 'generating' | 'pending' | 'reply_overdue' | 'failed' | 'completed' = 'total';

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

    const statuses: (keyof typeof counts)[] = ['total', 'generating', 'pending', 'reply_overdue', 'failed', 'completed'];
    const counts = {
        total: allLetters.length,
        generating: allLetters.filter(l => l.status === 'generating').length,
        pending: allLetters.filter(l => {
            // AI letter pending delivery
            if (!l.isPlayerSender && l.status === 'pending' && l.delivered !== true) {
                return true;
            }
            // Player letter pending non-overdue reply
            if (l.isPlayerSender) {
                const hasReply = allLetters.some(reply => reply.replyToId === l.id && reply.delivered);
                if (hasReply) return false;
                if (currentGameDay === 0 || !l.totalDays || typeof l.delay === 'undefined') return false;
                const expectedReplyDay = l.totalDays + l.delay;
                return expectedReplyDay >= currentGameDay;
            }
            return false;
        }).length,
        reply_overdue: allLetters.filter(l => {
            if (!l.isPlayerSender) return false;
            const hasReply = allLetters.some(reply => reply.replyToId === l.id && reply.delivered);
            if (hasReply) return false;
            if (currentGameDay === 0 || !l.totalDays || typeof l.delay === 'undefined') return false;
            const expectedReplyDay = l.totalDays + l.delay;
            return expectedReplyDay < currentGameDay;
        }).length,
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

function renderJourneyTimeline(status: { journey?: { currentStage: number } } | null): string {
    if (!status || !status.journey) {
        return '';
    }
    const stage = status.journey.currentStage;
    // @ts-ignore
    const stage1Label = window.LocalizationManager.getTranslation('letters.journey_stage1', 'Sent');
    // @ts-ignore
    const stage2Label = window.LocalizationManager.getTranslation('letters.journey_stage2', 'Writing Reply');
    // @ts-ignore
    const stage3Label = window.LocalizationManager.getTranslation('letters.journey_stage3', 'Reply Sent');
    // @ts-ignore
    const stage4Label = window.LocalizationManager.getTranslation('letters.journey_stage4', 'Reply Received');

    return `
        <div class="journey-timeline">
            <div class="journey-point stage-1 ${stage >= 1 ? 'completed' : ''} ${stage === 1 ? 'active' : ''}">
                <div class="journey-dot"></div>
                <div class="journey-label">${stage1Label}</div>
            </div>
            <div class="journey-point stage-2 ${stage >= 2 ? 'completed' : ''} ${stage === 2 ? 'active' : ''}">
                <div class="journey-dot"></div>
                <div class="journey-label">${stage2Label}</div>
            </div>
            <div class="journey-point stage-3 ${stage >= 3 ? 'completed' : ''} ${stage === 3 ? 'active' : ''}">
                <div class="journey-dot"></div>
                <div class="journey-label">${stage3Label}</div>
            </div>
            <div class="journey-point stage-4 ${stage >= 4 ? 'completed' : ''} ${stage === 4 ? 'active' : ''}">
                <div class="journey-dot"></div>
                <div class="journey-label">${stage4Label}</div>
            </div>
        </div>
    `;
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

    const cleanLetters = allLetters.filter(l => {
        if (!l || !l.sender || !l.recipient || l.sender.id == null || l.recipient.id == null) {
            console.warn('Skipping malformed or incomplete letter object:', l);
            return false;
        }
        // If it's a reply FROM an AI TO the player, hide it until it's delivered.
        if (l.replyToId && !l.isPlayerSender && l.delivered !== true) {
            console.log(`Hiding undelivered reply letter: ${l.id}`);
            return false;
        }
        return true;
    });

    // Filter letters by selected character
    let characterFilteredLetters = selectedCharacterId === 'all'
        ? cleanLetters
        : cleanLetters.filter(letter => {
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
        } else if (statusFilter === 'reply_overdue') {
            characterFilteredLetters = characterFilteredLetters.filter(l => {
                if (!l.isPlayerSender) return false;
                const hasReply = allLetters.some(reply => reply.replyToId === l.id && reply.delivered);
                if (hasReply) return false;
                if (currentGameDay === 0 || !l.totalDays || typeof l.delay === 'undefined') return false;
                const expectedReplyDay = l.totalDays + l.delay;
                return expectedReplyDay < currentGameDay;
            });
        } else if (statusFilter === 'pending') {
            characterFilteredLetters = characterFilteredLetters.filter(l => {
                // AI-sent letters pending delivery
                if (!l.isPlayerSender && l.status === 'pending' && l.delivered !== true) {
                    return true;
                }
                // Player-sent letters awaiting a reply that is NOT overdue
                if (l.isPlayerSender) {
                    const hasReply = allLetters.some(reply => reply.replyToId === l.id && reply.delivered);
                    if (hasReply) return false;
                    if (currentGameDay === 0 || !l.totalDays || typeof l.delay === 'undefined') return false;
                    const expectedReplyDay = l.totalDays + l.delay;
                    return expectedReplyDay >= currentGameDay;
                }
                return false;
            });
        } else { // 'generating', 'failed'
            characterFilteredLetters = characterFilteredLetters.filter(l => l.status === statusFilter);
        }
    }

    const lettersToDisplay = characterFilteredLetters;

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
            const status = getLetterStatus(pair.received);
            let statusHtml = '';
            if (status) {
                statusHtml = `<div class="letter-item-reply-status ${status.overdue ? 'overdue' : ''}">${status.text}</div>`;
            }
            let deliveryDateHtml = '';
            if (pair.received.deliveryTimestamp) {
                deliveryDateHtml = `<span class="letter-item-date received-on" style="display: block;">Received on: ${formatDate(new Date(pair.received.deliveryTimestamp))}</span>`;
            }

            receivedHtml = `
                <div class="letter-item received" data-letter-id="${pair.received.id}">
                    <div class="letter-item-header">
                        <span class="letter-item-party">From: ${pair.received.sender.shortName}</span>
                        <span class="letter-item-date">Written: ${formatDate(new Date(pair.received.timestamp))}</span>
                        ${deliveryDateHtml}
                    </div>
                    <div class="letter-item-subject">${pair.received.subject}</div>
                    ${statusHtml}
                </div>
            `;
        }

        let sentHtml = '';
        if (pair.sent) {
            const status = getLetterStatus(pair.sent);
            let statusHtml = '';
            let journeyHtml = '';

            if (status) {
                journeyHtml = renderJourneyTimeline(status);
                statusHtml = `<div class="letter-item-reply-status ${status.overdue ? 'overdue' : ''}">${status.text}</div>`;
            }

            sentHtml = `
                <div class="letter-item sent" data-letter-id="${pair.sent.id}">
                    <div class="letter-item-header">
                        <span class="letter-item-party">To: ${pair.sent.recipient.shortName}</span>
                        <span class="letter-item-date">${formatDate(new Date(pair.sent.timestamp))}</span>
                    </div>
                    <div class="letter-item-subject">${pair.sent.subject}</div>
                    ${journeyHtml}
                    ${statusHtml}
                </div>
            `;
        } else {
            if (pair.received && pair.received.replyToId) {
                sentHtml = `<div class="letter-item-placeholder" data-i18n="letters.outbound_not_found">Outbound letter not found.</div>`;
            } else {
                // Case where we have a received letter but no reply from the player yet
                sentHtml = `<div class="letter-item-placeholder" data-i18n="letters.no_reply">No reply yet.</div>`;
            }
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

    let statusHtml = '';
    const reply = allLetters.find(l => l.replyToId === letter.id);

    if (letter.isPlayerSender && reply && reply.delivered) {
        const status = getLetterStatus(letter);
        const journeyHtml = renderJourneyTimeline(status);

        const replyDate = formatDate(new Date(reply.deliveryTimestamp || reply.timestamp));
        // @ts-ignore
        const statusText = window.LocalizationManager.getTranslation('letters.reply_received_on', 'Reply received on {date}').replace('{date}', replyDate);

        const deliveryDate = new Date(letter.deliveryTimestamp!);
        const expectedReplyDate = new Date(deliveryDate.getTime());
        expectedReplyDate.setDate(deliveryDate.getDate() + letter.delay);
        // @ts-ignore
        const estimatedText = `(${window.LocalizationManager.getTranslation('letters.estimated_reply_date_was', 'Estimated reply date was')} ${formatDate(expectedReplyDate)})`;

        statusHtml = journeyHtml + `
            <div class="letter-view-reply-status has-reply">
                <div>
                    <span>${statusText}</span>
                    <div class="estimated-date">${estimatedText}</div>
                </div>
                <button class="view-reply-btn" data-reply-id="${reply.id}" data-i18n="letters.view_reply">View Reply</button>
            </div>
        `;
    } else {
        const status = getLetterStatus(letter);
        if (status) {
            const journeyHtml = renderJourneyTimeline(status);
            statusHtml = journeyHtml + `<div class="letter-view-reply-status ${status.overdue ? 'overdue' : ''}">${status.text}</div>`;
        }
    }

    let metaHtml = `
        <span><strong>From:</strong> ${letter.sender.fullName}</span>
        <span><strong>To:</strong> ${letter.recipient.fullName}</span>
        <span><strong>Date:</strong> ${formatDate(new Date(letter.timestamp))}</span>
    `;

    // If it's a received letter with a delivery date, show it.
    if (!letter.isPlayerSender && letter.deliveryTimestamp) {
        metaHtml += `<span><strong>Received on:</strong> ${formatDate(new Date(letter.deliveryTimestamp))}</span>`;
    }

    letterViewContainer.innerHTML = `
        <div class="letter-view-header">
            <h3>${letter.subject}</h3>
            ${statusHtml}
            <div class="letter-view-meta">
                ${metaHtml}
            </div>
        </div>
        <div class="letter-view-body">
            ${letter.content.replace(/\n/g, '<br>')}
        </div>
    `;

    const viewReplyBtn = letterViewContainer.querySelector('.view-reply-btn');
    if (viewReplyBtn) {
        viewReplyBtn.addEventListener('click', (e) => {
            const replyId = (e.currentTarget as HTMLElement).dataset.replyId;
            const replyLetter = allLetters.find(l => l.id === replyId);
            if (replyLetter) {
                selectedLetter = replyLetter;
                renderLetterContent(replyLetter);
                document.querySelectorAll('.letter-item.selected').forEach(el => el.classList.remove('selected'));
                const newListItem = document.querySelector(`.letter-item[data-letter-id="${replyId}"]`);
                if (newListItem) {
                    newListItem.classList.add('selected');
                    newListItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }

    // Re-apply search highlighting if there's an active search term
    if (currentSearchTerm) {
        highlightText(letterViewContainer, currentSearchTerm);
        matches = Array.from(letterViewContainer.querySelectorAll('mark'));
        if (matches.length > 0) {
            currentMatchIndex = 0;
            matches[0].classList.add('current-match');
        }
    }

    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        window.LocalizationManager.applyTranslations(letterViewContainer);
    }
}

async function loadPlayers(currentPlayerId?: string, currentCharacterId?: string) {
    loader.style.display = 'block';
    try {
        const playerSelect = document.getElementById('player-select') as HTMLSelectElement;
        const players = await ipcRenderer.invoke('get-letter-players');
        const previouslySelectedPlayerId = playerSelect.value;

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

        if (Array.from(playerSelect.options).some(opt => opt.value === previouslySelectedPlayerId)) {
            playerSelect.value = previouslySelectedPlayerId;
        }

        selectedPlayerId = playerSelect.value;
        await loadCharacters(selectedPlayerId, currentCharacterId);
        await loadLetters(selectedPlayerId);
    } catch (error) {
        console.error("Error loading players:", error);
    } finally {
        loader.style.display = 'none';
    }
}

async function loadCharacters(playerId: string, currentCharacterId?: string) {
    const characterSelect = document.getElementById('character-select') as HTMLSelectElement;
    const characters = await ipcRenderer.invoke('get-corresponded-characters', playerId);
    const previouslySelectedCharId = characterSelect.value;

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

    if (Array.from(characterSelect.options).some(opt => opt.value === previouslySelectedCharId)) {
        characterSelect.value = previouslySelectedCharId;
    } else {
        characterSelect.value = 'all';
    }
    selectedCharacterId = characterSelect.value;
}

async function loadLetters(playerId: string) {
    allLetters = await ipcRenderer.invoke('get-all-letters-for-player', playerId);
    // currentGameDay is now managed by IPC events ('get-current-game-day' and 'game-date-updated')
    // and should not be derived from letter data here, as it causes bugs with date calculations.
    renderStatusSummary();
    renderLetters();
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('container');
    if (container) {
        container.style.display = 'flex';
    }

    await initLocalization();

    currentGameDay = await ipcRenderer.invoke('get-current-game-day');
    console.log(`Initial game day fetched: ${currentGameDay}`);
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
        const playerSelect = document.getElementById('player-select') as HTMLSelectElement;
        const characterSelect = document.getElementById('character-select') as HTMLSelectElement;
        const currentPlayerId = playerSelect.value;
        const currentCharacterId = characterSelect.value;

        try {
            // Pass the currently selected player and character to the main process.
            // The import logic requires a specific character, so we only invoke if one is selected.
            if (selectedPlayerId && selectedCharacterId && selectedCharacterId !== 'all') {
                await ipcRenderer.invoke('import-letters-from-log', {
                    playerId: selectedPlayerId,
                    recipientId: selectedCharacterId
                });
            }
            // We still refresh the view even if we didn't import.
            await loadPlayers();
        } catch (error) {
            console.error("Error during manual letter import and refresh:", error);
        } finally {
            loader.style.display = 'none';
        }
    });

    playerSelect.addEventListener('change', async () => {
        selectedPlayerId = playerSelect.value;
        // When player changes, reset character to 'all'
        await loadCharacters(selectedPlayerId, 'all');
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

ipcRenderer.on('game-date-updated', (event, newTotalDays: number) => {
    console.log(`Received game-date-updated event: ${newTotalDays}`);
    if (newTotalDays > currentGameDay) {
        currentGameDay = newTotalDays;
        // Re-render to update statuses
        renderLetters();
        renderStatusSummary();
        if (selectedLetter) {
            renderLetterContent(selectedLetter);
        }
    }
});
