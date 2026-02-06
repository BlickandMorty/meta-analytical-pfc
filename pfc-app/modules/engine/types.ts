import type { PipelineStage, StageResult } from '../store/usePFCStore';

// --- Dual-Message System ---

export interface LaymanSummary {
  whatWasTried: string;
  whatIsLikelyTrue: string;
  confidenceExplanation: string;
  whatCouldChange: string;
  whoShouldTrust: string;
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

// --- Train Me ---

export interface ExperimentSuggestion {
  name: string;
  description: string;
  methodology: string;
  expectedOutcome: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  requiredTools: string[];
}

export interface TrainingInsight {
  id: string;
  category: 'architecture' | 'data' | 'optimization' | 'evaluation' | 'alignment';
  title: string;
  observation: string;
  hypothesis: string;
  experiment: ExperimentSuggestion;
  priority: 'high' | 'medium' | 'low';
  relatedSignals: string[];
}

export interface TrainMeReport {
  insights: TrainingInsight[];
  systemSelfAssessment: string;
  prioritizedImprovements: string[];
  researcherNotes: string;
  timestamp: number;
}
