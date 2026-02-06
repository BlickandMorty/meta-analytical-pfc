import React, { useEffect, useState, useRef } from 'react';
import { PFCText } from './PFCText';
import type { FontSize } from '../theme/fonts';

interface TypewriterTextProps {
  text: string;
  speed?: number; // chars per second, default 80
  onComplete?: () => void;
  variant?: 'body' | 'ui' | 'code' | 'display';
  size?: FontSize;
  color?: string;
  style?: any;
  animate?: boolean; // if false, render full text immediately
}

export function TypewriterText({
  text,
  speed = 80,
  onComplete,
  variant = 'body',
  size = 'md',
  color,
  style,
  animate = true,
}: TypewriterTextProps) {
  const [displayedLength, setDisplayedLength] = useState(animate ? 0 : text.length);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(!animate);

  useEffect(() => {
    if (!animate) {
      setDisplayedLength(text.length);
      return;
    }

    setDisplayedLength(0);
    completedRef.current = false;

    const intervalMs = 1000 / speed;
    // Batch multiple chars per frame for high speeds
    const charsPerTick = Math.max(1, Math.floor(speed / 60));

    intervalRef.current = setInterval(() => {
      setDisplayedLength((prev) => {
        const next = Math.min(prev + charsPerTick, text.length);
        if (next >= text.length && !completedRef.current) {
          completedRef.current = true;
          if (intervalRef.current) clearInterval(intervalRef.current);
          onComplete?.();
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed, animate]);

  const displayText = text.slice(0, displayedLength);

  return (
    <PFCText variant={variant} size={size} color={color} style={style}>
      {displayText}
      {animate && displayedLength < text.length ? '\u258C' : ''}
    </PFCText>
  );
}
