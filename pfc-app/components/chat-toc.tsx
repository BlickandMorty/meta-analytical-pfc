'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { extractHeadings, type TocEntry } from './markdown-content';
import { useTheme } from 'next-themes';
import { ListIcon } from 'lucide-react';
import type { ChatMessage } from '@/lib/engine/types';

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 };

const selectMessages = (s: { messages: ChatMessage[] }) => s.messages;

function ChatTOCInner({ scrollContainerRef }: { scrollContainerRef: React.RefObject<HTMLDivElement | null> }) {
  const messages = usePFCStore(selectMessages);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  // Extract all headings from assistant messages
  const headings: TocEntry[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') continue;
    const text = getMessageText(msg);
    if (text) {
      headings.push(...extractHeadings(text));
    }
  }

  // Track which heading is currently in view
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        root: container,
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0,
      }
    );

    // Observe all heading elements
    for (const h of headings) {
      const el = container.querySelector(`#${CSS.escape(h.id)}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings, scrollContainerRef]);

  const handleClick = useCallback((id: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, [scrollContainerRef]);

  if (headings.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={SPRING}
        style={{
          width: '13.5rem',
          flexShrink: 0,
          padding: '1rem 0.75rem',
          position: 'sticky',
          top: '3.5rem',
          maxHeight: 'calc(100vh - 4.5rem)',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            marginBottom: '0.75rem',
            padding: '0 0.375rem',
          }}
        >
          <ListIcon
            style={{
              height: '0.75rem',
              width: '0.75rem',
              color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
            }}
          />
          <span
            style={{
              fontSize: 'var(--type-label-sm)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
            }}
          >
            Contents
          </span>
        </div>

        {/* TOC entries */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {headings.map((h, idx) => {
            const isActive = activeId === h.id;
            const indent = (h.level - 1) * 0.625;

            return (
              <motion.button
                key={`${h.id}-${idx}`}
                onClick={() => handleClick(h.id)}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING, delay: idx * 0.02 }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: `0.3125rem 0.5rem 0.3125rem ${0.5 + indent}rem`,
                  borderRadius: 'var(--shape-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: h.level <= 2 ? 'var(--type-label-md)' : 'var(--type-label-sm)',
                  fontWeight: isActive ? 600 : h.level <= 2 ? 500 : 400,
                  lineHeight: 1.35,
                  color: isActive
                    ? 'var(--m3-primary)'
                    : isDark
                      ? 'rgba(155,150,137,0.65)'
                      : 'rgba(0,0,0,0.45)',
                  background: isActive
                    ? isDark
                      ? 'rgba(196,149,106,0.08)'
                      : 'rgba(196,149,106,0.06)'
                    : 'transparent',
                  transition: 'color 0.15s, background 0.15s',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {h.text}
              </motion.button>
            );
          })}
        </nav>
      </motion.aside>
    </AnimatePresence>
  );
}

/** Get the display text from a message for heading extraction. */
function getMessageText(msg: ChatMessage): string {
  if (msg.dualMessage?.laymanSummary) {
    const ls = msg.dualMessage.laymanSummary;
    const parts: string[] = [];
    if (ls.whatIsLikelyTrue) parts.push(ls.whatIsLikelyTrue);
    if (ls.whatCouldChange) parts.push(ls.whatCouldChange);
    return parts.join('\n\n') || msg.text;
  }
  return msg.text;
}

export const ChatTOC = memo(ChatTOCInner);
