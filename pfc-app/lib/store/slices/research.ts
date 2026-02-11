'use client';

import type {
  ChatViewMode,
  ResearchPaper,
  Citation,
  ThoughtGraph,
  RerouteInstruction,
  ResearchBook,
} from '@/lib/research/types';
import type { PFCSet, PFCGet } from '../use-pfc-store';

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface ResearchSliceState {
  researchChatMode: boolean;
  chatViewMode: ChatViewMode;
  researchPapers: ResearchPaper[];
  currentCitations: Citation[];
  currentThoughtGraph: ThoughtGraph | null;
  pendingReroute: RerouteInstruction | null;
  researchBooks: ResearchBook[];
  researchModeControls: {
    autoExtractCitations: boolean;
    showVisualizationPreview: boolean;
    deepResearchEnabled: boolean;
  };
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface ResearchSliceActions {
  toggleResearchChatMode: () => void;
  setChatViewMode: (mode: ChatViewMode) => void;
  addResearchPaper: (paper: ResearchPaper) => void;
  removeResearchPaper: (id: string) => void;
  updateResearchPaper: (
    id: string,
    updates: Partial<ResearchPaper>,
  ) => void;
  setCurrentCitations: (citations: Citation[]) => void;
  setCurrentThoughtGraph: (graph: ThoughtGraph | null) => void;
  setPendingReroute: (instruction: RerouteInstruction | null) => void;
  setResearchModeControls: (
    controls: Partial<ResearchSliceState['researchModeControls']>,
  ) => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createResearchSlice = (set: PFCSet, get: PFCGet) => ({
  // --- initial state ---
  researchChatMode: false,
  chatViewMode: 'chat' as ChatViewMode,
  researchPapers: [] as ResearchPaper[],
  currentCitations: [] as Citation[],
  currentThoughtGraph: null as ThoughtGraph | null,
  pendingReroute: null as RerouteInstruction | null,
  researchBooks: [] as ResearchBook[],
  researchModeControls: {
    autoExtractCitations: true,
    showVisualizationPreview: false,
    deepResearchEnabled: false,
  },

  // --- actions ---

  toggleResearchChatMode: () =>
    set((s) => ({ researchChatMode: !s.researchChatMode })),

  setChatViewMode: (mode: ChatViewMode) => set({ chatViewMode: mode }),

  addResearchPaper: (paper: ResearchPaper) =>
    set((s) => {
      const updated = [paper, ...s.researchPapers].slice(0, 500);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            'pfc-research-papers',
            JSON.stringify(updated),
          );
        } catch { /* localStorage quota exceeded — ignore */ }
      }
      return { researchPapers: updated };
    }),

  removeResearchPaper: (id: string) =>
    set((s) => {
      const updated = s.researchPapers.filter(
        (p: ResearchPaper) => p.id !== id,
      );
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            'pfc-research-papers',
            JSON.stringify(updated),
          );
        } catch { /* localStorage quota exceeded — ignore */ }
      }
      return { researchPapers: updated };
    }),

  updateResearchPaper: (id: string, updates: Partial<ResearchPaper>) =>
    set((s) => {
      const updated = s.researchPapers.map((p: ResearchPaper) =>
        p.id === id ? { ...p, ...updates } : p,
      );
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            'pfc-research-papers',
            JSON.stringify(updated),
          );
        } catch { /* localStorage quota exceeded — ignore */ }
      }
      return { researchPapers: updated };
    }),

  setCurrentCitations: (citations: Citation[]) =>
    set({ currentCitations: citations }),

  setCurrentThoughtGraph: (graph: ThoughtGraph | null) =>
    set({ currentThoughtGraph: graph }),

  setPendingReroute: (instruction: RerouteInstruction | null) =>
    set({ pendingReroute: instruction }),

  setResearchModeControls: (
    controls: Partial<ResearchSliceState['researchModeControls']>,
  ) =>
    set((s) => ({
      researchModeControls: { ...s.researchModeControls, ...controls },
    })),
});
