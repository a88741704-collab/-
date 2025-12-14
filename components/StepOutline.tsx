import React, { useState } from 'react';
import { generateOutline, runMephistoCritique } from '../geminiService';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const StepOutline: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [loading, setLoading] = useState(false);
  const [critiquing, setCritiquing] = useState(false);
  const [showCritique, setShowCritique] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setProject({ ...project, agentStatus: 'thinking', agentTask: '正在编排剧情脉络与章节细纲...' });
    try {
      const chapters = await generateOutline(project.settings, project.characters, project.agentConfig);
      setProject({ ...project, chapters, agentStatus: 'idle', agentTask: '大纲规划完成' });
    } catch (e) {
      setProject({ ...project, agentStatus: 'error', agentTask: '大纲生成失败' });
      alert("生成大纲失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCritique = async () => {
      if (project.chapters.length === 0) return;
      setCritiquing(true);
      setShowCritique(true);
      setProject({ ...project, agentStatus: 'thinking', agentTask: 'Mephisto 正在审视剧情大纲...' });
      
      const outlineText = project.chapters.map(c => `Chapter ${c.number}: ${c.title}\n${c.summary}`).join('\n\n');
      try {
          const result = await runMephistoCritique(outlineText, 'Outline', project.agentConfig);
          setProject({ ...project, outlineCritique: result, agentStatus: 'idle', agentTask: '审判完毕' });
      } catch (e) {
          setProject({ ...project, agentStatus: 'error', agentTask: '审判失败' });
      } finally {
          setCritiquing(false);
      }
  };

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-indigo-400">步骤 5: 剧情细纲</h2>
            <div className="flex gap-2">
                <button
                  onClick={handleCritique}
                  disabled={critiquing || project.chapters.length === 0}
                  className="px-3 py-2 border border-red-800 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg text-xs font-bold transition-all"
                >
                   {critiquing ? '审判中...' : '🩸 剧情审判'}
                </button>
                <button 
                    onClick={handleGenerate}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium text-sm"
                >
                    {loading ? '规划中...' : '生成章节大纲'}
                </button>
                <button onClick={onNext} className="px-4 py-2 bg-indigo-600 rounded-lg text-white">下一步</button>
            </div>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden">
             {/* Chapters List */}
             <div className="flex-1 overflow-y-auto glass-panel rounded-xl p-2 space-y-2 custom-scrollbar">
                {project.chapters.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500">
                        暂无章节计划。点击生成按钮开始规划时间线。
                    </div>
                ) : (
                    project.chapters.map((chap) => (
                        <div key={chap.number} className="p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors">
                            <div className="flex items-baseline gap-4 mb-2">
                                <span className="text-indigo-400 font-mono font-bold">第 {chap.number} 章</span>
                                <h3 className="text-lg font-semibold text-slate-200">{chap.title}</h3>
                            </div>
                            <p className="text-slate-400 text-sm">{chap.summary}</p>
                        </div>
                    ))
                )}
            </div>

            {/* Critique Panel */}
            {showCritique && (
                 <div className="w-1/2 bg-[#120a0a] border-l border-red-900/50 flex flex-col rounded-r-xl overflow-hidden shadow-2xl relative animate-fade-in">
                      <div className="p-4 border-b border-red-900/30 flex justify-between items-center bg-[#1a0f0f]">
                           <h3 className="text-red-500 font-bold flex items-center gap-2">👹 Mephisto 审判</h3>
                           <button onClick={() => setShowCritique(false)} className="text-slate-500 hover:text-white">✕</button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                          {project.outlineCritique ? (
                              <div className="prose prose-invert prose-sm prose-p:text-slate-300 prose-headings:text-red-400 max-w-none">
                                  <div className="whitespace-pre-wrap">{project.outlineCritique}</div>
                              </div>
                          ) : (
                              <div className="text-center text-slate-600 mt-20">等待审判结果...</div>
                          )}
                      </div>
                 </div>
            )}
        </div>
    </div>
  );
};

export default StepOutline;