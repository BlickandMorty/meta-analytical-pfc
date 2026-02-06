'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  SettingsIcon,
  BrainCircuitIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  Trash2Icon,
  ServerIcon,
  CpuIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const },
  }),
};

export default function SettingsPage() {
  const ready = useSetupGuard();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const setInferenceMode = usePFCStore((s) => s.setInferenceMode);
  const reset = usePFCStore((s) => s.reset);
  const [mounted, setMounted] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('pfc-api-key') || '';
    setApiKey(stored);
  }, []);

  const handleModeChange = (mode: 'hybrid' | 'local') => {
    setInferenceMode(mode);
    localStorage.setItem('pfc-inference-mode', mode);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem('pfc-api-key', value);
  };

  const handleReset = () => {
    localStorage.clear();
    reset();
    router.push('/onboarding');
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
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1 -ml-3 hover:bg-muted"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Link>
          <div className="flex items-center gap-2 ml-1">
            <SettingsIcon className="h-5 w-5 text-pfc-ember" />
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        {/* Inference Mode */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BrainCircuitIcon className="h-4 w-4 text-pfc-ember" />
                Inference Mode
              </CardTitle>
              <CardDescription className="text-xs">
                Choose how PFC processes queries. Simulation uses the built-in engine; API mode connects to an external LLM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleModeChange('hybrid')}
                  className={cn(
                    'relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-200 cursor-pointer',
                    inferenceMode === 'hybrid'
                      ? 'border-pfc-ember/50 bg-pfc-ember/5 shadow-sm'
                      : 'border-border/50 hover:border-border hover:bg-muted/30'
                  )}
                >
                  <CpuIcon className={cn('h-5 w-5', inferenceMode === 'hybrid' ? 'text-pfc-ember' : 'text-muted-foreground')} />
                  <span className={cn('text-sm font-medium', inferenceMode === 'hybrid' ? 'text-foreground' : 'text-muted-foreground')}>
                    Simulation
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">Built-in engine</span>
                  {inferenceMode === 'hybrid' && (
                    <Badge className="absolute -top-2 -right-2 bg-pfc-ember text-white text-[9px] px-1.5 py-0">
                      Active
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => handleModeChange('local')}
                  className={cn(
                    'relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-200 cursor-pointer',
                    inferenceMode === 'local'
                      ? 'border-pfc-violet/50 bg-pfc-violet/5 shadow-sm'
                      : 'border-border/50 hover:border-border hover:bg-muted/30'
                  )}
                >
                  <ServerIcon className={cn('h-5 w-5', inferenceMode === 'local' ? 'text-pfc-violet' : 'text-muted-foreground')} />
                  <span className={cn('text-sm font-medium', inferenceMode === 'local' ? 'text-foreground' : 'text-muted-foreground')}>
                    API Mode
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">External LLM</span>
                  {inferenceMode === 'local' && (
                    <Badge className="absolute -top-2 -right-2 bg-pfc-violet text-white text-[9px] px-1.5 py-0">
                      Active
                    </Badge>
                  )}
                </button>
              </div>

              {inferenceMode === 'local' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 pt-2"
                >
                  <label className="text-xs font-medium text-muted-foreground">API Key</label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground/60">
                    Stored locally in your browser. Never sent to our servers.
                  </p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <Separator />

        {/* Theme */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <SunIcon className="h-4 w-4 text-pfc-yellow" />
                Appearance
              </CardTitle>
              <CardDescription className="text-xs">
                Choose your preferred color theme.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'light', label: 'Light', Icon: SunIcon },
                  { value: 'dark', label: 'Dark', Icon: MoonIcon },
                  { value: 'system', label: 'System', Icon: MonitorIcon },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer',
                      mounted && theme === value
                        ? 'border-pfc-ember/50 bg-pfc-ember/5 shadow-sm'
                        : 'border-border/50 hover:border-border hover:bg-muted/30'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', mounted && theme === value ? 'text-pfc-ember' : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-medium', mounted && theme === value ? 'text-foreground' : 'text-muted-foreground')}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Separator />

        {/* Reset */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Trash2Icon className="h-4 w-4 text-pfc-red" />
                Reset
              </CardTitle>
              <CardDescription className="text-xs">
                Clear all data and return to onboarding. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <Trash2Icon className="h-3.5 w-3.5" />
                    Reset Everything
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all your data, chat history, and settings. You will be returned to the onboarding screen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset}>
                      Yes, reset everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </motion.div>

        <Separator />

        {/* About */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={3}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">v2.0.0</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Engine</span>
                <span className="font-mono">Meta-Analytical PFC</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pipeline</span>
                <span className="font-mono">10-stage executive reasoning</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
