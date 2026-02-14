'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { logger } from '@/lib/debug-logger';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Chat } from '@/components/chat';

export default function ChatByIdPage() {
  const params = useParams();
  const chatId = params.id as string;
  const setCurrentChat = usePFCStore((s) => s.setCurrentChat);
  const loadMessages = usePFCStore((s) => s.loadMessages);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId) return;

    setCurrentChat(chatId);

    // Load messages from DB
    async function loadFromDb() {
      try {
        const res = await fetch(`/api/history?chatId=${chatId}`);
        const data = await res.json();
        if (data.messages) {
          loadMessages(data.messages);
        }
      } catch (error) {
        logger.error('chat/[id]', 'Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    }

    loadFromDb();
  }, [chatId, setCurrentChat, loadMessages]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          width: '100%',
          maxWidth: '48rem',
          padding: '2rem 1.5rem',
        }}>
          {/* Skeleton message bubbles */}
          {[0.6, 0.8, 0.45].map((w, i) => (
            <div
              key={i}
              style={{
                height: '2.5rem',
                width: `${w * 100}%`,
                borderRadius: 'var(--shape-lg)',
                background: 'var(--m3-surface-container)',
                opacity: 0.5,
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
                alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return <Chat mode="conversation" />;
}
