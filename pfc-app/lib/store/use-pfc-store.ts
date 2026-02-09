'use client';

import { create } from 'zustand';
import type { PipelineStage } from '@/lib/constants';
import { STAGES, STAGE_LABELS } from '@/lib/constants';
import type {
  DualMessage,
  SynthesisReport,
  FileAttachment,
  TruthAssessment,
  StageResult,
  StageStatus,
  TDASnapshot,
  SafetyState,
  ChatMessage,
  SignalUpdate,
} from '@/lib/engine/types';
import type { InferenceConfig, InferenceMode, ApiProvider, OpenAIModel, AnthropicModel } from '@/lib/engine/llm/config';
import type { OllamaHardwareStatus } from '@/lib/engine/llm/ollama';

// --- Pipeline helpers ---

function freshPipeline(): StageResult[] {
  return STAGES.map((s) => ({
    stage: s,
    status: 'idle' as StageStatus,
    summary: STAGE_LABELS[s],
  }));
}

let msgId = 0;

// --- Signal history ---

export interface SignalHistoryEntry {
  timestamp: number;
  confidence: number;
  entropy: number;
  dissonance: number;
  healthScore: number;
  riskScore: number;
}

const MAX_SIGNAL_HISTORY = 50;

// --- Concept Hierarchy ---

export interface ConceptWeight {
  concept: string;
  weight: number;       // 0.0 to 2.0, default 1.0 — user-adjustable importance
  firstSeen: number;    // timestamp of first extraction
  lastSeen: number;     // timestamp of most recent extraction
  queryCount: number;   // how many queries this concept appeared in
  autoWeight: number;   // engine-calculated weight (frequency-based)
}

export interface QueryConceptEntry {
  queryId: string;
  timestamp: number;
  concepts: string[];
}

const MAX_CONCEPT_HISTORY = 100;

// --- Cortex Snapshot (brain state archive) ---

export interface CortexSnapshot {
  id: string;
  label: string;
  timestamp: number;
  signals: {
    confidence: number;
    entropy: number;
    dissonance: number;
    healthScore: number;
    safetyState: SafetyState;
    riskScore: number;
  };
  tda: TDASnapshot;
  focus: { focusDepth: number; temperatureScale: number };
  concepts: { activeConcepts: string[]; activeChordProduct: number; harmonyKeyDistance: number };
  controls: PipelineControls;
  meta: { queriesProcessed: number; totalTraces: number; skillGapsDetected: number };
  inferenceMode: InferenceMode;
  signalHistory: SignalHistoryEntry[];
}

const CORTEX_STORAGE_KEY = 'pfc-cortex-archive';

function loadCortexArchive(): CortexSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CORTEX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCortexArchive(snapshots: CortexSnapshot[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CORTEX_STORAGE_KEY, JSON.stringify(snapshots));
}

// --- Pipeline controls ---

export interface PipelineControls {
  focusDepthOverride: number | null;
  temperatureOverride: number | null;
  complexityBias: number;
  adversarialIntensity: number;
  bayesianPriorStrength: number;
}

const defaultControls: PipelineControls = {
  focusDepthOverride: null,
  temperatureOverride: null,
  complexityBias: 0,
  adversarialIntensity: 1.0,
  bayesianPriorStrength: 1.0,
};

// --- State interface ---

export interface PFCState {
  // current chat
  currentChatId: string | null;

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

  // streaming
  streamingText: string;
  isStreaming: boolean;

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

  // inference
  inferenceMode: InferenceMode;
  apiProvider: ApiProvider;
  apiKey: string;
  openaiModel: OpenAIModel;
  anthropicModel: AnthropicModel;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaAvailable: boolean;
  ollamaModels: string[];
  ollamaHardware: OllamaHardwareStatus | null;

  // --- NEW: Live controls ---
  liveControlsOpen: boolean;
  controls: PipelineControls;

  // --- NEW: Signal history ---
  signalHistory: SignalHistoryEntry[];

  // --- NEW: Cortex archive ---
  cortexArchive: CortexSnapshot[];

  // --- NEW: Concept hierarchy ---
  conceptWeights: Record<string, ConceptWeight>;
  queryConceptHistory: QueryConceptEntry[];
  conceptHierarchyOpen: boolean;

  // --- NEW: Manual signal overrides ---
  userSignalOverrides: {
    confidence: number | null;
    entropy: number | null;
    dissonance: number | null;
    healthScore: number | null;
  };

  // actions
  setCurrentChat: (chatId: string) => void;
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
  setSidebarOpen: (open: boolean) => void;
  addAttachment: (file: FileAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  toggleTruthBot: () => void;
  setTruthAssessment: (assessment: TruthAssessment) => void;
  // Streaming actions
  appendStreamingText: (text: string) => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  clearStreamingText: () => void;

  // Bulk signal update from SSE
  applySignalUpdate: (update: Partial<SignalUpdate>) => void;

  // Load messages from DB
  loadMessages: (messages: ChatMessage[]) => void;

  // --- NEW: Live controls actions ---
  toggleLiveControls: () => void;
  setControls: (controls: Partial<PipelineControls>) => void;
  resetControls: () => void;

  // --- NEW: Manual signal overrides actions ---
  setSignalOverride: (signal: 'confidence' | 'entropy' | 'dissonance' | 'healthScore', value: number | null) => void;
  resetAllSignalOverrides: () => void;

  // --- NEW: Inference mode ---
  setInferenceMode: (mode: InferenceMode) => void;
  setApiProvider: (provider: ApiProvider) => void;
  setApiKey: (key: string) => void;
  setOpenAIModel: (model: OpenAIModel) => void;
  setAnthropicModel: (model: AnthropicModel) => void;
  setOllamaBaseUrl: (url: string) => void;
  setOllamaModel: (model: string) => void;
  setOllamaStatus: (available: boolean, models: string[]) => void;
  setOllamaHardware: (hardware: OllamaHardwareStatus | null) => void;
  getInferenceConfig: () => InferenceConfig;

  // --- NEW: Cortex archive ---
  saveCortexSnapshot: (label: string) => void;
  deleteCortexSnapshot: (id: string) => void;
  restoreCortexSnapshot: (id: string) => void;
  loadCortexFromStorage: () => void;

  // --- NEW: Concept hierarchy ---
  recordQueryConcepts: (queryId: string, concepts: string[]) => void;
  setConceptWeight: (concept: string, weight: number) => void;
  resetConceptWeight: (concept: string) => void;
  resetAllConceptWeights: () => void;
  toggleConceptHierarchy: () => void;
  getEffectiveConceptWeights: () => Record<string, number>;

  clearMessages: () => void;
  reset: () => void;
}

// --- Initial state ---

const initialState = {
  currentChatId: null,

  pipelineStages: freshPipeline(),
  activeStage: null,
  isProcessing: false,

  confidence: 0.5,
  entropy: 0,
  dissonance: 0,
  healthScore: 1.0,
  safetyState: 'green' as SafetyState,
  riskScore: 0,

  tda: { betti0: 0, betti1: 0, persistenceEntropy: 0, maxPersistence: 0 },

  focusDepth: 3,
  temperatureScale: 1.0,

  activeChordProduct: 1,
  activeConcepts: [] as string[],
  harmonyKeyDistance: 0,

  queriesProcessed: 0,
  totalTraces: 0,
  skillGapsDetected: 0,

  messages: [] as ChatMessage[],

  streamingText: '',
  isStreaming: false,

  activeMessageLayer: 'raw' as const,
  synthesisReport: null,
  showSynthesis: false,
  arcadeMode: false,

  sidebarOpen: false,

  pendingAttachments: [] as FileAttachment[],

  showTruthBot: true,
  latestTruthAssessment: null,

  inferenceMode: 'simulation' as InferenceMode,
  apiProvider: 'openai' as ApiProvider,
  apiKey: '',
  openaiModel: 'gpt-4o' as OpenAIModel,
  anthropicModel: 'claude-sonnet-4-20250514' as AnthropicModel,
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  ollamaAvailable: false,
  ollamaModels: [] as string[],
  ollamaHardware: null as OllamaHardwareStatus | null,

  // NEW
  liveControlsOpen: false,
  controls: { ...defaultControls },
  signalHistory: [] as SignalHistoryEntry[],
  cortexArchive: [] as CortexSnapshot[],

  // Concept hierarchy
  conceptWeights: {} as Record<string, ConceptWeight>,
  queryConceptHistory: [] as QueryConceptEntry[],
  conceptHierarchyOpen: false,

  // Manual signal overrides
  userSignalOverrides: {
    confidence: null,
    entropy: null,
    dissonance: null,
    healthScore: null,
  },
};

// --- Store ---

export const usePFCStore = create<PFCState>((set, get) => ({
  ...initialState,

  setCurrentChat: (chatId) => set({ currentChatId: chatId }),

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
      streamingText: '',
      isStreaming: false,
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
    set((s) => {
      // Record signal history entry
      const historyEntry: SignalHistoryEntry = {
        timestamp: Date.now(),
        confidence,
        entropy: s.entropy,
        dissonance: s.dissonance,
        healthScore: s.healthScore,
        riskScore: s.riskScore,
      };
      const newHistory = [...s.signalHistory, historyEntry].slice(-MAX_SIGNAL_HISTORY);

      // Record concepts for this query in the hierarchy
      const now = Date.now();
      const queryConcepts = [...s.activeConcepts];
      const newConceptWeights = { ...s.conceptWeights };
      for (const concept of queryConcepts) {
        if (newConceptWeights[concept]) {
          newConceptWeights[concept] = {
            ...newConceptWeights[concept],
            lastSeen: now,
            queryCount: newConceptWeights[concept].queryCount + 1,
            autoWeight: Math.min(2.0, 0.5 + (newConceptWeights[concept].queryCount + 1) * 0.15),
          };
        } else {
          newConceptWeights[concept] = {
            concept,
            weight: 1.0,
            firstSeen: now,
            lastSeen: now,
            queryCount: 1,
            autoWeight: 0.65,
          };
        }
      }
      const conceptEntry: QueryConceptEntry = { queryId: id, timestamp: now, concepts: queryConcepts };
      const newConceptHistory = [...s.queryConceptHistory, conceptEntry].slice(-MAX_CONCEPT_HISTORY);

      return {
        isProcessing: false,
        isStreaming: false,
        activeStage: null,
        confidence,
        queriesProcessed: s.queriesProcessed + 1,
        totalTraces: s.totalTraces + 1,
        latestTruthAssessment: truthAssessment ?? null,
        signalHistory: newHistory,
        conceptWeights: newConceptWeights,
        queryConceptHistory: newConceptHistory,
        pipelineStages: s.pipelineStages.map((sr) => ({
          ...sr,
          status: 'complete' as StageStatus,
        })),
        messages: [...s.messages, {
          id,
          role: 'system' as const,
          text: dualMessage.rawAnalysis,
          timestamp: Date.now(),
          confidence,
          evidenceGrade: grade,
          mode,
          dualMessage,
          truthAssessment,
          // Attach per-message concepts
          concepts: queryConcepts,
        }],
        streamingText: '',
      };
    });
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

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

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

  // Streaming actions
  appendStreamingText: (text) =>
    set((s) => ({ streamingText: s.streamingText + text })),

  startStreaming: () =>
    set({ isStreaming: true, streamingText: '' }),

  stopStreaming: () =>
    set({ isStreaming: false }),

  clearStreamingText: () =>
    set({ streamingText: '' }),

  // Bulk signal update from SSE events
  applySignalUpdate: (update) =>
    set((s) => ({
      ...(update.confidence !== undefined && { confidence: update.confidence }),
      ...(update.entropy !== undefined && { entropy: update.entropy }),
      ...(update.dissonance !== undefined && { dissonance: update.dissonance }),
      ...(update.healthScore !== undefined && { healthScore: update.healthScore }),
      ...(update.safetyState !== undefined && { safetyState: update.safetyState }),
      ...(update.riskScore !== undefined && { riskScore: update.riskScore }),
      ...(update.tda && { tda: { ...s.tda, ...update.tda } }),
      ...(update.focusDepth !== undefined && { focusDepth: update.focusDepth }),
      ...(update.temperatureScale !== undefined && { temperatureScale: update.temperatureScale }),
      ...(update.activeConcepts && { activeConcepts: update.activeConcepts }),
      ...(update.activeChordProduct !== undefined && { activeChordProduct: update.activeChordProduct }),
      ...(update.harmonyKeyDistance !== undefined && { harmonyKeyDistance: update.harmonyKeyDistance }),
    })),

  // Load messages from DB
  loadMessages: (messages) => set({ messages }),

  // --- NEW: Live controls ---
  toggleLiveControls: () =>
    set((s) => ({ liveControlsOpen: !s.liveControlsOpen })),

  setControls: (partial) =>
    set((s) => ({ controls: { ...s.controls, ...partial } })),

  resetControls: () =>
    set({ controls: { ...defaultControls } }),

  // --- NEW: Manual signal overrides ---
  setSignalOverride: (signal, value) =>
    set((s) => ({
      userSignalOverrides: { ...s.userSignalOverrides, [signal]: value },
    })),

  resetAllSignalOverrides: () =>
    set({
      userSignalOverrides: {
        confidence: null,
        entropy: null,
        dissonance: null,
        healthScore: null,
      },
    }),

  // --- NEW: Inference mode ---
  setInferenceMode: (mode) => set({ inferenceMode: mode }),
  setApiProvider: (provider) => set({ apiProvider: provider }),
  setApiKey: (key) => set({ apiKey: key }),
  setOpenAIModel: (model) => set({ openaiModel: model }),
  setAnthropicModel: (model) => set({ anthropicModel: model }),
  setOllamaBaseUrl: (url) => set({ ollamaBaseUrl: url }),
  setOllamaModel: (model) => set({ ollamaModel: model }),
  setOllamaStatus: (available, models) => set({ ollamaAvailable: available, ollamaModels: models }),
  setOllamaHardware: (hardware) => set({ ollamaHardware: hardware }),
  getInferenceConfig: () => {
    const s = get();
    return {
      mode: s.inferenceMode,
      apiProvider: s.apiProvider,
      apiKey: s.apiKey,
      openaiModel: s.openaiModel,
      anthropicModel: s.anthropicModel,
      ollamaBaseUrl: s.ollamaBaseUrl,
      ollamaModel: s.ollamaModel,
    };
  },

  // --- NEW: Cortex archive ---
  saveCortexSnapshot: (label) =>
    set((s) => {
      const snapshot: CortexSnapshot = {
        id: `cortex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label,
        timestamp: Date.now(),
        signals: {
          confidence: s.confidence,
          entropy: s.entropy,
          dissonance: s.dissonance,
          healthScore: s.healthScore,
          safetyState: s.safetyState,
          riskScore: s.riskScore,
        },
        tda: { ...s.tda },
        focus: { focusDepth: s.focusDepth, temperatureScale: s.temperatureScale },
        concepts: { activeConcepts: [...s.activeConcepts], activeChordProduct: s.activeChordProduct, harmonyKeyDistance: s.harmonyKeyDistance },
        controls: { ...s.controls },
        meta: { queriesProcessed: s.queriesProcessed, totalTraces: s.totalTraces, skillGapsDetected: s.skillGapsDetected },
        inferenceMode: s.inferenceMode,
        signalHistory: [...s.signalHistory],
      };
      const updated = [snapshot, ...s.cortexArchive].slice(0, 50);
      saveCortexArchive(updated);
      return { cortexArchive: updated };
    }),

  deleteCortexSnapshot: (id) =>
    set((s) => {
      const updated = s.cortexArchive.filter((snap) => snap.id !== id);
      saveCortexArchive(updated);
      return { cortexArchive: updated };
    }),

  restoreCortexSnapshot: (id) =>
    set((s) => {
      const snap = s.cortexArchive.find((sn) => sn.id === id);
      if (!snap) return {};
      return {
        confidence: snap.signals.confidence,
        entropy: snap.signals.entropy,
        dissonance: snap.signals.dissonance,
        healthScore: snap.signals.healthScore,
        safetyState: snap.signals.safetyState,
        riskScore: snap.signals.riskScore,
        tda: { ...snap.tda },
        focusDepth: snap.focus.focusDepth,
        temperatureScale: snap.focus.temperatureScale,
        activeConcepts: [...snap.concepts.activeConcepts],
        activeChordProduct: snap.concepts.activeChordProduct,
        harmonyKeyDistance: snap.concepts.harmonyKeyDistance,
        controls: { ...snap.controls },
        queriesProcessed: snap.meta.queriesProcessed,
        totalTraces: snap.meta.totalTraces,
        skillGapsDetected: snap.meta.skillGapsDetected,
        inferenceMode: snap.inferenceMode,
        signalHistory: [...snap.signalHistory],
      };
    }),

  loadCortexFromStorage: () =>
    set({ cortexArchive: loadCortexArchive() }),

  // --- NEW: Concept hierarchy ---
  recordQueryConcepts: (queryId, concepts) =>
    set((s) => {
      const now = Date.now();
      const newWeights = { ...s.conceptWeights };

      for (const concept of concepts) {
        if (newWeights[concept]) {
          newWeights[concept] = {
            ...newWeights[concept],
            lastSeen: now,
            queryCount: newWeights[concept].queryCount + 1,
            autoWeight: Math.min(2.0, 0.5 + (newWeights[concept].queryCount + 1) * 0.15),
          };
        } else {
          newWeights[concept] = {
            concept,
            weight: 1.0,
            firstSeen: now,
            lastSeen: now,
            queryCount: 1,
            autoWeight: 0.65,
          };
        }
      }

      const entry: QueryConceptEntry = { queryId, timestamp: now, concepts };
      const newHistory = [...s.queryConceptHistory, entry].slice(-MAX_CONCEPT_HISTORY);

      return {
        conceptWeights: newWeights,
        queryConceptHistory: newHistory,
      };
    }),

  setConceptWeight: (concept, weight) =>
    set((s) => {
      const existing = s.conceptWeights[concept];
      if (!existing) return {};
      return {
        conceptWeights: {
          ...s.conceptWeights,
          [concept]: { ...existing, weight: Math.max(0, Math.min(2.0, weight)) },
        },
      };
    }),

  resetConceptWeight: (concept) =>
    set((s) => {
      const existing = s.conceptWeights[concept];
      if (!existing) return {};
      return {
        conceptWeights: {
          ...s.conceptWeights,
          [concept]: { ...existing, weight: 1.0 },
        },
      };
    }),

  resetAllConceptWeights: () =>
    set((s) => {
      const reset: Record<string, ConceptWeight> = {};
      for (const [key, cw] of Object.entries(s.conceptWeights)) {
        reset[key] = { ...cw, weight: 1.0 };
      }
      return { conceptWeights: reset };
    }),

  toggleConceptHierarchy: () =>
    set((s) => ({ conceptHierarchyOpen: !s.conceptHierarchyOpen })),

  getEffectiveConceptWeights: (): Record<string, number> => {
    const state = usePFCStore.getState();
    const result: Record<string, number> = {};
    for (const [key, cw] of Object.entries(state.conceptWeights)) {
      result[key] = cw.weight * cw.autoWeight;
    }
    return result;
  },

  clearMessages: () => set(() => ({ messages: [], currentChatId: null, isProcessing: false, isStreaming: false, streamingText: '', pipelineStages: freshPipeline(), activeStage: null })),

  reset: () => set((s) => ({ ...initialState, pipelineStages: freshPipeline(), signalHistory: [], cortexArchive: s.cortexArchive, conceptWeights: {}, queryConceptHistory: [], userSignalOverrides: { confidence: null, entropy: null, dissonance: null, healthScore: null } })),
}));

// --- Standalone utility: get effective signal value ---
export function getEffectiveSignal(signal: 'confidence' | 'entropy' | 'dissonance' | 'healthScore'): number {
  const state = usePFCStore.getState();
  const override = state.userSignalOverrides[signal];
  if (override !== null) return override;
  return state[signal];
}

export { STAGES, STAGE_LABELS };
