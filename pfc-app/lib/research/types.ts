// ═══════════════════════════════════════════════════════════════════
// Research Suite — Core Types
// ═══════════════════════════════════════════════════════════════════

/** Which suites are enabled */
export type SuiteMode = 'research-only' | 'full';

/** Research chat mode toggle */
export type ChatViewMode = 'chat' | 'visualize-thought';

/** Thinking playback state */
export type ThinkingPlayState = 'playing' | 'paused' | 'stopped';

/** A saved research article / paper reference */
export interface ResearchPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  tags: string[];
  savedAt: number;
  /** Which chat message sourced this */
  sourceMessageId?: string;
  /** User notes */
  notes?: string;
}

/** A citation extracted from model output */
export interface Citation {
  id: string;
  text: string;
  source: string;
  authors?: string[];
  year?: number;
  doi?: string;
  url?: string;
  confidence: number;
}

/** Thought node for mind-map visualization */
export interface ThoughtNode {
  id: string;
  label: string;
  type: 'query' | 'reasoning' | 'evidence' | 'conclusion' | 'counter' | 'branch';
  parentId?: string;
  children: string[];
  depth: number;
  confidence?: number;
  detail?: string;
}

/** Thought graph for visualization */
export interface ThoughtGraph {
  nodes: ThoughtNode[];
  edges: { from: string; to: string; label?: string; weight?: number }[];
  rootId: string;
}

/** Export format options */
export type ExportFormat = 'json' | 'csv' | 'markdown' | 'bibtex' | 'ris';

/** Export data type */
export type ExportDataType = 'signals' | 'papers' | 'pipeline-runs' | 'thought-graphs' | 'chat-history' | 'all';

/** Educational tooltip entry */
export interface EducationalTooltip {
  id: string;
  title: string;
  description: string;
  useCases: string[];
  learnMore?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

/** Rerouting instruction for thinking */
export interface RerouteInstruction {
  type: 'focus' | 'explore' | 'challenge' | 'synthesize' | 'simplify';
  detail?: string;
}

/** Thinking speed multiplier */
export type ThinkingSpeed = 0.25 | 0.5 | 1 | 1.5 | 2;
