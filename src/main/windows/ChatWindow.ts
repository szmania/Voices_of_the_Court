
import {  app, BrowserWindow, ipcMain, screen} from "electron";
import { OverlayController, OVERLAY_WINDOW_OPTS } from 'electron-overlay-window';
import path from 'path';

// Do not import @paymoapp/active-window on Linux. Loading it calls XSetErrorHandler()
// at require() time (inside the native addon's Init function), which replaces
// Electron/Chromium's global X11 error handler process-wide and silently breaks
// clipboard.readText() in the main process.
let ActiveWindow: any = null;
if (process.platform !== 'linux') {
    ActiveWindow = require('@paymoapp/active-window').default;
    ActiveWindow.initialize();
}

export class ChatWindow{
    window: BrowserWindow;
    conversation: any;
    isShown: boolean;
    windowWatchId: number;
    interval: any;
    lastGameWindowActive: boolean = false;


    constructor(){
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.bounds;

        this.window = new BrowserWindow({
            ...OVERLAY_WINDOW_OPTS,
            // 【新增】：如果是 Mac，强制使用 panel 类型
            type: process.platform === 'darwin' ? 'panel' : undefined,
            fullscreenable: false,
            transparent: true,
            alwaysOnTop: true,
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

        this.interval = setInterval(()=>{
            try {
                if (!ActiveWindow) return;
                let win = ActiveWindow.getActiveWindow();

                // 检查是否是游戏或者聊天窗口本身
                const isGameActive = win.title === "Crusader Kings III";
                const isChatActive = win.title === "Voices of the Court 2.0 - Community Edition - Chat";
                const isConfigActive = win.title === "Voices of the Court 2.0 - Community Edition";

                const isGameOrChatOrConfigActive = isGameActive || isChatActive || isConfigActive;

                // When game window gains focus, show chat window
                if (isGameActive && !this.lastGameWindowActive) {
                    this.showWindow();
                }
                // When game window loses focus, hide chat window (unless chat/config window is gaining focus)
                else if (!isGameActive && this.lastGameWindowActive && !isChatActive && !isConfigActive) {
                    this.hideWindow();
                }

                this.lastGameWindowActive = isGameActive;
            } catch (err) {
                console.error("Failed to get active window:", err);
            }
        }, 500)

        this.isShown = false;

        ipcMain.on('chat-stop', () =>{this.hide()})

        ipcMain.on('reset-window-position', () =>{this.resetPosition()})

        ipcMain.on('get-conversation-history', (event) => {
            if (this.conversation) {
                event.reply('conversation-history', this.conversation.getHistory());
            }
        });


        
        console.log("Chat window opened!")

        
        if (!this.isShown) {
            console.log("Chat window showed via focus listener!");
            OverlayController.activateOverlay();
            this.window.show();
            this.isShown = true;
        }
    }
    showWindow() {
        if (!this.isShown) {
            console.log("Chat window showed via focus listener!");
            this.window.show();
            this.isShown = true;
        }
    }

    hideWindow() {
        if (this.isShown) {
            console.log("Chat window hidden via focus listener!");
            this.window.hide();
            this.isShown = false;
        }
    }
    show(){
        console.log("Chat window showed!");
        this.showWindow();

        // Send the show event after a short delay to ensure the renderer is ready
        setTimeout(() => {
            if (this.window && !this.window.isDestroyed()) {
                this.window.webContents.send('chat-show');
            }
        }, 150);

        /*this.windowWatchId = ActiveWindow.subscribe( (winInfo) =>{
            if(winInfo?.title == "Crusader Kings III" && this.isShown ){

                OverlayController.activateOverlay();
                //this.window.webContents.send('chat-show');
                
            }else{
                //this.window.webContents.send('chat-hide');
            }
                
        })*/

    }

    hide(){
        console.log("Chat window hidden!");
        this.hideWindow();
        OverlayController.focusTarget();
        this.isShown = false;
    }

    resetPosition(){
        // Window position is managed by OverlayController to match the game window.
        // We only need to reset the internal div position which is handled in the renderer.
        console.log("Resetting chat window position (internal div)...");
    }
}
