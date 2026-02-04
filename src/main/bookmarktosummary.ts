import fs from 'fs';
import path from 'path';
import { BookmarkData, BookmarkPlayer } from './parseLogforbookmarks.js';

/**
 * 书签条目接口
 * 定义了书签文件中每个条目的结构
 */
interface BookmarkEntry {
    /** 涉及的角色名称列表 */
    characters: string[];
    /** 事件日期 */
    date: string;
    /** 事件内容摘要 */
    content: string;
}

/**
 * 对话摘要条目接口
 * 定义了摘要文件中每个条目的结构
 */
interface SummaryEntry {
    /** 事件日期 */
    date: string;
    /** 事件内容摘要 */
    content: string;
}

/**
 * 对话摘要接口
 * 定义了角色对话摘要文件的数据结构，为摘要条目对象的数组
 */
type ConversationSummary = SummaryEntry[];

/**
 * 处理书签数据并将其写入角色对话摘要文件
 * 
 * @param bookmarkData 从游戏日志中解析出的书签数据，包含玩家信息和角色映射
 * @param userDataPath 用户数据路径，用于定位脚本和摘要文件
 * @param bookmarkScriptPath 书签脚本文件路径，相对于bookmarks目录
 */
export async function processBookmarkToSummary(
    bookmarkData: BookmarkData,
    userDataPath: string,
    bookmarkScriptPath: string
): Promise<void> {
    console.log(`正在为玩家 ${bookmarkData.player.name} 处理书签摘要`);
    
    // 构建书签脚本文件的完整路径
    const fullBookmarkPath = path.join(userDataPath, 'scripts', 'bookmarks', bookmarkScriptPath);
    
    // 检查书签脚本文件是否存在
    if (!fs.existsSync(fullBookmarkPath)) {
        console.error(`未找到书签脚本文件: ${fullBookmarkPath}`);
        return;
    }
    
    let bookmarkEntries: BookmarkEntry[] = [];
    
    try {
        // 读取并解析书签脚本文件内容
        const fileContent = await fs.promises.readFile(fullBookmarkPath, 'utf8');
        bookmarkEntries = JSON.parse(fileContent);
    } catch (error) {
        console.error(`读取书签脚本文件时出错: ${error}`);
        return;
    }
    
    // 查找匹配的书签条目
    const matchingEntries: BookmarkEntry[] = [];
    
    // 遍历所有书签条目，检查是否有匹配的角色
    for (const entry of bookmarkEntries) {
        // 检查书签中的任何角色是否与当前书签事件中的角色匹配
        const hasMatchingCharacter = entry.characters.some(charName => 
            Array.from(bookmarkData.characters_in_bookmark.values()).includes(charName)
        );
        
        if (hasMatchingCharacter) {
            matchingEntries.push(entry);
        }
    }
    
    // 如果没有找到匹配的条目，记录日志并退出
    if (matchingEntries.length === 0) {
        console.log(`未找到与玩家 ${bookmarkData.player.name} 匹配的书签条目`);
        return;
    }
    
    console.log(`找到 ${matchingEntries.length} 个匹配的书签条目`);
    
    // 创建对话摘要目录（如果不存在）
    const summaryDir = path.join(userDataPath, 'conversation_summaries', bookmarkData.player.id);
    
    if (!fs.existsSync(summaryDir)) {
        fs.mkdirSync(summaryDir, { recursive: true });
    }
    
    // 处理书签中的每个角色
    for (const [charId, charName] of bookmarkData.characters_in_bookmark.entries()) {
        // 创建或更新角色的摘要文件
        const summaryFilePath = path.join(summaryDir, `${charId}.json`);
        
        let existingSummary: ConversationSummary = [];
        
        // 如果摘要文件已存在，读取现有内容
        if (fs.existsSync(summaryFilePath)) {
            try {
                const fileContent = await fs.promises.readFile(summaryFilePath, 'utf8');
                // 只处理新格式（直接是数组）
                const parsedData = JSON.parse(fileContent);
                
                if (Array.isArray(parsedData)) {
                    existingSummary = parsedData;
                } else {
                    console.warn(`角色 ${charId} 的摘要文件格式不正确，已忽略现有内容`);
                }
            } catch (error) {
                console.error(`读取角色 ${charId} 的现有摘要文件时出错: ${error}`);
            }
        }
        
        // 将匹配的条目添加到摘要中
        for (const entry of matchingEntries) {
            if (entry.characters.includes(charName)) {
                // 检查是否已存在相同日期的条目，如果存在则更新，否则添加新条目
                const existingEntryIndex = existingSummary.findIndex(e => e.date === entry.date);
                if (existingEntryIndex >= 0) {
                    existingSummary[existingEntryIndex] = {
                        date: entry.date,
                        content: entry.content
                    };
                } else {
                    existingSummary.push({
                        date: entry.date,
                        content: entry.content
                    });
                }
            }
        }
        
        // 将更新后的摘要写回文件
        try {
            // 只有当摘要不为空时才保存文件
            if (existingSummary.length > 0) {
                await fs.promises.writeFile(
                    summaryFilePath, 
                    JSON.stringify(existingSummary, null, 2),
                    'utf8'
                );
                console.log(`已更新角色 ${charName} (${charId}) 的摘要文件，共 ${existingSummary.length} 条记录`);
            } else {
                // 如果摘要为空且文件存在，则删除文件
                if (fs.existsSync(summaryFilePath)) {
                    fs.unlinkSync(summaryFilePath);
                    console.log(`角色 ${charName} (${charId}) 的摘要为空，已删除摘要文件`);
                } else {
                    console.log(`角色 ${charName} (${charId}) 的摘要为空，未创建文件`);
                }
            }
        } catch (error) {
            console.error(`写入角色 ${charName} 的摘要文件时出错: ${error}`);
        }
    }
}