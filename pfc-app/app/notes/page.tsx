'use client';

import { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { useTheme } from 'next-themes';
import { spring, variants, ease } from '@/lib/motion/motion-config';
import {
  PanelLeftIcon,
  PlusIcon,
  CalendarIcon,
  PenLineIcon,
  StarIcon,
  PinIcon,
  HashIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  LinkIcon,
  ClockIcon,
  TypeIcon,
  MoreHorizontalIcon,
  BookOpenIcon,
  SparklesIcon,
  MaximizeIcon,
  MinimizeIcon,
  FileTextIcon,
  EyeIcon,
  PencilIcon,
} from 'lucide-react';
import type { NotePage, NoteBlock, PageLink } from '@/lib/notes/types';
import { PixelBook } from '@/components/pixel-book';

// ═══════════════════════════════════════════════════════════════════
// Dynamic imports — code-split heavy editor components
// ═══════════════════════════════════════════════════════════════════

const NotesSidebar = dynamic(
  () => import('@/components/notes/notes-sidebar').then((m) => ({ default: m.NotesSidebar })),
  { ssr: false },
);
const BlockEditor = dynamic(
  () => import('@/components/notes/block-editor').then((m) => ({ default: m.BlockEditor })),
  { ssr: false },
);
const NoteAIChat = dynamic(
  () => import('@/components/notes/note-ai-chat').then((m) => ({ default: m.NoteAIChat })),
  { ssr: false },
);
const LearningPanel = dynamic(
  () => import('@/components/notes/learning-panel').then((m) => ({ default: m.LearningPanel })),
  { ssr: false },
);

// ═══════════════════════════════════════════════════════════════════
// Theme helper — consistent with sidebar
// ═══════════════════════════════════════════════════════════════════

function th(isDark: boolean) {
  return {
    bg:       isDark ? 'var(--background)' : 'var(--background)',
    text:     isDark ? 'rgba(237,224,212,0.95)' : 'rgba(0,0,0,0.85)',
    muted:    isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.35)',
    faint:    isDark ? 'rgba(156,143,128,0.25)' : 'rgba(0,0,0,0.12)',
    border:   isDark ? 'rgba(79,69,57,0.3)' : 'rgba(208,196,180,0.3)',
    hover:    isDark ? 'rgba(244,189,111,0.06)' : 'rgba(0,0,0,0.03)',
    accent:   '#C4956A',
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
// NoteTitleTypewriter — types the note title with code syntax preview
// One-shot: code variation → plain title, cursor fades after
// ═══════════════════════════════════════════════════════════════════

interface TitleVariation {
  plain: string;
  spans: { text: string; color: string }[];
  isCode: boolean;
}

function buildVariations(title: string): TitleVariation[] {
  return [
    {
      plain: `# ${title}`,
      spans: [
        { text: '# ', color: '#86EFAC' },
        { text: title, color: '#86EFAC' },
      ],
      isCode: true,
    },
    {
      plain: `const title = "${title}"`,
      spans: [
        { text: 'const', color: '#C4B5FD' },
        { text: ' title ', color: '#22D3EE' },
        { text: '= ', color: '#9CA3AF' },
        { text: `"${title}"`, color: '#4ADE80' },
      ],
      isCode: true,
    },
    {
      plain: title,
      spans: [{ text: title, color: 'inherit' }],
      isCode: false,
    },
  ];
}

function NoteTitleTypewriter({
  title,
  isDark,
  onClick,
}: {
  title: string;
  isDark: boolean;
  onClick: () => void;
}) {
  const [displayText, setDisplayText] = useState('');
  const [cursorOn, setCursorOn] = useState(true);
  const [variationIdx, setVariationIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [cursorOpacity, setCursorOpacity] = useState(1);
  const stateRef = useRef({
    variation: 0,
    charIdx: 0,
    phase: 'typing' as 'typing' | 'pausing' | 'deleting' | 'done',
  });
  const variations = useMemo(() => buildVariations(title), [title]);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    stateRef.current = { variation: 0, charIdx: 0, phase: 'typing' };
    setDisplayText('');
    setVariationIdx(0);
    setDone(false);
    setCursorOpacity(1);

    let timer: ReturnType<typeof setTimeout>;
    const totalVariations = variations.length;

    function tick() {
      const s = stateRef.current;
      const target = variations[s.variation].plain;
      const isLast = s.variation === totalVariations - 1;

      if (s.phase === 'typing') {
        if (s.charIdx < target.length) {
          s.charIdx++;
          setDisplayText(target.slice(0, s.charIdx));
          setVariationIdx(s.variation);
          timer = setTimeout(tick, isLast ? 45 : 30);
        } else {
          s.phase = 'pausing';
          timer = setTimeout(tick, isLast ? 600 : 1200);
        }
      } else if (s.phase === 'pausing') {
        if (isLast) {
          s.phase = 'done';
          setDone(true);
          let fade = 1;
          const fadeInterval = setInterval(() => {
            fade -= 0.08;
            if (fade <= 0) { clearInterval(fadeInterval); setCursorOpacity(0); }
            else setCursorOpacity(fade);
          }, 50);
        } else {
          s.phase = 'deleting';
          tick();
        }
      } else if (s.phase === 'deleting') {
        if (s.charIdx > 0) {
          s.charIdx--;
          setDisplayText(variations[s.variation].plain.slice(0, s.charIdx));
          timer = setTimeout(tick, 15);
        } else {
          s.variation++;
          s.phase = 'typing';
          setVariationIdx(s.variation);
          timer = setTimeout(tick, 350);
        }
      }
    }

    timer = setTimeout(tick, 80);
    return () => clearTimeout(timer);
  }, [title, variations]);

  const v = variations[variationIdx];
  const isCode = v?.isCode ?? false;

  const coloredOutput = useMemo(() => {
    if (!v) return [];
    let remaining = displayText.length;
    const spans: { text: string; color: string }[] = [];
    for (const seg of v.spans) {
      if (remaining <= 0) break;
      const chars = Math.min(remaining, seg.text.length);
      spans.push({ text: seg.text.slice(0, chars), color: seg.color });
      remaining -= chars;
    }
    return spans;
  }, [displayText, v]);

  const titleColor = isDark ? 'rgba(237,224,212,0.95)' : 'rgba(0,0,0,0.85)';

  return (
    <h1
      onClick={onClick}
      style={{
        fontFamily: isCode ? 'var(--font-mono)' : 'var(--font-display)',
        fontSize: isCode ? '1.75rem' : '3rem',
        letterSpacing: isCode ? '0em' : '-0.035em',
        lineHeight: 1.15,
        fontWeight: isCode ? 400 : 700,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        minHeight: '3.5rem',
        display: 'flex',
        alignItems: 'center',
        margin: 0,
        cursor: 'text',
        transition: 'font-size 0.3s cubic-bezier(0.32,0.72,0,1), font-weight 0.3s cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      {coloredOutput.map((span, i) => (
        <span key={i} style={{ color: span.color === 'inherit' ? titleColor : span.color }}>
          {span.text}
        </span>
      ))}
      {cursorOpacity > 0 && (
        <span
          style={{
            display: 'inline-block',
            width: '2px',
            height: isCode ? '1.75rem' : '2.75rem',
            marginLeft: '2px',
            background: '#C4956A',
            opacity: cursorOn ? cursorOpacity : 0,
            transition: 'height 0.3s cubic-bezier(0.32,0.72,0,1)',
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
  const [expanded, setExpanded] = useState(false);

  if (backlinks.length === 0) return null;

  // Deduplicate by source page
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
            style={{ overflow: 'hidden' }}
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
// Page Stats — word count, block count, updated time
// ═══════════════════════════════════════════════════════════════════

function PageStats({
  pageId,
  page,
  c,
}: {
  pageId: string;
  page: NotePage;
  c: ReturnType<typeof th>;
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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      fontSize: '0.6875rem',
      color: c.faint,
      fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      paddingTop: '1.5rem',
    }}>
      <span>{stats.totalWords} word{stats.totalWords !== 1 ? 's' : ''}</span>
      <span>{stats.blockCount} block{stats.blockCount !== 1 ? 's' : ''}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <ClockIcon style={{ width: '0.625rem', height: '0.625rem' }} />
        {stats.timeStr}
      </span>
    </div>
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
        width: '1.75rem',
        height: '1.75rem',
        borderRadius: '9999px',
        border: 'none',
        background: bgColor ?? 'transparent',
        cursor: 'pointer',
        color: isActive ? (activeColor ?? '#C4956A') : (inactiveColor ?? 'rgba(156,143,128,0.3)'),
      }}
    >
      {children}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sidebar Dimensions
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 420;

// ═══════════════════════════════════════════════════════════════════
// Main Notes Page
// ═══════════════════════════════════════════════════════════════════

export default function NotesPage() {
  const ready = useSetupGuard();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const c = th(isDark);

  // ── Store selectors ──
  const activePageId     = usePFCStore((s) => s.activePageId);
  const notePages        = usePFCStore((s) => s.notePages);
  const notesSidebarOpen = usePFCStore((s) => s.notesSidebarOpen);
  const toggleNotesSidebar = usePFCStore((s) => s.toggleNotesSidebar);
  const loadNotesFromStorage = usePFCStore((s) => s.loadNotesFromStorage);
  const createPage       = usePFCStore((s) => s.createPage);
  const renamePage       = usePFCStore((s) => s.renamePage);
  const getOrCreateTodayJournal = usePFCStore((s) => s.getOrCreateTodayJournal);
  const editingBlockId   = usePFCStore((s) => s.editingBlockId);
  const togglePageFavorite = usePFCStore((s) => s.togglePageFavorite);
  const togglePagePin    = usePFCStore((s) => s.togglePagePin);
  const setActivePage    = usePFCStore((s) => s.setActivePage);

  // ── Zen mode (distraction-free) ──
  const [zenMode, setZenMode] = useState(false);

  // ── Read / Write mode ──
  const [editorMode, setEditorMode] = useState<'write' | 'read'>('write');

  // ── Resizable sidebar ──
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, ev.clientX));
      setSidebarWidth(newWidth);
    };

    const handleUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, []);

  // ── Load notes ──
  useEffect(() => {
    if (ready) loadNotesFromStorage();
  }, [ready, loadNotesFromStorage]);

  // ── Active page ──
  const activePage = useMemo(
    () => notePages.find((p: NotePage) => p.id === activePageId) ?? null,
    [notePages, activePageId],
  );

  // ── Title editing ──
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => setIsEditingTitle(false), [activePageId]);

  const handleTitleClick = useCallback(() => {
    if (!activePage) return;
    setTitleDraft(activePage.title);
    setIsEditingTitle(true);
    requestAnimationFrame(() => titleRef.current?.select());
  }, [activePage]);

  const handleTitleCommit = useCallback(() => {
    if (!activePage) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== activePage.title) renamePage(activePage.id, trimmed);
    setIsEditingTitle(false);
  }, [activePage, titleDraft, renamePage]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleTitleCommit(); }
    if (e.key === 'Escape') setIsEditingTitle(false);
  }, [handleTitleCommit]);

  const handleNewPage = useCallback(() => {
    // Use startTransition to keep sidebar animation smooth
    startTransition(() => {
      createPage('Untitled');
    });
    requestAnimationFrame(() => {
      setTitleDraft('Untitled');
      setIsEditingTitle(true);
      requestAnimationFrame(() => titleRef.current?.select());
    });
  }, [createPage]);

  // ── Keyboard shortcut: Cmd+\ for sidebar ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleNotesSidebar();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleNotesSidebar]);

  // ── Loading state ──
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--background)' }}>
        <PixelBook size={40} />
      </div>
    );
  }

  const showSidebar = mounted && notesSidebarOpen && !zenMode;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: c.bg,
        overflow: 'hidden',
        paddingTop: '3rem',
        contain: 'layout style',
      }}
    >
      {/* ── Sidebar ── */}
      <AnimatePresence mode="popLayout">
        {showSidebar && (
          <motion.div
            key="sidebar"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: sidebarWidth }}
            exit={{ opacity: 0, width: 0 }}
            transition={spring.settle}
            style={{
              position: 'relative',
              flexShrink: 0,
              overflow: 'hidden',
              contain: 'layout paint',
            }}
          >
            <NotesSidebar />
            {/* Resize handle */}
            <div
              onMouseDown={handleResizeStart}
              style={{
                position: 'absolute',
                top: 0,
                right: -2,
                width: 5,
                height: '100%',
                cursor: 'col-resize',
                zIndex: 10,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          background: c.bg,
          contain: 'layout style',
        }}
      >
        {/* ── Toolbar ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.5rem',
            borderBottom: `1px solid ${c.border}`,
            flexShrink: 0,
            contain: 'layout style',
          }}
        >
          {/* Sidebar toggle */}
          <ToolbarBtn
            onClick={toggleNotesSidebar}
            title="Toggle sidebar (Cmd+\\)"
            bgColor={c.toolbarBtnBg}
            activeColor={c.muted}
            inactiveColor={c.muted}
            isActive
          >
            <PanelLeftIcon style={{ width: '1rem', height: '1rem' }} />
          </ToolbarBtn>

          {/* Page nav breadcrumb */}
          {activePage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              color: c.muted,
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
            }}>
              {activePage.isJournal && (
                <>
                  <CalendarIcon style={{ width: '0.6875rem', height: '0.6875rem', color: c.green }} />
                  <span style={{ color: c.green }}>Journal</span>
                  <ChevronRightIcon style={{ width: '0.625rem', height: '0.625rem', opacity: 0.4 }} />
                </>
              )}
              <span style={{
                maxWidth: '12rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {activePage.title}
              </span>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Page actions */}
          {activePage && (
            <>
              <ToolbarBtn
                onClick={() => togglePageFavorite(activePage.id)}
                title={activePage.favorite ? 'Remove from favorites' : 'Favorite'}
                activeColor="#FBBF24"
                isActive={activePage.favorite}
              >
                <StarIcon style={{
                  width: '0.8rem', height: '0.8rem',
                  fill: activePage.favorite ? '#FBBF24' : 'none',
                }} />
              </ToolbarBtn>
              <ToolbarBtn
                onClick={() => togglePagePin(activePage.id)}
                title={activePage.pinned ? 'Unpin' : 'Pin'}
                isActive={activePage.pinned}
              >
                <PinIcon style={{ width: '0.8rem', height: '0.8rem' }} />
              </ToolbarBtn>
            </>
          )}

          {/* Read / Write mode toggle */}
          <ToolbarBtn
            onClick={() => setEditorMode((m) => m === 'write' ? 'read' : 'write')}
            title={editorMode === 'write' ? 'Switch to read mode' : 'Switch to write mode'}
            isActive
            activeColor={editorMode === 'read' ? c.green : c.accent}
            bgColor={editorMode === 'read'
              ? (isDark ? 'rgba(52,211,153,0.1)' : 'rgba(52,211,153,0.08)')
              : c.toolbarBtnBg}
          >
            {editorMode === 'read'
              ? <EyeIcon style={{ width: '0.8rem', height: '0.8rem' }} />
              : <PencilIcon style={{ width: '0.8rem', height: '0.8rem' }} />
            }
          </ToolbarBtn>

          {/* Zen mode toggle */}
          <ToolbarBtn
            onClick={() => setZenMode((v) => !v)}
            title={zenMode ? 'Exit zen mode' : 'Zen mode'}
            isActive={zenMode}
            activeColor={c.accent}
          >
            {zenMode
              ? <MinimizeIcon style={{ width: '0.8rem', height: '0.8rem' }} />
              : <MaximizeIcon style={{ width: '0.8rem', height: '0.8rem' }} />
            }
          </ToolbarBtn>

          {/* New page */}
          <ToolbarBtn
            onClick={handleNewPage}
            title="New page"
            bgColor={isDark ? 'rgba(52,211,153,0.1)' : 'rgba(52,211,153,0.08)'}
            activeColor={c.green}
            isActive
          >
            <PlusIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          </ToolbarBtn>

          {/* Today's journal */}
          <ToolbarBtn
            onClick={() => getOrCreateTodayJournal()}
            title="Today's journal"
            bgColor={isDark ? 'rgba(244,189,111,0.1)' : 'rgba(244,189,111,0.08)'}
            activeColor={c.accent}
            isActive
          >
            <CalendarIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          </ToolbarBtn>
        </div>

        {/* ── Editor area ── */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <AnimatePresence mode="wait">
            {activePageId && activePage && mounted ? (
              <motion.div
                key={activePageId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring.standard}
                style={{
                  maxWidth: zenMode ? '42rem' : '52rem',
                  margin: '0 auto',
                  padding: zenMode ? '4rem 2rem 8rem' : '3rem 4rem 8rem',
                  transition: 'max-width 0.3s cubic-bezier(0.32,0.72,0,1), padding 0.3s cubic-bezier(0.32,0.72,0,1)',
                }}
              >
                {/* Notebook breadcrumb */}
                <Breadcrumb page={activePage} c={c} />

                {/* Title header — centered with book GIF */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  marginBottom: '2.5rem',
                  paddingTop: '0.5rem',
                }}>
                  {/* Journal badge */}
                  {activePage.isJournal && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem',
                    }}>
                      <CalendarIcon style={{ width: '0.875rem', height: '0.875rem', color: c.green }} />
                      <span style={{
                        fontSize: '0.8125rem', fontWeight: 600, color: c.green,
                        letterSpacing: '0.03em', textTransform: 'uppercase',
                      }}>Journal</span>
                    </div>
                  )}

                  {/* Tags */}
                  {activePage.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {activePage.tags.map((tag: string) => (
                        <motion.span
                          key={tag}
                          whileHover={{ scale: 1.05 }}
                          transition={spring.snappy}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            fontSize: '0.8125rem', fontWeight: 500,
                            color: c.muted,
                            background: isDark ? 'rgba(244,189,111,0.08)' : 'rgba(0,0,0,0.04)',
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

                  {/* Title row — book GIF + title centered */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                  }}>
                    <PixelBook size={48} />

                    {/* Title — editable always, typewriter only in read mode */}
                    {isEditingTitle ? (
                      <input
                        ref={titleRef}
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={handleTitleCommit}
                        onKeyDown={handleTitleKeyDown}
                        autoFocus
                        style={{
                          fontSize: '2.5rem',
                          fontWeight: 700,
                          letterSpacing: '-0.035em',
                          lineHeight: 1.15,
                          color: c.text,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          padding: 0,
                          caretColor: c.accent,
                          fontFamily: 'var(--font-display)',
                          textAlign: 'center',
                          maxWidth: '32rem',
                        }}
                      />
                    ) : editorMode === 'read' ? (
                      <NoteTitleTypewriter
                        title={activePage.title}
                        isDark={isDark}
                        onClick={handleTitleClick}
                      />
                    ) : (
                      <h1
                        onClick={handleTitleClick}
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '2.5rem',
                          letterSpacing: '-0.035em',
                          lineHeight: 1.15,
                          fontWeight: 700,
                          margin: 0,
                          cursor: 'text',
                          color: c.text,
                        }}
                      >
                        {activePage.title}
                      </h1>
                    )}
                  </div>
                </div>

                {/* Block editor */}
                <BlockEditor pageId={activePageId} />

                {/* Backlinks panel */}
                <BacklinksPanel pageId={activePageId} c={c} />

                {/* Page stats */}
                <PageStats pageId={activePageId} page={activePage} c={c} />
              </motion.div>
            ) : (
              /* ── Landing page (empty state) ── */
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
                      background: isDark ? 'rgba(244,189,111,0.06)' : 'rgba(0,0,0,0.03)',
                    }}
                  >
                    <PenLineIcon style={{
                      width: '1.5rem',
                      height: '1.5rem',
                      color: c.faint,
                    }} />
                  </motion.div>

                  <div>
                    <h3 style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: isDark ? 'rgba(237,224,212,0.7)' : 'rgba(0,0,0,0.6)',
                      marginBottom: '0.5rem',
                    }}>
                      Notes
                    </h3>
                    <p style={{
                      fontSize: '1rem',
                      color: c.muted,
                      maxWidth: '340px',
                      lineHeight: 1.6,
                    }}>
                      Create a page or open today&apos;s journal to start taking notes.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <motion.button
                      onClick={handleNewPage}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      transition={spring.snappy}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.625rem 1.25rem',
                        borderRadius: '9999px',
                        border: 'none',
                        background: isDark ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.1)',
                        color: c.green,
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        cursor: 'pointer',
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.625rem 1.25rem',
                        borderRadius: '9999px',
                        border: 'none',
                        background: isDark ? 'rgba(244,189,111,0.12)' : 'rgba(244,189,111,0.1)',
                        color: c.accent,
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <CalendarIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                      Today&apos;s Journal
                    </motion.button>
                  </div>
                </motion.div>

                {/* Recent pages quick-access */}
                <RecentPagesGrid isDark={isDark} c={c} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Chat overlay */}
          {activePageId && mounted && (
            <NoteAIChat pageId={activePageId} activeBlockId={editingBlockId} />
          )}
          {mounted && <LearningPanel />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Recent Pages Grid — shown on landing page
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
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.25rem',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.625rem',
              border: `1px solid ${c.border}`,
              background: c.hover,
              cursor: 'pointer',
              textAlign: 'left',
              minHeight: '3.5rem',
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
