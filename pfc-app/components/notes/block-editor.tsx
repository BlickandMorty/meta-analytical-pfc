'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useTheme } from 'next-themes';
import type { NoteBlock, BlockType, SlashCommand } from '@/lib/notes/types';
import { SLASH_COMMANDS, SLASH_CATEGORIES, stripHtml } from '@/lib/notes/types';
import {
  GripVerticalIcon,
  PlusIcon,
  ChevronRightIcon,
  CheckSquareIcon,
  SquareIcon,
  QuoteIcon,
  CodeIcon,
  MinusIcon,
  AlertCircleIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  SparklesIcon,
  BookOpenIcon,
  ExpandIcon,
  PenLineIcon,
  ImageIcon,
  TableIcon,
  FrameIcon,
  LinkIcon,
  SigmaIcon,
  TypeIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  HighlighterIcon,
  CodeXmlIcon,
  type LucideIcon,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// SiYuan-Inspired Block Editor
// Rich formatting, floating toolbar, drag-drop, keyboard shortcuts,
// arrow-key navigation, block splitting/merging, undo/redo
// ═══════════════════════════════════════════════════════════════════

const CUP = 'cubic-bezier(0.32, 0.72, 0, 1)';

// ── Icon map ──
const ICON_MAP: Record<string, LucideIcon> = {
  'heading-1': Heading1Icon, 'heading-2': Heading2Icon, 'heading-3': Heading3Icon,
  'check-square': CheckSquareIcon, 'list': ListIcon, 'list-ordered': ListOrderedIcon,
  'quote': QuoteIcon, 'code': CodeIcon, 'minus': MinusIcon, 'alert-circle': AlertCircleIcon,
  'chevron-right': ChevronRightIcon, 'sigma': SigmaIcon, 'table': TableIcon,
  'image': ImageIcon, 'frame': FrameIcon, 'link': LinkIcon, 'sparkles': SparklesIcon,
  'book-open': BookOpenIcon, 'expand': ExpandIcon, 'pen-line': PenLineIcon, 'type': TypeIcon,
};

// ═══════════════════════════════════════════════════════════════════
// Floating Formatting Toolbar (appears on text selection)
// SiYuan-style: bold, italic, underline, strikethrough, code, highlight, link
// ═══════════════════════════════════════════════════════════════════

function FloatingToolbar({
  position,
  isDark,
  onFormat,
}: {
  position: { top: number; left: number } | null;
  isDark: boolean;
  onFormat: (command: string, value?: string) => void;
}) {
  if (!position) return null;

  const buttons: { cmd: string; icon: LucideIcon; label: string; shortcut: string }[] = [
    { cmd: 'bold', icon: BoldIcon, label: 'Bold', shortcut: 'Ctrl+B' },
    { cmd: 'italic', icon: ItalicIcon, label: 'Italic', shortcut: 'Ctrl+I' },
    { cmd: 'underline', icon: UnderlineIcon, label: 'Underline', shortcut: 'Ctrl+U' },
    { cmd: 'strikethrough', icon: StrikethroughIcon, label: 'Strikethrough', shortcut: 'Ctrl+Shift+S' },
    { cmd: 'inlineCode', icon: CodeXmlIcon, label: 'Code', shortcut: 'Ctrl+E' },
    { cmd: 'highlight', icon: HighlighterIcon, label: 'Highlight', shortcut: 'Ctrl+Shift+H' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: position.top - 44,
        left: position.left,
        transform: 'translateX(-50%)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '4px',
        borderRadius: '10px',
        background: isDark ? 'rgba(40,36,30,0.95)' : 'rgba(255,255,255,0.97)',
        border: `1px solid ${isDark ? 'rgba(79,69,57,0.5)' : 'rgba(190,183,170,0.3)'}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3)'
          : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        animation: 'toolbar-in 0.12s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      <style>{`
        @keyframes toolbar-in {
          from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.96); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
      {buttons.map(({ cmd, icon: Icon, label, shortcut }) => (
        <button
          key={cmd}
          title={`${label} (${shortcut})`}
          onMouseDown={(e) => {
            e.preventDefault(); // Keep selection alive
            onFormat(cmd);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.6)',
            transition: `background 0.1s ${CUP}, color 0.1s`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isDark ? 'rgba(196,149,106,0.15)' : 'rgba(0,0,0,0.06)';
            e.currentTarget.style.color = '#C4956A';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.6)';
          }}
        >
          <Icon style={{ width: '14px', height: '14px' }} />
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SlashMenu — command palette triggered by /
// Categorized like SiYuan with keyword search
// ═══════════════════════════════════════════════════════════════════

function SlashMenu({
  query,
  position,
  isDark,
  onSelect,
  onClose,
  selectedIndex,
}: {
  query: string;
  position: { top: number; left: number };
  isDark: boolean;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
  selectedIndex: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.includes(q)),
    );
  }, [query]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: { category: string; label: string; items: SlashCommand[] }[] = [];
    for (const cat of SLASH_CATEGORIES) {
      const items = filtered.filter((c) => c.category === cat.id);
      if (items.length > 0) groups.push({ category: cat.id, label: cat.label, items });
    }
    return groups;
  }, [filtered]);

  // Scroll selected item into view
  useEffect(() => {
    if (!menuRef.current) return;
    const el = menuRef.current.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  let flatIdx = -1;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 50,
        width: '18rem',
        maxHeight: '22rem',
        overflowY: 'auto',
        borderRadius: '12px',
        background: isDark ? 'rgba(40,36,30,0.95)' : 'rgba(255,255,255,0.97)',
        border: `1px solid ${isDark ? 'rgba(79,69,57,0.4)' : 'rgba(190,183,170,0.25)'}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.5)'
          : '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        padding: '6px',
        backdropFilter: 'blur(20px) saturate(1.3)',
        animation: 'toolbar-in 0.12s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      {grouped.map((group) => (
        <div key={group.category}>
          <div style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.25)',
            padding: '6px 8px 4px',
            fontFamily: 'var(--font-sans)',
          }}>
            {group.label}
          </div>
          {group.items.map((cmd) => {
            flatIdx++;
            const isSelected = flatIdx === selectedIndex;
            const Icon = ICON_MAP[cmd.icon] ?? PlusIcon;
            return (
              <button
                key={cmd.id}
                data-selected={isSelected ? 'true' : undefined}
                onClick={() => onSelect(cmd)}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '7px 8px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: isSelected
                    ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(196,149,106,0.08)')
                    : 'transparent',
                  color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(0,0,0,0.8)',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: '24px', height: '24px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(0,0,0,0.04)',
                  flexShrink: 0,
                }}>
                  <Icon style={{ width: '13px', height: '13px', color: '#C4956A' }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{cmd.label}</div>
                  <div style={{
                    fontSize: '0.6875rem',
                    color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.35)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {cmd.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BlockItem — single block with contentEditable + all interactions
// ═══════════════════════════════════════════════════════════════════

const BlockItem = memo(function BlockItem({
  block,
  isEditing,
  isDark,
  onFocus,
  pageId,
  blockIndex,
  totalBlocks,
  onNavigate,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  block: NoteBlock;
  isEditing: boolean;
  isDark: boolean;
  onFocus: () => void;
  pageId: string;
  blockIndex: number;
  totalBlocks: number;
  onNavigate: (direction: 'up' | 'down') => void;
  onDragStart: (blockId: string) => void;
  onDragOver: (blockId: string) => void;
  onDrop: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const updateBlockContent = usePFCStore((s) => s.updateBlockContent);
  const deleteBlock = usePFCStore((s) => s.deleteBlock);
  const indentBlock = usePFCStore((s) => s.indentBlock);
  const outdentBlock = usePFCStore((s) => s.outdentBlock);
  const setEditingBlock = usePFCStore((s) => s.setEditingBlock);
  const toggleBlockCollapse = usePFCStore((s) => s.toggleBlockCollapse);
  const changeBlockType = usePFCStore((s) => s.changeBlockType);
  const splitBlock = usePFCStore((s) => s.splitBlock);
  const mergeBlockUp = usePFCStore((s) => s.mergeBlockUp);
  const createBlock = usePFCStore((s) => s.createBlock);
  const undo = usePFCStore((s) => s.undo);
  const redo = usePFCStore((s) => s.redo);

  // Slash command state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [slashIdx, setSlashIdx] = useState(0);
  const slashStartRef = useRef<number>(-1);

  // Hover state
  const [hovered, setHovered] = useState(false);

  // Track whether we set innerHTML to avoid input event loops
  const suppressInputRef = useRef(false);

  // Sync content from store → DOM on mount and when block changes
  useEffect(() => {
    if (contentRef.current && !isEditing) {
      if (contentRef.current.innerHTML !== block.content) {
        suppressInputRef.current = true;
        contentRef.current.innerHTML = block.content;
      }
    }
  }, [block.content, isEditing]);

  // Focus + restore cursor when becoming editing block
  useEffect(() => {
    if (isEditing && contentRef.current) {
      // Set content first
      if (contentRef.current.innerHTML !== block.content) {
        suppressInputRef.current = true;
        contentRef.current.innerHTML = block.content;
      }
      contentRef.current.focus();
      // Place cursor at end
      const sel = window.getSelection();
      const range = document.createRange();
      if (contentRef.current.childNodes.length > 0) {
        range.selectNodeContents(contentRef.current);
        range.collapse(false);
      }
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Input handler — reads innerHTML for rich formatting ──
  const handleInput = useCallback(() => {
    if (suppressInputRef.current) { suppressInputRef.current = false; return; }
    if (!contentRef.current) return;
    const html = contentRef.current.innerHTML;
    // Normalize browser-generated empty content
    const cleaned = html === '<br>' ? '' : html;
    updateBlockContent(block.id, cleaned);

    // Slash menu tracking
    if (slashOpen) {
      const text = contentRef.current.textContent ?? '';
      const afterSlash = text.slice(slashStartRef.current + 1);
      if (afterSlash.includes(' ') || !text.includes('/')) {
        setSlashOpen(false);
      } else {
        setSlashQuery(afterSlash);
        setSlashIdx(0);
      }
    }
  }, [block.id, updateBlockContent, slashOpen]);

  // ── Apply inline formatting (SiYuan keyboard shortcuts) ──
  const applyFormat = useCallback((command: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    switch (command) {
      case 'bold':
        document.execCommand('bold', false);
        break;
      case 'italic':
        document.execCommand('italic', false);
        break;
      case 'underline':
        document.execCommand('underline', false);
        break;
      case 'strikethrough':
        document.execCommand('strikeThrough', false);
        break;
      case 'inlineCode': {
        // Wrap selection in <code>
        const range = sel.getRangeAt(0);
        if (range.collapsed) break;
        const code = document.createElement('code');
        code.style.cssText = `
          background: ${isDark ? 'rgba(196,149,106,0.1)' : 'rgba(0,0,0,0.06)'};
          padding: 0.125em 0.35em;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 0.875em;
          color: ${isDark ? '#E8B06A' : '#B07D42'};
        `;
        range.surroundContents(code);
        break;
      }
      case 'highlight': {
        const range = sel.getRangeAt(0);
        if (range.collapsed) break;
        const mark = document.createElement('mark');
        mark.style.cssText = `background: rgba(251,191,36,0.25); padding: 0 2px; border-radius: 2px;`;
        range.surroundContents(mark);
        break;
      }
    }

    // Sync to store
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      updateBlockContent(block.id, html === '<br>' ? '' : html);
    }
  }, [block.id, isDark, updateBlockContent]);

  // ── Slash command select ──
  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setSlashOpen(false);
    if (!contentRef.current) return;

    // Remove the slash text
    const text = contentRef.current.textContent ?? '';
    const beforeSlash = text.slice(0, slashStartRef.current);
    suppressInputRef.current = true;
    contentRef.current.innerHTML = beforeSlash;
    updateBlockContent(block.id, beforeSlash);

    if (cmd.blockType) {
      const props: Record<string, string> = {};
      if (cmd.action === 'heading-1') props.level = '1';
      if (cmd.action === 'heading-2') props.level = '2';
      if (cmd.action === 'heading-3') props.level = '3';
      if (cmd.action === 'todo') props.checked = 'false';
      if (cmd.action === 'callout') props.calloutType = 'info';
      changeBlockType(block.id, cmd.blockType, props);
    }
  }, [block.id, updateBlockContent, changeBlockType]);

  // ── Keyboard handler — all shortcuts ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const text = contentRef.current?.textContent ?? '';
    const isMod = e.metaKey || e.ctrlKey;

    // ── Undo/Redo ──
    if (isMod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (isMod && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
    if (isMod && e.key === 'y') { e.preventDefault(); redo(); return; }

    // ── Inline formatting shortcuts ──
    if (isMod && e.key === 'b') { e.preventDefault(); applyFormat('bold'); return; }
    if (isMod && e.key === 'i') { e.preventDefault(); applyFormat('italic'); return; }
    if (isMod && e.key === 'u') { e.preventDefault(); applyFormat('underline'); return; }
    if (isMod && e.shiftKey && e.key === 'S') { e.preventDefault(); applyFormat('strikethrough'); return; }
    if (isMod && e.key === 'e') { e.preventDefault(); applyFormat('inlineCode'); return; }
    if (isMod && e.shiftKey && e.key === 'H') { e.preventDefault(); applyFormat('highlight'); return; }

    // ── Slash command nav ──
    if (slashOpen) {
      const filtered = SLASH_COMMANDS.filter(
        (cmd) => cmd.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
          cmd.description.toLowerCase().includes(slashQuery.toLowerCase()) ||
          cmd.keywords.some((kw) => kw.includes(slashQuery.toLowerCase())),
      );

      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[slashIdx]) handleSlashSelect(filtered[slashIdx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setSlashOpen(false); return; }
    }

    // ── Enter — split block at cursor ──
    if (e.key === 'Enter' && !e.shiftKey && !slashOpen) {
      e.preventDefault();
      if (!contentRef.current) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        // No selection — just create a new block
        const newId = createBlock(pageId, block.parentId, block.id);
        requestAnimationFrame(() => setEditingBlock(newId));
        return;
      }

      // Split at cursor position
      const range = sel.getRangeAt(0);
      const beforeRange = document.createRange();
      beforeRange.setStart(contentRef.current, 0);
      beforeRange.setEnd(range.startContainer, range.startOffset);

      const afterRange = document.createRange();
      afterRange.setStart(range.endContainer, range.endOffset);
      afterRange.setEndAfter(contentRef.current.lastChild || contentRef.current);

      const beforeFrag = beforeRange.cloneContents();
      const afterFrag = afterRange.cloneContents();

      const tmpBefore = document.createElement('div');
      tmpBefore.appendChild(beforeFrag);
      const tmpAfter = document.createElement('div');
      tmpAfter.appendChild(afterFrag);

      const htmlBefore = tmpBefore.innerHTML;
      const htmlAfter = tmpAfter.innerHTML;

      const newId = splitBlock(block.id, htmlBefore, htmlAfter);
      if (newId) {
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-block-id="${newId}"]`) as HTMLElement;
          if (el) {
            el.focus();
            // Place cursor at start
            const r = document.createRange();
            r.selectNodeContents(el);
            r.collapse(true);
            const s = window.getSelection();
            s?.removeAllRanges();
            s?.addRange(r);
          }
        });
      }
    }

    // ── Backspace on empty block — delete; at start — merge up ──
    if (e.key === 'Backspace' && !isMod) {
      if (text === '' && blockIndex > 0) {
        e.preventDefault();
        deleteBlock(block.id);
        return;
      }
      // Check if cursor is at start of block
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range.collapsed && range.startOffset === 0 && range.startContainer === contentRef.current?.firstChild) {
          // Merge with previous block
          if (blockIndex > 0) {
            e.preventDefault();
            const targetId = mergeBlockUp(block.id);
            if (targetId) {
              requestAnimationFrame(() => {
                const el = document.querySelector(`[data-block-id="${targetId}"]`) as HTMLElement;
                if (el) el.focus();
              });
            }
          }
        }
      }
    }

    // ── Tab / Shift+Tab — indent/outdent ──
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); indentBlock(block.id); }
    if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); outdentBlock(block.id); }

    // ── Arrow Up at top of block — navigate to prev block ──
    if (e.key === 'ArrowUp' && !slashOpen) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range.collapsed) {
          // Check if at first line
          const rect = range.getBoundingClientRect();
          const containerRect = contentRef.current?.getBoundingClientRect();
          if (containerRect && rect.top - containerRect.top < 4) {
            e.preventDefault();
            onNavigate('up');
          }
        }
      }
    }

    // ── Arrow Down at bottom of block — navigate to next block ──
    if (e.key === 'ArrowDown' && !slashOpen) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range.collapsed) {
          const rect = range.getBoundingClientRect();
          const containerRect = contentRef.current?.getBoundingClientRect();
          if (containerRect && containerRect.bottom - rect.bottom < 4) {
            e.preventDefault();
            onNavigate('down');
          }
        }
      }
    }

    // ── / — open slash menu ──
    if (e.key === '/' && !slashOpen && !isMod) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSlashPos({ top: rect.bottom + 4, left: rect.left });
        setSlashOpen(true);
        setSlashQuery('');
        setSlashIdx(0);
        slashStartRef.current = text.length;
      }
    }

    // ── Markdown shortcuts on Space ──
    if (e.key === ' ' && !isMod) {
      if (text === '#') { e.preventDefault(); changeBlockType(block.id, 'heading', { level: '1' }); }
      else if (text === '##') { e.preventDefault(); changeBlockType(block.id, 'heading', { level: '2' }); }
      else if (text === '###') { e.preventDefault(); changeBlockType(block.id, 'heading', { level: '3' }); }
      else if (text === '-' || text === '*') { e.preventDefault(); changeBlockType(block.id, 'list-item', {}); }
      else if (text === '1.') { e.preventDefault(); changeBlockType(block.id, 'numbered-item', {}); }
      else if (text === '[]' || text === '[ ]') { e.preventDefault(); changeBlockType(block.id, 'todo', { checked: 'false' }); }
      else if (text === '>') { e.preventDefault(); changeBlockType(block.id, 'quote', {}); }
      else if (text === '---') { e.preventDefault(); changeBlockType(block.id, 'divider', {}); }
      else if (text === '```') { e.preventDefault(); changeBlockType(block.id, 'code', { language: '' }); }
    }
  }, [
    block, pageId, blockIndex, slashOpen, slashQuery, slashIdx,
    createBlock, deleteBlock, indentBlock, outdentBlock, setEditingBlock,
    handleSlashSelect, changeBlockType, splitBlock, mergeBlockUp,
    applyFormat, undo, redo, onNavigate,
  ]);

  // ── Todo toggle ──
  const handleTodoToggle = useCallback(() => {
    usePFCStore.setState((s) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === block.id
          ? { ...b, properties: { ...b.properties, checked: b.properties.checked === 'true' ? 'false' : 'true' }, updatedAt: Date.now() }
          : b,
      ),
    }));
    setTimeout(() => usePFCStore.getState().saveNotesToStorage(), 100);
  }, [block.id]);

  // ── Block prefix (bullet, checkbox, number, etc.) ──
  const renderPrefix = () => {
    switch (block.type) {
      case 'todo': {
        const checked = block.properties.checked === 'true';
        return (
          <button
            onClick={handleTodoToggle}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '18px', height: '18px', border: 'none',
              background: 'transparent', cursor: 'pointer', flexShrink: 0,
              color: checked ? '#34D399' : (isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.2)'),
              marginTop: '3px', transition: 'color 0.15s',
            }}
          >
            {checked
              ? <CheckSquareIcon style={{ width: '16px', height: '16px' }} />
              : <SquareIcon style={{ width: '16px', height: '16px' }} />
            }
          </button>
        );
      }
      case 'list-item':
        return (
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
            background: isDark ? 'rgba(196,149,106,0.5)' : 'rgba(0,0,0,0.3)',
            marginTop: '10px',
          }} />
        );
      case 'numbered-item':
        return (
          <span style={{
            fontSize: '0.8125rem', fontWeight: 600, flexShrink: 0,
            color: isDark ? 'rgba(196,149,106,0.6)' : 'rgba(0,0,0,0.35)',
            minWidth: '20px', textAlign: 'right', marginTop: '3px',
          }}>
            {blockIndex + 1}.
          </span>
        );
      case 'quote':
        return (
          <div style={{
            width: '3px', flexShrink: 0, borderRadius: '2px',
            background: isDark ? 'rgba(196,149,106,0.3)' : 'rgba(196,149,106,0.4)',
            alignSelf: 'stretch', marginRight: '4px',
          }} />
        );
      case 'toggle':
        return (
          <button
            onClick={() => toggleBlockCollapse(block.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '20px', height: '20px', border: 'none',
              background: 'transparent', cursor: 'pointer', flexShrink: 0,
              color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.25)',
              transform: block.collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: `transform 0.15s ${CUP}`,
            }}
          >
            <ChevronRightIcon style={{ width: '14px', height: '14px' }} />
          </button>
        );
      default:
        return null;
    }
  };

  // ── Block-type styles ──
  const getBlockStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      fontSize: '0.9375rem',
      lineHeight: 1.7,
      fontWeight: 400,
      fontFamily: 'var(--font-sans)',
    };

    switch (block.type) {
      case 'heading': {
        const level = parseInt(block.properties.level || '1', 10);
        if (level === 1) return { ...base, fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.02em' };
        if (level === 2) return { ...base, fontSize: '1.375rem', fontWeight: 650, lineHeight: 1.35, letterSpacing: '-0.015em' };
        return { ...base, fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 };
      }
      case 'code':
        return {
          ...base,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8125rem',
          lineHeight: 1.6,
          padding: '12px 16px',
          borderRadius: '8px',
          background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)',
          whiteSpace: 'pre-wrap',
          display: 'block',
        };
      case 'quote':
        return { ...base, fontStyle: 'italic', color: isDark ? 'rgba(232,228,222,0.7)' : 'rgba(0,0,0,0.55)' };
      case 'callout':
        return {
          ...base,
          padding: '12px 16px',
          borderRadius: '8px',
          background: isDark ? 'rgba(196,149,106,0.06)' : 'rgba(196,149,106,0.04)',
          borderLeft: '3px solid #C4956A',
          display: 'block',
        };
      case 'todo': {
        const checked = block.properties.checked === 'true';
        return {
          ...base,
          textDecoration: checked ? 'line-through' : 'none',
          color: checked ? (isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.25)') : undefined,
        };
      }
      default:
        return base;
    }
  };

  // ── Drag-over visual state ──
  const [dragOver, setDragOver] = useState(false);

  // ── Divider block (non-editable) ──
  if (block.type === 'divider') {
    return (
      <div
        className="pfc-block"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 0',
          paddingLeft: `${block.indent * 1.5}rem`,
          // 60fps: GPU layer + containment + skip off-screen
          transform: 'translateZ(0)',
          contain: 'layout style',
          contentVisibility: 'auto',
          containIntrinsicSize: 'auto 40px',
        } as React.CSSProperties}
      >
        <div style={{
          flex: 1, height: '1px',
          background: isDark ? 'rgba(79,69,57,0.3)' : 'rgba(190,183,170,0.25)',
        }} />
      </div>
    );
  }

  return (
    <div
      className="pfc-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable={hovered && !isEditing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', block.id);
        onDragStart(block.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(true);
        onDragOver(block.id);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop();
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        paddingLeft: `${block.indent * 1.5}rem`,
        position: 'relative',
        borderRadius: '6px',
        // 60fps: GPU layer + containment + skip off-screen rendering
        transform: 'translateZ(0)',
        contain: 'layout style',
        contentVisibility: isEditing ? 'visible' : 'auto',
        containIntrinsicSize: 'auto 32px',
      } as React.CSSProperties}
    >
      {/* ── Focus/hover overlay — S-Tier opacity transition, no background repaint ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '6px',
          pointerEvents: 'none',
          background: isDark ? 'rgba(196,149,106,0.06)' : 'rgba(196,149,106,0.04)',
          opacity: isEditing ? 1 : hovered ? 0.5 : 0,
          transition: `opacity 0.15s ${CUP}`,
          transform: 'translateZ(0)',
        }}
      />

      {/* ── Drag drop indicator line — S-Tier transform slide ── */}
      {dragOver && (
        <div
          style={{
            position: 'absolute',
            bottom: '-1px',
            left: '2rem',
            right: '0.5rem',
            height: '2px',
            borderRadius: '1px',
            background: '#C4956A',
            opacity: 0.7,
            transform: 'translateZ(0) scaleX(1)',
            transformOrigin: 'left',
            animation: 'drop-line-in 0.1s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        />
      )}

      {/* ── Gutter: drag handle + add button — S-Tier opacity ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        opacity: hovered ? 0.6 : 0,
        transition: `opacity 0.15s ${CUP}`,
        transform: 'translateZ(0)',
        flexShrink: 0,
        marginTop: block.type === 'heading' ? '6px' : '3px',
        position: 'relative',
        zIndex: 1,
      }}>
        <button
          onClick={() => {
            const newId = createBlock(pageId, block.parentId, block.id);
            requestAnimationFrame(() => setEditingBlock(newId));
          }}
          title="Add block below"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '18px', height: '18px', border: 'none',
            borderRadius: '4px', cursor: 'pointer',
            background: 'transparent',
            color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.2)',
          }}
        >
          <PlusIcon style={{ width: '12px', height: '12px' }} />
        </button>
        <div
          title="Drag to reorder"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '18px', height: '18px', cursor: 'grab',
            color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.2)',
          }}
        >
          <GripVerticalIcon style={{ width: '12px', height: '12px' }} />
        </div>
      </div>

      {/* ── Block prefix ── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start' }}>
        {renderPrefix()}
      </div>

      {/* ── Content area (contentEditable with rich formatting) ── */}
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={onFocus}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-block-id={block.id}
        data-placeholder={
          block.type === 'heading' ? `Heading ${block.properties.level || '1'}`
          : block.type === 'code' ? 'Code...'
          : block.type === 'quote' ? 'Quote...'
          : block.type === 'callout' ? 'Callout...'
          : 'Type / for commands...'
        }
        style={{
          flex: 1,
          outline: 'none',
          minHeight: '1.5em',
          color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(0,0,0,0.8)',
          caretColor: '#C4956A',
          wordBreak: 'break-word',
          position: 'relative',
          zIndex: 1,
          ...getBlockStyles(),
        }}
      />

      {/* ── Slash menu overlay — pure CSS animation, no Framer Motion ── */}
      {slashOpen && (
        <SlashMenu
          query={slashQuery}
          position={slashPos}
          isDark={isDark}
          onSelect={handleSlashSelect}
          onClose={() => setSlashOpen(false)}
          selectedIndex={slashIdx}
        />
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// BlockEditor — renders all blocks for a page
// Handles floating toolbar, drag-drop coordination, block navigation
// ═══════════════════════════════════════════════════════════════════

export function BlockEditor({ pageId }: { pageId: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = (resolvedTheme === 'dark' || resolvedTheme === 'oled');

  const noteBlocks = usePFCStore((s) => s.noteBlocks);
  const editingBlockId = usePFCStore((s) => s.editingBlockId);
  const setEditingBlock = usePFCStore((s) => s.setEditingBlock);
  const createBlock = usePFCStore((s) => s.createBlock);
  const moveBlock = usePFCStore((s) => s.moveBlock);

  // Floating toolbar position (null = hidden)
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);

  // Drag state
  const dragSourceRef = useRef<string | null>(null);
  const dragTargetRef = useRef<string | null>(null);

  // Page blocks sorted
  const pageBlocks = useMemo(() => {
    return noteBlocks
      .filter((b: NoteBlock) => b.pageId === pageId)
      .sort((a: NoteBlock, b: NoteBlock) => a.order.localeCompare(b.order));
  }, [noteBlocks, pageId]);

  // ── Selection change listener for floating toolbar ──
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setToolbarPos(null);
        return;
      }
      // Only show toolbar if selection is within our editor
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const blockEl = (container.nodeType === 3 ? container.parentElement : container as HTMLElement)?.closest('[data-block-id]');
      if (!blockEl) {
        setToolbarPos(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setToolbarPos({ top: rect.top, left: rect.left + rect.width / 2 });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // ── Format handler for toolbar ──
  const handleFormat = useCallback((command: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    switch (command) {
      case 'bold': document.execCommand('bold', false); break;
      case 'italic': document.execCommand('italic', false); break;
      case 'underline': document.execCommand('underline', false); break;
      case 'strikethrough': document.execCommand('strikeThrough', false); break;
      case 'inlineCode': {
        const range = sel.getRangeAt(0);
        if (range.collapsed) break;
        const code = document.createElement('code');
        code.style.cssText = `
          background: ${isDark ? 'rgba(196,149,106,0.1)' : 'rgba(0,0,0,0.06)'};
          padding: 0.125em 0.35em; border-radius: 4px;
          font-family: var(--font-mono); font-size: 0.875em;
          color: ${isDark ? '#E8B06A' : '#B07D42'};
        `;
        range.surroundContents(code);
        break;
      }
      case 'highlight': {
        const range = sel.getRangeAt(0);
        if (range.collapsed) break;
        const mark = document.createElement('mark');
        mark.style.cssText = `background: rgba(251,191,36,0.25); padding: 0 2px; border-radius: 2px;`;
        range.surroundContents(mark);
        break;
      }
    }

    // Sync the modified block to store
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const blockEl = (container.nodeType === 3 ? container.parentElement : container as HTMLElement)?.closest('[data-block-id]') as HTMLElement;
    if (blockEl) {
      const blockId = blockEl.getAttribute('data-block-id');
      if (blockId) {
        const html = blockEl.innerHTML;
        usePFCStore.getState().updateBlockContent(blockId, html === '<br>' ? '' : html);
      }
    }
  }, [isDark]);

  // ── Navigate between blocks ──
  const handleNavigate = useCallback((direction: 'up' | 'down', currentBlockId: string) => {
    const idx = pageBlocks.findIndex((b: NoteBlock) => b.id === currentBlockId);
    if (direction === 'up' && idx > 0) {
      setEditingBlock(pageBlocks[idx - 1].id);
    } else if (direction === 'down' && idx < pageBlocks.length - 1) {
      setEditingBlock(pageBlocks[idx + 1].id);
    }
  }, [pageBlocks, setEditingBlock]);

  // ── Drag handlers ──
  const handleDragStart = useCallback((blockId: string) => { dragSourceRef.current = blockId; }, []);
  const handleDragOver = useCallback((blockId: string) => { dragTargetRef.current = blockId; }, []);
  const handleDrop = useCallback(() => {
    if (dragSourceRef.current && dragTargetRef.current && dragSourceRef.current !== dragTargetRef.current) {
      const target = pageBlocks.find((b: NoteBlock) => b.id === dragTargetRef.current);
      if (target) {
        moveBlock(dragSourceRef.current, target.parentId, target.id);
      }
    }
    dragSourceRef.current = null;
    dragTargetRef.current = null;
  }, [pageBlocks, moveBlock]);

  // ── Click empty area — add/focus last block ──
  const handleEmptyClick = useCallback(() => {
    if (pageBlocks.length === 0) {
      const newId = createBlock(pageId);
      requestAnimationFrame(() => setEditingBlock(newId));
    } else {
      const lastBlock = pageBlocks[pageBlocks.length - 1];
      if (stripHtml(lastBlock.content) !== '' || (lastBlock.type ?? 'paragraph') !== 'paragraph') {
        const newId = createBlock(pageId, null, lastBlock.id);
        requestAnimationFrame(() => setEditingBlock(newId));
      } else {
        setEditingBlock(lastBlock.id);
      }
    }
  }, [pageBlocks, pageId, createBlock, setEditingBlock]);

  return (
    <>
      {/* Floating formatting toolbar */}
      <FloatingToolbar
        position={toolbarPos}
        isDark={isDark}
        onFormat={handleFormat}
      />

      {/* Block list — GPU-promoted container with paint containment */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        contain: 'layout style',
        transform: 'translateZ(0)',
      }}>
        {pageBlocks.map((block, idx) => (
          <BlockItem
            key={block.id}
            block={block}
            isEditing={editingBlockId === block.id}
            isDark={isDark}
            onFocus={() => setEditingBlock(block.id)}
            pageId={pageId}
            blockIndex={idx}
            totalBlocks={pageBlocks.length}
            onNavigate={(dir) => handleNavigate(dir, block.id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}

        {/* Click zone to add new blocks */}
        <div
          onClick={handleEmptyClick}
          style={{
            minHeight: '12rem',
            cursor: 'text',
            borderRadius: '8px',
          }}
        />
      </div>

      {/* 60fps styles: all transitions use S-Tier properties (transform, opacity) */}
      <style>{`
        @keyframes drop-line-in {
          from { transform: translateZ(0) scaleX(0); opacity: 0; }
          to   { transform: translateZ(0) scaleX(1); opacity: 0.7; }
        }

        /* Drag ghost: subtle scale + opacity */
        .pfc-block:active[draggable="true"] {
          opacity: 0.5;
        }

        [data-block-id]:empty:before {
          content: attr(data-placeholder);
          color: ${isDark ? 'rgba(155,150,137,0.25)' : 'rgba(0,0,0,0.15)'};
          pointer-events: none;
          position: absolute;
        }
        [data-block-id] strong { font-weight: 700; }
        [data-block-id] em { font-style: italic; }
        [data-block-id] u { text-decoration: underline; text-underline-offset: 2px; }
        [data-block-id] s { text-decoration: line-through; opacity: 0.6; }
        [data-block-id] code {
          background: ${isDark ? 'rgba(196,149,106,0.1)' : 'rgba(0,0,0,0.06)'};
          padding: 0.125em 0.35em;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 0.875em;
          color: ${isDark ? '#E8B06A' : '#B07D42'};
        }
        [data-block-id] mark {
          background: rgba(251,191,36,0.25);
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </>
  );
}
