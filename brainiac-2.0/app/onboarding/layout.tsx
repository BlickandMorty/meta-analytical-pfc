import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Setup | Brainiac',
  description:
    'Configure your Brainiac environment with API keys, model preferences, and initial settings.',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
