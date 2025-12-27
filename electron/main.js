import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readdir, stat } from 'fs/promises';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // 开发环境加载 Vite dev server，生产环境加载打包后的文件
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ==================== IPC Handlers ====================

// 获取用户主目录
ipcMain.handle('get-home-dir', () => {
    return homedir();
});

// 浏览文件系统目录
ipcMain.handle('browse-dir', async (event, dirPath) => {
    try {
        const targetPath = dirPath || homedir();
        const items = await readdir(targetPath, { withFileTypes: true });
        const directories = [];

        for (const item of items) {
            if (item.isDirectory() && !item.name.startsWith('.')) {
                const fullPath = path.join(targetPath, item.name);
                let isGitRepo = false;
                try {
                    await stat(path.join(fullPath, '.git'));
                    isGitRepo = true;
                } catch {
                    // 不是git仓库
                }
                directories.push({
                    name: item.name,
                    path: fullPath,
                    isGitRepo,
                });
            }
        }

        directories.sort((a, b) => {
            if (a.isGitRepo && !b.isGitRepo) return -1;
            if (!a.isGitRepo && b.isGitRepo) return 1;
            return a.name.localeCompare(b.name);
        });

        return {
            success: true,
            currentPath: targetPath,
            parentPath: path.dirname(targetPath),
            directories,
        };
    } catch (error) {
        return { success: false, error: error.message || '读取目录失败' };
    }
});

// 检查路径是否为git仓库
ipcMain.handle('check-repo', async (event, repoPath) => {
    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
            cwd: repoPath,
        });
        return { success: true, isGitRepo: stdout.trim() === 'true' };
    } catch {
        return { success: false, isGitRepo: false };
    }
});

// 获取git提交记录
ipcMain.handle('git-log', async (event, options) => {
    try {
        const { repoPath, since, until, author, branch } = options;

        if (!repoPath) {
            return { success: false, error: '请提供仓库路径' };
        }

        const args = ['log', '--pretty=format:%H|%h|%s|%an|%ae|%ai'];

        if (branch) {
            if (branch === '__all__') {
                args.push('--all');
            } else {
                let branchRef = branch;
                try {
                    await execFileAsync('git', ['rev-parse', '--verify', branch], {
                        cwd: repoPath,
                        encoding: 'utf-8',
                    });
                } catch {
                    try {
                        await execFileAsync('git', ['rev-parse', '--verify', `origin/${branch}`], {
                            cwd: repoPath,
                            encoding: 'utf-8',
                        });
                        branchRef = `origin/${branch}`;
                    } catch {
                        // 保持原样
                    }
                }
                args.push(branchRef);
            }
        }

        if (since) args.push(`--since=${since}`);
        if (until) args.push(`--until=${until}`);
        if (author) args.push(`--author=${author}`);

        const { stdout, stderr } = await execFileAsync('git', args, {
            cwd: repoPath,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
        });

        if (stderr && !stdout) {
            return { success: false, error: stderr };
        }

        const lines = stdout.trim().split('\n').filter(line => line.trim());
        const commits = lines.map(line => {
            const parts = line.split('|');
            return {
                id: parts[0] || '',
                sha: parts[1] || '',
                message: parts[2] || '',
                author: parts[3] || '',
                email: parts[4] || '',
                date: parts[5] || '',
            };
        });

        return { success: true, commits, total: commits.length };
    } catch (error) {
        return { success: false, error: error.message || '执行git命令失败' };
    }
});

// 获取分支列表
ipcMain.handle('get-branches', async (event, repoPath) => {
    try {
        const { stdout } = await execFileAsync('git', ['branch', '-a', '--format=%(refname:short)'], {
            cwd: repoPath,
            encoding: 'utf-8',
        });

        const branches = stdout.trim().split('\n')
            .filter(b => b.trim())
            .map(b => b.trim().replace('origin/', ''));

        const uniqueBranches = [...new Set(branches)];

        const { stdout: currentBranch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: repoPath,
            encoding: 'utf-8',
        });

        return {
            success: true,
            branches: uniqueBranches,
            currentBranch: currentBranch.trim(),
        };
    } catch (error) {
        return { success: false, error: error.message || '获取分支列表失败' };
    }
});

// 获取作者列表
ipcMain.handle('get-authors', async (event, repoPath) => {
    try {
        const { stdout } = await execFileAsync('git', ['log', '--format=%an', '--all'], {
            cwd: repoPath,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
        });

        const authors = stdout.trim().split('\n')
            .filter(a => a.trim())
            .map(a => a.trim());

        const uniqueAuthors = [...new Set(authors)].sort();

        return { success: true, authors: uniqueAuthors };
    } catch (error) {
        return { success: false, error: error.message || '获取作者列表失败' };
    }
});

// git pull
ipcMain.handle('git-pull', async (event, repoPath) => {
    try {
        await execFileAsync('git', ['fetch', '--all'], {
            cwd: repoPath,
            encoding: 'utf-8',
        });

        const { stdout, stderr } = await execFileAsync('git', ['pull'], {
            cwd: repoPath,
            encoding: 'utf-8',
        });

        return {
            success: true,
            message: stdout || 'Already up to date.',
            detail: stderr || '',
        };
    } catch (error) {
        return { success: false, error: error.message || 'git pull 失败' };
    }
});

// AI优化周报 - 流式输出
ipcMain.handle('optimize-report', async (event, options) => {
    const { commits, apiKey, model, promptTemplate } = options;

    if (!commits || !Array.isArray(commits) || commits.length === 0) {
        return { success: false, error: '请提供提交记录' };
    }

    if (!apiKey) {
        return { success: false, error: '请提供API Key' };
    }

    const commitsText = commits.map((commit, index) =>
        `${index + 1}. ${commit.message} (${commit.author}, ${commit.date})`
    ).join('\n');

    const defaultSystemPrompt = `你是一个专业的技术周报撰写助手。请根据提供的Git提交记录，生成一份清晰、专业的周报内容。

要求：
1. 对相似的提交进行归类和合并
2. 周报是给老板看的，不要过多的使用一些技术名词，内容尽量精简，可以合并一些类似的内容
3. 按工作类型分类（功能开发、Bug修复、代码优化，其他等）
4. 突出重点工作成果
5. 只输出周报内容，不要添加额外的解释
6. 每个内容前面带上emoji
7. 生成markdown文档，markdown语法不要使用 '#' 和 '*'，列表要加上序号

下面是给你参考的模板：
🛠️功能开发：
1. 实现xxxxx

🐞 Bug修复：
1. 修复xxxxx

🔧代码优化：
1. 优化xxxx

📦其他事项：
1. 其他xxx`;

    const systemPrompt = promptTemplate && promptTemplate.trim() ? promptTemplate.trim() : defaultSystemPrompt;
    const userPrompt = `以下是本周的Git提交记录，请帮我整理成周报：\n\n${commitsText}`;

    try {
        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'qwen-plus',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 2000,
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return { success: false, error: errorData.error?.message || `AI服务调用失败: ${response.status}` };
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        mainWindow?.webContents.send('ai-stream-done');
                        continue;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            mainWindow?.webContents.send('ai-stream-chunk', content);
                        }
                    } catch {
                        // 忽略解析错误
                    }
                }
            }
        }

        reader.releaseLock();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message || 'AI优化周报失败' };
    }
});
