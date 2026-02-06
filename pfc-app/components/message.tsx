'use client';

import { motion } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { MessageLayman } from './message-layman';
import { MessageResearch } from './message-research';
import { TruthBotCard } from './truth-bot-card';
import type { ChatMessage } from '@/lib/engine/types';
import { cn } from '@/lib/utils';
import { UserIcon, BrainCircuitIcon } from 'lucide-react';

interface MessageProps {
  message: ChatMessage;
}

export function Message({ message }: MessageProps) {
  const activeLayer = usePFCStore((s) => s.activeMessageLayer);
  const showTruthBot = usePFCStore((s) => s.showTruthBot);
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' as const }}
      className={cn(
        'flex gap-3 w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pfc-ember/10 text-pfc-ember mt-1">
          <BrainCircuitIcon className="h-3.5 w-3.5" />
        </div>
      )}

      <div
        className={cn(
          isUser
            ? 'max-w-[80%] rounded-2xl rounded-br-md bg-pfc-ember text-white px-3.5 py-2'
            : 'max-w-[75%] rounded-2xl rounded-bl-md bg-card/80 border border-border/40 px-4 py-3'
        )}
      >
        {isUser ? (
          <p className="text-[14px] leading-relaxed">{message.text}</p>
        ) : message.dualMessage ? (
          <div className="space-y-3">
            {activeLayer === 'layman' ? (
              <MessageLayman layman={message.dualMessage.laymanSummary} />
            ) : (
              <MessageResearch dualMessage={message.dualMessage} />
            )}

            {/* Confidence + Grade badge */}
            {message.confidence !== undefined && (
              <div className="flex items-center gap-2 pt-2.5 border-t border-border/30">
                <span className="text-[10px] font-mono text-muted-foreground/70">
                  {(message.confidence * 100).toFixed(0)}% confidence
                </span>
                {message.evidenceGrade && (
                  <span className={cn(
                    'text-[10px] font-mono px-1.5 py-0.5 rounded-md',
                    message.evidenceGrade === 'A' ? 'bg-pfc-green/10 text-pfc-green' :
                    message.evidenceGrade === 'B' ? 'bg-pfc-yellow/10 text-pfc-yellow' :
                    'bg-pfc-red/10 text-pfc-red'
                  )}>
                    Grade {message.evidenceGrade}
                  </span>
                )}
                {message.mode && (
                  <span className="text-[10px] font-mono text-muted-foreground/50">
                    {message.mode}
                  </span>
                )}
              </div>
            )}

            {/* Truth Assessment */}
            {showTruthBot && message.truthAssessment && (
              <TruthBotCard assessment={message.truthAssessment} />
            )}
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed text-foreground/90">{message.text}</p>
        )}
      </div>

      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary mt-1">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}
