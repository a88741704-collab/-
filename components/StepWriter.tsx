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
  
  const activeChapterIndex = project.chapters.findIndex(c => c.id === selectedChapId) !== -1 
     ? project.chapters.findIndex(c => c.id === selectedChapId)
     : 0;
  
  const activeChapter = project.chapters[activeChapterIndex];

  // UI State
  const [writing, setWriting] = useState(false);
  const [critiquing, setCritiquing] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [mode, setMode] = useState<'edit' | 'critique' | 'adapt'>('edit');
  const [sidebarTab, setSidebarTab] = useState<'directory' | 'phrases'>('directory');
  const [newPhrase, setNewPhrase] = useState('');

  // Refs for Text Insertion
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateChapter = (updates: Partial<typeof activeChapter>) => {
      const newChapters = [...project.chapters];
      newChapters[activeChapterIndex] = { ...activeChapter, ...updates };
      setProject({ ...project, chapters: newChapters });
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
      if (!window.aistudio?.hasSelectedApiKey) {
           // Simulate check
      }
      setGeneratingVideo(true);
      setProject({ ...project, agentStatus: 'generating', agentTask: '正在渲染场景动画 (Veo)...' });
      try {
          const videoUrl = await generateSceneVideo(activeChapter.summary);
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

  if (!activeChapter) return <div className="p-10 text-center text-slate-500">请先在上一阶段生成大纲。</div>;

  return (
    <div className="h-full flex gap-6">
        {/* Left: Active Directory & Phrases */}
        <div className="w-72 flex-shrink-0 glass-panel rounded-xl overflow-hidden flex flex-col border border-slate-700">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-slate-700 bg-slate-900/50">
                <button 
                   onClick={() => setSidebarTab('directory')}
                   className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${sidebarTab === 'directory' ? 'text-white bg-slate-700/50 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    活动目录
                </button>
                <button 
                   onClick={() => setSidebarTab('phrases')}
                   className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${sidebarTab === 'phrases' ? 'text-white bg-slate-700/50 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    快捷短语
                </button>
            </div>

            {/* Content: Directory */}
            {sidebarTab === 'directory' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-800/30">第一卷：初入江湖</div>
                    {project.chapters.map((chap, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedChapId(chap.id || String(idx))}
                            className={`w-full text-left px-4 py-3 text-sm border-b border-slate-800/50 transition-all flex items-start gap-3 group ${
                                idx === activeChapterIndex ? 'bg-indigo-600/10 border-l-4 border-l-indigo-500' : 'hover:bg-slate-800'
                            }`}
                        >
                            <span className={`mt-0.5 w-4 h-4 flex items-center justify-center rounded text-[10px] ${idx === activeChapterIndex ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                {chap.number}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className={`truncate font-medium ${idx === activeChapterIndex ? 'text-indigo-300' : 'text-slate-300 group-hover:text-white'}`}>
                                    {chap.title}
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                    {chap.content ? `${chap.content.length} 字` : '暂无内容'}
                                </div>
                            </div>
                        </button>
                    ))}
                    <div className="p-4 text-center">
                        <button className="text-xs text-slate-500 hover:text-indigo-400 dashed-border px-4 py-2 rounded transition-colors">
                            + 新建分卷 (未实装)
                        </button>
                    </div>
                </div>
            )}

            {/* Content: Phrases */}
            {sidebarTab === 'phrases' && (
                <div className="flex-1 flex flex-col h-full">
                     <div className="p-3 border-b border-slate-700 bg-slate-800/30">
                        <div className="flex gap-2">
                            <input 
                                value={newPhrase}
                                onChange={(e) => setNewPhrase(e.target.value)}
                                placeholder="输入常用短语..."
                                className="flex-1 bg-black/30 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddPhrase()}
                            />
                            <button 
                                onClick={handleAddPhrase}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-xs"
                            >
                                +
                            </button>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-2 space-y-2">
                         {(!project.quickPhrases || project.quickPhrases.length === 0) && (
                             <div className="text-center text-slate-500 text-xs py-4">暂无短语，请添加</div>
                         )}
                         {project.quickPhrases?.map((phrase, idx) => (
                             <div key={idx} className="group relative bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 rounded p-2 transition-colors cursor-pointer" onClick={() => insertPhrase(phrase)}>
                                 <p className="text-xs text-slate-300 line-clamp-3">{phrase}</p>
                                 <button 
                                     onClick={(e) => { e.stopPropagation(); handleDeletePhrase(idx); }}
                                     className="absolute top-1 right-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                 >
                                     ×
                                 </button>
                             </div>
                         ))}
                     </div>
                     <div className="p-2 text-[10px] text-slate-500 text-center bg-slate-900/30">
                         点击短语即可插入光标处
                     </div>
                </div>
            )}
        </div>

        {/* Center: Content */}
        <div className="flex-1 flex flex-col glass-panel rounded-xl overflow-hidden border border-slate-700">
            {/* Toolbar */}
            <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">CH.{activeChapter.number}</span>
                    <h3 className="font-bold text-slate-200">{activeChapter.title}</h3>
                </div>
                <div className="flex gap-2">
                    <div className="bg-slate-800 p-1 rounded-lg flex gap-1">
                        <button onClick={() => setMode('edit')} className={`px-3 py-1 text-xs rounded transition-all ${mode === 'edit' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>编辑器</button>
                        <button onClick={() => setMode('critique')} className={`px-3 py-1 text-xs rounded transition-all ${mode === 'critique' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>审查意见</button>
                        <button onClick={() => setMode('adapt')} className={`px-3 py-1 text-xs rounded transition-all ${mode === 'adapt' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>视觉改编</button>
                    </div>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto p-8 relative bg-[#0f1219]">
                {mode === 'edit' && (
                    <>
                        {!activeChapter.content && !writing ? (
                             <div className="h-full flex flex-col items-center justify-center space-y-4">
                                 <div className="w-16 h-16 bg-indigo-900/30 rounded-full flex items-center justify-center mb-2">
                                     <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                 </div>
                                 <p className="text-slate-500 max-w-md text-center text-sm">本章暂无内容。您可以开始写作，或使用 Agent 自动生成。</p>
                                 <button 
                                    onClick={handleWrite}
                                    disabled={writing}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg font-bold text-sm transition-all"
                                 >
                                     AI 自动写作 (Agent)
                                 </button>
                             </div>
                        ) : (
                            <textarea 
                                ref={textareaRef}
                                className="w-full h-full bg-transparent text-slate-300 font-serif text-lg leading-loose resize-none focus:outline-none p-4"
                                placeholder="在此处输入正文..."
                                value={activeChapter.content || (writing ? '正在生成中...' : '')}
                                onChange={(e) => updateChapter({ content: e.target.value })}
                            />
                        )}
                        {/* Floating Action for Critique */}
                        {activeChapter.content && (
                            <button 
                                onClick={handleCritique}
                                disabled={critiquing}
                                className="absolute bottom-6 right-6 bg-pink-600 hover:bg-pink-500 text-white p-3 rounded-full shadow-lg shadow-pink-900/20 transition-all hover:scale-105"
                                title="运行审查"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                            </button>
                        )}
                    </>
                )}

                {mode === 'critique' && (
                    <div className="prose prose-invert max-w-none">
                        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
                            <span className="text-2xl">🧐</span>
                            <h4 className="text-pink-400 font-bold text-xl">Agent 审查报告</h4>
                        </div>
                        <div className="whitespace-pre-wrap text-slate-300 leading-relaxed bg-slate-800/30 p-6 rounded-xl border border-slate-800">
                            {activeChapter.critique || "暂无审查意见。请在编辑视图点击右下角按钮运行审查 Agent。"}
                        </div>
                    </div>
                )}

                {mode === 'adapt' && (
                    <div className="flex flex-col items-center gap-8 pt-10">
                        <div className="w-full max-w-3xl bg-black rounded-xl aspect-video flex items-center justify-center overflow-hidden border border-slate-700 relative shadow-2xl">
                            {activeChapter.animationUrl ? (
                                <video controls src={activeChapter.animationUrl} className="w-full h-full" />
                            ) : (
                                <div className="text-center p-6">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    </div>
                                    <p className="text-slate-400 mb-6 text-lg">根据本章概要生成 AI 动画预览</p>
                                    <button 
                                        onClick={handleVideo}
                                        disabled={generatingVideo}
                                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition-all hover:scale-105"
                                    >
                                        {generatingVideo ? 'Veo 渲染中 (约需1-2分钟)...' : '生成场景动画 (Veo)'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 max-w-lg">
                            <h5 className="text-slate-300 font-bold mb-2 flex items-center gap-2">
                                <span className="text-amber-500">⚠</span> 注意事项
                            </h5>
                            <p className="text-sm text-slate-400">
                                动画生成使用 Google Veo 模型。该功能需要消耗较多额度，且生成时间较长，请耐心等待。
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default StepWriter;
