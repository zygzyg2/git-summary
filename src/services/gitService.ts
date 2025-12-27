import dayjs from 'dayjs';
import '../electron.d.ts';

// 检测是否在 Electron 环境中
export const isElectron = (): boolean => {
    return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

export interface GitCommit {
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
    branch?: string;
}

export interface ParsedRepoInfo {
    owner: string;
    repo: string;
    platform: 'github' | 'gitlab' | 'gitee' | 'codeup';
    organizationId?: string; // 云效组织ID
    fullPath?: string; // 完整路径
}

// 解析Git仓库URL
export function parseGitRepoUrl(url: string): ParsedRepoInfo | null {
    // 支持多种格式
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    // https://gitlab.com/owner/repo
    // https://gitee.com/owner/repo
    // https://codeup.aliyun.com/{organizationId}/{group}/{repo}
    // git@codeup.aliyun.com:{organizationId}/{group}/{repo}.git

    let owner = '';
    let repo = '';
    let platform: 'github' | 'gitlab' | 'gitee' | 'codeup' = 'github';
    let organizationId = '';
    let fullPath = '';

    try {
        // SSH格式
        if (url.startsWith('git@')) {
            // git@codeup.aliyun.com:628f3627487c500c27f5d72a/xilin_feng_teng/chaos.git
            const match = url.match(/git@([^:]+):(.+?)(\.git)?$/);
            if (match) {
                const host = match[1];
                const pathPart = match[2];

                if (host.includes('codeup.aliyun.com')) {
                    platform = 'codeup';
                    // 解析路径: {orgId}/{group}/{repo}
                    const pathParts = pathPart.split('/');
                    if (pathParts.length >= 3) {
                        organizationId = pathParts[0];
                        owner = pathParts[1];
                        repo = pathParts[2].replace('.git', '');
                        fullPath = `${owner}/${repo}`;
                    } else if (pathParts.length === 2) {
                        organizationId = pathParts[0];
                        owner = '';
                        repo = pathParts[1].replace('.git', '');
                        fullPath = repo;
                    }
                } else {
                    // 其他平台的SSH格式
                    const parts = pathPart.split('/');
                    if (parts.length >= 2) {
                        owner = parts[0];
                        repo = parts[1].replace('.git', '');
                    }

                    if (host.includes('github')) platform = 'github';
                    else if (host.includes('gitlab')) platform = 'gitlab';
                    else if (host.includes('gitee')) platform = 'gitee';
                }
            }
        } else {
            // HTTPS格式
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);

            // 云效Codeup格式: https://codeup.aliyun.com/{organizationId}/{group}/{repo}
            if (urlObj.host.includes('codeup.aliyun.com')) {
                platform = 'codeup';
                if (pathParts.length >= 3) {
                    organizationId = pathParts[0];
                    owner = pathParts[1];
                    repo = pathParts[2].replace('.git', '');
                    fullPath = `${owner}/${repo}`;
                } else if (pathParts.length === 2) {
                    organizationId = pathParts[0];
                    owner = '';
                    repo = pathParts[1].replace('.git', '');
                    fullPath = repo;
                }
            } else if (pathParts.length >= 2) {
                owner = pathParts[0];
                repo = pathParts[1].replace('.git', '');

                if (urlObj.host.includes('github')) platform = 'github';
                else if (urlObj.host.includes('gitlab')) platform = 'gitlab';
                else if (urlObj.host.includes('gitee')) platform = 'gitee';
            }
        }

        if ((owner && repo) || (platform === 'codeup' && repo)) {
            return {
                owner,
                repo,
                platform,
                organizationId: organizationId || undefined,
                fullPath: fullPath || undefined
            };
        }
    } catch {
        return null;
    }

    return null;
}

// 获取GitHub提交记录
export async function fetchGitHubCommits(
    owner: string,
    repo: string,
    author: string,
    since: string,
    until: string,
    token?: string
): Promise<GitCommit[]> {
    const params = new URLSearchParams({
        since: dayjs(since).toISOString(),
        until: dayjs(until).endOf('day').toISOString(),
        per_page: '100',
    });

    if (author) {
        params.append('author', author);
    }

    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
    };

    if (token) {
        headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?${params}`,
        {headers}
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '获取提交记录失败');
    }

    const data = await response.json();

    return data.map((item: {
        sha: string;
        commit: { message: string; author: { name: string; date: string } };
        html_url: string
    }) => ({
        sha: item.sha.substring(0, 7),
        message: item.commit.message.split('\n')[0], // 只取第一行
        author: item.commit.author.name,
        date: dayjs(item.commit.author.date).format('YYYY-MM-DD HH:mm:ss'),
        url: item.html_url,
    }));
}

// 获取Gitee提交记录
export async function fetchGiteeCommits(
    owner: string,
    repo: string,
    author: string,
    since: string,
    until: string,
    token?: string
): Promise<GitCommit[]> {
    const params = new URLSearchParams({
        since: dayjs(since).toISOString(),
        until: dayjs(until).endOf('day').toISOString(),
        per_page: '100',
    });

    if (author) {
        params.append('author', author);
    }

    if (token) {
        params.append('access_token', token);
    }

    const response = await fetch(
        `https://gitee.com/api/v5/repos/${owner}/${repo}/commits?${params}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '获取提交记录失败');
    }

    const data = await response.json();

    return data.map((item: {
        sha: string;
        commit: { message: string; author: { name: string; date: string } };
        html_url: string
    }) => ({
        sha: item.sha.substring(0, 7),
        message: item.commit.message.split('\n')[0],
        author: item.commit.author.name,
        date: dayjs(item.commit.author.date).format('YYYY-MM-DD HH:mm:ss'),
        url: item.html_url,
    }));
}

// 获取GitLab提交记录
export async function fetchGitLabCommits(
    owner: string,
    repo: string,
    author: string,
    since: string,
    until: string,
    token?: string
): Promise<GitCommit[]> {
    const projectId = encodeURIComponent(`${owner}/${repo}`);

    const params = new URLSearchParams({
        since: dayjs(since).toISOString(),
        until: dayjs(until).endOf('day').toISOString(),
        per_page: '100',
    });

    if (author) {
        params.append('author', author);
    }

    const headers: HeadersInit = {};
    if (token) {
        headers['PRIVATE-TOKEN'] = token;
    }

    const response = await fetch(
        `https://gitlab.com/api/v4/projects/${projectId}/repository/commits?${params}`,
        {headers}
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '获取提交记录失败');
    }

    const data = await response.json();

    return data.map((item: {
        short_id: string;
        title: string;
        author_name: string;
        created_at: string;
        web_url: string
    }) => ({
        sha: item.short_id,
        message: item.title,
        author: item.author_name,
        date: dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss'),
        url: item.web_url,
    }));
}

// 获取阿里云云效Codeup提交记录
// 注意：云效API需要特殊认证，纯前端调用有限制
export async function fetchCodeupCommits(
    organizationId: string,
    owner: string,
    repo: string,
    author: string,
    since: string,
    until: string,
    token?: string
): Promise<GitCommit[]> {
    if (!token) {
        throw new Error('云效Codeup需要提供个人访问令牌');
    }

    // 构建仓库路径
    const repoPath = owner ? `${owner}/${repo}` : repo;

    encodeURIComponent(repoPath);
    // 使用云效的API格式
    const params = new URLSearchParams({
        per_page: '100',
        private_token: token, // 尝试作为查询参数传递
    });

    // 添加时间范围
    if (since) {
        params.append('since', dayjs(since).startOf('day').toISOString());
    }
    if (until) {
        params.append('until', dayjs(until).endOf('day').toISOString());
    }

    // 尝试多种认证方式
    const headers: HeadersInit = {
        'PRIVATE-TOKEN': token,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    // 调用云效API
    const response = await fetch(
        `/codeup-api/${organizationId}/${repoPath}/-/api/commits?${params}`,
        {
            method: 'GET',
            headers,
            redirect: 'error', // 禁止重定向
        }
    );

    if (!response.ok) {
        // 云效API在浏览器中无法直接调用，提示用户使用本地方式
        throw new Error(
            '云效Codeup的API需要特殊认证，请使用“本地Git日志”方式获取提交记录\n\n' +
            '在本地仓库运行：\n' +
            `git log --pretty=format:"%h|%s|%an|%ai" --since="${since}" --until="${until}"` +
            (author ? ` --author="${author}"` : '')
        );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error('返回数据格式错误，请使用本地Git日志方式');
    }

    let commits = data;

    // 如果指定了作者，在客户端过滤
    if (author) {
        const authorLower = author.toLowerCase();
        commits = commits.filter((item: { author_name?: string; author_email?: string }) => {
            const name = (item.author_name || '').toLowerCase();
            const email = (item.author_email || '').toLowerCase();
            return name.includes(authorLower) || email.includes(authorLower);
        });
    }

    return commits.map((item: {
        short_id: string;
        id: string;
        title: string;
        author_name: string;
        created_at: string;
        web_url?: string
    }) => ({
        sha: item.short_id || item.id?.substring(0, 8),
        message: item.title,
        author: item.author_name,
        date: dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss'),
        url: item.web_url || `https://codeup.aliyun.com/${organizationId}/${repoPath}/commit/${item.id}`,
    }));
}

// 统一获取提交记录的入口
export async function fetchCommits(
    repoUrl: string,
    author: string,
    since: string,
    until: string,
    token?: string
): Promise<GitCommit[]> {
    const repoInfo = parseGitRepoUrl(repoUrl);

    if (!repoInfo) {
        throw new Error('无法解析仓库地址，请检查格式是否正确');
    }

    const {owner, repo, platform, organizationId} = repoInfo;

    switch (platform) {
        case 'github':
            return fetchGitHubCommits(owner, repo, author, since, until, token);
        case 'gitee':
            return fetchGiteeCommits(owner, repo, author, since, until, token);
        case 'gitlab':
            return fetchGitLabCommits(owner, repo, author, since, until, token);
        case 'codeup':
            if (!organizationId) {
                throw new Error('无法解析云效组织ID，请检查仓库地址格式');
            }
            return fetchCodeupCommits(organizationId, owner, repo, author, since, until, token);
        default:
            throw new Error('不支持的Git平台');
    }
}

// 生成周报文本
export function generateWeeklyReport(commits: GitCommit[], repoCommits?: { [repoPath: string]: GitCommit[] }): string {
    if (commits.length === 0) {
        return '本周暂无提交记录';
    }

    // 如果有按仓库分组的数据，则按仓库生成
    if (repoCommits && Object.keys(repoCommits).length > 0) {
        const sections: string[] = [];
        
        for (const [repoPath, repoCommitList] of Object.entries(repoCommits)) {
            if (repoCommitList.length === 0) continue;
            
            // 提取仓库名称
            const repoName = repoPath.split(/[/\\]/).pop() || repoPath;
            
            const lines = repoCommitList.map((commit, index) => {
                const branchInfo = commit.branch ? ` [${commit.branch}]` : '';
                return `${index + 1}. ${commit.message}${branchInfo} (${commit.date.split(' ')[0]})`;
            });
            
            sections.push(`## ${repoName}\n${lines.join('\n')}`);
        }
        
        return sections.join('\n\n');
    }

    // 单仓库模式
    const lines = commits.map((commit, index) => {
        const branchInfo = commit.branch ? ` [${commit.branch}]` : '';
        return `${index + 1}. ${commit.message}${branchInfo} (${commit.date.split(' ')[0]})`;
    });

    return lines.join('\n');
}

// 从本地Git仓库获取提交记录
export async function fetchLocalGitCommits(
    repoPath: string,
    author: string,
    since: string,
    until: string,
    branch?: string
): Promise<GitCommit[]> {
    // Electron 环境使用 IPC
    if (isElectron()) {
        const result = await window.electronAPI!.gitLog({
            repoPath,
            author,
            since,
            until,
            branch,
        });

        if (!result.success) {
            throw new Error(result.error || '获取提交记录失败');
        }

        return (result.commits || []).map((commit) => ({
            sha: commit.sha,
            message: commit.message,
            author: commit.author,
            date: commit.date,
            url: '',
            branch: branch === '__all__' ? undefined : branch,
        }));
    }

    // 回退到 HTTP 请求（开发模式）
    const response = await fetch('http://localhost:3001/api/git-log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            repoPath,
            author,
            since,
            until,
            branch,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '获取提交记录失败');
    }

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取提交记录失败');
    }

    return data.commits.map((commit: { sha: string; message: string; author: string; date: string; id: string }) => ({
        sha: commit.sha,
        message: commit.message,
        author: commit.author,
        date: commit.date,
        url: '',
        branch: branch === '__all__' ? undefined : branch,
    }));
}

// 获取仓库分支列表
export async function fetchBranches(repoPath: string): Promise<{ branches: string[]; currentBranch: string }> {
    // Electron 环境使用 IPC
    if (isElectron()) {
        const result = await window.electronAPI!.getBranches(repoPath);

        if (!result.success) {
            throw new Error(result.error || '获取分支列表失败');
        }

        return {
            branches: result.branches || [],
            currentBranch: result.currentBranch || '',
        };
    }

    // 回退到 HTTP 请求
    const response = await fetch('http://localhost:3001/api/branches', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({repoPath}),
    });

    if (!response.ok) {
        throw new Error('获取分支列表失败');
    }

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取分支列表失败');
    }

    return {
        branches: data.branches,
        currentBranch: data.currentBranch,
    };
}

// 获取仓库作者列表
export async function fetchAuthors(repoPath: string): Promise<string[]> {
    // Electron 环境使用 IPC
    if (isElectron()) {
        const result = await window.electronAPI!.getAuthors(repoPath);

        if (!result.success) {
            throw new Error(result.error || '获取作者列表失败');
        }

        return result.authors || [];
    }

    // 回退到 HTTP 请求
    const response = await fetch('http://localhost:3001/api/authors', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({repoPath}),
    });

    if (!response.ok) {
        throw new Error('获取作者列表失败');
    }

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '获取作者列表失败');
    }

    return data.authors;
}

// 更新仓库（git pull）
export async function gitPull(repoPath: string): Promise<{ success: boolean; message: string }> {
    // Electron 环境使用 IPC
    if (isElectron()) {
        const result = await window.electronAPI!.gitPull(repoPath);

        if (!result.success) {
            throw new Error(result.error || 'git pull 失败');
        }

        return {
            success: true,
            message: result.message || 'Already up to date.',
        };
    }

    // 回退到 HTTP 请求
    const response = await fetch('http://localhost:3001/api/git-pull', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({repoPath}),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'git pull 失败');
    }

    return {
        success: data.success,
        message: data.message,
    };
}

// 检查路径是否为Git仓库
export async function checkIsGitRepo(repoPath: string): Promise<boolean> {
    try {
        // Electron 环境使用 IPC
        if (isElectron()) {
            const result = await window.electronAPI!.checkRepo(repoPath);
            return result.isGitRepo === true;
        }

        // 回退到 HTTP 请求
        const response = await fetch('http://localhost:3001/api/check-repo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({repoPath}),
        });

        const data = await response.json();
        return data.isGitRepo === true;
    } catch {
        return false;
    }
}

// AI优化周报内容
export interface AIOptimizeResult {
    success: boolean;
    report: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    error?: string;
}

// 流式调用AI优化周报
export async function optimizeReportWithAIStream(
    commits: GitCommit[],
    apiKey: string,
    model: string,
    promptTemplate: string,
    onChunk: (content: string) => void,
    onComplete: () => void,
    onError: (error: string) => void,
    provider?: string,
    customApiUrl?: string,
    customModel?: string,
    abortSignal?: AbortSignal
): Promise<void> {
    // Electron 环境使用 IPC
    if (isElectron()) {
        try {
            // 设置流式监听器
            window.electronAPI!.removeAIListeners();
            window.electronAPI!.onAIStreamChunk(onChunk);
            window.electronAPI!.onAIStreamDone(() => {
                window.electronAPI!.removeAIListeners();
                onComplete();
            });

            // 监听取消信号
            if (abortSignal) {
                abortSignal.addEventListener('abort', () => {
                    window.electronAPI!.removeAIListeners();
                    onError('cancelled');
                });
            }

            const result = await window.electronAPI!.optimizeReport({
                commits,
                apiKey,
                model: model || 'qwen-plus',
                promptTemplate: promptTemplate || '',
                provider: provider || 'dashscope',
                customApiUrl: customApiUrl || '',
                customModel: customModel || '',
            });

            if (!result.success) {
                window.electronAPI!.removeAIListeners();
                onError(result.error || 'AI优化失败');
            }
        } catch (error) {
            window.electronAPI!.removeAIListeners();
            if (abortSignal?.aborted) {
                onError('cancelled');
            } else {
                onError(error instanceof Error ? error.message : 'AI优化失败');
            }
        }
        return;
    }

    // 回退到 HTTP 请求
    try {
        const response = await fetch('http://localhost:3001/api/optimize-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                commits,
                apiKey,
                model: model || 'qwen-plus',
                promptTemplate: promptTemplate || '',
                provider: provider || 'dashscope',
                customApiUrl: customApiUrl || '',
                customModel: customModel || '',
            }),
            signal: abortSignal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            onError(errorData.error || 'AI优化失败');
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
            onError('无法读取响应流');
            return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            // 检查是否已取消
            if (abortSignal?.aborted) {
                reader.cancel();
                onError('cancelled');
                return;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        continue;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            onChunk(parsed.content);
                        }
                    } catch {
                        // 忽略解析错误
                    }
                }
            }
        }

        onComplete();
    } catch (error) {
        if (abortSignal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
            onError('cancelled');
        } else {
            onError(error instanceof Error ? error.message : 'AI优化失败');
        }
    }
}

export async function optimizeReportWithAI(
    commits: GitCommit[],
    apiKey: string,
    model?: string,
    promptTemplate?: string
): Promise<AIOptimizeResult> {
    const response = await fetch('http://localhost:3001/api/optimize-report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            commits,
            apiKey,
            model: model || 'qwen-plus',
            promptTemplate: promptTemplate || '',
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        return {
            success: false,
            report: '',
            error: data.error || 'AI优化失败',
        };
    }

    return {
        success: true,
        report: data.report,
        usage: data.usage,
    };
}

// 解析git log输出
// 支持格式: git log --oneline --since="2025-12-22" --until="2025-12-28" --author="your-name"
// 或者: git log --pretty=format:"%h|%s|%an|%ai" --since="2025-12-22" --until="2025-12-28"
export function parseGitLog(gitLogOutput: string): GitCommit[] {
    const lines = gitLogOutput.trim().split('\n').filter(line => line.trim());
    const commits: GitCommit[] = [];

    for (const line of lines) {
        // 尝试解析自定义格式: sha|message|author|date
        if (line.includes('|')) {
            const parts = line.split('|');
            if (parts.length >= 4) {
                commits.push({
                    sha: parts[0].trim(),
                    message: parts[1].trim(),
                    author: parts[2].trim(),
                    date: parts[3].trim(),
                    url: '',
                });
                continue;
            }
        }

        // 尝试解析 --oneline 格式: sha message
        const onelineMatch = line.match(/^([a-f0-9]{7,40})\s+(.+)$/);
        if (onelineMatch) {
            commits.push({
                sha: onelineMatch[1],
                message: onelineMatch[2],
                author: '',
                date: '',
                url: '',
            });
            continue;
        }

        // 尝试解析完整格式的第一行: commit sha
        const commitMatch = line.match(/^commit\s+([a-f0-9]{40})/);
        if (commitMatch) {
            commits.push({
                sha: commitMatch[1].substring(0, 7),
                message: '',
                author: '',
                date: '',
                url: '',
            });
            continue;
        }

        // 解析其他行并填充到最后一个commit
        if (commits.length > 0) {
            const lastCommit = commits[commits.length - 1];

            const authorMatch = line.match(/^Author:\s*(.+?)\s*</);
            if (authorMatch) {
                lastCommit.author = authorMatch[1];
                continue;
            }

            const dateMatch = line.match(/^Date:\s*(.+)$/);
            if (dateMatch) {
                lastCommit.date = dateMatch[1].trim();
                continue;
            }

            // 提交信息（通常有缩进）
            if (line.startsWith('    ') && !lastCommit.message) {
                lastCommit.message = line.trim();
            }
        }
    }

    return commits.filter(c => c.message); // 过滤掉没有消息的提交
}
