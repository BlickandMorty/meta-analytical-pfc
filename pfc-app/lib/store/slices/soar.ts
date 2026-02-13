'use client';

import type { SOARConfig, SOARSession } from '@/lib/engine/soar/types';
import { DEFAULT_SOAR_CONFIG } from '@/lib/engine/soar/types';
import type { PFCSet, PFCGet } from '../use-pfc-store';

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
}

// ── Actions interface ──
export interface SOARSliceActions {
  setSOARConfig: (patch: Partial<SOARConfig>) => void;
  setSOAREnabled: (enabled: boolean) => void;
  setSOARSession: (session: SOARSession | null) => void;
  hydrateSOAR: () => void;
}

// ── Slice creator ──
export const createSOARSlice = (set: PFCSet, get: PFCGet) => ({
  // ── Initial state (hydrated from localStorage in hydrateSOAR) ──
  soarConfig: DEFAULT_SOAR_CONFIG,
  soarSession: null as SOARSession | null,

  // ── Actions ──

  setSOARConfig: (patch: Partial<SOARConfig>) => {
    set((s) => {
      const updated = { ...s.soarConfig, ...patch };
      saveConfig(updated);
      return { soarConfig: updated };
    });
  },

  setSOAREnabled: (enabled: boolean) => {
    set((s) => {
      const updated = { ...s.soarConfig, enabled };
      saveConfig(updated);
      return { soarConfig: updated };
    });
  },

  setSOARSession: (session: SOARSession | null) => {
    set({ soarSession: session });
  },

  hydrateSOAR: () => {
    set({ soarConfig: loadConfig() });
  },
});
