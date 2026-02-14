import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pipeline | Brainiac',
  description:
    'Monitor and control the analytical pipeline stages including statistical, causal, Bayesian, and adversarial reasoning.',
};

export default function PipelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
