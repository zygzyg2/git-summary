import React from 'react';
import { Button, Card, Space, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { RepoCommits } from '../types';
import { GitCommit } from '../services/gitService';
import { getRepoName } from '../utils/helpers';

interface CommitsTabProps {
    repoCommits: RepoCommits;
    totalCommits: number;
    activeCommitTab: string;
    onActiveCommitTabChange: (tab: string) => void;
    onOpenConfigDrawer: () => void;
}

// 表格列定义
const columns = [
    {
        title: 'SHA',
        dataIndex: 'sha',
        key: 'sha',
        width: 80,
        render: (sha: string, record: GitCommit) => (
            <a href={record.url} target="_blank" rel="noopener noreferrer">
                {sha}
            </a>
        ),
    },
    {
        title: '提交信息',
        dataIndex: 'message',
        key: 'message',
        ellipsis: {
            showTitle: false,
        },
        render: (text: string) => (
            <Tooltip placement="topLeft" title={text}>
                {text}
            </Tooltip>
        ),
    },
    {
        title: '分支',
        dataIndex: 'branch',
        key: 'branch',
        width: 160,
        ellipsis: true,
        render: (branch: string) => (
            branch ? (
                <Tooltip title={branch}>
                    <Tag color="blue" style={{
                        maxWidth: 140,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {branch}
                    </Tag>
                </Tooltip>
            ) : <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
        title: '作者',
        dataIndex: 'author',
        key: 'author',
        width: 100,
        ellipsis: true,
    },
    {
        title: '提交时间',
        dataIndex: 'date',
        key: 'date',
        width: 180,
        render: (date: string) => {
            if (!date) return '-';
            const d = dayjs(date);
            return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : date;
        },
    },
];

const CommitsTab: React.FC<CommitsTabProps> = ({
    repoCommits,
    totalCommits,
    activeCommitTab,
    onActiveCommitTabChange,
    onOpenConfigDrawer,
}) => {
    if (totalCommits === 0) {
        return (
            <Card>
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                    <p>暂无提交记录</p>
                    <Button type="primary" onClick={onOpenConfigDrawer}>
                        获取提交记录
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <Tabs
                activeKey={activeCommitTab}
                onChange={onActiveCommitTabChange}
                items={Object.entries(repoCommits).map(([repoPath, commits]) => ({
                    key: repoPath,
                    label: (
                        <Space>
                            <FolderOutlined style={{ color: '#52c41a' }} />
                            <span>{getRepoName(repoPath)}</span>
                            <Tag color="blue">{commits.length}</Tag>
                        </Space>
                    ),
                    children: (
                        <Table
                            dataSource={commits}
                            columns={columns}
                            rowKey="sha"
                            pagination={{
                                pageSize: 10,
                                showSizeChanger: true,
                                showQuickJumper: true,
                            }}
                        />
                    ),
                }))}
            />
        </Card>
    );
};

export default CommitsTab;
