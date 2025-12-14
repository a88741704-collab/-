import React, { useState, useEffect } from 'react';
import { ProjectState, AgentConfig, AgentPlugin, RAGConfig } from '../types';
import { testApiConnection, fetchAvailableModels } from '../geminiService';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

// Initial Data consistent with the new UI style
const AVAILABLE_PLUGINS: AgentPlugin[] = [
  { 
      id: 'architect',
      name: 'story-architect',
      type: 'agent',
      tags: ['structure', 'world-building'],
      description: 'Master architect for narrative structures. Converts vague ideas into solid plot beats, world rules, and character arcs.',
      tools: ['Read', 'Write'],
      active: true,
      content: 'You are the Story Architect. Your goal is to turn the user\'s raw inspiration into a cohesive novel structure. Focus on Causality, Conflict, and Theme. When generating settings or outlines, ensure every element serves the core narrative.',
      fileName: 'story-architect.md',
      sourcePath: 'agents/specialists/story-architect.md',
      fileSize: '5.5 KB'
  },
  { 
      id: 'critic', 
      name: 'literary-critic', 
      type: 'agent',
      tags: ['critique', 'style'],
      description: 'Professional literary critic focusing on prose quality, pacing, and metaphorical resonance.', 
      tools: ['Read', 'Grep'],
      active: true, 
      content: 'Act as a harsh but fair literary critic. Focus on "Show, Don\'t Tell". Highlight clichés. Demand sensory details.',
      fileName: 'literary-critic.md',
      sourcePath: 'agents/critics/literary-critic.md',
      fileSize: '4.2 KB'
  },
  { 
      id: 'researcher', 
      name: 'trend-watcher', 
      type: 'agent', 
      tags: ['research', 'web'], 
      description: 'Research assistant capable of searching the web for real-world facts, historical details, or current tropes.', 
      tools: ['WebSearch'], 
      active: false, 
      content: 'You are a Research Assistant. Use Google Search to verify facts, find historical references, or look up scientific concepts to make the novel more realistic.', 
      fileName: 'trend-watcher.md', 
      sourcePath: 'agents/support/trend-watcher.md', 
      fileSize: '2.8 KB' 
  },
  { 
      id: 'ethics', 
      name: 'ai-ethics-advisor', 
      type: 'agent',
      tags: ['ai-specialists', 'safety'],
      description: 'AI ethics and responsible AI development specialist. Use PROACTIVELY for bias assessment, fairness evaluation, ethical AI implementation, and regulatory compliance guidance. Expert in AI safety and alignment.', 
      tools: ['Read', 'Write', 'WebSearch', 'Grep'],
      active: false, 
      content: 'You are an AI Ethics Advisor. Your mandate is to ensure all generated content adheres to safety guidelines, avoids stereotypes, and promotes inclusivity. Review all plot points for potential sensitivity.',
      fileName: 'ai-ethics-advisor.md',
      sourcePath: 'agents/ai-specialists/ai-ethics-advisor.md',
      fileSize: '6.86 KB'
  },
  { 
      id: 'visual', 
      name: 'visual-director', 
      type: 'agent',
      tags: ['visuals', 'adaptation'],
      description: 'Specialist in converting text to visual descriptions for comics and animation.', 
      tools: ['ImageGen', 'WebSearch'],
      active: true, 
      content: 'You are a Visual Director. When analyzing text, extract key visual elements, lighting, camera angles, and character expressions suitable for Stable Diffusion or Midjourney prompts.',
      fileName: 'visual-director.md',
      sourcePath: 'agents/directors/visual-director.md',
      fileSize: '3.1 KB'
  },
];

// Helper for URL preview
const getUrlPreview = (baseUrl: string) => {
    if (!baseUrl) return '';
    let clean = baseUrl.trim();
    if (!clean.startsWith('http')) clean = `https://${clean}`;
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
          name: 'new-agent-protocol',
          type: 'agent',
          tags: ['custom'],
          description: 'Describe the agent capabilities here...',
          tools: ['Read'],
          active: true,
          content: 'You are a helpful assistant.',
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
          alert('无法获取模型列表');
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
          
          {/* BASIC SETTINGS */}
          {activeTab === 'basic' && (
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
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
                               <div className="mt-1 text-[10px] text-slate-500 font-mono">
                                   Preview: {getUrlPreview(config.customBaseUrl)}
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

          {/* PLUGINS - REWRITTEN TO MATCH SCREENSHOT */}
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

                {/* Right: Plugin Editor (Visuals from Screenshot) */}
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
                                        <h4 className="text-sm font-bold text-slate-300">Description</h4>
                                        <textarea 
                                            value={activePlugin.description}
                                            onChange={(e) => handlePluginUpdate(activePlugin.id, { description: e.target.value })}
                                            className="w-full bg-[#181A1F] text-slate-300 text-sm p-4 rounded-lg border border-slate-700 focus:border-slate-500 focus:outline-none resize-none h-24 leading-relaxed"
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
                                        <h4 className="text-sm font-bold text-slate-300">Content (System Prompt)</h4>
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

          {/* PERMISSIONS (Simplified) */}
          {activeTab === 'permissions' && (
            <div className="p-8 space-y-6">
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