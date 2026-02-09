'use client';

import { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';

/* ═══════════════════════════════════════════════════════════
   GlassBubbleButton — iOS 26 liquid-glass bubble interaction

   Features:
   • Frosted glass with subtle border
   • Spring-based hover/tap with scale + brightness shift
   • Color accent variants (violet, ember, green, cyan, red, yellow, neutral)
   • Cursor-proximity glow (lightweight — only on hover)
   • Works in both light and dark modes
   ═══════════════════════════════════════════════════════════ */

export type BubbleColor = 'violet' | 'ember' | 'green' | 'cyan' | 'red' | 'yellow' | 'neutral';

interface GlassBubbleButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  color?: BubbleColor;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

const COLOR_MAP: Record<BubbleColor, { accent: string; bg: string; border: string; activeBg: string; activeBorder: string }> = {
  violet:  { accent: '#C4956A', bg: 'rgba(196,149,106,0.06)', border: 'rgba(196,149,106,0.12)', activeBg: 'rgba(196,149,106,0.14)', activeBorder: 'rgba(196,149,106,0.28)' },
  ember:   { accent: '#C4956A', bg: 'rgba(196,149,106,0.06)',  border: 'rgba(196,149,106,0.12)',  activeBg: 'rgba(196,149,106,0.14)',  activeBorder: 'rgba(196,149,106,0.28)' },
  green:   { accent: '#34D399', bg: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.12)',  activeBg: 'rgba(52,211,153,0.14)',  activeBorder: 'rgba(52,211,153,0.28)' },
  cyan:    { accent: '#22D3EE', bg: 'rgba(34,211,238,0.06)',  border: 'rgba(34,211,238,0.12)',  activeBg: 'rgba(34,211,238,0.14)',  activeBorder: 'rgba(34,211,238,0.28)' },
  red:     { accent: '#F87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.12)', activeBg: 'rgba(248,113,113,0.14)', activeBorder: 'rgba(248,113,113,0.28)' },
  yellow:  { accent: '#FBBF24', bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.12)',  activeBg: 'rgba(251,191,36,0.14)',  activeBorder: 'rgba(251,191,36,0.28)' },
  neutral: { accent: 'currentColor', bg: 'rgba(128,128,128,0.04)', border: 'rgba(128,128,128,0.1)', activeBg: 'rgba(128,128,128,0.08)', activeBorder: 'rgba(128,128,128,0.18)' },
};

const SIZE_MAP = {
  sm: { padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '0.75rem', gap: '0.375rem' },
  md: { padding: '0.5rem 1rem', fontSize: '0.8125rem', borderRadius: '1rem', gap: '0.5rem' },
  lg: { padding: '0.75rem 1.25rem', fontSize: '0.875rem', borderRadius: '1.125rem', gap: '0.5rem' },
};

const SPRING = { type: 'spring' as const, stiffness: 500, damping: 28, mass: 0.5 };

export function GlassBubbleButton({
  children,
  onClick,
  active = false,
  color = 'neutral',
  size = 'md',
  fullWidth = false,
  className,
  disabled = false,
  type = 'button',
}: GlassBubbleButtonProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const btnRef = useRef<HTMLButtonElement>(null);

  const c = COLOR_MAP[color];
  const s = SIZE_MAP[size];

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--glow-x', `${x}%`);
    el.style.setProperty('--glow-y', `${y}%`);
  }, []);

  return (
    <motion.button
      ref={btnRef}
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.035 }}
      whileTap={{ scale: 0.955 }}
      transition={SPRING}
      onMouseMove={handleMouseMove}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: active ? 600 : 450,
        letterSpacing: '-0.01em',
        borderRadius: s.borderRadius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        border: `1px solid ${active ? c.activeBorder : (isDark ? `rgba(62,61,57,0.5)` : c.border)}`,
        background: active
          ? (isDark ? c.activeBg : c.activeBg)
          : (isDark ? 'rgba(53,52,48,0.5)' : c.bg),
        color: active
          ? c.accent
          : (isDark ? 'rgba(232,228,222,0.6)' : 'rgba(0,0,0,0.55)'),
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        transition: 'color 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.2s',
        opacity: disabled ? 0.4 : 1,
        whiteSpace: 'nowrap',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {children}
    </motion.button>
  );
}
