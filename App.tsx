
import React, { useState, useEffect } from 'react';
import { PipelineStep, ProjectState, UIPreferences } from './types';
import StepConfiguration, { AVAILABLE_PLUGINS } from './components/StepConfiguration';
import StepIdea from './components/StepIdea';
import StepWorldReview from './components/StepWorldReview';
import StepCharacters from './components/StepCharacters';
import StepOutline from './components/StepOutline';
import StepWriter from './components/StepWriter';
import StepKnowledgeBase from './components/StepKnowledgeBase'; 
import StatusPanel from './components/StatusPanel';
import DashboardModal from './components/DashboardModal';
import { get, set } from 'idb-keyval'; 

const INITIAL_RAG_ID = 'kb-default-01';
const STORAGE_KEY = 'novel_craft_project_v1';

// Default UI Preferences
const DEFAULT_UI_PREFS: UIPreferences = {
    fontSize: 16,
    accentColor: '#4f46e5', // Indigo-600
    theme: 'dark'
};

const INITIAL_PROJECT: ProjectState = {
  agentConfig: {
    name: 'Novel Agent',
    provider: 'custom',
    model: 'deepseek-reasoner',
    workDir: 'D:/Creative/Novel/Assets',
    description: 'Expert novel writing assistant specializing in plot twists and character depth.',
    plugins: AVAILABLE_PLUGINS, 
    customBaseUrl: 'https://api.deepseek.com',
    customApiKey: '', 
    ragConfigs: [
        {
            id: INITIAL_RAG_ID,
            enabled: true,
            name: '小说文件库', 
            embeddingModel: 'BAAI/bge-m3', 
            embeddingDimension: 1024,
            topK: 15,
            rerankModel: 'BAAI/bge-reranker-v2-m3',
            chunkSize: 512,
            chunkOverlap: 64,
            scoreThreshold: 0.7,
            useSeparateApi: true,
            ragBaseUrl: 'https://api.siliconflow.cn/v1',
            ragApiKey: '', 
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
  knowledgeBaseFiles: [], 
  quickPhrases: [
      "环境：月色如霜，洒在青石板路上，泛起惨白的光。",
      "动作：他眉头微皱，指尖轻轻敲击着桌面，似乎在权衡利弊。",
      "战斗：剑光如虹，瞬息间已刺出三剑，封死了对方所有退路。",
      "心理：一种莫名的恐惧如同潮水般涌上心头，令他几乎窒息。"
  ],
  uiPreferences: DEFAULT_UI_PREFS
};

// Define Main Navigation Groups
const MAIN_NAV = [
    { id: PipelineStep.KnowledgeBase, label: '小说知识库', icon: '📚' },
    { id: PipelineStep.IdeaGeneration, label: '写小说', icon: '✍️' }, 
];

const PIPELINE_STEPS = [
  { id: PipelineStep.Configuration, label: '0. Agent 配置' },
  { id: PipelineStep.IdeaGeneration, label: '1. 灵感构思' },
  { id: PipelineStep.WorldReview, label: '2. 设定审查' },
  { id: PipelineStep.CharacterDesign, label: '3. 角色设计' },
  { id: PipelineStep.OutlineStructure, label: '4. 剧情大纲' },
  { id: PipelineStep.Drafting, label: '5. 写作与改编' }, 
];

// Helper: Hex to RGB for CSS vars
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<PipelineStep>(PipelineStep.Configuration);
  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
  const [showDashboard, setShowDashboard] = useState(false);
  
  // Persistence States
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 1. Load Data on Mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedProject = await get(STORAGE_KEY);
        if (savedProject) {
          // Merge with initial
          const mergedPlugins = savedProject.agentConfig?.plugins?.[0]?.content 
              ? savedProject.agentConfig.plugins 
              : INITIAL_PROJECT.agentConfig.plugins;

          setProject({ 
              ...INITIAL_PROJECT, 
              ...savedProject, 
              agentConfig: {
                  ...INITIAL_PROJECT.agentConfig,
                  ...savedProject.agentConfig,
                  plugins: mergedPlugins
              },
              uiPreferences: {
                  ...INITIAL_PROJECT.uiPreferences,
                  ...(savedProject.uiPreferences || {})
              },
              agentStatus: 'idle', 
              agentTask: '已恢复上次工作状态' 
          });
        }
      } catch (e) {
        console.error("Failed to load project", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // 2. Auto-Save
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      set(STORAGE_KEY, project)
        .then(() => setLastSaved(new Date()))
        .catch(err => console.error("Save failed", err));
    }, 1000); 
    return () => clearTimeout(timer);
  }, [project, isLoaded]);

  // 3. Apply Theme (CSS Injection)
  useEffect(() => {
      const prefs = project.uiPreferences || DEFAULT_UI_PREFS;
      const rgb = hexToRgb(prefs.accentColor || '#4f46e5');
      
      if (rgb) {
          // We override Tailwind's indigo-600/500/400 colors globally by injecting a style tag
          // This is a hack to allow theming without recompiling Tailwind
          const styleId = 'dynamic-theme-styles';
          let styleTag = document.getElementById(styleId);
          if (!styleTag) {
              styleTag = document.createElement('style');
              styleTag.id = styleId;
              document.head.appendChild(styleTag);
          }
          
          styleTag.innerHTML = `
              :root {
                  --accent-r: ${rgb.r};
                  --accent-g: ${rgb.g};
                  --accent-b: ${rgb.b};
              }
              /* Override Indigo-600 (Primary Buttons/Backgrounds) */
              .bg-indigo-600 { background-color: rgb(${rgb.r}, ${rgb.g}, ${rgb.b}) !important; }
              .hover\\:bg-indigo-500:hover { background-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8) !important; }
              
              /* Override Indigo-400 (Text Highlights) */
              .text-indigo-400 { color: rgb(${Math.min(255, rgb.r + 60)}, ${Math.min(255, rgb.g + 60)}, ${Math.min(255, rgb.b + 100)}) !important; }
              
              /* Override Border */
              .border-indigo-500 { border-color: rgb(${rgb.r}, ${rgb.g}, ${rgb.b}) !important; }
          `;
      }
  }, [project.uiPreferences]);

  const handleUpdatePrefs = (newPrefs: Partial<UIPreferences>) => {
      setProject(prev => ({
          ...prev,
          uiPreferences: { ...prev.uiPreferences, ...newPrefs }
      }));
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

  const hasValidConfig = 
      (project.agentConfig.provider === 'custom' && !!project.agentConfig.customApiKey) || 
      (project.agentConfig.provider === 'google' && (!!process.env.API_KEY || !!import.meta.env.VITE_API_KEY));

  const showWelcomeBlocker = isLoaded && !hasValidConfig && currentStep !== PipelineStep.Configuration;

  if (!isLoaded) {
      return (
          <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a] text-slate-400">
              <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p>正在从本地数据库恢复数据...</p>
              </div>
          </div>
      );
  }

  if (showWelcomeBlocker) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a] text-slate-200">
        <div className="max-w-md text-center p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
          <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-2xl text-white shadow-lg mx-auto mb-6">N</div>
          <h1 className="text-2xl font-bold mb-4">欢迎使用 NovelCraft AI</h1>
          <p className="text-slate-400 mb-8">请先配置您的 AI 模型服务商 (Google Gemini 或 DeepSeek/OpenAI)。</p>
          <div className="space-y-3">
            <button 
              onClick={() => setCurrentStep(PipelineStep.Configuration)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/30"
            >
              前往配置页面
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPipelineMode = currentStep >= 0;
  const activeKbsCount = project.agentConfig.ragConfigs?.filter(r => r.enabled).length || 0;
  
  // Apply Font Size dynamically
  const fontSizeStyle = { fontSize: `${project.uiPreferences?.fontSize || 16}px` };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f172a] text-slate-200 overflow-hidden transition-colors duration-500" style={fontSizeStyle}>
      
      {showDashboard && (
          <DashboardModal 
            project={project}
            onUpdatePrefs={handleUpdatePrefs}
            onClose={() => setShowDashboard(false)}
          />
      )}

      {/* Header */}
      <header className="h-[4em] shrink-0 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur flex items-center px-6 justify-between shadow-sm z-50">
        <div className="flex items-center gap-2">
            <div className="w-[2em] h-[2em] bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30 text-[1.2em]">N</div>
            <h1 className="text-[1.1em] font-bold tracking-tight text-white">NovelCraft <span className="text-indigo-400">AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
            {lastSaved && (
                <span className="text-[0.7em] text-slate-500 font-mono hidden sm:block animate-fade-in">
                    已自动保存 {lastSaved.toLocaleTimeString()}
                </span>
            )}
            <div className="text-[0.8em] text-slate-500 hidden md:flex items-center gap-3">
                <div className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700 truncate max-w-[150px]">
                    {project.agentConfig.provider === 'custom' ? `🚀 ${project.agentConfig.model}` : `⚡ ${project.agentConfig.model}`}
                </div>
                {activeKbsCount > 0 && (
                    <div className="px-3 py-1 bg-emerald-900/30 text-emerald-400 rounded-full border border-emerald-800/50 flex items-center gap-1">
                        <span>📚 KB: {activeKbsCount}</span>
                    </div>
                )}
                <button 
                    onClick={() => setShowDashboard(true)}
                    className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-300 hover:text-white"
                    title="控制中心 / 设置"
                >
                    <svg className="w-[1.4em] h-[1.4em]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[16em] border-r border-slate-800 bg-[#151b28] flex flex-col hidden md:flex z-40">
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-1 mb-6">
                    <button
                        onClick={() => setCurrentStep(PipelineStep.Configuration)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-[0.9em] transition-all flex items-center gap-3 font-medium ${currentStep === PipelineStep.Configuration ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>⚙️</span> 配置与插件
                    </button>
                    {MAIN_NAV.map(nav => (
                        <button
                            key={nav.id}
                            onClick={() => setCurrentStep(nav.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-[0.9em] transition-all flex items-center gap-3 font-medium ${
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

                {isPipelineMode && (
                    <div className="ml-2 pl-3 border-l border-slate-800 space-y-1 relative">
                        <div className="absolute -left-[1px] top-0 bottom-0 w-[1px] bg-slate-800"></div>
                        <p className="text-[0.6em] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-2">Creation Pipeline</p>
                        {PIPELINE_STEPS.slice(1).map((step, idx) => {
                            const isActive = currentStep === step.id || (step.id === PipelineStep.Drafting && currentStep > PipelineStep.Drafting);
                            return (
                                <button
                                    key={step.id}
                                    onClick={() => setCurrentStep(step.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-[0.8em] transition-all flex items-center gap-2 group ${
                                        isActive 
                                        ? 'bg-indigo-600/10 text-indigo-300 font-semibold' 
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <span className={`w-[1.6em] h-[1.6em] rounded-full flex items-center justify-center text-[0.8em] border ${
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
            
            <div className="p-4 border-t border-slate-800 bg-[#0f1219]">
                <StatusPanel status={project.agentStatus} task={project.agentTask} />
                <div className="mt-3 flex justify-between items-center text-[0.7em] text-slate-500 font-mono">
                    <span>Total Words</span>
                    <span className="text-emerald-500 font-bold">{project.chapters.reduce((acc, curr) => acc + (curr.content?.length || 0), 0).toLocaleString()}</span>
                </div>
            </div>
        </aside>

        <main className="flex-1 p-6 overflow-hidden relative bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
            {renderStep()}
        </main>
      </div>
    </div>
  );
}
