import { app, BrowserWindow } from "electron";
import path from 'path';

export class ReadmeWindow{
    window: BrowserWindow;

    constructor(){
        this.window = new BrowserWindow({
            width: 800,
            height: 600,
            minWidth: 600,
            minHeight: 400,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                preload: path.join(__dirname, '..', 'preload.js'),
            },
            modal: true,
            show: false,
            resizable: true,
            minimizable: false,
            maximizable: true,
            closable: true,
            alwaysOnTop: false,
            skipTaskbar: false,
            title: 'Voices of the Court - Community Edition',
        });

        this.window.loadFile('./public/readmeWindow/readme.html');
        this.window.removeMenu();

        // 监听窗口关闭事件
        this.window.on('closed', () => {
            // 窗口关闭时清理引用
            this.window = null as any;
        });

        console.log("Readme window created!");
    }

    show(): void {
        if (this.window && !this.window.isDestroyed()) {
            this.window.show();
            this.window.focus();
            console.log("Readme window shown!");
        }
    }

    close(): void {
        if (this.window && !this.window.isDestroyed()) {
            this.window.close();
            console.log("Readme window closed!");
        }
    }

    isDestroyed(): boolean {
        return !this.window || this.window.isDestroyed();
    }
}