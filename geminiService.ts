import { GoogleGenAI, Schema, Type } from "@google/genai";
import { ProjectState, Character, Chapter, AgentConfig } from './types';

// Helper to safely get API Key from process.env if available, or return empty string
const getEnvApiKey = () => {
    try {
        // @ts-ignore
        return (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
    } catch (e) {
        return '';
    }
};

// Initialize the API client - always creates a new instance to pick up the latest key
const getAI = () => new GoogleGenAI({ apiKey: getEnvApiKey() });

// --- Helper: Normalize Base URL ---
const normalizeBaseUrl = (url: string): string => {
    let clean = url.trim();
    clean = clean.replace(/\/+$/, ''); // Remove trailing slash
    
    // Known suffixes to strip to get to the "base"
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

    if (!clean.startsWith('http')) {
        clean = `https://${clean}`;
    }
    
    return clean;
};

// --- Helper: Robust Fetch with /v1 Fallback ---
// Many users paste "https://api.provider.com" but the API lives at "https://api.provider.com/v1"
// This helper tries the original URL, and if it 404s, tries appending /v1.
const fetchWithFallback = async (url: string, options: RequestInit): Promise<Response> => {
    const response = await fetch(url, options);

    // If 404 and the URL doesn't already contain /v1 (heuristically), try appending /v1
    if (response.status === 404 && !url.includes('/v1/')) {
        // Construct fallback URL. 
        // We need to insert /v1 before the last segment (endpoint) usually, 
        // but since we construct URLs like `${baseUrl}/models`, we can just modify the baseUrl logic in the caller.
        // However, here we have the full URL. Let's try to insert /v1 before the last path segment.
        // E.g. https://api.site.com/chat/completions -> https://api.site.com/v1/chat/completions
        
        try {
            const urlObj = new URL(url);
            // Simple heuristic: prepend /v1 to the pathname
            if (!urlObj.pathname.startsWith('/v1')) {
                urlObj.pathname = `/v1${urlObj.pathname}`;
                // console.log(`[Auto-Fix] Retrying 404 with fallback: ${urlObj.toString()}`);
                const fallbackResponse = await fetch(urlObj.toString(), options);
                // Only return fallback if it's NOT 404, or if it is, return it anyway (we tried).
                if (fallbackResponse.status !== 404) {
                    return fallbackResponse;
                }
            }
        } catch (e) {
            // URL parsing failed, just return original response
        }
    }
    return response;
};

// --- Helper: Fetch Available Models (OpenAI Compatible) ---
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

// --- Helper: Test API Connection ---
export const testApiConnection = async (baseUrl: string, apiKey: string, model: string): Promise<{success: boolean, message: string}> => {
    try {
        const cleanBaseUrl = normalizeBaseUrl(baseUrl);
        
        // Use a generic model if none provided, to avoid 400 Bad Request on "empty model name"
        // But for Embedding endpoint, we might fail if model doesn't exist.
        // For Chat, we can often just check connectivity.
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
                // Handle SiliconFlow/OpenAI specific error structures
                const errMsg = json.error?.message || json.message || response.statusText;
                return { success: false, message: `错误: ${errMsg}` };
            } catch {
                return { success: false, message: `错误 (${response.status}): ${text.substring(0, 50)}...` };
            }
        }
    } catch (e: any) {
        console.error("API Test Failed", e);
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            return { success: false, message: '跨域(CORS)限制或网络不可达。' };
        }
        return { success: false, message: `网络错误: ${e.message}` };
    }
};

// --- Helper: System Instructions Builder ---
const getSystemInstruction = (config?: AgentConfig) => {
  let base = `
你是一位专业的小说创作助手，担任"主编"和"合著者"的角色。
你的目标是帮助用户创作一部高质量的小说（约800章的规模潜力）。
你遵循严格的流程：设定 -> 审查 -> 角色 -> 大纲 -> 写作 -> 改编。
始终优先考虑逻辑一致性、"爽点"（吸引点）和情感共鸣。
请始终使用中文回复。
`;
  
  if (config) {
    base += `\n\n【Agent 设定】\n名称: ${config.name}\n描述: ${config.description}\n`;
    if (config.workDir) base += `本地知识库路径: ${config.workDir} (已加载上下文)\n`;
    
    // RAG Context Injection (Simulated Multi-KB)
    if (config.ragConfigs && config.ragConfigs.length > 0) {
        const enabledKbs = config.ragConfigs.filter(r => r.enabled);
        if (enabledKbs.length > 0) {
            base += `\n【知识库已启用】\n`;
            enabledKbs.forEach(kb => {
                base += `- 知识库: ${kb.name} (Model: ${kb.embeddingModel})\n`;
            });
            base += `(RAG系统将自动检索上述知识库的相关信息并注入上下文)\n`;
        }
    }

    const activePlugins = config.plugins.filter(p => p.active);
    if (activePlugins.length > 0) {
      base += `\n【已启用插件/技能】\n${activePlugins.map(p => `- ${p.name}: ${p.systemPromptAddon}`).join('\n')}`;
    }
  }
  return base;
};

// --- Helper: Custom OpenAI-Compatible API Caller ---
const callCustomApi = async (config: AgentConfig, prompt: string, systemPrompt: string, jsonMode: boolean = false): Promise<string> => {
    let baseUrl = normalizeBaseUrl(config.customBaseUrl || 'https://api.deepseek.com');
    const apiKey = config.customApiKey || '';
    const model = config.model || 'deepseek-reasoner';

    // Construct Messages
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
            throw new Error(`Custom API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return content;
    } catch (e: any) {
        console.error("Custom API Call Failed", e);
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            throw new Error('网络请求失败(CORS)。请检查 API 地址是否支持浏览器跨域访问。');
        }
        throw e;
    }
};

// --- Helper: Clean JSON Markdown ---
const cleanJsonOutput = (text: string): string => {
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return clean;
};


// --- Step 1: Generate Settings ---
export const generateSettings = async (idea: string, config: AgentConfig): Promise<string> => {
  const systemPrompt = getSystemInstruction(config);
  const prompt = `
  任务：生成小说核心设定及大纲
  用户灵感：${idea}
  
  具体目标：请根据提供的内容总结出且自然扩展出有趣的设定。
  要求：
  1. 情节要跃然起伏，主线清晰。
  2. 人物形象鲜明。
  3. 设定要有新意，避免套路和抄袭。
  4. 输出格式为Markdown，包含：【核心概念】、【世界观】、【力量体系/职业体系】、【主要冲突】、【大致故事走向】。
  `;

  if (config.provider === 'custom') {
      return callCustomApi(config, prompt, systemPrompt);
  }

  const ai = getAI();
  const modelName = config.model.includes('flash') ? 'gemini-2.5-flash' : 'gemini-3-pro-preview';
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { systemInstruction: systemPrompt }
  });
  return response.text || "";
};

// --- Step 2 & 3: Critique Settings ---
export const critiqueSettings = async (settings: string, config: AgentConfig): Promise<string> => {
  const systemPrompt = getSystemInstruction(config);
  const prompt = `
  任务：参考以下内容对该设定及大纲进行审查和完善
  待审查设定：
  ${settings}

  具体目标：
  1. 核心卖点是什么？给读者带来什么快乐？
  2. 戏剧空间有多大？
  3. 理清因果线（闭环）：开局的设定（因）如何导致后果（果）。
  4. 检查"隐患"和"伏笔"。
  5. 按照 问题 -> 条件 -> 解决 的步骤，理清主角的目标和阻碍。
  
  请输出一份详细的审查报告和修改建议。
  `;

  if (config.provider === 'custom') {
      return callCustomApi(config, prompt, systemPrompt);
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: { 
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingBudget: 4096 }
    }
  });
  return response.text || "";
};

// --- Step 4: Generate Characters ---
export const generateCharacters = async (settings: string, config: AgentConfig): Promise<Character[]> => {
  const systemPrompt = getSystemInstruction(config);
  const prompt = `
  任务：设置小说中的主要角色和次要角色
  背景设定：${settings}

  具体目标：
  1. 创建6-8个主要角色。
  2. 每个角色包含：姓名、角色定位(Main/Support/Antagonist)、外貌性格、历史和动机。
  3. 描述不超过150字。
  
  请务必返回纯 JSON 数组格式，不要包含 Markdown 标记。格式示例：
  [{"id": "1", "name": "...", "role": "Main", "description": "...", "appearance": "..."}]
  `;

  if (config.provider === 'custom') {
      const text = await callCustomApi(config, prompt, systemPrompt, true);
      try {
          return JSON.parse(cleanJsonOutput(text));
      } catch (e) {
          console.error("Failed to parse custom API JSON", e);
          return [];
      }
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            role: { type: Type.STRING, enum: ['Main', 'Support', 'Antagonist'] },
            description: { type: Type.STRING },
            appearance: { type: Type.STRING },
          },
          required: ['id', 'name', 'role', 'description', 'appearance']
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

// --- Step 5 & 6: Generate Chapter Outline ---
export const generateOutline = async (settings: string, characters: Character[], config: AgentConfig): Promise<Chapter[]> => {
  const systemPrompt = getSystemInstruction(config);
  const charContext = characters.map(c => `${c.name} (${c.role}): ${c.description}`).join('\n');
  
  const prompt = `
  任务：制定小说第一卷的章节纲（前10章示范）
  设定：${settings}
  角色：${charContext}

  具体目标：
  1. 根据设定规划每一章的重点内容和目标。
  2. 每一章约对应2300字的剧情量。
  3. 确保节奏紧凑。

  请务必返回纯 JSON 数组格式，不要包含 Markdown 标记。格式示例：
  [{"id": "c1", "number": 1, "title": "...", "summary": "..."}]
  `;

  if (config.provider === 'custom') {
      const text = await callCustomApi(config, prompt, systemPrompt, true);
      try {
          return JSON.parse(cleanJsonOutput(text));
      } catch (e) {
          console.error("Failed to parse custom API JSON", e);
          return [];
      }
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            number: { type: Type.INTEGER },
            title: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: ['id', 'number', 'title', 'summary']
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

// --- Step 7: Write Chapter ---
export const writeChapterContent = async (
  chapter: Chapter, 
  settings: string, 
  characters: Character[], 
  previousSummary: string,
  config: AgentConfig
): Promise<string> => {
  const systemPrompt = getSystemInstruction(config);
  const charContext = characters.map(c => `${c.name}: ${c.description}`).join('\n');
  
  const prompt = `
  任务：创作小说的第 ${chapter.number} 章：${chapter.title}
  
  【世界观设定】：${settings.substring(0, 1000)}...
  【角色表】：${charContext}
  【本章大纲】：${chapter.summary}
  【前情提要】：${previousSummary}

  具体目标：
  1. 写出引人入胜的内容，约2300字。
  2. 风格符合设定。
  3. 引入主要冲突，不要偏离主线。
  `;

  if (config.provider === 'custom') {
      return callCustomApi(config, prompt, systemPrompt);
  }

  const ai = getAI();
  const modelName = config.model.includes('flash') ? 'gemini-2.5-flash' : 'gemini-3-pro-preview';

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { systemInstruction: systemPrompt }
  });
  return response.text || "";
};

// --- Step 8: Critique Draft ---
export const critiqueDraft = async (content: string, config: AgentConfig): Promise<string> => {
  const systemPrompt = getSystemInstruction(config);
  const prompt = `
  任务：对完成的草稿进行审核和修改
  
  草稿内容：
  ${content}

  具体目标：
  1. 审核语言流畅度。
  2. 检查故事逻辑是否自洽。
  3. 角色行为是否一致。
  4. 给出具体的修改建议。
  `;

  if (config.provider === 'custom') {
      return callCustomApi(config, prompt, systemPrompt);
  }

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { systemInstruction: systemPrompt }
  });
  return response.text || "";
};

// --- Step 9: Generate Character Image (Google Only) ---
// Note: Visual tasks are kept on Google GenAI as generic text APIs do not support image generation.
export const generateCharacterImage = async (description: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
        parts: [{ text: `Anime style character design, high quality, detailed, white background. Description: ${description}` }]
    },
    config: {
        imageConfig: {
            aspectRatio: "3:4",
            imageSize: "1K"
        }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
      }
  }
  return "";
};

// --- Step 10: Generate Animation (Google Only) ---
export const generateSceneVideo = async (sceneDescription: string): Promise<string | null> => {
    const ai = getAI();
    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: `Cinematic anime style scene: ${sceneDescription}`,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        // Polling logic
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }
        
        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if(uri) {
             // Use getEnvApiKey to avoid crash, though Veo needs a valid key.
             return `${uri}&key=${getEnvApiKey()}`;
        }
        return null;

    } catch (e) {
        console.error("Video generation failed", e);
        return null;
    }
}