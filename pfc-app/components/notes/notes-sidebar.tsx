'use client';

import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  SearchIcon,
  PlusIcon,
  CalendarIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  StarIcon,
  PinIcon,
  TrashIcon,
  PencilIcon,
  XIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];
/* sidebar width is controlled by the parent (NotesPage) */

/* ------------------------------------------------------------------ */
/*  Theme helpers                                                      */
/* ------------------------------------------------------------------ */

function t(isDark: boolean) {
  return {
    bg:       isDark ? 'rgba(20,19,17,0.95)'      : 'rgba(218,212,200,0.95)',
    text:     isDark ? 'rgba(237,224,212,0.9)'     : 'rgba(43,42,39,0.9)',
    muted:    isDark ? 'rgba(156,143,128,0.5)'     : 'rgba(0,0,0,0.35)',
    border:   isDark ? 'rgba(79,69,57,0.3)'        : 'rgba(208,196,180,0.3)',
    hover:    isDark ? 'rgba(244,189,111,0.06)'    : 'rgba(0,0,0,0.04)',
    active:   isDark ? 'rgba(244,189,111,0.12)'    : 'rgba(244,189,111,0.10)',
    accent:   '#C4956A',
    icon:     isDark ? 'rgba(156,143,128,0.5)'     : 'rgba(0,0,0,0.3)',
    inputBg:  isDark ? 'rgba(79,69,57,0.3)'        : 'rgba(208,196,180,0.2)',
    danger:   '#E05252',
  };
}

/* ------------------------------------------------------------------ */
/*  Main sidebar component                                             */
/* ------------------------------------------------------------------ */

export const NotesSidebar = memo(function NotesSidebar() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const c = t(isDark);

  // -- Store selectors --
  const notePages          = usePFCStore((s) => s.notePages);
  const noteBooks          = usePFCStore((s) => s.noteBooks);
  const activePageId       = usePFCStore((s) => s.activePageId);
  const sidebarOpen        = usePFCStore((s) => s.notesSidebarOpen);
  const setActivePage      = usePFCStore((s) => s.setActivePage);
  const createPage         = usePFCStore((s) => s.createPage);
  const deletePage         = usePFCStore((s) => s.deletePage);
  const renamePage         = usePFCStore((s) => s.renamePage);
  const togglePageFavorite = usePFCStore((s) => s.togglePageFavorite);
  const togglePagePin      = usePFCStore((s) => s.togglePagePin);
  const searchNotes        = usePFCStore((s) => s.searchNotes);
  const getOrCreateTodayJournal = usePFCStore((s) => s.getOrCreateTodayJournal);
  const toggleNotesSidebar = usePFCStore((s) => s.toggleNotesSidebar);
  const createNoteBook     = usePFCStore((s) => s.createNoteBook);

  // -- Local state --
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // -- Search filtering --
  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchNotes(searchQuery) : []),
    [searchQuery, searchNotes],
  );
  const isSearching = searchQuery.trim().length > 0;

  // -- Derived data: pinned, books with pages, standalone pages --
  const pinnedPages = useMemo(
    () => notePages.filter((p) => p.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
    [notePages],
  );

  const bookPageIds = useMemo(() => {
    const ids = new Set<string>();
    noteBooks.forEach((b) => b.pageIds.forEach((id) => ids.add(id)));
    return ids;
  }, [noteBooks]);

  const standalonePages = useMemo(
    () => notePages
      .filter((p) => !p.pinned && !bookPageIds.has(p.id))
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [notePages, bookPageIds],
  );

  const booksWithPages = useMemo(
    () => noteBooks.map((book) => ({
      ...book,
      pages: book.pageIds
        .map((id) => notePages.find((p) => p.id === id))
        .filter(Boolean) as typeof notePages,
    })),
    [noteBooks, notePages],
  );

  // -- Handlers --
  const handleNewPage = useCallback(() => {
    createPage('Untitled');
  }, [createPage]);

  const handleTodayJournal = useCallback(() => {
    getOrCreateTodayJournal();
  }, [getOrCreateTodayJournal]);

  const toggleBook = useCallback((bookId: string) => {
    setExpandedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }, []);

  const startRename = useCallback((id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      renamePage(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, renamePage]);

  if (!sidebarOpen) return null;

  return (
        <aside
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: c.bg,
            borderRight: `1px solid ${c.border}`,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '14px',
            color: c.text,
            userSelect: 'none',
            overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <SidebarHeader
            c={c}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {/* ── Scrollable tree area ── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'thin',
              padding: '6px 0',
            }}
          >
            {isSearching ? (
              <SearchResults
                c={c}
                results={searchResults}
                query={searchQuery}
                activePageId={activePageId}
                onSelectPage={setActivePage}
              />
            ) : (
              <TreeView
                c={c}
                pinnedPages={pinnedPages}
                booksWithPages={booksWithPages}
                standalonePages={standalonePages}
                expandedBooks={expandedBooks}
                activePageId={activePageId}
                renamingId={renamingId}
                renameValue={renameValue}
                onToggleBook={toggleBook}
                onSelectPage={setActivePage}
                onDelete={deletePage}
                onToggleFavorite={togglePageFavorite}
                onTogglePin={togglePagePin}
                onStartRename={startRename}
                onRenameChange={setRenameValue}
                onCommitRename={commitRename}
              />
            )}
          </div>

          {/* ── Bottom bar ── */}
          <BottomBar
            c={c}
            onNewPage={handleNewPage}
            onTodayJournal={handleTodayJournal}
          />

        </aside>
  );
});

/* ================================================================== */
/*  Sidebar Header                                                     */
/* ================================================================== */

interface SidebarHeaderProps {
  c: ReturnType<typeof t>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const SidebarHeader = memo(function SidebarHeader({
  c, searchQuery, onSearchChange,
}: SidebarHeaderProps) {
  return (
    <div style={{
      padding: '14px 12px 10px',
      borderBottom: `1px solid ${c.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* Title */}
      <span style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: c.muted,
      }}>
        Files
      </span>

      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <SearchIcon style={{
          position: 'absolute',
          left: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 13,
          height: 13,
          color: c.icon,
          pointerEvents: 'none',
        }} />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            height: 30,
            paddingLeft: 30,
            paddingRight: searchQuery ? 28 : 8,
            fontSize: '13px',
            fontWeight: 400,
            borderRadius: 4,
            border: `1px solid ${c.border}`,
            background: c.inputBg,
            color: c.text,
            outline: 'none',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 3,
              border: 'none',
              background: 'transparent',
              color: c.muted,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <XIcon style={{ width: 12, height: 12 }} />
          </button>
        )}
      </div>
    </div>
  );
});

/* ================================================================== */
/*  Tree View                                                          */
/* ================================================================== */

interface TreePage {
  id: string;
  title: string;
  icon?: string;
  tags: string[];
  favorite: boolean;
  pinned: boolean;
  isJournal: boolean;
  journalDate?: string;
  updatedAt: number;
}

interface BookWithPages {
  id: string;
  title: string;
  description?: string;
  pageIds: string[];
  pages: TreePage[];
}

interface TreeViewProps {
  c: ReturnType<typeof t>;
  pinnedPages: TreePage[];
  booksWithPages: BookWithPages[];
  standalonePages: TreePage[];
  expandedBooks: Set<string>;
  activePageId: string | null;
  renamingId: string | null;
  renameValue: string;
  onToggleBook: (id: string) => void;
  onSelectPage: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onStartRename: (id: string, title: string) => void;
  onRenameChange: (val: string) => void;
  onCommitRename: () => void;
}

function TreeView({
  c,
  pinnedPages,
  booksWithPages,
  standalonePages,
  expandedBooks,
  activePageId,
  renamingId,
  renameValue,
  onToggleBook,
  onSelectPage,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onStartRename,
  onRenameChange,
  onCommitRename,
}: TreeViewProps) {
  const hasAnything = pinnedPages.length > 0 || booksWithPages.length > 0 || standalonePages.length > 0;

  if (!hasAnything) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: c.muted,
        fontSize: '13px',
      }}>
        No pages yet. Create one to get started.
      </div>
    );
  }

  return (
    <>
      {/* ── Pinned section ── */}
      {pinnedPages.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <SectionHeader c={c} label="Pinned" />
          {pinnedPages.map((page) => (
            <FileItem
              key={page.id}
              c={c}
              page={page}
              isActive={page.id === activePageId}
              isRenaming={page.id === renamingId}
              renameValue={renameValue}
              depth={0}
              onSelect={onSelectPage}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onTogglePin={onTogglePin}
              onStartRename={onStartRename}
              onRenameChange={onRenameChange}
              onCommitRename={onCommitRename}
            />
          ))}
        </div>
      )}

      {/* ── Books (folders) ── */}
      {booksWithPages.map((book) => (
        <FolderItem
          key={book.id}
          c={c}
          book={book}
          isExpanded={expandedBooks.has(book.id)}
          activePageId={activePageId}
          renamingId={renamingId}
          renameValue={renameValue}
          onToggle={onToggleBook}
          onSelectPage={onSelectPage}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onTogglePin={onTogglePin}
          onStartRename={onStartRename}
          onRenameChange={onRenameChange}
          onCommitRename={onCommitRename}
        />
      ))}

      {/* ── Standalone pages (root-level files) ── */}
      {standalonePages.map((page) => (
        <FileItem
          key={page.id}
          c={c}
          page={page}
          isActive={page.id === activePageId}
          isRenaming={page.id === renamingId}
          renameValue={renameValue}
          depth={0}
          onSelect={onSelectPage}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onTogglePin={onTogglePin}
          onStartRename={onStartRename}
          onRenameChange={onRenameChange}
          onCommitRename={onCommitRename}
        />
      ))}
    </>
  );
}

/* ================================================================== */
/*  Section Header                                                     */
/* ================================================================== */

function SectionHeader({ c, label }: { c: ReturnType<typeof t>; label: string }) {
  return (
    <div style={{
      padding: '8px 12px 4px',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: c.muted,
    }}>
      {label}
    </div>
  );
}

/* ================================================================== */
/*  Folder Item (Book)                                                 */
/* ================================================================== */

interface FolderItemProps {
  c: ReturnType<typeof t>;
  book: BookWithPages;
  isExpanded: boolean;
  activePageId: string | null;
  renamingId: string | null;
  renameValue: string;
  onToggle: (id: string) => void;
  onSelectPage: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onStartRename: (id: string, title: string) => void;
  onRenameChange: (val: string) => void;
  onCommitRename: () => void;
}

const FolderItem = memo(function FolderItem({
  c,
  book,
  isExpanded,
  activePageId,
  renamingId,
  renameValue,
  onToggle,
  onSelectPage,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onStartRename,
  onRenameChange,
  onCommitRename,
}: FolderItemProps) {
  const [hovered, setHovered] = useState(false);
  const FolderIco = isExpanded ? FolderOpenIcon : FolderIcon;

  return (
    <div style={{ marginBottom: 2 }}>
      {/* Folder row */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onToggle(book.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px 4px 12px',
          cursor: 'pointer',
          borderRadius: 4,
          margin: '0 4px',
          transition: 'background 0.1s',
          background: hovered ? c.hover : 'transparent',
        }}
      >
        {/* Disclosure triangle */}
        <ChevronRightIcon style={{
          width: 14,
          height: 14,
          color: c.muted,
          flexShrink: 0,
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease',
        }} />

        {/* Folder icon */}
        <FolderIco style={{
          width: 15,
          height: 15,
          color: c.accent,
          flexShrink: 0,
        }} />

        {/* Title */}
        <span style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 600,
          color: c.text,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {book.title}
        </span>

        {/* Page count */}
        {!hovered && (
          <span style={{
            fontSize: '11px',
            fontWeight: 500,
            color: c.muted,
            flexShrink: 0,
          }}>
            {book.pageIds.length}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && book.pages.map((page) => (
        <FileItem
          key={page.id}
          c={c}
          page={page}
          isActive={page.id === activePageId}
          isRenaming={page.id === renamingId}
          renameValue={renameValue}
          depth={1}
          onSelect={onSelectPage}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onTogglePin={onTogglePin}
          onStartRename={onStartRename}
          onRenameChange={onRenameChange}
          onCommitRename={onCommitRename}
        />
      ))}
    </div>
  );
});

/* ================================================================== */
/*  File Item (Page)                                                   */
/* ================================================================== */

interface FileItemProps {
  c: ReturnType<typeof t>;
  page: TreePage;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  depth: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onStartRename: (id: string, title: string) => void;
  onRenameChange: (val: string) => void;
  onCommitRename: () => void;
}

const FileItem = memo(function FileItem({
  c,
  page,
  isActive,
  isRenaming,
  renameValue,
  depth,
  onSelect,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onStartRename,
  onRenameChange,
  onCommitRename,
}: FileItemProps) {
  const [hovered, setHovered] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const paddingLeft = 12 + depth * 20;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!isRenaming) onSelect(page.id); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: `3px 8px 3px ${paddingLeft}px`,
        cursor: 'pointer',
        borderRadius: 4,
        margin: '0 4px',
        transition: 'background 0.1s',
        background: isActive ? c.active : hovered ? c.hover : 'transparent',
        minHeight: 28,
      }}
    >
      {/* File icon */}
      {page.isJournal ? (
        <CalendarIcon style={{
          width: 14,
          height: 14,
          color: isActive ? c.accent : c.icon,
          flexShrink: 0,
        }} />
      ) : (
        <FileTextIcon style={{
          width: 14,
          height: 14,
          color: isActive ? c.accent : c.icon,
          flexShrink: 0,
        }} />
      )}

      {/* Title or rename input */}
      {isRenaming ? (
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitRename();
            if (e.key === 'Escape') onCommitRename();
          }}
          onBlur={onCommitRename}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: 600,
            background: c.inputBg,
            border: `1px solid ${c.accent}`,
            borderRadius: 3,
            color: c.text,
            padding: '1px 4px',
            outline: 'none',
            minWidth: 0,
          }}
        />
      ) : (
        <span style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: isActive ? 600 : 500,
          color: isActive ? c.text : (hovered ? c.text : c.text),
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: isActive ? 1 : 0.8,
        }}>
          {page.title || 'Untitled'}
        </span>
      )}

      {/* Pinned indicator */}
      {page.pinned && !hovered && (
        <PinIcon style={{
          width: 11,
          height: 11,
          color: c.accent,
          flexShrink: 0,
        }} />
      )}

      {/* Favorite indicator */}
      {page.favorite && !page.pinned && !hovered && (
        <StarIcon style={{
          width: 11,
          height: 11,
          color: '#FBBF24',
          fill: '#FBBF24',
          flexShrink: 0,
        }} />
      )}

      {/* Context menu (on hover) */}
      {hovered && !isRenaming && (
        <ItemContextMenu
          c={c}
          page={page}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onTogglePin={onTogglePin}
          onStartRename={onStartRename}
        />
      )}
    </div>
  );
});

/* ================================================================== */
/*  Item Context Menu                                                  */
/* ================================================================== */

interface ItemContextMenuProps {
  c: ReturnType<typeof t>;
  page: TreePage;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onTogglePin: (id: string) => void;
  onStartRename: (id: string, title: string) => void;
}

const ItemContextMenu = memo(function ItemContextMenu({
  c, page, onDelete, onToggleFavorite, onTogglePin, onStartRename,
}: ItemContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 3,
            border: 'none',
            background: 'transparent',
            color: c.muted,
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
            opacity: 0.7,
          }}
        >
          <MoreHorizontalIcon style={{ width: 14, height: 14 }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        style={{
          minWidth: 160,
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: 6,
          padding: 4,
          fontSize: '13px',
        }}
      >
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onStartRename(page.id, page.title); }}
          className="gap-2 cursor-pointer"
          style={{ fontSize: '13px', padding: '6px 8px', borderRadius: 4 }}
        >
          <PencilIcon style={{ width: 14, height: 14 }} />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(page.id); }}
          className="gap-2 cursor-pointer"
          style={{ fontSize: '13px', padding: '6px 8px', borderRadius: 4 }}
        >
          <StarIcon style={{
            width: 14,
            height: 14,
            fill: page.favorite ? '#FBBF24' : 'none',
            color: page.favorite ? '#FBBF24' : 'currentColor',
          }} />
          {page.favorite ? 'Unfavorite' : 'Favorite'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onTogglePin(page.id); }}
          className="gap-2 cursor-pointer"
          style={{ fontSize: '13px', padding: '6px 8px', borderRadius: 4 }}
        >
          <PinIcon style={{
            width: 14,
            height: 14,
            color: page.pinned ? c.accent : 'currentColor',
          }} />
          {page.pinned ? 'Unpin' : 'Pin to top'}
        </DropdownMenuItem>
        <DropdownMenuSeparator style={{ background: c.border, margin: '4px 0' }} />
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
          className="gap-2 cursor-pointer"
          style={{ fontSize: '13px', padding: '6px 8px', borderRadius: 4, color: c.danger }}
        >
          <TrashIcon style={{ width: 14, height: 14 }} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

/* ================================================================== */
/*  Search Results                                                     */
/* ================================================================== */

interface SearchResultsProps {
  c: ReturnType<typeof t>;
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

function SearchResults({ c, results, query, activePageId, onSelectPage }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: c.muted,
        fontSize: '13px',
      }}>
        No results for &ldquo;{query}&rdquo;
      </div>
    );
  }

  return (
    <div>
      <SectionHeader c={c} label={`${results.length} result${results.length !== 1 ? 's' : ''}`} />
      {results.map((result, idx) => {
        const isActive = result.pageId === activePageId;
        return (
          <SearchResultItem
            key={`${result.pageId}-${result.blockId ?? idx}`}
            c={c}
            result={result}
            query={query}
            isActive={isActive}
            onSelect={onSelectPage}
          />
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Search Result Item                                                 */
/* ================================================================== */

interface SearchResultItemProps {
  c: ReturnType<typeof t>;
  result: {
    type: 'page' | 'block';
    pageId: string;
    blockId?: string;
    title: string;
    snippet: string;
    score: number;
  };
  query: string;
  isActive: boolean;
  onSelect: (id: string) => void;
}

const SearchResultItem = memo(function SearchResultItem({
  c, result, query, isActive, onSelect,
}: SearchResultItemProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(result.pageId)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '5px 8px 5px 12px',
        margin: '0 4px',
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'background 0.1s',
        background: isActive ? c.active : hovered ? c.hover : 'transparent',
      }}
    >
      <FileTextIcon style={{
        width: 14,
        height: 14,
        color: isActive ? c.accent : c.icon,
        flexShrink: 0,
        marginTop: 2,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: c.text,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: isActive ? 1 : 0.85,
        }}>
          {result.title}
        </div>
        {result.snippet && (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 400,
              color: c.muted,
              marginTop: 2,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            dangerouslySetInnerHTML={{
              __html: highlightQuery(result.snippet, query, c),
            }}
          />
        )}
      </div>
    </div>
  );
});

/* ================================================================== */
/*  Bottom Bar                                                         */
/* ================================================================== */

interface BottomBarProps {
  c: ReturnType<typeof t>;
  onNewPage: () => void;
  onTodayJournal: () => void;
}

const BottomBar = memo(function BottomBar({ c, onNewPage, onTodayJournal }: BottomBarProps) {
  return (
    <div style={{
      padding: '8px 8px',
      borderTop: `1px solid ${c.border}`,
      display: 'flex',
      gap: 4,
    }}>
      <button
        onClick={onNewPage}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          height: 30,
          fontSize: '13px',
          fontWeight: 600,
          borderRadius: 4,
          border: 'none',
          background: 'transparent',
          color: c.muted,
          cursor: 'pointer',
          transition: 'background 0.1s, color 0.1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = c.hover;
          e.currentTarget.style.color = c.text;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = c.muted;
        }}
      >
        <PlusIcon style={{ width: 14, height: 14 }} />
        New Page
      </button>
      <button
        onClick={onTodayJournal}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          height: 30,
          fontSize: '13px',
          fontWeight: 600,
          borderRadius: 4,
          border: 'none',
          background: 'transparent',
          color: c.muted,
          cursor: 'pointer',
          transition: 'background 0.1s, color 0.1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = c.hover;
          e.currentTarget.style.color = c.accent;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = c.muted;
        }}
      >
        <CalendarIcon style={{ width: 14, height: 14 }} />
        Today
      </button>
    </div>
  );
});

/* ================================================================== */
/*  Utilities                                                          */
/* ================================================================== */

function highlightQuery(text: string, query: string, c: ReturnType<typeof t>): string {
  if (!query.trim()) return escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(text).replace(
    regex,
    `<mark style="background:rgba(244,189,111,0.25);color:${c.text};border-radius:2px;padding:0 1px;">$1</mark>`,
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
