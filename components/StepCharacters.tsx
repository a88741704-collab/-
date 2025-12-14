import React, { useState } from 'react';
import { generateCharacters, generateCharacterImage, runMephistoCritique } from '../geminiService';
import { ProjectState, Character } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const StepCharacters: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [loading, setLoading] = useState(false);
  const [critiquing, setCritiquing] = useState(false);
  const [imgLoading, setImgLoading] = useState<string | null>(null);
  const [showCritique, setShowCritique] = useState(false);

  const handleGenerateChars = async () => {
    setLoading(true);
    setProject({ ...project, agentStatus: 'generating', agentTask: '正在规划角色阵容与人设...' });
    try {
      const chars = await generateCharacters(project.settings, project.agentConfig);
      setProject({ ...project, characters: chars, agentStatus: 'idle', agentTask: `已生成 ${chars.length} 名角色` });
    } catch (e) {
      setProject({ ...project, agentStatus: 'error', agentTask: '角色生成失败' });
      alert("生成角色失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCritique = async () => {
      if (project.characters.length === 0) return;
      setCritiquing(true);
      setShowCritique(true);
      setProject({ ...project, agentStatus: 'thinking', agentTask: 'Mephisto 正在审视角色...' });
      
      const charText = project.characters.map(c => `${c.name} (${c.role}): ${c.description}`).join('\n');
      try {
          const result = await runMephistoCritique(charText, 'Characters', project.agentConfig);
          setProject({ ...project, characterCritique: result, agentStatus: 'idle', agentTask: '审判完毕' });
      } catch (e) {
          setProject({ ...project, agentStatus: 'error', agentTask: '审判失败' });
      } finally {
          setCritiquing(false);
      }
  };

  const handleGenerateImage = async (charId: string, desc: string) => {
    setImgLoading(charId);
    setProject({ ...project, agentStatus: 'generating', agentTask: '正在绘制角色立绘...' });
    try {
        const base64 = await generateCharacterImage(desc);
        const updated = project.characters.map(c => 
            c.id === charId ? { ...c, imageUrl: base64 } : c
        );
        setProject({ ...project, characters: updated, agentStatus: 'idle', agentTask: '立绘绘制完成' });
    } catch(e) {
        setProject({ ...project, agentStatus: 'error', agentTask: '绘图失败' });
        alert("图片生成失败");
    } finally {
        setImgLoading(null);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto space-y-4 relative">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-indigo-400">步骤 4: 角色设计</h2>
            <div className="flex gap-2">
                <button
                  onClick={handleCritique}
                  disabled={critiquing || project.characters.length === 0}
                  className="px-3 py-2 border border-red-800 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg text-xs font-bold transition-all"
                >
                   {critiquing ? '审判中...' : '🩸 角色审判'}
                </button>
                <button 
                    onClick={handleGenerateChars}
                    disabled={loading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium text-sm"
                >
                    {loading ? '选角中...' : '生成角色表'}
                </button>
                <button onClick={onNext} className="px-4 py-2 bg-indigo-600 rounded-lg text-white">下一步</button>
            </div>
        </div>
        
        <div className="flex-1 flex gap-6 overflow-hidden">
             {/* Character Grid */}
            <div className={`flex-1 overflow-y-auto pb-10 custom-scrollbar ${showCritique ? 'w-1/2' : 'w-full'}`}>
                {project.characters.length === 0 ? (
                    <div className="h-full flex items-center justify-center glass-panel rounded-xl text-slate-500">
                        请先生成角色以继续。
                    </div>
                ) : (
                    <div className={`grid gap-6 ${showCritique ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                        {project.characters.map((char) => (
                            <div key={char.id || Math.random()} className="glass-panel p-4 rounded-xl flex flex-col gap-4">
                                <div className="aspect-[3/4] bg-slate-800 rounded-lg overflow-hidden relative group">
                                    {char.imageUrl ? (
                                        <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                            暂无图片
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => handleGenerateImage(char.id, char.appearance)}
                                        disabled={!!imgLoading}
                                        className="absolute bottom-2 right-2 bg-indigo-600 text-xs px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        {imgLoading === char.id ? '绘制中...' : '生成立绘'}
                                    </button>
                                </div>
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-xl font-bold text-slate-200">{char.name}</h3>
                                        <span className={`text-xs px-2 py-1 rounded ${
                                            char.role === 'Main' ? 'bg-amber-500/20 text-amber-400' :
                                            char.role === 'Antagonist' ? 'bg-red-500/20 text-red-400' :
                                            'bg-slate-500/20 text-slate-400'
                                        }`}>{char.role}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 italic">{char.appearance}</p>
                                    <p className="text-sm text-slate-300 mt-2 line-clamp-4 hover:line-clamp-none transition-all">{char.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Critique Sidebar */}
            {showCritique && (
                 <div className="w-1/2 bg-[#120a0a] border-l border-red-900/50 flex flex-col rounded-r-xl overflow-hidden shadow-2xl relative animate-fade-in">
                      <div className="p-4 border-b border-red-900/30 flex justify-between items-center bg-[#1a0f0f]">
                           <h3 className="text-red-500 font-bold flex items-center gap-2">👹 Mephisto 审判</h3>
                           <button onClick={() => setShowCritique(false)} className="text-slate-500 hover:text-white">✕</button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                          {project.characterCritique ? (
                              <div className="prose prose-invert prose-sm prose-p:text-slate-300 prose-headings:text-red-400 max-w-none">
                                  <div className="whitespace-pre-wrap">{project.characterCritique}</div>
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

export default StepCharacters;