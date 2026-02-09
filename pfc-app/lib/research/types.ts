// ═══════════════════════════════════════════════════════════════════
// Suite Architecture — 3-Tier System
// ═══════════════════════════════════════════════════════════════════

import type { InferenceMode } from '@/lib/engine/llm/config';

/**
 * Three suite tiers, ontologically separated by device capability:
 *
 * 'notes'        → Phones, tablets, weak laptops. AI chat + notes + research library.
 *                   No heavy computation. Minimal memory footprint.
 *
 * 'programming'  → Desktops, dev machines. Adds code analysis, language tools,
 *                   codebase suggestions, steering lab.
 *
 * 'full'         → GPU machines, power users. Adds pipeline measurement, TDA,
 *                   signal diagnostics, cortex archive, live controls.
 */
export type SuiteTier = 'notes' | 'programming' | 'full';

/** Legacy alias — kept for migration */
export type SuiteMode = SuiteTier;

/** Research chat mode toggle */
export type ChatViewMode = 'chat' | 'visualize-thought';

/** Thinking playback state */
export type ThinkingPlayState = 'playing' | 'paused' | 'stopped';

/** Thinking speed multiplier */
export type ThinkingSpeed = 0.25 | 0.5 | 1 | 1.5 | 2;

// ═══════════════════════════════════════════════════════════════════
// Research Types
// ═══════════════════════════════════════════════════════════════════

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
  sourceMessageId?: string;
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

// ═══════════════════════════════════════════════════════════════════
// Code Language Analyzer Types
// ═══════════════════════════════════════════════════════════════════

/** Supported programming languages for analysis */
export type ProgrammingLanguage =
  | 'typescript' | 'javascript' | 'python' | 'rust' | 'go'
  | 'java' | 'kotlin' | 'swift' | 'c' | 'cpp'
  | 'csharp' | 'ruby' | 'php' | 'dart' | 'elixir'
  | 'zig' | 'lua' | 'scala' | 'haskell' | 'ocaml';

/** Project category that influences language recommendation */
export type ProjectCategory =
  | 'web-frontend' | 'web-backend' | 'mobile-native' | 'mobile-cross'
  | 'desktop-app' | 'cli-tool' | 'game-engine' | 'game-scripting'
  | 'ml-training' | 'ml-inference' | 'data-pipeline' | 'embedded'
  | 'systems' | 'blockchain' | 'api-service' | 'devtools'
  | 'library' | 'compiler' | 'database' | 'networking';

/** Language fitness score for a category */
export interface LanguageFitScore {
  language: ProgrammingLanguage;
  overallScore: number;         // 0-100
  performanceScore: number;     // 0-100
  ecosystemScore: number;       // 0-100
  devExperienceScore: number;   // 0-100
  maintainabilityScore: number; // 0-100
  hiringPoolScore: number;      // 0-100
  reasoning: string;
  bestFor: string[];
  tradeoffs: string[];
  recommendedLibs: string[];
  recommendedRepos: string[];
}

/** A codebase analysis result */
export interface CodebaseAnalysis {
  id: string;
  timestamp: number;
  projectName: string;
  currentLanguage: ProgrammingLanguage;
  category: ProjectCategory;
  scores: LanguageFitScore[];
  topRecommendation: ProgrammingLanguage;
  migrationComplexity: 'trivial' | 'moderate' | 'significant' | 'massive';
  estimatedFiles: number;
  aiSummary: string;
}

// ═══════════════════════════════════════════════════════════════════
// Inference-Mode Feature Gating
// ═══════════════════════════════════════════════════════════════════

/** Which features are available per inference mode */
export interface InferenceModeFeatures {
  playPause: boolean;
  speedControl: boolean;
  stopThinking: boolean;
  rerouteThinking: boolean;
  deepResearch: boolean;
  modeLabel: string;
  modeHint: string;
}

/** Get available features for the current inference mode */
export function getInferenceModeFeatures(mode: InferenceMode): InferenceModeFeatures {
  switch (mode) {
    case 'local':
      return {
        playPause: true,
        speedControl: true,
        stopThinking: true,
        rerouteThinking: true,
        deepResearch: true,
        modeLabel: 'Local',
        modeHint: 'Full thinking controls — running on your hardware',
      };
    case 'api':
      return {
        playPause: false,
        speedControl: false,
        stopThinking: true,
        rerouteThinking: true,
        deepResearch: true,
        modeLabel: 'API',
        modeHint: 'Research & notes focused — some controls need local models',
      };
    case 'simulation':
    default:
      return {
        playPause: false,
        speedControl: false,
        stopThinking: true,
        rerouteThinking: true,
        deepResearch: false,
        modeLabel: 'Simulation',
        modeHint: 'Simulated inference — connect a model for full features',
      };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Suite Tier Feature Matrix
// ═══════════════════════════════════════════════════════════════════

/** Complete feature availability for a suite tier */
export interface SuiteTierFeatures {
  // Core (always on)
  chat: boolean;
  researchLibrary: boolean;
  citations: boolean;
  dataExport: boolean;
  educationalTooltips: boolean;

  // Research-level
  thoughtVisualizer: 'off' | 'simplified' | 'full';
  researchMode: boolean;
  deepResearch: boolean;

  // Programming-level
  codeAnalyzer: boolean;
  codebaseTools: boolean;
  steeringLab: boolean;

  // Measurement-level
  pipelineVisualizer: boolean;
  signalDiagnostics: boolean;
  tdaTopology: boolean;
  liveControls: boolean;
  cortexArchive: boolean;
  conceptHierarchy: boolean;
  signalOverrides: boolean;

  // Meta
  tierLabel: string;
  tierDescription: string;
  tierColor: string;
}

/** Get feature set for a suite tier */
export function getSuiteTierFeatures(tier: SuiteTier): SuiteTierFeatures {
  switch (tier) {
    case 'notes':
      return {
        chat: true,
        researchLibrary: true,
        citations: true,
        dataExport: true,
        educationalTooltips: true,
        thoughtVisualizer: 'simplified',
        researchMode: true,
        deepResearch: false,
        codeAnalyzer: false,
        codebaseTools: false,
        steeringLab: false,
        pipelineVisualizer: false,
        signalDiagnostics: false,
        tdaTopology: false,
        liveControls: false,
        cortexArchive: false,
        conceptHierarchy: false,
        signalOverrides: false,
        tierLabel: 'Notes & Research',
        tierDescription: 'AI chat, research library, notes, and citations. Optimized for mobile and low-power devices.',
        tierColor: 'pfc-green',
      };
    case 'programming':
      return {
        chat: true,
        researchLibrary: true,
        citations: true,
        dataExport: true,
        educationalTooltips: true,
        thoughtVisualizer: 'full',
        researchMode: true,
        deepResearch: true,
        codeAnalyzer: true,
        codebaseTools: true,
        steeringLab: true,
        pipelineVisualizer: false,
        signalDiagnostics: false,
        tdaTopology: false,
        liveControls: false,
        cortexArchive: false,
        conceptHierarchy: false,
        signalOverrides: false,
        tierLabel: 'Programming Suite',
        tierDescription: 'Research + code analysis, language tools, codebase suggestions, and AI steering.',
        tierColor: 'pfc-violet',
      };
    case 'full':
    default:
      return {
        chat: true,
        researchLibrary: true,
        citations: true,
        dataExport: true,
        educationalTooltips: true,
        thoughtVisualizer: 'full',
        researchMode: true,
        deepResearch: true,
        codeAnalyzer: true,
        codebaseTools: true,
        steeringLab: true,
        pipelineVisualizer: true,
        signalDiagnostics: true,
        tdaTopology: true,
        liveControls: true,
        cortexArchive: true,
        conceptHierarchy: true,
        signalOverrides: true,
        tierLabel: 'Full Measurement',
        tierDescription: 'Everything — pipeline analysis, signal diagnostics, TDA topology, cortex archive.',
        tierColor: 'pfc-ember',
      };
  }
}
