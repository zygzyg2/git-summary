import {useEffect, useRef, useState} from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import './MarkdownEditor.css';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    height?: number | string;
    streaming?: boolean; // 流式输出模式
}

let editorCounter = 0;

const MarkdownEditor = ({value, onChange, height = 'calc(100vh - 300px)', streaming = false}: MarkdownEditorProps) => {
    const [editorId] = useState(() => `vditor_${++editorCounter}`);
    const vditorRef = useRef<Vditor | null>(null);
    const isInternalChange = useRef(false);
    const lastValueRef = useRef(value);
    const initialValueRef = useRef(value);
    const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // 保存初始值
        initialValueRef.current = value;

        // 延迟初始化，确保 DOM 已渲染
        const timer = setTimeout(() => {
            const container = document.getElementById(editorId);
            if (!container || vditorRef.current) return;

            // 初始化 Vditor
            vditorRef.current = new Vditor(editorId, {
                height: typeof height === 'number' ? height : undefined,
                mode: 'ir', // 即时渲染模式
                theme: 'classic',
                icon: 'ant',
                placeholder: '周报内容将在这里显示...',
                toolbar: [
                    'headings',
                    'bold',
                    'italic',
                    'strike',
                    'link',
                    '|',
                    'list',
                    'ordered-list',
                    'check',
                    '|',
                    'quote',
                    'code',
                    'inline-code',
                    '|',
                    'undo',
                    'redo',
                    '|',
                    'fullscreen',
                ],
                cache: {
                    enable: false,
                },
                after: () => {
                    // 初始化后设置内容
                    if (initialValueRef.current && vditorRef.current) {
                        vditorRef.current.setValue(initialValueRef.current);
                        lastValueRef.current = initialValueRef.current;
                    }
                    // 如果是字符串高度，手动设置
                    if (typeof height === 'string') {
                        const el = document.getElementById(editorId);
                        if (el) {
                            el.style.height = height;
                        }
                    }
                },
                input: (val: string) => {
                    // 用户输入时触发
                    isInternalChange.current = true;
                    lastValueRef.current = val;
                    onChange(val);
                    // 延迟重置标志
                    setTimeout(() => {
                        isInternalChange.current = false;
                    }, 50);
                },
            });
        }, 100);

        return () => {
            clearTimeout(timer);
            if (streamingTimerRef.current) {
                clearTimeout(streamingTimerRef.current);
            }
            if (vditorRef.current) {
                try {
                    vditorRef.current.destroy();
                } catch (e) {
                    // 忽略销毁错误
                }
                vditorRef.current = null;
            }
        };
    }, [editorId]);

    // 外部 value 变化时更新编辑器
    useEffect(() => {
        if (vditorRef.current && !isInternalChange.current && value !== lastValueRef.current) {
            // 流式模式下使用轻量级防抖，减少闪烁但保留实时效果
            if (streaming) {
                if (streamingTimerRef.current) {
                    clearTimeout(streamingTimerRef.current);
                }
                // 使用较短的防抖时间，保留流式效果
                streamingTimerRef.current = setTimeout(() => {
                    if (vditorRef.current && value !== lastValueRef.current) {
                        // 使用 insertValue 追加内容，减少重绘
                        const currentValue = lastValueRef.current || '';
                        if (value.startsWith(currentValue) && value.length > currentValue.length) {
                            // 追加内容
                            const newContent = value.slice(currentValue.length);
                            vditorRef.current.insertValue(newContent);
                        } else {
                            // 完全替换
                            vditorRef.current.setValue(value);
                        }
                        lastValueRef.current = value;
                    }
                }, 50); // 50ms 防抖，保留流式效果
            } else {
                vditorRef.current.setValue(value);
                lastValueRef.current = value;
            }
        }
    }, [value, streaming]);

    return <div id={editorId} className="vditor-editor-wrapper"
                style={{height: typeof height === 'string' ? height : undefined}}/>;
};

export default MarkdownEditor;
