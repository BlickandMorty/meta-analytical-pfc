'use client';

import type { SOARConfig, SOARSession } from '@/lib/engine/soar/types';
import { DEFAULT_SOAR_CONFIG } from '@/lib/engine/soar/types';

// ── localStorage keys ──
const STORAGE_KEY_CONFIG = 'pfc-soar-config';

// ── Helpers ──
function loadConfig(): SOARConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return DEFAULT_SOAR_CONFIG;
    return { ...DEFAULT_SOAR_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SOAR_CONFIG;
  }
}

function saveConfig(config: SOARConfig) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch {
    // Storage unavailable
  }
}

// ── State interface ──
export interface SOARSliceState {
  soarConfig: SOARConfig;
  soarSession: SOARSession | null;
  soarSessionHistory: Array<{
    id: string;
    query: string;
    improved: boolean;
    iterations: number;
    reward: number;
    timestamp: number;
  }>;
}

// ── Actions interface ──
export interface SOARSliceActions {
  setSOARConfig: (patch: Partial<SOARConfig>) => void;
  setSOAREnabled: (enabled: boolean) => void;
  setSOARSession: (session: SOARSession | null) => void;
  addSOARSessionToHistory: (session: SOARSession) => void;
  resetSOARConfig: () => void;
}

// ── Slice creator ──
export const createSOARSlice = (set: any, get: any) => ({
  // ── Initial state ──
  soarConfig: loadConfig(),
  soarSession: null as SOARSession | null,
  soarSessionHistory: [] as SOARSliceState['soarSessionHistory'],

  // ── Actions ──

  setSOARConfig: (patch: Partial<SOARConfig>) => {
    set((s: any) => {
      const updated = { ...s.soarConfig, ...patch };
      saveConfig(updated);
      return { soarConfig: updated };
    });
  },

  setSOAREnabled: (enabled: boolean) => {
    set((s: any) => {
      const updated = { ...s.soarConfig, enabled };
      saveConfig(updated);
      return { soarConfig: updated };
    });
  },

  setSOARSession: (session: SOARSession | null) => {
    set({ soarSession: session });
  },

  addSOARSessionToHistory: (session: SOARSession) => {
    set((s: any) => {
      const entry = {
        id: session.id,
        query: session.targetQuery.slice(0, 100),
        improved: session.overallImproved,
        iterations: session.iterationsCompleted,
        reward: session.rewards.reduce((sum: number, r: any) => sum + r.composite, 0),
        timestamp: session.startedAt,
      };
      return {
        soarSessionHistory: [...s.soarSessionHistory, entry],
      };
    });
  },

  resetSOARConfig: () => {
    saveConfig(DEFAULT_SOAR_CONFIG);
    set({
      soarConfig: DEFAULT_SOAR_CONFIG,
      soarSession: null,
      soarSessionHistory: [],
    });
  },
});
