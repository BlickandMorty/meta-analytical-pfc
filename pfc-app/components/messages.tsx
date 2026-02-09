'use client';

import { memo } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Message } from './message';
import type { ChatMessage } from '@/lib/engine/types';
import { StreamingText } from './streaming-text';
import { ThinkingAccordion } from './thinking-accordion';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { ArrowDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { BrainMascot } from './brain-mascot';
import { useTheme } from 'next-themes';

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

// Stable selectors
const selectMessages = (s: { messages: ChatMessage[] }) => s.messages;
const selectIsStreaming = (s: { isStreaming: boolean }) => s.isStreaming;
const selectIsProcessing = (s: { isProcessing: boolean }) => s.isProcessing;
const selectReasoningText = (s: { reasoningText: string }) => s.reasoningText;
const selectReasoningDuration = (s: { reasoningDuration: number | null }) => s.reasoningDuration;
const selectIsReasoning = (s: { isReasoning: boolean }) => s.isReasoning;

function MessagesInner() {
  const messages = usePFCStore(selectMessages);
  const isStreaming = usePFCStore(selectIsStreaming);
  const isProcessing = usePFCStore(selectIsProcessing);
  const reasoningText = usePFCStore(selectReasoningText);
  const reasoningDuration = usePFCStore(selectReasoningDuration);
  const isReasoning = usePFCStore(selectIsReasoning);
  const { containerRef, isAtBottom, scrollToBottom } = useScrollToBottom<HTMLDivElement>();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="relative flex-1 overflow-hidden">
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

          {/* Thinking / streaming indicator */}
          {(isStreaming || isProcessing) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.32, ease: CUPERTINO_EASE }}
              className="flex gap-3"
            >
              <div className="flex shrink-0 mt-1">
                <BrainMascot isDark={isDark} size={28} mini />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md glass px-4 py-3 space-y-2">
                {/* Reasoning accordion — shows AI thinking process */}
                {(isReasoning || reasoningText) && (
                  <ThinkingAccordion
                    content={reasoningText}
                    duration={reasoningDuration}
                    isThinking={isReasoning}
                  />
                )}
                {isStreaming ? (
                  <StreamingText />
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-muted-foreground/60">
                      {isReasoning ? 'Reasoning...' : 'Thinking...'}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28, mass: 0.6 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
          >
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-7 text-[10px] gap-1 px-3 cursor-pointer border-none"
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(12px) saturate(1.3)',
                WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
              }}
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
