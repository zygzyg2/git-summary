import React from 'react';
import { Button, Layout, Space, Tooltip, Typography } from 'antd';
import { GithubOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';

const { Header } = Layout;
const { Title } = Typography;

interface AppHeaderProps {
    onOpenConfigDrawer: () => void;
    onOpenAISettings: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onOpenConfigDrawer, onOpenAISettings }) => {
    return (
        <Header
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '0 24px',
                height: 56,
            }}
        >
            <Space>
                <GithubOutlined style={{ fontSize: 24, color: '#fff' }} />
                <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 600 }}>
                    Git 周报助手
                </Title>
            </Space>
            <Space>
                <Button
                    icon={<PlusOutlined />}
                    onClick={onOpenConfigDrawer}
                >
                    获取提交记录
                </Button>
                <Tooltip title="AI设置">
                    <Button
                        icon={<SettingOutlined />}
                        onClick={onOpenAISettings}
                    />
                </Tooltip>
            </Space>
        </Header>
    );
};

export default AppHeader;
