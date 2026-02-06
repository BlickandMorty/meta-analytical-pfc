'use client';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SparklesIcon,
  ActivityIcon,
  MenuIcon,
  PanelLeftIcon,
  NetworkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SteeringIndicator } from './steering-indicator';

export function ChatHeader() {
  const toggleSynthesis = usePFCStore((s) => s.toggleSynthesisView);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const activeStage = usePFCStore((s) => s.activeStage);
  const toggleSidebar = usePFCStore((s) => s.toggleSidebar);
  const sidebarOpen = usePFCStore((s) => s.sidebarOpen);
  const messages = usePFCStore((s) => s.messages);
  const toggleConceptHierarchy = usePFCStore((s) => s.toggleConceptHierarchy);
  const conceptWeights = usePFCStore((s) => s.conceptWeights);
  const conceptCount = Object.keys(conceptWeights).length;

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
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hidden md:flex text-muted-foreground hover:text-foreground"
                  onClick={toggleSidebar}
                >
                  <PanelLeftIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Open sidebar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <h1 className="text-sm font-semibold tracking-tight">
          PFC
          <span className="text-muted-foreground font-normal ml-1.5 hidden sm:inline">
            Meta-Analytical Engine
          </span>
        </h1>

        {/* Steering indicator */}
        <SteeringIndicator />

        {/* Processing pill */}
        {isProcessing && activeStage && (
          <Badge variant="secondary" className="animate-pipeline-pulse text-[10px] font-mono gap-1.5">
            <ActivityIcon className="h-3 w-3 text-pfc-ember" />
            {activeStage.replace('_', '-')}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Concept Hierarchy toggle */}
        {conceptCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 text-pfc-violet/80 border-pfc-violet/20 hover:bg-pfc-violet/10"
            onClick={toggleConceptHierarchy}
          >
            <NetworkIcon className="h-3 w-3" />
            <span className="hidden sm:inline">Concepts</span>
            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono bg-pfc-violet/10 text-pfc-violet">
              {conceptCount}
            </Badge>
          </Button>
        )}

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
