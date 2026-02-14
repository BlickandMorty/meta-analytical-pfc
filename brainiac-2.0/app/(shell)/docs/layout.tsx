import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation | Brainiac',
  description:
    'Reference documentation for Brainiac features, architecture, SOAR engine, and analytical pipeline.',
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
