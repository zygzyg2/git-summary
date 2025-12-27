// 默认的 AI 周报模板
export const DEFAULT_PROMPT_TEMPLATE = `
你是一个专业的技术周报撰写助手。请根据提供的Git提交记录，生成一份清晰、专业的周报内容。
要求：
    1.对相似的提交进行归类和合并
    2.周报是给老板看的，不要过多的使用一些技术名词，内容尽量精简，可以合并一些类似的内容
    3.突出重点工作成果
    4.只输出周报内容，不要添加额外的解释
    5.每个内容前面带上emoji
    6.生成markdown文档，markdown语法不要使用 '#' 和 '*'，列表要加上序号 。
    7. 按工作类型分类（🛠️功能开发、🐞Bug修复、🔧代码优化，📦其他事项）每个分类下面的内容都使用有序列表列出
`

// AI 平台提供商配置
export interface AIProvider {
    id: string;
    name: string;
    apiUrl: string;
    apiKeyUrl: string;
    apiKeyPlaceholder: string;
    models: { value: string; label: string }[];
}

export const AI_PROVIDERS: AIProvider[] = [
    {
        id: 'dashscope',
        name: '阿里云百炼',
        apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        apiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
        apiKeyPlaceholder: '请输入阿里云百炼API Key (sk-xxx)',
        models: [
            { value: 'qwen-plus', label: '通义千问Plus (推荐)' },
            { value: 'qwen-turbo', label: '通义千问Turbo (快速)' },
            { value: 'qwen-max', label: '通义千问Max (强力)' },
            { value: 'qwen-long', label: '通义千问Long (长文本)' },
            { value: 'deepseek-v3', label: 'DeepSeek V3' },
            { value: 'deepseek-r1', label: 'DeepSeek R1 (推理)' },
            { value: 'deepseek-chat', label: 'DeepSeek Chat' },
        ],
    },
    {
        id: 'modelscope',
        name: '魔搭社区',
        apiUrl: 'https://api-inference.modelscope.cn/v1/chat/completions',
        apiKeyUrl: 'https://modelscope.cn/my/myaccesstoken',
        apiKeyPlaceholder: '请输入魔搭社区 SDK Token',
        models: [
            { value: 'Qwen/Qwen3-32B', label: 'Qwen3-32B (推荐)' },
            { value: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3-235B' },
            { value: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen2.5-Coder-32B' },
            { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B' },
            { value: 'Qwen/Qwen2.5-32B-Instruct', label: 'Qwen2.5-32B' },
            { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B (快速)' },
            { value: 'deepseek-ai/DeepSeek-R1-0528', label: 'DeepSeek R1' },
        ],
    },
    {
        id: 'siliconflow',
        name: '硅基流动',
        apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
        apiKeyPlaceholder: '请输入硅基流动 API Key (sk-xxx)',
        models: [
            { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B (推荐)' },
            { value: 'Qwen/Qwen2.5-32B-Instruct', label: 'Qwen2.5-32B' },
            { value: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen2.5-Coder-32B' },
            { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3' },
            { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1 (推理)' },
            { value: 'THUDM/glm-4-9b-chat', label: 'GLM-4-9B' },
            { value: 'internlm/internlm2_5-20b-chat', label: 'InternLM2.5-20B' },
        ],
    },
    {
        id: 'deepseek',
        name: 'DeepSeek官方',
        apiUrl: 'https://api.deepseek.com/chat/completions',
        apiKeyUrl: 'https://platform.deepseek.com/api_keys',
        apiKeyPlaceholder: '请输入DeepSeek API Key (sk-xxx)',
        models: [
            { value: 'deepseek-chat', label: 'DeepSeek Chat (推荐)' },
            { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (推理)' },
        ],
    },
    {
        id: 'openai',
        name: 'OpenAI',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        apiKeyPlaceholder: '请输入OpenAI API Key (sk-xxx)',
        models: [
            { value: 'gpt-4o', label: 'GPT-4o (推荐)' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini (快速)' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (经济)' },
        ],
    },
    {
        id: 'custom',
        name: '自定义 (OpenAI兼容)',
        apiUrl: '',
        apiKeyUrl: '',
        apiKeyPlaceholder: '请输入API Key',
        models: [],
    },
];

export const DEFAULT_PROVIDER = 'dashscope';


