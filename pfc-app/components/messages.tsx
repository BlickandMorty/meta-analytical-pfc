'use client';

import { memo } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Message } from './message';
import type { ChatMessage } from '@/lib/engine/types';
import { StreamingText } from './streaming-text';
import { ThinkingAccordion } from './thinking-accordion';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { ArrowDownIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { PixelSun } from './pixel-sun';
import { PixelBook } from './pixel-book';
import { useIsDark } from '@/hooks/use-is-dark';
import { useComposedRefs } from '@radix-ui/react-compose-refs';

/* Harmonoid-inspired spring config */
const HARMONOID_SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 };

// Stable selectors
const selectMessages = (s: { messages: ChatMessage[] }) => s.messages;
const selectIsStreaming = (s: { isStreaming: boolean }) => s.isStreaming;
const selectIsProcessing = (s: { isProcessing: boolean }) => s.isProcessing;
const selectReasoningText = (s: { reasoningText: string }) => s.reasoningText;
const selectReasoningDuration = (s: { reasoningDuration: number | null }) => s.reasoningDuration;
const selectIsReasoning = (s: { isReasoning: boolean }) => s.isReasoning;

function MessagesInner({
  scrollContainerRef,
}: {
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const messages = usePFCStore(selectMessages);
  const isStreaming = usePFCStore(selectIsStreaming);
  const isProcessing = usePFCStore(selectIsProcessing);
  const reasoningText = usePFCStore(selectReasoningText);
  const reasoningDuration = usePFCStore(selectReasoningDuration);
  const isReasoning = usePFCStore(selectIsReasoning);
  const { containerRef, isAtBottom, scrollToBottom } = useScrollToBottom<HTMLDivElement>();
  const { isDark } = useIsDark();

  // Merge the scroll-to-bottom ref with the externally provided ref for TOC
  const setRefs = useComposedRefs(containerRef, scrollContainerRef);

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <div
        ref={setRefs}
        style={{
          position: 'relative',
          height: '100%',
          overflowY: 'auto',
          padding: '5.5rem 1rem 6rem',
          willChange: 'scroll-position',
          overscrollBehavior: 'contain',
          transform: 'translateZ(0)',
        }}
      >
        <div style={{
          maxWidth: '48rem',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
          contain: 'layout style',
          contentVisibility: 'auto',
        }}>
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </AnimatePresence>

          {/* Thinking / streaming — Gemini-style: avatar + clean text, no bubble */}
          {(isStreaming || isProcessing) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={HARMONOID_SPRING}
              style={{
                display: 'flex',
                gap: '0.75rem',
                width: '100%',
                justifyContent: 'flex-start',
                transform: 'translateZ(0)',
              }}
            >
              {/* Avatar */}
              <div style={{ flexShrink: 0, marginTop: '0.125rem' }}>
                <PixelSun size={26} />
              </div>

              {/* Content — clean text, no bubble */}
              <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: 'var(--type-chat-stream)',
                lineHeight: 1.8,
                color: isDark ? '#FFFFFF' : 'var(--foreground)',
                fontFamily: 'var(--font-secondary)',
              }}>
                {/* Reasoning accordion */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <PixelBook size={24} />
                    <span style={{
                      color: 'var(--m3-primary)',
                      fontSize: 'var(--type-body-md)',
                      fontWeight: 500,
                    }}>
                      {isReasoning ? 'Reasoning...' : 'Thinking...'}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Scroll to bottom — M3 tonal surface button */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={HARMONOID_SPRING}
            style={{
              position: 'absolute',
              bottom: '2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <button
              onClick={scrollToBottom}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.3125rem 0.75rem',
                borderRadius: 'var(--shape-full)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--type-label-sm)',
                fontWeight: 500,
                background: 'var(--m3-surface-container-highest)',
                color: 'var(--foreground)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <ArrowDownIcon style={{ height: '0.625rem', width: '0.625rem' }} />
              Scroll to bottom
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const Messages = memo(MessagesInner);
