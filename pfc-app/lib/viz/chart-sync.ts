'use client';

import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { MutableRefObject } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HoverState {
  /** Index of the hovered data point */
  dataIndex: number;
  /** X coordinate in SVG / chart space */
  x: number;
  /** Y coordinate in SVG / chart space */
  y: number;
  /** ID of the chart that initiated the hover */
  sourceChartId: string;
}

/**
 * Callback signature each chart registers so the sync manager can push
 * hover state without triggering React state updates on the manager itself.
 */
type HoverCallback = (state: HoverState | null) => void;

/** Internal registry held entirely in refs -- zero re-renders. */
interface ChartSyncRegistry {
  /** chartId -> latest hover state (source of truth) */
  hoverMap: Map<string, HoverState | null>;
  /** chartId -> update callback */
  callbacks: Map<string, HoverCallback>;
  /** Pending rAF id so we only flush once per frame */
  rafId: number | null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const ChartSyncContext = createContext<
  MutableRefObject<ChartSyncRegistry> | null
>(null);

/**
 * Create the ref object that the ChartSyncProvider component will own.
 * This is split out so the provider can call it once at mount time.
 */
export function createChartSyncRegistry(): ChartSyncRegistry {
  return {
    hoverMap: new Map(),
    callbacks: new Map(),
    rafId: null,
  };
}

// ---------------------------------------------------------------------------
// Hook: useChartSync(chartId)
// ---------------------------------------------------------------------------

export interface UseChartSyncReturn {
  /** Call when the user hovers a data point in this chart */
  onHover: (dataIndex: number, x: number, y: number) => void;
  /** Call when the user leaves this chart */
  onLeave: () => void;
  /** The currently hovered point (may originate from any chart) */
  hoveredPoint: HoverState | null;
}

export function useChartSync(chartId: string): UseChartSyncReturn {
  const registryRef = useContext(ChartSyncContext);

  // Local state that only this chart subscribes to -- keeps React rendering
  // scoped to the individual chart rather than the whole tree.
  const [hoveredPoint, setHoveredPoint] = useState<HoverState | null>(null);

  // Register / unregister this chart's callback
  useEffect(() => {
    if (!registryRef) return;
    const registry = registryRef.current;

    const callback: HoverCallback = (state) => {
      setHoveredPoint(state);
    };

    registry.callbacks.set(chartId, callback);

    return () => {
      registry.callbacks.delete(chartId);
      registry.hoverMap.delete(chartId);
    };
  }, [chartId, registryRef]);

  // ------- onHover -------
  const onHover = useCallback(
    (dataIndex: number, x: number, y: number) => {
      if (!registryRef) return;
      const registry = registryRef.current;

      const state: HoverState = { dataIndex, x, y, sourceChartId: chartId };
      registry.hoverMap.set(chartId, state);

      // Batch via rAF so multiple synchronous onHover calls collapse into one
      if (registry.rafId === null) {
        registry.rafId = requestAnimationFrame(() => {
          registry.rafId = null;
          // Broadcast to ALL registered charts (including the source -- the
          // source chart can check sourceChartId to decide how to render).
          registry.callbacks.forEach((cb) => {
            cb(state);
          });
        });
      }
    },
    [chartId, registryRef],
  );

  // ------- onLeave -------
  const onLeave = useCallback(() => {
    if (!registryRef) return;
    const registry = registryRef.current;

    registry.hoverMap.set(chartId, null);

    if (registry.rafId === null) {
      registry.rafId = requestAnimationFrame(() => {
        registry.rafId = null;
        registry.callbacks.forEach((cb) => {
          cb(null);
        });
      });
    }
  }, [chartId, registryRef]);

  return { onHover, onLeave, hoveredPoint };
}
