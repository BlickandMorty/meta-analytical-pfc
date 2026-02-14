'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuitIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  ZapIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';
import { getSOARLimitations } from '@/lib/engine/soar/types';
import { Switch } from '@/components/ui/switch';
import { GlassSection } from '@/components/layout/page-shell';

export function SOARSection() {
  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const soarConfig = usePFCStore((s) => s.soarConfig);
  const setSOARConfig = usePFCStore((s) => s.setSOARConfig);
  const setSOAREnabled = usePFCStore((s) => s.setSOAREnabled);

  const soarLimitations = getSOARLimitations(inferenceMode);

  return (
    <GlassSection title="SOAR Meta-Reasoning">
      <p className="text-sm text-muted-foreground/60 mb-5">
        Self-Organized Analytical Reasoning. When queries hit the edge of learnability, SOAR generates a curriculum of stepping-stone problems to build reasoning scaffolding before re-attacking the hard problem.
      </p>

      {/* Master toggle */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-pfc-cyan/10">
            <BrainCircuitIcon className="h-4 w-4 text-pfc-cyan" />
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5625rem', fontWeight: 500 }}>Enable SOAR</p>
            <p className="text-xs text-muted-foreground/50">Teacher-student meta-reasoning loop</p>
          </div>
        </div>
        <Switch
          checked={soarConfig.enabled}
          onCheckedChange={(v) => setSOAREnabled(!!v)}
          activeColor="var(--color-pfc-cyan)"
        />
      </div>

      <AnimatePresence>
        {soarConfig.enabled && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-5 pt-4 border-t border-border/20" style={{ overflow: 'hidden', transform: 'translateZ(0)' }}>

            {/* Mode-specific limitations panel */}
            <div className={cn(
              'rounded-2xl p-4 space-y-3',
              inferenceMode === 'local' ? 'bg-pfc-green/5' :
              'bg-pfc-violet/5',
            )}>
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 text-pfc-yellow" />
                <span className="text-sm font-semibold">
                  {inferenceMode === 'local' ? 'Local Mode' : 'API Mode'} — SOAR Characteristics
                </span>
              </div>

              {/* Advantages */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheckIcon className="h-3 w-3 text-pfc-green" />
                  <span className="text-xs font-semibold text-pfc-green">Advantages</span>
                </div>
                {soarLimitations.advantages.map((adv, i) => (
                  <p key={i} className="text-xs text-muted-foreground/70 pl-4.5 leading-relaxed">{adv}</p>
                ))}
              </div>

              {/* Limitations */}
              <div className="space-y-1.5 pt-2 border-t border-border/10">
                <div className="flex items-center gap-1.5">
                  <AlertTriangleIcon className="h-3 w-3 text-pfc-yellow" />
                  <span className="text-xs font-semibold text-pfc-yellow">Limitations</span>
                </div>
                {soarLimitations.limitations.map((lim, i) => (
                  <p key={i} className="text-xs text-muted-foreground/70 pl-4.5 leading-relaxed">{lim}</p>
                ))}
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/10">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground/80">{soarLimitations.maxIterations}</p>
                  <p className="text-[10px] text-muted-foreground/50">Max Iterations</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground/80">{soarLimitations.maxStonesPerCurriculum}</p>
                  <p className="text-[10px] text-muted-foreground/50">Stones/Curriculum</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-semibold text-foreground/80">{soarLimitations.estimatedCostPerIteration}</p>
                  <p className="text-[10px] text-muted-foreground/50">Cost/Iteration</p>
                </div>
              </div>
            </div>

            {/* Auto-detect toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SearchIcon className="h-4 w-4 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-semibold">Auto-detect Edge of Learnability</p>
                  <p className="text-xs text-muted-foreground/50">Automatically probe query difficulty before engaging SOAR</p>
                </div>
              </div>
              <Switch
                checked={soarConfig.autoDetect}
                onCheckedChange={(v) => setSOARConfig({ autoDetect: !!v })}
                activeColor="var(--color-pfc-cyan)"
              />
            </div>

            {/* Contradiction detection toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ZapIcon className="h-4 w-4 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-semibold">OOLONG Contradiction Detection</p>
                  <p className="text-xs text-muted-foreground/50">O(n&sup2;) cross-reference of claims to surface hidden contradictions</p>
                </div>
              </div>
              <Switch
                checked={soarConfig.contradictionDetection}
                onCheckedChange={(v) => setSOARConfig({ contradictionDetection: !!v })}
                activeColor="var(--color-pfc-cyan)"
              />
            </div>

            {/* Numerical config */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/20">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Max Iterations</label>
                <select
                  value={soarConfig.maxIterations}
                  onChange={(e) => setSOARConfig({ maxIterations: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border/30 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pfc-cyan/50"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n} disabled={n > soarLimitations.maxIterations}>
                      {n}{n > soarLimitations.maxIterations ? ` (exceeds ${inferenceMode} limit)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Stones per Curriculum</label>
                <select
                  value={soarConfig.stonesPerCurriculum}
                  onChange={(e) => setSOARConfig({ stonesPerCurriculum: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border/30 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pfc-cyan/50"
                >
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n} disabled={n > soarLimitations.maxStonesPerCurriculum}>
                      {n}{n > soarLimitations.maxStonesPerCurriculum ? ` (exceeds ${inferenceMode} limit)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Verbose toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-border/20">
              <div className="flex items-center gap-3">
                <SlidersHorizontalIcon className="h-4 w-4 text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-semibold">Verbose Logging</p>
                  <p className="text-xs text-muted-foreground/50">Show detailed SOAR progress in pipeline view</p>
                </div>
              </div>
              <Switch
                checked={soarConfig.verbose}
                onCheckedChange={(v) => setSOARConfig({ verbose: !!v })}
                activeColor="var(--color-pfc-cyan)"
              />
            </div>

            {/* Learning persistence note */}
            <div className="rounded-xl bg-muted/20 p-3 text-xs text-muted-foreground/50 leading-relaxed">
              <span className="font-semibold text-foreground/60">Learning persistence: </span>
              {soarLimitations.learningPersistence === 'in-context' && 'In-context only — the model improves within a single conversation but forgets between sessions. This is prompt-engineering, not true learning.'}
              {soarLimitations.learningPersistence === 'session' && 'Session-level — accumulated reasoning context persists across SOAR iterations within a session but resets between sessions.'}
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </GlassSection>
  );
}
