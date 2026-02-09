'use client';

import { useState, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { MessageLayman } from './message-layman';
import { MessageResearch } from './message-research';
import { TruthBotCard } from './truth-bot-card';
import type { ChatMessage } from '@/lib/engine/types';
import { cn } from '@/lib/utils';
import { UserIcon, ChevronDownIcon } from 'lucide-react';
import { BrainMascot } from './brain-mascot';
import { useTheme } from 'next-themes';
import { ConceptMiniMap } from './concept-mini-map';
import { SteeringFeedback } from './steering-feedback';
import { useSteeringStore } from '@/lib/store/use-steering-store';

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

interface MessageProps {
  message: ChatMessage;
}

const selectShowTruthBot = (s: { showTruthBot: boolean }) => s.showTruthBot;
const selectInferenceMode = (s: { inferenceMode: string }) => s.inferenceMode;
const selectLatestSynthesisKeyId = (s: { latestSynthesisKeyId: string | null }) => s.latestSynthesisKeyId;
const selectSteeringExemplars = (s: { memory: { exemplars: Array<{ key: { timestamp: number; id: string } }> } }) => s.memory.exemplars;

function MessageInner({ message }: MessageProps) {
  const showTruthBot = usePFCStore(selectShowTruthBot);
  const inferenceMode = usePFCStore(selectInferenceMode);
  const latestSynthesisKeyId = useSteeringStore(selectLatestSynthesisKeyId);
  const exemplars = useSteeringStore(selectSteeringExemplars);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isUser = message.role === 'user';
  const [deepOpen, setDeepOpen] = useState(false);

  const messageSynthesisKeyId = useMemo(() => {
    if (isUser || message.confidence === undefined) return null;
    return exemplars.find(
      ex => Math.abs(ex.key.timestamp - message.timestamp) < 5000,
    )?.key.id ?? latestSynthesisKeyId;
  }, [isUser, message.confidence, message.timestamp, exemplars, latestSynthesisKeyId]);

  // Extract clean response text from the layman summary
  const cleanText = useMemo(() => {
    if (!message.dualMessage?.laymanSummary) return message.text;
    const ls = message.dualMessage.laymanSummary;
    // Combine the most important sections into a clean response
    const parts: string[] = [];
    if (ls.whatIsLikelyTrue) parts.push(ls.whatIsLikelyTrue);
    if (ls.whatCouldChange) parts.push(ls.whatCouldChange);
    return parts.length > 0 ? parts.join('\n\n') : message.text;
  }, [message]);

  const isSimulation = inferenceMode === 'simulation';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: CUPERTINO_EASE }}
      className={cn(
        'flex gap-3 w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex shrink-0 mt-1">
          <BrainMascot isDark={isDark} size={28} mini />
        </div>
      )}

      <div
        className={cn(
          isUser
            ? 'max-w-[80%] rounded-2xl rounded-br-md bg-pfc-violet text-white px-3.5 py-2 shadow-[var(--shadow-s)]'
            : 'max-w-[85%] rounded-2xl rounded-bl-md glass px-4 py-3'
        )}
      >
        {isUser ? (
          <p className="text-[14px] leading-relaxed">{message.text}</p>
        ) : message.dualMessage ? (
          <div className="space-y-2">
            {/* Clean response text — always visible */}
            <div className="text-[14px] leading-[1.7] text-foreground/90 whitespace-pre-line">
              {cleanText}
            </div>

            {/* Confidence footer — subtle inline */}
            {message.confidence !== undefined && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40 font-mono">
                <span>{(message.confidence * 100).toFixed(0)}% confidence</span>
                {message.evidenceGrade && (
                  <span className={cn(
                    'px-1 py-0.5 rounded',
                    message.evidenceGrade === 'A' ? 'text-pfc-green/60' :
                    message.evidenceGrade === 'B' ? 'text-pfc-yellow/60' :
                    'text-pfc-red/60'
                  )}>
                    Grade {message.evidenceGrade}
                  </span>
                )}
                {isSimulation && (
                  <span className="text-pfc-violet/50">sim</span>
                )}
              </div>
            )}

            {/* Deep analysis toggle */}
            <button
              onClick={() => setDeepOpen(!deepOpen)}
              className={cn(
                'flex items-center gap-1.5 text-[11px] font-medium cursor-pointer',
                'text-muted-foreground/40 hover:text-muted-foreground/70',
                'transition-colors duration-200',
              )}
            >
              <ChevronDownIcon className={cn('h-3 w-3 transition-transform duration-200', deepOpen && 'rotate-180')} />
              <span>{deepOpen ? 'Hide' : 'View'} deep analysis</span>
            </button>

            {/* Expandable deep analysis section */}
            <AnimatePresence>
              {deepOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: CUPERTINO_EASE }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 pt-2 border-t border-border/20">
                    {/* Full layman breakdown */}
                    <MessageLayman layman={message.dualMessage.laymanSummary} />

                    {/* Research analysis with inline tags */}
                    <div className="pt-2 border-t border-border/15">
                      <p className="text-[9.5px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-2">
                        Research Analysis
                      </p>
                      <MessageResearch dualMessage={message.dualMessage} />
                    </div>

                    {/* Concept mini-map */}
                    {message.concepts && message.concepts.length > 0 && (
                      <ConceptMiniMap messageConcepts={message.concepts} />
                    )}

                    {/* Steering feedback */}
                    <SteeringFeedback synthesisKeyId={messageSynthesisKeyId} />

                    {/* Truth bot */}
                    {showTruthBot && message.truthAssessment && (
                      <TruthBotCard assessment={message.truthAssessment} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed text-foreground/90">{message.text}</p>
        )}
      </div>

      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 mt-1">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
      )}
    </motion.div>
  );
}

export const Message = memo(MessageInner, (prev, next) =>
  prev.message.id === next.message.id &&
  prev.message.text === next.message.text &&
  prev.message.confidence === next.message.confidence,
);
