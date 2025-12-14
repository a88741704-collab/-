import React, { useState } from 'react';
import { generateCharacters, generateCharacterImage } from '../geminiService';
import { ProjectState, Character } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
  onNext: () => void;
}

const StepCharacters: React.FC<Props> = ({ project, setProject, onNext }) => {
  const [loading, setLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState<string | null>(null);

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
    <div className="h-full flex flex-col max-w-6xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-indigo-400">步骤 4: 角色设计</h2>
            <div className="flex gap-2">
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

        {project.characters.length === 0 ? (
            <div className="flex-1 flex items-center justify-center glass-panel rounded-xl text-slate-500">
                请先生成角色以继续。
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-10">
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
  );
};

export default StepCharacters;