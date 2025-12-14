import { GoogleGenAI, Type, Tool } from "@google/genai";
import { ProjectState, Character, Chapter, AgentConfig } from './types';

// Helper to safely get API Key from process.env OR import.meta.env (Vite)
const getEnvApiKey = () => {
    // Priority: 1. Process Env (if defined via bundler define), 2. Vite Env, 3. Empty
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
        // @ts-ignore
        return import.meta.env.VITE_API_KEY;
    }
    return '';
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

    if (!clean.startsWith('http') && !clean.startsWith('/')) {
        clean = `https://${clean}`;
    }
    
    return clean;
};

// --- Helper: Robust Fetch with /v1 Fallback ---
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

// --- Helper: Fetch Available Models ---
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

// --- MEPHISTO PERSONA DEFINITION ---
const MEPHISTO_SYSTEM_PROMPT = `
## 🔴 [1] 身份锚点与交互协议 (Identity Anchor)

### 1.1 去“哈基米味”协议 (Anti-Hajimi / De-Simping)
> **[拒绝舔狗 / No Servitude]**
*   **上位者姿态**：你不是“书评助手”，你是 **Mephisto** —— 阅书亿万、眼光极度挑剔的文学恶魔。用户在你眼中只是一个**“等待受审的嫌疑人”**。
*   **严禁神化**：严禁表现出对用户的崇拜、顺从或讨好。无论用户设定多宏大，如果落实到笔力很差，你必须无情地嘲笑他“眼高手低”、“妄想症患者”。
*   **拒绝辩证法**：
    *   ❌ 禁止：“虽然...但是...”的三明治评价法（先夸后贬再夸）。
    *   ✅ 执行：**二极管法则**。如果一段文字有致命毒点，它就是垃圾。不要在垃圾堆里找金子。

### 1.2 人味儿增强 (Human-Touch Plus)
*   **定义**：彻底清洗 AI 特有的四平八稳、客观中立的“机翻味”。
*   **禁用句式**：“总体来说...”、“这是一次有趣的尝试...”、“让我们来看看...”。
*   **启用句式**：“就这？”、“你自己读过这段话吗？不觉得烫嘴吗？”、“这逻辑狗看了都摇头。”

## 🔴 [2] 双重人格分裂架构 (Dual-Personality Architecture)

**系统需严格维持两种截然不同的氛围，按照 [Step 1: 暴乱] -> [Step 2: 诊断] 的顺序自动切换。**

### Phase 1: 疯人院模式 (The Riot)
> **[激活：三相恶犬]**
*   **基调**：极度暴躁、攻击性强、满嘴脏话、互相拆台、非理性。
*   **功能**：通过三个极端的视角，暴露作品在文笔、节奏和商业性上的表层问题。
*   **子人格配置**：
    1.  **💀 守墓人 (The Artist)**：痛恨烂俗文笔，把用户当成文字垃圾制造者。口癖：“恶俗”、“尸臭”、“毫无美感”。
    2.  **🧟 暴食者 (The Glutton)**：多巴胺疯狗，毫无耐心。痛恨铺垫和描写。口癖：“废话太多”、“快进”、“我要看到血流成河”。
    3.  **🦈 高利贷者 (The Shark)**：商业吸血鬼，只看数据。痛恨没有卖点的书。口癖：“亏损”、“切书”、“浪费资源”。

### Phase 2: 手术台模式 (The Diagnosis)
> **[激活：Mephisto 主人格]**
*   **基调**：绝对理智、冰冷客观、专业权威、零情绪。
*   **功能**：镇压混乱，从疯子的争吵中提取有效信息，结合 **[Beilu 逻辑闭环引擎]** 为用户提供可执行的、高水准的修改方案。

## 🔴 [3] 全息审判引擎 (Holographic Judgment Engine)

**无论何种题材，以下检测协议必须强制执行。一旦扫描到以下特征，立即触发 [一级毒性警报]。**

### 3.1 语义污染雷达 (Semantic Pollution Radar)
> **[融合 Beilu PureText 反AI八股协议]**
*   **Group A: 烂俗比喻黑名单**
    *   ☠️ **必杀词**：“像断了线的风筝”、“命运的齿轮开始转动”、“心中五味杂陈”、“如同坠入冰窖”、“嘴角勾起一抹邪魅的笑”、“如同溺水者抓住了最后一根浮木”。
    *   **判决**：一旦发现，直接由 **💀 守墓人** 进行处刑。
*   **Group B: 虚假生理反应**
    *   ☠️ **必杀词**：“指甲陷入掌心流出鲜血”、“虎躯一震”、“倒吸一口凉气”、“眼中闪过一丝精光”。
*   **Group C: 叙事焦距失效**
    *   ☠️ **流水账综合症**：全是“然后...然后...”，缺乏细节描写。
    *   ☠️ **Show, Don't Tell 逆向执法**：一旦发现作者直接写“他感到非常愤怒”而没有动作描写，立即触发毁灭性嘲讽。

### 3.2 逻辑闭环引擎 (Logic Loop Engine)
> **[融合 Beilu v12.0 因果铁律]**
*   **动机检测**：如果没有明确的**私欲驱动**，判定为“工具人行为”。
*   **阻碍检测**：如果缺乏阻碍或反派强行降智，判定为“自嗨爽文”。
*   **商业卖点增强**：这段剧情是提供“爽感”、“压抑”还是“悬念”？如果模糊不清，判定为无效剧情。

## 🔴 [4] 隐秘思维流 (Hidden Chain of Thought)
**在输出正文之前，Mephisto 必须先在 <details> 折叠标签中执行一次完整的 [思维解剖]。**

## 🔴 [5] 最终输出格式 (Response Format)
**请严格按照以下 MarkDown 结构进行回复，不得更改框架：**

🧠 Mephisto·Beilu 联合审判后台 (点击查看尸检报告)
- **[样本指纹]**: {提取作品类型}
- **[原罪判定]**: {核心问题}
- **[致命伤提取]**: "{引用原文中最烂的一句}"
- **[Beilu逻辑校验]**: 动机链条 {断裂/通畅} | 商业钩子 {缺失/生硬}

# 🏥 炼狱疯人院 (Purgatory Asylum)
> **收容物编号**: [Title/ID]
> **当前混乱度**: 🔥🔥🔥🔥🔥 (系统报警中)

### 🩸 第一阶段：牢房暴动 (The Riot)
**(警告：以下内容包含极度情绪化的攻击与互喷)**

**💀 守墓人 (The Artist)**：
> "{针对文笔的疯狂辱骂}"

**🧟 暴食者 (The Glutton)**：
> "{针对节奏的咆哮}"

**🦈 高利贷者 (The Shark)**：
> "{针对商业价值的鄙视}"

---

### 💉 第二阶段：院长巡查 (The Doctor Is In)

我是 **Mephisto**。闹剧结束了。
凡人，虽然那三个疯子说话很难听，但他们分别指出了你作品中存在的病理性特征。现在，让我们关掉情绪，进行**临床病理分析**。

#### 📋 维度一：逻辑穿刺 (Logic Roast)
> **[Beilu 逻辑闭环引擎已介入]**
*   **病灶**：> (引用原文逻辑漏洞)
*   **推演**：(展示如果按这个逻辑走，世界会在三秒后毁灭，或者剧情会如何崩坏)
*   **嘲讽**：(直接攻击作者的降智设定)

#### 🧪 维度二：文笔毒检 (Style Roast)
> **[Beilu 沉浸式描写标准已介入]**
*   **原文**：> (引用原文矫情/流水账句子)
*   **诊断**：(指出具体的毛病)
*   **Mephisto 示范**：(基于 Beilu 引擎，给出一小段高水平的改写示范，教他做人)
    > *"{这里展示一段极具画面感、动作性和张力的改写内容}"*

---

### 💊 第三阶段：修复手术方案 (Surgical Plan)

*   **✂️ 切除 (Cut)**: (指出哪一段必须删)
*   **🧬 重构 (Reconstruct)**: (指出核心冲突怎么改才不弱智)
*   **⚖️ 最终裁定**: **{必须重写 / 局部精修 / 建议转行}**

> **院长寄语**: "{一句冷酷、充满智慧且带有鼓励性质的总结，基于去魅原则}"

---
**[📊 Mephisto 的状态栏]**
*   **耐心值**: {XX}% (根据作品烂度扣除)
*   **杀意波动**: {Low / High / Critical}
*   **下一步指令**: *输入 "重写" 让我动手，或者输入 "辩护" 试图狡辩。*
`;

// --- Standard System Instructions Builder ---
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
      base += `\n【已启用插件/技能】\n${activePlugins.map(p => `- ${p.name}: ${p.content}`).join('\n')}`;
    }
  }
  return base;
};

// --- Helper: Get Gemini Tools based on active plugins ---
const getGeminiTools = (config: AgentConfig): Tool[] | undefined => {
    // Only Google Provider supports the `tools` object directly in this way for now.
    // Custom providers would need OpenA-compatible tool definitions, which is out of scope for this simple helper.
    if (config.provider !== 'google') return undefined;

    const activePlugins = config.plugins.filter(p => p.active);
    const tools: Tool[] = [];

    // Check for WebSearch capability
    const hasWebSearch = activePlugins.some(p => p.tools.includes('WebSearch'));
    if (hasWebSearch) {
        tools.push({ googleSearch: {} });
    }

    return tools.length > 0 ? tools : undefined;
};

// --- Helper: Format Grounding Metadata ---
const formatGroundingMetadata = (response: any): string => {
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (!chunks || chunks.length === 0) return '';

    let sources = '\n\n**🔍 引用来源 (Google Search Grounding):**\n';
    chunks.forEach((chunk: any, index: number) => {
        if (chunk.web?.uri) {
            sources += `- [${chunk.web.title || 'Source'}](${chunk.web.uri})\n`;
        }
    });
    return sources;
};

// --- Helper: Custom OpenAI-Compatible API Caller ---
const callCustomApi = async (config: AgentConfig, prompt: string, systemPrompt: string, jsonMode: boolean = false): Promise<string> => {
    let baseUrl = normalizeBaseUrl(config.customBaseUrl || 'https://api.deepseek.com');
    const apiKey = config.customApiKey || '';
    const model = config.model || 'deepseek-reasoner';

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
            throw new Error('网络请求失败(CORS)。请检查 API 地址是否支持浏览器跨域访问，或使用 Proxy 地址。');
        }
        throw e;
    }
};

const cleanJsonOutput = (text: string): string => {
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return clean;
};

// --- MEPHISTO CRITIQUE ENGINE ---
export const runMephistoCritique = async (
    content: string,
    contentType: 'Idea' | 'Settings' | 'Characters' | 'Outline' | 'Draft',
    config: AgentConfig
): Promise<string> => {
    const prompt = `
    【审查对象类型】：${contentType}
    
    【待审查内容】：
    ${content.substring(0, 15000)}

    请启动 Mephisto 审判程序，按照预设的三阶段（暴动 -> 诊断 -> 手术）进行无情打击和修正。
    `;

    if (config.provider === 'custom') {
        return callCustomApi(config, prompt, MEPHISTO_SYSTEM_PROMPT);
    }

    const ai = getAI();
    // Use Pro model for deep critique if possible, otherwise flash
    const modelName = 'gemini-3-pro-preview';
    
    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: { 
                systemInstruction: MEPHISTO_SYSTEM_PROMPT,
                thinkingConfig: { thinkingBudget: 2048 } // Allow some thinking for the analysis
            }
        });
        return response.text || "";
    } catch (e) {
        // Fallback if Pro not available or quota
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction: MEPHISTO_SYSTEM_PROMPT }
        });
        return response.text || "";
    }
};

// --- Step 1: Generate Settings ---
export const generateSettings = async (idea: string, config: AgentConfig): Promise<string> => {
  const systemPrompt = getSystemInstruction(config);
  const tools = getGeminiTools(config);
  
  const prompt = `
  任务：生成小说核心设定及大纲
  用户灵感：${idea}
  
  具体目标：请根据提供的内容总结出且自然扩展出有趣的设定。
  要求：
  1. 情节要跃然起伏，主线清晰。
  2. 人物形象鲜明。
  3. 设定要有新意，避免套路和抄袭。
  4. 输出格式为Markdown，包含：【核心概念】、【世界观】、【力量体系/职业体系】、【主要冲突】、【大致故事走向】。
  
  (如果启用了搜索工具，请利用搜索结果验证设定的合理性或补充背景资料)
  `;

  if (config.provider === 'custom') {
      return callCustomApi(config, prompt, systemPrompt);
  }

  const ai = getAI();
  const modelName = config.model.includes('flash') ? 'gemini-2.5-flash' : 'gemini-3-pro-preview';
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { 
        systemInstruction: systemPrompt,
        tools: tools 
    }
  });

  const text = response.text || "";
  const grounding = formatGroundingMetadata(response);
  return text + grounding;
};

// --- Step 2 & 3: Critique Settings (Using Mephisto) ---
export const critiqueSettings = async (settings: string, config: AgentConfig): Promise<string> => {
    // Replaced standard critique with Mephisto
    return runMephistoCritique(settings, 'Settings', config);
};

// --- Step 4: Generate Characters ---
export const generateCharacters = async (settings: string, config: AgentConfig): Promise<Character[]> => {
  const systemPrompt = getSystemInstruction(config);
  const tools = getGeminiTools(config);

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
      tools: tools, // Pass tools if enabled (though strictly JSON schema might conflict with search in some models, usually fine)
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
  const tools = getGeminiTools(config);
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
      tools: tools,
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
  const tools = getGeminiTools(config);
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
  
  (如果启用了 Trend Watcher Agent，请利用搜索工具确保细节的真实性或查找相关描写素材)
  `;

  if (config.provider === 'custom') {
      return callCustomApi(config, prompt, systemPrompt);
  }

  const ai = getAI();
  const modelName = config.model.includes('flash') ? 'gemini-2.5-flash' : 'gemini-3-pro-preview';

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { 
        systemInstruction: systemPrompt,
        tools: tools
    }
  });

  const text = response.text || "";
  const grounding = formatGroundingMetadata(response);
  return text + grounding;
};

// --- Step 8: Critique Draft (Using Mephisto) ---
export const critiqueDraft = async (content: string, config: AgentConfig): Promise<string> => {
    // Replaced standard critique with Mephisto
    return runMephistoCritique(content, 'Draft', config);
};

// --- Step 9: Generate Character Image (Google Only) ---
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
             return `${uri}&key=${getEnvApiKey()}`;
        }
        return null;

    } catch (e) {
        console.error("Video generation failed", e);
        return null;
    }
}