'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { motion } from 'framer-motion';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarOpen = usePFCStore((s) => s.sidebarOpen);
  const ready = useSetupGuard();

  // Show nothing while checking / redirecting — avoids flash
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <motion.main
        className="flex-1 min-w-0 overflow-hidden"
        initial={false}
        animate={{
          marginLeft: sidebarOpen ? 0 : -280,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 35,
          mass: 0.6,
        }}
      >
        {children}
      </motion.main>
    </div>
  );
}
