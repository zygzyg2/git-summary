import React from 'react';
import { Form, Input, Modal, Select, Divider } from 'antd';
import { AI_PROVIDERS } from '../constants';

interface AISettingsModalProps {
    visible: boolean;
    provider: string;
    apiKey: string;
    model: string;
    promptTemplate: string;
    customApiUrl: string;
    customModel: string;
    onProviderChange: (value: string) => void;
    onApiKeyChange: (value: string) => void;
    onModelChange: (value: string) => void;
    onPromptTemplateChange: (value: string) => void;
    onCustomApiUrlChange: (value: string) => void;
    onCustomModelChange: (value: string) => void;
    onSave: () => void;
    onCancel: () => void;
}

const AISettingsModal: React.FC<AISettingsModalProps> = ({
    visible,
    provider,
    apiKey,
    model,
    promptTemplate,
    customApiUrl,
    customModel,
    onProviderChange,
    onApiKeyChange,
    onModelChange,
    onPromptTemplateChange,
    onCustomApiUrlChange,
    onCustomModelChange,
    onSave,
    onCancel,
}) => {
    const currentProvider = AI_PROVIDERS.find(p => p.id === provider) || AI_PROVIDERS[0];
    const isCustomProvider = provider === 'custom';

    const handleProviderChange = (newProvider: string) => {
        onProviderChange(newProvider);
        // 切换平台时重置模型为新平台的默认模型
        const newProviderConfig = AI_PROVIDERS.find(p => p.id === newProvider);
        if (newProviderConfig && newProviderConfig.models.length > 0) {
            onModelChange(newProviderConfig.models[0].value);
        }
    };

    return (
        <Modal
            title="AI优化设置"
            open={visible}
            onOk={onSave}
            onCancel={onCancel}
            okText="保存"
            cancelText="取消"
            width={520}
        >
            <Form layout="vertical">
                <Form.Item
                    label="AI平台"
                    extra="选择你使用的AI服务提供商"
                >
                    <Select
                        value={provider}
                        onChange={handleProviderChange}
                        options={AI_PROVIDERS.map(p => ({
                            value: p.id,
                            label: p.name,
                        }))}
                    />
                </Form.Item>

                {isCustomProvider && (
                    <Form.Item
                        label="自定义API地址"
                        required
                        extra="请输入OpenAI兼容的API地址（包含/v1/chat/completions）"
                    >
                        <Input
                            value={customApiUrl}
                            onChange={(e) => onCustomApiUrlChange(e.target.value)}
                            placeholder="https://your-api.com/v1/chat/completions"
                        />
                    </Form.Item>
                )}

                <Form.Item
                    label="API Key"
                    required
                    extra={
                        currentProvider.apiKeyUrl ? (
                            <span>
                                请在 <a href={currentProvider.apiKeyUrl} target="_blank" rel="noopener noreferrer">
                                    {currentProvider.name}
                                </a> 获取API Key
                            </span>
                        ) : undefined
                    }
                >
                    <Input.Password
                        value={apiKey}
                        onChange={(e) => onApiKeyChange(e.target.value)}
                        placeholder={currentProvider.apiKeyPlaceholder}
                    />
                </Form.Item>

                {isCustomProvider ? (
                    <Form.Item
                        label="模型名称"
                        required
                        extra="请输入模型名称，如: gpt-4, qwen-plus"
                    >
                        <Input
                            value={customModel}
                            onChange={(e) => onCustomModelChange(e.target.value)}
                            placeholder="请输入模型名称"
                        />
                    </Form.Item>
                ) : (
                    <Form.Item
                        label="模型选择"
                        extra={`支持${currentProvider.name}提供的模型`}
                    >
                        <Select
                            value={model}
                            onChange={onModelChange}
                            options={currentProvider.models}
                        />
                    </Form.Item>
                )}

                <Divider />

                <Form.Item
                    label="自定义周报模板"
                    extra="可修改模板内容，Git提交记录会自动追加到提示词后面"
                >
                    <Input.TextArea
                        value={promptTemplate}
                        onChange={(e) => onPromptTemplateChange(e.target.value)}
                        autoSize={{ minRows: 6, maxRows: 12 }}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default AISettingsModal;
