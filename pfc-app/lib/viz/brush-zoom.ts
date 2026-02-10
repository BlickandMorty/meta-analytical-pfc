'use client';

import { useState, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Domain {
  /** Start of the visible range (e.g. timestamp or index) */
  min: number;
  /** End of the visible range */
  max: number;
}

export interface BrushState {
  /** Whether the user is currently dragging a brush selection */
  active: boolean;
  /** Start position in domain units */
  startX: number;
  /** Current end position in domain units */
  endX: number;
}

export interface UseBrushZoomReturn {
  /** The current visible domain */
  domain: Domain;
  /** Whether a brush selection is in progress */
  brushState: BrushState;
  /** Call on pointerdown -- begin a brush selection */
  brushStart: (domainX: number) => void;
  /** Call on pointermove -- extend the brush */
  brushMove: (domainX: number) => void;
  /** Call on pointerup -- finalise the brush and zoom in */
  brushEnd: () => void;
  /** Zoom in by a fixed factor (2x) centred on the midpoint */
  zoomIn: () => void;
  /** Zoom out by a fixed factor (2x) centred on the midpoint */
  zoomOut: () => void;
  /** Reset to the initial (full) domain */
  resetZoom: () => void;
  /** Whether there is at least one previous zoom level on the stack */
  canUndo: boolean;
  /** Pop the most recent zoom and restore the previous domain */
  undo: () => void;
  /** Number of zoom levels in the undo stack */
  undoDepth: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a domain so it never exceeds the initial bounds. */
function clampDomain(d: Domain, initial: Domain): Domain {
  const min = Math.max(d.min, initial.min);
  const max = Math.min(d.max, initial.max);
  // Prevent inverted domains
  if (min >= max) return initial;
  return { min, max };
}

// ---------------------------------------------------------------------------
// Hook: useBrushZoom(initialDomain)
// ---------------------------------------------------------------------------

export function useBrushZoom(initialDomain: Domain): UseBrushZoomReturn {
  const [domain, setDomain] = useState<Domain>(initialDomain);
  const [undoStack, setUndoStack] = useState<Domain[]>([]);
  const brushRef = useRef<BrushState>({
    active: false,
    startX: 0,
    endX: 0,
  });
  const [brushState, setBrushState] = useState<BrushState>({
    active: false,
    startX: 0,
    endX: 0,
  });

  // ---- Brush interaction ----

  const brushStart = useCallback((domainX: number) => {
    const next: BrushState = { active: true, startX: domainX, endX: domainX };
    brushRef.current = next;
    setBrushState(next);
  }, []);

  const brushMove = useCallback((domainX: number) => {
    if (!brushRef.current.active) return;
    const next: BrushState = {
      ...brushRef.current,
      endX: domainX,
    };
    brushRef.current = next;
    setBrushState(next);
  }, []);

  const brushEnd = useCallback(() => {
    if (!brushRef.current.active) return;

    const { startX, endX } = brushRef.current;
    const lo = Math.min(startX, endX);
    const hi = Math.max(startX, endX);

    // Ignore tiny selections (< 1% of current domain span)
    const span = domain.max - domain.min;
    const selectionSpan = hi - lo;
    if (selectionSpan < span * 0.01) {
      const reset: BrushState = { active: false, startX: 0, endX: 0 };
      brushRef.current = reset;
      setBrushState(reset);
      return;
    }

    const newDomain = clampDomain({ min: lo, max: hi }, initialDomain);

    // Push current domain to undo stack before applying new one
    setUndoStack((prev) => [...prev, domain]);
    setDomain(newDomain);

    const reset: BrushState = { active: false, startX: 0, endX: 0 };
    brushRef.current = reset;
    setBrushState(reset);
  }, [domain, initialDomain]);

  // ---- Programmatic zoom ----

  const zoomIn = useCallback(() => {
    setUndoStack((prev) => [...prev, domain]);
    setDomain((prev) => {
      const mid = (prev.min + prev.max) / 2;
      const halfSpan = (prev.max - prev.min) / 4; // zoom 2x
      return clampDomain({ min: mid - halfSpan, max: mid + halfSpan }, initialDomain);
    });
  }, [domain, initialDomain]);

  const zoomOut = useCallback(() => {
    setUndoStack((prev) => [...prev, domain]);
    setDomain((prev) => {
      const mid = (prev.min + prev.max) / 2;
      const halfSpan = (prev.max - prev.min); // zoom 0.5x
      return clampDomain({ min: mid - halfSpan, max: mid + halfSpan }, initialDomain);
    });
  }, [domain, initialDomain]);

  const resetZoom = useCallback(() => {
    if (domain.min !== initialDomain.min || domain.max !== initialDomain.max) {
      setUndoStack((prev) => [...prev, domain]);
    }
    setDomain(initialDomain);
  }, [domain, initialDomain]);

  // ---- Undo ----

  const canUndo = undoStack.length > 0;

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setDomain(last);
      return next;
    });
  }, []);

  return {
    domain,
    brushState,
    brushStart,
    brushMove,
    brushEnd,
    zoomIn,
    zoomOut,
    resetZoom,
    canUndo,
    undo,
    undoDepth: undoStack.length,
  };
}
