import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daemon | Brainiac',
  description:
    'Manage autonomous background agents that organize notes, discover connections, and run scheduled research tasks.',
};

export default function DaemonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
