import {  app, BrowserWindow } from "electron";
import path from 'path';

export class ConfigWindow{
    window: BrowserWindow;
    isShown: boolean = false;

    constructor(){
        this.window = new BrowserWindow({
            width: 1280,
            height: 600,
            minWidth: 1280,
            minHeight: 600,
            frame: false,
            transparent: true,
            show: false,
            webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, '..', 'preload.js'),
            }       
        })

        if(!app.isPackaged){
            this.window.webContents.openDevTools({ mode: 'detach' });
        }
        

        this.window.loadFile('./public/configWindow/connection.html', { query: { source: 'chat' } });
        this.window.removeMenu();

        console.log("Config window created!")
    }

    show() {
        this.window.show();
        this.isShown = true;
    }

    hide() {
        this.window.hide();
        this.isShown = false;
    }

    minimize() {
        this.hide();
    }

    restore() {
        this.show();
    }

    toggle() {
        if (this.isShown) {
            this.hide();
        } else {
            this.show();
        }
    }
}
