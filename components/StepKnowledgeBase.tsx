import React, { useState } from 'react';
import { ProjectState, KnowledgeFile } from '../types';

interface Props {
  project: ProjectState;
  setProject: (p: ProjectState) => void;
}

const StepKnowledgeBase: React.FC<Props> = ({ project, setProject }) => {
  const { ragConfig } = project.agentConfig;
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Simulation of file upload
      const file = e.dataTransfer.files[0];
      const newFile: KnowledgeFile = {
          id: `f-${Date.now()}`,
          name: file.name,
          size: `${(file.size / 1024).toFixed(0)} KB`,
          type: file.type || 'Unknown',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'indexed' // Simulating instant indexing
      };
      setProject({
          ...project,
          knowledgeBaseFiles: [...(project.knowledgeBaseFiles || []), newFile]
      });
    }
  };

  const handleDelete = (id: string) => {
      setProject({
          ...project,
          knowledgeBaseFiles: (project.knowledgeBaseFiles || []).filter(f => f.id !== id)
      });
  };

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
                       <span>MinerU 剩余额度: 500</span>
                   </div>
               </div>
           </div>
           <div>
               <button className="p-2 text-slate-400 hover:text-white transition-colors">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               </button>
           </div>
       </div>

       {/* Tabs & Actions */}
       <div className="flex justify-between items-center">
           <div className="flex gap-6 text-sm font-medium">
               <button className="text-emerald-500 border-b-2 border-emerald-500 pb-2 flex items-center gap-2">
                   📄 文件 <span className="bg-emerald-900 text-emerald-300 text-[10px] px-1.5 rounded-full">{(project.knowledgeBaseFiles || []).length}</span>
               </button>
               <button className="text-slate-500 hover:text-slate-300 pb-2 transition-colors flex items-center gap-2">
                   📝 笔记 <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 rounded-full">0</span>
               </button>
               <button className="text-slate-500 hover:text-slate-300 pb-2 transition-colors flex items-center gap-2">
                   📁 目录 <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 rounded-full">0</span>
               </button>
               <button className="text-slate-500 hover:text-slate-300 pb-2 transition-colors flex items-center gap-2">
                   🔗 网址 <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 rounded-full">0</span>
               </button>
           </div>
           <button className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-900/20">
               <span>+</span> 添加文件
           </button>
       </div>

       {/* Drag & Drop Area */}
       <div 
         className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive ? 'border-emerald-500 bg-emerald-900/10' : 'border-slate-700 bg-slate-800/30'}`}
         onDragEnter={handleDrag}
         onDragLeave={handleDrag}
         onDragOver={handleDrag}
         onDrop={handleDrop}
       >
           <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
               <p className="text-lg font-medium text-slate-300">拖拽文件到这里</p>
               <p className="text-xs">支持 TXT, MD, HTML, PDF, DOCX, PPTX, XLSX, EPUB... 格式</p>
           </div>
       </div>

       {/* File List */}
       <div className="flex-1 overflow-y-auto space-y-2">
           {(project.knowledgeBaseFiles || []).length === 0 ? (
                <div className="text-center text-slate-500 py-10">暂无文件，请上传。</div>
           ) : (
               (project.knowledgeBaseFiles || []).map(file => (
                   <div key={file.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between group hover:border-slate-600 transition-all">
                       <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-slate-700 rounded flex items-center justify-center text-slate-300 font-bold">
                               {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                           </div>
                           <div>
                               <h4 className="text-slate-200 text-sm font-medium">{file.name}</h4>
                               <p className="text-xs text-slate-500">{file.uploadDate} · {file.size}</p>
                           </div>
                       </div>
                       <div className="flex items-center gap-3">
                           {file.status === 'indexed' && (
                               <div className="flex items-center gap-2 text-xs text-emerald-500">
                                   <span className="w-4 h-4 rounded-full border border-emerald-500 flex items-center justify-center">✓</span>
                               </div>
                           )}
                           <div className="flex items-center gap-2 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button className="hover:text-white p-1" title="Reload">↻</button>
                               <button className="hover:text-white p-1" title="Check">✓</button>
                               <button className="hover:text-white p-1" title="Info">ⓘ</button>
                               <button className="hover:text-red-400 p-1" title="Delete" onClick={() => handleDelete(file.id)}>🗑</button>
                           </div>
                       </div>
                   </div>
               ))
           )}
       </div>
    </div>
  );
};

export default StepKnowledgeBase;
