import { GoogleGenAI, Type, Tool } from "@google/genai";
import { ProjectState, Character, Chapter, AgentConfig, ProviderConfig } from './types';

// Helper to safely get API Key from process.env OR import.meta.env (Vite)
const getEnvApiKey = () => {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_KEY) {
        return (import.meta as any).env.VITE_API_KEY;
    }
    return '';
};

// Initialize the API client
const getAI = (apiKey?: string) => new GoogleGenAI({ apiKey: apiKey || getEnvApiKey() });

// --- Helper: Normalize Base URL ---
const normalizeBaseUrl = (url: string): string => {
    let clean = url.trim();
    clean = clean.replace(/\/+$/, ''); // Remove trailing slash
    
    const suffixes = [
        '/chat/completions',
        '/embeddings',
        '/models',
        '/audio/speech',
        '/audio/transcriptions',
        '/images/generations'
    ];
    
    let modified = true;
    while (modified) {
        modified = false;
        for (const suffix of suffixes) {
            if (clean.endsWith(suffix)) {
                clean = clean.substring(0, clean.length - suffix.length);
                clean = clean.replace(/\/+$/, ''); 
                modified = true;
            }
        }
    }

    if (!clean.startsWith('http') && !clean.startsWith('/')) {
        clean = `https://${clean}`;
    }
    
    return clean;
};

const fetchWithFallback = async (url: string, options: RequestInit): Promise<Response> => {
    const response = await fetch(url, options);

    if (response.status === 404 && !url.includes('/v1/')) {
        try {
            const urlObj = new URL(url, window.location.origin);
            if (!urlObj.pathname.startsWith('/v1')) {
                urlObj.pathname = `/v1${urlObj.pathname}`;
                const fallbackResponse = await fetch(urlObj.toString(), options);
                if (fallbackResponse.status !== 404) {
                    return fallbackResponse;
                }
            }
        } catch (e) {
            // URL parsing failed
        }
    }
    return response;
};

export const fetchAvailableModels = async (baseUrl: string, apiKey: string): Promise<string[]> => {
    try {
        const cleanBaseUrl = normalizeBaseUrl(baseUrl);
        const url = `${cleanBaseUrl}/models`;

        const response = await fetchWithFallback(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            mode: 'cors'
        });

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.data)) {
                return data.data.map((m: any) => m.id).sort();
            }
            return [];
        }
        return [];
    } catch (e) {
        console.error("Failed to fetch models", e);
        return [];
    }
};

export const testApiConnection = async (baseUrl: string, apiKey: string, model: string): Promise<{success: boolean, message: string}> => {
    try {
        const cleanBaseUrl = normalizeBaseUrl(baseUrl);
        const targetModel = model || 'gpt-3.5-turbo'; 

        const isEmbedding = targetModel.toLowerCase().includes('embedding') || 
                            targetModel.toLowerCase().includes('bge') || 
                            targetModel.toLowerCase().includes('nomic') ||
                            targetModel.toLowerCase().includes('text-'); 

        let url = '';
        let body = {};

        if (isEmbedding) {
            url = `${cleanBaseUrl}/embeddings`;
            body = {
                model: targetModel,
                input: "Test connection"
            };
        } else {
            url = `${cleanBaseUrl}/chat/completions`;
            body = {
                model: targetModel,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1
            };
        }
        
        const response = await fetchWithFallback(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            mode: 'cors',
            credentials: 'omit',
            body: JSON.stringify(body)
        });

        if (response.ok) {
            return { success: true, message: `连接成功 (200 OK)` };
        } else {
            const text = await response.text();
            try {
                const json = JSON.parse(text);
                const errMsg = json.error?.message || json.message || response.statusText;
                return { success: false, message: `错误: ${errMsg}` };
            } catch {
                return { success: false, message: `错误 (${response.status}): ${text.substring(0, 50)}...` };
            }
        }
    } catch (e: any) {
        console.error("API Test Failed", e);
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            return { 
                success: false, 
                message: '网络不可达 (CORS)。请尝试使用 Proxy 地址 (如 /proxy/deepseek) 作为 Base URL。' 
            };
        }
        return { success: false, message: `网络错误: ${e.message}` };
    }
};

// --- MEPHISTO ---
const DEFAULT_MEPHISTO_PROMPT = `
## 🔴 Mephisto 审判程序
> **身份**: 极度挑剔的文学恶魔。
> **目标**: 摧毁平庸，逼迫作者进化。
> **风格**: 毒舌、直接、一针见血。
`;

const getSystemInstruction = (config?: AgentConfig) => {
  let base = `你是一位专业的小说创作助手。请始终使用中文回复。`;
  if (config) {
    base += `\n\n【Agent】${config.name}: ${config.description}\n`;
    const activePlugins = config.plugins.filter(p => p.active);
    if (activePlugins.length > 0) {
      base += `\n【技能】\n${activePlugins.map(p => `- ${p.name}: ${p.content}`).join('\n')}`;
    }
  }
  return base;
};

const getGeminiTools = (config: AgentConfig): Tool[] | undefined => {
    // Check if active provider is Google
    if (config.activeProviderId !== 'google') return undefined;

    const activePlugins = config.plugins.filter(p => p.active);
    const tools: Tool[] = [];
    if (activePlugins.some(p => p.tools.includes('WebSearch'))) {
        tools.push({ googleSearch: {} });
    }
    return tools.length > 0 ? tools : undefined;
};

const formatGroundingMetadata = (response: any): string => {
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (!chunks || chunks.length === 0) return '';
    let sources = '\n\n**🔍 引用来源:**\n';
    chunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
            sources += `- [${chunk.web.title || 'Source'}](${chunk.web.uri})\n`;
        }
    });
    return sources;
};

const cleanJsonOutput = (text: string): string => {
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return clean;
};

// --- Unified API Caller ---
const callApi = async (config: AgentConfig, prompt: string, systemPrompt: string, jsonMode: boolean = false): Promise<string> => {
    const provider = config.providers.find(p => p.id === config.activeProviderId);
    if (!provider) throw new Error("No active provider selected");

    // Google Gemini Logic
    if (provider.id === 'google') {
        const ai = getAI(provider.apiKey);
        const modelName = provider.activeModel || 'gemini-2.5-flash';
        const tools = getGeminiTools(config);
        
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: { 
                    systemInstruction: systemPrompt,
                    tools: tools,
                    ...(jsonMode ? { responseMimeType: "application/json" } : {})
                }
            });
            const text = response.text || "";
            const grounding = formatGroundingMetadata(response);
            return text + grounding;
        } catch (e: any) {
            console.error("Gemini API Error", e);
            throw e;
        }
    }

    // OpenAI/DeepSeek/Generic Logic
    let baseUrl = normalizeBaseUrl(provider.baseUrl);
    const apiKey = provider.apiKey || '';
    const model = provider.activeModel;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
    ];

    try {
        const url = `${baseUrl}/chat/completions`;
        const response = await fetchWithFallback(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            mode: 'cors',
            credentials: 'omit',
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: false,
                ...(jsonMode ? { response_format: { type: "json_object" } } : {})
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return content;
    } catch (e: any) {
        console.error("Custom API Call Failed", e);
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            throw new Error('CORS Error. Try using a Proxy URL.');
        }
        throw e;
    }
};

// --- Public Methods ---

export const runMephistoCritique = async (content: string, type: string, config: AgentConfig) => {
    const prompt = `【审查对象】${type}\n【内容】\n${content.substring(0, 15000)}\n请进行无情审判。`;
    const criticPlugin = config.plugins.find(p => p.active && (p.id === 'critic' || p.tags.includes('书评')));
    const sys = criticPlugin ? criticPlugin.content : DEFAULT_MEPHISTO_PROMPT;
    return callApi(config, prompt, sys);
};

export const generateSettings = async (idea: string, config: AgentConfig) => {
    const sys = getSystemInstruction(config);
    const prompt = `任务：生成小说大纲。\n灵感：${idea}\n要求：Markdown格式，包含核心概念、世界观、力量体系、主要冲突。`;
    return callApi(config, prompt, sys);
};

export const generateCharacters = async (settings: string, config: AgentConfig): Promise<Character[]> => {
    const sys = getSystemInstruction(config);
    const prompt = `任务：创建角色。\n设定：${settings}\n要求：JSON数组，包含 id, name, role, description, appearance。`;
    const text = await callApi(config, prompt, sys, true);
    try {
        return JSON.parse(cleanJsonOutput(text));
    } catch (e) {
        console.error("JSON Parse Error", e);
        return [];
    }
};

export const generateOutline = async (settings: string, characters: Character[], config: AgentConfig): Promise<Chapter[]> => {
    const sys = getSystemInstruction(config);
    const charContext = characters.map(c => `${c.name} (${c.role})`).join(', ');
    const prompt = `任务：章节大纲(前10章)。\n设定：${settings}\n角色：${charContext}\n要求：JSON数组，包含 id, number, title, summary。`;
    const text = await callApi(config, prompt, sys, true);
    try {
        return JSON.parse(cleanJsonOutput(text));
    } catch (e) {
        return [];
    }
};

export const writeChapterContent = async (chapter: Chapter, settings: string, characters: Character[], prevSummary: string, config: AgentConfig) => {
    const sys = getSystemInstruction(config);
    const charContext = characters.map(c => `${c.name}: ${c.description}`).join('\n');
    const prompt = `任务：撰写第${chapter.number}章 ${chapter.title}。\n本章大纲：${chapter.summary}\n前情：${prevSummary}\n设定：${settings}\n角色：${charContext}`;
    return callApi(config, prompt, sys);
};

export const critiqueDraft = async (content: string, config: AgentConfig) => {
    return runMephistoCritique(content, 'Draft', config);
};

export const critiqueSettings = async (settings: string, config: AgentConfig) => {
    return runMephistoCritique(settings, 'World Settings', config);
};

// --- Visuals (Google Only) ---
export const generateCharacterImage = async (description: string): Promise<string> => {
    const ai = getAI(); // Uses ENV key by default
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: `Anime character: ${description}` }] },
        config: { imageConfig: { aspectRatio: "3:4", imageSize: "1K" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "";
};

export const generateSceneVideo = async (sceneDescription: string): Promise<string | null> => {
    const ai = getAI();
    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: `Anime scene: ${sceneDescription}`,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }
        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if(uri) return `${uri}&key=${getEnvApiKey()}`;
        return null;
    } catch (e) {
        console.error("Video failed", e);
        return null;
    }
};

export const generateComicPanel = async (prompt: string): Promise<string> => {
    // Re-use image gen for now
    const ai = getAI(); 
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: `Manga panel, black and white, high quality: ${prompt}` }] },
        config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "";
};