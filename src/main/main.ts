import { app, ipcMain, dialog, autoUpdater, Tray, Menu, BrowserWindow} from "electron";
import {ConfigWindow} from './windows/ConfigWindow.js';
import {ChatWindow} from './windows/ChatWindow.js';
import {SummaryManagerWindow} from './windows/SummaryManagerWindow.js';
import { ConversationHistoryWindow } from './windows/ConversationHistoryWindow.js';
import { Config } from '../shared/Config.js';
import { DiaryGenerator } from './diary/DiaryGenerator.js';
import { ClipboardListener } from "./ClipboardListener.js";
import { Conversation } from "./conversation/Conversation.js";
import { GameData } from "../shared/gameData/GameData.js";
import { Letter } from "./letter/Letter.js";
import { StoredLetter } from "./letter/letterInterfaces.js";
import { LetterReplyGenerator } from "./letter/LetterReplyGenerator.js";
import { LetterManager } from "./letter/LetterManager.js";
import { parseLog } from "../shared/gameData/parseLog.js";
import { parseLettersFromLog } from "./letter/parseLogForLetters.js";
import { parseLogForBookmarks } from "./parseLogforbookmarks.js";
import { processBookmarkToSummary } from "./bookmarktosummary.js";
import { getPlayerId, getAllPlayerIds, readSummaryFile, saveSummaryFile, readCharacterMap } from "./summaryManager.js";
import { parseDiaryIdsFromLog, getAllDiaryPlayerIds, getDiaryFiles, readDiaryFile, saveDiaryFile, getCharacterMap as getDiaryCharacterMap, readDiarySummaries, saveDiarySummaries, getAllDiarySummaries } from "./diaryManager.js";
import { getConversationHistoryFiles, readConversationHistoryFile } from "./conversationHistory.js";
import { readPromptHistory, savePromptHistory } from "./promptHistory.js";
import { Message, ActionResponse } from "./ts/conversation_interfaces.js";
import { ActionEffectWriter } from "./conversation/ActionEffectWriter.js";
import path from 'path';
import fs from 'fs';
import { randomUUID } from "crypto";
import { checkUserData } from "./userDataCheck.js";
import { updateElectronApp } from 'update-electron-app';
import { ReadmeWindow } from './windows/ReadmeWindow.js';
const shell = require('electron').shell;
const packagejson = require('../../package.json');

let translations: any = {};
const loadTranslations = (lang: string) => {
    try {
        const localePath = path.join(__dirname, '..', '..', 'public', 'locales', `${lang}.json`);
        translations = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    } catch (err) {
        console.error(`Failed to load translations for ${lang}:`, err);
    }
};

const t = (key: string, variables: any = {}) => {
    let text = key.split('.').reduce((obj, i) => (obj ? obj[i] : null), translations) || key;
    Object.keys(variables).forEach(v => {
        text = text.replace(`{${v}}`, variables[v]);
    });
    return text;
};

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

            const dialogOpts = {
                type: 'info' as const,
                buttons: [t('dialog.update_now'), t('dialog.later')],
                title: t('dialog.update_title'),
                message: t('dialog.update_message', { version: latestRelease.tag_name }),
                detail: latestRelease.prerelease
                    ? t('dialog.early_access_detail')
                    : t('dialog.stable_detail')
            };

            const { response: buttonIndex } = await dialog.showMessageBox(dialogOpts);
            if (buttonIndex === 0) {
                autoUpdater.checkForUpdates();
            }
        } else if (manual) {
            dialog.showMessageBox({
                type: 'info',
                title: t('dialog.no_updates_title'),
                message: t('dialog.no_updates_message')
            });
        }
    } catch (err) {
        console.error('Failed to check for updates:', err);
        if (manual) {
            dialog.showErrorBox(t('dialog.update_failed_title'), t('dialog.update_failed_message'));
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
            title: t('dialog.dev_updates_title'),
            message: t('dialog.dev_updates_message')
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

let tray: Tray;
const createTray = () => {
    if (tray) tray.destroy();
    
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.icns';
    
    const iconPath = path.join(app.getAppPath(), 'build', 'icons', iconName);
    
    try {
        tray = new Tray(iconPath);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: t('tray.open_config'),
                click: () => {
                    if(configWindow.window.isDestroyed()){
                        configWindow = new ConfigWindow();
                    }
                    else if(configWindow.window.isMinimized()){
                        configWindow.window.focus();
                    }
                }
            },
            {
                label: t('tray.check_updates'),
                click: () => {
                    checkForUpdates();
                }
            },
            {
                label: t('tray.exit'),
                click: () => {
                    app.quit();
                }
            },
        ]);

        tray.setToolTip(t('tray.tooltip'));
        tray.setContextMenu(contextMenu);

        tray.on('click', ()=>{
            if(configWindow.window.isDestroyed()){
                configWindow = new ConfigWindow();
            }
            else if(configWindow.window.isMinimized()){
                configWindow.window.focus();
            }
        });
    } catch (error) {
        console.error("Failed to create tray icon:", error);
    }
};

let clipboardListener = new ClipboardListener();
let config: Config;
let diaryGenerator: DiaryGenerator;

let letterThreadCount = 0;
let letterThreadFullNotified = false;


let currentTotalDays: number = 0;
const storedLetters: Map<string, StoredLetter> = new Map();
let lastLetterSentToGame: StoredLetter | null = null;
let lastLetterSentToGameTime: number = 0;
const LETTER_DELIVERY_TIMEOUT_MS = 60_000; // 60 seconds — if no VOTC:LETTER_ACCEPTED, assume delivery failed


function rehydratePendingReplyLetters(playerId: string): void {
    const letterManager = LetterManager.getInstance();
    const allLetters = letterManager.getAllLetters(playerId);

    const pendingReplies = allLetters.filter(l =>
        !l.isPlayerSender &&
        l.status === 'pending' &&
        l.delivered === false &&
        l.replyToId
    );

    let rehydratedCount = 0;
    for (const reply of pendingReplies) {
        if (storedLetters.has(reply.replyToId!)) continue;

        const original = allLetters.find(l => l.id === reply.replyToId);
        if (!original) {
            console.warn(`rehydratePendingReplyLetters: Could not find original letter ${reply.replyToId} for pending reply ${reply.id}`);
            continue;
        }

        const expectedDeliveryDay = original.totalDays + original.delay;
        storedLetters.set(original.id, {
            letter: reply,
            originalLetter: original,
            expectedDeliveryDay
        });
        rehydratedCount++;
        console.log(`rehydratePendingReplyLetters: Re-queued reply for letter ${original.id}, expectedDeliveryDay: ${expectedDeliveryDay}`);
    }

    if (rehydratedCount > 0) {
        console.log(`rehydratePendingReplyLetters: Re-hydrated ${rehydratedCount} pending letter replies.`);
        checkAndDeliverLetters();
    }
}

async function checkAndDeliverLetters() {
    const letterManager = LetterManager.getInstance();

    // If a previous delivery never got VOTC:LETTER_ACCEPTED, unblock after the timeout.
    if (lastLetterSentToGame && Date.now() - lastLetterSentToGameTime > LETTER_DELIVERY_TIMEOUT_MS) {
        console.warn(`Letter delivery timed out for letter ${lastLetterSentToGame.originalLetter.id} — no VOTC:LETTER_ACCEPTED received. Clearing to allow future deliveries.`);
        lastLetterSentToGame = null;
    }

    // Use a copy of keys to allow modification during iteration
    const letterIds = Array.from(storedLetters.keys());
    for (const letterId of letterIds) {
        const storedLetter = storedLetters.get(letterId);
        // Only deliver one letter at a time, and only if another isn't already waiting for game confirmation
        if (storedLetter && !lastLetterSentToGame && currentTotalDays >= storedLetter.expectedDeliveryDay) {
            console.log(`Sending letter reply for ${letterId} to game (current: ${currentTotalDays}, expected: ${storedLetter.expectedDeliveryDay})`);

            const gameData = await parseLog(path.join(config.userFolderPath, 'logs', 'debug.log'));
            if (!gameData) {
                console.error(`Could not parse game data during letter delivery for letter ${letterId}.`);
                continue;
            }
            const currentDateString = gameData.date;

            // The letter is being sent to the game, but not yet confirmed as delivered.
            letterManager.deliverLetter(storedLetter, config, currentDateString);
            lastLetterSentToGame = storedLetter; // Track the letter sent
            lastLetterSentToGameTime = Date.now();
            storedLetters.delete(letterId); // Remove from pending queue

            // Since the mod probably handles one at a time, break after sending one.
            break;
        }
    }
}

function totalDaysToDateString(totalDays: number): string {
    const year = Math.floor(totalDays / 365);
    const dayOfYear = (totalDays % 365) + 1; // 1-indexed day

    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let day = dayOfYear;
    let month = 1;

    for (let i = 0; i < monthDays.length; i++) {
        if (day <= monthDays[i]) {
            month = i + 1;
            break;
        }
        day -= monthDays[i];
    }

    // Returns "867.10.22"
    return `${year}.${month.toString().padStart(2, '0')}.${day.toString().padStart(2, '0')}`;
}

function removeLettersAfterDate(cutoffDate: number): void {
    const lettersToRemove: string[] = [];

    for (const [letterId, storedLetter] of storedLetters.entries()) {
      // The timestamp for when the reply was generated is the `totalDays` of the original letter.
      if (storedLetter.letter.totalDays > cutoffDate) {
        lettersToRemove.push(letterId);
      }
    }

    for (const letterId of lettersToRemove) {
      console.log(`Removing pending letter ${letterId} due to time travel.`);
      storedLetters.delete(letterId);
    }
}

function updateCurrentDate(newTotalDays: number) {
    const oldTotalDays = currentTotalDays;

    // Detect time travel backwards (loading an older save)
    if (oldTotalDays > 0 && newTotalDays < oldTotalDays) {
        console.log(`Time travel detected (backwards). Removing letters sent after new date. | Old date: ${oldTotalDays} | New date: ${newTotalDays}`);
        removeLettersAfterDate(newTotalDays);
    }
    // Detect large time jump forward (more than 40 days), could be loading a different save
    else if (oldTotalDays > 0 && newTotalDays - oldTotalDays > 120) {
        console.log("Large time jump detected (>90 days). Assuming new save loaded, clearing all pending letters.");
        storedLetters.clear();
    }

    currentTotalDays = newTotalDays;
    console.log(`Game date updated to: ${currentTotalDays}`);
    checkAndDeliverLetters();

    // Broadcast the date update to all renderer windows
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('game-date-updated', newTotalDays);
    });
}

function processLogLine(line: string) {
    const dateRegex = /VOTC:DATE\/;\/(\d+)/;
    const match = line.match(dateRegex);

    if (match) {
      const newTotalDays = Number(match[1]);
      updateCurrentDate(newTotalDays);
    }
}

async function initCurrentDateFromLog(): Promise<void> {
    const debugLogPath = path.join(config.userFolderPath, 'logs', 'debug.log');
    if (!config.userFolderPath || !fs.existsSync(debugLogPath)) return;

    const CHUNK_SIZE = 512 * 1024; // 512KB — enough to find a recent VOTC:DATE
    let handle;
    try {
        handle = await fs.promises.open(debugLogPath, 'r');
        const { size } = await handle.stat();
        const position = Math.max(0, size - CHUNK_SIZE);
        const buffer = Buffer.alloc(size - position);
        await handle.read(buffer, 0, buffer.length, position);
        const lines = buffer.toString('utf8').split(/\r?\n/);

        const dateRegex = /VOTC:DATE\/;\/(\d+)/;
        let latestDays = 0;
        for (const line of lines) {
            const match = line.match(dateRegex);
            if (match) {
                const days = Number(match[1]);
                if (days > latestDays) latestDays = days;
            }
        }
        if (latestDays > 0) {
            currentTotalDays = latestDays;
            console.log(`initCurrentDateFromLog: Initialized currentTotalDays to ${currentTotalDays} from log.`);
        }
    } catch (err) {
        console.warn(`initCurrentDateFromLog: Could not read log: ${err}`);
    } finally {
        if (handle) await handle.close();
    }
}

let lastSize = 0;
function startLogTailing() {
    const debugLogPath = path.join(config.userFolderPath, 'logs', 'debug.log');
    if (!config.userFolderPath || !fs.existsSync(debugLogPath)) {
        console.warn("LetterManager: CK3 debug log path not configured or file not found; cannot start log tailing for date updates.");
        setTimeout(startLogTailing, 5000); // Retry after 5s if path not set
        return;
    }

    console.log(`Starting to watch debug log for date updates: ${debugLogPath}`);

    try {
        lastSize = fs.statSync(debugLogPath).size;

        fs.watchFile(debugLogPath, { interval: 2000 }, (curr, prev) => {
            if (curr.mtime > prev.mtime && curr.size > lastSize) {
                const bufferSize = curr.size - lastSize;
                const buffer = Buffer.alloc(bufferSize);
                const fd = fs.openSync(debugLogPath, 'r');
                fs.readSync(fd, buffer, 0, bufferSize, lastSize);
                fs.closeSync(fd);

                const newContent = buffer.toString('utf8');
                newContent.split(/\r?\n/).forEach(line => {
                    if (line) processLogLine(line);
                });
                lastSize = curr.size;
            } else if (curr.size < lastSize) {
                // Log file was likely cleared/rotated
                lastSize = curr.size;
            }
        });
    } catch (error) {
        console.error("Error starting log tailing:", error);
    }
}


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
    diaryGenerator = new DiaryGenerator(config, userDataPath);
    loadTranslations(config.language);
    console.log('Configuration loaded successfully.');

    // Initialize the current game date from the last known VOTC:DATE in the log.
    await initCurrentDateFromLog();

    // Re-hydrate any pending reply letters that were not delivered before the last app restart.
    const letterManager = LetterManager.getInstance();
    for (const { id } of letterManager.getAllPlayerIdsWithLetters()) {
        rehydratePendingReplyLetters(id);
    }

    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
        const dialogOpts = {
            type: 'info' as const,
            buttons: [t('dialog.restart_now'), t('dialog.later')],
            title: t('dialog.update_ready_title'),
            message: t('dialog.update_ready_message'),
            detail: releaseName
        };

        dialog.showMessageBox(dialogOpts).then((returnValue) => {
            if (returnValue.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.on('error', (error) => {
        console.error('There was a problem updating the application', error);
    });

    // Check for incompatible mods
    const dlcLoadPath = path.join(config.userFolderPath, 'dlc_load.json');
    if (fs.existsSync(dlcLoadPath)) {
        try {
            const dlcLoadContent = fs.readFileSync(dlcLoadPath, 'utf8');
            const dlcLoadJson = JSON.parse(dlcLoadContent);
            const incompatibleMod = "mod/ugc_3346777360.mod";

            if (dlcLoadJson.enabled_mods && dlcLoadJson.enabled_mods.includes(incompatibleMod)) {
                console.error('Incompatible mod detected. Application will now close.');

                const dialogOpts = {
                    type: 'error' as const,
                    buttons: [t('dialog.open_steam_and_quit'), t('dialog.open_discord_and_quit'), t('dialog.close_app')],
                    title: t('dialog.incompatible_mod_title'),
                    message: t('dialog.incompatible_mod_message'),
                    detail: 'Steam: https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139\nDiscord: https://discord.gg/UQpE4mJSqZ',
                    defaultId: 0,
                    cancelId: 2
                };

                const { response } = await dialog.showMessageBox(dialogOpts);

                if (response === 0) { // "Open Steam and Quit"
                    shell.openExternal('https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139');
                } else if (response === 1) { // "Open Discord and Quit"
                    shell.openExternal('https://discord.gg/UQpE4mJSqZ');
                }
                // Quit the app regardless of the choice.
                app.quit();
                return; // Stop further execution in the ready event.
            }

            // Check for megamod presets
            const megamodMappings: { [key: string]: { modPath: string; presetName: string } } = {
                "LotR: Realms in Exile": { modPath: "mod/ugc_2291024373.mod", presetName: "LotR: Realms in Exile" },
                "A Game of Thrones": { modPath: "mod/ugc_2962333032.mod", presetName: "A Game of Thrones" },
                "The Fallen Eagle": { modPath: "mod/ugc_2243307127.mod", presetName: "The Fallen Eagle" },
                "Warcraft: Guardians of Azeroth 2": { modPath: "mod/ugc_2949767945.mod", presetName: "Warcraft: Guardians of Azeroth 2" }
            };

            if (dlcLoadJson.enabled_mods) {
                for (const [modName, mapping] of Object.entries(megamodMappings)) {
                    if (dlcLoadJson.enabled_mods.includes(mapping.modPath)) {
                        // Check if user has disabled notification for this megamod
                        const disabledNotifications = config.disabledMegamodNotifications || [];
                        if (!disabledNotifications.includes(modName)) {
                            const dialogOpts = {
                                type: 'question' as const,
                                buttons: [t('dialog.yes'), t('dialog.no')],
                                title: t('dialog.megamod_detected_title'),
                                message: t('dialog.megamod_detected_message', { modName: modName }),
                                detail: t('dialog.megamod_detected_detail'),
                                checkboxLabel: t('dialog.dont_ask_again'),
                                checkboxChecked: false
                            };
                            const { response, checkboxChecked } = await dialog.showMessageBox(dialogOpts);
                            
                            if (checkboxChecked) {
                                // Add to disabled notifications list
                                if (!config.disabledMegamodNotifications) {
                                    config.disabledMegamodNotifications = [];
                                }
                                config.disabledMegamodNotifications.push(modName);
                                config.export();
                            }
                            
                            if (response === 0) {
                                // User clicked "Yes" - enable the preset
                                config.activePromptPreset = mapping.presetName;
                                config.export();
                                console.log(`Enabled megamod preset: ${mapping.presetName}`);
                            }
                            // Only check for one megamod at a time
                            break;
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Failed to read or parse dlc_load.json:', err);
        }
    }

    // Tokenizer IPC handlers
    ipcMain.handle('calculate-tokens', async (event, text: string) => {
        try {
            if (config?.textGenerationApiConnectionConfig?.connection) {
                // Import ApiConnection dynamically to avoid circular dependencies
                const { ApiConnection } = await import('../shared/apiConnection.js');
                const apiConnection = new ApiConnection(
                    config.textGenerationApiConnectionConfig.connection,
                    config.textGenerationApiConnectionConfig.parameters
                );
                return apiConnection.calculateTokensFromText(text);
            }
        } catch (error) {
            console.error('Error calculating tokens in main:', error);
        }
        // Fallback: simple token estimation (rough approximation)
        return Math.ceil((text || "").length / 4);
    });

    ipcMain.handle('get-context-limit', async () => {
        try {
            const connectionConfig = config?.textGenerationApiConnectionConfig?.connection;
            if (connectionConfig) {
                // 1. Prioritize manual overwrite if it exists and is valid
                if (connectionConfig.overwriteContext && connectionConfig.customContext > 0) {
                    return Number(connectionConfig.customContext);
                }

                // 2. Fallback to API-detected context
                const { ApiConnection } = await import('../shared/apiConnection.js');
                const apiConnection = new ApiConnection(
                    connectionConfig,
                    config.textGenerationApiConnectionConfig.parameters
                );
                const detectedContext = apiConnection.context || 0;
                if (detectedContext > 0) {
                    return detectedContext;
                }
            }
        } catch (error) {
            console.error('Error getting context limit in main:', error);
        }
        // 3. If all else fails, return a safe default
        return 90000;
    });


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


    createTray();
    console.log('Tray icon and context menu created.');



    console.log("App ready!");

    // Show announcement popup
    const announcementOpts = {
        type: 'info' as const,
        buttons: [t('dialog.join_discord'), t('dialog.view_website'), t('dialog.view_steam'), t('dialog.later')],
        title: t('dialog.announcement_title'),
        message: t('dialog.announcement_message'),
        cancelId: 3 // Set "Later" as the cancel action
    };

    dialog.showMessageBox(announcementOpts).then((returnValue) => {
        if (returnValue.response === 0) {
            shell.openExternal('https://discord.gg/UQpE4mJSqZ');
        } else if (returnValue.response === 1) {
            shell.openExternal('https://votc-ce.vercel.app/');
        } else if (returnValue.response === 2) {
            shell.openExternal('https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139');
        }
    });

    configWindow = new ConfigWindow();
    console.log('ConfigWindow created.');
    chatWindow = new ChatWindow();
    console.log('ChatWindow created.');
    readmeWindow = new ReadmeWindow();
    console.log('ReadmeWindow created.');

    // 检查是否是首次启动
    // checkFirstRunAndShowReadme(); // Disabled: Don't show help window on startup

    chatWindow.window.on('closed', () =>{
        console.log('Chat window closed. Quitting application.');
        app.quit()
    });

    clipboardListener.start();
    console.log('ClipboardListener started.');

    startLogTailing();

    configWindow.window.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

ipcMain.on('open-external-link', (event, url: string) => {
    console.log('IPC: 打开外部链接:', url);
    shell.openExternal(url);
});

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
        buttons: [t('dialog.yes'), t('dialog.no')],
        title: t('dialog.clear_summaries_title'),
        message: t('dialog.clear_summaries_message'),
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

    // Check for incompatible mods
    const dlcLoadPath = path.join(config.userFolderPath, 'dlc_load.json');
    if (fs.existsSync(dlcLoadPath)) {
        try {
            const dlcLoadContent = fs.readFileSync(dlcLoadPath, 'utf8');
            const dlcLoadJson = JSON.parse(dlcLoadContent);
            const incompatibleMod = "mod/ugc_3346777360.mod";

            if (dlcLoadJson.enabled_mods && dlcLoadJson.enabled_mods.includes(incompatibleMod)) {
                console.error('Incompatible mod detected. Application will now close.');

                const dialogOpts = {
                    type: 'error' as const,
                    buttons: [t('dialog.open_steam_and_quit'), t('dialog.open_discord_and_quit'), t('dialog.close_app')],
                    title: t('dialog.incompatible_mod_title'),
                    message: t('dialog.incompatible_mod_message'),
                    detail: 'Steam: https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139\nDiscord: https://discord.gg/UQpE4mJSqZ',
                    defaultId: 0,
                    cancelId: 2
                };

                const { response } = await dialog.showMessageBox(dialogOpts);

                if (response === 0) { // "Open Steam and Quit"
                    shell.openExternal('https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139');
                } else if (response === 1) { // "Open Discord and Quit"
                    shell.openExternal('https://discord.gg/UQpE4mJSqZ');
                }
                // Quit the app regardless of the choice.
                app.quit();
                return; // Stop further execution.
            }
        } catch (err) {
            console.error('Failed to read or parse dlc_load.json:', err);
        }
    }

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
        if (gameData.totalDays) {
            updateCurrentDate(gameData.totalDays);
        }
        conversation = new Conversation(gameData, config, chatWindow, userDataPath);
        await conversation.loadHistory();

        // Import letters from log
        await conversation.letterManager.importLettersFromLog(config, gameData, String(gameData.playerID), gameData.date, String(gameData.aiID));

        // Consolidate chat-start and chat-history into a single event to prevent race conditions
        const historicalMetadata = conversation.historicalConversations || [];

        // Sanitize actions to remove non-serializable functions
        const sanitizedActions = conversation.actions
            .filter(action => action && action.signature)
            .map(action => ({
                signature: action.signature,
                args: action.args,
                description: action.description,
                creator: action.creator,
                usesSource: (action as any).usesSource,
                usesTarget: (action as any).usesTarget
        }));

        // Calculate base prompt tokens
        const basePromptTokens = await conversation.calculateBasePromptTokens();

        const payload = {
            gameData: conversation.gameData,
            messages: conversation.messages,
            historicalMetadata: historicalMetadata,
            actions: sanitizedActions, // Pass sanitized actions
            basePromptTokens: basePromptTokens
        };
        console.log(`Sending chat-start payload with ${sanitizedActions.length} actions and base tokens: ${basePromptTokens}.`);
        chatWindow.window.webContents.send('chat-start', payload);

        // Wait for the chat window to be ready before starting the conversation flow
        ipcMain.once('chat-window-ready', async () => {
            console.log('IPC: Received chat-window-ready. Initializing conversation flow.');
            await conversation.initialize();
        });

    }catch(err){
        console.log("==VOTC:IN ERROR==");
        console.error(err); // Changed from console.log(err)

        if(chatWindow.isShown){
            chatWindow.window.webContents.send('error-message', err);
        }
    }
})

clipboardListener.on('VOTC:EFFECT_ACCEPTED', () =>{
    console.log('ClipboardListener: VOTC:EFFECT_ACCEPTED event detected.');
    if(conversation){
        conversation.runFileManager.clear();
        console.log('Conversation active, run file manager cleared.');
    } else {
        console.warn('VOTC:EFFECT_ACCEPTED received but no active conversation.');
    }

})

clipboardListener.on('VOTC:LETTER_ACCEPTED', async () => {
    console.log('ClipboardListener: VOTC:LETTER_ACCEPTED event detected.');
    try {
        LetterManager.getInstance().clearLettersFile(config);
        if (lastLetterSentToGame) {
            console.log(`Game confirmed delivery of letter reply for original letter: ${lastLetterSentToGame.originalLetter.id}`);
            const letterManager = LetterManager.getInstance();
            const replyLetter = lastLetterSentToGame.letter;

            // Use the reliable currentTotalDays to create the delivery date
            const deliveryDateString = totalDaysToDateString(currentTotalDays);
            const deliveryDate = new Date(deliveryDateString.replace(/\./g, '-'));

            // Now officially mark as delivered and save
            letterManager.markAsDelivered(
                String(replyLetter.recipient.id), // Player ID
                String(replyLetter.sender.id),   // Character ID
                replyLetter.id,
                deliveryDate
            );

            lastLetterSentToGame = null; // Clear the tracked letter

            // Notify UI of the final status change
            if (configWindow && !configWindow.window.isDestroyed()) {
                configWindow.window.webContents.send('letter-status-changed');
            }
        } else {
            console.log('VOTC:LETTER_ACCEPTED received, but no letter was pending game confirmation.');
        }
    } catch (error) {
        console.error(`Failed to handle LETTER_ACCEPTED event: ${error}`);
    }
});

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
        LetterManager.getInstance().clearLettersFile(config);
        await sleep(250); // Wait for log to flush

        const gameData = await parseLog(path.join(config.userFolderPath, 'logs', 'debug.log'));
        if (!gameData) {
            console.error('Failed to parse game data from debug.log for letter event.');
            return;
        }

        // Overwrite stale date from parseLog with the fresh, tailed date
        gameData.totalDays = currentTotalDays;
        gameData.date = totalDaysToDateString(currentTotalDays);

        const playerId = String(gameData.playerID);
        const recipientId = String(gameData.aiID);

        const gameDate = gameData.date;
        const letterManager = LetterManager.getInstance();

        // First, update the character map with the latest data from the log
        const summaryDirForMap = path.join(userDataPath, 'conversation_summaries', playerId);
        const characterMapPath = path.join(summaryDirForMap, '_character_map.json');
        let characterNameMap: Map<string, string> = await readCharacterMap(userDataPath, playerId);

        // Add all characters from the current gameData to the map
        gameData.characters.forEach(char => {
            if (!characterNameMap.has(String(char.id))) {
                characterNameMap.set(String(char.id), char.fullName);
            }
        });

        // Save the updated map back to the file
        const mapToSave: { [key: string]: string } = {};
        characterNameMap.forEach((name, id) => {
            mapToSave[id] = name;
        });
        fs.writeFileSync(characterMapPath, JSON.stringify(mapToSave, null, '\t'));
        console.log(`Updated character map before letter import at: ${characterMapPath}`);


        // Import letters from log, which now also saves them.
        await letterManager.importLettersFromLog(config, gameData, playerId, gameDate, recipientId);
        console.log("Imported and saved letters immediately after VOTC:LETTER event.");

        // Refresh the letters UI to show the new letter in the outbox
        if (configWindow && !configWindow.window.isDestroyed()) {
            configWindow.window.webContents.send('letter-status-changed');
        }

        // Get all letters for the player and find the most recent one by creation date.
        const allPlayerLetters = letterManager.getAllLetters(playerId);
        const latestLetter = letterManager.getLatestLetter(playerId);

        if (!latestLetter) {
            console.error("VOTC:LETTER event, but no letters found after import.");
            return;
        }

        // START NEW LOGIC
        const letterIdMatch = latestLetter.subject.match(/letter_(\d+)/);
        if (letterIdMatch) {
            const newCount = parseInt(letterIdMatch[1], 10);
            if (newCount === 1) {
                console.log('Letter thread reset detected (letter_1).');
                letterThreadCount = 1;
                letterThreadFullNotified = false;
            } else {
                letterThreadCount = newCount;
            }

            console.log(`Letter thread count updated to: ${letterThreadCount}/9`);

            if (letterThreadCount >= 9 && !letterThreadFullNotified) {
                dialog.showMessageBox({
                    type: 'warning',
                    title: t('dialog.letter_thread_full_title'),
                    message: t('dialog.letter_thread_full_message'),
                    buttons: [t('dialog.ok')]
                });
                letterThreadFullNotified = true;
            }
        }

        // Send update to renderer
        if (configWindow && !configWindow.window.isDestroyed()) {
            configWindow.window.webContents.send('letter-thread-status-update', letterThreadCount);
        }
        // END NEW LOGIC

        // Check if this letter already has a reply that is not in the future
        const hasReply = allPlayerLetters.some(l =>
            l.replyToId === latestLetter.id &&
            l.totalDays <= gameData.totalDays &&
            l.sender.id === latestLetter.recipient.id &&
            l.recipient.id === latestLetter.sender.id
        );
        if (hasReply) {
            console.log(`Letter ${latestLetter.id} already has a reply that is not in the future. No new reply will be generated.`);
            return;
        }

        // Mark original letter as 'generating'
        letterManager.updateLetterStatus(playerId, recipientId, latestLetter.id, 'generating');
        if (configWindow && !configWindow.window.isDestroyed()) {
            configWindow.window.webContents.send('letter-status-changed');
        }

        if (gameData.totalDays) {
            updateCurrentDate(gameData.totalDays);
        }

        const letterReplyGenerator = new LetterReplyGenerator(config, userDataPath);
        const replyLetter = await letterReplyGenerator.generateLetterReply(gameData, latestLetter);

        // Diary entry for player sending a letter
        if (config.diaryGenerationChance > 0 && Math.random() < (config.diaryGenerationChance / 100)) {
            const playerCharacter = gameData.getCharacter(gameData.playerID);
            if (playerCharacter) {
                const newEntry = await diaryGenerator.generateDiaryEntryForLetter(gameData, playerCharacter, latestLetter.content, 'sent');
                if (newEntry) {
                    await saveDiaryFile(String(gameData.playerID), String(playerCharacter.id), newEntry);
                    const summaryResult = await diaryGenerator.summarizeDiaryEntry(newEntry);
                    if (summaryResult) {
                        const summaries = await readDiarySummaries(String(gameData.playerID), String(playerCharacter.id));
                        summaries.unshift({ id: randomUUID(), ...summaryResult });
                        await saveDiarySummaries(String(gameData.playerID), String(playerCharacter.id), summaries);
                    }
                }
            }
        }

        if (!replyLetter) {
            console.error(`Failed to generate a reply for letter ${latestLetter.id}. The LLM may have returned an empty response.`);
            return;
        }

        const expectedDeliveryDay = latestLetter.totalDays + latestLetter.delay;
        const storedLetter: StoredLetter = {
            letter: replyLetter,
            originalLetter: latestLetter,
            expectedDeliveryDay: expectedDeliveryDay
        };

        storedLetters.set(latestLetter.id, storedLetter);
        console.log(`Letter ${latestLetter.id} reply generated and stored. Will deliver on day ${expectedDeliveryDay}. Current day: ${currentTotalDays}`);

        // Diary entry for AI receiving a letter and replying
        if (config.diaryGenerationChance > 0 && Math.random() < (config.diaryGenerationChance / 100)) {
            const aiCharacter = gameData.getCharacter(replyLetter.sender.id);
            if (aiCharacter) {
                const newEntry = await diaryGenerator.generateDiaryEntryForLetter(gameData, aiCharacter, replyLetter.content, 'received');
                if (newEntry) {
                    await saveDiaryFile(String(gameData.playerID), String(aiCharacter.id), newEntry);
                    const summaryResult = await diaryGenerator.summarizeDiaryEntry(newEntry);
                    if (summaryResult) {
                        const summaries = await readDiarySummaries(String(gameData.playerID), String(aiCharacter.id));
                        summaries.unshift({ id: randomUUID(), ...summaryResult });
                        await saveDiarySummaries(String(gameData.playerID), String(aiCharacter.id), summaries);
                    }
                }
            }
        }

        checkAndDeliverLetters();

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

ipcMain.handle('get-prompt-history', async (event, playerId: string) => {
    console.log(`IPC: Received get-prompt-history for player: ${playerId}`);
    return await readPromptHistory(playerId);
});

ipcMain.on('save-prompt-history', (event, { playerId, history }: { playerId: string, history: string[] }) => {
    console.log(`IPC: Received save-prompt-history for player: ${playerId}`);
    savePromptHistory(playerId, history);
});

ipcMain.handle('get-userdata-path', () => {
    console.log('IPC: Received get-userdata-path event.');
    return path.join(app.getPath("userData"), 'votc_data')
});

ipcMain.handle('get-prompt-presets', async () => {
    console.log('IPC: Received get-prompt-presets event.');
    const presetsPath = path.join(userDataPath, 'configs', 'prompt_presets.json');
    if (fs.existsSync(presetsPath)) {
        try {
            const presetsRaw = await fs.promises.readFile(presetsPath, 'utf-8');
            const presets = JSON.parse(presetsRaw);
            // Ensure the new structure exists
            if (!presets.global && !Object.keys(presets).some(k => k !== 'global')) {
                // Old flat structure detected, migrate it
                console.log('Old preset structure detected, migrating to new structure.');
                return { global: presets };
            }
            return presets;
        } catch (error) {
            console.error('Error reading prompt presets file:', error);
            return { global: {} }; // Return new structure
        }
    }
    return { global: {} }; // Return new structure
});

ipcMain.handle('save-prompt-presets', async (event, presets) => {
    console.log('IPC: Received save-prompt-presets event.');
    const presetsPath = path.join(userDataPath, 'configs', 'prompt_presets.json');
    try {
        await fs.promises.writeFile(presetsPath, JSON.stringify(presets, null, '\t'));
        return { success: true };
    } catch (error) {
        console.error('Error saving prompt presets file:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});


const promptKeys = [
    'mainPrompt',
    'summarizePrompt',
    'memoriesPrompt',
    'suffixPrompt',
    'selfTalkPrompt',
    'selfTalkSummarizePrompt',
    'narrativePrompt',
    'sceneDescriptionPrompt',
    'letterPrompt',
    'letterSummaryPrompt',
    'diaryPrompt',
    'diarySummarizePrompt',
];

ipcMain.on('config-change', (e, confID: string, newValue: any) =>{
    console.log(`IPC: Received config-change event. ID: ${confID}, New Value: ${newValue}`);

    if (promptKeys.includes(confID)) {
        // @ts-ignore
        if (!config.prompts[config.language]) {
            // @ts-ignore
            config.prompts[config.language] = {};
        }
        // @ts-ignore
        config.prompts[config.language][confID] = newValue;
    } else {
        // @ts-ignore
        config[confID] = newValue;
    }

    config.export();
    diaryGenerator = new DiaryGenerator(config, userDataPath); // Re-initialize with new config
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

    // Preserve the entire apiKeys object from the previous state if it's not in the new value.
    if (innerConfID === 'connection' && previous && typeof previous === 'object') {
        if (!newValue.apiKeys && previous.apiKeys) {
            newValue.apiKeys = previous.apiKeys;
        }
    }

    // Save custom player2 models
    if (innerConfID === 'connection' && newValue.type === 'player2' && newValue.model) {
        if (!newValue.apiKeys) newValue.apiKeys = {};
        if (!newValue.apiKeys.player2) newValue.apiKeys.player2 = {};
        
        const customModels = new Set(newValue.apiKeys.player2.customModels || []);

        if (newValue.model !== 'gpt-oss-120b') {
            customModels.add(newValue.model);
        }
        
        newValue.apiKeys.player2.customModels = Array.from(customModels);
    }

    // Update the active configuration
    //@ts-ignore
    config[outerConfID][innerConfID] = newValue;

    // Also update the specific entry in apiKeys to keep it in sync
    if (innerConfID === 'connection') {
        const apiType = newValue.type;
        if (apiType) {
            //@ts-ignore
            if (!config[outerConfID][innerConfID].apiKeys) {
                //@ts-ignore
                config[outerConfID][innerConfID].apiKeys = {};
            }
            
            // Create a clean cache object to avoid circular references.
            const valueToCache = {
                type: newValue.type,
                baseUrl: newValue.baseUrl,
                key: newValue.key,
                model: newValue.model,
                forceInstruct: newValue.forceInstruct,
                overwriteContext: newValue.overwriteContext,
                customContext: newValue.customContext
            };

            if (apiType === 'player2' && newValue.apiKeys && newValue.apiKeys.player2) {
                //@ts-ignore
                valueToCache.customModels = newValue.apiKeys.player2.customModels;
            }

            // Save the clean value to the specific API key cache
            //@ts-ignore
            config[outerConfID][innerConfID].apiKeys[apiType] = valueToCache;
        }
    }

    config.export();
    diaryGenerator = new DiaryGenerator(config, userDataPath); // Re-initialize with new config
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
})

//dear god...
ipcMain.on('config-change-nested-nested', (e, outerConfID: string, middleConfID: string, innerConfID: string, newValue: any) =>{
    console.log(`IPC: Received config-change-nested-nested event. Outer ID: ${outerConfID}, Middle ID: ${middleConfID}, Inner ID: ${innerConfID}, New Value: ${newValue}`);
    
    if (innerConfID === 'customContext') {
        newValue = parseInt(newValue, 10) || 0;
    }

    //@ts-ignore
    config[outerConfID][middleConfID][innerConfID] = newValue;
    config.export();
    diaryGenerator = new DiaryGenerator(config, userDataPath); // Re-initialize with new config
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
})

ipcMain.on('chat-stop', () =>{
    console.log('IPC: Received chat-stop event.');
    chatWindow.hide();

    if(conversation && conversation.isOpen){
        if (conversation.gameData.totalDays) {
            updateCurrentDate(conversation.gameData.totalDays);
        }
        conversation.summarize();
    }

})

ipcMain.on('cancel-generation', () => {
    console.log('IPC: Received cancel-generation event.');
    if (conversation) {
        conversation.cancelGeneration();
    }
});

ipcMain.on('clear-conversation-history', () => {
    console.log('IPC: Received clear-conversation-history event.');
    if (conversation) {
        conversation.clearHistory();
        // Notify chat window that history was cleared
        if (chatWindow && !chatWindow.window.isDestroyed()) {
            chatWindow.window.webContents.send('conversation-history-cleared');
        }
    }
});

ipcMain.on('undo-message', () => {
    console.log('IPC: Received undo-message event.');
    if (conversation) {
        conversation.undo();
    }
});

ipcMain.on('regenerate-response', async () => {
    console.log('IPC: Received regenerate-response event.');
    if (conversation) {
        try {
            await conversation.regenerate();
        } catch (err) {
            console.error('Error during regeneration:', err);
            chatWindow.window.webContents.send('error-message', 'An error occurred during regeneration.');
        }
    }
});

ipcMain.on('pause-conversation', () => {
    console.log('IPC: Received pause-conversation event.');
    if (conversation) {
        conversation.pause();
    }
});

ipcMain.on('resume-conversation', () => {
    console.log('IPC: Received resume-conversation event.');
    if (conversation) {
        conversation.resume();
    }
});

ipcMain.on('edit-message', (event, { messageId, newContent }) => {
    console.log(`IPC: Received edit-message for ID ${messageId}.`);
    if (conversation) {
        conversation.editMessage(messageId, newContent);
    }
});

ipcMain.on('execute-approved-action', (event, messageId: string, actionName: string) => {
    console.log(`IPC: Received execute-approved-action for action: ${actionName}`);
    if (conversation) {
        conversation.executeApprovedAction(messageId, actionName);
    }
});

ipcMain.on('execute-action', (event, signature: string, args: any[]) => {
    console.log(`IPC: Received execute-action event for ${signature} with args:`, args);
    if (conversation) {
        const action = conversation.actions.find(a => a.signature === signature);
        if (action) {
            const originalPlayerId = conversation.gameData.playerID;
            const originalAiId = conversation.gameData.aiID;
            const originalAiName = conversation.gameData.aiName;
            try {
                const sourceId = args[0] ? parseInt(args[0], 10) : null;
                const targetId = args[1] ? parseInt(args[1], 10) : null;
                const actionArgs = args.slice(2);

                if ((args[0] && isNaN(sourceId!)) || (args[1] && isNaN(targetId!))) {
                    throw new Error('Invalid source or target character ID.');
                }

                if (signature !== 'noOp') {
                    if (sourceId !== null) conversation.actionInvolvedCharacterIds.add(sourceId);
                    if (targetId !== null) conversation.actionInvolvedCharacterIds.add(targetId);
                }

                if ((sourceId !== null && !conversation.gameData.characters.has(sourceId)) || (targetId !== null && !conversation.gameData.characters.has(targetId))) {
                    throw new Error('Source or target character not found in conversation.');
                }

                // Temporarily set gameData context for the action
                conversation.gameData.playerID = sourceId !== null ? sourceId : originalPlayerId;
                conversation.gameData.aiID = targetId !== null ? targetId : originalAiId;
                if (targetId !== null) {
                    const targetCharacter = conversation.gameData.characters.get(targetId);
                    if (targetCharacter) {
                        conversation.gameData.aiName = targetCharacter.shortName;
                    }
                }

                // Run the action to get the effect body
                let effectBody = "";
                action.run(conversation.gameData, (text: string) => { effectBody += text; }, actionArgs, sourceId!, targetId!);

                // Use the writer to create the full script with prelude
                ActionEffectWriter.writeEffect(
                    conversation.runFileManager,
                    conversation.gameData,
                    sourceId,
                    targetId,
                    effectBody
                );

                // Append the trigger to execute the script
                const triggerScript = `
          root = {trigger_event = mcc_event_v2.9003}
                `;
                conversation.runFileManager.append(triggerScript);
                console.log('Appended trigger event for slash command.');

                // Hardcoded effects for specific actions
                if ((signature === 'leaveConversation' || signature === 'killCharacter') && targetId !== null) {
                    if (targetId === conversation.gameData.playerID) {
                        console.log(`Player is leaving or was killed. Ending session. Action: ${signature}`);
                        chatWindow.window.webContents.send('chat-hide');
                        chatWindow.hide();
                        if (conversation && conversation.isOpen) {
                            if (conversation.gameData.totalDays) {
                                updateCurrentDate(conversation.gameData.totalDays);
                            }
                            conversation.summarize();
                        }
                    } else {
                        conversation.removeCharacter(targetId);
                    }
                }
                if (signature === 'changeLocation') {
                    conversation.generateSceneDescription();
                }

                // Generate the chat message if it exists
                if (action.chatMessage) {
                    let chatMessage = action.chatMessage(actionArgs);
                    if (typeof chatMessage === 'object' && chatMessage !== null) {
                        chatMessage = chatMessage[conversation.config.language] || chatMessage['en'] || Object.values(chatMessage)[0] || '';
                    }

                    if (chatMessage) {
                        const { parseVariables } = require('./parseVariables.js');
                        const source = conversation.gameData.getCharacterById(sourceId!);
                        const target = conversation.gameData.getCharacterById(targetId!);
                        conversation.gameData.character1Name = source ? source.shortName : "someone";
                        conversation.gameData.character2Name = target ? target.shortName : "someone";
                        const response: ActionResponse = {
                            actionName: action.signature,
                            chatMessage: parseVariables(chatMessage, conversation.gameData),
                            chatMessageClass: action.chatMessageClass
                        };
                        // Send the single action response back to be displayed
                        event.sender.send('actions-receive', [response], ""); // Send as an array
                    }
                }
            } catch (e) {
                const errMsg = `Action error: failure in run function for action: ${action.signature}; details: ` + e;
                console.error(errMsg);
                event.sender.send('error-message', errMsg);
            } finally {
                // Restore original gameData context
                conversation.gameData.playerID = originalPlayerId;
                conversation.gameData.aiID = originalAiId;
                conversation.gameData.aiName = originalAiName;
            }
        } else {
            console.warn(`Execute-action warning: Action "${signature}" not found.`);
        }
    }
});


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

ipcMain.on('open-action-file', (event, filePath: string) => {
    console.log(`IPC: Received open-action-file event for path: ${filePath}`);
    shell.openPath(filePath).catch((err: any) => {
        console.error(`Failed to open action file at ${filePath}:`, err);
    });
});

ipcMain.on('open-roaming-data-folder', () => {
    console.log('IPC: Received open-roaming-data-folder event.');
    const roamingPath = path.join(app.getPath('userData'), 'votc_data');
    console.log(`Opening roaming data folder at: ${roamingPath}`);
    shell.openPath(roamingPath);
});

// Summary Manager IPC handlers
ipcMain.handle('get-summary-ids', async () => {
    console.log('IPC: Received get-summary-ids event.');
    try {
        const ids = await getPlayerId(userDataPath);
        return ids;
    } catch (error) {
        console.error('Error getting summary IDs:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { playerId: null, error: errorMessage };
    }
});

ipcMain.handle('get-all-summary-player-ids', async () => {
    console.log('IPC: Received get-all-summary-player-ids event.');
    try {
        // Get player IDs from all three sources and merge them
        const conversationPlayerIds = await getAllPlayerIds(userDataPath);
        const letterManager = LetterManager.getInstance();
        const letterPlayerIds = letterManager.getAllPlayerIdsWithLetters();

        // Get diary player IDs
        const diaryPlayerIds = await getAllDiaryPlayerIds(userDataPath);

        // Merge all player IDs, ensuring uniqueness
        const allPlayerIds = new Map<string, { id: string, name: string }>();

        // Add conversation player IDs
        conversationPlayerIds.forEach(player => {
            allPlayerIds.set(player.id, player);
        });

        // Add letter player IDs
        letterPlayerIds.forEach(player => {
            if (!allPlayerIds.has(player.id)) {
                allPlayerIds.set(player.id, player);
            }
        });

        // Add diary player IDs
        diaryPlayerIds.forEach(player => {
            if (!allPlayerIds.has(player.id)) {
                allPlayerIds.set(player.id, player);
            }
        });

        const mergedPlayerIds = Array.from(allPlayerIds.values());
        return { success: true, ids: mergedPlayerIds };
    } catch (error) {
        console.error('Error getting all player IDs:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('read-summary-file', async (event, playerId) => {
    console.log(`IPC: Received read-summary-file event for player: ${playerId}`);
    try {
        const summaries = await readSummaryFile(userDataPath, playerId);

        const characterMapPath = path.join(userDataPath, 'conversation_summaries', playerId, '_character_map.json');
        let characterMap: {[key: string]: string} = {};
        if (fs.existsSync(characterMapPath)) {
            try {
                characterMap = JSON.parse(fs.readFileSync(characterMapPath, 'utf8'));
            } catch (e) {
                console.error('Error reading character map:', e);
            }
        }

        const augmentedSummaries = summaries.map(summary => {
            let characterName = 'Unknown';
            if (summary.characterId) {
                characterName = characterMap[summary.characterId] || `Character ${summary.characterId}`;
            }
            return { ...summary, characterName };
        });

        return augmentedSummaries;
    } catch (error) {
        console.error('Error reading summary file:', error);
        return [];
    }
});

ipcMain.handle('save-summary-file', async (event, playerId, summaryData) => {
    console.log(`IPC: Received save-summary-file event for player: ${playerId}`);
    try {
        await saveSummaryFile(userDataPath, playerId, summaryData);
        return { success: true };
    } catch (error) {
        console.error('Error saving summary file:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

// Letter Summary IPC handlers
ipcMain.handle('get-all-letter-summaries-for-player', async (event, playerId: string) => {
    console.log(`IPC: Received get-all-letter-summaries-for-player event for player: ${playerId}`);
    try {
        const letterManager = LetterManager.getInstance();
        const summaries = letterManager.getAllLetterSummaries(playerId);
        return summaries;
    } catch (error) {
        console.error('Error getting letter summaries for player:', error);
        return [];
    }
});

ipcMain.handle('save-all-letter-summaries', async (event, playerId: string, summariesData: any[]) => {
    console.log(`IPC: Received save-all-letter-summaries event for player: ${playerId}`);
    try {
        const letterManager = LetterManager.getInstance();
        const summaryDir = path.join(app.getPath('userData'), 'votc_data', 'letter_summaries', playerId);
        const existingSummaryFiles = fs.existsSync(summaryDir) ? fs.readdirSync(summaryDir).filter(f => f.endsWith('.json') && f !== '_character_map.json') : [];
        const existingCharIds = new Set(existingSummaryFiles.map(f => f.replace('.json', '')));

        const summariesByCharacter: { [key: string]: any[] } = {};
        summariesData.forEach(summary => {
            const characterId = summary.characterId;
            if (!summariesByCharacter[characterId]) {
                summariesByCharacter[characterId] = [];
            }
            summariesByCharacter[characterId].push(summary);
            existingCharIds.delete(characterId);
        });

        for (const [characterId, summaries] of Object.entries(summariesByCharacter)) {
            summaries.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const cleanSummaries = summaries.map(({ characterId, characterName, ...rest }) => rest);
            letterManager.saveLetterSummaries(playerId, characterId, cleanSummaries);
        }

        // Delete summaries for characters that were removed
        for (const charIdToDelete of existingCharIds) {
            const summaryPath = path.join(summaryDir, `${charIdToDelete}.json`);
            if (fs.existsSync(summaryPath)) {
                fs.unlinkSync(summaryPath);
                console.log(`Deleted letter summary for character ${charIdToDelete}`);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Error saving letter summaries:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

// Diary Summary IPC handlers
ipcMain.handle('get-all-diaries-for-player', async (event, playerId: string) => {
    console.log(`IPC: Received get-all-diaries-for-player event for player: ${playerId}`);
    try {
        const summaries = await getAllDiarySummaries(playerId);
        summaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return summaries;
    } catch (error) {
        console.error('Error getting diary summaries for player:', error);
        return [];
    }
});

ipcMain.handle('save-all-diary-summaries', async (event, playerId: string, summariesData: any[]) => {
    console.log(`IPC: Received save-all-diary-summaries event for player: ${playerId}`);
    try {
        const summaryDir = path.join(app.getPath('userData'), 'votc_data', 'diary_summaries', playerId);
        const existingSummaryFiles = fs.existsSync(summaryDir) ? fs.readdirSync(summaryDir).filter(f => f.endsWith('.json') && f !== '_character_map.json') : [];
        const existingCharIds = new Set(existingSummaryFiles.map(f => f.replace('.json', '')));

        const summariesByCharacter: { [key: string]: any[] } = {};
        summariesData.forEach(summary => {
            const characterId = summary.characterId;
            if (!summariesByCharacter[characterId]) {
                summariesByCharacter[characterId] = [];
            }
            summariesByCharacter[characterId].push(summary);
            existingCharIds.delete(characterId);
        });

        for (const [characterId, summaries] of Object.entries(summariesByCharacter)) {
            summaries.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const cleanSummaries = summaries.map(({ characterName, ...rest }) => rest);
            await saveDiarySummaries(playerId, characterId, cleanSummaries);
        }

        // Delete summaries for characters that were removed
        for (const charIdToDelete of existingCharIds) {
            const summaryPath = path.join(summaryDir, `${charIdToDelete}.json`);
            if (fs.existsSync(summaryPath)) {
                fs.unlinkSync(summaryPath);
                console.log(`Deleted diary summary for character ${charIdToDelete}`);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Error saving diary summaries:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('get-letter-thread-status', () => {
    console.log(`IPC: Received get-letter-thread-status. Current count: ${letterThreadCount}`);
    return letterThreadCount;
});

ipcMain.handle('get-current-game-day', () => {
    return currentTotalDays;
});

ipcMain.handle('get-character-map', async (event, playerId) => {
    console.log(`IPC: Received get-character-map event for player: ${playerId}`);
    try {
        const map = await readCharacterMap(userDataPath, playerId);
        return { success: true, map: Object.fromEntries(map) };
    } catch (error) {
        console.error('Error getting character map:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('get-diary-character-map', async (event, playerId) => {
    console.log(`IPC: Received get-diary-character-map event for player: ${playerId}`);
    try {
        const map = await getDiaryCharacterMap(playerId);
        return { success: true, map: map };
    } catch (error) {
        console.error('Error getting diary character map:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

// Diary Manager IPC handlers
ipcMain.handle('get-diary-ids', async () => {
    console.log('IPC: Received get-diary-ids event.');
    try {
        const ids = await getAllDiaryPlayerIds(userDataPath);
        return { success: true, ids: ids };
    } catch (error) {
        console.error('Error getting diary IDs:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('get-all-diary-player-ids', async () => {
    console.log('IPC: Received get-all-diary-player-ids event.');
    try {
        const players = await getAllDiaryPlayerIds(userDataPath);

        const playerTimestamps = await Promise.all(players.map(async (player) => {
            let latestTimestamp = 0;
            try {
                const characterIds = await getDiaryFiles(player.id);
                for (const charId of characterIds) {
                    const diaryData = await readDiaryFile(player.id, charId);
                    if (diaryData && diaryData.diary_entries) {
                        for (const entry of diaryData.diary_entries) {
                            if (entry.creationTimestamp) {
                                const timestamp = new Date(entry.creationTimestamp).getTime();
                                if (timestamp > latestTimestamp) {
                                    latestTimestamp = timestamp;
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`Error processing diaries for player ${player.id}:`, e);
            }
            return { ...player, latestTimestamp };
        }));

        playerTimestamps.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

        const sortedPlayers = playerTimestamps.map(({ id, name }) => ({ id, name }));

        return { success: true, ids: sortedPlayers };
    } catch (error) {
        console.error('Error getting all diary player IDs:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('get-diary-files', async (event, playerId) => {
    console.log(`IPC: Received get-diary-files event for player: ${playerId}`);
    try {
        const files = await getDiaryFiles(playerId);
        // we only want character id, so remove .json
        return files.map(f => f.replace('.json', ''));
    } catch (error) {
        console.error('Error getting diary files:', error);
        return [];
    }
});

ipcMain.handle('read-diary-file', async (event, playerId, characterId) => {
    console.log(`IPC: Received read-diary-file event for player: ${playerId}, character: ${characterId}`);
    try {
        return await readDiaryFile(playerId, characterId);
    } catch (error) {
        console.error('Error reading diary file:', error);
        return null;
    }
});

ipcMain.handle('save-diary-file', async (event, playerId, characterId, diaryData) => {
    console.log(`IPC: Received save-diary-file event for player: ${playerId}, character: ${characterId}`);
    try {
        await saveDiaryFile(playerId, characterId, diaryData);
        return { success: true };
    } catch (error) {
        console.error('Error saving diary file:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('regenerate-diary-summaries', async (event, { playerId, editedEntries, deletedEntries }) => {
    console.log(`IPC: Regenerating summaries for player ${playerId}. Edited: ${editedEntries.length}, Deleted: ${deletedEntries.length}`);
    if (!diaryGenerator) {
        diaryGenerator = new DiaryGenerator(config, userDataPath);
    }

    try {
        const characterIds = new Set<string>([
            ...editedEntries.map((e: any) => e.character_id),
            ...deletedEntries.map((e: any) => e.character_id)
        ]);

        for (const charId of characterIds) {
            if (!charId) continue;
            let summaries = await readDiarySummaries(playerId, charId);

            // Remove summaries for deleted entries
            const deletedIdsForChar = new Set(deletedEntries.filter((e: any) => e.character_id === charId).map((e: any) => e.id));
            if (deletedIdsForChar.size > 0) {
                summaries = summaries.filter(s => !deletedIdsForChar.has(s.diaryEntryId));
            }

            // Update/add summaries for edited entries
            const editedEntriesForChar = editedEntries.filter((e: any) => e.character_id === charId);
            for (const entry of editedEntriesForChar) {
                const newSummary = await diaryGenerator.summarizeDiaryEntry(entry);
                if (newSummary) {
                    const existingSummaryIndex = summaries.findIndex(s => s.diaryEntryId === entry.id);
                    if (existingSummaryIndex !== -1) {
                        summaries[existingSummaryIndex] = { ...summaries[existingSummaryIndex], ...newSummary };
                    } else {
                        summaries.unshift({ id: randomUUID(), ...newSummary, characterId: charId });
                    }
                }
            }

            summaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            await saveDiarySummaries(playerId, charId, summaries);
        }
        return { success: true };
    } catch (error) {
        console.error('Error regenerating diary summaries:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

// Conversation History IPC handlers

ipcMain.handle('get-conversation-history-files', async (event, playerId) => {
    console.log(`IPC: Received get-conversation-history-files event for player: ${playerId}`);
    try {
        const files = await getConversationHistoryFiles(playerId, []);
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

// Letter IPC Handlers
ipcMain.handle('import-letters-from-log', async (event, args) => {
    console.log('IPC: Received import-letters-from-log event with args:', args);
    try {
        const playerId = args ? args.playerId : (await getPlayerId(userDataPath)).playerId;

        if (playerId) {
            const gameData = await parseLog(path.join(config.userFolderPath, 'logs', 'debug.log'));
            if (!gameData) {
                console.error("Could not parse gameData for manual letter import.");
                return { success: false, error: 'Could not parse gameData from log.' };
            }
            const gameDate = gameData.date;
            const letterManager = LetterManager.getInstance();
            const recipientId = args ? args.recipientId : undefined;
            await letterManager.importLettersFromLog(config, gameData, playerId, gameDate, recipientId);
            return { success: true };
        }
        return { success: false, error: 'Player ID not found.' };
    } catch (error) {
        console.error('Error during manual letter import:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('get-letter-players', async () => {
    console.log('IPC: Received get-letter-players event.');
    const letterManager = LetterManager.getInstance();
    return letterManager.getAllPlayerIdsWithLetters();
});

ipcMain.handle('get-corresponded-characters', async (event, playerId: string) => {
    console.log(`IPC: Received get-corresponded-characters event for player: ${playerId}`);
    const letterManager = LetterManager.getInstance();
    return letterManager.getCorrespondedCharacters(playerId);
});

ipcMain.handle('get-all-letters-for-player', async (event, playerId: string) => {
    console.log(`IPC: Received get-all-letters-for-player event for player: ${playerId}`);
    if (playerId) {
        const letterManager = LetterManager.getInstance();
        return letterManager.getAllLetters(playerId);
    }
    return [];
});

ipcMain.on('get-letters', (event) => {
    console.log('IPC: Received get-letters event.');
    if (conversation) {
        const letters = conversation.letterManager.getAllLetters(String(conversation.gameData.playerID));
        event.sender.send('letters-data', letters);
    } else {
        // Fallback for when conversation is not active, maybe check last player ID?
        // For now, just send empty. A more robust solution could be implemented if needed.
        console.log('IPC: No active conversation, sending empty letter array.');
        event.sender.send('letters-data', []);
    }
});

ipcMain.on('mark-letter-as-read', (event, { playerId, characterId, letterId }: { playerId: string, characterId: string, letterId: string }) => {
    console.log(`IPC: Received mark-letter-as-read event for letter ID: ${letterId} for player ${playerId} and character ${characterId}`);
    const letterManager = LetterManager.getInstance();
    letterManager.markAsRead(playerId, characterId, letterId);
    console.log(`Letter ${letterId} marked as read.`);
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

    const windows = [
        configWindow,
        chatWindow,
        summaryManagerWindow,
        readmeWindow,
        conversationHistoryWindow
    ];

    windows.forEach(win => {
        if (win && win.window && !win.window.isDestroyed()) {
            win.window.webContents.send('update-theme', theme);
        }
    });
});
});

// 处理语言切换事件
ipcMain.on('language-changed', (event, lang: string) => {
    console.log(`IPC: Received language-changed event. Language: ${lang}`);

    loadTranslations(lang);
    createTray();

    const windows = [
        configWindow,
        chatWindow,
        summaryManagerWindow,
        readmeWindow,
        conversationHistoryWindow
    ];

    windows.forEach(win => {
        if (win && win.window && !win.window.isDestroyed()) {
            console.log(`Sending update-language to window: ${win.constructor.name}`);
            win.window.webContents.send('update-language', lang);
        }
    });
});
