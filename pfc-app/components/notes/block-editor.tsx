'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import type { NoteBlock, BlockType, SlashCommand } from '@/lib/notes/types';
import { SLASH_COMMANDS } from '@/lib/notes/types';
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
  type LucideIcon,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// SiYuan-inspired Block Editor
// Rich block types, slash commands, keyboard shortcuts, drag handles
// ═══════════════════════════════════════════════════════════════════

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 };

// Icon map for slash commands
const ICON_MAP: Record<string, LucideIcon> = {
  'heading-1': Heading1Icon,
  'heading-2': Heading2Icon,
  'heading-3': Heading3Icon,
  'check-square': CheckSquareIcon,
  'list': ListIcon,
  'list-ordered': ListOrderedIcon,
  'quote': QuoteIcon,
  'code': CodeIcon,
  'minus': MinusIcon,
  'alert-circle': AlertCircleIcon,
  'chevron-right': ChevronRightIcon,
  'sigma': SigmaIcon,
  'table': TableIcon,
  'image': ImageIcon,
  'frame': FrameIcon,
  'link': LinkIcon,
  'sparkles': SparklesIcon,
  'book-open': BookOpenIcon,
  'expand': ExpandIcon,
  'pen-line': PenLineIcon,
};

// ═══════════════════════════════════════════════════════════════════
// SlashMenu — command palette triggered by /
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
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return SLASH_COMMANDS.filter(
      (cmd) => cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q),
    );
  }, [query]);

  if (filtered.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 50,
        width: '17rem',
        maxHeight: '20rem',
        overflowY: 'auto',
        borderRadius: '0.75rem',
        background: isDark ? 'var(--m3-surface-container-high)' : '#fff',
        border: `1px solid ${isDark ? 'rgba(79,69,57,0.4)' : 'rgba(190,183,170,0.25)'}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.5)'
          : '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        padding: '0.375rem',
        backdropFilter: 'blur(20px)',
      }}
    >
      {filtered.map((cmd, i) => {
        const Icon = ICON_MAP[cmd.icon] ?? PlusIcon;
        const isSelected = i === selectedIndex;
        return (
          <button
            key={cmd.id}
            onClick={() => onSelect(cmd)}
            onMouseDown={(e) => e.preventDefault()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              width: '100%',
              padding: '0.5rem 0.625rem',
              borderRadius: '0.5rem',
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
              width: '1.5rem',
              height: '1.5rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(0,0,0,0.04)',
              flexShrink: 0,
            }}>
              <Icon style={{ width: '0.8125rem', height: '0.8125rem', color: '#C4956A' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{cmd.label}</div>
              <div style={{
                fontSize: '0.6875rem',
                color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.35)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {cmd.description}
              </div>
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Single Block component
// ═══════════════════════════════════════════════════════════════════

const BlockItem = memo(function BlockItem({
  block,
  isEditing,
  isDark,
  onFocus,
  pageId,
  blockIndex,
}: {
  block: NoteBlock;
  isEditing: boolean;
  isDark: boolean;
  onFocus: () => void;
  pageId: string;
  blockIndex: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const updateBlockContent = usePFCStore((s) => s.updateBlockContent);
  const createBlock = usePFCStore((s) => s.createBlock);
  const deleteBlock = usePFCStore((s) => s.deleteBlock);
  const indentBlock = usePFCStore((s) => s.indentBlock);
  const outdentBlock = usePFCStore((s) => s.outdentBlock);
  const setEditingBlock = usePFCStore((s) => s.setEditingBlock);
  const toggleBlockCollapse = usePFCStore((s) => s.toggleBlockCollapse);

  // Slash command state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [slashIdx, setSlashIdx] = useState(0);
  const slashStartRef = useRef<number>(-1);

  // Hover state for drag handle
  const [hovered, setHovered] = useState(false);

  // Focus when becoming the editing block
  useEffect(() => {
    if (isEditing && contentRef.current) {
      contentRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      if (contentRef.current.childNodes.length > 0) {
        range.selectNodeContents(contentRef.current);
        range.collapse(false);
      }
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]);

  const handleInput = useCallback(() => {
    if (!contentRef.current) return;
    const text = contentRef.current.textContent ?? '';
    updateBlockContent(block.id, text);

    if (slashOpen) {
      const query = text.slice(slashStartRef.current + 1);
      if (query.includes(' ') || !text.includes('/')) {
        setSlashOpen(false);
      } else {
        setSlashQuery(query);
        setSlashIdx(0);
      }
    }
  }, [block.id, updateBlockContent, slashOpen]);

  const convertBlock = useCallback((type: BlockType, props: Record<string, string>) => {
    if (!contentRef.current) return;
    contentRef.current.textContent = '';
    updateBlockContent(block.id, '');
    usePFCStore.setState((s) => ({
      noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
        b.id === block.id
          ? { ...b, type, properties: { ...b.properties, ...props }, content: '', updatedAt: Date.now() }
          : b,
      ),
    }));
  }, [block.id, updateBlockContent]);

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setSlashOpen(false);
    if (!contentRef.current) return;

    const text = contentRef.current.textContent ?? '';
    const beforeSlash = text.slice(0, slashStartRef.current);
    contentRef.current.textContent = beforeSlash;
    updateBlockContent(block.id, beforeSlash);

    if (cmd.blockType) {
      const props: Record<string, string> = {};
      if (cmd.action === 'heading-1') props.level = '1';
      if (cmd.action === 'heading-2') props.level = '2';
      if (cmd.action === 'heading-3') props.level = '3';
      if (cmd.action === 'todo') props.checked = 'false';
      if (cmd.action === 'callout') props.calloutType = 'info';

      usePFCStore.setState((s) => ({
        noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
          b.id === block.id
            ? { ...b, type: cmd.blockType!, properties: { ...b.properties, ...props }, updatedAt: Date.now() }
            : b,
        ),
      }));
    }
  }, [block.id, updateBlockContent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const text = contentRef.current?.textContent ?? '';

    // Slash command navigation
    if (slashOpen) {
      const filtered = SLASH_COMMANDS.filter(
        (cmd) => cmd.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
          cmd.description.toLowerCase().includes(slashQuery.toLowerCase()),
      );

      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[slashIdx]) handleSlashSelect(filtered[slashIdx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setSlashOpen(false); return; }
    }

    // Enter — create new block below
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newId = createBlock(pageId, block.parentId, block.id);
      requestAnimationFrame(() => setEditingBlock(newId));
    }

    // Backspace on empty block — delete it
    if (e.key === 'Backspace' && text === '' && blockIndex > 0) {
      e.preventDefault();
      deleteBlock(block.id);
    }

    // Tab — indent
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); indentBlock(block.id); }

    // Shift+Tab — outdent
    if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); outdentBlock(block.id); }

    // / — open slash menu
    if (e.key === '/' && !slashOpen) {
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

    // Markdown shortcuts on space
    if (e.key === ' ') {
      if (text === '#') { e.preventDefault(); convertBlock('heading', { level: '1' }); }
      else if (text === '##') { e.preventDefault(); convertBlock('heading', { level: '2' }); }
      else if (text === '###') { e.preventDefault(); convertBlock('heading', { level: '3' }); }
      else if (text === '-' || text === '*') { e.preventDefault(); convertBlock('list-item', {}); }
      else if (text === '1.') { e.preventDefault(); convertBlock('numbered-item', {}); }
      else if (text === '[]' || text === '[ ]') { e.preventDefault(); convertBlock('todo', { checked: 'false' }); }
      else if (text === '>') { e.preventDefault(); convertBlock('quote', {}); }
      else if (text === '---') { e.preventDefault(); convertBlock('divider', {}); }
      else if (text === '```') { e.preventDefault(); convertBlock('code', { language: '' }); }
    }
  }, [block, pageId, blockIndex, slashOpen, slashQuery, slashIdx, createBlock, deleteBlock, indentBlock, outdentBlock, setEditingBlock, handleSlashSelect, convertBlock]);

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

  // ── Block prefix based on type ──

  const renderPrefix = () => {
    switch (block.type) {
      case 'todo': {
        const checked = block.properties.checked === 'true';
        return (
          <button
            onClick={handleTodoToggle}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '1.125rem', height: '1.125rem', border: 'none',
              background: 'transparent', cursor: 'pointer', flexShrink: 0,
              color: checked ? '#34D399' : (isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.2)'),
              marginTop: '0.1875rem',
            }}
          >
            {checked
              ? <CheckSquareIcon style={{ width: '1rem', height: '1rem' }} />
              : <SquareIcon style={{ width: '1rem', height: '1rem' }} />
            }
          </button>
        );
      }
      case 'list-item':
        return (
          <span style={{
            width: '0.375rem', height: '0.375rem', borderRadius: '50%', flexShrink: 0,
            background: isDark ? 'rgba(196,149,106,0.5)' : 'rgba(0,0,0,0.3)',
            marginTop: '0.625rem',
          }} />
        );
      case 'numbered-item':
        return (
          <span style={{
            fontSize: '0.8125rem', fontWeight: 600, flexShrink: 0,
            color: isDark ? 'rgba(196,149,106,0.6)' : 'rgba(0,0,0,0.35)',
            minWidth: '1.25rem', textAlign: 'right', marginTop: '0.1875rem',
          }}>
            {blockIndex + 1}.
          </span>
        );
      case 'quote':
        return (
          <div style={{
            width: '3px', flexShrink: 0, borderRadius: '2px',
            background: isDark ? 'rgba(196,149,106,0.3)' : 'rgba(196,149,106,0.4)',
            alignSelf: 'stretch', marginRight: '0.25rem',
          }} />
        );
      case 'toggle':
        return (
          <button
            onClick={() => toggleBlockCollapse(block.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '1.25rem', height: '1.25rem', border: 'none',
              background: 'transparent', cursor: 'pointer', flexShrink: 0,
              color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.25)',
              transform: block.collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            <ChevronRightIcon style={{ width: '0.875rem', height: '0.875rem' }} />
          </button>
        );
      default:
        return null;
    }
  };

  // ── Block-type-specific styles ──

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
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)',
          whiteSpace: 'pre-wrap',
          display: 'block',
        };
      case 'quote':
        return { ...base, fontStyle: 'italic', color: isDark ? 'rgba(232,228,222,0.7)' : 'rgba(0,0,0,0.55)' };
      case 'callout':
        return {
          ...base,
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
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

  // Divider — non-editable
  if (block.type === 'divider') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.75rem 0',
          paddingLeft: `${block.indent * 1.5}rem`,
        }}
      >
        <div style={{
          flex: 1, height: '1px',
          background: isDark ? 'rgba(79,69,57,0.3)' : 'rgba(190,183,170,0.25)',
        }} />
      </div>
    );
  }

  return (
    <motion.div
      layout="position"
      transition={SPRING}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.375rem',
        paddingLeft: `${block.indent * 1.5}rem`,
        position: 'relative',
        borderRadius: '0.375rem',
        transition: 'background 0.15s',
        background: isEditing
          ? (isDark ? 'rgba(196,149,106,0.04)' : 'rgba(196,149,106,0.02)')
          : 'transparent',
      }}
    >
      {/* Drag handle + add button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.125rem',
        opacity: hovered ? 0.6 : 0,
        transition: 'opacity 0.15s',
        flexShrink: 0,
        marginTop: block.type === 'heading' ? '0.375rem' : '0.1875rem',
      }}>
        <button
          onClick={() => {
            const newId = createBlock(pageId, block.parentId, block.id);
            requestAnimationFrame(() => setEditingBlock(newId));
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '1.125rem', height: '1.125rem', border: 'none',
            borderRadius: '0.25rem', cursor: 'pointer',
            background: 'transparent',
            color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.2)',
          }}
        >
          <PlusIcon style={{ width: '0.75rem', height: '0.75rem' }} />
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '1.125rem', height: '1.125rem', cursor: 'grab',
          color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.2)',
        }}>
          <GripVerticalIcon style={{ width: '0.75rem', height: '0.75rem' }} />
        </div>
      </div>

      {/* Block prefix */}
      {renderPrefix()}

      {/* Content area */}
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
          : 'Type / for commands...'
        }
        style={{
          flex: 1,
          outline: 'none',
          minHeight: '1.5em',
          color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(0,0,0,0.8)',
          caretColor: '#C4956A',
          ...getBlockStyles(),
        }}
      >
        {block.content}
      </div>

      {/* Slash menu */}
      <AnimatePresence>
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
      </AnimatePresence>
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// BlockEditor — renders all blocks for a page
// ═══════════════════════════════════════════════════════════════════

export function BlockEditor({ pageId }: { pageId: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const noteBlocks = usePFCStore((s) => s.noteBlocks);
  const editingBlockId = usePFCStore((s) => s.editingBlockId);
  const setEditingBlock = usePFCStore((s) => s.setEditingBlock);
  const createBlock = usePFCStore((s) => s.createBlock);

  const pageBlocks = useMemo(() => {
    return noteBlocks
      .filter((b: NoteBlock) => b.pageId === pageId)
      .sort((a: NoteBlock, b: NoteBlock) => a.order.localeCompare(b.order));
  }, [noteBlocks, pageId]);

  const handleEmptyClick = useCallback(() => {
    if (pageBlocks.length === 0) {
      const newId = createBlock(pageId);
      requestAnimationFrame(() => setEditingBlock(newId));
    } else {
      const lastBlock = pageBlocks[pageBlocks.length - 1];
      if (lastBlock.content !== '' || (lastBlock.type ?? 'paragraph') !== 'paragraph') {
        const newId = createBlock(pageId, null, lastBlock.id);
        requestAnimationFrame(() => setEditingBlock(newId));
      } else {
        setEditingBlock(lastBlock.id);
      }
    }
  }, [pageBlocks, pageId, createBlock, setEditingBlock]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
      {pageBlocks.map((block, idx) => (
        <BlockItem
          key={block.id}
          block={block}
          isEditing={editingBlockId === block.id}
          isDark={isDark}
          onFocus={() => setEditingBlock(block.id)}
          pageId={pageId}
          blockIndex={idx}
        />
      ))}

      {/* Click zone to add new blocks */}
      <div
        onClick={handleEmptyClick}
        style={{
          minHeight: '12rem',
          cursor: 'text',
          borderRadius: '0.5rem',
        }}
      />
    </div>
  );
}
