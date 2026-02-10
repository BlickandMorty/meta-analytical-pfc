'use client';

import { useState } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import type { SynthesisReport } from '@/lib/engine/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SparklesIcon, XIcon, BookOpenIcon, FlaskConicalIcon, LightbulbIcon } from 'lucide-react';
import { PixelBook } from '@/components/pixel-book';
import { AnimatePresence, motion } from 'framer-motion';
import { Markdown } from '@/components/markdown';
import { cn } from '@/lib/utils';

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;

const TABS = [
  { key: 'plain', label: 'Summary', icon: BookOpenIcon },
  { key: 'research', label: 'Research', icon: FlaskConicalIcon },
  { key: 'suggestions', label: 'Ideas', icon: LightbulbIcon },
] as const;

export function SynthesisCard() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('plain');

  const synthesisReport = usePFCStore((s) => s.synthesisReport);
  const showSynthesis = usePFCStore((s) => s.showSynthesis);
  const toggleSynthesisView = usePFCStore((s) => s.toggleSynthesisView);
  const setSynthesisReport = usePFCStore((s) => s.setSynthesisReport);
  const messages = usePFCStore((s) => s.messages);
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);
  const healthScore = usePFCStore((s) => s.healthScore);
  const safetyState = usePFCStore((s) => s.safetyState);
  const riskScore = usePFCStore((s) => s.riskScore);
  const tda = usePFCStore((s) => s.tda);
  const focusDepth = usePFCStore((s) => s.focusDepth);
  const temperatureScale = usePFCStore((s) => s.temperatureScale);
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const activeChordProduct = usePFCStore((s) => s.activeChordProduct);
  const harmonyKeyDistance = usePFCStore((s) => s.harmonyKeyDistance);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const totalTraces = usePFCStore((s) => s.totalTraces);
  const skillGapsDetected = usePFCStore((s) => s.skillGapsDetected);
  const inferenceMode = usePFCStore((s) => s.inferenceMode);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch('/api/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
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
          transition={{ duration: 0.32, ease: CUPERTINO_EASE }}
          className="flex justify-center w-full mb-3"
          style={{ transform: 'translateZ(0)' }}
        >
          <div
            className="max-w-3xl w-full rounded-2xl border border-border/20 overflow-hidden"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(12px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/15">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-3.5 w-3.5 text-pfc-violet" />
                <span className="text-xs font-bold tracking-tight">Synthesis</span>
                {synthesisReport?.timestamp && (
                  <span className="text-[9px] text-muted-foreground/40 font-mono">
                    {new Date(synthesisReport.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={toggleSynthesisView}
                aria-label="Close synthesis"
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/50 hover:text-foreground cursor-pointer transition-colors"
              >
                <XIcon className="h-3.5 w-3.5" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-4">
              {!synthesisReport ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <p className="text-xs text-muted-foreground/60 text-center max-w-sm">
                    Generate a synthesis from your conversation and current signals.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleGenerate}
                    disabled={loading}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-full text-xs cursor-pointer',
                      'transition-colors disabled:opacity-50',
                    )}
                    style={{
                      background: 'rgba(244,189,111,0.12)',
                      color: 'rgba(237,224,212,0.95)',
                      fontWeight: 700,
                      border: 'none',
                    }}
                  >
                    {loading ? <PixelBook size={16} /> : <SparklesIcon className="h-3.5 w-3.5" />}
                    {loading ? 'Generating...' : 'Generate'}
                  </motion.button>
                </div>
              ) : (
                <div>
                  {/* Tab bar */}
                  <div className="flex gap-1 mb-3">
                    {TABS.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.key;
                      return (
                        <motion.button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          whileTap={{ scale: 0.92 }}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors',
                            isActive
                              ? 'bg-[rgba(244,189,111,0.12)] text-[rgba(237,224,212,0.95)]'
                              : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40',
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {tab.label}
                        </motion.button>
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
                      transition={{ duration: 0.2, ease: CUPERTINO_EASE }}
                      className="rounded-xl bg-background/40 p-4 text-xs leading-relaxed text-foreground/80 max-h-[280px] overflow-y-auto"
                      style={{ willChange: 'scroll-position', overscrollBehavior: 'contain', transform: 'translateZ(0)' }}
                    >
                      {activeTab === 'plain' && (
                        <Markdown>{synthesisReport.plainSummary}</Markdown>
                      )}
                      {activeTab === 'research' && (
                        <Markdown>{synthesisReport.researchSummary}</Markdown>
                      )}
                      {activeTab === 'suggestions' && (
                        <ol className="space-y-2">
                          {synthesisReport.suggestions.map((suggestion, i) => (
                            <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
                              <span className="shrink-0 font-mono text-[10px] font-bold text-pfc-violet mt-0.5">
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
