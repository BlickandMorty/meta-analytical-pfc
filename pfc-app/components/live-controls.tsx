'use client';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  RotateCcwIcon,
  TargetIcon,
  ThermometerIcon,
  BrainCircuitIcon,
  SwordsIcon,
  ScaleIcon,
} from 'lucide-react';

interface ControlRowProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  autoEnabled: boolean;
  onAutoToggle: () => void;
  onChange: (v: number) => void;
  color?: string;
}

function ControlRow({
  label,
  icon,
  value,
  min,
  max,
  step,
  displayValue,
  autoEnabled,
  onAutoToggle,
  onChange,
  color = 'text-pfc-ember',
}: ControlRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('h-4 w-4', color)}>{icon}</span>
          <span className="text-[11px] font-medium text-foreground/80">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground/70">
            {autoEnabled ? 'Auto' : displayValue}
          </span>
          <Switch
            checked={!autoEnabled}
            onCheckedChange={onAutoToggle}
            className="h-4 w-7 data-[state=checked]:bg-pfc-violet"
          />
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        disabled={autoEnabled}
        className={cn(
          'h-1.5',
          autoEnabled && 'opacity-30 pointer-events-none',
        )}
      />
    </div>
  );
}

export function LiveControls() {
  const open = usePFCStore((s) => s.liveControlsOpen);
  const controls = usePFCStore((s) => s.controls);
  const setControls = usePFCStore((s) => s.setControls);
  const resetControls = usePFCStore((s) => s.resetControls);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="overflow-hidden"
        >
          <div className="mx-auto max-w-3xl px-4 pb-3">
            <div className="rounded-2xl p-4 space-y-4 border border-border/15" style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(80px) saturate(2.2)', WebkitBackdropFilter: 'blur(80px) saturate(2.2)', boxShadow: 'var(--shadow-s)' }}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuitIcon className="h-3.5 w-3.5 text-pfc-violet" />
                  <span className="text-xs font-semibold tracking-tight">Live Controls</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={resetControls}
                >
                  <RotateCcwIcon className="h-3 w-3" />
                  Reset
                </Button>
              </div>

              {/* Slider grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <ControlRow
                  label="Focus Depth"
                  icon={<TargetIcon className="h-4 w-4" />}
                  value={controls.focusDepthOverride ?? 5}
                  min={2}
                  max={10}
                  step={1}
                  displayValue={String(controls.focusDepthOverride ?? 5)}
                  autoEnabled={controls.focusDepthOverride === null}
                  onAutoToggle={() =>
                    setControls({
                      focusDepthOverride: controls.focusDepthOverride === null ? 5 : null,
                    })
                  }
                  onChange={(v) => setControls({ focusDepthOverride: v })}
                  color="text-pfc-cyan"
                />

                <ControlRow
                  label="Temperature"
                  icon={<ThermometerIcon className="h-4 w-4" />}
                  value={controls.temperatureOverride ?? 1.0}
                  min={0.3}
                  max={1.5}
                  step={0.1}
                  displayValue={(controls.temperatureOverride ?? 1.0).toFixed(1)}
                  autoEnabled={controls.temperatureOverride === null}
                  onAutoToggle={() =>
                    setControls({
                      temperatureOverride: controls.temperatureOverride === null ? 1.0 : null,
                    })
                  }
                  onChange={(v) => setControls({ temperatureOverride: v })}
                  color="text-pfc-ember"
                />

                <ControlRow
                  label="Complexity Bias"
                  icon={<BrainCircuitIcon className="h-4 w-4" />}
                  value={controls.complexityBias}
                  min={-0.3}
                  max={0.3}
                  step={0.05}
                  displayValue={`${controls.complexityBias > 0 ? '+' : ''}${(controls.complexityBias * 100).toFixed(0)}%`}
                  autoEnabled={false}
                  onAutoToggle={() => setControls({ complexityBias: 0 })}
                  onChange={(v) => setControls({ complexityBias: v })}
                  color="text-pfc-violet"
                />

                <ControlRow
                  label="Adversarial Intensity"
                  icon={<SwordsIcon className="h-4 w-4" />}
                  value={controls.adversarialIntensity}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  displayValue={`${controls.adversarialIntensity.toFixed(1)}x`}
                  autoEnabled={false}
                  onAutoToggle={() => setControls({ adversarialIntensity: 1.0 })}
                  onChange={(v) => setControls({ adversarialIntensity: v })}
                  color="text-pfc-red"
                />

                <ControlRow
                  label="Bayesian Prior Strength"
                  icon={<ScaleIcon className="h-4 w-4" />}
                  value={controls.bayesianPriorStrength}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  displayValue={`${controls.bayesianPriorStrength.toFixed(1)}x`}
                  autoEnabled={false}
                  onAutoToggle={() => setControls({ bayesianPriorStrength: 1.0 })}
                  onChange={(v) => setControls({ bayesianPriorStrength: v })}
                  color="text-pfc-green"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
