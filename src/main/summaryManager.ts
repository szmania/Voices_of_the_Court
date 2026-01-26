import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// 从debuglog解析玩家ID
export async function parseSummaryIdsFromLog(logFilePath: string): Promise<{playerId: string}> {
    try {
        if (!fs.existsSync(logFilePath)) {
            throw new Error(`日志文件不存在: ${logFilePath}`);
        }
        
        const logContent = fs.readFileSync(logFilePath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        
        // 查找最后一个包含VOTC:summay_manage的行
        let summaryManageLine = '';
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('VOTC:summay_manage')) {
                summaryManageLine = lines[i];
                break;
            }
        }
        
        if (!summaryManageLine) {
            throw new Error('在日志中未找到VOTC:summay_manage行');
        }
        
        // 解析格式: VOTC:summay_manage/;/玩家ID/角色ID
        const parts = summaryManageLine.split('/;/');
        if (parts.length < 2) {
            throw new Error('VOTC:summay_manage行格式不正确');
        }
        
        const playerId = parts[1].trim();
        
        if (!playerId) {
            throw new Error('无法从VOTC:summay_manage行解析玩家ID');
        }
        
        return { playerId };
    } catch (error) {
        console.error('解析总结ID错误:', error);
        throw error;
    }
}

// 读取总结文件
export async function readSummaryFile(playerId: string): Promise<any[]> {
    try {
        // 构建总结目录路径
        const userDataPath = path.join(app.getPath("userData"), 'votc_data');
        const summaryDir = path.join(userDataPath, 'conversation_summaries', playerId);
        
        // 确保目录存在
        if (!fs.existsSync(summaryDir)) {
            fs.mkdirSync(summaryDir, { recursive: true });
            return [];
        }
        
        // 读取目录中的所有JSON文件
        const files = fs.readdirSync(summaryDir).filter(file => file.endsWith('.json'));
        const allSummaries = [];
        
        for (const file of files) {
            const filePath = path.join(summaryDir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const summaries = JSON.parse(content);
                // 为每个总结添加角色ID信息
                const characterId = path.basename(file, '.json');
                const summariesWithCharacterId = summaries.map((summary: any) => ({
                    ...summary,
                    characterId
                }));
                allSummaries.push(...summariesWithCharacterId);
            } catch (error) {
                console.error(`读取文件 ${filePath} 失败:`, error);
            }
        }
        
        // 按日期排序
        allSummaries.sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        
        return allSummaries;
    } catch (error) {
        console.error('读取总结文件错误:', error);
        throw error;
    }
}

// 保存总结文件
export async function saveSummaryFile(playerId: string, summaries: any[]): Promise<void> {
    try {
        // 构建总结目录路径
        const userDataPath = path.join(app.getPath("userData"), 'votc_data');
        const summaryDir = path.join(userDataPath, 'conversation_summaries', playerId);
        
        // 确保目录存在
        if (!fs.existsSync(summaryDir)) {
            fs.mkdirSync(summaryDir, { recursive: true });
        }
        
        // 按角色ID分组总结
        const summariesByCharacter: { [key: string]: any[] } = {};
        summaries.forEach(summary => {
            const characterId = summary.characterId || 'default';
            if (!summariesByCharacter[characterId]) {
                summariesByCharacter[characterId] = [];
            }
            summariesByCharacter[characterId].push(summary);
        });
        
        // 为每个角色创建单独的文件
        for (const [characterId, characterSummaries] of Object.entries(summariesByCharacter)) {
            const summaryFilePath = path.join(summaryDir, `${characterId}.json`);
            
            // 移除characterId字段，因为它已经体现在文件名中
            const cleanSummaries = characterSummaries.map((summary: any) => {
                const { characterId, ...cleanSummary } = summary;
                return cleanSummary;
            });
            
            // 写入文件
            fs.writeFileSync(summaryFilePath, JSON.stringify(cleanSummaries, null, '\t'), 'utf8');
        }
    } catch (error) {
        console.error('保存总结文件错误:', error);
        throw error;
    }
}