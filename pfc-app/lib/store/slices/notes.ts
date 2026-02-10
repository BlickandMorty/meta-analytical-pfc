'use client';

import type {
  NoteBlock, NotePage, NoteBook, PageLink,
  NoteSearchResult, NoteAIState, BlockType,
  Transaction, IOperation,
} from '@/lib/notes/types';
import {
  generateBlockId, generatePageId, normalizePageName,
  createEmptyBlock, createNewPage, getTodayJournalDate,
  extractPageLinks, orderBetween, migrateBlock, stripHtml,
} from '@/lib/notes/types';

// ═══════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════

export interface NotesSliceState {
  notePages: NotePage[];
  noteBlocks: NoteBlock[];
  noteBooks: NoteBook[];
  pageLinks: PageLink[];

  // UI
  activePageId: string | null;
  activeBlockId: string | null;
  editingBlockId: string | null;
  notesSidebarOpen: boolean;
  notesSidebarView: 'pages' | 'journals' | 'books' | 'graph';
  notesSearchQuery: string;

  // Undo/redo (SiYuan-inspired transaction system)
  undoStack: Transaction[];
  redoStack: Transaction[];

  // AI
  noteAI: NoteAIState;
}

// ═══════════════════════════════════════════════════════════════════
// Actions
// ═══════════════════════════════════════════════════════════════════

export interface NotesSliceActions {
  // Pages
  createPage: (title: string, isJournal?: boolean) => string;
  deletePage: (pageId: string) => void;
  renamePage: (pageId: string, newTitle: string) => void;
  setActivePage: (pageId: string | null) => void;
  ensurePage: (title: string) => string;
  togglePageFavorite: (pageId: string) => void;
  togglePagePin: (pageId: string) => void;

  // Blocks
  createBlock: (pageId: string, parentId?: string | null, afterBlockId?: string | null, content?: string, type?: BlockType) => string;
  updateBlockContent: (blockId: string, content: string) => void;
  deleteBlock: (blockId: string) => void;
  indentBlock: (blockId: string) => void;
  outdentBlock: (blockId: string) => void;
  moveBlock: (blockId: string, newParentId: string | null, afterBlockId: string | null) => void;
  toggleBlockCollapse: (blockId: string) => void;
  setEditingBlock: (blockId: string | null) => void;
  changeBlockType: (blockId: string, type: BlockType, props?: Record<string, string>) => void;
  mergeBlockUp: (blockId: string) => string | null;
  splitBlock: (blockId: string, htmlBefore: string, htmlAfter: string) => string;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  pushTransaction: (doOps: IOperation[], undoOps: IOperation[]) => void;

  // Journal
  getOrCreateTodayJournal: () => string;

  // Search
  setNotesSearchQuery: (query: string) => void;
  searchNotes: (query: string) => NoteSearchResult[];

  // Sidebar
  toggleNotesSidebar: () => void;
  setNotesSidebarView: (view: 'pages' | 'journals' | 'books' | 'graph') => void;

  // Books
  createNoteBook: (title: string, pageIds?: string[]) => string;
  addPageToBook: (bookId: string, pageId: string) => void;
  removePageFromBook: (bookId: string, pageId: string) => void;
  movePageToBook: (pageId: string, targetBookId: string | null) => void;

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

// ── Constants ──
const STORAGE_KEY_PAGES = 'pfc-note-pages';
const STORAGE_KEY_BLOCKS = 'pfc-note-blocks';
const STORAGE_KEY_BOOKS = 'pfc-note-books';
const MAX_UNDO_STACK = 64;
const SAVE_DEBOUNCE_MS = 500;

// ═══════════════════════════════════════════════════════════════════
// Slice Creator
// ═══════════════════════════════════════════════════════════════════

export const createNotesSlice = (set: any, get: any) => ({
  // ── Initial State ──
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

  undoStack: [] as Transaction[],
  redoStack: [] as Transaction[],

  noteAI: {
    isGenerating: false,
    targetPageId: null,
    targetBlockId: null,
    generatedText: '',
    prompt: '',
  } as NoteAIState,

  // ═════════════════════════════════════════════════════════════════
  // Transaction System (SiYuan-inspired)
  // 64-entry undo stack, operation pairs for reliable undo/redo
  // ═════════════════════════════════════════════════════════════════

  pushTransaction: (doOps: IOperation[], undoOps: IOperation[]) => {
    const txn: Transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      doOps,
      undoOps,
    };
    set((s: any) => ({
      undoStack: [...s.undoStack.slice(-MAX_UNDO_STACK + 1), txn],
      redoStack: [], // Clear redo on new action
    }));
  },

  undo: () => {
    const s = get();
    if (s.undoStack.length === 0) return;

    const txn = s.undoStack[s.undoStack.length - 1];
    let blocks = [...s.noteBlocks];

    // Apply undo operations
    for (const op of txn.undoOps) {
      switch (op.action) {
        case 'insert':
          // Undo insert = delete the block
          blocks = blocks.filter((b: NoteBlock) => b.id !== op.blockId);
          break;
        case 'delete':
          // Undo delete = re-insert the block
          if (op.previousData) blocks.push(op.previousData);
          break;
        case 'update':
          blocks = blocks.map((b: NoteBlock) =>
            b.id === op.blockId ? { ...b, content: op.previousData?.content ?? b.content, updatedAt: Date.now() } : b
          );
          break;
        case 'setBlockType':
          blocks = blocks.map((b: NoteBlock) =>
            b.id === op.blockId
              ? { ...b, type: op.previousData?.type ?? b.type, properties: op.previousData?.properties ?? b.properties, updatedAt: Date.now() }
              : b
          );
          break;
        case 'move':
          blocks = blocks.map((b: NoteBlock) =>
            b.id === op.blockId
              ? { ...b, parentId: op.previousData?.parentId, order: op.previousData?.order, indent: op.previousData?.indent ?? b.indent, updatedAt: Date.now() }
              : b
          );
          break;
      }
    }

    set((s: any) => ({
      noteBlocks: blocks,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, txn],
    }));

    debouncedSave(get);
  },

  redo: () => {
    const s = get();
    if (s.redoStack.length === 0) return;

    const txn = s.redoStack[s.redoStack.length - 1];
    let blocks = [...s.noteBlocks];

    // Apply do operations
    for (const op of txn.doOps) {
      switch (op.action) {
        case 'insert':
          if (op.data) blocks.push(op.data);
          break;
        case 'delete':
          blocks = blocks.filter((b: NoteBlock) => b.id !== op.blockId);
          break;
        case 'update':
          blocks = blocks.map((b: NoteBlock) =>
            b.id === op.blockId ? { ...b, content: op.data?.content ?? b.content, updatedAt: Date.now() } : b
          );
          break;
        case 'setBlockType':
          blocks = blocks.map((b: NoteBlock) =>
            b.id === op.blockId
              ? { ...b, type: op.data?.type ?? b.type, properties: op.data?.properties ?? b.properties, updatedAt: Date.now() }
              : b
          );
          break;
        case 'move':
          blocks = blocks.map((b: NoteBlock) =>
            b.id === op.blockId
              ? { ...b, parentId: op.data?.parentId, order: op.data?.order, indent: op.data?.indent ?? b.indent, updatedAt: Date.now() }
              : b
          );
          break;
      }
    }

    set((s: any) => ({
      noteBlocks: blocks,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, txn],
    }));

    debouncedSave(get);
  },

  // ═════════════════════════════════════════════════════════════════
  // Page Operations
  // ═════════════════════════════════════════════════════════════════

  createPage: (title: string, isJournal: boolean = false): string => {
    const journalDate = isJournal ? getTodayJournalDate() : undefined;
    const page = createNewPage(title, isJournal, journalDate);
    const firstBlock = createEmptyBlock(page.id, null, 'a0');

    set((s: any) => ({
      notePages: [...s.notePages, page],
      noteBlocks: [...s.noteBlocks, firstBlock],
      activePageId: page.id,
    }));

    debouncedSave(get);
    return page.id;
  },

  deletePage: (pageId: string) => {
    set((s: any) => ({
      notePages: s.notePages.filter((p: NotePage) => p.id !== pageId),
      noteBlocks: s.noteBlocks.filter((b: NoteBlock) => b.pageId !== pageId),
      pageLinks: s.pageLinks.filter((l: PageLink) => l.sourcePageId !== pageId && l.targetPageId !== pageId),
      activePageId: s.activePageId === pageId ? null : s.activePageId,
    }));
    debouncedSave(get);
  },

  renamePage: (pageId: string, newTitle: string) => {
    set((s: any) => ({
      notePages: s.notePages.map((p: NotePage) =>
        p.id === pageId
          ? { ...p, title: newTitle, name: normalizePageName(newTitle), updatedAt: Date.now() }
          : p
      ),
    }));
    debouncedSave(get);
  },

  setActivePage: (pageId: string | null) => set({ activePageId: pageId, editingBlockId: null }),

  ensurePage: (title: string): string => {
    const s = get();
    const normalized = normalizePageName(title);
    const existing = s.notePages.find((p: NotePage) => p.name === normalized);
    if (existing) return existing.id;
    return get().createPage(title);
  },

  togglePageFavorite: (pageId: string) => {
    set((s: any) => ({
      notePages: s.notePages.map((p: NotePage) =>
        p.id === pageId ? { ...p, favorite: !p.favorite } : p
      ),
    }));
    debouncedSave(get);
  },

  togglePagePin: (pageId: string) => {
    set((s: any) => ({
      notePages: s.notePages.map((p: NotePage) =>
        p.id === pageId ? { ...p, pinned: !p.pinned } : p
      ),
    }));
    debouncedSave(get);
  },

  // ═════════════════════════════════════════════════════════════════
  // Block Operations (with transaction recording)
  // ═════════════════════════════════════════════════════════════════

  createBlock: (
    pageId: string,
    parentId: string | null = null,
    afterBlockId: string | null = null,
    content: string = '',
    type: BlockType = 'paragraph',
  ): string => {
    const s = get();
    const siblings = s.noteBlocks
      .filter((b: NoteBlock) => b.pageId === pageId && b.parentId === parentId)
      .sort((a: NoteBlock, b: NoteBlock) => a.order.localeCompare(b.order));

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
      type,
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

    // Record transaction
    get().pushTransaction(
      [{ action: 'insert', blockId: block.id, pageId, data: block }],
      [{ action: 'insert', blockId: block.id, pageId }],
    );

    if (block.refs.length > 0) get().rebuildPageLinks();
    debouncedSave(get);
    return block.id;
  },

  updateBlockContent: (blockId: string, content: string) => {
    const s = get();
    const oldBlock = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!oldBlock) return;

    const refs = extractPageLinks(content);
    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId ? { ...b, content, refs, updatedAt: Date.now() } : b
      ),
    }));

    // Batch content updates (don't push a txn for every keystroke)
    // Transaction is pushed on blur or explicit save
    clearTimeout((globalThis as any).__notesSaveTimer);
    (globalThis as any).__notesSaveTimer = setTimeout(() => {
      get().rebuildPageLinks();
      get().saveNotesToStorage();
    }, SAVE_DEBOUNCE_MS);
  },

  deleteBlock: (blockId: string) => {
    const s = get();
    const block = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!block) return;

    // Find children recursively
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

    const deletedBlocks = s.noteBlocks.filter((b: NoteBlock) => toDelete.has(b.id));

    set((s: any) => ({
      noteBlocks: s.noteBlocks.filter((b: NoteBlock) => !toDelete.has(b.id)),
      editingBlockId: s.editingBlockId && toDelete.has(s.editingBlockId) ? null : s.editingBlockId,
    }));

    // Record transaction
    get().pushTransaction(
      [{ action: 'delete', blockId, pageId: block.pageId }],
      deletedBlocks.map((b: NoteBlock) => ({ action: 'delete', blockId: b.id, pageId: b.pageId, previousData: b })),
    );

    debouncedSave(get);
  },

  changeBlockType: (blockId: string, type: BlockType, props?: Record<string, string>) => {
    const s = get();
    const block = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!block) return;

    const oldType = block.type;
    const oldProps = { ...block.properties };

    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId
          ? { ...b, type, properties: { ...b.properties, ...props }, content: '', updatedAt: Date.now() }
          : b
      ),
    }));

    get().pushTransaction(
      [{ action: 'setBlockType', blockId, pageId: block.pageId, data: { type, properties: props } }],
      [{ action: 'setBlockType', blockId, pageId: block.pageId, previousData: { type: oldType, properties: oldProps } }],
    );

    debouncedSave(get);
  },

  /** Merge block content into the previous block, returns the target block ID or null */
  mergeBlockUp: (blockId: string): string | null => {
    const s = get();
    const block = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!block) return null;

    // Find previous sibling
    const siblings = s.noteBlocks
      .filter((b: NoteBlock) => b.pageId === block.pageId && b.parentId === block.parentId)
      .sort((a: NoteBlock, b: NoteBlock) => a.order.localeCompare(b.order));

    const idx = siblings.findIndex((b: NoteBlock) => b.id === blockId);
    if (idx <= 0) return null;

    const prevBlock = siblings[idx - 1];
    if (prevBlock.type === 'divider') return null;

    const mergedContent = prevBlock.content + block.content;

    set((s: any) => ({
      noteBlocks: s.noteBlocks
        .map((b: NoteBlock) => b.id === prevBlock.id ? { ...b, content: mergedContent, updatedAt: Date.now() } : b)
        .filter((b: NoteBlock) => b.id !== blockId),
      editingBlockId: prevBlock.id,
    }));

    get().pushTransaction(
      [
        { action: 'update', blockId: prevBlock.id, pageId: block.pageId, data: { content: mergedContent } },
        { action: 'delete', blockId, pageId: block.pageId },
      ],
      [
        { action: 'update', blockId: prevBlock.id, pageId: block.pageId, previousData: { content: prevBlock.content } },
        { action: 'delete', blockId, pageId: block.pageId, previousData: block },
      ],
    );

    debouncedSave(get);
    return prevBlock.id;
  },

  /** Split a block at cursor: block becomes htmlBefore, new block gets htmlAfter. Returns new block ID. */
  splitBlock: (blockId: string, htmlBefore: string, htmlAfter: string): string => {
    const s = get();
    const block = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!block) return '';

    // Find next sibling order for new block
    const siblings = s.noteBlocks
      .filter((b: NoteBlock) => b.pageId === block.pageId && b.parentId === block.parentId)
      .sort((a: NoteBlock, b: NoteBlock) => a.order.localeCompare(b.order));

    const idx = siblings.findIndex((b: NoteBlock) => b.id === blockId);
    const nextSibling = siblings[idx + 1];
    const newOrder = orderBetween(block.order, nextSibling?.order ?? null);

    const newBlock: NoteBlock = {
      id: generateBlockId(),
      type: 'paragraph',
      content: htmlAfter,
      parentId: block.parentId,
      pageId: block.pageId,
      order: newOrder,
      collapsed: false,
      indent: block.indent,
      properties: {},
      refs: extractPageLinks(htmlAfter),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((s: any) => ({
      noteBlocks: [
        ...s.noteBlocks.map((b: NoteBlock) =>
          b.id === blockId ? { ...b, content: htmlBefore, updatedAt: Date.now() } : b
        ),
        newBlock,
      ],
      editingBlockId: newBlock.id,
    }));

    get().pushTransaction(
      [
        { action: 'update', blockId, pageId: block.pageId, data: { content: htmlBefore } },
        { action: 'insert', blockId: newBlock.id, pageId: block.pageId, data: newBlock },
      ],
      [
        { action: 'update', blockId, pageId: block.pageId, previousData: { content: block.content } },
        { action: 'insert', blockId: newBlock.id, pageId: block.pageId },
      ],
    );

    debouncedSave(get);
    return newBlock.id;
  },

  indentBlock: (blockId: string) => {
    const s = get();
    const block = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!block) return;

    const siblings = s.noteBlocks
      .filter((b: NoteBlock) => b.pageId === block.pageId && b.parentId === block.parentId)
      .sort((a: NoteBlock, b: NoteBlock) => a.order.localeCompare(b.order));

    const idx = siblings.findIndex((b: NoteBlock) => b.id === blockId);
    if (idx <= 0) return;

    const newParent = siblings[idx - 1];
    const oldParentId = block.parentId;
    const oldOrder = block.order;
    const oldIndent = block.indent;

    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId
          ? { ...b, parentId: newParent.id, indent: (newParent.indent ?? 0) + 1, updatedAt: Date.now() }
          : b
      ),
    }));

    get().pushTransaction(
      [{ action: 'move', blockId, pageId: block.pageId, data: { parentId: newParent.id, indent: (newParent.indent ?? 0) + 1 } }],
      [{ action: 'move', blockId, pageId: block.pageId, previousData: { parentId: oldParentId, order: oldOrder, indent: oldIndent } }],
    );

    debouncedSave(get);
  },

  outdentBlock: (blockId: string) => {
    const s = get();
    const block = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!block || !block.parentId) return;

    const parent = s.noteBlocks.find((b: NoteBlock) => b.id === block.parentId);
    if (!parent) return;

    const oldParentId = block.parentId;
    const oldOrder = block.order;
    const oldIndent = block.indent;

    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId
          ? { ...b, parentId: parent.parentId, indent: Math.max(0, (block.indent ?? 1) - 1), updatedAt: Date.now() }
          : b
      ),
    }));

    get().pushTransaction(
      [{ action: 'move', blockId, pageId: block.pageId, data: { parentId: parent.parentId, indent: Math.max(0, (block.indent ?? 1) - 1) } }],
      [{ action: 'move', blockId, pageId: block.pageId, previousData: { parentId: oldParentId, order: oldOrder, indent: oldIndent } }],
    );

    debouncedSave(get);
  },

  moveBlock: (blockId: string, newParentId: string | null, afterBlockId: string | null) => {
    const s = get();
    const block = s.noteBlocks.find((b: NoteBlock) => b.id === blockId);
    if (!block) return;

    const siblings = s.noteBlocks.filter((b: NoteBlock) =>
      b.pageId === block.pageId && b.parentId === newParentId
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

    const oldParentId = block.parentId;
    const oldOrder = block.order;
    const oldIndent = block.indent;

    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId
          ? { ...b, parentId: newParentId, order, indent: parentIndent, updatedAt: Date.now() }
          : b
      ),
    }));

    get().pushTransaction(
      [{ action: 'move', blockId, pageId: block.pageId, data: { parentId: newParentId, order, indent: parentIndent } }],
      [{ action: 'move', blockId, pageId: block.pageId, previousData: { parentId: oldParentId, order: oldOrder, indent: oldIndent } }],
    );

    debouncedSave(get);
  },

  toggleBlockCollapse: (blockId: string) => {
    set((s: any) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId ? { ...b, collapsed: !b.collapsed } : b
      ),
    }));
  },

  setEditingBlock: (blockId: string | null) => set({ editingBlockId: blockId }),

  // ═════════════════════════════════════════════════════════════════
  // Journal
  // ═════════════════════════════════════════════════════════════════

  getOrCreateTodayJournal: (): string => {
    const s = get();
    const today = getTodayJournalDate();
    const existing = s.notePages.find((p: NotePage) => p.isJournal && p.journalDate === today);
    if (existing) {
      set({ activePageId: existing.id });
      return existing.id;
    }
    const d = new Date();
    const title = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return get().createPage(title, true);
  },

  // ═════════════════════════════════════════════════════════════════
  // Search
  // ═════════════════════════════════════════════════════════════════

  setNotesSearchQuery: (query: string) => set({ notesSearchQuery: query }),

  searchNotes: (query: string): NoteSearchResult[] => {
    if (!query.trim()) return [];
    const s = get();
    const q = query.toLowerCase();
    const results: NoteSearchResult[] = [];

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

    for (const block of s.noteBlocks) {
      const text = stripHtml(block.content).toLowerCase();
      if (text.includes(q)) {
        const page = s.notePages.find((p: NotePage) => p.id === block.pageId);
        results.push({
          type: 'block',
          pageId: block.pageId,
          blockId: block.id,
          title: page?.title ?? 'Unknown',
          snippet: stripHtml(block.content).slice(0, 120),
          score: text.startsWith(q) ? 1.5 : 0.5,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 20);
  },

  // ═════════════════════════════════════════════════════════════════
  // Sidebar
  // ═════════════════════════════════════════════════════════════════

  toggleNotesSidebar: () => set((s: any) => ({ notesSidebarOpen: !s.notesSidebarOpen })),

  setNotesSidebarView: (view: 'pages' | 'journals' | 'books' | 'graph') =>
    set({ notesSidebarView: view }),

  // ═════════════════════════════════════════════════════════════════
  // Books
  // ═════════════════════════════════════════════════════════════════

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
    debouncedSave(get);
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
    debouncedSave(get);
  },

  removePageFromBook: (bookId: string, pageId: string) => {
    set((s: any) => ({
      noteBooks: s.noteBooks.map((b: NoteBook) =>
        b.id === bookId
          ? { ...b, pageIds: b.pageIds.filter((id: string) => id !== pageId), updatedAt: Date.now() }
          : b
      ),
    }));
    debouncedSave(get);
  },

  movePageToBook: (pageId: string, targetBookId: string | null) => {
    set((s: any) => {
      const now = Date.now();
      // Remove from any existing book, then add to target
      const updated = s.noteBooks.map((b: NoteBook) => {
        const hadPage = b.pageIds.includes(pageId);
        const isTarget = b.id === targetBookId;
        let ids = hadPage ? b.pageIds.filter((id: string) => id !== pageId) : b.pageIds;
        if (isTarget && !ids.includes(pageId)) ids = [...ids, pageId];
        if (hadPage || isTarget) return { ...b, pageIds: ids, updatedAt: now };
        return b;
      });
      return { noteBooks: updated };
    });
    debouncedSave(get);
  },

  // ═════════════════════════════════════════════════════════════════
  // AI
  // ═════════════════════════════════════════════════════════════════

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

  // ═════════════════════════════════════════════════════════════════
  // Persistence
  // ═════════════════════════════════════════════════════════════════

  loadNotesFromStorage: () => {
    try {
      const pagesRaw = localStorage.getItem(STORAGE_KEY_PAGES);
      const blocksRaw = localStorage.getItem(STORAGE_KEY_BLOCKS);
      const booksRaw = localStorage.getItem(STORAGE_KEY_BOOKS);

      const notePages = pagesRaw ? JSON.parse(pagesRaw) : [];
      const rawBlocks = blocksRaw ? JSON.parse(blocksRaw) : [];
      const noteBlocks = rawBlocks.map(migrateBlock);
      const noteBooks = booksRaw ? JSON.parse(booksRaw) : [];

      set({ notePages, noteBlocks, noteBooks });
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
            context: stripHtml(block.content).slice(0, 100),
          });
        }
      }
    }

    set({ pageLinks: links });
  },

  getBacklinks: (pageId: string): PageLink[] => {
    const s = get();
    return s.pageLinks.filter((l: PageLink) => l.targetPageId === pageId);
  },
});

// ── Debounced save helper ──
function debouncedSave(get: any) {
  clearTimeout((globalThis as any).__notesSaveTimer);
  (globalThis as any).__notesSaveTimer = setTimeout(() => {
    get().saveNotesToStorage();
  }, 300);
}
