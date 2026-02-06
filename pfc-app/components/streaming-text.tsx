'use client';

import { usePFCStore } from '@/lib/store/use-pfc-store';

export function StreamingText() {
  const streamingText = usePFCStore((s) => s.streamingText);
  const isStreaming = usePFCStore((s) => s.isStreaming);

  if (!isStreaming && !streamingText) return null;

  return (
    <div className="text-foreground/90 leading-relaxed">
      {streamingText}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-pfc-ember animate-blink rounded-sm" />
      )}
    </div>
  );
}
