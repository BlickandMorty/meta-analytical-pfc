'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  NetworkIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  AlertTriangleIcon,
  ClockIcon,
  BrainCircuitIcon,
  ArrowLeftIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  STAGES,
  STAGE_LABELS,
  STAGE_DESCRIPTIONS,
  type PipelineStage,
} from '@/lib/constants';
import type { StageResult, StageStatus } from '@/lib/engine/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { ThemeToggle } from '@/components/theme-toggle';

// ---------------------------------------------------------------------------
// Status icon helper
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2Icon className="h-5 w-5 text-[#22C55E]" />;
    case 'active':
      return (
        <CircleDotIcon className="h-5 w-5 text-[#C15F3C] animate-pipeline-pulse" />
      );
    case 'error':
      return <AlertTriangleIcon className="h-5 w-5 text-[#EF4444]" />;
    case 'idle':
    default:
      return <ClockIcon className="h-5 w-5 text-muted-foreground" />;
  }
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: StageStatus }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  switch (status) {
    case 'complete':
      return (
        <Badge className="bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/25">
          {label}
        </Badge>
      );
    case 'active':
      return (
        <Badge className="bg-[#C15F3C]/15 text-[#C15F3C] border-[#C15F3C]/30 hover:bg-[#C15F3C]/25">
          {label}
        </Badge>
      );
    case 'error':
      return <Badge variant="destructive">{label}</Badge>;
    case 'idle':
    default:
      return <Badge variant="secondary">{label}</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Single stage card
// ---------------------------------------------------------------------------

function StageCard({
  result,
  index,
}: {
  result: StageResult;
  index: number;
}) {
  const { stage, status, detail, value } = result;

  return (
    <motion.div
      key={stage}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Card
        className={cn(
          'relative overflow-hidden transition-colors',
          status === 'active' && 'border-[#C15F3C]/50 shadow-[0_0_12px_rgba(193,95,60,0.15)]',
          status === 'complete' && 'border-[#22C55E]/30',
          status === 'error' && 'border-[#EF4444]/40'
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <StatusIcon status={status} />
              <div>
                <CardTitle className="text-base">
                  <span className={cn(
                    'font-mono mr-1.5 text-[13px]',
                    status === 'active' ? 'text-[#C15F3C]' :
                    status === 'complete' ? 'text-[#22C55E]/70' :
                    'text-muted-foreground'
                  )}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {STAGE_LABELS[stage]}
                </CardTitle>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {STAGE_DESCRIPTIONS[stage]}
          </p>

          {detail && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {detail}
              </p>
            </div>
          )}

          {typeof value === 'number' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Progress
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {Math.round(value * 100)}%
                </span>
              </div>
              <Progress
                value={value * 100}
                className="h-1.5 bg-muted"
              />
            </div>
          )}
        </CardContent>

        {/* Subtle left-edge accent bar for active / complete */}
        {(status === 'active' || status === 'complete' || status === 'error') && (
          <span
            className={cn(
              'absolute left-0 top-0 h-full w-1 rounded-l-xl',
              status === 'active' && 'bg-[#C15F3C]',
              status === 'complete' && 'bg-[#22C55E]',
              status === 'error' && 'bg-[#EF4444]'
            )}
          />
        )}
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline page
// ---------------------------------------------------------------------------

export default function PipelinePage() {
  const ready = useSetupGuard();
  const pipelineStages = usePFCStore((s) => s.pipelineStages);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);

  const completedCount = pipelineStages.filter(
    (s) => s.status === 'complete'
  ).length;
  const overallProgress = (completedCount / STAGES.length) * 100;

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1 -ml-3 hover:bg-muted"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Link>

          <div className="flex flex-col gap-0.5 ml-1">
            <div className="flex items-center gap-2">
              <NetworkIcon className="h-5 w-5 text-[#C15F3C]" />
              <h1 className="text-lg font-semibold tracking-tight">Pipeline</h1>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block ml-7">10-stage executive reasoning pipeline</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-xs">
              {completedCount}/{STAGES.length} stages
            </Badge>
            {isProcessing && (
              <Badge className="bg-[#C15F3C]/15 text-[#C15F3C] border-[#C15F3C]/30">
                <BrainCircuitIcon className="mr-1 h-3 w-3 animate-pipeline-pulse" />
                Processing
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Overall completion
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {Math.round(overallProgress)}%
              </span>
            </div>
            <Progress value={overallProgress} className="h-2 bg-muted" />
            {pipelineStages.find(s => s.status === 'active') && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Currently processing: <span className="text-[#C15F3C] font-medium">{STAGE_LABELS[pipelineStages.find(s => s.status === 'active')!.stage]}</span>
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Stage cards grid                                                  */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {pipelineStages.map((result, i) => (
                <StageCard key={result.stage} result={result} index={i} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* Footer metadata                                                   */}
      {/* ----------------------------------------------------------------- */}
      <footer className="border-t bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BrainCircuitIcon className="h-3.5 w-3.5 text-[#6B5CE7]" />
              Queries processed:
              <span className="font-mono font-medium text-foreground">
                {queriesProcessed}
              </span>
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="hidden sm:flex items-center gap-1.5">
              Status:
              <span
                className={cn(
                  'font-medium',
                  isProcessing ? 'text-[#C15F3C]' : 'text-muted-foreground'
                )}
              >
                {isProcessing ? 'Active' : 'Idle'}
              </span>
            </span>
          </div>

          <div className={cn(
            'flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border',
            isProcessing
              ? 'text-[#C15F3C] border-[#C15F3C]/20 bg-[#C15F3C]/5'
              : 'text-muted-foreground border-border/50'
          )}>
            <span className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              isProcessing ? 'bg-[#C15F3C] animate-pipeline-pulse' : 'bg-muted-foreground/40'
            )} />
            {isProcessing ? 'Pipeline running' : 'Pipeline idle'}
          </div>
        </div>
      </footer>
    </div>
  );
}
