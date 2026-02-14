import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Export | Brainiac',
  description:
    'Export research sessions, analyses, and findings in various formats for sharing and publication.',
};

export default function ExportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
