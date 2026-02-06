'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArchiveIcon,
  DownloadIcon,
  Trash2Icon,
  RotateCcwIcon,
  BrainCircuitIcon,
  SaveIcon,
  CalendarIcon,
  ActivityIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { usePFCStore, type CortexSnapshot } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { ThemeToggle } from '@/components/theme-toggle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(v: number) {
  return Math.round(v * 100);
}

function safetyColor(state: string) {
  switch (state) {
    case 'green': return 'bg-pfc-green/15 text-pfc-green border-pfc-green/30';
    case 'yellow': return 'bg-pfc-yellow/15 text-pfc-yellow border-pfc-yellow/30';
    case 'orange': return 'bg-pfc-ember/15 text-pfc-ember border-pfc-ember/30';
    case 'red': return 'bg-pfc-red/15 text-pfc-red border-pfc-red/30';
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Snapshot Card
// ---------------------------------------------------------------------------

function SnapshotCard({
  snapshot,
  onRestore,
  onDelete,
}: {
  snapshot: CortexSnapshot;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(snapshot.timestamp), { addSuffix: true }); }
    catch { return 'unknown'; }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      layout
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuitIcon className="h-4 w-4 text-pfc-ember" />
              <CardTitle className="text-sm">{snapshot.label}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-[9px] uppercase', safetyColor(snapshot.signals.safetyState))}>
                {snapshot.signals.safetyState}
              </Badge>
              {expanded ? <ChevronUpIcon className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>
          <CardDescription className="text-[10px] flex items-center gap-1.5">
            <CalendarIcon className="h-3 w-3" />
            {timeAgo}
            <span className="mx-1">·</span>
            {snapshot.meta.queriesProcessed} queries
            <span className="mx-1">·</span>
            {snapshot.concepts.activeConcepts.length} concepts
          </CardDescription>
        </CardHeader>

        {/* Quick stats always visible */}
        <CardContent className="pb-2">
          <div className="flex flex-wrap gap-3 text-[10px] font-mono">
            <span className={cn(snapshot.signals.confidence > 0.6 ? 'text-pfc-green' : snapshot.signals.confidence > 0.3 ? 'text-pfc-yellow' : 'text-pfc-red')}>
              Conf {pct(snapshot.signals.confidence)}%
            </span>
            <span className="text-muted-foreground/60">
              Ent {pct(snapshot.signals.entropy)}%
            </span>
            <span className="text-muted-foreground/60">
              Diss {pct(snapshot.signals.dissonance)}%
            </span>
            <span className="text-muted-foreground/60">
              Health {pct(snapshot.signals.healthScore)}%
            </span>
          </div>
        </CardContent>

        {/* Expanded detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0 space-y-3">
                <Separator />

                {/* Concepts */}
                {snapshot.concepts.activeConcepts.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5">Concepts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {snapshot.concepts.activeConcepts.map((c) => (
                        <Badge key={c} variant="secondary" className="text-[9px] bg-pfc-violet/10 text-pfc-violet border-pfc-violet/20">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5">Controls</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <span className="text-muted-foreground">Focus: {snapshot.controls.focusDepthOverride ?? 'Auto'}</span>
                    <span className="text-muted-foreground">Temp: {snapshot.controls.temperatureOverride?.toFixed(1) ?? 'Auto'}</span>
                    <span className="text-muted-foreground">Adversarial: {snapshot.controls.adversarialIntensity.toFixed(1)}x</span>
                    <span className="text-muted-foreground">Bayesian: {snapshot.controls.bayesianPriorStrength.toFixed(1)}x</span>
                    <span className="text-muted-foreground">Mode: {snapshot.inferenceMode}</span>
                  </div>
                </div>

                {/* TDA */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1.5">TDA Topology</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-pfc-violet">
                    <span>B0: {snapshot.tda.betti0}</span>
                    <span>B1: {snapshot.tda.betti1}</span>
                    <span>Pers. Ent: {snapshot.tda.persistenceEntropy.toFixed(3)}</span>
                    <span>Max Pers: {snapshot.tda.maxPersistence.toFixed(3)}</span>
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs flex-1"
                    onClick={() => onRestore(snapshot.id)}
                  >
                    <RotateCcwIcon className="h-3 w-3 text-pfc-ember" />
                    Restore
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs text-pfc-red border-pfc-red/20 hover:bg-pfc-red/5">
                        <Trash2Icon className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete snapshot?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{snapshot.label}&quot;. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(snapshot.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CortexArchivePage() {
  const ready = useSetupGuard();
  const cortexArchive = usePFCStore((s) => s.cortexArchive);
  const saveCortexSnapshot = usePFCStore((s) => s.saveCortexSnapshot);
  const deleteCortexSnapshot = usePFCStore((s) => s.deleteCortexSnapshot);
  const restoreCortexSnapshot = usePFCStore((s) => s.restoreCortexSnapshot);
  const loadCortexFromStorage = usePFCStore((s) => s.loadCortexFromStorage);
  const [newLabel, setNewLabel] = useState('');

  // Load archive from localStorage on mount
  useEffect(() => {
    loadCortexFromStorage();
  }, [loadCortexFromStorage]);

  const handleSave = () => {
    const label = newLabel.trim() || `Snapshot ${new Date().toLocaleString()}`;
    saveCortexSnapshot(label);
    setNewLabel('');
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
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1 -ml-3 hover:bg-muted"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Link>
          <div className="flex items-center gap-2 ml-1">
            <ArchiveIcon className="h-5 w-5 text-pfc-ember" />
            <h1 className="text-lg font-semibold tracking-tight">Cortex Archive</h1>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {/* Save current state */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <SaveIcon className="h-4 w-4 text-pfc-ember" />
              Save Current Brain State
            </CardTitle>
            <CardDescription className="text-xs">
              Capture a snapshot of all signals, concepts, controls, and pipeline settings before resetting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Snapshot label (optional)..."
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <Button onClick={handleSave} className="gap-1.5 shrink-0 bg-pfc-ember hover:bg-pfc-ember/90">
                <DownloadIcon className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Archive list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ActivityIcon className="h-4 w-4" />
              Saved States
            </h2>
            {cortexArchive.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {cortexArchive.length} snapshot{cortexArchive.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {cortexArchive.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ArchiveIcon className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground/50">No saved brain states yet</p>
                <p className="text-xs text-muted-foreground/30 mt-1">Save a snapshot above before resetting to preserve your insights</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {cortexArchive.map((snap) => (
                  <SnapshotCard
                    key={snap.id}
                    snapshot={snap}
                    onRestore={restoreCortexSnapshot}
                    onDelete={deleteCortexSnapshot}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
