'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  BookOpenIcon,
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
  const getOrCreateTodayJournal = usePFCStore((s) => s.getOrCreateTodayJournal);
  const editingBlockId = usePFCStore((s) => s.editingBlockId);

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

  // Handle new page creation
  const handleNewPage = useCallback(() => {
    const title = 'Untitled';
    createPage(title);
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
        paddingTop: '3rem', // Space for TopNav
      }}
    >
      {/* Sidebar */}
      {mounted && (
        <AnimatePresence>
          {notesSidebarOpen && <NotesSidebar />}
        </AnimatePresence>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Page header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.25rem',
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

          {activePage ? (
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 650,
                  letterSpacing: '-0.02em',
                  color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activePage.isJournal && (
                  <CalendarIcon
                    style={{
                      display: 'inline',
                      width: '0.75rem',
                      height: '0.75rem',
                      marginRight: '0.375rem',
                      color: '#34D399',
                      verticalAlign: 'middle',
                    }}
                  />
                )}
                {activePage.title}
              </h2>
            </div>
          ) : (
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)',
                }}
              >
                Select a page or create one
              </span>
            </div>
          )}

          {/* Quick actions */}
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

        {/* Editor area */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {activePageId && mounted ? (
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
              <BlockEditor pageId={activePageId} />
            </motion.div>
          ) : (
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
                    Create a page or open today's journal to start taking notes with AI assistance.
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
                    Today's Journal
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
