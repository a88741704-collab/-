import React, { useState, useEffect } from 'react';
import { PipelineStep, ProjectState } from './types';
import StepConfiguration, { AVAILABLE_PLUGINS } from './components/StepConfiguration';
import StepIdea from './components/StepIdea';
import StepWorldReview from './components/StepWorldReview';
import StepCharacters from './components/StepCharacters';
import StepOutline from './components/StepOutline';
import StepWriter from './components/StepWriter';
import StatusPanel from './components/StatusPanel';

const INITIAL_PROJECT: ProjectState = {
  agentConfig: {
    name: 'Novel Agent',
    provider: 'google',
    model: 'gemini-2.5-flash',
    workDir: 'D:/Creative/Novel/Assets',
    description: 'Expert novel writing assistant specializing in plot twists and character depth.',
    plugins: AVAILABLE_PLUGINS,
    customBaseUrl: '',
    customApiKey: '',
    ragConfig: {
        enabled: true,
        name: '我在女尊世界当药神',
        embeddingModel: 'BAAI/bge-large-zh-v1.5',
        embeddingDimension: 1024,
        topK: 15,
        rerankModel: 'BAAI/bge-reranker-v2-m3',
        chunkSize: 512,
        chunkOverlap: 64,
        scoreThreshold: 0.7,
        useSeparateApi: false
    }
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
  chapters: [],
  knowledgeBase: []
};

const STEPS = [
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

  const showWelcomeBlocker = !hasKey && currentStep !== PipelineStep.Configuration;

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

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur fixed w-full top-0 z-50 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">N</div>
            <h1 className="text-lg font-bold tracking-tight text-white">NovelCraft <span className="text-indigo-400">AI</span></h1>
        </div>
        <div className="text-xs text-slate-500 hidden md:block">
           {project.agentConfig.provider === 'custom' ? `Custom: ${project.agentConfig.model}` : `Google: ${project.agentConfig.model}`}
        </div>
      </header>

      <div className="flex flex-1 pt-16 h-screen overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-slate-800 bg-[#1e293b]/30 flex flex-col hidden md:flex">
            <div className="p-4 flex-1 overflow-y-auto">
                <div className="mb-4 px-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">创作流水线</p>
                    {STEPS.map((step) => {
                    const isActive = currentStep === step.id || (step.id === PipelineStep.Drafting && currentStep > PipelineStep.Drafting);
                    return (
                        <button
                            key={step.id}
                            onClick={() => setCurrentStep(step.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all mb-1 ${
                                isActive 
                                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                        >
                            {step.label}
                        </button>
                    )
                    })}
                </div>
            </div>
            
            {/* Status Panel Area */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <StatusPanel status={project.agentStatus} task={project.agentTask} />
                <div className="mt-4 pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-400 font-mono flex justify-between">
                        <span>Word Count:</span>
                        <span>{project.chapters.reduce((acc, curr) => acc + (curr.content?.length || 0), 0)}</span>
                    </p>
                </div>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-hidden relative">
            {renderStep()}
        </main>
      </div>
    </div>
  );
}