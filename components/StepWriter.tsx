import React, { useState, useRef } from 'react';
import { writeChapterContent, critiqueDraft, generateSceneVideo } from '../geminiService';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
}

const StepWriter: React.FC<Props> = ({ project, setProject }) => {
  // Select first chapter by default if not selected
  const [selectedChapId, setSelectedChapId] = useState<string | null>(
      project.chapters.length > 0 ? (project.chapters[0].id || '0') : null
  );
  
  const activeChapterIndex = project.chapters.findIndex(c => c.id === selectedChapId);
  const activeChapter = activeChapterIndex !== -1 ? project.chapters[activeChapterIndex] : null;

  // UI State
  const [writing, setWriting] = useState(false);
  const [critiquing, setCritiquing] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [mode, setMode] = useState<'edit' | 'critique' | 'adapt'>('edit');
  const [sidebarTab, setSidebarTab] = useState<'directory' | 'phrases'>('directory');
  const [newPhrase, setNewPhrase] = useState('');
  
  // Collapse state for volumes
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<string, boolean>>({});

  // Refs for Text Insertion
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

  // --- Core Actions ---

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
        alert("写作失败");
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
          alert("审查失败");
      } finally {
          setCritiquing(false);
      }
  };

  const handleVideo = async () => {
      setGeneratingVideo(true);
      setProject({ ...project, agentStatus: 'generating', agentTask: '正在渲染场景动画 (Veo)...' });
      try {
          const videoUrl = await generateSceneVideo(activeChapter!.summary);
          if (videoUrl) {
              updateChapter({ animationUrl: videoUrl });
              setProject({ ...project, agentStatus: 'idle', agentTask: '动画渲染完成' });
          } else {
              setProject({ ...project, agentStatus: 'error', agentTask: '动画渲染返回空值' });
              alert("视频生成失败");
          }
      } catch (e) {
          setProject({ ...project, agentStatus: 'error', agentTask: '视频服务连接错误' });
          alert("视频服务错误");
      } finally {
          setGeneratingVideo(false);
      }
  };

  const handleExport = () => {
      // Simple TXT export
      let content = `${project.title}\n\n`;
      content += `核心设定:\n${project.settings}\n\n`;
      
      project.volumes.forEach(vol => {
          content += `\n\n=== ${vol.title} ===\n\n`;
          const volChapters = project.chapters.filter(c => c.volumeId === vol.id);
          volChapters.forEach(chap => {
              content += `第 ${chap.number} 章 ${chap.title}\n\n`;
              content += `${chap.content || '(暂无内容)'}\n\n`;
          });
      });

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.title || 'novel'}_export.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- Quick Phrase Logic ---

  const handleAddPhrase = () => {
      if (!newPhrase.trim()) return;
      setProject({
          ...project,
          quickPhrases: [...(project.quickPhrases || []), newPhrase.trim()]
      });
      setNewPhrase('');
  };

  const handleDeletePhrase = (index: number) => {
      const newPhrases = [...(project.quickPhrases || [])];
      newPhrases.splice(index, 1);
      setProject({ ...project, quickPhrases: newPhrases });
  };

  const insertPhrase = (text: string) => {
      if (!textareaRef.current || !activeChapter) return;
      
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const currentText = activeChapter.content || '';
      
      const newText = currentText.substring(0, start) + text + currentText.substring(end);
      
      updateChapter({ content: newText });
      
      // Restore focus and cursor position
      setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + text.length, start + text.length);
      }, 0);
  };

  if (project.chapters.length === 0) return <div className="p-10 text-center text-slate-500">请先在上一阶段生成大纲。</div>;

  return (
    <div className="h-full flex gap-4">
        {/* Left: Active Directory & Phrases */}
        <div className="w-80 flex-shrink-0 bg-[#151b28] border border-slate-700/50 rounded-xl overflow-hidden flex flex-col shadow-xl">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-slate-800 bg-[#0f1219]">
                <button 
                   onClick={() => setSidebarTab('directory')}
                   className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${sidebarTab === 'directory' ? 'text-white bg-slate-800 border-t-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    目录 (Directory)
                </button>
                <button 
                   onClick={() => setSidebarTab('phrases')}
                   className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${sidebarTab === 'phrases' ? 'text-white bg-slate-800 border-t-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    素材 (Phrases)
                </button>
            </div>

            {/* Content: Directory */}
            {sidebarTab === 'directory' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {project.volumes.map(vol => {
                        const isCollapsed = collapsedVolumes[vol.id];
                        const volChapters = project.chapters.filter(c => c.volumeId === vol.id || (!c.volumeId && vol.order === 1)); // Fallback for old chapters
                        
                        return (
                            <div key={vol.id} className="mb-4">
                                <button 
                                    onClick={() => toggleVolume(vol.id)}
                                    className="w-full flex items-center gap-2 px-2 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
                                >
                                    <span className={`transform transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>▼</span>
                                    {vol.title}
                                </button>
                                
                                {!isCollapsed && (
                                    <div className="space-y-1 mt-1 pl-2 border-l border-slate-800 ml-2">
                                        {volChapters.map((chap, idx) => {
                                            const isActive = activeChapter?.id === chap.id;
                                            return (
                                                <button
                                                    key={chap.id || idx}
                                                    onClick={() => setSelectedChapId(chap.id)}
                                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-start gap-3 group ${
                                                        isActive ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-slate-800 text-slate-400'
                                                    }`}
                                                >
                                                    <span className={`mt-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded text-[10px] font-mono border ${
                                                        isActive ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300' : 'border-slate-700 bg-slate-800 text-slate-500'
                                                    }`}>
                                                        {chap.number}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`truncate font-medium leading-tight ${isActive ? 'text-indigo-200' : 'text-slate-300 group-hover:text-white'}`}>
                                                            {chap.title}
                                                        </div>
                                                        <div className="text-[10px] text-slate-600 truncate mt-1 flex justify-between">
                                                            <span>{chap.content ? `${chap.content.length} words` : 'Drafting'}</span>
                                                            {chap.content && <span>✓</span>}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                        {volChapters.length === 0 && <div className="text-[10px] text-slate-600 pl-3 py-1">No chapters</div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    <div className="mt-6 px-4 pt-4 border-t border-slate-800 flex flex-col gap-2">
                        <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors">
                            + 新建分卷 (New Volume)
                        </button>
                        <button 
                            onClick={handleExport}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-emerald-400 transition-colors flex items-center justify-center gap-2"
                        >
                            <span>📥</span> 导出全书 (Export)
                        </button>
                    </div>
                </div>
            )}

            {/* Content: Phrases */}
            {sidebarTab === 'phrases' && (
                <div className="flex-1 flex flex-col h-full bg-[#0f1219]">
                     <div className="p-3 border-b border-slate-800">
                        <div className="flex gap-2">
                            <input 
                                value={newPhrase}
                                onChange={(e) => setNewPhrase(e.target.value)}
                                placeholder="输入常用短语..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddPhrase()}
                            />
                            <button 
                                onClick={handleAddPhrase}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs"
                            >
                                +
                            </button>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                         {(!project.quickPhrases || project.quickPhrases.length === 0) && (
                             <div className="text-center text-slate-600 text-xs py-10">暂无短语</div>
                         )}
                         {project.quickPhrases?.map((phrase, idx) => (
                             <div key={idx} className="group relative bg-slate-800/40 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800 rounded p-3 transition-colors cursor-pointer select-none" onClick={() => insertPhrase(phrase)}>
                                 <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">{phrase}</p>
                                 <button 
                                     onClick={(e) => { e.stopPropagation(); handleDeletePhrase(idx); }}
                                     className="absolute top-1 right-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                 >
                                     ×
                                 </button>
                             </div>
                         ))}
                     </div>
                </div>
            )}
        </div>

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col bg-[#1e293b] rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl relative">
            {/* Toolbar */}
            <div className="h-14 border-b border-slate-700/50 flex items-center justify-between px-6 bg-[#151b28]">
                {activeChapter ? (
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded uppercase">CH.{activeChapter.number}</span>
                        <h3 className="font-bold text-slate-200 text-sm tracking-wide">{activeChapter.title}</h3>
                    </div>
                ) : (
                    <div className="text-slate-500 text-sm">No Chapter Selected</div>
                )}
                
                <div className="flex gap-2">
                    <div className="bg-slate-900 p-1 rounded-lg flex gap-1 border border-slate-800">
                        <button onClick={() => setMode('edit')} className={`px-4 py-1.5 text-xs font-medium rounded transition-all ${mode === 'edit' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Editor</button>
                        <button onClick={() => setMode('critique')} className={`px-4 py-1.5 text-xs font-medium rounded transition-all ${mode === 'critique' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Critique</button>
                        <button onClick={() => setMode('adapt')} className={`px-4 py-1.5 text-xs font-medium rounded transition-all ${mode === 'adapt' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Visuals</button>
                    </div>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-hidden relative bg-[#1e293b]">
                {activeChapter ? (
                    mode === 'edit' ? (
                        <>
                            <textarea 
                                ref={textareaRef}
                                className="w-full h-full bg-transparent text-[#e2e8f0] font-serif text-lg leading-loose resize-none focus:outline-none p-8 max-w-4xl mx-auto custom-scrollbar"
                                placeholder="Start writing your chapter here..."
                                value={activeChapter.content || (writing ? 'AI is generating content...' : '')}
                                onChange={(e) => updateChapter({ content: e.target.value })}
                                spellCheck={false}
                            />
                            {/* Floating Tools */}
                            <div className="absolute bottom-6 right-8 flex flex-col gap-3">
                                {activeChapter.content && (
                                    <button 
                                        onClick={handleCritique}
                                        disabled={critiquing}
                                        className="w-10 h-10 bg-slate-700 hover:bg-pink-600 text-white rounded-full shadow-lg transition-all hover:scale-110 flex items-center justify-center group"
                                        title="Run Critique Agent"
                                    >
                                        <span className="text-lg">🧐</span>
                                    </button>
                                )}
                                <button 
                                    onClick={handleWrite}
                                    disabled={writing}
                                    className={`w-12 h-12 rounded-full shadow-xl transition-all hover:scale-110 flex items-center justify-center group ${writing ? 'bg-slate-700 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                    title="AI Write / Continue"
                                >
                                    {writing ? (
                                        <span className="animate-spin text-white">⟳</span>
                                    ) : (
                                        <span className="text-white font-bold text-xl">✍️</span>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : mode === 'critique' ? (
                        <div className="h-full overflow-y-auto p-8 custom-scrollbar">
                            <div className="max-w-3xl mx-auto">
                                <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
                                    <span className="text-3xl">🧐</span>
                                    <div>
                                        <h4 className="text-pink-400 font-bold text-xl">Critique Report</h4>
                                        <p className="text-slate-500 text-xs">Analysis of pacing, logic, and character consistency.</p>
                                    </div>
                                </div>
                                <div className="prose prose-invert max-w-none">
                                    <div className="whitespace-pre-wrap text-slate-300 leading-relaxed bg-slate-800/50 p-8 rounded-xl border border-slate-700/50 shadow-inner">
                                        {activeChapter.critique || <span className="text-slate-500 italic">No critique generated yet. Switch to Edit mode and run the Critique Agent.</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto p-8 custom-scrollbar flex flex-col items-center">
                             {/* Visual Adapt Mode */}
                             <div className="w-full max-w-4xl space-y-8">
                                 <div className="text-center space-y-2">
                                     <h3 className="text-2xl font-bold text-emerald-400">Visual Adaptation</h3>
                                     <p className="text-slate-500">Generate storyboard visuals or video previews for this chapter.</p>
                                 </div>
                                 
                                 <div className="bg-black rounded-xl aspect-video w-full border border-slate-700 shadow-2xl overflow-hidden relative group">
                                     {activeChapter.animationUrl ? (
                                         <video controls src={activeChapter.animationUrl} className="w-full h-full" />
                                     ) : (
                                         <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black via-slate-900 to-slate-800">
                                              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-lg border border-slate-700">
                                                  <span className="text-4xl">🎬</span>
                                              </div>
                                              <p className="text-slate-400 text-lg font-medium mb-8">No Scene Video Generated</p>
                                              <button 
                                                  onClick={handleVideo}
                                                  disabled={generatingVideo}
                                                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition-all transform hover:-translate-y-1"
                                              >
                                                  {generatingVideo ? 'Rendering Scene (Veo)...' : 'Generate Cinematic Preview'}
                                              </button>
                                         </div>
                                     )}
                                 </div>
                                 
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                         <h4 className="text-slate-300 font-bold mb-2">Comic Panels</h4>
                                         <p className="text-xs text-slate-500">Coming soon: Generate multi-panel comic strips based on chapter dialogue.</p>
                                     </div>
                                     <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                                         <h4 className="text-slate-300 font-bold mb-2">Character Emotions</h4>
                                         <p className="text-xs text-slate-500">Coming soon: Analyze emotional beats and generate reaction images.</p>
                                     </div>
                                 </div>
                             </div>
                        </div>
                    )
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-600">
                        Select a chapter to begin writing.
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default StepWriter;