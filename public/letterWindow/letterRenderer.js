const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    // Request letters when the window is ready
    ipcRenderer.send('get-letters');
});

ipcRenderer.on('letters-data', (event, letters) => {
    const letterList = document.getElementById('letter-list');
    const letterContent = document.getElementById('letter-content');
    letterList.innerHTML = ''; // Clear existing list

    if (letters.length === 0) {
        letterList.innerHTML = '<li>No letters found.</li>';
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
            // Remove unread style
            li.classList.remove('unread');
        });
        letterList.appendChild(li);
    });
});

ipcRenderer.on('update-theme', (event, theme) => {
    document.body.className = `theme-${theme}`;
});
