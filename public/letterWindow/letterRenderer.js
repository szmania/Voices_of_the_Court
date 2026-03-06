const { ipcRenderer } = require('electron');
function initLocalization() {
    const { LocalizationManager } = window;
    if (LocalizationManager) {
        LocalizationManager.instance.loadTranslations().then(() => {
            LocalizationManager.instance.applyLocalization();
        });
    }
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

ipcRenderer.on('update-theme', (event, theme) => {
    document.body.className = `theme-${theme}`;
});
