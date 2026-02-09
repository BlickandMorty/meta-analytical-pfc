'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  SearchIcon,
  BarChart3Icon,
  SettingsIcon,
  BookOpenIcon,
  LibraryIcon,
  DownloadIcon,
  type LucideIcon,
} from 'lucide-react';

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** If true, grayed out when measurement is disabled */
  measurementOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Search', icon: SearchIcon },
  { href: '/analytics', label: 'Analytics', icon: BarChart3Icon, measurementOnly: true },
  { href: '/research-library', label: 'Library', icon: LibraryIcon },
  { href: '/export', label: 'Export', icon: DownloadIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
  { href: '/docs', label: 'Docs', icon: BookOpenIcon },
];

const NavBubble = memo(function NavBubble({
  item,
  isActive,
  isDark,
  onNavigate,
  disabled,
}: {
  item: NavItem;
  isActive: boolean;
  isDark: boolean;
  onNavigate: (href: string) => void;
  disabled?: boolean;
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
      title={disabled ? `${item.label} — enable Measurement Suite in Settings` : item.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expanded ? '0.375rem' : '0rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: expanded ? '0.375rem 0.75rem' : '0.375rem',
        height: '2rem',
        minWidth: expanded ? 'auto' : '2rem',
        fontSize: '0.75rem',
        fontWeight: isActive ? 600 : 500,
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
        height: '0.875rem',
        width: '0.875rem',
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
  const measurementEnabled = usePFCStore((s) => s.measurementEnabled);

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
      {/* Two-tone accent strip */}
      <div style={{
        height: '2px',
        background: isDark
          ? 'linear-gradient(90deg, #8B7CF6 0%, #22D3EE 50%, #E07850 100%)'
          : 'linear-gradient(90deg, #7C6CF0 0%, #34D399 50%, #E07850 100%)',
        opacity: isDark ? 0.4 : 0.35,
      }} />

      {/* Navigation bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
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
        {NAV_ITEMS.map((item) => (
          <NavBubble
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            isDark={isDark}
            onNavigate={handleNavigate}
            disabled={item.measurementOnly && !measurementEnabled}
          />
        ))}
      </div>
    </motion.nav>
  );
}
