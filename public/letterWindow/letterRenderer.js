const { ipcRenderer } = require('electron');
const { LocalizationManager } = require('../../src/shared/LocalizationManager.js');

function initLocalization() {
    const lm = new LocalizationManager();
    lm.loadTranslations().then(() => {
        document.querySelectorAll('[data-localize]').forEach(element => {
            const key = element.getAttribute('data-localize');
            if (key) {
                const translation = lm.getTranslation(key);
                if (translation) {
                    element.innerHTML = translation;
                }
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initLocalization();
    // Request letters when the window is ready
    ipcRenderer.send('get-letters');
});

ipcRenderer.on('letters-data', (event, letters) => {
    const letterList = document.getElementById('letter-list');
    letterList.innerHTML = ''; // Clear existing list

    if (letters.length === 0) {
        letterList.innerHTML = '<li class="no-letters">No letters found.</li>';
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
                <p><strong>From:</strong> ${letter.sender.fullName} (${letter.sender.id})</p>
                <p><strong>To:</strong> ${letter.recipient.fullName} (${letter.recipient.id})</p>
                <p><strong>Date:</strong> ${new Date(letter.timestamp).toLocaleString()}</p>
            </div>
            <div class="letter-body">
                <h4>${letter.subject}</h4>
                <p>${letter.content}</p>
            </div>
        `;

        li.addEventListener('click', () => {
            ipcRenderer.send('mark-letter-as-read', letter.id);
            li.classList.remove('unread');
        });

        letterList.appendChild(li);
    });
});

ipcRenderer.on('update-theme', (event, theme) => {
    document.body.className = `theme-${theme}`;
});
