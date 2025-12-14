import React, { useState, useRef } from 'react';
import { ProjectState, KnowledgeFile } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
}

const StepKnowledgeBase: React.FC<Props> = ({ project, setProject }) => {
  const { ragConfig } = project.agentConfig;
  const [activeTab, setActiveTab] = useState<'files' | 'notes' | 'urls'>('files');
  const [dragActive, setDragActive] = useState(false);
  
  // Inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newNote, setNewNote] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Handlers for File Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
      const newFile: KnowledgeFile = {
          id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: file.type || 'text/plain',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'processing'
      };

      // Add to state immediately as processing
      const updatedFiles = [...(project.knowledgeBaseFiles || []), newFile];
      setProject({ ...project, knowledgeBaseFiles: updatedFiles });

      // Simulate async processing/indexing
      setTimeout(() => {
          const filesAfterIndex = updatedFiles.map(f => 
             f.id === newFile.id ? { ...f, status: 'indexed' as const } : f
          );
          setProject({ ...project, knowledgeBaseFiles: filesAfterIndex });
      }, 1500 + Math.random() * 2000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          processFile(e.target.files[0]);
      }
  };

  const handleDelete = (id: string) => {
      setProject({
          ...project,
          knowledgeBaseFiles: (project.knowledgeBaseFiles || []).filter(f => f.id !== id)
      });
  };

  // Handlers for Notes
  const handleAddNote = () => {
      if(!newNote.trim()) return;
      const noteFile: KnowledgeFile = {
          id: `n-${Date.now()}`,
          name: `Note: ${newNote.substring(0, 15)}...`,
          size: `${newNote.length} chars`,
          type: 'application/x-note',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'indexed'
      };
      setProject({
          ...project,
          knowledgeBaseFiles: [...(project.knowledgeBaseFiles || []), noteFile]
      });
      setNewNote('');
  };

  // Handlers for URLs
  const handleAddUrl = () => {
      if(!newUrl.trim()) return;
      const urlFile: KnowledgeFile = {
          id: `u-${Date.now()}`,
          name: newUrl,
          size: 'Web Page',
          type: 'text/html',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'processing'
      };
      const updatedFiles = [...(project.knowledgeBaseFiles || []), urlFile];
      setProject({ ...project, knowledgeBaseFiles: updatedFiles });
      setNewUrl('');

      // Simulate crawling
      setTimeout(() => {
          setProject({
              ...project,
              knowledgeBaseFiles: updatedFiles.map(f => 
                  f.id === urlFile.id ? { ...f, status: 'indexed', size: '15 KB (Crawled)' } : f
              )
          });
      }, 3000);
  };

  const filteredFiles = (project.knowledgeBaseFiles || []).filter(f => {
      if (activeTab === 'files') return !f.type.includes('note') && !f.type.includes('html');
      if (activeTab === 'notes') return f.type.includes('note');
      if (activeTab === 'urls') return f.type.includes('html');
      return true;
  });

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4">
       {/* Header with RAG Config Summary */}
       <div className="flex items-center justify-between border-b border-slate-700 pb-4">
           <div>
               <h2 className="text-2xl font-bold text-white mb-1">{ragConfig.name || '小说知识库'}</h2>
               <div className="flex gap-3 text-xs text-slate-400">
                   <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                       <span className="text-slate-500">⚙️ 嵌入模型</span>
                       <span className="text-white">{ragConfig.embeddingModel.split('/').pop()}</span>
                   </div>
                   {ragConfig.rerankModel && (
                       <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                           <span className="text-slate-500">⇅ 重排模型</span>
                           <span className="text-white">{ragConfig.rerankModel.split('/').pop()}</span>
                       </div>
                   )}
                   <div className="flex items-center gap-1 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-900/50 text-amber-500">
                       <span>DB: {ragConfig.vectorStore}</span>
                   </div>
               </div>
           </div>
           <div>
               <button className="p-2 text-slate-400 hover:text-white transition-colors" title="Settings">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               </button>
           </div>
       </div>

       {/* Tabs & Actions */}
       <div className="flex justify-between items-center">
           <div className="flex gap-6 text-sm font-medium">
               <button 
                  onClick={() => setActiveTab('files')}
                  className={`pb-2 transition-colors flex items-center gap-2 ${activeTab === 'files' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
               >
                   📄 文件 <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 rounded-full">{(project.knowledgeBaseFiles || []).filter(f => !f.type.includes('note') && !f.type.includes('html')).length}</span>
               </button>
               <button 
                  onClick={() => setActiveTab('notes')}
                  className={`pb-2 transition-colors flex items-center gap-2 ${activeTab === 'notes' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
               >
                   📝 笔记 <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 rounded-full">{(project.knowledgeBaseFiles || []).filter(f => f.type.includes('note')).length}</span>
               </button>
               <button 
                  onClick={() => setActiveTab('urls')}
                  className={`pb-2 transition-colors flex items-center gap-2 ${activeTab === 'urls' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
               >
                   🔗 网址 <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 rounded-full">{(project.knowledgeBaseFiles || []).filter(f => f.type.includes('html')).length}</span>
               </button>
           </div>
           
           {activeTab === 'files' && (
               <>
                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                 >
                    <span>+</span> 上传文件
                 </button>
               </>
           )}
       </div>

       {/* Content Area */}
       <div className="flex-1 flex flex-col overflow-hidden">
           
           {/* FILE UPLOAD DRAG AREA */}
           {activeTab === 'files' && (
               <div 
                 className={`border-2 border-dashed rounded-xl p-8 text-center transition-all mb-4 ${dragActive ? 'border-emerald-500 bg-emerald-900/10' : 'border-slate-700 bg-slate-800/30'}`}
                 onDragEnter={handleDrag}
                 onDragLeave={handleDrag}
                 onDragOver={handleDrag}
                 onDrop={handleDrop}
               >
                   <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                       <p className="text-lg font-medium text-slate-300">拖拽文件到这里</p>
                       <p className="text-xs">支持 TXT, MD, PDF, DOCX, EPUB 格式</p>
                   </div>
               </div>
           )}

           {/* NOTES INPUT AREA */}
           {activeTab === 'notes' && (
               <div className="mb-4 flex gap-2">
                   <input 
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="快速记录设定或灵感..."
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                   />
                   <button onClick={handleAddNote} className="bg-slate-700 hover:bg-slate-600 px-4 rounded-lg text-white">添加</button>
               </div>
           )}

           {/* URL INPUT AREA */}
           {activeTab === 'urls' && (
               <div className="mb-4 flex gap-2">
                   <input 
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://example.com/wiki/entry"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                   />
                   <button onClick={handleAddUrl} className="bg-slate-700 hover:bg-slate-600 px-4 rounded-lg text-white">抓取</button>
               </div>
           )}

           {/* LIST */}
           <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
               {filteredFiles.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">该分类下暂无内容。</div>
               ) : (
                   filteredFiles.map(file => (
                       <div key={file.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between group hover:border-slate-600 transition-all">
                           <div className="flex items-center gap-3">
                               <div className={`w-10 h-10 rounded flex items-center justify-center font-bold text-sm ${
                                   file.type.includes('note') ? 'bg-indigo-900/50 text-indigo-400' :
                                   file.type.includes('html') ? 'bg-blue-900/50 text-blue-400' :
                                   'bg-slate-700 text-slate-300'
                               }`}>
                                   {file.type.includes('note') ? 'TXT' : file.type.includes('html') ? 'WEB' : file.name.split('.').pop()?.toUpperCase().substring(0,3)}
                               </div>
                               <div>
                                   <h4 className="text-slate-200 text-sm font-medium line-clamp-1">{file.name}</h4>
                                   <p className="text-xs text-slate-500">{file.uploadDate} · {file.size}</p>
                               </div>
                           </div>
                           <div className="flex items-center gap-3">
                               {file.status === 'indexed' ? (
                                   <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-900/20 px-2 py-0.5 rounded">
                                       <span>已索引</span>
                                   </div>
                               ) : file.status === 'processing' ? (
                                   <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-900/20 px-2 py-0.5 rounded">
                                       <span className="animate-spin">⟳</span> 处理中
                                   </div>
                               ) : (
                                   <div className="text-xs text-red-500">错误</div>
                               )}
                               
                               <button 
                                   className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                                   title="删除" 
                                   onClick={() => handleDelete(file.id)}
                               >
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                               </button>
                           </div>
                       </div>
                   ))
               )}
           </div>
       </div>
    </div>
  );
};

export default StepKnowledgeBase;
