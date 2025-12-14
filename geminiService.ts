import { GoogleGenAI, Schema, Type } from "@google/genai";
import { ProjectState, Character, Chapter, AgentConfig } from './types';

// Initialize the API client - always creates a new instance to pick up the latest key
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper: Test API Connection ---
export const testApiConnection = async (baseUrl: string, apiKey: string, model: string): Promise<{success: boolean, message: string}> => {
    try {
        const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
        const url = `${cleanBaseUrl}/chat/completions`;
        
        // Simple test request
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1
            })
        });

        if (response.ok) {
            return { success: true, message: '连接成功 (200 OK)' };
        } else {
            const text = await response.text();
            try {
                const json = JSON.parse(text);
                return { success: false, message: `错误: ${json.error?.message || response.statusText}` };
            } catch {
                return { success: false, message: `错误 (${response.status}): ${text.substring(0, 100)}` };
            }
        }
    } catch (e: any) {
        return { success: false, message: `网络错误: ${e.message || '无法连接到服务器'}` };
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
    
    // RAG Context Injection (Simulated)
    if (config.ragConfig?.enabled) {
         base += `\n【知识库已启用】\n知识库: ${config.ragConfig.name}\n嵌入模型: ${config.ragConfig.embeddingModel}\n(RAG系统将自动检索相关信息并注入上下文)\n`;
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
    const baseUrl = config.customBaseUrl?.replace(/\/+$/, '') || 'https://api.deepseek.com';
    const apiKey = config.customApiKey || '';
    const model = config.model || 'deepseek-reasoner';

    // Construct Messages
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
    ];

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: false,
                // Attempt JSON mode if requested. Note: Not all providers support response_format.
                // We will rely on prompt engineering as primary method for JSON.
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
    } catch (e) {
        console.error("Custom API Call Failed", e);
        throw e;
    }
};

// --- Helper: Clean JSON Markdown ---
const cleanJsonOutput = (text: string): string => {
    // Remove ```json and ``` markers if present
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
             return `${uri}&key=${process.env.API_KEY}`;
        }
        return null;

    } catch (e) {
        console.error("Video generation failed", e);
        return null;
    }
}
