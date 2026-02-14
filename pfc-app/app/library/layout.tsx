import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Library | Brainiac',
  description:
    'Browse and manage your research library of saved papers, citations, authors, and collected references.',
};

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
