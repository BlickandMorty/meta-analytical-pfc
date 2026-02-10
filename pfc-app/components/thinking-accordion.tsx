'use client';

import { memo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, AtomIcon } from 'lucide-react';
import { PixelBook } from './pixel-book';

interface ThinkingAccordionProps {
  content: string;
  duration?: number | null;
  isThinking: boolean;
  className?: string;
}

const CUPERTINO: [number, number, number, number] = [0.32, 0.72, 0, 1];

export const ThinkingAccordion = memo<ThinkingAccordionProps>(function ThinkingAccordion({
  content,
  duration,
  isThinking,
  className,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-expand when thinking starts
  useEffect(() => {
    if (isThinking) setIsExpanded(true);
  }, [isThinking]);

  // Auto-scroll during active thinking
  useEffect(() => {
    if (isThinking && isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isThinking, isExpanded]);

  if (!content && !isThinking) return null;

  const durationText = duration
    ? `Thought for ${(duration / 1000).toFixed(1)}s`
    : isThinking
    ? 'Thinking'
    : 'Thought';

  return (
    <div className={`rounded-xl overflow-hidden ${className ?? ''}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs
                   bg-white/[0.04] dark:bg-white/[0.02] hover:bg-white/[0.06]
                   transition-colors duration-200"
      >
        {/* Status icon */}
        <span className="flex items-center justify-center w-5 h-5 rounded-md
                        bg-white/[0.06] dark:bg-white/[0.04]">
          {isThinking ? (
            <PixelBook size={16} />
          ) : (
            <AtomIcon className={`w-3 h-3 ${isExpanded ? 'text-pfc-violet' : 'text-muted-foreground/50'}`} />
          )}
        </span>

        {/* Label */}
        <span className={`flex-1 text-left ${isThinking ? 'text-pfc-violet font-medium thinking-shimmer' : 'text-muted-foreground/60'}`}>
          {durationText}
        </span>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: CUPERTINO }}
        >
          <ChevronDownIcon className="w-3.5 h-3.5 text-muted-foreground/40" />
        </motion.span>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: CUPERTINO }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="max-h-[200px] overflow-y-auto px-3 py-2
                         text-xs leading-relaxed text-muted-foreground/70
                         scrollbar-thin scrollbar-thumb-white/10"
            >
              <div className="whitespace-pre-wrap break-words">
                {content}
                {isThinking && (
                  <span className="inline-block w-1.5 h-3 ml-0.5 bg-pfc-violet animate-pulse rounded-sm" />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
