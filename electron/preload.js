const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 获取用户主目录
    getHomeDir: () => ipcRenderer.invoke('get-home-dir'),

    // 浏览目录
    browseDir: (dirPath) => ipcRenderer.invoke('browse-dir', dirPath),

    // 检查是否为 Git 仓库
    checkRepo: (repoPath) => ipcRenderer.invoke('check-repo', repoPath),

    // 获取 Git 提交记录
    gitLog: (options) => ipcRenderer.invoke('git-log', options),

    // 获取分支列表
    getBranches: (repoPath) => ipcRenderer.invoke('get-branches', repoPath),

    // 获取作者列表
    getAuthors: (repoPath) => ipcRenderer.invoke('get-authors', repoPath),

    // Git pull
    gitPull: (repoPath) => ipcRenderer.invoke('git-pull', repoPath),

    // AI 优化周报
    optimizeReport: (options) => ipcRenderer.invoke('optimize-report', options),

    // 监听 AI 流式输出
    onAIStreamChunk: (callback) => {
        ipcRenderer.on('ai-stream-chunk', (event, content) => callback(content));
    },

    // 监听 AI 流式完成
    onAIStreamDone: (callback) => {
        ipcRenderer.on('ai-stream-done', () => callback());
    },

    // 移除监听器
    removeAIListeners: () => {
        ipcRenderer.removeAllListeners('ai-stream-chunk');
        ipcRenderer.removeAllListeners('ai-stream-done');
    },
});
