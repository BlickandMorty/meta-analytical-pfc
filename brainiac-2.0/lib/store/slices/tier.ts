'use client';

import type {
  SuiteTier,
  SuiteTierFeatures,
} from '@/lib/research/types';
import { getSuiteTierFeatures } from '@/lib/research/types';
import type { PFCSet, PFCGet } from '../use-pfc-store';

// ---------------------------------------------------------------------------
// State interface — single mode, all features always on
// ---------------------------------------------------------------------------

export interface TierSliceState {
  suiteTier: SuiteTier;
  measurementEnabled: boolean;
  tierFeatures: SuiteTierFeatures;
}

// ---------------------------------------------------------------------------
// Actions interface — kept for store interface compat
// ---------------------------------------------------------------------------

export interface TierSliceActions {
  /** @deprecated No-op — single mode, kept for backward compat */
  setSuiteTier: (tier: SuiteTier) => void;
  setMeasurementEnabled: (enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createTierSlice = (set: PFCSet, _get: PFCGet) => ({
  // --- initial state (always programming, always on) ---
  suiteTier: 'programming' as SuiteTier,
  measurementEnabled: true,
  tierFeatures: getSuiteTierFeatures(),

  // --- actions ---

  /** No-op — single mode. Kept so callers don't break. */
  setSuiteTier: (_tier: SuiteTier) => {
    // intentionally no-op
  },

  setMeasurementEnabled: (enabled: boolean) => {
    set({ measurementEnabled: enabled });
  },
});
