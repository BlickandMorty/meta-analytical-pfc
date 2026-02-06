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
      return <CheckCircle2Icon className="h-4 w-4 text-pfc-green" />;
    case 'active':
      return (
        <CircleDotIcon className="h-4 w-4 text-pfc-ember animate-pipeline-pulse" />
      );
    case 'error':
      return <AlertTriangleIcon className="h-4 w-4 text-pfc-red" />;
    case 'idle':
    default:
      return <ClockIcon className="h-4 w-4 text-muted-foreground/50" />;
  }
}

// ---------------------------------------------------------------------------
// Mini pipeline progress indicator (header)
// ---------------------------------------------------------------------------

function MiniPipelineIndicator({ stages }: { stages: StageResult[] }) {
  return (
    <div className="hidden sm:flex items-center gap-1">
      {stages.map((s, i) => (
        <div key={s.stage} className="flex items-center">
          <div
            className={cn(
              'h-2 w-2 rounded-full transition-colors duration-300',
              s.status === 'complete' && 'bg-pfc-green',
              s.status === 'active' && 'bg-pfc-ember animate-pipeline-pulse',
              s.status === 'error' && 'bg-pfc-red',
              s.status === 'idle' && 'bg-muted-foreground/20',
            )}
          />
          {i < stages.length - 1 && (
            <div
              className={cn(
                'h-[1px] w-2',
                s.status === 'complete' ? 'bg-pfc-green/40' : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single stage card — polished
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
    >
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-300',
          status === 'active' && 'border-pfc-ember/50 shadow-[0_0_16px_rgba(193,95,60,0.12)]',
          status === 'complete' && 'border-pfc-green/25',
          status === 'error' && 'border-pfc-red/40',
        )}
      >
        {/* Active shimmer overlay */}
        {status === 'active' && (
          <div className="absolute inset-0 animate-shimmer pointer-events-none" />
        )}

        <CardHeader className="pb-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {/* Stage number pill */}
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[11px] font-semibold',
                  status === 'active' && 'bg-pfc-ember/10 text-pfc-ember',
                  status === 'complete' && 'bg-pfc-green/10 text-pfc-green/80',
                  status === 'error' && 'bg-pfc-red/10 text-pfc-red',
                  status === 'idle' && 'bg-muted text-muted-foreground/60',
                )}
              >
                {String(index + 1).padStart(2, '0')}
              </div>
              <div>
                <CardTitle className="text-sm font-medium">
                  {STAGE_LABELS[stage]}
                </CardTitle>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {STAGE_DESCRIPTIONS[stage]}
                </p>
              </div>
            </div>
            <StatusIcon status={status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-2.5 pt-0">
          {detail && (
            <div className="rounded-md bg-muted/40 px-2.5 py-1.5 border border-border/30">
              <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                {detail}
              </p>
            </div>
          )}

          {typeof value === 'number' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
                  Progress
                </span>
                <span className="text-[9px] font-mono text-muted-foreground/60">
                  {Math.round(value * 100)}%
                </span>
              </div>
              <Progress
                value={value * 100}
                className="h-1 bg-muted"
              />
            </div>
          )}
        </CardContent>

        {/* Left-edge accent bar */}
        {(status === 'active' || status === 'complete' || status === 'error') && (
          <span
            className={cn(
              'absolute left-0 top-0 h-full w-[3px] rounded-l-xl',
              status === 'active' && 'bg-pfc-ember',
              status === 'complete' && 'bg-pfc-green',
              status === 'error' && 'bg-pfc-red',
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
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      {/* Subtle dot-grid background */}
      <div className="absolute inset-0 dot-grid-bg pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1 -ml-3 hover:bg-muted"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Link>

          <div className="flex items-center gap-2.5 ml-1">
            <NetworkIcon className="h-5 w-5 text-pfc-ember" />
            <div>
              <h1 className="text-base font-semibold tracking-tight leading-none">Pipeline</h1>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 hidden sm:block">10-stage executive reasoning</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <MiniPipelineIndicator stages={pipelineStages} />
            <Badge variant="outline" className="font-mono text-[10px] h-6">
              {completedCount}/{STAGES.length}
            </Badge>
            {isProcessing && (
              <Badge className="bg-pfc-ember/15 text-pfc-ember border-pfc-ember/30 h-6 text-[10px]">
                <BrainCircuitIcon className="mr-1 h-3 w-3 animate-pipeline-pulse" />
                Active
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mx-auto max-w-5xl px-4 pb-2.5 sm:px-6">
          <Progress value={overallProgress} className="h-1.5 bg-muted" />
        </div>
      </header>

      {/* Stage cards grid */}
      <main className="relative flex-1 overflow-y-auto pb-20">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {pipelineStages.map((result, i) => (
                <StageCard key={result.stage} result={result} index={i} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t bg-background/90 backdrop-blur-md z-20">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BrainCircuitIcon className="h-3 w-3 text-pfc-violet" />
              <span className="font-mono">{queriesProcessed}</span> queries
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="hidden sm:flex items-center gap-1.5">
              Status:
              <span
                className={cn(
                  'font-medium',
                  isProcessing ? 'text-pfc-ember' : 'text-muted-foreground/60'
                )}
              >
                {isProcessing ? 'Active' : 'Idle'}
              </span>
            </span>
          </div>

          <div className={cn(
            'flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border',
            isProcessing
              ? 'text-pfc-ember border-pfc-ember/20 bg-pfc-ember/5'
              : 'text-muted-foreground/60 border-border/40'
          )}>
            <span className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              isProcessing ? 'bg-pfc-ember animate-pipeline-pulse' : 'bg-muted-foreground/30'
            )} />
            {isProcessing ? 'Running' : 'Idle'}
          </div>
        </div>
      </footer>
    </div>
  );
}
