'use client';

import type {
  NoteBlock, NotePage, NoteBook, PageLink,
  NoteSearchResult, NoteAIState, BlockType,
  Transaction, IOperation, Vault, Concept, ConceptCorrelation,
} from '@/lib/notes/types';
import type { PFCSet, PFCGet } from '../use-pfc-store';
import {
  generateBlockId, generatePageId, normalizePageName,
  createEmptyBlock, createNewPage, getTodayJournalDate,
  extractPageLinks, orderBetween, migrateBlock, stripHtml,
  generateVaultId,
} from '@/lib/notes/types';

// ── Module-scope abort controller for Note AI SSE (not in Zustand state) ──
let _noteAIAbortController: AbortController | null = null;

// ═══════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════

export interface NotesSliceState {
  notePages: NotePage[];
  noteBlocks: NoteBlock[];
  noteBooks: NoteBook[];
  pageLinks: PageLink[];

  // Vault
  vaults: Vault[];
  activeVaultId: string | null;
  vaultReady: boolean;

  // Concepts
  concepts: Concept[];
  conceptCorrelations: ConceptCorrelation[];

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
  rebuildPageLinks: () => void;
  getBacklinks: (pageId: string) => PageLink[];

  // Vault
  createVault: (name: string) => string;
  switchVault: (vaultId: string) => void;
  deleteVault: (vaultId: string) => void;
  renameVault: (vaultId: string, name: string) => void;
  loadVaultIndex: () => void;

  // Concepts
  extractConcepts: (pageId: string) => void;
  addConcept: (concept: Omit<Concept, 'id' | 'createdAt'>) => string;
  removeConcept: (conceptId: string) => void;
  getPageConcepts: (pageId: string) => Concept[];
  correlatePages: (pageAId: string, pageBId: string) => ConceptCorrelation[];
}

// ── Constants ──
const STORAGE_KEY_VAULTS = 'pfc-vaults';
const STORAGE_KEY_ACTIVE_VAULT = 'pfc-active-vault';
const MAX_UNDO_STACK = 64;
const SAVE_DEBOUNCE_MS = 500;

// ── Module-level debounce timers (replaces globalThis hack) ──
let _notesSaveTimer: ReturnType<typeof setTimeout> | null = null;
let _notesContentTimer: ReturnType<typeof setTimeout> | null = null;

// Vault-scoped storage keys
function vaultKey(vaultId: string, suffix: string): string {
  return `pfc-vault-${vaultId}-${suffix}`;
}

// ═══════════════════════════════════════════════════════════════════
// Note AI SSE connection — calls /api/notes-ai and streams response
// Same pattern as connectLearningSSE in the learning slice
// ═══════════════════════════════════════════════════════════════════

function connectNoteAISSE(set: PFCSet, get: PFCGet) {
  const state = get();
  const noteAI: NoteAIState = state.noteAI;
  if (!noteAI || !noteAI.isGenerating) return;

  // Abort any existing connection
  if (_noteAIAbortController) {
    _noteAIAbortController.abort();
  }

  const controller = new AbortController();
  _noteAIAbortController = controller;

  // Gather note data
  const notePages = state.notePages ?? [];
  const noteBlocks = state.noteBlocks ?? [];

  // Gather inference config
  const inferenceConfig = state.getInferenceConfig
    ? state.getInferenceConfig()
    : {
        mode: state.inferenceMode ?? 'simulation',
        apiProvider: state.apiProvider ?? 'openai',
        apiKey: state.apiKey ?? '',
        openaiModel: state.openaiModel ?? 'gpt-4o',
        anthropicModel: state.anthropicModel ?? 'claude-sonnet-4-20250514',
        ollamaBaseUrl: state.ollamaBaseUrl ?? 'http://localhost:11434',
        ollamaModel: state.ollamaModel ?? 'llama3.1',
      };

  (async () => {
    try {
      const response = await fetch('/api/notes-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: notePages,
          blocks: noteBlocks,
          prompt: noteAI.prompt,
          targetBlockId: noteAI.targetBlockId,
          inferenceConfig,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          if (data === '[DONE]') {
            set((s) => ({
              noteAI: { ...s.noteAI, isGenerating: false },
            }));
            continue;
          }

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case 'text': {
                set((s) => ({
                  noteAI: {
                    ...s.noteAI,
                    generatedText: s.noteAI.generatedText + event.text,
                  },
                }));
                break;
              }
              case 'done': {
                set((s) => ({
                  noteAI: { ...s.noteAI, isGenerating: false },
                }));
                break;
              }
              case 'error': {
                console.error('[note-ai] SSE error:', event.message);
                set((s) => ({
                  noteAI: { ...s.noteAI, isGenerating: false },
                }));
                break;
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[note-ai] Stream error:', error);
        set((s) => ({
          noteAI: { ...s.noteAI, isGenerating: false },
        }));
      }
    } finally {
      _noteAIAbortController = null;
    }
  })();
}

// ═══════════════════════════════════════════════════════════════════
// Slice Creator
// ═══════════════════════════════════════════════════════════════════

export const createNotesSlice = (set: PFCSet, get: PFCGet) => ({
  // ── Initial State ──
  notePages: [] as NotePage[],
  noteBlocks: [] as NoteBlock[],
  noteBooks: [] as NoteBook[],
  pageLinks: [] as PageLink[],

  // Vault
  vaults: [] as Vault[],
  activeVaultId: null as string | null,
  vaultReady: false,

  // Concepts
  concepts: [] as Concept[],
  conceptCorrelations: [] as ConceptCorrelation[],

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
    set((s) => ({
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

    set((s) => ({
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

    set((s) => ({
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

    set((s) => ({
      notePages: [...s.notePages, page],
      noteBlocks: [...s.noteBlocks, firstBlock],
      activePageId: page.id,
    }));

    debouncedSave(get);
    return page.id;
  },

  deletePage: (pageId: string) => {
    set((s) => ({
      notePages: s.notePages.filter((p: NotePage) => p.id !== pageId),
      noteBlocks: s.noteBlocks.filter((b: NoteBlock) => b.pageId !== pageId),
      pageLinks: s.pageLinks.filter((l: PageLink) => l.sourcePageId !== pageId && l.targetPageId !== pageId),
      activePageId: s.activePageId === pageId ? null : s.activePageId,
    }));
    debouncedSave(get);
  },

  renamePage: (pageId: string, newTitle: string) => {
    const s = get();
    const page = s.notePages.find((p: NotePage) => p.id === pageId);
    if (!page) return;
    const oldTitle = page.title;

    set((s) => {
      // Update all blocks that reference the old page name via [[links]]
      const escOld = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const linkRegex = new RegExp(`\\[\\[${escOld}\\]\\]`, 'gi');
      const updatedBlocks = s.noteBlocks.map((b: NoteBlock) => {
        if (b.refs.some((r: string) => normalizePageName(r) === normalizePageName(oldTitle))) {
          const newContent = b.content.replace(linkRegex, `[[${newTitle}]]`);
          return { ...b, content: newContent, refs: extractPageLinks(newContent), updatedAt: Date.now() };
        }
        return b;
      });

      return {
        notePages: s.notePages.map((p: NotePage) =>
          p.id === pageId
            ? { ...p, title: newTitle, name: normalizePageName(newTitle), updatedAt: Date.now() }
            : p
        ),
        noteBlocks: updatedBlocks,
      };
    });

    get().rebuildPageLinks();
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
    set((s) => ({
      notePages: s.notePages.map((p: NotePage) =>
        p.id === pageId ? { ...p, favorite: !p.favorite } : p
      ),
    }));
    debouncedSave(get);
  },

  togglePagePin: (pageId: string) => {
    set((s) => ({
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

    set((s) => ({
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
    set((s) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === blockId ? { ...b, content, refs, updatedAt: Date.now() } : b
      ),
    }));

    // Batch content updates (don't push a txn for every keystroke)
    // Transaction is pushed on blur or explicit save
    if (_notesContentTimer) clearTimeout(_notesContentTimer);
    _notesContentTimer = setTimeout(() => {
      _notesContentTimer = null;
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

    // Find the best sibling to move cursor to (previous first, then next)
    let nextEditId: string | null = null;
    if (s.editingBlockId && toDelete.has(s.editingBlockId)) {
      const pageBlocks = s.noteBlocks.filter((b: NoteBlock) => b.pageId === block.pageId && !toDelete.has(b.id));
      const deletedIdx = s.noteBlocks.findIndex((b: NoteBlock) => b.id === blockId);
      // Find closest preceding sibling that's not being deleted
      let prevBlock: NoteBlock | null = null;
      let nextBlock: NoteBlock | null = null;
      for (let i = deletedIdx - 1; i >= 0; i--) {
        const b = s.noteBlocks[i];
        if (b.pageId === block.pageId && !toDelete.has(b.id)) {
          prevBlock = b;
          break;
        }
      }
      if (!prevBlock) {
        for (let i = deletedIdx + 1; i < s.noteBlocks.length; i++) {
          const b = s.noteBlocks[i];
          if (b.pageId === block.pageId && !toDelete.has(b.id)) {
            nextBlock = b;
            break;
          }
        }
      }
      nextEditId = (prevBlock ?? nextBlock)?.id ?? null;
    }

    set((s) => ({
      noteBlocks: s.noteBlocks.filter((b: NoteBlock) => !toDelete.has(b.id)),
      editingBlockId: s.editingBlockId && toDelete.has(s.editingBlockId) ? nextEditId : s.editingBlockId,
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

    set((s) => ({
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
    if (prevBlock.type === 'divider' || prevBlock.type === 'page-break') return null;

    const mergedContent = prevBlock.content + block.content;

    set((s) => ({
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

    set((s) => ({
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

    set((s) => ({
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

    set((s) => ({
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

    set((s) => ({
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
    set((s) => ({
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

  toggleNotesSidebar: () => set((s) => ({ notesSidebarOpen: !s.notesSidebarOpen })),

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
    set((s) => ({ noteBooks: [...s.noteBooks, book] }));
    debouncedSave(get);
    return book.id;
  },

  addPageToBook: (bookId: string, pageId: string) => {
    set((s) => ({
      noteBooks: s.noteBooks.map((b: NoteBook) =>
        b.id === bookId && !b.pageIds.includes(pageId)
          ? { ...b, pageIds: [...b.pageIds, pageId], updatedAt: Date.now() }
          : b
      ),
    }));
    debouncedSave(get);
  },

  removePageFromBook: (bookId: string, pageId: string) => {
    set((s) => ({
      noteBooks: s.noteBooks.map((b: NoteBook) =>
        b.id === bookId
          ? { ...b, pageIds: b.pageIds.filter((id: string) => id !== pageId), updatedAt: Date.now() }
          : b
      ),
    }));
    debouncedSave(get);
  },

  movePageToBook: (pageId: string, targetBookId: string | null) => {
    set((s) => {
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

  startNoteAIGeneration: (pageId: string, blockId: string | null, prompt: string) => {
    set({
      noteAI: {
        isGenerating: true,
        targetPageId: pageId,
        targetBlockId: blockId,
        generatedText: '',
        prompt,
      },
    });
    // Connect to SSE endpoint to stream the AI response
    connectNoteAISSE(set, get);
  },

  appendNoteAIText: (text: string) =>
    set((s) => ({
      noteAI: { ...s.noteAI, generatedText: s.noteAI.generatedText + text },
    })),

  stopNoteAIGeneration: () => {
    // Abort the SSE fetch if active
    if (_noteAIAbortController) {
      _noteAIAbortController.abort();
      _noteAIAbortController = null;
    }
    set((s) => ({
      noteAI: { ...s.noteAI, isGenerating: false },
    }));
  },

  // ═════════════════════════════════════════════════════════════════
  // Vault System
  // ═════════════════════════════════════════════════════════════════

  loadVaultIndex: () => {
    try {
      const vaultsRaw = localStorage.getItem(STORAGE_KEY_VAULTS);
      const vaults: Vault[] = vaultsRaw ? JSON.parse(vaultsRaw) : [];
      const activeVaultId = localStorage.getItem(STORAGE_KEY_ACTIVE_VAULT);

      // Migrate: if old non-vault data exists, create a default vault and migrate
      const legacyPages = localStorage.getItem('pfc-note-pages');
      if (legacyPages && vaults.length === 0) {
        const defaultVault: Vault = {
          id: generateVaultId(),
          name: 'My Vault',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pageCount: 0,
        };
        vaults.push(defaultVault);
        // Migrate legacy data to vault-scoped keys
        const legacyBlocks = localStorage.getItem('pfc-note-blocks');
        const legacyBooks = localStorage.getItem('pfc-note-books');
        if (legacyPages) localStorage.setItem(vaultKey(defaultVault.id, 'pages'), legacyPages);
        if (legacyBlocks) localStorage.setItem(vaultKey(defaultVault.id, 'blocks'), legacyBlocks);
        if (legacyBooks) localStorage.setItem(vaultKey(defaultVault.id, 'books'), legacyBooks);
        // Clean up legacy keys
        localStorage.removeItem('pfc-note-pages');
        localStorage.removeItem('pfc-note-blocks');
        localStorage.removeItem('pfc-note-books');
        localStorage.setItem(STORAGE_KEY_VAULTS, JSON.stringify(vaults));
        localStorage.setItem(STORAGE_KEY_ACTIVE_VAULT, defaultVault.id);
        set({ vaults, activeVaultId: defaultVault.id, vaultReady: true });
        return;
      }

      set({ vaults, activeVaultId: activeVaultId || (vaults[0]?.id ?? null), vaultReady: true });
    } catch {
      set({ vaultReady: true });
    }
  },

  createVault: (name: string): string => {
    const vault: Vault = {
      id: generateVaultId(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageCount: 0,
    };
    set((s) => ({ vaults: [...s.vaults, vault] }));
    try {
      const s = get();
      localStorage.setItem(STORAGE_KEY_VAULTS, JSON.stringify(s.vaults));
    } catch {}
    return vault.id;
  },

  switchVault: (vaultId: string) => {
    // Save current vault synchronously (not debounced) to prevent data loss
    try {
      const s = get();
      const oldVid = s.activeVaultId;
      if (oldVid) {
        localStorage.setItem(vaultKey(oldVid, 'pages'), JSON.stringify(s.notePages));
        localStorage.setItem(vaultKey(oldVid, 'blocks'), JSON.stringify(s.noteBlocks));
        localStorage.setItem(vaultKey(oldVid, 'books'), JSON.stringify(s.noteBooks));
        localStorage.setItem(vaultKey(oldVid, 'concepts'), JSON.stringify(s.concepts));
      }
    } catch {}
    // Clear current data and switch
    set({
      notePages: [],
      noteBlocks: [],
      noteBooks: [],
      pageLinks: [],
      concepts: [],
      conceptCorrelations: [],
      activePageId: null,
      editingBlockId: null,
      activeVaultId: vaultId,
    });
    localStorage.setItem(STORAGE_KEY_ACTIVE_VAULT, vaultId);
    // Load new vault's data
    get().loadNotesFromStorage();
  },

  deleteVault: (vaultId: string) => {
    // Remove vault data from storage
    try {
      localStorage.removeItem(vaultKey(vaultId, 'pages'));
      localStorage.removeItem(vaultKey(vaultId, 'blocks'));
      localStorage.removeItem(vaultKey(vaultId, 'books'));
      localStorage.removeItem(vaultKey(vaultId, 'concepts'));
    } catch {}
    set((s) => {
      const vaults = s.vaults.filter((v: Vault) => v.id !== vaultId);
      localStorage.setItem(STORAGE_KEY_VAULTS, JSON.stringify(vaults));
      const newActiveId = s.activeVaultId === vaultId ? (vaults[0]?.id ?? null) : s.activeVaultId;
      if (newActiveId !== s.activeVaultId) {
        if (newActiveId) {
          localStorage.setItem(STORAGE_KEY_ACTIVE_VAULT, newActiveId);
        } else {
          localStorage.removeItem(STORAGE_KEY_ACTIVE_VAULT);
        }
      }
      return { vaults, activeVaultId: newActiveId };
    });
  },

  renameVault: (vaultId: string, name: string) => {
    set((s) => {
      const vaults = s.vaults.map((v: Vault) => v.id === vaultId ? { ...v, name, updatedAt: Date.now() } : v);
      localStorage.setItem(STORAGE_KEY_VAULTS, JSON.stringify(vaults));
      return { vaults };
    });
  },

  // ═════════════════════════════════════════════════════════════════
  // Concepts
  // ═════════════════════════════════════════════════════════════════

  extractConcepts: (pageId: string) => {
    const s = get();
    const pageBlocks = s.noteBlocks.filter((b: NoteBlock) => b.pageId === pageId);
    const newConcepts: Concept[] = [];

    for (const block of pageBlocks) {
      const text = stripHtml(block.content).trim();
      if (!text) continue;

      // Extract headings as concepts
      if (block.type === 'heading') {
        newConcepts.push({
          id: `concept-${block.id}`,
          name: text,
          sourcePageId: pageId,
          sourceBlockId: block.id,
          type: 'heading',
          context: text,
          createdAt: Date.now(),
        });
      }

      // Extract bold/strong terms as key concepts
      const boldMatches = block.content.matchAll(/<(?:strong|b)>([^<]+)<\/(?:strong|b)>/gi);
      for (const match of boldMatches) {
        const term = match[1].trim();
        if (term.length > 2 && term.length < 100) {
          newConcepts.push({
            id: `concept-bold-${block.id}-${term.slice(0, 20)}`,
            name: term,
            sourcePageId: pageId,
            sourceBlockId: block.id,
            type: 'key-term',
            context: text.slice(0, 150),
            createdAt: Date.now(),
          });
        }
      }

      // Extract [[linked]] terms as concepts
      const linkMatches = text.matchAll(/\[\[([^\]]+)\]\]/g);
      for (const match of linkMatches) {
        newConcepts.push({
          id: `concept-link-${block.id}-${match[1].slice(0, 20)}`,
          name: match[1],
          sourcePageId: pageId,
          sourceBlockId: block.id,
          type: 'entity',
          context: text.slice(0, 150),
          createdAt: Date.now(),
        });
      }
    }

    // Merge with existing concepts (replace page's concepts)
    set((s) => ({
      concepts: [
        ...s.concepts.filter((c: Concept) => c.sourcePageId !== pageId),
        ...newConcepts,
      ],
    }));
  },

  addConcept: (partial: Omit<Concept, 'id' | 'createdAt'>): string => {
    const id = `concept-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const concept: Concept = { ...partial, id, createdAt: Date.now() };
    set((s) => ({ concepts: [...s.concepts, concept] }));
    return id;
  },

  removeConcept: (conceptId: string) => {
    set((s) => ({
      concepts: s.concepts.filter((c: Concept) => c.id !== conceptId),
    }));
  },

  getPageConcepts: (pageId: string): Concept[] => {
    return get().concepts.filter((c: Concept) => c.sourcePageId === pageId);
  },

  correlatePages: (pageAId: string, pageBId: string): ConceptCorrelation[] => {
    const s = get();
    const conceptsA = s.concepts.filter((c: Concept) => c.sourcePageId === pageAId);
    const conceptsB = s.concepts.filter((c: Concept) => c.sourcePageId === pageBId);
    const correlations: ConceptCorrelation[] = [];

    // Find shared concepts (same name or similar)
    for (const a of conceptsA) {
      for (const b of conceptsB) {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA)) {
          correlations.push({
            id: `corr-${a.id}-${b.id}`,
            conceptAId: a.id,
            conceptBId: b.id,
            pageAId: pageAId,
            pageBId: pageBId,
            correlationType: 'shared-concept',
            description: `Both pages discuss "${a.name}"`,
            strength: nameA === nameB ? 1.0 : 0.7,
            createdAt: Date.now(),
          });
        }
      }
    }

    // Find [[link]] references between pages
    const blocksA = s.noteBlocks.filter((b: NoteBlock) => b.pageId === pageAId);
    const blocksB = s.noteBlocks.filter((b: NoteBlock) => b.pageId === pageBId);
    const pageA = s.notePages.find((p: NotePage) => p.id === pageAId);
    const pageB = s.notePages.find((p: NotePage) => p.id === pageBId);

    if (pageA && pageB) {
      const aLinksToB = blocksA.some((b: NoteBlock) =>
        b.refs.some((r: string) => normalizePageName(r) === pageB.name)
      );
      const bLinksToA = blocksB.some((b: NoteBlock) =>
        b.refs.some((r: string) => normalizePageName(r) === pageA.name)
      );

      if (aLinksToB || bLinksToA) {
        correlations.push({
          id: `corr-link-${pageAId}-${pageBId}`,
          conceptAId: pageAId,
          conceptBId: pageBId,
          pageAId, pageBId,
          correlationType: aLinksToB && bLinksToA ? 'supporting' : 'hierarchical',
          description: aLinksToB && bLinksToA
            ? `"${pageA.title}" and "${pageB.title}" reference each other`
            : aLinksToB
              ? `"${pageA.title}" links to "${pageB.title}"`
              : `"${pageB.title}" links to "${pageA.title}"`,
          strength: aLinksToB && bLinksToA ? 0.9 : 0.6,
          createdAt: Date.now(),
        });
      }
    }

    set({ conceptCorrelations: correlations });
    return correlations;
  },

  // ═════════════════════════════════════════════════════════════════
  // Persistence (vault-scoped)
  // ═════════════════════════════════════════════════════════════════

  loadNotesFromStorage: () => {
    try {
      const activeVaultId = get().activeVaultId;
      if (!activeVaultId) return;

      const pagesRaw = localStorage.getItem(vaultKey(activeVaultId, 'pages'));
      const blocksRaw = localStorage.getItem(vaultKey(activeVaultId, 'blocks'));
      const booksRaw = localStorage.getItem(vaultKey(activeVaultId, 'books'));
      const conceptsRaw = localStorage.getItem(vaultKey(activeVaultId, 'concepts'));

      const notePages = pagesRaw ? JSON.parse(pagesRaw) : [];
      const rawBlocks = blocksRaw ? JSON.parse(blocksRaw) : [];
      const noteBlocks = rawBlocks.map(migrateBlock);
      const noteBooks = booksRaw ? JSON.parse(booksRaw) : [];
      const concepts = conceptsRaw ? JSON.parse(conceptsRaw) : [];

      set({ notePages, noteBlocks, noteBooks, concepts });
      get().rebuildPageLinks();
    } catch {
      // Ignore parse errors
    }
  },

  saveNotesToStorage: () => {
    try {
      const s = get();
      const vid = s.activeVaultId;
      if (!vid) return;

      localStorage.setItem(vaultKey(vid, 'pages'), JSON.stringify(s.notePages));
      localStorage.setItem(vaultKey(vid, 'blocks'), JSON.stringify(s.noteBlocks));
      localStorage.setItem(vaultKey(vid, 'books'), JSON.stringify(s.noteBooks));
      localStorage.setItem(vaultKey(vid, 'concepts'), JSON.stringify(s.concepts));

      // Update vault page count
      set((st) => ({
        vaults: st.vaults.map((v: Vault) =>
          v.id === vid ? { ...v, pageCount: s.notePages.length, updatedAt: Date.now() } : v
        ),
      }));
      localStorage.setItem(STORAGE_KEY_VAULTS, JSON.stringify(get().vaults));
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
function debouncedSave(get: PFCGet) {
  if (_notesSaveTimer) clearTimeout(_notesSaveTimer);
  _notesSaveTimer = setTimeout(() => {
    _notesSaveTimer = null;
    get().saveNotesToStorage();
  }, 300);
}
