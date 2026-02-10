'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { MarkdownContent } from './markdown-content';

/* ChatGPT-style smooth streaming with settle animation */
const SETTLE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.6 };

export function StreamingText() {
  const streamingText = usePFCStore((s) => s.streamingText);
  const isStreaming = usePFCStore((s) => s.isStreaming);
  const [settled, setSettled] = useState(false);
  const wasStreamingRef = useRef(false);

  // Detect streaming completion → trigger settle animation
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && streamingText) {
      setSettled(false);
      // Small delay then settle into final bubble form
      const timer = setTimeout(() => setSettled(true), 80);
      return () => clearTimeout(timer);
    }
    if (isStreaming) {
      setSettled(false);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, streamingText]);

  if (!isStreaming && !streamingText) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: settled ? 1 : 0.998,
      }}
      transition={SETTLE_SPRING}
      style={{ position: 'relative' }}
    >
      <MarkdownContent content={streamingText} />

      {/* Streaming cursor — smooth pulse with soft glow */}
      {isStreaming && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            display: 'inline-block',
            width: 2,
            height: '1.05em',
            background: 'var(--m3-primary)',
            borderRadius: 2,
            verticalAlign: 'text-bottom',
            marginLeft: 2,
            boxShadow: '0 0 8px color-mix(in srgb, var(--m3-primary) 40%, transparent)',
          }}
        />
      )}
    </motion.div>
  );
}
