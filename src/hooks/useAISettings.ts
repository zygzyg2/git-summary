import { useState } from 'react';
import { DEFAULT_PROMPT_TEMPLATE, DEFAULT_PROVIDER, AI_PROVIDERS } from '../constants';

export interface AISettings {
    provider: string;
    apiKey: string;
    model: string;
    promptTemplate: string;
    customApiUrl?: string;
    customModel?: string;
}

export interface UseAISettingsReturn {
    aiProvider: string;
    aiApiKey: string;
    aiModel: string;
    aiPromptTemplate: string;
    aiCustomApiUrl: string;
    aiCustomModel: string;
    aiSettingsVisible: boolean;
    setAiProvider: (provider: string) => void;
    setAiApiKey: (key: string) => void;
    setAiModel: (model: string) => void;
    setAiPromptTemplate: (template: string) => void;
    setAiCustomApiUrl: (url: string) => void;
    setAiCustomModel: (model: string) => void;
    setAiSettingsVisible: (visible: boolean) => void;
    saveAISettings: () => void;
}

export function useAISettings(): UseAISettingsReturn {
    const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('ai_provider') || DEFAULT_PROVIDER);
    const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem('ai_api_key') || '');
    const [aiModel, setAiModel] = useState(() => {
        const saved = localStorage.getItem('ai_model');
        if (saved) return saved;
        const provider = AI_PROVIDERS.find(p => p.id === (localStorage.getItem('ai_provider') || DEFAULT_PROVIDER));
        return provider?.models[0]?.value || 'qwen-plus';
    });
    const [aiPromptTemplate, setAiPromptTemplate] = useState(
        () => localStorage.getItem('ai_prompt_template') || DEFAULT_PROMPT_TEMPLATE
    );
    const [aiCustomApiUrl, setAiCustomApiUrl] = useState(() => localStorage.getItem('ai_custom_api_url') || '');
    const [aiCustomModel, setAiCustomModel] = useState(() => localStorage.getItem('ai_custom_model') || '');
    const [aiSettingsVisible, setAiSettingsVisible] = useState(false);

    const saveAISettings = () => {
        localStorage.setItem('ai_provider', aiProvider);
        localStorage.setItem('ai_api_key', aiApiKey);
        localStorage.setItem('ai_model', aiModel);
        localStorage.setItem('ai_prompt_template', aiPromptTemplate);
        localStorage.setItem('ai_custom_api_url', aiCustomApiUrl);
        localStorage.setItem('ai_custom_model', aiCustomModel);
        setAiSettingsVisible(false);
    };

    return {
        aiProvider,
        aiApiKey,
        aiModel,
        aiPromptTemplate,
        aiCustomApiUrl,
        aiCustomModel,
        aiSettingsVisible,
        setAiProvider,
        setAiApiKey,
        setAiModel,
        setAiPromptTemplate,
        setAiCustomApiUrl,
        setAiCustomModel,
        setAiSettingsVisible,
        saveAISettings,
    };
}
