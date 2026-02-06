'use client';

import { useCallback, useRef } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import type { PipelineEvent } from '@/lib/engine/types';

export function useChatStream() {
  const abortRef = useRef<AbortController | null>(null);

  const sendQuery = useCallback(async (query: string, chatId?: string) => {
    const store = usePFCStore.getState();

    // Abort any existing stream
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Optimistic: add user message immediately
    store.submitQuery(query);
    store.startStreaming();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatId || store.currentChatId,
          query,
          userId: 'local-user',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') {
            store.stopStreaming();
            continue;
          }

          try {
            const event = JSON.parse(data) as PipelineEvent | { type: 'chat-id'; chatId: string };

            switch (event.type) {
              case 'chat-id':
                if ('chatId' in event) {
                  store.setCurrentChat(event.chatId);
                }
                break;

              case 'stage':
                store.advanceStage(event.stage, {
                  status: event.status,
                  detail: event.detail,
                  value: event.value,
                });
                break;

              case 'signals':
                store.applySignalUpdate(event.data);
                break;

              case 'text-delta':
                store.appendStreamingText(event.text);
                break;

              case 'complete':
                store.completeProcessing(
                  event.dualMessage,
                  event.confidence,
                  event.grade,
                  event.mode,
                  event.truthAssessment,
                );
                // Apply final signals
                store.applySignalUpdate(event.signals);
                break;

              case 'error':
                console.error('Pipeline error:', event.message);
                store.stopStreaming();
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Stream error:', error);
      }
      store.stopStreaming();
    } finally {
      abortRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      usePFCStore.getState().stopStreaming();
    }
  }, []);

  return { sendQuery, abort };
}
