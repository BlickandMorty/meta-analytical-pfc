'use client';

import type {
  SuiteTier,
  SuiteMode,
  SuiteTierFeatures,
} from '@/lib/research/types';
import { getSuiteTierFeatures } from '@/lib/research/types';

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface TierSliceState {
  suiteTier: SuiteTier;
  suiteMode: SuiteMode;
  measurementEnabled: boolean;
  tierFeatures: SuiteTierFeatures;
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface TierSliceActions {
  setSuiteTier: (tier: SuiteTier) => void;
  setSuiteMode: (mode: SuiteMode) => void;
  setMeasurementEnabled: (enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createTierSlice = (set: any, get: any) => ({
  // --- initial state ---
  suiteTier: 'programming' as SuiteTier,
  suiteMode: 'programming' as SuiteMode,
  measurementEnabled: false,
  tierFeatures: getSuiteTierFeatures('programming'),

  // --- actions ---

  setSuiteTier: (tier: SuiteTier) => {
    const features = getSuiteTierFeatures(tier);
    set({
      suiteTier: tier,
      suiteMode: tier,
      measurementEnabled: features.pipelineVisualizer,
      tierFeatures: features,
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('pfc-suite-tier', tier);
      localStorage.setItem('pfc-suite-mode', tier);
      localStorage.setItem(
        'pfc-measurement-enabled',
        String(features.pipelineVisualizer),
      );
    }
  },

  setSuiteMode: (mode: SuiteMode) => {
    // Legacy: delegates to setSuiteTier
    const tier = mode as SuiteTier;
    get().setSuiteTier(tier);
  },

  setMeasurementEnabled: (enabled: boolean) => {
    set({ measurementEnabled: enabled });
    if (typeof window !== 'undefined') {
      localStorage.setItem('pfc-measurement-enabled', String(enabled));
    }
  },
});
