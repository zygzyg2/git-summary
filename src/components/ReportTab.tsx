import React from 'react';
import { Button, Card, Space, Tag } from 'antd';
import { CopyOutlined, RobotOutlined, StopOutlined } from '@ant-design/icons';
import MarkdownEditor from './MarkdownEditor';

interface ReportTabProps {
    weeklyReport: string;
    totalCommits: number;
    optimizing: boolean;
    onWeeklyReportChange: (value: string) => void;
    onAIOptimize: () => void;
    onCancelAIOptimize: () => void;
    onCopy: () => void;
}

const ReportTab: React.FC<ReportTabProps> = ({
    weeklyReport,
    totalCommits,
    optimizing,
    onWeeklyReportChange,
    onAIOptimize,
    onCancelAIOptimize,
    onCopy,
}) => {
    return (
        <Card>
            <div style={{
                marginBottom: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <Space>
                    {totalCommits > 0 && (
                        <Tag color="blue">{totalCommits} 条提交记录</Tag>
                    )}
                </Space>
                <Space>
                    {optimizing ? (
                        <Button
                            danger
                            icon={<StopOutlined />}
                            onClick={onCancelAIOptimize}
                        >
                            取消生成
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            icon={<RobotOutlined />}
                            onClick={onAIOptimize}
                            disabled={totalCommits === 0}
                        >
                            AI优化周报
                        </Button>
                    )}
                    <Button icon={<CopyOutlined />} onClick={onCopy}>
                        复制周报
                    </Button>
                </Space>
            </div>
            <MarkdownEditor
                value={weeklyReport}
                onChange={onWeeklyReportChange}
                streaming={optimizing}
            />
        </Card>
    );
};

export default ReportTab;
