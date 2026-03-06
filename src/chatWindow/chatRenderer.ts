import { ipcRenderer } from 'electron';
import {ActionResponse, Message} from '../main/ts/conversation_interfaces.js';
import { marked } from 'marked';
import { GameData } from '../shared/gameData/GameData.js';
const DOMPurify = require('dompurify');

const sanitizeConfig = {
    ALLOWED_TAGS: ['em', 'strong'],
    KEEP_CONTENT: true,
  };

const characterColorPalette = [
    '#a1b8c3', // Light Slate Blue
    '#b3a1c3', // Light Lavender
    '#a1c3b1', // Light Sea Green
    '#c3b8a1', // Light Tan
    '#c3a1a1', // Light Rosy Brown
    '#b8c3a1', // Light Olive
    '#a1c3c3', // Light Teal
];
const characterColorMap = new Map<number, string>();
let nextColorIndex = 0;

function getCharacterColor(characterId: number): string {
    if (!characterColorMap.has(characterId)) {
        const color = characterColorPalette[nextColorIndex % characterColorPalette.length];
        characterColorMap.set(characterId, color);
        nextColorIndex++;
    }
    return characterColorMap.get(characterId)!;
}

hideChat();

document.addEventListener('click', (event) => {
    // This global listener closes any dropdown if the click is outside of it.
    // The stopPropagation in the valueDiv's click handler prevents this from firing when a dropdown is opened.
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select-container')) {
        document.querySelectorAll('.custom-select-options').forEach(optionsDiv => {
            (optionsDiv as HTMLElement).style.display = 'none';
        });
    }
});

// 初始化主题
function initTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'chinese';
    document.body.classList.add(`theme-${savedTheme}`);
}

// 页面加载时初始化主题
initTheme();

const chatBox: HTMLDivElement = document.querySelector('.chat-box')!;
let chatMessages: HTMLDivElement = document.querySelector('.messages')!;
let chatInput: HTMLInputElement= document.querySelector('.chat-input')!;
let leaveButton: HTMLButtonElement = document.querySelector('.leave-button')!;
let clearHistoryButton: HTMLButtonElement = document.querySelector('.clear-history-button')!;

let regenerateButton: HTMLButtonElement = document.querySelector('.regenerate-button')!;
let regenerateButtonWrapper: HTMLDivElement = document.querySelector('#regenerate-button-wrapper')!;
let undoButton: HTMLButtonElement = document.querySelector('.undo-button')!;
let undoButtonWrapper: HTMLDivElement = document.querySelector('#undo-button-wrapper')!;

let suggestionsButton: HTMLButtonElement = document.querySelector('.suggestions-button')!;
let suggestionsContainer: HTMLDivElement = document.querySelector('.suggestions-container')!;
let suggestionsList: HTMLDivElement = document.querySelector('.suggestions-list')!;
let suggestionsClose: HTMLButtonElement = document.querySelector('.suggestions-close')!;
let searchInput: HTMLInputElement = document.querySelector('.search-input')!;
let resetButton: HTMLButtonElement = document.querySelector('.reset-button')!;
let tokenDisplayWrapper: HTMLDivElement = document.querySelector('.token-display-wrapper')!;
let tokenCountElement: HTMLSpanElement = document.querySelector('.token-count')!;
let contextLimitElement: HTMLSpanElement = document.querySelector('.context-limit')!;
let slashCommandContainer: HTMLDivElement = document.querySelector('#slash-command-container')!;
let queueStatusDiv: HTMLDivElement = document.querySelector('.queue-status')!;
let characterTargetContainer: HTMLDivElement = document.querySelector('#character-target-container')!;
let characterTargetSelect: HTMLSelectElement = document.querySelector('#character-target-select')!;
let loadingDots: any;

let contextLimit: number = 0;
let availableActions: any[] = [];
let currentSlashCommand = '';
let selectedSlashCommandIndex = -1;

let playerName: string;
let aiName: string;
let showSuggestionsButton: boolean = true; // 默认显示建议按钮
let autoSendSuggestion: boolean = false; // 默认不自动发送建议
let showTokenizerDisplay: boolean = false; // 默认不显示分词器
// Add input event listener for real-time token counting
chatInput.addEventListener('input', function(e) {
    const text = chatInput.value;
    if (text.startsWith('/')) {
        currentSlashCommand = text.substring(1);
        showSlashCommands(currentSlashCommand);
    } else {
        hideSlashCommands();
    }

    if (showTokenizerDisplay) {
        updateTokenCount(text);
    }
});
let currentGameData: GameData | null = null; // Store current game data for scene/location and character list

// Store initial window state
let initialWindowState = {
    width: '',
    height: '',
    top: '',
    left: ''
};


async function initChat(){

    chatMessages.innerHTML = '';
    chatInput.innerHTML = '';
    chatInput.disabled = false;

    // 根据配置显示或隐藏建议按钮
    if (suggestionsButton) {
        suggestionsButton.style.display = showSuggestionsButton ? 'block' : 'none';
    }

    // 根据配置显示或隐藏分词器显示
    if (tokenDisplayWrapper) {
        tokenDisplayWrapper.style.display = showTokenizerDisplay ? 'block' : 'none';
    }
    updateRegenerateButtonState();
}

async function displayMessage(message: Message, isHistorical: boolean = false): Promise<HTMLDivElement>{

    if(message.content.startsWith(message.name+":")){
        message.content = message.content.slice(message.name!.length+1);
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    if (isHistorical) {
        messageDiv.classList.add('historical-message');
    }

    switch (message.role){
        case 'user':
            messageDiv.classList.add('player-message');
            if (isHistorical) {
                messageDiv.classList.add('historical-player-message');
            }
            const displayName = `${message.name} (You)`;
            messageDiv.innerHTML = DOMPurify.sanitize(await marked.parseInline(`**${displayName}:** ${message.content}`), sanitizeConfig);
    
            // Add visual indicator for targeted message
            const targetId = (message as any).targetCharacterId;
            if (targetId && currentGameData) {
                const targetChar = currentGameData.characters.get(targetId);
                if (targetChar) {
                    const targetIndicator = document.createElement('div');
                    targetIndicator.classList.add('target-indicator');
                    targetIndicator.textContent = `(To: ${targetChar.shortName})`;
                    messageDiv.appendChild(targetIndicator);
                }
            }
            break;
        case 'assistant':
            removeLoadingDots();
            // Color-code AI character messages
            if (currentGameData) {
                const character = Array.from(currentGameData.characters.values()).find(c => c.shortName === message.name || c.fullName === message.name);
                if (character) messageDiv.style.color = getCharacterColor(character.id);
            }
            
            messageDiv.classList.add('ai-message');
            if (isHistorical) {
                messageDiv.classList.add('historical-ai-message');
            }
            messageDiv.innerHTML = DOMPurify.sanitize(await marked.parseInline(`**${message.name}:** ${message.content}`), sanitizeConfig);

            break;
    };
    chatMessages.append(messageDiv);
    // Auto-scroll to bottom after adding message
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 10);

    updateRegenerateButtonState();

    return messageDiv;
}

function displayNarrative(narrative: string) {
    if (!narrative) return;

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add('narrative-message');
    messageDiv.classList.add('action-message'); // Narratives are tied to actions/state changes

    const narrativeSpan = document.createElement('span');
    narrativeSpan.innerText = narrative;
    messageDiv.appendChild(narrativeSpan);

    chatMessages.append(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayActions(actions: ActionResponse[]){
    if (!actions || actions.length === 0) return;

    const feedbackDiv = document.createElement('div');
    feedbackDiv.classList.add('action-feedback');
    
    const messages = actions.map(action => {
        return action.chatMessage;
    }).join('\n');

    feedbackDiv.innerText = messages;

    chatMessages.append(feedbackDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayErrorMessage(error: string){
    removeLoadingDots();
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    messageDiv.classList.add('error-message');
    messageDiv.innerText = error;
    chatMessages.append(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    updateRegenerateButtonState();
}

function displayLoadingIndicator(message: string = "Loading historical conversations..."): HTMLDivElement {
    removeLoadingDots(); // Remove any existing loading dots
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message');
    loadingDiv.classList.add('loading-indicator');
    loadingDiv.id = 'historical-loading-indicator';

    const loadingSpan = document.createElement('span');
    loadingSpan.innerText = message;
    loadingSpan.classList.add('loading-text');

    const dotsSpan = document.createElement('span');
    dotsSpan.classList.add('loading-dots');
    dotsSpan.innerText = '...';

    loadingDiv.appendChild(loadingSpan);
    loadingDiv.appendChild(dotsSpan);

    chatMessages.append(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    console.log('Displayed loading indicator for historical conversations');
    return loadingDiv;
}

function removeLoadingIndicator(): void {
    const loadingIndicator = document.getElementById('historical-loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
        console.log('Removed historical conversations loading indicator');
    }
}



// Token counting function
function updateTokenCount(text: string) {
    if (!showTokenizerDisplay || !tokenDisplayWrapper || !tokenCountElement) {
        return;
    }

    // Calculate token count using the ApiConnection's calculateTokensFromText method
    // We'll need to get this from the main process
    ipcRenderer.invoke('calculate-tokens', text).then((tokenCount: number) => {
        tokenCountElement.textContent = `Tokens: ${tokenCount}`;

        if (contextLimit > 0) {
            contextLimitElement.textContent = `/${contextLimit}`;

            // Add warning/critical classes based on usage percentage
            const usagePercentage = (tokenCount / contextLimit) * 100;
            tokenDisplayWrapper.classList.remove('warning', 'critical');

            if (usagePercentage > 90) {
                tokenDisplayWrapper.classList.add('critical');
            } else if (usagePercentage > 75) {
                tokenDisplayWrapper.classList.add('warning');
            }
        } else {
            contextLimitElement.textContent = '/0';
        }
    }).catch((error) => {
        console.error('Error calculating tokens:', error);
        tokenCountElement.textContent = 'Tokens: Error';
        contextLimitElement.textContent = '/0';
    });
}
chatInput.addEventListener('keydown', async function(e) {
    // Handle slash command navigation
    if (slashCommandContainer.style.display === 'block') {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const items = slashCommandContainer.querySelectorAll('.slash-command-item');
            if (selectedSlashCommandIndex < items.length - 1) {
                selectedSlashCommandIndex++;
                updateSelectedSlashCommand();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedSlashCommandIndex > 0) {
                selectedSlashCommandIndex--;
                updateSelectedSlashCommand();
            }
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const selectedItem = slashCommandContainer.querySelector('.slash-command-item.selected');
            if (selectedItem) {
                const signature = (selectedItem as HTMLElement).dataset.signature;
                const action = availableActions.find(a => a.signature === signature);
                if (action) {
                    selectSlashCommand(action);
                }
            } else { // If no item is selected, select the first one
                const firstItem = slashCommandContainer.querySelector('.slash-command-item');
                if (firstItem) {
                    const signature = (firstItem as HTMLElement).dataset.signature;
                    const action = availableActions.find(a => a.signature === signature);
                    if (action) {
                        selectSlashCommand(action);
                    }
                }
            }
            return; // Prevent sending message
        } else if (e.key === 'Escape') {
            hideSlashCommands();
            return;
        }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        chatInput.value = '';

        let message: Message = {
            role: "user",
            name: playerName,
            content: messageText
        };

        // Add multiple target character IDs if selected
        const hiddenInput = document.getElementById('character-target-hidden-input') as HTMLInputElement;
        const wrapper = document.getElementById('character-target-wrapper') as HTMLDivElement;
        if (wrapper.style.display === 'flex' && hiddenInput.value) {
            (message as any).targetCharacterIds = hiddenInput.value.split(',').filter(Boolean).map(Number);
        }

        await displayMessage(message);
        showLoadingDots();
        ipcRenderer.send('message-send', message);
    }
});

async function replaceLastMessage(message: Message){
    chatMessages.lastElementChild!.innerHTML = DOMPurify.sanitize((await marked.parseInline(`**${message.name}:** ${message.content}*`)).replace(/\*/g, ''), sanitizeConfig);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showLoadingDots(){  //and disable chat
    if (loadingDots) {
        return;
    }
    console.log('showLoadingDots() called');
    loadingDots = document.createElement('div');
    loadingDots.classList.add('loading');
    chatMessages.append(loadingDots);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.disabled = true;

    updateRegenerateButtonState();
    updateInputTooltip();
}

function removeLoadingDots(){
    if (!loadingDots) {
        return;
    }
    console.log('removeLoadingDots() called');
    loadingDots.remove();
    loadingDots = null;
    chatInput.disabled = false;

    updateRegenerateButtonState();
    updateInputTooltip();
}

function updateInputTooltip() {
    // Update tooltip for chat input when it's disabled
    if (chatInput.disabled) {
        // @ts-ignore
        const lm = window.LocalizationManager;
        const waitingTooltip = (lm ? lm.getNestedTranslation('chat.waiting_tooltip') : null) || "Waiting for response...";
        chatInput.title = waitingTooltip;
        chatInput.style.cursor = 'not-allowed';
    } else {
        chatInput.title = '';
        chatInput.style.cursor = 'url(../assets/cursor.png), auto';
    }
}

function updateRegenerateButtonState() {
    const lastMessageElement = chatMessages.lastElementChild as HTMLElement;
    // @ts-ignore
    const lm = window.LocalizationManager;
    const defaultTooltip = (lm ? lm.getNestedTranslation('chat.regenerate_tooltip') : null) || "You can only regenerate a response if the AI was the last one to speak.";
    const actionTooltip = (lm ? lm.getNestedTranslation('chat.action_tooltip') : null) || "Cannot regenerate a response that includes actions.";
    const waitingTooltip = (lm ? lm.getNestedTranslation('chat.waiting_tooltip') : null) || "Waiting for a response...";
    const undoTooltip = (lm ? lm.getNestedTranslation('chat.undo_tooltip') : null) || "Remove the last exchange (your message and the AI's response).";
    const leaveTooltip = (lm ? lm.getNestedTranslation('chat.leave_tooltip') : null) || "End the current conversation and save the summary.";
    const clearHistoryTooltip = (lm ? lm.getNestedTranslation('chat.clear_history_tooltip') : null) || "Clear conversation history";
    const suggestionsTooltip = (lm ? lm.getNestedTranslation('suggestions.tooltip') : null) || "Show or hide the recommended input statements feature.";
    const tokenizerTooltip = (lm ? lm.getNestedTranslation('chat.tokenizer_tooltip') : null) || "Real-time token count for the current message. Tokens are the basic units of text used by the AI.";

    // Set static tooltips
    undoButtonWrapper.setAttribute('data-tooltip', undoTooltip);
    tokenDisplayWrapper.setAttribute('data-tooltip', tokenizerTooltip);
    document.getElementById('leave-button-wrapper')?.setAttribute('data-tooltip', leaveTooltip);
    document.getElementById('clear-history-button-wrapper')?.setAttribute('data-tooltip', clearHistoryTooltip);
    document.querySelector('.suggestions-button-wrapper')?.setAttribute('data-tooltip', suggestionsTooltip);

    // Case 1: Loading dots are visible
    if (document.querySelector('.loading')) {
        regenerateButton.disabled = true;
        regenerateButtonWrapper.setAttribute('data-tooltip', waitingTooltip);
        undoButton.disabled = true;
        return;
    }

    // Update Undo button state
    const hasPlayerMessage = !!chatMessages.querySelector('.player-message');
    undoButton.disabled = !hasPlayerMessage;

    // Case 2: No messages or last message is not a valid message element
    if (!lastMessageElement || !lastMessageElement.classList.contains('message')) {
        regenerateButton.disabled = true;
        regenerateButtonWrapper.setAttribute('data-tooltip', defaultTooltip);
        return;
    }

    // Case 3: Last message is an action message
    if (lastMessageElement.classList.contains('action-message')) {
        regenerateButton.disabled = true;
        regenerateButtonWrapper.setAttribute('data-tooltip', actionTooltip);
        undoButton.disabled = true;
        undoButtonWrapper.setAttribute('data-tooltip', actionTooltip);
        return;
    }

    // Case 4: Last message is a player message or error message
    if (lastMessageElement.classList.contains('player-message') || lastMessageElement.classList.contains('error-message')) {
        regenerateButton.disabled = true;
        regenerateButtonWrapper.setAttribute('data-tooltip', defaultTooltip);
        return;
    }

    // Case 5: Last message is a plain AI message (enabling the button)
    if (lastMessageElement.classList.contains('ai-message')) {
        regenerateButton.disabled = false;
        regenerateButtonWrapper.setAttribute('data-tooltip', defaultTooltip);
        return;
    }

    // Default case: Disable the button
    regenerateButton.disabled = true;
    regenerateButtonWrapper.setAttribute('data-tooltip', defaultTooltip);
}

// 显示推荐输入语句
function displaySuggestions(suggestions: string[]) {
    // 清空之前的推荐
    suggestionsList.innerHTML = ''

    // 如果没有推荐，显示提示信息
    if (suggestions.length === 0) {
        const noSuggestionsItem = document.createElement('div')
        noSuggestionsItem.className = 'suggestion-item'
        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            noSuggestionsItem.textContent = window.LocalizationManager.getNestedTranslation('suggestions.no_suggestions') || 'No suggestions available';
        } else {
            noSuggestionsItem.textContent = 'No suggestions available';
        }
        suggestionsList.appendChild(noSuggestionsItem)
    } else {
        // 添加每个推荐语句
        suggestions.forEach(suggestion => {
            const suggestionItem = document.createElement('div')
            suggestionItem.className = 'suggestion-item'
            suggestionItem.textContent = suggestion

            // 点击推荐语句时，将其填入输入框
            suggestionItem.addEventListener('click', async () => {
                // 处理建议文本：移除引号、前面的序号以及结尾的括号内容
                let processedText = suggestion
                    .replace(/^\d+\.\s*/, '') // 移除开头的序号（如"1. "）
                    .replace(/（[^）]*）$/, '') // 移除结尾的中文括号及其内容
                    .replace(/\([^)]*\)$/, '') // 移除结尾的英文括号及其内容
                    .replace(/^[""]/g, '') // 移除开头的引号
                    .replace(/[""]$/g, ''); // 移除结尾的引号

                chatInput.value = processedText
                suggestionsContainer.style.display = 'none'

                // 如果启用了自动发送建议功能，直接发送消息
                if (autoSendSuggestion) {
                    console.log('Auto-sending suggestion:', processedText);
                    const messageText = processedText;
                    chatInput.value = ''

                    let message: Message = {
                        role: "user",
                        name: playerName,
                        content: messageText
                    }

                    await displayMessage(message);
                    showLoadingDots();
                    ipcRenderer.send('message-send', message);
                } else {
                    console.log('Not auto-sending suggestion, autoSendSuggestion is:', autoSendSuggestion);
                    chatInput.focus()
                }
            })

            suggestionsList.appendChild(suggestionItem)
        })
    }

    // 显示推荐容器
    suggestionsContainer.style.display = 'block'
}

function hideChat(){
    document.body.style.display = 'none';
}

function setupCharacterTargeting(gameData: GameData) {
    const wrapper = document.getElementById('character-target-wrapper') as HTMLDivElement;
    const valueDiv = document.getElementById('character-target-value') as HTMLDivElement;
    const optionsDiv = document.getElementById('character-target-options') as HTMLDivElement;
    const hiddenInput = document.getElementById('character-target-hidden-input') as HTMLInputElement;

    if (!wrapper || !valueDiv || !optionsDiv || !hiddenInput) return;

    const aiCharacters = Array.from(gameData.characters.values()).filter(c => c.id !== gameData.playerID);

    if (aiCharacters.length > 1) {
        optionsDiv.innerHTML = '';

        const updateSelection = () => {
            const selectedCheckboxes = Array.from(optionsDiv.querySelectorAll('input[type="checkbox"]:checked')) as HTMLInputElement[];
            const selectedIds = selectedCheckboxes.map(cb => cb.dataset.id);
            const selectedNames = selectedCheckboxes.map(cb => cb.dataset.name);

            hiddenInput.value = selectedIds.join(',');
            valueDiv.textContent = selectedNames.join(', ') || window.LocalizationManager.getTranslation('chat.target_auto', 'Automatically Detected');
        };

        aiCharacters.forEach(char => {
            const charOption = document.createElement('div');
            charOption.className = 'custom-select-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.id = char.id.toString();
            checkbox.dataset.name = char.shortName;
            checkbox.id = `target-char-${char.id}`;

            const label = document.createElement('label');
            label.htmlFor = `target-char-${char.id}`;
            label.textContent = char.shortName;

            charOption.appendChild(checkbox);
            charOption.appendChild(label);

            checkbox.addEventListener('change', updateSelection);

            optionsDiv.appendChild(charOption);
        });

        // Set default value
        valueDiv.textContent = window.LocalizationManager.getTranslation('chat.target_auto', 'Automatically Detected');
        hiddenInput.value = '';

        // Toggle dropdown
        valueDiv.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the global listener from closing it immediately
            optionsDiv.style.display = optionsDiv.style.display === 'block' ? 'none' : 'block';
        });

        // Prevent dropdown from closing when clicking inside
        optionsDiv.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Manually set the tooltip since the element might have been hidden during initial localization
        // @ts-ignore
        const tooltipText = window.LocalizationManager.getNestedTranslation('chat.target_tooltip');
        if (tooltipText) {
            wrapper.setAttribute('data-tooltip', tooltipText);
        }

        wrapper.style.display = 'flex';
    } else {
        wrapper.style.display = 'none';
    }
}

function updateQueueStatus(queue: {name: string, id: number}[], currentSpeaker: {name: string, id: number} | null) {
    if (!queueStatusDiv) return;

    if (!currentSpeaker && queue.length === 0) {
        queueStatusDiv.innerHTML = '';
        return;
    }

    let statusHTML = '';
    if (currentSpeaker) {
        statusHTML += `<div><span class="current-speaker">Speaking:</span> ${currentSpeaker.name}</div>`;
    }

    if (queue.length > 0) {
        statusHTML += `<div><span class="next-up">Next:</span> ${queue.map(c => c.name).join(', ')}</div>`;
    }
    
    queueStatusDiv.innerHTML = statusHTML;
}

leaveButton.addEventListener("click", ()=>{
    hideChat();
    chatMessages.innerHTML = '';
    chatInput.innerHTML = '';
    // 关闭建议选项框
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }
    if (clearHistoryButton) {
        clearHistoryButton.style.display = 'none';
    }
    ipcRenderer.send('chat-stop');
});

clearHistoryButton.addEventListener("click", ()=>{
    chatMessages.innerHTML = '';
    clearHistoryButton.style.display = 'none';
    ipcRenderer.send('clear-conversation-history');
});

undoButton.addEventListener('click', () => {
    const messages = Array.from(chatMessages.querySelectorAll('.message'));
    let foundPlayerMessage = false;

    // Iterate backwards to find the last player message and remove everything from there
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const isPlayer = msg.classList.contains('player-message');
        msg.remove();
        if (isPlayer) {
            foundPlayerMessage = true;
            break;
        }
    }

    if (foundPlayerMessage) {
        ipcRenderer.send('undo-message');
    }
    updateRegenerateButtonState();
});

regenerateButton.addEventListener('click', () => {
    const messages = Array.from(chatMessages.querySelectorAll('.message'));

    // Iterate backwards from the end of the messages
    for (let i = messages.length - 1; i >= 0; i--) {
        const messageElement = messages[i];
        // If it's a player message, we've gone back far enough. Stop.
        if (messageElement.classList.contains('player-message')) {
            break;
        }
        // Otherwise, it's an AI message, an action message, or an error. Remove it.
        messageElement.remove();
    }

    updateRegenerateButtonState();
    showLoadingDots();
    ipcRenderer.send('regenerate-response');
});

// 更新建议容器样式的函数
function updateSuggestionsContainerStyle() {
    const isChineseTheme = document.body.classList.contains('theme-chinese');
    const isWestTheme = document.body.classList.contains('theme-west');

    if ((isChineseTheme || isWestTheme) && autoSendSuggestion) {
        document.body.classList.add('auto-send-suggestions');
    } else {
        document.body.classList.remove('auto-send-suggestions');
    }
}

// 监听主题更新事件
ipcRenderer.on('update-theme', (event, theme: string) => {
    document.body.classList.remove('theme-original', 'theme-chinese', 'theme-west');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('selectedTheme', theme);

    // 更新建议容器样式
    updateSuggestionsContainerStyle();
});

// 监听语言更新事件
ipcRenderer.on('update-language', async (event, lang: string) => {
    console.log(`Received update-language in chat window: ${lang}`);
    // @ts-ignore
    if (window.LocalizationManager) {
        try {
            // @ts-ignore
            await window.LocalizationManager.loadTranslations(lang);
            // @ts-ignore
            window.LocalizationManager.applyTranslations();
            console.log(`UI Translations applied for: ${lang}`);
        } catch (err) {
            console.error('Failed to apply translations:', err);
        }
    }
});

    // 推荐输入语句功能事件处理
    suggestionsButton.addEventListener('click', () => {
        ipcRenderer.send('get-suggestions')
    })

    suggestionsClose.addEventListener('click', () => {
        suggestionsContainer.style.display = 'none'
    })

    // 监听推荐输入语句响应
    ipcRenderer.on('suggestions-response', (event, suggestions) => {
        displaySuggestions(suggestions)
    })

    // 搜索功能
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.trim();
        const messages = chatMessages.querySelectorAll('.message');

        // 首先清除所有现有的高亮
        messages.forEach((msg: any) => {
            // 恢复原始文本（移除 span.search-highlight）
            const highlights = msg.querySelectorAll('.search-highlight');
            highlights.forEach((h: HTMLElement) => {
                const parent = h.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(h.innerText), h);
                    parent.normalize(); // 合并相邻文本节点
                }
            });
        });

        if (searchTerm === '') return;

        const regex = new RegExp(`(${searchTerm})`, 'gi');
        let firstMatch: HTMLElement | null = null;

        messages.forEach((msg: any) => {
            // 深度遍历文本节点进行替换，避免破坏 HTML 结构
            const walker = document.createTreeWalker(msg, NodeFilter.SHOW_TEXT, null);
            const nodesToReplace: {node: Text, matches: RegExpMatchArray}[] = [];

            let node;
            while (node = walker.nextNode()) {
                const matches = node.nodeValue?.match(regex);
                if (matches) {
                    nodesToReplace.push({node: node as Text, matches});
                }
            }

            nodesToReplace.forEach(({node, matches}) => {
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;
                const text = node.nodeValue || "";

                text.replace(regex, (match, p1, offset) => {
                    // 添加匹配前的文本
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, offset)));

                    // 添加高亮元素
                    const span = document.createElement('span');
                    span.className = 'search-highlight';
                    span.textContent = match;
                    fragment.appendChild(span);

                    if (!firstMatch) firstMatch = span;

                    lastIndex = offset + match.length;
                    return match;
                });

                // 添加剩余文本
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                node.parentNode?.replaceChild(fragment, node);
            });
        });

        if (firstMatch) {
            (firstMatch as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // 重置窗口位置和大小
    // 重置窗口位置和大小
    resetButton.addEventListener('click', () => {
        const chatBox = document.querySelector('.chat-box') as HTMLElement;
        if (chatBox && initialWindowState.width) {
            chatBox.style.width = initialWindowState.width;
            chatBox.style.height = initialWindowState.height;
            chatBox.style.top = initialWindowState.top;
            chatBox.style.left = initialWindowState.left;
        }
        ipcRenderer.send('reset-window-position');
    });

// 监听配置变更
    ipcRenderer.on('config-change', (event, key, value) => {
        console.log(`Received config-change in chat window: ${key} = ${value}`);
        if (key === 'showSuggestionsButton') {
            showSuggestionsButton = value;
            if (suggestionsButton) {
                suggestionsButton.style.display = showSuggestionsButton ? 'block' : 'none';
            }
        } else if (key === 'autoSendSuggestion') {
            autoSendSuggestion = value;
            console.log(`autoSendSuggestion updated to: ${autoSendSuggestion}`);
            // 更新建议容器样式
            updateSuggestionsContainerStyle();
        } else if (key === 'showTokenizerDisplay') {
            showTokenizerDisplay = value;
            console.log(`showTokenizerDisplay updated to: ${showTokenizerDisplay}`);
            // 更新分词器显示
            if (tokenDisplayWrapper) {
                tokenDisplayWrapper.style.display = showTokenizerDisplay ? 'block' : 'none';
            }
            // Update token count if display is now visible
            if (showTokenizerDisplay) {
                updateTokenCount(chatInput.value);
            }
        }
    })

//IPC Events

function showSlashCommands(filter = '') {
    console.log(`showSlashCommands called with filter: "${filter}". availableActions count: ${availableActions.length}`);
    const filteredActions = availableActions.filter(action => action.signature.toLowerCase().includes(filter.toLowerCase()));
    console.log(`Found ${filteredActions.length} filtered actions.`);

    if (filteredActions.length === 0) {
        hideSlashCommands();
        return;
    }

    slashCommandContainer.innerHTML = '';
    filteredActions.forEach((action, index) => {
        const item = document.createElement('div');
        item.classList.add('slash-command-item');
        item.dataset.signature = action.signature;

        const signatureSpan = document.createElement('span');
        signatureSpan.textContent = `/${action.signature}`;

        const descriptionSpan = document.createElement('span');
        descriptionSpan.classList.add('description');
        const desc = (typeof action.description === 'object')
            ? (action.description[(window as any).LocalizationManager?.language || 'en'] || action.description['en'])
            : action.description;
        descriptionSpan.textContent = desc.split('.')[0]; // Show first sentence of description

        item.appendChild(signatureSpan);
        item.appendChild(descriptionSpan);

        item.addEventListener('click', () => {
            selectSlashCommand(action);
        });
        slashCommandContainer.appendChild(item);
    });

    selectedSlashCommandIndex = -1;
    slashCommandContainer.style.display = 'block';
    chatMessages.appendChild(slashCommandContainer);
    slashCommandContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    updateSelectedSlashCommand();
}

function hideSlashCommands() {
    if (slashCommandContainer.parentNode === chatMessages) {
        chatMessages.removeChild(slashCommandContainer);
    }
    slashCommandContainer.style.display = 'none';
    currentSlashCommand = '';
    selectedSlashCommandIndex = -1;
}

function updateSelectedSlashCommand() {
    const items = slashCommandContainer.querySelectorAll('.slash-command-item');
    items.forEach((item, index) => {
        if (index === selectedSlashCommandIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function selectSlashCommand(action: any) {
    hideSlashCommands();
    chatInput.value = ''; // Clear the input
    showInlineActionForm(action);
}

function showInlineActionForm(action: any) {
    // Create form container
    const formContainer = document.createElement('div');
    formContainer.classList.add('inline-action-form');
    formContainer.dataset.signature = action.signature;

    // Add title
    const title = document.createElement('h3');
    title.textContent = `/${action.signature}`;
    formContainer.appendChild(title);

    // Add source and target character selectors
    const characterSelectorsContainer = document.createElement('div');
    characterSelectorsContainer.classList.add('action-character-selectors');

    const allCharacters = Array.from(currentGameData!.characters.values());

    // Source selector
    const sourceSelectDiv = document.createElement('div');
    sourceSelectDiv.classList.add('action-character-select');
    const sourceLabel = document.createElement('label');
    sourceLabel.textContent = 'Source Character';
    
    const sourceCustomSelect = document.createElement('div');
    sourceCustomSelect.className = 'custom-select-container';
    
    const sourceHiddenInput = document.createElement('input');
    sourceHiddenInput.type = 'hidden';
    sourceHiddenInput.id = 'action-source-char-hidden';

    const sourceValueDiv = document.createElement('div');
    sourceValueDiv.className = 'custom-select-value';

    const sourceOptionsDiv = document.createElement('div');
    sourceOptionsDiv.className = 'custom-select-options';

    allCharacters.forEach(char => {
        const optionElement = document.createElement('div');
        optionElement.className = 'custom-select-option';
        optionElement.dataset.value = char.id.toString();
        optionElement.textContent = char.shortName;
        optionElement.addEventListener('click', () => {
            sourceValueDiv.textContent = char.shortName;
            sourceHiddenInput.value = char.id.toString();
            sourceOptionsDiv.style.display = 'none';
        });
        sourceOptionsDiv.appendChild(optionElement);
        if (char.id === currentGameData!.playerID) {
            sourceValueDiv.textContent = char.shortName;
            sourceHiddenInput.value = char.id.toString();
        }
    });

    sourceValueDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = sourceOptionsDiv.style.display === 'block';
        // Close all other dropdowns
        document.querySelectorAll('.custom-select-options').forEach(otherOptions => {
            if (otherOptions !== sourceOptionsDiv) {
                (otherOptions as HTMLElement).style.display = 'none';
            }
        });
        // Toggle the current one
        sourceOptionsDiv.style.display = isVisible ? 'none' : 'block';
    });

    sourceCustomSelect.appendChild(sourceHiddenInput);
    sourceCustomSelect.appendChild(sourceValueDiv);
    sourceCustomSelect.appendChild(sourceOptionsDiv);

    sourceSelectDiv.appendChild(sourceLabel);
    sourceSelectDiv.appendChild(sourceCustomSelect);
    characterSelectorsContainer.appendChild(sourceSelectDiv);

    // Target selector
    const targetSelectDiv = document.createElement('div');
    targetSelectDiv.classList.add('action-character-select');
    const targetLabel = document.createElement('label');
    targetLabel.textContent = 'Target Character';

    const targetCustomSelect = document.createElement('div');
    targetCustomSelect.className = 'custom-select-container';

    const targetHiddenInput = document.createElement('input');
    targetHiddenInput.type = 'hidden';
    targetHiddenInput.id = 'action-target-char-hidden';

    const targetValueDiv = document.createElement('div');
    targetValueDiv.className = 'custom-select-value';

    const targetOptionsDiv = document.createElement('div');
    targetOptionsDiv.className = 'custom-select-options';

    let defaultTargetSet = false;
    allCharacters.forEach(char => {
        const optionElement = document.createElement('div');
        optionElement.className = 'custom-select-option';
        optionElement.dataset.value = char.id.toString();
        optionElement.textContent = char.shortName;
        optionElement.addEventListener('click', () => {
            targetValueDiv.textContent = char.shortName;
            targetHiddenInput.value = char.id.toString();
            targetOptionsDiv.style.display = 'none';
        });
        targetOptionsDiv.appendChild(optionElement);
        if (!defaultTargetSet) {
            targetValueDiv.textContent = char.shortName;
            targetHiddenInput.value = char.id.toString();
            defaultTargetSet = true;
        }
    });

    targetValueDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = targetOptionsDiv.style.display === 'block';
        // Close all other dropdowns
        document.querySelectorAll('.custom-select-options').forEach(otherOptions => {
            if (otherOptions !== targetOptionsDiv) {
                (otherOptions as HTMLElement).style.display = 'none';
            }
        });
        // Toggle the current one
        targetOptionsDiv.style.display = isVisible ? 'none' : 'block';
    });

    targetCustomSelect.appendChild(targetHiddenInput);
    targetCustomSelect.appendChild(targetValueDiv);
    targetCustomSelect.appendChild(targetOptionsDiv);

    targetSelectDiv.appendChild(targetLabel);
    targetSelectDiv.appendChild(targetCustomSelect);
    characterSelectorsContainer.appendChild(targetSelectDiv);

    formContainer.appendChild(characterSelectorsContainer);

    const descriptionDiv = document.createElement('div');
    descriptionDiv.classList.add('action-description');
    const actionDesc = (typeof action.description === 'object')
        ? (action.description[(window as any).LocalizationManager?.language || 'en'] || action.description['en'])
        : action.description;
    descriptionDiv.textContent = actionDesc;
    formContainer.appendChild(descriptionDiv);

    // Add arguments
    const argsContainer = document.createElement('div');
    argsContainer.classList.add('action-args-container');

    if (action.args.length === 0) {
        const noArgsLabel = document.createElement('p');
        noArgsLabel.textContent = 'This action takes no arguments.';
        argsContainer.appendChild(noArgsLabel);
    } else {
        action.args.forEach((arg: any, index: number) => {
            const argDiv = document.createElement('div');
            argDiv.classList.add('action-arg');

            const label = document.createElement('label');
            label.innerHTML = `${arg.name} <span class="arg-type">(${arg.type})</span>`;

            let inputElement: HTMLInputElement | HTMLSelectElement;

            const desc = document.createElement('div');
            desc.classList.add('arg-desc');
            const argDesc = (typeof arg.desc === 'object')
                ? (arg.desc[(window as any).LocalizationManager?.language || 'en'] || arg.desc['en'])
                : arg.desc;
            desc.textContent = argDesc;

            // Check for enum options or boolean type to create a dropdown
            if ((arg.options && Array.isArray(arg.options)) || arg.type === 'boolean') {
                // Create a custom select dropdown
                const customSelectContainer = document.createElement('div');
                customSelectContainer.classList.add('custom-select-container');

                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.dataset.argName = arg.name;
                hiddenInput.id = `action-arg-${index}`;

                const selectValue = document.createElement('div');
                selectValue.classList.add('custom-select-value');

                const optionsList = document.createElement('div');
                optionsList.classList.add('custom-select-options');
                optionsList.style.display = 'none';

                const lang = (window as any).LocalizationManager?.language || 'en';

                let optionsSource = arg.options;
                if (arg.type === 'boolean') {
                    optionsSource = ['true', 'false'];
                }

                optionsSource.forEach((option: any, optionIndex: number) => {
                    const optionElement = document.createElement('div');
                    optionElement.classList.add('custom-select-option');
                    
                    let value: string;
                    let display: string;

                    if (typeof option === 'object' && option.value && option.display) {
                        value = option.value;
                        display = option.display[lang] || option.display['en'] || option.value;
                    } else {
                        value = option;
                        display = option;
                    }
                    optionElement.dataset.value = value;
                    optionElement.textContent = display;

                    optionElement.addEventListener('click', () => {
                        selectValue.textContent = display;
                        hiddenInput.value = value;
                        optionsList.style.display = 'none';
                    });

                    optionsList.appendChild(optionElement);

                    if (optionIndex === 0) {
                        selectValue.textContent = display;
                        hiddenInput.value = value;
                    }
                });

                selectValue.addEventListener('click', () => {
                    optionsList.style.display = optionsList.style.display === 'none' ? 'block' : 'none';
                });

                customSelectContainer.appendChild(hiddenInput);
                customSelectContainer.appendChild(selectValue);
                customSelectContainer.appendChild(optionsList);

                argDiv.appendChild(label);
                argDiv.appendChild(customSelectContainer);
                argDiv.appendChild(desc);

            } else { // Otherwise, create a standard input
                inputElement = document.createElement('input');
                if (arg.type === 'number') {
                    inputElement.type = 'number';
                    // Add min/max validation if specified
                    if (arg.min !== undefined) {
                        inputElement.min = arg.min;
                    }
                    if (arg.max !== undefined) {
                        inputElement.max = arg.max;
                    }
                } else {
                    inputElement.type = 'text';
                }
                inputElement.dataset.argName = arg.name;
                inputElement.id = `action-arg-${index}`;
                argDiv.appendChild(label);
                argDiv.appendChild(inputElement);
                argDiv.appendChild(desc);
            }
            
            argsContainer.appendChild(argDiv);
        });
    }

    formContainer.appendChild(argsContainer);

    // Add buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('inline-action-buttons');

    // @ts-ignore
    const lm = window.LocalizationManager;

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.classList.add('action-cancel-button');
    const cancelTooltip = (lm ? lm.getNestedTranslation('chat.cancel_tooltip') : null) || "Cancel this action.";
    cancelButton.setAttribute('data-tooltip', cancelTooltip);
    cancelButton.addEventListener('click', () => {
        if (formContainer.parentNode) {
            formContainer.parentNode.removeChild(formContainer);
        }
    });

    const executeButton = document.createElement('button');
    executeButton.textContent = 'Execute';
    executeButton.classList.add('action-execute-button');
    const executeTooltip = (lm ? lm.getNestedTranslation('chat.execute_tooltip') : null) || "Execute this action.";
    executeButton.setAttribute('data-tooltip', executeTooltip);
    executeButton.addEventListener('click', () => {
        const sourceId = (formContainer.querySelector('#action-source-char-hidden') as HTMLInputElement).value;
        const targetId = (formContainer.querySelector('#action-target-char-hidden') as HTMLInputElement).value;
        
        const args: any[] = [sourceId, targetId];
        const inputs = formContainer.querySelectorAll('.action-arg input, .action-arg select, .action-arg input[type=hidden]');
        
        inputs.forEach(input => {
            args.push((input as HTMLInputElement | HTMLSelectElement).value);
        });

        ipcRenderer.send('execute-action', action.signature, args);
        if (formContainer.parentNode) {
            formContainer.parentNode.removeChild(formContainer);
        }
    });

    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(executeButton);
    formContainer.appendChild(buttonsContainer);

    // Add to chat messages
    chatMessages.appendChild(formContainer);
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // Focus the first input if it exists
    const firstInput = formContainer.querySelector('input');
    if (firstInput) {
        firstInput.focus();
    }
}

ipcRenderer.on('chat-show', () =>{
    document.body.style.display = '';
})

ipcRenderer.on('queue-update', (e, queue, currentSpeaker) => {
    updateQueueStatus(queue, currentSpeaker);
});

ipcRenderer.on('chat-hide', () =>{
    hideChat();
})

ipcRenderer.on('chat-start', async (e, payload: { gameData: GameData, messages: Message[], narratives: [number, string[]][], historicalMetadata: any[], actions: any[] }) => {
    const { gameData, messages, narratives, historicalMetadata, actions } = payload;
    availableActions = actions;
    console.log(`Received ${availableActions.length} available actions from chat-start payload.`);

    playerName = gameData.playerName.replace(/\s+/g, '');
    aiName = gameData.aiName;
    currentGameData = gameData;

    // Reset character color mapping for new conversation
    characterColorMap.clear();
    nextColorIndex = 0;

    setupCharacterTargeting(gameData);

    document.body.style.display = '';

    // Capture initial state
    const chatBox = document.querySelector('.chat-box') as HTMLElement;
    if (chatBox && !initialWindowState.width) {
        const computedStyle = window.getComputedStyle(chatBox);
        initialWindowState = {
            width: computedStyle.width,
            height: computedStyle.height,
            top: chatBox.offsetTop + 'px',
            left: chatBox.offsetLeft + 'px'
        };
    }

    // Load config and apply settings
    let config: any;
    try {
        config = await ipcRenderer.invoke('get-config');
        showSuggestionsButton = config.showSuggestionsButton !== undefined ? config.showSuggestionsButton : true;
        autoSendSuggestion = config.autoSendSuggestion !== undefined ? config.autoSendSuggestion : false;
        showTokenizerDisplay = config.showTokenizerDisplay !== undefined ? config.showTokenizerDisplay : false;
    } catch (error) {
        console.error('Error getting config:', error);
        showSuggestionsButton = true;
        autoSendSuggestion = false;
        showTokenizerDisplay = false;
    }

    // Apply translations
    // @ts-ignore
    if (window.LocalizationManager && config) {
        // @ts-ignore
        window.LocalizationManager.loadTranslations(config.language || 'en').then(() => {
            // @ts-ignore
            window.LocalizationManager.applyTranslations();
        });
    }

    // Initialize chat UI elements (this clears the display)
    initChat();
    updateSuggestionsContainerStyle();

    // Get context limit once per chat session
    ipcRenderer.invoke('get-context-limit').then((limit: number) => {
        if (limit > 0) {
            contextLimit = limit;
        } else if (config && config.contextSize > 0) {
            // Fallback to overwrite value from config
            contextLimit = config.contextSize;
        } else {
            contextLimit = 0;
        }

        // Initial update for tokenizer if visible
        if (showTokenizerDisplay) {
            updateTokenCount(chatInput.value);
        }
    });

    // Render historical conversations if they exist
    if (messages && messages.length > 0) {
        const narrativeMap = new Map(narratives);

        const separator = document.createElement('div');
        separator.classList.add('historical-separator');
        separator.innerHTML = '<hr>';
        chatMessages.append(separator);

        const header = document.createElement('div');
        header.classList.add('historical-header');
        header.classList.add('message');
        header.textContent = 'Previous Conversations:';
        chatMessages.append(header);

        let messageIndex = 0;
        if (historicalMetadata && historicalMetadata.length > 0) {
            for (const conv of historicalMetadata) {
                const convHeader = document.createElement('div');
                convHeader.classList.add('historical-conversation-header');
                convHeader.classList.add('message');

                let headerText = `Date: ${conv.date}`;
                if (conv.location) headerText += ` | Location: ${conv.location}`;
                if (conv.scene) headerText += ` | Scene: ${conv.scene}`;
                convHeader.textContent = headerText;
                chatMessages.append(convHeader);

                if (conv.characters && conv.characters.length > 0) {
                    const characterDiv = document.createElement('div');
                    characterDiv.classList.add('historical-characters', 'message');
                    characterDiv.style.cssText = 'font-size: 0.9rem; color: #a18c61; margin-top: 2px; margin-bottom: 5px;';
                    characterDiv.textContent = `Characters: ${conv.characters.join(', ')}`;
                    chatMessages.append(characterDiv);
                }

                for (const msg of conv.messages) {
                    await displayMessage(msg, true);
                    const msgNarratives = narrativeMap.get(messageIndex);
                    if (msgNarratives) {
                        msgNarratives.forEach(n => displayNarrative(n));
                    }
                    messageIndex++;
                }
                const convSeparator = document.createElement('div');
                convSeparator.classList.add('historical-conversation-separator');
                convSeparator.innerHTML = '<hr style="margin: 10px 0; border-color: #3d2e1e;">';
                chatMessages.append(convSeparator);
            }
        } else {
            for (let i = 0; i < messages.length; i++) {
                await displayMessage(messages[i], true);
                const msgNarratives = narrativeMap.get(i);
                if (msgNarratives) {
                    msgNarratives.forEach(n => displayNarrative(n));
                }
            }
        }
    }

    // Render current conversation header
    const currentSeparator = document.createElement('div');
    currentSeparator.classList.add('current-conversation-separator');
    currentSeparator.innerHTML = '<hr>';
    chatMessages.append(currentSeparator);

    const currentHeader = document.createElement('div');
    currentHeader.classList.add('current-conversation-header', 'message');
    let currentHeaderText = 'Current Conversation:';
    if (currentGameData) {
        currentHeaderText += ` | Date: ${currentGameData.date}`;
        if (currentGameData.location) currentHeaderText += ` | Location: ${currentGameData.location}`;
        if (currentGameData.scene) currentHeaderText += ` | Scene: ${currentGameData.scene}`;
    }
    currentHeader.textContent = currentHeaderText;
    chatMessages.append(currentHeader);

    if (currentGameData && currentGameData.characters) {
        const characterDiv = document.createElement('div');
        characterDiv.classList.add('current-characters', 'message');
        characterDiv.style.cssText = 'font-size: 0.9rem; color: #a18c61; margin-top: 2px; margin-bottom: 5px;';
        const playerID = currentGameData.playerID;
        const characterNames = Array.from(currentGameData.characters.values()).map(c => {
            if (c.id === playerID) {
                return `${c.shortName} (You)`;
            }
            return c.shortName;
        }).join(', ');
        characterDiv.textContent = `Characters: ${characterNames}`;
        chatMessages.append(characterDiv);
    }

    if (messages.length > 0 && clearHistoryButton) {
        clearHistoryButton.style.display = 'flex';
    }

    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
});

ipcRenderer.on('message-receive', async (e, message: Message, waitForActions: boolean)=>{
    await displayMessage(message);
    console.log("wait: "+waitForActions)

    // Clear loading dots if this is an AI message and we're not waiting for actions
    // This handles the case where AI speaks first in a conversation
    if (message.role === "assistant" && !waitForActions) {
        removeLoadingDots();
    }

    // Always keep loading dots visible until actions are received
    // Don't remove loading dots here - wait for actions-receive event
    if(waitForActions){
        showLoadingDots();
    }

    // Show clear history button after first message
    if (clearHistoryButton && clearHistoryButton.style.display === 'none') {
        clearHistoryButton.style.display = 'flex';
    }


})

ipcRenderer.on('actions-receive', async (e, actionsResponse: ActionResponse[], narrative: string) =>{
    displayActions(actionsResponse);
    displayNarrative(narrative);

    removeLoadingDots();
})

ipcRenderer.on('stream-start', async (e, gameData)=>{
    let streamMessage = document.createElement('div');
    streamMessage.classList.add('message');
    streamMessage.classList.add('ai-message');
    chatMessages.append(streamMessage);
})

ipcRenderer.on('stream-message', (e, message: Message)=>{
    removeLoadingDots();
    replaceLastMessage(message);
    showLoadingDots();
    //@ts-ignore
})

ipcRenderer.on('stream-end', (e, actions: ActionResponse[], narrative: string) =>{
    displayActions(actions);
    displayNarrative(narrative);
    removeLoadingDots();
})

ipcRenderer.on('error-message', (e, errorMessage: string) =>{
    displayErrorMessage(errorMessage);
})

// 监听场景描述事件
ipcRenderer.on('scene-description', (e, sceneDescription: string) =>{
    if (sceneDescription && sceneDescription.trim()) {
        // 创建场景描述消息元素
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add('scene-description-message');

        // 创建场景描述内容
        const sceneDescSpan = document.createElement('span');
        sceneDescSpan.innerText = sceneDescription;
        sceneDescSpan.classList.add('scene-description-text');

        messageDiv.appendChild(sceneDescSpan);

        // 尝试将场景描述插入到当前对话部分的正确位置
        // 首先查找当前角色列表元素
        const currentCharacters = chatMessages.querySelector('.current-characters');
        if (currentCharacters) {
            // 插入到当前角色列表之后
            currentCharacters.parentNode?.insertBefore(messageDiv, currentCharacters.nextSibling);
            console.log(`Scene description inserted after current characters: ${sceneDescription.substring(0, 50)}...`);
        } else {
            // 如果没有找到当前角色列表，查找当前对话标题
            const currentHeader = chatMessages.querySelector('.current-conversation-header');
            if (currentHeader) {
                // 插入到当前对话标题之后
                currentHeader.parentNode?.insertBefore(messageDiv, currentHeader.nextSibling);
                console.log(`Scene description inserted after current conversation header: ${sceneDescription.substring(0, 50)}...`);
            } else {
                // 如果都没有找到，回退到插入到开头
                chatMessages.insertBefore(messageDiv, chatMessages.firstChild);
                console.log(`Scene description inserted at beginning (fallback): ${sceneDescription.substring(0, 50)}...`);
            }
        }

        // Auto-scroll to bottom after scene description is inserted
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 10);

        // Clear loading state AFTER scene description is inserted into DOM
        removeLoadingDots();
    } else {
        // If scene description is empty, still clear loading dots
        removeLoadingDots();
    }
})

// 监听场景描述加载事件
ipcRenderer.on('scene-description-loading', (e, isLoading: boolean) =>{
    console.log(`Scene description loading: ${isLoading}`);
    if (isLoading === true) {
        showLoadingDots();
        // Update tooltip for disabled input
        updateInputTooltip();
    } else if (isLoading === false) {
        removeLoadingDots();
    } else {
        console.warn(`Invalid isLoading value received: ${isLoading}`);
    }
})

// 监听AI首次对话加载事件
ipcRenderer.on('ai-first-conversation-loading', (e, isLoading: boolean) =>{
    console.log(`AI first conversation loading: ${isLoading}`);
    if (isLoading) {
        showLoadingDots();
        // Update tooltip for disabled input
        updateInputTooltip();
    }
})

// 监听历史对话加载事件
ipcRenderer.on('historical-conversations-loading', (e, isLoading: boolean) =>{
    console.log(`Historical conversations loading: ${isLoading}`);
    if (isLoading) {
        // 显示加载指示器
        // 将输入框占位符改为"Loading..."
        chatInput.placeholder = "Loading...";
    } else {
        // 移除加载指示器
        // 将输入框占位符恢复为默认值
        // @ts-ignore
        if (window.LocalizationManager) {
            // @ts-ignore
            const placeholderText = window.LocalizationManager.getNestedTranslation('chat.input_placeholder') || 'Write a message...';
            chatInput.placeholder = placeholderText;
        } else {
            chatInput.placeholder = 'Write a message...';
        }
    }
})

// Initialize dragging
const dragHandle = document.querySelector('.drag-handle') as HTMLElement;
if (chatBox && dragHandle) {
    makeDraggable(chatBox, dragHandle);
}



function makeDraggable(element: HTMLElement, handle: HTMLElement) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e: MouseEvent) {
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e: MouseEvent) {
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}
