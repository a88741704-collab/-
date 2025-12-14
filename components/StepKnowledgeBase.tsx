import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, KnowledgeFile, RAGConfig } from '../types';
import RagSettingsModal from './RagSettingsModal';

interface Props {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
}

interface SearchResult {
    id: string;
    text: string;
    source: string;
    score: number;
}

// Helper to read file as text
const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        // Only attempt to read text-ish files
        if (file.type.match(/text.*/) || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.txt')) {
             reader.readAsText(file);
        } else {
             // For binary files (pdf/doc) in this frontend-only demo, we can't easily parse them.
             // We'll return a placeholder to indicate this limitation.
             resolve(`[Binary content of ${file.name} cannot be previewed in this local demo]`);
        }
    });
};

const StepKnowledgeBase: React.FC<Props> = ({ project, setProject }) => {
  const { ragConfigs } = project.agentConfig;
  
  // State for selected KB
  const [selectedKbId, setSelectedKbId] = useState<string | null>(ragConfigs.length > 0 ? ragConfigs[0].id : null);
  const activeKb = ragConfigs.find(k => k.id === selectedKbId);

  const [activeTab, setActiveTab] = useState<'files' | 'notes' | 'urls' | 'test'>('files');
  const [dragActive, setDragActive] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newNote, setNewNote] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Search Test State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // If no KB selected but list exists, select first
  useEffect(() => {
      if (!selectedKbId && ragConfigs.length > 0) {
          setSelectedKbId(ragConfigs[0].id);
      }
  }, [ragConfigs, selectedKbId]);

  // --- Handlers for KB Management ---

  const handleAddKb = () => {
      const newId = `kb-${Date.now()}`;
      const newKb: RAGConfig = {
          id: newId,
          enabled: true,
          name: 'New Knowledge Base',
          embeddingModel: 'BAAI/bge-large-zh-v1.5',
          embeddingDimension: 1024,
          topK: 10,
          useSeparateApi: false,
          vectorStore: 'local',
          vectorStoreCollection: 'new_collection'
      };
      setProject(prev => ({
          ...prev,
          agentConfig: {
              ...prev.agentConfig,
              ragConfigs: [...prev.agentConfig.ragConfigs, newKb]
          }
      }));
      setSelectedKbId(newId);
  };

  const handleToggleKb = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setProject(prev => ({
          ...prev,
          agentConfig: {
              ...prev.agentConfig,
              ragConfigs: prev.agentConfig.ragConfigs.map(k => k.id === id ? { ...k, enabled: !k.enabled } : k)
          }
      }));
  };

  const handleDeleteKb = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Confirm delete this knowledge base?')) {
        setProject(prev => ({
            ...prev,
            agentConfig: {
                ...prev.agentConfig,
                ragConfigs: prev.agentConfig.ragConfigs.filter(k => k.id !== id)
            }
        }));
        if (selectedKbId === id) setSelectedKbId(null);
    }
  };

  // --- Handlers for Files ---

  const processFile = async (file: File) => {
      if (!selectedKbId) return;

      // 1. Read File Content Real-time
      let content = '';
      try {
          content = await readFileAsText(file);
      } catch (e) {
          console.error("Failed to read file", e);
          content = "Read Error";
      }

      // 2. Create Entry
      const newFile: KnowledgeFile = {
          id: `f-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
          kbId: selectedKbId,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: file.type || 'text/plain',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'processing',
          progress: 0,
          totalChunks: 0,
          content: content // Store real content
      };

      setProject(prev => ({
          ...prev, 
          knowledgeBaseFiles: [...(prev.knowledgeBaseFiles || []), newFile]
      }));

      // Simulate Processing
      const chunkSize = activeKb?.chunkSize || 512;
      const estimatedChunks = Math.max(1, Math.ceil(file.size / chunkSize));
      const processingSpeed = 20; 
      const updateInterval = 200;
      const chunksPerTick = Math.max(1, Math.ceil(processingSpeed * (updateInterval / 1000)));

      let processedChunks = 0;
      const timer = setInterval(() => {
          processedChunks += chunksPerTick;
          const rawProgress = (processedChunks / estimatedChunks) * 100;
          const progress = Math.min(99, rawProgress);

          setProject(prev => ({
              ...prev,
              knowledgeBaseFiles: prev.knowledgeBaseFiles.map(f => 
                  f.id === newFile.id 
                  ? { ...f, progress: progress, totalChunks: estimatedChunks } 
                  : f
              )
          }));

          if (processedChunks >= estimatedChunks) {
              clearInterval(timer);
              setTimeout(() => {
                  setProject(prev => ({
                      ...prev,
                      knowledgeBaseFiles: prev.knowledgeBaseFiles.map(f => 
                          f.id === newFile.id 
                          ? { ...f, status: 'indexed', progress: 100 } 
                          : f
                      )
                  }));
              }, 600);
          }
      }, updateInterval);
  };

  const handleDrag = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
      else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          Array.from(e.dataTransfer.files).forEach(f => processFile(f));
      }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          Array.from(e.target.files).forEach(file => processFile(file));
      }
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  const handleReindex = (id: string) => {
      if (reindexingId) return;
      setReindexingId(id);
      
      const targetFile = project.knowledgeBaseFiles.find(f => f.id === id);
      const estSize = targetFile ? parseInt(targetFile.size) * 1024 : 10000;
      const estChunks = Math.ceil(estSize / 512);

      setProject(prev => ({
          ...prev,
          knowledgeBaseFiles: prev.knowledgeBaseFiles.map(f => 
             f.id === id ? { ...f, status: 'processing', progress: 0 } : f
          )
      }));

      let progress = 0;
      const interval = setInterval(() => {
          progress += 5;
          setProject(prev => ({
              ...prev,
              knowledgeBaseFiles: prev.knowledgeBaseFiles.map(f => 
                  f.id === id ? { ...f, progress: Math.min(99, progress) } : f
              )
          }));

          if (progress >= 100) {
              clearInterval(interval);
              setTimeout(() => {
                  setProject(prev => ({
                      ...prev,
                      knowledgeBaseFiles: prev.knowledgeBaseFiles.map(f => 
                          f.id === id ? { ...f, status: 'indexed', progress: 100 } : f
                      )
                  }));
                  setReindexingId(null);
              }, 500);
          }
      }, 100);
  };

  const handleDeleteFile = (id: string) => {
      setProject(prev => ({
          ...prev,
          knowledgeBaseFiles: prev.knowledgeBaseFiles.filter(f => f.id !== id)
      }));
  };

  // --- Handlers for Notes & URLs ---
  const handleAddNote = () => {
      if(!newNote.trim() || !selectedKbId) return;
      const noteFile: KnowledgeFile = {
          id: `n-${Date.now()}`,
          kbId: selectedKbId,
          name: `Note: ${newNote.substring(0, 15)}...`,
          size: `${newNote.length} chars`,
          type: 'application/x-note',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'indexed',
          progress: 100,
          content: newNote // Store content
      };
      setProject(prev => ({ ...prev, knowledgeBaseFiles: [...prev.knowledgeBaseFiles, noteFile] }));
      setNewNote('');
  };

  const handleAddUrl = () => {
      if(!newUrl.trim() || !selectedKbId) return;
      const urlFile: KnowledgeFile = {
          id: `u-${Date.now()}`,
          kbId: selectedKbId,
          name: newUrl,
          size: 'Web Page',
          type: 'text/html',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'processing',
          progress: 0,
          content: `Simulated crawled content for ${newUrl}. This would contain text from the webpage.`
      };
      setProject(prev => ({ ...prev, knowledgeBaseFiles: [...prev.knowledgeBaseFiles, urlFile] }));
      setNewUrl('');
      
      let p = 0;
      const interval = setInterval(() => {
          p += 5;
          setProject(prev => ({
              ...prev,
              knowledgeBaseFiles: prev.knowledgeBaseFiles.map(f => f.id === urlFile.id ? { ...f, progress: p } : f)
          }));
          if(p >= 100) {
              clearInterval(interval);
              setProject(prev => ({
                  ...prev,
                  knowledgeBaseFiles: prev.knowledgeBaseFiles.map(f => f.id === urlFile.id ? { ...f, status: 'indexed', size: '15 KB (Crawled)', progress: 100 } : f)
              }));
          }
      }, 100);
  };

  const handleSaveSettings = (newRagConfig: RAGConfig) => {
      setProject(prev => ({
          ...prev,
          agentConfig: {
              ...prev.agentConfig,
              ragConfigs: prev.agentConfig.ragConfigs.map(k => k.id === newRagConfig.id ? newRagConfig : k)
          }
      }));
      setShowSettings(false);
  };

  // --- Real Search Implementation ---
  const performSearch = () => {
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      setSearchResults([]);
      
      // We simulate a small delay to make it feel like "searching"
      setTimeout(() => {
          const currentFiles = project.knowledgeBaseFiles.filter(f => f.kbId === selectedKbId);
          const results: SearchResult[] = [];
          
          currentFiles.forEach(file => {
             if (!file.content) return;
             
             const lowerContent = file.content.toLowerCase();
             const lowerQuery = searchQuery.toLowerCase();
             
             // Simple string matching simulation for RAG
             // In a real RAG, this would be vector similarity
             if (lowerContent.includes(lowerQuery)) {
                 // Find all occurrences or best occurrence
                 const idx = lowerContent.indexOf(lowerQuery);
                 // Extract window around match
                 const start = Math.max(0, idx - 50);
                 const end = Math.min(file.content.length, idx + lowerQuery.length + 100);
                 let snippet = file.content.substring(start, end);
                 if (start > 0) snippet = "..." + snippet;
                 if (end < file.content.length) snippet = snippet + "...";

                 results.push({
                     id: `res-${file.id}-${idx}`,
                     text: snippet,
                     source: file.name,
                     // Fake score: mostly high if exact match found
                     score: 85 + Math.random() * 14
                 });
             }
          });

          setSearchResults(results.sort((a,b) => b.score - a.score));
          setIsSearching(false);
      }, 600);
  };

  // Highlight helper
  const HighlightedText = ({ text, query }: { text: string, query: string }) => {
      if (!query) return <span>{text}</span>;
      // Escape regex special characters from query
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${safeQuery})`, 'gi'));
      return (
          <span>
              {parts.map((part, i) => 
                  part.toLowerCase() === query.toLowerCase() 
                  ? <span key={i} className="bg-orange-500/20 text-orange-400 border-b border-orange-500/50 mx-0.5 px-0.5 rounded-sm font-medium">{part}</span> 
                  : part
              )}
          </span>
      );
  };

  // Filter files for current KB
  const currentFiles = project.knowledgeBaseFiles.filter(f => f.kbId === selectedKbId);
  
  const filteredList = currentFiles.filter(f => {
      if (activeTab === 'files') return !f.type.includes('note') && !f.type.includes('html');
      if (activeTab === 'notes') return f.type.includes('note');
      if (activeTab === 'urls') return f.type.includes('html');
      return false;
  });

  return (
    <div className="flex h-full animate-fade-in gap-4">
       {/* Modal for Settings */}
       {showSettings && activeKb && (
           <RagSettingsModal 
                config={activeKb} 
                onSave={handleSaveSettings} 
                onClose={() => setShowSettings(false)} 
           />
       )}

       {/* LEFT SIDEBAR: KB List */}
       <div className="w-64 bg-[#151b28] border border-slate-700 rounded-xl flex flex-col overflow-hidden shadow-lg">
           <div className="p-4 border-b border-slate-700 bg-[#0f1219]">
               <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Knowledge Bases</h3>
               <button 
                  onClick={handleAddKb}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors flex items-center justify-center gap-2"
               >
                   <span>+</span> Create New
               </button>
           </div>
           <div className="flex-1 overflow-y-auto p-2 space-y-1">
               {ragConfigs.map(kb => (
                   <div 
                      key={kb.id}
                      onClick={() => setSelectedKbId(kb.id)}
                      className={`group p-3 rounded-lg cursor-pointer border transition-all ${
                          selectedKbId === kb.id 
                          ? 'bg-slate-800 border-indigo-500/50' 
                          : 'bg-transparent border-transparent hover:bg-slate-800/50'
                      }`}
                   >
                       <div className="flex justify-between items-start mb-1">
                           <h4 className={`text-sm font-medium truncate ${selectedKbId === kb.id ? 'text-white' : 'text-slate-400'}`}>{kb.name}</h4>
                           <div className="flex items-center gap-2">
                               {/* Toggle */}
                               <div 
                                  onClick={(e) => handleToggleKb(kb.id, e)}
                                  className={`w-6 h-3 rounded-full relative transition-colors cursor-pointer ${kb.enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                  title={kb.enabled ? 'Enabled' : 'Disabled'}
                               >
                                  <div className={`w-2 h-2 bg-white rounded-full absolute top-0.5 transition-all ${kb.enabled ? 'right-0.5' : 'left-0.5'}`}></div>
                               </div>
                           </div>
                       </div>
                       <div className="flex justify-between items-center text-[10px] text-slate-500">
                           <span className="truncate max-w-[80px]">{kb.embeddingModel.split('/').pop()}</span>
                           <button 
                              onClick={(e) => handleDeleteKb(kb.id, e)}
                              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                           >
                               Trash
                           </button>
                       </div>
                   </div>
               ))}
           </div>
       </div>

       {/* MAIN CONTENT */}
       <div className="flex-1 flex flex-col bg-[#1e293b] rounded-xl border border-slate-700 shadow-xl overflow-hidden">
           {/* Header */}
           {activeKb ? (
               <div className="h-16 border-b border-slate-700 px-6 flex items-center justify-between bg-[#151b28]">
                   <div>
                       <h2 className="text-xl font-bold text-white flex items-center gap-2">
                           {activeKb.name}
                           {!activeKb.enabled && <span className="bg-slate-700 text-slate-400 text-[10px] px-2 py-0.5 rounded">DISABLED</span>}
                       </h2>
                       <div className="flex gap-4 text-xs text-slate-400">
                           <span className="flex items-center gap-1">Model: <span className="text-emerald-400">{activeKb.embeddingModel}</span></span>
                           <span className="flex items-center gap-1">Store: <span className="text-indigo-400">{activeKb.vectorStore}</span></span>
                       </div>
                   </div>
                   <button 
                      onClick={() => setShowSettings(true)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700"
                      title="KB Settings"
                   >
                       ⚙️ Settings
                   </button>
               </div>
           ) : (
               <div className="h-16 border-b border-slate-700 px-6 flex items-center bg-[#151b28]">
                   <span className="text-slate-500">No Knowledge Base Selected</span>
               </div>
           )}

           {/* Tabs */}
           <div className="px-6 pt-4 border-b border-slate-700 bg-[#1e293b]">
               <div className="flex gap-6 text-sm font-medium">
                   {['files', 'notes', 'urls'].map(tab => (
                       <button 
                          key={tab}
                          onClick={() => setActiveTab(tab as any)}
                          className={`pb-3 border-b-2 transition-all capitalize ${activeTab === tab ? 'text-emerald-500 border-emerald-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                       >
                           {tab} <span className="ml-1 bg-slate-800 text-[10px] px-1.5 rounded-full text-slate-400">
                               {currentFiles.filter(f => {
                                   if (tab === 'files') return !f.type.includes('note') && !f.type.includes('html');
                                   if (tab === 'notes') return f.type.includes('note');
                                   return f.type.includes('html');
                               }).length}
                           </span>
                       </button>
                   ))}
                   <button 
                      onClick={() => setActiveTab('test')}
                      className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${activeTab === 'test' ? 'text-amber-500 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                   >
                       🔍 Search Test
                   </button>
               </div>
           </div>

           {/* Content Body */}
           <div className="flex-1 overflow-hidden relative p-6 bg-[#0f172a]/50">
               
               {/* --- SEARCH TEST TAB --- */}
               {activeTab === 'test' && (
                   <div className="flex flex-col h-full max-w-4xl mx-auto">
                       <div className="flex gap-2 mb-6">
                           <input 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Enter query to search within your uploaded files..."
                              className="flex-1 bg-slate-800/80 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none shadow-inner"
                              onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                           />
                           <button 
                              onClick={performSearch}
                              className="px-6 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-lg shadow-amber-900/20"
                           >
                               {isSearching ? 'Searching...' : 'Search'}
                           </button>
                       </div>

                       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                           {searchResults.length === 0 && !isSearching && (
                               <div className="text-center text-slate-500 mt-20">
                                   <div className="text-4xl mb-4 opacity-30">🔍</div>
                                   <p>{currentFiles.length === 0 ? "No files indexed. Upload some text files first." : "Enter a keyword to search your documents."}</p>
                               </div>
                           )}
                           
                           {isSearching && (
                               <div className="space-y-4">
                                   {[1,2,3].map(i => (
                                       <div key={i} className="h-32 bg-slate-800/50 rounded-xl animate-pulse"></div>
                                   ))}
                               </div>
                           )}
                            
                           {searchResults.length === 0 && searchQuery && !isSearching && currentFiles.length > 0 && (
                               <div className="text-center text-slate-500 mt-10">
                                   No matches found for "{searchQuery}".
                               </div>
                           )}

                           {searchResults.map((res) => (
                               <div key={res.id} className="bg-emerald-900/10 border border-emerald-500/30 rounded-lg p-4 shadow-lg hover:border-emerald-500/50 transition-colors">
                                   <div className="flex justify-between items-start mb-3">
                                       <div className="flex items-center gap-2 text-xs text-slate-400">
                                           <span className="text-slate-500">来源:</span>
                                           <span className="text-blue-400 underline cursor-pointer hover:text-blue-300 truncate max-w-md">{res.source}</span>
                                       </div>
                                       <div className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-sm">
                                           Score: {res.score.toFixed(1)}%
                                       </div>
                                   </div>
                                   <p className="text-slate-300 text-sm leading-relaxed font-serif">
                                       <HighlightedText text={res.text} query={searchQuery} />
                                   </p>
                               </div>
                           ))}
                       </div>
                   </div>
               )}

               {/* --- FILES/NOTES/URLS TABS --- */}
               {activeTab !== 'test' && (
                   <div className="h-full flex flex-col">
                       {/* Actions */}
                       <div className="flex justify-between mb-4">
                           <div className="text-sm text-slate-400 flex items-center gap-2">
                               {activeTab === 'files' && 'Manage your source documents.'}
                               {activeTab === 'notes' && 'Quick thoughts & raw text inputs.'}
                               {activeTab === 'urls' && 'Web pages to crawl & index.'}
                           </div>

                           {activeTab === 'files' && (
                               <>
                                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple className="hidden" />
                                 <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                                 >
                                    <span>+</span> Upload Files
                                 </button>
                               </>
                           )}
                           {activeTab === 'notes' && (
                               <div className="flex gap-2 w-1/2">
                                   <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Type a note..." className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none" onKeyDown={(e) => e.key === 'Enter' && handleAddNote()} />
                                   <button onClick={handleAddNote} className="bg-slate-700 hover:bg-slate-600 px-3 rounded text-white text-sm">Add</button>
                               </div>
                           )}
                           {activeTab === 'urls' && (
                               <div className="flex gap-2 w-1/2">
                                   <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none" onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()} />
                                   <button onClick={handleAddUrl} className="bg-slate-700 hover:bg-slate-600 px-3 rounded text-white text-sm">Crawl</button>
                               </div>
                           )}
                       </div>

                       {/* List */}
                       <div 
                         className={`flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2 ${activeTab === 'files' && dragActive ? 'bg-emerald-900/10 border-2 border-dashed border-emerald-500 rounded-xl' : ''}`}
                         onDragEnter={activeTab === 'files' ? handleDrag : undefined}
                         onDragLeave={activeTab === 'files' ? handleDrag : undefined}
                         onDragOver={activeTab === 'files' ? handleDrag : undefined}
                         onDrop={activeTab === 'files' ? handleDrop : undefined}
                       >
                           {filteredList.length === 0 ? (
                                <div className="text-center text-slate-500 py-20">
                                    {activeTab === 'files' && 'Drag & drop text files here (txt, md, json).'}
                                    {activeTab === 'notes' && 'No notes yet.'}
                                    {activeTab === 'urls' && 'No URLs added.'}
                                </div>
                           ) : (
                               filteredList.map(file => (
                                   <div key={file.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 group hover:border-slate-600 transition-all">
                                       <div className="flex items-center justify-between">
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
                                                        <span>Indexed</span>
                                                    </div>
                                                ) : file.status === 'processing' ? (
                                                    <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-900/20 px-2 py-0.5 rounded">
                                                        <span className="animate-spin">⟳</span> Processing...
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-red-500">Error</div>
                                                )}
                                                
                                                <button 
                                                    className="text-slate-500 hover:text-emerald-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                                                    title="Re-index" 
                                                    onClick={() => handleReindex(file.id)}
                                                    disabled={reindexingId === file.id || file.status === 'processing'}
                                                >
                                                    <svg className={`w-4 h-4 ${reindexingId === file.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </button>

                                                <button 
                                                    className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                                                    title="Delete" 
                                                    onClick={() => handleDeleteFile(file.id)}
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                       </div>
                                       
                                       {/* Processing Progress Bar */}
                                       {file.status === 'processing' && typeof file.progress === 'number' && (
                                           <div className="mt-3">
                                               <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                   <span>Chunking & Embedding</span>
                                                   <span>{Math.round(file.progress)}%</span>
                                               </div>
                                               <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                                                   <div 
                                                       className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
                                                       style={{ width: `${file.progress}%` }}
                                                   ></div>
                                               </div>
                                           </div>
                                       )}
                                   </div>
                               ))
                           )}
                       </div>
                   </div>
               )}

           </div>
       </div>
    </div>
  );
};

export default StepKnowledgeBase;