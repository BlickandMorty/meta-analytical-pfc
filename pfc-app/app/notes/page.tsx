'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { useTheme } from 'next-themes';
import {
  PanelLeftIcon,
  PlusIcon,
  CalendarIcon,
  PenLineIcon,
  StarIcon,
  PinIcon,
  HashIcon,
} from 'lucide-react';
import type { NotePage } from '@/lib/notes/types';
import { PixelBook } from '@/components/pixel-book';

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

const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];

// ═══════════════════════════════════════════════════════════════════
// NoteTitleTypewriter — types the note title with brief syntax previews
// Different from landing page: contextual (uses the actual title),
// one-shot reveal (types 2 code variations → settles on plain title),
// cursor fades out after completion.
// ═══════════════════════════════════════════════════════════════════

interface TitleVariation {
  plain: string;
  spans: { text: string; color: string }[];
  isCode: boolean;
}

function buildVariations(title: string): TitleVariation[] {
  return [
    // 1: Python comment
    {
      plain: `# ${title}`,
      spans: [
        { text: '# ', color: '#86EFAC' },
        { text: title, color: '#86EFAC' },
      ],
      isCode: true,
    },
    // 2: JS variable
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
    // 3: Plain title (final — this one stays)
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

  // Blink cursor
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, [done]);

  // Typewriter loop
  useEffect(() => {
    // Reset on title change
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
          // Code variations type faster, final title types more deliberately
          const speed = isLast ? 45 : 30;
          timer = setTimeout(tick, speed);
        } else {
          s.phase = 'pausing';
          // Short pause for code versions, longer for final
          timer = setTimeout(tick, isLast ? 600 : 1200);
        }
      } else if (s.phase === 'pausing') {
        if (isLast) {
          // Final variation — done, fade cursor
          s.phase = 'done';
          setDone(true);
          // Fade cursor out
          let fade = 1;
          const fadeInterval = setInterval(() => {
            fade -= 0.08;
            if (fade <= 0) {
              clearInterval(fadeInterval);
              setCursorOpacity(0);
            } else {
              setCursorOpacity(fade);
            }
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

  // Build colored spans
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
        <span
          key={i}
          style={{ color: span.color === 'inherit' ? titleColor : span.color }}
        >
          {span.text}
        </span>
      ))}
      {/* Blinking cursor */}
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

const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 420;

export default function NotesPage() {
  const ready = useSetupGuard();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  // Store state
  const activePageId = usePFCStore((s) => s.activePageId);
  const notePages = usePFCStore((s) => s.notePages);
  const notesSidebarOpen = usePFCStore((s) => s.notesSidebarOpen);
  const toggleNotesSidebar = usePFCStore((s) => s.toggleNotesSidebar);
  const loadNotesFromStorage = usePFCStore((s) => s.loadNotesFromStorage);
  const createPage = usePFCStore((s) => s.createPage);
  const renamePage = usePFCStore((s) => s.renamePage);
  const getOrCreateTodayJournal = usePFCStore((s) => s.getOrCreateTodayJournal);
  const editingBlockId = usePFCStore((s) => s.editingBlockId);
  const togglePageFavorite = usePFCStore((s) => s.togglePageFavorite);
  const togglePagePin = usePFCStore((s) => s.togglePagePin);

  // Resizable sidebar
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

  useEffect(() => {
    if (ready) loadNotesFromStorage();
  }, [ready, loadNotesFromStorage]);

  const activePage = useMemo(
    () => notePages.find((p: NotePage) => p.id === activePageId) ?? null,
    [notePages, activePageId],
  );

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
    createPage('Untitled');
    requestAnimationFrame(() => {
      setTitleDraft('Untitled');
      setIsEditingTitle(true);
      requestAnimationFrame(() => titleRef.current?.select());
    });
  }, [createPage]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--background)' }}>
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--background)',
        overflow: 'hidden',
        paddingTop: '3rem',
      }}
    >
      {/* Sidebar */}
      {mounted && notesSidebarOpen && (
        <div style={{ position: 'relative', width: sidebarWidth, flexShrink: 0 }}>
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
        </div>
      )}

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          background: 'var(--background)',
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.5rem',
            borderBottom: `1px solid ${isDark ? 'rgba(79,69,57,0.3)' : 'rgba(208,196,180,0.3)'}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={toggleNotesSidebar}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2rem',
              height: '2rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: isDark ? 'rgba(244,189,111,0.08)' : 'rgba(0,0,0,0.05)',
              cursor: 'pointer',
              color: isDark ? 'rgba(237,224,212,0.5)' : 'rgba(0,0,0,0.4)',
            }}
          >
            <PanelLeftIcon style={{ width: '1rem', height: '1rem' }} />
          </button>

          <div style={{ flex: 1 }} />

          {activePage && (
            <>
              <button
                onClick={() => togglePageFavorite(activePage.id)}
                title={activePage.favorite ? 'Remove from favorites' : 'Favorite'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '1.75rem', height: '1.75rem', borderRadius: '9999px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: activePage.favorite ? '#FBBF24' : (isDark ? 'rgba(156,143,128,0.3)' : 'rgba(0,0,0,0.15)'),
                }}
              >
                <StarIcon style={{ width: '0.8rem', height: '0.8rem', fill: activePage.favorite ? '#FBBF24' : 'none' }} />
              </button>
              <button
                onClick={() => togglePagePin(activePage.id)}
                title={activePage.pinned ? 'Unpin' : 'Pin'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '1.75rem', height: '1.75rem', borderRadius: '9999px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: activePage.pinned ? '#C4956A' : (isDark ? 'rgba(156,143,128,0.3)' : 'rgba(0,0,0,0.15)'),
                }}
              >
                <PinIcon style={{ width: '0.8rem', height: '0.8rem' }} />
              </button>
            </>
          )}

          <button
            onClick={handleNewPage}
            title="New page"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '1.75rem', height: '1.75rem', borderRadius: '9999px',
              border: 'none', background: isDark ? 'rgba(52,211,153,0.1)' : 'rgba(52,211,153,0.08)',
              cursor: 'pointer', color: '#34D399',
            }}
          >
            <PlusIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          </button>

          <button
            onClick={() => getOrCreateTodayJournal()}
            title="Today's journal"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '1.75rem', height: '1.75rem', borderRadius: '9999px',
              border: 'none', background: isDark ? 'rgba(244,189,111,0.1)' : 'rgba(244,189,111,0.08)',
              cursor: 'pointer', color: '#C4956A',
            }}
          >
            <CalendarIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          </button>
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {activePageId && activePage && mounted ? (
            <motion.div
              key={activePageId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: CUPERTINO }}
              style={{
                maxWidth: '52rem',
                margin: '0 auto',
                padding: '3rem 4rem 8rem',
              }}
            >
              {/* Notion-style banner */}
              <div
                style={{
                  height: '6rem',
                  borderRadius: '0.75rem',
                  marginBottom: '2rem',
                  background: activePage.isJournal
                    ? (isDark ? 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(52,211,153,0.04))' : 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(52,211,153,0.02))')
                    : (isDark ? 'linear-gradient(135deg, rgba(244,189,111,0.08), rgba(139,124,246,0.06))' : 'linear-gradient(135deg, rgba(244,189,111,0.06), rgba(139,124,246,0.04))'),
                }}
              />

              {/* Page title */}
              <div style={{ marginBottom: '2.5rem' }}>
                {activePage.isJournal && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem',
                  }}>
                    <CalendarIcon style={{ width: '0.875rem', height: '0.875rem', color: '#34D399' }} />
                    <span style={{
                      fontSize: '0.8125rem', fontWeight: 600, color: '#34D399',
                      letterSpacing: '0.03em', textTransform: 'uppercase',
                    }}>Journal</span>
                  </div>
                )}

                {activePage.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {activePage.tags.map((tag: string) => (
                      <span key={tag} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: '0.8125rem', fontWeight: 500,
                        color: isDark ? 'rgba(156,143,128,0.6)' : 'rgba(0,0,0,0.4)',
                        background: isDark ? 'rgba(244,189,111,0.08)' : 'rgba(0,0,0,0.04)',
                        borderRadius: '9999px', padding: '0.25rem 0.75rem',
                      }}>
                        <HashIcon style={{ width: '0.625rem', height: '0.625rem' }} />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {isEditingTitle ? (
                  <input
                    ref={titleRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={handleTitleCommit}
                    onKeyDown={handleTitleKeyDown}
                    autoFocus
                    style={{
                      width: '100%',
                      fontSize: '3rem',
                      fontWeight: 700,
                      letterSpacing: '-0.035em',
                      lineHeight: 1.15,
                      color: isDark ? 'rgba(237,224,212,0.95)' : 'rgba(0,0,0,0.85)',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      padding: 0,
                      caretColor: '#C4956A',
                      fontFamily: 'var(--font-display)',
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

              <BlockEditor pageId={activePageId} />
            </motion.div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: '1.5rem', padding: '2rem',
            }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: CUPERTINO }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}
              >
                <div style={{
                  width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDark ? 'rgba(244,189,111,0.06)' : 'rgba(0,0,0,0.03)',
                }}>
                  <PenLineIcon style={{
                    width: '1.5rem', height: '1.5rem',
                    color: isDark ? 'rgba(156,143,128,0.3)' : 'rgba(0,0,0,0.15)',
                  }} />
                </div>
                <div>
                  <h3 style={{
                    fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em',
                    color: isDark ? 'rgba(237,224,212,0.7)' : 'rgba(0,0,0,0.6)',
                    marginBottom: '0.5rem',
                  }}>Notes</h3>
                  <p style={{
                    fontSize: '1rem',
                    color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                    maxWidth: '340px', lineHeight: 1.6,
                  }}>
                    Create a page or open today&apos;s journal to start taking notes.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={handleNewPage}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.625rem 1.25rem', borderRadius: '9999px', border: 'none',
                      background: isDark ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.1)',
                      color: '#34D399', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <PlusIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                    New Page
                  </button>
                  <button
                    onClick={() => getOrCreateTodayJournal()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.625rem 1.25rem', borderRadius: '9999px', border: 'none',
                      background: isDark ? 'rgba(244,189,111,0.12)' : 'rgba(244,189,111,0.1)',
                      color: '#C4956A', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <CalendarIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                    Today&apos;s Journal
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {activePageId && mounted && (
            <NoteAIChat pageId={activePageId} activeBlockId={editingBlockId} />
          )}
          {mounted && <LearningPanel />}
        </div>
      </div>
    </div>
  );
}
