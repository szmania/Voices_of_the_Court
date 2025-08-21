import {  app, BrowserWindow } from "electron";
import path from 'path';

export class ConfigWindow{
    window: BrowserWindow;

    constructor(){
        this.window = new BrowserWindow({
            width: 850,
            height: 600,
            minWidth: 850,
            minHeight: 600,
            webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, '..', 'preload.js')
            }       
        })

        if(!app.isPackaged){
            this.window.webContents.openDevTools();
        }
        

        this.window.loadFile('./public/configWindow/connection.html')
        this.window.removeMenu();

        console.log("Config window opened!")
    }


}
