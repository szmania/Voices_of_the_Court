import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// 从debuglog解析玩家ID
export async function parseConversationHistoryIdsFromLog(logFilePath: string): Promise<{playerId: string}> {
    try {
        if (!fs.existsSync(logFilePath)) {
            throw new Error(`日志文件不存在: ${logFilePath}`);
        }
        
        const logContent = fs.readFileSync(logFilePath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        
        // 查找最后一个包含VOTC:conversation_history的行
        let conversationHistoryLine = '';
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('VOTC:conversation_history')) {
                conversationHistoryLine = lines[i];
                break;
            }
        }
        
        if (!conversationHistoryLine) {
            throw new Error('在日志中未找到VOTC:conversation_history行');
        }
        
        // 解析格式: VOTC:conversation_history/;/玩家ID
        const parts = conversationHistoryLine.split('/;/');
        if (parts.length < 2) {
            throw new Error('VOTC:conversation_history行格式不正确');
        }
        
        const playerId = parts[1].trim();
        
        if (!playerId) {
            throw new Error('无法从VOTC:conversation_history行解析玩家ID');
        }
        
        return { playerId };
    } catch (error) {
        console.error('解析对话历史ID错误:', error);
        throw error;
    }
}

// 读取历史对话文件列表
export async function getConversationHistoryFiles(playerId: string): Promise<Array<{fileName: string, modifiedTime: number}>> {
    try {
        // 构建对话历史目录路径 - 使用userdata的conversation_history目录
        const userDataPath = app.getPath('userData');
        const conversationHistoryDir = path.join(userDataPath, 'votc_data', 'conversation_history', playerId);
        
        // 确保目录存在
        if (!fs.existsSync(conversationHistoryDir)) {
            console.log(`对话历史目录不存在: ${conversationHistoryDir}`);
            return [];
        }
        
        // 读取目录中的所有txt文件
        const files = fs.readdirSync(conversationHistoryDir).filter(file => file.endsWith('.txt'));
        
        // 获取每个文件的修改时间
        const filesWithStats = files.map(fileName => {
            const filePath = path.join(conversationHistoryDir, fileName);
            const stats = fs.statSync(filePath);
            return {
                fileName,
                modifiedTime: stats.mtime.getTime()
            };
        });
        
        // 按修改时间降序排序（最新的在前）
        filesWithStats.sort((a, b) => b.modifiedTime - a.modifiedTime);
        
        return filesWithStats;
    } catch (error) {
        console.error('读取对话历史文件列表错误:', error);
        throw error;
    }
}

// 读取指定历史对话文件内容
export async function readConversationHistoryFile(playerId: string, fileName: string): Promise<string> {
    try {
        // 构建对话历史文件路径 - 使用userdata的conversation_history目录
        const userDataPath = app.getPath('userData');
        const filePath = path.join(userDataPath, 'votc_data', 'conversation_history', playerId, fileName);
        
        // 确保文件存在
        if (!fs.existsSync(filePath)) {
            throw new Error(`对话历史文件不存在: ${filePath}`);
        }
        
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf8');
        
        return content;
    } catch (error) {
        console.error('读取对话历史文件错误:', error);
        throw error;
    }
}