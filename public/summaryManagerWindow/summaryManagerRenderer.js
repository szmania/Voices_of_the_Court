const { ipcRenderer } = require('electron');

// DOM 元素
const playerIdInput = document.getElementById('playerId');
const characterSelect = document.getElementById('characterSelect');
const summaryPathInput = document.getElementById('summaryPath');
const summaryList = document.getElementById('summaryList');
const summaryDateInput = document.getElementById('summaryDate');
const summaryContentInput = document.getElementById('summaryContent');
const statusMessage = document.getElementById('statusMessage');

// 按钮
const refreshBtn = document.getElementById('refreshBtn');
const saveBtn = document.getElementById('saveBtn');
const closeBtn = document.getElementById('closeBtn');
const addSummaryBtn = document.getElementById('addSummaryBtn');
const updateSummaryBtn = document.getElementById('updateSummaryBtn');
const deleteSummaryBtn = document.getElementById('deleteSummaryBtn');
const newSummaryBtn = document.getElementById('newSummaryBtn');

// 状态变量
let allSummaries = []; // 存储所有角色的总结
let filteredSummaries = []; // 当前显示的总结（根据角色筛选）
let currentSummaryIndex = -1;
let playerId = '';
let selectedCharacterId = 'all'; // 当前选择的角色ID
let userDataPath = '';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 获取用户数据路径
        userDataPath = await ipcRenderer.invoke('get-userdata-path');
        
        // 初始加载数据
        await loadSummaryData();
        
        // 设置事件监听器
        setupEventListeners();
    } catch (error) {
        showStatusMessage('初始化失败: ' + error.message, 'error');
        console.error('初始化错误:', error);
    }
});

// 设置事件监听器
function setupEventListeners() {
    refreshBtn.addEventListener('click', loadSummaryData);
    saveBtn.addEventListener('click', saveSummaries);
    closeBtn.addEventListener('click', () => ipcRenderer.send('close-summary-manager'));
    addSummaryBtn.addEventListener('click', addNewSummary);
    updateSummaryBtn.addEventListener('click', updateCurrentSummary);
    deleteSummaryBtn.addEventListener('click', deleteCurrentSummary);
    newSummaryBtn.addEventListener('click', resetEditor);
    
    // 角色选择下拉框变化事件
    characterSelect.addEventListener('change', filterSummariesByCharacter);
}

// 加载总结数据
async function loadSummaryData() {
    try {
        showStatusMessage('正在加载总结数据...', 'info');
        
        // 从debuglog解析玩家ID
        const { playerId: pId } = await ipcRenderer.invoke('get-summary-ids');
        
        if (!pId) {
            throw new Error('无法从游戏日志中解析玩家ID');
        }
        
        playerId = pId;
        
        // 更新UI显示
        playerIdInput.value = playerId;
        
        const summaryFilePath = `${userDataPath}/conversation_summaries/${playerId}/`;
        summaryPathInput.value = summaryFilePath;
        
        // 读取总结文件
        allSummaries = await ipcRenderer.invoke('read-summary-file', playerId);
        
        // 获取所有角色ID并填充下拉框
        populateCharacterSelect();
        
        // 筛选并显示总结
        filterSummariesByCharacter();
        
        showStatusMessage('总结数据加载成功', 'success');
    } catch (error) {
        showStatusMessage('加载总结数据失败: ' + error.message, 'error');
        console.error('加载总结数据错误:', error);
    }
}

// 填充角色选择下拉框
function populateCharacterSelect() {
    // 清空现有选项（保留"所有角色"）
    characterSelect.innerHTML = '<option value="all">所有角色</option>';
    
    // 获取所有不重复的角色ID
    const characterIds = [...new Set(allSummaries.map(summary => summary.characterId || '未知'))];
    
    // 添加角色选项
    characterIds.forEach(characterId => {
        const option = document.createElement('option');
        option.value = characterId;
        option.textContent = characterId;
        characterSelect.appendChild(option);
    });
    
    // 恢复之前的选择
    characterSelect.value = selectedCharacterId;
}

// 根据选择的角色筛选总结
function filterSummariesByCharacter() {
    selectedCharacterId = characterSelect.value;
    
    if (selectedCharacterId === 'all') {
        filteredSummaries = [...allSummaries];
    } else {
        filteredSummaries = allSummaries.filter(summary => 
            (summary.characterId || '未知') === selectedCharacterId
        );
    }
    
    // 按日期降序排序（最新的在前面）
    filteredSummaries.sort((a, b) => {
        // 处理中文日期格式，例如 "1128年2月7日"
        // 提取年、月、日数字
        const extractDate = (dateStr) => {
            const match = dateStr.match(/(\d+)年(\d+)月(\d+)日/);
            if (match) {
                return {
                    year: parseInt(match[1]),
                    month: parseInt(match[2]),
                    day: parseInt(match[3])
                };
            }
            // 如果不是中文格式，尝试解析为标准日期
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return {
                    year: date.getFullYear(),
                    month: date.getMonth() + 1,
                    day: date.getDate()
                };
            }
            // 默认返回一个很早的日期
            return { year: 0, month: 1, day: 1 };
        };
        
        const dateA = extractDate(a.date);
        const dateB = extractDate(b.date);
        
        // 比较年份
        if (dateB.year !== dateA.year) {
            return dateB.year - dateA.year;
        }
        // 年份相同，比较月份
        if (dateB.month !== dateA.month) {
            return dateB.month - dateA.month;
        }
        // 月份相同，比较日期
        return dateB.day - dateA.day;
    });
    
    // 重置当前选中的总结
    currentSummaryIndex = -1;
    resetEditor();
    
    // 渲染总结列表
    renderSummaryList();
}

// 渲染总结列表
function renderSummaryList() {
    summaryList.innerHTML = '';
    
    if (!filteredSummaries || filteredSummaries.length === 0) {
        summaryList.innerHTML = '<div class="no-summaries">暂无总结数据</div>';
        return;
    }
    
    filteredSummaries.forEach((summary, index) => {
        const summaryItem = document.createElement('div');
        summaryItem.className = 'summary-item';
        if (index === currentSummaryIndex) {
            summaryItem.classList.add('selected');
        }
        
        const characterId = summary.characterId || '未知';
        summaryItem.innerHTML = `
            <div class="summary-date">${summary.date} - 角色: ${characterId}</div>
            <div class="summary-content">${summary.content}</div>
        `;
        
        summaryItem.addEventListener('click', () => selectSummary(index));
        summaryList.appendChild(summaryItem);
    });
}

// 选择总结
function selectSummary(index) {
    if (index < 0 || index >= filteredSummaries.length) return;
    
    currentSummaryIndex = index;
    const summary = filteredSummaries[index];
    
    summaryDateInput.value = summary.date;
    summaryContentInput.value = summary.content;
    
    // 更新选中状态
    document.querySelectorAll('.summary-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// 添加新总结
function addNewSummary() {
    // 获取当前选择的角色ID
    const characterId = selectedCharacterId === 'all' ? '默认角色' : selectedCharacterId;
    
    const newSummary = {
        date: '新日期',
        content: '新总结内容',
        characterId: characterId
    };
    
    // 添加到所有总结列表
    allSummaries.unshift(newSummary);
    
    // 重新筛选和显示
    filterSummariesByCharacter();
    
    showStatusMessage('已添加新总结', 'success');
}

// 更新当前总结
function updateCurrentSummary() {
    if (currentSummaryIndex < 0 || currentSummaryIndex >= filteredSummaries.length) {
        showStatusMessage('请先选择要更新的总结', 'error');
        return;
    }
    
    // 获取原始总结对象
    const summary = filteredSummaries[currentSummaryIndex];
    
    // 在allSummaries中找到并更新
    const originalIndex = allSummaries.findIndex(s => s === summary);
    if (originalIndex !== -1) {
        allSummaries[originalIndex].date = summaryDateInput.value;
        allSummaries[originalIndex].content = summaryContentInput.value;
    }
    
    // 重新筛选和显示
    filterSummariesByCharacter();
    
    showStatusMessage('总结已更新', 'success');
}

// 删除当前总结
function deleteCurrentSummary() {
    if (currentSummaryIndex < 0 || currentSummaryIndex >= filteredSummaries.length) {
        showStatusMessage('请先选择要删除的总结', 'error');
        return;
    }
    
    if (confirm('确定要删除这个总结吗？')) {
        // 获取原始总结对象
        const summary = filteredSummaries[currentSummaryIndex];
        
        // 在allSummaries中找到并删除
        const originalIndex = allSummaries.findIndex(s => s === summary);
        if (originalIndex !== -1) {
            allSummaries.splice(originalIndex, 1);
        }
        
        // 重新筛选和显示
        filterSummariesByCharacter();
        
        showStatusMessage('总结已删除', 'success');
    }
}

// 重置编辑器
function resetEditor() {
    currentSummaryIndex = -1;
    summaryDateInput.value = '';
    summaryContentInput.value = '';
    
    document.querySelectorAll('.summary-item').forEach(item => {
        item.classList.remove('selected');
    });
}

// 保存总结
async function saveSummaries() {
    try {
        showStatusMessage('正在保存总结...', 'info');
        
        await ipcRenderer.invoke('save-summary-file', playerId, allSummaries);
        
        showStatusMessage('总结保存成功', 'success');
    } catch (error) {
        showStatusMessage('保存总结失败: ' + error.message, 'error');
        console.error('保存总结错误:', error);
    }
}

// 显示状态消息
function showStatusMessage(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}