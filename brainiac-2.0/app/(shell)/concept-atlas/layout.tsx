import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Concept Atlas | Brainiac',
  description:
    'Explore an interactive knowledge graph of concepts, their relationships, and connections across your research.',
};

export default function ConceptAtlasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
