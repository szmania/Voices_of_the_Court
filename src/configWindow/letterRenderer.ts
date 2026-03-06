import { ipcRenderer } from 'electron';
import { Letter } from '../main/letter/letterInterfaces.js';

const initLocalization = () => {
    const { LocalizationManager } = window as any;
    if (LocalizationManager) {
        LocalizationManager.instance.loadTranslations().then(() => {
            LocalizationManager.instance.applyLocalization();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initLocalization();
    ipcRenderer.send('get-letters');
});

ipcRenderer.on('letters-data', (event, letters: Letter[]) => {
    const letterList = document.getElementById('letter-list');
    if (!letterList) return;

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
        li.dataset.letterId = letter.id;
        if (!letter.isRead) {
            li.classList.add('unread');
        }

        li.innerHTML = `
            <div class="letter-header">
                <span><strong>From:</strong> ${letter.sender.fullName}</span>
                <span><strong>To:</strong> ${letter.recipient.fullName}</span>
                <span class="letter-date"><strong>Date:</strong> ${new Date(letter.timestamp).toLocaleString()}</span>
            </div>
            <div class="letter-body">
                <p><strong>Subject:</strong> ${letter.subject}</p>
                <p>${letter.content.replace(/\n/g, '<br>')}</p>
            </div>
        `;

        li.addEventListener('click', () => {
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
