import { BrowserWindow } from "electron";
import path from 'path';

export class SummaryManagerWindow{
    window: BrowserWindow;

    constructor(){
        this.window = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 1200,
            minHeight: 700,
            webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, '..', 'preload.js'),
            }       
        })

        this.window.loadFile('./public/summaryManagerWindow/summaryManager.html')
        this.window.removeMenu();
        
        // 设置窗口全屏
        this.window.maximize();

        console.log("Summary manager window opened!")
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