'use client';

// ═══════════════════════════════════════════════════════════════════
// useAutoNotes — React hook for automatic chat-to-notes extraction
// ═══════════════════════════════════════════════════════════════════
// Watches the PFC store's messages array. When a new assistant
// message appears (and streaming has stopped), extracts insights
// and creates note blocks automatically.
//
// Debounced to 2 seconds to avoid processing mid-stream messages.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  processMessageForNotes,
  shouldExtractFromMessage,
  countInsights,
} from '@/lib/notes/auto-notes';
import type { ChatMessage } from '@/lib/engine/types';

// ── Constants ──

/** localStorage key for the auto-notes enabled toggle */
const STORAGE_KEY = 'pfc-auto-notes-enabled';

/** Debounce delay (ms) — wait for streaming to finish */
const DEBOUNCE_MS = 2_000;

// ── Helpers ──

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage unavailable
  }
}

// ═══════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════

export interface UseAutoNotesReturn {
  /** Whether auto-notes extraction is currently enabled */
  enabled: boolean;
  /** Toggle auto-notes on/off (persisted to localStorage) */
  setEnabled: (value: boolean) => void;
  /** Short description of the last extraction, or null */
  lastExtracted: string | null;
}

export function useAutoNotes(): UseAutoNotesReturn {
  const [enabled, setEnabledState] = useState<boolean>(loadEnabled);
  const [lastExtracted, setLastExtracted] = useState<string | null>(null);

  // Track the number of messages we have already processed, so we
  // only extract from genuinely new messages.
  const processedCountRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    saveEnabled(value);
  }, []);

  // ── Subscribe to store changes ──
  useEffect(() => {
    // Initialize the processed count to the current message count
    // so we don't retroactively process old messages on mount.
    const initialMessages = usePFCStore.getState().messages;
    processedCountRef.current = initialMessages.length;

    // Use Zustand's subscribeWithSelector to watch messages + isStreaming.
    // We subscribe to the raw store to get fine-grained control.
    const unsubscribe = usePFCStore.subscribe(
      (state) => ({
        messages: state.messages,
        isStreaming: state.isStreaming,
      }),
      (current) => {
        // Skip if disabled
        if (!enabled) return;

        // Skip if still streaming — wait for it to finish
        if (current.isStreaming) return;

        const messages = current.messages;
        const alreadyProcessed = processedCountRef.current;

        // No new messages
        if (messages.length <= alreadyProcessed) return;

        // Debounce: clear any pending timer and set a new one.
        // This ensures we wait 2s after the last message change
        // before extracting, avoiding mid-stream partial messages.
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          const store = usePFCStore.getState();
          const msgs = store.messages;
          const startIdx = processedCountRef.current;

          // Process only new messages
          for (let i = startIdx; i < msgs.length; i++) {
            const msg = msgs[i] as ChatMessage;
            if (!shouldExtractFromMessage(msg)) continue;

            const extraction = processMessageForNotes(msg, store);
            if (extraction) {
              const total = countInsights(extraction);
              setLastExtracted(
                `Extracted ${total} insight${total !== 1 ? 's' : ''} at ${new Date().toLocaleTimeString()}`,
              );
            }
          }

          // Update processed count
          processedCountRef.current = msgs.length;
        }, DEBOUNCE_MS);
      },
      { equalityFn: (a, b) => a.messages === b.messages && a.isStreaming === b.isStreaming },
    );

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled]);

  return { enabled, setEnabled, lastExtracted };
}
