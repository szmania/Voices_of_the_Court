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
import { updateElectronApp } from 'update-electron-app';
const shell = require('electron').shell;
const packagejson = require('../../package.json');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
    console.log('Another instance of the application is already running. Quitting this instance.');
    app.quit();
    process.exit();
} 
else {
app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('Second instance detected. Focusing the existing window.');
    if(configWindow.window.isDestroyed()){
        configWindow = new ConfigWindow();
    }
    else if(configWindow.window.isMinimized()){
        configWindow.window.focus();
    }
})
}

if (require('electron-squirrel-startup')) {
    console.log('Squirrel startup event detected. Quitting application.');
    app.quit();
}

process.on("rejectionHandled", function(err){
    console.log('=== REJECTION HANDLED ===');
    console.error( err )
});

process.on('uncaughtException', function(err) {
    console.log('=== UNCAUGHT EXCEPTION ===');
    console.error(err); // Changed from console.log(err)
  });

process.on('unhandledRejection', (error, p) => {
    console.log('=== UNHANDLED REJECTION ===');
    console.error(error); // Changed from console.log(error)
});

//check config files
const userDataPath = path.join(app.getPath('userData'), 'votc_data');




const checkForUpdates = () => {
    if (app.isPackaged) {
        console.log('Manual update check triggered.');
        autoUpdater.checkForUpdates();
    } else {
        console.log('Update check skipped in development mode.');
        dialog.showMessageBox({
            type: 'info',
            title: 'Updates',
            message: 'Updates are disabled in development mode.'
        });
    }
};



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
    console.log('App is ready event triggered.');

   await checkUserData();
   console.log('User data check completed.');

    // Relocated config loading to happen earlier
    if (!fs.existsSync(path.join(userDataPath, 'configs', 'config.json'))){
        let conf = await JSON.parse(fs.readFileSync(path.join(userDataPath, 'configs', 'default_config.json')).toString());
        await fs.writeFileSync(path.join(userDataPath, 'configs', 'config.json'), JSON.stringify(conf, null, '\t'))
    }
    
    config = new Config(path.join(userDataPath, 'configs', 'config.json'));
    console.log('Configuration loaded successfully.');


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
    console.log(`Repository: ${packagejson.repository}`);

    // Conditional automatic update check based on config
    if (app.isPackaged && config.checkForUpdatesOnStartup) {
        console.log('Initializing automatic update check on startup...');
        updateElectronApp({
            repo: 'szmania/Voices_of_the_Court', // Explicitly set repository to fix updater crash
            logger: {
                info: (message) => console.info(`[Updater] ${message}`),
                warn: (message) => console.warn(`[Updater] ${message}`),
                error: (message) => console.error(`[Updater] ${message}`),
                log: (message) => console.debug(`[Updater] ${message}`),
            }
        });
    } else if (app.isPackaged) {
        console.log('Automatic update check on startup is disabled in config.');
    } else {
        console.log('Update checks are skipped in development mode.');
    }

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
    { label: 'Exit', 
        click: () => { 
            app.quit();
      }},
    ])
    tray.setToolTip('Voices of the Court CK3 mod')
    tray.setContextMenu(contextMenu)
    console.log('Tray icon and context menu created.');

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
    console.log('ConfigWindow created.');
    chatWindow = new ChatWindow();
    console.log('ChatWindow created.');

    
    chatWindow.window.on('closed', () =>{
        console.log('Chat window closed. Quitting application.');
        app.quit()
    });

    clipboardListener.start();
    console.log('ClipboardListener started.');


    configWindow.window.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    }) 
   
});

ipcMain.on('update-app', ()=>{
    console.log('IPC: Received update-app event.');
    checkForUpdates();
});

ipcMain.on('clear-summaries', ()=>{
    console.log('IPC: Received clear-summaries event.');
    const dialogOpts = {
        type: 'question' as const,
        buttons: ['Yes', 'No'],
        title: 'Clear summaries',
        message: "Are you sure you want to clear conversation summaries?",
      }
    
      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        console.log(`User chose to ${returnValue.response === 0 ? 'confirm' : 'cancel'} clearing summaries.`);
        if (returnValue.response === 0){
            const remPath = path.join(userDataPath, 'conversation_summaries');

            fs.readdir(remPath, (err, files) => {
                if (err) throw err;

                for(const file of files){
                    const filePath = path.join(remPath, file);
                    fs.rmSync(filePath, { recursive: true, force: true });
                    console.log(`Removed summary file: ${filePath}`);
                }

                
            })
        }
      })
})

let conversation: Conversation;

clipboardListener.on('VOTC:IN', async () =>{
    console.log('ClipboardListener: VOTC:IN event detected. Showing chat window.');
    chatWindow.show();
    chatWindow.window.webContents.send('chat-show');
    try{ 
        console.log("Waiting briefly for log file to update...");
        await sleep(250);

        console.log("Parsing log for new conversation...");
        const logFilePath = path.join(config.userFolderPath, 'logs', 'debug.log');
        console.log(`Game log file path: ${logFilePath}`);
        const gameData = await parseLog(logFilePath);
        if (!gameData || !gameData.playerID) {
          throw new Error(`Failed to parse game data from log file. Could not find "VOTC:IN" data in ${logFilePath}. Make sure the user folder path is set correctly in the config and the log file exists and is not empty. This is most likely a mod conflict.`);
        }

        console.log("New conversation started!");
        conversation = new Conversation(gameData, config, chatWindow);
        chatWindow.window.webContents.send('chat-start', conversation.gameData);
        
    }catch(err){
        console.log("==VOTC:IN ERROR==");
        console.error(err); // Changed from console.log(err)

        if(chatWindow.isShown){
            chatWindow.window.webContents.send('error-message', err);
        }
    }
})

clipboardListener.on('VOTC:EFFECT_ACCEPTED', async () =>{
    console.log('ClipboardListener: VOTC:EFFECT_ACCEPTED event detected.');
    if(conversation){
        conversation.runFileManager.clear();
        console.log('Conversation active, run file manager cleared.');
    } else {
        console.warn('VOTC:EFFECT_ACCEPTED received but no active conversation.');
    }
    
})

//IPC 

ipcMain.on('message-send', async (e, message: Message) =>{
    console.log('IPC: Received message-send event with message:', message.content);
    conversation.pushMessage(message);
    try{
        conversation.generateAIsMessages();
    }
    catch(err){
        console.error(err); // Changed from console.log(err)
        chatWindow.window.webContents.send('error-message', err);
    }
    
    
    
});



ipcMain.handle('get-config', () => {
    console.log('IPC: Received get-config event.');
    return config
});

ipcMain.handle('get-userdata-path', () => {
    console.log('IPC: Received get-userdata-path event.');
    return path.join(app.getPath("userData"), 'votc_data')
});


ipcMain.on('config-change', (e, confID: string, newValue: any) =>{
    console.log(`IPC: Received config-change event. ID: ${confID}, New Value: ${newValue}`);
    //@ts-ignore
    config[confID] = newValue;
    config.export();
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
    
})

ipcMain.on('config-change-nested', (e, outerConfID: string, innerConfID: string, newValue: any) =>{
    console.log(`IPC: Received config-change-nested event. Outer ID: ${outerConfID}, Inner ID: ${innerConfID}, New Value: ${newValue}`);
    //@ts-ignore
    config[outerConfID][innerConfID] = newValue;
    config.export();
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
})

//dear god...
ipcMain.on('config-change-nested-nested', (e, outerConfID: string, middleConfID: string, innerConfID: string, newValue: any) =>{
    console.log(`IPC: Received config-change-nested-nested event. Outer ID: ${outerConfID}, Middle ID: ${middleConfID}, Inner ID: ${innerConfID}, New Value: ${newValue}`);
    //@ts-ignore
    config[outerConfID][middleConfID][innerConfID] = newValue;
    config.export();
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
})

ipcMain.on('chat-stop', () =>{
    console.log('IPC: Received chat-stop event.');
    chatWindow.hide();

    if(conversation && conversation.isOpen){
        conversation.summarize();
    }
    
})


ipcMain.on("select-user-folder", (event) => {
    console.log('IPC: Received select-user-folder event.');
    dialog.showOpenDialog(configWindow.window, { properties: ['openDirectory']}).then( (resp) =>{
        if (resp.filePaths && resp.filePaths.length > 0) {
            console.log(`User selected folder: ${resp.filePaths[0]}`);
        } else {
            console.log('User canceled folder selection.');
        }
        event.reply("select-user-folder-success", resp.filePaths[0]);
    });
});

ipcMain.on("open-folder", (event, path) => {
    console.log(`IPC: Received open-folder event for path: ${path}`);
    dialog.showSaveDialog(configWindow.window, { defaultPath: path, properties: []});
});
