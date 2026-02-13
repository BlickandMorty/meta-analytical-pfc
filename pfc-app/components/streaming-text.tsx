'use client';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { MarkdownContent } from './markdown-content';

export function StreamingText() {
  const streamingText = usePFCStore((s) => s.streamingText);
  const isStreaming = usePFCStore((s) => s.isStreaming);

  if (!isStreaming && !streamingText) return null;

  return (
    <div style={{ position: 'relative' }}>
      <MarkdownContent content={streamingText.replace(/\s*\[(DATA|CONFLICT|UNCERTAIN|MODEL)\]\s*/g, ' ')} />
      {isStreaming && (
        <span
          className="animate-blink"
          style={{
            display: 'inline-block',
            width: 2.5,
            height: '1.1em',
            background: 'var(--m3-primary)',
            borderRadius: 1,
            verticalAlign: 'text-bottom',
            marginLeft: 1,
          }}
        />
      )}
    </div>
  );
}
