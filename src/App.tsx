import {useMemo, useState} from 'react';
import MarkdownEditor from './components/MarkdownEditor';
import {
    AutoComplete,
    Button,
    Card,
    Collapse,
    DatePicker,
    Drawer,
    Form,
    Input,
    Layout,
    message,
    Modal,
    Select,
    Space,
    Table,
    Tabs,
    Tag,
    Tooltip,
    Typography,
} from 'antd';
import {
    ArrowLeftOutlined,
    CodeOutlined,
    CopyOutlined,
    DeleteOutlined,
    FileTextOutlined,
    FolderOpenOutlined,
    FolderOutlined,
    GithubOutlined,
    PlusOutlined,
    RobotOutlined,
    SearchOutlined,
    SettingOutlined,
    SyncOutlined,
    UnorderedListOutlined,
} from '@ant-design/icons';
import dayjs, {Dayjs} from 'dayjs';
import {
    fetchAuthors,
    fetchBranches,
    fetchCommits,
    fetchLocalGitCommits,
    generateWeeklyReport,
    GitCommit,
    gitPull,
    optimizeReportWithAIStream,
    parseGitLog,
} from './services/gitService';
import {DEFAULT_PROMPT_TEMPLATE} from './constants';

const {Header, Content, Footer} = Layout;
const {Title} = Typography;
const {RangePicker} = DatePicker;
const {TextArea} = Input;

// 定义仓库配置类型
interface RepoConfig {
    path: string;
    branches: string[];
    selectedBranches: string[];
    currentBranch: string;
    loadingBranches: boolean;
    authors: string[];
}

// 定义提交记录按仓库分组
interface RepoCommits {
    [repoPath: string]: GitCommit[];
}

function App() {
    const [form] = Form.useForm();
    const [gitLogForm] = Form.useForm();
    const [localRepoForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [repoCommits, setRepoCommits] = useState<RepoCommits>({});
    const [weeklyReport, setWeeklyReport] = useState('');
    const [activeTab, setActiveTab] = useState('localRepo');
    const [activeCommitTab, setActiveCommitTab] = useState<string>('');
    const [activeResultTab, setActiveResultTab] = useState('report');
    const [optimizing, setOptimizing] = useState(false);
    const [aiSettingsVisible, setAiSettingsVisible] = useState(false);
    const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem('ai_api_key') || '');
    const [aiModel, setAiModel] = useState(() => localStorage.getItem('ai_model') || 'qwen-plus');
    const [aiPromptTemplate, setAiPromptTemplate] = useState(() => localStorage.getItem('ai_prompt_template') || DEFAULT_PROMPT_TEMPLATE);
    const [repoPathHistory, setRepoPathHistory] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('repo_path_history') || '[]');
        } catch {
            return [];
        }
    });
    const [folderBrowserVisible, setFolderBrowserVisible] = useState(false);
    const [configDrawerVisible, setConfigDrawerVisible] = useState(false);
    const [browsingPath, setBrowsingPath] = useState('');
    const [directories, setDirectories] = useState<{ name: string; path: string; isGitRepo: boolean }[]>([]);
    const [loadingDirs, setLoadingDirs] = useState(false);

    // 多仓库配置
    const [repoConfigs, setRepoConfigs] = useState<RepoConfig[]>([]);
    const [inputRepoPath, setInputRepoPath] = useState('');
    const [pullingRepos, setPullingRepos] = useState<Set<string>>(new Set());
    const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);

    // 计算所有仓库的作者合集
    const allAuthors = useMemo(() => {
        const authorsSet = new Set<string>();
        repoConfigs.forEach(r => r.authors.forEach(a => authorsSet.add(a)));
        return [...authorsSet].sort();
    }, [repoConfigs]);

    // 计算所有提交记录（用于AI优化）
    const allCommits = useMemo(() => {
        return Object.values(repoCommits).flat();
    }, [repoCommits]);

    // 计算总提交数
    const totalCommits = useMemo(() => {
        return Object.values(repoCommits).reduce((sum, commits) => sum + commits.length, 0);
    }, [repoCommits]);

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

    // 选择文件夹（添加到多仓库列表）
    const selectFolder = async (folderPath: string) => {
        // 检查是否已添加
        if (repoConfigs.some(r => r.path === folderPath)) {
            message.warning('该仓库已添加');
            return;
        }

        // 添加新仓库
        const newConfig: RepoConfig = {
            path: folderPath,
            branches: [],
            selectedBranches: [],
            currentBranch: '',
            loadingBranches: true,
            authors: [],
        };
        setRepoConfigs(prev => [...prev, newConfig]);
        setFolderBrowserVisible(false);
        saveRepoPathToHistory(folderPath);

        // 加载分支
        await loadBranchesForRepo(folderPath);
    };

    // 从输入框添加仓库
    const addRepoFromInput = async () => {
        if (!inputRepoPath.trim()) {
            message.warning('请输入仓库路径');
            return;
        }

        const path = inputRepoPath.trim();
        if (repoConfigs.some(r => r.path === path)) {
            message.warning('该仓库已添加');
            return;
        }

        // 添加新仓库
        const newConfig: RepoConfig = {
            path,
            branches: [],
            selectedBranches: [],
            currentBranch: '',
            loadingBranches: true,
            authors: [],
        };
        setRepoConfigs(prev => [...prev, newConfig]);
        setInputRepoPath('');
        saveRepoPathToHistory(path);

        // 加载分支
        await loadBranchesForRepo(path);
    };

    // 移除仓库
    const removeRepo = (repoPath: string) => {
        setRepoConfigs(prev => prev.filter(r => r.path !== repoPath));
        // 同时清除该仓库的提交记录
        setRepoCommits(prev => {
            const newCommits = {...prev};
            delete newCommits[repoPath];
            return newCommits;
        });
    };

    // 为指定仓库加载分支和作者
    const loadBranchesForRepo = async (repoPath: string) => {
        try {
            // 并行加载分支和作者
            const [branchResult, authors] = await Promise.all([
                fetchBranches(repoPath),
                fetchAuthors(repoPath).catch(() => [] as string[]),
            ]);

            setRepoConfigs(prev => prev.map(r => {
                if (r.path === repoPath) {
                    return {
                        ...r,
                        branches: branchResult.branches,
                        currentBranch: branchResult.currentBranch,
                        selectedBranches: [branchResult.currentBranch], // 默认选择当前分支
                        loadingBranches: false,
                        authors,
                    };
                }
                return r;
            }));
        } catch (error) {
            console.error('加载分支失败:', error);
            setRepoConfigs(prev => prev.map(r => {
                if (r.path === repoPath) {
                    return {...r, loadingBranches: false};
                }
                return r;
            }));
            message.error(`加载分支失败: ${repoPath}`);
        }
    };

    // 更新仓库的选中分支
    const updateRepoSelectedBranches = (repoPath: string, branches: string[]) => {
        setRepoConfigs(prev => prev.map(r => {
            if (r.path === repoPath) {
                return {...r, selectedBranches: branches};
            }
            return r;
        }));
    };

    // 获取仓库名称（从路径中提取）
    const getRepoName = (repoPath: string) => {
        const parts = repoPath.split(/[/\\]/);
        return parts[parts.length - 1] || repoPath;
    };

    // 更新仓库（git pull）
    const handleGitPull = async (repoPath: string) => {
        setPullingRepos(prev => new Set(prev).add(repoPath));
        try {
            const result = await gitPull(repoPath);
            message.success(`${getRepoName(repoPath)} 更新成功: ${result.message.split('\n')[0]}`);
            // 更新后重新加载分支
            await loadBranchesForRepo(repoPath);
        } catch (error) {
            message.error(`${getRepoName(repoPath)} 更新失败: ${error instanceof Error ? error.message : 'git pull 失败'}`);
        } finally {
            setPullingRepos(prev => {
                const next = new Set(prev);
                next.delete(repoPath);
                return next;
            });
        }
    };

    // 更新所有仓库
    const handleGitPullAll = async () => {
        if (repoConfigs.length === 0) {
            message.warning('请先添加仓库');
            return;
        }
        for (const repo of repoConfigs) {
            await handleGitPull(repo.path);
        }
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


    // 提交表单（API获取）
    const onFinish = async (values: {
        repoUrl: string;
        author: string;
        dateRange: [Dayjs, Dayjs];
        token?: string;
    }) => {
        setLoading(true);
        setRepoCommits({});
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

            // 使用repoUrl作为key
            setRepoCommits({[repoUrl]: result});
            setActiveCommitTab(repoUrl);
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
        setRepoCommits({});
        setWeeklyReport('');

        try {
            const result = parseGitLog(values.gitLog);
            // 使用“粘贴内容”作为key
            setRepoCommits({'Git日志': result});
            setActiveCommitTab('Git日志');
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

    // 处理本地仓库路径获取（多仓库多分支）
    const onLocalRepoSubmit = async (values: {
        dateRange: [Dayjs, Dayjs];
    }) => {
        if (repoConfigs.length === 0) {
            message.warning('请先添加至少一个仓库');
            return;
        }

        setLoading(true);
        setRepoCommits({});
        setWeeklyReport('');

        try {
            const {dateRange} = values;
            const [since, until] = dateRange;

            const newRepoCommits: RepoCommits = {};
            let totalCount = 0;
            let firstRepo = '';

            // 作者列表（如果没有选择，则传空字符串获取所有）
            const authorsToQuery = selectedAuthors.length > 0 ? selectedAuthors : [''];

            // 遍历所有仓库
            for (const repo of repoConfigs) {
                const repoCommitsArray: GitCommit[] = [];

                // 遍历所有选中的分支
                const branchesToFetch = repo.selectedBranches.length > 0
                    ? repo.selectedBranches
                    : ['__all__'];

                for (const branch of branchesToFetch) {
                    for (const author of authorsToQuery) {
                        try {
                            const result = await fetchLocalGitCommits(
                                repo.path,
                                author,
                                since.format('YYYY-MM-DD'),
                                until.format('YYYY-MM-DD'),
                                branch
                            );

                            // 去重（通过sha）
                            for (const commit of result) {
                                if (!repoCommitsArray.some(c => c.sha === commit.sha)) {
                                    repoCommitsArray.push(commit);
                                }
                            }
                        } catch (error) {
                            console.error(`获取仓库 ${repo.path} 分支 ${branch} 失败:`, error);
                            message.warning(`仓库 ${repo.path} 分支 ${branch} 获取失败`);
                        }
                    }
                }

                // 按日期排序
                repoCommitsArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                // 始终添加仓库到结果中（即使没有提交记录）
                newRepoCommits[repo.path] = repoCommitsArray;
                totalCount += repoCommitsArray.length;
                if (!firstRepo) firstRepo = repo.path;
            }

            setRepoCommits(newRepoCommits);
            setActiveCommitTab(firstRepo);

            // 生成汇总周报（按仓库分组）
            const allCommitsFlat = Object.values(newRepoCommits).flat();
            setWeeklyReport(generateWeeklyReport(allCommitsFlat, newRepoCommits));

            if (totalCount === 0) {
                message.info('未找到符合条件的提交记录');
            } else {
                message.success(`成功获取 ${totalCount} 条提交记录（${Object.keys(newRepoCommits).length} 个仓库）`);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : '获取提交记录失败，请确保后端服务已启动');
        } finally {
            setLoading(false);
        }
    };

    // 使用AI优化周报（流式输出）
    const handleAIOptimize = async () => {
        if (allCommits.length === 0) {
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
            allCommits,
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

    return (
        <Layout style={{minHeight: '100vh'}}>
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
                    <GithubOutlined style={{fontSize: 24, color: '#fff'}}/>
                    <Title level={4} style={{color: '#fff', margin: 0, fontWeight: 600}}>
                        Git 周报助手
                    </Title>
                </Space>
                <Space>
                    <Button
                        icon={<PlusOutlined/>}
                        onClick={() => setConfigDrawerVisible(true)}
                    >
                        获取提交记录
                    </Button>
                    <Tooltip title="AI设置">
                        <Button
                            icon={<SettingOutlined/>}
                            onClick={() => setAiSettingsVisible(true)}
                        />
                    </Tooltip>
                </Space>
            </Header>

            <Content style={{padding: '16px 24px', maxWidth: 1400, margin: '0 auto', width: '100%'}}>
                <Tabs
                    activeKey={activeResultTab}
                    onChange={setActiveResultTab}
                    items={[
                        {
                            key: 'report',
                            label: (
                                <Space>
                                    <FileTextOutlined/>
                                    <span>周报内容</span>
                                </Space>
                            ),
                            children: (
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
                                                icon={<RobotOutlined/>}
                                                onClick={handleAIOptimize}
                                                loading={optimizing}
                                                disabled={totalCommits === 0}
                                            >
                                                AI优化周报
                                            </Button>
                                            <Button icon={<CopyOutlined/>} onClick={copyToClipboard}>
                                                复制周报
                                            </Button>
                                        </Space>
                                    </div>
                                    <MarkdownEditor
                                        value={weeklyReport}
                                        onChange={(val) => setWeeklyReport(val)}
                                        streaming={optimizing}
                                    />
                                </Card>
                            ),
                        },
                        {
                            key: 'commits',
                            label: (
                                <Space>
                                    <UnorderedListOutlined/>
                                    <span>提交记录</span>
                                    {totalCommits > 0 && <Tag color="blue">{totalCommits}</Tag>}
                                </Space>
                            ),
                            children: totalCommits > 0 ? (
                                <Card>
                                    <Tabs
                                        activeKey={activeCommitTab}
                                        onChange={setActiveCommitTab}
                                        items={Object.entries(repoCommits).map(([repoPath, commits]) => ({
                                            key: repoPath,
                                            label: (
                                                <Space>
                                                    <FolderOutlined style={{color: '#52c41a'}}/>
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
                            ) : (
                                <Card>
                                    <div style={{textAlign: 'center', padding: 40, color: '#999'}}>
                                        <p>暂无提交记录</p>
                                        <Button type="primary" onClick={() => setConfigDrawerVisible(true)}>
                                            获取提交记录
                                        </Button>
                                    </div>
                                </Card>
                            ),
                        },
                    ]}
                />
            </Content>

            <Footer
                style={{textAlign: 'center', padding: '12px 50px', background: '#f5f5f5', fontSize: 13, color: '#666'}}>
                Git 周报助手 - 智能生成工作周报
            </Footer>

            {/* 配置抽屉 */}
            <Drawer
                title="获取 Git 提交记录"
                placement="right"
                width={600}
                open={configDrawerVisible}
                onClose={() => setConfigDrawerVisible(false)}
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'localRepo',
                            label: (
                                <span>
                                    <FolderOpenOutlined/>
                                    本地仓库
                                </span>
                            ),
                            children: (
                                <>
                                    <Collapse
                                        size="small"
                                        items={[{
                                            key: '1',
                                            label: <span style={{color: '#1677ff'}}>使用说明 - 点击展开</span>,
                                            children: (
                                                <div style={{fontSize: 13, lineHeight: 1.8}}>
                                                    <p style={{margin: '4px 0'}}>1.
                                                        输入本地Git仓库的绝对路径，或点击"浏览"选择</p>
                                                    <p style={{margin: '4px 0'}}>2. 选择分支、时间范围，可选填写作者名</p>
                                                    <p style={{margin: '4px 0'}}>3.
                                                        点击"获取提交记录"即可自动调用本地git命令</p>
                                                    <p style={{
                                                        margin: '4px 0',
                                                        color: '#ff4d4f'
                                                    }}>注意：请确保已运行 <code>npm run start</code> 启动后端服务</p>
                                                </div>
                                            ),
                                        }]}
                                        style={{marginBottom: 16, background: '#f6f8fa'}}
                                    />
                                    <Form
                                        form={localRepoForm}
                                        layout="vertical"
                                        onFinish={(values) => {
                                            onLocalRepoSubmit(values);
                                            setConfigDrawerVisible(false);
                                        }}
                                        initialValues={{
                                            dateRange: getThisWeekRange(),
                                        }}
                                    >
                                        <Form.Item label="本地仓库路径（支持多选）">
                                            <Space.Compact style={{width: '100%'}}>
                                                <AutoComplete
                                                    style={{flex: 1}}
                                                    value={inputRepoPath}
                                                    onChange={(value) => setInputRepoPath(value)}
                                                    options={repoPathHistory
                                                        .filter(p => !repoConfigs.some(r => r.path === p))
                                                        .map(path => ({
                                                            value: path,
                                                            label: path
                                                        }))}
                                                    placeholder="输入仓库路径"
                                                    onSelect={(value) => setInputRepoPath(value)}
                                                    filterOption={(inputValue, option) =>
                                                        option?.value.toLowerCase().includes(inputValue.toLowerCase()) ?? false
                                                    }
                                                />
                                                <Button onClick={addRepoFromInput}
                                                        disabled={!inputRepoPath.trim()}>添加</Button>
                                                <Button icon={<FolderOutlined/>}
                                                        onClick={openFolderBrowser}>浏览</Button>
                                            </Space.Compact>
                                        </Form.Item>

                                        {/* 已选仓库列表 */}
                                        {repoConfigs.length > 0 && (
                                            <div style={{marginBottom: 16}}>
                                                <div style={{
                                                    marginBottom: 8,
                                                    fontWeight: 500,
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <span>已选仓库 ({repoConfigs.length}):</span>
                                                    <Button size="small"
                                                            icon={<SyncOutlined spin={pullingRepos.size > 0}/>}
                                                            onClick={handleGitPullAll} disabled={pullingRepos.size > 0}>
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
                                                                <FolderOutlined style={{color: '#52c41a'}}/>
                                                                <span
                                                                    style={{fontWeight: 500}}>{getRepoName(repo.path)}</span>
                                                            </Space>
                                                            <Space size={4}>
                                                                <Button type="text" size="small" icon={<SyncOutlined
                                                                    spin={pullingRepos.has(repo.path)}/>}
                                                                        onClick={() => handleGitPull(repo.path)}
                                                                        disabled={pullingRepos.has(repo.path)}/>
                                                                <Button type="text" danger size="small"
                                                                        icon={<DeleteOutlined/>}
                                                                        onClick={() => removeRepo(repo.path)}/>
                                                            </Space>
                                                        </div>
                                                        <Select
                                                            mode="multiple"
                                                            size="small"
                                                            style={{width: '100%'}}
                                                            placeholder="选择分支"
                                                            loading={repo.loadingBranches}
                                                            value={repo.selectedBranches}
                                                            onChange={(values) => updateRepoSelectedBranches(repo.path, values)}
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

                                        <div style={{display: 'flex', gap: 16, flexWrap: 'wrap'}}>
                                            <Form.Item label="作者（可选）"
                                                       style={{flex: 1, minWidth: 200, marginBottom: 16}}>
                                                <Select
                                                    mode="multiple"
                                                    placeholder="选择作者，留空获取所有"
                                                    value={selectedAuthors}
                                                    onChange={setSelectedAuthors}
                                                    allowClear
                                                    maxTagCount="responsive"
                                                    disabled={allAuthors.length === 0}
                                                >
                                                    {allAuthors.map((author) => (
                                                        <Select.Option key={author}
                                                                       value={author}>{author}</Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item name="dateRange" label="时间范围"
                                                       rules={[{required: true, message: '请选择时间范围'}]}
                                                       style={{flex: 1, minWidth: 280, marginBottom: 16}}>
                                                <RangePicker
                                                    showTime
                                                    format="YYYY-MM-DD HH:mm:ss"
                                                    style={{width: '100%'}}
                                                    presets={[
                                                        {label: '本周', value: getThisWeekRange()},
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
                                            <Button type="primary" htmlType="submit" loading={loading}
                                                    icon={<SearchOutlined/>} block disabled={repoConfigs.length === 0}>
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
                                    <CodeOutlined/>
                                    粘贴日志
                                </span>
                            ),
                            children: (
                                <>
                                    <Collapse
                                        size="small"
                                        items={[{
                                            key: '1',
                                            label: <span style={{color: '#1677ff'}}>使用说明 - 点击展开</span>,
                                            children: (
                                                <div style={{fontSize: 13, lineHeight: 1.8}}>
                                                    <p style={{margin: '4px 0'}}>1.
                                                        在本地仓库目录运行以下命令获取提交记录：</p>
                                                    <pre style={{
                                                        background: '#f5f5f5',
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        fontSize: 12,
                                                        margin: '4px 0'
                                                    }}>
{`git log --pretty=format:"%h|%s|%an|%ai" --since="2025-12-22" --until="2025-12-28"`}
                                                    </pre>
                                                    <p style={{margin: '4px 0'}}>2.
                                                        复制命令输出结果，粘贴到下方文本框</p>
                                                </div>
                                            ),
                                        }]}
                                        style={{marginBottom: 16, background: '#f6f8fa'}}
                                    />
                                    <Form form={gitLogForm} layout="vertical" onFinish={(values) => {
                                        onGitLogPaste(values);
                                        setConfigDrawerVisible(false);
                                    }}>
                                        <Form.Item name="gitLog" label="粘贴 Git Log 输出"
                                                   rules={[{required: true, message: '请粘贴git log输出内容'}]}>
                                            <TextArea rows={8}
                                                      placeholder="粘贴 git log 输出内容，支持格式: sha|message|author|date"/>
                                        </Form.Item>
                                        <Form.Item>
                                            <Button type="primary" htmlType="submit" icon={<SearchOutlined/>}
                                                    block>解析提交记录</Button>
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
                                    API获取
                                </span>
                            ),
                            children: (
                                <>
                                    <Collapse
                                        size="small"
                                        items={[{
                                            key: '1',
                                            label: <span style={{color: '#1677ff'}}>使用说明 - 点击展开</span>,
                                            children: (
                                                <div style={{fontSize: 13, lineHeight: 1.8}}>
                                                    <p style={{margin: '4px 0'}}>1. 支持 GitHub、GitLab、Gitee 仓库</p>
                                                    <p style={{margin: '4px 0'}}>2.
                                                        阿里云云效(Codeup)：请使用"本地仓库"标签页</p>
                                                    <p style={{margin: '4px 0'}}>3.
                                                        公开仓库可不填Token，私有仓库需要填写访问令牌</p>
                                                </div>
                                            ),
                                        }]}
                                        style={{marginBottom: 16, background: '#f6f8fa'}}
                                    />
                                    <Form form={form} layout="vertical" onFinish={(values) => {
                                        onFinish(values);
                                        setConfigDrawerVisible(false);
                                    }} initialValues={{dateRange: getThisWeekRange()}}>
                                        <Form.Item name="repoUrl" label="仓库地址"
                                                   rules={[{required: true, message: '请输入仓库地址'}]}>
                                            <Input placeholder="https://github.com/owner/repo"
                                                   prefix={<GithubOutlined/>}/>
                                        </Form.Item>
                                        <Form.Item name="author" label="作者（可选）">
                                            <Input placeholder="用户名或邮箱，留空获取所有提交"/>
                                        </Form.Item>
                                        <div style={{display: 'flex', gap: 16, flexWrap: 'wrap'}}>
                                            <Form.Item name="dateRange" label="时间范围"
                                                       rules={[{required: true, message: '请选择时间范围'}]}
                                                       style={{flex: 1, minWidth: 280, marginBottom: 16}}>
                                                <RangePicker showTime format="YYYY-MM-DD HH:mm:ss"
                                                             style={{width: '100%'}}
                                                             presets={[
                                                                 {label: '本周', value: getThisWeekRange()},
                                                                 {
                                                                     label: '上周',
                                                                     value: [dayjs().startOf('week').subtract(6, 'day'), dayjs().startOf('week')]
                                                                 },
                                                             ]}/>
                                            </Form.Item>
                                            <Form.Item name="token" label="访问令牌（可选）"
                                                       style={{flex: 1, minWidth: 150, marginBottom: 16}}>
                                                <Input.Password placeholder="私有仓库需要填写"/>
                                            </Form.Item>
                                        </div>
                                        <Form.Item>
                                            <Button type="primary" htmlType="submit" loading={loading}
                                                    icon={<SearchOutlined/>} block>获取提交记录</Button>
                                        </Form.Item>
                                    </Form>
                                </>
                            ),
                        },
                    ]}
                />
            </Drawer>

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
                        extra="支持通义千问、DeepSeek等模型"
                    >
                        <Select
                            value={aiModel}
                            onChange={setAiModel}
                            options={[
                                {value: 'qwen-plus', label: '通义千问Plus (推荐)'},
                                {value: 'qwen-turbo', label: '通义千问Turbo (快速)'},
                                {value: 'qwen-max', label: '通义千问Max (强力)'},
                                {value: 'qwen-long', label: '通义千问Long (长文本)'},
                                {value: 'deepseek-v3', label: 'DeepSeek V3'},
                                {value: 'deepseek-r1', label: 'DeepSeek R1 (推理)'},
                                {value: 'deepseek-chat', label: 'DeepSeek Chat'},
                            ]}
                        />
                    </Form.Item>
                    <Form.Item
                        label="自定义周报模板"
                        extra="可修改模板内容，Git提交记录会自动追加到提示词后面"
                    >
                        <Input.TextArea
                            value={aiPromptTemplate}
                            onChange={(e) => setAiPromptTemplate(e.target.value)}
                            autoSize={{minRows: 6, maxRows: 12}}
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
