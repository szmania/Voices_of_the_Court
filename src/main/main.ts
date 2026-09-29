import { app, ipcMain, dialog, autoUpdater, Tray, Menu, BrowserWindow, screen } from "electron";
app.commandLine.appendSwitch('disable-gpu');
import { getEncoding, Tiktoken } from "js-tiktoken";
import {ConfigWindow} from './windows/ConfigWindow';
import {ChatWindow} from './windows/ChatWindow';
import {SummaryManagerWindow} from './windows/SummaryManagerWindow';
import { ConversationHistoryWindow } from './windows/ConversationHistoryWindow';
import { Config } from '../shared/Config';
import { DiaryGenerator } from './diary/DiaryGenerator';
import { RunFileManager } from './RunFileManager.js';
import { ClipboardListener } from "./ClipboardListener";
import { Conversation } from "./conversation/Conversation";
import { GameData } from "../shared/gameData/GameData";
import { Letter } from "./letter/Letter";
import { Letter as ILetter, StoredLetter } from "./letter/letterInterfaces";
import { LetterReplyGenerator } from "./letter/LetterReplyGenerator";
import { LetterManager } from "./letter/LetterManager";
import { LetterApprovalQueue } from "./letter/LetterApprovalQueue";
import { LetterActionTrigger } from "./letter/LetterActionTrigger.js";
import { parseLog } from "../shared/gameData/parseLog";
import { parseLettersFromLog } from "./letter/parseLogForLetters";
import { parseLogForBookmarks } from "./parseLogforbookmarks";
import { processBookmarkToSummary } from "./bookmarktosummary";
import { getPlayerId, getAllPlayerIds, readSummaryFile, saveSummaryFile, readCharacterMap, saveCharacterMap, exportPlayerData, importPlayerData } from "./summaryManager";
import { getCharacterDescription, saveCharacterDescription, getCharacterDescriptionPlayers, getCharacterDescriptionCharacters } from "./characterDescription";
import { parseDiaryIdsFromLog, getAllDiaryPlayerIds, getDiaryFiles, readDiaryFile, saveDiaryFile, getCharacterMap as getDiaryCharacterMap, readDiarySummaries, saveDiarySummaries, getAllDiarySummaries } from "./diaryManager";
import { getConversationHistoryFiles, readConversationHistoryFile } from "./conversationHistory";
import { readPromptHistory, savePromptHistory } from "./promptHistory";
import { Message, ActionResponse } from "./ts/conversation_interfaces";
import { ActionEffectWriter } from "./conversation/ActionEffectWriter";
import path from 'path';
import fs from 'fs';
import { randomUUID } from "crypto";
import { checkUserData } from "./userDataCheck";
import { updateElectronApp } from 'update-electron-app';
import { ReadmeWindow } from './windows/ReadmeWindow';
import { setCachedGameData, getCachedGameData, clearCachedGameData } from './gameDataCache';
import { compactedMemoryStore } from './compactedMemoryStore';
import { MemoryManager, Memory } from './memoryManager';
import { ApiConnection, EmbeddingProvider, getEffectiveEmbeddingDimension } from '../shared/apiConnection';
import { getConfig } from "./configManager";
const shell = require('electron').shell;
const packagejson = require('../../package.json');

let tiktokenEncoder: Tiktoken | null = null;

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
        configWindow = new ConfigWindow(chatWindow.window);
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
let votcDataPath: string;

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





let chatWindow: ChatWindow;
let configWindow: ConfigWindow; // This will be the frameless, in-chat window
let mainConfigWindow: BrowserWindow | null = null; // This will be the framed, startup window
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
                        configWindow = new ConfigWindow(chatWindow.window);
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
                configWindow = new ConfigWindow(chatWindow.window);
            }
            else if(configWindow.window.isMinimized()){
                configWindow.window.focus();
            }
        });
    } catch (error) {
        console.error("Failed to create tray icon:", error);
    }
};

let clipboardListener: ClipboardListener;
let config: Config;
let diaryGenerator: DiaryGenerator;
let memoryManager: MemoryManager;

let letterThreadCount = 0;
let letterThreadFullNotified = false;

let currentSessionPlayerId: string | null = null;
let currentTotalDays: number = 0;
const storedLetters: Map<string, StoredLetter> = new Map();
let lastLetterSentToGame: StoredLetter | null = null;
let lastLetterSentToGameTime: number = 0;

// --- Private helpers for testing ---
export function _private_setCurrentTotalDays(days: number): void { currentTotalDays = days; }
export function _private_getStoredLetters(): Map<string, StoredLetter> { return storedLetters; }
export function _private_setLastLetterSentToGame(letter: StoredLetter | null): void { lastLetterSentToGame = letter; }
export function _private_setSessionPlayerId(id: string | null): void { currentSessionPlayerId = id; }
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
        if (currentTotalDays > 0) {
            checkAndDeliverLetters();
        } else {
            console.log('rehydratePendingReplyLetters: Skipping immediate delivery check as currentTotalDays is not yet initialized.');
        }
    }
}

export async function checkAndDeliverLetters() {
    if (currentTotalDays === 0) {
        console.warn("Skipping letter delivery: currentTotalDays is uninitialized.");
        return;
    }

    let gameData = await parseLog(path.join(config.userFolderPath, 'logs', 'debug.log'));
    if (!gameData) {
        gameData = getCachedGameData() ?? undefined;
    }

    if (!gameData) {
        console.warn("Could not parse game data during letter delivery. Using currentTotalDays fallback for date.");
        const gameDate = totalDaysToDateString(currentTotalDays);
        // Further logic to handle letter delivery without full gameData would be needed here.
        // For now, we'll just log the warning and return.
        return;
    }
    const letterManager = LetterManager.getInstance();

    // If a previous delivery never got VOTC:LETTER_ACCEPTED, unblock after the timeout.
    if (lastLetterSentToGame && Date.now() - lastLetterSentToGameTime > LETTER_DELIVERY_TIMEOUT_MS) {
        console.warn(`Letter delivery timed out for letter ${lastLetterSentToGame.originalLetter.id} Ã¢â‚¬â€ no VOTC:LETTER_ACCEPTED received. Clearing to allow future deliveries.`);
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
            let currentDateString: string;
            if (!gameData) {
                console.warn(`Could not parse game data during letter delivery. Using currentTotalDays fallback for date.`);
                currentDateString = totalDaysToDateString(currentTotalDays);
            } else {
                currentDateString = gameData.date;
            }
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
    const year = Math.max(1, Math.floor(totalDays / 365));
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

/**
 * Loads the action module and writes its effect to the letter run file, mirroring the
 * live-approve code path. Returns true on success. Used both for immediate approval of
 * the active player's actions and for executing queued approvals when a player resumes.
 */
/**
 * Resolves the letter thread name (e.g. "letter_1") for a queued/approved letter action
 * by looking up the stored letter and extracting the thread pattern from its subject.
 */
function resolveLetterName(playerId: string, characterId: string, letterId: string): string {
    try {
        const letter = LetterManager.getInstance().getAllLetters(playerId).find(l => l.id === letterId);
        const subject = letter?.subject ?? '';
        const match = subject.match(/letter_\d+/);
        if (match) return match[0];
        if (subject) return subject;
    } catch (e) {
        console.warn(`resolveLetterName: Failed to resolve letter name for letter ${letterId}:`, e);
    }
    console.warn(`resolveLetterName: Could not resolve letter name for letter ${letterId}; falling back to 'letter_1'.`);
    return 'letter_1';
}

async function executeLetterActionEffect(actionSignature: string, args: any[], sourceId: number, targetId: number, letterName: string): Promise<boolean> {
    try {
        const allActions: any[] = [];
        const actionsPath = path.join(votcDataPath, 'scripts', 'actions');
        const standardActionFiles = fs.readdirSync(path.join(actionsPath, 'standard')).filter(file => path.extname(file) === ".js");
        const customActionFiles = fs.readdirSync(path.join(actionsPath, 'custom')).filter(file => path.extname(file) === ".js");

        for (const file of standardActionFiles) {
            delete require.cache[require.resolve(path.join(actionsPath, 'standard', file))];
            allActions.push(require(path.join(actionsPath, 'standard', file)));
        }
        for (const file of customActionFiles) {
            delete require.cache[require.resolve(path.join(actionsPath, 'custom', file))];
            allActions.push(require(path.join(actionsPath, 'custom', file)));
        }

        const action = allActions.find(a => a.signature === actionSignature);
        if (!action) {
            console.error(`[LetterApprovalQueue] Action with signature '${actionSignature}' not found.`);
            return false;
        }

        const gameData = await parseLog(path.join(config.userFolderPath, 'logs', 'debug.log'));
        if (!gameData) {
            console.error('[LetterApprovalQueue] Could not parse gameData to execute letter action.');
            return false;
        }

        const letterRunFileManager = new RunFileManager(config.userFolderPath);
        let effectBody = "";
        action.run(gameData, (text: string) => { effectBody += text; }, args, sourceId, targetId);

        // Letter approvals use the letter-specific global scope variables, not the
        // positional conversation list prelude.
        ActionEffectWriter.writeLetterEffect(letterRunFileManager, sourceId, targetId, gameData.playerID, letterName, effectBody);
        letterRunFileManager.append(`root = {trigger_event = mcc_event_v2.9003}`);
        // Clear the letter actions file after the game has consumed it,
        // mirroring the conversation run file pattern (Conversation.ts ~line 1746).
        setTimeout(() => {
            letterRunFileManager.clear();
            console.log('[LetterApprovalQueue] Cleared letter actions file after trigger event.');
        }, 800);
        return true;
    } catch (e: any) {
        console.error(`[LetterApprovalQueue] Failed to execute letter action '${actionSignature}': ${e.message}`);
        return false;
    }
}

/**
 * Executes every queued approval belonging to the given player exactly once, removing
 * each entry from the queue on success. Called when the active session player becomes
 * that player.
 */
async function processQueuedApprovals(playerId: string): Promise<void> {
    // Only drain entries that are due: legacy entries with no game-date stamp (treated as due)
    // and entries whose gameDateTotalDays <= currentTotalDays. Future-dated entries stay queued.
    const queued = LetterApprovalQueue.getDueApprovalsForPlayer(playerId, currentTotalDays);
    if (queued.length === 0) return;
    console.log(`[LetterApprovalQueue] Processing ${queued.length} due queued letter action approval(s) for player ${playerId} (current day: ${currentTotalDays}).`);
    for (const entry of queued) {
        const letterName = entry.letterName ?? resolveLetterName(entry.playerId, entry.characterId, entry.letterId);
        const ok = await executeLetterActionEffect(entry.actionSignature, entry.args, entry.sourceId, entry.targetId, letterName);
        if (ok) {
            LetterApprovalQueue.removeQueuedApproval(entry.id);
            console.log(`[LetterApprovalQueue] Executed queued letter action '${entry.actionSignature}' for player ${playerId}.`);
        } else {
            console.warn(`[LetterApprovalQueue] Skipping queued letter action '${entry.actionSignature}' for player ${playerId} (execution failed).`);
        }
    }
}

function broadcastCurrentSessionPlayer(): void {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('current-session-player-changed', currentSessionPlayerId);
    });
}

export function updateCurrentDate(newTotalDays: number) {
    const oldPlayerId = currentSessionPlayerId;
    const oldTotalDays = currentTotalDays;

    // Detect time travel backwards (loading an older save)
    if (oldTotalDays > 0 && newTotalDays < oldTotalDays) {
        console.log(`Time travel detected (backwards). Removing letters sent after new date. | Old date: ${oldTotalDays} | New date: ${newTotalDays}`);
        removeLettersAfterDate(newTotalDays);
    }
    // Detect large time jump forward (more than 40 days), could be loading a different save
    else if (oldTotalDays > 0 && newTotalDays - oldTotalDays > 120) {
        console.log(`Large time jump forward detected. Clearing letters and potentially cache. | Old date: ${oldTotalDays} | New date: ${newTotalDays}`);
        // This could also indicate a new save, so we might clear more than just letters.
        // For now, we'll just remove letters.
        removeLettersAfterDate(newTotalDays);
    }

    currentTotalDays = newTotalDays;

    // After a potential time travel or large jump, re-evaluate the player ID
    if (fs.existsSync(votcDataPath)) {
        getPlayerId(votcDataPath).then(result => {
            const newPlayerId = result.playerId;
            if (newPlayerId && oldPlayerId !== newPlayerId) {
                console.log(`Player session changed from ${oldPlayerId} to ${newPlayerId}. Clearing cache.`);
                clearCachedGameData();
                currentSessionPlayerId = newPlayerId;
                broadcastCurrentSessionPlayer();
                processQueuedApprovals(newPlayerId);
            }
        });
    }
    else if (oldTotalDays > 0 && newTotalDays - oldTotalDays > 120) {
        console.log("Large time jump detected (>90 days). Assuming new save loaded, clearing all pending letters.");
        storedLetters.clear();
    }

    currentTotalDays = newTotalDays;
    console.log(`Game date updated to: ${currentTotalDays}`);
    checkAndDeliverLetters();

    // Drain due queued letter-action approvals for the active player on EVERY date tick,
    // not only on player change or conversation start. Future-dated entries remain queued
    // until their game date passes (handled inside processQueuedApprovals).
    if (currentSessionPlayerId != null && currentTotalDays > 0) {
        processQueuedApprovals(currentSessionPlayerId);
    }

    // Broadcast the date update to all renderer windows
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('game-date-updated', newTotalDays);
    });
}

let positionConfigScheduled = false;
function schedulePositionConfigWindow() {
    if (positionConfigScheduled) return;
    positionConfigScheduled = true;
    queueMicrotask(() => {
        positionConfigScheduled = false;
        positionConfigWindow();
    });
}

function positionConfigWindow() {
    if (!configWindow || !configWindow.isShown) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workArea;

    const PADDING = 20;
    const configWidth = 800; // A more reasonable default width
    const configHeight = height - (2 * PADDING);

    const target = {
        x: Math.round(width - configWidth - PADDING),
        y: Math.round(PADDING),
        width: configWidth,
        height: configHeight
    };

    // Idempotent: skip setBounds when the window is already at the target bounds.
    // This breaks the move/resize -> setBounds -> move/resize feedback loop that
    // causes flicker on Wayland compositors (VOTC-174).
    // ponytail: bounds-debounce is a known ceiling against event storms on Wayland
    // compositors; upgrade path is BrowserWindow#on('will-resize') if needed.
    const current = configWindow.window.getBounds();
    if (
        current.x === target.x &&
        current.y === target.y &&
        current.width === target.width &&
        current.height === target.height
    ) {
        return;
    }

    configWindow.window.setBounds(target);
}

// Broadcast to the Memories tab (hosted in the config window) that new memories
// were inserted into the vector DB, so the Memory Constellation auto-refreshes.
function sendMemoriesChanged() {
    if (configWindow && !configWindow.window.isDestroyed()) {
        configWindow.window.webContents.send('memory-constellation:memories-changed');
    }
}


ipcMain.on('request-config-toggle', () => {
    configWindow.toggle();
    if (configWindow.isShown) {
        positionConfigWindow();
    }
    chatWindow.window.webContents.send('config-window-toggled', { isShown: configWindow.isShown });
});

ipcMain.on('request-config-minimize', () => {
    configWindow.minimize();
    chatWindow.window.webContents.send('config-window-toggled', { isShown: false, minimized: true });
});

ipcMain.on('request-config-restore', () => {
    configWindow.restore();
    positionConfigWindow();
    chatWindow.window.webContents.send('config-window-toggled', { isShown: true, minimized: false });
});

ipcMain.on('request-config-close', () => {
    if (configWindow) {
        configWindow.hide();
        chatWindow.window.webContents.send('config-window-toggled', { isShown: false, minimized: false });
    }
});

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

    const CHUNK_SIZE = 512 * 1024; // 512KB Ã¢â‚¬â€ enough to find a recent VOTC:DATE
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
    try {
        console.log("Initializing tiktoken encoder at startup...");
        tiktokenEncoder = getEncoding("cl100k_base");
        console.log("Tiktoken encoder initialized.");
    } catch (e) {
        console.error("Failed to initialize tiktoken encoder at startup:", e);
    }
    console.log('App is ready event triggered.');
    userDataPath = app.getPath('userData');
    votcDataPath = path.join(userDataPath, 'votc_data');

   await checkUserData();
   compactedMemoryStore.migrateDataDirectory();
   console.log('User data check completed.');

    // Relocated config loading to happen earlier
    if (!fs.existsSync(path.join(votcDataPath, 'configs', 'config.json'))){
        let conf = await JSON.parse(fs.readFileSync(path.join(votcDataPath, 'configs', 'default_config.json')).toString());
        await fs.writeFileSync(path.join(votcDataPath, 'configs', 'config.json'), JSON.stringify(conf, null, '\t'))
    }

    config = new Config(path.join(votcDataPath, 'configs', 'config.json'));
    diaryGenerator = new DiaryGenerator(config, votcDataPath, tiktokenEncoder);
    const embeddingDimension = getEffectiveEmbeddingDimension(config?.embeddingApiConnectionConfig?.connection);
    memoryManager = new MemoryManager(votcDataPath, embeddingDimension);
    loadTranslations(config.language);
    console.log('Configuration loaded successfully.');

    // Initialize blank run files (letters.txt and votc.txt) if they don't exist
    if (config.userFolderPath) {
        const runFolderPath = path.join(config.userFolderPath, 'run');
        if (!fs.existsSync(runFolderPath)) {
            fs.mkdirSync(runFolderPath, { recursive: true });
            console.log(`Created CK3 run folder at: ${runFolderPath}`);
        }
        const lettersFilePath = path.join(runFolderPath, 'letters.txt');
        if (!fs.existsSync(lettersFilePath)) {
            fs.writeFileSync(lettersFilePath, '\uFEFF' + "debug_log = \"[Localize('talk_event.9999.desc')]\"", 'utf-8');
            console.log(`Created blank letters.txt at: ${lettersFilePath}`);
        }
        const votcFilePath = path.join(runFolderPath, 'votc.txt');
        if (!fs.existsSync(votcFilePath)) {
            fs.writeFileSync(votcFilePath, '', 'utf-8');
            console.log(`Created blank votc.txt at: ${votcFilePath}`);
        }
    } else {
        console.warn('Cannot initialize run files: userFolderPath is not configured.');
    }

    // Initialize the current game date from the last known VOTC:DATE in the log.
    await initCurrentDateFromLog();

    // Re-hydrate any pending reply letters that were not delivered before the last app restart.
    const letterManager = LetterManager.getInstance();
    for (const { id } of letterManager.getAllPlayerIdsWithLetters()) {
        rehydratePendingReplyLetters(id);
    }

    // Automatically import legacy memories for the current player on startup
    if (config.userFolderPath) {
        getPlayerId(votcDataPath).then(playerInfo => {
            if (playerInfo && playerInfo.playerId) {
                console.log(`Startup: Found current player ID ${playerInfo.playerId}. Triggering legacy memory import.`);
                importLegacyMemories(playerInfo.playerId);
            }
        }).catch(err => {
            console.error('Startup: Could not determine player ID for automatic legacy import.', err);
        });
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
    const dlcLoadPath = path.join(config.userFolderPath, 'dlc_loadon');
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
                "Warcraft: Guardians of Azeroth 2": { modPath: "mod/ugc_2949767945.mod", presetName: "Warcraft: Guardians of Azeroth 2" },
                "Elder Kings 2": { modPath: "mod/ugc_2887120253.mod", presetName: "Elder Kings 2" }
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
            console.error('Failed to read or parse dlc_loadon:', err);
        }
    }

    // Tokenizer IPC handlers
    ipcMain.handle('calculate-tokens', async (event, text: string) => {
        try {
            if (config?.textGenerationApiConnectionConfig?.connection) {
                // Import ApiConnection dynamically to avoid circular dependencies
                const { ApiConnection } = await import('../shared/apiConnection');
                const apiConnection = new ApiConnection(
                    config.textGenerationApiConnectionConfig.connection,
                    config.textGenerationApiConnectionConfig.parameters,
                    tiktokenEncoder
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
                const { ApiConnection } = await import('../shared/apiConnection');
                const apiConnection = new ApiConnection(
                    connectionConfig,
                    config.textGenerationApiConnectionConfig.parameters,
                    tiktokenEncoder
                );
                const detectedContext = apiConnection.context || 0;
                if (detectedContext > 0) {
                    return detectedContext;
                }

                // 3. If API detection fails, use custom context if available
                if (connectionConfig.customContext > 0) {
                    return Number(connectionConfig.customContext);
                }
            }
        } catch (error) {
            console.error('Error getting context limit in main:', error);
        }
        // 4. If all else fails, return a safe default
        return 8192;
    });

    // --- Neural Memory System IPC Handlers ---

    // Embedding configuration handlers
    ipcMain.handle('check-dimension-mismatch', async () => {
        if (memoryManager) {
            return memoryManager.dimensionMismatchDetected && (memoryManager.getTotalMemoryCount() > 0);
        }
        return false;
    });

    ipcMain.handle('get-embedding-config', async () => {
        console.log('IPC: Received get-embedding-config event.');
        if (config?.embeddingApiConnectionConfig) {
            return config.embeddingApiConnectionConfig;
        }
        // Return sensible defaults if not configured
        return {
            connection: {
                type: 'openai',
                baseUrl: 'https://api.openai.com/v1',
                key: '',
                model: 'text-embedding-3-small',
                forceInstruct: false,
                overwriteContext: false,
                customContext: 0
            },
            parameters: {}
        };
    });

    ipcMain.handle('save-embedding-config', async (event, newConfig: any) => {
        console.log('IPC: Received save-embedding-config event.');
        try {
            if (!config.embeddingApiConnectionConfig) {
                config.embeddingApiConnectionConfig = {} as any;
            }
            Object.assign(config.embeddingApiConnectionConfig, newConfig);
            config.export();
            return { success: true };
        } catch (error: any) {
            console.error('Error saving embedding config:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('test-embedding-connection', async (event, providerConfig: {
        provider: string;
        model: string;
        baseUrl: string;
        apiKey: string;
        expectedDimension?: number;
        embeddingInputType?: string;
    }) => {
        console.log('IPC: Received test-embedding-connection event.');
        try {
            const provider = new EmbeddingProvider(
                providerConfig.provider as any,
                providerConfig.model,
                providerConfig.baseUrl,
                providerConfig.apiKey,
                providerConfig.expectedDimension,
                providerConfig.embeddingInputType
            );
            const result = await provider.testConnection();
            return result;
        } catch (error: any) {
            console.error('Error testing embedding connection:', error);
            return {
                success: false,
                message: error?.message || String(error),
                provider: providerConfig.provider
            };
        }
    });

    // Memory CRUD handlers
    ipcMain.handle('get-memories', async (event, filter: { playerId?: string; characterId?: string; limit?: number } | string, legacyLimit?: number) => {
        // Support both old (string) and new (object) calling conventions
        let characterId: string;
        let playerId: string | undefined;
        let limit: number | undefined;

        if (typeof filter === 'string') {
            // Legacy: called as get-memories(characterId, limit)
            characterId = filter;
            limit = legacyLimit;
        } else if (filter && typeof filter === 'object') {
            // New: called as get-memories({ playerId, characterId })
            characterId = filter.characterId || '';
            playerId = filter.playerId || undefined;
            limit = filter.limit;
        } else {
            characterId = '';
        }

        console.log(`IPC: Received get-memories for character: ${characterId}, player: ${playerId || 'any'}`);
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            const memories = memoryManager.getMemoriesByCharacter(characterId, limit || 100, playerId);
            // Convert Float32Array vectors to regular arrays for IPC serialization
            const serializable = memories.map(m => ({
                ...m,
                vector: Array.from(m.vector || [])
            }));
            return { success: true, memories: serializable };
        } catch (error: any) {
            console.error('Error getting memories:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('add-memory', async (event, memoryData: {
        characterId: string;
        text: string;
        vector?: number[];
        emotion?: string;
        scene?: string;
        timestamp?: number;
    }) => {
        console.log(`IPC: Received add-memory for character: ${memoryData.characterId}`);
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            if (!memoryData.characterId) {
                return { success: false, error: 'characterId is required.' };
            }
            if (!memoryData.text) {
                return { success: false, error: 'text is required.' };
            }

            const memory = {
                id: randomUUID(),
                characterId: memoryData.characterId,
                scene: memoryData.scene || '',
                text: memoryData.text,
                vector: memoryData.vector || [],
                timestamp: memoryData.timestamp || Date.now(),
                emotion: memoryData.emotion || 'neutral',
                decay: 0.0,
                accessCount: 0,
                lastAccessed: Date.now()
            };

            memoryManager.insertMemory(memory);
            return { success: true, id: memory.id };
        } catch (error: any) {
            console.error('Error adding memory:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('search-memories', async (event, characterId: string, queryVector: number[], topK?: number) => {
        console.log(`IPC: Received search-memories for character: ${characterId}`);
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            const results = memoryManager.searchSimilar(characterId, queryVector, { topK: topK || 10 });
            const serializable = results.map(m => ({
                ...m,
                vector: Array.from(m.vector || [])
            }));
            return { success: true, memories: serializable };
        } catch (error: any) {
            console.error('Error searching memories:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('delete-memory', async (event, memoryId: string) => {
        console.log(`IPC: Received delete-memory for id: ${memoryId}`);
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            memoryManager.deleteMemory(memoryId);
            return { success: true };
        } catch (error: any) {
            console.error('Error deleting memory:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('update-memory', async (event, memoryData: { id: string; text?: string; emotion?: string }) => {
        console.log(`IPC: Received update-memory for id: ${memoryData.id}`);
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            if (!memoryData.id) {
                return { success: false, error: 'id is required.' };
            }
            const updates: any = {};
            if (memoryData.text !== undefined) updates.text = memoryData.text;
            if (memoryData.emotion !== undefined) updates.emotion = memoryData.emotion;
            memoryManager.updateMemory(memoryData.id, updates);
            return { success: true };
        } catch (error: any) {
            console.error('Error updating memory:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('delete-memories-by-character', async (event, characterId: string) => {
        console.log(`IPC: Received delete-memories-by-character for: ${characterId}`);
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            memoryManager.deleteMemoriesByCharacter(characterId);
            return { success: true };
        } catch (error: any) {
            console.error('Error deleting memories by character:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('apply-memory-decay', async (event, characterId: string) => {
        console.log(`IPC: Received apply-memory-decay for character: ${characterId}`);
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            memoryManager.applyDecay(characterId);
            return { success: true };
        } catch (error: any) {
            console.error('Error applying memory decay:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('consolidate-memories', async (event, characterId: string) => {
        console.log(`IPC: Received consolidate-memories for character: ${characterId}`);
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            memoryManager.consolidateMemories(characterId);
            return { success: true };
        } catch (error: any) {
            console.error('Error consolidating memories:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    ipcMain.handle('get-memory-count', async (event, filter: { playerId?: string; characterId?: string } | string) => {
        // Support both legacy (characterId string) and new ({ playerId, characterId }) calling conventions
        let characterId: string;
        let playerId: string | undefined;
        if (typeof filter === 'string') {
            characterId = filter;
        } else if (filter && typeof filter === 'object') {
            characterId = filter.characterId || '';
            playerId = filter.playerId || undefined;
        } else {
            characterId = '';
        }
        console.log(`IPC: Received get-memory-count for character: ${characterId}, player: ${playerId || 'any'}`);
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            const count = playerId
                ? memoryManager.getPlayerMemoryCount(playerId, characterId || undefined)
                : (characterId ? memoryManager.getMemoryCount(characterId) : memoryManager.getTotalMemoryCount());
            // Diagnostic: if a player-scoped count returns 0 but memories exist elsewhere,
            // surface the likely player_id mismatch in the debug log so the UI is diagnosable.
            if (playerId && count === 0) {
                const total = memoryManager.getTotalMemoryCount();
                const characterOnly = characterId ? memoryManager.getMemoryCount(characterId) : 0;
                if (total > 0 || characterOnly > 0) {
                    console.warn(`get-memory-count: player-scoped count is 0 for playerId=${playerId}${characterId ? ', characterId=' + characterId : ''}, but total=${total}, character-only=${characterOnly}. Likely a player_id mismatch on stored memories.`);
                }
            }
            return { success: true, count };
        } catch (error: any) {
            console.error('Error getting memory count:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    // Re-embed all stored memories at the currently configured embedding dimension
    // and rebuild the sqlite-vec index. Used when the user changes the embedding
    // model / dimension override so existing memories are preserved, not discarded.
    ipcMain.handle('reindex-embedding-dimensions', async () => {
        console.log('IPC: Received reindex-embedding-dimensions event.');
        try {
            if (!memoryManager) {
                return { success: false, error: 'Memory manager not initialized.' };
            }
            const conn = config?.embeddingApiConnectionConfig?.connection;
            if (!conn || !conn.type || !conn.model || !conn.baseUrl) {
                return { success: false, error: 'Embedding API connection is not configured.' };
            }

            const targetDimension = getEffectiveEmbeddingDimension(conn);
            const provider = new EmbeddingProvider(
                conn.type as any,
                conn.model,
                conn.baseUrl,
                conn.key,
                targetDimension,
                conn.embeddingInputType
            );

            // Brief rate limiting between calls to avoid flooding external APIs.
            const result = await memoryManager.reindexMemories(async (text) => {
                const vector = await provider.embed(text);
                await sleep(75);
                return vector;
            }, targetDimension);

            sendMemoriesChanged();
            return { success: true, ...result };
        } catch (error: any) {
            console.error('Error reindexing embedding dimensions:', error);
            return { success: false, error: error?.message || String(error) };
        }
    });

    // Function to handle the import logic, callable from multiple places
    async function importLegacyMemories(playerId: string) {
        try {
            console.log(`Executing import of legacy memories for player ${playerId}`);
            const currentConfig = config; // Use the live app configuration (updated when the user saves settings), not the stale cached config from configManager

            // 1. Load all legacy compacted memories from JSON files
            const { memories: compactedMemories } = await compactedMemoryStore.getAllCompactedMemories(playerId);
            if (!compactedMemories || compactedMemories.length === 0) {
              console.log(`No legacy memories found for player ${playerId}. Import not needed.`);
              return { success: true, count: 0, message: 'No legacy memories found to import.' };
            }

            // 2. Initialize the necessary tools
            const importDimension = getEffectiveEmbeddingDimension(currentConfig?.embeddingApiConnectionConfig?.connection);
            const localMemoryManager = new MemoryManager(votcDataPath, importDimension);
            if (!currentConfig.embeddingApiConnectionConfig) {
                throw new Error("Embedding API connection is not configured.");
            }
            const embeddingApi = new ApiConnection(currentConfig.embeddingApiConnectionConfig.connection, currentConfig.embeddingApiConnectionConfig.parameters, null);

            // 3. Transform and vectorize the legacy memories
            const memoriesToInsert: Memory[] = [];
            for (const compacted of compactedMemories) {
              try {
                const embedding = await embeddingApi.embed(compacted.content);
                memoriesToInsert.push({
                  id: compacted.id,
                  characterId: compacted.characterIds[0]?.toString() || '',
                  playerId: playerId,
                  text: compacted.content,
                  vector: embedding,
                  timestamp: compacted.creationTimestamp,
                  emotion: 'neutral', // Legacy memories don't have emotion
                  decay: 0,
                  accessCount: 0,
                  lastAccessed: Date.now(),
                });
              } catch (e) {
                console.error(`Failed to generate embedding for legacy memory ${compacted.id}:`, e);
              }
            }

            // 4. Batch insert into the new database
            if (memoriesToInsert.length > 0) {
              localMemoryManager.batchInsertMemories(memoriesToInsert);
              sendMemoriesChanged();
            }

            localMemoryManager.close();
            console.log(`Finished importing ${memoriesToInsert.length} legacy memories for player ${playerId}.`);
            return { success: true, count: memoriesToInsert.length };
          } catch (error: any) {
            console.error(`Failed to import legacy memories for player ${playerId}:`, error);
            return { success: false, error: error.message };
          }
    }

    // Checks how many legacy compacted memories are already embedded in the vector DB.
    async function getLegacyMemoryStatus(playerId: string) {
        try {
            const { memories: compactedMemories } = await compactedMemoryStore.getAllCompactedMemories(playerId);
            if (!compactedMemories || compactedMemories.length === 0) {
                return { success: true, hasLegacy: false, totalLegacy: 0, loadedCount: 0, allLoaded: false };
            }

            const statusDimension = getEffectiveEmbeddingDimension(config?.embeddingApiConnectionConfig?.connection);
            const localMemoryManager = new MemoryManager(votcDataPath, statusDimension);
            let loadedCount = 0;
            for (const compacted of compactedMemories) {
                if (localMemoryManager.hasMemory(compacted.id)) {
                    loadedCount++;
                }
            }
            localMemoryManager.close();

            return {
                success: true,
                hasLegacy: true,
                totalLegacy: compactedMemories.length,
                loadedCount,
                allLoaded: loadedCount >= compactedMemories.length
            };
        } catch (error: any) {
            console.error(`Failed to check legacy memory status for player ${playerId}:`, error);
            return { success: false, error: error.message };
        }
    }

    ipcMain.handle('import-legacy-memories', async (event, playerId: string) => {
        console.log(`IPC: Received request to import legacy memories for player ${playerId}`);
        return await importLegacyMemories(playerId);
    });


    ipcMain.handle('get-legacy-memory-status', async (event, playerId: string) => {
        console.log(`IPC: Received request to check legacy memory status for player ${playerId}`);
        return await getLegacyMemoryStatus(playerId);
    });

    //logging
    var util = require('util');

    var log_file = fs.createWriteStream(path.join(votcDataPath, 'logs', 'debug.log'), {flags : 'w'});

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


    // Create and show the main, framed config window on startup
    mainConfigWindow = new BrowserWindow({
        width: 1280,
        height: 600,
        minWidth: 1280,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    mainConfigWindow.loadFile('./public/configWindow/connection.html');
    mainConfigWindow.removeMenu();
    if(!app.isPackaged){
        mainConfigWindow.webContents.openDevTools();
    }
    mainConfigWindow.on('closed', () => {
        mainConfigWindow = null;
    });

    chatWindow = new ChatWindow();
    console.log('ChatWindow created.');
    configWindow = new ConfigWindow(chatWindow.window); // This is the frameless window for in-chat use
    console.log('ConfigWindow created.');

    chatWindow.window.on('move', schedulePositionConfigWindow);
    chatWindow.window.on('resize', schedulePositionConfigWindow);

    readmeWindow = new ReadmeWindow();
    console.log('ReadmeWindow created.');

    // Ã¦Â£â‚¬Ã¦Å¸Â¥Ã¦ËœÂ¯Ã¥ÂÂ¦Ã¦ËœÂ¯Ã©Â¦â€“Ã¦Â¬Â¡Ã¥ÂÂ¯Ã¥Å Â¨
    // checkFirstRunAndShowReadme(); // Disabled: Don't show help window on startup

    chatWindow.window.on('closed', () =>{
        console.log('Chat window closed. Quitting application.');
        app.quit()
    });

    clipboardListener = new ClipboardListener();
    clipboardListener.start();
    console.log('ClipboardListener started.');


    configWindow.window.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

ipcMain.on('open-external-link', (event, url: string) => {
    console.log('IPC: Ã¦â€°â€œÃ¥Â¼â‚¬Ã¥Â¤â€“Ã©Æ’Â¨Ã©â€œÂ¾Ã¦Å½Â¥:', url);
    shell.openExternal(url);
});

ipcMain.on('update-app', ()=>{
    console.log('IPC: Received update-app event.');
    checkForUpdates();
});

// READMEÃ§Âªâ€”Ã¥ÂÂ£Ã§â€ºÂ¸Ã¥â€¦Â³IPCÃ¤Âºâ€¹Ã¤Â»Â¶
ipcMain.on('close-readme-window', () => {
    console.log('IPC: Ã¥â€¦Â³Ã©â€”Â­READMEÃ§Âªâ€”Ã¥ÂÂ£');
    if (readmeWindow && !readmeWindow.isDestroyed()) {
        readmeWindow.close();
    }
});

  ipcMain.on('open-readme-window', () => {
      console.log('IPC: Ã¦â€°â€œÃ¥Â¼â‚¬READMEÃ§Âªâ€”Ã¥ÂÂ£');
      if (readmeWindow && !readmeWindow.isDestroyed()) {
          readmeWindow.show();
      } else {
          // Ã¥Â¦â€šÃ¦Å¾Å“Ã§Âªâ€”Ã¥ÂÂ£Ã¤Â¸ÂÃ¥Â­ËœÃ¥Å“Â¨Ã¦Ë†â€“Ã¨Â¢Â«Ã©â€â‚¬Ã¦Â¯ÂÃ¯Â¼Å’Ã©â€¡ÂÃ¦â€“Â°Ã¥Ë†â€ºÃ¥Â»Âº
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
            const remPath = path.join(votcDataPath, 'conversation_summaries');

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
let isConversationReady = false;
let pendingMessages: Message[] = [];
let conversationLock: Promise<void> | null = null;

clipboardListener.on('VOTC:IN', async () =>{
    console.log('ClipboardListener: VOTC:IN event detected. Showing chat window.');

    // Reset state for the new conversation session
    isConversationReady = false;
    pendingMessages = [];
    // @ts-ignore
    conversation = null;

    // 1. Register the listener immediately. It will contain all the setup logic.
    ipcMain.once('chat-window-ready', async () => {
        console.log('IPC: Received chat-window-ready. Starting conversation setup.');
        chatWindow.window.webContents.send('chat-loading-data');
        try {
            // Check for incompatible mods
            const dlcLoadPath = path.join(config.userFolderPath, 'dlc_loadon');
            if (fs.existsSync(dlcLoadPath)) {
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
                    if (response === 0) shell.openExternal('https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139');
                    else if (response === 1) shell.openExternal('https://discord.gg/UQpE4mJSqZ');
                    app.quit();
                    return;
                }
            }

            // 3. Now do all the heavy lifting.
            await sleep(250);
            const logFilePath = path.join(config.userFolderPath, 'logs', 'debug.log');
            const gameData = await parseLog(logFilePath);
            if (!gameData || !gameData.playerID) {
                throw new Error(`Failed to parse game data from log file. Could not find "VOTC:IN" data in ${logFilePath}.`);
            }

            if (currentSessionPlayerId && currentSessionPlayerId !== String(gameData.playerID)) {
                console.log(`Player switch detected. Old: ${currentSessionPlayerId}, New: ${gameData.playerID}. Clearing pending letters.`);
                storedLetters.clear();
                lastLetterSentToGame = null;
            }
            setCachedGameData(gameData);
            currentSessionPlayerId = String(gameData.playerID);
            broadcastCurrentSessionPlayer();
            processQueuedApprovals(String(gameData.playerID));

            if (gameData.totalDays) {
                updateCurrentDate(gameData.totalDays);
            }
            conversation = new Conversation(gameData, config, chatWindow, votcDataPath, tiktokenEncoder);
            // Wire the memory-insertion callback so main broadcasts a Memories-tab refresh
            // whenever this conversation embeds new memories (compaction / summary embedding).
            conversation.onMemoriesEmbedded = () => sendMemoriesChanged();
            await conversation.loadHistory();
            await conversation.letterManager.importLettersFromLog(config, gameData, String(gameData.playerID), gameData.date, String(gameData.aiID));

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

            const payload = {
                gameData: conversation.gameData,
                messages: conversation.messages,
                narratives: (conversation as any).narratives ? Array.from((conversation as any).narratives) : [],
                historicalMetadata: conversation.historicalConversations || [],
                actions: sanitizedActions,
                basePromptTokens: await conversation.calculateBasePromptTokens()
            };

            // 4. Send the payload.
            chatWindow.window.webContents.send('chat-start', payload);

            // 5. Initialize the conversation logic after the UI has the data.
            await conversation.initialize();

            // 6. Mark conversation as ready and process any queued messages.
            isConversationReady = true;
            chatWindow.window.webContents.send('chat-ready');
            console.log('Conversation is ready. Processing pending messages.');
            if (pendingMessages.length > 0) {
                console.log(`Processing ${pendingMessages.length} queued message(s).`);
                pendingMessages.forEach(msg => conversation.pushMessage(msg));
                pendingMessages = []; // Clear the queue
                await conversation.generateAIsMessages(); // Trigger a single generation cycle for the queued messages
            }

        } catch (err) {
            console.error("Error during VOTC:IN setup:", err);
            isConversationReady = false; // Ensure state is correct on failure
            if(chatWindow.isShown){
                const msg = err instanceof Error ? err.message : (err ? String(err) : 'An error occurred.');
                chatWindow.window.webContents.send('error-message', msg);
            }
        }
    });

    // 2. Show the window, which will trigger the 'chat-window-ready' event from the renderer.
    chatWindow.show();
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

            // Guard: never auto-execute letter actions when manual approval is enabled.
            // This branch is currently dead (associatedAction is never assigned), but if it
            // is ever enabled, it must still respect manualLetterActionApproval.
            if (!config.manualLetterActionApproval && replyLetter.associatedAction?.triggerOn === 'send') {
              LetterActionTrigger.executeLetterAction(replyLetter, replyLetter.associatedAction, config);
            }

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
        const bookmarkScriptPath = config.selectedBookmarkScript || 'standard/shaosongon';
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
        let characterNameMap: Map<string, string> = await readCharacterMap(votcDataPath, playerId);

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
        await saveCharacterMap(votcDataPath, playerId, mapToSave);
        console.log(`Updated character map before letter import for player ${playerId}`);


        // Import letters from log, which now also saves them.
        // Retry import up to 5 times with increasing delays to handle log flush timing
        let latestLetter: ILetter | null = null;
        let allPlayerLetters: ILetter[] = [];
        const maxRetries = 5;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            await letterManager.importLettersFromLog(config, gameData, playerId, gameDate, recipientId);
            console.log(`Imported and saved letters immediately after VOTC:LETTER event (attempt ${attempt + 1}/${maxRetries}).`);

            // Refresh the letters UI to show the new letter in the outbox
            if (configWindow && !configWindow.window.isDestroyed()) {
                configWindow.window.webContents.send('letter-status-changed');
            }

            // Get all letters for the player and find the most recent one by creation date.
            allPlayerLetters = letterManager.getAllLetters(playerId);
            latestLetter = letterManager.getLatestLetter(playerId);

            if (latestLetter) {
                console.log(`Found latest letter ${latestLetter.id} on attempt ${attempt + 1}.`);
                break;
            }

            if (attempt < maxRetries - 1) {
                const delay = 250 * (attempt + 1); // 250ms, 500ms, 750ms, 1000ms
                console.log(`No letters found after import on attempt ${attempt + 1}. Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }

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

        const letterReplyGenerator = new LetterReplyGenerator(config, votcDataPath, tiktokenEncoder);
        const replyLetter = await letterReplyGenerator.generateLetterReply(gameData, latestLetter);

        // Diary entry for player sending a letter
        if (config.diaryGenerationChance > 0 && Math.random() < (config.diaryGenerationChance / 100)) {
            const playerCharacter = gameData.getCharacter(gameData.playerID);
            if (playerCharacter) {
                const newEntry = await diaryGenerator.generateDiaryEntryForLetter(gameData, playerCharacter, latestLetter.content, 'sent');
                if (newEntry) {
                    await saveDiaryFile(String(gameData.playerID), String(playerCharacter.id), newEntry);
                    const summaryResult = await diaryGenerator.summarizeDiaryEntry(newEntry, gameData);
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

        // Guard: never auto-execute letter actions when manual approval is enabled.
        // This branch is currently dead (associatedAction is never assigned), but if it
        // is ever enabled, it must still respect manualLetterActionApproval.
        if (!config.manualLetterActionApproval && replyLetter.associatedAction?.triggerOn === 'send') {
          LetterActionTrigger.executeLetterAction(replyLetter, replyLetter.associatedAction, config);
        }
        // Diary entry for AI receiving a letter and replying
        if (config.diaryGenerationChance > 0 && Math.random() < (config.diaryGenerationChance / 100)) {
            const aiCharacter = gameData.getCharacter(replyLetter.sender.id);
            if (aiCharacter) {
                const newEntry = await diaryGenerator.generateDiaryEntryForLetter(gameData, aiCharacter, replyLetter.content, 'received');
                if (newEntry) {
                    await saveDiaryFile(String(gameData.playerID), String(aiCharacter.id), newEntry);
                    const summaryResult = await diaryGenerator.summarizeDiaryEntry(newEntry, gameData);
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
    if (isConversationReady && conversation) {
        conversation.pushMessage(message);
        try {
            await conversation.generateAIsMessages();
        } catch (err) {
            console.error('Error during message generation:', err);
            if (chatWindow && chatWindow.window && !chatWindow.window.isDestroyed()) {
                const msg = err instanceof Error ? err.message : (err ? String(err) : 'An error occurred.');
                chatWindow.window.webContents.send('error-message', msg);
            }
        }
    } else {
        console.log('Conversation not ready. Queuing message.');
        pendingMessages.push(message);
    }
});

    // Ã¥Â¤â€žÃ§Ââ€ Ã¨Å½Â·Ã¥Ââ€“Ã¦Å½Â¨Ã¨ÂÂÃ¨Â¾â€œÃ¥â€¦Â¥Ã¨Â¯Â­Ã¥ÂÂ¥Ã§Å¡â€žÃ¨Â¯Â·Ã¦Â±â€š
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
    const presetsPath = path.join(votcDataPath, 'configs', 'prompt_presets.json');
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

ipcMain.handle('get-default-prompts', async () => {
    const lang = config.language || 'en';
    const promptsDir = path.join(app.getAppPath(), 'default_userdata', 'configs', 'prompts');
    const promptsPath = path.join(promptsDir, `${lang}.json`);
    const fallbackPath = path.join(promptsDir, 'en.json');
    let finalPath = promptsPath;

    if (!fs.existsSync(promptsPath)) {
        console.warn(`Prompt file for language '${lang}' not found at ${promptsPath}. Falling back to 'en.json'.`);
        finalPath = fallbackPath;
    }

    if (!fs.existsSync(finalPath)) {
        console.error(`Fallback prompt file 'en.json' not found at ${fallbackPath}. Cannot load prompts.`);
        return null;
    }

    try {
        const data = fs.readFileSync(finalPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Failed to read or parse prompt file ${finalPath}:`, error);
        return null;
    }
});

ipcMain.handle('save-prompt-presets', async (event, presets) => {
    console.log('IPC: Received save-prompt-presets event.');
    const presetsPath = path.join(votcDataPath, 'configs', 'prompt_presets.json');
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
    'actionPrompt',
    'letterPrompt',
    'letterSummaryPrompt',
    'diaryPrompt',
    'diarySummarizePrompt',
    'diaryForLetterPrompt'
];

ipcMain.on('config-change', (e, confID: string, newValue: any) =>{
    console.log(`IPC: Received config-change event. ID: ${confID}, New Value: ${newValue}`);

    if (promptKeys.includes(confID)) {
        // @ts-ignore
        if (!config.prompts) {
            // @ts-ignore
            config.prompts = {};
        }
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
    diaryGenerator = new DiaryGenerator(config, votcDataPath, tiktokenEncoder); // Re-initialize with new config
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }

    // Ã¥Â°â€ Ã©â€¦ÂÃ§Â½Â®Ã¥ÂËœÃ¦â€ºÂ´Ã¥Ââ€˜Ã©â‚¬ÂÃ¥Ë†Â°Ã¨ÂÅ Ã¥Â¤Â©Ã§Âªâ€”Ã¥ÂÂ£
    if (chatWindow.window) {
        chatWindow.window.webContents.send('config-change', confID, newValue);
    }
})

ipcMain.on('config-change-nested', (e, outerConfID: string, innerConfID: string, newValue: any) =>{
    console.log(`IPC: Received config-change-nested event. Outer ID: ${outerConfID}, Inner ID: ${innerConfID}, New Value: ${newValue}`);

    // Ensure the outer config object exists (e.g. embeddingApiConnectionConfig)
    if (!(config as any)[outerConfID]) {
        (config as any)[outerConfID] = {};
    }

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
    diaryGenerator = new DiaryGenerator(config, votcDataPath, tiktokenEncoder); // Re-initialize with new config
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
    diaryGenerator = new DiaryGenerator(config, votcDataPath, tiktokenEncoder); // Re-initialize with new config
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
        // This now saves history synchronously and triggers async summarization
        conversation.saveHistoryAndTriggerSummarization();
        // Clean up compaction resources when conversation ends
        conversation.cleanup();
    }

    // Reset conversation state
    isConversationReady = false;
    pendingMessages = [];
    // @ts-ignore
    conversation = null;
})

// Memory Compaction IPC Handlers
ipcMain.on('manual-compaction-trigger', async (event) => {
    console.log('IPC: Received manual-compaction-trigger event.');
    if (conversation && conversation.memoryCompactor) {
        try {
            const result = await conversation.memoryCompactor.compact(conversation);
            event.sender.send('compaction-status-update', result);
            console.log(`Manual compaction completed: Phase1=${result.phase1Run}, Phase2=${result.phase2Run}, Memories=${result.memoriesCreated}`);
        } catch (error) {
            console.error('Manual compaction failed:', error);
            event.sender.send('compaction-status-update', { phase1Run: false, phase2Run: false, memoriesCreated: 0, error: String(error) });
        }
    } else {
        event.sender.send('compaction-status-update', { phase1Run: false, phase2Run: false, memoriesCreated: 0, error: 'No active conversation or memory compactor not initialized' });
    }
});

ipcMain.handle('get-compaction-status', async () => {
    if (conversation && conversation.memoryCompactor) {
        const tokenCount = await conversation.calculateBasePromptTokens();
        const contextSize = conversation.textGenApiConnection.context || 8192;
        return conversation.memoryCompactor.getCompactionStatus(tokenCount, contextSize);
    }
    return {
        contextUsagePct: 0,
        phase1ThresholdPct: 70,
        tokenCount: 0,
        contextSize: 8192,
        isCompacting: false,
        enableCompaction: true,
        cooldownRemaining: 0,
        phase1SummaryCount: 0,
        phase2Threshold: 5,
    };
});

// Player Data Export/Import IPC Handlers
ipcMain.handle('export-player-data', async () => {
    console.log('IPC: Received export-player-data event.');
    try {
        const result = await dialog.showSaveDialog({
            title: t('dialog.export_player_data_title'),
            defaultPath: `votc_player_data_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`,
            filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
        });

        if (result.canceled || !result.filePath) {
            console.log('Export cancelled by user.');
            return { success: false, error: 'Export cancelled by user.' };
        }

        await exportPlayerData(votcDataPath, result.filePath);
        return { success: true, filePath: result.filePath };
    } catch (error) {
        console.error('Error exporting player data:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('import-player-data', async () => {
    console.log('IPC: Received import-player-data event.');
    try {
        const result = await dialog.showOpenDialog({
            title: t('dialog.import_player_data_title'),
            filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
            properties: ['openFile']
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            console.log('Import cancelled by user.');
            return { success: false, error: 'Import cancelled by user.' };
        }

        const importPath = result.filePaths[0];
        await importPlayerData(votcDataPath, importPath);
        return { success: true, filePath: importPath };
    } catch (error) {
        console.error('Error importing player data:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

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
                            conversation.saveHistoryAndTriggerSummarization();
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
                        const { parseVariables } = require('./parseVariables');
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

function broadcastCurrentSessionPlayer(): void {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('current-session-player-changed', currentSessionPlayerId);
    });
}

ipcMain.handle('get-current-session-player', () => currentSessionPlayerId);

ipcMain.on('approve-letter-action', async (event, { playerId, characterId, letterId, actionSignature, args, sourceId, targetId }) => {
    console.log(`IPC: Received approve-letter-action for action: ${actionSignature}`);
    try {
        // Robust active-player detection: trust the cached session player first (fast path),
        // then fall back to a fresh parse of debug.log when the cache is null or disagrees.
        // This prevents approvals for the currently played character from being queued just
        // because no conversation has started this session (cache never set) or is stale.
        let isActivePlayer = currentSessionPlayerId != null && playerId === currentSessionPlayerId;
        if (isActivePlayer) {
            console.log(`[LetterApprovalQueue] Active-player check passed via cached currentSessionPlayerId (${currentSessionPlayerId}).`);
        } else {
            const freshGameData = await parseLog(path.join(config.userFolderPath, 'logs', 'debug.log'));
            const freshPlayerId = freshGameData?.playerID != null ? String(freshGameData.playerID) : null;
            if (freshPlayerId != null && freshPlayerId === playerId) {
                isActivePlayer = true;
                console.log(`[LetterApprovalQueue] Active-player check passed via fresh debug.log parse (player ${playerId}); refreshing cached session player.`);
                currentSessionPlayerId = freshPlayerId;
                broadcastCurrentSessionPlayer();
            } else {
                console.log(`[LetterApprovalQueue] Active-player check failed for player ${playerId}: cached=${currentSessionPlayerId}, log=${freshPlayerId}. Approval will be queued.`);
            }
        }
        const letterName = resolveLetterName(playerId, characterId, letterId);
        // Timeline gating: an action must not fire before the letter has reached its
        // recipient (stage 1 of the journey = totalDays + floor(delay * 4/9)). If the
        // letter is still en route, queue the approval instead of executing now —
        // processQueuedApprovals drains it once the in-game date passes the due day.
        const approvalLetter = LetterManager.getInstance().getAllLetters(playerId).find(l => l.id === letterId);
        const stage1EndDay = approvalLetter
            ? approvalLetter.totalDays + Math.floor((approvalLetter.delay || 0) * 4 / 9)
            : null;
        const isDue = stage1EndDay == null || currentTotalDays >= stage1EndDay;

        if (isActivePlayer && isDue) {
            const ok = await executeLetterActionEffect(actionSignature, args, sourceId, targetId, letterName);
            if (!ok) {
                throw new Error(`Failed to execute approved letter action '${actionSignature}'.`);
            }
            console.log(`Approved letter action '${actionSignature}' executed successfully.`);
        } else if (isActivePlayer && !isDue) {
            // Active player, but letter has not arrived at the AI character yet.
            LetterApprovalQueue.queueApproval({ playerId, characterId, letterId, actionSignature, args, sourceId, targetId, letterName, gameDateTotalDays: stage1EndDay! });
            console.log(`Approved letter action '${actionSignature}' queued until letter delivery (day ${stage1EndDay}; current day ${currentTotalDays}).`);
        } else {
            // The letter belongs to a player who is not currently played. Persist the
            // approval status now, but queue the actual effect execution until that player
            // becomes the active session player. If the letter is still en route at that
            // point, stage1EndDay gates it; otherwise it is due immediately (currentTotalDays).
            const dueDay = stage1EndDay != null && stage1EndDay > currentTotalDays ? stage1EndDay : currentTotalDays;
            LetterApprovalQueue.queueApproval({ playerId, characterId, letterId, actionSignature, args, sourceId, targetId, letterName, gameDateTotalDays: dueDay });
            console.log(`Approved letter action '${actionSignature}' for non-active player ${playerId}. Queued for execution when that player is played.`);
        }
        // Persist the approval status so it survives navigation and app restarts.
        if (playerId && characterId) {
            LetterManager.getInstance().updateLetterActionStatus(playerId, characterId, letterId, actionSignature, 'approved');
        }
        event.sender.send('letter-action-approved', { letterId, actionSignature });

    } catch (e: any) {
        const errMsg = `Failed to execute approved letter action: ${e.message}`;
        console.error(errMsg);
        event.sender.send('error-message', errMsg);
    }
});

ipcMain.on('deny-letter-action', (event, { playerId, characterId, letterId, actionSignature }) => {
    console.log(`User denied letter action '${actionSignature}' for letter ${letterId}.`);
    // Persist the denial status so it survives navigation and app restarts.
    if (playerId && characterId) {
        LetterManager.getInstance().updateLetterActionStatus(playerId, characterId, letterId, actionSignature, 'denied');
    }
    event.sender.send('letter-action-denied', { letterId, actionSignature });
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
        const ids = await getPlayerId(votcDataPath);
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
        const conversationPlayerIds = await getAllPlayerIds(votcDataPath);
        const letterManager = LetterManager.getInstance();
        const letterPlayerIds = letterManager.getAllPlayerIdsWithLetters();

        // Get diary player IDs with their latest diary activity (same pattern as the get-all-diary-player-ids handler)
        const diaryPlayerIds = await getAllDiaryPlayerIds(votcDataPath);
        const diaryPlayersWithTs = await Promise.all(diaryPlayerIds.map(async (player) => {
            let latestTimestamp = 0;
            try {
                const characterIds = await getDiaryFiles(player.id);
                for (const charId of characterIds) {
                    const diaryData = await readDiaryFile(player.id, charId);
                    if (diaryData && diaryData.diary_entries) {
                        for (const entry of diaryData.diary_entries) {
                            if (entry.creationTimestamp) {
                                const ts = new Date(entry.creationTimestamp).getTime();
                                if (ts > latestTimestamp) latestTimestamp = ts;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`Error processing diaries for player ${player.id}:`, e);
            }
            return { ...player, latestTimestamp };
        }));

        // Merge all player IDs, keeping the greatest latestTimestamp seen across sources
        // (latestTimestamp is an additive/optional field exposed by getAllPlayerIds and LetterManager.getAllPlayerIdsWithLetters).
        const allPlayerIds = new Map<string, { id: string, name: string, latestTimestamp?: number }>();

        const mergePlayer = (player: { id: string, name: string, latestTimestamp?: number }) => {
            const existing = allPlayerIds.get(player.id);
            if (!existing) {
                allPlayerIds.set(player.id, { id: player.id, name: player.name, latestTimestamp: player.latestTimestamp || 0 });
            } else {
                existing.latestTimestamp = Math.max(existing.latestTimestamp || 0, player.latestTimestamp || 0);
            }
        };
        conversationPlayerIds.forEach(mergePlayer);
        letterPlayerIds.forEach(mergePlayer);
        diaryPlayersWithTs.forEach(mergePlayer);

        // Sort by most recent activity first so the currently-played save is at the top of the dropdown.
        const mergedPlayerIds = Array.from(allPlayerIds.values()).sort((a, b) => (b.latestTimestamp || 0) - (a.latestTimestamp || 0));
        // Strip the additive field from the response so the IPC contract ({ id, name }) is unchanged.
        return { success: true, ids: mergedPlayerIds.map(({ id, name }) => ({ id, name })) };
    } catch (error) {
        console.error('Error getting all player IDs:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

// Character Description IPC handlers
ipcMain.handle('get-character-description-players', async () => {
    console.log('IPC: Received get-character-description-players event.');
    try {
        const conversationPlayerIds = await getAllPlayerIds(userDataPath);
        const letterManager = LetterManager.getInstance();
        const letterPlayerIds = letterManager.getAllPlayerIdsWithLetters();
        const diaryPlayerIds = await getAllDiaryPlayerIds(userDataPath);

        const allPlayerIds = new Map<string, { id: string, name: string }>();
        conversationPlayerIds.forEach(player => { allPlayerIds.set(player.id, player); });
        letterPlayerIds.forEach(player => { if (!allPlayerIds.has(player.id)) { allPlayerIds.set(player.id, player); } });
        diaryPlayerIds.forEach(player => { if (!allPlayerIds.has(player.id)) { allPlayerIds.set(player.id, player); } });

        // Include players that only have character descriptions
        getCharacterDescriptionPlayers(userDataPath).forEach(player => {
            if (!allPlayerIds.has(player.id)) { allPlayerIds.set(player.id, player); }
        });

        // Strip the additive latestTimestamp field so the IPC response stays { id, name }.
        return { success: true, ids: Array.from(allPlayerIds.values()).map(({ id, name }) => ({ id, name })) };
    } catch (error) {
        console.error('Error getting character description players:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('get-character-description-characters', async (event, playerId: string) => {
    console.log(`IPC: Received get-character-description-characters event for player: ${playerId}`);
    try {
        const characters = new Map<string, { id: string, name: string }>();

        if (playerId === 'global') {
            // Build the union of characters across all player careers.
            const conversationPlayerIds = await getAllPlayerIds(userDataPath);
            const letterManager = LetterManager.getInstance();
            const letterPlayerIds = letterManager.getAllPlayerIdsWithLetters();
            const diaryPlayerIds = await getAllDiaryPlayerIds(userDataPath);

            const allPlayerIds = new Map<string, { id: string, name: string }>();
            conversationPlayerIds.forEach(player => { allPlayerIds.set(player.id, player); });
            letterPlayerIds.forEach(player => { if (!allPlayerIds.has(player.id)) { allPlayerIds.set(player.id, player); } });
            diaryPlayerIds.forEach(player => { if (!allPlayerIds.has(player.id)) { allPlayerIds.set(player.id, player); } });
            getCharacterDescriptionPlayers(userDataPath).forEach(player => {
                if (!allPlayerIds.has(player.id)) { allPlayerIds.set(player.id, player); }
            });

            for (const pid of allPlayerIds.keys()) {
                const characterMap = await readCharacterMap(userDataPath, pid);
                characterMap.forEach((name, id) => {
                    if (!characters.has(id)) { characters.set(id, { id, name }); }
                });
            }
        } else {
            const characterMap = await readCharacterMap(userDataPath, playerId);
            characterMap.forEach((name, id) => { characters.set(id, { id, name }); });

            // Ensure the player's own character is always selectable so users can
            // write a description for their own character.
            if (!characters.has(playerId)) {
                const playerName = characterMap.get(playerId) || `Player ${playerId}`;
                characters.set(playerId, { id: playerId, name: playerName });
            }
        }

        // Include characters that only have descriptions
        getCharacterDescriptionCharacters(userDataPath, playerId).forEach(char => {
            if (!characters.has(char.id)) { characters.set(char.id, char); }
        });

        return { success: true, ids: Array.from(characters.values()) };
    } catch (error) {
        console.error('Error getting character description characters:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('get-character-description', async (event, playerId: string, characterId: string) => {
    console.log(`IPC: Received get-character-description event for player: ${playerId}, character: ${characterId}`);
    return getCharacterDescription(userDataPath, playerId, characterId);
});

ipcMain.handle('save-character-description', async (event, playerId: string, characterId: string, description: string) => {
    console.log(`IPC: Received save-character-description event for player: ${playerId}, character: ${characterId}`);
    try {
        saveCharacterDescription(userDataPath, playerId, characterId, description);
        return { success: true };
    } catch (error) {
        console.error('Error saving character description:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('read-summary-file', async (event, playerId) => {
    console.log(`IPC: Received read-summary-file event for player: ${playerId}`);
    try {
        const summaries = await readSummaryFile(votcDataPath, playerId);

        const characterMapPath = path.join(votcDataPath, 'conversation_summaries', playerId, '_character_map.json');
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
        await saveSummaryFile(votcDataPath, playerId, summaryData);
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
        const map = await readCharacterMap(votcDataPath, playerId);
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
        const ids = await getAllDiaryPlayerIds(votcDataPath);
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
        const players = await getAllDiaryPlayerIds(votcDataPath);

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
        // we only want character id, so remove on
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
        diaryGenerator = new DiaryGenerator(config, votcDataPath, tiktokenEncoder);
    }

    try {
        const characterIds = new Set<string>([
            ...editedEntries.map((e: any) => e.character_id),
            ...deletedEntries.map((e: any) => e.character_id)
        ]);

        const mockGameData = { playerID: parseInt(playerId, 10) } as GameData;
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
                const newSummary = await diaryGenerator.summarizeDiaryEntry(entry, mockGameData);
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
        const files = await getConversationHistoryFiles(playerId, [], 0);
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
        const playerId = args ? args.playerId : (await getPlayerId(votcDataPath)).playerId;

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
    // Strip the additive latestTimestamp field so the IPC response stays { id, name }.
    return letterManager.getAllPlayerIdsWithLetters().map(({ id, name }) => ({ id, name }));
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
    letterManager.markAsRead(playerId, characterId, letterId, config);
    console.log(`Letter ${letterId} marked as read.`);
});

ipcMain.handle('delete-letter', async (event, { playerId, characterId, letterId }) => {
    console.log(`Received delete-letter request for player ${playerId}, char ${characterId}, letter ${letterId}`);
    const letterManager = LetterManager.getInstance();
    return letterManager.deleteLetter(playerId, characterId, letterId);
});


// Ã¥Â¤â€žÃ§Ââ€ APIÃ©â€¦ÂÃ§Â½Â®Ã¦â€ºÂ´Ã¦â€Â¹Ã¤Âºâ€¹Ã¤Â»Â¶
ipcMain.on('api-config-change', (e, configType: string, apiType: string, configData: any) => {
    console.log(`IPC: Received api-config-change event. Config Type: ${configType}, API Type: ${apiType}`);

    // Ã§Â¡Â®Ã¤Â¿ÂÃ©â€¦ÂÃ§Â½Â®Ã¥Â¯Â¹Ã¨Â±Â¡Ã¥Â­ËœÃ¥Å“Â¨
    if (!(config as any)[configType]) {
        (config as any)[configType] = {};
    }

    // Ã§Â¡Â®Ã¤Â¿ÂconnectionÃ¥Â¯Â¹Ã¨Â±Â¡Ã¥Â­ËœÃ¥Å“Â¨
    if (!(config as any)[configType].connection) {
        (config as any)[configType].connection = {};
    }

    // Ã§Â¡Â®Ã¤Â¿ÂapiKeysÃ¥Â¯Â¹Ã¨Â±Â¡Ã¥Â­ËœÃ¥Å“Â¨
    if (!(config as any)[configType].connection.apiKeys) {
        (config as any)[configType].connection.apiKeys = {};
    }

    // Ã¤Â¿ÂÃ¥Â­ËœAPIÃ©â€¦ÂÃ§Â½Â®Ã¥Ë†Â°apiKeysÃ¥Â¯Â¹Ã¨Â±Â¡Ã¤Â¸Â­
    (config as any)[configType].connection.apiKeys[apiType] = configData;

    // Ã¥Â¦â€šÃ¦Å¾Å“Ã¦ËœÂ¯Ã¥Â½â€œÃ¥â€°ÂÃ©â‚¬â€°Ã¤Â¸Â­Ã§Å¡â€žAPIÃ§Â±Â»Ã¥Å¾â€¹Ã¯Â¼Å’Ã¥ÂÅ’Ã¦â€”Â¶Ã¦â€ºÂ´Ã¦â€“Â°connectionÃ¥Â¯Â¹Ã¨Â±Â¡Ã¤Â¸Â­Ã§Å¡â€žÃ¤Â¸Â»Ã¨Â¦ÂÃ¥Â­â€”Ã¦Â®Âµ
    if ((config as any)[configType].connection.type === apiType) {
        (config as any)[configType].connection.key = configData.key || '';
        (config as any)[configType].connection.baseUrl = configData.baseUrl || '';
        (config as any)[configType].connection.model = configData.model || '';
    }

    // Ã¥Â¯Â¼Ã¥â€¡ÂºÃ©â€¦ÂÃ§Â½Â®
    config.export();

    // Ã¥Â¦â€šÃ¦Å¾Å“Ã¨ÂÅ Ã¥Â¤Â©Ã§Âªâ€”Ã¥ÂÂ£Ã¥Â·Â²Ã¦ËœÂ¾Ã§Â¤ÂºÃ¯Â¼Å’Ã¦â€ºÂ´Ã¦â€“Â°Ã¥Â¯Â¹Ã¨Â¯ÂÃ©â€¦ÂÃ§Â½Â®
    if(chatWindow.isShown){
        conversation.updateConfig(config);
    }
});

// Ã¥Â¤â€žÃ§Ââ€ Ã¥â€¦Â³Ã©â€”Â­Ã¥Â¯Â¹Ã¨Â¯ÂÃ¥Å½â€ Ã¥ÂÂ²Ã§Âªâ€”Ã¥ÂÂ£Ã§Å¡â€žÃ¨Â¯Â·Ã¦Â±â€š
ipcMain.on('close-conversation-history', () => {
    console.log('IPC: Received close-conversation-history event.');
    if (conversationHistoryWindow && !conversationHistoryWindow.isDestroyed()) {
        conversationHistoryWindow.close();
        console.log('Conversation history window closed.');
    }
});

// Ã¥Â¤â€žÃ§Ââ€ Ã¥â€¦Â³Ã©â€”Â­Ã¦â‚¬Â»Ã§Â»â€œÃ§Â®Â¡Ã§Ââ€ Ã¥â„¢Â¨Ã§Âªâ€”Ã¥ÂÂ£Ã§Å¡â€žÃ¨Â¯Â·Ã¦Â±â€š
ipcMain.on('close-summary-manager', () => {
    console.log('IPC: Received close-summary-manager event.');
    if (summaryManagerWindow && !summaryManagerWindow.isDestroyed()) {
        summaryManagerWindow.close();
        console.log('Summary manager window closed.');
    }
});

// Ã¥Â¤â€žÃ§Ââ€ Ã¤Â¸Â»Ã©Â¢ËœÃ¥Ë†â€¡Ã¦ÂÂ¢Ã¤Âºâ€¹Ã¤Â»Â¶
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
});
