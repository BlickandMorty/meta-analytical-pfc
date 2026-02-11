'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Chat } from '@/components/chat';

export default function ChatByIdPage() {
  const params = useParams();
  const chatId = params.id as string;
  const setCurrentChat = usePFCStore((s) => s.setCurrentChat);
  const loadMessages = usePFCStore((s) => s.loadMessages);

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
        console.error('[chat/[id]] Failed to load messages:', error);
      }
    }

    loadFromDb();
  }, [chatId, setCurrentChat, loadMessages]);

  return <Chat />;
}
