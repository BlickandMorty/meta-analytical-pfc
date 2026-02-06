'use client';

import { useEffect, useState } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { LiveBrief } from './live-brief';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BrainCircuitIcon,
  GaugeIcon,
  BarChart3Icon,
  GraduationCapIcon,
  NetworkIcon,
  SunIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  XIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: BrainCircuitIcon },
  { href: '/pipeline', label: 'Pipeline', icon: NetworkIcon },
  { href: '/diagnostics', label: 'Diagnostics', icon: GaugeIcon },
  { href: '/visualizer', label: 'Visualizer', icon: BarChart3Icon },
  { href: '/trainme', label: 'Train Me', icon: GraduationCapIcon },
];

interface ChatHistoryItem {
  id: string;
  title: string;
  updatedAt: string;
}

export function AppSidebar() {
  const sidebarOpen = usePFCStore((s) => s.sidebarOpen);
  const setSidebarOpen = usePFCStore((s) => s.setSidebarOpen);
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch chat history
  useEffect(() => {
    async function loadHistory() {
      try {
        setHistoryLoading(true);
        const res = await fetch('/api/history?userId=local-user');
        const data = await res.json();
        setChatHistory(data.chats || []);
      } catch {
        // Silently fail
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — always in DOM, slides in/out */}
      <motion.aside
        initial={false}
        animate={{
          x: sidebarOpen ? 0 : -280,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 35,
          mass: 0.6,
        }}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col border-r bg-sidebar text-sidebar-foreground will-change-transform',
          'md:relative md:z-auto',
        )}
        style={{ width: 280, minWidth: 280 }}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <BrainCircuitIcon className="h-5 w-5 text-pfc-ember" />
            <span className="text-sm font-bold tracking-tight">PFC</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <XIcon className="h-4 w-4 md:hidden" />
            <PanelLeftCloseIcon className="h-4 w-4 hidden md:block" />
          </Button>
        </div>

        {/* New Chat button */}
        <div className="p-3">
          <Link href="/">
            <button
              className={cn(
                'group relative w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300',
                'bg-gradient-to-r from-pfc-ember/90 to-pfc-violet/80',
                'dark:from-pfc-ember/20 dark:to-pfc-violet/15',
                'text-white dark:text-sidebar-foreground',
                'hover:shadow-lg hover:shadow-pfc-ember/20 dark:hover:shadow-pfc-ember/10',
                'hover:scale-[1.02] active:scale-[0.98]',
                'border border-white/10 dark:border-pfc-ember/20',
              )}
            >
              {/* Glow effect */}
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-pfc-ember/0 via-white/10 to-pfc-violet/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Brain bubble icon */}
              <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 dark:bg-pfc-ember/25 backdrop-blur-sm shadow-inner">
                <BrainCircuitIcon className="h-4 w-4" />
              </span>

              <span className="relative">New Chat</span>
            </button>
          </Link>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <nav className="p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-2 text-sm h-9',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* Chat History */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium">
              Recent
            </p>
          </div>
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-0.5 pb-4">
              {historyLoading ? (
                <div className="space-y-1.5 px-2 py-1">
                  <Skeleton className="h-7 w-full rounded-md" />
                  <Skeleton className="h-7 w-3/4 rounded-md" />
                  <Skeleton className="h-7 w-5/6 rounded-md" />
                </div>
              ) : chatHistory.length === 0 ? (
                <p className="px-3 py-2 text-xs text-sidebar-foreground/30">
                  No conversations yet
                </p>
              ) : (
                chatHistory.slice(0, 20).map((chatItem) => (
                  <ChatHistoryRow key={chatItem.id} chatItem={chatItem} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer: Vitals + Theme */}
        <div className="border-t border-sidebar-border p-3 space-y-3">
          <LiveBrief />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-sidebar-foreground/40 font-mono">v2.0</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {/* Only render theme icon after mount to avoid hydration mismatch */}
              {!mounted ? (
                <span className="h-3.5 w-3.5" />
              ) : resolvedTheme === 'dark' ? (
                <SunIcon className="h-3.5 w-3.5" />
              ) : (
                <MoonIcon className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function ChatHistoryRow({ chatItem }: { chatItem: ChatHistoryItem }) {
  const [hovered, setHovered] = useState(false);
  const [displayedChars, setDisplayedChars] = useState(0);
  const pathname = usePathname();
  const isActive = pathname === `/chat/${chatItem.id}`;

  // Generate a mock summary from the title (in production this would come from the API)
  const summary = `Analysis of "${chatItem.title.slice(0, 40)}" — processed through the 10-stage pipeline.`;

  // Typewriter effect on hover
  useEffect(() => {
    if (!hovered) {
      setDisplayedChars(0);
      return;
    }

    if (displayedChars >= summary.length) return;

    const timer = setTimeout(() => {
      setDisplayedChars((prev) => Math.min(prev + 2, summary.length));
    }, 15);

    return () => clearTimeout(timer);
  }, [hovered, displayedChars, summary.length]);

  return (
    <Link href={`/chat/${chatItem.id}`}>
      <div
        className={cn(
          'group relative rounded-lg px-3 py-2 transition-colors cursor-pointer',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'hover:bg-sidebar-accent/50',
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <p className={cn(
          'text-xs truncate',
          isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/70',
        )}>
          {chatItem.title}
        </p>

        {/* Typewriter summary on hover */}
        <AnimatePresence>
          {hovered && !isActive && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[10px] text-sidebar-foreground/40 mt-0.5 leading-relaxed overflow-hidden"
            >
              {summary.slice(0, displayedChars)}
              {displayedChars < summary.length && (
                <span className="animate-blink">|</span>
              )}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Link>
  );
}
