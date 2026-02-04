import fs from 'fs';
import path from 'path';
import { Summary } from '../ts/conversation_interfaces.js';

/**
 * 文件监控管理器类
 * 用于监控总结文件的变化并自动重新加载
 */
export class SummaryFileWatcher {
    private watchers: Map<string, fs.FSWatcher> = new Map();
    private reloadCallbacks: Map<string, (summaries: Summary[]) => void> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly debounceDelay = 500; // 防抖延迟，单位毫秒
    private pausedWatchers: Set<string> = new Set(); // 暂停监控的文件集合

    /**
     * 添加文件监控
     * @param filePath 要监控的文件路径
     * @param callback 文件变化时的回调函数
     */
    public watchFile(filePath: string, callback: (summaries: Summary[]) => void): void {
        // 如果已经在监控这个文件，先停止监控
        if (this.watchers.has(filePath)) {
            this.unwatchFile(filePath);
        }

        // 确保文件存在
        if (!fs.existsSync(filePath)) {
            console.warn(`File does not exist, cannot watch: ${filePath}`);
            return;
        }

        try {
            // 创建文件监控
            const watcher = fs.watch(filePath, (eventType, filename) => {
                if (eventType === 'change') {
                    // 使用防抖机制，避免频繁触发
                    this.debounceFileChange(filePath, callback);
                }
            });

            // 保存监控器和回调函数
            this.watchers.set(filePath, watcher);
            this.reloadCallbacks.set(filePath, callback);
            
            console.log(`Started watching summary file: ${filePath}`);
        } catch (error) {
            console.error(`Error setting up file watcher for ${filePath}:`, error);
        }
    }

    /**
     * 停止监控指定文件
     * @param filePath 要停止监控的文件路径
     */
    public unwatchFile(filePath: string): void {
        const watcher = this.watchers.get(filePath);
        if (watcher) {
            watcher.close();
            this.watchers.delete(filePath);
            this.reloadCallbacks.delete(filePath);
            
            // 清除防抖定时器
            const timer = this.debounceTimers.get(filePath);
            if (timer) {
                clearTimeout(timer);
                this.debounceTimers.delete(filePath);
            }
            
            console.log(`Stopped watching summary file: ${filePath}`);
        }
    }

    /**
     * 停止所有文件监控
     */
    public unwatchAll(): void {
        for (const filePath of this.watchers.keys()) {
            this.unwatchFile(filePath);
        }
        console.log('Stopped all file watchers');
        
        // 清除所有暂停的监控文件
        this.pausedWatchers.clear();
    }

    /**
     * 清除所有暂停的监控文件
     */
    public clearPausedWatchers(): void {
        this.pausedWatchers.clear();
        console.log("Cleared all paused watchers");
    }

    /**
     * 暂停对指定文件的监控
     * @param filePath 要暂停监控的文件路径
     */
    public pauseWatcher(filePath: string): void {
        this.pausedWatchers.add(filePath);
        console.log(`Paused watching summary file: ${filePath}`);
    }

    /**
     * 恢复对指定文件的监控
     * @param filePath 要恢复监控的文件路径
     */
    public resumeWatcher(filePath: string): void {
        this.pausedWatchers.delete(filePath);
        console.log(`Resumed watching summary file: ${filePath}`);
    }

    /**
     * 防抖处理文件变化
     * @param filePath 文件路径
     * @param callback 回调函数
     */
    private debounceFileChange(filePath: string, callback: (summaries: Summary[]) => void): void {
        // 如果监控已暂停，不处理文件变化
        if (this.pausedWatchers.has(filePath)) {
            return;
        }

        // 清除之前的定时器
        const existingTimer = this.debounceTimers.get(filePath);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // 设置新的定时器
        const timer = setTimeout(() => {
            this.handleFileChange(filePath, callback);
            this.debounceTimers.delete(filePath);
        }, this.debounceDelay);

        this.debounceTimers.set(filePath, timer);
    }

    /**
     * 处理文件变化
     * @param filePath 文件路径
     * @param callback 回调函数
     */
    private handleFileChange(filePath: string, callback: (summaries: Summary[]) => void): void {
        try {
            // 读取文件内容
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const summaries = JSON.parse(fileContent) as Summary[];
            
            // 按日期排序（最新的在前）
            summaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            console.log(`Reloaded ${summaries.length} summaries from ${filePath}`);
            
            // 调用回调函数
            callback(summaries);
        } catch (error) {
            console.error(`Error reloading summary file ${filePath}:`, error);
        }
    }

    /**
     * 获取当前正在监控的文件列表
     * @returns 正在监控的文件路径数组
     */
    public getWatchedFiles(): string[] {
        return Array.from(this.watchers.keys());
    }
}