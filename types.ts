export enum PipelineStep {
  Configuration = -1, // New Agent Setup Step
  KnowledgeBase = -2, // Knowledge Base Management
  IdeaGeneration = 0,
  WorldReview = 1,
  CharacterDesign = 2,
  OutlineStructure = 3,
  Drafting = 4,
  Critique = 5,
  Adaptation = 6
}

export interface AgentPlugin {
  id: string;
  name: string;
  description: string;
  active: boolean;
  systemPromptAddon: string;
  isCustom?: boolean; // Flag for user-created plugins
}

export interface RAGConfig {
  enabled: boolean;
  name: string;
  embeddingModel: string;
  embeddingDimension: number;
  topK: number;
  
  // Advanced Settings
  rerankModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  scoreThreshold?: number;

  // Separate API Config for RAG (optional)
  useSeparateApi: boolean;
  ragBaseUrl?: string;
  ragApiKey?: string;
}

export interface AgentConfig {
  name: string;
  
  // API Configuration
  provider: 'google' | 'custom';
  model: string; // Model name/ID (e.g. 'gemini-2.5-flash' or 'deepseek-reasoner')
  
  // Custom Provider Specifics
  customBaseUrl?: string;
  customApiKey?: string;

  // Knowledge Base
  ragConfig: RAGConfig;

  workDir: string;
  description: string;
  plugins: AgentPlugin[];
}

export interface Character {
  id: string;
  name: string;
  role: 'Main' | 'Support' | 'Antagonist';
  description: string; // Background, personality, motivation
  appearance: string;
  imageUrl?: string;
}

export interface Volume {
  id: string;
  title: string;
  order: number;
  description?: string;
}

export interface Chapter {
  id: string;
  volumeId: string; // Link to volume
  number: number;
  title: string;
  summary: string;
  content?: string;
  critique?: string;
  comicImageUrls?: string[];
  animationUrl?: string;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadDate: string;
  status: 'indexed' | 'processing' | 'error';
}

export type AgentStatus = 'idle' | 'thinking' | 'generating' | 'error';

export interface ProjectState {
  agentConfig: AgentConfig;
  agentStatus: AgentStatus;
  agentTask: string;
  title: string;
  genre: string;
  coreIdea: string;
  settings: string;
  settingsCritique: string;
  characters: Character[];
  detailedOutline: string;
  volumes: Volume[]; // New: List of volumes
  chapters: Chapter[];
  currentChapterId?: string;
  knowledgeBase: string[];
  knowledgeBaseFiles: KnowledgeFile[];
  quickPhrases: string[];
}

export type AIModelType = 'text-fast' | 'text-reasoning' | 'image' | 'video';
