import { ipcRenderer } from 'electron';
import {ActionResponse, Message, HistoricalConversation} from '../main/ts/conversation_interfaces.js';
import { marked } from 'marked';
import { GameData } from '../shared/gameData/GameData.js';
const DOMPurify = require('dompurify');

const sanitizeConfig = {
    ALLOWED_TAGS: ['em', 'strong'], 
    KEEP_CONTENT: true, 
  };

hideChat();


let chatMessages: HTMLDivElement = document.querySelector('.messages')!;
let chatInput: HTMLTextAreaElement= document.querySelector('.chat-input')!;
let leaveButton: HTMLButtonElement = document.querySelector('.leave-button')!;

let regenerateButton: HTMLButtonElement = document.querySelector('.regenerate-button')!;
let regenerateButtonWrapper: HTMLDivElement = document.querySelector('#regenerate-button-wrapper')!;
let resetButton: HTMLButtonElement = document.querySelector('.reset-button')!;
let searchContainer: HTMLDivElement = document.querySelector('.search-container')!;
let searchInput: HTMLInputElement = document.querySelector('.search-bar')!;
let searchButton: HTMLButtonElement = document.querySelector('.search-button')!;
let loadingDots: any;

let playerName: string;
let aiName: string;


async function initChat(){
    
    chatMessages.innerHTML = '';
    chatInput.innerHTML = '';
    chatInput.disabled = false;    
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
            messageDiv.innerHTML = DOMPurify.sanitize(await marked.parseInline(`**${message.name}:** ${message.content}`), sanitizeConfig);
            break;
        case 'assistant':
            removeLoadingDots();
            messageDiv.classList.add('ai-message');
            messageDiv.innerHTML = DOMPurify.sanitize(await marked.parseInline(`**${message.name}:** ${message.content}`), sanitizeConfig);

            break;
    };   
    chatMessages.append(messageDiv);
    if (!isHistorical) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    updateRegenerateButtonState();

    return messageDiv;
}

function displayActions(actions: ActionResponse[]){
    if (!actions || actions.length === 0) {
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'action-message');
    for(const action of actions){
        
        const ActionSpan = document.createElement('span');
        ActionSpan.innerText = action.chatMessage+"\n";
        ActionSpan.classList.add(action.chatMessageClass);
        messageDiv.appendChild(ActionSpan);

        
    }
    
    chatMessages.append(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
    
    updateRegenerateButtonState();
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

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function clearHighlights() {
    const marks = chatMessages.querySelectorAll('mark');
    marks.forEach(mark => {
        const parent = mark.parentNode!;
        // Replace the <mark> element with its text content
        parent.replaceChild(document.createTextNode(mark.textContent!), mark);
        // Merge adjacent text nodes to clean up the DOM for the next search
        parent.normalize();
    });
}

function performSearch() {
    const query = searchInput.value;
    clearHighlights(); // Clears previous search results

    if (!query.trim()) {
        return; // Do not search for empty or whitespace-only strings
    }

    const messages = chatMessages.querySelectorAll('.message:not(.action-message)');
    const regex = new RegExp(escapeRegExp(query), 'gi');
    let firstMatchElement: HTMLElement | null = null;

    // Use a for...of loop instead of forEach
    for (const messageElement of messages) {
        const message = messageElement as HTMLElement;
        // Use a TreeWalker to safely traverse and modify only text nodes
        const treeWalker = document.createTreeWalker(message, NodeFilter.SHOW_TEXT);
        const nodes: Node[] = [];
        while (treeWalker.nextNode()) {
            nodes.push(treeWalker.currentNode);
        }

        let foundInMessage = false;
        nodes.forEach(node => {
            if (node.nodeValue && regex.test(node.nodeValue)) {
                foundInMessage = true;
                const span = document.createElement('span');
                span.innerHTML = node.nodeValue.replace(regex, '<mark>$&</mark>');
                
                // Replace the original text node with the new nodes (including <mark>)
                node.parentNode!.replaceChild(span, node);
            }
        });

        if (foundInMessage && !firstMatchElement) {
            firstMatchElement = message;
        }
    }

    if (firstMatchElement) {
        firstMatchElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function updateRegenerateButtonState() {
    const lastMessageElement = chatMessages.lastElementChild as HTMLElement;
    const defaultTooltip = "You can only regenerate a response if the AI was the last one to speak.";
    const actionTooltip = "Cannot regenerate a response that includes actions.";
    const waitingTooltip = "Waiting for a response...";

    // Case 1: Loading dots are visible
    if (document.querySelector('.loading')) {
        regenerateButton.disabled = true;
        regenerateButtonWrapper.setAttribute('data-tooltip', waitingTooltip);
        return;
    }

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



chatInput.addEventListener('keydown', async function(e) {    
    if(e.which == 13) { //on enter
        e.preventDefault(); //disallow newlines   
        if(chatInput.value != ''){
            const messageText = chatInput.value;
            console.log(`User submitted message: "${messageText}"`);
            chatInput.value = ''

            let message: Message = {
                role: "user",
                name: playerName,
                content: messageText
            }

            await displayMessage(message);
            showLoadingDots();
            ipcRenderer.send('message-send', message);
            console.log('Sent message-send event to main process.');

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

function hideChat(){
    document.body.style.display = 'none';
}

async function displayHistoricalConversation(conversation: HistoricalConversation): Promise<void> {
    console.log(`Displaying historical conversation: ${conversation.summary} (${conversation.date}) with ${conversation.messages.length} messages.`);
    
    const separator = document.createElement('div');
    separator.classList.add('history-separator');
    separator.textContent = `${conversation.summary} (${conversation.date})`;
    chatMessages.appendChild(separator);
    
    for (const message of conversation.messages) {
        await displayMessage(message, true);
    }
    
    console.log(`Finished displaying historical conversation: ${conversation.summary}`);
}

leaveButton.addEventListener("click", ()=>{
    hideChat();
    chatMessages.innerHTML = '';
    chatInput.innerHTML = '';
    ipcRenderer.send('chat-stop');
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

searchInput.addEventListener('input', () => {
    // Keep search bar visible if there is text, hide otherwise
    if (searchInput.value.trim() !== '') {
        searchContainer.classList.add('active');
    } else {
        searchContainer.classList.remove('active');
        clearHighlights(); // Clear highlights when search input is empty
    }
});

searchButton.addEventListener('click', () => {
    performSearch();
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    }
});

//IPC Events

ipcRenderer.on('chat-show', () =>{
    document.body.style.display = '';
})

ipcRenderer.on('chat-hide', () =>{
    hideChat();
})

ipcRenderer.on('chat-start', async (e, gameData: GameData, historicalConversations: HistoricalConversation[]) =>{   
    console.log('Received chat-start event. GameData:', gameData);
    console.log(`Received ${historicalConversations ? historicalConversations.length : 0} historical conversations.`);
    
    playerName = gameData.playerName;
    aiName = gameData.aiName;
    initChat();
    
    // Display historical conversations if available
    if (historicalConversations && historicalConversations.length > 0) {
        console.log('Displaying historical conversations...');
        historicalConversations.reverse();
        for (const conversation of historicalConversations) {
            console.log(`Rendering historical conversation from ${conversation.date} with ${conversation.messages.length} messages.`);
            await displayHistoricalConversation(conversation);
        }

        // Add a solid line to mark the end of history and start of current chat
        const endSeparator = document.createElement('div');
        endSeparator.classList.add('history-separator', 'history-end-separator');
        endSeparator.textContent = "Current Conversation";
        chatMessages.appendChild(endSeparator);

        chatMessages.scrollTop = chatMessages.scrollHeight;
        console.log('Finished displaying historical conversations.');
    } else {
        console.log('No historical conversations to display.');
        // Display a message when no conversation history is found
        const noHistoryMessage = document.createElement('div');
        noHistoryMessage.className = 'system-message';
        noHistoryMessage.textContent = 'No previous conversation history found.';
        chatMessages.appendChild(noHistoryMessage);
    }
    
    document.body.style.display = '';
    // For self-talk, the AI initiates. Otherwise, the player does.
    if (gameData.playerID === gameData.aiID) {
        showLoadingDots();
    }
})

ipcRenderer.on('message-receive', async (e, message: Message, waitForActions: boolean)=>{
    console.log('Received new AI message:', message);
    await displayMessage(message);
    console.log("wait for actions: "+waitForActions)

    if(waitForActions){
        showLoadingDots();
    } else{
        removeLoadingDots();
    }

    
})

ipcRenderer.on('actions-receive', async (e, actionsResponse: ActionResponse[]) =>{
    displayActions(actionsResponse);

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

ipcRenderer.on('stream-end', (e, actions: ActionResponse[])=>{
    displayActions(actions);
    removeLoadingDots();
})

ipcRenderer.on('error-message', (e, errorMessage: string) =>{
    displayErrorMessage(errorMessage);
})

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

// Initialize dragging
const chatBox = document.querySelector('.chat-box') as HTMLElement;
const dragHandle = document.querySelector('.drag-handle') as HTMLElement;
if (chatBox && dragHandle) {
    makeDraggable(chatBox, dragHandle);
}

resetButton.addEventListener('click', () => {
    if (chatBox) {
        chatBox.style.top = '';
        chatBox.style.left = '';
        chatBox.style.width = '';
        chatBox.style.height = '';
    }
});
