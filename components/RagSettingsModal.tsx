import React, { useState } from 'react';
import { RAGConfig } from '../types';
import { testApiConnection, fetchAvailableModels } from '../geminiService';

interface Props {
  config: RAGConfig;
  onSave: (config: RAGConfig) => void;
  onClose: () => void;
}

const RagSettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const [localConfig, setLocalConfig] = useState<RAGConfig>(config);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Test Connection State for RAG
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Fetched models for dropdown
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const handleChange = (updates: Partial<RAGConfig>) => {
    setLocalConfig({ ...localConfig, ...updates });
  };

  const handleTestConnection = async () => {
    if (!localConfig.ragApiKey || !localConfig.ragBaseUrl) {
        setTestStatus('error');
        setTestMessage('请填写 Base URL 和 API Key');
        return;
    }
    setTestStatus('testing');
    setTestMessage('正在连接...');
    
    // We use the embedding model as the model ID to check, though testApiConnection does a chat completion.
    // Some endpoints might reject chat completions for embedding models.
    // If it fails with a specific model error, it still proves connectivity.
    // Ideally we would use a specific embedding test, but reusing the existing helper for now.
    const result = await testApiConnection(localConfig.ragBaseUrl, localConfig.ragApiKey, localConfig.embeddingModel);
    
    setTestStatus(result.success ? 'success' : 'error');
    setTestMessage(result.message);
    
    if (result.success) {
        setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  const handleFetchModels = async () => {
    if (!localConfig.ragApiKey || !localConfig.ragBaseUrl) {
        alert('请先填写 Base URL 和 API Key');
        return;
    }
    setFetchingModels(true);
    const models = await fetchAvailableModels(localConfig.ragBaseUrl, localConfig.ragApiKey);
    setFetchingModels(false);
    
    if (models.length > 0) {
        setFetchedModels(models);
        // Maybe auto-set if empty? For now just populate list.
    } else {
        alert('无法获取模型列表，请检查配置或手动输入');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121212] border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h3 className="text-xl font-bold text-white">知识库设置</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm custom-scrollbar">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-slate-300 font-semibold">知识库名称</label>
            <input 
              value={localConfig.name}
              onChange={(e) => handleChange({ name: e.target.value })}
              className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Vector Store Configuration */}
          <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-4">
              <h4 className="text-white font-bold flex items-center gap-2">
                  🗄️ 向量数据库 (Vector Store)
              </h4>
              <div className="space-y-2">
                  <label className="text-slate-300 text-xs uppercase tracking-wide">存储类型</label>
                  <select 
                      value={localConfig.vectorStore}
                      onChange={(e) => handleChange({ vectorStore: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none"
                  >
                      <option value="local">本地存储 (IndexedDB/Memory) - 推荐个人使用</option>
                      <option value="chroma">ChromaDB (Remote/Local Server)</option>
                      <option value="qdrant">Qdrant Cloud / Docker</option>
                  </select>
              </div>

              {localConfig.vectorStore !== 'local' && (
                  <div className="grid grid-cols-1 gap-4 animate-fade-in">
                      <div className="space-y-2">
                          <label className="text-slate-300 text-xs uppercase tracking-wide">数据库地址 (URL)</label>
                          <input 
                             placeholder={localConfig.vectorStore === 'chroma' ? "http://localhost:8000" : "https://xyz-example.qdrant.tech"}
                             value={localConfig.vectorStoreUrl || ''}
                             onChange={(e) => handleChange({ vectorStoreUrl: e.target.value })}
                             className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono text-xs"
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-slate-300 text-xs uppercase tracking-wide">API Key (Optional)</label>
                          <input 
                             type="password"
                             value={localConfig.vectorStoreApiKey || ''}
                             onChange={(e) => handleChange({ vectorStoreApiKey: e.target.value })}
                             className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono text-xs"
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-slate-300 text-xs uppercase tracking-wide">集合名称 (Collection)</label>
                          <input 
                             value={localConfig.vectorStoreCollection || ''}
                             onChange={(e) => handleChange({ vectorStoreCollection: e.target.value })}
                             placeholder="novel_knowledge_base"
                             className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono text-xs"
                          />
                      </div>
                  </div>
              )}
          </div>

          <div className="grid grid-cols-2 gap-4">
              {/* Embedding Model */}
              <div className="space-y-2">
                 <div className="flex justify-between">
                    <label className="text-slate-300 font-semibold flex items-center gap-1">
                       嵌入模型
                    </label>
                 </div>
                 <div className="relative">
                     {localConfig.useSeparateApi ? (
                         <>
                            <input 
                                list="rag-models" 
                                value={localConfig.embeddingModel}
                                onChange={(e) => handleChange({ embeddingModel: e.target.value })}
                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none text-xs"
                                placeholder="输入或选择模型"
                            />
                            <datalist id="rag-models">
                                {fetchedModels.map(m => <option key={m} value={m} />)}
                            </datalist>
                         </>
                     ) : (
                        <select 
                            value={localConfig.embeddingModel}
                            onChange={(e) => handleChange({ embeddingModel: e.target.value })}
                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none appearance-none text-xs"
                        >
                            <option value="BAAI/bge-large-zh-v1.5">BAAI/bge-large-zh-v1.5</option>
                            <option value="BAAI/bge-m3">BAAI/bge-m3</option>
                            <option value="text-embedding-004">text-embedding-004 (Google)</option>
                            <option value="custom">Custom</option>
                        </select>
                     )}
                 </div>
              </div>

              {/* Embedding Dimension */}
              <div className="space-y-2">
                <label className="text-slate-300 font-semibold flex items-center gap-1">
                   嵌入维度
                </label>
                <div className="flex items-center gap-2">
                   <input 
                     type="number"
                     value={localConfig.embeddingDimension}
                     onChange={(e) => handleChange({ embeddingDimension: Number(e.target.value) })}
                     className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none text-xs"
                   />
                </div>
              </div>
          </div>

          {/* Top K Slider */}
          <div className="space-y-4">
             <div className="flex justify-between items-center">
                 <label className="text-slate-300 font-semibold flex items-center gap-1">
                    检索数量 (Top K)
                 </label>
                 <span className="text-emerald-500 font-mono">{localConfig.topK}</span>
             </div>
             <input 
                type="range" 
                min="1" max="50" 
                value={localConfig.topK}
                onChange={(e) => handleChange({ topK: Number(e.target.value) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
             />
          </div>

          {/* Advanced Settings Toggle */}
          <div className="border-t border-slate-700 pt-4">
             <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-slate-300 hover:text-white font-semibold transition-colors"
             >
                <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>›</span>
                高级 / API 设置
             </button>

             {showAdvanced && (
                <div className="mt-4 space-y-6 animate-fade-in pl-4 border-l-2 border-slate-800">
                   
                   {/* Rerank Model */}
                   <div className="space-y-2">
                        <label className="text-slate-300 font-semibold flex items-center gap-1">
                            重排模型 (Rerank)
                        </label>
                        {localConfig.useSeparateApi ? (
                            <>
                                <input 
                                    list="rag-models-rerank" 
                                    value={localConfig.rerankModel || ''}
                                    onChange={(e) => handleChange({ rerankModel: e.target.value })}
                                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none text-xs"
                                    placeholder="输入或选择模型 (可选)"
                                />
                                <datalist id="rag-models-rerank">
                                    {fetchedModels.map(m => <option key={m} value={m} />)}
                                </datalist>
                            </>
                        ) : (
                            <select 
                                value={localConfig.rerankModel || ''}
                                onChange={(e) => handleChange({ rerankModel: e.target.value })}
                                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white focus:border-emerald-500 focus:outline-none text-xs"
                            >
                                <option value="">Disabled (None)</option>
                                <option value="BAAI/bge-reranker-v2-m3">BAAI/bge-reranker-v2-m3</option>
                                <option value="BAAI/bge-reranker-large">BAAI/bge-reranker-large</option>
                            </select>
                        )}
                   </div>

                   {/* Chunking */}
                   <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-slate-300 font-semibold">分段 (Chunk Size)</label>
                          <input 
                            type="number" 
                            placeholder="512"
                            value={localConfig.chunkSize || ''}
                            onChange={(e) => handleChange({ chunkSize: Number(e.target.value) })}
                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white text-xs"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-slate-300 font-semibold">重叠 (Overlap)</label>
                          <input 
                            type="number" 
                            placeholder="64"
                            value={localConfig.chunkOverlap || ''}
                            onChange={(e) => handleChange({ chunkOverlap: Number(e.target.value) })}
                            className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white text-xs"
                          />
                       </div>
                   </div>

                   {/* Score Threshold */}
                   <div className="space-y-2">
                      <label className="text-slate-300 font-semibold">匹配阈值 (Threshold)</label>
                      <input 
                         type="number" 
                         step="0.1" min="0" max="1"
                         value={localConfig.scoreThreshold || 0.7}
                         onChange={(e) => handleChange({ scoreThreshold: Number(e.target.value) })}
                         className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white text-xs"
                      />
                   </div>
                   
                   {/* Separate API Config */}
                   <div className="pt-4 border-t border-slate-800">
                        <div className="flex items-center gap-2 mb-4">
                            <input 
                                type="checkbox" 
                                id="separateApi"
                                checked={localConfig.useSeparateApi}
                                onChange={(e) => handleChange({ useSeparateApi: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                            />
                            <label htmlFor="separateApi" className="text-slate-300 font-semibold cursor-pointer">
                                为嵌入/重排使用独立 API (如 SiliconFlow)
                            </label>
                        </div>
                        
                        {localConfig.useSeparateApi && (
                            <div className="space-y-4 pl-6 border-l border-slate-700">
                                <div>
                                    <label className="text-xs text-slate-500 block mb-1">API Base URL</label>
                                    <input 
                                        value={localConfig.ragBaseUrl || ''}
                                        onChange={(e) => handleChange({ ragBaseUrl: e.target.value })}
                                        placeholder="https://api.siliconflow.cn/v1"
                                        className="w-full bg-slate-800/50 border border-slate-600 rounded p-2 text-white text-xs font-mono"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs text-slate-500 block">API Key</label>
                                        <div className="flex items-center gap-2">
                                            {testStatus === 'success' && <span className="text-emerald-500 text-xs">✓ 成功</span>}
                                            {testStatus === 'error' && <span className="text-red-500 text-xs">{testMessage}</span>}
                                            {testStatus === 'testing' && <span className="text-slate-400 text-xs animate-pulse">连接中...</span>}
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="password"
                                            value={localConfig.ragApiKey || ''}
                                            onChange={(e) => handleChange({ ragApiKey: e.target.value })}
                                            placeholder="sk-..."
                                            className={`w-full bg-slate-800/50 border ${testStatus === 'error' ? 'border-red-500' : 'border-slate-600'} rounded p-2 pr-16 text-white text-xs font-mono`}
                                        />
                                        <button 
                                            onClick={handleTestConnection}
                                            disabled={testStatus === 'testing'}
                                            className="absolute right-1 top-1 bottom-1 px-2 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white transition-colors"
                                        >
                                            测试
                                        </button>
                                    </div>
                                    <div className="mt-2 text-right">
                                        <button 
                                            onClick={handleFetchModels}
                                            disabled={fetchingModels}
                                            className="text-[10px] text-emerald-500 hover:text-emerald-400 underline"
                                        >
                                            {fetchingModels ? '获取中...' : '从 API 获取模型列表'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                   </div>
                </div>
             )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-[#181818]">
           <button 
             onClick={onClose}
             className="px-6 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
           >
             取消
           </button>
           <button 
             onClick={() => onSave(localConfig)}
             className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/20 transition-all"
           >
             保存
           </button>
        </div>
      </div>
    </div>
  );
};

export default RagSettingsModal;
