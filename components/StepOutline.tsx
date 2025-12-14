import React, { useState } from 'react';
import { generateOutline } from '../geminiService';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const StepOutline: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-indigo-400">步骤 5 & 6: 剧情细纲</h2>
            <div className="flex gap-2">
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

        <div className="flex-1 overflow-y-auto glass-panel rounded-xl p-2 space-y-2">
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
    </div>
  );
};

export default StepOutline;