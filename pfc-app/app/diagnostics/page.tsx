'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  GaugeIcon,
  HeartPulseIcon,
  ShieldCheckIcon,
  BrainIcon,
  ThermometerIcon,
  ZapIcon,
  ActivityIcon,
  TargetIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import type { SafetyState } from '@/lib/constants';
import { cn } from '@/lib/utils';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { ThemeToggle } from '@/components/theme-toggle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(value: number): number {
  return Math.round(value * 100);
}

function confidenceColor(v: number): string {
  if (v > 0.6) return 'text-pfc-green';
  if (v > 0.3) return 'text-pfc-yellow';
  return 'text-pfc-red';
}

function confidenceBarClass(v: number): string {
  if (v > 0.6) return '[&>div]:bg-pfc-green';
  if (v > 0.3) return '[&>div]:bg-pfc-yellow';
  return '[&>div]:bg-pfc-red';
}

function entropyColor(v: number): string {
  if (v < 0.4) return 'text-pfc-green';
  if (v < 0.7) return 'text-pfc-yellow';
  return 'text-pfc-red';
}

function entropyBarClass(v: number): string {
  if (v < 0.4) return '[&>div]:bg-pfc-green';
  if (v < 0.7) return '[&>div]:bg-pfc-yellow';
  return '[&>div]:bg-pfc-red';
}

function dissonanceColor(v: number): string {
  if (v < 0.3) return 'text-pfc-green';
  if (v < 0.6) return 'text-pfc-yellow';
  return 'text-pfc-red';
}

function dissonanceBarClass(v: number): string {
  if (v < 0.3) return '[&>div]:bg-pfc-green';
  if (v < 0.6) return '[&>div]:bg-pfc-yellow';
  return '[&>div]:bg-pfc-red';
}

function safetyBadgeClass(state: SafetyState): string {
  switch (state) {
    case 'green':
      return 'bg-pfc-green/20 text-pfc-green border-pfc-green/40';
    case 'yellow':
      return 'bg-pfc-yellow/20 text-pfc-yellow border-pfc-yellow/40';
    case 'orange':
      return 'bg-pfc-ember/20 text-pfc-ember border-pfc-ember/40';
    case 'red':
      return 'bg-pfc-red/20 text-pfc-red border-pfc-red/40';
  }
}

function riskBarClass(v: number): string {
  if (v < 0.3) return '[&>div]:bg-pfc-green';
  if (v < 0.6) return '[&>div]:bg-pfc-yellow';
  return '[&>div]:bg-pfc-red';
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' as const },
  }),
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DiagnosticsPage() {
  const ready = useSetupGuard();
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);
  const healthScore = usePFCStore((s) => s.healthScore);
  const safetyState = usePFCStore((s) => s.safetyState);
  const riskScore = usePFCStore((s) => s.riskScore);
  const focusDepth = usePFCStore((s) => s.focusDepth);
  const temperatureScale = usePFCStore((s) => s.temperatureScale);
  const tda = usePFCStore((s) => s.tda);
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const activeChordProduct = usePFCStore((s) => s.activeChordProduct);
  const harmonyKeyDistance = usePFCStore((s) => s.harmonyKeyDistance);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const totalTraces = usePFCStore((s) => s.totalTraces);
  const skillGapsDetected = usePFCStore((s) => s.skillGapsDetected);
  const reset = usePFCStore((s) => s.reset);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1 -ml-3 hover:bg-muted"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Link>

          <div className="flex items-center gap-2 ml-1">
            <GaugeIcon className="h-5 w-5 text-pfc-ember" />
            <h1 className="text-lg font-semibold tracking-tight">
              Diagnostics
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="gap-1.5"
            >
              <RefreshCwIcon className="h-3.5 w-3.5" />
              Reset
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* --------------------------------------------------------------- */}
        {/* Section 1: Core Signals                                         */}
        {/* --------------------------------------------------------------- */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ActivityIcon className="h-4 w-4" />
            Core Signals
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Confidence */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={0}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <TargetIcon className="h-3.5 w-3.5" />
                    Confidence Score
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={cn('text-3xl font-bold tabular-nums', confidenceColor(confidence))}>
                    {pct(confidence)}%
                  </p>
                  <Progress
                    value={pct(confidence)}
                    className={cn('mt-3 h-2', confidenceBarClass(confidence))}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Entropy */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={1}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <ZapIcon className="h-3.5 w-3.5" />
                    Entropy Level
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={cn('text-3xl font-bold tabular-nums', entropyColor(entropy))}>
                    {pct(entropy)}%
                  </p>
                  <Progress
                    value={pct(entropy)}
                    className={cn('mt-3 h-2', entropyBarClass(entropy))}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Dissonance */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={2}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <BrainIcon className="h-3.5 w-3.5" />
                    Cognitive Dissonance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={cn('text-3xl font-bold tabular-nums', dissonanceColor(dissonance))}>
                    {pct(dissonance)}%
                  </p>
                  <Progress
                    value={pct(dissonance)}
                    className={cn('mt-3 h-2', dissonanceBarClass(dissonance))}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Health */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={3}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <HeartPulseIcon className="h-3.5 w-3.5" />
                    System Health
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={cn('text-3xl font-bold tabular-nums', confidenceColor(healthScore))}>
                    {pct(healthScore)}%
                  </p>
                  <Progress
                    value={pct(healthScore)}
                    className={cn('mt-3 h-2', confidenceBarClass(healthScore))}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        <Separator />

        {/* --------------------------------------------------------------- */}
        {/* Section 2: Safety & Risk                                        */}
        {/* --------------------------------------------------------------- */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheckIcon className="h-4 w-4" />
            Safety & Risk
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Safety State */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={4}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                    Safety Status
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                  <Badge
                    className={cn(
                      'px-4 py-2 text-lg font-bold uppercase tracking-wider',
                      safetyBadgeClass(safetyState),
                    )}
                  >
                    {safetyState}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {safetyState === 'green' && 'All systems nominal'}
                    {safetyState === 'yellow' && 'Minor concerns detected'}
                    {safetyState === 'orange' && 'Elevated risk level'}
                    {safetyState === 'red' && 'Critical alert active'}
                  </span>
                </CardContent>
              </Card>
            </motion.div>

            {/* Risk Score */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={5}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <ZapIcon className="h-3.5 w-3.5" />
                    Risk Score
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={cn(
                    'text-3xl font-bold tabular-nums',
                    riskScore < 0.3
                      ? 'text-pfc-green'
                      : riskScore < 0.6
                        ? 'text-pfc-yellow'
                        : 'text-pfc-red',
                  )}>
                    {pct(riskScore)}%
                  </p>
                  <Progress
                    value={pct(riskScore)}
                    className={cn('mt-3 h-2', riskBarClass(riskScore))}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        <Separator />

        {/* --------------------------------------------------------------- */}
        {/* Section 3: TDA Topology                                         */}
        {/* --------------------------------------------------------------- */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <BrainIcon className="h-4 w-4" />
            TDA Topology
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              { label: 'Betti-0', value: tda.betti0 },
              { label: 'Betti-1', value: tda.betti1 },
              { label: 'Persistence Entropy', value: tda.persistenceEntropy },
              { label: 'Max Persistence', value: tda.maxPersistence },
            ] as const).map((item, i) => (
              <motion.div
                key={item.label}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={6 + i}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">
                      {item.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold tabular-nums text-pfc-violet">
                      {item.value.toFixed(3)}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <Separator />

        {/* --------------------------------------------------------------- */}
        {/* Section 4: Focus & Temperature                                  */}
        {/* --------------------------------------------------------------- */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ThermometerIcon className="h-4 w-4" />
            Focus & Temperature
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Focus Depth */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={10}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <TargetIcon className="h-3.5 w-3.5" />
                    Focus Depth
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums text-pfc-cyan">
                    {Math.round(focusDepth)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Current analytical depth level
                  </span>
                </CardContent>
              </Card>
            </motion.div>

            {/* Temperature Scale */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={11}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <ThermometerIcon className="h-3.5 w-3.5" />
                    Temperature Scale
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums text-pfc-ember">
                    {temperatureScale.toFixed(2)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Sampling temperature multiplier
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        <Separator />

        {/* --------------------------------------------------------------- */}
        {/* Section 5: Concept Chords                                       */}
        {/* --------------------------------------------------------------- */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ActivityIcon className="h-4 w-4" />
            Concept Chords
          </h2>

          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={12}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Active Concepts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {activeConcepts.length > 0 ? (
                    activeConcepts.map((concept) => (
                      <Badge
                        key={concept}
                        variant="secondary"
                        className="bg-pfc-violet/10 text-pfc-violet border-pfc-violet/20"
                      >
                        {concept}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No active concepts
                    </span>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Chord Product</p>
                    <p className="text-xl font-bold tabular-nums text-pfc-cyan">
                      {activeChordProduct.toFixed(3)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Harmony Distance</p>
                    <p className="text-xl font-bold tabular-nums text-pfc-cyan">
                      {harmonyKeyDistance.toFixed(3)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        <Separator />

        {/* --------------------------------------------------------------- */}
        {/* Section 6: Meta Statistics                                      */}
        {/* --------------------------------------------------------------- */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <GaugeIcon className="h-4 w-4" />
            Meta Statistics
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {([
              {
                label: 'Queries Processed',
                value: queriesProcessed,
                icon: ZapIcon,
                color: 'text-pfc-green',
              },
              {
                label: 'Total Traces',
                value: totalTraces,
                icon: ActivityIcon,
                color: 'text-pfc-violet',
              },
              {
                label: 'Skill Gaps Detected',
                value: skillGapsDetected,
                icon: TargetIcon,
                color: 'text-pfc-ember',
              },
            ] as const).map((stat, i) => (
              <motion.div
                key={stat.label}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={13 + i}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1.5">
                      <stat.icon className="h-3.5 w-3.5" />
                      {stat.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className={cn('text-3xl font-bold tabular-nums', stat.color)}>
                      {stat.value}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
