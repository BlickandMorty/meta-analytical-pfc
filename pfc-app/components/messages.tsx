'use client';

import { memo } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Message } from './message';
import { StreamingText } from './streaming-text';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { BrainCircuitIcon, ArrowDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';

function MessagesInner() {
  const messages = usePFCStore((s) => s.messages);
  const isStreaming = usePFCStore((s) => s.isStreaming);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const { containerRef, isAtBottom, scrollToBottom } = useScrollToBottom<HTMLDivElement>();

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 chat-grid-bg pointer-events-none" />

      <div
        ref={containerRef}
        className="relative h-full overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </AnimatePresence>

          {/* Streaming indicator */}
          {(isStreaming || isProcessing) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pfc-ember/10 text-pfc-ember mt-1">
                <BrainCircuitIcon className="h-3.5 w-3.5 animate-pulse" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-card/80 border border-border/40 px-4 py-3">
                {isStreaming ? (
                  <StreamingText />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-pfc-ember animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-pfc-ember animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-pfc-ember animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs text-muted-foreground">Processing through pipeline...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
          >
            <Button
              variant="outline"
              size="sm"
              className="rounded-full shadow-md h-6 text-[10px] gap-1 px-2.5 bg-background/90 backdrop-blur-sm"
              onClick={scrollToBottom}
            >
              <ArrowDownIcon className="h-2.5 w-2.5" />
              Scroll to bottom
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const Messages = memo(MessagesInner);
