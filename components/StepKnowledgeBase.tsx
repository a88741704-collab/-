import React, { useState, useRef, useEffect } from 'react';
import { ProjectState, KnowledgeFile, RAGConfig, TextChunk } from '../types';
import RagSettingsModal from './RagSettingsModal';

interface Props {
  project: ProjectState;
  setProject: React.Dispatch<React.SetStateAction<ProjectState>>;
}

interface SearchResult {
    id: string;
    text: string; // The chunk text
    source: string;
    score: number;
    chunkIndex: number; // To show which chunk matched
}

// --- Real RAG Utilities ---

// Helper to read file as text
const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        if (file.type.match(/text.*/) || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.txt')) {
             reader.readAsText(file);
        } else {
             resolve(`[Binary content of ${file.name} cannot be previewed in this local demo]`);
        }
    });
};

// Recursive Character Text Splitter Simulation
// Splits by double newline, then newline, then space to respect chunk size
const recursiveSplitText = (text: string, chunkSize: number, chunkOverlap: number): TextChunk[] => {
    const chunks: TextChunk[] = [];
    if (!text) return chunks;

    let startIndex = 0;
    while (startIndex < text.length) {
        let endIndex = startIndex + chunkSize;
        
        // If we are not at the end, try to find a nice break point
        if (endIndex < text.length) {
            // Priority 1: Double newline (Paragraph)
            const doubleNewlineIndex = text.lastIndexOf('\n\n', endIndex);
            // Priority 2: Newline
            const newlineIndex = text.lastIndexOf('\n', endIndex);
            // Priority 3: Space
            const spaceIndex = text.lastIndexOf(' ', endIndex);

            // Determine best break point, ensuring we progress at least a bit to avoid infinite loops
            // Only back up if the break point is reasonably close to the limit (e.g. within last 25%)
            // otherwise we might cut too short.
            const minProgress = Math.floor(chunkSize * 0.5);
            
            if (doubleNewlineIndex > startIndex + minProgress) {
                endIndex = doubleNewlineIndex + 2; // Include the newlines
            } else if (newlineIndex > startIndex + minProgress) {
                endIndex = newlineIndex + 1;
            } else if (spaceIndex > startIndex + minProgress) {
                endIndex = spaceIndex + 1;
            }
            // Fallback: Hard cut at chunk size
        } else {
            endIndex = text.length;
        }

        const chunkText = text.substring(startIndex, endIndex);
        chunks.push({
            id: `chk-${Date.now()}-${chunks.length}`,
            text: chunkText.trim(),
            startIndex: startIndex,
            endIndex: endIndex
        });

        // Move start index for next chunk, backing up by overlap
        // But never back up past current start (infinite loop protection)
        const nextStart = endIndex - chunkOverlap;
        startIndex = Math.max(startIndex + 1, nextStart);
        
        // Optimization: If we reached end, break
        if (endIndex >= text.length) break;
    }

    return chunks;
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
  const [allSearchResults, setAllSearchResults] = useState<SearchResult[]>([]);
  const [visibleResultsCount, setVisibleResultsCount] = useState(10); // Pagination control
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState({ time: 0, tokens: 0, reqId: '' });

  // Search Settings State
  const [recallMethod, setRecallMethod] = useState<'hybrid' | 'vector' | 'keyword'>('hybrid');
  const [vectorRatio, setVectorRatio] = useState(0.8);
  const [topK, setTopK] = useState(activeKb?.topK || 20); // Retrieve more candidates, display paginated
  const [minScore, setMinScore] = useState(0.5);
  const [enableRerank, setEnableRerank] = useState(false);

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
          topK: 20,
          chunkSize: 512,
          chunkOverlap: 64,
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

  // --- Handlers for Files (Now with Real Chunking) ---

  const processFile = async (file: File) => {
      if (!selectedKbId || !activeKb) return;

      // 1. Read File Content
      let content = '';
      try {
          content = await readFileAsText(file);
      } catch (e) {
          console.error("Failed to read file", e);
          content = "Read Error";
      }

      // 2. Perform Real Slicing
      const chunkSize = activeKb.chunkSize ?? 512;
      const chunkOverlap = activeKb.chunkOverlap ?? 64;
      const chunks = recursiveSplitText(content, chunkSize, chunkOverlap);

      // 3. Create Entry
      const newFile: KnowledgeFile = {
          id: `f-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
          kbId: selectedKbId,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          type: file.type || 'text/plain',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'processing',
          progress: 0,
          totalChunks: chunks.length,
          content: content,
          chunks: chunks // Store the sliced chunks
      };

      setProject(prev => ({
          ...prev, 
          knowledgeBaseFiles: [...(prev.knowledgeBaseFiles || []), newFile]
      }));

      // Simulate Embedding Progress (We already have chunks, but simulating vectorization time)
      const processingSpeed = 10; 
      const updateInterval = 200;
      const totalSteps = 100 / processingSpeed * 5; 
      
      let steps = 0;
      const timer = setInterval(() => {
          steps++;
          const progress = Math.min(99, (steps / totalSteps) * 100);

          setProject(prev => ({
              ...prev,
              knowledgeBaseFiles: prev.knowledgeBaseFiles.map(f => 
                  f.id === newFile.id 
                  ? { ...f, progress: progress } 
                  : f
              )
          }));

          if (progress >= 99) {
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
              }, 500);
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
      if (reindexingId || !activeKb) return;
      setReindexingId(id);
      
      const targetFile = project.knowledgeBaseFiles.find(f => f.id === id);
      if(!targetFile || !targetFile.content) return;

      // Re-slice (in case settings changed)
      const chunkSize = activeKb.chunkSize ?? 512;
      const chunkOverlap = activeKb.chunkOverlap ?? 64;
      const chunks = recursiveSplitText(targetFile.content, chunkSize, chunkOverlap);

      setProject(prev => ({
          ...prev,
          knowledgeBaseFiles: prev.knowledgeBaseFiles.map(f => 
             f.id === id ? { ...f, status: 'processing', progress: 0, totalChunks: chunks.length, chunks: chunks } : f
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
      if(!newNote.trim() || !selectedKbId || !activeKb) return;
      
      const content = newNote;
      const chunkSize = activeKb.chunkSize ?? 512;
      const chunks = recursiveSplitText(content, chunkSize, activeKb.chunkOverlap ?? 64);

      const noteFile: KnowledgeFile = {
          id: `n-${Date.now()}`,
          kbId: selectedKbId,
          name: `Note: ${newNote.substring(0, 15)}...`,
          size: `${newNote.length} chars`,
          type: 'application/x-note',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'indexed',
          progress: 100,
          totalChunks: chunks.length,
          content: content,
          chunks: chunks
      };
      setProject(prev => ({ ...prev, knowledgeBaseFiles: [...prev.knowledgeBaseFiles, noteFile] }));
      setNewNote('');
  };

  const handleAddUrl = () => {
      // Simulation of URL crawling
      if(!newUrl.trim() || !selectedKbId || !activeKb) return;
      
      const simulatedContent = `[Simulated Crawl of ${newUrl}]\n\nNovel writing is an art form that requires patience, skill, and a touch of madness. The structure of a novel usually follows the three-act structure. \n\nCharacters must have flaws. A perfect character is boring. Give them internal conflict. The setting should be a character in itself.`;
      
      const chunkSize = activeKb.chunkSize ?? 512;
      const chunks = recursiveSplitText(simulatedContent, chunkSize, activeKb.chunkOverlap ?? 64);

      const urlFile: KnowledgeFile = {
          id: `u-${Date.now()}`,
          kbId: selectedKbId,
          name: newUrl,
          size: 'Web Page',
          type: 'text/html',
          uploadDate: new Date().toLocaleTimeString(),
          status: 'processing',
          progress: 0,
          totalChunks: chunks.length,
          content: simulatedContent,
          chunks: chunks
      };
      setProject(prev => ({ ...prev, knowledgeBaseFiles: [...prev.knowledgeBaseFiles, urlFile] }));
      setNewUrl('');
      
      let p = 0;
      const interval = setInterval(() => {
          p += 10;
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

  // --- Real Search Implementation (Chunk-based) ---
  const performSearch = () => {
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      setAllSearchResults([]); // Clear previous
      setVisibleResultsCount(10); // Reset pagination

      const startTime = performance.now();
      
      // Simulation delay for "network/processing" feel
      setTimeout(() => {
          const currentFiles = project.knowledgeBaseFiles.filter(f => f.kbId === selectedKbId);
          const results: SearchResult[] = [];
          
          const lowerQuery = searchQuery.toLowerCase();
          const queryTerms = lowerQuery.split(/\s+/).filter(t => t.length > 0);

          currentFiles.forEach(file => {
             // We search inside CHUNKS now, not the whole content
             if (!file.chunks) return;

             file.chunks.forEach((chunk, index) => {
                 const lowerChunkText = chunk.text.toLowerCase();
                 let score = 0;

                 // 1. Exact Phrase Match
                 if (lowerChunkText.includes(lowerQuery)) {
                     score += 0.5; 
                 }

                 // 2. Term Density (Vector Similarity Sim)
                 let termMatches = 0;
                 queryTerms.forEach(term => {
                     // Simple frequency count
                     const matches = lowerChunkText.split(term).length - 1;
                     if (matches > 0) termMatches += 1 + (matches * 0.1);
                 });
                 
                 if (queryTerms.length > 0) {
                     score += (termMatches / (queryTerms.length * 2)) * 0.5; // Normalized
                 }

                 // Recall Method Adjustments
                 if (recallMethod === 'keyword' && !lowerChunkText.includes(lowerQuery)) score = 0;
                 if (recallMethod === 'vector') {
                     // Add some noise if score > 0 to simulate vector drift
                     if (score > 0) score += (Math.random() * 0.05);
                 }

                 if (score >= minScore) {
                     if (enableRerank) score = Math.min(0.99, score + (Math.random() * 0.1));
                     
                     results.push({
                         id: `res-${file.id}-${chunk.id}`,
                         text: chunk.text, // Return ACTUAL sliced chunk
                         source: file.name,
                         score: score,
                         chunkIndex: index
                     });
                 }
             });
          });

          // Sort by score
          const sorted = results.sort((a,b) => b.score - a.score);
          
          setAllSearchResults(sorted);
          const endTime = performance.now();
          setSearchMeta({
              time: (endTime - startTime) / 1000,
              tokens: searchQuery.length + sorted.reduce((acc, r) => acc + r.text.length, 0),
              reqId: `req-${Math.random().toString(16).substr(2, 8)}`
          });
          setIsSearching(false);
      }, 600);
  };

  const handleLoadMore = () => {
      setVisibleResultsCount(prev => prev + 10);
  };

  // Highlight helper
  const HighlightedText = ({ text, query }: { text: string, query: string }) => {
      if (!query) return <span>{text}</span>;
      // Split by query terms for "Hybrid/Vector" style highlighting
      const terms = query.split(/\s+/).filter(t => t.length > 0).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (terms.length === 0) return <span>{text}</span>;

      const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
      const parts = text.split(pattern);

      return (
          <span>
              {parts.map((part, i) => 
                  terms.some(t => new RegExp(t, 'i').test(part))
                  ? <span key={i} className="bg-yellow-500/30 text-yellow-200 font-bold px-0.5 rounded-sm">{part}</span> 
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

  // Derived visible results
  const visibleResults = allSearchResults.slice(0, visibleResultsCount);

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
       <div className="w-64 bg-[#151b28] border border-slate-700 rounded-xl flex flex-col overflow-hidden shadow-lg hidden md:flex">
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
                           <span className="flex items-center gap-1">Chunk Size: <span className="text-indigo-400">{activeKb.chunkSize || 512}</span></span>
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
                      className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${activeTab === 'test' ? 'text-blue-400 border-blue-400 font-bold' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                   >
                       知识检索 (Search Test)
                   </button>
               </div>
           </div>

           {/* Content Body */}
           <div className="flex-1 overflow-hidden relative bg-[#0f172a]/50">
               
               {/* --- SEARCH TEST TAB --- */}
               {activeTab === 'test' && (
                   <div className="flex h-full">
                       {/* Left: Search Area */}
                       <div className="flex-1 flex flex-col p-6 border-r border-slate-700 overflow-hidden">
                           <div className="text-center mb-6 mt-2">
                               <h1 className="text-2xl font-bold text-white mb-6 tracking-tight">知识检索</h1>
                               <div className="relative max-w-2xl mx-auto">
                                   <input 
                                      value={searchQuery}
                                      onChange={(e) => setSearchQuery(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                                      placeholder="请输入搜索内容..."
                                      className="w-full h-12 pl-4 pr-12 rounded-lg border border-blue-500/50 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg shadow-blue-900/10 placeholder-slate-400"
                                   />
                                   <button 
                                      onClick={performSearch}
                                      className="absolute right-1 top-1 bottom-1 w-10 bg-blue-600 hover:bg-blue-500 rounded-md flex items-center justify-center text-white transition-colors"
                                   >
                                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                   </button>
                               </div>
                           </div>

                           <div className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
                               {/* Result Header */}
                               <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 px-2 font-mono">
                                   <span>检索结果: {allSearchResults.length} 个</span>
                                   {allSearchResults.length > 0 && (
                                       <>
                                           <span className="border-l border-slate-700 pl-4">单次检索耗时 {searchMeta.time.toFixed(3)} s</span>
                                           <span className="border-l border-slate-700 pl-4">Token消耗 {searchMeta.tokens}</span>
                                           <span className="border-l border-slate-700 pl-4 truncate max-w-[150px]">ID {searchMeta.reqId}</span>
                                       </>
                                   )}
                               </div>

                               {/* Results List */}
                               <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 pb-4">
                                   {isSearching ? (
                                       <div className="space-y-4">
                                           {[1,2,3].map(i => (
                                               <div key={i} className="bg-white/5 rounded-lg p-4 animate-pulse">
                                                   <div className="h-4 bg-slate-700 rounded w-1/3 mb-3"></div>
                                                   <div className="h-3 bg-slate-700/50 rounded w-full mb-2"></div>
                                                   <div className="h-3 bg-slate-700/50 rounded w-2/3"></div>
                                               </div>
                                           ))}
                                       </div>
                                   ) : visibleResults.length > 0 ? (
                                       <>
                                           {visibleResults.map((res, idx) => (
                                               <div key={res.id} className="bg-transparent hover:bg-slate-800/30 p-4 rounded-lg transition-colors border-b border-slate-800/50 last:border-0 group">
                                                   <div className="flex justify-between items-start mb-2">
                                                       <div className="flex items-center gap-2">
                                                            <h4 className="text-sm font-bold text-slate-200">{idx + 1}. {res.source}</h4>
                                                            <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-1 rounded">Chunk #{res.chunkIndex}</span>
                                                       </div>
                                                       <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">Score: {res.score.toFixed(4)}</span>
                                                   </div>
                                                   <div className="text-sm text-slate-300 leading-relaxed font-serif whitespace-pre-line">
                                                       <HighlightedText text={res.text} query={searchQuery} />
                                                   </div>
                                               </div>
                                           ))}

                                           {/* LOAD MORE BUTTON */}
                                           {visibleResultsCount < allSearchResults.length && (
                                               <div className="pt-2 pb-4 text-center">
                                                   <button 
                                                       onClick={handleLoadMore}
                                                       className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-xs font-bold transition-all border border-slate-600 shadow-lg"
                                                   >
                                                       ↓ Load More ({allSearchResults.length - visibleResultsCount} remaining)
                                                   </button>
                                               </div>
                                           )}
                                       </>
                                   ) : (
                                       <div className="text-center text-slate-500 py-10">
                                           {searchQuery ? "未找到相关切片 (No chunks matched)" : "请输入关键词开始检索"}
                                       </div>
                                   )}
                               </div>
                           </div>
                       </div>

                       {/* Right: Settings Panel */}
                       <div className="w-80 bg-white border-l border-slate-200 text-slate-800 flex flex-col">
                           <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                               <h3 className="font-bold text-slate-800">检索参数设置</h3>
                               <button className="text-slate-400 hover:text-blue-500" title="Reset">
                                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                               </button>
                           </div>
                           
                           <div className="p-4 overflow-y-auto flex-1 space-y-6">
                               {/* Recall Settings */}
                               <div>
                                   <h4 className="text-sm font-bold text-slate-600 mb-3">召回设置</h4>
                                   
                                   <div className="space-y-3">
                                       <div className="flex justify-between items-center cursor-pointer">
                                           <label className="text-sm text-slate-500">召回方式</label>
                                           <span className="text-slate-400 text-xs transform -rotate-90">›</span>
                                       </div>
                                       
                                       {/* Recall Method Selection */}
                                       <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/50 space-y-3">
                                           <label className="flex items-start gap-2 cursor-pointer">
                                               <input type="radio" name="recall" checked={recallMethod === 'hybrid'} onChange={() => setRecallMethod('hybrid')} className="mt-1 text-blue-600 focus:ring-blue-500" />
                                               <div>
                                                   <span className="block text-sm font-bold text-slate-700">混合检索</span>
                                                   <span className="block text-xs text-slate-500 mt-1">结合向量检索与关键词检索，返回两种结果中最匹配用户问题的文件。</span>
                                                   
                                                   {recallMethod === 'hybrid' && (
                                                       <div className="mt-2">
                                                           <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                               <span>向量检索占比</span>
                                                               <span>{vectorRatio}</span>
                                                           </div>
                                                           <input 
                                                              type="range" min="0" max="1" step="0.1" 
                                                              value={vectorRatio} onChange={(e) => setVectorRatio(parseFloat(e.target.value))}
                                                              className="w-full h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                           />
                                                       </div>
                                                   )}
                                               </div>
                                           </label>

                                           <label className="flex items-start gap-2 cursor-pointer">
                                               <input type="radio" name="recall" checked={recallMethod === 'vector'} onChange={() => setRecallMethod('vector')} className="mt-1 text-blue-600 focus:ring-blue-500" />
                                               <div>
                                                   <span className="block text-sm font-bold text-slate-700">向量检索</span>
                                                   <span className="block text-xs text-slate-500 mt-1">通过向量化方式进行问题和文本段落的向量相似度匹配。</span>
                                               </div>
                                           </label>

                                           <label className="flex items-start gap-2 cursor-pointer">
                                               <input type="radio" name="recall" checked={recallMethod === 'keyword'} onChange={() => setRecallMethod('keyword')} className="mt-1 text-blue-600 focus:ring-blue-500" />
                                               <div>
                                                   <span className="block text-sm font-bold text-slate-700">关键词检索</span>
                                                   <span className="block text-xs text-slate-500 mt-1">根据用户关键词精确匹配文本。</span>
                                               </div>
                                           </label>
                                       </div>
                                   </div>
                               </div>

                               {/* Parameters */}
                               <div className="space-y-4">
                                   <div className="flex justify-between items-center">
                                       <span className="text-sm text-slate-600">Rerank ⓘ</span>
                                       <div 
                                          onClick={() => setEnableRerank(!enableRerank)}
                                          className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${enableRerank ? 'bg-blue-600' : 'bg-slate-300'}`}
                                       >
                                           <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${enableRerank ? 'right-0.5' : 'left-0.5'}`}></div>
                                       </div>
                                   </div>

                                   <div>
                                       <div className="flex justify-between text-sm text-slate-600 mb-2">
                                           <span>召回数量 (Candidates) ⓘ</span>
                                           <span className="border border-slate-200 px-2 rounded bg-white text-xs py-0.5">{topK}</span>
                                       </div>
                                       <input 
                                          type="range" min="10" max="100" 
                                          value={topK} onChange={(e) => setTopK(parseInt(e.target.value))}
                                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                       />
                                       <div className="text-[10px] text-slate-400 mt-1 text-right">Visible: {visibleResultsCount}</div>
                                   </div>

                                   <div>
                                       <div className="flex justify-between text-sm text-slate-600 mb-2">
                                           <span>召回分数 ⓘ</span>
                                           <span className="border border-slate-200 px-2 rounded bg-white text-xs py-0.5">{minScore}</span>
                                       </div>
                                       <input 
                                          type="range" min="0" max="1" step="0.05"
                                          value={minScore} onChange={(e) => setMinScore(parseFloat(e.target.value))}
                                          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                       />
                                   </div>

                                   <div className="flex justify-between items-center opacity-50">
                                       <span className="text-sm text-slate-600">QA干预 ⓘ</span>
                                       <div className="w-10 h-5 rounded-full bg-slate-300 relative"><div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5"></div></div>
                                   </div>
                               </div>

                               {/* Filters */}
                               <div>
                                   <h4 className="text-sm font-bold text-slate-600 mb-3">文件范围</h4>
                                   <div className="flex justify-between items-center">
                                       <span className="text-sm text-slate-600">按标签筛选 ⓘ</span>
                                       <div className="w-10 h-5 rounded-full bg-slate-300 relative"><div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5"></div></div>
                                   </div>
                               </div>
                           </div>
                       </div>
                   </div>
               )}

               {/* --- FILES/NOTES/URLS TABS --- */}
               {activeTab !== 'test' && (
                   <div className="h-full flex flex-col p-6">
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
                                                    <p className="text-xs text-slate-500">{file.uploadDate} · {file.size} · {file.totalChunks || 0} Chunks</p>
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