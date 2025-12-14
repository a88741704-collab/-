
import React from 'react';
import { ProjectState, UIPreferences } from '../types';

interface Props {
  project: ProjectState;
  onUpdatePrefs: (prefs: Partial<UIPreferences>) => void;
  onClose: () => void;
}

const THEME_COLORS = [
    { name: 'Indigo', hex: '#4f46e5', label: '靛蓝 (默认)' },
    { name: 'Emerald', hex: '#059669', label: '翡翠' },
    { name: 'Rose', hex: '#e11d48', label: '玫瑰' },
    { name: 'Amber', hex: '#d97706', label: '琥珀' },
    { name: 'Cyan', hex: '#0891b2', label: '青色' },
    { name: 'Violet', hex: '#7c3aed', label: '紫罗兰' },
];

const DashboardModal: React.FC<Props> = ({ project, onUpdatePrefs, onClose }) => {
  const { uiPreferences, chapters, volumes, characters, agentConfig } = project;
  
  // Calculate Stats
  const totalWords = chapters.reduce((acc, c) => acc + (c.content?.length || 0), 0);
  const totalChapters = chapters.length;
  const avgWords = totalChapters > 0 ? Math.round(totalWords / totalChapters) : 0;
  const completedChapters = chapters.filter(c => c.content && c.content.length > 500).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121212] border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-[#18181b]">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
             🎛️ 控制中心 & 数据汇总
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-2 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* 1. Appearance Settings */}
                <div className="space-y-6">
                    <h4 className="text-lg font-bold text-slate-200 border-b border-slate-700 pb-2 mb-4">🎨 外观与显示</h4>
                    
                    {/* Font Size */}
                    <div className="bg-[#1e1e24] p-5 rounded-xl border border-slate-700/50">
                        <div className="flex justify-between mb-2">
                            <label className="text-slate-300 font-medium">全局字体大小</label>
                            <span className="text-emerald-400 font-mono">{uiPreferences?.fontSize || 16}px</span>
                        </div>
                        <input 
                            type="range" 
                            min="12" max="24" step="1"
                            value={uiPreferences?.fontSize || 16}
                            onChange={(e) => onUpdatePrefs({ fontSize: Number(e.target.value) })}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                            <span>小</span>
                            <span>标准</span>
                            <span>大</span>
                        </div>
                    </div>

                    {/* Theme Color */}
                    <div className="bg-[#1e1e24] p-5 rounded-xl border border-slate-700/50">
                        <label className="text-slate-300 font-medium block mb-3">主题色调 (Accent Color)</label>
                        <div className="grid grid-cols-3 gap-3">
                            {THEME_COLORS.map(color => (
                                <button
                                    key={color.name}
                                    onClick={() => onUpdatePrefs({ accentColor: color.hex })}
                                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                        (uiPreferences?.accentColor === color.hex || (!uiPreferences?.accentColor && color.name === 'Indigo'))
                                        ? 'bg-slate-700 border-white ring-1 ring-white' 
                                        : 'bg-slate-800 border-transparent hover:bg-slate-700'
                                    }`}
                                >
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color.hex }}></div>
                                    <span className="text-xs text-slate-300">{color.label}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">* 颜色更改将应用到按钮、高亮和标题。</p>
                    </div>
                </div>

                {/* 2. Statistics & Health */}
                <div className="space-y-6">
                    <h4 className="text-lg font-bold text-slate-200 border-b border-slate-700 pb-2 mb-4">📊 运行情况汇总</h4>
                    
                    {/* Big Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-white mb-1">{totalWords.toLocaleString()}</span>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">总字数</span>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-white mb-1">{completedChapters} <span className="text-base text-slate-500 font-normal">/ {totalChapters}</span></span>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">完成章节</span>
                        </div>
                    </div>

                    {/* Detailed List */}
                    <div className="bg-[#1e1e24] rounded-xl border border-slate-700/50 overflow-hidden">
                        <div className="p-4 space-y-3 text-sm">
                            <div className="flex justify-between border-b border-slate-700 pb-2">
                                <span className="text-slate-400">平均章节字数</span>
                                <span className="text-slate-200 font-mono">{avgWords} 字</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-700 pb-2">
                                <span className="text-slate-400">登场角色</span>
                                <span className="text-slate-200 font-mono">{characters.length} 人</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-700 pb-2">
                                <span className="text-slate-400">规划分卷</span>
                                <span className="text-slate-200 font-mono">{volumes.length} 卷</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-700 pb-2">
                                <span className="text-slate-400">知识库文件</span>
                                <span className="text-slate-200 font-mono">{project.knowledgeBaseFiles.length} 个</span>
                            </div>
                        </div>
                    </div>

                    {/* System Info */}
                    <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4">
                        <h5 className="text-xs font-bold text-indigo-400 uppercase mb-2">System Config</h5>
                        <div className="space-y-1 text-xs font-mono text-indigo-200/80">
                            <p>Provider: {agentConfig.provider}</p>
                            <p>Model: {agentConfig.model}</p>
                            <p>API Endpoint: {agentConfig.provider === 'custom' ? agentConfig.customBaseUrl : 'Google Cloud Vertex'}</p>
                            <p>Plugins Loaded: {agentConfig.plugins.filter(p => p.active).length}</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardModal;
