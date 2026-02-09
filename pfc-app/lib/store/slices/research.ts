'use client';

import type {
  ChatViewMode,
  ThinkingPlayState,
  ThinkingSpeed,
  ResearchPaper,
  Citation,
  ThoughtGraph,
  RerouteInstruction,
} from '@/lib/research/types';

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface ResearchSliceState {
  researchChatMode: boolean;
  chatViewMode: ChatViewMode;
  thinkingPlayState: ThinkingPlayState;
  thinkingSpeed: ThinkingSpeed;
  researchPapers: ResearchPaper[];
  currentCitations: Citation[];
  currentThoughtGraph: ThoughtGraph | null;
  pendingReroute: RerouteInstruction | null;
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
  setThinkingPlayState: (state: ThinkingPlayState) => void;
  setThinkingSpeed: (speed: ThinkingSpeed) => void;
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

export const createResearchSlice = (set: any, get: any) => ({
  // --- initial state ---
  researchChatMode: false,
  chatViewMode: 'chat' as ChatViewMode,
  thinkingPlayState: 'stopped' as ThinkingPlayState,
  thinkingSpeed: 1 as ThinkingSpeed,
  researchPapers: [] as ResearchPaper[],
  currentCitations: [] as Citation[],
  currentThoughtGraph: null as ThoughtGraph | null,
  pendingReroute: null as RerouteInstruction | null,
  researchModeControls: {
    autoExtractCitations: true,
    showVisualizationPreview: false,
    deepResearchEnabled: false,
  },

  // --- actions ---

  toggleResearchChatMode: () =>
    set((s: any) => ({ researchChatMode: !s.researchChatMode })),

  setChatViewMode: (mode: ChatViewMode) => set({ chatViewMode: mode }),

  setThinkingPlayState: (state: ThinkingPlayState) =>
    set({ thinkingPlayState: state }),

  setThinkingSpeed: (speed: ThinkingSpeed) => set({ thinkingSpeed: speed }),

  addResearchPaper: (paper: ResearchPaper) =>
    set((s: any) => {
      const updated = [paper, ...s.researchPapers].slice(0, 500);
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'pfc-research-papers',
          JSON.stringify(updated),
        );
      }
      return { researchPapers: updated };
    }),

  removeResearchPaper: (id: string) =>
    set((s: any) => {
      const updated = s.researchPapers.filter(
        (p: ResearchPaper) => p.id !== id,
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'pfc-research-papers',
          JSON.stringify(updated),
        );
      }
      return { researchPapers: updated };
    }),

  updateResearchPaper: (id: string, updates: Partial<ResearchPaper>) =>
    set((s: any) => {
      const updated = s.researchPapers.map((p: ResearchPaper) =>
        p.id === id ? { ...p, ...updates } : p,
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'pfc-research-papers',
          JSON.stringify(updated),
        );
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
    set((s: any) => ({
      researchModeControls: { ...s.researchModeControls, ...controls },
    })),
});
