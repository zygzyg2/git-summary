import {useState} from 'react';
import {
    Layout,
    Card,
    Form,
    Input,
    Button,
    DatePicker,
    Table,
    Space,
    Typography,
    message,
    Tooltip,
    Alert,
    Tabs,
    Select,
    Modal,
    AutoComplete,
} from 'antd';
import {
    GithubOutlined,
    SearchOutlined,
    CopyOutlined,
    FileTextOutlined,
    CodeOutlined,
    FolderOpenOutlined,
    RobotOutlined,
    SettingOutlined,
    FolderOutlined,
    ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs, {Dayjs} from 'dayjs';
import {
    fetchCommits,
    generateWeeklyReport,
    GitCommit,
    parseGitLog,
    fetchLocalGitCommits,
    fetchBranches,
    optimizeReportWithAIStream,
} from './services/gitService';

const {Header, Content, Footer} = Layout;
const {Title, Paragraph} = Typography;
const {RangePicker} = DatePicker;
const {TextArea} = Input;

function App() {
    const [form] = Form.useForm();
    const [gitLogForm] = Form.useForm();
    const [localRepoForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [commits, setCommits] = useState<GitCommit[]>([]);
    const [weeklyReport, setWeeklyReport] = useState('');
    const [activeTab, setActiveTab] = useState('localRepo');
    const [branches, setBranches] = useState<string[]>([]);
    const [currentBranch, setCurrentBranch] = useState<string>('');
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [optimizing, setOptimizing] = useState(false);
    const [aiSettingsVisible, setAiSettingsVisible] = useState(false);
    const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem('ai_api_key') || '');
    const [aiModel, setAiModel] = useState(() => localStorage.getItem('ai_model') || 'qwen-plus');
    const [aiPromptTemplate, setAiPromptTemplate] = useState(() => localStorage.getItem('ai_prompt_template') || '');
    const [repoPathHistory, setRepoPathHistory] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('repo_path_history') || '[]');
        } catch {
            return [];
        }
    });
    const [folderBrowserVisible, setFolderBrowserVisible] = useState(false);
    const [browsingPath, setBrowsingPath] = useState('');
    const [directories, setDirectories] = useState<{ name: string; path: string; isGitRepo: boolean }[]>([]);
    const [loadingDirs, setLoadingDirs] = useState(false);
    const [selectedRepoPath, setSelectedRepoPath] = useState('');

    // 保存仓库路径到历史记录
    const saveRepoPathToHistory = (path: string) => {
        if (!path || path.trim() === '') return;
        const trimmedPath = path.trim();
        const newHistory = [trimmedPath, ...repoPathHistory.filter(p => p !== trimmedPath)].slice(0, 10);
        setRepoPathHistory(newHistory);
        localStorage.setItem('repo_path_history', JSON.stringify(newHistory));
    };

    // 打开文件夹浏览器
    const openFolderBrowser = async () => {
        setFolderBrowserVisible(true);
        setLoadingDirs(true);
        try {
            const res = await fetch('http://localhost:3001/api/home-dir');
            const data = await res.json();
            await browsePath(data.path);
        } catch (error) {
            message.error('无法连接后端服务');
        }
    };

    // 浏览指定路径
    const browsePath = async (dirPath: string) => {
        setLoadingDirs(true);
        try {
            const res = await fetch('http://localhost:3001/api/browse-dir', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({dirPath}),
            });
            const data = await res.json();
            if (data.success) {
                setBrowsingPath(data.currentPath);
                setDirectories(data.directories);
            } else {
                message.error(data.error || '读取目录失败');
            }
        } catch (error) {
            message.error('读取目录失败');
        } finally {
            setLoadingDirs(false);
        }
    };

    // 选择文件夹
    const selectFolder = (folderPath: string) => {
        setSelectedRepoPath(folderPath);
        localRepoForm.setFieldsValue({repoPath: folderPath});
        setFolderBrowserVisible(false);
        loadBranches(folderPath);
        saveRepoPathToHistory(folderPath);
    };

    // 返回上级目录
    const goToParent = () => {
        const parentPath = browsingPath.split(/[\/\\]/).slice(0, -1).join('/');
        if (parentPath) {
            browsePath(parentPath || '/');
        }
    };

    // 获取本周的开始和结束日期
    const getThisWeekRange = (): [Dayjs, Dayjs] => {
        const now = dayjs();
        const startOfWeek = now.startOf('week').add(1, 'day'); // 周一开始
        const endOfWeek = now.endOf('week').add(1, 'day'); // 周日结束
        return [startOfWeek, endOfWeek];
    };

    // 加载分支列表
    const loadBranches = async (repoPath: string) => {
        if (!repoPath) {
            setBranches([]);
            setCurrentBranch('');
            return;
        }
        setLoadingBranches(true);
        try {
            const result = await fetchBranches(repoPath);
            setBranches(result.branches);
            setCurrentBranch(result.currentBranch);
            // 自动设置当前分支
            localRepoForm.setFieldValue('branch', result.currentBranch);
        } catch (error) {
            console.error('加载分支失败:', error);
            setBranches([]);
        } finally {
            setLoadingBranches(false);
        }
    };

    // 提交表单
    const onFinish = async (values: {
        repoUrl: string;
        author: string;
        dateRange: [Dayjs, Dayjs];
        token?: string;
    }) => {
        setLoading(true);
        setCommits([]);
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

            setCommits(result);
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
        setCommits([]);
        setWeeklyReport('');

        try {
            const result = parseGitLog(values.gitLog);
            setCommits(result);
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

    // 处理本地仓库路径获取
    const onLocalRepoSubmit = async (values: {
        repoPath: string;
        author: string;
        dateRange: [Dayjs, Dayjs];
        branch?: string;
    }) => {
        setLoading(true);
        setCommits([]);
        setWeeklyReport('');

        try {
            const {repoPath, author, dateRange, branch} = values;
            const [since, until] = dateRange;

            // 保存到历史记录
            saveRepoPathToHistory(repoPath);

            const result = await fetchLocalGitCommits(
                repoPath,
                author,
                since.format('YYYY-MM-DD'),
                until.format('YYYY-MM-DD'),
                branch
            );

            setCommits(result);
            setWeeklyReport(generateWeeklyReport(result));

            if (result.length === 0) {
                message.info('未找到符合条件的提交记录');
            } else {
                message.success(`成功获取 ${result.length} 条提交记录`);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : '获取提交记录失败，请确保后端服务已启动');
        } finally {
            setLoading(false);
        }
    };

    // 使用AI优化周报（流式输出）
    const handleAIOptimize = async () => {
        if (commits.length === 0) {
            message.warning('请先获取提交记录');
            return;
        }

        if (!aiApiKey) {
            setAiSettingsVisible(true);
            message.info('请先配置AI API Key');
            return;
        }

        setOptimizing(true);
        setWeeklyReport(''); // 清空当前内容

        await optimizeReportWithAIStream(
            commits,
            aiApiKey,
            aiModel,
            aiPromptTemplate,
            (content) => {
                // 流式更新内容
                setWeeklyReport((prev) => prev + content);
            },
            () => {
                // 完成
                setOptimizing(false);
                message.success('AI优化周报完成');
            },
            (error) => {
                // 错误
                setOptimizing(false);
                message.error(error);
            }
        );
    };

    // 保存AI设置
    const saveAISettings = () => {
        localStorage.setItem('ai_api_key', aiApiKey);
        localStorage.setItem('ai_model', aiModel);
        localStorage.setItem('ai_prompt_template', aiPromptTemplate);
        setAiSettingsVisible(false);
        message.success('AI设置已保存');
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

    // 表格列定义
    const columns = [
        {
            title: 'SHA',
            dataIndex: 'sha',
            key: 'sha',
            width: 100,
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
            title: '作者',
            dataIndex: 'author',
            key: 'author',
            width: 150,
        },
        {
            title: '提交时间',
            dataIndex: 'date',
            key: 'date',
            width: 180,
        },
    ];

    return (
        <Layout style={{minHeight: '100vh'}}>
            <Header
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#001529',
                    padding: '0 24px',
                }}
            >
                <GithubOutlined style={{fontSize: 28, color: '#fff', marginRight: 12}}/>
                <Title level={4} style={{color: '#fff', margin: 0}}>
                    Git 提交信息汇总工具
                </Title>
            </Header>

            <Content style={{padding: '24px 48px'}}>
                <Card style={{marginBottom: 24}}>
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={[
                            {
                                key: 'localRepo',
                                label: (
                                    <span>
                                        <FolderOpenOutlined/>
                                        本地仓库（推荐）
                                    </span>
                                ),
                                children: (
                                    <>
                                        <Alert
                                            message="直接调用本地Git - 适用于云效Codeup等所有Git仓库"
                                            description={
                                                <div>
                                                    <p>1. 输入本地Git仓库的绝对路径</p>
                                                    <p>2. 选择时间范围，可选填写作者名</p>
                                                    <p>3. 点击“获取提交记录”即可自动调用本地git命令</p>
                                                    <p style={{color: '#ff4d4f'}}>注意：请确保已运行 <code>npm run
                                                        start</code> 启动后端服务</p>
                                                </div>
                                            }
                                            type="info"
                                            showIcon
                                            style={{marginBottom: 16}}
                                        />
                                        <Form
                                            form={localRepoForm}
                                            layout="vertical"
                                            onFinish={onLocalRepoSubmit}
                                            initialValues={{
                                                dateRange: getThisWeekRange(),
                                            }}
                                        >
                                            <Form.Item
                                                label="本地仓库路径"
                                                required
                                            >
                                                <Space.Compact style={{width: '100%'}}>
                                                    <Form.Item
                                                        name="repoPath"
                                                        noStyle
                                                        rules={[{required: true, message: '请输入本地仓库路径'}]}
                                                    >
                                                        <AutoComplete
                                                            style={{flex: 1}}
                                                            value={selectedRepoPath}
                                                            onChange={(value) => setSelectedRepoPath(value)}
                                                            options={repoPathHistory.map(path => ({
                                                                value: path,
                                                                label: path
                                                            }))}
                                                            placeholder="例如: /home/user/projects/my-project"
                                                            onSelect={(value) => {
                                                                setSelectedRepoPath(value);
                                                                loadBranches(value);
                                                            }}
                                                            onBlur={(e) => loadBranches((e.target as HTMLInputElement).value)}
                                                            filterOption={(inputValue, option) =>
                                                                option?.value.toLowerCase().includes(inputValue.toLowerCase()) ?? false
                                                            }
                                                        />
                                                    </Form.Item>
                                                    <Button
                                                        icon={<FolderOutlined/>}
                                                        onClick={openFolderBrowser}
                                                    >
                                                        浏览
                                                    </Button>
                                                </Space.Compact>
                                            </Form.Item>

                                            <Form.Item name="branch" label="分支">
                                                <Select
                                                    placeholder="选择分支（需先输入仓库路径）"
                                                    loading={loadingBranches}
                                                    allowClear
                                                    showSearch
                                                    optionFilterProp="children"
                                                >
                                                    <Select.Option value="__all__">
                                                        🌐 所有分支
                                                    </Select.Option>
                                                    {branches.map((branch) => (
                                                        <Select.Option key={branch} value={branch}>
                                                            {branch === currentBranch ? `✓ ${branch} (当前)` : branch}
                                                        </Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>

                                            <Form.Item name="author" label="作者 (可选)">
                                                <Input placeholder="填写Git用户名或邮箱，留空获取所有提交"/>
                                            </Form.Item>

                                            <Form.Item
                                                name="dateRange"
                                                label="时间范围"
                                                rules={[{required: true, message: '请选择时间范围'}]}
                                            >
                                                <RangePicker
                                                    style={{width: '100%'}}
                                                    presets={[
                                                        {label: '本周', value: getThisWeekRange()},
                                                        {
                                                            label: '上周',
                                                            value: [
                                                                dayjs().startOf('week').subtract(6, 'day'),
                                                                dayjs().startOf('week'),
                                                            ],
                                                        },
                                                        {
                                                            label: '本月',
                                                            value: [dayjs().startOf('month'), dayjs().endOf('month')],
                                                        },
                                                    ]}
                                                />
                                            </Form.Item>

                                            <Form.Item>
                                                <Button
                                                    type="primary"
                                                    htmlType="submit"
                                                    loading={loading}
                                                    icon={<SearchOutlined/>}
                                                    size="large"
                                                >
                                                    获取提交记录
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
                    <CodeOutlined/>
                    本地Git日志（推荐）
                  </span>
                                ),
                                children: (
                                    <>
                                        <Alert
                                            message="使用说明 - 适用于云效Codeup等所有Git仓库"
                                            description={
                                                <div>
                                                    <p>1. 在本地仓库目录运行以下命令获取提交记录：</p>
                                                    <pre style={{
                                                        background: '#f5f5f5',
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        overflow: 'auto'
                                                    }}>
{`# 获取本周提交记录（指定作者）
git log --pretty=format:"%h|%s|%an|%ai" --since="2025-12-22" --until="2025-12-28" --author="你的名字"

# 或者获取所有人的提交
git log --pretty=format:"%h|%s|%an|%ai" --since="2025-12-22" --until="2025-12-28"

# 简化版本
git log --oneline --since="2025-12-22" --until="2025-12-28"`}
                          </pre>
                                                    <p>2. 复制命令输出结果，粘贴到下方文本框</p>
                                                </div>
                                            }
                                            type="info"
                                            showIcon
                                            style={{marginBottom: 16}}
                                        />
                                        <Form form={gitLogForm} layout="vertical" onFinish={onGitLogPaste}>
                                            <Form.Item
                                                name="gitLog"
                                                label="粘贴 Git Log 输出"
                                                rules={[{required: true, message: '请粘贴git log输出内容'}]}
                                            >
                                                <TextArea
                                                    rows={8}
                                                    placeholder={
                                                        `粘贴 git log 输出内容，支持以下格式:

格式1 (推荐): sha|message|author|date
例如: a1b2c3d|修复bug|zhangsan|2025-12-25 10:30:00

格式2: git log --oneline 输出
例如: a1b2c3d 修复bug`
                                                    }
                                                />
                                            </Form.Item>
                                            <Form.Item>
                                                <Button type="primary" htmlType="submit" icon={<SearchOutlined/>}
                                                        size="large">
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
                    <GithubOutlined/>
                    API获取（GitHub/GitLab/Gitee）
                  </span>
                                ),
                                children: (
                                    <>
                                        <Alert
                                            message="使用说明"
                                            description={
                                                <div>
                                                    <p>1. 支持 GitHub、GitLab、Gitee 仓库</p>
                                                    <p>2. <strong>阿里云云效(Codeup)</strong>：请使用“本地Git日志”标签页
                                                    </p>
                                                    <p>3. 公开仓库可以不填写
                                                        Token，私有仓库需要填写对应平台的访问令牌</p>
                                                    <p>4. 作者可以填写用户名或邮箱，留空则获取所有提交</p>
                                                </div>
                                            }
                                            type="info"
                                            showIcon
                                            style={{marginBottom: 16}}
                                        />
                                        <Form
                                            form={form}
                                            layout="vertical"
                                            onFinish={onFinish}
                                            initialValues={{
                                                dateRange: getThisWeekRange(),
                                            }}
                                        >
                                            <Form.Item
                                                name="repoUrl"
                                                label="仓库地址"
                                                rules={[{required: true, message: '请输入仓库地址'}]}
                                            >
                                                <Input
                                                    placeholder="例如: https://github.com/owner/repo 或 git@github.com:owner/repo.git"
                                                    prefix={<GithubOutlined/>}
                                                />
                                            </Form.Item>

                                            <Form.Item name="author" label="作者 (可选)">
                                                <Input placeholder="填写Git用户名或邮箱，留空获取所有提交"/>
                                            </Form.Item>

                                            <Form.Item
                                                name="dateRange"
                                                label="时间范围"
                                                rules={[{required: true, message: '请选择时间范围'}]}
                                            >
                                                <RangePicker
                                                    style={{width: '100%'}}
                                                    presets={[
                                                        {label: '本周', value: getThisWeekRange()},
                                                        {
                                                            label: '上周',
                                                            value: [
                                                                dayjs().startOf('week').subtract(6, 'day'),
                                                                dayjs().startOf('week'),
                                                            ],
                                                        },
                                                        {
                                                            label: '本月',
                                                            value: [dayjs().startOf('month'), dayjs().endOf('month')],
                                                        },
                                                    ]}
                                                />
                                            </Form.Item>

                                            <Form.Item name="token" label="访问令牌 (可选)">
                                                <Input.Password placeholder="私有仓库需要填写，公开仓库可不填"/>
                                            </Form.Item>

                                            <Form.Item>
                                                <Button
                                                    type="primary"
                                                    htmlType="submit"
                                                    loading={loading}
                                                    icon={<SearchOutlined/>}
                                                    size="large"
                                                >
                                                    获取提交记录
                                                </Button>
                                            </Form.Item>
                                        </Form>
                                    </>
                                ),
                            },
                        ]}
                    />
                </Card>

                {commits.length > 0 && (
                    <>
                        <Card
                            title={
                                <Space>
                                    <FileTextOutlined/>
                                    <span>周报内容</span>
                                </Space>
                            }
                            extra={
                                <Space>
                                    <Tooltip title="AI设置">
                                        <Button
                                            icon={<SettingOutlined/>}
                                            onClick={() => setAiSettingsVisible(true)}
                                        />
                                    </Tooltip>
                                    <Button
                                        type="primary"
                                        icon={<RobotOutlined/>}
                                        onClick={handleAIOptimize}
                                        loading={optimizing}
                                    >
                                        AI优化周报
                                    </Button>
                                    <Button icon={<CopyOutlined/>} onClick={copyToClipboard}>
                                        复制周报
                                    </Button>
                                </Space>
                            }
                            style={{marginBottom: 24}}
                        >
                            <TextArea
                                value={weeklyReport}
                                onChange={(e) => setWeeklyReport(e.target.value)}
                                autoSize={{minRows: 4, maxRows: 12}}
                                placeholder="周报内容"
                            />
                            <Paragraph type="secondary" style={{marginTop: 8}}>
                                * 你可以直接编辑上方内容后再复制
                            </Paragraph>
                        </Card>

                        <Card title={`提交记录 (共 ${commits.length} 条)`}>
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
                        </Card>
                    </>
                )}
            </Content>

            <Footer style={{textAlign: 'center'}}>
                Git Summary Tool - 帮助Java程序员快速生成周报
            </Footer>

            {/* AI设置弹窗 */}
            <Modal
                title="AI优化设置"
                open={aiSettingsVisible}
                onOk={saveAISettings}
                onCancel={() => setAiSettingsVisible(false)}
                okText="保存"
                cancelText="取消"
            >
                <Form layout="vertical">
                    <Form.Item
                        label="API Key"
                        required
                        extra={
                            <span>
                                请在 <a href="https://bailian.console.aliyun.com/?apiKey=1" target="_blank"
                                        rel="noopener noreferrer">
                                    阿里云百炼平台
                                </a> 获取API Key
                            </span>
                        }
                    >
                        <Input.Password
                            value={aiApiKey}
                            onChange={(e) => setAiApiKey(e.target.value)}
                            placeholder="请输入阿里云百炼API Key (sk-xxx)"
                        />
                    </Form.Item>
                    <Form.Item
                        label="模型选择"
                        extra="建议使用qwen-plus，性价比较高"
                    >
                        <Select
                            value={aiModel}
                            onChange={setAiModel}
                            options={[
                                {value: 'qwen-plus', label: '通义千问Plus (推荐)'},
                                {value: 'qwen-turbo', label: '通义千问Turbo (快速)'},
                                {value: 'qwen-max', label: '通义千问Max (强力)'},
                            ]}
                        />
                    </Form.Item>
                    <Form.Item
                        label="自定义周报模板（可选）"
                        extra="留空则使用默认模板。可用变量：Git提交记录会自动追加到提示词后面"
                    >
                        <Input.TextArea
                            value={aiPromptTemplate}
                            onChange={(e) => setAiPromptTemplate(e.target.value)}
                            placeholder={`示例：你是一个专业的技术周报撰写助手。请根据提供的Git提交记录，生成一份清晰、专业的周报内容。

要求：
1. 对相似的提交进行归类和合并
2. 使用简洁专业的技术语言
3. 按工作类型分类（如：功能开发、Bug修复、代码优化等）
4. 突出重点工作成果
5. 只输出周报内容，不要添加额外的解释`}
                            autoSize={{minRows: 4, maxRows: 10}}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 文件夹浏览器弹窗 */}
            <Modal
                title="选择仓库文件夹"
                open={folderBrowserVisible}
                onCancel={() => setFolderBrowserVisible(false)}
                footer={null}
                width={600}
            >
                <div style={{marginBottom: 12}}>
                    <Space>
                        <Button
                            icon={<ArrowLeftOutlined/>}
                            onClick={goToParent}
                            disabled={browsingPath === '/'}
                        >
                            上级目录
                        </Button>
                        <Input
                            value={browsingPath}
                            onChange={(e) => setBrowsingPath(e.target.value)}
                            onPressEnter={() => browsePath(browsingPath)}
                            style={{width: 350}}
                            addonAfter={
                                <Button type="link" size="small" onClick={() => browsePath(browsingPath)}>
                                    跳转
                                </Button>
                            }
                        />
                    </Space>
                </div>
                <div style={{maxHeight: 400, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 6}}>
                    {loadingDirs ? (
                        <div style={{padding: 24, textAlign: 'center'}}>加载中...</div>
                    ) : directories.length === 0 ? (
                        <div style={{padding: 24, textAlign: 'center', color: '#999'}}>此目录下没有子文件夹</div>
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
                                onDoubleClick={() => browsePath(dir.path)}
                            >
                                <Space>
                                    <FolderOutlined style={{color: dir.isGitRepo ? '#52c41a' : '#1890ff'}}/>
                                    <span>{dir.name}</span>
                                    {dir.isGitRepo && (
                                        <span style={{color: '#52c41a', fontSize: 12}}>(Git仓库)</span>
                                    )}
                                </Space>
                                <Space>
                                    <Button size="small" onClick={() => browsePath(dir.path)}>
                                        打开
                                    </Button>
                                    {dir.isGitRepo && (
                                        <Button type="primary" size="small" onClick={() => selectFolder(dir.path)}>
                                            选择
                                        </Button>
                                    )}
                                </Space>
                            </div>
                        ))
                    )}
                </div>
                <div style={{marginTop: 12, color: '#666', fontSize: 12}}>
                    提示：双击文件夹进入，绿色图标表示Git仓库，点击“选择”确认
                </div>
            </Modal>
        </Layout>
    );
}

export default App;
