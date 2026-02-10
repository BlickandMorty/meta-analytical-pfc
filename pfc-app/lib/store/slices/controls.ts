'use client';

import type { PipelineControls } from '@/lib/engine/types';

// Re-export so existing imports from this file still work
export type { PipelineControls } from '@/lib/engine/types';

export const defaultControls: PipelineControls = {
  focusDepthOverride: null,
  temperatureOverride: null,
  complexityBias: 0,
  adversarialIntensity: 1.0,
  bayesianPriorStrength: 1.0,
};

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface ControlsSliceState {
  liveControlsOpen: boolean;
  controls: PipelineControls;
  userSignalOverrides: {
    confidence: number | null;
    entropy: number | null;
    dissonance: number | null;
    healthScore: number | null;
  };
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface ControlsSliceActions {
  toggleLiveControls: () => void;
  setControls: (controls: Partial<PipelineControls>) => void;
  resetControls: () => void;
  setSignalOverride: (
    signal: 'confidence' | 'entropy' | 'dissonance' | 'healthScore',
    value: number | null,
  ) => void;
  resetAllSignalOverrides: () => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createControlsSlice = (set: any, get: any) => ({
  // --- initial state ---
  liveControlsOpen: false,
  controls: { ...defaultControls },
  userSignalOverrides: {
    confidence: null as number | null,
    entropy: null as number | null,
    dissonance: null as number | null,
    healthScore: null as number | null,
  },

  // --- actions ---

  toggleLiveControls: () =>
    set((s: any) => ({ liveControlsOpen: !s.liveControlsOpen })),

  setControls: (partial: Partial<PipelineControls>) =>
    set((s: any) => ({ controls: { ...s.controls, ...partial } })),

  resetControls: () => set({ controls: { ...defaultControls } }),

  setSignalOverride: (
    signal: 'confidence' | 'entropy' | 'dissonance' | 'healthScore',
    value: number | null,
  ) =>
    set((s: any) => ({
      userSignalOverrides: { ...s.userSignalOverrides, [signal]: value },
    })),

  resetAllSignalOverrides: () =>
    set({
      userSignalOverrides: {
        confidence: null,
        entropy: null,
        dissonance: null,
        healthScore: null,
      },
    }),
});
