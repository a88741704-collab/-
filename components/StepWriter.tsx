
import React, { useState, useRef } from 'react';
import { writeChapterContent, critiqueDraft } from '../geminiService';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
}

const StepWriter: React.FC<Props> = ({ project, setProject }) => {
  const [selectedChapId, setSelectedChapId] = useState<string | null>(
      project.chapters.length > 0 ? (project.chapters[0].id || '0') : null
  );
  
  const activeChapterIndex = project.chapters.findIndex(c => c.id === selectedChapId);
  const activeChapter = activeChapterIndex !== -1 ? project.chapters[activeChapterIndex] : null;

  const [writing, setWriting] = useState(false);
  const [critiquing, setCritiquing] = useState(false);
  const [mode, setMode] = useState<'edit' | 'critique'>('edit');
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<string, boolean>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateChapter = (updates: Partial<typeof activeChapter>) => {
      if(!activeChapter) return;
      const newChapters = [...project.chapters];
      newChapters[activeChapterIndex] = { ...activeChapter, ...updates };
      setProject({ ...project, chapters: newChapters });
  };

  const toggleVolume = (volId: string) => {
      setCollapsedVolumes(prev => ({...prev, [volId]: !prev[volId]}));
  };

  const handleWrite = async () => {
    if (!activeChapter) return;
    setWriting(true);
    setProject({ ...project, agentStatus: 'generating', agentTask: `正在撰写第 ${activeChapter.number} 章正文...` });
    try {
        const prevSummary = activeChapterIndex > 0 ? project.chapters[activeChapterIndex - 1].summary : "Novel Start";
        const content = await writeChapterContent(activeChapter, project.settings, project.characters, prevSummary, project.agentConfig);
        updateChapter({ content });
        setProject({ ...project, agentStatus: 'idle', agentTask: '章节草稿撰写完成' });
    } catch(e) {
        setProject({ ...project, agentStatus: 'error', agentTask: '写作中断' });
    } finally {
        setWriting(false);
    }
  };

  const handleCritique = async () => {
      if (!activeChapter?.content) return;
      setCritiquing(true);
      setProject({ ...project, agentStatus: 'thinking', agentTask: '正在审查章节逻辑与文笔...' });
      try {
          const critique = await critiqueDraft(activeChapter.content, project.agentConfig);
          updateChapter({ critique });
          setMode('critique');
          setProject({ ...project, agentStatus: 'idle', agentTask: '章节审查完成' });
      } catch(e) {
          setProject({ ...project, agentStatus: 'error', agentTask: '审查中断' });
      } finally {
          setCritiquing(false);
      }
  };

  if (project.chapters.length === 0) return <div className="p-10 text-center text-slate-500">请先在上一阶段生成大纲。</div>;

  return (
    <div className="h-full flex gap-4">
        {/* Left: Directory */}
        <div className="w-64 flex-shrink-0 bg-[#151b28] border border-slate-700/50 rounded-xl overflow-hidden flex flex-col shadow-xl">
            <div className="p-3 bg-[#0f1219] border-b border-slate-800 font-bold text-slate-400 text-xs uppercase tracking-wider">
                目录 (Directory)
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {project.volumes.map(vol => {
                    const isCollapsed = collapsedVolumes[vol.id];
                    const volChapters = project.chapters.filter(c => c.volumeId === vol.id);
                    return (
                        <div key={vol.id} className="mb-4">
                            <button onClick={() => toggleVolume(vol.id)} className="w-full flex items-center gap-2 px-2 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider">
                                <span className={`transform transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>▼</span> {vol.title}
                            </button>
                            {!isCollapsed && (
                                <div className="space-y-1 mt-1 pl-2 border-l border-slate-800 ml-2">
                                    {volChapters.map(chap => {
                                        const isActive = activeChapter?.id === chap.id;
                                        return (
                                            <button key={chap.id} onClick={() => setSelectedChapId(chap.id)} className={`w-full text-left px-3 py-2 rounded text-sm truncate transition-all ${isActive ? 'bg-emerald-600/20 text-emerald-300' : 'text-slate-400 hover:text-white'}`}>
                                                {chap.number}. {chap.title}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col bg-[#1e293b] rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl relative">
            <div className="h-12 border-b border-slate-700/50 flex items-center justify-between px-6 bg-[#151b28]">
                <h3 className="font-bold text-slate-200 text-sm tracking-wide">{activeChapter ? activeChapter.title : 'No Chapter'}</h3>
                <div className="flex gap-2">
                     <button onClick={() => setMode('edit')} className={`px-4 py-1 text-xs font-medium rounded ${mode === 'edit' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Edit</button>
                     <button onClick={() => setMode('critique')} className={`px-4 py-1 text-xs font-medium rounded ${mode === 'critique' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Critique</button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative bg-[#1e293b]">
                {activeChapter && mode === 'edit' ? (
                    <>
                        <textarea 
                            ref={textareaRef}
                            className="w-full h-full bg-transparent text-[#e2e8f0] font-serif text-lg leading-loose resize-none focus:outline-none p-8 max-w-4xl mx-auto custom-scrollbar"
                            value={activeChapter.content || (writing ? 'AI generating...' : '')}
                            onChange={(e) => updateChapter({ content: e.target.value })}
                        />
                        <div className="absolute bottom-6 right-8 flex flex-col gap-3">
                            <button onClick={handleCritique} disabled={critiquing} className="w-10 h-10 bg-slate-700 hover:bg-red-600 text-white rounded-full flex items-center justify-center">🧐</button>
                            <button onClick={handleWrite} disabled={writing} className="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg">✍️</button>
                        </div>
                    </>
                ) : activeChapter && mode === 'critique' ? (
                    <div className="p-8 overflow-y-auto h-full prose prose-invert max-w-none">
                        <div className="whitespace-pre-wrap">{activeChapter.critique || '暂无评论'}</div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">选择章节开始写作</div>
                )}
            </div>
        </div>
    </div>
  );
};
export default StepWriter;
