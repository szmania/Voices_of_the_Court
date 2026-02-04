// README窗口渲染器
document.addEventListener('DOMContentLoaded', function() {
    const { ipcRenderer } = require('electron');
    
    // 获取DOM元素
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const dontShowAgainBtn = document.getElementById('dont-show-again');
    const closeReadmeBtn = document.getElementById('close-readme');
    const appVersionSpans = document.querySelectorAll('.app-version');

    // 标签页切换功能
    navTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有活动状态
            navTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // 添加活动状态
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // 获取应用版本信息
    async function loadAppVersion() {
        try {
            // 在 Electron 中，我们可以尝试通过 IPC 获取版本，或者从 package.json 获取
            // 这里的路径相对于 public/readmeWindow/readme.html
            const response = await fetch('../../package.json');
            const packageJson = await response.json();
            const version = packageJson.version || '1.3.0-alpha.1';
            
            appVersionSpans.forEach(span => {
                span.textContent = version;
                // 移除 data-i18n 属性，防止被 LocalizationManager 覆盖
                span.removeAttribute('data-i18n');
            });
        } catch (error) {
            console.error('无法加载应用版本:', error);
            appVersionSpans.forEach(span => {
                span.textContent = '1.3.0-alpha.1';
            });
        }
    }

    // "不再显示"按钮事件
    if (dontShowAgainBtn) {
        dontShowAgainBtn.addEventListener('click', function() {
            // 发送IPC消息，设置不再显示README
            ipcRenderer.send('set-readme-preference', false);
            
            // 关闭窗口
            ipcRenderer.send('close-readme-window');
        });
    }

    // "开始使用"按钮事件
    if (closeReadmeBtn) {
        closeReadmeBtn.addEventListener('click', function() {
            // 关闭窗口
            ipcRenderer.send('close-readme-window');
        });
    }

    // 外部链接点击处理
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'A' && e.target.href.startsWith('http')) {
            e.preventDefault();
            ipcRenderer.send('open-external-link', e.target.href);
        }
    });

    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // ESC键关闭窗口
            ipcRenderer.send('close-readme-window');
        }
    });

    // 添加平滑滚动效果
    function addSmoothScroll() {
        const links = document.querySelectorAll('a[href^="#"]');
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // 添加代码高亮（如果需要的话）
    function addCodeHighlight() {
        // 这里可以添加代码高亮库，比如Prism.js或highlight.js
        // 目前先添加简单的代码块样式
        const codeBlocks = document.querySelectorAll('pre, code');
        codeBlocks.forEach(block => {
            block.style.backgroundColor = 'rgba(40, 40, 40, 0.8)';
            block.style.padding = '1rem';
            block.style.borderRadius = '4px';
            block.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            block.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
            block.style.fontSize = '0.9rem';
            block.style.overflowX = 'auto';
        });
    }

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
        }
    });

    // 初始化函数
    async function initialize() {
        // 应用主题
        const savedTheme = localStorage.getItem('selectedTheme') || 'original';
        applyTheme(savedTheme);

        // 初始化语言
        const config = await ipcRenderer.invoke('get-config');
        if (window.LocalizationManager) {
            await window.LocalizationManager.loadTranslations(config.language || 'en');
            window.LocalizationManager.applyTranslations();
        }

        loadAppVersion();
        addSmoothScroll();
        addCodeHighlight();
        
        // 添加加载动画
        document.body.style.opacity = '0';
        setTimeout(() => {
            document.body.style.transition = 'opacity 0.5s ease-in-out';
            document.body.style.opacity = '1';
        }, 100);

        console.log('README窗口渲染器已加载');
    }

    // 启动初始化
    initialize();

    // 暴露一些函数供外部使用（如果需要）
    window.ReadmeRenderer = {
        switchTab: function(tabName) {
            const tab = document.querySelector(`[data-tab="${tabName}"]`);
            if (tab) {
                tab.click();
            }
        },
        getCurrentTab: function() {
            const activeTab = document.querySelector('.nav-tab.active');
            return activeTab ? activeTab.getAttribute('data-tab') : null;
        }
    };
});