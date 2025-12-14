import React, { useState, useEffect } from 'react';
import { ProjectState, AgentConfig, AgentPlugin, RAGConfig } from '../types';
import { testApiConnection, fetchAvailableModels } from '../geminiService';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

// Initial Data consistent with the new UI style
// 全部汉化：将插件名称、标签、内容全部改为中文指令。
const AVAILABLE_PLUGINS: AgentPlugin[] = [
  { 
      id: 'architect',
      name: '故事架构师',
      type: 'agent',
      tags: ['结构', '剧情节拍'],
      description: '【架构专家】负责将模糊的灵感转化为坚实的小说大纲。关注因果逻辑、冲突升级和叙事节奏。它会确保你的故事结构完整，避免烂尾。',
      tools: ['Read', 'Write'],
      active: true,
      content: `你是一位故事架构师， narrative structure（叙事结构）和剧情工程的大师。
      
      【目标】：将用户模糊的想法转化为坚实、连贯的小说结构。
      
      【核心原则】：
      1. 因果律：每一个场景都必须是由前一个场景导致的。拒绝“然后”，追求“因此”或“但是”。
      2. 冲突：确保主角面临不断升级的阻碍。没有冲突就没有故事。
      3. 节奏：平衡动作场景与反思性的后续场景（Sequels）。
      
      【输出风格】：结构化的 Markdown。使用项目符号列出剧情节拍。关注宏观层面的故事弧光。`,
      fileName: 'story-architect.md',
      sourcePath: 'agents/specialists/story-architect.md',
      fileSize: '5.5 KB'
  },
  { 
      id: 'critic', 
      name: '毒舌评论家', 
      type: 'agent',
      tags: ['书评', '文笔', '风格'],
      description: '【文笔质检】专业的文学评论家，专注于具体的文字质量。它会无情地指出陈词滥调、逻辑漏洞和“流水账”问题，逼迫你提升描写水平。', 
      tools: ['Read', 'Grep'],
      active: true, 
      content: `你是一位严厉但公正的文学评论家。你阅读过所有的经典名著，对懒惰的写作零容忍。
      
      【目标】：提升用户的文笔质量和叙事逻辑。
      
      【批评标准】：
      1. 展示而非讲述 (Show, Don't Tell)：指出那些直接陈述情绪或特征，而不是通过行动展示的地方。
      2. 陈词滥调：识别并嘲讽被过度使用的套路或短语。
      3. 感官细节：要求包含视觉、听觉、嗅觉、触觉和味觉的描写。
      4. 逻辑：无情地指出人物行为的不一致或剧情漏洞。
      
      【语气】：专业、尖锐、略带傲慢但富有建设性。`,
      fileName: 'literary-critic.md',
      sourcePath: 'agents/critics/literary-critic.md',
      fileSize: '4.2 KB'
  },
  { 
      id: 'researcher', 
      name: '热点观察员', 
      type: 'agent', 
      tags: ['调研', '网络', '事实'], 
      description: '【考据与调研】拥有联网能力的搜索助手。它可以利用 Google Search 验证设定合理性、查找历史资料、补充科学背景，或寻找当下流行的网文热梗。', 
      tools: ['WebSearch'], 
      active: false, 
      content: `你是一位配备了 Google 搜索的研究助理和热点观察员。
      
      【目标】：将故事建立在现实基础之上，并用事实深度或当前趋势来丰富故事。
      
      【指令】：
      1. 验证：当用户提出一个设定（例如特定的历史时期或科学概念）时，使用搜索来验证其合理性。
      2. 丰富：从网络上寻找细节（服装、食物、法律、俚语），让世界观感觉真实。
      3. 引用：始终为你找到的信息提供来源 URL。
      
      提供一份“考据报告”，列出发现的事实以及如何将其整合到故事中。`, 
      fileName: 'trend-watcher.md', 
      sourcePath: 'agents/support/trend-watcher.md', 
      fileSize: '2.8 KB' 
  },
  { 
      id: 'visual', 
      name: '视觉导演', 
      type: 'agent',
      tags: ['视觉', '摄影'],
      description: '【画面转化】视觉转换专家。它擅长分析文本中的场景、光影和动作，将其提取为适合 AI 绘画（如 MJ/SD）或视频生成的详细提示词。', 
      tools: ['ImageGen', 'WebSearch'],
      active: true, 
      content: `你是一位视觉导演和电影摄影师。在你眼中，文字就是图像。
      
      【目标】：将叙事文本转化为适合图像/视频生成模型的生动视觉描述。
      
      【关注领域】：
      1. 构图：摄像机角度（广角、特写、荷兰角）、取景和景深。
      2. 灯光：氛围照明（明暗对照、霓虹灯、自然光、电影感）。
      3. 主体：角色外貌和表情的具体细节。
      4. 风格：定义艺术风格（例如：赛博朋克动漫、油画、8k逼真照片）。`,
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
          name: '新 Agent',
          type: 'agent',
          tags: ['自定义'],
          description: '点击此处编辑中文描述，说明该 Agent 的用途...',
          tools: ['Read'],
          active: true,
          content: '你是一个有用的助手。',
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
      if(confirm('确定要删除这个 Agent 吗？')) {
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
          alert(`成功连接！共获取 ${models.length} 个模型。\n已自动为您选择了第一个可用模型，您也可以点击下方下拉菜单手动选择。`);
      } else {
          alert('无法获取模型列表，请确认：\n1. Base URL 是否正确 (如 https://api.deepseek.com)\n2. 是否存在 CORS 跨域问题 (可尝试使用代理)\n3. API Key 是否有效');
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
               <h2 className="text-2xl font-bold text-white tracking-tight">Agent 指挥中心</h2>
               <p className="text-xs text-slate-400 font-mono">v2.4.0-stable</p>
           </div>
        </div>
        <button 
           onClick={handleSaveAndNext}
           className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-semibold shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
        >
           部署流水线 &gt;
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-48 flex flex-col gap-2 text-sm shrink-0">
          {[
            { id: 'basic', label: '基础设置', icon: '⚙️' },
            { id: 'plugins', label: '插件管理', icon: '🧩' },
            { id: 'permissions', label: '权限设置', icon: '🛡️' }
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
                    <label className="text-slate-300 font-bold tracking-wide">Agent 身份标识</label>
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
                  <label className="text-slate-300 font-bold tracking-wide block">大模型后端服务 (LLM Backend)</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => updateConfig({ provider: 'google', model: 'gemini-2.5-flash' })}
                      className={`py-4 px-6 rounded-xl border-2 text-left transition-all ${config.provider === 'google' ? 'bg-indigo-900/20 border-indigo-500 text-indigo-300' : 'bg-[#181A1F] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                      <div className="font-bold mb-1">Google Gemini</div>
                      <div className="text-xs opacity-70">原生支持 · 多模态</div>
                    </button>
                    <button 
                      onClick={() => updateConfig({ provider: 'custom', model: 'deepseek-reasoner' })}
                      className={`py-4 px-6 rounded-xl border-2 text-left transition-all ${config.provider === 'custom' ? 'bg-indigo-900/20 border-indigo-500 text-indigo-300' : 'bg-[#181A1F] border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                      <div className="font-bold mb-1">自定义 / OpenAI 兼容</div>
                      <div className="text-xs opacity-70">DeepSeek · SiliconFlow · 本地模型</div>
                    </button>
                  </div>

                  {config.provider === 'google' ? (
                     <div className="animate-fade-in p-4 bg-[#181A1F] rounded-lg border border-slate-700">
                        <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider">模型选择</label>
                        <select 
                          value={config.model}
                          onChange={(e) => updateConfig({ model: e.target.value })}
                          className="w-full bg-[#0B0C0F] border border-slate-600 rounded p-3 text-white focus:border-emerald-500 focus:outline-none appearance-none"
                        >
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (均衡)</option>
                          <option value="gemini-3-pro-preview">Gemini 3.0 Pro (高智商)</option>
                        </select>
                     </div>
                  ) : (
                     <div className="space-y-4 animate-fade-in p-5 bg-[#181A1F] rounded-xl border border-slate-700">
                        {/* API Key */}
                        <div>
                           <label className="text-xs font-bold text-slate-400 block mb-2">API 密钥 (API KEY)</label>
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
                                    {testStatus === 'testing' ? '连接中...' : testStatus === 'success' ? '连接成功' : '测试'}
                                </button>
                           </div>
                           {testStatus === 'error' && <p className="text-xs text-red-500 mt-2 font-mono">{testMessage}</p>}
                        </div>

                        {/* API URL */}
                        <div>
                           <label className="text-xs font-bold text-slate-400 block mb-2">接口地址 (BASE URL)</label>
                           <input 
                              placeholder="https://api.deepseek.com" 
                              value={config.customBaseUrl || ''}
                              onChange={(e) => updateConfig({ customBaseUrl: e.target.value })}
                              className="w-full bg-[#0B0C0F] border border-slate-700 rounded-lg py-3 px-4 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm"
                           />
                           {config.customBaseUrl && (
                               <div className="mt-1 flex flex-col gap-1">
                                   <div className="text-[10px] text-slate-500 font-mono">
                                       预览: {getUrlPreview(config.customBaseUrl)}
                                   </div>
                                   <div className="text-[10px] text-amber-500/70">
                                       提示: 如果遇到 CORS 跨域错误，请尝试使用代理地址：<code>/proxy/deepseek</code> 或 <code>/proxy/silicon</code>
                                   </div>
                               </div>
                           )}
                        </div>
                        
                        {/* Models */}
                        <div>
                           <div className="flex justify-between items-center mb-2">
                               <label className="text-xs font-bold text-slate-400">模型 ID (MODEL ID)</label>
                               <button 
                                   onClick={handleFetchModels}
                                   disabled={fetchingModels}
                                   className="text-[10px] text-emerald-500 hover:text-emerald-400 flex items-center gap-1 border border-emerald-500/30 px-2 py-0.5 rounded hover:bg-emerald-500/10 transition-colors"
                               >
                                   {fetchingModels ? '获取中...' : '📥 拉取模型列表'}
                               </button>
                           </div>
                           {/* Model Select Dropdown if models fetched */}
                           <div className="relative">
                               <input 
                                  value={config.model}
                                  onChange={(e) => updateConfig({ model: e.target.value })}
                                  placeholder="deepseek-reasoner"
                                  className="w-full bg-[#0B0C0F] border border-slate-700 rounded-lg py-3 px-4 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm"
                                  list="fetched-models-list"
                               />
                               <datalist id="fetched-models-list">
                                   {fetchedModels.map(m => <option key={m} value={m} />)}
                               </datalist>
                           </div>
                           
                           {fetchedModels.length > 0 && (
                               <div className="mt-2 text-[10px] text-slate-500 flex flex-wrap gap-2">
                                   <span>最近获取:</span>
                                   {fetchedModels.slice(0, 3).map(m => (
                                       <span 
                                         key={m} 
                                         onClick={() => updateConfig({ model: m })}
                                         className="cursor-pointer text-indigo-400 hover:text-white underline"
                                       >
                                           {m}
                                       </span>
                                   ))}
                               </div>
                           )}
                        </div>
                     </div>
                  )}
               </div>

               {/* Work Directory */}
               <div className="space-y-2">
                  <label className="text-slate-300 font-bold tracking-wide">工作区路径</label>
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
                        <span className="text-xs font-bold text-slate-400 uppercase">插件列表</span>
                        <button onClick={handleCreatePlugin} className="text-slate-500 hover:text-white" title="新建 Agent">
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
                                                        const newTag = prompt('输入新标签:');
                                                        if(newTag) handlePluginUpdate(activePlugin.id, { tags: [...activePlugin.tags, newTag] });
                                                    }}
                                                    className="px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-600 text-xs border border-dashed border-slate-700 hover:text-white hover:border-slate-500"
                                                >
                                                    + 标签
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Toggle Switch */}
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold uppercase ${activePlugin.active ? 'text-emerald-500' : 'text-slate-600'}`}>
                                                {activePlugin.active ? '已启用' : '已禁用'}
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
                                        <h4 className="text-sm font-bold text-slate-300">功能描述</h4>
                                        <textarea 
                                            value={activePlugin.description}
                                            onChange={(e) => handlePluginUpdate(activePlugin.id, { description: e.target.value })}
                                            className="w-full bg-[#181A1F] text-slate-300 text-sm p-4 rounded-lg border border-slate-700 focus:border-slate-500 focus:outline-none resize-none h-24 leading-relaxed"
                                            placeholder="请描述该 Agent 的用途..."
                                        />
                                    </div>

                                    {/* Tools */}
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-bold text-slate-300">可用工具 (Tools)</h4>
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
                                        <h4 className="text-sm font-bold text-slate-300">元数据 (Metadata)</h4>
                                        <div className="bg-[#181A1F] rounded-lg border border-slate-700 p-4 font-mono text-xs space-y-2">
                                            <div className="flex justify-between border-b border-slate-700/50 pb-2">
                                                <span className="text-slate-500">文件名:</span>
                                                <span className="text-slate-300">{activePlugin.fileName}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-700/50 pb-2">
                                                <span className="text-slate-500">大小:</span>
                                                <span className="text-slate-300">{(activePlugin.content.length / 1024).toFixed(2)} KB</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">来源路径:</span>
                                                <span className="text-slate-300 truncate max-w-[300px]">{activePlugin.sourcePath}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Editor */}
                                    <div className="space-y-2 flex-1 flex flex-col">
                                        <h4 className="text-sm font-bold text-slate-300">系统提示词 (System Prompt)</h4>
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
                                                placeholder="在此输入中文或英文 Prompt..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600">
                            <span className="text-4xl mb-4 opacity-50">⚡</span>
                            <p>请选择一个 Agent 进行配置</p>
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
                     自动批准文件操作 <span className="bg-emerald-900 text-emerald-400 text-xs px-2 py-1 rounded border border-emerald-700">已选中</span>
                   </h3>
                   <p className="text-sm text-slate-400 mb-4">受信任的 Agent 进行的文件编辑和系统操作将自动执行，无需人工确认。</p>
                </div>
                <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-xl flex gap-4 items-start">
                    <span className="text-amber-500 text-2xl font-bold">!</span>
                    <div>
                        <h4 className="font-bold text-amber-500 text-sm">安全警告</h4>
                        <p className="text-xs text-amber-400/70 mt-1">请仅为您信任的 Agent 启用“Write（写入）”工具。当前本地预览模式下，沙盒模式已禁用。</p>
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