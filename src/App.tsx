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
} from 'antd';
import {
    GithubOutlined,
    SearchOutlined,
    CopyOutlined,
    FileTextOutlined,
    CodeOutlined,
    FolderOpenOutlined,
} from '@ant-design/icons';
import dayjs, {Dayjs} from 'dayjs';
import {
    fetchCommits,
    generateWeeklyReport,
    GitCommit,
    parseGitLog,
    fetchLocalGitCommits,
    fetchBranches
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
                                                name="repoPath"
                                                label="本地仓库路径"
                                                rules={[{required: true, message: '请输入本地仓库路径'}]}
                                            >
                                                <Input
                                                    placeholder="例如: /home/user/projects/my-project 或 D:\Projects\my-project"
                                                    prefix={<FolderOpenOutlined/>}
                                                    onBlur={(e) => loadBranches(e.target.value)}
                                                />
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
                                <Button icon={<CopyOutlined/>} onClick={copyToClipboard}>
                                    复制周报
                                </Button>
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
        </Layout>
    );
}

export default App;
