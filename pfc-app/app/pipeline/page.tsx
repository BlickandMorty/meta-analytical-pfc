'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  NetworkIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  AlertTriangleIcon,
  ClockIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  STAGES,
  STAGE_LABELS,
  STAGE_DESCRIPTIONS,
} from '@/lib/constants';
import type { StageResult, StageStatus } from '@/lib/engine/types';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { PageShell, GlassSection } from '@/components/page-shell';
import { EducationalTooltipButton } from '@/components/educational-tooltip';
import { PIPELINE_TOOLTIPS } from '@/lib/research/educational-data';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

function StatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2Icon className="h-4 w-4 text-pfc-green" />;
    case 'active':
      return <CircleDotIcon className="h-4 w-4 text-pfc-ember animate-pipeline-pulse" />;
    case 'error':
      return <AlertTriangleIcon className="h-4 w-4 text-pfc-red" />;
    default:
      return <ClockIcon className="h-4 w-4 text-muted-foreground/30" />;
  }
}

function StageRow({ result, index, isDark }: { result: StageResult; index: number; isDark: boolean }) {
  const { stage, status, detail, value } = result;
  const tooltip = PIPELINE_TOOLTIPS[stage];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className={cn(
        'flex items-start gap-4 rounded-2xl p-4 transition-colors',
        status === 'active' && 'bg-pfc-ember/5',
        status === 'complete' && 'bg-pfc-green/3',
        status === 'error' && 'bg-pfc-red/5',
      )}
    >
      {/* Stage number */}
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold',
        status === 'active' && 'bg-pfc-ember/10 text-pfc-ember',
        status === 'complete' && 'bg-pfc-green/10 text-pfc-green',
        status === 'error' && 'bg-pfc-red/10 text-pfc-red',
        status === 'idle' && 'bg-muted/40 text-muted-foreground/40',
      )}>
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-base font-semibold">{STAGE_LABELS[stage]}</p>
              <p className="text-xs text-muted-foreground/50 mt-0.5">{STAGE_DESCRIPTIONS[stage]}</p>
            </div>
            {tooltip && <EducationalTooltipButton tooltip={tooltip} isDark={isDark} position="right" />}
          </div>
          <StatusIcon status={status} />
        </div>

        {detail && (
          <p className="text-xs text-muted-foreground font-mono mt-2 leading-relaxed">
            {detail}
          </p>
        )}

        {typeof value === 'number' && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold">Progress</span>
              <span className="text-[10px] font-mono text-muted-foreground/40">{Math.round(value * 100)}%</span>
            </div>
            <Progress value={value * 100} className="h-1 bg-muted/30" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function PipelinePage() {
  const ready = useSetupGuard();
  const pipelineStages = usePFCStore((s) => s.pipelineStages);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  const completedCount = pipelineStages.filter((s) => s.status === 'complete').length;
  const overallProgress = (completedCount / STAGES.length) * 100;

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <PageShell
      icon={NetworkIcon}
      iconColor="var(--color-pfc-ember)"
      title="Pipeline"
      subtitle="10-stage executive reasoning protocol"
    >
      {/* Progress overview */}
      <GlassSection>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">Overall Progress</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {completedCount}/{STAGES.length}
            </Badge>
            {isProcessing && (
              <Badge className="bg-pfc-ember/15 text-pfc-ember border-0 text-xs">
                Active
              </Badge>
            )}
          </div>
          <span className="text-lg font-bold font-mono text-muted-foreground/50">
            {Math.round(overallProgress)}%
          </span>
        </div>
        <Progress value={overallProgress} className="h-2 bg-muted/30" />
      </GlassSection>

      {/* Stage list */}
      <GlassSection title="Stages">
        <div className="space-y-1">
          <AnimatePresence mode="popLayout">
            {pipelineStages.map((result, i) => (
              <StageRow key={result.stage} result={result} index={i} isDark={isDark} />
            ))}
          </AnimatePresence>
        </div>
      </GlassSection>
    </PageShell>
  );
}
