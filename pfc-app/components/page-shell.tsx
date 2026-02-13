'use client';

import type { LucideIcon } from 'lucide-react';
import { useIsDark } from '@/hooks/use-is-dark';
import { useTypewriter } from '@/hooks/use-typewriter';
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
  const { isDark, isOled } = useIsDark();
  const { displayText: titleText, cursorVisible: titleCursor } = useTypewriter(title, true, {
    speed: 30,
    startDelay: 200,
    cursorLingerMs: 500,
  });

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
          willChange: 'scroll-position',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          contain: 'layout style paint',
          transform: 'translateZ(0)',
        } as React.CSSProperties}
      >
        {/* ── Page header ── */}
        <motion.div
          variants={headerVariants}
          initial="hidden"
          animate="visible"
          style={{ marginBottom: '3rem', transform: 'translateZ(0)' }}
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
                background: isOled ? 'rgba(25,25,25,0.8)' : isDark ? 'var(--pfc-accent-light)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <Icon
                style={{
                  height: '1.75rem',
                  width: '1.75rem',
                  color: iconColor || 'var(--pfc-accent)',
                }}
              />
            </div>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '2.25rem',
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {titleText}
                {titleCursor && (
                  <span style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '2rem',
                    backgroundColor: 'var(--pfc-accent)',
                    marginLeft: '2px',
                    flexShrink: 0,
                    opacity: 0.8,
                  }} />
                )}
              </h1>
              {subtitle && (
                <p
                  style={{
                    fontSize: '1rem',
                    marginTop: '0.25rem',
                    color: isOled ? 'rgba(140,140,140,0.9)' : isDark ? 'rgba(156,143,128,0.9)' : 'rgba(0,0,0,0.4)',
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
          style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', transform: 'translateZ(0)' }}
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
  const { isDark, isOled } = useIsDark();

  return (
    <motion.div variants={sectionVariants} className={className} style={{ transform: 'translateZ(0)', contain: 'layout style' }}>
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: `1px solid ${isOled ? 'rgba(40,40,40,0.5)' : isDark ? 'rgba(79,69,57,0.5)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.125rem',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: isOled ? 'rgba(220,220,220,0.9)' : isDark ? 'rgba(237,224,212,0.9)' : 'rgba(0,0,0,0.75)',
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

export function GlassSection(props: SectionProps) {
  return <Section {...props} />;
}
