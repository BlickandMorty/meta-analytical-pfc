import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notes | Brainiac',
  description:
    'Capture and organize research notes with a block editor, backlinks, AI chat, and graph view.',
};

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
