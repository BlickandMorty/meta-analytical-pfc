'use client';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useChatStream } from '@/hooks/use-chat-stream';
import { ChatHeader } from './chat-header';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { SynthesisCard } from './synthesis-card';
import { EXAMPLE_QUERIES } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuitIcon } from 'lucide-react';
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
            exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
            className="flex flex-1 flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-2xl space-y-8">
              {/* Brain icon + title */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-2"
              >
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-pfc-ember/20 to-pfc-violet/15 flex items-center justify-center border border-pfc-ember/10">
                      <BrainCircuitIcon className="h-7 w-7 text-pfc-ember" />
                    </div>
                    {/* Subtle pulse ring */}
                    <div className="absolute inset-0 rounded-2xl bg-pfc-ember/5 animate-ping" style={{ animationDuration: '3s' }} />
                  </div>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  What would you like to analyze?
                </h1>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Ask any research question. The 10-stage pipeline will stress-test it through statistical, causal, Bayesian, and adversarial reasoning.
                </p>
              </motion.div>

              {/* Large centered input */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <MultimodalInput
                  onSubmit={sendQuery}
                  onStop={abort}
                  isProcessing={isProcessing}
                  className="shadow-lg border-border"
                />
              </motion.div>

              {/* Example query chips */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-wrap justify-center gap-2"
              >
                {EXAMPLE_QUERIES.map((example) => (
                  <button
                    key={example.query}
                    onClick={() => sendQuery(example.query)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs',
                      'bg-card/80 backdrop-blur-sm',
                      'text-muted-foreground hover:text-foreground',
                      'border-border/60 hover:border-pfc-ember/30',
                      'hover:bg-pfc-ember/5 hover:shadow-sm',
                      'transition-all duration-200 cursor-pointer',
                    )}
                  >
                    <span>{example.icon}</span>
                    <span>{example.title}</span>
                  </button>
                ))}
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
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
