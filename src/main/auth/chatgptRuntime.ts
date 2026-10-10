import { app, ipcMain, safeStorage, shell, dialog, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatGPTAuth } from './chatgptAuth';
import { ChatGPTStore } from './chatgptStore';
import { ChatGPTProvider } from './chatgptProvider';
import { registerChatGPTIpc } from './chatgptIpc';
import { setChatGPTAdapter } from '../../shared/chatgptSubscription';
import { getConfig } from '../configManager';
import { ApiConnection } from '../../shared/apiConnection';

export async function initializeChatGPT(getWindows: () => Array<BrowserWindow | null | undefined>): Promise<void> {
    const auth = new ChatGPTAuth({
        store: new ChatGPTStore(path.join(app.getPath('userData'), 'chatgpt-auth'), safeStorage),
        fetch,
        openBrowser: url => shell.openExternal(url),
        changed: status => {
            getWindows().forEach(window => {
                if (window && !window.isDestroyed()) window.webContents.send('openai-chatgpt:changed', status);
            });
        },
        welcome: async () => {
            await dialog.showMessageBox({ type: 'info', title: 'You’re using your ChatGPT plan',
                message: 'Eligible AI requests in Voices of the Court use your ChatGPT plan. Manage usage and app access in ChatGPT settings.',
                buttons: ['Got it'] });
        },
    });
    await auth.initialize();
    const provider = new ChatGPTProvider(auth);
    setChatGPTAdapter(provider);
    registerChatGPTIpc(ipcMain, auth, provider, event => {
        const window = getWindows().find(window => window && !window.isDestroyed() && event.sender === window.webContents);
        if (!window || event.senderFrame !== window.webContents.mainFrame) return false;
        try {
            const url = new URL(event.senderFrame.url);
            return url.protocol === 'file:' && path.dirname(fileURLToPath(url)) ===
                path.join(app.getAppPath(), 'public', 'configWindow');
        } catch { return false; }
    }, async id => {
        const config = await getConfig();
        const selected = (config as any)[id];
        return new ApiConnection(selected.connection, selected.parameters || {}, null);
    });
    app.on('before-quit', () => auth.dispose());
    for (const channel of ['config-change', 'config-change-nested', 'config-change-nested-nested', 'api-config-change']) {
        ipcMain.on(channel, event => {
            if (!getWindows().some(window => window && !window.isDestroyed() && event.sender === window.webContents)) return;
            // Existing handlers perform their synchronous config update first.
            queueMicrotask(() => {
                BrowserWindow.getAllWindows().forEach(window => window.webContents.send('votc-provider-config-changed'));
            });
        });
    }
}
