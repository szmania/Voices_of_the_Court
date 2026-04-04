
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
                let isGameActive = win.title === "Crusader Kings III" || win.title === "Voices of the Court 2.0 - Community Edition - Chat";

                // 【修复】：在 Mac 全屏下，有时候 win.title 可能为空或者无法获取，
                // 如果直接 minimize 会导致窗口永远弹不出来。
                // 我们加一个判断，如果是 Mac 平台，就不那么激进地 minimize
                if(isGameActive){
                    OverlayController.activateOverlay();
                    //this.window.webContents.send('chat-show');
                }else{
                    // 只有在 Windows 上，或者明确知道切到了别的应用时才最小化
                    if (process.platform !== 'darwin') {
                        this.window.minimize();
                    } else {
                        // 在 Mac 上，与其最小化，不如暂时隐藏或者直接不管，
                        // 因为 panel 类型的窗口不会干扰 Mac 本身的操作。
                        // 如果你希望切出游戏时聊天框不挡视线，可以用 this.window.hide() 代替 minimize
                        if (this.isShown) {
                           // this.window.hide(); // 你可以取消注释这行来测试效果
                        }
                    }
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
