import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Research Copilot | Brainiac',
  description:
    'AI-assisted research companion for literature search, citation discovery, paper review, and idea generation.',
};

export default function ResearchCopilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
