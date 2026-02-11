'use client';

import { useState, memo } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useShallow } from 'zustand/react/shallow';
import type { SynthesisReport } from '@/lib/engine/types';
import { SparklesIcon, XIcon, BookOpenIcon, FlaskConicalIcon, LightbulbIcon } from 'lucide-react';
import { PixelBook } from '@/components/pixel-book';
import { AnimatePresence, motion } from 'framer-motion';
import { Markdown } from '@/components/markdown';
import { useTheme } from 'next-themes';

const CUP_EASE = [0.32, 0.72, 0, 1] as const;

const TABS = [
  { key: 'plain', label: 'Summary', icon: BookOpenIcon },
  { key: 'research', label: 'Research', icon: FlaskConicalIcon },
  { key: 'suggestions', label: 'Ideas', icon: LightbulbIcon },
] as const;

function SynthesisCardBase() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('plain');
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark' || resolvedTheme === 'oled';

  const {
    synthesisReport, showSynthesis, toggleSynthesisView, setSynthesisReport,
    confidence, entropy, dissonance, healthScore, safetyState,
    riskScore, tda, focusDepth, temperatureScale, activeConcepts,
    activeChordProduct, harmonyKeyDistance, queriesProcessed, totalTraces,
    skillGapsDetected, inferenceMode,
  } = usePFCStore(useShallow((s) => ({
    synthesisReport: s.synthesisReport,
    showSynthesis: s.showSynthesis,
    toggleSynthesisView: s.toggleSynthesisView,
    setSynthesisReport: s.setSynthesisReport,
    confidence: s.confidence,
    entropy: s.entropy,
    dissonance: s.dissonance,
    healthScore: s.healthScore,
    safetyState: s.safetyState,
    riskScore: s.riskScore,
    tda: s.tda,
    focusDepth: s.focusDepth,
    temperatureScale: s.temperatureScale,
    activeConcepts: s.activeConcepts,
    activeChordProduct: s.activeChordProduct,
    harmonyKeyDistance: s.harmonyKeyDistance,
    queriesProcessed: s.queriesProcessed,
    totalTraces: s.totalTraces,
    skillGapsDetected: s.skillGapsDetected,
    inferenceMode: s.inferenceMode,
  })));

  async function handleGenerate() {
    setLoading(true);
    try {
      const currentMessages = usePFCStore.getState().messages;
      const res = await fetch('/api/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          signals: {
            confidence, entropy, dissonance, healthScore,
            safetyState, riskScore, tda, focusDepth,
            temperatureScale, activeConcepts, activeChordProduct,
            harmonyKeyDistance, queriesProcessed, totalTraces,
            skillGapsDetected, inferenceMode,
          },
        }),
      });

      if (!res.ok) throw new Error('Synthesis request failed');
      const report: SynthesisReport = await res.json();
      setSynthesisReport(report);
    } catch (err) {
      console.error('Synthesis generation failed:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!showSynthesis) return null;

  return (
    <AnimatePresence>
      {showSynthesis && (
        <motion.div
          key="synthesis-card"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.32, ease: CUP_EASE }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            marginBottom: '0.75rem',
            transform: 'translateZ(0)',
          }}
        >
          <div
            style={{
              maxWidth: '48rem',
              width: '100%',
              borderRadius: '1.25rem',
              overflow: 'hidden',
              background: isDark
                ? 'rgba(22,21,19,0.65)'
                : 'rgba(237,232,222,0.6)',
              backdropFilter: 'blur(20px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
              border: `1px solid ${isDark ? 'rgba(50,49,45,0.25)' : 'rgba(190,183,170,0.3)'}`,
              boxShadow: isDark
                ? '0 2px 12px -2px rgba(0,0,0,0.3)'
                : '0 2px 16px -2px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.03)',
            }}
          >
            {/* ── Header ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderBottom: `1px solid ${isDark ? 'rgba(50,49,45,0.2)' : 'rgba(190,183,170,0.15)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SparklesIcon style={{ height: '0.875rem', width: '0.875rem', color: '#C4956A', flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: isDark ? 'rgba(232,228,222,0.95)' : 'rgba(60,45,30,0.85)',
                  }}
                >
                  Synthesis
                </span>
                {synthesisReport?.timestamp && (
                  <span
                    style={{
                      fontSize: '0.5625rem',
                      fontFamily: 'var(--font-mono)',
                      color: isDark ? 'rgba(155,150,137,0.4)' : 'rgba(0,0,0,0.25)',
                    }}
                  >
                    {new Date(synthesisReport.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={toggleSynthesisView}
                aria-label="Close synthesis"
                style={{
                  display: 'flex',
                  height: '1.5rem',
                  width: '1.5rem',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = isDark ? 'rgba(232,228,222,0.9)' : 'rgba(0,0,0,0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.3)';
                }}
              >
                <XIcon style={{ height: '0.875rem', width: '0.875rem' }} />
              </motion.button>
            </div>

            {/* ── Content ── */}
            <div style={{ padding: '1rem' }}>
              {!synthesisReport ? (
                /* ── Empty state: generate prompt ── */
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1.5rem 0',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      maxWidth: '24rem',
                      lineHeight: 1.6,
                      color: isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)',
                    }}
                  >
                    Generate a synthesis from your conversation and current signals.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleGenerate}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.4375rem 0.875rem',
                      borderRadius: '9999px',
                      border: 'none',
                      cursor: loading ? 'wait' : 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      opacity: loading ? 0.6 : 1,
                      background: isDark ? 'rgba(44,43,41,0.85)' : 'rgba(255,255,255,0.85)',
                      color: isDark ? 'rgba(232,228,222,0.95)' : 'rgba(60,45,30,0.85)',
                      boxShadow: isDark
                        ? '0 2px 8px -1px rgba(0,0,0,0.3), 0 1px 3px -1px rgba(0,0,0,0.2)'
                        : '0 2px 16px -2px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.04)',
                      transition: 'background 0.15s, opacity 0.2s',
                    }}
                  >
                    {loading ? (
                      <PixelBook size={14} />
                    ) : (
                      <SparklesIcon style={{ height: '0.75rem', width: '0.75rem', color: '#C4956A' }} />
                    )}
                    {loading ? 'Generating...' : 'Generate'}
                  </motion.button>
                </div>
              ) : (
                /* ── Report with tabs ── */
                <div>
                  {/* Tab bar — nav pill style */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.125rem',
                      marginBottom: '0.75rem',
                      padding: '0.1875rem',
                      borderRadius: '9999px',
                      background: isDark ? 'rgba(14,13,11,0.3)' : 'rgba(0,0,0,0.03)',
                    }}
                  >
                    {TABS.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.3125rem 0.625rem',
                            borderRadius: '9999px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.6875rem',
                            fontWeight: isActive ? 700 : 500,
                            letterSpacing: '-0.01em',
                            color: isActive
                              ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(60,45,30,0.85)')
                              : (isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)'),
                            background: isActive
                              ? (isDark ? 'rgba(44,43,41,0.85)' : 'rgba(255,255,255,0.85)')
                              : 'transparent',
                            boxShadow: isActive
                              ? (isDark
                                  ? '0 2px 8px -1px rgba(0,0,0,0.3), 0 1px 3px -1px rgba(0,0,0,0.2)'
                                  : '0 2px 16px -2px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.04)')
                              : 'none',
                            transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
                          }}
                        >
                          <Icon
                            style={{
                              height: '0.6875rem',
                              width: '0.6875rem',
                              flexShrink: 0,
                              color: isActive ? '#C4956A' : 'inherit',
                              transition: 'color 0.15s',
                            }}
                          />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab content */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: CUP_EASE }}
                      style={{
                        borderRadius: '0.75rem',
                        background: isDark ? 'rgba(14,13,11,0.35)' : 'rgba(0,0,0,0.025)',
                        padding: '1rem',
                        fontSize: '0.75rem',
                        lineHeight: 1.7,
                        color: isDark ? 'rgba(232,228,222,0.8)' : 'rgba(43,42,39,0.75)',
                        maxHeight: '280px',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        transform: 'translateZ(0)',
                      }}
                    >
                      {activeTab === 'plain' && (
                        <Markdown>{synthesisReport.plainSummary}</Markdown>
                      )}
                      {activeTab === 'research' && (
                        <Markdown>{synthesisReport.researchSummary}</Markdown>
                      )}
                      {activeTab === 'suggestions' && (
                        <ol style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: 0, padding: 0, listStyle: 'none' }}>
                          {synthesisReport.suggestions.map((suggestion, i) => (
                            <li
                              key={i}
                              style={{
                                display: 'flex',
                                gap: '0.625rem',
                                fontSize: '0.75rem',
                                lineHeight: 1.7,
                                alignItems: 'flex-start',
                              }}
                            >
                              <span
                                style={{
                                  flexShrink: 0,
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.625rem',
                                  fontWeight: 700,
                                  color: '#C4956A',
                                  marginTop: '0.125rem',
                                  minWidth: '1rem',
                                  textAlign: 'right',
                                }}
                              >
                                {i + 1}.
                              </span>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const SynthesisCard = memo(SynthesisCardBase);
