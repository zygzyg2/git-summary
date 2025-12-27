import React, {useState, useMemo, useRef} from 'react';
import {message} from 'antd';
import {Dayjs} from 'dayjs';
import {RepoConfig, RepoCommits} from '../types';
import {
    GitCommit,
    fetchCommits,
    fetchLocalGitCommits,
    generateWeeklyReport,
    parseGitLog,
    optimizeReportWithAIStream,
} from '../services/gitService';

export interface UseCommitsReturn {
    loading: boolean;
    repoCommits: RepoCommits;
    weeklyReport: string;
    optimizing: boolean;
    activeCommitTab: string;
    allCommits: GitCommit[];
    totalCommits: number;
    setLoading: (loading: boolean) => void;
    setRepoCommits: React.Dispatch<React.SetStateAction<RepoCommits>>;
    setWeeklyReport: (report: string) => void;
    setOptimizing: (optimizing: boolean) => void;
    setActiveCommitTab: (tab: string) => void;
    onFinish: (values: {
        repoUrl: string;
        author: string;
        dateRange: [Dayjs, Dayjs];
        token?: string;
    }) => Promise<void>;
    onGitLogPaste: (values: { gitLog: string }) => void;
    onLocalRepoSubmit: (
        values: { dateRange: [Dayjs, Dayjs] },
        repoConfigs: RepoConfig[],
        selectedAuthors: string[]
    ) => Promise<void>;
    handleAIOptimize: (
        apiKey: string,
        model: string,
        promptTemplate: string,
        openSettings: () => void,
        provider?: string,
        customApiUrl?: string,
        customModel?: string
    ) => Promise<void>;
    cancelAIOptimize: () => void;
    copyToClipboard: () => Promise<void>;
}

export function useCommits(): UseCommitsReturn {
    const [loading, setLoading] = useState(false);
    const [repoCommits, setRepoCommits] = useState<RepoCommits>({});
    const [weeklyReport, setWeeklyReport] = useState('');
    const [optimizing, setOptimizing] = useState(false);
    const [activeCommitTab, setActiveCommitTab] = useState<string>('');

    // 用于取消AI请求
    const abortControllerRef = useRef<AbortController | null>(null);

    // 计算所有提交记录
    const allCommits = useMemo(() => {
        return Object.values(repoCommits).flat();
    }, [repoCommits]);

    // 计算总提交数
    const totalCommits = useMemo(() => {
        return Object.values(repoCommits).reduce((sum, commits) => sum + commits.length, 0);
    }, [repoCommits]);

    // 提交表单（API获取）
    const onFinish = async (values: {
        repoUrl: string;
        author: string;
        dateRange: [Dayjs, Dayjs];
        token?: string;
    }) => {
        setLoading(true);
        setRepoCommits({});
        setWeeklyReport('');

        try {
            const {repoUrl, author, dateRange, token} = values;
            const [since, until] = dateRange;

            const result = await fetchCommits(
                repoUrl,
                author,
                since.format('YYYY-MM-DD'),
                until.format('YYYY-MM-DD'),
                token
            );

            setRepoCommits({[repoUrl]: result});
            setActiveCommitTab(repoUrl);
            setWeeklyReport(generateWeeklyReport(result));

            if (result.length === 0) {
                message.info('未找到符合条件的提交记录');
            } else {
                message.success(`成功获取 ${result.length} 条提交记录`);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : '获取提交记录失败');
        } finally {
            setLoading(false);
        }
    };

    // 处理本地Git日志粘贴
    const onGitLogPaste = (values: { gitLog: string }) => {
        setRepoCommits({});
        setWeeklyReport('');

        try {
            const result = parseGitLog(values.gitLog);
            setRepoCommits({'Git日志': result});
            setActiveCommitTab('Git日志');
            setWeeklyReport(generateWeeklyReport(result));

            if (result.length === 0) {
                message.warning('未能解析出提交记录，请检查格式');
            } else {
                message.success(`成功解析 ${result.length} 条提交记录`);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : '解析失败');
        }
    };

    // 处理本地仓库路径获取（多仓库多分支）
    const onLocalRepoSubmit = async (
        values: { dateRange: [Dayjs, Dayjs] },
        repoConfigs: RepoConfig[],
        selectedAuthors: string[]
    ) => {
        if (repoConfigs.length === 0) {
            message.warning('请先添加至少一个仓库');
            return;
        }

        setLoading(true);
        setRepoCommits({});
        setWeeklyReport('');

        try {
            const {dateRange} = values;
            const [since, until] = dateRange;

            const newRepoCommits: RepoCommits = {};
            let totalCount = 0;
            let firstRepo = '';

            const authorsToQuery = selectedAuthors.length > 0 ? selectedAuthors : [''];

            for (const repo of repoConfigs) {
                const repoCommitsArray: GitCommit[] = [];

                const branchesToFetch = repo.selectedBranches.length > 0
                    ? repo.selectedBranches
                    : ['__all__'];

                for (const branch of branchesToFetch) {
                    for (const author of authorsToQuery) {
                        try {
                            const result = await fetchLocalGitCommits(
                                repo.path,
                                author,
                                since.format('YYYY-MM-DD'),
                                until.format('YYYY-MM-DD'),
                                branch
                            );

                            for (const commit of result) {
                                if (!repoCommitsArray.some(c => c.sha === commit.sha)) {
                                    repoCommitsArray.push(commit);
                                }
                            }
                        } catch (error) {
                            console.error(`获取仓库 ${repo.path} 分支 ${branch} 失败:`, error);
                            message.warning(`仓库 ${repo.path} 分支 ${branch} 获取失败`);
                        }
                    }
                }

                repoCommitsArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                newRepoCommits[repo.path] = repoCommitsArray;
                totalCount += repoCommitsArray.length;
                if (!firstRepo) firstRepo = repo.path;
            }

            setRepoCommits(newRepoCommits);
            setActiveCommitTab(firstRepo);

            const allCommitsFlat = Object.values(newRepoCommits).flat();
            setWeeklyReport(generateWeeklyReport(allCommitsFlat, newRepoCommits));

            if (totalCount === 0) {
                message.info('未找到符合条件的提交记录');
            } else {
                message.success(`成功获取 ${totalCount} 条提交记录（${Object.keys(newRepoCommits).length} 个仓库）`);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : '获取提交记录失败，请确保后端服务已启动');
        } finally {
            setLoading(false);
        }
    };

    // 使用AI优化周报（流式输出）
    const handleAIOptimize = async (
        apiKey: string,
        model: string,
        promptTemplate: string,
        openSettings: () => void,
        provider?: string,
        customApiUrl?: string,
        customModel?: string
    ) => {
        if (allCommits.length === 0) {
            message.warning('请先获取提交记录');
            return;
        }

        if (!apiKey) {
            openSettings();
            message.info('请先配置AI API Key');
            return;
        }

        // 取消之前的请求
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setOptimizing(true);
        setWeeklyReport('');

        await optimizeReportWithAIStream(
            allCommits,
            apiKey,
            model,
            promptTemplate,
            (content) => {
                setWeeklyReport((prev) => prev + content);
            },
            () => {
                setOptimizing(false);
                abortControllerRef.current = null;
                message.success('AI优化周报完成');
            },
            (error) => {
                setOptimizing(false);
                abortControllerRef.current = null;
                if (error !== 'cancelled') {
                    message.error(error);
                }
            },
            provider,
            customApiUrl,
            customModel,
            abortControllerRef.current.signal
        );
    };

    // 取消AI优化请求
    const cancelAIOptimize = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setOptimizing(false);
            message.info('已取消AI优化');
        }
    };

    // 复制周报到剪贴板
    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(weeklyReport);
            message.success('周报已复制到剪贴板');
        } catch {
            message.error('复制失败，请手动复制');
        }
    };

    return {
        loading,
        repoCommits,
        weeklyReport,
        optimizing,
        activeCommitTab,
        allCommits,
        totalCommits,
        setLoading,
        setRepoCommits,
        setWeeklyReport,
        setOptimizing,
        setActiveCommitTab,
        onFinish,
        onGitLogPaste,
        onLocalRepoSubmit,
        handleAIOptimize,
        cancelAIOptimize,
        copyToClipboard,
    };
}
