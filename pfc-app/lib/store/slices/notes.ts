'use client';

import type {
  NoteBlock, NotePage, NoteBook, PageLink,
  NoteSearchResult, NoteAIState,
} from '@/lib/notes/types';
import {
  generateBlockId, generatePageId, normalizePageName,
  createEmptyBlock, createNewPage, getTodayJournalDate,
  extractPageLinks, orderBetween,
} from '@/lib/notes/types';

// State
export interface NotesSliceState {
  // Core data
  notePages: NotePage[];
  noteBlocks: NoteBlock[];
  noteBooks: NoteBook[];
  pageLinks: PageLink[];

  // UI state
  activePageId: string | null;
  activeBlockId: string | null;
  editingBlockId: string | null;
  notesSidebarOpen: boolean;
  notesSidebarView: 'pages' | 'journals' | 'books' | 'graph';
  notesSearchQuery: string;

  // AI state
  noteAI: NoteAIState;
}

// Actions
export interface NotesSliceActions {
  // Page operations
  createPage: (title: string, isJournal?: boolean) => string;
  deletePage: (pageId: string) => void;
  renamePage: (pageId: string, newTitle: string) => void;
  setActivePage: (pageId: string | null) => void;
  togglePageFavorite: (pageId: string) => void;
  togglePagePin: (pageId: string) => void;

  // Block operations
  createBlock: (pageId: string, parentId?: string | null, afterBlockId?: string | null, content?: string) => string;
  updateBlockContent: (blockId: string, content: string) => void;
  deleteBlock: (blockId: string) => void;
  indentBlock: (blockId: string) => void;
  outdentBlock: (blockId: string) => void;
  moveBlock: (blockId: string, newParentId: string | null, afterBlockId: string | null) => void;
  toggleBlockCollapse: (blockId: string) => void;
  setEditingBlock: (blockId: string | null) => void;

  // Journal
  getOrCreateTodayJournal: () => string;

  // Search
  setNotesSearchQuery: (query: string) => void;
  searchNotes: (query: string) => NoteSearchResult[];

  // Sidebar
  toggleNotesSidebar: () => void;
  setNotesSidebarView: (view: 'pages' | 'journals' | 'books' | 'graph') => void;

  // Books/Collections
  createNoteBook: (title: string, pageIds?: string[]) => string;
  addPageToBook: (bookId: string, pageId: string) => void;
  removePageFromBook: (bookId: string, pageId: string) => void;

  // AI
  startNoteAIGeneration: (pageId: string, blockId: string | null, prompt: string) => void;
  appendNoteAIText: (text: string) => void;
  stopNoteAIGeneration: () => void;

  // Persistence
  loadNotesFromStorage: () => void;
  saveNotesToStorage: () => void;

  // Backlinks
  getBacklinks: (pageId: string) => PageLink[];
}

// ── localStorage keys ──
const STORAGE_KEY_PAGES = 'pfc-note-pages';
const STORAGE_KEY_BLOCKS = 'pfc-note-blocks';
const STORAGE_KEY_BOOKS = 'pfc-note-books';

// ── Slice creator ──
export const createNotesSlice = (set: any, get: any) => ({
  // Initial state
  notePages: [] as NotePage[],
  noteBlocks: [] as NoteBlock[],
  noteBooks: [] as NoteBook[],
  pageLinks: [] as PageLink[],

  activePageId: null as string | null,
  activeBlockId: null as string | null,
  editingBlockId: null as string | null,
  notesSidebarOpen: true,
  notesSidebarView: 'pages' as 'pages' | 'journals' | 'books' | 'graph',
  notesSearchQuery: '',

  noteAI: {
    isGenerating: false,
    targetPageId: null,
    targetBlockId: null,
    generatedText: '',
    prompt: '',
  } as NoteAIState,

  // ── Page operations ──

  createPage: (title: string, isJournal: boolean = false): string => {
    const journalDate = isJournal ? getTodayJournalDate() : undefined;
    const page = createNewPage(title, isJournal, journalDate);
    const firstBlock = createEmptyBlock(page.id, null, 'a0');

    set((s: any) => ({
      notePages: [...s.notePages, page],
      noteBlocks: [...s.noteBlocks, firstBlock],
      activePageId: page.id,
    }));

    // Auto-save
    setTimeout(() => get().saveNotesToStorage(), 100);
    return page.id;
  },

  deletePage: (pageId: string) => {
    set((s: any) => ({
      notePages: s.notePages.filter((p: NotePage) => p.id !== pageId),
      noteBlocks: s.noteBlocks.filter((b: NoteBlock) => b.pageId !== pageId),
      pageLinks: s.pageLinks.filter((l: PageLink) => l.sourcePageId !== pageId && l.targetPageId !== pageId),
      activePageId: s.activePageId === pageId ? null : s.activePageId,
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  renamePage: (pageId: string, newTitle: string) => {
    set((s: any) => ({
      notePages: s.notePages.map((p: NotePage) =>
        p.id === pageId
          ? { ...p, title: newTitle, name: normalizePageName(newTitle), updatedAt: Date.now() }
          : p
      ),
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  setActivePage: (pageId: string | null) => set({ activePageId: pageId, editingBlockId: null }),

  togglePageFavorite: (pageId: string) => {
    set((s: any) => ({
      notePages: s.notePages.map((p: NotePage) =>
        p.id === pageId ? { ...p, favorite: !p.favorite } : p
      ),
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  togglePagePin: (pageId: string) => {
    set((s: any) => ({
      notePages: s.notePages.map((p: NotePage) =>
        p.id === pageId ? { ...p, pinned: !p.pinned } : p
      ),
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  // ── Block operations ──

  createBlock: (pageId: string, parentId: string | null = null, afterBlockId: string | null = null, content: string = ''): string => {
    const s = get();
    const siblings = s.noteBlocks.filter((b: NoteBlock) => b.pageId === pageId && b.parentId === parentId);

    let order: string;
    if (afterBlockId) {
      const afterBlock = siblings.find((b: NoteBlock) => b.id === afterBlockId);
      const afterIdx = siblings.indexOf(afterBlock!);
      const nextBlock = siblings[afterIdx + 1];
      order = orderBetween(afterBlock?.order ?? null, nextBlock?.order ?? null);
    } else {
      const lastBlock = siblings[siblings.length - 1];
      order = orderBetween(lastBlock?.order ?? null, null);
    }

    const block: NoteBlock = {
      id: generateBlockId(),
      content,
      parentId,
      pageId,
      order,
      collapsed: false,
      indent: parentId ? (s.noteBlocks.find((b: NoteBlock) => b.id === parentId)?.indent ?? 0) + 1 : 0,
      properties: {},
      refs: extractPageLinks(content),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((s: any) => ({
      noteBlocks: [...s.noteBlocks, block],
      editingBlockId: block.id,
    }));

    // Update page links
    if (block.refs.length > 0) {
      get().rebuildPageLinks();
    }

    setTimeout(() => get().saveNotesToStorage(), 300);
    return block.id;
  },

  updateBlockContent: (blockId: string, content: string) => {
    const refs = extractPageLinks(content);
    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId
          ? { ...b, content, refs, updatedAt: Date.now() }
          : b
      ),
    }));
    // Debounced save (called frequently during typing)
    clearTimeout((globalThis as any).__notesSaveTimer);
    (globalThis as any).__notesSaveTimer = setTimeout(() => {
      get().rebuildPageLinks();
      get().saveNotesToStorage();
    }, 500);
  },

  deleteBlock: (blockId: string) => {
    const s = get();
    // Find all children recursively
    const toDelete = new Set<string>([blockId]);
    let found = true;
    while (found) {
      found = false;
      for (const b of s.noteBlocks) {
        if (b.parentId && toDelete.has(b.parentId) && !toDelete.has(b.id)) {
          toDelete.add(b.id);
          found = true;
        }
      }
    }

    set((s: any) => ({
      noteBlocks: s.noteBlocks.filter((b: NoteBlock) => !toDelete.has(b.id)),
      editingBlockId: s.editingBlockId && toDelete.has(s.editingBlockId) ? null : s.editingBlockId,
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  indentBlock: (blockId: string) => {
    const s = get();
    const block = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!block) return;

    // Find previous sibling to become new parent
    const siblings = s.noteBlocks
      .filter((b: NoteBlock) => b.pageId === block.pageId && b.parentId === block.parentId)
      .sort((a: NoteBlock, b: NoteBlock) => a.order.localeCompare(b.order));

    const idx = siblings.findIndex((b: NoteBlock) => b.id === blockId);
    if (idx <= 0) return; // Can't indent first block

    const newParent = siblings[idx - 1];
    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId
          ? { ...b, parentId: newParent.id, indent: (newParent.indent ?? 0) + 1, updatedAt: Date.now() }
          : b
      ),
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  outdentBlock: (blockId: string) => {
    const s = get();
    const block = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!block || !block.parentId) return; // Can't outdent top-level

    const parent = s.noteBlocks.find((b: NoteBlock) => b.id === block.parentId);
    if (!parent) return;

    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId
          ? { ...b, parentId: parent.parentId, indent: Math.max(0, (block.indent ?? 1) - 1), updatedAt: Date.now() }
          : b
      ),
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  moveBlock: (blockId: string, newParentId: string | null, afterBlockId: string | null) => {
    const s = get();
    const siblings = s.noteBlocks.filter((b: NoteBlock) =>
      b.pageId === s.noteBlocks.find((bb: NoteBlock) => bb.id === blockId)?.pageId &&
      b.parentId === newParentId
    );

    let order: string;
    if (afterBlockId) {
      const afterBlock = siblings.find((b: NoteBlock) => b.id === afterBlockId);
      const afterIdx = siblings.indexOf(afterBlock!);
      const nextBlock = siblings[afterIdx + 1];
      order = orderBetween(afterBlock?.order ?? null, nextBlock?.order ?? null);
    } else {
      order = orderBetween(null, siblings[0]?.order ?? null);
    }

    const parentIndent = newParentId
      ? (s.noteBlocks.find((b: NoteBlock) => b.id === newParentId)?.indent ?? 0) + 1
      : 0;

    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId
          ? { ...b, parentId: newParentId, order, indent: parentIndent, updatedAt: Date.now() }
          : b
      ),
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  toggleBlockCollapse: (blockId: string) => {
    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId ? { ...b, collapsed: !b.collapsed } : b
      ),
    }));
  },

  setEditingBlock: (blockId: string | null) => set({ editingBlockId: blockId }),

  // ── Journal ──

  getOrCreateTodayJournal: (): string => {
    const s = get();
    const today = getTodayJournalDate();
    const existing = s.notePages.find((p: NotePage) => p.isJournal && p.journalDate === today);
    if (existing) {
      set({ activePageId: existing.id });
      return existing.id;
    }
    // Create today's journal
    const d = new Date();
    const title = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return get().createPage(title, true);
  },

  // ── Search ──

  setNotesSearchQuery: (query: string) => set({ notesSearchQuery: query }),

  searchNotes: (query: string): NoteSearchResult[] => {
    if (!query.trim()) return [];
    const s = get();
    const q = query.toLowerCase();
    const results: NoteSearchResult[] = [];

    // Search pages
    for (const page of s.notePages) {
      if (page.title.toLowerCase().includes(q) || page.name.includes(q)) {
        results.push({
          type: 'page',
          pageId: page.id,
          title: page.title,
          snippet: page.title,
          score: page.title.toLowerCase().startsWith(q) ? 2 : 1,
        });
      }
    }

    // Search blocks
    for (const block of s.noteBlocks) {
      if (block.content.toLowerCase().includes(q)) {
        const page = s.notePages.find((p: NotePage) => p.id === block.pageId);
        results.push({
          type: 'block',
          pageId: block.pageId,
          blockId: block.id,
          title: page?.title ?? 'Unknown',
          snippet: block.content.slice(0, 120),
          score: block.content.toLowerCase().startsWith(q) ? 1.5 : 0.5,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  },

  // ── Sidebar ──

  toggleNotesSidebar: () => set((s: any) => ({ notesSidebarOpen: !s.notesSidebarOpen })),

  setNotesSidebarView: (view: 'pages' | 'journals' | 'books' | 'graph') =>
    set({ notesSidebarView: view }),

  // ── Books ──

  createNoteBook: (title: string, pageIds: string[] = []): string => {
    const book: NoteBook = {
      id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      pageIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      autoGenerated: false,
      chapters: [],
    };
    set((s: any) => ({ noteBooks: [...s.noteBooks, book] }));
    setTimeout(() => get().saveNotesToStorage(), 100);
    return book.id;
  },

  addPageToBook: (bookId: string, pageId: string) => {
    set((s: any) => ({
      noteBooks: s.noteBooks.map((b: NoteBook) =>
        b.id === bookId && !b.pageIds.includes(pageId)
          ? { ...b, pageIds: [...b.pageIds, pageId], updatedAt: Date.now() }
          : b
      ),
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  removePageFromBook: (bookId: string, pageId: string) => {
    set((s: any) => ({
      noteBooks: s.noteBooks.map((b: NoteBook) =>
        b.id === bookId
          ? { ...b, pageIds: b.pageIds.filter((id: string) => id !== pageId), updatedAt: Date.now() }
          : b
      ),
    }));
    setTimeout(() => get().saveNotesToStorage(), 100);
  },

  // ── AI ──

  startNoteAIGeneration: (pageId: string, blockId: string | null, prompt: string) =>
    set({
      noteAI: {
        isGenerating: true,
        targetPageId: pageId,
        targetBlockId: blockId,
        generatedText: '',
        prompt,
      },
    }),

  appendNoteAIText: (text: string) =>
    set((s: any) => ({
      noteAI: { ...s.noteAI, generatedText: s.noteAI.generatedText + text },
    })),

  stopNoteAIGeneration: () =>
    set((s: any) => ({
      noteAI: { ...s.noteAI, isGenerating: false },
    })),

  // ── Persistence ──

  loadNotesFromStorage: () => {
    try {
      const pagesRaw = localStorage.getItem(STORAGE_KEY_PAGES);
      const blocksRaw = localStorage.getItem(STORAGE_KEY_BLOCKS);
      const booksRaw = localStorage.getItem(STORAGE_KEY_BOOKS);

      const notePages = pagesRaw ? JSON.parse(pagesRaw) : [];
      const noteBlocks = blocksRaw ? JSON.parse(blocksRaw) : [];
      const noteBooks = booksRaw ? JSON.parse(booksRaw) : [];

      set({ notePages, noteBlocks, noteBooks });

      // Rebuild links
      get().rebuildPageLinks();
    } catch {
      // Ignore parse errors
    }
  },

  saveNotesToStorage: () => {
    try {
      const s = get();
      localStorage.setItem(STORAGE_KEY_PAGES, JSON.stringify(s.notePages));
      localStorage.setItem(STORAGE_KEY_BLOCKS, JSON.stringify(s.noteBlocks));
      localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(s.noteBooks));
    } catch {
      // Storage full or unavailable
    }
  },

  // ── Internal: rebuild page links ──

  rebuildPageLinks: () => {
    const s = get();
    const links: PageLink[] = [];

    for (const block of s.noteBlocks) {
      const pageRefs = extractPageLinks(block.content);
      for (const ref of pageRefs) {
        const targetPage = s.notePages.find((p: NotePage) => p.name === normalizePageName(ref));
        if (targetPage) {
          links.push({
            sourcePageId: block.pageId,
            targetPageId: targetPage.id,
            sourceBlockId: block.id,
            context: block.content.slice(0, 100),
          });
        }
      }
    }

    set({ pageLinks: links });
  },

  // ── Backlinks ──

  getBacklinks: (pageId: string): PageLink[] => {
    const s = get();
    return s.pageLinks.filter((l: PageLink) => l.targetPageId === pageId);
  },
});
