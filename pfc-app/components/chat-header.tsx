'use client';

import { usePFCStore, type PFCState } from '@/lib/store/use-pfc-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SparklesIcon,
  ActivityIcon,
  NetworkIcon,
  WifiIcon,
  ServerIcon,
} from 'lucide-react';
import { SteeringIndicator } from './steering-indicator';
import { cn } from '@/lib/utils';

const selectToggleSynthesis = (s: PFCState) => s.toggleSynthesisView;
const selectIsProcessing = (s: PFCState) => s.isProcessing;
const selectActiveStage = (s: PFCState) => s.activeStage;
const selectMessages = (s: PFCState) => s.messages;
const selectToggleConceptHierarchy = (s: PFCState) => s.toggleConceptHierarchy;
const selectConceptWeights = (s: PFCState) => s.conceptWeights;
const selectInferenceMode = (s: PFCState) => s.inferenceMode;
const selectConfidence = (s: PFCState) => s.confidence;

const MODE_STYLES: Record<string, { label: string; color: string }> = {
  simulation: { label: 'Sim', color: 'text-pfc-ember/70 border-pfc-ember/20' },
  api: { label: 'API', color: 'text-pfc-green/70 border-pfc-green/20' },
  local: { label: 'Local', color: 'text-pfc-cyan/70 border-pfc-cyan/20' },
};

export function ChatHeader() {
  const toggleSynthesis = usePFCStore(selectToggleSynthesis);
  const isProcessing = usePFCStore(selectIsProcessing);
  const activeStage = usePFCStore(selectActiveStage);
  const messages = usePFCStore(selectMessages);
  const toggleConceptHierarchy = usePFCStore(selectToggleConceptHierarchy);
  const conceptWeights = usePFCStore(selectConceptWeights);
  const inferenceMode = usePFCStore(selectInferenceMode);
  const confidence = usePFCStore(selectConfidence);
  const conceptCount = Object.keys(conceptWeights).length;

  const hasMessages = messages.some((m) => m.role === 'system');
  const modeInfo = MODE_STYLES[inferenceMode] ?? MODE_STYLES.simulation;

  return (
    <header
      className="flex h-12 items-center justify-between px-4 pl-14 shrink-0"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(80px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(80px) saturate(2.2)',
        boxShadow: 'var(--shadow-s)',
        borderRadius: 'var(--radius-obs-xl)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <h1 className="text-sm font-semibold tracking-tight">
          PFC
          <span className="text-muted-foreground/50 font-normal ml-1.5 hidden sm:inline">
            Meta-Analytical Engine
          </span>
        </h1>

        {/* Mode badge */}
        <div className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-mono',
          modeInfo.color,
        )}>
          {inferenceMode === 'simulation' ? (
            <ServerIcon className="h-2.5 w-2.5" />
          ) : (
            <WifiIcon className="h-2.5 w-2.5" />
          )}
          {modeInfo.label}
        </div>

        {/* Confidence indicator */}
        {confidence > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground/40">
            {(confidence * 100).toFixed(0)}%
          </span>
        )}

        <SteeringIndicator />

        {/* Active stage indicator */}
        {isProcessing && activeStage && (
          <Badge
            variant="secondary"
            className="animate-pipeline-pulse text-[10px] font-mono gap-1.5 bg-pfc-violet/8 border-pfc-violet/15 text-pfc-violet/80 rounded-full"
          >
            <ActivityIcon className="h-3 w-3 text-pfc-violet" />
            {activeStage.replace('_', '-')}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {conceptCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 text-pfc-violet/70 border-pfc-violet/15 hover:bg-pfc-violet/8 rounded-full transition-colors duration-200"
            onClick={toggleConceptHierarchy}
          >
            <NetworkIcon className="h-3 w-3" />
            <span className="hidden sm:inline">Concepts</span>
            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-mono bg-pfc-violet/8 text-pfc-violet rounded-full">
              {conceptCount}
            </Badge>
          </Button>
        )}

        {hasMessages && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 text-pfc-violet/80 border-pfc-violet/20 hover:bg-pfc-violet/8 rounded-full transition-colors duration-200"
            onClick={toggleSynthesis}
          >
            <SparklesIcon className="h-3 w-3" />
            Synthesize
          </Button>
        )}
      </div>
    </header>
  );
}
