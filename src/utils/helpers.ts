import dayjs, { Dayjs } from 'dayjs';

/**
 * 获取本周的开始和结束日期
 */
export const getThisWeekRange = (): [Dayjs, Dayjs] => {
    const now = dayjs();
    const startOfWeek = now.startOf('week').add(1, 'day'); // 周一开始
    const endOfWeek = now.endOf('week').add(1, 'day'); // 周日结束
    return [startOfWeek, endOfWeek];
};

/**
 * 获取仓库名称（从路径中提取）
 */
export const getRepoName = (repoPath: string): string => {
    const parts = repoPath.split(/[/\\]/);
    return parts[parts.length - 1] || repoPath;
};

/**
 * 保存仓库路径到历史记录
 */
export const saveRepoPathToHistory = (
    path: string,
    currentHistory: string[],
    setHistory: (history: string[]) => void
): void => {
    if (!path || path.trim() === '') return;
    const trimmedPath = path.trim();
    const newHistory = [trimmedPath, ...currentHistory.filter(p => p !== trimmedPath)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('repo_path_history', JSON.stringify(newHistory));
};

/**
 * 从 localStorage 获取仓库路径历史
 */
export const getRepoPathHistory = (): string[] => {
    try {
        return JSON.parse(localStorage.getItem('repo_path_history') || '[]');
    } catch {
        return [];
    }
};
