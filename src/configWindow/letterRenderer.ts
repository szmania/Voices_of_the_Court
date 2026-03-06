import { ipcRenderer } from 'electron';
import { Letter } from '../main/letter/letterInterfaces.js';

const initLocalization = () => {
    const { LocalizationManager } = window as any;
    if (LocalizationManager) {
        LocalizationManager.instance.applyLocalization();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initLocalization();
    ipcRenderer.send('get-letters');
});

ipcRenderer.on('letters-data', (event, letters: Letter[]) => {
    const letterList = document.getElementById('letter-list');
    const letterContent = document.getElementById('letter-content');
    if (!letterList || !letterContent) return;

    letterList.innerHTML = ''; // Clear existing list

    if (letters.length === 0) {
        const noLettersItem = document.createElement('li');
        noLettersItem.setAttribute('data-i18n', 'letters.no_letters');
        noLettersItem.textContent = 'No letters found.'; // Fallback text
        letterList.appendChild(noLettersItem);
        initLocalization(); // Apply localization to the new element
        return;
    }

    letters.forEach(letter => {
        const li = document.createElement('li');
        li.textContent = `From: ${letter.sender.shortName} - ${letter.subject}`;
        li.dataset.letterId = letter.id;
        if (!letter.isRead) {
            li.classList.add('unread');
        }
        li.addEventListener('click', () => {
            letterContent.innerHTML = `
                <h3>${letter.subject}</h3>
                <p><strong>From:</strong> ${letter.sender.fullName}</p>
                <p><strong>To:</strong> ${letter.recipient.fullName}</p>
                <p><strong>Date:</strong> ${new Date(letter.timestamp).toLocaleString()}</p>
                <hr>
                <div>${letter.content}</div>
            `;
            ipcRenderer.send('mark-letter-as-read', letter.id);
            li.classList.remove('unread');
        });
        letterList.appendChild(li);
    });
});

ipcRenderer.on('update-theme', (event, theme: string) => {
    document.body.className = `theme-${theme}`;
});

ipcRenderer.on('update-language', () => {
    initLocalization();
});
