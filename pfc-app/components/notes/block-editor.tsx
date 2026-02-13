'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useTheme } from 'next-themes';
import type { NoteBlock, NotePage, BlockType, SlashCommand } from '@/lib/notes/types';
import { SLASH_COMMANDS, SLASH_CATEGORIES, stripHtml, normalizePageName } from '@/lib/notes/types';
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
  ScissorsIcon,
  ClipboardIcon,
  ClipboardPasteIcon,
  Trash2Icon,
  RemoveFormattingIcon,
  PilcrowIcon,
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

// ── Process [[page links]] for display (non-editing blocks) ──
function processContentLinks(html: string): string {
  const parts = html.split(/(<[^>]*>)/);
  return parts
    .map((part) => {
      if (part.startsWith('<')) return part;
      return part.replace(
        /\[\[([^\]]+)\]\]/g,
        '<span class="pfc-page-link" data-page-ref="$1">$1</span>',
      );
    })
    .join('');
}

function isRangeWithinNode(range: Range, node: Node): boolean {
  return node.contains(range.startContainer) && node.contains(range.endContainer);
}

// ═══════════════════════════════════════════════════════════════════
// PageLinkPopup — autocomplete for [[page links]]
// ═══════════════════════════════════════════════════════════════════

function PageLinkPopup({
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
  onSelect: (page: NotePage) => void;
  onClose: () => void;
  selectedIndex: number;
}) {
  const notePages = usePFCStore((s) => s.notePages);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return notePages.slice(0, 12);
    return notePages
      .filter((p: NotePage) => p.title.toLowerCase().includes(q) || p.name.includes(q))
      .slice(0, 12);
  }, [query, notePages]);

  useEffect(() => {
    if (!menuRef.current) return;
    const el = menuRef.current.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (filtered.length === 0 && !query.trim()) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 'var(--z-modal)',
        width: '16rem',
        maxHeight: '18rem',
        overflowY: 'auto',
        borderRadius: '12px',
        background: isDark ? 'rgba(40,36,30,0.95)' : 'rgba(255,255,255,0.97)',
        border: `1px solid ${isDark ? 'rgba(79,69,57,0.4)' : 'rgba(190,183,170,0.25)'}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.5)'
          : '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        padding: '6px',
        backdropFilter: 'blur(20px) saturate(1.5)',
        animation: 'toolbar-in 0.12s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      <div style={{
        fontSize: '0.625rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.25)',
        padding: '6px 8px 4px',
      }}>
        {query.trim() ? 'Link to page' : 'Recent pages'}
      </div>
      {filtered.length === 0 ? (
        <div style={{
          padding: '8px',
          fontSize: '0.75rem',
          color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
        }}>
          No pages found — Enter to create &quot;{query}&quot;
        </div>
      ) : (
        filtered.map((page: NotePage, idx: number) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={page.id}
              data-selected={isSelected ? 'true' : undefined}
              onClick={() => onSelect(page)}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '6px 8px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                background: isSelected
                  ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.12)' : 'rgba(var(--pfc-accent-rgb), 0.08)')
                  : 'transparent',
                color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(0,0,0,0.8)',
                transition: 'background 0.1s',
              }}
            >
              <LinkIcon style={{ width: '12px', height: '12px', color: 'var(--pfc-accent)', flexShrink: 0 }} />
              <span style={{
                fontSize: '0.8125rem',
                fontWeight: 550,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {page.title}
              </span>
              {page.isJournal && (
                <span style={{
                  fontSize: '0.5625rem',
                  color: '#34D399',
                  fontWeight: 500,
                  marginLeft: 'auto',
                  flexShrink: 0,
                }}>
                  Journal
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BlockContextMenu — Craft/Obsidian-style right-click menu
// Replaces the floating toolbar with a full context menu system
// ═══════════════════════════════════════════════════════════════════

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  disabled?: boolean;
}

function BlockContextMenu({
  position,
  isDark,
  onClose,
  onFormat,
  onChangeType,
  onInsert,
  onDelete,
  currentBlockType,
}: {
  position: { x: number; y: number };
  isDark: boolean;
  onClose: () => void;
  onFormat: (command: string) => void;
  onChangeType: (type: BlockType, props?: Record<string, string>) => void;
  onInsert: (type: string) => void;
  onDelete: () => void;
  currentBlockType: BlockType;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [submenuPos, setSubmenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClick);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [onClose]);

  // Clamp menu position to viewport
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const x = Math.min(position.x, window.innerWidth - rect.width - 8);
    const y = Math.min(position.y, window.innerHeight - rect.height - 8);
    setMenuStyle({ top: Math.max(4, y), left: Math.max(4, x) });
  }, [position]);

  const handleCut = () => { document.execCommand('cut'); onClose(); };
  const handleCopy = () => { document.execCommand('copy'); onClose(); };
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      document.execCommand('insertText', false, text);
    } catch { document.execCommand('paste'); }
    onClose();
  };
  const handleSelectAll = () => {
    const sel = window.getSelection();
    const blockEl = sel?.anchorNode?.parentElement?.closest('[data-block-id]');
    if (blockEl) {
      const range = document.createRange();
      range.selectNodeContents(blockEl);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    onClose();
  };

  // Menu definitions
  const formatSubmenu: ContextMenuItem[] = [
    { id: 'bold', label: 'Bold', icon: BoldIcon, shortcut: '⌘B', action: () => { onFormat('bold'); onClose(); } },
    { id: 'italic', label: 'Italic', icon: ItalicIcon, shortcut: '⌘I', action: () => { onFormat('italic'); onClose(); } },
    { id: 'underline', label: 'Underline', icon: UnderlineIcon, shortcut: '⌘U', action: () => { onFormat('underline'); onClose(); } },
    { id: 'strikethrough', label: 'Strikethrough', icon: StrikethroughIcon, shortcut: '⌘⇧S', action: () => { onFormat('strikethrough'); onClose(); } },
    { id: 'sep1', label: '', separator: true },
    { id: 'code', label: 'Inline Code', icon: CodeXmlIcon, shortcut: '⌘E', action: () => { onFormat('inlineCode'); onClose(); } },
    { id: 'highlight', label: 'Highlight', icon: HighlighterIcon, shortcut: '⌘⇧H', action: () => { onFormat('highlight'); onClose(); } },
    { id: 'sep2', label: '', separator: true },
    { id: 'clear', label: 'Clear Formatting', icon: RemoveFormattingIcon, action: () => { document.execCommand('removeFormat'); onClose(); } },
  ];

  const turnIntoSubmenu: ContextMenuItem[] = [
    { id: 'paragraph', label: 'Text', icon: PilcrowIcon, action: () => { onChangeType('paragraph'); onClose(); }, disabled: currentBlockType === 'paragraph' },
    { id: 'h1', label: 'Heading 1', icon: Heading1Icon, action: () => { onChangeType('heading', { level: '1' }); onClose(); } },
    { id: 'h2', label: 'Heading 2', icon: Heading2Icon, action: () => { onChangeType('heading', { level: '2' }); onClose(); } },
    { id: 'h3', label: 'Heading 3', icon: Heading3Icon, action: () => { onChangeType('heading', { level: '3' }); onClose(); } },
    { id: 'sep1', label: '', separator: true },
    { id: 'bullet', label: 'Bullet List', icon: ListIcon, action: () => { onChangeType('list-item'); onClose(); }, disabled: currentBlockType === 'list-item' },
    { id: 'numbered', label: 'Numbered List', icon: ListOrderedIcon, action: () => { onChangeType('numbered-item'); onClose(); }, disabled: currentBlockType === 'numbered-item' },
    { id: 'todo', label: 'To-do', icon: CheckSquareIcon, action: () => { onChangeType('todo', { checked: 'false' }); onClose(); }, disabled: currentBlockType === 'todo' },
    { id: 'sep2', label: '', separator: true },
    { id: 'quote', label: 'Quote', icon: QuoteIcon, action: () => { onChangeType('quote'); onClose(); }, disabled: currentBlockType === 'quote' },
    { id: 'callout', label: 'Callout', icon: AlertCircleIcon, action: () => { onChangeType('callout'); onClose(); }, disabled: currentBlockType === 'callout' },
    { id: 'code-block', label: 'Code Block', icon: CodeIcon, action: () => { onChangeType('code'); onClose(); }, disabled: currentBlockType === 'code' },
    { id: 'toggle', label: 'Toggle', icon: ChevronRightIcon, action: () => { onChangeType('toggle'); onClose(); }, disabled: currentBlockType === 'toggle' },
  ];

  const insertSubmenu: ContextMenuItem[] = [
    { id: 'divider', label: 'Divider', icon: MinusIcon, action: () => { onInsert('divider'); onClose(); } },
    { id: 'page-break', label: 'Page Break', icon: MinusIcon, action: () => { onInsert('page-break'); onClose(); } },
    { id: 'sep1', label: '', separator: true },
    { id: 'table', label: 'Table', icon: TableIcon, action: () => { onInsert('table'); onClose(); } },
    { id: 'image', label: 'Image', icon: ImageIcon, action: () => { onInsert('image'); onClose(); } },
    { id: 'math', label: 'Math Block', icon: SigmaIcon, action: () => { onInsert('math'); onClose(); } },
    { id: 'embed', label: 'Embed', icon: FrameIcon, action: () => { onInsert('embed'); onClose(); } },
  ];

  const menuItems: ContextMenuItem[] = [
    { id: 'format', label: 'Format', icon: BoldIcon, submenu: formatSubmenu },
    { id: 'turn-into', label: 'Turn into', icon: PilcrowIcon, submenu: turnIntoSubmenu },
    { id: 'insert', label: 'Insert below', icon: PlusIcon, submenu: insertSubmenu },
    { id: 'sep-actions', label: '', separator: true },
    { id: 'cut', label: 'Cut', icon: ScissorsIcon, shortcut: '⌘X', action: handleCut },
    { id: 'copy', label: 'Copy', icon: ClipboardIcon, shortcut: '⌘C', action: handleCopy },
    { id: 'paste', label: 'Paste', icon: ClipboardPasteIcon, shortcut: '⌘V', action: handlePaste },
    { id: 'select-all', label: 'Select All', shortcut: '⌘A', action: handleSelectAll },
    { id: 'sep-delete', label: '', separator: true },
    { id: 'delete', label: 'Delete Block', icon: Trash2Icon, action: () => { onDelete(); onClose(); } },
  ];

  const bg = isDark ? 'rgba(28,24,20,0.96)' : 'rgba(255,255,255,0.98)';
  const border = isDark ? 'rgba(79,69,57,0.45)' : 'rgba(190,183,170,0.28)';
  const hoverBg = isDark ? 'rgba(var(--pfc-accent-rgb), 0.1)' : 'rgba(0,0,0,0.04)';
  const textColor = isDark ? 'rgba(232,228,222,0.85)' : 'rgba(0,0,0,0.7)';
  const subtleColor = isDark ? 'rgba(232,228,222,0.38)' : 'rgba(0,0,0,0.32)';
  const dangerColor = isDark ? '#E07850' : '#C44030';
  const sepColor = isDark ? 'rgba(79,69,57,0.35)' : 'rgba(0,0,0,0.06)';

  const handleSubmenuEnter = (itemId: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setSubmenuPos({ top: rect.top - 4, left: rect.right + 2 });
    hoverTimerRef.current = setTimeout(() => setOpenSubmenu(itemId), 80);
  };

  const handleSubmenuLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setOpenSubmenu(null), 200);
  };

  const renderMenuItem = (item: ContextMenuItem, inSubmenu = false) => {
    if (item.separator) {
      return <div key={item.id} style={{ height: 1, margin: '4px 8px', background: sepColor }} />;
    }

    const hasSubmenu = !!item.submenu;
    const isDelete = item.id === 'delete';
    const Icon = item.icon;

    return (
      <div
        key={item.id}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus theft from contentEditable
        onClick={item.disabled ? undefined : item.action}
        onMouseEnter={(e) => {
          if (item.disabled) return;
          (e.currentTarget as HTMLElement).style.background = hoverBg;
          if (hasSubmenu) handleSubmenuEnter(item.id, e);
          else {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            if (!inSubmenu) hoverTimerRef.current = setTimeout(() => setOpenSubmenu(null), 200);
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          if (hasSubmenu) handleSubmenuLeave();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.38rem 0.6rem 0.38rem 0.55rem',
          borderRadius: '6px',
          cursor: item.disabled ? 'default' : 'pointer',
          color: item.disabled ? subtleColor : isDelete ? dangerColor : textColor,
          fontSize: '0.78rem',
          fontWeight: 520,
          letterSpacing: '-0.005em',
          opacity: item.disabled ? 0.5 : 1,
          transition: 'background 0.08s',
          position: 'relative',
        }}
      >
        {Icon && <Icon style={{ width: 14, height: 14, strokeWidth: 2, opacity: 0.7, flexShrink: 0 }} />}
        <span style={{ flex: 1, lineHeight: 1 }}>{item.label}</span>
        {item.shortcut && (
          <span style={{
            fontSize: '0.66rem', fontWeight: 500, color: subtleColor,
            fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
          }}>{item.shortcut}</span>
        )}
        {hasSubmenu && (
          <ChevronRightIcon style={{ width: 12, height: 12, strokeWidth: 2.2, opacity: 0.4, marginLeft: 'auto' }} />
        )}
      </div>
    );
  };

  const renderSubmenu = (items: ContextMenuItem[]) => (
    <div
      onMouseDown={(e) => e.preventDefault()} // Prevent focus theft from contentEditable
      onMouseEnter={() => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }}
      onMouseLeave={handleSubmenuLeave}
      style={{
        position: 'fixed',
        top: Math.min(submenuPos.top, window.innerHeight - 320),
        left: Math.min(submenuPos.left, window.innerWidth - 220),
        width: '13.5rem',
        maxHeight: '22rem',
        overflowY: 'auto',
        padding: '4px',
        borderRadius: '10px',
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.3)'
          : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        zIndex: 'var(--z-modal)',
        animation: 'ctx-sub-in 0.1s cubic-bezier(0.32, 0.72, 0, 1)',
        scrollbarWidth: 'thin',
        scrollbarColor: isDark ? 'rgba(79,69,57,0.3) transparent' : 'rgba(0,0,0,0.08) transparent',
      }}
    >
      {items.map((item) => renderMenuItem(item, true))}
    </div>
  );

  return (
    <div ref={menuRef} onMouseDown={(e) => e.preventDefault()} style={{ display: 'contents' }}>
      <div
        onMouseDown={(e) => e.preventDefault()} // Prevent focus theft from contentEditable
        style={{
          position: 'fixed',
          ...menuStyle,
          width: '14.5rem',
          padding: '4px',
          borderRadius: '10px',
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark
            ? '0 12px 48px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.35)'
            : '0 12px 48px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.07)',
          backdropFilter: 'blur(24px) saturate(1.6)',
          zIndex: 'var(--z-modal)',
          animation: 'ctx-menu-in 0.12s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {menuItems.map((item) => renderMenuItem(item))}
      </div>

      {/* Render submenu — inside menuRef so outside-click detection works */}
      {openSubmenu && (() => {
        const parent = menuItems.find(i => i.id === openSubmenu);
        return parent?.submenu ? renderSubmenu(parent.submenu) : null;
      })()}

      <style>{`
        @keyframes ctx-menu-in {
          from { opacity: 0; transform: scale(0.96) translateY(-2px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ctx-sub-in {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
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
        zIndex: 'var(--z-modal)',
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
        backdropFilter: 'blur(20px) saturate(1.5)',
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
                    ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.12)' : 'rgba(var(--pfc-accent-rgb), 0.08)')
                    : 'transparent',
                  color: isDark ? 'rgba(232,228,222,0.9)' : 'rgba(0,0,0,0.8)',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: '24px', height: '24px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.08)' : 'rgba(0,0,0,0.04)',
                  flexShrink: 0,
                }}>
                  <Icon style={{ width: '13px', height: '13px', color: 'var(--pfc-accent)' }} />
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
// EmbeddedPageContent — renders a page's blocks inline (read-only)
// ═══════════════════════════════════════════════════════════════════

const EmbeddedPageContent = memo(function EmbeddedPageContent({
  pageId,
  isDark,
}: {
  pageId: string;
  isDark: boolean;
}) {
  const noteBlocks = usePFCStore((s) => s.noteBlocks);
  const blocks = useMemo(
    () => noteBlocks
      .filter((b: NoteBlock) => b.pageId === pageId)
      .sort((a: NoteBlock, b: NoteBlock) => a.order.localeCompare(b.order))
      .slice(0, 8), // Limit for performance
    [noteBlocks, pageId],
  );

  if (blocks.length === 0) {
    return (
      <div style={{
        fontSize: '0.75rem',
        color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.25)',
        fontStyle: 'italic',
      }}>
        Empty page
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {blocks.map((b) => (
        <div
          key={b.id}
          style={{
            fontSize: b.type === 'heading'
              ? (b.properties?.level === '1' ? '1rem' : b.properties?.level === '2' ? '0.9375rem' : '0.875rem')
              : '0.8125rem',
            fontWeight: b.type === 'heading' ? 400 : 400,
            fontFamily: b.type === 'heading' ? 'var(--font-heading)' : undefined,
            lineHeight: 1.6,
            color: isDark ? 'rgba(232,228,222,0.7)' : 'rgba(0,0,0,0.6)',
            paddingLeft: `${b.indent * 1}rem`,
          }}
          dangerouslySetInnerHTML={{ __html: processContentLinks(b.content) || '&nbsp;' }}
        />
      ))}
      {blocks.length >= 8 && (
        <div style={{
          fontSize: '0.6875rem',
          color: isDark ? 'rgba(var(--pfc-accent-rgb), 0.4)' : 'rgba(var(--pfc-accent-rgb), 0.5)',
          fontWeight: 500,
        }}>
          Click to view full page →
        </div>
      )}
    </div>
  );
});

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
  readOnly,
  onNavigateToPage,
  isTypewriterTarget,
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
  readOnly?: boolean;
  onNavigateToPage?: (pageTitle: string) => void;
  /** Block is actively receiving typewriter AI output */
  isTypewriterTarget?: boolean;
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

  // [[ page link popup state
  const [bracketOpen, setBracketOpen] = useState(false);
  const [bracketQuery, setBracketQuery] = useState('');
  const [bracketPos, setBracketPos] = useState({ top: 0, left: 0 });
  const [bracketIdx, setBracketIdx] = useState(0);
  const bracketStartRef = useRef<number>(-1);

  // Hover state
  const [hovered, setHovered] = useState(false);

  // Track whether we set innerHTML to avoid input event loops
  const suppressInputRef = useRef(false);

  // Track the last content we synced TO the store, so we know when
  // the store changed externally (e.g., undo/redo)
  const lastSyncedContentRef = useRef(block.content);

  // ── Debounced typing undo — captures content before typing starts,
  // pushes a coalesced transaction after user pauses (500ms)
  const typingSnapshotRef = useRef<string | null>(null);
  const typingUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync content from store → DOM on mount and when block changes
  // When not editing, render [[links]] as clickable styled spans
  // When editing AND store content differs from what we last synced
  // (undo/redo happened), force-update the DOM
  useEffect(() => {
    if (!contentRef.current) return;
    if (!isEditing) {
      const displayContent = processContentLinks(block.content);
      if (contentRef.current.innerHTML !== displayContent) {
        suppressInputRef.current = true;
        contentRef.current.innerHTML = displayContent;
      }
    } else if (block.content !== lastSyncedContentRef.current) {
      // Undo/redo changed the store content — re-sync to DOM
      suppressInputRef.current = true;
      contentRef.current.innerHTML = block.content || '<br>';
      lastSyncedContentRef.current = block.content;
    }
  }, [block.content, isEditing]);

  // ── Typewriter mode sync: stream store content → DOM while AI writes ──
  // Normal sync skips isEditing=true, but typewriter blocks ARE editing.
  // This effect pushes each SSE token into the contentEditable div.
  // Note: block.content is authored by the local note-AI engine (same
  // trust model as the existing content sync paths above).
  const wasTypewriterRef = useRef(false);
  useEffect(() => {
    if (isTypewriterTarget && contentRef.current) {
      wasTypewriterRef.current = true;
      const current = contentRef.current.textContent ?? '';
      const expected = block.content;
      if (current !== expected) {
        suppressInputRef.current = true;
        // SAFETY: innerHTML assignment uses locally-generated AI text with the same
        // trust model as the existing content sync paths in this component.
        contentRef.current.innerHTML = expected;
        contentRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else if (wasTypewriterRef.current && !isTypewriterTarget) {
      // Typewriter just ended — sync lastSyncedContentRef so the main
      // sync effect doesn't fight with user edits after AI finishes
      wasTypewriterRef.current = false;
      lastSyncedContentRef.current = block.content;
    }
  }, [isTypewriterTarget, block.content]);

  // Focus + restore cursor when becoming editing block
  // Skip when typewriter target — AI is writing, don't steal focus
  useEffect(() => {
    if (isEditing && !isTypewriterTarget && contentRef.current) {
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
  // SAFETY: block.content is intentionally omitted — this effect handles focus and
  // cursor placement when isEditing changes, not content sync (handled elsewhere).
  // contentRef and suppressInputRef are stable refs.
  }, [isEditing, isTypewriterTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup typing undo timer on unmount
  useEffect(() => {
    return () => {
      if (typingUndoTimerRef.current) clearTimeout(typingUndoTimerRef.current);
    };
  }, []);

  // ── Input handler — reads innerHTML for rich formatting ──
  const handleInput = useCallback(() => {
    if (suppressInputRef.current) { suppressInputRef.current = false; return; }
    if (!contentRef.current) return;
    const html = contentRef.current.innerHTML;
    // Normalize browser-generated empty content
    const cleaned = html === '<br>' ? '' : html;

    // ── Debounced typing undo — capture snapshot before first keystroke
    if (typingSnapshotRef.current === null) {
      typingSnapshotRef.current = lastSyncedContentRef.current;
    }
    // Reset the debounce timer on each keystroke
    if (typingUndoTimerRef.current) clearTimeout(typingUndoTimerRef.current);
    typingUndoTimerRef.current = setTimeout(() => {
      // Push coalesced typing transaction after 500ms pause
      const snapshot = typingSnapshotRef.current;
      typingSnapshotRef.current = null;
      typingUndoTimerRef.current = null;
      if (snapshot !== null && snapshot !== cleaned) {
        usePFCStore.getState().pushTransaction(
          [{ action: 'update', blockId: block.id, pageId, data: { content: cleaned } }],
          [{ action: 'update', blockId: block.id, pageId, previousData: { content: snapshot } }],
        );
      }
    }, 500);

    lastSyncedContentRef.current = cleaned;
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

    // [[ bracket link tracking
    if (bracketOpen) {
      const text = contentRef.current.textContent ?? '';
      const afterBracket = text.slice(bracketStartRef.current + 2);
      if (afterBracket.includes(']]')) {
        setBracketOpen(false);
      } else {
        setBracketQuery(afterBracket);
        setBracketIdx(0);
      }
    }

    // Detect [[ being typed — open page link popup
    if (!bracketOpen && !slashOpen) {
      const text = contentRef.current.textContent ?? '';
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (!isRangeWithinNode(range, contentRef.current)) return;
        // Get text content up to cursor
        let textBefore = '';
        try {
          const beforeRange = document.createRange();
          beforeRange.setStart(contentRef.current, 0);
          beforeRange.setEnd(range.startContainer, range.startOffset);
          const tmpDiv = document.createElement('div');
          tmpDiv.appendChild(beforeRange.cloneContents());
          textBefore = tmpDiv.textContent ?? '';
        } catch {
          return;
        }

        if (textBefore.endsWith('[[')) {
          const rect = range.getBoundingClientRect();
          // Constrain popup to viewport (256px = popup width)
          const safeLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 264));
          setBracketPos({ top: rect.bottom + 4, left: safeLeft });
          setBracketOpen(true);
          setBracketQuery('');
          setBracketIdx(0);
          bracketStartRef.current = textBefore.length - 2;
        }
      }
    }
  }, [block.id, updateBlockContent, slashOpen, bracketOpen]);

  // ── Apply inline formatting (SiYuan keyboard shortcuts) ──
  // Pushes a transaction so Cmd+Z can undo format changes
  const applyFormat = useCallback((command: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (!contentRef.current) return;

    // Capture before-state for undo
    const oldHtml = contentRef.current.innerHTML;
    const oldContent = oldHtml === '<br>' ? '' : oldHtml;

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
          background: ${isDark ? 'rgba(var(--pfc-accent-rgb), 0.1)' : 'rgba(0,0,0,0.06)'};
          padding: 0.125em 0.35em;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 0.875em;
          color: ${isDark ? '#E8B06A' : '#B07D42'};
        `;
        try {
          range.surroundContents(code);
        } catch {
          break;
        }
        break;
      }
      case 'highlight': {
        const range = sel.getRangeAt(0);
        if (range.collapsed) break;
        const mark = document.createElement('mark');
        mark.style.cssText = `background: rgba(251,191,36,0.25); padding: 0 2px; border-radius: 2px;`;
        try {
          range.surroundContents(mark);
        } catch {
          break;
        }
        break;
      }
    }

    // Capture after-state and sync to store
    const newHtml = contentRef.current.innerHTML;
    const newContent = newHtml === '<br>' ? '' : newHtml;

    if (newContent !== oldContent) {
      lastSyncedContentRef.current = newContent;
      updateBlockContent(block.id, newContent);
      // Push transaction for undo/redo
      usePFCStore.getState().pushTransaction(
        [{ action: 'update', blockId: block.id, pageId, data: { content: newContent } }],
        [{ action: 'update', blockId: block.id, pageId, previousData: { content: oldContent } }],
      );
    }
  }, [block.id, pageId, isDark, updateBlockContent]);

  // ── Slash command select ──
  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setSlashOpen(false);
    if (!contentRef.current) return;

    // Remove the slash text
    const text = contentRef.current.textContent ?? '';
    const beforeSlash = text.slice(0, slashStartRef.current);

    // Handle page-link: insert [[ and open page link popup
    if (cmd.action === 'page-link') {
      const newContent = beforeSlash + '[[';
      suppressInputRef.current = true;
      contentRef.current.innerHTML = newContent;
      updateBlockContent(block.id, newContent);
      // Place cursor after [[
      requestAnimationFrame(() => {
        if (!contentRef.current) return;
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(contentRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
        // Open bracket popup
        const rect = range.getBoundingClientRect();
        setBracketPos({ top: rect.bottom + 4, left: rect.left });
        setBracketOpen(true);
        setBracketQuery('');
        setBracketIdx(0);
        bracketStartRef.current = beforeSlash.length;
      });
      return;
    }

    // Handle embed-page: change to embed type
    if (cmd.action === 'embed-page') {
      suppressInputRef.current = true;
      contentRef.current.innerHTML = '';
      updateBlockContent(block.id, '');
      changeBlockType(block.id, 'embed', {});
      // Open bracket popup so user can select which page to embed
      requestAnimationFrame(() => {
        const el = contentRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setBracketPos({ top: rect.bottom + 4, left: rect.left });
        setBracketOpen(true);
        setBracketQuery('');
        setBracketIdx(0);
        bracketStartRef.current = 0;
      });
      return;
    }

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

  // ── Page link bracket select ──
  const handleBracketSelect = useCallback((page: NotePage) => {
    setBracketOpen(false);
    if (!contentRef.current) return;

    const text = contentRef.current.textContent ?? '';

    if (block.type === 'embed') {
      // For embed blocks, store the page ID in properties
      usePFCStore.setState((s) => ({
        noteBlocks: s.noteBlocks.map((b: NoteBlock) =>
          b.id === block.id
            ? { ...b, properties: { ...b.properties, embedPageId: page.id, embedPageTitle: page.title }, updatedAt: Date.now() }
            : b,
        ),
      }));
      setTimeout(() => usePFCStore.getState().saveNotesToStorage(), 100);
      return;
    }

    // For regular blocks, insert [[PageTitle]] at the bracket position
    const beforeBracket = text.slice(0, bracketStartRef.current);
    const afterQuery = text.slice(bracketStartRef.current + 2 + bracketQuery.length);
    const newContent = beforeBracket + '[[' + page.title + ']]' + afterQuery;
    suppressInputRef.current = true;
    contentRef.current.innerHTML = newContent;
    updateBlockContent(block.id, newContent);

    // Place cursor after the closing ]]
    requestAnimationFrame(() => {
      if (!contentRef.current) return;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, [block.id, block.type, bracketQuery, updateBlockContent]);

  // ── Click handler for page links ──
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('pfc-page-link')) {
      e.preventDefault();
      e.stopPropagation();
      const pageRef = target.getAttribute('data-page-ref');
      if (pageRef && onNavigateToPage) {
        onNavigateToPage(pageRef);
      }
    }
  }, [onNavigateToPage]);

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

    // ── [[ page link popup nav ──
    if (bracketOpen) {
      const allPages = usePFCStore.getState().notePages;
      const q = bracketQuery.toLowerCase().trim();
      const filtered = q
        ? allPages.filter((p: NotePage) => p.title.toLowerCase().includes(q) || p.name.includes(q)).slice(0, 12)
        : allPages.slice(0, 12);

      if (e.key === 'ArrowDown') { e.preventDefault(); setBracketIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setBracketIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[bracketIdx]) {
          handleBracketSelect(filtered[bracketIdx]);
        } else if (bracketQuery.trim()) {
          // Create new page with the typed name
          const newPageId = usePFCStore.getState().ensurePage(bracketQuery.trim());
          const newPage = usePFCStore.getState().notePages.find((p: NotePage) => p.id === newPageId);
          if (newPage) handleBracketSelect(newPage);
        }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setBracketOpen(false); return; }
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
      if (!isRangeWithinNode(range, contentRef.current)) {
        const newId = createBlock(pageId, block.parentId, block.id);
        requestAnimationFrame(() => setEditingBlock(newId));
        return;
      }

      let htmlBefore = '';
      let htmlAfter = '';
      try {
        const beforeRange = document.createRange();
        beforeRange.setStart(contentRef.current, 0);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        const afterRange = document.createRange();
        afterRange.setStart(range.endContainer, range.endOffset);
        afterRange.setEnd(contentRef.current, contentRef.current.childNodes.length);

        const beforeFrag = beforeRange.cloneContents();
        const afterFrag = afterRange.cloneContents();

        const tmpBefore = document.createElement('div');
        tmpBefore.appendChild(beforeFrag);
        const tmpAfter = document.createElement('div');
        tmpAfter.appendChild(afterFrag);

        htmlBefore = tmpBefore.innerHTML;
        htmlAfter = tmpAfter.innerHTML;
      } catch {
        const newId = createBlock(pageId, block.parentId, block.id);
        requestAnimationFrame(() => setEditingBlock(newId));
        return;
      }

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

    // ── Markdown shortcuts on Space (Obsidian-complete set) ──
    if (e.key === ' ' && !isMod) {
      // Headings: # through ######
      if (text === '#') { e.preventDefault(); changeBlockType(block.id, 'heading', { level: '1' }); }
      else if (text === '##') { e.preventDefault(); changeBlockType(block.id, 'heading', { level: '2' }); }
      else if (text === '###') { e.preventDefault(); changeBlockType(block.id, 'heading', { level: '3' }); }
      else if (text === '####') { e.preventDefault(); changeBlockType(block.id, 'heading', { level: '4' }); }
      else if (text === '#####') { e.preventDefault(); changeBlockType(block.id, 'heading', { level: '5' }); }
      else if (text === '######') { e.preventDefault(); changeBlockType(block.id, 'heading', { level: '6' }); }
      // Bullet list: - or * or +
      else if (text === '-' || text === '*' || text === '+') { e.preventDefault(); changeBlockType(block.id, 'list-item', {}); }
      // Numbered list: 1. 2. etc
      else if (/^\d+\.$/.test(text)) { e.preventDefault(); changeBlockType(block.id, 'numbered-item', {}); }
      // Todo / checkbox: [] [ ] [x] -[] -[ ] - [] - [ ]
      else if (/^-?\s?\[[\sx]?\]$/.test(text)) { e.preventDefault(); changeBlockType(block.id, 'todo', { checked: text.includes('x') ? 'true' : 'false' }); }
      // Quote: >
      else if (text === '>') { e.preventDefault(); changeBlockType(block.id, 'quote', {}); }
      // Callout: >! or >> (Obsidian-style callout)
      else if (text === '>!' || text === '>>') { e.preventDefault(); changeBlockType(block.id, 'callout', {}); }
      // Divider / horizontal rule: --- or *** or ___
      else if (text === '---' || text === '***' || text === '___') { e.preventDefault(); changeBlockType(block.id, 'divider', {}); }
      // Code block: ```
      else if (text === '```') { e.preventDefault(); changeBlockType(block.id, 'code', { language: '' }); }
      // Code block with language: ```js ```python etc.
      else if (text.startsWith('```') && text.length > 3) {
        e.preventDefault();
        changeBlockType(block.id, 'code', { language: text.slice(3).trim() });
      }
      // Math block: $$ (LaTeX)
      else if (text === '$$') { e.preventDefault(); changeBlockType(block.id, 'math', {}); }
      // Toggle / collapsible: >>>
      else if (text === '>>>') { e.preventDefault(); changeBlockType(block.id, 'toggle', {}); }
    }
  }, [
    block, pageId, blockIndex, slashOpen, slashQuery, slashIdx,
    bracketOpen, bracketQuery, bracketIdx, handleBracketSelect,
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
            background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.5)' : 'rgba(0,0,0,0.3)',
            marginTop: '10px',
          }} />
        );
      case 'numbered-item':
        return (
          <span style={{
            fontSize: '0.8125rem', fontWeight: 600, flexShrink: 0,
            color: isDark ? 'rgba(var(--pfc-accent-rgb), 0.6)' : 'rgba(0,0,0,0.35)',
            minWidth: '20px', textAlign: 'right', marginTop: '3px',
          }}>
            {blockIndex + 1}.
          </span>
        );
      case 'quote':
        return (
          <div style={{
            width: '3px', flexShrink: 0, borderRadius: '2px',
            background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.3)' : 'rgba(var(--pfc-accent-rgb), 0.4)',
            alignSelf: 'stretch', marginRight: '4px',
          }} />
        );
      case 'heading':
        return (
          <button
            onClick={() => toggleBlockCollapse(block.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '18px', height: '18px', border: 'none',
              background: 'transparent', cursor: 'pointer', flexShrink: 0,
              color: isDark ? 'rgba(155,150,137,0.35)' : 'rgba(0,0,0,0.18)',
              transform: block.collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: `transform 0.15s ${CUP}, opacity 0.15s`,
              opacity: hovered || block.collapsed ? 1 : 0,
              marginTop: '2px',
            }}
          >
            <ChevronRightIcon style={{ width: '13px', height: '13px' }} />
          </button>
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
        const headingBase = { ...base, fontFamily: 'var(--font-heading)', position: 'relative' as const };
        if (level === 1) return { ...headingBase, fontSize: '1.5rem', fontWeight: 400, lineHeight: 1.3, letterSpacing: '-0.01em' };
        if (level === 2) return { ...headingBase, fontSize: '1.25rem', fontWeight: 400, lineHeight: 1.35, letterSpacing: '-0.01em' };
        return { ...headingBase, fontSize: '1rem', fontWeight: 400, lineHeight: 1.4 };
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
          background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.06)' : 'rgba(var(--pfc-accent-rgb), 0.04)',
          borderLeft: '3px solid var(--pfc-accent)',
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

  // ── Embed block — renders embedded page content ──
  if (block.type === 'embed') {
    const embedPageId = block.properties.embedPageId;
    const embedPageTitle = block.properties.embedPageTitle;

    return (
      <div
        className="pfc-block"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          paddingLeft: `${block.indent * 1.5}rem`,
          transform: 'translateZ(0)',
          contain: 'layout style',
          marginBottom: '4px',
        }}
      >
        <div style={{
          border: `1px solid ${isDark ? 'rgba(var(--pfc-accent-rgb), 0.15)' : 'rgba(var(--pfc-accent-rgb), 0.2)'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.03)' : 'rgba(var(--pfc-accent-rgb), 0.02)',
          cursor: embedPageId ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (embedPageId && onNavigateToPage && embedPageTitle) {
            onNavigateToPage(embedPageTitle);
          }
        }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: isDark ? 'rgba(var(--pfc-accent-rgb), 0.6)' : 'rgba(var(--pfc-accent-rgb), 0.7)',
            marginBottom: embedPageId ? '8px' : 0,
          }}>
            <FrameIcon style={{ width: '12px', height: '12px' }} />
            {embedPageId ? `Embedded: ${embedPageTitle ?? 'Page'}` : 'Select a page to embed (use / → Embed Page)'}
          </div>
          {embedPageId && (
            <EmbeddedPageContent pageId={embedPageId} isDark={isDark} />
          )}
        </div>
      </div>
    );
  }

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
          background: isTypewriterTarget
            ? (isDark ? 'rgba(52,211,153,0.06)' : 'rgba(52,211,153,0.04)')
            : (isDark ? 'rgba(var(--pfc-accent-rgb), 0.06)' : 'rgba(var(--pfc-accent-rgb), 0.04)'),
          opacity: isTypewriterTarget ? 1 : isEditing ? 1 : hovered ? 0.5 : 0,
          border: isTypewriterTarget ? '1px solid rgba(52,211,153,0.25)' : 'none',
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
            background: 'var(--pfc-accent)',
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
        zIndex: 'var(--z-base)',
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
      <div style={{ position: 'relative', zIndex: 'var(--z-base)', display: 'flex', alignItems: 'flex-start' }}>
        {renderPrefix()}
      </div>

      {/* ── Auto-generated badge — sparkle indicator for AI-generated blocks ── */}
      {block.properties?.autoGenerated === 'true' && !isEditing && (
        <div
          title="AI-generated content"
          style={{
            position: 'absolute',
            right: 4,
            top: 4,
            opacity: hovered ? 0.6 : 0.25,
            transition: `opacity 0.15s ${CUP}`,
            transform: 'translateZ(0)',
            zIndex: 'calc(var(--z-base) + 1)',
            pointerEvents: 'none',
          }}
        >
          <SparklesIcon style={{ width: '10px', height: '10px', color: 'var(--pfc-accent)' }} />
        </div>
      )}

      {/* ── Content area (contentEditable with rich formatting) ── */}
      <div
        ref={contentRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onFocus={onFocus}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleContentClick}
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
          caretColor: 'var(--pfc-accent)',
          wordBreak: 'break-word',
          position: 'relative',
          zIndex: 'var(--z-base)',
          ...getBlockStyles(),
        }}
      />

      {/* ── Typewriter cursor indicator — shows when AI is writing into this block ── */}
      {isTypewriterTarget && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.5rem',
          pointerEvents: 'none',
        }}>
          <span style={{
            display: 'inline-block',
            width: 7,
            height: 16,
            background: '#34D399',
            borderRadius: 1.5,
            animation: 'typewriter-blink 0.8s step-end infinite',
          }} />
          <span style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            color: '#34D399',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            opacity: 0.7,
          }}>
            AI writing...
          </span>
          <style>{`
            @keyframes typewriter-blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
          `}</style>
        </div>
      )}

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

      {/* ── [[ Page link popup ── */}
      {bracketOpen && (
        <PageLinkPopup
          query={bracketQuery}
          position={bracketPos}
          isDark={isDark}
          onSelect={handleBracketSelect}
          onClose={() => setBracketOpen(false)}
          selectedIndex={bracketIdx}
        />
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// BlockEditor — renders all blocks for a page
// Handles floating toolbar, drag-drop coordination, block navigation
// ═══════════════════════════════════════════════════════════════════

export function BlockEditor({ pageId, readOnly }: { pageId: string; readOnly?: boolean }) {
  const { resolvedTheme } = useTheme();
  const isDark = (resolvedTheme === 'dark' || resolvedTheme === 'oled' || resolvedTheme === 'navy' || resolvedTheme === 'cosmic');

  const noteBlocks = usePFCStore((s) => s.noteBlocks);
  const notePages = usePFCStore((s) => s.notePages);
  const editingBlockId = usePFCStore((s) => s.editingBlockId);
  const setEditingBlock = usePFCStore((s) => s.setEditingBlock);
  const createBlock = usePFCStore((s) => s.createBlock);
  const moveBlock = usePFCStore((s) => s.moveBlock);
  const setActivePage = usePFCStore((s) => s.setActivePage);
  const ensurePage = usePFCStore((s) => s.ensurePage);

  // Typewriter mode — track which block is being written to
  const typewriterBlockId = usePFCStore((s) => s.noteAI.writeToNote ? s.noteAI.typewriterBlockId : null);
  const isTypewriting = usePFCStore((s) => s.noteAI.writeToNote && s.noteAI.isGenerating);

  // ── Navigate to a page by title (from [[link]] click) ──
  const handleNavigateToPage = useCallback((pageTitle: string) => {
    const normalized = normalizePageName(pageTitle);
    const existing = notePages.find((p: NotePage) => p.name === normalized || p.title === pageTitle);
    if (existing) {
      setActivePage(existing.id);
    } else {
      // Create page if it doesn't exist
      const newId = ensurePage(pageTitle);
      setActivePage(newId);
    }
  }, [notePages, setActivePage, ensurePage]);

  // Context menu state (replaces floating toolbar)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);
  const changeBlockType = usePFCStore((s) => s.changeBlockType);
  const deleteBlock = usePFCStore((s) => s.deleteBlock);

  // Drag state
  const dragSourceRef = useRef<string | null>(null);
  const dragTargetRef = useRef<string | null>(null);

  // Save selection range when context menu opens (restored before format commands)
  const ctxSavedRangeRef = useRef<Range | null>(null);

  // Page blocks sorted, with collapsed heading/toggle children filtered out
  const pageBlocks = useMemo(() => {
    const sorted = noteBlocks
      .filter((b: NoteBlock) => b.pageId === pageId)
      .sort((a: NoteBlock, b: NoteBlock) => a.order.localeCompare(b.order));

    // Build lookup map for parent checks
    const blockById = new Map(sorted.map(b => [b.id, b]));

    const visible: NoteBlock[] = [];
    const hiddenIds = new Set<string>(); // tracks all hidden block IDs for recursive hiding
    let hiddenUntilLevel = -1; // heading collapse: -1 = not hiding

    for (const block of sorted) {
      // 1. If any ancestor is hidden, this block is also hidden (recursive parent collapse)
      if (block.parentId && hiddenIds.has(block.parentId)) {
        hiddenIds.add(block.id);
        continue;
      }

      // 2. Check if direct parent is a collapsed toggle block
      if (block.parentId) {
        const parent = blockById.get(block.parentId);
        if (parent && parent.type === 'toggle' && parent.collapsed) {
          hiddenIds.add(block.id);
          continue;
        }
      }

      // 3. Heading-level collapsing (document order based)
      if (block.type === 'heading') {
        const level = parseInt(block.properties.level || '1', 10);
        if (hiddenUntilLevel > 0) {
          if (level <= hiddenUntilLevel) {
            // Same or higher level heading ends the collapsed section
            hiddenUntilLevel = -1;
          } else {
            hiddenIds.add(block.id);
            continue;
          }
        }
        visible.push(block);
        if (block.collapsed) {
          hiddenUntilLevel = level;
        }
      } else {
        // Non-heading block under collapsed heading section
        if (hiddenUntilLevel > 0) {
          hiddenIds.add(block.id);
          continue;
        }
        visible.push(block);
      }
    }

    return visible;
  }, [noteBlocks, pageId]);

  // ── Context menu handler (right-click → block context menu) ──
  // Always prevent default inside editor to suppress browser menu
  // Save the current selection so format commands can restore it
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Capture current selection before menu steals focus
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      ctxSavedRangeRef.current = sel.getRangeAt(0).cloneContents() ? sel.getRangeAt(0).cloneRange() : null;
    } else {
      ctxSavedRangeRef.current = null;
    }
    const target = e.target as HTMLElement;
    const blockEl = target.closest?.('[data-block-id]');
    const blockId = blockEl?.getAttribute('data-block-id') ?? pageBlocks[0]?.id ?? '';
    if (blockId) {
      setCtxMenu({ x: e.clientX, y: e.clientY, blockId });
    }
  }, [pageBlocks]);

  // ── Format handler for toolbar / context menu ──
  // Pushes undo transaction so Cmd+Z works for format changes
  const handleFormat = useCallback((command: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // Find the block element BEFORE formatting to capture old content
    const preRange = sel.getRangeAt(0);
    const preContainer = preRange.commonAncestorContainer;
    const blockEl = (preContainer.nodeType === 3 ? preContainer.parentElement : preContainer as HTMLElement)?.closest('[data-block-id]') as HTMLElement;
    const oldHtml = blockEl ? blockEl.innerHTML : null;
    const blockId = blockEl?.getAttribute('data-block-id');

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
          background: ${isDark ? 'rgba(var(--pfc-accent-rgb), 0.1)' : 'rgba(0,0,0,0.06)'};
          padding: 0.125em 0.35em; border-radius: 4px;
          font-family: var(--font-mono); font-size: 0.875em;
          color: ${isDark ? '#E8B06A' : '#B07D42'};
        `;
        try {
          range.surroundContents(code);
        } catch {
          break;
        }
        break;
      }
      case 'highlight': {
        const range = sel.getRangeAt(0);
        if (range.collapsed) break;
        const mark = document.createElement('mark');
        mark.style.cssText = `background: rgba(251,191,36,0.25); padding: 0 2px; border-radius: 2px;`;
        try {
          range.surroundContents(mark);
        } catch {
          break;
        }
        break;
      }
    }

    // Sync the modified block to store + push undo transaction
    if (blockEl && blockId) {
      const newHtml = blockEl.innerHTML;
      const oldContent = oldHtml === '<br>' ? '' : (oldHtml ?? '');
      const newContent = newHtml === '<br>' ? '' : newHtml;
      if (newContent !== oldContent) {
        usePFCStore.getState().updateBlockContent(blockId, newContent);
        usePFCStore.getState().pushTransaction(
          [{ action: 'update', blockId, pageId, data: { content: newContent } }],
          [{ action: 'update', blockId, pageId, previousData: { content: oldContent } }],
        );
      }
    }
  }, [isDark, pageId]);

  // ── Navigate between blocks ──
  const handleNavigate = useCallback((direction: 'up' | 'down', currentBlockId: string) => {
    const idx = pageBlocks.findIndex((b: NoteBlock) => b.id === currentBlockId);
    if (direction === 'up' && idx > 0) {
      setEditingBlock(pageBlocks[idx - 1]!.id);
    } else if (direction === 'down' && idx < pageBlocks.length - 1) {
      setEditingBlock(pageBlocks[idx + 1]!.id);
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
      const lastBlock = pageBlocks[pageBlocks.length - 1]!;
      if (stripHtml(lastBlock.content) !== '' || (lastBlock.type ?? 'paragraph') !== 'paragraph') {
        const newId = createBlock(pageId, null, lastBlock.id);
        requestAnimationFrame(() => setEditingBlock(newId));
      } else {
        setEditingBlock(lastBlock.id);
      }
    }
  }, [pageBlocks, pageId, createBlock, setEditingBlock]);

  // ── Context menu callbacks ──
  const handleCtxFormat = useCallback((command: string) => {
    // Restore saved selection before executing format (menu click steals focus)
    const savedRange = ctxSavedRangeRef.current;
    if (savedRange) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    }
    handleFormat(command);
    ctxSavedRangeRef.current = null;
  }, [handleFormat]);

  const handleCtxChangeType = useCallback((type: BlockType, props?: Record<string, string>) => {
    if (ctxMenu?.blockId) {
      changeBlockType(ctxMenu.blockId, type, props ?? {});
    }
  }, [ctxMenu, changeBlockType]);

  const handleCtxInsert = useCallback((type: string) => {
    if (!ctxMenu?.blockId) return;
    const newId = createBlock(pageId, null, ctxMenu.blockId, '', type as BlockType);
    requestAnimationFrame(() => setEditingBlock(newId));
  }, [ctxMenu, createBlock, pageId, setEditingBlock]);

  const handleCtxDelete = useCallback(() => {
    if (ctxMenu?.blockId) {
      deleteBlock(ctxMenu.blockId);
    }
  }, [ctxMenu, deleteBlock]);

  const ctxBlock = ctxMenu ? pageBlocks.find((b: NoteBlock) => b.id === ctxMenu.blockId) : null;

  return (
    <>
      {/* Right-click context menu (replaces floating toolbar) */}
      {ctxMenu && ctxBlock && (
        <BlockContextMenu
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          isDark={isDark}
          onClose={() => setCtxMenu(null)}
          onFormat={handleCtxFormat}
          onChangeType={handleCtxChangeType}
          onInsert={handleCtxInsert}
          onDelete={handleCtxDelete}
          currentBlockType={ctxBlock.type}
        />
      )}

      {/* Block list — GPU-promoted container with paint containment */}
      <div
        onContextMenu={handleContextMenu}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          contain: 'layout style',
          transform: 'translateZ(0)',
        }}
      >
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
            readOnly={readOnly || (isTypewriting && block.id === typewriterBlockId)}
            onNavigateToPage={handleNavigateToPage}
            isTypewriterTarget={isTypewriting && block.id === typewriterBlockId}
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
          background: ${isDark ? 'rgba(var(--pfc-accent-rgb), 0.1)' : 'rgba(0,0,0,0.06)'};
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
        .pfc-page-link {
          color: var(--pfc-accent);
          cursor: pointer;
          border-bottom: 1px solid rgba(var(--pfc-accent-rgb), 0.3);
          font-weight: 500;
          transition: border-color 0.15s, color 0.15s;
          text-decoration: none;
        }
        .pfc-page-link:hover {
          border-bottom-color: var(--pfc-accent);
          color: #D4B896;
        }
      `}</style>
    </>
  );
}
