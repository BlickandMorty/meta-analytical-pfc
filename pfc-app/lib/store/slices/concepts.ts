'use client';

// ---------------------------------------------------------------------------
// Concept types
// ---------------------------------------------------------------------------

export interface ConceptWeight {
  concept: string;
  weight: number; // 0.0 to 2.0, default 1.0 — user-adjustable importance
  firstSeen: number; // timestamp of first extraction
  lastSeen: number; // timestamp of most recent extraction
  queryCount: number; // how many queries this concept appeared in
  autoWeight: number; // engine-calculated weight (frequency-based)
}

export interface QueryConceptEntry {
  queryId: string;
  timestamp: number;
  concepts: string[];
}

export const MAX_CONCEPT_HISTORY = 100;

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface ConceptsSliceState {
  conceptWeights: Record<string, ConceptWeight>;
  queryConceptHistory: QueryConceptEntry[];
  conceptHierarchyOpen: boolean;
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface ConceptsSliceActions {
  recordQueryConcepts: (queryId: string, concepts: string[]) => void;
  setConceptWeight: (concept: string, weight: number) => void;
  resetConceptWeight: (concept: string) => void;
  resetAllConceptWeights: () => void;
  toggleConceptHierarchy: () => void;
  getEffectiveConceptWeights: () => Record<string, number>;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createConceptsSlice = (set: any, get: any) => ({
  // --- initial state ---
  conceptWeights: {} as Record<string, ConceptWeight>,
  queryConceptHistory: [] as QueryConceptEntry[],
  conceptHierarchyOpen: false,

  // --- actions ---

  recordQueryConcepts: (queryId: string, concepts: string[]) =>
    set((s: any) => {
      const now = Date.now();
      const newWeights = { ...s.conceptWeights };

      for (const concept of concepts) {
        if (newWeights[concept]) {
          newWeights[concept] = {
            ...newWeights[concept],
            lastSeen: now,
            queryCount: newWeights[concept].queryCount + 1,
            autoWeight: Math.min(
              2.0,
              0.5 + (newWeights[concept].queryCount + 1) * 0.15,
            ),
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

      const entry: QueryConceptEntry = {
        queryId,
        timestamp: now,
        concepts,
      };
      const newHistory = [...s.queryConceptHistory, entry].slice(
        -MAX_CONCEPT_HISTORY,
      );

      return {
        conceptWeights: newWeights,
        queryConceptHistory: newHistory,
      };
    }),

  setConceptWeight: (concept: string, weight: number) =>
    set((s: any) => {
      const existing = s.conceptWeights[concept];
      if (!existing) return {};
      return {
        conceptWeights: {
          ...s.conceptWeights,
          [concept]: {
            ...existing,
            weight: Math.max(0, Math.min(2.0, weight)),
          },
        },
      };
    }),

  resetConceptWeight: (concept: string) =>
    set((s: any) => {
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
    set((s: any) => {
      const reset: Record<string, ConceptWeight> = {};
      for (const [key, cw] of Object.entries(s.conceptWeights)) {
        reset[key] = { ...(cw as ConceptWeight), weight: 1.0 };
      }
      return { conceptWeights: reset };
    }),

  toggleConceptHierarchy: () =>
    set((s: any) => ({ conceptHierarchyOpen: !s.conceptHierarchyOpen })),

  getEffectiveConceptWeights: (): Record<string, number> => {
    const state = get();
    const result: Record<string, number> = {};
    for (const [key, cw] of Object.entries(state.conceptWeights)) {
      const typed = cw as ConceptWeight;
      result[key] = typed.weight * typed.autoWeight;
    }
    return result;
  },
});
