'use client';

import { useState } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import type { SynthesisReport } from '@/lib/engine/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SparklesIcon, XIcon, BookOpenIcon, FlaskConicalIcon, LightbulbIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Markdown } from '@/components/markdown';
import { cn } from '@/lib/utils';

export function SynthesisCard() {
  const [loading, setLoading] = useState(false);

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
            confidence,
            entropy,
            dissonance,
            healthScore,
            safetyState,
            riskScore,
            tda,
            focusDepth,
            temperatureScale,
            activeConcepts,
            activeChordProduct,
            harmonyKeyDistance,
            queriesProcessed,
            totalTraces,
            skillGapsDetected,
            inferenceMode,
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex justify-center w-full"
        >
          <Card className="max-w-3xl w-full border-pfc-violet/20 bg-card dark:bg-muted/30">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="h-4 w-4 text-pfc-violet" />
                  <span>Synthesis Report</span>
                </div>
                <div className="flex items-center gap-2">
                  {synthesisReport?.timestamp && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {new Date(synthesisReport.timestamp).toLocaleString()}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={toggleSynthesisView}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 pt-0">
              {!synthesisReport ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <p className="text-sm text-muted-foreground text-center">
                    Generate a synthesis report from your conversation and current signal data.
                  </p>
                  <Button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="bg-pfc-violet hover:bg-pfc-violet/90 text-white"
                  >
                    {loading ? (
                      <>
                        <SparklesIcon className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="h-4 w-4" />
                        Generate Synthesis
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Tabs defaultValue="plain" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="plain" className="flex-1 gap-1.5 text-xs">
                      <BookOpenIcon className="h-3.5 w-3.5" />
                      Plain Summary
                    </TabsTrigger>
                    <TabsTrigger value="research" className="flex-1 gap-1.5 text-xs">
                      <FlaskConicalIcon className="h-3.5 w-3.5" />
                      Research Summary
                    </TabsTrigger>
                    <TabsTrigger value="suggestions" className="flex-1 gap-1.5 text-xs">
                      <LightbulbIcon className="h-3.5 w-3.5" />
                      Suggestions
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="plain" className="mt-3">
                    <div className="rounded-lg border bg-background p-4">
                      <Markdown>{synthesisReport.plainSummary}</Markdown>
                    </div>
                  </TabsContent>

                  <TabsContent value="research" className="mt-3">
                    <div className="rounded-lg border bg-background p-4">
                      <Markdown>{synthesisReport.researchSummary}</Markdown>
                    </div>
                  </TabsContent>

                  <TabsContent value="suggestions" className="mt-3">
                    <div className="rounded-lg border bg-background p-4">
                      <ol className="space-y-2">
                        {synthesisReport.suggestions.map((suggestion, i) => (
                          <li
                            key={i}
                            className="flex gap-3 text-sm text-foreground/90 leading-relaxed"
                          >
                            <span className="shrink-0 font-mono text-xs font-bold text-pfc-violet mt-0.5">
                              {i + 1}.
                            </span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
