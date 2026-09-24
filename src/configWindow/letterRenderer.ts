import { ipcRenderer } from 'electron';
import { Letter } from '../main/letter/letterInterfaces.js';
import * as path from 'path';
import * as fs from 'fs';

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
    if (!date || isNaN(date.getTime()) || date.getFullYear() < 867) {
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
        const reply = repliesByReplyToId.get(letter.id);

        if (letter.totalDays === undefined || typeof letter.delay === 'undefined') {
            return null;
        }

        // If reply is actively being generated, show stage 2.
        if (letter.status === 'generating' && !reply) {
            const estReplyDate = new Date(new Date(letter.timestamp).setDate(new Date(letter.timestamp).getDate() + letter.delay));
            // @ts-ignore
            const estReplyText = `(${window.LocalizationManager.getTranslation('letters.estimated_reply', 'Est. Reply: {date}').replace('{date}', formatDate(estReplyDate))})`;
            return {
                // @ts-ignore
                text: `${window.LocalizationManager.getTranslation('letters.status_awaiting_reply', 'Awaiting reply from {character}').replace('{character}', letter.recipient.shortName)} ${estReplyText}`,
                overdue: false,
                journey: { currentStage: 2 }
            };
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
            const sentDay = letter.totalDays;
            const totalJourneyTime = letter.delay;

            // Calculate the expected reply date. Use the reply's date if it exists, otherwise estimate from original.
            const expectedReplyDate = reply && reply.expectedDeliveryDate
                ? new Date(reply.expectedDeliveryDate)
                : new Date(new Date(letter.timestamp).setDate(new Date(letter.timestamp).getDate() + totalJourneyTime));

            const expectedReplyDay = sentDay + totalJourneyTime;
            const daysDifference = expectedReplyDay - currentGameDay;

            if (currentGameDay > 0 && sentDay > 0 && daysDifference < 0) {
                return {
                    // @ts-ignore
                    text: `${window.LocalizationManager.getTranslation('letters.reply_overdue_since', 'Reply overdue since')} ${formatDate(expectedReplyDate)}`,
                    overdue: true,
                    journey: { currentStage: 3 } // If overdue, reply should be on its way
                };
            } else if (sentDay > 0) {
                const timeElapsed = currentGameDay - sentDay;
                const stage1End = Math.floor(totalJourneyTime * 4 / 9); // Letter arrives at recipient
                const stage2End = Math.floor(totalJourneyTime * 5 / 9); // AI finishes writing reply

                let statusText = '';
                let currentStage = 0;

                if (timeElapsed <= stage1End) {
                    // Stage 1: Letter is traveling to the recipient.
                    // @ts-ignore
                    statusText = window.LocalizationManager.getTranslation('letters.status_journey_began', 'Journey to {character} began').replace('{character}', letter.recipient.shortName);
                    currentStage = 1;
                } else if (timeElapsed <= stage2End) {
                    // Stage 2: Recipient has the letter and is writing a reply.
                    // @ts-ignore
                    statusText = window.LocalizationManager.getTranslation('letters.status_awaiting_reply', 'Awaiting reply from {character}').replace('{character}', letter.recipient.shortName);
                    currentStage = 2;
                } else {
                    // Stage 3: The reply is generated and is on its way back to the player.
                    // @ts-ignore
                    statusText = window.LocalizationManager.getTranslation('letters.status_reply_en_route', 'Reply is on its way');
                    currentStage = 3;
                }

                const estReplyText = `(${window.LocalizationManager.getTranslation('letters.estimated_reply', 'Est. Reply: {date}').replace('{date}', formatDate(expectedReplyDate))})`;

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
let cachedLetterPairs: { sent?: Letter, received?: Letter }[] | null = null;
let showFutureLetters = false;
let manualLetterActionApproval = false;
// Tracks the currently filtered letter set (post-character-filter and post-status-filter).
// Used by renderStatusSummary() to show counts that match the displayed letter list.
let currentFilteredLetters: Letter[] = [];
let countdown = 20;
let refreshInterval: NodeJS.Timeout;
let actionsPath: string | null = null;
let currentLanguage = 'en';
// The player currently being played in-game (from main). Used to warn when the letters
// tab is viewing a different player, since approvals for a non-active player are queued.
let currentSessionPlayerId: string | null = null;
// Session-local record of every action the user approved/denied, keyed by
// letterId|signature|triggerOn. Applied onto freshly reloaded letters so a reload can
// never show an approved/denied action as pending again, even if the disk write raced.
const userActionStatuses = new Map<string, 'approved' | 'denied'>();

// Lookup maps rebuilt in loadLetters() whenever allLetters changes, so per-render and
// per-click lookups are O(1) instead of O(N) array scans.
let lettersById = new Map<string, Letter>();
let repliesByReplyToId = new Map<string, Letter>();
// Tracks the currently selected letter list item so selection updates toggle classes on
// the old/new elements instead of sweeping the whole document.
let selectedLetterItemEl: HTMLElement | null = null;

function renderTriggeredActionsListForListItem(letter: Letter | undefined): string {
    if (!letter || !letter.triggeredActions || letter.triggeredActions.length === 0) {
        // @ts-ignore
        const noActionsText = window.LocalizationManager.getTranslation('letters.no_actions_triggered', 'No actions triggered.');
        return `<div class="letter-item-actions">${noActionsText}</div>`;
    }

    const actionItems = letter.triggeredActions.map(action => `<li>${action.signature}</li>`).join('');
    // @ts-ignore
    const headerText = window.LocalizationManager.getTranslation('letters.triggered_actions', 'Triggered Actions');

    return `
        <div class="letter-item-actions">
            <strong>${headerText}:</strong>
            <ul>${actionItems}</ul>
        </div>
    `;
}

const initLocalization = async (lang?: string) => {
    if (window.LocalizationManager) {
        // @ts-ignore
        let language = lang;
        // @ts-ignore
        const config = await ipcRenderer.invoke('get-config');
        if (!language) {
            language = config.language || 'en';
        }
        manualLetterActionApproval = config.manualLetterActionApproval;
        currentLanguage = language || 'en';
        // @ts-ignore
        await window.LocalizationManager.loadTranslations(language);
        // @ts-ignore
        window.LocalizationManager.applyTranslations();
    }
};


function renderStatusSummary() {
    const summaryContainer = document.getElementById('letter-status-summary');
    if (!summaryContainer) return;

    const lettersForCounts = currentFilteredLetters.length > 0 || statusFilter !== 'total' || selectedCharacterId !== 'all'
        ? currentFilteredLetters
        : allLetters;
    const counts = {
        total: lettersForCounts.length,
        generating: lettersForCounts.filter(l => l.status === 'generating').length,
        pending: lettersForCounts.filter(l => {
            // AI letter pending delivery
            if (!l.isPlayerSender && l.status === 'pending' && l.delivered !== true) {
                return true;
            }
            // Player letter pending non-overdue reply
            if (l.isPlayerSender) {
                const replyForCount = repliesByReplyToId.get(l.id);
                const hasReply = !!(replyForCount && replyForCount.delivered);
                if (hasReply) return false;
                if (currentGameDay === 0 || !l.totalDays || typeof l.delay === 'undefined') return false;
                const expectedReplyDay = l.totalDays + l.delay;
                return expectedReplyDay >= currentGameDay;
            }
            return false;
        }).length,
        reply_overdue: lettersForCounts.filter(l => {
            if (!l.isPlayerSender) return false;
            const replyForCount = repliesByReplyToId.get(l.id);
            const hasReply = !!(replyForCount && replyForCount.delivered);
            if (hasReply) return false;
            if (currentGameDay === 0 || !l.totalDays || typeof l.delay === 'undefined') return false;
            const expectedReplyDay = l.totalDays + l.delay;
            return expectedReplyDay < currentGameDay;
        }).length,
        failed: lettersForCounts.filter(l => l.status === 'failed').length,
        completed: lettersForCounts.filter(l => l.status === 'sent' || l.status === 'read').length
    };

    const statuses: Array<'total' | 'generating' | 'pending' | 'reply_overdue' | 'failed' | 'completed'> = ['total', 'generating', 'pending', 'reply_overdue', 'failed', 'completed'];

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
            cachedLetterPairs = null;
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

    // Clear the list at the start so every render starts fresh. This prevents stale
    // letters from a previous player/character from lingering, and prevents repeated
    // "No letters found." messages from accumulating when there are no letters.
    selectedLetterItemEl = null;
    letterList.innerHTML = '';

    const fragment = document.createDocumentFragment();

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

    let letterPairs: { sent?: Letter, received?: Letter }[] = [];

if (cachedLetterPairs) {
letterPairs = cachedLetterPairs;
    } else {
        const cleanLetters = allLetters.filter(l => {
            if (!l || !l.sender || !l.recipient || l.sender.id == null || l.recipient.id == null) {
                console.warn('Skipping malformed or incomplete letter object:', l);
                return false;
            }
            if (l.replyToId && !l.isPlayerSender && l.delivered !== true) {
                console.log(`Hiding undelivered reply letter: ${l.id}`);
                return false;
            }
            return true;
        });

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

        if (statusFilter !== 'total') {
            if (statusFilter === 'completed') {
                characterFilteredLetters = characterFilteredLetters.filter(l => l.status === 'sent' || l.status === 'read');
            } else if (statusFilter === 'reply_overdue') {
                characterFilteredLetters = characterFilteredLetters.filter(l => {
                    if (!l.isPlayerSender) return false;
                    const r = repliesByReplyToId.get(l.id);
                    const hasReply = !!(r && r.delivered);
                    if (hasReply) return false;
                    if (currentGameDay === 0 || !l.totalDays || typeof l.delay === 'undefined') return false;
                    const expectedReplyDay = l.totalDays + l.delay;
                    return expectedReplyDay < currentGameDay;
                });
            } else if (statusFilter === 'pending') {
                characterFilteredLetters = characterFilteredLetters.filter(l => {
                    if (!l.isPlayerSender && l.status === 'pending' && l.delivered !== true) {
                        return true;
                    }
                    if (l.isPlayerSender) {
                        const r = repliesByReplyToId.get(l.id);
                        const hasReply = !!(r && r.delivered);
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

    // Store the filtered letters so renderStatusSummary() can use them for accurate counts.
    // This ensures the status summary reflects the same filtered set as the displayed letter list.
    currentFilteredLetters = characterFilteredLetters;

    const repliesMap = new Map<string, Letter>();
    const rootLetters: Letter[] = [];

        lettersToDisplay.forEach(l => {
            if (l.replyToId) {
                repliesMap.set(l.replyToId, l);
            } else {
                rootLetters.push(l);
            }
        });

        rootLetters.forEach(root => {
            const reply = repliesMap.get(root.id);
            if (root.sender.id === Number(selectedPlayerId)) {
                letterPairs.push({ sent: root, received: reply });
            } else {
                letterPairs.push({ received: root, sent: reply });
            }
        });

        repliesMap.forEach((reply, rootId) => {
            if (!rootLetters.some(root => root.id === rootId)) {
                if (reply.sender.id === Number(selectedPlayerId)) {
                    letterPairs.push({ sent: reply });
                } else {
                    letterPairs.push({ received: reply });
                }
            }
        });

        letterPairs.sort((a, b) => {
            const getTimestamp = (letter: Letter | undefined) => {
                if (!letter) return 0;
                const ts = sortMode === 'gameDate'
                    ? new Date(letter.timestamp)
                    : new Date(letter.creationTimestamp || letter.timestamp);
                // Return 0 for invalid dates to avoid sorting errors
                return isNaN(ts.getTime()) ? 0 : ts.getTime();
            };

            // Get the latest timestamp from each pair to sort by the most recent activity
            const timeA = Math.max(getTimestamp(a.sent), getTimestamp(a.received));
            const timeB = Math.max(getTimestamp(b.sent), getTimestamp(b.received));

            return timeB - timeA; // Sort descending
        });

cachedLetterPairs = letterPairs;
    }



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
            const triggeredActionsHtml = renderTriggeredActionsListForListItem(pair.received);
            receivedHtml = `
                <div class="letter-item received" data-letter-id="${pair.received.id}">
                    <div class="letter-item-header">
                        <span class="letter-item-party">From: ${pair.received.sender.shortName}<br>To: ${pair.received.recipient.shortName}</span>
                        <span class="letter-item-date">${formatDate(new Date(pair.received.timestamp))}</span>
                    </div>
                    <div class="letter-item-subject">${pair.received.subject}</div>
                    ${statusHtml}
                    ${triggeredActionsHtml}
                </div>
            `;
        }

        let sentHtml = '';
        if (pair.sent) {
            const status = getLetterStatus(pair.sent);
            let statusHtml = '';
            if (status) {
                const journeyHtml = renderJourneyTimeline(status);
                statusHtml = journeyHtml + `<div class="letter-item-reply-status ${status.overdue ? 'overdue' : ''}">${status.text}</div>`;
            }
            const triggeredActionsHtml = renderTriggeredActionsListForListItem(pair.sent);
            sentHtml = `
                <div class="letter-item sent" data-letter-id="${pair.sent.id}">
                    <div class="letter-item-header">
                        <span class="letter-item-party">From: ${pair.sent.sender.shortName}<br>To: ${pair.sent.recipient.shortName}</span>
                        <span class="letter-item-date">${formatDate(new Date(pair.sent.timestamp))}</span>
                    </div>
                    <div class="letter-item-subject">${pair.sent.subject}</div>
                    ${statusHtml}
                    ${triggeredActionsHtml}
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
        fragment.appendChild(li);
    });

    letterList.appendChild(fragment);

    // Add event listeners after rendering
    document.querySelectorAll('.letter-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const letterId = target.dataset.letterId;
            if (!letterId) return;

            const letter = lettersById.get(letterId);
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

            // Highlight selected without sweeping the full document
            if (selectedLetterItemEl) {
                selectedLetterItemEl.classList.remove('selected');
            }
            target.classList.add('selected');
            selectedLetterItemEl = target;
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
// Session-level caches so per-letter rendering doesn't hit the disk repeatedly:
// action modules loaded lazily once per signature, and resolved localized descriptions
// cached per language+signature (keyed by language so no invalidation is needed when
// the UI language changes).
const actionModuleCache = new Map<string, any | null>();
const actionDescriptionCache = new Map<string, string | null>();

function loadActionModule(signature: string): any | null {
    if (actionModuleCache.has(signature)) {
        return actionModuleCache.get(signature) || null;
    }
    let actionModule: any | null = null;
    if (actionsPath) {
        for (const folder of ['standard', 'custom']) {
            try {
                const filePath = path.join(actionsPath, folder, `${signature}.js`);
                if (!fs.existsSync(filePath)) continue;
                actionModule = require(filePath);
                break;
            } catch (e) {
                // Ignore and try the next folder.
            }
        }
    }
    actionModuleCache.set(signature, actionModule);
    return actionModule;
}

// Resolves the localized description for an action module (by signature) from the
// user's scripts/actions/{standard,custom} folders, falling back to the signature text.
function getActionDescription(signature: string): string | null {
    const cacheKey = `${currentLanguage}|${signature}`;
    if (actionDescriptionCache.has(cacheKey)) {
        return actionDescriptionCache.get(cacheKey) || null;
    }
    let resolved: string | null = null;
    const actionModule = loadActionModule(signature);
    if (actionModule) {
        const desc = actionModule.description;
        if (typeof desc === 'string') {
            resolved = desc;
        } else if (desc && typeof desc === 'object') {
            resolved = desc[currentLanguage] || desc['en'] || Object.values(desc)[0] || null;
        }
    }
    actionDescriptionCache.set(cacheKey, resolved);
    return resolved;
}

// Resolves the localized, human-readable chat message for an action (by signature) from
// the user's scripts/actions/{standard,custom} folders. Mirrors the chat window's
// checkActions.ts behavior: calls the module's chatMessage(args) with the stored parsed
// args, localizes the result, and substitutes {{character1Name}}/{{character2Name}} etc.
// Falls back to the localized description, then the signature.
function getActionChatMessage(letter: Letter, action: { signature: string; args: any[] }): string {
    const actionModule = loadActionModule(action.signature);
    if (actionModule && typeof actionModule.chatMessage === 'function') {
        let message = actionModule.chatMessage(action.args || []);
        if (typeof message === 'object' && message !== null) {
            message = message[currentLanguage] || message['en'] || Object.values(message)[0] || '';
        }
        if (typeof message === 'string' && message) {
            const sourceName = (letter.sender && letter.sender.shortName) || 'someone';
            const targetName = (letter.recipient && letter.recipient.shortName) || 'someone';
            const vars: Record<string, string> = { character1Name: sourceName, character2Name: targetName };
            return message.replace(/\{\{([^}]+)\}\}/gi, (_, key: string) => vars[key.trim()] || '');
        }
    }
    return getActionDescription(action.signature) || action.signature;
}

// Builds the triggered-actions section HTML for the letter view. Returns markup only;
// call wireTriggeredActions() after insertion to attach approve/deny handlers. Splitting
// build from wiring lets renderLetterContent() run its single search-highlight pass
// (which rewrites innerHTML) before any listeners are attached.
function buildTriggeredActionsHtml(letter: Letter): string {
    // @ts-ignore
    const headerText = window.LocalizationManager.getTranslation('letters.triggered_actions', 'Triggered Actions');
    let html = `<div class="triggered-actions-section"><h4 data-i18n="letters.triggered_actions">${headerText}</h4>`;

    if (!letter.triggeredActions || letter.triggeredActions.length === 0) {
        // @ts-ignore
        const noActionsText = window.LocalizationManager.getTranslation('letters.no_actions_triggered', 'No actions triggered.');
        html += `<span class="no-actions-text" data-i18n="letters.no_actions_triggered">${noActionsText}</span>`;
    } else if (manualLetterActionApproval) {
        // @ts-ignore
        const approveText = window.LocalizationManager.getTranslation('letters.approve_action', 'Approve');
        // @ts-ignore
        const denyText = window.LocalizationManager.getTranslation('letters.deny_action', 'Deny');
        // @ts-ignore
        const approveTooltip = window.LocalizationManager.getTranslation('letters.action_approve_tooltip', 'Approve this action...');
        // @ts-ignore
        const denyTooltip = window.LocalizationManager.getTranslation('letters.action_deny_tooltip', 'Deny this action...');

        html += '<div class="action-approval-container">';
        letter.triggeredActions.forEach((action, index) => {
            const actionDescription = getActionDescription(action.signature);
            const tooltipAttr = actionDescription ? ` data-tooltip="${actionDescription.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"` : '';
            const actionMessage = getActionChatMessage(letter, action);

            if (action.status === 'approved') {
                // @ts-ignore
                const approvedText = window.LocalizationManager.getTranslation('letters.action_approved', 'Action approved: {signature}').replace('{signature}', actionMessage);
                html += `<div class="action-prompt action-approved" id="action-prompt-${letter.id}-${action.signature}"${tooltipAttr}><span>${approvedText}</span></div>`;
            } else if (action.status === 'denied') {
                // @ts-ignore
                const deniedText = window.LocalizationManager.getTranslation('letters.action_denied', 'Action denied: {signature}').replace('{signature}', actionMessage);
                html += `<div class="action-prompt action-denied" id="action-prompt-${letter.id}-${action.signature}"${tooltipAttr}><span>${deniedText}</span></div>`;
            } else {
                html += `<div class="action-prompt" id="action-prompt-${letter.id}-${action.signature}" data-action-index="${index}"${tooltipAttr}>`
                    + `<span>${actionMessage}</span>`
                    + `<div class="action-buttons">`
                    + `<button data-i18n="letters.approve_action" class="action-approve-button" data-tooltip="${String(approveTooltip).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${approveText}</button>`
                    + `<button data-i18n="letters.deny_action" class="action-decline-button" data-tooltip="${String(denyTooltip).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${denyText}</button>`
                    + `</div></div>`;
            }
        });
        html += '</div>';
    } else {
        // @ts-ignore
        const signatureLabel = window.LocalizationManager.getTranslation('letters.action_signature', 'Action');
        // @ts-ignore
        const triggerLabel = window.LocalizationManager.getTranslation('letters.action_trigger', 'Trigger');

        html += '<ul class="triggered-actions-list">';
        for (const action of letter.triggeredActions) {
            const signature = (action && action.signature) || 'Unknown Action';
            const triggerOn = (action && action.triggerOn) || 'unknown';
            html += `<li class="triggered-action-item">${signatureLabel}: ${signature} (${triggerLabel}: ${triggerOn})</li>`;
        }
        html += '</ul>';
    }

    html += '</div>';
    return html;
}

// Attaches approve/deny handlers to the pending action prompts built by
// buildTriggeredActionsHtml(). Must run after the section HTML is in the DOM.
function wireTriggeredActions(container: HTMLElement, letter: Letter): void {
    if (!manualLetterActionApproval || !letter.triggeredActions || letter.triggeredActions.length === 0) return;

    letter.triggeredActions.forEach((action, index) => {
        if (action.status === 'approved' || action.status === 'denied') return;
        const actionPrompt = container.querySelector<HTMLElement>(`.action-prompt[data-action-index="${index}"]`);
        if (!actionPrompt) return;
        const actionMessage = getActionChatMessage(letter, action);

        const approveButton = actionPrompt.querySelector<HTMLButtonElement>('.action-approve-button');
        if (approveButton) {
            approveButton.onclick = () => {
                action.status = 'approved';
                userActionStatuses.set(`${letter.id}|${action.signature}|${action.triggerOn}`, 'approved');
                ipcRenderer.send('approve-letter-action', {
                    playerId: selectedPlayerId,
                    characterId: letter.sender.id === Number(selectedPlayerId) ? String(letter.recipient.id) : String(letter.sender.id),
                    letterId: letter.id,
                    actionSignature: action.signature,
                    args: action.args,
                    sourceId: letter.sender.id,
                    targetId: letter.recipient.id
                });
                actionPrompt.classList.add('action-approved');
                // @ts-ignore
                actionPrompt.innerHTML = `<span>${window.LocalizationManager.getTranslation('letters.action_approved', 'Action approved: {signature}').replace('{signature}', actionMessage)}</span>`;
            };
        }

        const denyButton = actionPrompt.querySelector<HTMLButtonElement>('.action-decline-button');
        if (denyButton) {
            denyButton.onclick = () => {
                action.status = 'denied';
                userActionStatuses.set(`${letter.id}|${action.signature}|${action.triggerOn}`, 'denied');
                ipcRenderer.send('deny-letter-action', {
                    playerId: selectedPlayerId,
                    characterId: letter.sender.id === Number(selectedPlayerId) ? String(letter.recipient.id) : String(letter.sender.id),
                    letterId: letter.id,
                    actionSignature: action.signature
                });
                actionPrompt.classList.add('action-denied');
                // @ts-ignore
                actionPrompt.innerHTML = `<span>${window.LocalizationManager.getTranslation('letters.action_denied', 'Action denied: {signature}').replace('{signature}', actionMessage)}</span>`;
            };
        }
    });
}

function renderLetterContent(letter: Letter) {
    const letterViewContainer = document.getElementById('letter-view-container');
    if (!letterViewContainer) return;

    let statusHtml = '';
    const reply = repliesByReplyToId.get(letter.id);

    if (letter.isPlayerSender && reply && reply.delivered) {
        const status = getLetterStatus(letter);
        const journeyHtml = renderJourneyTimeline(status);

        const replyDate = formatDate(new Date(reply.deliveryTimestamp || reply.timestamp));
        // @ts-ignore
        const statusText = window.LocalizationManager.getTranslation('letters.reply_received_on', 'Reply received on {date}').replace('{date}', replyDate);

        const expectedReplyDate = reply.expectedDeliveryDate ? new Date(reply.expectedDeliveryDate) : new Date(new Date(letter.timestamp).setDate(new Date(letter.timestamp).getDate() + letter.delay));
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

    // Build the view HTML as a single string (including triggered actions markup),
    // then apply search highlighting BEFORE setting innerHTML and wiring listeners.
    // This eliminates the second innerHTML rewrite that previously wiped event listeners.
    let viewHtml = `
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
        <div class="letter-view-controls">
            <button id="letter-delete-btn" class="btn btn-danger" data-i18n="letters.delete">Delete</button>
        </div>
        ${buildTriggeredActionsHtml(letter)}
    `;

    if (currentSearchTerm) {
        const regex = new RegExp(`(${currentSearchTerm})`, 'gi');
        viewHtml = viewHtml.replace(regex, '<mark>$1</mark>');
    }

    letterViewContainer.innerHTML = viewHtml;

    if (currentSearchTerm) {
        matches = Array.from(letterViewContainer.querySelectorAll('mark'));
        if (matches.length > 0) {
            currentMatchIndex = 0;
            matches[0].classList.add('current-match');
        }
    }

    // Wire listeners after single DOM build + highlight
    const deleteBtn = letterViewContainer.querySelector('#letter-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!selectedLetter || !selectedPlayerId) return;

            // @ts-ignore
            const confirmDelete = confirm(window.LocalizationManager.getTranslation('letters.confirm_delete', 'Are you sure you want to permanently delete this letter? This action cannot be undone.'));
            if (confirmDelete) {
                const otherPartyId = selectedLetter.sender.id === Number(selectedPlayerId)
                    ? String(selectedLetter.recipient.id)
                    : String(selectedLetter.sender.id);

                loader.style.display = 'block';
                try {
                    const result = await ipcRenderer.invoke('delete-letter', {
                        playerId: selectedPlayerId,
                        characterId: otherPartyId,
                        letterId: selectedLetter.id
                    });

                    if (result.success) {
                        // @ts-ignore
                        showStatusMessage(window.LocalizationManager.getTranslation('letters.delete_success', 'Letter deleted successfully.'), 'success');
                        selectedLetter = null;
                        // @ts-ignore
                        letterViewContainer.innerHTML = `<p data-i18n="letters.select">${window.LocalizationManager.getTranslation('letters.select', 'Select a letter to read.')}</p>`;
                        // Reload letters
                        await loadLetters(selectedPlayerId);
                    } else {
                        // @ts-ignore
                        showStatusMessage(window.LocalizationManager.getTranslation('letters.delete_failed', 'Failed to delete letter: {error}').replace('{error}', result.error), 'error');
                    }
                } catch (error: any) {
                    // @ts-ignore
                    showStatusMessage(window.LocalizationManager.getTranslation('letters.delete_failed', 'Failed to delete letter: {error}').replace('{error}', error.message), 'error');
                } finally {
                    loader.style.display = 'none';
                }
            }
        });
    }

    wireTriggeredActions(letterViewContainer, letter);

    const viewReplyBtn = letterViewContainer.querySelector('.view-reply-btn');
    if (viewReplyBtn) {
        viewReplyBtn.addEventListener('click', (e) => {
            const replyId = (e.currentTarget as HTMLElement).dataset.replyId;
            const replyLetter = replyId ? lettersById.get(replyId) : undefined;
            if (replyLetter) {
                selectedLetter = replyLetter;
                renderLetterContent(replyLetter);
                if (selectedLetterItemEl) {
                    selectedLetterItemEl.classList.remove('selected');
                }
                const letterListEl = document.getElementById('letter-list');
                const newListItem = letterListEl ? letterListEl.querySelector(`.letter-item[data-letter-id="${replyId}"]`) as HTMLElement | null : null;
                if (newListItem) {
                    newListItem.classList.add('selected');
                    selectedLetterItemEl = newListItem;
                    newListItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }

    // @ts-ignore
    if (window.LocalizationManager) {
        // @ts-ignore
        window.LocalizationManager.applyTranslations(letterViewContainer);
    }
}

function updatePlayerMismatchWarning() {
    const controls = document.getElementById('letter-controls');
    if (!controls) return;
    let warning = document.getElementById('player-mismatch-warning') as HTMLDivElement | null;
    const mismatch = currentSessionPlayerId != null && selectedPlayerId != null && selectedPlayerId !== currentSessionPlayerId;
    if (mismatch) {
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'player-mismatch-warning';
            warning.className = 'player-mismatch-warning';
            controls.appendChild(warning);
        }
        // @ts-ignore
        warning.textContent = window.LocalizationManager.getTranslation('letters.player_mismatch_warning', 'Warning: The selected player is not the currently played character. Approving actions will be queued until that player is played.');
        warning.style.display = 'inline-block';
    } else if (warning) {
        warning.style.display = 'none';
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
        updatePlayerMismatchWarning();
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

    // Use the explicitly passed currentCharacterId if provided, otherwise fall back to the
    // previously selected value from the DOM, defaulting to 'all'.
    const targetCharId = currentCharacterId ?? (previouslySelectedCharId || 'all');
    if (Array.from(characterSelect.options).some(opt => opt.value === targetCharId)) {
        characterSelect.value = targetCharId;
    } else {
        characterSelect.value = 'all';
    }
    selectedCharacterId = characterSelect.value;

    await loadLetters(playerId);
}

async function loadLetters(playerId: string) {
    allLetters = await ipcRenderer.invoke('get-all-letters-for-player', playerId);
    // Rebuild O(1) lookup maps for getLetterStatus(), renderStatusSummary(), click
    // handlers, and renderLetterContent().
    lettersById = new Map();
    repliesByReplyToId = new Map();
    for (const l of allLetters) {
        if (l && l.id) lettersById.set(l.id, l);
        if (l && l.replyToId && !repliesByReplyToId.has(l.replyToId)) repliesByReplyToId.set(l.replyToId, l);
    }
    // Reconcile any user-set approval/denial statuses from this session onto the freshly
    // reloaded objects. This guarantees a reload cannot show an approved/denied action as
    // pending again within the same session, even if the disk write raced with the reload.
    if (userActionStatuses.size > 0) {
        for (const letter of allLetters) {
            if (!letter.triggeredActions) continue;
            for (const action of letter.triggeredActions) {
                const status = userActionStatuses.get(`${letter.id}|${action.signature}|${action.triggerOn}`);
                if (status) action.status = status;
            }
        }
    }
    // Invalidate the cached letter pairs whenever fresh data arrives, so newly attached
    // triggered actions (e.g. player actions on a sent letter) are shown on refresh.
    cachedLetterPairs = null;
    // currentGameDay is now managed by IPC events ('get-current-game-day' and 'game-date-updated')
    // and should not be derived from letter data here, as it causes bugs with date calculations.
    // Reset filtered letters to allLetters on load since no filter is active yet.
    // renderLetters() will recompute the filtered set based on current character/status selections.
    currentFilteredLetters = allLetters;
    renderStatusSummary();
    renderLetters();
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('container');
    if (container) {
        container.style.display = 'flex';
    }

    await initLocalization();

    actionsPath = await ipcRenderer.invoke('get-userdata-path').then((p: string) => p ? path.join(p, 'scripts', 'actions') : null);

    currentGameDay = await ipcRenderer.invoke('get-current-game-day');
    currentSessionPlayerId = await ipcRenderer.invoke('get-current-session-player');
    console.log(`Initial game day fetched: ${currentGameDay}`);
    // @ts-ignore
    const successMsg = window.LocalizationManager.getTranslation('letters.load_success', 'Letters data successfully loaded');
    showStatusMessage(successMsg, 'success');

    const playerSelect = document.getElementById('player-select') as HTMLSelectElement;
    const characterSelect = document.getElementById('character-select') as HTMLSelectElement;
    const sortSelect = document.getElementById('letter-sort-select') as HTMLSelectElement;
    const refreshBtn = document.getElementById('letter-refresh-btn') as HTMLButtonElement;
    const refreshCountdownEl = document.getElementById('refresh-countdown') as HTMLSpanElement;
    const searchInput = document.getElementById('letter-search-input') as HTMLInputElement;
    const toggleFutureBtn = document.getElementById('toggle-future-btn') as HTMLButtonElement;

    function updateFutureButtonText() {
        if (showFutureLetters) {
            toggleFutureBtn.textContent = window.LocalizationManager.getTranslation('letters.hide_future', 'Hide Future Letters');
            toggleFutureBtn.classList.add('active');
        } else {
            toggleFutureBtn.textContent = window.LocalizationManager.getTranslation('letters.show_all', 'Show All Letters');
            toggleFutureBtn.classList.remove('active');
        }
    }
    updateFutureButtonText(); // Set initial text

    toggleFutureBtn.addEventListener('click', () => {
        showFutureLetters = !showFutureLetters;
        updateFutureButtonText();
        renderLetters();
    });

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
        cachedLetterPairs = null;
        renderLetters();
    });

    const refreshLetters = async (isAuto = false) => {
        if (!isAuto) { // Manual refresh resets the timer
            clearInterval(refreshInterval);
            countdown = 20;
            startInterval();
        }

        refreshBtn.classList.add('refreshing');
        if (!isAuto) {
            loader.style.display = 'block';
        }

        const playerSelect = document.getElementById('player-select') as HTMLSelectElement;
        const characterSelect = document.getElementById('character-select') as HTMLSelectElement;

        try {
            if (selectedPlayerId) {
                // Auto-refresh should be silent and not trigger a log import
                if (!isAuto && selectedCharacterId && selectedCharacterId !== 'all') {
                     await ipcRenderer.invoke('import-letters-from-log', {
                        playerId: selectedPlayerId,
                        recipientId: selectedCharacterId
                    });
                }
                await loadPlayers(playerSelect.value, characterSelect.value);
            }
        } catch (error) {
            console.error("Error during letter refresh:", error);
        } finally {
            if (!isAuto) {
                loader.style.display = 'none';
            }
            // Give animation time to be seen
            setTimeout(() => {
                refreshBtn.classList.remove('refreshing');
            }, 500);
        }
    };

    refreshBtn.addEventListener('click', () => refreshLetters(false));
    playerSelect.addEventListener('change', async () => {
        selectedPlayerId = playerSelect.value;
        // When player changes, reset character to 'all'
        await loadCharacters(selectedPlayerId, 'all');
        updatePlayerMismatchWarning();
    });
    playerSelect.addEventListener('change', async () => {
        selectedPlayerId = playerSelect.value;
        // When player changes, reset character to 'all'
        await loadCharacters(selectedPlayerId, 'all');
    });

    characterSelect.addEventListener('change', () => {
        selectedCharacterId = characterSelect.value;
        cachedLetterPairs = null;
        renderLetters();
        renderStatusSummary(); // Update status counts to reflect character filter
    });

    const startInterval = () => {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            countdown--;
            if (refreshCountdownEl) {
                // @ts-ignore
                const refreshText = window.LocalizationManager.getTranslation('letters.refreshing_in', 'Refreshing in {seconds}s...').replace('{seconds}', String(countdown));
                refreshCountdownEl.textContent = refreshText;
            }
            if (countdown <= 0) {
                countdown = 20;
                refreshLetters(true);
            }
        }, 1000);
    };

    loadPlayers();
    updatePlayerMismatchWarning();
    // Initial load of letter thread status
    ipcRenderer.invoke('get-letter-thread-status').then(count => {
        updateLetterThreadStatus(count);
    });

    startInterval();
});

ipcRenderer.on('update-theme', (event, theme: string) => {
    document.body.className = `theme-${theme}`;
});

ipcRenderer.on('update-language', (event, lang) => {
    initLocalization(lang);
});

ipcRenderer.on('current-session-player-changed', (event, playerId: string | null) => {
    currentSessionPlayerId = playerId;
    updatePlayerMismatchWarning();
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

window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});
