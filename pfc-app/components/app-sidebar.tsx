'use client';

import { useEffect, useState, useCallback } from 'react';
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
  SettingsIcon,
  BrainIcon,
  ArchiveIcon,
  FlaskConicalIcon,
  MicroscopeIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: BrainCircuitIcon },
  { href: '/pipeline', label: 'Pipeline', icon: NetworkIcon },
  { href: '/diagnostics', label: 'Diagnostics', icon: GaugeIcon },
  { href: '/visualizer', label: 'Visualizer', icon: BarChart3Icon },
  { href: '/concept-atlas', label: 'Concept Atlas', icon: BrainIcon },
  { href: '/trainme', label: 'Train Me', icon: GraduationCapIcon },
  { href: '/evaluate', label: 'ML Evaluator', icon: MicroscopeIcon },
  { href: '/research-copilot', label: 'Research Copilot', icon: FlaskConicalIcon },
  { href: '/cortex-archive', label: 'Cortex Archive', icon: ArchiveIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

interface ChatHistoryItem {
  id: string;
  title: string;
  updatedAt: string;
}

export function AppSidebar() {
  const sidebarOpen = usePFCStore((s) => s.sidebarOpen);
  const setSidebarOpen = usePFCStore((s) => s.setSidebarOpen);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadHistory = useCallback(async () => {
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
  }, []);

  // Fetch chat history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Refresh history when new queries are processed
  useEffect(() => {
    if (queriesProcessed > 0) {
      loadHistory();
    }
  }, [queriesProcessed, loadHistory]);

  const handleNewChat = () => {
    usePFCStore.getState().reset();
    router.push('/');
  };

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

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -280 }}
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

        {/* New Chat — Material Design 3D raised button */}
        <div className="px-3 pt-3 pb-2.5">
          <button
            onClick={handleNewChat}
            className={cn(
              'group relative w-full cursor-pointer',
              'flex items-center justify-center gap-2.5 h-10 rounded-xl',
              'transition-all duration-200 ease-out',
              'hover:translate-y-[-1px] active:translate-y-[1px]',
              // Light mode: Material elevated surface
              'bg-gradient-to-b from-indigo-600 to-indigo-700',
              'dark:from-pfc-ember/80 dark:to-pfc-ember/60',
              // 3D shadow layers — Material Design depth
              'shadow-[0_2px_4px_rgba(0,0,0,0.15),0_4px_8px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.08)_inset]',
              'hover:shadow-[0_4px_8px_rgba(0,0,0,0.2),0_8px_16px_rgba(0,0,0,0.12),0_1px_0_rgba(255,255,255,0.12)_inset]',
              'active:shadow-[0_1px_2px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.06)_inset]',
              'dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),0_4px_12px_rgba(193,95,60,0.15),0_1px_0_rgba(255,255,255,0.06)_inset]',
              'dark:hover:shadow-[0_4px_8px_rgba(0,0,0,0.35),0_8px_20px_rgba(193,95,60,0.2),0_1px_0_rgba(255,255,255,0.1)_inset]',
              'dark:active:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_rgba(193,95,60,0.1),0_1px_0_rgba(255,255,255,0.04)_inset]',
            )}
          >
            {/* Top highlight — gives 3D raised effect */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-white/15 rounded-t-xl" />
            {/* Content */}
            <BrainCircuitIcon className="h-4 w-4 text-white/90 drop-shadow-sm" />
            <span className="text-sm font-semibold text-white drop-shadow-sm tracking-tight">
              New Chat
            </span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white text-[10px] font-bold transition-transform duration-200 group-hover:scale-110">
              +
            </span>
          </button>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <nav className="p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  // Close sidebar on mobile after navigation
                  if (window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-2 text-sm h-9 px-3 rounded-md transition-colors cursor-pointer',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* Chat History */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-3 py-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium">
              Recent
            </p>
            {chatHistory.length > 0 && (
              <span className="text-[9px] font-mono text-sidebar-foreground/30 bg-sidebar-accent/50 px-1.5 py-0.5 rounded">
                {chatHistory.length}
              </span>
            )}
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

  const summary = `Analyzed "${chatItem.title.slice(0, 40)}" through the reasoning pipeline.`;

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(chatItem.updatedAt), { addSuffix: true });
    } catch {
      return '';
    }
  })();

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
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn(
            'text-xs truncate flex-1',
            isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/70',
          )}>
            {chatItem.title}
          </p>
          {timeAgo && !hovered && (
            <span className="text-[9px] text-sidebar-foreground/30 shrink-0 font-mono">
              {timeAgo.replace('about ', '~')}
            </span>
          )}
        </div>

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
