'use client';

import { useState, useRef, memo, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { MessageLayman } from './message-layman';
import { MessageResearch } from './message-research';
import { TruthBotCard } from './truth-bot-card';
import { ThinkingAccordion } from './thinking-accordion';
import { MarkdownContent } from './markdown-content';
import type { ChatMessage } from '@/lib/engine/types';
import { cn } from '@/lib/utils';
import {
  UserIcon,
  ChevronDownIcon,
  CopyIcon,
  CheckIcon,
  FileTextIcon,
  StickyNoteIcon,
} from 'lucide-react';
import { PixelSun } from './pixel-sun';
import { useIsDark } from '@/hooks/use-is-dark';
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
const selectSteeringExemplars = (s: { memory?: { exemplars?: Array<{ key: { timestamp: number; id: string } }> } }) => s.memory?.exemplars ?? [];

/**
 * Build a full markdown export including summary, research analysis,
 * reflection, arbitration, and uncertainty tags.
 */
function buildFullExport(
  message: ChatMessage,
  cleanText: string,
  safeText: string,
  safeDualMessage: ChatMessage['dualMessage'] | null,
): string {
  const sections: string[] = [];

  // Summary / main response
  sections.push(cleanText || safeText);

  if (safeDualMessage) {
    const ls = safeDualMessage.laymanSummary;

    // Layman breakdown
    if (ls) {
      sections.push('\n---\n\n## Layman Summary');
      if (ls.whatWasTried) sections.push(`### ${ls.sectionLabels?.whatWasTried || 'What Was Tried'}\n${ls.whatWasTried}`);
      if (ls.whatIsLikelyTrue) sections.push(`### ${ls.sectionLabels?.whatIsLikelyTrue || 'What Is Likely True'}\n${ls.whatIsLikelyTrue}`);
      if (ls.confidenceExplanation) sections.push(`### ${ls.sectionLabels?.confidenceExplanation || 'Confidence Explanation'}\n${ls.confidenceExplanation}`);
      if (ls.whatCouldChange) sections.push(`### ${ls.sectionLabels?.whatCouldChange || 'What Could Change This'}\n${ls.whatCouldChange}`);
      if (ls.whoShouldTrust) sections.push(`### ${ls.sectionLabels?.whoShouldTrust || 'Who Should Trust This'}\n${ls.whoShouldTrust}`);
    }

    // Raw analysis
    if (safeDualMessage.rawAnalysis) {
      sections.push('\n---\n\n## Research Analysis\n' + safeDualMessage.rawAnalysis);
    }

    // Reflection
    const ref = safeDualMessage.reflection;
    if (ref) {
      sections.push('\n---\n\n## Reflection');
      if (ref.selfCriticalQuestions?.length) {
        sections.push('### Self-Critical Questions\n' + ref.selfCriticalQuestions.map(q => `- ${q}`).join('\n'));
      }
      if (ref.adjustments?.length) {
        sections.push('### Adjustments\n' + ref.adjustments.map(a => `- ${a}`).join('\n'));
      }
      if (ref.leastDefensibleClaim) {
        sections.push(`### Least Defensible Claim\n${ref.leastDefensibleClaim}`);
      }
      if (ref.precisionVsEvidenceCheck) {
        sections.push(`### Precision vs Evidence\n${ref.precisionVsEvidenceCheck}`);
      }
    }

    // Arbitration
    const arb = safeDualMessage.arbitration;
    if (arb) {
      sections.push('\n---\n\n## Arbitration');
      sections.push(`**Consensus:** ${arb.consensus ? 'Yes' : 'No'}`);
      if (arb.resolution) sections.push(`**Resolution:** ${arb.resolution}`);
      if (arb.votes?.length) {
        sections.push('### Engine Votes');
        for (const v of arb.votes) {
          sections.push(`- **${v.engine}** — ${v.position} (${(v.confidence * 100).toFixed(0)}%): ${v.reasoning}`);
        }
      }
      if (arb.disagreements?.length) {
        sections.push('### Disagreements\n' + arb.disagreements.map(d => `- ${d}`).join('\n'));
      }
    }

    // Uncertainty tags
    if (safeDualMessage.uncertaintyTags?.length) {
      sections.push('\n---\n\n## Uncertainty Tags');
      for (const t of safeDualMessage.uncertaintyTags) {
        sections.push(`- **[${t.tag}]** ${t.claim}`);
      }
    }

    // Data vs model flags
    if (safeDualMessage.modelVsDataFlags?.length) {
      sections.push('\n---\n\n## Data vs Model Flags');
      for (const f of safeDualMessage.modelVsDataFlags) {
        sections.push(`- **${f.source}**: ${f.claim}`);
      }
    }
  }

  // Confidence & evidence grade
  if (typeof message.confidence === 'number' && !isNaN(message.confidence)) {
    sections.push(`\n---\n\n**Confidence:** ${(message.confidence * 100).toFixed(0)}%`);
    if (message.evidenceGrade) sections.push(`**Evidence Grade:** ${message.evidenceGrade}`);
  }

  return sections.join('\n\n');
}

function MessageInner({ message }: MessageProps) {
  const showTruthBot = usePFCStore(selectShowTruthBot);
  const inferenceMode = usePFCStore(selectInferenceMode);
  const latestSynthesisKeyId = useSteeringStore(selectLatestSynthesisKeyId);
  const exemplars = useSteeringStore(selectSteeringExemplars);
  const { isDark } = useIsDark();
  const router = useRouter();
  const isUser = message.role === 'user';
  const [deepOpen, setDeepOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const messageSynthesisKeyId = useMemo(() => {
    if (isUser || message.confidence === undefined) return null;
    return exemplars.find(
      ex => Math.abs(ex.key.timestamp - message.timestamp) < 5000,
    )?.key.id ?? latestSynthesisKeyId;
  }, [isUser, message.confidence, message.timestamp, exemplars, latestSynthesisKeyId]);

  // ── Defensive defaults for potentially missing fields ──
  const safeText = message.text ?? '';
  const safeDualMessage = message.dualMessage ?? null;
  const safeConfidence = typeof message.confidence === 'number' && !isNaN(message.confidence) ? message.confidence : null;

  // Strip epistemic markers like [DATA], [CONFLICT], [UNCERTAIN], [MODEL] from display text
  // Only collapse horizontal whitespace (spaces/tabs) — preserve newlines for markdown formatting
  const stripMarkers = (text: string) =>
    text.replace(/\s*\[(DATA|CONFLICT|UNCERTAIN|MODEL)\]\s*/g, ' ').replace(/[^\S\n]{2,}/g, ' ').trim();

  // Main answer — "completified" version: the core response the AI gives,
  // slightly better than stock but not as complex as the deep analysis.
  // This is whatIsLikelyTrue — the direct answer to the user's question.
  const cleanText = useMemo(() => {
    if (!safeDualMessage?.laymanSummary) return stripMarkers(safeText);
    const ls = safeDualMessage.laymanSummary;
    // The main answer is just the core finding — direct, complete, no section headers
    return stripMarkers(ls.whatIsLikelyTrue || safeText);
  }, [safeDualMessage, safeText]);

  const isSimulation = inferenceMode === 'simulation';

  // ── Smart heading — extracts a concise topic title (not just first sentence) ──
  const responseHeading = useMemo(() => {
    if (isUser) return null;
    const text = cleanText || safeText;
    if (!text || text.length < 40) return null;

    // 1. If the response starts with a markdown heading, use it directly
    const mdHeadingMatch = text.match(/^#{1,3}\s+(.{5,80})/);
    if (mdHeadingMatch) {
      const h = mdHeadingMatch[1]!.trim();
      return h.length > 50 ? h.slice(0, 50).replace(/\s\S*$/, '') + '...' : h;
    }

    // 2. Extract first two sentences for analysis
    const sentences = text.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length === 0) return null;
    const firstSentence = sentences[0].trim();

    // 3. Remove filler/boilerplate openings to get to the meat
    const fillerPatterns = [
      /^(okay|ok|sure|yes|no|well|so|right|great|absolutely|certainly|definitely|of course|here'?s?|let me|i'?d? be happy to|i'?ll|that'?s a|this is a)\s*/i,
      /^(based on|according to|in (this|that|the)|from (what|the))\s*/i,
    ];
    let core = firstSentence;
    for (const pat of fillerPatterns) {
      core = core.replace(pat, '');
    }
    core = core.replace(/^[,\s]+/, '');

    // 4. Extract key noun phrases — take the subject/topic
    // Split on common verb phrases to isolate the topic portion
    const verbSplitters = /\s+(is|are|was|were|has|have|had|can|could|will|would|may|might|should|does|do|did|involves?|requires?|means?|refers? to|works?|plays?|offers?|provides?|represents?|demonstrates?|shows?|suggests?|indicates?|reveals?|explores?|examines?|describes?|explains?|addresses?|covers?|focuses?|highlights?|illustrates?)\s+/i;
    const parts = core.split(verbSplitters);
    let topic = parts[0]!.trim();

    // 5. Clean up the topic — remove leading articles, cap length
    topic = topic.replace(/^(the|a|an|this|that|these|those)\s+/i, '').trim();

    // If topic is too short (< 3 chars) or too generic, fall back to first ~6 key words
    if (topic.length < 3) {
      const words = core.split(/\s+/).slice(0, 6).join(' ');
      topic = words;
    }

    // 6. Cap at ~50 chars, break at word boundary
    if (topic.length > 50) {
      topic = topic.slice(0, 50).replace(/\s\S*$/, '') + '...';
    }

    // 7. Capitalize first letter
    topic = topic.charAt(0).toUpperCase() + topic.slice(1);

    // Don't show headings that are too short or basically the whole first sentence
    return topic.length > 3 ? topic : null;
  }, [isUser, cleanText, safeText]);

  // ── Copy text ──
  const copyText = useCallback(() => {
    navigator.clipboard.writeText(cleanText || safeText);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [cleanText, safeText]);

  // Clean up copy timer on unmount
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  // ── Send to notes (creates page, fills content, navigates) ──
  const sendToNotes = useCallback(() => {
    const store = usePFCStore.getState();
    // Build full content including research analysis when available
    const fullContent = buildFullExport(message, cleanText, safeText, safeDualMessage);
    const pageId = store.createPage(responseHeading || `Chat Export — ${new Date().toLocaleDateString()}`);
    // Find the first block of the newly created page and fill it with content
    const firstBlock = store.noteBlocks.find((b: { pageId: string }) => b.pageId === pageId);
    if (firstBlock) {
      store.updateBlockContent(firstBlock.id, fullContent);
    }
    // Persist to storage BEFORE navigating so loadNotesFromStorage finds it
    store.setActivePage(pageId);
    store.saveNotesToStorage();
    router.push('/notes');
  }, [cleanText, safeText, safeDualMessage, message, responseHeading, router]);

  // ── Export single message as full doc (includes research analysis) ──
  const exportMessage = useCallback(() => {
    const fullContent = buildFullExport(message, cleanText, safeText, safeDualMessage);
    const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cleanText, safeText, safeDualMessage, message]);

  // ════════════════════════════════════════════════
  // USER MESSAGE — bubble style
  // ════════════════════════════════════════════════
  if (isUser) {
    return (
      <motion.div
        role="article"
        aria-label="User message"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MSG_SPRING}
        style={{
          display: 'flex',
          gap: '0.75rem',
          width: '100%',
          justifyContent: 'flex-end',
        }}
      >
        <div style={{
          maxWidth: '80%',
          borderRadius: 'var(--shape-xl) var(--shape-xl) var(--shape-sm) var(--shape-xl)',
          padding: '0.625rem 1rem',
          background: 'var(--m3-primary)',
          color: 'var(--m3-on-primary)',
        }}>
          <p style={{
            fontSize: '1.25rem',
            lineHeight: 1.7,
            margin: 0,
          }}>
            {safeText}
          </p>
          {/* Attachment badges/thumbnails */}
          {message.attachments && message.attachments.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.375rem',
              marginTop: '0.5rem',
            }}>
              {message.attachments.map((att) => {
                const isImage = att.type === 'image';
                return isImage && att.preview ? (
                  <img
                    key={att.id}
                    src={att.preview}
                    alt={att.name}
                    style={{
                      width: '64px',
                      height: '64px',
                      objectFit: 'cover',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                    }}
                    onClick={() => window.open(att.preview, '_blank')}
                  />
                ) : (
                  <span
                    key={att.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '999px',
                      background: 'rgba(255,255,255,0.15)',
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {att.type === 'pdf' ? '📄' : att.type === 'csv' ? '📊' : '📎'}
                    {att.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div style={{
          display: 'flex',
          height: '1.625rem',
          width: '1.625rem',
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--shape-full)',
          background: 'var(--m3-surface-container-high)',
          marginTop: '0.25rem',
        }}>
          <UserIcon style={{
            height: '0.8125rem',
            width: '0.8125rem',
            color: isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)',
          }} />
        </div>
      </motion.div>
    );
  }

  // ════════════════════════════════════════════════
  // ASSISTANT MESSAGE — clean text (Gemini-style), no bubble
  // ════════════════════════════════════════════════
  return (
    <motion.div
      role="article"
      aria-label="Assistant response"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MSG_SPRING}
      style={{
        display: 'flex',
        gap: '0.75rem',
        width: '100%',
        justifyContent: 'flex-start',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* AI avatar */}
      <div style={{ flexShrink: 0, marginTop: '0.125rem' }}>
        <PixelSun size={26} />
      </div>

      {/* Content — no bubble, clean text */}
      <div style={{
        flex: 1,
        minWidth: 0,
        maxWidth: '100%',
        position: 'relative',
        paddingBottom: '2.25rem',
      }}>
        {/* Reasoning accordion */}
        {message.reasoning?.content && (
          <div style={{ marginBottom: '0.5rem' }}>
            <ThinkingAccordion
              content={message.reasoning.content}
              duration={message.reasoning.duration}
              isThinking={false}
            />
          </div>
        )}

        {/* Response heading — Gemini-style bold title */}
        {responseHeading && (
          <h3 style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1.625rem',
            fontWeight: 700,
            lineHeight: 1.35,
            color: isDark ? '#FFFFFF' : 'var(--foreground)',
            fontFamily: "'RetroGaming', var(--font-display)",
            letterSpacing: '-0.01em',
          }}>
            {responseHeading}
          </h3>
        )}

        {/* Main text — rendered markdown */}
        <div
          style={{
            fontSize: '1.375rem',
            lineHeight: 1.8,
            color: isDark ? '#FFFFFF' : 'var(--foreground)',
            fontFamily: 'var(--font-secondary)',
          }}
        >
            {safeDualMessage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* ── Summary response — full standalone answer ── */}
                  <div style={{ paddingBottom: '1.25rem' }}>
                    <MarkdownContent content={cleanText} />
                  </div>

                  {/* ── Confidence + Grade bar ── */}
                  {safeConfidence !== null && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: 'var(--type-label-sm)',
                      fontFamily: 'var(--font-mono)',
                      color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.3)',
                      paddingBottom: '1rem',
                    }}>
                      <span>{(safeConfidence! * 100).toFixed(0)}% confidence</span>
                      {message.evidenceGrade && (
                        <span style={{
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
                        }}>
                          Grade {message.evidenceGrade}
                        </span>
                      )}
                      {isSimulation && (
                        <span style={{
                          padding: '0.0625rem 0.375rem',
                          borderRadius: 'var(--shape-full)',
                          background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.06)' : 'rgba(var(--pfc-accent-rgb), 0.04)',
                          color: 'var(--m3-primary)',
                          fontSize: 'var(--type-label-sm)',
                        }}>
                          sim
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── Separator line between summary and analysis ── */}
                  <div style={{
                    height: '1px',
                    background: isDark
                      ? 'linear-gradient(90deg, rgba(79,69,57,0.3) 0%, rgba(79,69,57,0.08) 100%)'
                      : 'linear-gradient(90deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.02) 100%)',
                    marginBottom: '1rem',
                  }} />

                  {/* ── Deep analysis toggle ── */}
                  <button
                    aria-expanded={deepOpen}
                    onClick={(e) => { e.stopPropagation(); setDeepOpen(!deepOpen); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.375rem 0.75rem',
                      borderRadius: 'var(--shape-full)',
                      border: isDark ? '1px solid rgba(79,69,57,0.25)' : '1px solid rgba(0,0,0,0.08)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: deepOpen
                        ? 'var(--pfc-accent)'
                        : isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.4)',
                      background: deepOpen
                        ? isDark ? 'rgba(var(--pfc-accent-rgb), 0.08)' : 'rgba(var(--pfc-accent-rgb), 0.06)'
                        : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      transition: 'color 0.15s, background 0.15s, border-color 0.15s',
                      alignSelf: 'flex-start',
                    }}
                  >
                    <ChevronDownIcon style={{
                      height: '0.75rem',
                      width: '0.75rem',
                      transition: 'transform 0.2s',
                      transform: deepOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }} />
                    {deepOpen ? 'Hide' : 'View'} deep analysis
                  </button>

                  {/* ── Expandable deep analysis section ── */}
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
                          gap: '1.25rem',
                          paddingTop: '1.25rem',
                          marginTop: '0.75rem',
                          borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.06)'}`,
                        }}>
                          {/* Methodology + Confidence + Caveats — structured breakdown from layman summary */}
                          {safeDualMessage!.laymanSummary && (() => {
                            const ls = safeDualMessage!.laymanSummary;
                            const deepSections: string[] = [];
                            if (ls.whatWasTried) {
                              deepSections.push(`### ${ls.sectionLabels?.whatWasTried || 'Research Approach'}\n${ls.whatWasTried}`);
                            }
                            if (ls.confidenceExplanation) {
                              deepSections.push(`### ${ls.sectionLabels?.confidenceExplanation || 'Confidence Assessment'}\n${ls.confidenceExplanation}`);
                            }
                            if (ls.whatCouldChange) {
                              deepSections.push(`### ${ls.sectionLabels?.whatCouldChange || 'What Could Change This'}\n${ls.whatCouldChange}`);
                            }
                            if (ls.whoShouldTrust) {
                              deepSections.push(`### ${ls.sectionLabels?.whoShouldTrust || 'Applicability'}\n${ls.whoShouldTrust}`);
                            }
                            return deepSections.length > 0 ? (
                              <MarkdownContent content={deepSections.join('\n\n')} />
                            ) : null;
                          })()}

                          {/* Raw research analysis — full pipeline output */}
                          <div style={{
                            paddingTop: '1rem',
                            borderTop: `1px solid ${isDark ? 'rgba(50,49,45,0.15)' : 'rgba(190,183,170,0.1)'}`,
                          }}>
                            <p style={{
                              fontSize: 'var(--type-label-sm)',
                              fontWeight: 600,
                              color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.3)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              marginBottom: '0.75rem',
                            }}>
                              Research Analysis
                            </p>
                            <MessageResearch dualMessage={safeDualMessage!} />
                          </div>

                          {/* Layman structured breakdown (reflection, arbitration) */}
                          <MessageLayman layman={safeDualMessage!.laymanSummary} />

                          {/* Concepts */}
                          {message.concepts && message.concepts.length > 0 && (
                            <ConceptMiniMap messageConcepts={message.concepts} />
                          )}

                          {/* Steering + Truth */}
                          <SteeringFeedback synthesisKeyId={messageSynthesisKeyId} />
                          {showTruthBot && message.truthAssessment && (
                            <TruthBotCard assessment={message.truthAssessment} />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
            ) : (
              <MarkdownContent content={safeText} />
            )}
          </div>

        {/* ── Hover action toolbar — absolute overlay, no layout shift ── */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                position: 'absolute',
                bottom: '0.25rem',
                left: 0,
                zIndex: 5,
              }}
            >
              {/* Copy */}
              <button
                onClick={(e) => { e.stopPropagation(); copyText(); }}
                title="Copy text"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'var(--shape-full)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                  e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
                  e.currentTarget.style.color = isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)';
                }}
              >
                {copied ? <CheckIcon style={{ height: 12, width: 12 }} /> : <CopyIcon style={{ height: 12, width: 12 }} />}
                {copied ? 'Copied' : 'Copy'}
              </button>

              {/* Export as doc */}
              <button
                onClick={(e) => { e.stopPropagation(); exportMessage(); }}
                title="Export as document"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'var(--shape-full)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                  e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
                  e.currentTarget.style.color = isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)';
                }}
              >
                <FileTextIcon style={{ height: 12, width: 12 }} />
                Export
              </button>

              {/* Send to notes */}
              <button
                onClick={(e) => { e.stopPropagation(); sendToNotes(); }}
                title="Send to notes"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'var(--shape-full)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                  e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
                  e.currentTarget.style.color = isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)';
                }}
              >
                <StickyNoteIcon style={{ height: 12, width: 12 }} />
                Notes
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export const Message = memo(MessageInner, (prev, next) =>
  prev.message.id === next.message.id &&
  prev.message.text === next.message.text &&
  prev.message.confidence === next.message.confidence &&
  prev.message.dualMessage === next.message.dualMessage &&
  prev.message.reasoning === next.message.reasoning &&
  prev.message.truthAssessment === next.message.truthAssessment,
);
