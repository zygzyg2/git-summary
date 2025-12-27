import { useState } from 'react';
import { message } from 'antd';
import { DirectoryInfo } from '../types';
import { isElectron } from '../services/gitService';

export interface UseFolderBrowserReturn {
    folderBrowserVisible: boolean;
    browsingPath: string;
    directories: DirectoryInfo[];
    loadingDirs: boolean;
    setFolderBrowserVisible: (visible: boolean) => void;
    setBrowsingPath: (path: string) => void;
    openFolderBrowser: () => Promise<void>;
    browsePath: (dirPath: string) => Promise<void>;
    goToParent: () => void;
}

export function useFolderBrowser(): UseFolderBrowserReturn {
    const [folderBrowserVisible, setFolderBrowserVisible] = useState(false);
    const [browsingPath, setBrowsingPath] = useState('');
    const [directories, setDirectories] = useState<DirectoryInfo[]>([]);
    const [loadingDirs, setLoadingDirs] = useState(false);

    // 浏览指定路径
    const browsePath = async (dirPath: string) => {
        setLoadingDirs(true);
        try {
            // Electron 环境使用 IPC
            if (isElectron()) {
                const data = await window.electronAPI!.browseDir(dirPath);
                if (data.success) {
                    setBrowsingPath(data.currentPath || '');
                    setDirectories(data.directories || []);
                } else {
                    message.error(data.error || '读取目录失败');
                }
            } else {
                // 回退到 HTTP 请求
                const res = await fetch('http://localhost:3001/api/browse-dir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dirPath }),
                });
                const data = await res.json();
                if (data.success) {
                    setBrowsingPath(data.currentPath);
                    setDirectories(data.directories);
                } else {
                    message.error(data.error || '读取目录失败');
                }
            }
        } catch (error) {
            message.error('读取目录失败');
        } finally {
            setLoadingDirs(false);
        }
    };

    // 打开文件夹浏览器
    const openFolderBrowser = async () => {
        setFolderBrowserVisible(true);
        setLoadingDirs(true);
        try {
            let homePath: string;
            // Electron 环境使用 IPC
            if (isElectron()) {
                homePath = await window.electronAPI!.getHomeDir();
            } else {
                // 回退到 HTTP 请求
                const res = await fetch('http://localhost:3001/api/home-dir');
                const data = await res.json();
                homePath = data.path;
            }
            await browsePath(homePath);
        } catch (error) {
            message.error('无法连接后端服务');
        }
    };

    // 返回上级目录
    const goToParent = () => {
        const parentPath = browsingPath.split(/[\/\\]/).slice(0, -1).join('/');
        if (parentPath) {
            browsePath(parentPath || '/');
        }
    };

    return {
        folderBrowserVisible,
        browsingPath,
        directories,
        loadingDirs,
        setFolderBrowserVisible,
        setBrowsingPath,
        openFolderBrowser,
        browsePath,
        goToParent,
    };
}
