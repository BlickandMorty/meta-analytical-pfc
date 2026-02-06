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
  AlertTriangleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  CopyIcon,
  SwordsIcon,
  SearchIcon,
  RotateCcwIcon,
} from 'lucide-react';

import { usePFCStore, type SignalHistoryEntry } from '@/lib/store/use-pfc-store';
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
// Sparkline — mini SVG chart
// ---------------------------------------------------------------------------

function Sparkline({
  data,
  color = '#C15F3C',
  height = 32,
  width = 80,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-[9px] text-muted-foreground/40"
      >
        No data
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * w;
      const y = padding + h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  const lastX = padding + ((data.length - 1) / (data.length - 1)) * w;
  const lastY = padding + h - ((data[data.length - 1] - min) / range) * h;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Trend indicator
// ---------------------------------------------------------------------------

function TrendArrow({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const recent = data.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const prev = data.slice(-6, -3);
  if (prev.length === 0) return null;
  const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
  const diff = avg - prevAvg;

  if (Math.abs(diff) < 0.02) {
    return <MinusIcon className="h-3 w-3 text-muted-foreground/40" />;
  }
  if (diff > 0) {
    return <TrendingUpIcon className="h-3 w-3 text-pfc-green" />;
  }
  return <TrendingDownIcon className="h-3 w-3 text-pfc-red" />;
}

// ---------------------------------------------------------------------------
// Anomaly alert logic
// ---------------------------------------------------------------------------

interface Anomaly {
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  recommendation: string;
}

function getAnomalies(state: {
  entropy: number;
  dissonance: number;
  healthScore: number;
  riskScore: number;
  confidence: number;
}): Anomaly[] {
  const alerts: Anomaly[] = [];
  if (state.entropy > 0.7) {
    alerts.push({
      severity: 'warning',
      title: 'Divergent reasoning detected',
      description: `Entropy at ${pct(state.entropy)}% indicates high uncertainty across reasoning paths.`,
      recommendation: 'Increase focus depth or narrow the query scope.',
    });
  }
  if (state.dissonance > 0.5) {
    alerts.push({
      severity: 'critical',
      title: 'Evidence conflicts found',
      description: `Dissonance at ${pct(state.dissonance)}% suggests contradictory evidence streams.`,
      recommendation: 'Run adversarial stress test to isolate conflicting sources.',
    });
  }
  if (state.healthScore < 0.4) {
    alerts.push({
      severity: 'critical',
      title: 'Pipeline integrity compromised',
      description: `Health score dropped to ${pct(state.healthScore)}%.`,
      recommendation: 'Reset controls and re-run with default parameters.',
    });
  }
  if (state.riskScore > 0.5) {
    alerts.push({
      severity: 'warning',
      title: 'Elevated risk assessment',
      description: `Risk score at ${pct(state.riskScore)}% exceeds safe threshold.`,
      recommendation: 'Review safety state and consider lowering adversarial intensity.',
    });
  }
  if (state.confidence < 0.3) {
    alerts.push({
      severity: 'warning',
      title: 'Low confidence output',
      description: `Confidence at ${pct(state.confidence)}% — results may be unreliable.`,
      recommendation: 'Increase Bayesian prior strength or simplify the query.',
    });
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Correlation heatmap
// ---------------------------------------------------------------------------

function correlateArrays(a: number[], b: number[]): number {
  if (a.length < 3 || b.length < 3) return 0;
  const n = Math.min(a.length, b.length);
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

function CorrelationMatrix({ history }: { history: SignalHistoryEntry[] }) {
  const labels = ['Conf', 'Entr', 'Diss', 'Health'];
  const extracted = {
    confidence: history.map((h) => h.confidence),
    entropy: history.map((h) => h.entropy),
    dissonance: history.map((h) => h.dissonance),
    healthScore: history.map((h) => h.healthScore),
  };
  const keys = ['confidence', 'entropy', 'dissonance', 'healthScore'] as const;

  if (history.length < 3) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground/40">
        Need 3+ queries for correlations
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-0.5" style={{ width: 'fit-content' }}>
      {/* Header row */}
      <div />
      {labels.map((l) => (
        <div key={l} className="text-[9px] text-center font-mono text-muted-foreground/60 px-1">
          {l}
        </div>
      ))}
      {/* Data rows */}
      {keys.map((rowKey, ri) => (
        <div key={rowKey} className="contents">
          <div className="text-[9px] font-mono text-muted-foreground/60 flex items-center pr-1">
            {labels[ri]}
          </div>
          {keys.map((colKey) => {
            const r = rowKey === colKey ? 1 : correlateArrays(extracted[rowKey], extracted[colKey]);
            const abs = Math.abs(r);
            return (
              <div
                key={`${rowKey}-${colKey}`}
                className={cn(
                  'w-8 h-8 flex items-center justify-center text-[9px] font-mono rounded-sm',
                  rowKey === colKey
                    ? 'bg-muted/60 text-muted-foreground/40'
                    : r > 0.3
                      ? 'bg-pfc-green/10 text-pfc-green'
                      : r < -0.3
                        ? 'bg-pfc-red/10 text-pfc-red'
                        : 'bg-muted/30 text-muted-foreground/40',
                )}
                style={{ opacity: rowKey === colKey ? 0.5 : 0.4 + abs * 0.6 }}
              >
                {r.toFixed(1)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
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
  const signalHistory = usePFCStore((s) => s.signalHistory);
  const setControls = usePFCStore((s) => s.setControls);
  const resetControls = usePFCStore((s) => s.resetControls);
  const reset = usePFCStore((s) => s.reset);

  const anomalies = getAnomalies({ entropy, dissonance, healthScore, riskScore, confidence });

  const handleExport = () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      signals: { confidence, entropy, dissonance, healthScore, riskScore, safetyState },
      tda,
      focus: { focusDepth, temperatureScale },
      concepts: { activeConcepts, activeChordProduct, harmonyKeyDistance },
      meta: { queriesProcessed, totalTraces, skillGapsDetected },
      history: signalHistory.slice(-10),
    };
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <h1 className="text-lg font-semibold tracking-tight">Diagnostics</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 text-xs">
              <CopyIcon className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
              <RefreshCwIcon className="h-3.5 w-3.5" />
              Reset
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* Anomaly Alerts */}
        {anomalies.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-pfc-red">
              <AlertTriangleIcon className="h-4 w-4" />
              Active Alerts
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {anomalies.map((a, i) => (
                <motion.div
                  key={a.title}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  custom={i}
                >
                  <Card className={cn(
                    'border-l-[3px]',
                    a.severity === 'critical' ? 'border-l-pfc-red' : 'border-l-pfc-yellow',
                  )}>
                    <CardHeader className="pb-1.5">
                      <CardTitle className="text-xs flex items-center gap-2">
                        <AlertTriangleIcon className={cn(
                          'h-3.5 w-3.5',
                          a.severity === 'critical' ? 'text-pfc-red' : 'text-pfc-yellow',
                        )} />
                        {a.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">{a.description}</p>
                      <p className="text-[10px] text-pfc-ember font-medium">{a.recommendation}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Core Signals with Sparklines */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ActivityIcon className="h-4 w-4" />
            Core Signals
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <TargetIcon className="h-3.5 w-3.5" />
                      Confidence
                    </span>
                    <TrendArrow data={signalHistory.map((h) => h.confidence)} />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <p className={cn('text-3xl font-bold tabular-nums', confidenceColor(confidence))}>
                      {pct(confidence)}%
                    </p>
                    <Sparkline data={signalHistory.map((h) => h.confidence)} color="#22C55E" />
                  </div>
                  <Progress value={pct(confidence)} className={cn('mt-3 h-1.5', confidenceBarClass(confidence))} />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ZapIcon className="h-3.5 w-3.5" />
                      Entropy
                    </span>
                    <TrendArrow data={signalHistory.map((h) => h.entropy)} />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <p className={cn('text-3xl font-bold tabular-nums', entropyColor(entropy))}>
                      {pct(entropy)}%
                    </p>
                    <Sparkline data={signalHistory.map((h) => h.entropy)} color="#EAB308" />
                  </div>
                  <Progress value={pct(entropy)} className={cn('mt-3 h-1.5', entropyBarClass(entropy))} />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BrainIcon className="h-3.5 w-3.5" />
                      Dissonance
                    </span>
                    <TrendArrow data={signalHistory.map((h) => h.dissonance)} />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <p className={cn('text-3xl font-bold tabular-nums', dissonanceColor(dissonance))}>
                      {pct(dissonance)}%
                    </p>
                    <Sparkline data={signalHistory.map((h) => h.dissonance)} color="#EF4444" />
                  </div>
                  <Progress value={pct(dissonance)} className={cn('mt-3 h-1.5', dissonanceBarClass(dissonance))} />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={3}>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <HeartPulseIcon className="h-3.5 w-3.5" />
                      System Health
                    </span>
                    <TrendArrow data={signalHistory.map((h) => h.healthScore)} />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <p className={cn('text-3xl font-bold tabular-nums', confidenceColor(healthScore))}>
                      {pct(healthScore)}%
                    </p>
                    <Sparkline data={signalHistory.map((h) => h.healthScore)} color="#06B6D4" />
                  </div>
                  <Progress value={pct(healthScore)} className={cn('mt-3 h-1.5', confidenceBarClass(healthScore))} />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        <Separator />

        {/* Safety, Correlations & Quick Actions — Bento layout */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={4}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                  Safety Status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge
                  className={cn(
                    'px-4 py-2 text-lg font-bold uppercase tracking-wider',
                    safetyBadgeClass(safetyState),
                  )}
                >
                  {safetyState}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {safetyState === 'green' && 'All systems nominal'}
                  {safetyState === 'yellow' && 'Minor concerns detected'}
                  {safetyState === 'orange' && 'Elevated risk level'}
                  {safetyState === 'red' && 'Critical alert active'}
                </p>
                <div className="pt-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Risk Score</p>
                  <p className={cn(
                    'text-2xl font-bold tabular-nums',
                    riskScore < 0.3 ? 'text-pfc-green' : riskScore < 0.6 ? 'text-pfc-yellow' : 'text-pfc-red',
                  )}>
                    {pct(riskScore)}%
                  </p>
                  <Progress value={pct(riskScore)} className={cn('mt-2 h-1.5', riskBarClass(riskScore))} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={5}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <ActivityIcon className="h-3.5 w-3.5" />
                  Signal Correlations
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <CorrelationMatrix history={signalHistory} />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={6}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <ZapIcon className="h-3.5 w-3.5" />
                  Quick Actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs h-8"
                  onClick={() => setControls({ focusDepthOverride: 8 })}
                >
                  <SearchIcon className="h-3.5 w-3.5 text-pfc-cyan" />
                  Deep analysis (depth 8)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs h-8"
                  onClick={() => setControls({ adversarialIntensity: 1.8 })}
                >
                  <SwordsIcon className="h-3.5 w-3.5 text-pfc-red" />
                  Stress test (1.8x intensity)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs h-8"
                  onClick={resetControls}
                >
                  <RotateCcwIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  Reset all controls
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs h-8"
                  onClick={handleExport}
                >
                  <CopyIcon className="h-3.5 w-3.5 text-pfc-violet" />
                  Copy signal snapshot
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        <Separator />

        {/* TDA Topology */}
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
                custom={7 + i}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">{item.label}</CardDescription>
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

        {/* Focus & Temperature */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ThermometerIcon className="h-4 w-4" />
            Focus & Temperature
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={11}>
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
                  <span className="text-xs text-muted-foreground">Current analytical depth level</span>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={12}>
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
                  <span className="text-xs text-muted-foreground">Sampling temperature multiplier</span>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        <Separator />

        {/* Concept Chords */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ActivityIcon className="h-4 w-4" />
            Concept Chords
          </h2>

          <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={13}>
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
                    <span className="text-sm text-muted-foreground">No active concepts</span>
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

        {/* Meta Statistics */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <GaugeIcon className="h-4 w-4" />
            Meta Statistics
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {([
              { label: 'Queries Processed', value: queriesProcessed, icon: ZapIcon, color: 'text-pfc-green' },
              { label: 'Total Traces', value: totalTraces, icon: ActivityIcon, color: 'text-pfc-violet' },
              { label: 'Skill Gaps Detected', value: skillGapsDetected, icon: TargetIcon, color: 'text-pfc-ember' },
            ] as const).map((stat, i) => (
              <motion.div
                key={stat.label}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                custom={14 + i}
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
