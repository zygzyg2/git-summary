import { GitCommit } from './services/gitService';

// 仓库配置类型
export interface RepoConfig {
    path: string;
    branches: string[];
    selectedBranches: string[];
    currentBranch: string;
    loadingBranches: boolean;
    authors: string[];
}

// 提交记录按仓库分组
export interface RepoCommits {
    [repoPath: string]: GitCommit[];
}

// 目录信息
export interface DirectoryInfo {
    name: string;
    path: string;
    isGitRepo: boolean;
}
