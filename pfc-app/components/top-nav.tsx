'use client';

import { useState, useEffect, memo, useCallback, Fragment } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  HomeIcon,
  MessageSquareIcon,
  BarChart3Icon,
  SettingsIcon,
  BookOpenIcon,
  LibraryIcon,
  DownloadIcon,
  CodeIcon,
  WrenchIcon,
  PenLineIcon,
  type LucideIcon,
} from 'lucide-react';

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

/** Minimum tier required to access a nav item */
type TierGate = 'notes' | 'programming' | 'full';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Minimum tier needed. Default: 'notes' (always available) */
  minTier?: TierGate;
  /** Visual grouping for separator dots */
  group: 'core' | 'tools' | 'utility';
}

const NAV_ITEMS: NavItem[] = [
  // ── Home / Landing ──
  { href: '/', label: 'Home', icon: HomeIcon, group: 'core' },
  // ── Pillar 2: Notes ──
  { href: '/notes', label: 'Notes', icon: PenLineIcon, group: 'core' },
  // ── Pillar 3: Research ──
  { href: '/research-library', label: 'Library', icon: LibraryIcon, group: 'core' },
  // ── Programming (tier-gated) ──
  { href: '/dev-tools', label: 'Dev Tools', icon: WrenchIcon, minTier: 'programming', group: 'tools' },
  { href: '/code-analyzer', label: 'Analyzer', icon: CodeIcon, minTier: 'programming', group: 'tools' },
  // ── Measurement (tier-gated) ──
  { href: '/analytics', label: 'Analytics', icon: BarChart3Icon, minTier: 'full', group: 'tools' },
  // ── Utilities ──
  { href: '/export', label: 'Export', icon: DownloadIcon, group: 'utility' },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, group: 'utility' },
  { href: '/docs', label: 'Docs', icon: BookOpenIcon, group: 'utility' },
];

/** Check if a tier meets the minimum requirement */
function tierMeetsMinimum(current: string, minimum: TierGate): boolean {
  const ORDER: Record<string, number> = { notes: 0, programming: 1, full: 2 };
  return (ORDER[current] ?? 0) >= (ORDER[minimum] ?? 0);
}

/** Get a human-readable label for a tier gate */
function tierGateLabel(gate: TierGate): string {
  switch (gate) {
    case 'programming': return 'Programming Suite';
    case 'full': return 'Full Measurement Suite';
    default: return '';
  }
}

const NavBubble = memo(function NavBubble({
  item,
  isActive,
  isDark,
  onNavigate,
  disabled,
  disabledReason,
}: {
  item: NavItem;
  isActive: boolean;
  isDark: boolean;
  onNavigate: (href: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const expanded = (hovered || isActive) && !disabled;
  const Icon = item.icon;

  return (
    <motion.button
      onClick={() => !disabled && onNavigate(item.href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      title={disabled ? `${item.label} — enable ${disabledReason} in Settings` : item.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expanded ? '0.375rem' : '0rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: expanded ? '0.4375rem 0.875rem' : '0.4375rem',
        height: '2.25rem',
        minWidth: expanded ? 'auto' : '2.25rem',
        fontSize: '0.8125rem',
        fontWeight: isActive ? 700 : 600,
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.35 : 1,
        color: disabled
          ? (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)')
          : isActive
            ? (isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)')
            : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'),
        background: disabled
          ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
          : isActive
            ? (isDark ? 'rgba(139,124,246,0.15)' : 'rgba(139,124,246,0.10)')
            : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
        backdropFilter: 'blur(12px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
        transition: 'padding 0.28s cubic-bezier(0.32,0.72,0,1), gap 0.28s cubic-bezier(0.32,0.72,0,1), min-width 0.28s cubic-bezier(0.32,0.72,0,1), background 0.15s, color 0.15s, opacity 0.2s',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon style={{
        height: '0.9375rem',
        width: '0.9375rem',
        flexShrink: 0,
        color: isActive ? '#8B7CF6' : 'inherit',
      }} />
      <AnimatePresence>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.22, ease: CUPERTINO_EASE }}
            style={{ overflow: 'hidden', display: 'inline-block' }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const suiteTier = usePFCStore((s) => s.suiteTier);

  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  const handleNavigate = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: CUPERTINO_EASE }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'none',
      }}
    >
      {/* Navigation bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.625rem 1rem',
        pointerEvents: 'auto',
        background: isDark
          ? 'rgba(0,0,0,0.5)'
          : 'rgba(240,232,222,0.65)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: isDark
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(0,0,0,0.04)',
      }}>
        {NAV_ITEMS.map((item, idx) => {
          const prev = idx > 0 ? NAV_ITEMS[idx - 1] : null;
          const showSep = prev && prev.group !== item.group;
          const minTier = item.minTier ?? 'notes';
          const meetsRequirement = tierMeetsMinimum(suiteTier, minTier);
          return (
            <Fragment key={item.href}>
              {showSep && (
                <div style={{
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  flexShrink: 0,
                }} />
              )}
              <NavBubble
                item={item}
                isActive={pathname === item.href}
                isDark={isDark}
                onNavigate={handleNavigate}
                disabled={!meetsRequirement}
                disabledReason={tierGateLabel(minTier)}
              />
            </Fragment>
          );
        })}
      </div>
    </motion.nav>
  );
}
