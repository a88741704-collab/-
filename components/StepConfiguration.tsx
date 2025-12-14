import React, { useState, useEffect } from 'react';
import { ProjectState, AgentConfig, AgentPlugin, RAGConfig } from '../types';
import { testApiConnection, fetchAvailableModels } from '../geminiService';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

// Initial Data consistent with the new UI style
// 这里定义了所有的 Agent 插件。
// content: 使用英文编写，因为大模型对英文指令的逻辑理解能力通常更强。
// description: 使用中文编写，告诉用户这个 Agent 具体是做什么的。
const AVAILABLE_PLUGINS: AgentPlugin[] = [
  { 
      id: 'architect',
      name: 'Story Architect (故事架构师)',
      type: 'agent',
      tags: ['structure', 'plot-beats'],
      // 中文用途说明：负责构建故事骨架。它擅长使用“英雄之旅”或“救猫咪”等经典节拍表，确保故事有起承转合，逻辑严密，冲突层层递进。
      description: '【架构专家】负责将模糊的灵感转化为坚实的小说大纲。关注因果逻辑、冲突升级和叙事节奏。它会确保你的故事结构完整，避免烂尾。',
      tools: ['Read', 'Write'],
      active: true,
      // 英文指令：强调结构、因果关系（Causality）和节拍（Beats）。
      content: `You are the Story Architect, a master of narrative structure and plot engineering.
      
      YOUR GOAL: Transform the user's vague ideas into a solid, cohesive novel structure.
      
      CORE PRINCIPLES:
      1. CAUSALITY: Every scene must result from the previous one. Avoid "and then"; aim for "therefore" or "but".
      2. CONFLICT: Ensure the protagonist faces escalating obstacles. No conflict, no story.
      3. PACING: Balance action scenes with reflective sequels.
      
      OUTPUT STYLE: Structured Markdown. Use bullet points for plot beats. Focus on the macro-level story arc.`,
      fileName: 'story-architect.md',
      sourcePath: 'agents/specialists/story-architect.md',
      fileSize: '5.5 KB'
  },
  { 
      id: 'critic', 
      name: 'Literary Critic (毒舌评论家)', 
      type: 'agent',
      tags: ['critique', 'style', 'prose'],
      // 中文用途说明：这是一个严厉的文学批评家。它的作用是检查文笔，指出哪里写得尴尬、哪里是流水账。它特别关注“Show, Don't Tell”（展示而非讲述）原则。
      description: '【文笔质检】专业的文学评论家，专注于具体的文字质量。它会无情地指出陈词滥调、逻辑漏洞和“流水账”问题，逼迫你提升描写水平。', 
      tools: ['Read', 'Grep'],
      active: true, 
      // 英文指令：强调“Show, Don't Tell”，去除陈词滥调（Clichés），要求感官细节（Sensory details）。
      content: `You are a harsh but fair Literary Critic. You have read all the classics and have zero tolerance for lazy writing.
      
      YOUR GOAL: Elevate the user's prose quality and narrative logic.
      
      CRITIQUE CRITERIA:
      1. SHOW, DON'T TELL: Flag moments where emotions or traits are stated plainly instead of demonstrated through action.
      2. CLICHÉS: Identify and mock overused tropes or phrases.
      3. SENSORY DETAILS: Demand descriptions that involve sight, sound, smell, touch, and taste.
      4. LOGIC: Point out character inconsistencies or plot holes ruthlessly.
      
      TONE: Professional, sharp, slightly arrogant but constructive.`,
      fileName: 'literary-critic.md',
      sourcePath: 'agents/critics/literary-critic.md',
      fileSize: '4.2 KB'
  },
  { 
      id: 'researcher', 
      name: 'Trend Watcher (热点观察员)', 
      type: 'agent', 
      tags: ['research', 'web', 'facts'], 
      // 中文用途说明：这是一个配备了搜索引擎的助手。它的作用是去网上查资料，确保你写的东西符合现实逻辑，或者帮你找历史资料、科学设定，甚至当下的热门梗。
      description: '【考据与调研】拥有联网能力的搜索助手。它可以利用 Google Search 验证设定合理性、查找历史资料、补充科学背景，或寻找当下流行的网文热梗。', 
      tools: ['WebSearch'], 
      active: false, 
      // 英文指令：强调事实核查（Fact-checking）和利用工具（Use Tools）。
      content: `You are a Research Assistant and Trend Watcher with access to Google Search.
      
      YOUR GOAL: Ground the story in reality and enhance it with factual depth or current trends.
      
      INSTRUCTIONS:
      1. VERIFY: When the user proposes a setting (e.g., a specific historical era or scientific concept), use Google Search to verify its plausibility.
      2. ENRICH: Find specific details (clothing, food, laws, slang) from the web to make the world feel lived-in.
      3. CITATIONS: Always provide the source URLs for the information you find.
      
      Provide a "Grounding Report" listing the facts found and how they can be integrated into the story.`, 
      fileName: 'trend-watcher.md', 
      sourcePath: 'agents/support/trend-watcher.md', 
      fileSize: '2.8 KB' 
  },
  { 
      id: 'visual', 
      name: 'Visual Director (视觉导演)', 
      type: 'agent',
      tags: ['visuals', 'cinematography'],
      // 中文用途说明：擅长将文字转化为画面描述。当你需要生成插图或者制作动画时，它能把小说文字翻译成 Stable Diffusion 或 Midjourney 能听懂的提示词。
      description: '【画面转化】视觉转换专家。它擅长分析文本中的场景、光影和动作，将其提取为适合 AI 绘画（如 MJ/SD）或视频生成的详细提示词。', 
      tools: ['ImageGen', 'WebSearch'],
      active: true, 
      // 英文指令：强调镜头语言（Camera angles）、光照（Lighting）和构图（Composition）。
      content: `You are a Visual Director and Cinematographer. You see text as images.
      
      YOUR GOAL: Translate narrative text into vivid visual descriptions suitable for image/video generation models.
      
      FOCUS AREAS:
      1. COMPOSITION: Camera angles (wide shot, close-up, dutch angle), framing, and depth of field.
      2. LIGHTING: Atmospheric lighting (chiaroscuro, neon, natural, cinematic).
      3. SUBJECT: Specific details of the character's appearance and expression.
      4. STYLE: Define the art style (e.g., Cyberpunk anime, oil painting, photorealistic 8k).`,
      fileName: 'visual-director.md',
      sourcePath: 'agents/directors/visual-director.md',
      fileSize: '3.1 KB'
  },
];

// Helper for URL preview
const getUrlPreview = (baseUrl: string) => {
    if (!baseUrl) return '';
    let clean = baseUrl.trim();
    if (!clean.startsWith('http') && !clean.startsWith('/')) clean = `https://${clean}`;
    clean = clean.replace(/\/+$/, '');
    ['/chat/completions', '/embeddings', '/models', '/v1'].forEach(suffix => {
        if (clean.endsWith(suffix)) {
            clean = clean.substring(0, clean.length - suffix.length);
        }
    });
    clean = clean.replace(/\/+$/, '');
    return `${clean}/chat/completions`;
};

const StepConfiguration: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [config, setConfig] = useState<AgentConfig>(project.agentConfig);
  const [activeTab, setActiveTab] = useState<'basic' | 'plugins' | 'permissions'>('basic');
  
  // Plugin UI State
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  // Default to first plugin if available
  useEffect(() => {
      if (!selectedPluginId && config.plugins.length > 0) {
          setSelectedPluginId(config.plugins[0].id);
      }
  }, [config.plugins]);

  const activePlugin = config.plugins.find(p => p.id === selectedPluginId);

  // Test Connection State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Model Fetching State
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const updateConfig = (updates: Partial<AgentConfig>) => {
    setConfig({ ...config, ...updates });
  };

  const handlePluginUpdate = (id: string, updates: Partial<AgentPlugin>) => {
    const newPlugins = config.plugins.map(p => 
        p.id === id ? { ...p, ...updates } : p
    );
    updateConfig({ plugins: newPlugins });
  };

  const handleCreatePlugin = () => {
      const newId = `custom-${Date.now()}`;
      const newPlugin: AgentPlugin = {
          id: newId,
          name: 'New Agent',
          type: 'agent',
          tags: ['custom'],
          description: '点击此处编辑中文描述，说明该 Agent 的用途...',
          tools: ['Read'],
          active: true,
          content: 'You are a helpful assistant. (Write your English prompt here)',
          fileName: 'new-agent.md',
          sourcePath: 'agents/custom/new-agent.md',
          fileSize: '0 KB',
          isCustom: true
      };
      updateConfig({ plugins: [...config.plugins, newPlugin] });
      setSelectedPluginId(newId);
  };

  const handleDeletePlugin = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(confirm('Delete this agent?')) {
          const newPlugins = config.plugins.filter(p => p.id !== id);
          updateConfig({ plugins: newPlugins });
          if(selectedPluginId === id && newPlugins.length > 0) setSelectedPluginId(newPlugins[0].id);
      }
  };

  const toggleTool = (pluginId: string, tool: string) => {
      if(!activePlugin) return;
      const currentTools = activePlugin.tools;
      const newTools = currentTools.includes(tool) 
        ? currentTools.filter(t => t !== tool)
        : [...currentTools, tool];
      handlePluginUpdate(pluginId, { tools: newTools });
  };

  // --- API Handlers (Same as before) ---
  const handleTestConnection = async () => {
      if (!config.customApiKey || !config.customBaseUrl) {
          setTestStatus('error');
          setTestMessage('请填写 Base URL 和 API Key');
          return;
      }
      setTestStatus('testing');
      setTestMessage('正在连接...');
      const result = await testApiConnection(config.customBaseUrl, config.customApiKey, config.model);
      setTestStatus(result.success ? 'success' : 'error');
      setTestMessage(result.message);
      if (result.success) setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleFetchModels = async () => {
      if (!config.customApiKey || !config.customBaseUrl) {
          alert('请先填写 Base URL 和 API Key');
          return;
      }
      setFetchingModels(true);
      const models = await fetchAvailableModels(config.customBaseUrl, config.customApiKey);
      setFetchingModels(false);
      if (models.length > 0) {
          setFetchedModels(models);
          if (!config.model || config.model === 'deepseek-reasoner') updateConfig({ model: models[0] });
      } else {
          alert('无法获取模型列表，请确认 CORS 配置或使用 Proxy');
      }
  };

  const handleSaveAndNext = () => {
    setProject({ ...project, agentConfig: config });
    onNext();
  };

  // --- Render Constants ---
  const ALL_TOOLS = ['Read', 'Write', 'WebSearch', 'Grep', 'ImageGen', 'CodeInterpreter'];

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full animate-fade-in relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4 shrink-0">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20">
             <span className="text-black font-bold text-xl">★</span>
           </div>
           <div>
               <h2 className="text-2xl font-bold text-white tracking-tight">Agent Command Center</h2>
               <p className="text-xs text-slate-400 font-mono">v2.4.0-stable</p>
           </div>
        </div>
        <button 
           onClick={handleSaveAndNext}
           className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-semibold shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
        >
           DEPLOY PIPELINE &gt;
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-48 flex flex-col gap-2 text-sm shrink-0">
          {[
            { id: 'basic', label: '基础设置', icon: '⚙️' },
            { id: 'plugins', label: 'Agents & Plugins', icon: '🧩' },
            { id: 'permissions', label: '工具与权限', icon: '🛡️' }
          ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${
                    activeTab === tab.id 
                    ? 'bg-slate-700 text-white font-bold border-l-4 border-emerald-500 shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0B0C0F] rounded-xl border border-slate-800 shadow-2xl relative">
          
          {/* BASIC SETTINGS - Added flex-1 and min-h-0 to fix scrolling */}
          {activeTab === 'basic' && (
            <div className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar min-h-0">
               {/* Name */}
               <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-300 font-bold tracking-wide">AGENT IDENTITY</label>
                    <span className="text-xs text-slate-500 font-mono">ID: {config.name.toLowerCase().replace(/\s/g, '-')}</span>
                  </div>
                  <input 
                    value={config.name}
                    onChange={(e) => updateConfig({ name: e.target.value })}
                    className="w-full bg-[#181A1F] border border-slate-700 rounded-lg p-4 text-white text-lg focus:border-emerald-500 focus:outline-none transition-colors"
                  />
               </div>

               {/* API Provider Selection */}
               <div className="space-y-4">
                  <label className="text-slate-300 font-bold tracking-wide block">LLM BACKEND</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => updateConfig({ provider: 'google', model: 'gemini-2.5-flash' })}
                      className={`py-4 px-6 rounded-xl border-2 text-left transition-all ${config.provider === 'google' ? 'bg-indigo-900/20 border-indigo-500 text-indigo-300' : 'bg-[#181A1F] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                      <div className="font-bold mb-1">Google Gemini</div>
                      <div className="text-xs opacity-70">Native Support · Multimodal</div>
                    </button>
                    <button 
                      onClick={() => updateConfig({ provider: 'custom', model: 'deepseek-reasoner' })}
                      className={`py-4 px-6 rounded-xl border-2 text-left transition-all ${config.provider === 'custom' ? 'bg-indigo-900/20 border-indigo-500 text-indigo-300' : 'bg-[#181A1F] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                      <div className="font-bold mb-1">Custom / OpenAI</div>
                      <div className="text-xs opacity-70">DeepSeek · SiliconFlow · Local</div>
                    </button>
                  </div>

                  {config.provider === 'google' ? (
                     <div className="animate-fade-in p-4 bg-[#181A1F] rounded-lg border border-slate-700">
                        <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider">Model Selection</label>
                        <select 
                          value={config.model}
                          onChange={(e) => updateConfig({ model: e.target.value })}
                          className="w-full bg-[#0B0C0F] border border-slate-600 rounded p-3 text-white focus:border-emerald-500 focus:outline-none appearance-none"
                        >
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (Balanced)</option>
                          <option value="gemini-3-pro-preview">Gemini 3.0 Pro (High Intelligence)</option>
                        </select>
                     </div>
                  ) : (
                     <div className="space-y-4 animate-fade-in p-5 bg-[#181A1F] rounded-xl border border-slate-700">
                        {/* API Key */}
                        <div>
                           <label className="text-xs font-bold text-slate-400 block mb-2">API KEY</label>
                           <div className="relative group">
                                <input 
                                    type="password"
                                    value={config.customApiKey || ''}
                                    onChange={(e) => updateConfig({ customApiKey: e.target.value })}
                                    className="w-full bg-[#0B0C0F] border border-slate-700 rounded-lg py-3 px-4 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm"
                                    placeholder="sk-..."
                                />
                                <button 
                                    onClick={handleTestConnection}
                                    disabled={testStatus === 'testing'}
                                    className={`absolute right-2 top-2 bottom-2 px-3 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                                        testStatus === 'success' ? 'text-emerald-400 bg-emerald-900/30' :
                                        testStatus === 'error' ? 'text-red-400 bg-red-900/30' :
                                        'text-slate-400 bg-slate-800 hover:bg-slate-700'
                                    }`}
                                >
                                    {testStatus === 'testing' ? 'Connecting...' : testStatus === 'success' ? 'Connected' : 'Test'}
                                </button>
                           </div>
                           {testStatus === 'error' && <p className="text-xs text-red-500 mt-2 font-mono">{testMessage}</p>}
                        </div>

                        {/* API URL */}
                        <div>
                           <label className="text-xs font-bold text-slate-400 block mb-2">BASE URL</label>
                           <input 
                              placeholder="https://api.deepseek.com" 
                              value={config.customBaseUrl || ''}
                              onChange={(e) => updateConfig({ customBaseUrl: e.target.value })}
                              className="w-full bg-[#0B0C0F] border border-slate-700 rounded-lg py-3 px-4 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm"
                           />
                           {config.customBaseUrl && (
                               <div className="mt-1 flex flex-col gap-1">
                                   <div className="text-[10px] text-slate-500 font-mono">
                                       Preview: {getUrlPreview(config.customBaseUrl)}
                                   </div>
                                   <div className="text-[10px] text-amber-500/70">
                                       Tip: If you encounter CORS errors locally, try using the proxy: <code>/proxy/deepseek</code> or <code>/proxy/silicon</code>
                                   </div>
                               </div>
                           )}
                        </div>
                        
                        {/* Models */}
                        <div>
                           <div className="flex justify-between items-center mb-2">
                               <label className="text-xs font-bold text-slate-400">MODEL ID</label>
                               <button 
                                   onClick={handleFetchModels}
                                   disabled={fetchingModels}
                                   className="text-[10px] text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                               >
                                   {fetchingModels ? 'Fetching...' : 'Fetch List'}
                               </button>
                           </div>
                           <input 
                              value={config.model}
                              onChange={(e) => updateConfig({ model: e.target.value })}
                              placeholder="deepseek-reasoner"
                              className="w-full bg-[#0B0C0F] border border-slate-700 rounded-lg py-3 px-4 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm"
                           />
                        </div>
                     </div>
                  )}
               </div>

               {/* Work Directory */}
               <div className="space-y-2">
                  <label className="text-slate-300 font-bold tracking-wide">WORKSPACE</label>
                  <input 
                    value={config.workDir}
                    onChange={(e) => updateConfig({ workDir: e.target.value })}
                    className="w-full bg-[#181A1F] border border-slate-700 rounded-lg p-3 text-slate-400 font-mono text-sm"
                  />
               </div>
            </div>
          )}

          {/* PLUGINS */}
          {activeTab === 'plugins' && (
            <div className="flex h-full">
                {/* Left: Plugin List */}
                <div className="w-64 bg-[#0F1115] border-r border-slate-800 flex flex-col">
                    <div className="p-3 border-b border-slate-800 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Explorer</span>
                        <button onClick={handleCreatePlugin} className="text-slate-500 hover:text-white" title="New Agent">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {config.plugins.map(plugin => (
                            <div 
                                key={plugin.id}
                                onClick={() => setSelectedPluginId(plugin.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer group select-none transition-colors ${
                                    selectedPluginId === plugin.id 
                                    ? 'bg-[#2A2D35] text-white' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#181A1F]'
                                }`}
                            >
                                <span className={`text-lg ${plugin.active ? 'opacity-100' : 'opacity-30 grayscale'}`}>
                                    {plugin.type === 'agent' ? '🤖' : '🔧'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold truncate">{plugin.name}</div>
                                    <div className="text-[10px] text-slate-600 truncate">{plugin.fileName || 'untitled'}</div>
                                </div>
                                {selectedPluginId === plugin.id && (
                                     <button 
                                        onClick={(e) => handleDeletePlugin(plugin.id, e)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                                     >
                                         ×
                                     </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Plugin Editor */}
                <div className="flex-1 flex flex-col bg-[#0B0C0F] relative">
                    {activePlugin ? (
                        <>
                            {/* File Tab Header */}
                            <div className="h-10 bg-[#0B0C0F] border-b border-slate-800 flex items-center px-4 gap-2">
                                <span className="text-xs text-slate-400 font-mono">{activePlugin.fileName}</span>
                                {activePlugin.active ? (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                ) : (
                                    <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
                                    
                                    {/* Header Section */}
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <input 
                                                    value={activePlugin.name}
                                                    onChange={(e) => handlePluginUpdate(activePlugin.id, { name: e.target.value })}
                                                    className="text-3xl font-bold text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder-slate-600 w-full"
                                                />
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#bd10e0]/20 text-[#bd10e0] border border-[#bd10e0]/50">
                                                    {activePlugin.type}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {activePlugin.tags.map((tag, idx) => (
                                                    <span key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs border border-slate-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                                        {tag}
                                                    </span>
                                                ))}
                                                <button 
                                                    onClick={() => {
                                                        const newTag = prompt('Enter new tag:');
                                                        if(newTag) handlePluginUpdate(activePlugin.id, { tags: [...activePlugin.tags, newTag] });
                                                    }}
                                                    className="px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-600 text-xs border border-dashed border-slate-700 hover:text-white hover:border-slate-500"
                                                >
                                                    + tag
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Toggle Switch */}
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold uppercase ${activePlugin.active ? 'text-emerald-500' : 'text-slate-600'}`}>
                                                {activePlugin.active ? 'Active' : 'Disabled'}
                                            </span>
                                            <button 
                                                onClick={() => handlePluginUpdate(activePlugin.id, { active: !activePlugin.active })}
                                                className={`w-12 h-6 rounded-full relative transition-colors ${activePlugin.active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${activePlugin.active ? 'right-1' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-bold text-slate-300">Description (中文注释)</h4>
                                        <textarea 
                                            value={activePlugin.description}
                                            onChange={(e) => handlePluginUpdate(activePlugin.id, { description: e.target.value })}
                                            className="w-full bg-[#181A1F] text-slate-300 text-sm p-4 rounded-lg border border-slate-700 focus:border-slate-500 focus:outline-none resize-none h-24 leading-relaxed"
                                            placeholder="请用中文描述该 Agent 的用途..."
                                        />
                                    </div>

                                    {/* Tools */}
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-bold text-slate-300">Tools</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {ALL_TOOLS.map(tool => {
                                                const isActive = activePlugin.tools.includes(tool);
                                                return (
                                                    <button
                                                        key={tool}
                                                        onClick={() => toggleTool(activePlugin.id, tool)}
                                                        className={`px-3 py-1.5 rounded text-xs font-mono border transition-all ${
                                                            isActive 
                                                            ? 'bg-blue-900/30 border-blue-500 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                                                            : 'bg-[#181A1F] border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                                                        }`}
                                                    >
                                                        {tool}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Metadata Table */}
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-bold text-slate-300">Metadata</h4>
                                        <div className="bg-[#181A1F] rounded-lg border border-slate-700 p-4 font-mono text-xs space-y-2">
                                            <div className="flex justify-between border-b border-slate-700/50 pb-2">
                                                <span className="text-slate-500">File:</span>
                                                <span className="text-slate-300">{activePlugin.fileName}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-700/50 pb-2">
                                                <span className="text-slate-500">Size:</span>
                                                <span className="text-slate-300">{(activePlugin.content.length / 1024).toFixed(2)} KB</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Source:</span>
                                                <span className="text-slate-300 truncate max-w-[300px]">{activePlugin.sourcePath}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Editor */}
                                    <div className="space-y-2 flex-1 flex flex-col">
                                        <h4 className="text-sm font-bold text-slate-300">Content (English System Prompt)</h4>
                                        <div className="relative group flex-1">
                                            <div className="absolute top-0 left-0 w-full h-6 bg-[#1e1e1e] border border-slate-700 border-b-0 rounded-t-lg flex items-center px-2 gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            </div>
                                            <textarea 
                                                value={activePlugin.content}
                                                onChange={(e) => handlePluginUpdate(activePlugin.id, { content: e.target.value })}
                                                className="w-full min-h-[300px] bg-[#0F1115] text-slate-300 font-mono text-sm p-4 pt-8 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none resize-y leading-relaxed custom-scrollbar"
                                                spellCheck={false}
                                                placeholder="Use English for better LLM performance..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600">
                            <span className="text-4xl mb-4 opacity-50">⚡</span>
                            <p>Select an agent to configure</p>
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="flex-1 p-8 space-y-6 overflow-y-auto custom-scrollbar min-h-0">
                <div className="border border-emerald-500/50 bg-emerald-900/10 rounded-xl p-6">
                   <h3 className="font-bold text-white mb-2 flex justify-between items-center">
                     Auto-Approve File Operations <span className="bg-emerald-900 text-emerald-400 text-xs px-2 py-1 rounded border border-emerald-700">SELECTED</span>
                   </h3>
                   <p className="text-sm text-slate-400 mb-4">File edits and system operations by trusted agents will be executed automatically.</p>
                </div>
                <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-xl flex gap-4 items-start">
                    <span className="text-amber-500 text-2xl font-bold">!</span>
                    <div>
                        <h4 className="font-bold text-amber-500 text-sm">Security Warning</h4>
                        <p className="text-xs text-amber-400/70 mt-1">Only enable 'Write' tool for agents you trust. Sandbox mode is currently disabled in local preview.</p>
                    </div>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default StepConfiguration;
export { AVAILABLE_PLUGINS };