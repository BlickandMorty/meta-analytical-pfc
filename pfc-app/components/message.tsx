'use client';

import { useState, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { MessageLayman } from './message-layman';
import { MessageResearch } from './message-research';
import { TruthBotCard } from './truth-bot-card';
import { ThinkingAccordion } from './thinking-accordion';
import { MarkdownContent } from './markdown-content';
import type { ChatMessage } from '@/lib/engine/types';
import { cn } from '@/lib/utils';
import { UserIcon, ChevronDownIcon } from 'lucide-react';
import { PixelSun } from './pixel-sun';
import { useTheme } from 'next-themes';
import { ConceptMiniMap } from './concept-mini-map';
import { SteeringFeedback } from './steering-feedback';
import { useSteeringStore } from '@/lib/store/use-steering-store';

/* Harmonoid-inspired spring for message entrance */
const MSG_SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 };

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
    const parts: string[] = [];
    if (ls.whatIsLikelyTrue) parts.push(ls.whatIsLikelyTrue);
    if (ls.whatCouldChange) parts.push(ls.whatCouldChange);
    return parts.length > 0 ? parts.join('\n\n') : message.text;
  }, [message]);

  const isSimulation = inferenceMode === 'simulation';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MSG_SPRING}
      style={{
        display: 'flex',
        gap: '0.75rem',
        width: '100%',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        transform: 'translateZ(0)',
      }}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div style={{ flexShrink: 0, marginTop: '0.25rem' }}>
          <PixelSun size={26} />
        </div>
      )}

      {/* Message bubble */}
      <div
        style={{
          maxWidth: isUser ? '80%' : '88%',
          borderRadius: isUser
            ? 'var(--shape-xl) var(--shape-xl) var(--shape-sm) var(--shape-xl)'
            : 'var(--shape-xl) var(--shape-xl) var(--shape-xl) var(--shape-sm)',
          padding: isUser ? '0.625rem 1rem' : '0.875rem 1.125rem',
          background: isUser
            ? 'var(--m3-primary)'
            : isDark
              ? 'var(--m3-surface-container)'
              : 'var(--m3-surface-container)',
          color: isUser
            ? 'var(--m3-on-primary)'
            : 'var(--foreground)',
          ...(isUser ? {} : {
            border: `1px solid ${isDark ? 'rgba(50,49,45,0.25)' : 'rgba(190,183,170,0.2)'}`,
          }),
        }}
      >
        {isUser ? (
          <p style={{
            fontSize: 'var(--type-body-md)',
            lineHeight: 1.65,
            margin: 0,
          }}>
            {message.text}
          </p>
        ) : message.dualMessage ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Reasoning accordion — shows AI thinking for this message */}
            {message.reasoning?.content && (
              <ThinkingAccordion
                content={message.reasoning.content}
                duration={message.reasoning.duration}
                isThinking={false}
              />
            )}

            {/* Clean response text — rendered as markdown */}
            <MarkdownContent content={cleanText} />

            {/* Confidence footer — M3 label style */}
            {message.confidence !== undefined && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: 'var(--type-label-sm)',
                fontFamily: 'var(--font-mono)',
                color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.3)',
                paddingTop: '0.25rem',
              }}>
                <span>{(message.confidence * 100).toFixed(0)}% confidence</span>
                {message.evidenceGrade && (
                  <span
                    style={{
                      padding: '0.0625rem 0.375rem',
                      borderRadius: 'var(--shape-full)',
                      fontSize: 'var(--type-label-sm)',
                      fontWeight: 600,
                      background: message.evidenceGrade === 'A'
                        ? isDark ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.06)'
                        : message.evidenceGrade === 'B'
                          ? isDark ? 'rgba(212,168,67,0.08)' : 'rgba(212,168,67,0.06)'
                          : isDark ? 'rgba(199,94,94,0.08)' : 'rgba(199,94,94,0.06)',
                      color: message.evidenceGrade === 'A'
                        ? '#34D399'
                        : message.evidenceGrade === 'B'
                          ? '#D4A843'
                          : '#C75E5E',
                    }}
                  >
                    Grade {message.evidenceGrade}
                  </span>
                )}
                {isSimulation && (
                  <span style={{
                    padding: '0.0625rem 0.375rem',
                    borderRadius: 'var(--shape-full)',
                    background: isDark ? 'rgba(196,149,106,0.06)' : 'rgba(196,149,106,0.04)',
                    color: 'var(--m3-primary)',
                    fontSize: 'var(--type-label-sm)',
                  }}>
                    sim
                  </span>
                )}
              </div>
            )}

            {/* Deep analysis toggle — M3 tonal button */}
            <button
              onClick={() => setDeepOpen(!deepOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.3125rem 0.625rem',
                borderRadius: 'var(--shape-full)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--type-label-sm)',
                fontWeight: 500,
                color: isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.4)',
                background: isDark ? 'rgba(196,149,106,0.05)' : 'rgba(0,0,0,0.03)',
                transition: 'color 0.15s, background 0.15s',
                alignSelf: 'flex-start',
              }}
            >
              <ChevronDownIcon style={{
                height: '0.6875rem',
                width: '0.6875rem',
                transition: 'transform 0.2s',
                transform: deepOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }} />
              {deepOpen ? 'Hide' : 'View'} deep analysis
            </button>

            {/* Expandable deep analysis section */}
            <AnimatePresence>
              {deepOpen && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  style={{ overflow: 'hidden', transformOrigin: 'top', transform: 'translateZ(0)' }}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    paddingTop: '0.625rem',
                    borderTop: `1px solid ${isDark ? 'rgba(50,49,45,0.2)' : 'rgba(190,183,170,0.15)'}`,
                  }}>
                    {/* Full layman breakdown */}
                    <MessageLayman layman={message.dualMessage.laymanSummary} />

                    {/* Research analysis with inline tags */}
                    <div style={{
                      paddingTop: '0.5rem',
                      borderTop: `1px solid ${isDark ? 'rgba(50,49,45,0.15)' : 'rgba(190,183,170,0.1)'}`,
                    }}>
                      <p style={{
                        fontSize: 'var(--type-label-sm)',
                        fontWeight: 600,
                        color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '0.5rem',
                      }}>
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
          /* Simple text message — rendered as markdown */
          <MarkdownContent content={message.text} />
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div style={{
          display: 'flex',
          height: '1.625rem',
          width: '1.625rem',
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--shape-full)',
          background: isDark ? 'var(--m3-surface-container-high)' : 'var(--m3-surface-container-high)',
          marginTop: '0.25rem',
        }}>
          <UserIcon style={{
            height: '0.8125rem',
            width: '0.8125rem',
            color: isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)',
          }} />
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
