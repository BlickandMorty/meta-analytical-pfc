import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics | Brainiac',
  description:
    'Visualize research activity, usage patterns, reasoning metrics, and session analytics across your projects.',
};

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
