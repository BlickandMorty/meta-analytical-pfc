'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useIsDark } from '@/hooks/use-is-dark';
import { TopNav } from './top-nav';
import { StarField } from './star-field';
import type { InferenceMode, ApiProvider } from '@/lib/engine/llm/config';
import type { SuiteTier, ResearchPaper } from '@/lib/research/types';
import { detectDevice, cacheDeviceProfile } from '@/lib/device-detection';
import { ToastContainer } from './toast-container';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isDark, isOled } = useIsDark();
  const pathname = usePathname();
  const showStars = pathname === '/' || (isOled && pathname === '/docs');
  const starTheme = isOled ? 'oled' as const : isDark ? 'dark' as const : 'light' as const;
  const setInferenceMode = usePFCStore((s) => s.setInferenceMode);
  const setApiKey = usePFCStore((s) => s.setApiKey);
  const setApiProvider = usePFCStore((s) => s.setApiProvider);
  const setOllamaBaseUrl = usePFCStore((s) => s.setOllamaBaseUrl);
  const setOllamaModel = usePFCStore((s) => s.setOllamaModel);
  const setSuiteTier = usePFCStore((s) => s.setSuiteTier);
  const setMeasurementEnabled = usePFCStore((s) => s.setMeasurementEnabled);
  const initScheduler = usePFCStore((s) => s.initScheduler);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    initScheduler();
    return () => {
      import('@/lib/notes/learning-scheduler').then(({ stopScheduler }) => stopScheduler());
    };
  }, [initScheduler]);

  useEffect(() => {
    // --- Inference settings ---
    const storedMode = localStorage.getItem('pfc-inference-mode');
    if (storedMode && ['simulation', 'api', 'local'].includes(storedMode)) {
      setInferenceMode(storedMode as InferenceMode);
    }
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      {showStars && <StarField theme={starTheme} />}
      <TopNav />
      {children}

      <ToastContainer />
    </div>
  );
}
