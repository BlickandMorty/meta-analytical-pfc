import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings | Brainiac',
  description:
    'Configure API keys, model providers, theme preferences, and application behavior.',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
