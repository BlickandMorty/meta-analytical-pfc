'use client';

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { useIsDark } from '@/hooks/use-is-dark';
import { useTypewriter } from '@/hooks/use-typewriter';
import { usePFCStore, type PFCState } from '@/lib/store/use-pfc-store';
import {
  HomeIcon,
  BarChart3Icon,
  SettingsIcon,
  BookOpenIcon,
  DownloadIcon,
  PenLineIcon,
  LibraryIcon,
  ServerIcon,
  WifiIcon,
  ActivityIcon,
  FlaskConicalIcon,
  ArchiveIcon,
  CompassIcon,
  NetworkIcon,
  MicroscopeIcon,
  BrainIcon,
  BotIcon,
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
  { href: '/library', label: 'Library', icon: LibraryIcon, group: 'core' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3Icon, minTier: 'full', group: 'tools' },
  { href: '/daemon', label: 'Daemon', icon: BotIcon, group: 'tools' },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, group: 'utility' },
];

/* ─── Analytics sub-tabs ─── */
const ANALYTICS_TABS = [
  { key: 'archive', label: 'Archive', icon: ArchiveIcon },
  { key: 'steering', label: 'Steering', icon: CompassIcon },
  { key: 'pipeline', label: 'Pipeline', icon: NetworkIcon },
  { key: 'signals', label: 'Signals', icon: ActivityIcon },
  { key: 'visualizer', label: 'Visualizer', icon: BarChart3Icon },
] as const;

function tierMeetsMinimum(current: string, minimum: TierGate): boolean {
  const ORDER: Record<string, number> = { notes: 0, programming: 1, full: 2 };
  return (ORDER[current] ?? 0) >= (ORDER[minimum] ?? 0);
}

function tierGateLabel(gate: TierGate): string {
  switch (gate) {
    case 'programming': return 'Deep Analysis';
    case 'full': return 'Full AI & Measurement';
    default: return '';
  }
}

const MODE_STYLES: Record<string, { label: string }> = {
  simulation: { label: 'Sim' },
  api: { label: 'API' },
  local: { label: 'Local' },
};

/* ─── Theming helpers ─── */
function bubbleBg(isActive: boolean, isDark: boolean, disabled?: boolean, isOled?: boolean) {
  if (disabled) return 'transparent';
  if (isActive) {
    if (isOled) return 'rgba(20,20,20,0.7)';
    return isDark ? 'rgba(16,13,10,0.75)' : 'rgba(210,195,175,0.35)';
  }
  return 'transparent';
}

function bubbleColor(isActive: boolean, isDark: boolean, disabled?: boolean, isOled?: boolean) {
  if (disabled) {
    if (isOled) return 'rgba(120,120,120,0.55)';
    return isDark ? 'rgba(170,164,152,0.55)' : 'rgba(60,45,30,0.45)';
  }
  if (isActive) {
    if (isOled) return 'rgba(220,220,220,0.95)';
    return isDark ? 'rgba(232,228,222,0.95)' : 'rgba(60,45,30,0.85)';
  }
  if (isOled) return 'rgba(180,180,180,0.92)';
  return isDark ? 'rgba(205,198,186,0.92)' : 'rgba(72,54,36,0.86)';
}

/* ═══════════════════════════════════════════════════════════════════
   NavBubble — CSS transitions only, no layout prop
   ═══════════════════════════════════════════════════════════════════ */
const NavBubble = memo(function NavBubble({
  item,
  isActive,
  isDark,
  isOled,
  onNavigate,
  disabled,
  disabledReason,
}: {
  item: NavItem;
  isActive: boolean;
  isDark: boolean;
  isOled?: boolean;
  onNavigate: (href: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  // Clear pending hover timer on unmount to prevent setState on unmounted component
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);
  const expanded = (hovered || isActive) && !disabled;
  const Icon = item.icon;

  // Typewriter effect on hover — types out label with RetroGaming font + cursor
  const { displayText: twText, cursorVisible: twCursor } = useTypewriter(
    item.label,
    hovered && !isActive && !disabled,
    { speed: 35, startDelay: 80, cursorLingerMs: 600 },
  );

  // Show typewriter text when hovering (not active), else show full label when active
  const labelText = hovered && !isActive && !disabled ? twText : (expanded ? item.label : '');
  const usePixelFont = hovered && !isActive && !disabled;

  return (
    <button
      onClick={() => !disabled && onNavigate(item.href)}
      onMouseEnter={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => setHovered(true), 120);
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setHovered(false);
      }}
      title={disabled ? `${item.label} — enable ${disabledReason} in Settings` : item.label}
      aria-label={disabled ? `${item.label} — enable ${disabledReason} in Settings` : item.label}
      aria-disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expanded ? '0.5rem' : '0rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: expanded ? '0.4375rem 0.875rem' : '0.4375rem 0.5625rem',
        height: '2.375rem',
        fontSize: usePixelFont ? '0.625rem' : '0.8125rem',
        fontWeight: isActive ? 650 : 500,
        letterSpacing: usePixelFont ? '0.01em' : '-0.01em',
        opacity: disabled ? 0.35 : 1,
        color: bubbleColor(isActive, isDark, disabled, isOled),
        background: bubbleBg(isActive, isDark, disabled, isOled),
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
        color: isActive ? 'var(--pfc-accent)' : 'inherit',
        transition: 'color 0.15s',
      }} />
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: expanded ? '8rem' : '0rem',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: T_LABEL,
        fontFamily: (usePixelFont || isActive) ? 'var(--font-heading)' : 'inherit',
        fontSize: isActive ? '0.625rem' : undefined,
      }}>
        {labelText}
        {usePixelFont && twCursor && (
          <span style={{
            display: 'inline-block',
            width: '1.5px',
            height: '0.625rem',
            backgroundColor: 'var(--pfc-accent)',
            marginLeft: '1px',
            flexShrink: 0,
          }} />
        )}
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

const HomePFCBubble = memo(function HomePFCBubble({
  isDark,
  isOled,
  isOnChat,
  isOnHome,
  onNavigate,
}: {
  isDark: boolean;
  isOled?: boolean;
  isOnChat: boolean;
  isOnHome: boolean;
  onNavigate: (href: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  const isProcessing = usePFCStore(selectIsProcessing);
  const activeStage = usePFCStore(selectActiveStage);
  const messages = usePFCStore(selectMessages);
  const inferenceMode = usePFCStore(selectInferenceMode);
  const confidence = usePFCStore(selectConfidence);

  const hasMessages = messages.length > 0;
  const modeInfo = MODE_STYLES[inferenceMode] ?? MODE_STYLES.simulation!;

  // Lab mode: on chat page with messages
  const pfcMode = isOnChat && hasMessages;
  const showLabel = hovered || pfcMode || isOnHome;

  // Typewriter on hover — only for "Home" label (not Lab Engine mode)
  const homeLabel = pfcMode ? 'Lab Engine' : 'Home';
  const shouldTypewrite = hovered && !pfcMode && !isOnHome;
  const { displayText: twText, cursorVisible: twCursor } = useTypewriter(
    homeLabel,
    shouldTypewrite,
    { speed: 35, startDelay: 80, cursorLingerMs: 600 },
  );
  const labelText = shouldTypewrite ? twText : (showLabel ? homeLabel : '');
  const usePixelFont = shouldTypewrite;

  return (
    <button
      onClick={() => onNavigate('/')}
      onMouseEnter={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => setHovered(true), 120);
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setHovered(false);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: showLabel ? '0.5rem' : '0rem',
        cursor: 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: showLabel ? '0.4375rem 0.875rem' : '0.4375rem 0.5625rem',
        height: '2.375rem',
        fontSize: usePixelFont ? '0.625rem' : '0.8125rem',
        fontWeight: (pfcMode || isOnHome) ? 650 : 500,
        letterSpacing: usePixelFont ? '0.01em' : '-0.01em',
        color: bubbleColor(pfcMode || isOnHome || hovered, isDark, false, isOled),
        background: bubbleBg(pfcMode || isOnHome, isDark, false, isOled),
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
        color: (pfcMode || isOnHome || hovered) ? 'var(--pfc-accent)' : 'inherit',
        transition: 'color 0.15s',
      }} />

      {/* Label — "Lab Engine" when in chat, "Home" otherwise */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: showLabel ? '8rem' : '0rem',
        opacity: showLabel ? 1 : 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: T_LABEL,
        fontFamily: (usePixelFont || pfcMode || isOnHome) ? 'var(--font-heading)' : 'inherit',
        fontSize: (pfcMode || isOnHome) ? '0.625rem' : undefined,
      }}>
        {labelText}
        {usePixelFont && twCursor && (
          <span style={{
            display: 'inline-block',
            width: '1.5px',
            height: '0.625rem',
            backgroundColor: 'var(--pfc-accent)',
            marginLeft: '1px',
            flexShrink: 0,
          }} />
        )}
      </span>

      {/* Lab Engine badges — only in pfcMode */}
      {pfcMode && (
        <>
          <span style={{
            width: 3, height: 3, borderRadius: '50%', flexShrink: 0,
            background: isOled ? 'rgba(140,140,140,0.25)' : isDark ? 'rgba(155,150,137,0.25)' : 'rgba(0,0,0,0.15)',
          }} />

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.125rem 0.375rem', borderRadius: '9999px',
            background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.08)' : 'rgba(var(--pfc-accent-rgb), 0.06)',
            fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
            color: isDark ? 'rgba(var(--pfc-accent-rgb), 0.7)' : 'rgba(var(--pfc-accent-rgb), 0.8)',
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
              color: isOled ? 'rgba(140,140,140,0.5)' : isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
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
                background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.08)' : 'rgba(var(--pfc-accent-rgb), 0.06)',
                fontSize: '0.5625rem', fontFamily: 'var(--font-mono)',
                color: 'var(--pfc-accent)',
              }}
            >
              <ActivityIcon style={{ height: '0.5625rem', width: '0.5625rem' }} />
              {activeStage.replace('_', '-')}
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
  isOled,
  onNavigate,
  disabled,
  disabledReason,
}: {
  item: NavItem;
  isActive: boolean;
  isDark: boolean;
  isOled?: boolean;
  onNavigate: (href: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);
  const [activeSubTab, setActiveSubTab] = useState<string>('archive');
  const Icon = item.icon;

  // Listen for active tab broadcasts from the analytics page
  useEffect(() => {
    const handler = (e: Event) => {
      setActiveSubTab((e as CustomEvent).detail as string);
    };
    window.addEventListener('pfc-analytics-active', handler);
    return () => window.removeEventListener('pfc-analytics-active', handler);
  }, []);

  // Typewriter effect on hover — must be called unconditionally (Rules of Hooks)
  const { displayText: twText, cursorVisible: twCursor } = useTypewriter(
    item.label,
    hovered && !disabled && !isActive,
    { speed: 35, startDelay: 80, cursorLingerMs: 600 },
  );

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
                padding: '0.3125rem 0.625rem',
                height: '1.75rem',
                cursor: 'pointer',
                fontFamily: isTabActive ? 'var(--font-heading)' : 'inherit',
                fontSize: isTabActive ? '0.5625rem' : '0.6875rem',
                fontWeight: isTabActive ? 400 : 500,
                letterSpacing: isTabActive ? '0.01em' : '-0.01em',
                color: isTabActive
                  ? (isOled ? 'rgba(220,220,220,0.95)' : isDark ? 'rgba(232,228,222,0.95)' : 'rgba(60,45,30,0.85)')
                  : (isOled ? 'rgba(140,140,140,0.65)' : isDark ? 'rgba(155,150,137,0.65)' : 'rgba(80,65,45,0.55)'),
                background: isTabActive
                  ? (isOled ? 'rgba(35,35,35,0.55)' : isDark ? 'rgba(55,50,45,0.55)' : 'rgba(210,195,175,0.35)')
                  : 'transparent',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                transition: `${T_SIZE}, ${T_COLOR}`,
                transform: 'translateZ(0)',
              }}
            >
              <TabIcon style={{
                height: '0.6875rem',
                width: '0.6875rem',
                flexShrink: 0,
                color: isTabActive ? 'var(--pfc-accent)' : 'inherit',
                transition: 'color 0.15s',
              }} />
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Normal collapsed state — matches NavBubble typewriter + pixel font behavior
  const expanded = hovered && !disabled;
  const labelText = expanded ? twText : '';
  const usePixelFont = expanded;

  return (
    <button
      onClick={() => !disabled && onNavigate(item.href)}
      onMouseEnter={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => setHovered(true), 120);
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setHovered(false);
      }}
      title={disabled ? `${item.label} — enable ${disabledReason} in Settings` : item.label}
      aria-label={disabled ? `${item.label} — enable ${disabledReason} in Settings` : item.label}
      aria-disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expanded ? '0.5rem' : '0rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: expanded ? '0.4375rem 0.875rem' : '0.4375rem 0.5625rem',
        height: '2.375rem',
        fontSize: usePixelFont ? '0.625rem' : '0.8125rem',
        fontWeight: 500,
        letterSpacing: usePixelFont ? '0.01em' : '-0.01em',
        opacity: disabled ? 0.35 : 1,
        color: bubbleColor(false, isDark, disabled, isOled),
        background: bubbleBg(false, isDark, disabled, isOled),
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
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: expanded ? '8rem' : '0rem',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: T_LABEL,
        fontFamily: usePixelFont ? 'var(--font-heading)' : 'inherit',
      }}>
        {labelText}
        {usePixelFont && twCursor && (
          <span style={{
            display: 'inline-block',
            width: '1.5px',
            height: '0.625rem',
            backgroundColor: 'var(--pfc-accent)',
            marginLeft: '1px',
            flexShrink: 0,
          }} />
        )}
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
  const { isDark, isOled, mounted } = useIsDark();
  const suiteTier = usePFCStore((s) => s.suiteTier);

  const chatMessages = usePFCStore((s) => s.messages);
  const clearMessages = usePFCStore((s) => s.clearMessages);
  const chatMinimized = usePFCStore((s) => s.chatMinimized);
  const setChatMinimized = usePFCStore((s) => s.setChatMinimized);

  // Derived values (after all hooks)
  const isOnNotes = pathname === '/notes';
  const isOnChat = pathname.startsWith('/chat') || (pathname === '/' && chatMessages.length > 0);
  const isOnAnalytics = pathname === '/analytics';

  const handleNavigate = useCallback((href: string) => {
    if (href === '/') {
      // Already on landing with no messages and not minimized → scroll to top
      if (pathname === '/' && chatMessages.length === 0 && !chatMinimized) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // If minimized, clicking Home expands chat back to full size
      if (chatMinimized) {
        setChatMinimized(false);
        if (pathname !== '/') router.push('/');
        return;
      }
      // Chat is active (has messages) → minimize instead of destroy
      if (chatMessages.length > 0) {
        setChatMinimized(true);
        return;
      }
      // Fallback — clear and go to landing
      clearMessages();
      if (pathname === '/' || pathname.startsWith('/chat')) {
        router.replace('/');
      } else {
        router.push('/');
      }
      return;
    }
    // Non-home navigation: minimize active chat so it persists as widget
    if (chatMessages.length > 0 && !chatMinimized) {
      setChatMinimized(true);
    }
    router.push(href);
  }, [router, clearMessages, setChatMinimized, chatMinimized, pathname, chatMessages.length]);

  // Prefetch all nav routes on mount so pages are compiled before click
  useEffect(() => {
    const routes = NAV_ITEMS.map((item) => item.href);
    // Also prefetch analytics sub-pages (standalone routes)
    const extraRoutes = [
      '/steering-lab', '/research-copilot', '/concept-atlas',
      '/cortex-archive', '/visualizer',
      '/pipeline', '/diagnostics', '/library',
    ];
    for (const route of [...routes, ...extraRoutes]) {
      router.prefetch(route);
    }
  }, [router]);

  // Notes page: show nav but skip analytics expansion logic
  // (notes has its own floating toolbar for notes-specific controls)

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 'var(--z-nav)',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0) translateZ(0)' : 'translateY(-12px) translateZ(0)',
        transition: `opacity 0.4s ease-out, transform 0.4s ease-out`,
        contain: 'layout paint',
        isolation: 'isolate',
        padding: '0.625rem 1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.1875rem',
          borderRadius: '9999px',
          padding: '0.375rem',
          pointerEvents: 'auto',
          width: 'fit-content',
          background: isOled
            ? 'rgba(8,8,8,0.85)'
            : isDark
              ? 'rgba(14,12,10,0.8)'
              : 'rgba(237,232,222,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${isOled ? 'rgba(30,30,30,0.4)' : isDark ? 'rgba(30,25,20,0.35)' : 'rgba(190,183,170,0.3)'}`,
          boxShadow: isDark
            ? '0 2px 12px -2px rgba(0,0,0,0.3)'
            : '0 2px 16px -2px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.03)',
          transform: 'translateZ(0)',
        }}
      >
        {/* Home / PFC Engine bubble — first item, special behavior */}
        <HomePFCBubble
          isDark={isDark}
          isOled={isOled}
          isOnChat={isOnChat}
          isOnHome={pathname === '/'}
          onNavigate={handleNavigate}
        />

        {/* Remaining nav items */}
        {NAV_ITEMS.slice(1).map((item) => {
          const minTier = item.minTier ?? 'notes';
          const meetsRequirement = tierMeetsMinimum(suiteTier, minTier);

          if (item.label === 'Analytics') {
            // Completely hide Analytics when not on the full/measurement tier
            if (!meetsRequirement) return null;
            return (
              <AnalyticsNavBubble
                key={item.href}
                item={item}
                isActive={isOnAnalytics}
                isDark={isDark}
                isOled={isOled}
                onNavigate={handleNavigate}
                disabled={false}
                disabledReason=""
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
              isOled={isOled}
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
