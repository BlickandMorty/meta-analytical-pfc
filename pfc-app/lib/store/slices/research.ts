'use client';

import type {
  ChatViewMode,
  ResearchPaper,
  Citation,
  ThoughtGraph,
  RerouteInstruction,
  ResearchBook,
  ResearchBookChapter,
} from '@/lib/research/types';

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

  // Book CRUD
  createResearchBook: (title: string, coverColor?: string) => string;
  removeResearchBook: (id: string) => void;
  updateResearchBook: (id: string, updates: Partial<ResearchBook>) => void;

  // Chapter CRUD
  addChapterToBook: (bookId: string, title: string) => string;
  removeChapterFromBook: (bookId: string, chapterId: string) => void;
  updateChapter: (bookId: string, chapterId: string, updates: Partial<ResearchBookChapter>) => void;

  // Paper-book linking
  addPaperToBook: (bookId: string, paperId: string, chapterId?: string) => void;
  removePaperFromBook: (bookId: string, paperId: string) => void;
  movePaperToChapter: (bookId: string, paperId: string, targetChapterId: string) => void;

}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createResearchSlice = (set: any, get: any) => ({
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
    set((s: any) => ({ researchChatMode: !s.researchChatMode })),

  setChatViewMode: (mode: ChatViewMode) => set({ chatViewMode: mode }),

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

  // ---------------------------------------------------------------------------
  // Research Books — CRUD + auto-categorization
  // ---------------------------------------------------------------------------

  createResearchBook: (title: string, coverColor?: string): string => {
    const id = `book-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();
    const book: ResearchBook = {
      id,
      title,
      description: undefined,
      coverColor: coverColor ?? 'pfc-violet',
      chapters: [],
      paperIds: [],
      tags: [],
      autoGenerated: false,
      createdAt: now,
      updatedAt: now,
    };
    set((s: any) => {
      const updated = [...s.researchBooks, book];
      if (typeof window !== 'undefined') {
        localStorage.setItem('pfc-research-books', JSON.stringify(updated));
      }
      return { researchBooks: updated };
    });
    return id;
  },

  removeResearchBook: (id: string) =>
    set((s: any) => {
      const updated = s.researchBooks.filter((b: ResearchBook) => b.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pfc-research-books', JSON.stringify(updated));
      }
      return { researchBooks: updated };
    }),

  updateResearchBook: (id: string, updates: Partial<ResearchBook>) =>
    set((s: any) => {
      const updated = s.researchBooks.map((b: ResearchBook) =>
        b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b,
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('pfc-research-books', JSON.stringify(updated));
      }
      return { researchBooks: updated };
    }),

  addChapterToBook: (bookId: string, title: string): string => {
    const chapterId = `ch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    set((s: any) => {
      const updated = s.researchBooks.map((b: ResearchBook) => {
        if (b.id !== bookId) return b;
        const newChapter: ResearchBookChapter = {
          id: chapterId,
          title,
          description: undefined,
          paperIds: [],
          order: b.chapters.length,
        };
        return {
          ...b,
          chapters: [...b.chapters, newChapter],
          updatedAt: Date.now(),
        };
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('pfc-research-books', JSON.stringify(updated));
      }
      return { researchBooks: updated };
    });
    return chapterId;
  },

  removeChapterFromBook: (bookId: string, chapterId: string) =>
    set((s: any) => {
      const updated = s.researchBooks.map((b: ResearchBook) => {
        if (b.id !== bookId) return b;
        const chapter = b.chapters.find((c: ResearchBookChapter) => c.id === chapterId);
        const removedPaperIds = chapter ? chapter.paperIds : [];
        return {
          ...b,
          chapters: b.chapters.filter((c: ResearchBookChapter) => c.id !== chapterId),
          paperIds: b.paperIds.filter((pid: string) => !removedPaperIds.includes(pid)),
          updatedAt: Date.now(),
        };
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('pfc-research-books', JSON.stringify(updated));
      }
      return { researchBooks: updated };
    }),

  updateChapter: (bookId: string, chapterId: string, updates: Partial<ResearchBookChapter>) =>
    set((s: any) => {
      const updated = s.researchBooks.map((b: ResearchBook) => {
        if (b.id !== bookId) return b;
        return {
          ...b,
          chapters: b.chapters.map((c: ResearchBookChapter) =>
            c.id === chapterId ? { ...c, ...updates } : c,
          ),
          updatedAt: Date.now(),
        };
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('pfc-research-books', JSON.stringify(updated));
      }
      return { researchBooks: updated };
    }),

  addPaperToBook: (bookId: string, paperId: string, chapterId?: string) =>
    set((s: any) => {
      const updated = s.researchBooks.map((b: ResearchBook) => {
        if (b.id !== bookId) return b;
        // Avoid duplicates at the book level
        const newPaperIds = b.paperIds.includes(paperId)
          ? b.paperIds
          : [...b.paperIds, paperId];
        let newChapters = b.chapters;
        if (chapterId) {
          newChapters = b.chapters.map((c: ResearchBookChapter) => {
            if (c.id !== chapterId) return c;
            if (c.paperIds.includes(paperId)) return c;
            return { ...c, paperIds: [...c.paperIds, paperId] };
          });
        }
        return {
          ...b,
          paperIds: newPaperIds,
          chapters: newChapters,
          updatedAt: Date.now(),
        };
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('pfc-research-books', JSON.stringify(updated));
      }
      return { researchBooks: updated };
    }),

  removePaperFromBook: (bookId: string, paperId: string) =>
    set((s: any) => {
      const updated = s.researchBooks.map((b: ResearchBook) => {
        if (b.id !== bookId) return b;
        return {
          ...b,
          paperIds: b.paperIds.filter((pid: string) => pid !== paperId),
          chapters: b.chapters.map((c: ResearchBookChapter) => ({
            ...c,
            paperIds: c.paperIds.filter((pid: string) => pid !== paperId),
          })),
          updatedAt: Date.now(),
        };
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('pfc-research-books', JSON.stringify(updated));
      }
      return { researchBooks: updated };
    }),

  movePaperToChapter: (bookId: string, paperId: string, targetChapterId: string) =>
    set((s: any) => {
      const updated = s.researchBooks.map((b: ResearchBook) => {
        if (b.id !== bookId) return b;
        return {
          ...b,
          chapters: b.chapters.map((c: ResearchBookChapter) => {
            if (c.id === targetChapterId) {
              // Add to target (avoid duplicates)
              if (c.paperIds.includes(paperId)) return c;
              return { ...c, paperIds: [...c.paperIds, paperId] };
            }
            // Remove from all other chapters
            return { ...c, paperIds: c.paperIds.filter((pid: string) => pid !== paperId) };
          }),
          updatedAt: Date.now(),
        };
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('pfc-research-books', JSON.stringify(updated));
      }
      return { researchBooks: updated };
    }),
});
