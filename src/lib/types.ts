export type AgentSource = "seed" | "generate" | "manual" | "agent" | "notes" | "revert";
export type MiniStatus = "not_started" | "writing" | "ready_for_review" | "done";

export interface Standard {
  code: string;
  label: string;
  description: string;
}

export interface KnowledgeComponent {
  id: string;
  writerName: string;
  title: string;
  slug: string;
  grade: number;
  topic: number;
  kcNumber: number;
  condition: string;
  response: string;
  workedExampleMd: string;
  standards: Standard[];
  notesMd: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewKcInput {
  grade: number;
  topic: number;
  kcNumber: number;
  condition: string;
  response: string;
}

export interface MiniStep {
  id: string;
  instruction: string;
  interaction: string;
  targetResponse: string;
  hint: string;
  writerNotes?: string;
  agentNotes: string;
}

export interface MiniVersion {
  id: string;
  miniId: string;
  versionNumber: number;
  source: AgentSource;
  summary: string;
  steps: MiniStep[];
  createdAt: string;
}

export interface Mini {
  id: string;
  kcId: string;
  miniIndex: number;
  title: string;
  status: MiniStatus;
  currentVersionId: string;
  steps: MiniStep[];
  versions: MiniVersion[];
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackEntry {
  id: string;
  kcId: string | null;
  miniId: string | null;
  eventType: string;
  writerInput: string;
  agentResponse: string;
  createdAt: string;
}

export interface WorkspaceData {
  kcs: KnowledgeComponent[];
  minis: Mini[];
}

export interface AgentMessage {
  id: string;
  role: "writer" | "agent";
  content: string;
  createdAt: string;
}

export type EvalRating = "strong" | "mostly_strong" | "mixed" | "needs_work";
export type EvalPriority = "high" | "medium" | "low";

export interface MiniEvalDimension {
  key: string;
  label: string;
  rating: EvalRating;
  evidence: string;
}

export interface MiniEvalSuggestion {
  number: number;
  priority: EvalPriority;
  title: string;
  steps: string[];
  issue: string;
  suggestion: string;
  implementationPrompt: string;
}

export interface MiniEvalReport {
  miniId: string;
  kcId: string;
  title: string;
  overallRating: EvalRating;
  summary: string;
  dimensions: MiniEvalDimension[];
  suggestions: MiniEvalSuggestion[];
  readyForReview: boolean;
}
