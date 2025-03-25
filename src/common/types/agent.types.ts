export enum AgentStatus {
  PENDING = "PENDING",
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  PAUSED = "PAUSED",
  STOPPED = "STOPPED"
}

export interface Agent {
  id: string;
  instruction: string;
  status: AgentStatus;
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
  completedAt?: string; // ISO 8601 format
  model: string; // "gpt-4o" | "gpt-3.5-turbo" | "gpt-4-turbo"
  maxSteps: number;
  headless: boolean;
  useVision: boolean;
  generateGif: boolean;
  browserSize: string; // "mobile" | "tablet" | "pc"
  userId?: string;
  results?: AgentResult;
  logs?: AgentLog[];
  currentStep?: number;
}

export interface AgentResult {
  id: string;
  agentId: string;
  summary: string;
  outputText: string;
  outputHtml?: string;
  artifacts?: Artifact[];
  createdAt: string; // ISO 8601 format
}

export interface Artifact {
  id: string;
  agentId: string;
  resultId: string;
  type: "image" | "video" | "gif" | "json" | "text" | "html";
  url: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string; // ISO 8601 format
}

export interface AgentLog {
  id: string;
  agentId: string;
  stepNumber: number;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  details?: Record<string, any>;
  timestamp: string; // ISO 8601 format
  url?: string;
  screenshot?: string;
} 