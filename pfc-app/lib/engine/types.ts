import type { PipelineStage } from '@/lib/constants';

// --- Pipeline Stage Result ---

export type StageStatus = 'idle' | 'active' | 'complete' | 'error';

export interface StageResult {
  stage: PipelineStage;
  status: StageStatus;
  summary: string;
  detail?: string;
  value?: number;
}

// --- Dual-Message System ---

export interface LaymanSummary {
  whatWasTried: string;
  whatIsLikelyTrue: string;
  confidenceExplanation: string;
  whatCouldChange: string;
  whoShouldTrust: string;
  sectionLabels?: {
    whatWasTried?: string;
    whatIsLikelyTrue?: string;
    confidenceExplanation?: string;
    whatCouldChange?: string;
    whoShouldTrust?: string;
  };
}

export interface ReflectionResult {
  selfCriticalQuestions: string[];
  adjustments: string[];
  leastDefensibleClaim: string;
  precisionVsEvidenceCheck: string;
}

export interface EngineVote {
  engine: PipelineStage;
  position: 'supports' | 'opposes' | 'neutral';
  reasoning: string;
  confidence: number;
}

export interface ArbitrationResult {
  consensus: boolean;
  votes: EngineVote[];
  disagreements: string[];
  resolution: string;
}

export interface DualMessage {
  rawAnalysis: string;
  uncertaintyTags: UncertaintyTag[];
  modelVsDataFlags: DataFlag[];

  laymanSummary: LaymanSummary;
  reflection: ReflectionResult;
  arbitration: ArbitrationResult;
}

export type UncertaintyTag = {
  claim: string;
  tag: 'DATA' | 'MODEL' | 'UNCERTAIN' | 'CONFLICT';
};

export type DataFlag = {
  claim: string;
  source: 'data-driven' | 'model-assumption' | 'heuristic';
};

// --- Synthesis Report ---

export interface SynthesisReport {
  plainSummary: string;
  researchSummary: string;
  suggestions: string[];
  timestamp: number;
}

// --- File Attachments ---

export interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'csv' | 'pdf' | 'text' | 'other';
  uri: string;
  size: number;
  mimeType: string;
  preview?: string;
}

// --- Truth Bot ---

export interface TruthAssessment {
  overallTruthLikelihood: number;
  signalInterpretation: string;
  weaknesses: string[];
  improvements: string[];
  blindSpots: string[];
  confidenceCalibration: string;
  dataVsModelBalance: string;
  recommendedActions: string[];
}

// --- TDA Snapshot ---

export interface TDASnapshot {
  betti0: number;
  betti1: number;
  persistenceEntropy: number;
  maxPersistence: number;
}

// --- Safety State ---

export type SafetyState = 'green' | 'yellow' | 'orange' | 'red';

// --- SSE Pipeline Events ---

export type PipelineEvent =
  | { type: 'stage'; stage: PipelineStage; detail: string; value: number; status: StageStatus }
  | { type: 'signals'; data: Partial<SignalUpdate> }
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'complete'; dualMessage: DualMessage; truthAssessment: TruthAssessment; confidence: number; grade: string; mode: string; signals: SignalUpdate }
  | { type: 'error'; message: string };

export interface SignalUpdate {
  confidence: number;
  entropy: number;
  dissonance: number;
  healthScore: number;
  safetyState: SafetyState;
  riskScore: number;
  tda: TDASnapshot;
  focusDepth: number;
  temperatureScale: number;
  activeConcepts: string[];
  activeChordProduct: number;
  harmonyKeyDistance: number;
}

// --- Chat Message (for DB serialization) ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'system';
  text: string;
  timestamp: number;
  confidence?: number;
  evidenceGrade?: string;
  mode?: string;
  dualMessage?: DualMessage;
  attachments?: FileAttachment[];
  truthAssessment?: TruthAssessment;
  concepts?: string[];
  reasoning?: {
    content: string;
    duration?: number;
  };
}
