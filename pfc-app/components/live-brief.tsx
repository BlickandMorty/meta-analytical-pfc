'use client';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';

export function LiveBrief() {
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);
  const healthScore = usePFCStore((s) => s.healthScore);
  const safetyState = usePFCStore((s) => s.safetyState);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);

  const signals = [
    { label: 'CONF', value: confidence, color: confidence > 0.6 ? 'text-pfc-green' : confidence > 0.3 ? 'text-pfc-yellow' : 'text-pfc-red' },
    { label: 'ENT', value: entropy, color: entropy < 0.4 ? 'text-pfc-green' : entropy < 0.7 ? 'text-pfc-yellow' : 'text-pfc-red' },
    { label: 'DIS', value: dissonance, color: dissonance < 0.3 ? 'text-pfc-green' : dissonance < 0.6 ? 'text-pfc-yellow' : 'text-pfc-red' },
    { label: 'HP', value: healthScore, color: healthScore > 0.6 ? 'text-pfc-green' : healthScore > 0.3 ? 'text-pfc-yellow' : 'text-pfc-red' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors duration-500',
            safetyState === 'green' ? 'bg-pfc-green' :
            safetyState === 'yellow' ? 'bg-pfc-yellow' : 'bg-pfc-red'
          )}
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/55 font-mono">
          {queriesProcessed} queries
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {signals.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground/50 uppercase">
              {s.label}
            </span>
            <span className={cn('text-[11px] font-mono font-medium transition-colors duration-500', s.color)}>
              {(s.value * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
