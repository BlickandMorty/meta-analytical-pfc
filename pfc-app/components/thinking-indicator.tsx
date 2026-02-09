'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Claude-style AI thinking indicator.
 *
 * - Warm brown sparkle icon with gentle spin
 * - Large bold text with typewriter effect cycling through phrases
 * - Thick blinking cursor
 * - Flat, minimal — no glass morphism
 */

const THINKING_PHRASES = [
  'Thinking',
  'Analyzing patterns',
  'Synthesizing',
  'Reasoning',
  'Connecting ideas',
  'Evaluating',
  'Processing',
  'Reflecting',
];

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

// Sparkle SVG — warm brown asterisk/star inspired by Claude's indicator
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: 'block' }}
    >
      {/* 4-point sparkle / asterisk */}
      <path
        d="M12 2C12 2 12.8 8.5 12 12C11.2 8.5 12 2 12 2Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M12 22C12 22 12.8 15.5 12 12C11.2 15.5 12 22 12 22Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M2 12C2 12 8.5 12.8 12 12C8.5 11.2 2 12 2 12Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M22 12C22 12 15.5 12.8 12 12C15.5 11.2 22 12 22 12Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Diagonal rays */}
      <path
        d="M5.64 5.64C5.64 5.64 9.17 9.17 12 12C9.17 9.17 5.64 5.64 5.64 5.64Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M18.36 18.36C18.36 18.36 14.83 14.83 12 12C14.83 14.83 18.36 18.36 18.36 18.36Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M18.36 5.64C18.36 5.64 14.83 9.17 12 12C14.83 9.17 18.36 5.64 18.36 5.64Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M5.64 18.36C5.64 18.36 9.17 14.83 12 12C9.17 14.83 5.64 18.36 5.64 18.36Z"
        fill="currentColor"
        opacity="0.5"
      />
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

interface ThinkingIndicatorProps {
  className?: string;
  isReasoning?: boolean;
}

export function ThinkingIndicator({ className, isReasoning }: ThinkingIndicatorProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const charIndexRef = useRef(0);

  const currentPhrase = isReasoning ? 'Reasoning' : THINKING_PHRASES[phraseIndex];

  // Typewriter effect
  const typeNextChar = useCallback(() => {
    const phrase = isReasoning ? 'Reasoning' : THINKING_PHRASES[phraseIndex];

    if (charIndexRef.current <= phrase.length) {
      setDisplayText(phrase.slice(0, charIndexRef.current));
      charIndexRef.current++;
      setIsTyping(true);
      // Randomized typing speed for natural feel — fast base with slight variance
      const delay = 35 + Math.random() * 30;
      timerRef.current = setTimeout(typeNextChar, delay);
    } else {
      // Finished typing — hold for a moment, then move to next phrase
      setIsTyping(false);
      if (!isReasoning) {
        timerRef.current = setTimeout(() => {
          charIndexRef.current = 0;
          setDisplayText('');
          setIsTyping(true);
          setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
        }, 2200);
      }
    }
  }, [phraseIndex, isReasoning]);

  useEffect(() => {
    charIndexRef.current = 0;
    setDisplayText('');
    setIsTyping(true);

    // Small initial delay before starting to type
    timerRef.current = setTimeout(typeNextChar, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phraseIndex, typeNextChar]);

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      {/* Sparkle icon — gentle continuous spin */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          color: '#C4956A',
          width: 20,
          height: 20,
          flexShrink: 0,
        }}
      >
        <SparkleIcon className="w-5 h-5" />
      </motion.div>

      {/* Typewriter text + cursor */}
      <div className="flex items-center min-h-[1.5em]">
        <AnimatePresence mode="wait">
          <motion.span
            key={phraseIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: CUPERTINO_EASE }}
            style={{
              color: '#C4956A',
              fontSize: '0.9375rem',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              lineHeight: 1.5,
            }}
          >
            {displayText}
          </motion.span>
        </AnimatePresence>

        {/* Thick blinking cursor */}
        <motion.span
          animate={{ opacity: [1, 1, 0, 0] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            times: [0, 0.45, 0.5, 0.95],
            ease: 'linear',
          }}
          style={{
            display: 'inline-block',
            width: 2.5,
            height: '1.1em',
            marginLeft: 1,
            background: '#C4956A',
            borderRadius: 1,
            verticalAlign: 'text-bottom',
          }}
        />
      </div>
    </div>
  );
}
