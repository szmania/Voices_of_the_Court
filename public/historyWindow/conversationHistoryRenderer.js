const { ipcRenderer } = require('electron');

// DOM 元素
const playerIdInput = document.getElementById('playerId');
const checkpointValue = document.getElementById('checkpointValue');
const archiveTabs = document.getElementById('archiveTabs');
const conversationList = document.getElementById('conversationList');
const archiveKicker = document.getElementById('archiveKicker');
const conversationHeading = document.getElementById('conversationHeading');
const currentFileNameInput = document.getElementById('currentFileName');
const conversationText = document.getElementById('conversationText');
const statusMessage = document.getElementById('statusMessage');

// 按钮
const refreshBtn = document.getElementById('refreshBtn');
const closeBtn = document.getElementById('closeBtn');

// 状态变量
let playerId = '';
let checkpointEpoch;
let activeHistoryType = 'conversation';
let archiveItems = [];
let selectedArchiveItemId = '';
let hasLoadedContext = false;

function translate(key, defaultText) {
    return window.LocalizationManager ? window.LocalizationManager.getTranslation(key, defaultText) : defaultText;
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 应用主题
        const savedTheme = localStorage.getItem('selectedTheme') || 'original';
        applyTheme(savedTheme);

        // 初始化语言
        const config = await ipcRenderer.invoke('get-config');
        if (window.LocalizationManager) {
            await window.LocalizationManager.loadTranslations(config.language || 'en');
            window.LocalizationManager.applyTranslations();
        }

        // 设置事件监听器
        setupEventListeners();

        // 初始加载数据
        await loadArchiveContext();
    } catch (error) {
        showStatusMessage(translate('history.load_fail', 'Failed to load conversation history data: ') + error.message, 'error');
        console.error('初始化错误:', error);
    }
});

// 应用主题函数
function applyTheme(theme) {
    const body = document.querySelector('body');
    if (body) {
        body.classList.remove('theme-original', 'theme-chinese', 'theme-west');
        body.classList.add(`theme-${theme}`);
    }
}

// 监听主题更新
ipcRenderer.on('update-theme', (event, theme) => {
    applyTheme(theme);
    localStorage.setItem('selectedTheme', theme);
});

// 监听语言更新
ipcRenderer.on('update-language', async (event, lang) => {
    if (window.LocalizationManager) {
        await window.LocalizationManager.loadTranslations(lang);
        window.LocalizationManager.applyTranslations();
        // 重新渲染列表以更新"暂无数据"文本
        renderArchiveList();
        updateArchivePresentation();
    }
});

// 监听主进程的 checkpoint 推进：按新 epoch 重新过滤当前档案列表
ipcRenderer.on('checkpoint-update', async (event, epoch) => {
    checkpointEpoch = typeof epoch === 'number' ? epoch : undefined;
    if (checkpointValue) {
        checkpointValue.textContent = checkpointEpoch ?? '—';
    }
    if (hasLoadedContext) {
        selectedArchiveItemId = '';
        await loadActiveArchiveItems();
    }
});

// 设置事件监听器
function setupEventListeners() {
    refreshBtn.addEventListener('click', loadArchiveContext);
    closeBtn.addEventListener('click', () => ipcRenderer.send('close-conversation-history'));
    archiveTabs.addEventListener('click', async (event) => {
        const tab = event.target.closest('[data-history-type]');
        if (!tab || tab.dataset.historyType === activeHistoryType) return;

        activeHistoryType = tab.dataset.historyType;
        selectedArchiveItemId = '';
        updateArchivePresentation();
        await loadActiveArchiveItems();
    });
}

// 加载档案上下文（玩家ID + checkpoint）
async function loadArchiveContext() {
    try {
        showStatusMessage(translate('history.loading_data', 'Loading conversation history data...'), 'info');

        // 从debuglog解析玩家ID
        const context = await ipcRenderer.invoke('get-conversation-history-ids');

        if (!context.playerId) {
            throw new Error(translate('history.no_player_id', 'Unable to parse player ID from game logs'));
        }

        playerId = context.playerId;
        checkpointEpoch = context.checkpointEpoch;

        // 更新UI显示
        playerIdInput.value = context.playerName || playerId;
        if (checkpointValue) {
            checkpointValue.textContent = checkpointEpoch ?? '—';
        }
        hasLoadedContext = true;

        updateArchivePresentation();
        // 初始加载与 Refresh 均允许一次"会话列表为空时自动落到有数据的
        // letter/battle 档案"回落；手动切换 tab 不触发（见 setupEventListeners）。
        await loadActiveArchiveItems({ selectAvailableArchiveOnFirstLoad: true });
        showStatusMessage(translate('history.load_success', 'Conversation history data loaded successfully'), 'success');
    } catch (error) {
        showStatusMessage(translate('history.load_fail', 'Failed to load conversation history data: ') + error.message, 'error');
        console.error('加载档案数据错误:', error);
    }
}

// get-archive-history-entries 容错封装：仅在通道未注册（Task 5 前的
// "No handler registered"）时静默降级为空列表；其余错误原样上抛，
// 走 loadActiveArchiveItems 的既有错误分支展示。
async function fetchArchiveEntries(historyType) {
    try {
        return await ipcRenderer.invoke('get-archive-history-entries', playerId, checkpointEpoch, historyType);
    } catch (error) {
        if (!/No handler registered/i.test(error?.message ?? '')) {
            throw error;
        }
        console.debug(`[historyWindow] get-archive-history-entries not registered yet for "${historyType}"`);
        return [];
    }
}

// 加载当前标签页的档案条目
async function loadActiveArchiveItems({ selectAvailableArchiveOnFirstLoad = false } = {}) {
    try {
        if (activeHistoryType === 'conversation') {
            const files = await ipcRenderer.invoke('get-conversation-history-files', playerId, checkpointEpoch);
            archiveItems = files.map((file) => ({
                id: file.fileName,
                type: 'conversation',
                // 2CE 文件名为 <角色ID串>_ckpt<epoch>_<时间戳>.txt，角色数量可变，
                // 无法稳定提取单一角色名，直接展示完整文件名。
                title: file.fileName,
                subtitle: '',
                modifiedTime: file.modifiedTime,
                fileName: file.fileName
            }));

            // Letter replies and incoming letters are archive records, not chat
            // transcript files. When this viewer opens for the first time,
            // surface an available letter/battle archive instead of presenting
            // an empty conversation tab as if all history were missing.
            if (selectAvailableArchiveOnFirstLoad && archiveItems.length === 0) {
                for (const historyType of ['letter', 'battle']) {
                    const fallbackItems = await fetchArchiveEntries(historyType);
                    if (fallbackItems.length > 0) {
                        activeHistoryType = historyType;
                        archiveItems = fallbackItems;
                        updateArchivePresentation();
                        break;
                    }
                }
            }
        } else {
            archiveItems = await fetchArchiveEntries(activeHistoryType);
        }

        renderArchiveList();
        conversationText.textContent = translate('history.select_file', 'Please select a conversation file from the list to view content');
        currentFileNameInput.value = '';
    } catch (error) {
        archiveItems = [];
        renderArchiveList();
        showStatusMessage(translate('history.load_fail', 'Failed to load conversation history data: ') + error.message, 'error');
        console.error('加载档案条目错误:', error);
    }
}

// 渲染档案列表
function renderArchiveList() {
    conversationList.replaceChildren();

    if (!archiveItems.length) {
        const empty = document.createElement('div');
        empty.className = 'no-conversations';
        empty.textContent = getEmptyStateText();
        conversationList.appendChild(empty);
        return;
    }

    archiveItems.forEach((item) => {
        const conversationItem = document.createElement('button');
        conversationItem.type = 'button';
        conversationItem.className = 'conversation-item';
        conversationItem.classList.toggle('selected', item.id === selectedArchiveItemId);

        const title = document.createElement('span');
        title.className = 'file-name';
        title.textContent = item.title;

        const details = document.createElement('span');
        details.className = 'file-date';
        const modifiedDate = new Date(item.modifiedTime).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        details.textContent = item.subtitle ? `${item.subtitle} · ${modifiedDate}` : modifiedDate;

        conversationItem.append(title, details);
        conversationItem.addEventListener('click', () => selectArchiveItem(item));
        conversationList.appendChild(conversationItem);
    });
}

// 选择档案条目
async function selectArchiveItem(item) {
    try {
        showStatusMessage(translate('history.loading_content', 'Loading conversation content...'), 'info');

        // 更新选中状态
        selectedArchiveItemId = item.id;
        renderArchiveList();
        currentFileNameInput.value = item.title;

        if (item.type === 'conversation') {
            // 第 4 参 checkpointEpoch：Task 5 扩展 main 侧签名后生效，
            // 当前 main 不接收该参数也无副作用。
            conversationText.textContent = await ipcRenderer.invoke('read-conversation-history-file', playerId, item.fileName, checkpointEpoch);
        } else {
            conversationText.textContent = item.content;
        }
        showStatusMessage(translate('history.content_success', 'Conversation content loaded successfully'), 'success');
    } catch (error) {
        const failMsg = translate('history.content_fail', 'Failed to load conversation content: ');
        showStatusMessage(failMsg + error.message, 'error');
        console.error('加载档案内容错误:', error);
        conversationText.textContent = failMsg + error.message;
    }
}

// 更新标签页与查看器标题展示
function updateArchivePresentation() {
    if (archiveTabs) {
        archiveTabs.querySelectorAll('[data-history-type]').forEach((tab) => {
            const isActive = tab.dataset.historyType === activeHistoryType;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });
    }

    const presentation = {
        // The letter/battle kickers stay as decorative English tags; only the
        // conversation kicker is localized via history.section_kicker.
        conversation: { kicker: translate('history.section_kicker', 'CHRONICLE'), title: translate('history.viewer_header', 'Conversation Content') },
        letter: { kicker: 'CORRESPONDENCE', title: translate('history.letter_content_title', 'Letter correspondence') },
        battle: { kicker: 'BATTLE REPORT', title: translate('history.battle_content_title', 'Battle report') }
    }[activeHistoryType];
    if (archiveKicker) {
        archiveKicker.textContent = presentation.kicker;
    }
    if (conversationHeading) {
        conversationHeading.textContent = presentation.title;
    }
}

function getEmptyStateText() {
    if (activeHistoryType === 'letter') return translate('history.no_letters', 'No letter correspondence');
    if (activeHistoryType === 'battle') return translate('history.no_battle_reports', 'No battle reports');
    return translate('history.no_history', 'No conversation history files available');
}

// 显示状态消息
function showStatusMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;

    // 3秒后自动隐藏
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}
