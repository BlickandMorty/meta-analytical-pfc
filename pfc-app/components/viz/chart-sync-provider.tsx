'use client';

import { useRef } from 'react';
import type { ReactNode } from 'react';
import {
  ChartSyncContext,
  createChartSyncRegistry,
} from '@/lib/viz/chart-sync';

// ---------------------------------------------------------------------------
// ChartSyncProvider
// ---------------------------------------------------------------------------
//
// Wrap any group of <SignalChart> components with this provider so they share
// a single cross-chart hover registry.  The registry lives entirely in a ref
// (no React state), so the provider itself never re-renders when hover state
// changes -- only the individual chart hooks trigger local re-renders.
//
// Usage:
//
//   <ChartSyncProvider>
//     <SignalChart chartId="confidence" ... />
//     <SignalChart chartId="entropy"    ... />
//     <SignalChart chartId="dissonance" ... />
//   </ChartSyncProvider>
//
// Multiple independent <ChartSyncProvider> instances can coexist on the same
// page -- charts only sync with siblings under the same provider.
// ---------------------------------------------------------------------------

interface ChartSyncProviderProps {
  children: ReactNode;
}

export function ChartSyncProvider({ children }: ChartSyncProviderProps) {
  const registryRef = useRef(createChartSyncRegistry());

  return (
    <ChartSyncContext.Provider value={registryRef}>
      {children}
    </ChartSyncContext.Provider>
  );
}
