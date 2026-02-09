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
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════
   BlockEditor — Logseq-inspired outliner for PFC Notes

   Features:
   - Recursive indented block tree with collapse/expand
   - contentEditable with full keyboard navigation
   - [[Page links]], markdown inline formatting, checkboxes
   - AI typing animation with blinking cursor
   - Glass-morphism design system integration
   ═══════════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────────

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

// ── Constants ──────────────────────────────────────────────────────

const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];
const INDENT_PX = 24;
const VIOLET = '#7C6CF0';
const VIOLET_FAINT = 'rgba(124, 108, 240, 0.08)';
const VIOLET_BORDER = 'rgba(124, 108, 240, 0.25)';
const VIOLET_BADGE_BG = 'rgba(124, 108, 240, 0.15)';

// ── Store selectors (stable references) ────────────────────────────

const selectNoteBlocks = (s: any) => s.noteBlocks as NoteBlock[] | undefined;
const selectEditingBlockId = (s: any) => s.editingBlockId as string | null | undefined;
const selectNoteAI = (s: any) =>
  s.noteAI as { isGenerating: boolean; targetBlockId: string | null; streamedText?: string } | undefined;

const selectActions = (s: any) => ({
  createBlock: s.createBlock as (pageId: string, parentId: string | null, afterBlockId: string | null, content: string) => string,
  updateBlockContent: s.updateBlockContent as (blockId: string, content: string) => void,
  deleteBlock: s.deleteBlock as (blockId: string) => void,
  indentBlock: s.indentBlock as (blockId: string) => void,
  outdentBlock: s.outdentBlock as (blockId: string) => void,
  toggleBlockCollapse: s.toggleBlockCollapse as (blockId: string) => void,
  setEditingBlock: s.setEditingBlock as (blockId: string | null) => void,
  setActivePage: s.setActivePage as ((pageId: string) => void) | undefined,
  ensurePage: s.ensurePage as ((title: string) => string) | undefined,
});

// ── Markdown helpers ───────────────────────────────────────────────

/** Convert markdown-flavoured content to HTML for display mode */
function renderMarkdown(raw: string): string {
  let html = escapeHtml(raw);

  // Headings (must be at start of block content)
  html = html.replace(/^### (.+)$/, '<span class="text-base font-semibold text-foreground">$1</span>');
  html = html.replace(/^## (.+)$/, '<span class="text-lg font-semibold text-foreground">$1</span>');
  html = html.replace(/^# (.+)$/, '<span class="text-xl font-bold text-foreground">$1</span>');

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');

  // Italic *text* (but not inside bold)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic text-foreground/80">$1</em>');

  // Inline code `text`
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded-md text-xs font-mono bg-white/[0.06] text-pfc-ember border border-white/[0.08]">$1</code>',
  );

  // [[Page links]]
  html = html.replace(
    /\[\[([^\]]+)\]\]/g,
    '<span class="note-page-link inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium cursor-pointer select-none transition-colors duration-150" data-page="$1" style="background:' +
      VIOLET_BADGE_BG +
      ';color:' +
      VIOLET +
      ';border:1px solid ' +
      VIOLET_BORDER +
      '">$1</span>',
  );

  // Checkbox - [ ] / - [x]
  html = html.replace(
    /- \[x\]/g,
    '<span class="note-checkbox checked inline-flex items-center justify-center w-4 h-4 rounded border border-pfc-green bg-pfc-green/20 mr-1.5 cursor-pointer align-middle" data-checked="true"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#34D399" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.5L4 7.5L8 3"/></svg></span>',
  );
  html = html.replace(
    /- \[ \]/g,
    '<span class="note-checkbox inline-flex items-center justify-center w-4 h-4 rounded border border-white/20 bg-white/[0.04] mr-1.5 cursor-pointer align-middle" data-checked="false"></span>',
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

  // Sort children by order within each group
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
  const actions = usePFCStore(selectActions);

  // Build the block tree and flatten for rendering
  const childMap = useMemo(() => buildBlockTree(allBlocks, pageId), [allBlocks, pageId]);
  const collapsedIds = useMemo(
    () => new Set<string>(allBlocks.filter((b) => b.collapsed).map((b) => b.id)),
    [allBlocks],
  );
  const flatBlocks = useMemo(
    () => flattenTree(childMap, null, collapsedIds),
    [childMap, collapsedIds],
  );

  // Ref map so children can focus siblings
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerRef = useCallback((blockId: string, el: HTMLDivElement | null) => {
    if (el) {
      blockRefs.current.set(blockId, el);
    } else {
      blockRefs.current.delete(blockId);
    }
  }, []);

  const focusBlock = useCallback((blockId: string) => {
    // Small delay to let React commit DOM updates
    requestAnimationFrame(() => {
      const el = blockRefs.current.get(blockId);
      if (el) {
        el.focus();
        // Place cursor at end
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

  // Handle creating a new block at the end when clicking empty area
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
      className="relative min-h-[200px] py-2 cursor-text"
      onClick={handleContainerClick}
    >
      <AnimatePresence initial={false}>
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
          />
        ))}
      </AnimatePresence>

      {flatBlocks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: CUPERTINO }}
          className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground/40 select-none"
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: VIOLET, opacity: 0.3 }}
          />
          Click here to start writing...
        </motion.div>
      )}
    </div>
  );
}

// ── BlockItem (memoized) ───────────────────────────────────────────

interface BlockItemProps {
  block: NoteBlock;
  depth: number;
  isEditing: boolean;
  hasChildBlocks: boolean;
  noteAI: { isGenerating: boolean; targetBlockId: string | null; streamedText?: string } | undefined;
  actions: ReturnType<typeof selectActions>;
  pageId: string;
  flatBlocks: NoteBlock[];
  index: number;
  registerRef: (blockId: string, el: HTMLDivElement | null) => void;
  focusBlock: (blockId: string) => void;
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
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // AI typing state
  const isAITarget =
    noteAI?.isGenerating === true && noteAI.targetBlockId === block.id;
  const [displayedChars, setDisplayedChars] = useState(0);
  const aiText = isAITarget ? (noteAI?.streamedText ?? block.content) : '';

  // Register the contentEditable ref for external focus
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      (contentRef as any).current = el;
      registerRef(block.id, el);
    },
    [block.id, registerRef],
  );

  // Sync store content into the editable div when not focused
  useEffect(() => {
    const el = contentRef.current;
    if (!el || isFocused) return;
    if (!isAITarget) {
      // When not editing, show rendered markdown
      el.innerHTML = block.content ? renderMarkdown(block.content) : '';
    }
  }, [block.content, isFocused, isAITarget]);

  // When entering edit mode, switch to raw text
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (isFocused) {
      // Show raw content for editing (plain text)
      if (el.textContent !== block.content) {
        el.textContent = block.content;
      }
    }
  }, [isFocused, block.content]);

  // AI typing animation: reveal characters one by one
  useEffect(() => {
    if (!isAITarget) {
      setDisplayedChars(0);
      return;
    }
    const target = aiText.length;
    if (displayedChars >= target) return;

    const timer = setTimeout(() => {
      setDisplayedChars((prev) => Math.min(prev + 1, target));
    }, 18 + Math.random() * 12); // ~18-30ms per char for natural feel

    return () => clearTimeout(timer);
  }, [isAITarget, aiText, displayedChars]);

  // Update the AI display text in the DOM
  useEffect(() => {
    if (!isAITarget || !contentRef.current) return;
    contentRef.current.textContent = aiText.slice(0, displayedChars);
  }, [isAITarget, aiText, displayedChars]);

  // ── Handlers ───────────────────────────────────────────────────

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
    const text = el.textContent ?? '';
    actions.updateBlockContent(block.id, text);
  }, [actions, block.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const el = contentRef.current;
      if (!el) return;
      const text = el.textContent ?? '';

      // ── Enter: new block below ──
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Save current content
        actions.updateBlockContent(block.id, text);
        // Create sibling block after this one
        const newId = actions.createBlock(
          pageId,
          block.parentId,
          block.id,
          '',
        );
        actions.setEditingBlock(newId);
        focusBlock(newId);
        return;
      }

      // ── Backspace on empty: delete and focus previous ──
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

      // ── Tab: indent ──
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        actions.indentBlock(block.id);
        // Maintain focus after re-render
        requestAnimationFrame(() => focusBlock(block.id));
        return;
      }

      // ── Shift+Tab: outdent ──
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        actions.outdentBlock(block.id);
        requestAnimationFrame(() => focusBlock(block.id));
        return;
      }

      // ── Arrow Up: focus previous block ──
      if (e.key === 'ArrowUp') {
        // Only intercept if cursor is at the start of content
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

      // ── Arrow Down: focus next block ──
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

  // Handle clicks on rendered elements (page links, checkboxes)
  const handleContentClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // [[Page link]] click
      const pageLink = target.closest('.note-page-link') as HTMLElement | null;
      if (pageLink) {
        e.preventDefault();
        e.stopPropagation();
        const pageName = pageLink.getAttribute('data-page');
        if (pageName) {
          // Ensure page exists and navigate to it
          if (actions.ensurePage) {
            const targetPageId = actions.ensurePage(pageName);
            actions.setActivePage?.(targetPageId);
          } else {
            actions.setActivePage?.(pageName);
          }
        }
        return;
      }

      // Checkbox toggle
      const checkbox = target.closest('.note-checkbox') as HTMLElement | null;
      if (checkbox) {
        e.preventDefault();
        e.stopPropagation();
        const isChecked = checkbox.getAttribute('data-checked') === 'true';
        const currentContent = block.content;
        const updated = isChecked
          ? currentContent.replace('- [x]', '- [ ]')
          : currentContent.replace('- [ ]', '- [x]');
        actions.updateBlockContent(block.id, updated);
        return;
      }
    },
    [actions, block],
  );

  // ── Collapse toggle ──
  const handleCollapseToggle = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      actions.toggleBlockCollapse(block.id);
    },
    [actions, block.id],
  );

  // ── Render ─────────────────────────────────────────────────────

  const paddingLeft = depth * INDENT_PX + 8;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2, ease: CUPERTINO }}
      className={cn(
        'group relative flex items-start gap-0 rounded-lg transition-colors duration-150',
        isFocused && 'bg-white/[0.04] dark:bg-white/[0.03]',
        isHovered && !isFocused && 'bg-white/[0.02] dark:bg-white/[0.015]',
      )}
      style={{
        paddingLeft,
        minHeight: 32,
        // Violet accent line on left when focused
        borderLeft: isFocused
          ? `2px solid ${VIOLET}`
          : '2px solid transparent',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Collapse chevron / spacer ── */}
      <div className="flex items-center justify-center w-5 h-8 flex-shrink-0">
        {hasChildBlocks ? (
          <button
            onClick={handleCollapseToggle}
            className={cn(
              'flex items-center justify-center w-4 h-4 rounded transition-all duration-200',
              'text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-white/[0.06]',
            )}
            aria-label={block.collapsed ? 'Expand' : 'Collapse'}
          >
            <motion.span
              animate={{ rotate: block.collapsed ? 0 : 90 }}
              transition={{ duration: 0.2, ease: CUPERTINO }}
              className="flex items-center justify-center"
            >
              <ChevronRightIcon className="w-3 h-3" />
            </motion.span>
          </button>
        ) : (
          <span className="w-4 h-4" />
        )}
      </div>

      {/* ── Bullet point ── */}
      <div className="flex items-center justify-center w-5 h-8 flex-shrink-0">
        <span
          className={cn(
            'rounded-full transition-all duration-200',
            isFocused ? 'w-[5px] h-[5px]' : 'w-1 h-1',
          )}
          style={{
            background: VIOLET,
            opacity: isFocused ? 1 : 0.5,
            boxShadow: isFocused
              ? `0 0 6px ${VIOLET_FAINT}`
              : 'none',
          }}
        />
      </div>

      {/* ── Content area ── */}
      <div
        className="flex-1 min-w-0 relative"
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
          data-placeholder="Type '/' for commands..."
          className={cn(
            'outline-none min-h-[28px] py-1 pr-2 text-sm leading-relaxed',
            'text-foreground/90 selection:bg-pfc-violet/20',
            // Placeholder style via CSS
            'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/30',
            'empty:before:pointer-events-none',
          )}
          style={{
            wordBreak: 'break-word',
            caretColor: VIOLET,
          }}
        />

        {/* ── AI typing cursor ── */}
        {isAITarget && (
          <span
            className="inline-block w-[2px] h-4 ml-0.5 rounded-sm animate-blink align-middle"
            style={{ background: VIOLET }}
          />
        )}
      </div>

      {/* ── Hover border (faint) ── */}
      {isHovered && !isFocused && (
        <motion.div
          layoutId={`hover-border-${block.id}`}
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            border: '1px solid rgba(124, 108, 240, 0.06)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        />
      )}

      {/* ── Glass background when editing ── */}
      {isFocused && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none -z-10"
          style={{
            background: 'rgba(124, 108, 240, 0.03)',
            backdropFilter: 'blur(12px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
            border: `1px solid rgba(124, 108, 240, 0.08)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: CUPERTINO }}
        />
      )}
    </motion.div>
  );
});

// ── Exports ────────────────────────────────────────────────────────

export type { NoteBlock };
export default BlockEditor;
