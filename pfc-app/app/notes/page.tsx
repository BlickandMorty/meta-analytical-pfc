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

// Dynamic imports for heavy components
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

const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];
const SIDEBAR_WIDTH = 260;

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

  // Load notes from localStorage on mount
  useEffect(() => {
    if (ready) {
      loadNotesFromStorage();
    }
  }, [ready, loadNotesFromStorage]);

  // Active page
  const activePage = useMemo(
    () => notePages.find((p: NotePage) => p.id === activePageId) ?? null,
    [notePages, activePageId],
  );

  // Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset title editing when page changes
  useEffect(() => {
    setIsEditingTitle(false);
  }, [activePageId]);

  const handleTitleClick = useCallback(() => {
    if (!activePage) return;
    setTitleDraft(activePage.title);
    setIsEditingTitle(true);
    requestAnimationFrame(() => titleRef.current?.select());
  }, [activePage]);

  const handleTitleCommit = useCallback(() => {
    if (!activePage) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== activePage.title) {
      renamePage(activePage.id, trimmed);
    }
    setIsEditingTitle(false);
  }, [activePage, titleDraft, renamePage]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleCommit();
    }
    if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  }, [handleTitleCommit]);

  // Handle new page — auto-focus title for rename
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
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--chat-surface)',
        overflow: 'hidden',
        paddingTop: '3rem',
      }}
    >
      {/* Sidebar */}
      {mounted && (
        <AnimatePresence>
          {notesSidebarOpen && <NotesSidebar />}
        </AnimatePresence>
      )}

      {/* Main content — shifts right when sidebar open */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          marginLeft: notesSidebarOpen ? SIDEBAR_WIDTH : 0,
          transition: 'margin-left 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Compact toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 1.25rem',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={toggleNotesSidebar}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              cursor: 'pointer',
              color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
            }}
          >
            <PanelLeftIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          </button>

          <div style={{ flex: 1 }} />

          {activePage && (
            <>
              <button
                onClick={() => togglePageFavorite(activePage.id)}
                title={activePage.favorite ? 'Remove from favorites' : 'Favorite'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: activePage.favorite ? '#FBBF24' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                }}
              >
                <StarIcon style={{ width: '0.8rem', height: '0.8rem', fill: activePage.favorite ? '#FBBF24' : 'none' }} />
              </button>
              <button
                onClick={() => togglePagePin(activePage.id)}
                title={activePage.pinned ? 'Unpin' : 'Pin'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: activePage.pinned ? '#7C6CF0' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: isDark ? 'rgba(52,211,153,0.1)' : 'rgba(52,211,153,0.08)',
              cursor: 'pointer',
              color: '#34D399',
            }}
          >
            <PlusIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          </button>

          <button
            onClick={() => getOrCreateTodayJournal()}
            title="Today's journal"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: isDark ? 'rgba(124,108,240,0.1)' : 'rgba(124,108,240,0.08)',
              cursor: 'pointer',
              color: '#7C6CF0',
            }}
          >
            <CalendarIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          </button>
        </div>

        {/* Editor area — only this scrolls */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {activePageId && activePage && mounted ? (
            <motion.div
              key={activePageId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: CUPERTINO }}
              style={{
                maxWidth: '48rem',
                margin: '0 auto',
                padding: '2rem 2.5rem 8rem',
              }}
            >
              {/* ── Page title (large, editable, Notion-style) ── */}
              <div style={{ marginBottom: '1.5rem' }}>
                {activePage.isJournal && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    marginBottom: '0.5rem',
                  }}>
                    <CalendarIcon style={{ width: '0.75rem', height: '0.75rem', color: '#34D399' }} />
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      color: '#34D399',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                    }}>
                      Journal
                    </span>
                  </div>
                )}

                {activePage.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    {activePage.tags.map((tag: string) => (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.625rem',
                          fontWeight: 500,
                          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                          borderRadius: '4px',
                          padding: '0.125rem 0.375rem',
                        }}
                      >
                        <HashIcon style={{ width: '0.5rem', height: '0.5rem' }} />
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
                      fontSize: '2rem',
                      fontWeight: 700,
                      letterSpacing: '-0.03em',
                      lineHeight: 1.2,
                      color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      padding: 0,
                      caretColor: '#7C6CF0',
                      fontFamily: 'var(--font-display)',
                    }}
                  />
                ) : (
                  <h1
                    onClick={handleTitleClick}
                    style={{
                      fontSize: '2rem',
                      fontWeight: 700,
                      letterSpacing: '-0.03em',
                      lineHeight: 1.2,
                      color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                      cursor: 'text',
                      fontFamily: 'var(--font-display)',
                      margin: 0,
                    }}
                  >
                    {activePage.title}
                  </h1>
                )}
              </div>

              {/* ── Block editor ── */}
              <BlockEditor pageId={activePageId} />
            </motion.div>
          ) : (
            /* ── Empty state ── */
            <div
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: CUPERTINO }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    borderRadius: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  }}
                >
                  <PenLineIcon
                    style={{
                      width: '1.5rem',
                      height: '1.5rem',
                      color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                    }}
                  />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                      color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                      marginBottom: '0.375rem',
                    }}
                  >
                    Notes
                  </h3>
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)',
                      maxWidth: '280px',
                      lineHeight: 1.5,
                    }}
                  >
                    Create a page or open today&apos;s journal to start taking notes with AI assistance.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={handleNewPage}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '9999px',
                      border: 'none',
                      background: isDark ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.1)',
                      color: '#34D399',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <PlusIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                    New Page
                  </button>
                  <button
                    onClick={() => getOrCreateTodayJournal()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '9999px',
                      border: 'none',
                      background: isDark ? 'rgba(124,108,240,0.12)' : 'rgba(124,108,240,0.1)',
                      color: '#7C6CF0',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <CalendarIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                    Today&apos;s Journal
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* AI Chat (docked bottom-right) */}
          {activePageId && mounted && (
            <NoteAIChat pageId={activePageId} activeBlockId={editingBlockId} />
          )}
        </div>
      </div>
    </div>
  );
}
