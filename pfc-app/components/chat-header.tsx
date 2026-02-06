'use client';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayersIcon,
  SparklesIcon,
  ActivityIcon,
  MenuIcon,
  PanelLeftIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ChatHeader() {
  const activeLayer = usePFCStore((s) => s.activeMessageLayer);
  const toggleLayer = usePFCStore((s) => s.toggleMessageLayer);
  const toggleSynthesis = usePFCStore((s) => s.toggleSynthesisView);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const activeStage = usePFCStore((s) => s.activeStage);
  const toggleSidebar = usePFCStore((s) => s.toggleSidebar);
  const sidebarOpen = usePFCStore((s) => s.sidebarOpen);
  const messages = usePFCStore((s) => s.messages);

  const hasMessages = messages.some((m) => m.role === 'system');

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4 shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden"
          onClick={toggleSidebar}
        >
          <MenuIcon className="h-4 w-4" />
        </Button>

        {/* Desktop sidebar toggle */}
        {!sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hidden md:flex"
            onClick={toggleSidebar}
          >
            <PanelLeftIcon className="h-4 w-4" />
          </Button>
        )}

        <h1 className="text-sm font-semibold tracking-tight">
          PFC
          <span className="text-muted-foreground font-normal ml-1.5 hidden sm:inline">
            Meta-Analytical Engine
          </span>
        </h1>

        {/* Processing pill */}
        {isProcessing && activeStage && (
          <Badge variant="secondary" className="animate-pipeline-pulse text-[10px] font-mono gap-1.5">
            <ActivityIcon className="h-3 w-3 text-pfc-ember" />
            {activeStage.replace('_', '-')}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Layer toggle */}
        <Button
          variant={activeLayer === 'layman' ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-[11px] gap-1.5"
          onClick={toggleLayer}
        >
          <LayersIcon className="h-3 w-3" />
          {activeLayer === 'layman' ? 'Plain' : 'Research'}
        </Button>

        {/* Synthesize button */}
        {hasMessages && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 text-pfc-violet border-pfc-violet/30 hover:bg-pfc-violet/10"
            onClick={toggleSynthesis}
          >
            <SparklesIcon className="h-3 w-3" />
            Synthesize
          </Button>
        )}
      </div>
    </header>
  );
}
