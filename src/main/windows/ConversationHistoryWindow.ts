import { BrowserWindow } from "electron";
import path from 'path';

export class ConversationHistoryWindow{
    window: BrowserWindow;

    constructor(){
        this.window = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 1000,
            minHeight: 600,
            webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, '..', 'preload.js'),
            }       
        })

        this.window.loadFile('./public/historyWindow/conversationHistory.html')
        this.window.removeMenu();
        
        // 设置窗口全屏
        this.window.maximize();

        console.log("Conversation history window opened!")
    }

    show() {
        this.window.show();
        this.window.focus();
    }

    hide() {
        this.window.hide();
    }

    close() {
        this.window.close();
    }

    isDestroyed() {
        return this.window.isDestroyed();
    }
}