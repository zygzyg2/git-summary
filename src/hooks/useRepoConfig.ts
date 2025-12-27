import { useState, useMemo } from 'react';
import { message } from 'antd';
import { RepoConfig, RepoCommits } from '../types';
import { fetchBranches, fetchAuthors, gitPull } from '../services/gitService';
import { getRepoName, saveRepoPathToHistory, getRepoPathHistory } from '../utils/helpers';

export interface UseRepoConfigReturn {
    repoConfigs: RepoConfig[];
    inputRepoPath: string;
    pullingRepos: Set<string>;
    selectedAuthors: string[];
    repoPathHistory: string[];
    allAuthors: string[];
    setInputRepoPath: (path: string) => void;
    setSelectedAuthors: (authors: string[]) => void;
    setRepoPathHistory: (history: string[]) => void;
    addRepoFromInput: () => Promise<void>;
    selectFolder: (folderPath: string) => Promise<void>;
    removeRepo: (repoPath: string, setRepoCommits: React.Dispatch<React.SetStateAction<RepoCommits>>) => void;
    updateRepoSelectedBranches: (repoPath: string, branches: string[]) => void;
    handleGitPull: (repoPath: string) => Promise<void>;
    handleGitPullAll: () => Promise<void>;
    loadBranchesForRepo: (repoPath: string) => Promise<void>;
}

export function useRepoConfig(): UseRepoConfigReturn {
    const [repoConfigs, setRepoConfigs] = useState<RepoConfig[]>([]);
    const [inputRepoPath, setInputRepoPath] = useState('');
    const [pullingRepos, setPullingRepos] = useState<Set<string>>(new Set());
    const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
    const [repoPathHistory, setRepoPathHistory] = useState<string[]>(() => getRepoPathHistory());

    // 计算所有仓库的作者合集
    const allAuthors = useMemo(() => {
        const authorsSet = new Set<string>();
        repoConfigs.forEach(r => r.authors.forEach(a => authorsSet.add(a)));
        return [...authorsSet].sort();
    }, [repoConfigs]);

    // 为指定仓库加载分支和作者
    const loadBranchesForRepo = async (repoPath: string) => {
        try {
            const [branchResult, authors] = await Promise.all([
                fetchBranches(repoPath),
                fetchAuthors(repoPath).catch(() => [] as string[]),
            ]);

            setRepoConfigs(prev => prev.map(r => {
                if (r.path === repoPath) {
                    return {
                        ...r,
                        branches: branchResult.branches,
                        currentBranch: branchResult.currentBranch,
                        selectedBranches: [branchResult.currentBranch],
                        loadingBranches: false,
                        authors,
                    };
                }
                return r;
            }));
        } catch (error) {
            console.error('加载分支失败:', error);
            setRepoConfigs(prev => prev.map(r => {
                if (r.path === repoPath) {
                    return { ...r, loadingBranches: false };
                }
                return r;
            }));
            message.error(`加载分支失败: ${repoPath}`);
        }
    };

    // 从输入框添加仓库
    const addRepoFromInput = async () => {
        if (!inputRepoPath.trim()) {
            message.warning('请输入仓库路径');
            return;
        }

        const path = inputRepoPath.trim();
        if (repoConfigs.some(r => r.path === path)) {
            message.warning('该仓库已添加');
            return;
        }

        const newConfig: RepoConfig = {
            path,
            branches: [],
            selectedBranches: [],
            currentBranch: '',
            loadingBranches: true,
            authors: [],
        };
        setRepoConfigs(prev => [...prev, newConfig]);
        setInputRepoPath('');
        saveRepoPathToHistory(path, repoPathHistory, setRepoPathHistory);

        await loadBranchesForRepo(path);
    };

    // 选择文件夹（添加到多仓库列表）
    const selectFolder = async (folderPath: string) => {
        if (repoConfigs.some(r => r.path === folderPath)) {
            message.warning('该仓库已添加');
            return;
        }

        const newConfig: RepoConfig = {
            path: folderPath,
            branches: [],
            selectedBranches: [],
            currentBranch: '',
            loadingBranches: true,
            authors: [],
        };
        setRepoConfigs(prev => [...prev, newConfig]);
        saveRepoPathToHistory(folderPath, repoPathHistory, setRepoPathHistory);

        await loadBranchesForRepo(folderPath);
    };

    // 移除仓库
    const removeRepo = (repoPath: string, setRepoCommits: React.Dispatch<React.SetStateAction<RepoCommits>>) => {
        setRepoConfigs(prev => prev.filter(r => r.path !== repoPath));
        setRepoCommits(prev => {
            const newCommits = { ...prev };
            delete newCommits[repoPath];
            return newCommits;
        });
    };

    // 更新仓库的选中分支
    const updateRepoSelectedBranches = (repoPath: string, branches: string[]) => {
        setRepoConfigs(prev => prev.map(r => {
            if (r.path === repoPath) {
                return { ...r, selectedBranches: branches };
            }
            return r;
        }));
    };

    // 更新仓库（git pull）
    const handleGitPull = async (repoPath: string) => {
        setPullingRepos(prev => new Set(prev).add(repoPath));
        try {
            const result = await gitPull(repoPath);
            message.success(`${getRepoName(repoPath)} 更新成功: ${result.message.split('\n')[0]}`);
            await loadBranchesForRepo(repoPath);
        } catch (error) {
            message.error(`${getRepoName(repoPath)} 更新失败: ${error instanceof Error ? error.message : 'git pull 失败'}`);
        } finally {
            setPullingRepos(prev => {
                const next = new Set(prev);
                next.delete(repoPath);
                return next;
            });
        }
    };

    // 更新所有仓库
    const handleGitPullAll = async () => {
        if (repoConfigs.length === 0) {
            message.warning('请先添加仓库');
            return;
        }
        for (const repo of repoConfigs) {
            await handleGitPull(repo.path);
        }
    };

    return {
        repoConfigs,
        inputRepoPath,
        pullingRepos,
        selectedAuthors,
        repoPathHistory,
        allAuthors,
        setInputRepoPath,
        setSelectedAuthors,
        setRepoPathHistory,
        addRepoFromInput,
        selectFolder,
        removeRepo,
        updateRepoSelectedBranches,
        handleGitPull,
        handleGitPullAll,
        loadBranchesForRepo,
    };
}
