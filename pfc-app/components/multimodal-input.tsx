'use client';

import { useRef, useState, useCallback, useEffect, type KeyboardEvent } from 'react';
import { ArrowUpIcon, StopCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const SUGGESTION_SETS = [
  [
    'Is intermittent fasting effective for weight loss?',
    'What does the evidence say about screen time and children?',
    'How reliable are polygraph tests as evidence?',
  ],
  [
    'Does meditation actually reduce anxiety long-term?',
    'Is nuclear energy safer than fossil fuels?',
    'What causes antibiotic resistance to spread?',
  ],
  [
    'Are standardized tests culturally biased?',
    'What is the strongest evidence for dark matter?',
    'Does CBT outperform medication for depression?',
  ],
];

interface MultimodalInputProps {
  onSubmit: (query: string) => void;
  onStop?: () => void;
  isProcessing: boolean;
  className?: string;
}

export function MultimodalInput({
  onSubmit,
  onStop,
  isProcessing,
  className,
}: MultimodalInputProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pick a random suggestion set on mount
  useEffect(() => {
    const set = SUGGESTION_SETS[Math.floor(Math.random() * SUGGESTION_SETS.length)];
    setSuggestions(set);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;

    onSubmit(trimmed);
    setValue('');
    setFocused(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.blur();
    }
  }, [value, isProcessing, onSubmit]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion);
    setFocused(false);
    setValue('');
    if (textareaRef.current) textareaRef.current.blur();
  };

  const showSuggestions = focused && !value.trim() && !isProcessing;

  return (
    <div className="relative">
      {/* Animated suggestions above input */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-0 right-0 mb-2.5 flex flex-wrap gap-2 justify-center px-2"
          >
            {suggestions.map((s, i) => (
              <motion.button
                key={s}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05, duration: 0.15 }}
                onClick={() => handleSuggestionClick(s)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border',
                  'bg-card/80 backdrop-blur-sm',
                  'text-muted-foreground hover:text-foreground',
                  'border-border/60 hover:border-pfc-ember/40',
                  'hover:bg-pfc-ember/5',
                  'transition-all duration-150 cursor-pointer',
                  'max-w-[260px] truncate',
                )}
              >
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input container — no focus ring */}
      <div
        className={cn(
          'relative flex w-full items-end gap-2 rounded-2xl border bg-card p-3 transition-all duration-200',
          focused
            ? 'border-border shadow-md'
            : 'border-border/50 shadow-sm',
          className,
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so suggestion clicks register
            setTimeout(() => setFocused(false), 150);
          }}
          placeholder="Ask a research question…"
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 outline-none ring-0 border-0 focus:outline-none focus:ring-0 focus:border-0 focus-visible:outline-none focus-visible:ring-0 min-h-[24px] max-h-[200px] p-0"
          rows={1}
          disabled={isProcessing}
          style={{ boxShadow: 'none' }}
        />
        {isProcessing ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={onStop}
          >
            <StopCircleIcon className="h-4 w-4 text-destructive" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="icon"
            className={cn(
              'h-8 w-8 shrink-0 rounded-full transition-all duration-200',
              value.trim()
                ? 'bg-pfc-ember hover:bg-pfc-ember/90 scale-100'
                : 'bg-muted hover:bg-muted scale-95 opacity-40',
            )}
            onClick={handleSubmit}
            disabled={!value.trim()}
          >
            <ArrowUpIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
