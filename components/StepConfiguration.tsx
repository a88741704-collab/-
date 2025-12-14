import React, { useState } from 'react';
import { ProjectState, AgentConfig, ProviderConfig, AgentPlugin } from '../types';
import { testApiConnection, fetchAvailableModels } from '../geminiService';

export const AVAILABLE_PLUGINS: AgentPlugin[] = [
    {
        id: 'critic',
        name: 'Mephisto (审判者)',
        type: 'agent',
        tags: ['书评', '逻辑审查'],
        description: '极度挑剔的文学恶魔，负责审查设定漏洞与行文逻辑。',
        tools: [],
        active: true,
        content: `## 🔴 Mephisto 审判程序
> **身份**: 极度挑剔的文学恶魔。
> **目标**: 摧毁平庸，逼迫作者进化。
> **风格**: 毒舌、直接、一针见血。`,
        fileName: 'mephisto_critic.js',
        sourcePath: 'internal/plugins',
        isCustom: false
    },
    {
        id: 'web_researcher',
        name: 'Web Researcher',
        type: 'tool',
        tags: ['WebSearch', 'FactCheck'],
        description: '联网搜索工具，用于考据资料与核实设定合理性。',
        tools: ['WebSearch'],
        active: false,
        content: 'You are a research assistant. Use Google Search to find accurate information.',
        fileName: 'google_search_tool.js',
        sourcePath: 'internal/plugins',
        isCustom: false
    }
];

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const StepConfiguration: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [config, setConfig] = useState<AgentConfig>(project.agentConfig);
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({});

  const updateConfig = (updates: Partial<AgentConfig>) => {
    setConfig({ ...config, ...updates });
  };

  const handleProviderToggle = (id: string, enabled: boolean) => {
      const newProviders = config.providers.map(p => p.id === id ? { ...p, enabled } : p);
      updateConfig({ providers: newProviders });
  };

  const handleProviderUpdate = (id: string, updates: Partial<ProviderConfig>) => {
      const newProviders = config.providers.map(p => p.id === id ? { ...p, ...updates } : p);
      updateConfig({ providers: newProviders });
  };

  const handleSetActiveProvider = (id: string) => {
      updateConfig({ activeProviderId: id });
  };

  const handleTest = async (provider: ProviderConfig) => {
      setTestStatus(prev => ({ ...prev, [provider.id]: 'testing' }));
      const result = await testApiConnection(provider.baseUrl, provider.apiKey, provider.activeModel);
      setTestStatus(prev => ({ ...prev, [provider.id]: result.success ? 'success' : 'error' }));
      setTimeout(() => setTestStatus(prev => ({ ...prev, [provider.id]: 'idle' })), 3000);
  };

  const handleFetchModels = async (provider: ProviderConfig) => {
      if (!provider.apiKey) return alert("请先填写 API Key");
      const models = await fetchAvailableModels(provider.baseUrl, provider.apiKey);
      if (models.length > 0) {
          handleProviderUpdate(provider.id, { models, activeModel: models[0] });
          alert(`获取成功，共 ${models.length} 个模型`);
      } else {
          alert("获取失败");
      }
  };

  const handleSave = () => {
      setProject({ ...project, agentConfig: config });
      onNext();
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col animate-fade-in p-6">
        <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-lg">⚙️</span>
                模型服务配置
            </h2>
            <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-emerald-900/20">
                保存并继续
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
            {config.providers.map(provider => (
                <div key={provider.id} className={`rounded-xl border transition-all ${provider.enabled ? 'bg-slate-800/50 border-emerald-500/30' : 'bg-slate-900 border-slate-800 opacity-75'}`}>
                    <div className="p-4 flex items-center justify-between border-b border-slate-700/50">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-8 rounded-full relative cursor-pointer transition-colors ${provider.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`} onClick={() => handleProviderToggle(provider.id, !provider.enabled)}>
                                <div className={`w-6 h-6 bg-white rounded-full absolute top-1 shadow-md transition-all ${provider.enabled ? 'right-1' : 'left-1'}`}></div>
                            </div>
                            <h3 className="text-lg font-bold text-white">{provider.name}</h3>
                            {provider.enabled && config.activeProviderId === provider.id && (
                                <span className="bg-emerald-900 text-emerald-400 text-xs px-2 py-1 rounded">当前使用</span>
                            )}
                        </div>
                        {provider.enabled && config.activeProviderId !== provider.id && (
                            <button onClick={() => handleSetActiveProvider(provider.id)} className="text-xs text-slate-400 hover:text-white underline">设为默认</button>
                        )}
                    </div>

                    {provider.enabled && (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold">API Key</label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        value={provider.apiKey}
                                        onChange={(e) => handleProviderUpdate(provider.id, { apiKey: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                        placeholder={provider.id === 'google' ? "Process Env or Input" : "sk-..."}
                                    />
                                    <button 
                                        onClick={() => handleTest(provider)}
                                        className={`absolute right-1 top-1 bottom-1 px-3 text-xs rounded transition-colors ${testStatus[provider.id] === 'success' ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                                    >
                                        {testStatus[provider.id] === 'testing' ? '...' : testStatus[provider.id] === 'success' ? 'OK' : 'Test'}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold">Base URL</label>
                                <input 
                                    value={provider.baseUrl}
                                    onChange={(e) => handleProviderUpdate(provider.id, { baseUrl: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 font-mono"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-xs text-slate-400 font-bold">Model</label>
                                    <button onClick={() => handleFetchModels(provider)} className="text-[10px] text-emerald-500 hover:underline">刷新模型列表</button>
                                </div>
                                <select 
                                    value={provider.activeModel}
                                    onChange={(e) => handleProviderUpdate(provider.id, { activeModel: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                >
                                    {provider.models.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};

export default StepConfiguration;