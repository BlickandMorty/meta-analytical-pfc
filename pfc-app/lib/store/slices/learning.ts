'use client';

import type {
  LearningSession,
  LearningSessionStatus,
  LearningStep,
} from '@/lib/notes/learning-protocol';
import { createLearningSession } from '@/lib/notes/learning-protocol';

// ── localStorage keys ──
const STORAGE_KEY_HISTORY = 'pfc-learning-history';
const STORAGE_KEY_AUTORUN = 'pfc-learning-autorun';

// ── Module-scope abort controller (not in Zustand state) ──
let _learningAbortController: AbortController | null = null;

// ── History entry ──
export interface LearningHistoryEntry {
  id: string;
  startedAt: number;
  completedAt: number;
  totalInsights: number;
  iteration: number;
}

// ── State interface ──
export interface LearningSliceState {
  learningSession: LearningSession | null;
  learningHistory: LearningHistoryEntry[];
  learningStreamText: string;
  learningAutoRun: boolean;
}

// ── Actions interface ──
export interface LearningSliceActions {
  startLearningSession: (
    depth: LearningSession['depth'],
    maxIterations: number,
    targetPageIds?: string[],
  ) => void;
  pauseLearningSession: () => void;
  resumeLearningSession: () => void;
  stopLearningSession: () => void;
  updateLearningStep: (stepIndex: number, updates: Partial<LearningStep>) => void;
  advanceLearningStep: () => void;
  appendLearningStreamText: (text: string) => void;
  clearLearningStreamText: () => void;
  setLearningAutoRun: (enabled: boolean) => void;
  completeLearningSession: () => void;
}

// ── SSE event types emitted by /api/notes-learn ──
type LearningSSEEvent =
  | { type: 'step-start'; stepIndex: number; stepType: string }
  | { type: 'step-progress'; stepIndex: number; progress: number; detail?: string }
  | { type: 'step-complete'; stepIndex: number; insights: string[]; pagesCreated: string[]; blocksCreated: string[] }
  | { type: 'insight'; text: string }
  | { type: 'page-created'; pageTitle: string; pageId?: string }
  | { type: 'block-created'; content: string; pageId?: string; blockId?: string }
  | { type: 'stream-text'; text: string }
  | { type: 'session-complete'; totalInsights: number; totalPagesCreated: number }
  | { type: 'error'; message: string };

// ── Helper: load history from localStorage ──
function loadHistory(): LearningHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: LearningHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  } catch {
    // Storage full or unavailable
  }
}

function loadAutoRun(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_AUTORUN) === 'true';
  } catch {
    return false;
  }
}

// ── Helper: connect to SSE endpoint ──
function connectLearningSSE(set: any, get: any) {
  const state = get();
  const session: LearningSession | null = state.learningSession;
  if (!session) return;

  // Abort any existing connection
  if (_learningAbortController) {
    _learningAbortController.abort();
  }

  const controller = new AbortController();
  _learningAbortController = controller;

  // Gather note data from the notes slice
  const notePages = state.notePages ?? [];
  const noteBlocks = state.noteBlocks ?? [];

  // Gather inference config from the inference slice
  const inferenceConfig = state.getInferenceConfig
    ? state.getInferenceConfig()
    : {
        mode: state.inferenceMode ?? 'simulation',
        apiProvider: state.apiProvider ?? 'openai',
        apiKey: state.apiKey ?? '',
        openaiModel: state.openaiModel ?? 'gpt-4o',
        anthropicModel: state.anthropicModel ?? 'claude-sonnet-4-20250514',
        ollamaBaseUrl: state.ollamaBaseUrl ?? 'http://localhost:11434',
        ollamaModel: state.ollamaModel ?? 'llama3.1',
      };

  // Fire the SSE fetch
  (async () => {
    try {
      const response = await fetch('/api/notes-learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: { pages: notePages, blocks: noteBlocks },
          session,
          inferenceConfig,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') {
            get().completeLearningSession();
            continue;
          }

          try {
            const event = JSON.parse(data) as LearningSSEEvent;

            switch (event.type) {
              case 'step-start': {
                get().updateLearningStep(event.stepIndex, {
                  status: 'running',
                  startedAt: Date.now(),
                });
                get().clearLearningStreamText();
                break;
              }

              case 'step-progress': {
                // Optional progress update; store detail in step output
                if (event.detail) {
                  get().updateLearningStep(event.stepIndex, {
                    output: event.detail,
                  });
                }
                break;
              }

              case 'step-complete': {
                get().updateLearningStep(event.stepIndex, {
                  status: 'completed',
                  completedAt: Date.now(),
                  insights: event.insights,
                  pagesCreated: event.pagesCreated,
                  blocksCreated: event.blocksCreated,
                });

                // Update session totals
                set((s: any) => {
                  if (!s.learningSession) return {};
                  return {
                    learningSession: {
                      ...s.learningSession,
                      totalInsights: s.learningSession.totalInsights + event.insights.length,
                      totalPagesCreated: s.learningSession.totalPagesCreated + event.pagesCreated.length,
                      totalBlocksCreated: s.learningSession.totalBlocksCreated + event.blocksCreated.length,
                    },
                  };
                });

                get().advanceLearningStep();
                break;
              }

              case 'insight': {
                // Append insight to current step
                const currentSession = get().learningSession as LearningSession | null;
                if (currentSession) {
                  const idx = currentSession.currentStepIndex;
                  const step = currentSession.steps[idx];
                  if (step) {
                    get().updateLearningStep(idx, {
                      insights: [...step.insights, event.text],
                    });
                  }
                }
                break;
              }

              case 'page-created': {
                // Client handles actual page creation — emit to the notes slice
                const cs = get().learningSession as LearningSession | null;
                if (cs) {
                  const idx = cs.currentStepIndex;
                  const step = cs.steps[idx];
                  if (step && event.pageId) {
                    get().updateLearningStep(idx, {
                      pagesCreated: [...step.pagesCreated, event.pageId],
                    });
                  }
                }
                break;
              }

              case 'block-created': {
                const bs = get().learningSession as LearningSession | null;
                if (bs) {
                  const idx = bs.currentStepIndex;
                  const step = bs.steps[idx];
                  if (step && event.blockId) {
                    get().updateLearningStep(idx, {
                      blocksCreated: [...step.blocksCreated, event.blockId],
                    });
                  }
                }
                break;
              }

              case 'stream-text': {
                get().appendLearningStreamText(event.text);
                break;
              }

              case 'session-complete': {
                set((s: any) => {
                  if (!s.learningSession) return {};
                  return {
                    learningSession: {
                      ...s.learningSession,
                      totalInsights: event.totalInsights,
                      totalPagesCreated: event.totalPagesCreated,
                    },
                  };
                });
                get().completeLearningSession();
                break;
              }

              case 'error': {
                console.error('[learning] SSE error:', event.message);
                // Mark current step as error
                const errSession = get().learningSession as LearningSession | null;
                if (errSession) {
                  get().updateLearningStep(errSession.currentStepIndex, {
                    status: 'error',
                    error: event.message,
                  });
                }
                set((s: any) => {
                  if (!s.learningSession) return {};
                  return {
                    learningSession: {
                      ...s.learningSession,
                      status: 'error' as LearningSessionStatus,
                    },
                  };
                });
                break;
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[learning] Stream error:', error);
        set((s: any) => {
          if (!s.learningSession) return {};
          return {
            learningSession: {
              ...s.learningSession,
              status: 'error' as LearningSessionStatus,
            },
          };
        });
      }
    } finally {
      _learningAbortController = null;
    }
  })();
}

// ── Slice creator ──
export const createLearningSlice = (set: any, get: any) => ({
  // ── Initial state ──
  learningSession: null as LearningSession | null,
  learningHistory: loadHistory(),
  learningStreamText: '',
  learningAutoRun: loadAutoRun(),

  // ── Actions ──

  startLearningSession: (
    depth: LearningSession['depth'],
    maxIterations: number,
    targetPageIds?: string[],
  ) => {
    // Create a fresh session
    const session = createLearningSession(depth, maxIterations, targetPageIds);
    session.status = 'running';

    set({
      learningSession: session,
      learningStreamText: '',
    });

    // Connect to SSE endpoint
    connectLearningSSE(set, get);
  },

  pauseLearningSession: () => {
    // Abort the fetch
    if (_learningAbortController) {
      _learningAbortController.abort();
      _learningAbortController = null;
    }

    set((s: any) => {
      if (!s.learningSession) return {};
      return {
        learningSession: {
          ...s.learningSession,
          status: 'paused' as LearningSessionStatus,
        },
      };
    });
  },

  resumeLearningSession: () => {
    set((s: any) => {
      if (!s.learningSession) return {};
      return {
        learningSession: {
          ...s.learningSession,
          status: 'running' as LearningSessionStatus,
        },
      };
    });

    // Reconnect to SSE
    connectLearningSSE(set, get);
  },

  stopLearningSession: () => {
    // Abort the fetch
    if (_learningAbortController) {
      _learningAbortController.abort();
      _learningAbortController = null;
    }

    const session = get().learningSession as LearningSession | null;
    if (session) {
      // Add to history
      const entry: LearningHistoryEntry = {
        id: session.id,
        startedAt: session.startedAt,
        completedAt: Date.now(),
        totalInsights: session.totalInsights,
        iteration: session.iteration,
      };
      const history = [...get().learningHistory, entry];
      saveHistory(history);

      set({
        learningSession: null,
        learningHistory: history,
        learningStreamText: '',
      });
    } else {
      set({
        learningSession: null,
        learningStreamText: '',
      });
    }
  },

  updateLearningStep: (stepIndex: number, updates: Partial<LearningStep>) => {
    set((s: any) => {
      if (!s.learningSession) return {};
      const steps = [...s.learningSession.steps];
      if (stepIndex < 0 || stepIndex >= steps.length) return {};
      steps[stepIndex] = { ...steps[stepIndex], ...updates };
      return {
        learningSession: {
          ...s.learningSession,
          steps,
        },
      };
    });
  },

  advanceLearningStep: () => {
    set((s: any) => {
      if (!s.learningSession) return {};
      const nextIndex = s.learningSession.currentStepIndex + 1;
      if (nextIndex >= s.learningSession.steps.length) return {};
      return {
        learningSession: {
          ...s.learningSession,
          currentStepIndex: nextIndex,
        },
      };
    });
  },

  appendLearningStreamText: (text: string) => {
    set((s: any) => ({
      learningStreamText: s.learningStreamText + text,
    }));
  },

  clearLearningStreamText: () => {
    set({ learningStreamText: '' });
  },

  setLearningAutoRun: (enabled: boolean) => {
    set({ learningAutoRun: enabled });
    try {
      localStorage.setItem(STORAGE_KEY_AUTORUN, String(enabled));
    } catch {
      // Storage unavailable
    }
  },

  completeLearningSession: () => {
    // Abort any remaining connection
    if (_learningAbortController) {
      _learningAbortController.abort();
      _learningAbortController = null;
    }

    const session = get().learningSession as LearningSession | null;
    if (!session) return;

    // Mark remaining pending steps as skipped
    const steps = session.steps.map((step: LearningStep) =>
      step.status === 'pending' ? { ...step, status: 'skipped' as const } : step,
    );

    const completedSession: LearningSession = {
      ...session,
      steps,
      status: 'completed',
      completedAt: Date.now(),
    };

    // Add to history
    const entry: LearningHistoryEntry = {
      id: completedSession.id,
      startedAt: completedSession.startedAt,
      completedAt: completedSession.completedAt!,
      totalInsights: completedSession.totalInsights,
      iteration: completedSession.iteration,
    };
    const history = [...get().learningHistory, entry];
    saveHistory(history);

    set({
      learningSession: completedSession,
      learningHistory: history,
    });
  },
});
