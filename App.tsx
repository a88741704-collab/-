
import React, { useState, useEffect } from 'react';
import { PipelineStep, ProjectState, UIPreferences, ProviderConfig } from './types';
import StepConfiguration, { AVAILABLE_PLUGINS } from './components/StepConfiguration';
import StepChat from './components/StepChat';
import StepWorldReview from './components/StepWorldReview';
import StepCharacters from './components/StepCharacters';
import StepOutline from './components/StepOutline';
import StepWriter from './components/StepWriter';
import StepKnowledgeBase from './components/StepKnowledgeBase'; 
import StepComic from './components/StepComic';
import StepVideo from './components/StepVideo';
import StatusPanel from './components/StatusPanel';
import DashboardModal from './components/DashboardModal';
import { get, set } from 'idb-keyval'; 

const INITIAL_RAG_ID = 'kb-default-01';
const STORAGE_KEY = 'novel_craft_project_v1';

// Default UI Preferences
const DEFAULT_UI_PREFS: UIPreferences = {
    fontSize: 16,
    accentColor: '#10b981', // Emerald-500 default as per image hint
    theme: 'dark'
};

const DEFAULT_PROVIDERS: ProviderConfig[] = [
    {
        id: 'google',
        name: 'Google Gemini',
        enabled: true,
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: '',
        models: ['gemini-2.5-flash', 'gemini-3-pro-preview'],
        activeModel: 'gemini-2.5-flash',
        icon: 'google'
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        enabled: true,
        baseUrl: 'https://api.deepseek.com',
        apiKey: '',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        activeModel: 'deepseek-reasoner',
        icon: 'deepseek'
    },
    {
        id: 'openai',
        name: 'OpenAI',
        enabled: false,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        models: ['gpt-4o', 'gpt-4-turbo'],
        activeModel: 'gpt-4o',
        icon: 'openai'
    }
];

const INITIAL_PROJECT: ProjectState = {
  agentConfig: {
    name: 'Novel Agent',
    activeProviderId: 'deepseek',
    providers: DEFAULT_PROVIDERS,
    workDir: 'D:/Creative/Novel/Assets',
    description: 'Expert novel writing assistant specializing in plot twists and character depth.',
    plugins: AVAILABLE_PLUGINS, 
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
            chunkingStrategy: 'semantic',
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
  
  conversations: [],
  activeConversationId: null,

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
    { id: PipelineStep.KnowledgeBase, label: '知识库', icon: '📚' },
    { id: PipelineStep.Chat, label: '助手 / 灵感', icon: '💬' }, 
];

const PIPELINE_STEPS = [
  { id: PipelineStep.Configuration, label: '0. 配置' },
  { id: PipelineStep.Chat, label: '1. 灵感' },
  { id: PipelineStep.WorldReview, label: '2. 设定' },
  { id: PipelineStep.CharacterDesign, label: '3. 角色' },
  { id: PipelineStep.OutlineStructure, label: '4. 大纲' },
  { id: PipelineStep.Drafting, label: '5. 正文' }, 
];

const VISUAL_STEPS = [
    { id: PipelineStep.ComicGeneration, label: '漫画生成', icon: '🎨' },
    { id: PipelineStep.VideoGeneration, label: '视频生成', icon: '🎬' },
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
          // Deep merge logic to handle new fields like providers
          const mergedConfig = {
              ...INITIAL_PROJECT.agentConfig,
              ...savedProject.agentConfig,
              // Ensure providers array exists
              providers: savedProject.agentConfig.providers || INITIAL_PROJECT.agentConfig.providers
          };

          setProject({ 
              ...INITIAL_PROJECT, 
              ...savedProject, 
              agentConfig: mergedConfig,
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

  // 3. Apply Theme & Font (Global CSS Injection)
  useEffect(() => {
      const prefs = project.uiPreferences || DEFAULT_UI_PREFS;
      const rgb = hexToRgb(prefs.accentColor || '#10b981');
      
      const styleId = 'dynamic-theme-styles';
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = styleId;
          document.head.appendChild(styleTag);
      }
      
      // Inject global font size to HTML to scale rem units properly
      styleTag.innerHTML = `
          html {
              font-size: ${prefs.fontSize}px;
          }
          :root {
              --accent-r: ${rgb ? rgb.r : 16};
              --accent-g: ${rgb ? rgb.g : 185};
              --accent-b: ${rgb ? rgb.b : 129};
          }
          /* Custom Scrollbar for global adjustments */
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `;
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
        return <StepConfiguration project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.Chat)} />;
      case PipelineStep.KnowledgeBase:
        return <StepKnowledgeBase project={project} setProject={setProject} />;
      case PipelineStep.Chat:
        return <StepChat project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.WorldReview)} />;
      case PipelineStep.WorldReview:
        return <StepWorldReview project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.CharacterDesign)} />;
      case PipelineStep.CharacterDesign:
        return <StepCharacters project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.OutlineStructure)} />;
      case PipelineStep.OutlineStructure:
        return <StepOutline project={project} setProject={setProject} onNext={() => setCurrentStep(PipelineStep.Drafting)} />;
      case PipelineStep.Drafting:
        return <StepWriter project={project} setProject={setProject} />;
      case PipelineStep.ComicGeneration:
        return <StepComic project={project} setProject={setProject} />;
      case PipelineStep.VideoGeneration:
        return <StepVideo project={project} setProject={setProject} />;
      default:
        return <div>Unknown Step</div>;
    }
  };

  const hasValidConfig = project.agentConfig.providers.some(p => p.enabled && (!!p.apiKey || !!process.env.API_KEY));

  const showWelcomeBlocker = isLoaded && !hasValidConfig && currentStep !== PipelineStep.Configuration;

  if (!isLoaded) {
      return (
          <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a] text-slate-400">
              <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p>正在从本地数据库恢复数据...</p>
              </div>
          </div>
      );
  }

  if (showWelcomeBlocker) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a] text-slate-200">
        <div className="max-w-md text-center p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
          <div className="w-16 h-16 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-2xl text-white shadow-lg mx-auto mb-6">N</div>
          <h1 className="text-2xl font-bold mb-4">欢迎使用 NovelCraft AI</h1>
          <p className="text-slate-400 mb-8">请先配置您的 AI 模型服务商 (Google Gemini 或 DeepSeek/OpenAI)。</p>
          <div className="space-y-3">
            <button 
              onClick={() => setCurrentStep(PipelineStep.Configuration)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/30"
            >
              前往配置页面
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPipelineMode = currentStep >= 0 && currentStep <= 4;
  const activeKbsCount = project.agentConfig.ragConfigs?.filter(r => r.enabled).length || 0;
  
  const activeProvider = project.agentConfig.providers.find(p => p.id === project.agentConfig.activeProviderId);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f172a] text-slate-200 overflow-hidden transition-colors duration-500">
      
      {showDashboard && (
          <DashboardModal 
            project={project}
            onUpdatePrefs={handleUpdatePrefs}
            onClose={() => setShowDashboard(false)}
          />
      )}

      {/* Header */}
      <header className="h-[3.5rem] shrink-0 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur flex items-center px-6 justify-between shadow-sm z-50">
        <div className="flex items-center gap-3">
            <div className="w-[2rem] h-[2rem] bg-emerald-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/30 text-lg">N</div>
            <h1 className="text-lg font-bold tracking-tight text-white">NovelCraft <span className="text-emerald-400">AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
            {lastSaved && (
                <span className="text-xs text-slate-500 font-mono hidden sm:block animate-fade-in">
                    Saved {lastSaved.toLocaleTimeString()}
                </span>
            )}
            <div className="text-sm text-slate-500 hidden md:flex items-center gap-3">
                <div className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700 truncate max-w-[200px] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-300 text-xs font-bold">{activeProvider?.name}</span>
                    <span className="text-slate-500 text-[10px] hidden lg:inline">| {activeProvider?.activeModel}</span>
                </div>
                {activeKbsCount > 0 && (
                    <div className="px-3 py-1 bg-emerald-900/30 text-emerald-400 rounded-full border border-emerald-800/50 flex items-center gap-1 text-xs">
                        <span>📚 KB: {activeKbsCount}</span>
                    </div>
                )}
                <button 
                    onClick={() => setShowDashboard(true)}
                    className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-300 hover:text-white"
                    title="控制中心 / 设置"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[14rem] border-r border-slate-800 bg-[#151b28] flex flex-col hidden md:flex z-40">
            <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                
                {/* 1. Common Tools */}
                <div className="space-y-1 mb-6">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Workspace</p>
                    <button
                        onClick={() => setCurrentStep(PipelineStep.Configuration)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-3 font-medium ${currentStep === PipelineStep.Configuration ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <span>⚙️</span> 配置 (Config)
                    </button>
                    {MAIN_NAV.map(nav => (
                        <button
                            key={nav.id}
                            onClick={() => setCurrentStep(nav.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-3 font-medium ${
                                currentStep === nav.id
                                ? 'bg-gradient-to-r from-emerald-900/50 to-transparent text-emerald-400 border-l-2 border-emerald-500' 
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            <span>{nav.icon}</span> {nav.label}
                        </button>
                    ))}
                </div>

                {/* 2. Writing Pipeline */}
                <div className="mb-6">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Story Pipeline</p>
                    <div className="ml-2 pl-3 border-l border-slate-800 space-y-1">
                        {PIPELINE_STEPS.slice(2).map((step, idx) => {
                            const isActive = currentStep === step.id;
                            return (
                                <button
                                    key={step.id}
                                    onClick={() => setCurrentStep(step.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group ${
                                        isActive 
                                        ? 'bg-emerald-600/10 text-emerald-300 font-semibold' 
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] border ${
                                        isActive ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-700 bg-slate-800 text-slate-500 group-hover:border-slate-500'
                                    }`}>
                                        {idx + 2}
                                    </span>
                                    {step.label.split('. ')[1]}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 3. Visuals */}
                <div className="mb-6">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">Visuals</p>
                    <div className="space-y-1">
                        {VISUAL_STEPS.map(step => (
                            <button
                                key={step.id}
                                onClick={() => setCurrentStep(step.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-3 font-medium ${
                                    currentStep === step.id
                                    ? 'bg-purple-900/20 text-purple-300 border-l-2 border-purple-500' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                            >
                                <span>{step.icon}</span> {step.label}
                            </button>
                        ))}
                    </div>
                </div>

            </div>
            
            <div className="p-4 border-t border-slate-800 bg-[#0f1219]">
                <StatusPanel status={project.agentStatus} task={project.agentTask} />
            </div>
        </aside>

        <main className="flex-1 p-0 overflow-hidden relative bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
            {renderStep()}
        </main>
      </div>
    </div>
  );
}
