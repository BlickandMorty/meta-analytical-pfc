import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Diagnostics | Brainiac',
  description:
    'View system health, model connection status, performance metrics, and debug information.',
};

export default function DiagnosticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
