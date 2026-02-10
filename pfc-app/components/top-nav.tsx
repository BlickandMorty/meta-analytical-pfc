'use client';

import { useState, useEffect, memo, useCallback, Fragment } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { usePFCStore, type PFCState } from '@/lib/store/use-pfc-store';
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
  ServerIcon,
  WifiIcon,
  ActivityIcon,
  SparklesIcon,
  type LucideIcon,
} from 'lucide-react';
import { SteeringIndicator } from './steering-indicator';

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

/** Minimum tier required to access a nav item */
type TierGate = 'notes' | 'programming' | 'full';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minTier?: TierGate;
  group: 'core' | 'tools' | 'utility';
  activePrefix?: string;
  neverActive?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon, group: 'core', neverActive: true },
  { href: '/chat', label: 'Chat', icon: MessageSquareIcon, group: 'core', activePrefix: '/chat' },
  { href: '/notes', label: 'Notes', icon: PenLineIcon, group: 'core' },
  { href: '/research-library', label: 'Library', icon: LibraryIcon, group: 'core' },
  { href: '/dev-tools', label: 'Dev Tools', icon: WrenchIcon, minTier: 'programming', group: 'tools' },
  { href: '/code-analyzer', label: 'Analyzer', icon: CodeIcon, minTier: 'programming', group: 'tools' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3Icon, minTier: 'full', group: 'tools' },
  { href: '/export', label: 'Export', icon: DownloadIcon, group: 'utility' },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, group: 'utility' },
  { href: '/docs', label: 'Docs', icon: BookOpenIcon, group: 'utility' },
];

function tierMeetsMinimum(current: string, minimum: TierGate): boolean {
  const ORDER: Record<string, number> = { notes: 0, programming: 1, full: 2 };
  return (ORDER[current] ?? 0) >= (ORDER[minimum] ?? 0);
}

function tierGateLabel(gate: TierGate): string {
  switch (gate) {
    case 'programming': return 'Programming Suite';
    case 'full': return 'Full Measurement Suite';
    default: return '';
  }
}

const MODE_STYLES: Record<string, { label: string }> = {
  simulation: { label: 'Sim' },
  api: { label: 'API' },
  local: { label: 'Local' },
};

/* ─── Standard NavBubble ─── */
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
        height: '2.5rem',
        minWidth: expanded ? 'auto' : '2.5rem',
        fontSize: '0.875rem',
        fontWeight: isActive ? 700 : 600,
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.35 : 1,
        color: disabled
          ? (isDark ? 'rgba(155,150,137,0.35)' : 'rgba(0,0,0,0.2)')
          : isActive
            ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.9)')
            : (isDark ? 'rgba(155,150,137,0.7)' : 'rgba(0,0,0,0.45)'),
        background: disabled
          ? (isDark ? 'rgba(196,149,106,0.02)' : 'rgba(0,0,0,0.02)')
          : isActive
            ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(196,149,106,0.10)')
            : (isDark ? 'rgba(196,149,106,0.05)' : 'rgba(0,0,0,0.04)'),
        backdropFilter: 'blur(12px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
        transition: 'padding 0.28s cubic-bezier(0.32,0.72,0,1), gap 0.28s cubic-bezier(0.32,0.72,0,1), min-width 0.28s cubic-bezier(0.32,0.72,0,1), background 0.15s, color 0.15s, opacity 0.2s',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon style={{
        height: '1.0625rem',
        width: '1.0625rem',
        flexShrink: 0,
        color: isActive ? '#C4956A' : 'inherit',
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

/* ─── Chat NavBubble — expands into PFC engine bar when on chat page ─── */
const selectIsProcessing = (s: PFCState) => s.isProcessing;
const selectActiveStage = (s: PFCState) => s.activeStage;
const selectMessages = (s: PFCState) => s.messages;
const selectInferenceMode = (s: PFCState) => s.inferenceMode;
const selectConfidence = (s: PFCState) => s.confidence;
const selectToggleSynthesis = (s: PFCState) => s.toggleSynthesisView;

const ChatNavBubble = memo(function ChatNavBubble({
  item,
  isActive,
  isDark,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  isDark: boolean;
  onNavigate: (href: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;

  const isProcessing = usePFCStore(selectIsProcessing);
  const activeStage = usePFCStore(selectActiveStage);
  const messages = usePFCStore(selectMessages);
  const inferenceMode = usePFCStore(selectInferenceMode);
  const confidence = usePFCStore(selectConfidence);
  const toggleSynthesis = usePFCStore(selectToggleSynthesis);

  const hasMessages = messages.some((m) => m.role === 'system');
  const modeInfo = MODE_STYLES[inferenceMode] ?? MODE_STYLES.simulation;

  const showExpanded = isActive;
  const showLabel = hovered || isActive;

  return (
    <motion.button
      onClick={() => onNavigate(item.href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={{ scale: 0.95 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        cursor: 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: showExpanded
          ? '0.4375rem 0.75rem'
          : showLabel
            ? '0.4375rem 0.875rem'
            : '0.4375rem',
        height: '2.5rem',
        minWidth: showLabel ? 'auto' : '2.5rem',
        fontSize: '0.875rem',
        fontWeight: isActive ? 700 : 600,
        letterSpacing: '-0.01em',
        color: isActive
          ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.9)')
          : (isDark ? 'rgba(155,150,137,0.7)' : 'rgba(0,0,0,0.45)'),
        background: isActive
          ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(196,149,106,0.10)')
          : (isDark ? 'rgba(196,149,106,0.05)' : 'rgba(0,0,0,0.04)'),
        backdropFilter: 'blur(12px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
        transition: 'padding 0.28s cubic-bezier(0.32,0.72,0,1), gap 0.28s cubic-bezier(0.32,0.72,0,1), min-width 0.28s cubic-bezier(0.32,0.72,0,1), background 0.15s, color 0.15s',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon style={{
        height: '1.0625rem',
        width: '1.0625rem',
        flexShrink: 0,
        color: isActive ? '#C4956A' : 'inherit',
      }} />

      {/* Label */}
      <AnimatePresence>
        {showLabel && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.22, ease: CUPERTINO_EASE }}
            style={{ overflow: 'hidden', display: 'inline-block' }}
          >
            {showExpanded ? 'PFC Engine' : item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* PFC engine bar items — inline with the button, no nested AnimatePresence */}
      {showExpanded && (
        <>
          {/* Separator dot */}
          <span style={{
            width: 3, height: 3, borderRadius: '50%', flexShrink: 0,
            background: isDark ? 'rgba(155,150,137,0.25)' : 'rgba(0,0,0,0.15)',
          }} />

          {/* Mode badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.125rem 0.375rem', borderRadius: '9999px',
            background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(196,149,106,0.06)',
            fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
            color: isDark ? 'rgba(196,149,106,0.7)' : 'rgba(196,149,106,0.8)',
          }}>
            {inferenceMode === 'simulation'
              ? <ServerIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
              : <WifiIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
            }
            {modeInfo.label}
          </span>

          {/* Confidence */}
          {confidence > 0 && (
            <span style={{
              fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
              color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
            }}>
              {(confidence * 100).toFixed(0)}%
            </span>
          )}

          <SteeringIndicator />

          {/* Active pipeline stage */}
          {isProcessing && activeStage && (
            <span
              className="animate-pipeline-pulse"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.125rem 0.375rem', borderRadius: '9999px',
                background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(196,149,106,0.06)',
                fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
                color: '#C4956A',
              }}
            >
              <ActivityIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
              {activeStage.replace('_', '-')}
            </span>
          )}

          {/* Synthesize button */}
          {hasMessages && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); toggleSynthesis(); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.1875rem 0.5rem', borderRadius: '9999px',
                background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(196,149,106,0.06)',
                cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 600,
                color: '#C4956A',
              }}
            >
              <SparklesIcon style={{ height: '0.625rem', width: '0.625rem' }} />
              Synthesize
            </span>
          )}
        </>
      )}
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

  const chatMessages = usePFCStore((s) => s.messages);
  // Chat bubble is active only when actually chatting (has messages), not on landing
  const isOnChat = pathname.startsWith('/chat') || (pathname === '/' && chatMessages.length > 0);

  const clearMessages = usePFCStore((s) => s.clearMessages);

  const handleNavigate = useCallback((href: string) => {
    if (href === '/') {
      // Always clear chat state and go to landing
      clearMessages();
      // If already on / or /chat, push to / anyway to force re-render
      if (pathname === '/' || pathname.startsWith('/chat')) {
        router.replace('/');
      } else {
        router.push('/');
      }
      return;
    }
    router.push(href);
  }, [router, clearMessages, pathname]);

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
      {/* Floating bubbles — no background bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.375rem',
        padding: '0.625rem 1.25rem',
        pointerEvents: 'auto',
      }}>
        {NAV_ITEMS.map((item) => {
          const minTier = item.minTier ?? 'notes';
          const meetsRequirement = tierMeetsMinimum(suiteTier, minTier);

          // Chat item gets special expanded bubble
          if (item.label === 'Chat') {
            return (
              <ChatNavBubble
                key={item.href}
                item={item}
                isActive={isOnChat}
                isDark={isDark}
                onNavigate={handleNavigate}
              />
            );
          }

          return (
            <NavBubble
              key={item.href}
              item={item}
              isActive={
                item.neverActive
                  ? false
                  : item.activePrefix
                    ? pathname.startsWith(item.activePrefix)
                    : pathname === item.href
              }
              isDark={isDark}
              onNavigate={handleNavigate}
              disabled={!meetsRequirement}
              disabledReason={tierGateLabel(minTier)}
            />
          );
        })}
      </div>
    </motion.nav>
  );
}
