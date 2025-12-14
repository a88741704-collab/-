
import React, { useState } from 'react';
import { RAGConfig } from '../types';

interface Props {
  config: RAGConfig;
  onSave: (config: RAGConfig) => void;
  onClose: () => void;
}

const RagSettingsModal: React.FC<Props> = ({ config, onSave, onClose }) => {
  const [localConfig, setLocalConfig] = useState<RAGConfig>(config);

  const handleChange = (updates: Partial<RAGConfig>) => {
    setLocalConfig({ ...localConfig, ...updates });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121212] border border-slate-700 w-full max-w-lg rounded-xl shadow-2xl flex flex-col p-6 space-y-4">
          <h3 className="text-xl font-bold text-white">知识库设置</h3>
          
          <div className="space-y-2">
            <label className="text-slate-300">名称</label>
            <input value={localConfig.name} onChange={e => handleChange({name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
          </div>

          <div className="space-y-2">
            <label className="text-slate-300">分段策略 (Chunking Strategy)</label>
            <select 
                value={localConfig.chunkingStrategy || 'semantic'}
                onChange={(e) => handleChange({ chunkingStrategy: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
            >
                <option value="semantic">语义分段 (默认)</option>
                <option value="markdown">按标题分段 (Markdown Header)</option>
                <option value="fixed">固定字符 (Fixed Size)</option>
            </select>
          </div>

          <div className="space-y-2">
             <label className="text-slate-300">Top K</label>
             <input type="number" value={localConfig.topK} onChange={e => handleChange({topK: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
             <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
             <button onClick={() => onSave(localConfig)} className="px-4 py-2 bg-emerald-600 text-white rounded">保存</button>
          </div>
      </div>
    </div>
  );
};
export default RagSettingsModal;
