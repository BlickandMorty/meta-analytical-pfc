'use client';

import { useEffect } from 'react';
import {
  SettingsIcon,
  Trash2Icon,
  BookOpenIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { readString } from '@/lib/storage-versioning';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import type { InferenceMode, ApiProvider } from '@/lib/engine/llm/config';
import { Button } from '@/components/ui/button';
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
import { PageShell, GlassSection } from '@/components/layout/page-shell';
import { PixelBook } from '@/components/decorative/pixel-mascots';

import { InferenceSection } from './sections/inference-section';
import { SOARSection } from './sections/soar-section';
import { AppearanceSection } from './sections/appearance-section';
import { ExportSection } from './sections/export-section';

export default function SettingsPage() {
  const ready = useSetupGuard();
  const router = useRouter();

  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const setInferenceMode = usePFCStore((s) => s.setInferenceMode);
  const apiKey = usePFCStore((s) => s.apiKey);
  const setApiKey = usePFCStore((s) => s.setApiKey);
  const setApiProvider = usePFCStore((s) => s.setApiProvider);
  const setOllamaBaseUrl = usePFCStore((s) => s.setOllamaBaseUrl);
  const setOllamaModel = usePFCStore((s) => s.setOllamaModel);
  const reset = usePFCStore((s) => s.reset);

  useEffect(() => {
    // Load stored settings on mount
    const storedKey = readString('pfc-api-key') || '';
    if (storedKey && !apiKey) setApiKey(storedKey);
    const storedMode = readString('pfc-inference-mode') as InferenceMode;
    if (storedMode && storedMode !== inferenceMode) setInferenceMode(storedMode);
    const storedProvider = readString('pfc-api-provider') as ApiProvider;
    if (storedProvider) setApiProvider(storedProvider);
    const storedOllamaUrl = readString('pfc-ollama-url');
    if (storedOllamaUrl) setOllamaBaseUrl(storedOllamaUrl);
    const storedOllamaModel = readString('pfc-ollama-model');
    if (storedOllamaModel) setOllamaModel(storedOllamaModel);
    // SAFETY: One-time mount hydration from localStorage. All setters are stable
    // Zustand actions. Re-running would overwrite user changes made after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    localStorage.clear();
    reset();
    router.push('/onboarding');
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell icon={SettingsIcon} iconColor="var(--color-pfc-ember)" title="Settings" subtitle="Configure inference, appearance, and system options">
      <div className="space-y-6">
        <InferenceSection />
        <SOARSection />
        <AppearanceSection />

        {/* Documentation */}
        <GlassSection title="Documentation">
          <p className="text-sm text-muted-foreground/60 mb-3">Reference guides for the PFC system — brain circuits, pipeline architecture, and features.</p>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => router.push('/docs')}>
            <BookOpenIcon className="h-3.5 w-3.5" />
            Open Documentation
          </Button>
        </GlassSection>

        <ExportSection />

        {/* Reset */}
        <GlassSection title="Reset">
          <p className="text-sm text-muted-foreground/60 mb-5">Clear all data and return to onboarding. This cannot be undone.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5 rounded-full"><Trash2Icon className="h-3.5 w-3.5" />Reset Everything</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>This will clear all data, history, and settings.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Yes, reset everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </GlassSection>

      </div>
    </PageShell>
  );
}
