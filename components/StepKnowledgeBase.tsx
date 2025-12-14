
import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, KnowledgeFile, RAGConfig, TextChunk } from '../types';
import RagSettingsModal from './RagSettingsModal';
import mammoth from 'mammoth';

interface Props {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
}

// Helper to read file as text
const readFileAsText = async (file: File): Promise<string> => {
    if (file.name.endsWith('.docx')) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        } catch (e: any) {
            console.error("DOCX parse error", e);
            return `[Error: ${e.message}]`;
        }
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

// --- CHUNKING STRATEGIES ---

// 1. Recursive / Semantic (Existing)
const recursiveSplitText = (text: string, chunkSize: number, chunkOverlap: number): TextChunk[] => {
    const chunks: TextChunk[] = [];
    if (!text) return chunks;

    let startIndex = 0;
    while (startIndex < text.length) {
        let endIndex = startIndex + chunkSize;
        if (endIndex < text.length) {
            let splitIndex = text.lastIndexOf('\n\n', endIndex);
            if (splitIndex === -1 || splitIndex < startIndex + chunkSize * 0.5) splitIndex = text.lastIndexOf('\n', endIndex);
            if (splitIndex === -1 || splitIndex < startIndex + chunkSize * 0.5) splitIndex = text.lastIndexOf(' ', endIndex);
            
            if (splitIndex > startIndex) {
                endIndex = splitIndex;
                if (text[endIndex] === '\n') endIndex += 1;
            }
        } else {
            endIndex = text.length;
        }

        const chunkText = text.substring(startIndex, endIndex);
        if (chunkText.trim().length > 0) {
            chunks.push({
                id: `chk-${Date.now()}-${chunks.length}`,
                text: chunkText.trim(),
                startIndex,
                endIndex
            });
        }
        const nextStart = Math.max(startIndex + 1, endIndex - chunkOverlap);
        startIndex = nextStart <= startIndex ? endIndex : nextStart;
        if (endIndex >= text.length) break;
    }
    return chunks;
};

// 2. Markdown Header Split
const markdownSplitText = (text: string): TextChunk[] => {
    const chunks: TextChunk[] = [];
    // Regex for headers # to ######
    const regex = /(^|\n)(#{1,6})\s+(.+)/g; 
    let match;
    let lastIndex = 0;
    
    // Find all headers
    const matches = Array.from(text.matchAll(regex));
    
    if (matches.length === 0) return recursiveSplitText(text, 1000, 100); // Fallback

    for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        
        const start = currentMatch.index!;
        const end = nextMatch ? nextMatch.index! : text.length;
        
        const content = text.substring(start, end).trim();
        if (content) {
            chunks.push({
                id: `md-${i}`,
                text: content,
                startIndex: start,
                endIndex: end
            });
        }
    }
    // Add preamble if any
    if (matches.length > 0 && matches[0].index! > 0) {
         chunks.unshift({
             id: 'preamble',
             text: text.substring(0, matches[0].index!).trim(),
             startIndex: 0,
             endIndex: matches[0].index!
         });
    }

    return chunks;
};

const splitText = (text: string, strategy: string | undefined, chunkSize: number, chunkOverlap: number) => {
    if (strategy === 'markdown') return markdownSplitText(text);
    return recursiveSplitText(text, chunkSize, chunkOverlap);
};

const StepKnowledgeBase: React.FC<Props> = ({ project, setProject }) => {
  const { ragConfigs } = project.agentConfig;
  const [selectedKbId, setSelectedKbId] = useState<string | null>(ragConfigs.length > 0 ? ragConfigs[0].id : null);
  const activeKb = ragConfigs.find(k => k.id === selectedKbId);
  const [activeTab, setActiveTab] = useState<'files' | 'test'>('files');
  const [showSettings, setShowSettings] = useState(false);
  
  const processFile = async (file: File) => {
      if (!selectedKbId || !activeKb) return;
      let content = await readFileAsText(file);
      
      const chunks = splitText(content, activeKb.chunkingStrategy, activeKb.chunkSize || 512, activeKb.chunkOverlap || 64);

      const newFile: KnowledgeFile = {
          id: `f-${Date.now()}`,
          kbId: selectedKbId,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: file.type || 'text/plain',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'indexed',
          progress: 100,
          totalChunks: chunks.length,
          content: content,
          chunks: chunks
      };

      setProject(prev => ({
          ...prev, 
          knowledgeBaseFiles: [...(prev.knowledgeBaseFiles || []), newFile]
      }));
  };

  const currentFiles = project.knowledgeBaseFiles.filter(f => f.kbId === selectedKbId);

  return (
    <div className="flex h-full animate-fade-in gap-4">
       {showSettings && activeKb && (
           <RagSettingsModal 
                config={activeKb} 
                onSave={(c) => {
                    setProject(p => ({
                        ...p, agentConfig: { ...p.agentConfig, ragConfigs: p.agentConfig.ragConfigs.map(k => k.id === c.id ? c : k) }
                    }));
                    setShowSettings(false);
                }} 
                onClose={() => setShowSettings(false)} 
           />
       )}

       <div className="w-64 bg-[#151b28] border border-slate-700 rounded-xl flex flex-col overflow-hidden shadow-lg hidden md:flex">
           <div className="p-4 bg-[#0f1219] border-b border-slate-700">
               <h3 className="font-bold text-slate-300">知识库</h3>
           </div>
           <div className="flex-1 p-2 space-y-1">
               {ragConfigs.map(kb => (
                   <div key={kb.id} onClick={() => setSelectedKbId(kb.id)} className={`p-3 rounded cursor-pointer ${selectedKbId === kb.id ? 'bg-slate-800 border border-emerald-500/50' : 'hover:bg-slate-800/50'}`}>
                       <div className="text-sm font-bold text-slate-200">{kb.name}</div>
                       <div className="text-xs text-slate-500">{kb.chunkingStrategy || 'semantic'} mode</div>
                   </div>
               ))}
           </div>
       </div>

       <div className="flex-1 flex flex-col bg-[#1e293b] rounded-xl border border-slate-700 shadow-xl overflow-hidden">
           {activeKb ? (
               <>
                   <div className="h-16 border-b border-slate-700 px-6 flex items-center justify-between bg-[#151b28]">
                       <h2 className="font-bold text-white">{activeKb.name}</h2>
                       <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-800 rounded">⚙️ 设置</button>
                   </div>
                   <div className="p-6 flex-1 overflow-y-auto">
                       <div className="mb-4">
                           <input type="file" onChange={(e) => e.target.files && processFile(e.target.files[0])} className="hidden" id="upload" />
                           <label htmlFor="upload" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded cursor-pointer inline-block">上传文件</label>
                       </div>
                       <div className="space-y-2">
                           {currentFiles.map(f => (
                               <div key={f.id} className="bg-slate-800/50 p-3 rounded flex justify-between">
                                   <span>{f.name}</span>
                                   <span className="text-slate-500 text-sm">{f.totalChunks} 切片 ({activeKb.chunkingStrategy || 'semantic'})</span>
                               </div>
                           ))}
                       </div>
                   </div>
               </>
           ) : <div className="p-6 text-slate-500">选择知识库</div>}
       </div>
    </div>
  );
};
export default StepKnowledgeBase;
