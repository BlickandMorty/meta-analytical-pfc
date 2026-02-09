'use client';

// ═══════════════════════════════════════════════════════════════════
// useBackgroundLearning — Periodic background learning sessions
// ═══════════════════════════════════════════════════════════════════
// When `learningAutoRun` is enabled in the store, this hook:
// - Watches for changes to note blocks (debounced 60 seconds)
// - Starts a shallow learning session automatically
// - Prevents concurrent sessions
// - Reports countdown to next scheduled run

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';

// ── Constants ──

/** Debounce delay before triggering a background learning session (ms) */
const TRIGGER_DELAY_MS = 60_000; // 60 seconds

/** Minimum interval between background runs (ms) — prevent rapid cycling */
const MIN_INTERVAL_MS = 5 * 60_000; // 5 minutes

/** Default depth for background learning */
const BACKGROUND_DEPTH = 'shallow' as const;

/** Default max iterations for background learning */
const BACKGROUND_MAX_ITERATIONS = 1;

// ═══════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════

export interface UseBackgroundLearningReturn {
  /** Whether a background-triggered learning session is currently running */
  isAutoRunning: boolean;
  /** Seconds until the next scheduled background run, or null if not scheduled */
  nextRunIn: number | null;
}

export function useBackgroundLearning(): UseBackgroundLearningReturn {
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [nextRunIn, setNextRunIn] = useState<number | null>(null);

  // Refs for timers and tracking
  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRunAtRef = useRef<number>(0);
  const scheduledAtRef = useRef<number | null>(null);
  const prevBlockCountRef = useRef<number | null>(null);

  // ── Cleanup helper ──
  const clearTimers = useCallback(() => {
    if (triggerTimerRef.current) {
      clearTimeout(triggerTimerRef.current);
      triggerTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    scheduledAtRef.current = null;
    setNextRunIn(null);
  }, []);

  // ── Schedule a countdown display update ──
  const startCountdown = useCallback((targetTime: number) => {
    // Clear any existing countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    scheduledAtRef.current = targetTime;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setNextRunIn(remaining > 0 ? remaining : null);
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };

    tick(); // immediate first tick
    countdownRef.current = setInterval(tick, 1000);
  }, []);

  // ── Trigger a background learning session ──
  const triggerLearning = useCallback(() => {
    const store = usePFCStore.getState();

    // Guard: don't run if auto-run was disabled in the meantime
    if (!store.learningAutoRun) {
      clearTimers();
      return;
    }

    // Guard: don't run if a session is already active
    if (store.learningSession && store.learningSession.status === 'running') {
      clearTimers();
      return;
    }

    // Guard: respect minimum interval
    const now = Date.now();
    if (now - lastRunAtRef.current < MIN_INTERVAL_MS) {
      // Reschedule for the remaining time
      const delay = MIN_INTERVAL_MS - (now - lastRunAtRef.current);
      triggerTimerRef.current = setTimeout(triggerLearning, delay);
      startCountdown(now + delay);
      return;
    }

    // Guard: must have notes to learn from
    if (store.noteBlocks.length === 0) {
      clearTimers();
      return;
    }

    // Start the background learning session
    lastRunAtRef.current = now;
    setIsAutoRunning(true);
    clearTimers();

    store.startLearningSession(BACKGROUND_DEPTH, BACKGROUND_MAX_ITERATIONS);
  }, [clearTimers, startCountdown]);

  // ── Main subscription effect ──
  useEffect(() => {
    // Initialize the previous block count
    prevBlockCountRef.current = usePFCStore.getState().noteBlocks.length;

    // Subscribe to relevant state changes
    const unsubscribe = usePFCStore.subscribe(
      (state) => ({
        learningAutoRun: state.learningAutoRun,
        blockCount: state.noteBlocks.length,
        sessionStatus: state.learningSession?.status ?? null,
      }),
      (current, prev) => {
        // ── Handle auto-run being toggled off ──
        if (!current.learningAutoRun) {
          clearTimers();
          setIsAutoRunning(false);
          return;
        }

        // ── Handle session completion ──
        if (
          prev.sessionStatus === 'running' &&
          (current.sessionStatus === 'completed' || current.sessionStatus === 'error' || current.sessionStatus === null)
        ) {
          setIsAutoRunning(false);
        }

        // ── Handle note block changes (trigger debounced learning) ──
        if (
          current.learningAutoRun &&
          current.blockCount !== prev.blockCount &&
          prevBlockCountRef.current !== null &&
          current.blockCount !== prevBlockCountRef.current
        ) {
          prevBlockCountRef.current = current.blockCount;

          // Don't schedule if currently running
          if (current.sessionStatus === 'running') return;

          // Clear any existing scheduled trigger
          if (triggerTimerRef.current) {
            clearTimeout(triggerTimerRef.current);
          }

          // Schedule a new background run
          const targetTime = Date.now() + TRIGGER_DELAY_MS;
          triggerTimerRef.current = setTimeout(triggerLearning, TRIGGER_DELAY_MS);
          startCountdown(targetTime);
        }
      },
      {
        equalityFn: (a, b) =>
          a.learningAutoRun === b.learningAutoRun &&
          a.blockCount === b.blockCount &&
          a.sessionStatus === b.sessionStatus,
      },
    );

    return () => {
      unsubscribe();
      clearTimers();
    };
  }, [clearTimers, startCountdown, triggerLearning]);

  return { isAutoRunning, nextRunIn };
}
