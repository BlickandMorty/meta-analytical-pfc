import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Visualizer | Brainiac',
  description:
    'Interactive signal visualization with D3-powered charts for exploring reasoning traces and analytical outputs.',
};

export default function VisualizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
