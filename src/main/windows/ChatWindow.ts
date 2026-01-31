
import {  app, BrowserWindow, ipcMain} from "electron";
import { OverlayController, OVERLAY_WINDOW_OPTS } from 'electron-overlay-window';
import ActiveWindow from '@paymoapp/active-window';
import path from 'path';

ActiveWindow.initialize();

export class ChatWindow{
    window: BrowserWindow;
    conversation: any;
    isShown: boolean;
    windowWatchId: number;
    interval: any;


    constructor(){
        this.window = new BrowserWindow({
            ...OVERLAY_WINDOW_OPTS,
            fullscreenable: false, // 禁用全屏支持，避免与游戏窗口冲突
            transparent: true,
            resizable: true, // 必须设为true，否则Windows下无法切换输入法/显示候选框
            width: 650,
            height: 800,
            webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, '..', 'preload.js'),
            }       
        })

        //this.window.setShape([{x:0, y:0, width: 650, height: 800}])
        
        this.windowWatchId = 0;

        this.window.loadFile('./public/chatWindow/chat.html')
        this.window.removeMenu();
    
        OverlayController.attachByTitle(
            this.window,
            'Crusader Kings III',
          )
          
          if(!app.isPackaged){
            this.window.webContents.openDevTools({ mode: 'detach', activate: false })
          }
          
    
        this.window.on('close', ()=>{app.quit()}); //TODO

        this.isShown = false;

        ipcMain.on('chat-stop', () =>{this.hide()})

        ipcMain.on('reset-window-position', () =>{this.resetPosition()})

        ipcMain.on('get-conversation-history', (event) => {
            event.reply('conversation-history', this.conversation.getHistory());
        });

        ipcMain.on('reset-window-position', () =>{this.resetPosition()})

        ipcMain.on('get-conversation-history', (event) => {
            event.reply('conversation-history', this.conversation.getHistory());
        });


        
        console.log("Chat window opened!")

        
    }

    show(){
        console.log("Chat window showed!");
        OverlayController.activateOverlay();
        this.isShown = true;

        /*this.windowWatchId = ActiveWindow.subscribe( (winInfo) =>{
            if(winInfo?.title == "Crusader Kings III" && this.isShown ){

                OverlayController.activateOverlay();
                //this.window.webContents.send('chat-show');
                
            }else{
                //this.window.webContents.send('chat-hide');
            }
                
        })*/

        this.interval = setInterval(()=>{
            try {
                let win = ActiveWindow.getActiveWindow();
               // console.log(win.title)

                if(win.title === "Crusader Kings III" || win.title === "Voices of the Court - Community Edition - Chat"){
                    OverlayController.activateOverlay();
                    //this.window.webContents.send('chat-show');
                }else{
                    this.window.minimize();
                    //this.window.webContents.send('chat-hide');
                }
            } catch (err) {
                console.error("Failed to get active window:", err);
            }
        }, 500)

        
    }

    hide(){
        console.log("Chat window hidden!");
        OverlayController.focusTarget();
        this.isShown = false;

        ActiveWindow.unsubscribe(this.windowWatchId);

        clearInterval(this.interval);
    }

    resetPosition(){
        this.window.setPosition(100, 100);
    }
}