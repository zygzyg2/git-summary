import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 获取git提交记录
app.post('/api/git-log', async (req, res) => {
  try {
    const { repoPath, since, until, author } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: '请提供仓库路径' });
    }
    
    // 构建git命令参数 - 直接使用execFile避免shell问题
    const args = ['log', '--pretty=format:%H|%h|%s|%an|%ae|%ai'];
    
    // 添加分支参数
    if (req.body.branch) {
      if (req.body.branch === '__all__') {
        args.push('--all'); // 所有分支
      } else {
        args.push(req.body.branch);
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
    
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: repoPath,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    
    if (stderr && !stdout) {
      return res.status(500).json({ error: stderr });
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
    const { repoPath } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: '请提供仓库路径' });
    }
    
    const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
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
    const { repoPath } = req.body;
    
    if (!repoPath) {
      return res.status(400).json({ error: '请提供仓库路径' });
    }
    
    // 获取所有分支（本地+远程）
    const { stdout } = await execFileAsync('git', ['branch', '-a', '--format=%(refname:short)'], {
      cwd: repoPath,
      encoding: 'utf-8',
    });
    
    const branches = stdout.trim().split('\n')
      .filter(b => b.trim())
      .map(b => b.trim().replace('origin/', ''));
    
    // 去重
    const uniqueBranches = [...new Set(branches)];
    
    // 获取当前分支
    const { stdout: currentBranch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
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

app.listen(PORT, () => {
  console.log(`Git Summary 后端服务运行在 http://localhost:${PORT}`);
});
