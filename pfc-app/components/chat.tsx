'use client';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useChatStream } from '@/hooks/use-chat-stream';
import { ChatHeader } from './chat-header';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { SynthesisCard } from './synthesis-card';
import { EXAMPLE_QUERIES } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function Chat() {
  const messages = usePFCStore((s) => s.messages);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const { sendQuery, abort } = useChatStream();

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <AnimatePresence mode="wait">
        {isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.25 } }}
            className="flex flex-1 flex-col items-center justify-center px-6"
          >
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
            className="flex flex-1 flex-col min-h-0"
          >
            <ChatHeader />
            <Messages />
            <div className="mx-auto max-w-3xl w-full px-4">
              <SynthesisCard />
            </div>
            <div className="shrink-0 border-t bg-background/80 backdrop-blur-sm p-4">
              <div className="mx-auto max-w-3xl">
                <MultimodalInput
                  onSubmit={sendQuery}
                  onStop={abort}
                  isProcessing={isProcessing}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
