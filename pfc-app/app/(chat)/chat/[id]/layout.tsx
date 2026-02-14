import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat | Brainiac',
  description:
    'Continue an AI-powered research conversation with multi-model analytical reasoning.',
};

export default function ChatThreadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
