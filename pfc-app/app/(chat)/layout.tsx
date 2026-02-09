'use client';

import { useSetupGuard } from '@/hooks/use-setup-guard';
import { motion } from 'framer-motion';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ready = useSetupGuard();

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-6 w-6 rounded-full border-2 border-pfc-violet/20 border-t-pfc-violet"
        />
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden">
      <main className="absolute inset-0 overflow-hidden" style={{ paddingTop: '2.625rem' }}>
        {children}
      </main>
    </div>
  );
}
