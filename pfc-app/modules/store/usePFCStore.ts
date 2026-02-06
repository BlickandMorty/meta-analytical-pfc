import { create } from 'zustand';
import type { SafetyState } from '../shared/theme/colors';
import type {
  DualMessage,
  SynthesisReport,
  FileAttachment,
  TruthAssessment,
  TrainMeReport,
} from '../engine/types';
export type { SafetyState };

// --- types ---

export type PipelineStage =
  | 'triage'
  | 'memory'
  | 'routing'
  | 'statistical'
  | 'causal'
  | 'meta_analysis'
  | 'bayesian'
  | 'synthesis'
  | 'adversarial'
  | 'calibration';

export type StageStatus = 'idle' | 'active' | 'complete' | 'error';

export interface StageResult {
  stage: PipelineStage;
  status: StageStatus;
  summary: string;
  detail?: string;
  value?: number;
}

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
}

export interface TDASnapshot {
  betti0: number;
  betti1: number;
  persistenceEntropy: number;
  maxPersistence: number;
}

export interface PFCState {
  // setup
  isConfigured: boolean;
  inferenceMode: 'hybrid' | 'local';
  apiKey: string;

  // pipeline
  pipelineStages: StageResult[];
  activeStage: PipelineStage | null;
  isProcessing: boolean;

  // signals
  confidence: number;
  entropy: number;
  dissonance: number;
  healthScore: number;
  safetyState: SafetyState;
  riskScore: number;

  // tda
  tda: TDASnapshot;

  // focus
  focusDepth: number;
  temperatureScale: number;

  // concept chords
  activeChordProduct: number;
  activeConcepts: string[];
  harmonyKeyDistance: number;

  // meta
  queriesProcessed: number;
  totalTraces: number;
  skillGapsDetected: number;

  // chat
  messages: ChatMessage[];

  // dual-message layer
  activeMessageLayer: 'raw' | 'layman';

  // synthesis
  synthesisReport: SynthesisReport | null;
  showSynthesis: boolean;

  // arcade mode
  arcadeMode: boolean;

  // sidebar
  sidebarOpen: boolean;

  // file uploads
  pendingAttachments: FileAttachment[];

  // truth bot
  showTruthBot: boolean;
  latestTruthAssessment: TruthAssessment | null;

  // train me
  trainMeReport: TrainMeReport | null;

  // actions
  configure: (apiKey: string, mode: 'hybrid' | 'local') => void;
  submitQuery: (query: string) => void;
  advanceStage: (stage: PipelineStage, result: Partial<StageResult>) => void;
  completeProcessing: (dualMessage: DualMessage, confidence: number, grade: string, mode: string, truthAssessment?: TruthAssessment) => void;
  updateSignals: (signals: Partial<Pick<PFCState, 'entropy' | 'dissonance' | 'healthScore' | 'safetyState' | 'riskScore'>>) => void;
  updateTDA: (tda: Partial<TDASnapshot>) => void;
  updateFocus: (depth: number, temp: number) => void;
  updateConcepts: (concepts: string[], chord: number, harmony: number) => void;
  incrementSkillGaps: () => void;
  toggleMessageLayer: () => void;
  setSynthesisReport: (report: SynthesisReport) => void;
  toggleSynthesisView: () => void;
  toggleArcadeMode: () => void;
  toggleSidebar: () => void;
  addAttachment: (file: FileAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  toggleTruthBot: () => void;
  setTruthAssessment: (assessment: TruthAssessment) => void;
  setTrainMeReport: (report: TrainMeReport) => void;
  reset: () => void;
}

// --- initial pipeline ---

const STAGES: PipelineStage[] = [
  'triage', 'memory', 'routing', 'statistical', 'causal',
  'meta_analysis', 'bayesian', 'synthesis', 'adversarial', 'calibration',
];

const STAGE_LABELS: Record<PipelineStage, string> = {
  triage: 'Triage',
  memory: 'Memory Retrieval',
  routing: 'Pathway Routing',
  statistical: 'Statistical Analysis',
  causal: 'Causal Inference',
  meta_analysis: 'Meta-Analysis',
  bayesian: 'Bayesian Updating',
  synthesis: 'Synthesis',
  adversarial: 'Adversarial Review',
  calibration: 'Confidence Calibration',
};

function freshPipeline(): StageResult[] {
  return STAGES.map((s) => ({
    stage: s,
    status: 'idle' as StageStatus,
    summary: STAGE_LABELS[s],
  }));
}

let msgId = 0;

// --- store ---

export const usePFCStore = create<PFCState>((set) => ({
  isConfigured: false,
  inferenceMode: 'hybrid',
  apiKey: '',

  pipelineStages: freshPipeline(),
  activeStage: null,
  isProcessing: false,

  confidence: 0.5,
  entropy: 0,
  dissonance: 0,
  healthScore: 1.0,
  safetyState: 'green',
  riskScore: 0,

  tda: { betti0: 0, betti1: 0, persistenceEntropy: 0, maxPersistence: 0 },

  focusDepth: 3,
  temperatureScale: 1.0,

  activeChordProduct: 1,
  activeConcepts: [],
  harmonyKeyDistance: 0,

  queriesProcessed: 0,
  totalTraces: 0,
  skillGapsDetected: 0,

  messages: [],

  activeMessageLayer: 'layman',
  synthesisReport: null,
  showSynthesis: false,
  arcadeMode: false,

  sidebarOpen: false,

  pendingAttachments: [],

  showTruthBot: true,
  latestTruthAssessment: null,

  trainMeReport: null,

  configure: (apiKey, mode) =>
    set({ isConfigured: true, apiKey, inferenceMode: mode }),

  submitQuery: (query) => {
    const id = `msg-${++msgId}`;
    set((s) => ({
      messages: [...s.messages, {
        id,
        role: 'user',
        text: query,
        timestamp: Date.now(),
        attachments: s.pendingAttachments.length > 0 ? [...s.pendingAttachments] : undefined,
      }],
      pendingAttachments: [],
      isProcessing: true,
      pipelineStages: freshPipeline(),
      activeStage: 'triage',
      showSynthesis: false,
    }));
  },

  advanceStage: (stage, result) =>
    set((s) => ({
      activeStage: stage,
      pipelineStages: s.pipelineStages.map((sr) =>
        sr.stage === stage
          ? { ...sr, ...result, status: result.status ?? 'active' }
          : sr
      ),
    })),

  completeProcessing: (dualMessage, confidence, grade, mode, truthAssessment) => {
    const id = `msg-${++msgId}`;
    set((s) => ({
      isProcessing: false,
      activeStage: null,
      confidence,
      queriesProcessed: s.queriesProcessed + 1,
      totalTraces: s.totalTraces + 1,
      latestTruthAssessment: truthAssessment ?? null,
      pipelineStages: s.pipelineStages.map((sr) => ({
        ...sr,
        status: 'complete' as StageStatus,
      })),
      messages: [...s.messages, {
        id,
        role: 'system',
        text: dualMessage.rawAnalysis,
        timestamp: Date.now(),
        confidence,
        evidenceGrade: grade,
        mode,
        dualMessage,
        truthAssessment,
      }],
    }));
  },

  updateSignals: (signals) => set(signals),

  updateTDA: (tda) =>
    set((s) => ({ tda: { ...s.tda, ...tda } })),

  updateFocus: (depth, temp) =>
    set({ focusDepth: depth, temperatureScale: temp }),

  updateConcepts: (concepts, chord, harmony) =>
    set({ activeConcepts: concepts, activeChordProduct: chord, harmonyKeyDistance: harmony }),

  incrementSkillGaps: () =>
    set((s) => ({ skillGapsDetected: s.skillGapsDetected + 1 })),

  toggleMessageLayer: () =>
    set((s) => ({
      activeMessageLayer: s.activeMessageLayer === 'raw' ? 'layman' : 'raw',
    })),

  setSynthesisReport: (report) =>
    set({ synthesisReport: report, showSynthesis: true }),

  toggleSynthesisView: () =>
    set((s) => ({ showSynthesis: !s.showSynthesis })),

  toggleArcadeMode: () =>
    set((s) => ({ arcadeMode: !s.arcadeMode })),

  toggleSidebar: () =>
    set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  addAttachment: (file) =>
    set((s) => ({ pendingAttachments: [...s.pendingAttachments, file] })),

  removeAttachment: (id) =>
    set((s) => ({
      pendingAttachments: s.pendingAttachments.filter((f) => f.id !== id),
    })),

  clearAttachments: () =>
    set({ pendingAttachments: [] }),

  toggleTruthBot: () =>
    set((s) => ({ showTruthBot: !s.showTruthBot })),

  setTruthAssessment: (assessment) =>
    set({ latestTruthAssessment: assessment }),

  setTrainMeReport: (report) =>
    set({ trainMeReport: report }),

  reset: () =>
    set({
      pipelineStages: freshPipeline(),
      activeStage: null,
      isProcessing: false,
      confidence: 0.5,
      entropy: 0,
      dissonance: 0,
      healthScore: 1.0,
      safetyState: 'green',
      riskScore: 0,
      tda: { betti0: 0, betti1: 0, persistenceEntropy: 0, maxPersistence: 0 },
      focusDepth: 3,
      temperatureScale: 1.0,
      activeChordProduct: 1,
      activeConcepts: [],
      harmonyKeyDistance: 0,
      queriesProcessed: 0,
      totalTraces: 0,
      skillGapsDetected: 0,
      messages: [],
      synthesisReport: null,
      showSynthesis: false,
      pendingAttachments: [],
      latestTruthAssessment: null,
      trainMeReport: null,
    }),
}));

export { STAGES, STAGE_LABELS };
