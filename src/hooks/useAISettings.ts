import { useState } from 'react';
import { DEFAULT_PROMPT_TEMPLATE } from '../constants';

export interface AISettings {
    apiKey: string;
    model: string;
    promptTemplate: string;
}

export interface UseAISettingsReturn {
    aiApiKey: string;
    aiModel: string;
    aiPromptTemplate: string;
    aiSettingsVisible: boolean;
    setAiApiKey: (key: string) => void;
    setAiModel: (model: string) => void;
    setAiPromptTemplate: (template: string) => void;
    setAiSettingsVisible: (visible: boolean) => void;
    saveAISettings: () => void;
}

export function useAISettings(): UseAISettingsReturn {
    const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem('ai_api_key') || '');
    const [aiModel, setAiModel] = useState(() => localStorage.getItem('ai_model') || 'qwen-plus');
    const [aiPromptTemplate, setAiPromptTemplate] = useState(
        () => localStorage.getItem('ai_prompt_template') || DEFAULT_PROMPT_TEMPLATE
    );
    const [aiSettingsVisible, setAiSettingsVisible] = useState(false);

    const saveAISettings = () => {
        localStorage.setItem('ai_api_key', aiApiKey);
        localStorage.setItem('ai_model', aiModel);
        localStorage.setItem('ai_prompt_template', aiPromptTemplate);
        setAiSettingsVisible(false);
    };

    return {
        aiApiKey,
        aiModel,
        aiPromptTemplate,
        aiSettingsVisible,
        setAiApiKey,
        setAiModel,
        setAiPromptTemplate,
        setAiSettingsVisible,
        saveAISettings,
    };
}
