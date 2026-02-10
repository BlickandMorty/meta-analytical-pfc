'use client';

import { useState, useEffect, memo, useCallback } from 'react';
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
  PenLineIcon,
  ServerIcon,
  WifiIcon,
  ActivityIcon,
  SparklesIcon,
  FlaskConicalIcon,
  ArchiveIcon,
  CompassIcon,
  NetworkIcon,
  MicroscopeIcon,
  BrainIcon,
  type LucideIcon,
} from 'lucide-react';
import { SteeringIndicator } from './steering-indicator';

/* ─── Shared spring config for fluid motion ─── */
const FLUID_SPRING = { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.8 };
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
  { href: '/analytics', label: 'Analytics', icon: BarChart3Icon, minTier: 'full', group: 'tools' },
  { href: '/export', label: 'Export', icon: DownloadIcon, group: 'utility' },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, group: 'utility' },
  { href: '/docs', label: 'Docs', icon: BookOpenIcon, group: 'utility' },
];

/* ─── Analytics sub-tabs — shown when analytics bubble expands ─── */
const ANALYTICS_TABS = [
  { key: 'research', label: 'Research', icon: FlaskConicalIcon },
  { key: 'archive', label: 'Archive', icon: ArchiveIcon },
  { key: 'steering', label: 'Steering', icon: CompassIcon },
  { key: 'pipeline', label: 'Pipeline', icon: NetworkIcon },
  { key: 'signals', label: 'Signals', icon: ActivityIcon },
  { key: 'visualizer', label: 'Visualizer', icon: BarChart3Icon },
  { key: 'evaluate', label: 'Evaluate', icon: MicroscopeIcon },
  { key: 'concepts', label: 'Concepts', icon: BrainIcon },
] as const;

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

/* ─── M3 Nav bubble helpers — active uses primaryContainer ─── */
function bubbleBg(isActive: boolean, isDark: boolean, disabled?: boolean) {
  if (disabled) return 'transparent';
  if (isActive) return 'var(--m3-primary-container)';
  return 'transparent';
}

function bubbleColor(isActive: boolean, isDark: boolean, disabled?: boolean) {
  if (disabled) return isDark ? 'rgba(156,143,128,0.35)' : 'rgba(0,0,0,0.2)';
  if (isActive) return 'var(--m3-on-primary-container)';
  return isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)';
}

/* ═══════════════════════════════════════════════════════════════════
   Standard NavBubble
   ═══════════════════════════════════════════════════════════════════ */
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
      whileTap={disabled ? undefined : { scale: 0.95 }}
      title={disabled ? `${item.label} — enable ${disabledReason} in Settings` : item.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expanded ? '0.375rem' : '0rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: expanded ? '0.4375rem 0.875rem' : '0.4375rem 0.5rem',
        height: '2.25rem',
        fontSize: '0.8125rem',
        fontWeight: isActive ? 700 : 600,
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.35 : 1,
        color: bubbleColor(isActive, isDark, disabled),
        background: bubbleBg(isActive, isDark, disabled),
        whiteSpace: 'nowrap',
        transition: 'padding 0.25s cubic-bezier(0.2,0,0,1), gap 0.25s cubic-bezier(0.2,0,0,1), background 0.15s, color 0.15s',
      }}
    >
      <Icon style={{
        height: '0.9375rem',
        width: '0.9375rem',
        flexShrink: 0,
        color: isActive ? 'var(--m3-primary)' : 'inherit',
      }} />
      <AnimatePresence>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3, ease: CUPERTINO_EASE }}
            style={{ overflow: 'hidden', display: 'inline-block' }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   Chat NavBubble — expands into PFC engine bar when on chat page
   ═══════════════════════════════════════════════════════════════════ */
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
            : '0.4375rem 0.5rem',
        height: '2.25rem',
        fontSize: '0.8125rem',
        fontWeight: isActive ? 700 : 600,
        letterSpacing: '-0.01em',
        color: bubbleColor(isActive, isDark),
        background: bubbleBg(isActive, isDark),
        whiteSpace: 'nowrap',
        transition: 'padding 0.25s cubic-bezier(0.2,0,0,1), gap 0.25s cubic-bezier(0.2,0,0,1), background 0.15s, color 0.15s',
      }}
    >
      <Icon style={{
        height: '0.9375rem',
        width: '0.9375rem',
        flexShrink: 0,
        color: isActive ? 'var(--m3-primary)' : 'inherit',
      }} />

      {/* Label */}
      <AnimatePresence>
        {showLabel && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3, ease: CUPERTINO_EASE }}
            style={{ overflow: 'hidden', display: 'inline-block' }}
          >
            {showExpanded ? 'PFC Engine' : item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* PFC engine bar items — inline, no nested AnimatePresence */}
      {showExpanded && (
        <>
          <span style={{
            width: 3, height: 3, borderRadius: '50%', flexShrink: 0,
            background: isDark ? 'rgba(156,143,128,0.25)' : 'rgba(0,0,0,0.15)',
          }} />

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.125rem 0.375rem', borderRadius: '9999px',
            background: isDark ? 'rgba(244,189,111,0.08)' : 'rgba(128,86,16,0.06)',
            fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
            color: isDark ? 'rgba(244,189,111,0.7)' : 'rgba(128,86,16,0.7)',
          }}>
            {inferenceMode === 'simulation'
              ? <ServerIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
              : <WifiIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
            }
            {modeInfo.label}
          </span>

          {confidence > 0 && (
            <span style={{
              fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
              color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
            }}>
              {(confidence * 100).toFixed(0)}%
            </span>
          )}

          <SteeringIndicator />

          {isProcessing && activeStage && (
            <span
              className="animate-pipeline-pulse"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.125rem 0.375rem', borderRadius: '9999px',
                background: isDark ? 'rgba(244,189,111,0.08)' : 'rgba(128,86,16,0.06)',
                fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
                color: 'var(--m3-primary)',
              }}
            >
              <ActivityIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
              {activeStage.replace('_', '-')}
            </span>
          )}

          {hasMessages && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); toggleSynthesis(); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.1875rem 0.5rem', borderRadius: '9999px',
                background: isDark ? 'rgba(244,189,111,0.08)' : 'rgba(128,86,16,0.06)',
                cursor: 'pointer', fontSize: '0.625rem', fontWeight: 600,
                color: 'var(--m3-primary)',
              }}
            >
              <SparklesIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
              Synthesize
            </span>
          )}
        </>
      )}
    </motion.button>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   Analytics NavBubble — splits into sub-tab bubbles on analytics page
   ═══════════════════════════════════════════════════════════════════ */
const AnalyticsNavBubble = memo(function AnalyticsNavBubble({
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
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const Icon = item.icon;

  // When active, show the sub-tabs as separate small bubbles
  if (isActive && !disabled) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.1875rem',
        }}
      >
        {ANALYTICS_TABS.map((tab, idx) => {
          const TabIcon = tab.icon;
          const isTabHovered = hoveredTab === tab.key;
          return (
            <motion.button
              key={tab.key}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                ...FLUID_SPRING,
                delay: idx * 0.025,
              }}
              onMouseEnter={() => setHoveredTab(tab.key)}
              onMouseLeave={() => setHoveredTab(null)}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                // Dispatch a custom event for the analytics page to pick up
                window.dispatchEvent(new CustomEvent('pfc-analytics-tab', { detail: tab.key }));
              }}
              title={tab.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isTabHovered ? '0.25rem' : '0rem',
                border: 'none',
                borderRadius: '9999px',
                padding: isTabHovered ? '0.3125rem 0.5rem' : '0.3125rem',
                height: '1.75rem',
                cursor: 'pointer',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: isTabHovered
                  ? 'var(--m3-on-primary-container)'
                  : (isDark ? 'rgba(156,143,128,0.6)' : 'rgba(0,0,0,0.35)'),
                background: isTabHovered
                  ? 'var(--m3-primary-container)'
                  : 'transparent',
                whiteSpace: 'nowrap',
                transition: 'padding 0.3s cubic-bezier(0.32,0.72,0,1), gap 0.3s cubic-bezier(0.32,0.72,0,1), background 0.2s, color 0.2s',
              }}
            >
              <TabIcon style={{
                height: '0.75rem',
                width: '0.75rem',
                flexShrink: 0,
                color: isTabHovered ? 'var(--m3-primary)' : 'inherit',
              }} />
              {isTabHovered && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.25, ease: CUPERTINO_EASE }}
                  style={{ overflow: 'hidden', display: 'inline-block' }}
                >
                  {tab.label}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    );
  }

  // Normal collapsed state
  const expanded = hovered && !disabled;

  return (
    <motion.button
      onClick={() => !disabled && onNavigate(item.href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      title={disabled ? `${item.label} — enable ${disabledReason} in Settings` : item.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expanded ? '0.375rem' : '0rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: expanded ? '0.4375rem 0.875rem' : '0.4375rem 0.5rem',
        height: '2.25rem',
        fontSize: '0.8125rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.35 : 1,
        color: bubbleColor(false, isDark, disabled),
        background: bubbleBg(false, isDark, disabled),
        whiteSpace: 'nowrap',
        transition: 'padding 0.25s cubic-bezier(0.2,0,0,1), gap 0.25s cubic-bezier(0.2,0,0,1), background 0.15s, color 0.15s',
      }}
    >
      <Icon style={{
        height: '0.9375rem',
        width: '0.9375rem',
        flexShrink: 0,
      }} />
      <AnimatePresence>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3, ease: CUPERTINO_EASE }}
            style={{ overflow: 'hidden', display: 'inline-block' }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   TopNav — floating bubbles at top of page
   ═══════════════════════════════════════════════════════════════════ */
export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const suiteTier = usePFCStore((s) => s.suiteTier);

  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  const chatMessages = usePFCStore((s) => s.messages);
  const isOnChat = pathname.startsWith('/chat') || (pathname === '/' && chatMessages.length > 0);
  const isOnAnalytics = pathname === '/analytics';

  const clearMessages = usePFCStore((s) => s.clearMessages);

  const handleNavigate = useCallback((href: string) => {
    if (href === '/') {
      clearMessages();
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
      transition={{ duration: 0.5, ease: CUPERTINO_EASE }}
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
      {/* Floating bubbles — frosted dark backdrop for readability */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.25rem',
          padding: '0.5rem 1rem',
          pointerEvents: 'auto',
          background: isDark
            ? 'rgba(24,18,11,0.65)'
            : 'rgba(255,248,244,0.65)',
          backdropFilter: 'blur(16px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
          borderBottom: `1px solid ${isDark ? 'rgba(79,69,57,0.15)' : 'rgba(208,196,180,0.12)'}`,
        }}
      >
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

          // Analytics item splits into sub-bubbles on analytics page
          if (item.label === 'Analytics') {
            return (
              <AnalyticsNavBubble
                key={item.href}
                item={item}
                isActive={isOnAnalytics}
                isDark={isDark}
                onNavigate={handleNavigate}
                disabled={!meetsRequirement}
                disabledReason={tierGateLabel(minTier)}
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
