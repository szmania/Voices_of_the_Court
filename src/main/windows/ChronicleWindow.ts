import { BrowserWindow } from "electron";
import path from 'path';

export class ChronicleWindow {
    window: BrowserWindow;

    constructor() {
        this.window = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 1200,
            minHeight: 700,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                preload: path.join(__dirname, '..', 'preload.js'),
            }
        });

        this.window.loadFile('./public/chronicleWindow/chronicle.html');
        this.window.removeMenu();

        console.log("Chronicle window opened!");
    }

    show() {
        this.window.setAlwaysOnTop(true, 'screen-saver');
        this.window.show();
        this.window.moveTop();
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
