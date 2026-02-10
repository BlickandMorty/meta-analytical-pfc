'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════
   PageShell — full-bleed immersive page wrapper

   Replaces the old card-based layout with a clean, borderless
   flow. Content is structured through typography hierarchy
   and spacing instead of glass cards.
   ═══════════════════════════════════════════════════════════ */

interface PageShellProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const headerVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.5 },
  },
};

const contentVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.15 },
  },
};

export function PageShell({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  children,
}: PageShellProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--chat-surface)',
        color: 'var(--foreground)',
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          maxWidth: '56rem',
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: '3.5rem 2rem 4rem 4rem',
          width: '100%',
        }}
      >
        {/* ── Page header ── */}
        <motion.div
          variants={headerVariants}
          initial="hidden"
          animate="visible"
          style={{ marginBottom: '3rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                display: 'flex',
                height: '3.5rem',
                width: '3.5rem',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '1rem',
                flexShrink: 0,
                background: isDark ? 'rgba(244,189,111,0.08)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <Icon
                style={{
                  height: '1.75rem',
                  width: '1.75rem',
                  color: iconColor || '#C4956A',
                }}
              />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '2.25rem',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  style={{
                    fontSize: '1rem',
                    marginTop: '0.25rem',
                    color: isDark ? 'rgba(156,143,128,0.9)' : 'rgba(0,0,0,0.4)',
                    lineHeight: 1.5,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Content flow ── */}
        <motion.div
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Section — lightweight content grouping

   No card/glass wrapper. Uses a subtle top border and
   typography to define sections. Clean and minimal.
   ═══════════════════════════════════════════════════════════ */

interface SectionProps {
  title?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.5 },
  },
};

export function Section({ title, badge, children, className }: SectionProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  return (
    <motion.div variants={sectionVariants} className={className}>
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: `1px solid ${isDark ? 'rgba(79,69,57,0.5)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <h2
            style={{
              fontSize: '1.125rem',
              fontWeight: 650,
              letterSpacing: '-0.02em',
              color: isDark ? 'rgba(237,224,212,0.9)' : 'rgba(0,0,0,0.75)',
            }}
          >
            {title}
          </h2>
          {badge}
        </div>
      )}
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Backward-compat alias — so existing code doesn't break
   while we migrate all pages
   ═══════════════════════════════════════════════════════════ */

export const GlassSection = Section;
