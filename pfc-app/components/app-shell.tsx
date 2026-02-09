'use client';

import { useEffect, useState } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { TopNav } from './top-nav';
import type { InferenceMode, ApiProvider } from '@/lib/engine/llm/config';
import type { SuiteTier, ResearchPaper, CodebaseAnalysis } from '@/lib/research/types';
import { detectDevice, cacheDeviceProfile } from '@/lib/device-detection';

export function AppShell({ children }: { children: React.ReactNode }) {
  const setInferenceMode = usePFCStore((s) => s.setInferenceMode);
  const setApiKey = usePFCStore((s) => s.setApiKey);
  const setApiProvider = usePFCStore((s) => s.setApiProvider);
  const setOllamaBaseUrl = usePFCStore((s) => s.setOllamaBaseUrl);
  const setOllamaModel = usePFCStore((s) => s.setOllamaModel);
  const setSuiteTier = usePFCStore((s) => s.setSuiteTier);
  const setMeasurementEnabled = usePFCStore((s) => s.setMeasurementEnabled);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // --- Inference settings ---
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

    // --- Suite Tier (3-tier system) ---
    // Prefer new key, fallback to legacy key, fallback to device detection
    const storedTier = localStorage.getItem('pfc-suite-tier') as SuiteTier | null;
    const legacyMode = localStorage.getItem('pfc-suite-mode') as string | null;

    if (storedTier && ['notes', 'programming', 'full'].includes(storedTier)) {
      setSuiteTier(storedTier);
    } else if (legacyMode) {
      // Migrate legacy values
      if (legacyMode === 'research-only') {
        setSuiteTier('notes');
      } else if (legacyMode === 'full') {
        setSuiteTier('full');
      } else if (['notes', 'programming'].includes(legacyMode)) {
        setSuiteTier(legacyMode as SuiteTier);
      }
    }

    // Override measurement if explicitly stored
    const storedMeasurement = localStorage.getItem('pfc-measurement-enabled');
    if (storedMeasurement !== null) setMeasurementEnabled(storedMeasurement === 'true');

    // --- Detect and cache device profile ---
    const profile = detectDevice();
    cacheDeviceProfile(profile);

    // --- Load research papers ---
    try {
      const storedPapers = localStorage.getItem('pfc-research-papers');
      if (storedPapers) {
        const papers = JSON.parse(storedPapers) as ResearchPaper[];
        for (const paper of papers) {
          usePFCStore.getState().addResearchPaper(paper);
        }
      }
    } catch { /* ignore corrupt data */ }

    // --- Load codebase analyses ---
    try {
      const storedAnalyses = localStorage.getItem('pfc-codebase-analyses');
      if (storedAnalyses) {
        const analyses = JSON.parse(storedAnalyses) as CodebaseAnalysis[];
        for (const analysis of analyses) {
          usePFCStore.getState().addCodebaseAnalysis(analysis);
        }
      }
    } catch { /* ignore corrupt data */ }
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
