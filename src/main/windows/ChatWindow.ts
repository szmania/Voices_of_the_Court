
import {  app, BrowserWindow, ipcMain, screen} from "electron";
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
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.bounds;

        this.window = new BrowserWindow({
            ...OVERLAY_WINDOW_OPTS,
            // 【新增】：如果是 Mac，强制使用 panel 类型
            type: process.platform === 'darwin' ? 'panel' : undefined,
            fullscreenable: false,
            transparent: true,
            resizable: true,
            frame: false, // 确保没有系统边框
            width: width,
            height: height,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                preload: path.join(__dirname, '..', 'preload.js'),
            }       
        })

        // 【新增】：Mac 专属，强行刺穿全屏 Space 的屏障
        if (process.platform === 'darwin') {
            this.window.setAlwaysOnTop(true, 'screen-saver', 1);
            this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            this.window.setIgnoreMouseEvents(false);
        }

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

                // 检查是否是游戏或者聊天窗口本身
                const isGameActive = win.title === "Crusader Kings III";
                const isChatActive = win.title === "Voices of the Court 2.0 - Community Edition - Chat";
                const isConfigActive = win.title === "Voices of the Court 2.0 - Community Edition";

                if (isGameActive || isChatActive || isConfigActive) {
                    OverlayController.activateOverlay();
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
        // Window position is managed by OverlayController to match the game window.
        // We only need to reset the internal div position which is handled in the renderer.
        console.log("Resetting chat window position (internal div)...");
    }
}
