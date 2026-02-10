'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { useTheme } from 'next-themes';
import { usePFCStore, type PFCState } from '@/lib/store/use-pfc-store';
import {
  HomeIcon,
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

/* ─── Constants ─── */
const CUP = 'cubic-bezier(0.32, 0.72, 0, 1)';
const T_SIZE = `padding 0.3s ${CUP}, gap 0.3s ${CUP}`;
const T_LABEL = `max-width 0.3s ${CUP}, opacity 0.2s ${CUP}`;
const T_COLOR = 'background 0.15s ease, color 0.15s ease';

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

/* Chat item removed — Home now does double duty */
const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon, group: 'core' },
  { href: '/notes', label: 'Notes', icon: PenLineIcon, group: 'core' },
  { href: '/research-library', label: 'Library', icon: LibraryIcon, group: 'core' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3Icon, minTier: 'full', group: 'tools' },
  { href: '/export', label: 'Export', icon: DownloadIcon, group: 'utility' },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, group: 'utility' },
  { href: '/docs', label: 'Docs', icon: BookOpenIcon, group: 'utility' },
];

/* ─── Analytics sub-tabs ─── */
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

/* ─── Theming helpers ─── */
function bubbleBg(isActive: boolean, isDark: boolean, disabled?: boolean) {
  if (disabled) return 'transparent';
  if (isActive) return isDark ? 'rgba(55,50,45,0.55)' : 'rgba(255,252,248,0.55)';
  return isDark ? 'rgba(35,32,28,0.45)' : 'rgba(255,252,248,0.4)';
}

function bubbleColor(isActive: boolean, isDark: boolean, disabled?: boolean) {
  if (disabled) return isDark ? 'rgba(155,150,137,0.35)' : 'rgba(0,0,0,0.2)';
  if (isActive) return isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.9)';
  return isDark ? 'rgba(155,150,137,0.7)' : 'rgba(0,0,0,0.45)';
}

/* ═══════════════════════════════════════════════════════════════════
   NavBubble — CSS transitions only, no layout prop
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
    <button
      onClick={() => !disabled && onNavigate(item.href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={disabled ? `${item.label} — enable ${disabledReason} in Settings` : item.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expanded ? '0.5rem' : '0rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: expanded ? '0.5rem 1rem' : '0.5rem 0.625rem',
        height: '2.5rem',
        fontSize: '0.875rem',
        fontWeight: isActive ? 650 : 500,
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.35 : 1,
        color: bubbleColor(isActive, isDark, disabled),
        background: bubbleBg(isActive, isDark, disabled),
        backdropFilter: disabled ? 'none' : 'blur(12px) saturate(1.4)',
        WebkitBackdropFilter: disabled ? 'none' : 'blur(12px) saturate(1.4)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        transition: `${T_SIZE}, ${T_COLOR}`,
        transform: 'translateZ(0)',
      }}
    >
      <Icon style={{
        height: '1.0625rem',
        width: '1.0625rem',
        flexShrink: 0,
        color: isActive ? '#C4956A' : 'inherit',
        transition: 'color 0.15s',
      }} />
      <span style={{
        display: 'inline-block',
        maxWidth: expanded ? '8rem' : '0rem',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: T_LABEL,
      }}>
        {item.label}
      </span>
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   HomePFCBubble — Home button that morphs into PFC Engine bar on chat
   Click behavior:
     - From any page → navigate to landing
     - Already on landing → scroll to top
     - On chat with messages → clear messages, go to landing
   Visual:
     - When on chat with messages → expands to show "PFC Engine" + badges
     - Otherwise → shows Home icon, expands label on hover
   ═══════════════════════════════════════════════════════════════════ */
const selectIsProcessing = (s: PFCState) => s.isProcessing;
const selectActiveStage = (s: PFCState) => s.activeStage;
const selectMessages = (s: PFCState) => s.messages;
const selectInferenceMode = (s: PFCState) => s.inferenceMode;
const selectConfidence = (s: PFCState) => s.confidence;
const selectToggleSynthesis = (s: PFCState) => s.toggleSynthesisView;

const HomePFCBubble = memo(function HomePFCBubble({
  isDark,
  isOnChat,
  isOnHome,
  onNavigate,
}: {
  isDark: boolean;
  isOnChat: boolean;
  isOnHome: boolean;
  onNavigate: (href: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const isProcessing = usePFCStore(selectIsProcessing);
  const activeStage = usePFCStore(selectActiveStage);
  const messages = usePFCStore(selectMessages);
  const inferenceMode = usePFCStore(selectInferenceMode);
  const confidence = usePFCStore(selectConfidence);
  const toggleSynthesis = usePFCStore(selectToggleSynthesis);

  const hasMessages = messages.some((m) => m.role === 'system');
  const modeInfo = MODE_STYLES[inferenceMode] ?? MODE_STYLES.simulation;

  // PFC mode: on chat page with messages
  const pfcMode = isOnChat && hasMessages;
  const showLabel = hovered || pfcMode || isOnHome;

  return (
    <button
      onClick={() => onNavigate('/')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: showLabel ? '0.5rem' : '0rem',
        cursor: 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: showLabel ? '0.5rem 1rem' : '0.5rem 0.625rem',
        height: '2.5rem',
        fontSize: '0.875rem',
        fontWeight: (pfcMode || isOnHome) ? 650 : 500,
        letterSpacing: '-0.01em',
        color: bubbleColor(pfcMode || isOnHome || hovered, isDark),
        background: bubbleBg(pfcMode || isOnHome, isDark),
        backdropFilter: 'blur(12px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        transition: `${T_SIZE}, ${T_COLOR}`,
        transform: 'translateZ(0)',
      }}
    >
      <HomeIcon style={{
        height: '1.0625rem',
        width: '1.0625rem',
        flexShrink: 0,
        color: (pfcMode || isOnHome || hovered) ? '#C4956A' : 'inherit',
        transition: 'color 0.15s',
      }} />

      {/* Label — "PFC Engine" when in chat, "Home" otherwise */}
      <span style={{
        display: 'inline-block',
        maxWidth: showLabel ? '8rem' : '0rem',
        opacity: showLabel ? 1 : 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: T_LABEL,
      }}>
        {pfcMode ? 'PFC Engine' : 'Home'}
      </span>

      {/* PFC Engine badges — only in PFC mode */}
      {pfcMode && (
        <>
          <span style={{
            width: 3, height: 3, borderRadius: '50%', flexShrink: 0,
            background: isDark ? 'rgba(155,150,137,0.25)' : 'rgba(0,0,0,0.15)',
          }} />

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

          {confidence > 0 && (
            <span style={{
              fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
              color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
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
                background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(196,149,106,0.06)',
                fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
                color: '#C4956A',
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
                background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(196,149,106,0.06)',
                cursor: 'pointer', fontSize: '0.625rem', fontWeight: 600,
                color: '#C4956A',
              }}
            >
              <SparklesIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
              Synthesize
            </span>
          )}
        </>
      )}
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   AnalyticsBubble — splits into sub-tab bubbles on analytics page
   CSS transitions only, no layout prop
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
  const [activeSubTab, setActiveSubTab] = useState<string>('research');
  const Icon = item.icon;

  // Listen for active tab broadcasts from the analytics page
  useEffect(() => {
    const handler = (e: Event) => {
      setActiveSubTab((e as CustomEvent).detail as string);
    };
    window.addEventListener('pfc-analytics-active', handler);
    return () => window.removeEventListener('pfc-analytics-active', handler);
  }, []);

  // When active, show the sub-tabs with labels always visible
  if (isActive && !disabled) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}>
        {ANALYTICS_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isTabActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('pfc-analytics-tab', { detail: tab.key }));
                setActiveSubTab(tab.key);
              }}
              title={tab.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
                border: 'none',
                borderRadius: '9999px',
                padding: '0.4375rem 0.75rem',
                height: '2rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: isTabActive ? 650 : 500,
                letterSpacing: '-0.01em',
                color: isTabActive
                  ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.9)')
                  : (isDark ? 'rgba(155,150,137,0.65)' : 'rgba(0,0,0,0.4)'),
                background: isTabActive
                  ? (isDark ? 'rgba(55,50,45,0.55)' : 'rgba(255,252,248,0.55)')
                  : (isDark ? 'rgba(35,32,28,0.45)' : 'rgba(255,252,248,0.4)'),
                backdropFilter: 'blur(12px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                transition: `${T_SIZE}, ${T_COLOR}`,
                transform: 'translateZ(0)',
              }}
            >
              <TabIcon style={{
                height: '0.8125rem',
                width: '0.8125rem',
                flexShrink: 0,
                color: isTabActive ? '#C4956A' : 'inherit',
                transition: 'color 0.15s',
              }} />
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Normal collapsed state
  const expanded = hovered && !disabled;

  return (
    <button
      onClick={() => !disabled && onNavigate(item.href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={disabled ? `${item.label} — enable ${disabledReason} in Settings` : item.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expanded ? '0.5rem' : '0rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: expanded ? '0.5rem 1rem' : '0.5rem 0.625rem',
        height: '2.5rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.35 : 1,
        color: bubbleColor(false, isDark, disabled),
        background: bubbleBg(false, isDark, disabled),
        backdropFilter: disabled ? 'none' : 'blur(12px) saturate(1.4)',
        WebkitBackdropFilter: disabled ? 'none' : 'blur(12px) saturate(1.4)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        transition: `${T_SIZE}, ${T_COLOR}`,
        transform: 'translateZ(0)',
      }}
    >
      <Icon style={{
        height: '1.0625rem',
        width: '1.0625rem',
        flexShrink: 0,
        transition: 'color 0.15s',
      }} />
      <span style={{
        display: 'inline-block',
        maxWidth: expanded ? '8rem' : '0rem',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: T_LABEL,
      }}>
        {item.label}
      </span>
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   TopNav — floating bubbles, zero layout animations
   ═══════════════════════════════════════════════════════════════════ */
export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const suiteTier = usePFCStore((s) => s.suiteTier);

  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? (resolvedTheme === 'dark' || resolvedTheme === 'oled') : true;

  // Hide TopNav entirely on notes page — notes has its own floating UI
  const isOnNotes = pathname === '/notes';
  if (isOnNotes) return null;

  const chatMessages = usePFCStore((s) => s.messages);
  const isOnChat = pathname.startsWith('/chat') || (pathname === '/' && chatMessages.length > 0);
  const isOnAnalytics = pathname === '/analytics';

  const clearMessages = usePFCStore((s) => s.clearMessages);

  const handleNavigate = useCallback((href: string) => {
    if (href === '/') {
      // Already on landing with no messages → scroll to top
      if (pathname === '/' && chatMessages.length === 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // On chat or has messages → clear and go to landing
      clearMessages();
      if (pathname === '/' || pathname.startsWith('/chat')) {
        router.replace('/');
      } else {
        router.push('/');
      }
      return;
    }
    router.push(href);
  }, [router, clearMessages, pathname, chatMessages.length]);

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'none',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0) translateZ(0)' : 'translateY(-8px) translateZ(0)',
        transition: `opacity 0.5s ${CUP}, transform 0.5s ${CUP}`,
        contain: 'layout paint',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.375rem',
          padding: '0.625rem 1rem',
          pointerEvents: 'auto',
        }}
      >
        {/* Home / PFC Engine bubble — first item, special behavior */}
        <HomePFCBubble
          isDark={isDark}
          isOnChat={isOnChat}
          isOnHome={pathname === '/'}
          onNavigate={handleNavigate}
        />

        {/* Remaining nav items */}
        {NAV_ITEMS.slice(1).map((item) => {
          const minTier = item.minTier ?? 'notes';
          const meetsRequirement = tierMeetsMinimum(suiteTier, minTier);

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
                item.activePrefix
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
    </nav>
  );
}
