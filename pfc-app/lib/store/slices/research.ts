'use client';

import type {
  ResearchPaper,
  Citation,
  RerouteInstruction,
  ResearchBook,
} from '@/lib/research/types';
import { writeVersioned } from '@/lib/storage-versioning';
import type { PFCSet, PFCGet } from '../use-pfc-store';

const RESEARCH_PAPERS_VERSION = 1;

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface ResearchSliceState {
  researchChatMode: boolean;
  researchPapers: ResearchPaper[];
  currentCitations: Citation[];
  pendingReroute: RerouteInstruction | null;
  researchBooks: ResearchBook[];
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface ResearchSliceActions {
  toggleResearchChatMode: () => void;
  addResearchPaper: (paper: ResearchPaper) => void;
  removeResearchPaper: (id: string) => void;
  updateResearchPaper: (
    id: string,
    updates: Partial<ResearchPaper>,
  ) => void;
  setCurrentCitations: (citations: Citation[]) => void;
  setPendingReroute: (instruction: RerouteInstruction | null) => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createResearchSlice = (set: PFCSet, get: PFCGet) => ({
  // --- initial state ---
  researchChatMode: true,
  researchPapers: [] as ResearchPaper[],
  currentCitations: [] as Citation[],
  pendingReroute: null as RerouteInstruction | null,
  researchBooks: [] as ResearchBook[],

  // --- actions ---

  // Research mode is always on — toggle is a no-op for backward compat
  toggleResearchChatMode: () => {},

  addResearchPaper: (paper: ResearchPaper) =>
    set((s) => {
      const updated = [paper, ...s.researchPapers].slice(0, 500);
      if (typeof window !== 'undefined') {
        writeVersioned('pfc-research-papers', RESEARCH_PAPERS_VERSION, updated);
      }
      return { researchPapers: updated };
    }),

  removeResearchPaper: (id: string) =>
    set((s) => {
      const updated = s.researchPapers.filter(
        (p: ResearchPaper) => p.id !== id,
      );
      if (typeof window !== 'undefined') {
        writeVersioned('pfc-research-papers', RESEARCH_PAPERS_VERSION, updated);
      }
      return { researchPapers: updated };
    }),

  updateResearchPaper: (id: string, updates: Partial<ResearchPaper>) =>
    set((s) => {
      const updated = s.researchPapers.map((p: ResearchPaper) =>
        p.id === id ? { ...p, ...updates } : p,
      );
      if (typeof window !== 'undefined') {
        writeVersioned('pfc-research-papers', RESEARCH_PAPERS_VERSION, updated);
      }
      return { researchPapers: updated };
    }),

  setCurrentCitations: (citations: Citation[]) =>
    set({ currentCitations: citations }),

  setPendingReroute: (instruction: RerouteInstruction | null) =>
    set({ pendingReroute: instruction }),
});
