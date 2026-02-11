'use client';

import type { SynthesisReport, TruthAssessment } from '@/lib/engine/types';
import type { SuiteTier } from '@/lib/research/types';
import type { PFCSet, PFCGet } from '../use-pfc-store';

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export type ChatMode = 'measurement' | 'research' | 'plain';

export interface UISliceState {
  synthesisReport: SynthesisReport | null;
  showSynthesis: boolean;
  showTruthBot: boolean;
  latestTruthAssessment: TruthAssessment | null;
  chatMode: ChatMode;
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface UISliceActions {
  setSynthesisReport: (report: SynthesisReport) => void;
  toggleSynthesisView: () => void;
  toggleTruthBot: () => void;
  setTruthAssessment: (assessment: TruthAssessment) => void;
  setChatMode: (mode: ChatMode) => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createUISlice = (set: PFCSet, get: PFCGet) => ({
  // --- initial state ---
  synthesisReport: null as SynthesisReport | null,
  showSynthesis: false,
  showTruthBot: true,
  latestTruthAssessment: null as TruthAssessment | null,
  chatMode: 'research' as ChatMode,

  // --- actions ---

  setSynthesisReport: (report: SynthesisReport) =>
    set({ synthesisReport: report, showSynthesis: true }),

  toggleSynthesisView: () =>
    set((s) => ({ showSynthesis: !s.showSynthesis })),

  toggleTruthBot: () =>
    set((s) => ({ showTruthBot: !s.showTruthBot })),

  setTruthAssessment: (assessment: TruthAssessment) =>
    set({ latestTruthAssessment: assessment }),

  setChatMode: (mode: ChatMode) => {
    const tierMap: Record<ChatMode, SuiteTier> = {
      measurement: 'full',
      research: 'programming',
      plain: 'notes',
    };
    // UI-owned state only
    set({ chatMode: mode });
    // Cascade: use research slice's own toggle to keep ownership clear
    // researchChatMode is owned by research slice — use flat store set
    set({ researchChatMode: mode !== 'plain' });
    // Cascade to tier system so all feature gating updates
    get().setSuiteTier(tierMap[mode]);
  },
});
