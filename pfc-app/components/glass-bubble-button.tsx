'use client';

import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';

/* ═══════════════════════════════════════════════════════════
   GlassBubbleButton — NavBubble-style pill button

   Matches the top-nav NavBubble interaction model:
   • Pill shape (9999px radius)
   • No box-shadow, no heavy glass morphism
   • whileTap scale 0.92, subtle hover
   • Warm brown palette with clean transitions
   • Color accent variants for active state
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

const COLOR_MAP: Record<BubbleColor, { accent: string; activeBg: string; activeBgLight: string }> = {
  violet:  { accent: '#C4956A', activeBg: 'rgba(244,189,111,0.12)', activeBgLight: 'rgba(244,189,111,0.10)' },
  ember:   { accent: '#C4956A', activeBg: 'rgba(244,189,111,0.12)', activeBgLight: 'rgba(244,189,111,0.10)' },
  green:   { accent: '#34D399', activeBg: 'rgba(52,211,153,0.12)',  activeBgLight: 'rgba(52,211,153,0.10)' },
  cyan:    { accent: '#22D3EE', activeBg: 'rgba(34,211,238,0.12)',  activeBgLight: 'rgba(34,211,238,0.10)' },
  red:     { accent: '#F87171', activeBg: 'rgba(248,113,113,0.12)', activeBgLight: 'rgba(248,113,113,0.10)' },
  yellow:  { accent: '#FBBF24', activeBg: 'rgba(251,191,36,0.12)',  activeBgLight: 'rgba(251,191,36,0.10)' },
  neutral: { accent: '#C4956A', activeBg: 'rgba(244,189,111,0.12)', activeBgLight: 'rgba(244,189,111,0.10)' },
};

const SIZE_MAP = {
  sm: { padding: '0.35rem 0.75rem', fontSize: '0.75rem', gap: '0.375rem' },
  md: { padding: '0.4375rem 0.875rem', fontSize: '0.8125rem', gap: '0.375rem' },
  lg: { padding: '0.5rem 1rem', fontSize: '0.875rem', gap: '0.5rem' },
};

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

  const c = COLOR_MAP[color];
  const s = SIZE_MAP[size];

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: active ? 700 : 600,
        letterSpacing: '-0.01em',
        borderRadius: '9999px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        border: 'none',
        background: disabled
          ? (isDark ? 'rgba(244,189,111,0.02)' : 'rgba(0,0,0,0.02)')
          : active
            ? (isDark ? c.activeBg : c.activeBgLight)
            : (isDark ? 'rgba(244,189,111,0.05)' : 'rgba(0,0,0,0.04)'),
        color: disabled
          ? (isDark ? 'rgba(156,143,128,0.35)' : 'rgba(0,0,0,0.2)')
          : active
            ? (isDark ? 'rgba(237,224,212,0.95)' : 'rgba(0,0,0,0.9)')
            : (isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)'),
        backdropFilter: 'blur(12px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
        transition: 'background 0.15s, color 0.15s, opacity 0.2s',
        opacity: disabled ? 0.35 : 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {children}
    </motion.button>
  );
}
