import { describe, it, expect, beforeEach } from 'vitest';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { DEFAULT_SOAR_CONFIG } from '@/lib/engine/soar/types';
import type { SOARSession } from '@/lib/engine/soar/types';

describe('SOAR slice', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store to initial state
    usePFCStore.setState({ soarConfig: DEFAULT_SOAR_CONFIG, soarSession: null });
  });

  it('starts with default config (not localStorage)', () => {
    const config = usePFCStore.getState().soarConfig;
    expect(config).toEqual(DEFAULT_SOAR_CONFIG);
  });

  it('hydrateSOAR loads from localStorage', () => {
    const custom = { ...DEFAULT_SOAR_CONFIG, enabled: true, maxIterations: 10 };
    localStorage.setItem('pfc-soar-config', JSON.stringify(custom));

    usePFCStore.getState().hydrateSOAR();

    const config = usePFCStore.getState().soarConfig;
    expect(config.enabled).toBe(true);
    expect(config.maxIterations).toBe(10);
  });

  it('hydrateSOAR falls back to defaults on corrupt data', () => {
    localStorage.setItem('pfc-soar-config', 'not-json');

    usePFCStore.getState().hydrateSOAR();

    expect(usePFCStore.getState().soarConfig).toEqual(DEFAULT_SOAR_CONFIG);
  });

  it('setSOARConfig merges partial config', () => {
    usePFCStore.getState().setSOARConfig({ enabled: true });

    const config = usePFCStore.getState().soarConfig;
    expect(config.enabled).toBe(true);
    // Other fields preserved
    expect(config.maxIterations).toBe(DEFAULT_SOAR_CONFIG.maxIterations);
  });

  it('setSOARConfig persists to localStorage', () => {
    usePFCStore.getState().setSOARConfig({ enabled: true });

    const stored = JSON.parse(localStorage.getItem('pfc-soar-config')!);
    expect(stored.enabled).toBe(true);
  });

  it('setSOAREnabled toggles enabled flag', () => {
    usePFCStore.getState().setSOAREnabled(true);
    expect(usePFCStore.getState().soarConfig.enabled).toBe(true);

    usePFCStore.getState().setSOAREnabled(false);
    expect(usePFCStore.getState().soarConfig.enabled).toBe(false);
  });

  it('setSOARSession stores and clears session', () => {
    const session: SOARSession = {
      id: 'test',
      targetQuery: 'test query',
      probe: {
        estimatedDifficulty: 0.5,
        probeConfidence: 0.5,
        probeEntropy: 0.3,
        atEdge: false,
        reason: 'test',
        recommendedDepth: 1,
        timestamp: Date.now(),
      },
      curricula: [],
      attempts: [],
      finalAttempts: [],
      rewards: [],
      contradictionScan: null,
      baselineSignals: { confidence: 0.5, entropy: 0.3, dissonance: 0.1, healthScore: 0.8, persistenceEntropy: 0.2 },
      finalSignals: null,
      iterationsCompleted: 0,
      maxIterations: 3,
      overallImproved: false,
      totalDurationMs: 0,
      inferenceMode: 'simulation',
      startedAt: Date.now(),
      completedAt: null,
      status: 'complete',
    };
    usePFCStore.getState().setSOARSession(session);
    expect(usePFCStore.getState().soarSession).toBeTruthy();

    usePFCStore.getState().setSOARSession(null);
    expect(usePFCStore.getState().soarSession).toBeNull();
  });
});
