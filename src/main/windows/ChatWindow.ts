
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

// 'pending': OverlayController has not attached to the game window yet.
// 'overlay': it attached; the library positions, shows and hides this window.
// 'plain':   it never attached before the first conversation, so this window is
//            shown as a regular always-on-top window instead.
type OverlayMode = 'pending' | 'overlay' | 'plain';

export class ChatWindow{
    window: BrowserWindow;
    conversation: any;
    isShown: boolean;
    windowWatchId: number;
    interval: any;
    overlayMode: OverlayMode;
    // 'blur' listeners that attachByTitle() adds to this.window. They hide the window
    // whenever the library thinks the game is not focused, which is always the case
    // if it never attached, so plain mode removes them.
    private overlayBlurListeners: Array<(...args: any[]) => void>;


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
    
        this.overlayMode = 'pending';
        OverlayController.events.on('attach', () => this.onOverlayAttach());

        const blurListenersBefore = this.window.listeners('blur');
        OverlayController.attachByTitle(
            this.window,
            'Crusader Kings III',
          )
        this.overlayBlurListeners = this.window.listeners('blur')
            .filter(listener => !blurListenersBefore.includes(listener)) as Array<(...args: any[]) => void>;

          if(!app.isPackaged){
            this.window.webContents.openDevTools({ mode: 'detach', activate: false })
          }
          
    
        this.window.on('close', ()=>{app.quit()}); //TODO

        this.isShown = false;

        ipcMain.on('chat-stop', () =>{this.hide()})

        ipcMain.on('reset-window-position', () =>{this.resetPosition()})

        ipcMain.on('get-conversation-history', (event) => {
            if (this.conversation) {
                event.reply('conversation-history', this.conversation.getHistory());
            }
        });


        
        console.log("Chat window opened!")

        
    }

    show(){
        console.log("Chat window showed!");

        // Conversations are started from inside CK3, so the game has already been in the
        // foreground. If the overlay still hasn't attached, it isn't going to (e.g. under
        // Wine/Proton), and activateOverlay() would focus a window the library keeps hidden.
        if (this.overlayMode === 'pending') {
            this.enterPlainMode();
        }

        if (this.overlayMode === 'overlay') {
            OverlayController.activateOverlay();
        } else {
            this.showPlain();
        }
        this.isShown = true;

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

        if (this.overlayMode === 'overlay') {
            this.startForegroundWatch();
        }
    }

    // Keeps the overlay active while the game or one of our windows is in the foreground.
    // Only meaningful in overlay mode.
    private startForegroundWatch(){
        clearInterval(this.interval);
        this.interval = setInterval(()=>{
            try {
                if (!ActiveWindow) return;
                let win = ActiveWindow.getActiveWindow();

                // 检查是否是游戏或者聊天窗口本身
                const isGameActive = win.title === "Crusader Kings III";
                const isChatActive = win.title === "Voices of the Court 2.0 - Community Edition - Chat";
                const isConfigActive = win.title === "Voices of the Court 2.0 - Community Edition";

                if (isGameActive || isChatActive || isConfigActive) {
                    OverlayController.activateOverlay();
                } else {
                    // This block is intentionally left empty to prevent the window from hiding.
                    // With --disable-gpu, the window might become invisible without this.
                    if (this.window && !this.window.isDestroyed() && !this.window.isVisible()) {
                        this.window.showInactive();
                    }
                }
            } catch (err) {
                // console.error("Failed to get active window:", err);
            }
        }, 250)
    }

    private onOverlayAttach(){
        if (this.overlayMode === 'overlay') return;

        const wasPlain = this.overlayMode === 'plain';
        this.overlayMode = 'overlay';
        console.log("Chat window: overlay attached to 'Crusader Kings III'.");

        if (wasPlain) {
            // Attached late: hand the window back to OverlayController.
            for (const listener of this.overlayBlurListeners) {
                this.window.on('blur', listener);
            }
            if (this.isShown) {
                OverlayController.activateOverlay();
                this.startForegroundWatch();
            }
        }
    }

    private enterPlainMode(){
        this.overlayMode = 'plain';
        console.warn("Chat window: overlay never attached to 'Crusader Kings III'; falling back to a plain always-on-top window.");
        for (const listener of this.overlayBlurListeners) {
            this.window.removeListener('blur', listener);
        }
    }

    private showPlain(){
        this.window.setIgnoreMouseEvents(false);
        this.window.show();
        this.window.setAlwaysOnTop(true, 'screen-saver');
    }

    hide(){
        console.log("Chat window hidden!");
        if (this.overlayMode === 'overlay') {
            OverlayController.focusTarget();
        } else {
            this.window.hide();
        }
        this.isShown = false;

        if (ActiveWindow) ActiveWindow.unsubscribe(this.windowWatchId);

        clearInterval(this.interval);
    }

    resetPosition(){
        // Window position is managed by OverlayController to match the game window.
        // We only need to reset the internal div position which is handled in the renderer.
        console.log("Resetting chat window position (internal div)...");
    }
}
