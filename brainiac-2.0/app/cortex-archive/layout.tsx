import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cortex Archive | Brainiac',
  description:
    'Browse and manage archived reasoning sessions, past analyses, and historical research data.',
};

export default function CortexArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
