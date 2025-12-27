import {useState} from 'react';
import {Layout, Space, Tabs, Tag, message} from 'antd';
import {FileTextOutlined, UnorderedListOutlined} from '@ant-design/icons';
import {Dayjs} from 'dayjs';

// Components
import AppHeader from './components/AppHeader';
import ReportTab from './components/ReportTab';
import CommitsTab from './components/CommitsTab';
import ConfigDrawer from './components/ConfigDrawer';
import AISettingsModal from './components/AISettingsModal';
import FolderBrowserModal from './components/FolderBrowserModal';

// Hooks
import {useAISettings, useCommits, useFolderBrowser, useRepoConfig} from './hooks';

const {Content, Footer} = Layout;

function App() {
    // UI 状态
    const [configDrawerVisible, setConfigDrawerVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('localRepo');
    const [activeResultTab, setActiveResultTab] = useState('report');

    // 使用自定义 Hooks
    const aiSettings = useAISettings();
    const folderBrowser = useFolderBrowser();
    const repoConfig = useRepoConfig();
    const commits = useCommits();

    // 处理文件夹选择
    const handleSelectFolder = async (folderPath: string) => {
        await repoConfig.selectFolder(folderPath);
        folderBrowser.setFolderBrowserVisible(false);
    };

    // 处理移除仓库
    const handleRemoveRepo = (repoPath: string) => {
        repoConfig.removeRepo(repoPath, commits.setRepoCommits);
    };

    // 处理本地仓库提交
    const handleLocalRepoSubmit = async (values: { dateRange: [Dayjs, Dayjs] }) => {
        await commits.onLocalRepoSubmit(values, repoConfig.repoConfigs, repoConfig.selectedAuthors);
    };

    // 处理 AI 优化
    const handleAIOptimize = async () => {
        await commits.handleAIOptimize(
            aiSettings.aiApiKey,
            aiSettings.aiModel,
            aiSettings.aiPromptTemplate,
            () => aiSettings.setAiSettingsVisible(true),
            aiSettings.aiProvider,
            aiSettings.aiCustomApiUrl,
            aiSettings.aiCustomModel
        );
    };

    // 保存 AI 设置
    const handleSaveAISettings = () => {
        aiSettings.saveAISettings();
        message.success('AI设置已保存');
    };

    return (
        <Layout style={{minHeight: '100vh'}}>
            <AppHeader
                onOpenConfigDrawer={() => setConfigDrawerVisible(true)}
                onOpenAISettings={() => aiSettings.setAiSettingsVisible(true)}
            />

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
                                <ReportTab
                                    weeklyReport={commits.weeklyReport}
                                    totalCommits={commits.totalCommits}
                                    optimizing={commits.optimizing}
                                    onWeeklyReportChange={commits.setWeeklyReport}
                                    onAIOptimize={handleAIOptimize}
                                    onCancelAIOptimize={commits.cancelAIOptimize}
                                    onCopy={commits.copyToClipboard}
                                />
                            ),
                        },
                        {
                            key: 'commits',
                            label: (
                                <Space>
                                    <UnorderedListOutlined/>
                                    <span>提交记录</span>
                                    {commits.totalCommits > 0 && <Tag color="blue">{commits.totalCommits}</Tag>}
                                </Space>
                            ),
                            children: (
                                <CommitsTab
                                    repoCommits={commits.repoCommits}
                                    totalCommits={commits.totalCommits}
                                    activeCommitTab={commits.activeCommitTab}
                                    onActiveCommitTabChange={commits.setActiveCommitTab}
                                    onOpenConfigDrawer={() => setConfigDrawerVisible(true)}
                                />
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
            <ConfigDrawer
                visible={configDrawerVisible}
                onClose={() => setConfigDrawerVisible(false)}
                activeTab={activeTab}
                onActiveTabChange={setActiveTab}
                repoConfigs={repoConfig.repoConfigs}
                inputRepoPath={repoConfig.inputRepoPath}
                repoPathHistory={repoConfig.repoPathHistory}
                pullingRepos={repoConfig.pullingRepos}
                allAuthors={repoConfig.allAuthors}
                selectedAuthors={repoConfig.selectedAuthors}
                loading={commits.loading}
                onInputRepoPathChange={repoConfig.setInputRepoPath}
                onAddRepoFromInput={repoConfig.addRepoFromInput}
                onOpenFolderBrowser={folderBrowser.openFolderBrowser}
                onRemoveRepo={handleRemoveRepo}
                onUpdateRepoSelectedBranches={repoConfig.updateRepoSelectedBranches}
                onGitPull={repoConfig.handleGitPull}
                onGitPullAll={repoConfig.handleGitPullAll}
                onSelectedAuthorsChange={repoConfig.setSelectedAuthors}
                onLocalRepoSubmit={handleLocalRepoSubmit}
                onGitLogPaste={commits.onGitLogPaste}
                onApiSubmit={commits.onFinish}
            />

            {/* AI设置弹窗 */}
            <AISettingsModal
                visible={aiSettings.aiSettingsVisible}
                provider={aiSettings.aiProvider}
                apiKey={aiSettings.aiApiKey}
                model={aiSettings.aiModel}
                promptTemplate={aiSettings.aiPromptTemplate}
                customApiUrl={aiSettings.aiCustomApiUrl}
                customModel={aiSettings.aiCustomModel}
                onProviderChange={aiSettings.setAiProvider}
                onApiKeyChange={aiSettings.setAiApiKey}
                onModelChange={aiSettings.setAiModel}
                onPromptTemplateChange={aiSettings.setAiPromptTemplate}
                onCustomApiUrlChange={aiSettings.setAiCustomApiUrl}
                onCustomModelChange={aiSettings.setAiCustomModel}
                onSave={handleSaveAISettings}
                onCancel={() => aiSettings.setAiSettingsVisible(false)}
            />

            {/* 文件夹浏览器弹窗 */}
            <FolderBrowserModal
                visible={folderBrowser.folderBrowserVisible}
                browsingPath={folderBrowser.browsingPath}
                directories={folderBrowser.directories}
                loadingDirs={folderBrowser.loadingDirs}
                onClose={() => folderBrowser.setFolderBrowserVisible(false)}
                onBrowsingPathChange={folderBrowser.setBrowsingPath}
                onBrowsePath={folderBrowser.browsePath}
                onGoToParent={folderBrowser.goToParent}
                onSelectFolder={handleSelectFolder}
            />
        </Layout>
    );
}

export default App;
