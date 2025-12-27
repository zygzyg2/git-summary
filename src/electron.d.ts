// Electron API 类型声明
export interface ElectronAPI {
    getHomeDir: () => Promise<string>;
    browseDir: (dirPath?: string) => Promise<{
        success: boolean;
        currentPath?: string;
        parentPath?: string;
        directories?: Array<{
            name: string;
            path: string;
            isGitRepo: boolean;
        }>;
        error?: string;
    }>;
    checkRepo: (repoPath: string) => Promise<{
        success: boolean;
        isGitRepo: boolean;
    }>;
    gitLog: (options: {
        repoPath: string;
        since?: string;
        until?: string;
        author?: string;
        branch?: string;
    }) => Promise<{
        success: boolean;
        commits?: Array<{
            id: string;
            sha: string;
            message: string;
            author: string;
            email: string;
            date: string;
        }>;
        total?: number;
        error?: string;
    }>;
    getBranches: (repoPath: string) => Promise<{
        success: boolean;
        branches?: string[];
        currentBranch?: string;
        error?: string;
    }>;
    getAuthors: (repoPath: string) => Promise<{
        success: boolean;
        authors?: string[];
        error?: string;
    }>;
    gitPull: (repoPath: string) => Promise<{
        success: boolean;
        message?: string;
        error?: string;
    }>;
    optimizeReport: (options: {
        commits: Array<{ message: string; author: string; date: string }>;
        apiKey: string;
        model?: string;
        promptTemplate?: string;
    }) => Promise<{
        success: boolean;
        error?: string;
    }>;
    onAIStreamChunk: (callback: (content: string) => void) => void;
    onAIStreamDone: (callback: () => void) => void;
    removeAIListeners: () => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export {};
