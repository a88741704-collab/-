
export enum PipelineStep {
  Configuration = -1, // New Agent Setup Step
  KnowledgeBase = -2, // Knowledge Base Management
  Chat = 0, // General Assistant / Idea
  WorldReview = 1,
  CharacterDesign = 2,
  OutlineStructure = 3,
  Drafting = 4,
  ComicGeneration = 5, // New
  VideoGeneration = 6  // New
}

export interface AgentPlugin {
  id: string;
  name: string;
  type: 'agent' | 'tool';
  tags: string[];
  description: string;
  tools: string[]; // e.g. ['Read', 'Write', 'WebSearch', 'Grep']
  active: boolean;
  content: string; // The system prompt content
  
  // Metadata for UI
  fileName: string;
  sourcePath: string;
  fileSize?: string;
  isCustom?: boolean; 
}

export interface RAGConfig {
  id: string; // Unique ID for the KB
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
  
  // New Chunking Strategy
  chunkingStrategy?: 'fixed' | 'markdown' | 'semantic';

  // Separate API Config for RAG (optional)
  useSeparateApi: boolean;
  ragBaseUrl?: string;
  ragApiKey?: string;

  // Vector Store Configuration
  vectorStore: 'local' | 'chroma' | 'qdrant';
  vectorStoreUrl?: string;
  vectorStoreApiKey?: string;
  vectorStoreCollection?: string;
}

export interface ProviderConfig {
    id: string; // 'google', 'openai', 'deepseek', 'anthropic', 'custom'
    name: string;
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    models: string[]; 
    activeModel: string;
    icon?: string;
}

export interface AgentConfig {
  name: string;
  
  // New: Multiple Provider Configuration
  activeProviderId: string;
  providers: ProviderConfig[];

  // Legacy fields for backward compatibility (optional/computed)
  provider?: string; 
  model?: string;
  customBaseUrl?: string;
  customApiKey?: string;

  // Knowledge Base - Now supports multiple
  ragConfigs: RAGConfig[];

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

export interface TextChunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

export interface KnowledgeFile {
  id: string;
  kbId: string; // Link to specific RAGConfig ID
  name: string;
  size: string;
  type: string;
  uploadDate: string;
  status: 'indexed' | 'processing' | 'error';
  progress?: number; // 0-100 percentage
  totalChunks?: number; // Estimated chunks for display
  content?: string; // Actual text content
  chunks?: TextChunk[]; // Real RAG chunks
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    attachments?: string[]; // IDs or URLs
}

export interface Conversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    updatedAt: number;
}

export type AgentStatus = 'idle' | 'thinking' | 'generating' | 'error';

export interface UIPreferences {
    fontSize: number; // base pixel size, default 16
    accentColor: string; // hex code
    theme: 'dark' | 'midnight';
}

export interface ProjectState {
  agentConfig: AgentConfig;
  agentStatus: AgentStatus;
  agentTask: string;
  title: string;
  genre: string;
  
  // Chat / Idea Phase
  conversations: Conversation[];
  activeConversationId: string | null;

  // Legacy Idea fields
  coreIdea: string;
  ideaCritique?: string; 
  
  settings: string;
  settingsCritique: string;
  characters: Character[];
  characterCritique?: string;
  detailedOutline: string;
  outlineCritique?: string;
  volumes: Volume[]; 
  chapters: Chapter[];
  currentChapterId?: string;
  knowledgeBase: string[];
  knowledgeBaseFiles: KnowledgeFile[];
  quickPhrases: string[];
  uiPreferences: UIPreferences; // New field
}
