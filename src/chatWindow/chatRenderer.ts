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


let chatMessages: HTMLDivElement = document.querySelector('.messages')!;
let chatInput: HTMLTextAreaElement= document.querySelector('.chat-input')!;
let leaveButton: HTMLButtonElement = document.querySelector('.leave-button')!;

let regenerateButton: HTMLButtonElement = document.querySelector('.regenerate-button')!;
let regenerateButtonWrapper: HTMLDivElement = document.querySelector('#regenerate-button-wrapper')!;
let loadingDots: any;

let playerName: string;
let aiName: string;


async function initChat(){
    
    chatMessages.innerHTML = '';
    chatInput.innerHTML = '';
    chatInput.disabled = false;    
    updateRegenerateButtonState();
}

async function displayMessage(message: Message): Promise<HTMLDivElement>{

    if(message.content.startsWith(message.name+":")){
        message.content = message.content.slice(message.name!.length+1);
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
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
    chatMessages.scrollTop = chatMessages.scrollHeight;

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

function hideChat(){
    document.body.style.display = 'none';
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

//IPC Events

ipcRenderer.on('chat-show', () =>{
    document.body.style.display = '';
})

ipcRenderer.on('chat-hide', () =>{
    hideChat();
})

ipcRenderer.on('chat-start', (e, gameData: GameData) =>{   
    playerName = gameData.playerName;
    aiName = gameData.aiName;
    initChat();
    document.body.style.display = '';
    showLoadingDots();
})

ipcRenderer.on('message-receive', async (e, message: Message, waitForActions: boolean)=>{
    await displayMessage(message);
    console.log("wait: "+waitForActions)

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
