'use client';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useChatStream } from '@/hooks/use-chat-stream';
import { ChatHeader } from './chat-header';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { SynthesisCard } from './synthesis-card';
import { LiveControls } from './live-controls';
import { ConceptHierarchyPanel } from './concept-hierarchy-panel';
import { EXAMPLE_QUERIES } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PanelLeftIcon, MenuIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedDotGrid } from './animated-dot-grid';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function Chat() {
  const messages = usePFCStore((s) => s.messages);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const sidebarOpen = usePFCStore((s) => s.sidebarOpen);
  const toggleSidebar = usePFCStore((s) => s.toggleSidebar);
  const { sendQuery, abort } = useChatStream();

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex h-full flex-col">
      {/* Animated dot grid background — persistent across both states */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <AnimatedDotGrid />
      </div>

      <AnimatePresence mode="wait">
        {isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.25 } }}
            className="relative z-[1] flex flex-1 flex-col items-center justify-center px-6"
          >
            {/* Floating sidebar toggle when sidebar is closed */}
            {!sidebarOpen && (
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1">
                {/* Mobile */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden text-muted-foreground hover:text-foreground"
                  onClick={toggleSidebar}
                >
                  <MenuIcon className="h-4 w-4" />
                </Button>
                {/* Desktop */}
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
              </div>
            )}
            <div className="w-full max-w-xl space-y-6">
              {/* Title — clean Claude-style */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <h1 className="text-2xl font-semibold tracking-tight">
                  What would you like to analyze?
                </h1>
              </motion.div>

              {/* Hero input — large and prominent */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
              >
                <MultimodalInput
                  onSubmit={sendQuery}
                  onStop={abort}
                  isProcessing={isProcessing}
                  className="shadow-lg border-border"
                  hero
                />
              </motion.div>

              {/* Example query chips — subtle */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.16 }}
                className="flex flex-wrap justify-center gap-2"
              >
                {EXAMPLE_QUERIES.map((example) => (
                  <button
                    key={example.query}
                    onClick={() => sendQuery(example.query)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px]',
                      'bg-card/60 backdrop-blur-sm',
                      'text-muted-foreground/80 hover:text-foreground',
                      'border-border/50 hover:border-pfc-ember/30',
                      'hover:bg-pfc-ember/5',
                      'transition-all duration-200 cursor-pointer',
                    )}
                  >
                    <span className="text-[10px]">{example.icon}</span>
                    <span>{example.title}</span>
                  </button>
                ))}
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative z-[1] flex flex-1 flex-col min-h-0"
          >
            <ChatHeader />
            <Messages />
            {/* Bottom section — synthesis, controls, input pinned to bottom */}
            <div className="shrink-0 flex flex-col">
              <div className="mx-auto max-w-3xl w-full px-4">
                <SynthesisCard />
              </div>
              <LiveControls />
              <ConceptHierarchyPanel />
              <div className="border-t bg-background/80 backdrop-blur-sm p-4">
                <div className="mx-auto max-w-3xl">
                  <MultimodalInput
                    onSubmit={sendQuery}
                    onStop={abort}
                    isProcessing={isProcessing}
                    showControlsToggle
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
