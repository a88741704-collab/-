import React, { useState } from 'react';
import { ProjectState, AgentConfig, AgentPlugin, RAGConfig } from '../types';
import { testApiConnection } from '../geminiService';
import RagSettingsModal from './RagSettingsModal';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const AVAILABLE_PLUGINS: AgentPlugin[] = [
  { id: 'ethics', name: 'ai-ethics-advisor', description: '负责任的AI开发专家，主动进行偏见评估。', active: false, systemPromptAddon: 'Act as an AI ethics advisor. Ensure content is inclusive and unbiased.' },
  { id: 'strategist', name: 'hackathon-ai-strategist', description: '黑客松战略专家，用于构思和项目规划。', active: false, systemPromptAddon: 'Focus on strategic plot planning and high-impact pacing.' },
  { id: 'critic', name: 'literary-critic', description: '严厉的文学评论家，专注于词汇和隐喻。', active: true, systemPromptAddon: 'Critique style focusing on vocabulary richness and metaphors.' },
  { id: 'visual', name: 'visual-director', description: '视觉导演，优化场景描述以适应漫改。', active: true, systemPromptAddon: 'Emphasize visual descriptions suitable for comic/anime adaptation.' },
];

const StepConfiguration: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [config, setConfig] = useState<AgentConfig>(project.agentConfig);
  const [activeTab, setActiveTab] = useState<'basic' | 'plugins' | 'permissions'>('basic');
  
  // Test Connection State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // RAG Modal State
  const [showRagModal, setShowRagModal] = useState(false);

  // New Plugin State
  const [showPluginForm, setShowPluginForm] = useState(false);
  const [newPlugin, setNewPlugin] = useState<Partial<AgentPlugin>>({ name: '', description: '', systemPromptAddon: '' });

  // Edit Plugin State
  const [editingPluginId, setEditingPluginId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{description: string, prompt: string}>({description: '', prompt: ''});

  const updateConfig = (updates: Partial<AgentConfig>) => {
    setConfig({ ...config, ...updates });
  };

  const togglePlugin = (id: string) => {
    const newPlugins = config.plugins.map(p => 
      p.id === id ? { ...p, active: !p.active } : p
    );
    updateConfig({ plugins: newPlugins });
  };

  const startEditing = (plugin: AgentPlugin) => {
    setEditingPluginId(plugin.id);
    setEditForm({ description: plugin.description, prompt: plugin.systemPromptAddon });
  };

  const savePluginEdit = () => {
    if(!editingPluginId) return;
    const updatedPlugins = config.plugins.map(p => {
        if (p.id === editingPluginId) {
            return { ...p, description: editForm.description, systemPromptAddon: editForm.prompt };
        }
        return p;
    });
    updateConfig({ plugins: updatedPlugins });
    setEditingPluginId(null);
  };

  const handleAddPlugin = () => {
      if (!newPlugin.name || !newPlugin.systemPromptAddon) return;
      const plugin: AgentPlugin = {
          id: `custom-${Date.now()}`,
          name: newPlugin.name,
          description: newPlugin.description || 'Custom user plugin',
          systemPromptAddon: newPlugin.systemPromptAddon,
          active: true,
          isCustom: true
      };
      updateConfig({ plugins: [...config.plugins, plugin] });
      setShowPluginForm(false);
      setNewPlugin({ name: '', description: '', systemPromptAddon: '' });
  };

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
      
      // Clear message after 3 seconds if success
      if (result.success) {
          setTimeout(() => setTestStatus('idle'), 3000);
      }
  };

  const handleRagSave = (newRagConfig: RAGConfig) => {
      updateConfig({ ragConfig: newRagConfig });
      setShowRagModal(false);
  };

  const handleSaveAndNext = () => {
    setProject({ ...project, agentConfig: config });
    onNext();
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-full animate-fade-in relative">
      {showRagModal && (
          <RagSettingsModal 
            config={config.ragConfig} 
            onSave={handleRagSave}
            onClose={() => setShowRagModal(false)}
          />
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
             <span className="text-black font-bold text-xl">★</span>
           </div>
           <h2 className="text-2xl font-bold text-white">Agent 配置</h2>
        </div>
        <button 
           onClick={handleSaveAndNext}
           className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-semibold shadow-lg shadow-emerald-500/20"
        >
           保存并启动流水线
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-48 flex flex-col gap-2 text-sm">
          <button 
            onClick={() => setActiveTab('basic')}
            className={`text-left px-4 py-3 rounded-lg ${activeTab === 'basic' ? 'bg-slate-700 text-white font-bold border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            基础设置
          </button>
          <button 
            onClick={() => setActiveTab('plugins')}
            className={`text-left px-4 py-3 rounded-lg ${activeTab === 'plugins' ? 'bg-slate-700 text-white font-bold border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            插件 ({config.plugins.filter(p => p.active).length})
          </button>
          <button 
            onClick={() => setActiveTab('permissions')}
            className={`text-left px-4 py-3 rounded-lg ${activeTab === 'permissions' ? 'bg-slate-700 text-white font-bold border-l-4 border-emerald-500' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            工具与权限
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-2">
          
          {/* BASIC SETTINGS */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
               {/* Name */}
               <div className="glass-panel p-6 rounded-xl border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-slate-300 font-semibold">Agent 名称</label>
                    <span className="text-amber-500">★</span>
                  </div>
                  <input 
                    value={config.name}
                    onChange={(e) => updateConfig({ name: e.target.value })}
                    className="w-full bg-black/30 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 focus:outline-none"
                  />
               </div>

               {/* API Provider Selection */}
               <div className="glass-panel p-6 rounded-xl border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-slate-300 font-semibold">API 服务提供商</label>
                  </div>
                  <div className="flex gap-4 mb-4">
                    <button 
                      onClick={() => updateConfig({ provider: 'google', model: 'gemini-2.5-flash' })}
                      className={`flex-1 py-3 px-4 rounded-lg border transition-all ${config.provider === 'google' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
                    >
                      Google Gemini (环境默认)
                    </button>
                    <button 
                      onClick={() => updateConfig({ provider: 'custom', model: 'deepseek-reasoner' })}
                      className={`flex-1 py-3 px-4 rounded-lg border transition-all ${config.provider === 'custom' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
                    >
                      自定义 / 第三方 (DeepSeek等)
                    </button>
                  </div>

                  {config.provider === 'google' ? (
                     <div>
                        <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider">选择模型</label>
                        <select 
                          value={config.model}
                          onChange={(e) => updateConfig({ model: e.target.value })}
                          className="w-full bg-black/30 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 focus:outline-none appearance-none"
                        >
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (快速/均衡)</option>
                          <option value="gemini-3-pro-preview">Gemini 3.0 Pro (深度推理/高质量)</option>
                        </select>
                     </div>
                  ) : (
                     <div className="space-y-4 animate-fade-in relative">
                        {/* API Key with Test Button */}
                        <div>
                           <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-slate-500 block uppercase tracking-wider">API Key (令牌)</label>
                                <div className="flex items-center gap-2">
                                     {testStatus === 'success' && <span className="text-emerald-500 text-xs animate-fade-in">✓ 连接成功</span>}
                                     {testStatus === 'error' && <span className="text-red-500 text-xs animate-fade-in">{testMessage}</span>}
                                     {testStatus === 'testing' && <span className="text-slate-400 text-xs animate-pulse">连接中...</span>}
                                </div>
                           </div>
                           <div className="relative">
                                <input 
                                    type="password"
                                    placeholder="sk-..." 
                                    value={config.customApiKey || ''}
                                    onChange={(e) => updateConfig({ customApiKey: e.target.value })}
                                    className={`w-full bg-black/30 border ${testStatus === 'error' ? 'border-red-500' : 'border-slate-600'} rounded p-3 pr-20 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm`}
                                />
                                <button 
                                    onClick={handleTestConnection}
                                    disabled={testStatus === 'testing'}
                                    className="absolute right-2 top-2 bottom-2 px-3 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white transition-colors border border-slate-600"
                                >
                                    检测
                                </button>
                           </div>
                        </div>

                        <div>
                           <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider">API Base URL (端点地址)</label>
                           <input 
                              placeholder="https://api.deepseek.com" 
                              value={config.customBaseUrl || ''}
                              onChange={(e) => updateConfig({ customBaseUrl: e.target.value })}
                              className="w-full bg-black/30 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm"
                           />
                        </div>
                        
                        <div>
                           <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider">Model ID</label>
                           <input 
                              placeholder="deepseek-reasoner" 
                              value={config.model}
                              onChange={(e) => updateConfig({ model: e.target.value })}
                              className="w-full bg-black/30 border border-slate-600 rounded p-3 text-white focus:border-emerald-500 focus:outline-none font-mono text-sm"
                           />
                        </div>
                     </div>
                  )}
               </div>

               {/* Work Directory & Knowledge Base */}
               <div className="glass-panel p-6 rounded-xl border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-slate-300 font-semibold">知识库 & 目录</label>
                    <span className="text-slate-500 text-xs">+</span>
                  </div>
                  
                  <div className="space-y-4">
                      {/* Local Dir */}
                      <div>
                          <label className="text-xs text-slate-500 mb-2 block uppercase tracking-wider">本地工作目录</label>
                          <div className="flex gap-2">
                             <input 
                                value={config.workDir}
                                onChange={(e) => updateConfig({ workDir: e.target.value })}
                                className="flex-1 bg-black/30 border border-slate-600 rounded p-3 text-slate-400 font-mono text-sm"
                             />
                             <button className="text-red-500 hover:text-red-400 text-sm px-2">删除</button>
                          </div>
                      </div>

                      {/* RAG Config */}
                      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-600/50">
                          <div>
                              <div className="flex items-center gap-2">
                                  <h4 className="text-white font-medium">知识库 (RAG)</h4>
                                  {config.ragConfig.enabled ? (
                                      <span className="bg-emerald-900/50 text-emerald-400 text-xs px-2 py-0.5 rounded border border-emerald-800">ON</span>
                                  ) : (
                                      <span className="bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded">OFF</span>
                                  )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                  {config.ragConfig.name} • {config.ragConfig.embeddingModel}
                              </p>
                          </div>
                          <div className="flex gap-3">
                              <button 
                                 onClick={() => updateConfig({ ragConfig: { ...config.ragConfig, enabled: !config.ragConfig.enabled } })}
                                 className={`w-10 h-5 rounded-full relative transition-colors ${config.ragConfig.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                              >
                                  <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${config.ragConfig.enabled ? 'right-1' : 'left-1'}`}></div>
                              </button>
                              <button 
                                 onClick={() => setShowRagModal(true)}
                                 className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors"
                              >
                                  设置
                              </button>
                          </div>
                      </div>
                  </div>
               </div>

               {/* Description */}
               <div className="glass-panel p-6 rounded-xl border border-slate-700">
                  <label className="text-slate-300 font-semibold mb-4 block">描述 (System Instruction)</label>
                  <textarea 
                    value={config.description}
                    onChange={(e) => updateConfig({ description: e.target.value })}
                    className="w-full h-32 bg-black/30 border border-slate-600 rounded p-3 text-slate-300 text-sm focus:border-emerald-500 focus:outline-none resize-none"
                    placeholder="描述Agent的角色和行为..."
                  />
               </div>
            </div>
          )}

          {/* PLUGINS */}
          {activeTab === 'plugins' && (
            <div className="space-y-4">
              <div className="flex gap-4 mb-4">
                 <input placeholder="搜索插件..." className="flex-1 bg-black/30 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white" />
                 <button 
                    onClick={() => setShowPluginForm(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
                 >
                    + 新增插件
                 </button>
              </div>
              
              {/* Add Plugin Form */}
              {showPluginForm && (
                  <div className="border border-indigo-500/50 bg-indigo-900/10 rounded-xl p-4 mb-6 animate-fade-in">
                      <h4 className="text-indigo-300 font-bold mb-3">编写自定义插件</h4>
                      <div className="space-y-3">
                          <div>
                              <label className="text-xs text-slate-400 block mb-1">插件名称</label>
                              <input 
                                value={newPlugin.name} 
                                onChange={(e) => setNewPlugin({...newPlugin, name: e.target.value})}
                                placeholder="例如: 情感分析专家" 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm"
                              />
                          </div>
                          <div>
                              <label className="text-xs text-slate-400 block mb-1">描述</label>
                              <input 
                                value={newPlugin.description} 
                                onChange={(e) => setNewPlugin({...newPlugin, description: e.target.value})}
                                placeholder="插件的功能简介..." 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm"
                              />
                          </div>
                          <div>
                              <label className="text-xs text-slate-400 block mb-1">System Prompt Addon (核心指令)</label>
                              <textarea 
                                value={newPlugin.systemPromptAddon} 
                                onChange={(e) => setNewPlugin({...newPlugin, systemPromptAddon: e.target.value})}
                                placeholder="Enter specific instructions to append to the system prompt..." 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm h-20"
                              />
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                              <button onClick={() => setShowPluginForm(false)} className="px-3 py-1 text-slate-400 hover:text-white text-sm">取消</button>
                              <button onClick={handleAddPlugin} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm">确认添加</button>
                          </div>
                      </div>
                  </div>
              )}

              <div className="flex gap-4 text-sm font-medium border-b border-slate-800 pb-2 mb-4">
                 <span className="text-emerald-500 border-b-2 border-emerald-500 pb-2">全部</span>
                 <span className="text-slate-500">代理</span>
                 <span className="text-slate-500">命令</span>
                 <span className="text-slate-500">技能</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 {config.plugins.map(plugin => (
                   <div key={plugin.id} className={`border rounded-xl p-4 bg-slate-800/30 transition-colors ${plugin.active ? 'border-emerald-500/50' : 'border-slate-700 hover:border-slate-500'} relative group`}>
                      {editingPluginId === plugin.id ? (
                          <div className="space-y-3 animate-fade-in relative z-10">
                              <div>
                                  <label className="text-xs text-emerald-400 block mb-1">Editing: {plugin.name}</label>
                              </div>
                              <div>
                                  <label className="text-xs text-slate-500 block">Description</label>
                                  <input 
                                      value={editForm.description}
                                      onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                                      className="w-full bg-black/50 border border-slate-600 rounded p-2 text-xs text-white"
                                  />
                              </div>
                              <div>
                                  <label className="text-xs text-slate-500 block">System Prompt Addon</label>
                                  <textarea 
                                      value={editForm.prompt}
                                      onChange={(e) => setEditForm({...editForm, prompt: e.target.value})}
                                      className="w-full h-24 bg-black/50 border border-slate-600 rounded p-2 text-xs text-white font-mono"
                                  />
                              </div>
                              <div className="flex gap-2 justify-end">
                                  <button onClick={() => setEditingPluginId(null)} className="px-3 py-1 bg-slate-700 rounded text-xs text-white">取消</button>
                                  <button onClick={savePluginEdit} className="px-3 py-1 bg-emerald-600 rounded text-xs text-white">保存修改</button>
                              </div>
                          </div>
                      ) : (
                          <>
                              <button 
                                  onClick={() => startEditing(plugin)}
                                  className="absolute top-2 right-2 text-slate-500 hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                  title="Edit Plugin"
                              >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              
                              <div className="flex justify-between mb-2">
                                 <h3 className="font-bold text-white">{plugin.name}</h3>
                                 <div className="flex gap-1 pr-6">
                                     {plugin.isCustom && <span className="bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5 rounded">Custom</span>}
                                     <span className="bg-blue-900 text-blue-300 text-xs px-2 py-0.5 rounded">Agent</span>
                                 </div>
                              </div>
                              <div className="flex gap-2 mb-3">
                                <span className="bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded">ai-specialists</span>
                              </div>
                              <p className="text-slate-400 text-xs mb-4 line-clamp-2" title={plugin.description}>{plugin.description}</p>
                              <p className="text-slate-600 text-[10px] mb-4 line-clamp-1 font-mono">{plugin.systemPromptAddon}</p>
                              <button 
                                onClick={() => togglePlugin(plugin.id)}
                                className={`w-full py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                                  plugin.active 
                                   ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' 
                                   : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                }`}
                              >
                                 {plugin.active ? (
                                   <>✓ 已安装</>
                                 ) : (
                                   <>↓ 安装</>
                                 )}
                              </button>
                          </>
                      )}
                   </div>
                 ))}
              </div>
            </div>
          )}

          {/* PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
                <div className="border border-emerald-500/50 bg-emerald-900/10 rounded-xl p-4">
                   <h3 className="font-bold text-white mb-2 flex justify-between">
                     自动接受文件编辑 <span className="bg-emerald-900 text-emerald-400 text-xs px-2 py-1 rounded">已选择</span>
                   </h3>
                   <p className="text-sm text-slate-400 mb-4">文件编辑和文件系统操作将自动通过审批。</p>
                   <p className="text-sm text-slate-500">预先授权受信任的文件系统工具，允许即时执行。</p>
                </div>

                <div className="border border-slate-700 bg-slate-800/30 rounded-xl p-4 opacity-70">
                   <h3 className="font-bold text-white mb-2">默认 (继续前询问)</h3>
                   <p className="text-sm text-slate-400">只读工具会自动预先授权，其它操作仍需权限。</p>
                </div>

                <div className="bg-amber-900/20 border border-amber-700/50 p-4 rounded-xl flex gap-3 items-start">
                    <span className="text-amber-500 text-xl font-bold">!</span>
                    <div>
                        <h4 className="font-bold text-amber-500 text-sm">预先授权的工具将在无人工审核时运行。</h4>
                        <p className="text-xs text-amber-400/70 mt-1">仅启用你信任的工具。模式默认值会自动标注。</p>
                    </div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-slate-700">
                    <label className="text-slate-300 font-semibold mb-2 block">会话轮次数上限</label>
                    <input className="w-full bg-black/30 border border-slate-600 rounded p-3 text-white" defaultValue="100" />
                    <p className="text-xs text-slate-500 mt-2">数值越高可自主运行越久；数值越低更易控制。</p>
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
