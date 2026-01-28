import { app, ipcMain, dialog, autoUpdater, Tray, Menu} from "electron";
import {ConfigWindow} from './windows/ConfigWindow.js';
import {ChatWindow} from './windows/ChatWindow.js';
import {SummaryManagerWindow} from './windows/SummaryManagerWindow.js';
import { ConversationHistoryWindow } from './windows/ConversationHistoryWindow.js';
import { Config } from '../shared/Config.js';
import { ClipboardListener } from "./ClipboardListener.js";
import { Conversation } from "./conversation/Conversation.js";
import { GameData } from "../shared/gameData/GameData.js";
import { LetterReplyGenerator } from "./letter/LetterReplyGenerator.js";
import { parseLog } from "../shared/gameData/parseLog.js";
import { parseLogForBookmarks } from "./parseLogforbookmarks.js";
import { processBookmarkToSummary } from "./bookmarktosummary.js";
import { parseSummaryIdsFromLog, readSummaryFile, saveSummaryFile } from "./summaryManager.js";
import { parseConversationHistoryIdsFromLog, getConversationHistoryFiles, readConversationHistoryFile } from "./conversationHistory.js";
import { Message} from "./ts/conversation_interfaces.js";
import path from 'path';
import fs from 'fs';
import { checkUserData } from "./userDataCheck.js";
import { updateElectronApp } from 'update-electron-app';
import { ReadmeWindow } from './windows/ReadmeWindow.js';
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
let userDataPath: string;

const compareVersions = (v1: string, v2: string): number => {
    const parse = (v: string) => {
        const [main, pre] = v.replace(/^v/, '').split('-');
        const parts = main.split('.').map(Number);
        return { parts, pre };
    };

    const p1 = parse(v1);
    const p2 = parse(v2);

    for (let i = 0; i < Math.max(p1.parts.length, p2.parts.length); i++) {
        const n1 = p1.parts[i] || 0;
        const n2 = p2.parts[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }

    if (!p1.pre && p2.pre) return 1;
    if (p1.pre && !p2.pre) return -1;
    if (p1.pre && p2.pre) {
        return p1.pre.localeCompare(p2.pre, undefined, { numeric: true });
    }

    return 0;
};

const checkGitHubForUpdates = async (manual: boolean = false) => {
    console.log(`Checking for updates (manual: ${manual})...`);
    try {
        const response = await fetch('https://api.github.com/repos/szmania/Voices_of_the_Court/releases');
        if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);
        
        const releases: any[] = await response.json();
        if (!releases || releases.length === 0) return;

        const currentVersion = packagejson.version;
        let latestRelease = null;

        if (config.earlyAccessUpdates) {
            latestRelease = releases[0];
        } else {
            latestRelease = releases.find(r => !r.prerelease);
        }

        if (latestRelease && compareVersions(latestRelease.tag_name, currentVersion) > 0) {
            console.log(`New version found: ${latestRelease.tag_name}`);
            
            const isPreRelease = latestRelease.prerelease;
            const dialogOpts = {
                type: 'info' as const,
                buttons: ['Update Now', 'Later'],
                title: 'Update Available',
                message: `A new version (${latestRelease.tag_name}) is available!`,
                detail: isPreRelease 
                    ? 'A new Early Access version is available. Would you like to update now?' 
                    : 'A new stable version is available. Would you like to update now?'
            };

            const { response: buttonIndex } = await dialog.showMessageBox(dialogOpts);
            if (buttonIndex === 0) {
                autoUpdater.checkForUpdates();
            }
        } else if (manual) {
            dialog.showMessageBox({
                type: 'info',
                title: 'No Updates',
                message: 'You are running the latest version.'
            });
        }
    } catch (err) {
        console.error('Failed to check for updates:', err);
        if (manual) {
            dialog.showErrorBox('Update Check Failed', 'Could not connect to GitHub to check for updates.');
        }
    }
};

const checkForUpdates = () => {
    if (app.isPackaged) {
        checkGitHubForUpdates(true);
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
let summaryManagerWindow: SummaryManagerWindow;
let readmeWindow: ReadmeWindow;
let conversationHistoryWindow: ConversationHistoryWindow;

let clipboardListener = new ClipboardListener();
let config: Config;


app.on('ready',  async () => {
    console.log('App is ready event triggered.');
    userDataPath = path.join(app.getPath('userData'), 'votc_data');

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
        
        // Use custom check to respect earlyAccessUpdates toggle
        checkGitHubForUpdates(false);

        // Still initialize updateElectronApp for background stable updates if not in early access mode
        // or just let checkGitHubForUpdates handle the initial check.
        updateElectronApp({
            repo: 'szmania/Voices_of_the_Court', // Explicitly set repository to fix updater crash
            updateInterval: '1 hour',
            notifyUser: true,
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
    readmeWindow = new ReadmeWindow();
    console.log('ReadmeWindow created.');
    
    // 检查是否是首次启动
    checkFirstRunAndShowReadme();
    
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

// 检查是否是首次启动并显示README窗口
function checkFirstRunAndShowReadme() {
  try {
    const userDataPath = app.getPath('userData');
    const readmePreferencePath = path.join(userDataPath, 'readme_preference.json');
    
    // 检查是否存在README显示偏好设置
    let showReadme = true;
    if (fs.existsSync(readmePreferencePath)) {
      try {
        const preference = JSON.parse(fs.readFileSync(readmePreferencePath, 'utf8'));
        showReadme = preference.showReadme !== false; // 默认为true
      } catch (error) {
        console.error('读取README偏好设置失败:', error);
        showReadme = true;
      }
    }
    
    if (showReadme && readmeWindow) {
      console.log('首次启动，显示README窗口');
      setTimeout(() => {
        readmeWindow.show();
      }, 1000); // 延迟1秒显示，确保主窗口完全加载
    }
  } catch (error) {
    console.error('检查首次启动时出错:', error);
  }
}

ipcMain.on('update-app', ()=>{
    console.log('IPC: Received update-app event.');
    checkForUpdates();
});

// README窗口相关IPC事件
ipcMain.on('close-readme-window', () => {
    console.log('IPC: 关闭README窗口');
    if (readmeWindow && !readmeWindow.isDestroyed()) {
        readmeWindow.close();
    }
});

ipcMain.on('set-readme-preference', (event, showReadme: boolean) => {
    console.log('IPC: 设置README显示偏好为:', showReadme);
    try {
        const userDataPath = app.getPath('userData');
        const readmePreferencePath = path.join(userDataPath, 'readme_preference.json');
        const preference = { showReadme };
        fs.writeFileSync(readmePreferencePath, JSON.stringify(preference, null, 2));
        console.log('README显示偏好已保存');
    } catch (error) {
        console.error('保存README偏好设置失败:', error);
    }
});

ipcMain.on('open-external-link', (event, url: string) => {
      console.log('IPC: 打开外部链接:', url);
      shell.openExternal(url);
  });

  ipcMain.on('open-readme-window', () => {
      console.log('IPC: 打开README窗口');
      if (readmeWindow && !readmeWindow.isDestroyed()) {
          readmeWindow.show();
      } else {
          // 如果窗口不存在或被销毁，重新创建
          readmeWindow = new ReadmeWindow();
          readmeWindow.show();
      }
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

clipboardListener.on('VOTC:BOOKMARK', async () => {
    console.log('ClipboardListener: VOTC:BOOKMARK event detected.');
    try {
        // Wait briefly for log file to update
        await sleep(250);
        
        // Parse the log file for bookmark data
        const logFilePath = path.join(config.userFolderPath, 'logs', 'debug.log');
        console.log(`Parsing log file for bookmark data: ${logFilePath}`);
        
        const bookmarkData = await parseLogForBookmarks(logFilePath);
        if (!bookmarkData) {
            console.error('Failed to parse bookmark data from log file.');
            return;
        }
        
        // Get the selected bookmark script from config
        const bookmarkScriptPath = config.selectedBookmarkScript || 'standard/shaosong.json';
        console.log(`Using bookmark script: ${bookmarkScriptPath}`);
        
        // Process the bookmark data and update conversation summaries
        await processBookmarkToSummary(
            bookmarkData,
            path.join(app.getPath("userData"), 'votc_data'),
            bookmarkScriptPath
        );
        
        console.log('Bookmark processing completed successfully.');
    } catch (error) {
        console.error('Error processing VOTC:BOOKMARK event:', error);
    }
})

clipboardListener.on('VOTC:SUMMARY_MANAGER', async () => {
    console.log('ClipboardListener: VOTC:SUMMARY_MANAGER event detected.');
    try {
        // Create or show the summary manager window
        if (!summaryManagerWindow || summaryManagerWindow.isDestroyed()) {
            summaryManagerWindow = new SummaryManagerWindow();
        }
        
        summaryManagerWindow.show();
        console.log('Summary manager window opened.');
    } catch (error) {
        console.error('Error opening summary manager window:', error);
    }
})

clipboardListener.on('VOTC:CONVERSATION_HISTORY', async () => {
    console.log('ClipboardListener: VOTC:CONVERSATION_HISTORY event detected.');
    try {
        // Create or show the conversation history window
        if (!conversationHistoryWindow || conversationHistoryWindow.isDestroyed()) {
            conversationHistoryWindow = new ConversationHistoryWindow();
        }
        
        conversationHistoryWindow.show();
        console.log('Conversation history window opened.');
    } catch (error) {
        console.error('Error opening conversation history window:', error);
    }
})

clipboardListener.on('VOTC:LETTER', async () => {
    console.log('ClipboardListener: VOTC:LETTER event detected.');
    try {
        const debugLogPath = path.join(config.userFolderPath, 'logs', 'debug.log');
        
        // 解析游戏数据
        const gameData = await parseLog(debugLogPath);
        if (!gameData) {
            console.error('Failed to parse game data from debug.log');
            return;
        }

        // 创建信件回复生成器
        const letterReplyGenerator = new LetterReplyGenerator(config);
        
        // 生成回信并写入文件（新方法会自动处理letterId）
        const replyContent = await letterReplyGenerator.generateLetterReply(gameData, debugLogPath, config.userFolderPath);
        if (!replyContent) {
            console.error('Failed to generate letter reply');
            return;
        }

        console.log('Letter reply generated and written successfully.');
        
    } catch (error) {
        console.error('Error processing VOTC:LETTER event:', error);
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

    // 处理获取推荐输入语句的请求
    ipcMain.on('get-suggestions', async (event) => {
        if (conversation) {
            try {
                const suggestions = await conversation.generateSuggestions();
                event.reply('suggestions-response', suggestions);
            } catch (error) {
                console.error('Error generating suggestions:', error);
                event.reply('suggestions-response', []);
            }
        } else {
            event.reply('suggestions-response', []);
        }
    })



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
    
    // 将配置变更发送到聊天窗口
    if (chatWindow.window) {
        chatWindow.window.webContents.send('config-change', confID, newValue);
    }
})

ipcMain.on('config-change-nested', (e, outerConfID: string, innerConfID: string, newValue: any) =>{
    console.log(`IPC: Received config-change-nested event. Outer ID: ${outerConfID}, Inner ID: ${innerConfID}, New Value: ${newValue}`);
    //@ts-ignore
    const previous = config[outerConfID]?.[innerConfID];
    // Preserve existing API keys when updating the connection block
    if (innerConfID === 'connection' && previous && typeof previous === 'object') {
        if (!newValue.apiKeys && previous.apiKeys) {
            newValue.apiKeys = previous.apiKeys;
        }
    }
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

// Summary Manager IPC handlers
ipcMain.handle('get-summary-ids', async () => {
    console.log('IPC: Received get-summary-ids event.');
    try {
        const logFilePath = path.join(config.userFolderPath, 'logs', 'debug.log');
        const ids = await parseSummaryIdsFromLog(logFilePath);
        return ids;
    } catch (error) {
        console.error('Error getting summary IDs:', error);
        return { playerId: null };
    }
});

ipcMain.handle('read-summary-file', async (event, playerId) => {
    console.log(`IPC: Received read-summary-file event for player: ${playerId}`);
    try {
        const summaryData = await readSummaryFile(playerId);
        return summaryData;
    } catch (error) {
        console.error('Error reading summary file:', error);
        return [];
    }
});

ipcMain.handle('save-summary-file', async (event, playerId, summaryData) => {
    console.log(`IPC: Received save-summary-file event for player: ${playerId}`);
    try {
        await saveSummaryFile(playerId, summaryData);
        return { success: true };
    } catch (error) {
        console.error('Error saving summary file:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

// Conversation History IPC handlers
ipcMain.handle('get-conversation-history-ids', async () => {
    console.log('IPC: Received get-conversation-history-ids event.');
    try {
        const logFilePath = path.join(config.userFolderPath, 'logs', 'debug.log');
        const ids = await parseConversationHistoryIdsFromLog(logFilePath);
        return ids;
    } catch (error) {
        console.error('Error getting conversation history IDs:', error);
        return { playerId: null };
    }
});

ipcMain.handle('get-conversation-history-files', async (event, playerId) => {
    console.log(`IPC: Received get-conversation-history-files event for player: ${playerId}`);
    try {
        const files = await getConversationHistoryFiles(playerId);
        return files;
    } catch (error) {
        console.error('Error getting conversation history files:', error);
        return [];
    }
});

ipcMain.handle('read-conversation-history-file', async (event, playerId, filename) => {
    console.log(`IPC: Received read-conversation-history-file event for player: ${playerId}, file: ${filename}`);
    try {
        const content = await readConversationHistoryFile(playerId, filename);
        return content;
    } catch (error) {
        console.error('Error reading conversation history file:', error);
        return '';
    }
});

// 处理API配置更改事件
ipcMain.on('api-config-change', (e, configType: string, apiType: string, configData: any) => {
    console.log(`IPC: Received api-config-change event. Config Type: ${configType}, API Type: ${apiType}`);
    
    // 确保配置对象存在
    if (!(config as any)[configType]) {
        console.error(`Configuration type ${configType} not found`);
        return;
    }
    
    // 确保connection对象存在
    if (!(config as any)[configType].connection) {
        (config as any)[configType].connection = {};
    }
    
    // 确保apiKeys对象存在
    if (!(config as any)[configType].connection.apiKeys) {
        (config as any)[configType].connection.apiKeys = {};
    }
    
    // 保存API配置到apiKeys对象中
    (config as any)[configType].connection.apiKeys[apiType] = configData;
    
    // 如果是当前选中的API类型，同时更新connection对象中的主要字段
    if ((config as any)[configType].connection.type === apiType) {
        (config as any)[configType].connection.key = configData.key || '';
        (config as any)[configType].connection.baseUrl = configData.baseUrl || '';
        (config as any)[configType].connection.model = configData.model || '';
    }
    
    // 导出配置
    config.export();
    
    // 如果聊天窗口已显示，更新对话配置
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
});

// 处理关闭对话历史窗口的请求
ipcMain.on('close-conversation-history', () => {
    console.log('IPC: Received close-conversation-history event.');
    if (conversationHistoryWindow && !conversationHistoryWindow.isDestroyed()) {
        conversationHistoryWindow.close();
        console.log('Conversation history window closed.');
    }
});

// 处理关闭总结管理器窗口的请求
ipcMain.on('close-summary-manager', () => {
    console.log('IPC: Received close-summary-manager event.');
    if (summaryManagerWindow && !summaryManagerWindow.isDestroyed()) {
        summaryManagerWindow.close();
        console.log('Summary manager window closed.');
    }
});

// 处理主题切换事件
ipcMain.on('theme-changed', (event, theme: string) => {
    console.log(`IPC: Received theme-changed event. Theme: ${theme}`);
    // 通知聊天窗口更新主题
    if (chatWindow && chatWindow.window && !chatWindow.window.isDestroyed()) {
        chatWindow.window.webContents.send('update-theme', theme);
    }
});
