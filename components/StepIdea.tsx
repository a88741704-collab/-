import React, { useState } from 'react';
import { generateSettings, runMephistoCritique } from '../geminiService';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const StepIdea: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [loading, setLoading] = useState(false);
  const [critiquing, setCritiquing] = useState(false);
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

  const handleCritique = async () => {
      if (!idea.trim()) return;
      setCritiquing(true);
      setProject({ ...project, agentStatus: 'thinking', agentTask: 'Mephisto 正在审视你的灵感...' });
      try {
          const result = await runMephistoCritique(idea, 'Idea', project.agentConfig);
          setProject({ ...project, ideaCritique: result, agentStatus: 'idle', agentTask: '审判完毕' });
      } catch (e) {
          setProject({ ...project, agentStatus: 'error', agentTask: '审判失败' });
      } finally {
          setCritiquing(false);
      }
  };

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto space-y-6 animate-fade-in overflow-hidden">
      <div className="text-center space-y-2 flex-shrink-0">
        <h2 className="text-3xl font-bold text-indigo-400">步骤 1: 灵感构思</h2>
        <p className="text-slate-400">输入你最初的灵感，AI Agent 将为你扩展出一个完整的世界设定。</p>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
          {/* Input Panel */}
          <div className="glass-panel p-6 rounded-xl shadow-lg flex flex-col">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              你的灵感 / 核心点子
            </label>
            <textarea
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-4 text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none mb-4"
              placeholder="例如：一个赛博朋克世界，人们将记忆作为货币交易，但主角却患有失忆症..."
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
            <div className="flex justify-between items-center">
               <button
                  onClick={handleCritique}
                  disabled={critiquing || !idea}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border ${critiquing || !idea ? 'border-slate-700 text-slate-500' : 'border-red-800 bg-red-900/20 text-red-400 hover:bg-red-900/40'}`}
               >
                  {critiquing ? 'Mephisto 降临中...' : '🩸 召唤 Mephisto 审判'}
               </button>

               <button
                onClick={handleGenerate}
                disabled={loading || !idea}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  loading || !idea
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-indigo-500/20'
                }`}
              >
                {loading ? '生成设定中...' : '生成设定'}
              </button>
            </div>
          </div>
          
          {/* Critique Panel */}
          {project.ideaCritique ? (
              <div className="bg-[#120a0a] border border-red-900/30 p-6 rounded-xl overflow-y-auto shadow-inner relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 via-transparent to-red-900"></div>
                  <h3 className="text-red-500 font-bold mb-4 flex items-center gap-2">
                      <span>👹</span> Mephisto 审判报告
                  </h3>
                  <div className="prose prose-invert prose-sm prose-p:text-slate-300 prose-headings:text-red-400 prose-strong:text-white max-w-none">
                     <div className="whitespace-pre-wrap">{project.ideaCritique}</div>
                  </div>
              </div>
          ) : (
              <div className="border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-slate-600 bg-slate-900/30 border-dashed">
                  <span className="text-4xl mb-2 opacity-50">⚖️</span>
                  <p>在此处查看内容碰撞审查结果</p>
                  <p className="text-xs mt-2 opacity-50">点击左侧 "召唤 Mephisto" 对灵感进行毒性检测</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default StepIdea;