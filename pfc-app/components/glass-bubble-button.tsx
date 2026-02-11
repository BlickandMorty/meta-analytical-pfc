'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';

/* ═══════════════════════════════════════════════════════════
   GlassBubbleButton — NavBubble-style pill button

   Matches the top-nav NavBubble interaction model:
   • Pill shape (9999px radius)
   • Octa-inspired solid card bg + soft shadow on active
   • Smooth hover glow with border tint
   • whileTap scale 0.92
   • Warm brown palette with clean transitions
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
  style?: React.CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

const COLOR_MAP: Record<BubbleColor, { accent: string; activeBg: string; activeBgLight: string; hoverBorder: string; hoverBorderLight: string }> = {
  violet:  { accent: '#C4956A', activeBg: 'rgba(44,43,41,0.85)',  activeBgLight: 'rgba(255,255,255,0.85)', hoverBorder: 'rgba(196,149,106,0.2)', hoverBorderLight: 'rgba(196,149,106,0.15)' },
  ember:   { accent: '#C4956A', activeBg: 'rgba(44,43,41,0.85)',  activeBgLight: 'rgba(255,255,255,0.85)', hoverBorder: 'rgba(196,149,106,0.2)', hoverBorderLight: 'rgba(196,149,106,0.15)' },
  green:   { accent: '#34D399', activeBg: 'rgba(44,43,41,0.85)',  activeBgLight: 'rgba(255,255,255,0.85)', hoverBorder: 'rgba(52,211,153,0.2)',  hoverBorderLight: 'rgba(52,211,153,0.15)' },
  cyan:    { accent: '#22D3EE', activeBg: 'rgba(44,43,41,0.85)',  activeBgLight: 'rgba(255,255,255,0.85)', hoverBorder: 'rgba(34,211,238,0.2)',  hoverBorderLight: 'rgba(34,211,238,0.15)' },
  red:     { accent: '#F87171', activeBg: 'rgba(44,43,41,0.85)',  activeBgLight: 'rgba(255,255,255,0.85)', hoverBorder: 'rgba(248,113,113,0.2)', hoverBorderLight: 'rgba(248,113,113,0.15)' },
  yellow:  { accent: '#FBBF24', activeBg: 'rgba(44,43,41,0.85)',  activeBgLight: 'rgba(255,255,255,0.85)', hoverBorder: 'rgba(251,191,36,0.2)',  hoverBorderLight: 'rgba(251,191,36,0.15)' },
  neutral: { accent: '#C4956A', activeBg: 'rgba(44,43,41,0.85)',  activeBgLight: 'rgba(255,255,255,0.85)', hoverBorder: 'rgba(196,149,106,0.2)', hoverBorderLight: 'rgba(196,149,106,0.15)' },
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
  style: styleProp,
  disabled = false,
  type = 'button',
}: GlassBubbleButtonProps) {
  const { resolvedTheme } = useTheme();
  const isDark = (resolvedTheme === 'dark' || resolvedTheme === 'oled');
  const [hovered, setHovered] = useState(false);

  const c = COLOR_MAP[color];
  const s = SIZE_MAP[size];

  // Shadow: Octa-style soft shadow on active, subtle lift on hover
  const shadow = active
    ? (isDark
        ? '0 2px 8px -1px rgba(0,0,0,0.3), 0 1px 3px -1px rgba(0,0,0,0.2)'
        : '0 2px 16px -2px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.04)')
    : hovered && !disabled
      ? (isDark
          ? '0 2px 12px -2px rgba(0,0,0,0.2)'
          : '0 2px 12px -2px rgba(0,0,0,0.04)')
      : 'none';

  // Border: accent tint on hover/active
  const border = active
    ? `1px solid ${isDark ? c.hoverBorder : c.hoverBorderLight}`
    : hovered && !disabled
      ? `1px solid ${isDark ? 'rgba(79,69,57,0.3)' : 'rgba(190,183,170,0.3)'}`
      : '1px solid transparent';

  // Background: solid card surface on active (matching nav pill)
  const bg = disabled
    ? (isDark ? 'rgba(244,189,111,0.02)' : 'rgba(0,0,0,0.02)')
    : active
      ? (isDark ? c.activeBg : c.activeBgLight)
      : hovered
        ? (isDark ? 'rgba(55,50,45,0.35)' : 'rgba(0,0,0,0.04)')
        : (isDark ? 'rgba(244,189,111,0.05)' : 'rgba(0,0,0,0.03)');

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.04, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        border,
        background: bg,
        color: disabled
          ? (isDark ? 'rgba(156,143,128,0.35)' : 'rgba(0,0,0,0.2)')
          : active
            ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(60,45,30,0.85)')
            : (isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)'),
        boxShadow: shadow,
        backdropFilter: 'blur(12px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
        transition: 'background 0.15s, color 0.15s, border 0.2s, box-shadow 0.2s, opacity 0.2s',
        opacity: disabled ? 0.35 : 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        transform: 'translateZ(0)',
        ...styleProp,
      }}
    >
      {children}
    </motion.button>
  );
}
