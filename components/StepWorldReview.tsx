import React, { useState } from 'react';
import { critiqueSettings } from '../geminiService';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const StepWorldReview: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bible' | 'critique'>('bible');
  const [bibleSection, setBibleSection] = useState<'overview' | 'power' | 'factions' | 'story'>('overview');

  const handleCritique = async () => {
    setLoading(true);
    setProject({ ...project, agentStatus: 'thinking', agentTask: 'Mephisto 正在进行深度逻辑审查与卖点分析...' });
    try {
      const critique = await critiqueSettings(project.settings, project.agentConfig);
      setProject({ ...project, settingsCritique: critique, agentStatus: 'idle', agentTask: '审查报告已生成' });
      setActiveTab('critique');
    } catch (error) {
      setProject({ ...project, agentStatus: 'error', agentTask: '审查分析失败' });
      alert("审查失败");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto space-y-4 animate-fade-in">
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
         <div>
             <h2 className="text-2xl font-bold text-white tracking-tight">世界观设定集 <span className="text-indigo-400 text-lg font-normal">World Bible</span></h2>
             <p className="text-xs text-slate-400 mt-1">Review and refine the generated world settings before moving to characters.</p>
         </div>
         <div className="flex gap-3">
             <button 
                onClick={handleCritique}
                disabled={loading}
                className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-800/50 rounded-lg text-red-400 font-medium text-xs flex items-center gap-2 transition-all"
             >
                {loading ? (
                    <>
                        <span className="animate-spin">⟳</span> 审判中...
                    </>
                ) : (
                    <>
                        <span>🩸</span> Mephisto 审判
                    </>
                )}
             </button>
             <button 
                onClick={onNext}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
             >
                确认设定并继续 <span>→</span>
             </button>
         </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-6 border-b border-slate-700/50 text-sm font-medium">
          <button 
            className={`pb-3 px-2 transition-all ${activeTab === 'bible' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveTab('bible')}
          >
            📖 设定集 (Wiki)
          </button>
          <button 
            className={`pb-3 px-2 transition-all ${activeTab === 'critique' ? 'text-red-400 border-b-2 border-red-400' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => setActiveTab('critique')}
          >
            👹 审判报告
          </button>
      </div>

      <div className="flex-1 overflow-hidden glass-panel rounded-xl flex border border-slate-700 shadow-xl">
          {activeTab === 'bible' && (
              <>
                {/* Bible Sidebar */}
                <div className="w-48 bg-slate-900/50 border-r border-slate-700 p-2 flex flex-col gap-1">
                    <button 
                        onClick={() => setBibleSection('overview')}
                        className={`text-left px-3 py-2 rounded text-xs font-medium transition-colors ${bibleSection === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    >
                        🌍 世界概览
                    </button>
                    <button 
                        onClick={() => setBibleSection('power')}
                        className={`text-left px-3 py-2 rounded text-xs font-medium transition-colors ${bibleSection === 'power' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    >
                        ⚔️ 力量体系
                    </button>
                    <button 
                        onClick={() => setBibleSection('factions')}
                        className={`text-left px-3 py-2 rounded text-xs font-medium transition-colors ${bibleSection === 'factions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    >
                        🏛️ 势力/宗门
                    </button>
                    <button 
                        onClick={() => setBibleSection('story')}
                        className={`text-left px-3 py-2 rounded text-xs font-medium transition-colors ${bibleSection === 'story' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    >
                        📜 故事走向
                    </button>
                </div>
                
                {/* Bible Editor */}
                <div className="flex-1 bg-[#1e293b]/50 relative">
                     <textarea
                        className="w-full h-full bg-transparent text-slate-300 resize-none focus:outline-none font-serif leading-relaxed p-6 text-base"
                        value={project.settings}
                        onChange={(e) => setProject({...project, settings: e.target.value})}
                        placeholder="在这里编辑生成的设定。AI 生成的内容通常为 Markdown 格式。"
                      />
                      <div className="absolute top-2 right-4 text-xs text-slate-500 bg-slate-800/80 px-2 py-1 rounded pointer-events-none">
                          Markdown Mode
                      </div>
                </div>
              </>
          )}

          {activeTab === 'critique' && (
              <div className="w-full h-full bg-[#120a0a] p-0 relative overflow-hidden">
                  {!project.settingsCritique ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                          <span className="text-4xl mb-4 opacity-50">👹</span>
                          <p>暂无审判报告</p>
                          <p className="text-sm mt-2 opacity-50">点击右上角按钮召唤 Mephisto</p>
                      </div>
                  ) : (
                      <div className="h-full overflow-y-auto p-8 custom-scrollbar">
                           <div className="prose prose-invert max-w-none prose-headings:text-red-400 prose-p:text-slate-300">
                               <div className="whitespace-pre-wrap">{project.settingsCritique}</div>
                           </div>
                      </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

export default StepWorldReview;