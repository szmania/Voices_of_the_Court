import { ipcRenderer } from 'electron';
import {ActionResponse, Message} from '../main/ts/conversation_interfaces.js';
import { marked } from 'marked';
import { GameData } from '../shared/gameData/GameData.js';
const DOMPurify = require('dompurify');

const sanitizeConfig = {
    ALLOWED_TAGS: ['em', 'strong'], 
    KEEP_CONTENT: true, 
  };

hideChat();

// 初始化主题
function initTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'chinese';
    document.body.classList.add(`theme-${savedTheme}`);
}

// 页面加载时初始化主题
initTheme();

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
let loadingDots: any;

let playerName: string;
let aiName: string;
let showSuggestionsButton: boolean = true; // 默认显示建议按钮
let autoSendSuggestion: boolean = false; // 默认不自动发送建议

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
            messageDiv.innerHTML = DOMPurify.sanitize(await marked.parseInline(`**${message.name}:** ${message.content}`), sanitizeConfig);
            break;
        case 'assistant':
            removeLoadingDots();
            messageDiv.classList.add('ai-message');
            if (isHistorical) {
                messageDiv.classList.add('historical-ai-message');
            }
            messageDiv.innerHTML = DOMPurify.sanitize(await marked.parseInline(`**${message.name}:** ${message.content}`), sanitizeConfig);

            break;
    };   
    chatMessages.append(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

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

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add('action-message');
    
    for(const action of actions){
        const ActionSpan = document.createElement('span');
        ActionSpan.innerText = action.chatMessage+"\n";
        ActionSpan.classList.add(action.chatMessageClass);
        messageDiv.appendChild(ActionSpan);
    }
    
    chatMessages.append(messageDiv);
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



chatInput.addEventListener('keydown', async function(e) {    
    if(e.which == 13) { //on enter
        e.preventDefault(); //disallow newlines   
        if(chatInput.value != ''){
            const messageText = chatInput.value;
            chatInput.value = ''

            let message: Message = {
                role: "user",
                name: playerName,
                content: messageText
            }

            await displayMessage(message);
            showLoadingDots();
            ipcRenderer.send('message-send', message);

        };
    };
});

async function replaceLastMessage(message: Message){
    chatMessages.lastElementChild!.innerHTML = DOMPurify.sanitize((await marked.parseInline(`**${message.name}:** ${message.content}*`)).replace(/\*/g, ''), sanitizeConfig);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showLoadingDots(){  //and disable chat
    loadingDots = document.createElement('div');
    loadingDots.classList.add('loading');
    chatMessages.append(loadingDots);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.disabled = true;
    
    updateRegenerateButtonState();
}

function removeLoadingDots(){
    loadingDots?.remove();
    chatInput.disabled = false;
    
    updateRegenerateButtonState();
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

    // Set static tooltips
    undoButtonWrapper.setAttribute('data-tooltip', undoTooltip);
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
        }
    })

//IPC Events

ipcRenderer.on('chat-show', () =>{
    document.body.style.display = '';
})

ipcRenderer.on('chat-hide', () =>{
    hideChat();
})

ipcRenderer.on('chat-history', async (e, messages: Message[], narratives: [number, string[]][]) => {
    console.log(`Received ${messages.length} historical messages.`);
    const narrativeMap = new Map(narratives);
    
    // Add separation line before historical conversations
    const separator = document.createElement('div');
    separator.classList.add('historical-separator');
    separator.innerHTML = '<hr>';
    chatMessages.append(separator);
    
    // Add historical conversations header
    const header = document.createElement('div');
    header.classList.add('historical-header');
    header.classList.add('message');
    header.textContent = 'Previous Conversations:';
    chatMessages.append(header);
    
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        await displayMessage(msg, true); // Pass true for isHistorical parameter
        
        const msgNarratives = narrativeMap.get(i);
        if (msgNarratives) {
            msgNarratives.forEach(n => displayNarrative(n));
        }
    }
    
    // Add separation line between historical and current conversation
    const currentSeparator = document.createElement('div');
    currentSeparator.classList.add('current-conversation-separator');
    currentSeparator.innerHTML = '<hr>';
    chatMessages.append(currentSeparator);
    
    // Add current conversation header
    const currentHeader = document.createElement('div');
    currentHeader.classList.add('current-conversation-header');
    currentHeader.classList.add('message');
    currentHeader.textContent = 'Current Conversation:';
    chatMessages.append(currentHeader);
    
    // Show clear history button if there are messages
    if (messages.length > 0 && clearHistoryButton) {
        clearHistoryButton.style.display = 'flex';
    }
});

ipcRenderer.on('chat-start', async (e, gameData: GameData) =>{   
    playerName = gameData.playerName.replace(/\s+/g, '');
    aiName = gameData.aiName;
    
    document.body.style.display = '';
    initChat();

    // Capture initial state if not already captured
    // This represents the "default" position and size
    const chatBox = document.querySelector('.chat-box') as HTMLElement;
    if (chatBox && !initialWindowState.width) {
        const computedStyle = window.getComputedStyle(chatBox);
        initialWindowState = {
            width: computedStyle.width,
            height: computedStyle.height,
            top: chatBox.offsetTop + 'px',
            left: chatBox.offsetLeft + 'px'
        };
        console.log('Captured initial window state:', initialWindowState);
    }
    
    let config;
    // 应用当前语言翻译
    try {
        config = await ipcRenderer.invoke('get-config');
        showSuggestionsButton = config.showSuggestionsButton !== undefined ? config.showSuggestionsButton : true;
        autoSendSuggestion = config.autoSendSuggestion !== undefined ? config.autoSendSuggestion : false;
    } catch (error) {
        console.error('Error getting config:', error);
        showSuggestionsButton = true; // 默认显示
        autoSendSuggestion = false; // 默认不自动发送建议
    }
    
    // 应用当前语言翻译
    // @ts-ignore
    if (window.LocalizationManager && config) {
        // @ts-ignore
        window.LocalizationManager.loadTranslations(config.language || 'en').then(() => {
            // @ts-ignore
            window.LocalizationManager.applyTranslations();
        });
    }

    // 初始化建议容器样式
    updateSuggestionsContainerStyle();
})

ipcRenderer.on('message-receive', async (e, message: Message, waitForActions: boolean)=>{
    await displayMessage(message);
    console.log("wait: "+waitForActions)

    if(!waitForActions){
        removeLoadingDots();
    }else{
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
        
        // 将场景描述插入到消息列表的开头
        chatMessages.insertBefore(messageDiv, chatMessages.firstChild);
        
        console.log(`Scene description displayed: ${sceneDescription.substring(0, 50)}...`);
    }
})

// Initialize dragging
const chatBox = document.querySelector('.chat-box') as HTMLElement;
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