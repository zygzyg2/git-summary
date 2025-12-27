import React from 'react';
import { Button, Card, Space, Tag } from 'antd';
import { CopyOutlined, RobotOutlined } from '@ant-design/icons';
import MarkdownEditor from './MarkdownEditor';

interface ReportTabProps {
    weeklyReport: string;
    totalCommits: number;
    optimizing: boolean;
    onWeeklyReportChange: (value: string) => void;
    onAIOptimize: () => void;
    onCopy: () => void;
}

const ReportTab: React.FC<ReportTabProps> = ({
    weeklyReport,
    totalCommits,
    optimizing,
    onWeeklyReportChange,
    onAIOptimize,
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
                    <Button
                        type="primary"
                        icon={<RobotOutlined />}
                        onClick={onAIOptimize}
                        loading={optimizing}
                        disabled={totalCommits === 0}
                    >
                        AI优化周报
                    </Button>
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
