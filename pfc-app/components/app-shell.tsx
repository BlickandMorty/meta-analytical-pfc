'use client';

import { useEffect, useState } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { TopNav } from './top-nav';
import type { InferenceMode, ApiProvider } from '@/lib/engine/llm/config';

export function AppShell({ children }: { children: React.ReactNode }) {
  const setInferenceMode = usePFCStore((s) => s.setInferenceMode);
  const setApiKey = usePFCStore((s) => s.setApiKey);
  const setApiProvider = usePFCStore((s) => s.setApiProvider);
  const setOllamaBaseUrl = usePFCStore((s) => s.setOllamaBaseUrl);
  const setOllamaModel = usePFCStore((s) => s.setOllamaModel);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const storedMode = localStorage.getItem('pfc-inference-mode') as InferenceMode | null;
    if (storedMode) setInferenceMode(storedMode);
    const storedKey = localStorage.getItem('pfc-api-key');
    if (storedKey) setApiKey(storedKey);
    const storedProvider = localStorage.getItem('pfc-api-provider') as ApiProvider | null;
    if (storedProvider) setApiProvider(storedProvider);
    const storedOllamaUrl = localStorage.getItem('pfc-ollama-url');
    if (storedOllamaUrl) setOllamaBaseUrl(storedOllamaUrl);
    const storedOllamaModel = localStorage.getItem('pfc-ollama-model');
    if (storedOllamaModel) setOllamaModel(storedOllamaModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-background">
      <TopNav />
      {children}
    </div>
  );
}
