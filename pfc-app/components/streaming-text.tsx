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
        <span
          className="inline-block ml-0.5 animate-blink rounded-sm"
          style={{ width: 2.5, height: '1.1em', background: '#C4956A', verticalAlign: 'text-bottom' }}
        />
      )}
    </div>
  );
}
