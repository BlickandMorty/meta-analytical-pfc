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
  // Drizzle SQLite timestamps come as unix seconds (number)
  if (typeof value === 'number') {
    // If it looks like seconds (< year 2100 in ms), multiply by 1000
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
          setChats(data.chats.slice(0, 10));
        }
      } catch {
        // Silently fail — no chats to show
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
        gap: '0.25rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0 0.25rem',
          marginBottom: '0.25rem',
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
          Sessions
        </span>
      </div>

      {/* Chat list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1rem',
          overflow: 'hidden',
          background: isDark ? 'rgba(196,149,106,0.03)' : 'rgba(245,240,232,0.6)',
          border: 'none',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {chats.map((chat, idx) => {
          const isHovered = hoveredId === chat.id;
          const updatedDate = parseTimestamp(chat.updatedAt);
          const timeStr = formatRelativeTime(updatedDate);

          return (
            <button
              key={chat.id}
              onClick={() => router.push(`/chat/${chat.id}`)}
              onMouseEnter={() => setHoveredId(chat.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.625rem 0.75rem',
                border: 'none',
                borderTop: idx > 0
                  ? (isDark ? '1px solid rgba(50,49,45,0.2)' : '1px solid rgba(0,0,0,0.04)')
                  : 'none',
                background: isHovered
                  ? (isDark ? 'rgba(196,149,106,0.06)' : 'rgba(0,0,0,0.03)')
                  : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.15s ease',
              }}
            >
              <MessageSquareIcon
                style={{
                  height: '0.875rem',
                  width: '0.875rem',
                  flexShrink: 0,
                  color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.25)',
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.7)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                {chat.title}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 400,
                  color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.3)',
                  flexShrink: 0,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                {timeStr}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
