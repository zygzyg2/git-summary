import React from 'react';
import { Button, Input, Modal, Space } from 'antd';
import { ArrowLeftOutlined, FolderOutlined } from '@ant-design/icons';
import { DirectoryInfo } from '../types';

interface FolderBrowserModalProps {
    visible: boolean;
    browsingPath: string;
    directories: DirectoryInfo[];
    loadingDirs: boolean;
    onClose: () => void;
    onBrowsingPathChange: (path: string) => void;
    onBrowsePath: (path: string) => void;
    onGoToParent: () => void;
    onSelectFolder: (path: string) => void;
}

const FolderBrowserModal: React.FC<FolderBrowserModalProps> = ({
    visible,
    browsingPath,
    directories,
    loadingDirs,
    onClose,
    onBrowsingPathChange,
    onBrowsePath,
    onGoToParent,
    onSelectFolder,
}) => {
    return (
        <Modal
            title="选择仓库文件夹"
            open={visible}
            onCancel={onClose}
            footer={null}
            width={600}
        >
            <div style={{ marginBottom: 12 }}>
                <Space>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={onGoToParent}
                        disabled={browsingPath === '/'}
                    >
                        上级目录
                    </Button>
                    <Input
                        value={browsingPath}
                        onChange={(e) => onBrowsingPathChange(e.target.value)}
                        onPressEnter={() => onBrowsePath(browsingPath)}
                        style={{ width: 350 }}
                        addonAfter={
                            <Button type="link" size="small" onClick={() => onBrowsePath(browsingPath)}>
                                跳转
                            </Button>
                        }
                    />
                </Space>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 6 }}>
                {loadingDirs ? (
                    <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>
                ) : directories.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>此目录下没有子文件夹</div>
                ) : (
                    directories.map((dir) => (
                        <div
                            key={dir.path}
                            style={{
                                padding: '10px 16px',
                                borderBottom: '1px solid #f0f0f0',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                            onDoubleClick={() => onBrowsePath(dir.path)}
                        >
                            <Space>
                                <FolderOutlined style={{ color: dir.isGitRepo ? '#52c41a' : '#1890ff' }} />
                                <span>{dir.name}</span>
                                {dir.isGitRepo && (
                                    <span style={{ color: '#52c41a', fontSize: 12 }}>(Git仓库)</span>
                                )}
                            </Space>
                            <Space>
                                <Button size="small" onClick={() => onBrowsePath(dir.path)}>
                                    打开
                                </Button>
                                {dir.isGitRepo && (
                                    <Button type="primary" size="small" onClick={() => onSelectFolder(dir.path)}>
                                        选择
                                    </Button>
                                )}
                            </Space>
                        </div>
                    ))
                )}
            </div>
            <div style={{ marginTop: 12, color: '#666', fontSize: 12 }}>
                提示：双击文件夹进入，绿色图标表示Git仓库，点击"选择"确认
            </div>
        </Modal>
    );
};

export default FolderBrowserModal;
