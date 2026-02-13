import type { Metadata } from 'next';
import { ChatLayoutShell } from './chat-layout-shell';

export const metadata: Metadata = {
  title: 'Chat | ResearchLab',
  description:
    'AI-powered research chat with multi-model analytical reasoning, SOAR engine, and claim evaluation.',
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ChatLayoutShell>{children}</ChatLayoutShell>;
}
