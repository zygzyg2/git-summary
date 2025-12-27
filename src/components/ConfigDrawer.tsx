import React from 'react';
import {
    AutoComplete,
    Button,
    Collapse,
    DatePicker,
    Drawer,
    Form,
    Input,
    Select,
    Space,
    Tabs,
} from 'antd';
import {
    CodeOutlined,
    DeleteOutlined,
    FolderOpenOutlined,
    FolderOutlined,
    GithubOutlined,
    SearchOutlined,
    SyncOutlined,
} from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import { RepoConfig } from '../types';
import { getRepoName, getThisWeekRange } from '../utils/helpers';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface ConfigDrawerProps {
    visible: boolean;
    onClose: () => void;
    activeTab: string;
    onActiveTabChange: (tab: string) => void;
    // Local repo props
    repoConfigs: RepoConfig[];
    inputRepoPath: string;
    repoPathHistory: string[];
    pullingRepos: Set<string>;
    allAuthors: string[];
    selectedAuthors: string[];
    loading: boolean;
    onInputRepoPathChange: (path: string) => void;
    onAddRepoFromInput: () => void;
    onOpenFolderBrowser: () => void;
    onRemoveRepo: (path: string) => void;
    onUpdateRepoSelectedBranches: (path: string, branches: string[]) => void;
    onGitPull: (path: string) => void;
    onGitPullAll: () => void;
    onSelectedAuthorsChange: (authors: string[]) => void;
    onLocalRepoSubmit: (values: { dateRange: [Dayjs, Dayjs] }) => void;
    // Git log props
    onGitLogPaste: (values: { gitLog: string }) => void;
    // API props
    onApiSubmit: (values: {
        repoUrl: string;
        author: string;
        dateRange: [Dayjs, Dayjs];
        token?: string;
    }) => void;
}

const ConfigDrawer: React.FC<ConfigDrawerProps> = ({
    visible,
    onClose,
    activeTab,
    onActiveTabChange,
    repoConfigs,
    inputRepoPath,
    repoPathHistory,
    pullingRepos,
    allAuthors,
    selectedAuthors,
    loading,
    onInputRepoPathChange,
    onAddRepoFromInput,
    onOpenFolderBrowser,
    onRemoveRepo,
    onUpdateRepoSelectedBranches,
    onGitPull,
    onGitPullAll,
    onSelectedAuthorsChange,
    onLocalRepoSubmit,
    onGitLogPaste,
    onApiSubmit,
}) => {
    const [localRepoForm] = Form.useForm();
    const [gitLogForm] = Form.useForm();
    const [apiForm] = Form.useForm();

    return (
        <Drawer
            title="获取 Git 提交记录"
            placement="right"
            width={600}
            open={visible}
            onClose={onClose}
        >
            <Tabs
                activeKey={activeTab}
                onChange={onActiveTabChange}
                items={[
                    {
                        key: 'localRepo',
                        label: (
                            <span>
                                <FolderOpenOutlined />
                                本地仓库
                            </span>
                        ),
                        children: (
                            <>
                                <Collapse
                                    size="small"
                                    items={[{
                                        key: '1',
                                        label: <span style={{ color: '#1677ff' }}>使用说明 - 点击展开</span>,
                                        children: (
                                            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                                                <p style={{ margin: '4px 0' }}>1. 输入本地Git仓库的绝对路径，或点击"浏览"选择</p>
                                                <p style={{ margin: '4px 0' }}>2. 选择分支、时间范围，可选填写作者名</p>
                                                <p style={{ margin: '4px 0' }}>3. 点击"获取提交记录"即可自动调用本地git命令</p>
                                                <p style={{ margin: '4px 0', color: '#ff4d4f' }}>
                                                    注意：请确保已运行 <code>npm run start</code> 启动后端服务
                                                </p>
                                            </div>
                                        ),
                                    }]}
                                    style={{ marginBottom: 16, background: '#f6f8fa' }}
                                />
                                <Form
                                    form={localRepoForm}
                                    layout="vertical"
                                    onFinish={(values) => {
                                        onLocalRepoSubmit(values);
                                        onClose();
                                    }}
                                    initialValues={{
                                        dateRange: getThisWeekRange(),
                                    }}
                                >
                                    <Form.Item label="本地仓库路径（支持多选）">
                                        <Space.Compact style={{ width: '100%' }}>
                                            <AutoComplete
                                                style={{ flex: 1 }}
                                                value={inputRepoPath}
                                                onChange={onInputRepoPathChange}
                                                options={repoPathHistory
                                                    .filter(p => !repoConfigs.some(r => r.path === p))
                                                    .map(path => ({ value: path, label: path }))}
                                                placeholder="输入仓库路径"
                                                onSelect={onInputRepoPathChange}
                                                filterOption={(inputValue, option) =>
                                                    option?.value.toLowerCase().includes(inputValue.toLowerCase()) ?? false
                                                }
                                            />
                                            <Button onClick={onAddRepoFromInput} disabled={!inputRepoPath.trim()}>
                                                添加
                                            </Button>
                                            <Button icon={<FolderOutlined />} onClick={onOpenFolderBrowser}>
                                                浏览
                                            </Button>
                                        </Space.Compact>
                                    </Form.Item>

                                    {repoConfigs.length > 0 && (
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{
                                                marginBottom: 8,
                                                fontWeight: 500,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span>已选仓库 ({repoConfigs.length}):</span>
                                                <Button
                                                    size="small"
                                                    icon={<SyncOutlined spin={pullingRepos.size > 0} />}
                                                    onClick={onGitPullAll}
                                                    disabled={pullingRepos.size > 0}
                                                >
                                                    全部更新
                                                </Button>
                                            </div>
                                            {repoConfigs.map((repo) => (
                                                <div key={repo.path} style={{
                                                    padding: '8px 12px',
                                                    marginBottom: 6,
                                                    background: '#fafafa',
                                                    borderRadius: 6,
                                                    border: '1px solid #f0f0f0'
                                                }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        marginBottom: 6
                                                    }}>
                                                        <Space size="small">
                                                            <FolderOutlined style={{ color: '#52c41a' }} />
                                                            <span style={{ fontWeight: 500 }}>{getRepoName(repo.path)}</span>
                                                        </Space>
                                                        <Space size={4}>
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                icon={<SyncOutlined spin={pullingRepos.has(repo.path)} />}
                                                                onClick={() => onGitPull(repo.path)}
                                                                disabled={pullingRepos.has(repo.path)}
                                                            />
                                                            <Button
                                                                type="text"
                                                                danger
                                                                size="small"
                                                                icon={<DeleteOutlined />}
                                                                onClick={() => onRemoveRepo(repo.path)}
                                                            />
                                                        </Space>
                                                    </div>
                                                    <Select
                                                        mode="multiple"
                                                        size="small"
                                                        style={{ width: '100%' }}
                                                        placeholder="选择分支"
                                                        loading={repo.loadingBranches}
                                                        value={repo.selectedBranches}
                                                        onChange={(values) => onUpdateRepoSelectedBranches(repo.path, values)}
                                                        maxTagCount="responsive"
                                                    >
                                                        <Select.Option value="__all__">🌐 所有分支</Select.Option>
                                                        {repo.branches.map((branch) => (
                                                            <Select.Option key={branch} value={branch}>
                                                                {branch === repo.currentBranch ? `✓ ${branch} (当前)` : branch}
                                                            </Select.Option>
                                                        ))}
                                                    </Select>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <Form.Item label="作者（可选）" style={{ flex: 1, minWidth: 200, marginBottom: 16 }}>
                                            <Select
                                                mode="multiple"
                                                placeholder="选择作者，留空获取所有"
                                                value={selectedAuthors}
                                                onChange={onSelectedAuthorsChange}
                                                allowClear
                                                maxTagCount="responsive"
                                                disabled={allAuthors.length === 0}
                                            >
                                                {allAuthors.map((author) => (
                                                    <Select.Option key={author} value={author}>{author}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                        <Form.Item
                                            name="dateRange"
                                            label="时间范围"
                                            rules={[{ required: true, message: '请选择时间范围' }]}
                                            style={{ flex: 1, minWidth: 280, marginBottom: 16 }}
                                        >
                                            <RangePicker
                                                showTime
                                                format="YYYY-MM-DD HH:mm:ss"
                                                style={{ width: '100%' }}
                                                presets={[
                                                    { label: '本周', value: getThisWeekRange() },
                                                    {
                                                        label: '上周',
                                                        value: [dayjs().startOf('week').subtract(6, 'day'), dayjs().startOf('week')]
                                                    },
                                                    {
                                                        label: '本月',
                                                        value: [dayjs().startOf('month'), dayjs().endOf('month')]
                                                    },
                                                ]}
                                            />
                                        </Form.Item>
                                    </div>

                                    <Form.Item>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={loading}
                                            icon={<SearchOutlined />}
                                            block
                                            disabled={repoConfigs.length === 0}
                                        >
                                            获取提交记录 {repoConfigs.length > 0 && `(${repoConfigs.length}个仓库)`}
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </>
                        ),
                    },
                    {
                        key: 'local',
                        label: (
                            <span>
                                <CodeOutlined />
                                粘贴日志
                            </span>
                        ),
                        children: (
                            <>
                                <Collapse
                                    size="small"
                                    items={[{
                                        key: '1',
                                        label: <span style={{ color: '#1677ff' }}>使用说明 - 点击展开</span>,
                                        children: (
                                            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                                                <p style={{ margin: '4px 0' }}>1. 在本地仓库目录运行以下命令获取提交记录：</p>
                                                <pre style={{
                                                    background: '#f5f5f5',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    fontSize: 12,
                                                    margin: '4px 0'
                                                }}>
{`git log --pretty=format:"%h|%s|%an|%ai" --since="2025-12-22" --until="2025-12-28"`}
                                                </pre>
                                                <p style={{ margin: '4px 0' }}>2. 复制命令输出结果，粘贴到下方文本框</p>
                                            </div>
                                        ),
                                    }]}
                                    style={{ marginBottom: 16, background: '#f6f8fa' }}
                                />
                                <Form
                                    form={gitLogForm}
                                    layout="vertical"
                                    onFinish={(values) => {
                                        onGitLogPaste(values);
                                        onClose();
                                    }}
                                >
                                    <Form.Item
                                        name="gitLog"
                                        label="粘贴 Git Log 输出"
                                        rules={[{ required: true, message: '请粘贴git log输出内容' }]}
                                    >
                                        <TextArea rows={8} placeholder="粘贴 git log 输出内容，支持格式: sha|message|author|date" />
                                    </Form.Item>
                                    <Form.Item>
                                        <Button type="primary" htmlType="submit" icon={<SearchOutlined />} block>
                                            解析提交记录
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </>
                        ),
                    },
                    {
                        key: 'api',
                        label: (
                            <span>
                                <GithubOutlined />
                                API获取
                            </span>
                        ),
                        children: (
                            <>
                                <Collapse
                                    size="small"
                                    items={[{
                                        key: '1',
                                        label: <span style={{ color: '#1677ff' }}>使用说明 - 点击展开</span>,
                                        children: (
                                            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                                                <p style={{ margin: '4px 0' }}>1. 支持 GitHub、GitLab、Gitee 仓库</p>
                                                <p style={{ margin: '4px 0' }}>2. 阿里云云效(Codeup)：请使用"本地仓库"标签页</p>
                                                <p style={{ margin: '4px 0' }}>3. 公开仓库可不填Token，私有仓库需要填写访问令牌</p>
                                            </div>
                                        ),
                                    }]}
                                    style={{ marginBottom: 16, background: '#f6f8fa' }}
                                />
                                <Form
                                    form={apiForm}
                                    layout="vertical"
                                    onFinish={(values) => {
                                        onApiSubmit(values);
                                        onClose();
                                    }}
                                    initialValues={{ dateRange: getThisWeekRange() }}
                                >
                                    <Form.Item
                                        name="repoUrl"
                                        label="仓库地址"
                                        rules={[{ required: true, message: '请输入仓库地址' }]}
                                    >
                                        <Input placeholder="https://github.com/owner/repo" prefix={<GithubOutlined />} />
                                    </Form.Item>
                                    <Form.Item name="author" label="作者（可选）">
                                        <Input placeholder="用户名或邮箱，留空获取所有提交" />
                                    </Form.Item>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <Form.Item
                                            name="dateRange"
                                            label="时间范围"
                                            rules={[{ required: true, message: '请选择时间范围' }]}
                                            style={{ flex: 1, minWidth: 280, marginBottom: 16 }}
                                        >
                                            <RangePicker
                                                showTime
                                                format="YYYY-MM-DD HH:mm:ss"
                                                style={{ width: '100%' }}
                                                presets={[
                                                    { label: '本周', value: getThisWeekRange() },
                                                    {
                                                        label: '上周',
                                                        value: [dayjs().startOf('week').subtract(6, 'day'), dayjs().startOf('week')]
                                                    },
                                                ]}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="token"
                                            label="访问令牌（可选）"
                                            style={{ flex: 1, minWidth: 150, marginBottom: 16 }}
                                        >
                                            <Input.Password placeholder="私有仓库需要填写" />
                                        </Form.Item>
                                    </div>
                                    <Form.Item>
                                        <Button type="primary" htmlType="submit" loading={loading} icon={<SearchOutlined />} block>
                                            获取提交记录
                                        </Button>
                                    </Form.Item>
                                </Form>
                            </>
                        ),
                    },
                ]}
            />
        </Drawer>
    );
};

export default ConfigDrawer;
