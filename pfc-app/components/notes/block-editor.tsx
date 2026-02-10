'use client';

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type FocusEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRightIcon } from 'lucide-react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useTheme } from 'next-themes';

/* ═══════════════════════════════════════════════════════════════════
   BlockEditor — Notion/Obsidian-inspired editor

   Clean, flat design. Large text. Minimal UI. No glass morphism.
   ═══════════════════════════════════════════════════════════════════ */

interface NoteBlock {
  id: string;
  content: string;
  parentId: string | null;
  pageId: string;
  order: string;
  collapsed: boolean;
  indent: number;
  properties: Record<string, string>;
  refs: string[];
  createdAt: number;
  updatedAt: number;
}

const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];
const INDENT_PX = 24;
const ACCENT = '#C4956A';

const selectNoteBlocks = (s: any) => s.noteBlocks as NoteBlock[] | undefined;
const selectEditingBlockId = (s: any) => s.editingBlockId as string | null | undefined;
const selectNoteAI = (s: any) =>
  s.noteAI as { isGenerating: boolean; targetBlockId: string | null; streamedText?: string } | undefined;

// ── Markdown helpers ───────────────────────────────────────────────

function renderMarkdown(raw: string): string {
  let html = escapeHtml(raw);

  // Headings
  html = html.replace(/^### (.+)$/, '<span style="font-size:1rem;font-weight:600">$1</span>');
  html = html.replace(/^## (.+)$/, '<span style="font-size:1.25rem;font-weight:600">$1</span>');
  html = html.replace(/^# (.+)$/, '<span style="font-size:1.5rem;font-weight:700">$1</span>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600">$1</strong>');

  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    `<code style="padding:1px 6px;border-radius:4px;font-size:0.85em;font-family:var(--font-mono);background:rgba(196,149,106,0.08);color:${ACCENT}">$1</code>`,
  );

  // [[Page links]]
  html = html.replace(
    /\[\[([^\]]+)\]\]/g,
    `<span class="note-page-link" data-page="$1" style="color:${ACCENT};font-weight:500;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(196,149,106,0.3);text-underline-offset:2px">$1</span>`,
  );

  // Checkbox
  html = html.replace(
    /- \[x\]/g,
    '<span class="note-checkbox checked" data-checked="true" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;border:1.5px solid #34D399;background:rgba(52,211,153,0.15);margin-right:6px;cursor:pointer;vertical-align:middle"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#34D399" stroke-width="1.5" stroke-linecap="round"><path d="M2 5.5L4 7.5L8 3"/></svg></span>',
  );
  html = html.replace(
    /- \[ \]/g,
    '<span class="note-checkbox" data-checked="false" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;border:1.5px solid rgba(155,150,137,0.3);margin-right:6px;cursor:pointer;vertical-align:middle"></span>',
  );

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Block tree helpers ─────────────────────────────────────────────

function buildBlockTree(blocks: NoteBlock[], pageId: string) {
  const pageBlocks = blocks.filter((b) => b.pageId === pageId);
  const childMap = new Map<string | null, NoteBlock[]>();

  for (const b of pageBlocks) {
    const key = b.parentId;
    if (!childMap.has(key)) childMap.set(key, []);
    childMap.get(key)!.push(b);
  }

  childMap.forEach((children) => {
    children.sort((a, b) => a.order.localeCompare(b.order));
  });

  return childMap;
}

function flattenTree(
  childMap: Map<string | null, NoteBlock[]>,
  parentId: string | null,
  collapsedIds: Set<string>,
): NoteBlock[] {
  const result: NoteBlock[] = [];
  const children = childMap.get(parentId) ?? [];

  for (const block of children) {
    result.push(block);
    if (!collapsedIds.has(block.id)) {
      result.push(...flattenTree(childMap, block.id, collapsedIds));
    }
  }

  return result;
}

function hasChildren(childMap: Map<string | null, NoteBlock[]>, blockId: string): boolean {
  return (childMap.get(blockId)?.length ?? 0) > 0;
}

// ── BlockEditor (root) ─────────────────────────────────────────────

interface BlockEditorProps {
  pageId: string;
}

export function BlockEditor({ pageId }: BlockEditorProps) {
  const allBlocks = usePFCStore(selectNoteBlocks) ?? [];
  const editingBlockId = usePFCStore(selectEditingBlockId) ?? null;
  const noteAI = usePFCStore(selectNoteAI);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const createBlock = usePFCStore((s) => s.createBlock);
  const updateBlockContent = usePFCStore((s) => s.updateBlockContent);
  const deleteBlock = usePFCStore((s) => s.deleteBlock);
  const indentBlock = usePFCStore((s) => s.indentBlock);
  const outdentBlock = usePFCStore((s) => s.outdentBlock);
  const toggleBlockCollapse = usePFCStore((s) => s.toggleBlockCollapse);
  const setEditingBlock = usePFCStore((s) => s.setEditingBlock);
  const setActivePage = usePFCStore((s) => s.setActivePage);
  const ensurePage = usePFCStore((s) => s.ensurePage);

  const actionsRef = useRef({
    createBlock, updateBlockContent, deleteBlock, indentBlock, outdentBlock,
    toggleBlockCollapse, setEditingBlock, setActivePage, ensurePage,
  });
  actionsRef.current = {
    createBlock, updateBlockContent, deleteBlock, indentBlock, outdentBlock,
    toggleBlockCollapse, setEditingBlock, setActivePage, ensurePage,
  };
  const actions = actionsRef.current;

  const childMap = useMemo(() => buildBlockTree(allBlocks, pageId), [allBlocks, pageId]);
  const collapsedIds = useMemo(
    () => new Set<string>(allBlocks.filter((b) => b.collapsed).map((b) => b.id)),
    [allBlocks],
  );
  const flatBlocks = useMemo(
    () => flattenTree(childMap, null, collapsedIds),
    [childMap, collapsedIds],
  );

  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerRef = useCallback((blockId: string, el: HTMLDivElement | null) => {
    if (el) blockRefs.current.set(blockId, el);
    else blockRefs.current.delete(blockId);
  }, []);

  const focusBlock = useCallback((blockId: string) => {
    requestAnimationFrame(() => {
      const el = blockRefs.current.get(blockId);
      if (el) {
        el.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        if (sel) {
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });
  }, []);

  const handleContainerClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      const lastBlock = flatBlocks[flatBlocks.length - 1];
      const newId = actions.createBlock(pageId, null, lastBlock?.id ?? null, '');
      actions.setEditingBlock(newId);
      focusBlock(newId);
    },
    [flatBlocks, actions, pageId, focusBlock],
  );

  return (
    <div
      className="relative min-h-[300px] py-4 cursor-text"
      onClick={handleContainerClick}
      style={{ maxWidth: '48rem', margin: '0 auto' }}
    >
      {flatBlocks.map((block, idx) => (
        <BlockItem
          key={block.id}
          block={block}
          depth={block.indent}
          isEditing={editingBlockId === block.id}
          hasChildBlocks={hasChildren(childMap, block.id)}
          noteAI={noteAI}
          actions={actions}
          pageId={pageId}
          flatBlocks={flatBlocks}
          index={idx}
          registerRef={registerRef}
          focusBlock={focusBlock}
          isDark={isDark}
        />
      ))}

      {flatBlocks.length === 0 && (
        <div
          style={{
            padding: '1rem 0',
            fontSize: '1rem',
            color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.25)',
            userSelect: 'none',
          }}
        >
          Click anywhere to start writing...
        </div>
      )}
    </div>
  );
}

// ── BlockItem ───────────────────────────────────────────────────

interface BlockItemProps {
  block: NoteBlock;
  depth: number;
  isEditing: boolean;
  hasChildBlocks: boolean;
  noteAI: { isGenerating: boolean; targetBlockId: string | null; streamedText?: string } | undefined;
  actions: {
    createBlock: (pageId: string, parentId: string | null, afterBlockId: string | null, content: string) => string;
    updateBlockContent: (blockId: string, content: string) => void;
    deleteBlock: (blockId: string) => void;
    indentBlock: (blockId: string) => void;
    outdentBlock: (blockId: string) => void;
    toggleBlockCollapse: (blockId: string) => void;
    setEditingBlock: (blockId: string | null) => void;
    setActivePage: (pageId: string | null) => void;
    ensurePage?: (title: string) => string;
  };
  pageId: string;
  flatBlocks: NoteBlock[];
  index: number;
  registerRef: (blockId: string, el: HTMLDivElement | null) => void;
  focusBlock: (blockId: string) => void;
  isDark: boolean;
}

const BlockItem = memo<BlockItemProps>(function BlockItem({
  block,
  depth,
  isEditing,
  hasChildBlocks,
  noteAI,
  actions,
  pageId,
  flatBlocks,
  index,
  registerRef,
  focusBlock,
  isDark,
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const isAITarget =
    noteAI?.isGenerating === true && noteAI.targetBlockId === block.id;
  const [displayedChars, setDisplayedChars] = useState(0);
  const aiText = isAITarget ? (noteAI?.streamedText ?? block.content) : '';

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      (contentRef as any).current = el;
      registerRef(block.id, el);
    },
    [block.id, registerRef],
  );

  // Sync store content → DOM when not focused
  useEffect(() => {
    const el = contentRef.current;
    if (!el || isFocused) return;
    if (!isAITarget) {
      el.innerHTML = block.content ? renderMarkdown(block.content) : '';
    }
  }, [block.content, isFocused, isAITarget]);

  // When focusing, switch to raw text for editing
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (isFocused) {
      if (el.textContent !== block.content) {
        el.textContent = block.content;
      }
    }
  }, [isFocused, block.content]);

  // AI typing animation
  useEffect(() => {
    if (!isAITarget) { setDisplayedChars(0); return; }
    const target = aiText.length;
    if (displayedChars >= target) return;
    const timer = setTimeout(() => {
      setDisplayedChars((prev) => Math.min(prev + 1, target));
    }, 18 + Math.random() * 12);
    return () => clearTimeout(timer);
  }, [isAITarget, aiText, displayedChars]);

  useEffect(() => {
    if (!isAITarget || !contentRef.current) return;
    contentRef.current.textContent = aiText.slice(0, displayedChars);
  }, [isAITarget, aiText, displayedChars]);

  const handleFocus = useCallback(
    (_e: FocusEvent) => {
      setIsFocused(true);
      actions.setEditingBlock(block.id);
    },
    [actions, block.id],
  );

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const el = contentRef.current;
    if (el) {
      const text = el.textContent ?? '';
      if (text !== block.content) {
        actions.updateBlockContent(block.id, text);
      }
    }
  }, [actions, block.id, block.content]);

  const handleInput = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    actions.updateBlockContent(block.id, el.textContent ?? '');
  }, [actions, block.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const el = contentRef.current;
      if (!el) return;
      const text = el.textContent ?? '';

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        actions.updateBlockContent(block.id, text);
        const newId = actions.createBlock(pageId, block.parentId, block.id, '');
        actions.setEditingBlock(newId);
        focusBlock(newId);
        return;
      }

      if (e.key === 'Backspace' && text === '') {
        e.preventDefault();
        const prevBlock = index > 0 ? flatBlocks[index - 1] : null;
        actions.deleteBlock(block.id);
        if (prevBlock) {
          actions.setEditingBlock(prevBlock.id);
          focusBlock(prevBlock.id);
        }
        return;
      }

      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        actions.indentBlock(block.id);
        requestAnimationFrame(() => focusBlock(block.id));
        return;
      }

      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        actions.outdentBlock(block.id);
        requestAnimationFrame(() => focusBlock(block.id));
        return;
      }

      if (e.key === 'ArrowUp') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (range.startOffset === 0 && range.collapsed) {
            e.preventDefault();
            const prevBlock = index > 0 ? flatBlocks[index - 1] : null;
            if (prevBlock) {
              actions.setEditingBlock(prevBlock.id);
              focusBlock(prevBlock.id);
            }
          }
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const atEnd =
            range.collapsed &&
            range.startOffset === (range.startContainer.textContent?.length ?? 0);
          if (atEnd) {
            e.preventDefault();
            const nextBlock = index < flatBlocks.length - 1 ? flatBlocks[index + 1] : null;
            if (nextBlock) {
              actions.setEditingBlock(nextBlock.id);
              focusBlock(nextBlock.id);
            }
          }
        }
        return;
      }
    },
    [actions, block, pageId, flatBlocks, index, focusBlock],
  );

  const handleContentClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      const pageLink = target.closest('.note-page-link') as HTMLElement | null;
      if (pageLink) {
        e.preventDefault();
        e.stopPropagation();
        const pageName = pageLink.getAttribute('data-page');
        if (pageName && actions.ensurePage) {
          const targetPageId = actions.ensurePage(pageName);
          actions.setActivePage?.(targetPageId);
        }
        return;
      }

      const checkbox = target.closest('.note-checkbox') as HTMLElement | null;
      if (checkbox) {
        e.preventDefault();
        e.stopPropagation();
        const isChecked = checkbox.getAttribute('data-checked') === 'true';
        const updated = isChecked
          ? block.content.replace('- [x]', '- [ ]')
          : block.content.replace('- [ ]', '- [x]');
        actions.updateBlockContent(block.id, updated);
        return;
      }
    },
    [actions, block],
  );

  const handleCollapseToggle = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      actions.toggleBlockCollapse(block.id);
    },
    [actions, block.id],
  );

  const paddingLeft = depth * INDENT_PX + 4;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        paddingLeft,
        minHeight: 32,
        borderRadius: 6,
        transition: 'background 0.1s',
        background: isFocused
          ? (isDark ? 'rgba(196,149,106,0.04)' : 'rgba(196,149,106,0.03)')
          : 'transparent',
      }}
    >
      {/* Collapse chevron */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, minHeight: 32, flexShrink: 0, paddingTop: 7 }}>
        {hasChildBlocks ? (
          <button
            onClick={handleCollapseToggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
              transition: 'color 0.15s',
            }}
            aria-label={block.collapsed ? 'Expand' : 'Collapse'}
          >
            <motion.span
              animate={{ rotate: block.collapsed ? 0 : 90 }}
              transition={{ duration: 0.15, ease: CUPERTINO }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRightIcon style={{ width: 12, height: 12 }} />
            </motion.span>
          </button>
        ) : (
          <span style={{ width: 16, height: 16 }} />
        )}
      </div>

      {/* Bullet */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, minHeight: 32, flexShrink: 0, paddingTop: 7 }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: isFocused ? ACCENT : (isDark ? 'rgba(155,150,137,0.3)' : 'rgba(0,0,0,0.15)'),
            transition: 'background 0.15s',
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{ flex: 1, minWidth: 0 }}
        onClick={handleContentClick}
      >
        <div
          ref={setRef}
          contentEditable={!isAITarget}
          suppressContentEditableWarning
          spellCheck={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder="Type to start writing..."
          style={{
            outline: 'none',
            paddingRight: 8,
            fontSize: '1rem',
            lineHeight: '32px',
            minHeight: 32,
            color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(43,42,39,0.9)',
            caretColor: ACCENT,
            wordBreak: 'break-word',
          }}
          className="empty:before:content-[attr(data-placeholder)] empty:before:pointer-events-none"
          // Only first block shows placeholder
          {...(index === 0 ? {} : { 'data-placeholder': '' })}
        />

        {isAITarget && (
          <span
            className="inline-block animate-blink"
            style={{ width: 2.5, height: '1em', marginLeft: 1, background: ACCENT, borderRadius: 1, verticalAlign: 'text-bottom' }}
          />
        )}
      </div>
    </div>
  );
});
