import React, { useState } from 'react';
import { generateSettings } from '../geminiService';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const StepIdea: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [loading, setLoading] = useState(false);
  const [idea, setIdea] = useState(project.coreIdea || '');

  const handleGenerate = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setProject({ ...project, agentStatus: 'generating', agentTask: '正在基于灵感构建世界观与核心设定...' });
    try {
      const settings = await generateSettings(idea, project.agentConfig);
      setProject({ ...project, coreIdea: idea, settings, agentStatus: 'idle', agentTask: '设定生成完毕' });
      onNext();
    } catch (error) {
      console.error(error);
      setProject({ ...project, agentStatus: 'error', agentTask: '生成设定时发生错误' });
      alert('生成设定失败，请检查 API Key 或配置。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-indigo-400">步骤 1: 灵感构思</h2>
        <p className="text-slate-400">输入你最初的灵感，AI Agent 将为你扩展出一个完整的世界设定。</p>
      </div>

      <div className="glass-panel p-6 rounded-xl shadow-lg">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          你的灵感 / 核心点子
        </label>
        <textarea
          className="w-full h-40 bg-slate-800 border border-slate-700 rounded-lg p-4 text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
          placeholder="例如：一个赛博朋克世界，人们将记忆作为货币交易，但主角却患有失忆症..."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={loading || !idea}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              loading || !idea
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-indigo-500/20'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                正在构建世界...
              </span>
            ) : (
              '生成设定'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StepIdea;