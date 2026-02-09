'use client';

import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  SearchIcon,
  PlusIcon,
  CalendarIcon,
  FileTextIcon,
  BookOpenIcon,
  NetworkIcon,
  StarIcon,
  PinIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
  HashIcon,
  TextIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/* ═══════════════════════════════════════════════════════════════════
   NotesSidebar — Left panel for the notes system

   Displays page list, journals, notebooks, and search results.
   Glass-morphism design with Framer Motion slide-in animation.
   ═══════════════════════════════════════════════════════════════════ */

const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];

const SIDEBAR_WIDTH = 260;

type SidebarView = 'pages' | 'journals' | 'books' | 'graph';

interface ViewTab {
  id: SidebarView;
  label: string;
  icon: typeof FileTextIcon;
}

const VIEW_TABS: ViewTab[] = [
  { id: 'pages', label: 'Pages', icon: FileTextIcon },
  { id: 'journals', label: 'Journals', icon: CalendarIcon },
  { id: 'books', label: 'Books', icon: BookOpenIcon },
  { id: 'graph', label: 'Graph', icon: NetworkIcon },
];

// ── Helper: format relative date ──────────────────────────────────

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatJournalDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

// ═══════════════════════════════════════════════════════════════════
// Main sidebar component
// ═══════════════════════════════════════════════════════════════════

export const NotesSidebar = memo(function NotesSidebar() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  // ── Store selectors ──
  const notePages = usePFCStore((s) => s.notePages);
  const noteBooks = usePFCStore((s) => s.noteBooks);
  const activePageId = usePFCStore((s) => s.activePageId);
  const sidebarOpen = usePFCStore((s) => s.notesSidebarOpen);
  const currentView = usePFCStore((s) => s.notesSidebarView);
  const searchQuery = usePFCStore((s) => s.notesSearchQuery);
  const setActivePage = usePFCStore((s) => s.setActivePage);
  const createPage = usePFCStore((s) => s.createPage);
  const deletePage = usePFCStore((s) => s.deletePage);
  const togglePageFavorite = usePFCStore((s) => s.togglePageFavorite);
  const togglePagePin = usePFCStore((s) => s.togglePagePin);
  const getOrCreateTodayJournal = usePFCStore((s) => s.getOrCreateTodayJournal);
  const setNotesSidebarView = usePFCStore((s) => s.setNotesSidebarView);
  const setNotesSearchQuery = usePFCStore((s) => s.setNotesSearchQuery);
  const searchNotes = usePFCStore((s) => s.searchNotes);

  // ── Derived data ──
  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchNotes(searchQuery) : []),
    [searchQuery, searchNotes],
  );

  const pinnedPages = useMemo(
    () => notePages.filter((p) => p.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
    [notePages],
  );

  const favoritePages = useMemo(
    () => notePages.filter((p) => p.favorite && !p.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
    [notePages],
  );

  const allPagesSorted = useMemo(
    () => [...notePages].filter((p) => !p.pinned && !p.favorite).sort((a, b) => b.updatedAt - a.updatedAt),
    [notePages],
  );

  const journalPages = useMemo(
    () => notePages
      .filter((p) => p.isJournal)
      .sort((a, b) => (b.journalDate ?? '').localeCompare(a.journalDate ?? '')),
    [notePages],
  );

  const showSearch = searchQuery.trim().length > 0;

  // ── Handlers ──
  const handleNewPage = useCallback(() => {
    createPage('Untitled');
  }, [createPage]);

  const handleTodayJournal = useCallback(() => {
    getOrCreateTodayJournal();
  }, [getOrCreateTodayJournal]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  if (!sidebarOpen) return null;

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.aside
          key="notes-sidebar"
          initial={{ x: -SIDEBAR_WIDTH, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -SIDEBAR_WIDTH, opacity: 0 }}
          transition={{ duration: 0.32, ease: CUPERTINO }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: SIDEBAR_WIDTH,
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            background: isDark
              ? 'rgba(31, 30, 27, 0.95)'
              : 'rgba(255, 255, 255, 0.40)',
            backdropFilter: 'blur(12px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
            borderRight: isDark
              ? '1px solid rgba(62, 61, 57, 0.5)'
              : '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* ── Header bar ── */}
          <SidebarHeader
            isDark={isDark}
            searchQuery={searchQuery}
            searchInputRef={searchInputRef}
            onSearchChange={setNotesSearchQuery}
            onNewPage={handleNewPage}
            onTodayJournal={handleTodayJournal}
          />

          {/* ── View tabs ── */}
          {!showSearch && (
            <ViewTabBar
              isDark={isDark}
              currentView={currentView}
              onViewChange={setNotesSidebarView}
            />
          )}

          {/* ── Content area ── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            className="[&::-webkit-scrollbar]:hidden"
          >
            {showSearch ? (
              <SearchResultsView
                isDark={isDark}
                results={searchResults}
                query={searchQuery}
                activePageId={activePageId}
                onSelectPage={setActivePage}
              />
            ) : currentView === 'pages' ? (
              <PagesView
                isDark={isDark}
                pinnedPages={pinnedPages}
                favoritePages={favoritePages}
                allPages={allPagesSorted}
                activePageId={activePageId}
                onSelectPage={setActivePage}
                onDelete={deletePage}
                onToggleFavorite={togglePageFavorite}
                onTogglePin={togglePagePin}
              />
            ) : currentView === 'journals' ? (
              <JournalsView
                isDark={isDark}
                journals={journalPages}
                activePageId={activePageId}
                onSelectPage={setActivePage}
              />
            ) : currentView === 'books' ? (
              <BooksView
                isDark={isDark}
                books={noteBooks}
              />
            ) : (
              <GraphPlaceholder isDark={isDark} />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
});

// ═══════════════════════════════════════════════════════════════════
// Sidebar Header — Search + New Page + Today
// ═══════════════════════════════════════════════════════════════════

interface SidebarHeaderProps {
  isDark: boolean;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (query: string) => void;
  onNewPage: () => void;
  onTodayJournal: () => void;
}

const SidebarHeader = memo(function SidebarHeader({
  isDark,
  searchQuery,
  searchInputRef,
  onSearchChange,
  onNewPage,
  onTodayJournal,
}: SidebarHeaderProps) {
  return (
    <div
      style={{
        padding: '0.75rem 0.75rem 0.5rem',
        borderBottom: isDark
          ? '1px solid rgba(62, 61, 57, 0.5)'
          : '1px solid rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <SearchIcon
          style={{
            position: 'absolute',
            left: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '0.75rem',
            height: '0.75rem',
            color: isDark ? 'rgba(232,228,222,0.25)' : 'rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}
        />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            height: '1.75rem',
            paddingLeft: '1.75rem',
            paddingRight: searchQuery ? '1.75rem' : '0.5rem',
            fontSize: '0.6875rem',
            fontWeight: 400,
            letterSpacing: '-0.005em',
            borderRadius: '9999px',
            border: 'none',
            background: isDark
              ? 'rgba(196,149,106,0.08)'
              : 'rgba(0,0,0,0.03)',
            color: isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.75)',
            outline: 'none',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = isDark
              ? 'rgba(196,149,106,0.3)'
              : 'rgba(124,108,240,0.3)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = isDark
              ? 'rgba(62,61,57,0.5)'
              : 'rgba(0,0,0,0.06)';
          }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: '0.375rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '1rem',
              height: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: 'none',
              background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(0,0,0,0.06)',
              color: isDark ? 'rgba(232,228,222,0.4)' : 'rgba(0,0,0,0.35)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <XIcon style={{ width: '0.5rem', height: '0.5rem' }} />
          </button>
        )}
      </div>

      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onNewPage}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            height: '1.625rem',
            fontSize: '0.625rem',
            fontWeight: 600,
            letterSpacing: '-0.005em',
            borderRadius: '9999px',
            border: 'none',
            background: isDark
              ? 'rgba(52,211,153,0.12)'
              : 'rgba(52,211,153,0.10)',
            color: '#34D399',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          <PlusIcon style={{ width: '0.6875rem', height: '0.6875rem' }} />
          New Page
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onTodayJournal}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            height: '1.625rem',
            fontSize: '0.625rem',
            fontWeight: 600,
            letterSpacing: '-0.005em',
            borderRadius: '9999px',
            border: 'none',
            background: isDark
              ? 'rgba(196,149,106,0.12)'
              : 'rgba(196,149,106,0.10)',
            color: '#C4956A',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          <CalendarIcon style={{ width: '0.6875rem', height: '0.6875rem' }} />
          Today
        </motion.button>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// View Tab Bar
// ═══════════════════════════════════════════════════════════════════

interface ViewTabBarProps {
  isDark: boolean;
  currentView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

const ViewTabBar = memo(function ViewTabBar({
  isDark,
  currentView,
  onViewChange,
}: ViewTabBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.125rem',
        padding: '0.375rem 0.75rem',
        borderBottom: isDark
          ? '1px solid rgba(62,61,57,0.5)'
          : '1px solid rgba(0,0,0,0.04)',
      }}
    >
      {VIEW_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;
        return (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.92 }}
            onClick={() => onViewChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              height: '1.5rem',
              fontSize: '0.5625rem',
              fontWeight: isActive ? 700 : 600,
              letterSpacing: '-0.005em',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              background: isActive
                ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(196,149,106,0.10)')
                : 'transparent',
              color: isActive
                ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.9)')
                : (isDark ? 'rgba(155,150,137,0.7)' : 'rgba(0,0,0,0.35)'),
            }}
          >
            <Icon style={{ width: '0.6875rem', height: '0.6875rem' }} />
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// Section Header (Pinned, Favorites, All)
// ═══════════════════════════════════════════════════════════════════

interface SectionLabelProps {
  isDark: boolean;
  icon: typeof StarIcon;
  label: string;
  count: number;
}

function SectionLabel({ isDark, icon: Icon, label, count }: SectionLabelProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.5rem 0.75rem 0.25rem',
      }}
    >
      <Icon
        style={{
          width: '0.5625rem',
          height: '0.5625rem',
          color: isDark ? 'rgba(232,228,222,0.25)' : 'rgba(0,0,0,0.25)',
        }}
      />
      <span
        style={{
          fontSize: '0.5625rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: isDark ? 'rgba(232,228,222,0.25)' : 'rgba(0,0,0,0.25)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '0.5625rem',
          fontWeight: 500,
          color: isDark ? 'rgba(232,228,222,0.15)' : 'rgba(0,0,0,0.15)',
          marginLeft: 'auto',
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Page Row
// ═══════════════════════════════════════════════════════════════════

interface PageRowProps {
  page: {
    id: string;
    title: string;
    icon?: string;
    tags: string[];
    favorite: boolean;
    pinned: boolean;
    isJournal: boolean;
    journalDate?: string;
    updatedAt: number;
  };
  isDark: boolean;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  showDate?: boolean;
}

const PageRow = memo(function PageRow({
  page,
  isDark,
  isActive,
  onSelect,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  showDate = true,
}: PageRowProps) {
  const [hovered, setHovered] = useState(false);

  const pageIcon = page.icon || (page.isJournal ? undefined : undefined);

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(page.id)}
      whileTap={{ scale: 0.98 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.375rem 0.5rem',
        margin: '0 0.375rem',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        transition: 'background 0.12s',
        background: isActive
          ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(124,108,240,0.08)')
          : hovered
            ? (isDark ? 'rgba(196,149,106,0.08)' : 'rgba(0,0,0,0.03)')
            : 'transparent',
        borderLeft: isActive
          ? '2px solid #C4956A'
          : '2px solid transparent',
        position: 'relative',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '1.25rem',
          height: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: '0.25rem',
          background: isActive
            ? (isDark ? 'rgba(196,149,106,0.15)' : 'rgba(124,108,240,0.10)')
            : (isDark ? 'rgba(196,149,106,0.06)' : 'rgba(0,0,0,0.03)'),
        }}
      >
        {pageIcon ? (
          <span style={{ fontSize: '0.6875rem', lineHeight: 1 }}>{pageIcon}</span>
        ) : page.isJournal ? (
          <CalendarIcon
            style={{
              width: '0.625rem',
              height: '0.625rem',
              color: isActive ? '#C4956A' : (isDark ? 'rgba(232,228,222,0.3)' : 'rgba(0,0,0,0.3)'),
            }}
          />
        ) : (
          <FileTextIcon
            style={{
              width: '0.625rem',
              height: '0.625rem',
              color: isActive ? '#C4956A' : (isDark ? 'rgba(232,228,222,0.3)' : 'rgba(0,0,0,0.3)'),
            }}
          />
        )}
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.8125rem',
            fontWeight: isActive ? 550 : 450,
            lineHeight: 1.3,
            color: isActive
              ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.9)')
              : (isDark ? 'rgba(232,228,222,0.65)' : 'rgba(0,0,0,0.6)'),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {page.title || 'Untitled'}
        </div>
        {showDate && (
          <div
            style={{
              fontSize: '0.625rem',
              fontWeight: 400,
              color: isDark ? 'rgba(232,228,222,0.2)' : 'rgba(0,0,0,0.25)',
              marginTop: '0.0625rem',
            }}
          >
            {formatRelativeDate(page.updatedAt)}
          </div>
        )}
      </div>

      {/* Tags indicator */}
      {page.tags.length > 0 && !hovered && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.125rem',
          }}
        >
          <HashIcon
            style={{
              width: '0.5rem',
              height: '0.5rem',
              color: isDark ? 'rgba(232,228,222,0.15)' : 'rgba(0,0,0,0.15)',
            }}
          />
          <span
            style={{
              fontSize: '0.5625rem',
              color: isDark ? 'rgba(232,228,222,0.15)' : 'rgba(0,0,0,0.15)',
            }}
          >
            {page.tags.length}
          </span>
        </div>
      )}

      {/* Context menu (shows on hover) */}
      {hovered && onDelete && onToggleFavorite && onTogglePin && (
        <PageContextMenu
          isDark={isDark}
          page={page}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onTogglePin={onTogglePin}
        />
      )}
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// Page Context Menu (dropdown)
// ═══════════════════════════════════════════════════════════════════

interface PageContextMenuProps {
  isDark: boolean;
  page: {
    id: string;
    favorite: boolean;
    pinned: boolean;
  };
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
}

const PageContextMenu = memo(function PageContextMenu({
  isDark,
  page,
  onDelete,
  onToggleFavorite,
  onTogglePin,
}: PageContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '1.25rem',
            height: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: 'none',
            background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(0,0,0,0.04)',
            color: isDark ? 'rgba(232,228,222,0.4)' : 'rgba(0,0,0,0.35)',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
          }}
        >
          <MoreHorizontalIcon style={{ width: '0.6875rem', height: '0.6875rem' }} />
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="min-w-[140px]"
        style={{
          background: isDark ? 'rgba(43,42,39,0.95)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px) saturate(1.3)',
          border: isDark ? '1px solid rgba(62,61,57,0.3)' : '1px solid rgba(0,0,0,0.06)',
          borderRadius: '0.75rem',
          padding: '0.25rem',
        }}
      >
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(page.id); }}
          className="text-xs gap-2 cursor-pointer"
        >
          <StarIcon
            style={{
              width: '0.75rem',
              height: '0.75rem',
              fill: page.favorite ? '#FBBF24' : 'none',
              color: page.favorite ? '#FBBF24' : 'currentColor',
            }}
          />
          {page.favorite ? 'Remove favorite' : 'Add to favorites'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onTogglePin(page.id); }}
          className="text-xs gap-2 cursor-pointer"
        >
          <PinIcon
            style={{
              width: '0.75rem',
              height: '0.75rem',
              color: page.pinned ? '#C4956A' : 'currentColor',
            }}
          />
          {page.pinned ? 'Unpin' : 'Pin to top'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
          className="text-xs gap-2 cursor-pointer text-red-400 focus:text-red-400"
        >
          <TrashIcon style={{ width: '0.75rem', height: '0.75rem' }} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ═══════════════════════════════════════════════════════════════════
// Pages View
// ═══════════════════════════════════════════════════════════════════

interface PagesViewProps {
  isDark: boolean;
  pinnedPages: Array<PageRowProps['page']>;
  favoritePages: Array<PageRowProps['page']>;
  allPages: Array<PageRowProps['page']>;
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function PagesView({
  isDark,
  pinnedPages,
  favoritePages,
  allPages,
  activePageId,
  onSelectPage,
  onDelete,
  onToggleFavorite,
  onTogglePin,
}: PagesViewProps) {
  const hasAnyPages = pinnedPages.length > 0 || favoritePages.length > 0 || allPages.length > 0;

  if (!hasAnyPages) {
    return (
      <EmptyState
        isDark={isDark}
        icon={FileTextIcon}
        title="No pages yet"
        subtitle="Create a new page to get started"
      />
    );
  }

  return (
    <div style={{ paddingTop: '0.25rem', paddingBottom: '0.5rem' }}>
      {/* Pinned section */}
      {pinnedPages.length > 0 && (
        <div>
          <SectionLabel isDark={isDark} icon={PinIcon} label="Pinned" count={pinnedPages.length} />
          {pinnedPages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              isDark={isDark}
              isActive={page.id === activePageId}
              onSelect={onSelectPage}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}

      {/* Favorites section */}
      {favoritePages.length > 0 && (
        <div style={{ marginTop: pinnedPages.length > 0 ? '0.375rem' : 0 }}>
          <SectionLabel isDark={isDark} icon={StarIcon} label="Favorites" count={favoritePages.length} />
          {favoritePages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              isDark={isDark}
              isActive={page.id === activePageId}
              onSelect={onSelectPage}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}

      {/* All pages */}
      {allPages.length > 0 && (
        <div style={{ marginTop: (pinnedPages.length > 0 || favoritePages.length > 0) ? '0.375rem' : 0 }}>
          <SectionLabel isDark={isDark} icon={FileTextIcon} label="All Pages" count={allPages.length} />
          {allPages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              isDark={isDark}
              isActive={page.id === activePageId}
              onSelect={onSelectPage}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Journals View
// ═══════════════════════════════════════════════════════════════════

interface JournalsViewProps {
  isDark: boolean;
  journals: Array<PageRowProps['page']>;
  activePageId: string | null;
  onSelectPage: (id: string) => void;
}

function JournalsView({
  isDark,
  journals,
  activePageId,
  onSelectPage,
}: JournalsViewProps) {
  if (journals.length === 0) {
    return (
      <EmptyState
        isDark={isDark}
        icon={CalendarIcon}
        title="No journals yet"
        subtitle="Click 'Today' to start your first journal"
      />
    );
  }

  return (
    <div style={{ paddingTop: '0.25rem', paddingBottom: '0.5rem' }}>
      {journals.map((journal) => {
        const isTodayEntry = isToday(journal.journalDate);
        const isActive = journal.id === activePageId;
        return (
          <motion.div
            key={journal.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectPage(journal.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.5rem',
              margin: '0 0.375rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'background 0.12s',
              background: isActive
                ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(124,108,240,0.08)')
                : isTodayEntry
                  ? (isDark ? 'rgba(52,211,153,0.06)' : 'rgba(52,211,153,0.05)')
                  : 'transparent',
              borderLeft: isActive
                ? '2px solid #C4956A'
                : isTodayEntry
                  ? '2px solid rgba(52,211,153,0.4)'
                  : '2px solid transparent',
            }}
          >
            {/* Calendar icon */}
            <div
              style={{
                width: '1.5rem',
                height: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                borderRadius: '0.375rem',
                background: isTodayEntry
                  ? (isDark ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.10)')
                  : (isDark ? 'rgba(196,149,106,0.06)' : 'rgba(0,0,0,0.03)'),
              }}
            >
              <CalendarIcon
                style={{
                  width: '0.6875rem',
                  height: '0.6875rem',
                  color: isTodayEntry
                    ? '#34D399'
                    : isActive
                      ? '#C4956A'
                      : (isDark ? 'rgba(232,228,222,0.3)' : 'rgba(0,0,0,0.3)'),
                }}
              />
            </div>

            {/* Date + title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: isTodayEntry ? 600 : 450,
                  lineHeight: 1.3,
                  color: isTodayEntry
                    ? '#34D399'
                    : isActive
                      ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.9)')
                      : (isDark ? 'rgba(232,228,222,0.65)' : 'rgba(0,0,0,0.6)'),
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {formatJournalDate(journal.journalDate)}
              </div>
              <div
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 400,
                  color: isDark ? 'rgba(232,228,222,0.2)' : 'rgba(0,0,0,0.2)',
                  marginTop: '0.0625rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {journal.title}
              </div>
            </div>

            {/* Today badge */}
            {isTodayEntry && (
              <span
                style={{
                  fontSize: '0.5625rem',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '9999px',
                  background: isDark
                    ? 'rgba(52,211,153,0.15)'
                    : 'rgba(52,211,153,0.12)',
                  color: '#34D399',
                  flexShrink: 0,
                }}
              >
                NOW
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Books View
// ═══════════════════════════════════════════════════════════════════

interface BooksViewProps {
  isDark: boolean;
  books: Array<{
    id: string;
    title: string;
    description?: string;
    pageIds: string[];
  }>;
}

function BooksView({ isDark, books }: BooksViewProps) {
  const createPage = usePFCStore((s) => s.createPage);

  if (books.length === 0) {
    return (
      <div style={{ paddingTop: '0.25rem', paddingBottom: '0.5rem' }}>
        <EmptyState
          isDark={isDark}
          icon={BookOpenIcon}
          title="No notebooks yet"
          subtitle="Organize your pages into collections"
        />
        {/* Create book button */}
        <div style={{ padding: '0 0.75rem', marginTop: '0.5rem' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              height: '2rem',
              fontSize: '0.6875rem',
              fontWeight: 600,
              borderRadius: '9999px',
              border: isDark
                ? '1px dashed rgba(62,61,57,0.3)'
                : '1px dashed rgba(0,0,0,0.08)',
              background: 'transparent',
              color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            <PlusIcon style={{ width: '0.75rem', height: '0.75rem' }} />
            Create Book
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '0.25rem', paddingBottom: '0.5rem' }}>
      {books.map((book) => (
        <motion.div
          key={book.id}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.5rem',
            margin: '0 0.375rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isDark
              ? 'rgba(196,149,106,0.08)'
              : 'rgba(0,0,0,0.03)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {/* Book icon */}
          <div
            style={{
              width: '1.5rem',
              height: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              borderRadius: '0.375rem',
              background: isDark
                ? 'rgba(224,120,80,0.10)'
                : 'rgba(224,120,80,0.08)',
            }}
          >
            <BookOpenIcon
              style={{
                width: '0.6875rem',
                height: '0.6875rem',
                color: '#E07850',
              }}
            />
          </div>

          {/* Title + description */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                lineHeight: 1.3,
                color: isDark ? 'rgba(232,228,222,0.7)' : 'rgba(0,0,0,0.65)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {book.title}
            </div>
            {book.description && (
              <div
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 400,
                  color: isDark ? 'rgba(232,228,222,0.2)' : 'rgba(0,0,0,0.2)',
                  marginTop: '0.0625rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {book.description}
              </div>
            )}
          </div>

          {/* Page count badge */}
          <span
            style={{
              fontSize: '0.5625rem',
              fontWeight: 550,
              padding: '0.125rem 0.375rem',
              borderRadius: '9999px',
              background: isDark
                ? 'rgba(196,149,106,0.08)'
                : 'rgba(0,0,0,0.05)',
              color: isDark ? 'rgba(232,228,222,0.35)' : 'rgba(0,0,0,0.35)',
              flexShrink: 0,
            }}
          >
            {book.pageIds.length} {book.pageIds.length === 1 ? 'page' : 'pages'}
          </span>
        </motion.div>
      ))}

      {/* Create book button */}
      <div style={{ padding: '0.375rem 0.75rem' }}>
        <motion.button
          whileTap={{ scale: 0.92 }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.375rem',
            height: '2rem',
            fontSize: '0.6875rem',
            fontWeight: 600,
            borderRadius: '9999px',
            border: isDark
              ? '1px dashed rgba(62,61,57,0.3)'
              : '1px dashed rgba(0,0,0,0.08)',
            background: 'transparent',
            color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
            cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          <PlusIcon style={{ width: '0.75rem', height: '0.75rem' }} />
          Create Book
        </motion.button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Graph Placeholder
// ═══════════════════════════════════════════════════════════════════

function GraphPlaceholder({ isDark }: { isDark: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '2rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: CUPERTINO }}
      >
        <div
          style={{
            width: '3rem',
            height: '3rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.75rem',
            background: isDark
              ? 'rgba(34,211,238,0.08)'
              : 'rgba(34,211,238,0.06)',
            marginBottom: '0.75rem',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <NetworkIcon
            style={{
              width: '1.375rem',
              height: '1.375rem',
              color: 'rgba(34,211,238,0.5)',
            }}
          />
        </div>
        <h4
          style={{
            fontSize: '0.8125rem',
            fontWeight: 550,
            color: isDark ? 'rgba(232,228,222,0.6)' : 'rgba(0,0,0,0.55)',
            marginBottom: '0.25rem',
          }}
        >
          Knowledge Graph
        </h4>
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 400,
            color: isDark ? 'rgba(232,228,222,0.25)' : 'rgba(0,0,0,0.3)',
            lineHeight: 1.5,
            maxWidth: '11rem',
          }}
        >
          Visualize connections between your notes, tags, and concepts. Coming soon.
        </p>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Search Results View
// ═══════════════════════════════════════════════════════════════════

interface SearchResultsViewProps {
  isDark: boolean;
  results: Array<{
    type: 'page' | 'block';
    pageId: string;
    blockId?: string;
    title: string;
    snippet: string;
    score: number;
  }>;
  query: string;
  activePageId: string | null;
  onSelectPage: (id: string) => void;
}

function SearchResultsView({
  isDark,
  results,
  query,
  activePageId,
  onSelectPage,
}: SearchResultsViewProps) {
  if (results.length === 0) {
    return (
      <EmptyState
        isDark={isDark}
        icon={SearchIcon}
        title="No results"
        subtitle={`Nothing found for "${query}"`}
      />
    );
  }

  return (
    <div style={{ paddingTop: '0.25rem', paddingBottom: '0.5rem' }}>
      <SectionLabel
        isDark={isDark}
        icon={SearchIcon}
        label="Results"
        count={results.length}
      />
      {results.map((result, idx) => {
        const isActive = result.pageId === activePageId;
        return (
          <motion.div
            key={`${result.pageId}-${result.blockId ?? idx}`}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectPage(result.pageId)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.375rem 0.5rem',
              margin: '0 0.375rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'background 0.12s',
              background: isActive
                ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(124,108,240,0.08)')
                : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = isDark
                  ? 'rgba(196,149,106,0.08)'
                  : 'rgba(0,0,0,0.03)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: '1.25rem',
                height: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                borderRadius: '0.25rem',
                background: isDark ? 'rgba(196,149,106,0.06)' : 'rgba(0,0,0,0.03)',
                marginTop: '0.0625rem',
              }}
            >
              {result.type === 'block' ? (
                <TextIcon
                  style={{
                    width: '0.625rem',
                    height: '0.625rem',
                    color: isDark ? 'rgba(232,228,222,0.3)' : 'rgba(0,0,0,0.3)',
                  }}
                />
              ) : result.type === 'page' && result.blockId ? (
                <HashIcon
                  style={{
                    width: '0.625rem',
                    height: '0.625rem',
                    color: '#22D3EE',
                  }}
                />
              ) : (
                <FileTextIcon
                  style={{
                    width: '0.625rem',
                    height: '0.625rem',
                    color: isActive ? '#C4956A' : (isDark ? 'rgba(232,228,222,0.3)' : 'rgba(0,0,0,0.3)'),
                  }}
                />
              )}
            </div>

            {/* Title + snippet */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  lineHeight: 1.3,
                  color: isActive
                    ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.9)')
                    : (isDark ? 'rgba(232,228,222,0.65)' : 'rgba(0,0,0,0.6)'),
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {result.title}
              </div>
              {result.snippet && (
                <div
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 400,
                    color: isDark ? 'rgba(232,228,222,0.25)' : 'rgba(0,0,0,0.25)',
                    marginTop: '0.125rem',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightQuery(result.snippet, query, isDark),
                  }}
                />
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Highlight matching query text in snippets ──

function highlightQuery(text: string, query: string, isDark: boolean): string {
  if (!query.trim()) return escapeHtml(text);
  const escaped = escapeRegex(query);
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(text).replace(
    regex,
    `<mark style="background:rgba(196,149,106,${isDark ? '0.25' : '0.18'});color:${isDark ? 'rgba(232,228,222,0.85)' : 'rgba(0,0,0,0.8)'};border-radius:2px;padding:0 1px;">$1</mark>`,
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ═══════════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  isDark: boolean;
  icon: typeof FileTextIcon;
  title: string;
  subtitle: string;
}

function EmptyState({ isDark, icon: Icon, title, subtitle }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '2.5rem',
          height: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '0.625rem',
          background: isDark
            ? 'rgba(196,149,106,0.06)'
            : 'rgba(0,0,0,0.03)',
          marginBottom: '0.625rem',
        }}
      >
        <Icon
          style={{
            width: '1.125rem',
            height: '1.125rem',
            color: isDark ? 'rgba(232,228,222,0.2)' : 'rgba(0,0,0,0.2)',
          }}
        />
      </div>
      <h4
        style={{
          fontSize: '0.8125rem',
          fontWeight: 550,
          color: isDark ? 'rgba(232,228,222,0.45)' : 'rgba(0,0,0,0.45)',
          marginBottom: '0.125rem',
        }}
      >
        {title}
      </h4>
      <p
        style={{
          fontSize: '0.6875rem',
          fontWeight: 400,
          color: isDark ? 'rgba(232,228,222,0.2)' : 'rgba(0,0,0,0.25)',
          maxWidth: '10rem',
          lineHeight: 1.4,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}
