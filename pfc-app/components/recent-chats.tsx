'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageSquareIcon, ClockIcon } from 'lucide-react';

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

interface ChatEntry {
  id: string;
  title: string;
  createdAt: string | number | Date;
  updatedAt: string | number | Date;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const ts = date.getTime();
  const diffMs = now - ts;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function parseTimestamp(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  return new Date(value);
}

export function RecentChats({ isDark }: { isDark: boolean }) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchChats() {
      try {
        const res = await fetch('/api/history?userId=local-user');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (!cancelled && data.chats) {
          setChats(data.chats.slice(0, 8));
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchChats();
    return () => { cancelled = true; };
  }, []);

  if (loading || chats.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.48, ease: CUPERTINO_EASE }}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0 0.125rem',
        }}
      >
        <ClockIcon
          style={{
            height: '0.8125rem',
            width: '0.8125rem',
            color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
          }}
        />
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          Recent Sessions
        </span>
      </div>

      {/* NavBubble-style pill grid */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.375rem',
        }}
      >
        {chats.map((chat, idx) => {
          const isHovered = hoveredId === chat.id;
          const updatedDate = parseTimestamp(chat.updatedAt);
          const timeStr = formatRelativeTime(updatedDate);

          return (
            <motion.button
              key={chat.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, delay: 0.5 + idx * 0.04, ease: CUPERTINO_EASE }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push(`/chat/${chat.id}`)}
              onMouseEnter={() => setHoveredId(chat.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                maxWidth: '100%',
                background: isHovered
                  ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(196,149,106,0.10)')
                  : (isDark ? 'rgba(196,149,106,0.05)' : 'rgba(0,0,0,0.04)'),
                transition: 'background 0.15s ease, transform 0.15s ease',
                overflow: 'hidden',
              }}
            >
              <MessageSquareIcon
                style={{
                  height: '0.8125rem',
                  width: '0.8125rem',
                  flexShrink: 0,
                  color: isHovered
                    ? '#C4956A'
                    : (isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.25)'),
                  transition: 'color 0.15s',
                }}
              />
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: isHovered
                    ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(0,0,0,0.85)')
                    : (isDark ? 'rgba(155,150,137,0.7)' : 'rgba(0,0,0,0.45)'),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                  transition: 'color 0.15s',
                }}
              >
                {chat.title}
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 500,
                  color: isDark ? 'rgba(155,150,137,0.35)' : 'rgba(0,0,0,0.2)',
                  flexShrink: 0,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                {timeStr}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
