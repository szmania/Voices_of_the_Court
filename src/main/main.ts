import { app, ipcMain, dialog, autoUpdater, Tray, Menu} from "electron";
import {ConfigWindow} from './windows/ConfigWindow.js';
import {ChatWindow} from './windows/ChatWindow.js';
import { Config } from '../shared/Config.js';
import { ClipboardListener } from "./ClipboardListener.js";
import { Conversation } from "./conversation/Conversation.js";
import { GameData } from "../shared/gameData/GameData.js";
import { parseLog } from "../shared/gameData/parseLog.js";
import { Message} from "./ts/conversation_interfaces.js";
import path from 'path';
import fs from 'fs';
import { checkUserData } from "./userDataCheck.js";
const shell = require('electron').shell;
const packagejson = require('../../package.json');


let checkForUpdates = () => {
    // This will be replaced by the real implementation in app.on('ready')
    if (!app.isPackaged) {
        dialog.showMessageBox({
            type: 'info',
            title: 'Updates',
            message: 'Updates are disabled in development mode.'
        });
    }
};

let checkForUpdatesOnStartup = () => {
    // Check if the setting is enabled and then check for updates
    if (config && config.checkForUpdatesOnStartup) {
        checkForUpdates();
    }
};


const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
    app.quit();
    process.exit();
} 
else {
app.on('second-instance', (event, commandLine, workingDirectory) => {
    if(configWindow.window.isDestroyed()){
        configWindow = new ConfigWindow();
    }
    else if(configWindow.window.isMinimized()){
        configWindow.window.focus();
    }
})
}

if (require('electron-squirrel-startup')) {
    app.quit();
}

process.on("rejectionHandled", function(err){
    console.log('=== REJECTION HANDLED ===');
    console.error( err )
});

process.on('uncaughtException', function(err) {
    console.log('=== UNCAUGHT EXCEPTION ===');
    console.log(err);
  });

process.on('unhandledRejection', (error, p) => {
    console.log('=== UNHANDLED REJECTION ===');
    console.log(error);
});

//check config files
const userDataPath = path.join(app.getPath('userData'), 'votc_data');




//updating
if(app.isPackaged){
    const server = packagejson.updater.server;
    const repos = Array.isArray(packagejson.updater.repo) 
        ? packagejson.updater.repo 
        : [packagejson.updater.repo];
    
    let repoIndex = 0;

    const checkNextRepo = () => {
        if (repoIndex >= repos.length) {
            repoIndex = 0; // Reset for next manual check
            const dialogOpts = {
              type: 'info' as const,
              buttons: [],
              title: 'App is up to date!',
              message: "App is up to date!",
              detail: 'no new version was found!'
            }  
            dialog.showMessageBox(dialogOpts);
            return;
        }
        
        const repo = repos[repoIndex];
        console.log(`Checking for updates from ${repo}...`);
        const feed = `${server}/${repo}/${process.platform}-${process.arch}/${app.getVersion()}`;
        //@ts-ignore
        autoUpdater.setFeedURL(feed);
        autoUpdater.checkForUpdates();
    };

    checkForUpdates = () => {
        repoIndex = 0;
        checkNextRepo();
    };

    autoUpdater.on('update-available', () => {
        repoIndex = 0; // Reset for next manual check
        const dialogOpts = {
          type: "info" as const,
          buttons: [],
          title: 'Update found!',
          message: "new version found!",
          detail: 'A new version is available. updating application now...'
        }
      
        dialog.showMessageBox(dialogOpts);
    });

    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
        const dialogOpts = {
          type: 'info' as const,
          buttons: ['Restart', 'Later'],
          title: 'Application Update',
          message: process.platform === 'win32' ? releaseNotes : releaseName,
          detail:
            'A new version has been downloaded. Restart the application to apply the updates.'
        }
      
        dialog.showMessageBox(dialogOpts).then((returnValue) => {
          if (returnValue.response === 0) autoUpdater.quitAndInstall()
        })
    });

    autoUpdater.on('update-not-available', () => {
        repoIndex++;
        checkNextRepo();
    });

    autoUpdater.on('error', (error) => {
        console.error(`Update check failed for repo ${repos[repoIndex]}:`, error);
        repoIndex++;
        if (repoIndex < repos.length) {
            checkNextRepo();
        } else {
            repoIndex = 0; // Reset for next manual check
            const dialogOpts = {
              type: 'info' as const,
              buttons: [],
              title: 'Update error!',
              message: "Something went wrong during updating!",
              detail: 'error message: '+error
            }  
            dialog.showMessageBox(dialogOpts);
        }
    });
}



if(app.isPackaged){
    console.log("product mode")
}else{
    console.log("dev mode")
    require('source-map-support').install();
}





let configWindow: ConfigWindow;
let chatWindow: ChatWindow;

let clipboardListener = new ClipboardListener();
let config: Config;


app.on('ready',  async () => {

   await checkUserData();

    //logging
    var util = require('util');

    var log_file = fs.createWriteStream(path.join(userDataPath, 'logs', 'debug.log'), {flags : 'w'});

    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug
    };

    const logToFile = (prefix: string, message: string) => {
        const time = new Date();
        const currentDate = `[${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}] `;
        
        let sanitizedMessage = message;
        try {
            // Sanitize API keys from log messages to avoid leaking sensitive data.
            // This regex finds keys like `key: 'some-value'` and replaces `some-value` with '********'.
            // It specifically targets non-empty keys to avoid redacting empty key fields.
            const keyPattern = /(key\s*:\s*['"])([^"']+)(['"])/gi;
            sanitizedMessage = sanitizedMessage.replace(keyPattern, `$1********$3`);
        } catch (e) {
            // In case of a regex error, log the original message.
            // This is a safeguard.
            originalConsole.error("Error sanitizing log message:", e);
        }

        log_file.write(currentDate + prefix + sanitizedMessage + '\n');
    };

    console.log = (...args: any[]) => {
        originalConsole.log.apply(console, args);
        logToFile('', util.format(...args));
    };

    console.error = (...args: any[]) => {
        originalConsole.error.apply(console, args);
        logToFile('[ERROR] ', util.format(...args));
    };

    console.warn = (...args: any[]) => {
        originalConsole.warn.apply(console, args);
        logToFile('[WARN] ', util.format(...args));
    };

    console.info = (...args: any[]) => {
        originalConsole.info.apply(console, args);
        logToFile('[INFO] ', util.format(...args));
    };

    console.debug = (...args: any[]) => {
        if(originalConsole.debug){
            originalConsole.debug.apply(console, args);
        }
        else{
            originalConsole.log.apply(console, args);
        }
        logToFile('[DEBUG] ', util.format(...args));
    };

    ipcMain.on('log-message', (event, { level, message }) => {
        const rendererMessage = `[Renderer] ${message}`;
        switch (level) {
            case 'error':
                logToFile('[ERROR] ', rendererMessage);
                break;
            case 'warn':
                logToFile('[WARN] ', rendererMessage);
                break;
            case 'info':
                logToFile('[INFO] ', rendererMessage);
                break;
            case 'debug':
                logToFile('[DEBUG] ', rendererMessage);
                break;
            default:
                logToFile('', rendererMessage); // for console.log
                break;
        }
    });

    console.log(`app version: ${packagejson.version}`)

   let tray = new Tray(path.join(__dirname, '..', '..', 'build', 'icons', 'icon.ico'));
   const contextMenu = Menu.buildFromTemplate([
    { label: 'Open config window',
        click: () => { 
            if(configWindow.window.isDestroyed()){
                configWindow = new ConfigWindow();
            }
            else if(configWindow.window.isMinimized()){
                configWindow.window.focus();
            }
          }
    },
    { label: 'Check for updates..',
        click: () => { 
            checkForUpdates();
          }
    },
    { label: 'Check for updates on startup',
        checked: config?.checkForUpdatesOnStartup !== false, // default to true
        click: (menuItem) => {
            if (config) {
                config.checkForUpdatesOnStartup = menuItem.checked;
                config.export();
            }
        }
    },
    { label: 'Exit', 
        click: () => { 
            app.quit();
      }},
    ])
    tray.setToolTip('Voices of the Court CK3 mod')
    tray.setContextMenu(contextMenu)

    tray.on('click', ()=>{
        if(configWindow.window.isDestroyed()){
            configWindow = new ConfigWindow();
        }
        else if(configWindow.window.isMinimized()){
            configWindow.window.focus();
        }
    })

    

    console.log("App ready!");


    configWindow = new ConfigWindow();
    chatWindow = new ChatWindow();

    if (!app.isPackaged) {
        // Open DevTools for config window
        configWindow.window.webContents.openDevTools({ mode: 'detach' });

        // Open DevTools for chat window
        chatWindow.window.webContents.openDevTools({ mode: 'detach' });
    }
    
    chatWindow.window.on('closed', () =>{app.quit()});

    clipboardListener.start();


    if (!fs.existsSync(path.join(userDataPath, 'configs', 'config.json'))){
        let conf = await JSON.parse(fs.readFileSync(path.join(userDataPath, 'configs', 'default_config.json')).toString());
        await fs.writeFileSync(path.join(userDataPath, 'configs', 'config.json'), JSON.stringify(conf, null, '\t'))
    }
    
    config = new Config(path.join(userDataPath, 'configs', 'config.json'));


    configWindow.window.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    }) 

    // Check for updates on startup if enabled
    if (app.isPackaged) {
        setTimeout(() => {
            checkForUpdatesOnStartup();
        }, 3000); // Delay to allow config to be loaded
    }
   
});

ipcMain.on('update-app', ()=>{
    checkForUpdates();
});

ipcMain.on('clear-summaries', ()=>{
    const dialogOpts = {
        type: 'question' as const,
        buttons: ['Yes', 'No'],
        title: 'Clear summaries',
        message: "Are you sure you want to clear conversation summaries?",
      }
    
      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0){
            const remPath = path.join(userDataPath, 'conversation_summaries');

            fs.readdir(remPath, (err, files) => {
                if (err) throw err;

                for(const file of files){
                    fs.rmSync(path.join(remPath, file), { recursive: true, force: true });
                }

                
            })
        }
      })
})

let conversation: Conversation;

clipboardListener.on('VOTC:IN', async () =>{
    chatWindow.show();
    chatWindow.window.webContents.send('chat-show');
    try{ 
        console.log("Parsing log for new conversation...");
        const logFilePath = path.join(config.userFolderPath, 'logs', 'debug.log');
        const gameData = await parseLog(logFilePath);
        if (!gameData || !gameData.playerID) {
          throw new Error(`Failed to parse game data from log file. Could not find "VOTC:IN" data in ${logFilePath}. Make sure the user folder path is set correctly in the config and the log file exists and is not empty. This is most likely a mod conflict.`);
        }
        // Prevent the user from talking to themselves
        if (gameData.playerID === gameData.aiID) {
            const errorMessage = "Talking to yourself is a conversation best had in your own head, not in the chat window. This feature is not supported.";
            console.error(errorMessage);
            chatWindow.window.webContents.send('error-message', errorMessage);
            return; // Stop the conversation from initializing
        }

        console.log("New conversation started!");
        conversation = new Conversation(gameData, config, chatWindow);
        chatWindow.window.webContents.send('chat-start', conversation.gameData);
        
    }catch(err){
        console.log("==VOTC:IN ERROR==");
        console.log(err);

        if(chatWindow.isShown){
            chatWindow.window.webContents.send('error-message', err);
        }
    }
})

clipboardListener.on('VOTC:EFFECT_ACCEPTED', async () =>{
    if(conversation){
        conversation.runFileManager.clear();
    }
    
})

//IPC 

ipcMain.on('message-send', async (e, message: Message) =>{
    conversation.pushMessage(message);
    try{
        conversation.generateAIsMessages();
    }
    catch(err){
        console.log(err);
        chatWindow.window.webContents.send('error-message', err);
    }
    
    
    
});



ipcMain.handle('get-config', () => {return config});

ipcMain.handle('get-userdata-path', () => {return path.join(app.getPath("userData"), 'votc_data')});


ipcMain.on('config-change', (e, confID: string, newValue: any) =>{
    //@ts-ignore
    config[confID] = newValue;
    config.export();
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
    
})

ipcMain.on('config-change-nested', (e, outerConfID: string, innerConfID: string, newValue: any) =>{
    //@ts-ignore
    config[outerConfID][innerConfID] = newValue;
    config.export();
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
})

//dear god...
ipcMain.on('config-change-nested-nested', (e, outerConfID: string, middleConfID: string, innerConfID: string, newValue: any) =>{
    //@ts-ignore
    config[outerConfID][middleConfID][innerConfID] = newValue;
    config.export();
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
})


ipcMain.on('chat-stop', () =>{
    chatWindow.hide();

    if(conversation && conversation.isOpen){
        conversation.summarize();
    }
    
})


ipcMain.on("select-user-folder", (event) => {
    dialog.showOpenDialog(configWindow.window, { properties: ['openDirectory']}).then( (resp) =>{
        event.reply("select-user-folder-success", resp.filePaths[0]);
    });
});

ipcMain.on("open-folder", (event, path) => {
    dialog.showSaveDialog(configWindow.window, { defaultPath: path, properties: []});
});
