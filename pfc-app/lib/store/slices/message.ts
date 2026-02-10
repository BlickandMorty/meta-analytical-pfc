'use client';

import type {
  ChatMessage,
  DualMessage,
  FileAttachment,
  TruthAssessment,
  StageResult,
  StageStatus,
  SignalUpdate,
  SafetyState,
} from '@/lib/engine/types';
import type {
  ResearchPaper,
  Citation,
  ThoughtGraph,
  RerouteInstruction,
} from '@/lib/research/types';
import type { PipelineStage } from '@/lib/constants';
import { STAGES, STAGE_LABELS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshPipeline(): StageResult[] {
  return STAGES.map((s) => ({
    stage: s,
    status: 'idle' as StageStatus,
    summary: STAGE_LABELS[s],
  }));
}

let msgId = 0;

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface MessageSliceState {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  activeMessageLayer: 'raw' | 'layman';
  currentChatId: string | null;
  pendingAttachments: FileAttachment[];

  // Reasoning (AI thinking) state
  reasoningText: string;
  reasoningDuration: number | null;
  isReasoning: boolean;
  isThinkingPaused: boolean;
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface MessageSliceActions {
  setCurrentChat: (chatId: string) => void;
  submitQuery: (query: string) => void;
  completeProcessing: (
    dualMessage: DualMessage,
    confidence: number,
    grade: string,
    mode: string,
    truthAssessment?: TruthAssessment,
  ) => void;
  toggleMessageLayer: () => void;
  loadMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  appendStreamingText: (text: string) => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  clearStreamingText: () => void;
  addAttachment: (file: FileAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  // Reasoning actions
  appendReasoningText: (text: string) => void;
  startReasoning: () => void;
  stopReasoning: () => void;
  clearReasoning: () => void;
  setThinkingPaused: (paused: boolean) => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createMessageSlice = (set: any, get: any) => ({
  // --- initial state ---
  messages: [] as ChatMessage[],
  streamingText: '',
  isStreaming: false,
  activeMessageLayer: 'raw' as const,
  currentChatId: null as string | null,
  pendingAttachments: [] as FileAttachment[],

  // Reasoning state
  reasoningText: '',
  reasoningDuration: null as number | null,
  isReasoning: false,
  isThinkingPaused: false,

  // --- actions ---

  setCurrentChat: (chatId: string) => set({ currentChatId: chatId }),

  submitQuery: (query: string) => {
    const id = `msg-${++msgId}`;
    set((s: any) => ({
      messages: [
        ...s.messages,
        {
          id,
          role: 'user',
          text: query,
          timestamp: Date.now(),
          attachments:
            s.pendingAttachments.length > 0
              ? [...s.pendingAttachments]
              : undefined,
        },
      ],
      pendingAttachments: [],
      isProcessing: true,
      pipelineStages: freshPipeline(),
      activeStage: 'triage',
      showSynthesis: false,
      streamingText: '',
      isStreaming: false,
      // Reset reasoning for new query
      reasoningText: '',
      reasoningDuration: null,
      isReasoning: false,
    }));
  },

  completeProcessing: (
    dualMessage: DualMessage,
    confidence: number,
    grade: string,
    mode: string,
    truthAssessment?: TruthAssessment,
  ) => {
    const id = `msg-${++msgId}`;
    set((s: any) => {
      // Record signal history entry
      const historyEntry = {
        timestamp: Date.now(),
        confidence,
        entropy: s.entropy,
        dissonance: s.dissonance,
        healthScore: s.healthScore,
        riskScore: s.riskScore,
      };
      const MAX_SIGNAL_HISTORY = 50;
      const newHistory = [...s.signalHistory, historyEntry].slice(
        -MAX_SIGNAL_HISTORY,
      );

      // Record concepts for this query in the hierarchy
      const now = Date.now();
      const queryConcepts = [...s.activeConcepts];
      const MAX_CONCEPT_HISTORY = 100;
      const newConceptWeights = { ...s.conceptWeights };
      for (const concept of queryConcepts) {
        if (newConceptWeights[concept]) {
          newConceptWeights[concept] = {
            ...newConceptWeights[concept],
            lastSeen: now,
            queryCount: newConceptWeights[concept].queryCount + 1,
            autoWeight: Math.min(
              2.0,
              0.5 + (newConceptWeights[concept].queryCount + 1) * 0.15,
            ),
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
      const conceptEntry = {
        queryId: id,
        timestamp: now,
        concepts: queryConcepts,
      };
      const newConceptHistory = [
        ...s.queryConceptHistory,
        conceptEntry,
      ].slice(-MAX_CONCEPT_HISTORY);

      // Build reasoning attachment for the message (NEW)
      const reasoning =
        s.reasoningText.length > 0
          ? {
              content: s.reasoningText,
              duration: s.reasoningDuration ?? undefined,
            }
          : undefined;

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
        pipelineStages: s.pipelineStages.map((sr: StageResult) => ({
          ...sr,
          status: 'complete' as StageStatus,
        })),
        messages: [
          ...s.messages,
          {
            id,
            role: 'system' as const,
            text: dualMessage.rawAnalysis,
            timestamp: Date.now(),
            confidence,
            evidenceGrade: grade,
            mode,
            dualMessage,
            truthAssessment,
            concepts: queryConcepts,
            reasoning,
          },
        ],
        streamingText: '',
        // Reset reasoning state after completion
        reasoningText: '',
        reasoningDuration: null,
        isReasoning: false,
      };
    });
  },

  toggleMessageLayer: () =>
    set((s: any) => ({
      activeMessageLayer: s.activeMessageLayer === 'raw' ? 'layman' : 'raw',
    })),

  loadMessages: (messages: ChatMessage[]) => set({ messages }),

  clearMessages: () =>
    set(() => ({
      messages: [],
      currentChatId: null,
      isProcessing: false,
      isStreaming: false,
      streamingText: '',
      pipelineStages: freshPipeline(),
      activeStage: null,
      // Also clear reasoning on message clear
      reasoningText: '',
      reasoningDuration: null,
      isReasoning: false,
    })),

  appendStreamingText: (text: string) =>
    set((s: any) => ({ streamingText: s.streamingText + text })),

  startStreaming: () => set({ isStreaming: true, streamingText: '' }),

  stopStreaming: () => set({ isStreaming: false }),

  clearStreamingText: () => set({ streamingText: '' }),

  addAttachment: (file: FileAttachment) =>
    set((s: any) => ({
      pendingAttachments: [...s.pendingAttachments, file],
    })),

  removeAttachment: (id: string) =>
    set((s: any) => ({
      pendingAttachments: s.pendingAttachments.filter(
        (f: FileAttachment) => f.id !== id,
      ),
    })),

  clearAttachments: () => set({ pendingAttachments: [] }),

  // --- NEW: reasoning actions ---

  appendReasoningText: (text: string) =>
    set((s: any) => ({ reasoningText: s.reasoningText + text })),

  startReasoning: () =>
    set({ isReasoning: true, reasoningText: '', reasoningDuration: null }),

  stopReasoning: () => {
    const s = get();
    // If we were reasoning, calculate the duration based on when reasoning started
    // We don't have a start timestamp stored, so stopReasoning just marks it done.
    // The caller can set reasoningDuration explicitly if needed.
    set({ isReasoning: false });
  },

  clearReasoning: () =>
    set({ reasoningText: '', reasoningDuration: null, isReasoning: false }),

  setThinkingPaused: (paused: boolean) => set({ isThinkingPaused: paused }),
});
