'use client';

import { useEffect, useMemo } from 'react';
import { useSteeringStore } from '@/lib/store/use-steering-store';
import { projectPCA } from '@/lib/engine/steering/engine';
import { getMemoryStats } from '@/lib/engine/steering/memory';
import { DIMENSION_LABELS } from '@/lib/engine/steering/encoder';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CompassIcon,
  ArrowLeftIcon,
  DownloadIcon,
  UploadIcon,
  TrashIcon,
  PowerIcon,
  BrainCircuitIcon,
  TrendingUpIcon,
  BarChart3Icon,
  ScatterChartIcon,
  GaugeIcon,
} from 'lucide-react';
import Link from 'next/link';

export default function SteeringLabPage() {
  const memory = useSteeringStore((s) => s.memory);
  const config = useSteeringStore((s) => s.config);
  const currentBias = useSteeringStore((s) => s.currentBias);
  const stats = useSteeringStore((s) => s.stats);
  const loadFromStorage = useSteeringStore((s) => s.loadFromStorage);
  const isLoaded = useSteeringStore((s) => s.isLoaded);
  const toggleSteering = useSteeringStore((s) => s.toggleSteering);
  const setMasterStrength = useSteeringStore((s) => s.setMasterStrength);
  const resetMemory = useSteeringStore((s) => s.resetMemory);
  const exportJSON = useSteeringStore((s) => s.exportJSON);
  const importJSON = useSteeringStore((s) => s.importJSON);

  useEffect(() => {
    if (!isLoaded) loadFromStorage();
  }, [isLoaded, loadFromStorage]);

  // PCA projection
  const pca = useMemo(() => projectPCA(memory), [memory]);

  // Bayesian prior data for chart
  const priorData = useMemo(() => {
    const labels = DIMENSION_LABELS.slice(0, 14); // Only continuous dims
    return labels.map(label => {
      const prior = memory.priors.dimensions[label];
      return {
        label,
        mean: prior?.mean ?? 0.5,
        variance: prior?.variance ?? 0.05,
        sampleCount: prior?.sampleCount ?? 0,
        confidence: prior ? Math.max(0, 1 - prior.variance * 20) : 0,
      };
    });
  }, [memory.priors]);

  // Current bias values for bar chart
  const biasEntries = useMemo(() => [
    { label: 'Confidence', value: currentBias.confidence, color: 'text-pfc-green' },
    { label: 'Entropy', value: currentBias.entropy, color: 'text-pfc-yellow' },
    { label: 'Dissonance', value: currentBias.dissonance, color: 'text-pfc-red' },
    { label: 'Health', value: currentBias.healthScore, color: 'text-pfc-cyan' },
    { label: 'Risk', value: currentBias.riskScore, color: 'text-pfc-ember' },
    { label: 'Focus Depth', value: currentBias.focusDepth, color: 'text-pfc-violet' },
    { label: 'Temperature', value: currentBias.temperatureScale, color: 'text-muted-foreground' },
  ], [currentBias]);

  const handleExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pfc-steering-memory-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const success = importJSON(text);
      if (!success) alert('Invalid steering memory file');
    };
    input.click();
  };

  const strengthPct = Math.round(currentBias.steeringStrength * 100);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pfc-violet/10 text-pfc-violet">
              <CompassIcon className="h-3.5 w-3.5" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Steering Lab</h1>
          </div>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {stats.totalExemplars} exemplars
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={handleExport}>
            <DownloadIcon className="h-3 w-3" /> Export
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={handleImport}>
            <UploadIcon className="h-3 w-3" /> Import
          </Button>
          <Button
            variant={config.enabled ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={toggleSteering}
          >
            <PowerIcon className="h-3 w-3" />
            {config.enabled ? 'Active' : 'Off'}
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {stats.totalExemplars === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="h-16 w-16 rounded-2xl bg-pfc-violet/10 flex items-center justify-center mb-4">
              <BrainCircuitIcon className="h-8 w-8 text-pfc-violet/50" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight mb-1">No Steering Data Yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Submit queries in the chat to start building your steering memory.
              The engine learns from each analysis — rate results with 👍/👎 for faster adaptation.
            </p>
            <p className="text-xs text-muted-foreground/50 mt-3">
              Steering activates after 3+ exemplars • Full strength at 20+
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── Hero Stats ── */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Steering Strength"
                value={`${strengthPct}%`}
                icon={<GaugeIcon className="h-3.5 w-3.5" />}
                color={strengthPct > 50 ? 'text-pfc-green' : strengthPct > 10 ? 'text-pfc-yellow' : 'text-muted-foreground'}
              />
              <StatCard
                label="Exemplars"
                value={stats.totalExemplars.toString()}
                icon={<ScatterChartIcon className="h-3.5 w-3.5" />}
                color="text-pfc-violet"
                sub={`${stats.positiveCount}↑ ${stats.negativeCount}↓ ${stats.neutralCount}~`}
              />
              <StatCard
                label="User Rated"
                value={stats.userRatedCount.toString()}
                icon={<TrendingUpIcon className="h-3.5 w-3.5" />}
                color="text-pfc-cyan"
                sub={`of ${stats.totalExemplars}`}
              />
              <StatCard
                label="Domains"
                value={stats.uniqueDomains.length.toString()}
                icon={<BarChart3Icon className="h-3.5 w-3.5" />}
                color="text-pfc-ember"
                sub={stats.uniqueDomains.slice(0, 3).join(', ')}
              />
            </div>

            {/* ── PCA Scatter Plot ── */}
            <div className="rounded-xl border bg-card/50 p-4">
              <h3 className="text-sm font-semibold tracking-tight mb-3 flex items-center gap-2">
                <ScatterChartIcon className="h-4 w-4 text-pfc-violet" />
                Synthesis Key Space (PCA)
              </h3>
              {pca ? (
                <div className="relative">
                  <svg viewBox="-3 -3 6 6" className="w-full h-[280px]" preserveAspectRatio="xMidYMid meet">
                    {/* Grid */}
                    <line x1="-3" y1="0" x2="3" y2="0" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.02" />
                    <line x1="0" y1="-3" x2="0" y2="3" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.02" />

                    {/* Steering direction arrow */}
                    {pca.steeringArrow && (
                      <line
                        x1="0" y1="0"
                        x2={pca.steeringArrow.dx * 2}
                        y2={pca.steeringArrow.dy * 2}
                        stroke="var(--color-pfc-violet)"
                        strokeWidth="0.04"
                        markerEnd="url(#arrow)"
                        opacity="0.7"
                      />
                    )}
                    <defs>
                      <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-pfc-violet)" opacity="0.7" />
                      </marker>
                    </defs>

                    {/* Points */}
                    {pca.points.map((pt) => (
                      <circle
                        key={pt.id}
                        cx={pt.x}
                        cy={pt.y}
                        r={0.08}
                        fill={pt.score > 0.3 ? 'var(--color-pfc-green)' : pt.score < -0.3 ? 'var(--color-pfc-red)' : 'var(--color-pfc-yellow)'}
                        opacity={0.7}
                      />
                    ))}
                  </svg>
                  <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-1">
                    <span>PC1 ({(pca.varianceExplained[0] * 100).toFixed(0)}%)</span>
                    <span>PC2 ({(pca.varianceExplained[1] * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pfc-green" /> Positive</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pfc-yellow" /> Neutral</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pfc-red" /> Negative</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 bg-pfc-violet" style={{ width: 12, height: 2 }} /> Steering</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Need 3+ exemplars for PCA projection</p>
              )}
            </div>

            {/* ── Bayesian Priors ── */}
            <div className="rounded-xl border bg-card/50 p-4">
              <h3 className="text-sm font-semibold tracking-tight mb-3 flex items-center gap-2">
                <BarChart3Icon className="h-4 w-4 text-pfc-cyan" />
                Bayesian Prior Distributions
              </h3>
              <div className="space-y-2">
                {priorData.map(({ label, mean, confidence, sampleCount }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-[100px] truncate font-mono">{label}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden relative">
                      {/* Mean indicator */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-pfc-violet"
                        style={{ left: `${mean * 100}%` }}
                      />
                      {/* Confidence fill (centered around 0.5, grows toward mean) */}
                      {sampleCount > 0 && (
                        <div
                          className={cn(
                            'absolute top-0 h-full rounded-full',
                            mean > 0.5 ? 'bg-pfc-green/30' : 'bg-pfc-red/30',
                          )}
                          style={{
                            left: mean > 0.5 ? '50%' : `${mean * 100}%`,
                            width: `${Math.abs(mean - 0.5) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] tabular-nums text-muted-foreground/60 w-8 text-right">
                      {sampleCount > 0 ? `${(confidence * 100).toFixed(0)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Current Bias Bars ── */}
            <div className="rounded-xl border bg-card/50 p-4">
              <h3 className="text-sm font-semibold tracking-tight mb-3 flex items-center gap-2">
                <TrendingUpIcon className="h-4 w-4 text-pfc-ember" />
                Active Steering Bias
              </h3>
              {currentBias.steeringStrength > 0.01 ? (
                <div className="space-y-2">
                  {biasEntries.map(({ label, value, color }) => {
                    const absPct = Math.min(100, Math.abs(value) * 100 / 0.15);
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-[80px] truncate">{label}</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden relative">
                          <div className="absolute top-0 left-1/2 h-full w-px bg-border" />
                          <div
                            className={cn('absolute top-0 h-full rounded-full', color, 'opacity-40')}
                            style={{
                              left: value >= 0 ? '50%' : `${50 - absPct / 2}%`,
                              width: `${absPct / 2}%`,
                            }}
                          />
                        </div>
                        <span className={cn('text-[9px] tabular-nums w-12 text-right font-mono', color)}>
                          {value >= 0 ? '+' : ''}{value.toFixed(3)}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-[9px] text-muted-foreground/50 mt-2">
                    Source: {currentBias.steeringSource}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">No active bias — need more exemplars</p>
              )}
            </div>

            {/* ── Master Controls ── */}
            <div className="rounded-xl border bg-card/50 p-4">
              <h3 className="text-sm font-semibold tracking-tight mb-3 flex items-center gap-2">
                <GaugeIcon className="h-4 w-4 text-muted-foreground" />
                Controls
              </h3>

              <div className="space-y-4">
                {/* Master strength slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted-foreground">Master Strength</span>
                    <span className="text-xs font-mono tabular-nums text-pfc-violet">{Math.round(config.masterStrength * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(config.masterStrength * 100)}
                    onChange={(e) => setMasterStrength(Number(e.target.value) / 100)}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-pfc-violet"
                  />
                </div>

                {/* Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Steering Engine</span>
                  <Button
                    variant={config.enabled ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={toggleSteering}
                  >
                    <PowerIcon className="h-3 w-3" />
                    {config.enabled ? 'Active' : 'Disabled'}
                  </Button>
                </div>

                {/* Reset */}
                <div className="pt-3 border-t border-border/30">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 text-pfc-red border-pfc-red/20 hover:bg-pfc-red/10"
                    onClick={() => {
                      if (confirm('Reset all steering memory? This cannot be undone.')) {
                        resetMemory();
                      }
                    }}
                  >
                    <TrashIcon className="h-3 w-3" />
                    Reset Steering Memory
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Learning Timeline ── */}
            {memory.exemplars.length > 2 && (
              <div className="lg:col-span-2 rounded-xl border bg-card/50 p-4">
                <h3 className="text-sm font-semibold tracking-tight mb-3">Learning Timeline</h3>
                <div className="h-[100px]">
                  <svg viewBox={`0 0 ${memory.exemplars.length} 2`} className="w-full h-full" preserveAspectRatio="none">
                    {/* Zero line */}
                    <line x1="0" y1="1" x2={memory.exemplars.length} y2="1" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.02" />
                    {/* Score line */}
                    <polyline
                      fill="none"
                      stroke="var(--color-pfc-violet)"
                      strokeWidth="0.04"
                      points={memory.exemplars
                        .map((ex, i) => `${i},${1 - ex.outcome.compositeScore}`)
                        .join(' ')}
                    />
                    {/* Dots */}
                    {memory.exemplars.map((ex, i) => (
                      <circle
                        key={i}
                        cx={i}
                        cy={1 - ex.outcome.compositeScore}
                        r={0.06}
                        fill={ex.outcome.compositeScore > 0.3 ? 'var(--color-pfc-green)' : ex.outcome.compositeScore < -0.3 ? 'var(--color-pfc-red)' : 'var(--color-pfc-yellow)'}
                      />
                    ))}
                  </svg>
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-1">
                  <span>First exemplar</span>
                  <span>Latest</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── StatCard sub-component ──────────────────────────────────────

function StatCard({ label, value, icon, color, sub }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}
