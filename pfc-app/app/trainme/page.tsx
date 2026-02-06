'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCapIcon,
  ArrowLeftIcon,
  SparklesIcon,
  ChevronDownIcon,
  BeakerIcon,
  BookOpenIcon,
  WrenchIcon,
  TargetIcon,
  BrainIcon,
  AlertTriangleIcon,
  LightbulbIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import type { TrainMeReport, TrainingInsight } from '@/lib/engine/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<TrainingInsight['category'], React.ReactNode> = {
  architecture: <BrainIcon className="h-4 w-4" />,
  data: <BookOpenIcon className="h-4 w-4" />,
  optimization: <TargetIcon className="h-4 w-4" />,
  evaluation: <BeakerIcon className="h-4 w-4" />,
  alignment: <AlertTriangleIcon className="h-4 w-4" />,
};

const PRIORITY_COLORS: Record<TrainingInsight['priority'], string> = {
  high: 'bg-pfc-red/15 text-pfc-red border-pfc-red/30',
  medium: 'bg-pfc-yellow/15 text-pfc-yellow border-pfc-yellow/30',
  low: 'bg-pfc-green/15 text-pfc-green border-pfc-green/30',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-pfc-green/15 text-pfc-green border-pfc-green/30',
  intermediate: 'bg-pfc-yellow/15 text-pfc-yellow border-pfc-yellow/30',
  advanced: 'bg-pfc-red/15 text-pfc-red border-pfc-red/30',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrainMePage() {
  const ready = useSetupGuard();
  const [loading, setLoading] = useState(false);
  const [openInsights, setOpenInsights] = useState<Record<string, boolean>>({});

  const trainMeReport = usePFCStore((s) => s.trainMeReport);
  const setTrainMeReport = usePFCStore((s) => s.setTrainMeReport);

  // Signal values for the POST body
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);
  const healthScore = usePFCStore((s) => s.healthScore);
  const safetyState = usePFCStore((s) => s.safetyState);
  const riskScore = usePFCStore((s) => s.riskScore);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const focusDepth = usePFCStore((s) => s.focusDepth);
  const temperatureScale = usePFCStore((s) => s.temperatureScale);
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const activeChordProduct = usePFCStore((s) => s.activeChordProduct);
  const harmonyKeyDistance = usePFCStore((s) => s.harmonyKeyDistance);

  // ----------------------------------
  // Generate / Regenerate
  // ----------------------------------

  async function generateReport() {
    setLoading(true);
    try {
      const res = await fetch('/api/trainme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signals: {
            confidence,
            entropy,
            dissonance,
            healthScore,
            safetyState,
            riskScore,
            queriesProcessed,
            focusDepth,
            temperatureScale,
            activeConcepts,
            activeChordProduct,
            harmonyKeyDistance,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to generate report');

      const data: TrainMeReport = await res.json();
      setTrainMeReport(data);
      setOpenInsights({});
    } catch (err) {
      console.error('TrainMe generation failed:', err);
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------
  // Toggle insight open/close
  // ----------------------------------

  function toggleInsight(id: string) {
    setOpenInsights((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // ----------------------------------
  // Render
  // ----------------------------------

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1 -ml-3 hover:bg-muted"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Link>
          <div className="flex items-center gap-2 ml-1">
            <GraduationCapIcon className="h-5 w-5 text-pfc-violet" />
            <h1 className="text-lg font-semibold tracking-tight">Train Me</h1>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        <AnimatePresence mode="wait">
          {!trainMeReport ? (
            /* ── Empty State ── */
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="mb-6 rounded-full bg-pfc-violet/10 p-6">
                <GraduationCapIcon className="h-12 w-12 text-pfc-violet" />
              </div>
              <h2 className="mb-2 text-2xl font-bold tracking-tight">
                Train Me
              </h2>
              <p className="mb-8 max-w-md text-muted-foreground">
                Generate ML improvement suggestions based on your current PFC
                signal state. The system will self-assess its reasoning
                architecture and propose prioritized experiments for
                enhancement.
              </p>
              <Button
                size="lg"
                onClick={generateReport}
                disabled={loading}
                className="gap-2 rounded-full bg-pfc-violet text-white hover:bg-pfc-violet/90"
              >
                {loading ? (
                  <>
                    <SparklesIcon className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
            </motion.div>
          ) : (
            /* ── Report ── */
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="space-y-8"
            >
              {/* ── Report Header ── */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">
                    Training Report
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Generated{' '}
                    {new Date(trainMeReport.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="mt-2 w-fit border-pfc-violet/30 text-pfc-violet sm:mt-0"
                >
                  {trainMeReport.insights.length} insight
                  {trainMeReport.insights.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <Separator />

              {/* ── System Self-Assessment ── */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <BrainIcon className="h-5 w-5 text-pfc-cyan" />
                  <h3 className="text-lg font-semibold">
                    System Self-Assessment
                  </h3>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {trainMeReport.systemSelfAssessment}
                    </p>
                  </CardContent>
                </Card>
              </section>

              {/* ── Prioritized Improvements ── */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <TargetIcon className="h-5 w-5 text-pfc-ember" />
                  <h3 className="text-lg font-semibold">
                    Prioritized Improvements
                  </h3>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <ol className="space-y-3">
                      {trainMeReport.prioritizedImprovements.map(
                        (improvement, idx) => (
                          <li key={idx} className="flex gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pfc-violet/15 text-xs font-bold text-pfc-violet">
                              {idx + 1}
                            </span>
                            <span className="text-sm leading-relaxed">
                              {improvement}
                            </span>
                          </li>
                        )
                      )}
                    </ol>
                  </CardContent>
                </Card>
              </section>

              {/* ── Training Insights ── */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <LightbulbIcon className="h-5 w-5 text-pfc-yellow" />
                  <h3 className="text-lg font-semibold">Training Insights</h3>
                </div>
                <div className="space-y-3">
                  {trainMeReport.insights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      open={!!openInsights[insight.id]}
                      onToggle={() => toggleInsight(insight.id)}
                    />
                  ))}
                </div>
              </section>

              {/* ── Researcher Notes ── */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <BookOpenIcon className="h-5 w-5 text-pfc-green" />
                  <h3 className="text-lg font-semibold">Researcher Notes</h3>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {trainMeReport.researcherNotes}
                    </p>
                  </CardContent>
                </Card>
              </section>

              {/* ── Regenerate ── */}
              <div className="flex justify-center pb-8 pt-4">
                <Button
                  variant="outline"
                  onClick={generateReport}
                  disabled={loading}
                  className="gap-2 border-pfc-violet/30 text-pfc-violet hover:bg-pfc-violet/10"
                >
                  {loading ? (
                    <>
                      <SparklesIcon className="h-4 w-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-4 w-4" />
                      Regenerate
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InsightCard sub-component
// ---------------------------------------------------------------------------

function InsightCard({
  insight,
  open,
  onToggle,
}: {
  insight: TrainingInsight;
  open: boolean;
  onToggle: () => void;
}) {
  const { experiment } = insight;

  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <Card
        className={cn(
          'transition-colors',
          open && 'border-pfc-violet/30'
        )}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {/* Priority badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] uppercase tracking-wider',
                    PRIORITY_COLORS[insight.priority]
                  )}
                >
                  {insight.priority}
                </Badge>

                {/* Category badge */}
                <Badge
                  variant="outline"
                  className="gap-1 border-pfc-violet/30 text-pfc-violet"
                >
                  {CATEGORY_ICONS[insight.category]}
                  <span className="capitalize">{insight.category}</span>
                </Badge>
              </div>

              <ChevronDownIcon
                className={cn(
                  'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
                  open && 'rotate-180'
                )}
              />
            </div>

            <CardTitle className="mt-2 text-base">{insight.title}</CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-5">
            {/* Observation */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observation
              </p>
              <p className="text-sm leading-relaxed">{insight.observation}</p>
            </div>

            {/* Hypothesis */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hypothesis
              </p>
              <p className="text-sm leading-relaxed">{insight.hypothesis}</p>
            </div>

            <Separator />

            {/* Experiment Suggestion */}
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <BeakerIcon className="h-4 w-4 text-pfc-cyan" />
                <p className="text-sm font-semibold">Experiment Suggestion</p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Name
                  </p>
                  <p className="text-sm font-medium">{experiment.name}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </p>
                  <p className="text-sm leading-relaxed">
                    {experiment.description}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Methodology
                  </p>
                  <p className="text-sm leading-relaxed">
                    {experiment.methodology}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Expected Outcome
                  </p>
                  <p className="text-sm leading-relaxed">
                    {experiment.expectedOutcome}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Difficulty + Estimated Time */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] uppercase tracking-wider',
                    DIFFICULTY_COLORS[experiment.difficulty]
                  )}
                >
                  {experiment.difficulty}
                </Badge>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <WrenchIcon className="h-3 w-3" />
                  {experiment.estimatedTime}
                </Badge>
              </div>

              {/* Required Tools */}
              {experiment.requiredTools.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Required Tools
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {experiment.requiredTools.map((tool) => (
                      <Badge
                        key={tool}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Related Signals */}
            {insight.relatedSignals.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Related Signals
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {insight.relatedSignals.map((signal) => (
                    <Badge
                      key={signal}
                      variant="outline"
                      className="border-pfc-cyan/30 text-[10px] text-pfc-cyan"
                    >
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
