'use client';

import type {
  SuiteTier,
  SuiteTierFeatures,
} from '@/lib/research/types';
import { getSuiteTierFeatures } from '@/lib/research/types';
import { writeString } from '@/lib/storage-versioning';
import type { PFCSet, PFCGet } from '../use-pfc-store';

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface TierSliceState {
  suiteTier: SuiteTier;
  measurementEnabled: boolean;
  tierFeatures: SuiteTierFeatures;
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface TierSliceActions {
  setSuiteTier: (tier: SuiteTier) => void;
  setMeasurementEnabled: (enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createTierSlice = (set: PFCSet, get: PFCGet) => ({
  // --- initial state ---
  suiteTier: 'programming' as SuiteTier,
  measurementEnabled: false,
  tierFeatures: getSuiteTierFeatures('programming'),

  // --- actions ---

  setSuiteTier: (tier: SuiteTier) => {
    const features = getSuiteTierFeatures(tier);
    set({
      suiteTier: tier,
      measurementEnabled: features.pipelineVisualizer,
      tierFeatures: features,
    });
    if (typeof window !== 'undefined') {
      writeString('pfc-suite-tier', tier);
      writeString('pfc-suite-mode', tier);
      writeString('pfc-measurement-enabled', String(features.pipelineVisualizer));
    }
  },

  setMeasurementEnabled: (enabled: boolean) => {
    set({ measurementEnabled: enabled });
    if (typeof window !== 'undefined') {
      writeString('pfc-measurement-enabled', String(enabled));
    }
  },
});
