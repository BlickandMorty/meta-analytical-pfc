'use client';

import { useMemo, useRef } from 'react';
import type { SignalHistoryEntry } from '@/lib/store/use-pfc-store';

// ---------------------------------------------------------------------------
// Group key definitions
// ---------------------------------------------------------------------------

/**
 * Supported grouping strategies for signal history data:
 *
 *  - `time`             Raw chronological order (identity transform)
 *  - `confidence-band`  Bucket by confidence ranges (0-0.3, 0.3-0.6, 0.6-1.0)
 *  - `entropy-level`    Bucket by entropy level (low / medium / high)
 *  - `session`          Group by chat session (gap > 5 min = new session)
 */
export type GroupKey =
  | 'time'
  | 'confidence-band'
  | 'entropy-level'
  | 'session';

// ---------------------------------------------------------------------------
// Grouped output shape
// ---------------------------------------------------------------------------

export interface GroupedSignalData {
  /** Human-readable label for the group */
  label: string;
  /** Colour hint (hex) for rendering */
  color: string;
  /** Entries belonging to this group */
  entries: SignalHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Grouping implementations
// ---------------------------------------------------------------------------

const CONFIDENCE_BANDS: { label: string; color: string; min: number; max: number }[] = [
  { label: 'Low (0 - 0.3)',    color: '#F87171', min: 0,   max: 0.3 },
  { label: 'Medium (0.3 - 0.6)', color: '#FBBF24', min: 0.3, max: 0.6 },
  { label: 'High (0.6 - 1.0)',  color: '#34D399', min: 0.6, max: 1.0 },
];

const ENTROPY_LEVELS: { label: string; color: string; threshold: (e: number) => boolean }[] = [
  { label: 'Low entropy',    color: '#34D399', threshold: (e) => e < 0.33 },
  { label: 'Medium entropy',  color: '#FBBF24', threshold: (e) => e >= 0.33 && e < 0.66 },
  { label: 'High entropy',    color: '#F87171', threshold: (e) => e >= 0.66 },
];

/** 5-minute gap between entries → new session */
const SESSION_GAP_MS = 5 * 60 * 1000;

const SESSION_COLORS = [
  '#8B7CF6', // violet
  '#E07850', // ember
  '#34D399', // green
  '#22D3EE', // cyan
  '#FBBF24', // yellow
  '#F87171', // red
];

function groupByTime(data: SignalHistoryEntry[]): GroupedSignalData[] {
  return [
    {
      label: 'All signals (chronological)',
      color: '#8B7CF6',
      entries: data,
    },
  ];
}

function groupByConfidenceBand(data: SignalHistoryEntry[]): GroupedSignalData[] {
  return CONFIDENCE_BANDS.map((band) => ({
    label: band.label,
    color: band.color,
    entries: data.filter((e) => e.confidence >= band.min && e.confidence < band.max),
  }));
}

function groupByEntropyLevel(data: SignalHistoryEntry[]): GroupedSignalData[] {
  return ENTROPY_LEVELS.map((level) => ({
    label: level.label,
    color: level.color,
    entries: data.filter((e) => level.threshold(e.entropy)),
  }));
}

function groupBySession(data: SignalHistoryEntry[]): GroupedSignalData[] {
  if (data.length === 0) return [];

  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const sessions: SignalHistoryEntry[][] = [];
  let current: SignalHistoryEntry[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].timestamp - sorted[i - 1].timestamp > SESSION_GAP_MS) {
      sessions.push(current);
      current = [];
    }
    current.push(sorted[i]);
  }
  sessions.push(current);

  return sessions.map((entries, idx) => ({
    label: `Session ${idx + 1}`,
    color: SESSION_COLORS[idx % SESSION_COLORS.length],
    entries,
  }));
}

const GROUP_FUNCTIONS: Record<GroupKey, (data: SignalHistoryEntry[]) => GroupedSignalData[]> = {
  'time': groupByTime,
  'confidence-band': groupByConfidenceBand,
  'entropy-level': groupByEntropyLevel,
  'session': groupBySession,
};

// ---------------------------------------------------------------------------
// Hook: usePipelineGrouping(data, groupKey)
// ---------------------------------------------------------------------------

/**
 * Caches grouped results per groupKey so switching back and forth between
 * grouping strategies is instant (no recomputation).
 *
 * The cache is invalidated when the underlying data array changes (reference
 * or length). Each groupKey's result is stored independently.
 */
export function usePipelineGrouping(
  data: SignalHistoryEntry[],
  groupKey: GroupKey,
): GroupedSignalData[] {
  // Cache: Map<groupKey, { dataLen: number; dataRef: SignalHistoryEntry[]; result }>
  const cacheRef = useRef<
    Map<
      GroupKey,
      {
        dataLen: number;
        dataRef: SignalHistoryEntry[];
        result: GroupedSignalData[];
      }
    >
  >(new Map());

  return useMemo(() => {
    const cache = cacheRef.current;
    const cached = cache.get(groupKey);

    // Cache hit: same reference or same length (cheap heuristic)
    if (cached && cached.dataRef === data && cached.dataLen === data.length) {
      return cached.result;
    }

    // Miss: compute and store
    const fn = GROUP_FUNCTIONS[groupKey];
    const result = fn(data);

    cache.set(groupKey, {
      dataLen: data.length,
      dataRef: data,
      result,
    });

    return result;
  }, [data, groupKey]);
}
