import React, { useState, useEffect } from 'react';
import { PipelineStep, ProjectState } from './types';
import StepConfiguration, { AVAILABLE_PLUGINS } from './components/StepConfiguration';
import StepIdea from './components/StepIdea';
import StepWorldReview from './components/StepWorldReview';
import StepCharacters from './components/StepCharacters';
import StepOutline from './components/StepOutline';
import StepWriter from './components/StepWriter';
import StepKnowledgeBase from './components/StepKnowledgeBase'; // Import the new component
import StatusPanel from './components/StatusPanel';

const INITIAL_RAG_ID = 'kb-default-01';

const INITIAL_PROJECT: ProjectState = {
  agentConfig: {
    name: 'Novel Agent',
    provider: 'custom',
    model: 'deepseek-reasoner',
    workDir: 'D:/Creative/Novel/Assets',
    description: 'Expert novel writing assistant specializing in plot twists and character depth.',
    plugins: AVAILABLE_PLUGINS,
    customBaseUrl: 'https://api.deepseek.com',
    customApiKey: '', // User must input
    ragConfigs: [
        {
            id: INITIAL_RAG_ID,
            enabled: true,
            name: '小说文件库', // Renamed
            embeddingModel: 'BAAI/bge-m3', // Default SiliconFlow model
            embeddingDimension: 1024,
            topK: 15,
            rerankModel: 'BAAI/bge-reranker-v2-m3',
            chunkSize: 512,
            chunkOverlap: 64,
            scoreThreshold: 0.7,
            useSeparateApi: true,
            ragBaseUrl: 'https://api.siliconflow.cn/v1',
            ragApiKey: '', // User must input
            vectorStore: 'local',
            vectorStoreCollection: 'novel_knowledge_base'
        }
    ]
  },
  agentStatus: 'idle',
  agentTask: '',
  title: 'Untitled Project',
  genre: '',
  coreIdea: '',
  settings: '',
  settingsCritique: '',
  characters: [],
  detailedOutline: '',
  volumes: [
      { id: 'vol-1', title: '第一卷：初入江湖', order: 1, description: '主角刚刚进入世界的铺垫阶段。' }
  ],
  chapters: [],
  knowledgeBase: [],
  knowledgeBaseFiles: [], // Removed demo files
  quickPhrases: [
      "环境：月色如霜，洒在青石板路上，泛起惨白的光。",
      "动作：他眉头微皱，指尖轻轻敲击着桌面，似乎在权衡利弊。",
      "战斗：剑光如虹，瞬息间已刺出三剑，封死了对方所有退路。",
      "心理：一种莫名的恐惧如同潮水般涌上心头，令他几乎窒息。"
  ]
};

// Define Main Navigation Groups
const MAIN_NAV = [
    { id: PipelineStep.KnowledgeBase, label: '小说知识库', icon: '📚' },
    { id: PipelineStep.IdeaGeneration, label: '写小说', icon: '✍️' }, // Groups the pipeline
];

const PIPELINE_STEPS = [
  { id: PipelineStep.Configuration, label: '0. Agent 配置' },
  { id: PipelineStep.IdeaGeneration, label: '1. 灵感构思' },
  { id: PipelineStep.WorldReview, label: '2. 设定审查' },
  { id: PipelineStep.CharacterDesign, label: '3. 角色设计' },
  { id: PipelineStep.OutlineStructure, label: '4. 剧情大纲' },
  { id: PipelineStep.Drafting, label: '5. 写作与改编' }, 
];

export default function App() {
  const [currentStep, setCurrentStep] = useState<PipelineStep>(PipelineStep.Configuration);
  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    } else {
      alert("API Key selection not available in this environment.");
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case PipelineStep.Configuration:
        return <StepConfiguration project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.IdeaGeneration)} />;
      case PipelineStep.KnowledgeBase:
        return <StepKnowledgeBase project={project} setProject={setProject} />;
      case PipelineStep.IdeaGeneration:
        return <StepIdea project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.WorldReview)} />;
      case PipelineStep.WorldReview:
        return <StepWorldReview project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.CharacterDesign)} />;
      case PipelineStep.CharacterDesign:
        return <StepCharacters project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.OutlineStructure)} />;
      case PipelineStep.OutlineStructure:
        return <StepOutline project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.Drafting)} />;
      case PipelineStep.Drafting:
      case PipelineStep.Critique:
      case PipelineStep.Adaptation:
        return <StepWriter project={project} setProject={setProject} />;
      default:
        return <div>Unknown Step</div>;
    }
  };

  // Logic Update: Only show blocker if NO Google Key AND (Provider is Google OR Custom Key is missing)
  const isCustomConfigured = project.agentConfig.provider === 'custom' && !!project.agentConfig.customApiKey;
  const showWelcomeBlocker = !hasKey && !isCustomConfigured && currentStep !== PipelineStep.Configuration;

  if (showWelcomeBlocker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-200">
        <div className="max-w-md text-center p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
          <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-2xl text-white shadow-lg mx-auto mb-6">N</div>
          <h1 className="text-2xl font-bold mb-4">欢迎使用 NovelCraft AI</h1>
          <p className="text-slate-400 mb-8">您需要选择 Google API Key，或者进入配置页面设置自定义 API。</p>
          <div className="space-y-3">
            <button 
              onClick={handleSelectKey}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/30"
            >
              选择 Google API Key
            </button>
            <button 
              onClick={() => setCurrentStep(PipelineStep.Configuration)}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all"
            >
              使用自定义 API 配置
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine if we are in the "Writing Pipeline" mode to show the sub-steps
  const isPipelineMode = currentStep >= 0;
  
  // Calculate active KBs
  const activeKbsCount = project.agentConfig.ragConfigs?.filter(r => r.enabled).length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur fixed w-full top-0 z-50 flex items-center px-6 justify-between shadow-sm">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">N</div>
            <h1 className="text-lg font-bold tracking-tight text-white">NovelCraft <span className="text-indigo-400">AI</span></h1>
        </div>
        <div className="text-xs text-slate-500 hidden md:flex items-center gap-3">
           <div className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
             {project.agentConfig.provider === 'custom' ? `🚀 Custom: ${project.agentConfig.model}` : `⚡ Google: ${project.agentConfig.model}`}
           </div>
           {activeKbsCount > 0 && (
               <div className="px-3 py-1 bg-emerald-900/30 text-emerald-400 rounded-full border border-emerald-800/50 flex items-center gap-1">
                   <span>📚 RAG Enabled: {activeKbsCount}</span>
               </div>
           )}
        </div>
      </header>

      <div className="flex flex-1 pt-16 h-screen overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-slate-800 bg-[#151b28] flex flex-col hidden md:flex z-40">
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                {/* Main Nav Items */}
                <div className="space-y-1 mb-6">
                    <button
                        onClick={() => setCurrentStep(PipelineStep.Configuration)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 font-medium ${currentStep === PipelineStep.Configuration ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>⚙️</span> 配置与插件
                    </button>
                    {MAIN_NAV.map(nav => (
                        <button
                            key={nav.id}
                            onClick={() => setCurrentStep(nav.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 font-medium ${
                                (nav.id === PipelineStep.KnowledgeBase && currentStep === PipelineStep.KnowledgeBase) ||
                                (nav.id === PipelineStep.IdeaGeneration && isPipelineMode)
                                ? 'bg-gradient-to-r from-emerald-900/50 to-transparent text-emerald-400 border-l-2 border-emerald-500' 
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <span>{nav.icon}</span> {nav.label}
                        </button>
                    ))}
                </div>

                {/* Pipeline Steps (Only show if in writing mode) */}
                {isPipelineMode && (
                    <div className="ml-2 pl-3 border-l border-slate-800 space-y-1 relative">
                        {/* Connecting Line Adjustment */}
                        <div className="absolute -left-[1px] top-0 bottom-0 w-[1px] bg-slate-800"></div>
                        
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-2">Creation Pipeline</p>
                        {PIPELINE_STEPS.slice(1).map((step, idx) => {
                            const isActive = currentStep === step.id || (step.id === PipelineStep.Drafting && currentStep > PipelineStep.Drafting);
                            return (
                                <button
                                    key={step.id}
                                    onClick={() => setCurrentStep(step.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 group ${
                                        isActive 
                                        ? 'bg-indigo-600/10 text-indigo-300 font-semibold' 
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] border ${
                                        isActive ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-700 bg-slate-800 text-slate-500 group-hover:border-slate-500'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    {step.label.split('. ')[1]}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
            
            {/* Status Panel Area */}
            <div className="p-4 border-t border-slate-800 bg-[#0f1219]">
                <StatusPanel status={project.agentStatus} task={project.agentTask} />
                <div className="mt-3 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                    <span>Total Words</span>
                    <span className="text-emerald-500 font-bold">{project.chapters.reduce((acc, curr) => acc + (curr.content?.length || 0), 0).toLocaleString()}</span>
                </div>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-hidden relative bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
            {renderStep()}
        </main>
      </div>
    </div>
  );
}