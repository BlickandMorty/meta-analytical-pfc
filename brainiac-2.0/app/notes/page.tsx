'use client';

import { useState, useEffect, useMemo, useCallback, useRef, startTransition, memo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { useIsDark } from '@/hooks/use-is-dark';
import { useTypewriter } from '@/hooks/use-typewriter';
import { ErrorBoundary } from '@/components/error-boundary';
import { spring, variants, ease } from '@/lib/motion/motion-config';
import {
  PlusIcon,
  CalendarIcon,
  PenLineIcon,
  StarIcon,
  PinIcon,
  HashIcon,
  ChevronRightIcon,
  LinkIcon,
  ClockIcon,
  BookOpenIcon,
  MaximizeIcon,
  MinimizeIcon,
  FileTextIcon,
  EyeIcon,
  PencilIcon,
  FolderOpenIcon,
  XIcon,
  MousePointerClickIcon,
  SparklesIcon,
  WrenchIcon,
  BotIcon,
  MessageSquareIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
} from 'lucide-react';
import type { NotePage, NoteBlock, PageLink } from '@/lib/notes/types';
import { PixelBook } from '@/components/pixel-book';

// ═══════════════════════════════════════════════════════════════════
// Dynamic imports — code-split heavy editor components
// ═══════════════════════════════════════════════════════════════════

function DynamicFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', opacity: 0.3,
    }}>
      <div style={{
        width: '1.5rem', height: '1.5rem', borderRadius: '50%',
        border: '2px solid currentColor', borderTopColor: 'transparent',
        animation: 'pfc-dyn-spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes pfc-dyn-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const NotesSidebar = dynamic(
  () => import('@/components/notes/notes-sidebar').then((m) => ({ default: m.NotesSidebar })),
  { ssr: false, loading: DynamicFallback },
);
const BlockEditor = dynamic(
  () => import('@/components/notes/block-editor').then((m) => ({ default: m.BlockEditor })),
  { ssr: false, loading: DynamicFallback },
);
const VaultPicker = dynamic(
  () => import('@/components/notes/vault-picker').then((m) => ({ default: m.VaultPicker })),
  { ssr: false, loading: DynamicFallback },
);
const ConceptCorrelationPanel = dynamic(
  () => import('@/components/notes/concept-panel').then((m) => ({ default: m.ConceptCorrelationPanel })),
  { ssr: false, loading: DynamicFallback },
);

// ── 60fps: Cupertino easing for CSS transitions (S-Tier only) ──
const CUP_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

// ═══════════════════════════════════════════════════════════════════
// Theme helper — consistent with sidebar
// ═══════════════════════════════════════════════════════════════════

function th(isDark: boolean, isOled = false, isCosmic = false) {
  if (isOled) {
    return {
      bg:       'var(--background)',
      text:     'rgba(220,220,220,0.95)',
      muted:    'rgba(130,130,130,0.5)',
      faint:    'rgba(130,130,130,0.25)',
      border:   'rgba(40,40,40,0.35)',
      hover:    'rgba(255,255,255,0.04)',
      accent:   'var(--pfc-accent)',
      green:    '#34D399',
      journal:  'rgba(52,211,153,0.08)',
      journalGrad: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(52,211,153,0.04))',
      pageGrad: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(139,124,246,0.04))',
      toolbarBtnBg: 'rgba(255,255,255,0.06)',
      backlinkBg: 'rgba(255,255,255,0.03)',
    };
  }
  if (isCosmic) {
    return {
      bg:       'var(--background)',
      text:     'rgba(224,220,212,0.95)',
      muted:    'rgba(123,158,199,0.55)',
      faint:    'rgba(123,158,199,0.2)',
      border:   'var(--border)',
      hover:    'var(--glass-hover)',
      accent:   'var(--pfc-accent)',
      green:    '#6DD8A8',
      journal:  'rgba(109,216,168,0.1)',
      journalGrad: 'linear-gradient(135deg, rgba(109,216,168,0.14), rgba(109,216,168,0.04))',
      pageGrad: 'linear-gradient(135deg, rgba(123,158,199,0.1), rgba(139,124,246,0.08))',
      toolbarBtnBg: 'rgba(123,158,199,0.1)',
      backlinkBg: 'rgba(123,158,199,0.06)',
    };
  }
  return {
    bg:       isDark ? 'var(--background)' : 'var(--background)',
    text:     isDark ? 'rgba(237,224,212,0.95)' : 'rgba(0,0,0,0.85)',
    muted:    isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.35)',
    faint:    isDark ? 'rgba(156,143,128,0.25)' : 'rgba(0,0,0,0.12)',
    border:   isDark ? 'rgba(79,69,57,0.3)' : 'rgba(208,196,180,0.3)',
    hover:    isDark ? 'rgba(16,13,10,0.65)' : 'rgba(0,0,0,0.03)',
    accent:   'var(--pfc-accent)',
    green:    '#34D399',
    journal:  isDark ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.06)',
    journalGrad: isDark
      ? 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(52,211,153,0.04))'
      : 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(52,211,153,0.02))',
    pageGrad: isDark
      ? 'linear-gradient(135deg, rgba(244,189,111,0.08), rgba(139,124,246,0.06))'
      : 'linear-gradient(135deg, rgba(244,189,111,0.06), rgba(139,124,246,0.04))',
    toolbarBtnBg: isDark ? 'rgba(244,189,111,0.08)' : 'rgba(0,0,0,0.05)',
    backlinkBg: isDark ? 'rgba(244,189,111,0.04)' : 'rgba(0,0,0,0.02)',
  };
}

// ═══════════════════════════════════════════════════════════════════
// NoteTitleTypewriter — types the note title with cursor, then fades
// ═══════════════════════════════════════════════════════════════════

function NoteTitleTypewriter({
  title,
  isDark,
  onClick,
}: {
  title: string;
  isDark: boolean;
  onClick: () => void;
}) {
  const { displayText, cursorVisible } = useTypewriter(title, true, {
    speed: 45,
    startDelay: 80,
    cursorLingerMs: 600,
  });

  const titleColor = 'var(--foreground)';

  return (
    <h1
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'clamp(1.25rem, 4vw, 2rem)',
        letterSpacing: '-0.01em',
        lineHeight: 1.15,
        fontWeight: 400,
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        minHeight: '2rem',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        margin: 0,
        cursor: 'text',
      }}
    >
      <span style={{ color: titleColor }}>
        {displayText}
      </span>
      {cursorVisible && (
        <span
          style={{
            display: 'inline-block',
            width: '2px',
            height: '2.75rem',
            marginLeft: '2px',
            background: 'var(--pfc-accent)',
            borderRadius: '1px',
          }}
        />
      )}
    </h1>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Backlinks Panel — SiYuan-style bottom panel showing incoming refs
// ═══════════════════════════════════════════════════════════════════

function BacklinksPanel({
  pageId,
  c,
}: {
  pageId: string;
  c: ReturnType<typeof th>;
}) {
  const getBacklinks = usePFCStore((s) => s.getBacklinks);
  const notePages = usePFCStore((s) => s.notePages);
  const setActivePage = usePFCStore((s) => s.setActivePage);

  const backlinks = useMemo(() => getBacklinks(pageId), [getBacklinks, pageId]);
  const uniqueSourcePages = useMemo(() => {
    const seen = new Set<string>();
    const result: { page: NotePage; link: PageLink }[] = [];
    for (const link of backlinks) {
      if (!seen.has(link.sourcePageId)) {
        seen.add(link.sourcePageId);
        const page = notePages.find((p: NotePage) => p.id === link.sourcePageId);
        if (page) result.push({ page, link });
      }
    }
    return result;
  }, [backlinks, notePages]);
  const [expanded, setExpanded] = useState(false);

  if (backlinks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      style={{
        marginTop: '3rem',
        padding: '1.25rem 0',
        borderTop: `1px solid ${c.border}`,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: c.muted,
          fontSize: '0.8125rem',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.02em',
          padding: 0,
        }}
      >
        <LinkIcon style={{ width: '0.75rem', height: '0.75rem' }} />
        {backlinks.length} Backlink{backlinks.length !== 1 ? 's' : ''}
        <ChevronRightIcon style={{
          width: '0.75rem',
          height: '0.75rem',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1)',
        }} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: ease.cupertino }}
            style={{ overflow: 'hidden', transform: 'translateZ(0)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.75rem' }}>
              {uniqueSourcePages.map(({ page, link }) => (
                <button
                  key={page.id}
                  onClick={() => setActivePage(page.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: c.backlinkBg,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = c.hover}
                  onMouseLeave={(e) => e.currentTarget.style.background = c.backlinkBg}
                >
                  <FileTextIcon style={{
                    width: '0.8125rem', height: '0.8125rem',
                    color: c.accent, flexShrink: 0, marginTop: '0.125rem',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.8125rem', fontWeight: 600, color: c.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {page.title}
                    </div>
                    {link.context && (
                      <div style={{
                        fontSize: '0.75rem', color: c.muted, marginTop: '0.125rem',
                        lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {link.context}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Breadcrumb — shows notebook > page path
// ═══════════════════════════════════════════════════════════════════

function Breadcrumb({
  page,
  c,
}: {
  page: NotePage;
  c: ReturnType<typeof th>;
}) {
  const noteBooks = usePFCStore((s) => s.noteBooks);

  const parentBook = useMemo(() => {
    return noteBooks.find((b) => b.pageIds.includes(page.id));
  }, [noteBooks, page.id]);

  if (!parentBook) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.375rem',
      fontSize: '0.75rem',
      fontWeight: 500,
      color: c.muted,
      fontFamily: 'var(--font-sans)',
      marginBottom: '0.5rem',
    }}>
      <BookOpenIcon style={{ width: '0.6875rem', height: '0.6875rem' }} />
      <span>{parentBook.title}</span>
      <ChevronRightIcon style={{ width: '0.6875rem', height: '0.6875rem', opacity: 0.5 }} />
      <span style={{ color: c.accent }}>{page.title}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ToolsBar — flat Material icon bar, vertically stacked
// Smooth layout animation on expand/collapse, icon-based actions
// ═══════════════════════════════════════════════════════════════════

const TOOLS_ICON_SIZE = '0.875rem';

function ToolsIconBtn({
  icon,
  label,
  isPillDark,
  isActive,
  activeColor,
  onClick,
  idx = 0,
}: {
  icon: React.ReactNode;
  label: string;
  isPillDark: boolean;
  isActive?: boolean;
  activeColor?: string;
  onClick: () => void;
  idx?: number;
}) {
  const resolvedActiveColor = activeColor ?? (isPillDark ? '#B8C0FF' : 'var(--pfc-accent)');

  return (
    <motion.button
      layout
      onClick={onClick}
      title={label}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.12, delay: idx * 0.015, ease: [0.3, 0, 0.8, 0.15] } }}
      transition={{ layout: { type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }, opacity: { duration: 0.15, delay: idx * 0.025 }, scale: { duration: 0.15, delay: idx * 0.025, ease: [0.2, 0, 0, 1] } }}
      whileTap={{ scale: 0.9 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '2rem',
        height: '2rem',
        borderRadius: '0.5rem',
        border: 'none',
        cursor: 'pointer',
        color: isActive
          ? resolvedActiveColor
          : (isPillDark ? 'rgba(255,255,255,0.55)' : 'rgba(28,27,31,0.45)'),
        background: isActive
          ? (isPillDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
          : 'transparent',
        transition: 'background 0.12s ease, color 0.12s ease',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = isPillDark
            ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
          e.currentTarget.style.color = isPillDark
            ? 'rgba(255,255,255,0.85)' : 'rgba(28,27,31,0.75)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = isPillDark
            ? 'rgba(255,255,255,0.55)' : 'rgba(28,27,31,0.45)';
        }
      }}
    >
      {icon}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Toolbar Button — reusable with spring hover
// ═══════════════════════════════════════════════════════════════════

function ToolbarBtn({
  onClick,
  title,
  isActive,
  activeColor,
  inactiveColor,
  bgColor,
  children,
}: {
  onClick: () => void;
  title: string;
  isActive?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  bgColor?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={spring.snappy}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '2.125rem',
        height: '2.125rem',
        borderRadius: '9999px',
        border: '1px solid var(--pfc-accent-border)',
        background: bgColor ?? 'rgba(var(--pfc-accent-rgb), 0.06)',
        cursor: 'pointer',
        color: isActive ? (activeColor ?? 'var(--pfc-accent)') : (inactiveColor ?? 'rgba(156,143,128,0.45)'),
        fontWeight: 700,
      }}
    >
      {children}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TabBubble — pill-shaped tab matching top-nav NavBubble pattern exactly
// Expands label on hover/active, collapses to icon+truncated title otherwise
// ═══════════════════════════════════════════════════════════════════

const TAB_CUP = 'cubic-bezier(0.32, 0.72, 0, 1)';
const TAB_T_SIZE = `padding 0.3s ${TAB_CUP}, gap 0.3s ${TAB_CUP}`;
const TAB_T_COLOR = 'background 0.15s ease, color 0.15s ease';

function tabBubbleBg(isActive: boolean, isDark: boolean, isSunny?: boolean) {
  if (isActive) return isDark ? 'rgba(var(--pfc-accent-rgb), 0.14)' : isSunny ? 'var(--secondary)' : 'rgba(255,255,255,0.2)';
  return 'transparent';
}
function tabBubbleColor(isActive: boolean, isDark: boolean, isSunny?: boolean) {
  if (isActive) return isDark ? 'var(--foreground)' : isSunny ? 'var(--foreground)' : 'rgba(255,255,255,0.97)';
  return isDark ? 'color-mix(in srgb, var(--foreground) 85%, transparent)' : isSunny ? 'color-mix(in srgb, var(--foreground) 65%, transparent)' : 'rgba(255,255,255,0.65)';
}

const TabBubble = memo(function TabBubble({
  tabId,
  title,
  icon,
  isActive,
  isDark,
  isSunny,
  onClick,
  onClose,
}: {
  tabId: string;
  title: string;
  icon?: string | null;
  isActive: boolean;
  isDark: boolean;
  isSunny?: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const expanded = hovered || isActive;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: expanded ? '0.4rem' : '0rem',
        cursor: 'pointer',
        border: 'none',
        borderRadius: '9999px',
        padding: expanded ? '0.375rem 0.625rem' : '0.375rem 0.5rem',
        height: '2.125rem',
        fontSize: '0.8125rem',
        fontWeight: isActive ? 650 : 500,
        letterSpacing: '-0.01em',
        color: tabBubbleColor(isActive, isDark, isSunny),
        background: tabBubbleBg(isActive, isDark, isSunny),
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        transition: `${TAB_T_SIZE}, ${TAB_T_COLOR}`,
        position: 'relative',
        maxWidth: expanded ? '12rem' : '2.125rem',
      }}
    >
      {icon ? (
        <span style={{ fontSize: '0.8rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      ) : (
        <FileTextIcon style={{
          height: '0.9375rem',
          width: '0.9375rem',
          flexShrink: 0,
          color: isActive ? 'var(--pfc-accent)' : 'inherit',
          transition: 'color 0.15s',
        }} />
      )}
      <span style={{
        display: 'inline-block',
        maxWidth: expanded ? '8rem' : '0rem',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: `max-width 0.3s ${TAB_CUP}, opacity 0.2s ${TAB_CUP}`,
      }}>
        {title}
      </span>
      {expanded && (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 14, height: 14, borderRadius: '50%',
            background: 'transparent', cursor: 'pointer', flexShrink: 0,
            color: isDark ? 'color-mix(in srgb, var(--foreground) 40%, transparent)' : 'rgba(0,0,0,0.3)',
            transition: 'background 0.1s',
          }}
        >
          <XIcon style={{ width: 8, height: 8, strokeWidth: 2.5 }} />
        </span>
      )}
    </button>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ToolbarStats — scoped sub-component for page stats in bottom toolbar
// Subscribes to noteBlocks internally so the main NotesPage doesn't
// re-render on every keystroke.
// ═══════════════════════════════════════════════════════════════════

const ToolbarStats = memo(function ToolbarStats({
  pageId,
  page,
  isDark,
}: {
  pageId: string;
  page: NotePage;
  isDark: boolean;
}) {
  const noteBlocks = usePFCStore((s) => s.noteBlocks);

  const stats = useMemo(() => {
    const blocks = noteBlocks.filter((b: NoteBlock) => b.pageId === pageId);
    const totalWords = blocks.reduce((acc: number, b: NoteBlock) => {
      const words = b.content.trim().split(/\s+/).filter(Boolean).length;
      return acc + words;
    }, 0);
    const blockCount = blocks.length;
    const lastUpdate = new Date(page.updatedAt);
    const timeStr = lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return { totalWords, blockCount, timeStr };
  }, [noteBlocks, pageId, page.updatedAt]);

  return (
    <>
      <span style={{
        width: 3, height: 3, borderRadius: '50%', flexShrink: 0,
        background: isDark ? 'color-mix(in srgb, var(--foreground) 18%, transparent)' : 'rgba(0,0,0,0.12)',
      }} />
      <span style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        fontSize: '0.75rem', fontWeight: 650, whiteSpace: 'nowrap',
        color: isDark ? 'color-mix(in srgb, var(--foreground) 50%, transparent)' : 'rgba(120,110,100,0.6)',
        padding: '0 0.45rem',
      }}>
        <span>{stats.totalWords} word{stats.totalWords !== 1 ? 's' : ''}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{stats.blockCount} block{stats.blockCount !== 1 ? 's' : ''}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <ClockIcon style={{ width: '0.75rem', height: '0.75rem', strokeWidth: 2.4 }} />
          {stats.timeStr}
        </span>
      </span>
    </>
  );
});


// ═══════════════════════════════════════════════════════════════════
// Main Notes Page
// ═══════════════════════════════════════════════════════════════════

export default function NotesPage() {
  const ready = useSetupGuard();
  const router = useRouter();
  const { isDark, isOled, isCosmic, isSunny, mounted } = useIsDark();
  const c = th(isDark, isOled, isCosmic);

  const learningSession = usePFCStore((s) => s.learningSession);

  // ── Store selectors ──
  const activePageId     = usePFCStore((s) => s.activePageId);
  const notePages        = usePFCStore((s) => s.notePages);
  const loadNotesFromStorage = usePFCStore((s) => s.loadNotesFromStorage);
  const createPage       = usePFCStore((s) => s.createPage);
  const renamePage       = usePFCStore((s) => s.renamePage);
  const getOrCreateTodayJournal = usePFCStore((s) => s.getOrCreateTodayJournal);
  const editingBlockId   = usePFCStore((s) => s.editingBlockId);
  const togglePageFavorite = usePFCStore((s) => s.togglePageFavorite);
  const togglePagePin    = usePFCStore((s) => s.togglePagePin);
  const setActivePage    = usePFCStore((s) => s.setActivePage);
  const openTabIds       = usePFCStore((s) => s.openTabIds);
  const closeTab         = usePFCStore((s) => s.closeTab);
  const goBack           = usePFCStore((s) => s.goBack);
  const navHistoryLen    = usePFCStore((s) => s.navigationHistory.length);

  // ── Vault system ──
  const vaults = usePFCStore((s) => s.vaults);
  const activeVaultId = usePFCStore((s) => s.activeVaultId);
  const vaultReady = usePFCStore((s) => s.vaultReady);
  const loadVaultIndex = usePFCStore((s) => s.loadVaultIndex);
  const createVault = usePFCStore((s) => s.createVault);
  const switchVault = usePFCStore((s) => s.switchVault);
  const [showVaultPicker, setShowVaultPicker] = useState(false);

  // ── Concept correlation ──
  const [correlationTarget, setCorrelationTarget] = useState<{ pageAId: string; pageBId: string } | null>(null);
  const extractConcepts = usePFCStore((s) => s.extractConcepts);

  // ── Zen mode (distraction-free) ──
  const [zenMode, setZenMode] = useState(false);

  // ── Read / Write mode ──
  const [editorMode, setEditorMode] = useState<'write' | 'read'>('write');


  // ── Floating sidebar panel ──
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelHovered, setPanelHovered] = useState(false);
  const [pagesPanelPos, setPagesPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [pagesPanelSize, setPagesPanelSize] = useState({ w: 280, h: 520 });
  const pagesPanelDragRef = useRef(false);
  const pagesPanelDragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const pagesPanelResizeRef = useRef(false);
  const pagesPanelResizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const onPagesPanelDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    pagesPanelDragRef.current = true;
    const el = (e.currentTarget as HTMLElement).closest('[data-pages-panel]') as HTMLElement;
    const rect = el?.getBoundingClientRect();
    pagesPanelDragStart.current = { mx: e.clientX, my: e.clientY, px: rect?.left ?? 0, py: rect?.top ?? 0 };
    const onMove = (ev: MouseEvent) => {
      if (!pagesPanelDragRef.current) return;
      const dx = ev.clientX - pagesPanelDragStart.current.mx;
      const dy = ev.clientY - pagesPanelDragStart.current.my;
      setPagesPanelPos({
        x: Math.max(0, Math.min(window.innerWidth - 100, pagesPanelDragStart.current.px + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, pagesPanelDragStart.current.py + dy)),
      });
    };
    const onUp = () => { pagesPanelDragRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const onPagesPanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    pagesPanelResizeRef.current = true;
    pagesPanelResizeStart.current = { x: e.clientX, y: e.clientY, w: pagesPanelSize.w, h: pagesPanelSize.h };
    const onMove = (ev: MouseEvent) => {
      if (!pagesPanelResizeRef.current) return;
      const dx = ev.clientX - pagesPanelResizeStart.current.x;
      const dy = ev.clientY - pagesPanelResizeStart.current.y;
      setPagesPanelSize({
        w: Math.max(220, Math.min(600, pagesPanelResizeStart.current.w + dx)),
        h: Math.max(300, Math.min(800, pagesPanelResizeStart.current.h + dy)),
      });
    };
    const onUp = () => { pagesPanelResizeRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pagesPanelSize]);

  // ── Right-side tools pill (collapsed → expanded) ──
  const [toolsOpen, setToolsOpen] = useState(false);

  // ── Load vault index on mount ──
  useEffect(() => {
    if (ready) {
      loadVaultIndex();
    }
  }, [ready, loadVaultIndex]);

  // ── Fix 4E: Auto-create a default vault if none exist (with guard) ──
  const creatingVaultRef = useRef(false);
  useEffect(() => {
    if (vaultReady && vaults.length === 0 && !creatingVaultRef.current) {
      creatingVaultRef.current = true;
      const id = createVault('My Notes');
      switchVault(id);
    }
  }, [vaultReady, vaults.length, createVault, switchVault]);

  // ── Load notes when vault is selected ──
  useEffect(() => {
    if (vaultReady && activeVaultId) {
      loadNotesFromStorage();
    }
  }, [vaultReady, activeVaultId, loadNotesFromStorage]);

  // ── Fix 3C: Auto-extract concepts when active page changes (with cancellation) ──
  const conceptAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (activePageId) {
      if (conceptAbortRef.current) {
        conceptAbortRef.current.abort();
      }
      const controller = new AbortController();
      conceptAbortRef.current = controller;
      if (!controller.signal.aborted) {
        extractConcepts(activePageId);
      }
    }
    return () => {
      if (conceptAbortRef.current) {
        conceptAbortRef.current.abort();
        conceptAbortRef.current = null;
      }
    };
  }, [activePageId, extractConcepts]);

  // ── Save notes on tab close / navigation away ──
  const saveNotesToStorage = usePFCStore((s) => s.saveNotesToStorage);
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveNotesToStorage();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveNotesToStorage]);

  // ── Active page ──
  const activePage = useMemo(
    () => notePages.find((p: NotePage) => p.id === activePageId) ?? null,
    [notePages, activePageId],
  );

  // ── Title editing ──
  const [editingTitlePageId, setEditingTitlePageId] = useState<string | null>(null);
  const isEditingTitle = editingTitlePageId === activePageId;
  const [titleDraft, setTitleDraft] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const handleTitleClick = useCallback(() => {
    if (!activePage) return;
    setTitleDraft(activePage.title);
    setEditingTitlePageId(activePage.id);
    requestAnimationFrame(() => titleRef.current?.select());
  }, [activePage]);

  const handleTitleCommit = useCallback(() => {
    if (!activePage) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== activePage.title) renamePage(activePage.id, trimmed);
    setEditingTitlePageId(null);
  }, [activePage, titleDraft, renamePage]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleTitleCommit(); }
    if (e.key === 'Escape') setEditingTitlePageId(null);
  }, [handleTitleCommit]);

  const handleNewPage = useCallback(() => {
    startTransition(() => {
      createPage('Untitled');
    });
    requestAnimationFrame(() => {
      setTitleDraft('Untitled');
      const currentActiveId = usePFCStore.getState().activePageId;
      if (currentActiveId) {
        setEditingTitlePageId(currentActiveId);
      }
      requestAnimationFrame(() => titleRef.current?.select());
    });
  }, [createPage]);

  // ── Keyboard shortcuts ──
  const undo = usePFCStore((s) => s.undo);
  const redo = usePFCStore((s) => s.redo);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === '\\') {
        e.preventDefault();
        setPanelOpen((v) => !v);
      }
      if (e.key === 'Escape' && panelOpen) {
        setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panelOpen, undo, redo]);

  // ── Loading state ──
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--background)' }}>
        <PixelBook size={40} />
      </div>
    );
  }

  const panelBubbleExpanded = panelHovered || panelOpen;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        paddingTop: 0,
        background: c.bg,
        overflow: 'hidden',
        contain: 'layout style',
      }}
    >
      {/* ── Background learning indicator — thin top bar ── */}
      <AnimatePresence>
        {learningSession?.status === 'running' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              zIndex: 'var(--z-modal)',
              background: isOled ? 'rgba(40,40,40,0.3)' : isDark ? 'rgba(79,69,57,0.2)' : 'rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
              style={{
                width: '40%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, var(--pfc-accent), transparent)',
                borderRadius: 1,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full-page editor area ── */}
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-page-id')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'link';
          }
        }}
        onDrop={(e) => {
          const draggedPageId = e.dataTransfer.getData('application/x-page-id');
          if (draggedPageId && activePageId && draggedPageId !== activePageId) {
            setCorrelationTarget({ pageAId: activePageId, pageBId: draggedPageId });
          }
        }}
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          willChange: 'scroll-position',
          overscrollBehavior: 'contain',
          paddingBottom: '5rem', // Space for bottom tab bar
        } as React.CSSProperties}
      >
        <AnimatePresence mode="wait">
          {activePageId && activePage && mounted ? (
              <motion.div
                key={`notes-${activePageId}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring.standard}
                style={{
                  maxWidth: zenMode ? '52rem' : (editorMode === 'read' ? '80rem' : '72rem'),
                  margin: '0 auto',
                  padding: zenMode ? '1.5rem 3.5rem 8rem' : '1.5rem 5rem 8rem 4rem',
                  transition: 'max-width 0.3s cubic-bezier(0.32,0.72,0,1), padding 0.3s cubic-bezier(0.32,0.72,0,1)',
                }}
              >
                {/* Title header */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  marginBottom: '2.5rem',
                  paddingTop: '4rem',
                }}>
                  {/* Back button — appears when navigating via [[links]] */}
                  <AnimatePresence>
                    {navHistoryLen > 0 && (
                      <motion.button
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2 }}
                        onClick={goBack}
                        title="Back to previous note"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.3rem 0.625rem',
                          borderRadius: '9999px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          letterSpacing: '-0.01em',
                          color: isDark ? 'color-mix(in srgb, var(--foreground) 65%, transparent)' : 'rgba(28,27,31,0.55)',
                          background: isDark ? 'var(--glass-hover, rgba(255,255,255,0.06))' : 'rgba(0,0,0,0.04)',
                          marginBottom: '0.625rem',
                          transition: 'background 0.15s ease, color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isDark
                            ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
                          (e.currentTarget as HTMLElement).style.color = isDark
                            ? 'var(--foreground)' : 'rgba(28,27,31,0.8)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isDark
                            ? 'var(--glass-hover, rgba(255,255,255,0.06))' : 'rgba(0,0,0,0.04)';
                          (e.currentTarget as HTMLElement).style.color = isDark
                            ? 'color-mix(in srgb, var(--foreground) 65%, transparent)' : 'rgba(28,27,31,0.55)';
                        }}
                      >
                        <ArrowLeftIcon style={{ width: '0.75rem', height: '0.75rem', strokeWidth: 2.2 }} />
                        Back
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {activePage.isJournal && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem',
                    }}>
                      <CalendarIcon style={{ width: '0.75rem', height: '0.75rem', color: c.green }} />
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 600, color: c.green,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>Journal</span>
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    minHeight: '4rem',
                  }}>
                    {isEditingTitle ? (
                      <input
                        ref={titleRef}
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={handleTitleCommit}
                        onKeyDown={handleTitleKeyDown}
                        autoFocus
                        style={{
                          fontSize: '1.875rem',
                          fontWeight: 400,
                          letterSpacing: '-0.01em',
                          lineHeight: 1.2,
                          color: c.text,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          padding: 0,
                          caretColor: c.accent,
                          fontFamily: 'var(--font-heading)',
                          textAlign: 'center',
                          maxWidth: '32rem',
                        }}
                      />
                    ) : (
                      <NoteTitleTypewriter
                        title={activePage.title}
                        isDark={isDark}
                        onClick={handleTitleClick}
                      />
                    )}
                  </div>

                  {activePage.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {activePage.tags.map((tag: string) => (
                        <motion.span
                          key={tag}
                          whileHover={{ scale: 1.05 }}
                          transition={spring.snappy}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            fontSize: '0.8125rem', fontWeight: 500,
                            color: c.muted,
                            background: isDark ? 'var(--glass-hover, rgba(255,255,255,0.06))' : 'rgba(0,0,0,0.04)',
                            borderRadius: '9999px', padding: '0.25rem 0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          <HashIcon style={{ width: '0.625rem', height: '0.625rem' }} />
                          {tag}
                        </motion.span>
                      ))}
                    </div>
                  )}
                </div>

                <ErrorBoundary fallback={
                  <div style={{ padding: 24, opacity: 0.5, fontSize: 13, textAlign: 'center' }}>
                    Editor failed to load. Try refreshing the page.
                  </div>
                }>
                  <BlockEditor pageId={activePageId} readOnly={editorMode === 'read'} bookLayout={editorMode === 'read' && !zenMode} />
                </ErrorBoundary>

                <BacklinksPanel pageId={activePageId} c={c} />
              </motion.div>
          ) : (
            /* ═══ LANDING — no active page ═══ */
            <motion.div
              key="landing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={spring.standard}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '1.5rem',
                padding: '2rem',
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.gentle, delay: 0.05 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                  textAlign: 'center',
                }}
              >
                <motion.div
                  whileHover={{ scale: 1.06 }}
                  transition={spring.snappy}
                  style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    borderRadius: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDark ? 'var(--glass-hover, rgba(255,255,255,0.04))' : 'rgba(0,0,0,0.03)',
                  }}
                >
                  <PenLineIcon style={{ width: '1.5rem', height: '1.5rem', color: c.faint }} />
                </motion.div>

                <div>
                  <h3 style={{
                    fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em',
                    color: isDark ? 'color-mix(in srgb, var(--foreground) 70%, transparent)' : 'rgba(0,0,0,0.6)', marginBottom: '0.5rem',
                  }}>
                    Notes
                  </h3>
                  <p style={{ fontSize: '1rem', color: c.muted, maxWidth: '340px', lineHeight: 1.6 }}>
                    Create a page or open today&apos;s journal to start taking notes.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <motion.button
                    onClick={handleNewPage}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    transition={spring.snappy}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.625rem 1.25rem', borderRadius: '9999px', border: 'none',
                      background: isDark ? 'rgba(52,211,153,0.12)' : isSunny ? 'rgba(52,211,153,0.12)' : '#000000',
                      color: isDark ? c.green : isSunny ? '#34D399' : 'rgba(255,255,255,0.92)', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <PlusIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                    New Page
                  </motion.button>
                  <motion.button
                    onClick={() => getOrCreateTodayJournal()}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    transition={spring.snappy}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.625rem 1.25rem', borderRadius: '9999px', border: 'none',
                      background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.12)' : isSunny ? 'rgba(var(--pfc-accent-rgb), 0.12)' : '#000000',
                      color: isDark ? c.accent : isSunny ? 'var(--pfc-accent)' : 'rgba(255,255,255,0.85)', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <CalendarIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                    Today&apos;s Journal
                  </motion.button>
                  {vaults.length > 0 && (
                    <motion.button
                      onClick={() => setShowVaultPicker(true)}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      transition={spring.snappy}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        padding: '0.625rem 1.25rem', borderRadius: '9999px', border: 'none',
                        background: isDark ? 'rgba(139,124,246,0.12)' : isSunny ? 'rgba(139,124,246,0.12)' : '#000000',
                        color: isDark ? '#A78BFA' : isSunny ? '#A78BFA' : 'rgba(255,255,255,0.75)',
                        fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <FolderOpenIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                      Vault
                    </motion.button>
                  )}
                </div>
              </motion.div>

              <WhatYouMissed isDark={isDark} c={c} />
              <RecentPagesGrid isDark={isDark} c={c} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════ VIEWPORT-FIXED UI CHROME ═══════
          These elements live OUTSIDE the scrollable container so they
          stay pinned to the viewport, not the page content.          */}

        {/* ═══ Bottom Pill Tab Bar — always visible, Chrome/Obsidian-style ═══ */}
        {mounted && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.gentle}
            style={{
              position: 'fixed',
              bottom: '0.625rem',
              left: 0,
              right: 0,
              zIndex: 'calc(var(--z-nav) + 10)',
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.125rem',
                borderRadius: '9999px',
                padding: '0.3125rem',
                pointerEvents: 'auto',
                width: 'fit-content',
                maxWidth: 'calc(100vw - 6rem)',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                background: isDark ? 'rgba(28,27,31,0.85)' : isSunny ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                border: 'none',
                boxShadow: 'none',
                backdropFilter: 'blur(20px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
              }}
            >
              {/* Tab bubbles — grow from center as tabs are added */}
              {openTabIds.map((tabId) => {
                const tabPage = notePages.find((p: NotePage) => p.id === tabId);
                if (!tabPage) return null;
                const isActive = tabId === activePageId;
                return (
                  <TabBubble
                    key={tabId}
                    tabId={tabId}
                    title={tabPage.title || 'Untitled'}
                    icon={tabPage.icon}
                    isActive={isActive}
                    isDark={isDark}
                    isSunny={isSunny}
                    onClick={() => setActivePage(tabId)}
                    onClose={() => closeTab(tabId)}
                  />
                );
              })}

              {/* New tab button — always inside the pill */}
              <motion.button
                onClick={handleNewPage}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                transition={spring.snappy}
                title="New page"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2.125rem',
                  height: '2.125rem',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isDark ? 'color-mix(in srgb, var(--foreground) 40%, transparent)' : isSunny ? 'color-mix(in srgb, var(--foreground) 40%, transparent)' : 'rgba(255,255,255,0.4)',
                  flexShrink: 0,
                  transition: 'color 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = isDark ? 'var(--pfc-accent)' : isSunny ? 'var(--pfc-accent)' : 'rgba(255,255,255,0.95)';
                  (e.currentTarget as HTMLElement).style.background = isDark
                    ? 'var(--glass-hover, rgba(255,255,255,0.06))' : isSunny ? 'var(--secondary)' : 'rgba(255,255,255,0.12)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = isDark
                    ? 'color-mix(in srgb, var(--foreground) 40%, transparent)' : isSunny ? 'color-mix(in srgb, var(--foreground) 40%, transparent)' : 'rgba(255,255,255,0.4)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <PlusIcon style={{ width: '0.875rem', height: '0.875rem', strokeWidth: 2.5 }} />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ═══ Floating Pages button — bottom-left, toggles pages panel ═══ */}
        {/* Light/sunny mode: clean BookOpen icon pill; dark modes: pixel-book GIF */}
        {mounted && (
          <motion.button
            onClick={() => {
              // Anchor the panel right above the book button each time it opens
              if (!panelOpen) {
                setPagesPanelPos({ x: 16, y: window.innerHeight - 68 - pagesPanelSize.h - 8 });
              }
              setPanelOpen((v) => !v);
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.gentle}
            title="Pages"
            aria-label="Toggle Pages panel"
            style={{
              position: 'fixed',
              bottom: 20,
              left: 20,
              zIndex: 'calc(var(--z-nav) + 10)',
              width: (isSunny || (!isDark && !isSunny)) ? 40 : 48,
              height: (isSunny || (!isDark && !isSunny)) ? 40 : 48,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: (isSunny || (!isDark && !isSunny))
                ? (panelOpen ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)')
                : (panelOpen
                  ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.15)' : 'rgba(var(--pfc-accent-rgb), 0.1)')
                  : 'transparent'),
              borderRadius: (isSunny || (!isDark && !isSunny)) ? '9999px' : '50%',
              padding: 0,
              transition: 'transform 0.2s ease, background 0.2s ease',
              animation: panelOpen ? 'none' : (isSunny || (!isDark && !isSunny)) ? 'none' : 'float-bob-pages 3s ease-in-out infinite',
              backdropFilter: (isSunny || (!isDark && !isSunny)) ? 'blur(12px) saturate(1.3)' : undefined,
              WebkitBackdropFilter: (isSunny || (!isDark && !isSunny)) ? 'blur(12px) saturate(1.3)' : undefined,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              if (isSunny || (!isDark && !isSunny)) e.currentTarget.style.background = 'rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              if (isSunny || (!isDark && !isSunny)) e.currentTarget.style.background = panelOpen ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)';
            }}
          >
            {(isSunny || (!isDark && !isSunny)) ? (
              <BookOpenIcon style={{
                width: 18,
                height: 18,
                color: panelOpen ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
                transition: 'color 0.15s ease',
                strokeWidth: 1.75,
              }} />
            ) : (
              <img
                src="/pixel-book.gif"
                alt="Pages"
                draggable={false}
                style={{
                  width: 36,
                  height: 36,
                  imageRendering: 'pixelated',
                  pointerEvents: 'none',
                  filter: panelOpen ? 'brightness(1.2)' : 'none',
                }}
              />
            )}
            {panelOpen && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--pfc-accent)',
                boxShadow: '0 0 6px 2px rgba(var(--pfc-accent-rgb), 0.4)',
              }} />
            )}
          </motion.button>
        )}

        {/* ═══ Right-side Tools Bar — flat Material icon bar (hidden on landing) ═══ */}
        {mounted && activePageId && (
          <div style={{
            position: 'fixed',
            right: '0.625rem',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 'calc(var(--z-nav) + 10)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <motion.div
              layout
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ layout: { type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }, opacity: { duration: 0.15 } }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.125rem',
                borderRadius: '0.75rem',
                padding: '0.25rem',
                background: isDark
                  ? 'rgba(28,27,31,0.85)'
                  : isSunny ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                border: 'none',
                backdropFilter: 'blur(20px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                boxShadow: 'none',
              }}
            >
              {/* Wrench toggle — always visible, opens/closes extra tools */}
              <motion.button
                layout
                onClick={() => setToolsOpen((v) => !v)}
                title="Utilities"
                whileTap={{ scale: 0.9 }}
                transition={{ layout: { type: 'spring', stiffness: 500, damping: 35, mass: 0.8 } }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  background: toolsOpen
                    ? (!isSunny ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                    : 'transparent',
                  color: toolsOpen
                    ? (!isSunny ? '#B8C0FF' : 'var(--pfc-accent)')
                    : (!isSunny ? 'rgba(255,255,255,0.55)' : 'rgba(28,27,31,0.45)'),
                  transition: 'background 0.12s ease, color 0.12s ease, transform 0.2s cubic-bezier(0.32,0.72,0,1)',
                  transform: toolsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                <WrenchIcon style={{ width: TOOLS_ICON_SIZE, height: TOOLS_ICON_SIZE }} />
              </motion.button>

              {/* Divider + tool icons — animate in/out together */}
              <AnimatePresence>
                {toolsOpen && activePage && (
                  <>
                    <motion.div
                      layout
                      key="tools-divider"
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0, scaleX: 0, transition: { duration: 0.06, ease: [0.3, 0, 0.8, 0.15] } }}
                      transition={{ layout: { type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }, opacity: { duration: 0.12 }, scaleX: { duration: 0.12, ease: [0.2, 0, 0, 1] } }}
                      style={{
                        width: '1rem',
                        height: '1px',
                        background: !isSunny ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        margin: '0.0625rem 0',
                      }}
                    />
                    <ToolsIconBtn
                      key="home"
                      idx={0}
                      icon={<ArrowLeftIcon style={{ width: TOOLS_ICON_SIZE, height: TOOLS_ICON_SIZE }} />}
                      label="Home"
                      isPillDark={!isSunny}
                      onClick={() => setActivePage(null)}
                    />
                    <ToolsIconBtn
                      key="fav"
                      idx={1}
                      icon={<StarIcon style={{ width: TOOLS_ICON_SIZE, height: TOOLS_ICON_SIZE, fill: activePage.favorite ? '#FBBF24' : 'none' }} />}
                      label={activePage.favorite ? 'Unfavorite' : 'Favorite'}
                      isPillDark={!isSunny}
                      isActive={activePage.favorite}
                      activeColor="#FBBF24"
                      onClick={() => togglePageFavorite(activePage.id)}
                    />
                    <ToolsIconBtn
                      key="pin"
                      idx={2}
                      icon={<PinIcon style={{ width: TOOLS_ICON_SIZE, height: TOOLS_ICON_SIZE, transform: activePage.pinned ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform 0.15s ease' }} />}
                      label={activePage.pinned ? 'Unpin' : 'Pin'}
                      isPillDark={!isSunny}
                      isActive={activePage.pinned}
                      onClick={() => togglePagePin(activePage.id)}
                    />
                    <ToolsIconBtn
                      key="rw"
                      idx={3}
                      icon={editorMode === 'write'
                        ? <EyeIcon style={{ width: TOOLS_ICON_SIZE, height: TOOLS_ICON_SIZE }} />
                        : <PencilIcon style={{ width: TOOLS_ICON_SIZE, height: TOOLS_ICON_SIZE }} />}
                      label={editorMode === 'write' ? 'Read' : 'Write'}
                      isPillDark={!isSunny}
                      isActive
                      activeColor={editorMode === 'read' ? c.green : undefined}
                      onClick={() => setEditorMode((m) => m === 'write' ? 'read' : 'write')}
                    />
                    <ToolsIconBtn
                      key="zen"
                      idx={4}
                      icon={zenMode
                        ? <MinimizeIcon style={{ width: TOOLS_ICON_SIZE, height: TOOLS_ICON_SIZE }} />
                        : <MaximizeIcon style={{ width: TOOLS_ICON_SIZE, height: TOOLS_ICON_SIZE }} />}
                      label={zenMode ? 'Exit Zen' : 'Zen'}
                      isPillDark={!isSunny}
                      isActive={zenMode}
                      onClick={() => setZenMode((v) => !v)}
                    />
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        {/* ═══ Floating Notes Panel — chat-box styled, draggable, resizable ═══ */}
        <AnimatePresence>
          {panelOpen && mounted && (
            <motion.div
              key="notes-panel"
              data-pages-panel
              initial={{ opacity: 0, scale: 0.88, y: -12, x: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: -12, x: -12 }}
              transition={{
                duration: 0.32,
                ease: [0.32, 0.72, 0, 1],
                opacity: { duration: 0.22 },
              }}
              style={{
                position: 'fixed',
                ...(pagesPanelPos
                  ? { top: pagesPanelPos.y, left: pagesPanelPos.x, right: 'auto' }
                  : { bottom: 76, left: 16, top: 'auto' }),
                width: pagesPanelSize.w,
                height: pagesPanelSize.h,
                maxHeight: 'calc(100vh - 96px)',
                display: 'flex',
                flexDirection: 'column',
                background: isDark ? '#1C1B1F' : '#FFFBFE',
                border: 'none',
                borderRadius: '1.25rem',
                boxShadow: 'none',
                overflow: 'hidden',
                zIndex: 'var(--z-sidebar)',
              }}
            >
              {/* Draggable header */}
              <div
                onMouseDown={onPagesPanelDragStart}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.6rem 0.35rem 0.75rem',
                  borderBottom: `1px solid ${isOled ? 'rgba(40,40,40,0.2)' : isDark ? 'rgba(79,69,57,0.15)' : 'rgba(208,196,180,0.2)'}`,
                  flexShrink: 0,
                  cursor: 'grab',
                }}
              >
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  color: isDark ? 'color-mix(in srgb, var(--foreground) 35%, transparent)' : 'rgba(0,0,0,0.28)',
                }}>
                  Pages
                </span>
                <motion.button
                  onClick={() => setPanelOpen(false)}
                  whileTap={{ scale: 0.92 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: isDark ? 'color-mix(in srgb, var(--foreground) 40%, transparent)' : 'rgba(0,0,0,0.3)',
                  }}
                >
                  <XIcon style={{ width: 12, height: 12 }} />
                </motion.button>
              </div>
              {/* Sidebar content */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                <NotesSidebar />
              </div>
              {/* Resize handle — bottom-right corner */}
              <div
                onMouseDown={onPagesPanelResizeStart}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 18,
                  height: 18,
                  cursor: 'nwse-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.25 }}>
                  <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke={isDark ? '#fff' : '#000'} strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vault picker overlay */}
        {showVaultPicker && mounted && (
          <VaultPicker onClose={() => setShowVaultPicker(false)} />
        )}

        {/* Concept correlation panel */}
        <AnimatePresence>
          {correlationTarget && (
            <ConceptCorrelationPanel
              pageAId={correlationTarget.pageAId}
              pageBId={correlationTarget.pageBId}
              onClose={() => setCorrelationTarget(null)}
            />
          )}
        </AnimatePresence>

        {/* Floating Pages GIF animation */}
        <style>{`
          @keyframes float-bob-pages {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
        `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Recent Pages Grid — shown on landing page
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// ██ WHAT YOU MISSED — Daily digest of agent + AI activity
// ═══════════════════════════════════════════════════════════════════

interface DaemonDigestEvent {
  id: number;
  event_type: string;
  task_name: string | null;
  payload: string | null;
  created_at: string;
}

function WhatYouMissed({
  isDark,
  c,
}: {
  isDark: boolean;
  c: ReturnType<typeof th>;
}) {
  const [events, setEvents] = useState<DaemonDigestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Fetch daemon events from the last 24 hours
  useEffect(() => {
    let cancelled = false;
    async function fetchDigest() {
      try {
        const res = await fetch('/api/daemon?endpoint=events&limit=20');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          // Filter to events from last 24h
          const cutoff = Date.now() - 86400000;
          const recent = data.filter((e: DaemonDigestEvent) => {
            const ts = typeof e.created_at === 'string'
              ? new Date(e.created_at).getTime()
              : Number(e.created_at);
            return ts > cutoff;
          });
          setEvents(recent);
        }
      } catch {
        // Daemon not running or no events — that's fine
      }
      if (!cancelled) setLoading(false);
    }
    fetchDigest();
    return () => { cancelled = true; };
  }, []);

  // Parse event payloads for display
  const digest = useMemo(() => {
    const items: { icon: 'agent' | 'chat' | 'alert'; title: string; detail: string; time: string }[] = [];

    for (const evt of events) {
      if (evt.event_type === 'task_complete' && evt.task_name) {
        let result = '';
        if (evt.payload) {
          try {
            const p = JSON.parse(evt.payload);
            result = p.result || p.summary || '';
          } catch {
            result = evt.payload;
          }
        }
        const taskLabel = evt.task_name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        items.push({
          icon: 'agent',
          title: taskLabel,
          detail: result.slice(0, 200) || 'Task completed',
          time: formatTimeAgo(evt.created_at),
        });
      } else if (evt.event_type === 'task_error' && evt.task_name) {
        items.push({
          icon: 'alert',
          title: `${evt.task_name.replace(/-/g, ' ')} — Error`,
          detail: evt.payload ? (tryParseField(evt.payload, 'error') || evt.payload).slice(0, 150) : 'Unknown error',
          time: formatTimeAgo(evt.created_at),
        });
      }
    }

    return items;
  }, [events]);

  if (loading || digest.length === 0) return null;

  const visible = expanded ? digest : digest.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.gentle, delay: 0.12 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginTop: '1.5rem',
        width: '100%',
        maxWidth: '28rem',
      }}
    >
      <span style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: c.faint,
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
      }}>
        <SparklesIcon style={{ width: '0.75rem', height: '0.75rem' }} />
        What You Missed
      </span>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
      }}>
        {visible.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring.gentle, delay: 0.05 * i }}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.625rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.875rem',
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: 'none',
            }}
          >
            <div style={{
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '0.0625rem',
              background: item.icon === 'agent'
                ? isDark ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.1)'
                : item.icon === 'alert'
                ? isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)'
                : isDark ? 'rgba(139,124,246,0.12)' : 'rgba(139,124,246,0.1)',
            }}>
              {item.icon === 'agent' && <BotIcon style={{ width: '0.8125rem', height: '0.8125rem', color: c.green }} />}
              {item.icon === 'chat' && <MessageSquareIcon style={{ width: '0.8125rem', height: '0.8125rem', color: '#8B7CF6' }} />}
              {item.icon === 'alert' && <AlertCircleIcon style={{ width: '0.8125rem', height: '0.8125rem', color: '#EF4444' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c.text }}>{item.title}</span>
                <span style={{ fontSize: '0.625rem', color: c.faint }}>{item.time}</span>
              </div>
              <p style={{
                fontSize: '0.6875rem',
                color: c.muted,
                lineHeight: 1.5,
                marginTop: '0.125rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {item.detail}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {digest.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: '0.6875rem',
            color: c.faint,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: '0.25rem 0',
            textAlign: 'center',
          }}
        >
          {expanded ? 'Show less' : `Show ${digest.length - 3} more`}
        </button>
      )}
    </motion.div>
  );
}

function formatTimeAgo(ts: string | number): string {
  const ms = typeof ts === 'string' ? Date.now() - new Date(ts).getTime() : Date.now() - ts;
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

function tryParseField(json: string, field: string): string {
  try { return JSON.parse(json)[field] || ''; } catch { return ''; }
}

// ═══════════════════════════════════════════════════════════════════
// ██ RECENT PAGES GRID
// ═══════════════════════════════════════════════════════════════════

function RecentPagesGrid({
  isDark,
  c,
}: {
  isDark: boolean;
  c: ReturnType<typeof th>;
}) {
  const notePages = usePFCStore((s) => s.notePages);
  const setActivePage = usePFCStore((s) => s.setActivePage);

  const recentPages = useMemo(
    () => notePages
      .sort((a: NotePage, b: NotePage) => b.updatedAt - a.updatedAt)
      .slice(0, 6),
    [notePages],
  );

  if (recentPages.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.gentle, delay: 0.15 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        marginTop: '1.5rem',
        width: '100%',
        maxWidth: '28rem',
      }}
    >
      <span style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: c.faint,
      }}>
        Recent
      </span>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))',
        gap: '0.5rem',
        width: '100%',
      }}>
        {recentPages.map((page: NotePage) => (
          <motion.button
            key={page.id}
            onClick={() => setActivePage(page.id)}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.025)';
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.25rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.875rem',
              border: 'none',
              background: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.025)',
              cursor: 'pointer',
              textAlign: 'left',
              minHeight: '3.5rem',
              transition: 'background 0.18s ease',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              width: '100%',
            }}>
              {page.icon ? (
                <span style={{ fontSize: '0.75rem' }}>{page.icon}</span>
              ) : page.isJournal ? (
                <CalendarIcon style={{ width: '0.6875rem', height: '0.6875rem', color: c.green, flexShrink: 0 }} />
              ) : (
                <FileTextIcon style={{ width: '0.6875rem', height: '0.6875rem', color: c.accent, flexShrink: 0 }} />
              )}
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: c.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
              }}>
                {page.title}
              </span>
            </div>
            <span style={{
              fontSize: '0.625rem',
              color: c.faint,
              fontWeight: 500,
            }}>
              {formatRelativeTime(page.updatedAt)}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
