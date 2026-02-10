'use client';

import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  HighlighterIcon,
  Heading1Icon,
  Heading2Icon,
  ListIcon,
  ListOrderedIcon,
  CheckSquareIcon,
  QuoteIcon,
  CodeIcon,
  MinusIcon,
  ImageIcon,
  TableIcon,
  LinkIcon,
  SigmaIcon,
  PenLineIcon,
  TypeIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  type LucideIcon,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// Format Ribbon — OneNote-style formatting bar with Home/Insert tabs
// Glass-morphism design, NavBubble-consistent styling
// ═══════════════════════════════════════════════════════════════════

const CUP_EASE = [0.32, 0.72, 0, 1] as const;

type RibbonTab = 'home' | 'insert';

interface FormatAction {
  id: string;
  label: string;
  icon: LucideIcon;
  command: string;
  arg?: string;
  group: string;
}

const HOME_ACTIONS: FormatAction[] = [
  // Text formatting
  { id: 'bold', label: 'Bold', icon: BoldIcon, command: 'bold', group: 'format' },
  { id: 'italic', label: 'Italic', icon: ItalicIcon, command: 'italic', group: 'format' },
  { id: 'underline', label: 'Underline', icon: UnderlineIcon, command: 'underline', group: 'format' },
  { id: 'strike', label: 'Strikethrough', icon: StrikethroughIcon, command: 'strikeThrough', group: 'format' },
  { id: 'highlight', label: 'Highlight', icon: HighlighterIcon, command: 'hiliteColor', arg: '#FBBF2440', group: 'format' },
  { id: 'code', label: 'Code', icon: CodeIcon, command: 'pfc-inline-code', group: 'format' },
  // Alignment
  { id: 'alignLeft', label: 'Align left', icon: AlignLeftIcon, command: 'justifyLeft', group: 'align' },
  { id: 'alignCenter', label: 'Center', icon: AlignCenterIcon, command: 'justifyCenter', group: 'align' },
  { id: 'alignRight', label: 'Align right', icon: AlignRightIcon, command: 'justifyRight', group: 'align' },
  // Block types
  { id: 'h1', label: 'Heading 1', icon: Heading1Icon, command: 'formatBlock', arg: 'h1', group: 'block' },
  { id: 'h2', label: 'Heading 2', icon: Heading2Icon, command: 'formatBlock', arg: 'h2', group: 'block' },
  { id: 'quote', label: 'Quote', icon: QuoteIcon, command: 'formatBlock', arg: 'blockquote', group: 'block' },
];

const INSERT_ACTIONS: FormatAction[] = [
  { id: 'bullet', label: 'Bullet list', icon: ListIcon, command: 'insertUnorderedList', group: 'list' },
  { id: 'numbered', label: 'Numbered list', icon: ListOrderedIcon, command: 'insertOrderedList', group: 'list' },
  { id: 'todo', label: 'Checkbox', icon: CheckSquareIcon, command: 'pfc-todo', group: 'list' },
  { id: 'divider', label: 'Divider', icon: MinusIcon, command: 'insertHorizontalRule', group: 'media' },
  { id: 'link', label: 'Link', icon: LinkIcon, command: 'pfc-link', group: 'media' },
  { id: 'image', label: 'Image', icon: ImageIcon, command: 'pfc-image', group: 'media' },
  { id: 'table', label: 'Table', icon: TableIcon, command: 'pfc-table', group: 'media' },
  { id: 'math', label: 'Math', icon: SigmaIcon, command: 'pfc-math', group: 'media' },
];

interface FormatRibbonProps {
  isDark: boolean;
  activeTab: RibbonTab;
  onTabChange: (tab: RibbonTab) => void;
  onFormatAction?: (action: FormatAction) => void;
}

export const FormatRibbon = memo(function FormatRibbon({
  isDark,
  activeTab,
  onTabChange,
  onFormatAction,
}: FormatRibbonProps) {
  const actions = activeTab === 'home' ? HOME_ACTIONS : INSERT_ACTIONS;

  const handleAction = useCallback((action: FormatAction) => {
    if (onFormatAction) {
      onFormatAction(action);
      return;
    }
    // Default: use document.execCommand for basic formatting
    if (action.command.startsWith('pfc-')) {
      // Custom commands handled by parent
      return;
    }
    document.execCommand(action.command, false, action.arg);
  }, [onFormatAction]);

  const bg = isDark ? 'rgba(20,19,17,0.92)' : 'rgba(248,244,238,0.92)';
  const border = isDark ? 'rgba(79,69,57,0.25)' : 'rgba(208,196,180,0.25)';
  const text = isDark ? 'rgba(237,224,212,0.8)' : 'rgba(0,0,0,0.6)';
  const muted = isDark ? 'rgba(156,143,128,0.35)' : 'rgba(0,0,0,0.15)';
  const accent = '#C4956A';
  const hoverBg = isDark ? 'rgba(244,189,111,0.08)' : 'rgba(0,0,0,0.04)';

  // Group actions for visual separators
  const groups: FormatAction[][] = [];
  let lastGroup = '';
  for (const action of actions) {
    if (action.group !== lastGroup) {
      groups.push([]);
      lastGroup = action.group;
    }
    groups[groups.length - 1].push(action);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: CUP_EASE }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '4px 8px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
      }}
    >
      {groups.map((group, gi) => (
        <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
          {gi > 0 && (
            <div style={{
              width: 1,
              height: 18,
              background: muted,
              margin: '0 4px',
              flexShrink: 0,
            }} />
          )}
          {group.map((action) => (
            <motion.button
              key={action.id}
              onClick={() => handleAction(action)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              title={action.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: text,
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <action.icon style={{ width: 14, height: 14 }} />
            </motion.button>
          ))}
        </div>
      ))}
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// Export types for parent consumption
// ═══════════════════════════════════════════════════════════════════

export type { RibbonTab, FormatAction };
