'use client';

// ═══════════════════════════════════════════════════════════════════
// PFC Store — Composed from modular slices (LobeChat pattern)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Slice creators
import { createMessageSlice } from './slices/message';
import { createPipelineSlice } from './slices/pipeline';
import { createInferenceSlice } from './slices/inference';
import { createControlsSlice } from './slices/controls';
import { createCortexSlice } from './slices/cortex';
import { createConceptsSlice } from './slices/concepts';
import { createTierSlice } from './slices/tier';
import { createResearchSlice } from './slices/research';
import { createPortalSlice } from './slices/portal';
import { createUISlice } from './slices/ui';
import { createNotesSlice } from './slices/notes';
import { createLearningSlice } from './slices/learning';

// Slice types — local imports for composition + re-exports for consumers
import type { MessageSliceState, MessageSliceActions } from './slices/message';
import type { PipelineSliceState, PipelineSliceActions, SignalHistoryEntry } from './slices/pipeline';
import type { InferenceSliceState, InferenceSliceActions } from './slices/inference';
import type { ControlsSliceState, ControlsSliceActions, PipelineControls } from './slices/controls';
import type { CortexSliceState, CortexSliceActions, CortexSnapshot } from './slices/cortex';
import type { ConceptsSliceState, ConceptsSliceActions, ConceptWeight, QueryConceptEntry } from './slices/concepts';
import type { TierSliceState, TierSliceActions } from './slices/tier';
import type { ResearchSliceState, ResearchSliceActions } from './slices/research';
import type { PortalSliceState, PortalSliceActions, PortalViewData, PortalArtifact, PortalViewType } from './slices/portal';
import type { UISliceState, UISliceActions } from './slices/ui';
import type { NotesSliceState, NotesSliceActions } from './slices/notes';
import type { LearningSliceState, LearningSliceActions } from './slices/learning';

// Re-export slice types for consumers
export type { MessageSliceState, MessageSliceActions } from './slices/message';
export type { PipelineSliceState, PipelineSliceActions, SignalHistoryEntry } from './slices/pipeline';
export type { InferenceSliceState, InferenceSliceActions } from './slices/inference';
export type { ControlsSliceState, ControlsSliceActions, PipelineControls } from './slices/controls';
export type { CortexSliceState, CortexSliceActions, CortexSnapshot } from './slices/cortex';
export type { ConceptsSliceState, ConceptsSliceActions, ConceptWeight, QueryConceptEntry } from './slices/concepts';
export type { TierSliceState, TierSliceActions } from './slices/tier';
export type { ResearchSliceState, ResearchSliceActions } from './slices/research';
export type { PortalSliceState, PortalSliceActions, PortalViewData, PortalArtifact, PortalViewType } from './slices/portal';
export type { UISliceState, UISliceActions } from './slices/ui';
export type { NotesSliceState, NotesSliceActions } from './slices/notes';
export type { LearningSliceState, LearningSliceActions } from './slices/learning';

// Re-export constants
export { STAGES, STAGE_LABELS } from '@/lib/constants';

// ═══════════════════════════════════════════════════════════════════
// Aggregate store type
// ═══════════════════════════════════════════════════════════════════

export type PFCStoreState =
  & MessageSliceState
  & PipelineSliceState
  & InferenceSliceState
  & ControlsSliceState
  & CortexSliceState
  & ConceptsSliceState
  & TierSliceState
  & ResearchSliceState
  & PortalSliceState
  & UISliceState
  & NotesSliceState
  & LearningSliceState;

export type PFCStoreActions =
  & MessageSliceActions
  & PipelineSliceActions
  & InferenceSliceActions
  & ControlsSliceActions
  & CortexSliceActions
  & ConceptsSliceActions
  & TierSliceActions
  & ResearchSliceActions
  & PortalSliceActions
  & UISliceActions
  & NotesSliceActions
  & LearningSliceActions
  & { reset: () => void };

export type PFCState = PFCStoreState & PFCStoreActions;

// ═══════════════════════════════════════════════════════════════════
// Create composed store with subscribeWithSelector middleware
// ═══════════════════════════════════════════════════════════════════

export const usePFCStore = create<PFCState>()(
  subscribeWithSelector((set, get, api) => ({
    // Compose all slices
    ...createMessageSlice(set, get),
    ...createPipelineSlice(set, get),
    ...createInferenceSlice(set, get),
    ...createControlsSlice(set, get),
    ...createCortexSlice(set, get),
    ...createConceptsSlice(set, get),
    ...createTierSlice(set, get),
    ...createResearchSlice(set, get),
    ...createPortalSlice(set, get),
    ...createUISlice(set, get),
    ...createNotesSlice(set, get),
    ...createLearningSlice(set, get),

    // Global reset — preserves tier settings, cortex, and codebase analyses
    reset: () => {
      const s = get();
      // Get fresh defaults from each slice
      const freshMsg = createMessageSlice(set, get);
      const freshPipeline = createPipelineSlice(set, get);
      const freshControls = createControlsSlice(set, get);
      const freshResearch = createResearchSlice(set, get);
      const freshPortal = createPortalSlice(set, get);
      const freshUI = createUISlice(set, get);

      set({
        // Reset message state
        messages: freshMsg.messages,
        streamingText: freshMsg.streamingText,
        isStreaming: freshMsg.isStreaming,
        currentChatId: freshMsg.currentChatId,
        pendingAttachments: freshMsg.pendingAttachments,
        reasoningText: freshMsg.reasoningText,
        reasoningDuration: freshMsg.reasoningDuration,
        isReasoning: freshMsg.isReasoning,
        activeMessageLayer: freshMsg.activeMessageLayer,

        // Reset pipeline state
        pipelineStages: freshPipeline.pipelineStages,
        activeStage: freshPipeline.activeStage,
        isProcessing: freshPipeline.isProcessing,
        confidence: freshPipeline.confidence,
        entropy: freshPipeline.entropy,
        dissonance: freshPipeline.dissonance,
        healthScore: freshPipeline.healthScore,
        safetyState: freshPipeline.safetyState,
        riskScore: freshPipeline.riskScore,
        tda: freshPipeline.tda,
        focusDepth: freshPipeline.focusDepth,
        temperatureScale: freshPipeline.temperatureScale,
        activeConcepts: freshPipeline.activeConcepts,
        activeChordProduct: freshPipeline.activeChordProduct,
        harmonyKeyDistance: freshPipeline.harmonyKeyDistance,
        queriesProcessed: freshPipeline.queriesProcessed,
        totalTraces: freshPipeline.totalTraces,
        skillGapsDetected: freshPipeline.skillGapsDetected,
        signalHistory: [],

        // Reset controls
        controls: freshControls.controls,
        userSignalOverrides: freshControls.userSignalOverrides,

        // Reset research
        researchPapers: [],
        currentCitations: [],
        currentThoughtGraph: null,
        pendingReroute: null,
        researchChatMode: freshResearch.researchChatMode,
        chatViewMode: freshResearch.chatViewMode,
        thinkingPlayState: freshResearch.thinkingPlayState,
        thinkingSpeed: freshResearch.thinkingSpeed,

        // Reset portal
        portalStack: freshPortal.portalStack,
        showPortal: freshPortal.showPortal,

        // Reset UI
        synthesisReport: freshUI.synthesisReport,
        showSynthesis: freshUI.showSynthesis,

        // Preserve tier and cortex
        // (suiteTier, measurementEnabled, tierFeatures stay)
        // (cortexArchive stays)
        // (conceptWeights reset)
        conceptWeights: {},
        queryConceptHistory: [],

        // Reset learning (preserve history)
        learningSession: null,
        learningStreamText: '',
      });
    },
  })),
);

// ═══════════════════════════════════════════════════════════════════
// Standalone utility: get effective signal value
// ═══════════════════════════════════════════════════════════════════

export function getEffectiveSignal(signal: 'confidence' | 'entropy' | 'dissonance' | 'healthScore'): number {
  const state = usePFCStore.getState();
  const override = state.userSignalOverrides[signal];
  if (override !== null) return override;
  return state[signal];
}
