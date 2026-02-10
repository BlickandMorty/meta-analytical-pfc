'use client';

import type { SynthesisReport, TruthAssessment } from '@/lib/engine/types';

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface UISliceState {
  synthesisReport: SynthesisReport | null;
  showSynthesis: boolean;
  arcadeMode: boolean;
  sidebarOpen: boolean;
  showTruthBot: boolean;
  latestTruthAssessment: TruthAssessment | null;
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface UISliceActions {
  setSynthesisReport: (report: SynthesisReport) => void;
  toggleSynthesisView: () => void;
  toggleArcadeMode: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTruthBot: () => void;
  setTruthAssessment: (assessment: TruthAssessment) => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createUISlice = (set: any, get: any) => ({
  // --- initial state ---
  synthesisReport: null as SynthesisReport | null,
  showSynthesis: false,
  arcadeMode: false,
  sidebarOpen: false,
  showTruthBot: true,
  latestTruthAssessment: null as TruthAssessment | null,

  // --- actions ---

  setSynthesisReport: (report: SynthesisReport) =>
    set({ synthesisReport: report, showSynthesis: true }),

  toggleSynthesisView: () =>
    set((s: any) => ({ showSynthesis: !s.showSynthesis })),

  toggleArcadeMode: () =>
    set((s: any) => ({ arcadeMode: !s.arcadeMode })),

  toggleSidebar: () =>
    set((s: any) => ({ sidebarOpen: !s.sidebarOpen })),

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  toggleTruthBot: () =>
    set((s: any) => ({ showTruthBot: !s.showTruthBot })),

  setTruthAssessment: (assessment: TruthAssessment) =>
    set({ latestTruthAssessment: assessment }),
});
