import React from 'react';
import { Form, Input, Modal, Select } from 'antd';

interface AISettingsModalProps {
    visible: boolean;
    apiKey: string;
    model: string;
    promptTemplate: string;
    onApiKeyChange: (value: string) => void;
    onModelChange: (value: string) => void;
    onPromptTemplateChange: (value: string) => void;
    onSave: () => void;
    onCancel: () => void;
}

const AISettingsModal: React.FC<AISettingsModalProps> = ({
    visible,
    apiKey,
    model,
    promptTemplate,
    onApiKeyChange,
    onModelChange,
    onPromptTemplateChange,
    onSave,
    onCancel,
}) => {
    return (
        <Modal
            title="AI优化设置"
            open={visible}
            onOk={onSave}
            onCancel={onCancel}
            okText="保存"
            cancelText="取消"
        >
            <Form layout="vertical">
                <Form.Item
                    label="API Key"
                    required
                    extra={
                        <span>
                            请在 <a href="https://bailian.console.aliyun.com/?apiKey=1" target="_blank" rel="noopener noreferrer">
                                阿里云百炼平台
                            </a> 获取API Key
                        </span>
                    }
                >
                    <Input.Password
                        value={apiKey}
                        onChange={(e) => onApiKeyChange(e.target.value)}
                        placeholder="请输入阿里云百炼API Key (sk-xxx)"
                    />
                </Form.Item>
                <Form.Item
                    label="模型选择"
                    extra="支持通义千问、DeepSeek等模型"
                >
                    <Select
                        value={model}
                        onChange={onModelChange}
                        options={[
                            { value: 'qwen-plus', label: '通义千问Plus (推荐)' },
                            { value: 'qwen-turbo', label: '通义千问Turbo (快速)' },
                            { value: 'qwen-max', label: '通义千问Max (强力)' },
                            { value: 'qwen-long', label: '通义千问Long (长文本)' },
                            { value: 'deepseek-v3', label: 'DeepSeek V3' },
                            { value: 'deepseek-r1', label: 'DeepSeek R1 (推理)' },
                            { value: 'deepseek-chat', label: 'DeepSeek Chat' },
                        ]}
                    />
                </Form.Item>
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
