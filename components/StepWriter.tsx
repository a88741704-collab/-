import React, { useState } from 'react';
import { writeChapterContent, critiqueDraft, generateSceneVideo } from '../geminiService';
import { ProjectState } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
}

const StepWriter: React.FC<Props> = ({ project, setProject }) => {
  // Select first chapter by default if not selected
  const [selectedChapId, setSelectedChapId] = useState<string | null>(
      project.chapters.length > 0 ? (project.chapters[0].id || '0') : null // Fallback if ID missing in parsed JSON
  );
  
  // Workaround because generated IDs might be unstable, use index mapping for this demo
  const activeChapterIndex = project.chapters.findIndex(c => c.id === selectedChapId) !== -1 
     ? project.chapters.findIndex(c => c.id === selectedChapId)
     : 0;
  
  const activeChapter = project.chapters[activeChapterIndex];

  const [writing, setWriting] = useState(false);
  const [critiquing, setCritiquing] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [mode, setMode] = useState<'edit' | 'critique' | 'adapt'>('edit');

  const updateChapter = (updates: Partial<typeof activeChapter>) => {
      const newChapters = [...project.chapters];
      newChapters[activeChapterIndex] = { ...activeChapter, ...updates };
      setProject({ ...project, chapters: newChapters });
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
           // Simulate check or alert user. In real implementation, wrap button with check.
      }
      setGeneratingVideo(true);
      setProject({ ...project, agentStatus: 'generating', agentTask: '正在渲染场景动画 (Veo)...' });
      try {
          // Use summary as prompt for the scene
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

  if (!activeChapter) return <div className="p-10 text-center text-slate-500">请先在上一阶段生成大纲。</div>;

  return (
    <div className="h-full flex gap-6">
        {/* Left: Chapter Nav */}
        <div className="w-64 flex-shrink-0 glass-panel rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 font-bold text-slate-300">章节列表</div>
            <div className="flex-1 overflow-y-auto">
                {project.chapters.map((chap, idx) => (
                    <button
                        key={idx}
                        onClick={() => setSelectedChapId(chap.id || String(idx))} // Fallback ID logic
                        className={`w-full text-left px-4 py-3 text-sm border-b border-slate-800 ${
                            idx === activeChapterIndex ? 'bg-indigo-600/20 text-indigo-300 border-l-4 border-l-indigo-500' : 'text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        <div className="font-mono text-xs opacity-50">第 {chap.number} 章</div>
                        <div className="truncate">{chap.title}</div>
                    </button>
                ))}
            </div>
        </div>

        {/* Center: Content */}
        <div className="flex-1 flex flex-col glass-panel rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-900/50">
                <h3 className="font-bold text-slate-200">{activeChapter.title}</h3>
                <div className="flex gap-2">
                    <div className="bg-slate-800 p-1 rounded-lg flex gap-1">
                        <button onClick={() => setMode('edit')} className={`px-3 py-1 text-xs rounded ${mode === 'edit' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>编辑器</button>
                        <button onClick={() => setMode('critique')} className={`px-3 py-1 text-xs rounded ${mode === 'critique' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>审查意见</button>
                        <button onClick={() => setMode('adapt')} className={`px-3 py-1 text-xs rounded ${mode === 'adapt' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>视觉改编</button>
                    </div>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto p-8 relative">
                {mode === 'edit' && (
                    <>
                        {!activeChapter.content ? (
                             <div className="h-full flex flex-col items-center justify-center space-y-4">
                                 <p className="text-slate-500 max-w-md text-center">本章暂无内容。使用 Agent 根据大纲自动撰写草稿。</p>
                                 <button 
                                    onClick={handleWrite}
                                    disabled={writing}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg font-bold"
                                 >
                                     {writing ? '正在撰写...' : 'AI 自动写作 (Agent)'}
                                 </button>
                             </div>
                        ) : (
                            <textarea 
                                className="w-full h-full bg-transparent text-slate-300 font-serif text-lg leading-loose resize-none focus:outline-none"
                                value={activeChapter.content}
                                onChange={(e) => updateChapter({ content: e.target.value })}
                            />
                        )}
                        {/* Floating Action for Critique */}
                        {activeChapter.content && (
                            <button 
                                onClick={handleCritique}
                                disabled={critiquing}
                                className="absolute bottom-6 right-6 bg-pink-600 hover:bg-pink-500 text-white p-3 rounded-full shadow-lg"
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
                        <h4 className="text-pink-400 font-bold mb-4">Agent 审查报告</h4>
                        <div className="whitespace-pre-wrap text-slate-300">
                            {activeChapter.critique || "暂无审查意见。请在编辑视图运行审查 Agent。"}
                        </div>
                    </div>
                )}

                {mode === 'adapt' && (
                    <div className="flex flex-col items-center gap-8">
                        <div className="w-full max-w-2xl bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden border border-slate-700 relative">
                            {activeChapter.animationUrl ? (
                                <video controls src={activeChapter.animationUrl} className="w-full h-full" />
                            ) : (
                                <div className="text-center p-6">
                                    <p className="text-slate-500 mb-4">根据本章概要生成 AI 动画。</p>
                                    <button 
                                        onClick={handleVideo}
                                        disabled={generatingVideo}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                                    >
                                        {generatingVideo ? 'Veo 渲染中...' : '生成动画'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="text-sm text-slate-500 max-w-lg text-center">
                            注意：动画生成使用 Google Veo 模型。请确保已选择付费 API Key。
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default StepWriter;