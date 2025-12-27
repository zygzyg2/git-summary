import express from 'express';
import cors from 'cors';
import {execFile} from 'child_process';
import {promisify} from 'util';
import {readdir, stat} from 'fs/promises';
import {homedir} from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 获取用户主目录
app.get('/api/home-dir', (req, res) => {
    res.json({path: homedir()});
});

// 浏览文件系统目录
app.post('/api/browse-dir', async (req, res) => {
    try {
        const {dirPath} = req.body;
        const targetPath = dirPath || homedir();

        const items = await readdir(targetPath, {withFileTypes: true});
        const directories = [];

        for (const item of items) {
            if (item.isDirectory() && !item.name.startsWith('.')) {
                const fullPath = path.join(targetPath, item.name);
                // 检查是否为git仓库
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

        // 按名称排序，git仓库优先
        directories.sort((a, b) => {
            if (a.isGitRepo && !b.isGitRepo) return -1;
            if (!a.isGitRepo && b.isGitRepo) return 1;
            return a.name.localeCompare(b.name);
        });

        res.json({
            success: true,
            currentPath: targetPath,
            parentPath: path.dirname(targetPath),
            directories,
        });
    } catch (error) {
        res.status(500).json({
            error: error.message || '读取目录失败',
        });
    }
});

// 获取git提交记录
app.post('/api/git-log', async (req, res) => {
    try {
        const {repoPath, since, until, author} = req.body;

        if (!repoPath) {
            return res.status(400).json({error: '请提供仓库路径'});
        }

        // 构建git命令参数 - 直接使用execFile避免shell问题
        const args = ['log', '--pretty=format:%H|%h|%s|%an|%ae|%ai'];

        // 添加分支参数
        if (req.body.branch) {
            if (req.body.branch === '__all__') {
                args.push('--all'); // 所有分支
            } else {
                // 检查分支是否存在于本地
                let branchRef = req.body.branch;
                try {
                    await execFileAsync('git', ['rev-parse', '--verify', req.body.branch], {
                        cwd: repoPath,
                        encoding: 'utf-8',
                    });
                } catch {
                    // 本地分支不存在，尝试使用远程分支
                    try {
                        await execFileAsync('git', ['rev-parse', '--verify', `origin/${req.body.branch}`], {
                            cwd: repoPath,
                            encoding: 'utf-8',
                        });
                        branchRef = `origin/${req.body.branch}`;
                    } catch {
                        // 远程分支也不存在，保持原样（让git报错）
                    }
                }
                args.push(branchRef);
            }
        }

        if (since) {
            args.push(`--since=${since}`);
        }
        if (until) {
            args.push(`--until=${until}`);
        }
        if (author) {
            args.push(`--author=${author}`);
        }

        console.log(`执行命令: git ${args.join(' ')}`);
        console.log(`仓库路径: ${repoPath}`);

        const {stdout, stderr} = await execFileAsync('git', args, {
            cwd: repoPath,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
        });

        if (stderr && !stdout) {
            return res.status(500).json({error: stderr});
        }

        // 解析git log输出
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

        res.json({
            success: true,
            commits,
            total: commits.length
        });

    } catch (error) {
        console.error('Git命令执行失败:', error);
        res.status(500).json({
            error: error.message || '执行git命令失败',
            detail: error.stderr || ''
        });
    }
});

// 检查路径是否为git仓库
app.post('/api/check-repo', async (req, res) => {
    try {
        const {repoPath} = req.body;

        if (!repoPath) {
            return res.status(400).json({error: '请提供仓库路径'});
        }

        const {stdout} = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
            cwd: repoPath,
        });

        res.json({
            success: true,
            isGitRepo: stdout.trim() === 'true'
        });

    } catch (error) {
        res.json({
            success: false,
            isGitRepo: false,
            error: '该路径不是有效的Git仓库'
        });
    }
});

// 获取所有分支列表
app.post('/api/branches', async (req, res) => {
    try {
        const {repoPath} = req.body;

        if (!repoPath) {
            return res.status(400).json({error: '请提供仓库路径'});
        }

        // 获取所有分支（本地+远程）
        const {stdout} = await execFileAsync('git', ['branch', '-a', '--format=%(refname:short)'], {
            cwd: repoPath,
            encoding: 'utf-8',
        });

        const branches = stdout.trim().split('\n')
            .filter(b => b.trim())
            .map(b => b.trim().replace('origin/', ''));

        // 去重
        const uniqueBranches = [...new Set(branches)];

        // 获取当前分支
        const {stdout: currentBranch} = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: repoPath,
            encoding: 'utf-8',
        });

        res.json({
            success: true,
            branches: uniqueBranches,
            currentBranch: currentBranch.trim()
        });

    } catch (error) {
        console.error('获取分支失败:', error);
        res.status(500).json({
            error: error.message || '获取分支列表失败'
        });
    }
});

// 获取仓库作者列表
app.post('/api/authors', async (req, res) => {
    try {
        const {repoPath} = req.body;

        if (!repoPath) {
            return res.status(400).json({error: '请提供仓库路径'});
        }

        // 获取所有作者（去重）
        const {stdout} = await execFileAsync('git', ['log', '--format=%an', '--all'], {
            cwd: repoPath,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
        });

        const authors = stdout.trim().split('\n')
            .filter(a => a.trim())
            .map(a => a.trim());

        // 去重并排序
        const uniqueAuthors = [...new Set(authors)].sort();

        res.json({
            success: true,
            authors: uniqueAuthors
        });

    } catch (error) {
        console.error('获取作者列表失败:', error);
        res.status(500).json({
            error: error.message || '获取作者列表失败'
        });
    }
});

// AI优化周报内容（流式输出）
app.post('/api/optimize-report', async (req, res) => {
    try {
        const {commits, apiKey, model, promptTemplate} = req.body;

        if (!commits || !Array.isArray(commits) || commits.length === 0) {
            return res.status(400).json({error: '请提供提交记录'});
        }

        if (!apiKey) {
            return res.status(400).json({error: '请提供API Key'});
        }

        // 构建提交记录文本
        const commitsText = commits.map((commit, index) =>
            `${index + 1}. ${commit.message} (${commit.author}, ${commit.date})`
        ).join('\n');

        // 默认系统提示词（与前端 constants.ts 保持一致）
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
        // 使用用户自定义模板或默认模板
        const systemPrompt = promptTemplate && promptTemplate.trim() ? promptTemplate.trim() : defaultSystemPrompt;

        const userPrompt = `以下是本周的Git提交记录，请帮我整理成周报：\n\n${commitsText}`;

        // 调用阿里云百炼API（流式输出）
        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model || 'qwen-plus',
                messages: [
                    {role: 'system', content: systemPrompt},
                    {role: 'user', content: userPrompt}
                ],
                temperature: 0.7,
                max_tokens: 2000,
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('AI API调用失败:', errorData);
            return res.status(response.status).json({
                error: errorData.error?.message || `AI服务调用失败: ${response.status}`,
                detail: errorData
            });
        }

        // 设置流式响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 读取流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, {stream: true});
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            res.write('data: [DONE]\n\n');
                            continue;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                res.write(`data: ${JSON.stringify({content})}\n\n`);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        res.end();

    } catch (error) {
        console.error('AI优化周报失败:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: error.message || 'AI优化周报失败'
            });
        } else {
            res.end();
        }
    }
});

// 更新仓库（git pull）
app.post('/api/git-pull', async (req, res) => {
    try {
        const {repoPath} = req.body;

        if (!repoPath) {
            return res.status(400).json({error: '请提供仓库路径'});
        }

        console.log(`执行 git pull: ${repoPath}`);

        // 先执行 git fetch
        await execFileAsync('git', ['fetch', '--all'], {
            cwd: repoPath,
            encoding: 'utf-8',
        });

        // 然后执行 git pull
        const {stdout, stderr} = await execFileAsync('git', ['pull'], {
            cwd: repoPath,
            encoding: 'utf-8',
        });

        console.log('git pull 输出:', stdout);

        res.json({
            success: true,
            message: stdout || 'Already up to date.',
            detail: stderr || ''
        });

    } catch (error) {
        console.error('git pull 失败:', error);
        res.status(500).json({
            error: error.message || 'git pull 失败',
            detail: error.stderr || ''
        });
    }
});

app.listen(PORT, () => {
    console.log(`Git Summary 后端服务运行在 http://localhost:${PORT}`);
});
