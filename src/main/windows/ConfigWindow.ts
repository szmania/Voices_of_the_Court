import {  app, BrowserWindow } from "electron";
import path from 'path';

export class ConfigWindow{
    window: BrowserWindow;
    isShown: boolean = false;

    constructor(parentWindow: BrowserWindow){
        this.window = new BrowserWindow({
            parent: parentWindow,
            modal: false,
            type: 'toolbar',
            title: "Voices of the Court 2.0 - Community Edition",
            width: 1280,
            height: 600,
            minWidth: 800,
            minHeight: 600,
            frame: false,
            resizable: true,
            transparent: false,
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
