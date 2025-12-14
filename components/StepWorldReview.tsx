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
  const [activeTab, setActiveTab] = useState<'settings' | 'critique'>('settings');

  const handleCritique = async () => {
    setLoading(true);
    setProject({ ...project, agentStatus: 'thinking', agentTask: 'Agent 正在进行深度逻辑审查与卖点分析...' });
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
    <div className="h-full flex flex-col max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-indigo-400">步骤 2 & 3: 设定与大纲审查</h2>
         <div className="flex gap-2">
             <button 
                onClick={handleCritique}
                disabled={loading}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg text-white font-medium text-sm flex items-center gap-2"
             >
                {loading ? '分析中...' : '运行深度审查 Agent'}
             </button>
             <button 
                onClick={onNext}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-sm"
             >
                确认并继续
             </button>
         </div>
      </div>

      <div className="flex gap-4 mb-2 border-b border-slate-700">
          <button 
            className={`py-2 px-4 ${activeTab === 'settings' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400'}`}
            onClick={() => setActiveTab('settings')}
          >
            生成的设定
          </button>
          <button 
            className={`py-2 px-4 ${activeTab === 'critique' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-slate-400'}`}
            onClick={() => setActiveTab('critique')}
          >
            Agent 审查意见
          </button>
      </div>

      <div className="flex-1 overflow-hidden glass-panel rounded-xl p-6 relative">
          <textarea
            className="w-full h-full bg-transparent text-slate-300 resize-none focus:outline-none font-serif leading-relaxed"
            value={activeTab === 'settings' ? project.settings : project.settingsCritique}
            onChange={(e) => {
                if(activeTab === 'settings') setProject({...project, settings: e.target.value});
            }}
          />
          {activeTab === 'critique' && !project.settingsCritique && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                  <p>点击“运行深度审查 Agent”以分析卖点、闭环和逻辑。</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default StepWorldReview;