const { ipcRenderer } = require('electron');

// DOM 元素
const playerIdInput = document.getElementById('playerId');
const conversationList = document.getElementById('conversationList');
const currentFileNameInput = document.getElementById('currentFileName');
const conversationText = document.getElementById('conversationText');
const statusMessage = document.getElementById('statusMessage');

// 按钮
const refreshBtn = document.getElementById('refreshBtn');
const closeBtn = document.getElementById('closeBtn');

// 状态变量
let conversationFiles = [];
let currentFileName = '';
let playerId = '';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 初始加载数据
        await loadConversationHistoryData();
        
        // 设置事件监听器
        setupEventListeners();
    } catch (error) {
        showStatusMessage('初始化失败: ' + error.message, 'error');
        console.error('初始化错误:', error);
    }
});

// 设置事件监听器
function setupEventListeners() {
    refreshBtn.addEventListener('click', loadConversationHistoryData);
    closeBtn.addEventListener('click', () => ipcRenderer.send('close-conversation-history'));
}

// 加载对话历史数据
async function loadConversationHistoryData() {
    try {
        showStatusMessage('正在加载对话历史数据...', 'info');
        
        // 从debuglog解析玩家ID
        const { playerId: pId } = await ipcRenderer.invoke('get-conversation-history-ids');
        
        if (!pId) {
            throw new Error('无法从游戏日志中解析玩家ID');
        }
        
        playerId = pId;
        
        // 更新UI显示
        playerIdInput.value = playerId;
        
        // 获取对话历史文件列表
        conversationFiles = await ipcRenderer.invoke('get-conversation-history-files', playerId);
        
        // 渲染对话文件列表
        renderConversationList();
        
        showStatusMessage('对话历史数据加载成功', 'success');
    } catch (error) {
        showStatusMessage('加载对话历史数据失败: ' + error.message, 'error');
        console.error('加载对话历史数据错误:', error);
    }
}

// 渲染对话文件列表
function renderConversationList() {
    conversationList.innerHTML = '';
    
    if (!conversationFiles || conversationFiles.length === 0) {
        conversationList.innerHTML = '<div class="no-conversations">暂无对话历史文件</div>';
        return;
    }
    
    // 文件已经按修改时间降序排序（最新的在前）
    conversationFiles.forEach((fileInfo, index) => {
        const conversationItem = document.createElement('div');
        conversationItem.className = 'conversation-item';
        
        // 格式化修改时间为可读的日期字符串
        const modifiedDate = new Date(fileInfo.modifiedTime);
        const formattedDate = modifiedDate.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        conversationItem.innerHTML = `
            <div class="file-name">${fileInfo.fileName}</div>
            <div class="file-date">${formattedDate}</div>
        `;
        
        conversationItem.addEventListener('click', () => selectConversationFile(fileInfo.fileName));
        conversationList.appendChild(conversationItem);
    });
}

// 从文件名中提取日期信息
function extractDateFromFileName(fileName) {
    // 假设文件名包含日期信息，如 "2023-11-15_conversation.txt"
    const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
        return dateMatch[1];
    }
    
    // 如果没有找到日期，返回文件名
    return fileName;
}

// 选择对话文件
async function selectConversationFile(fileName) {
    try {
        showStatusMessage('正在加载对话内容...', 'info');
        
        // 更新当前选中的文件
        currentFileName = fileName;
        currentFileNameInput.value = fileName;
        
        // 更新选中状态
        document.querySelectorAll('.conversation-item').forEach((item, index) => {
            const itemName = item.querySelector('.file-name').textContent;
            if (itemName === fileName) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // 读取对话文件内容
        const content = await ipcRenderer.invoke('read-conversation-history-file', playerId, fileName);
        
        // 显示对话内容
        conversationText.textContent = content;
        
        showStatusMessage('对话内容加载成功', 'success');
    } catch (error) {
        showStatusMessage('加载对话内容失败: ' + error.message, 'error');
        console.error('加载对话内容错误:', error);
        conversationText.textContent = '加载对话内容失败: ' + error.message;
    }
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