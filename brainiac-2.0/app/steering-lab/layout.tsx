import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Steering Lab | Brainiac',
  description:
    'Explore and adjust steering vectors to fine-tune analytical reasoning dimensions and model behavior.',
};

export default function SteeringLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
