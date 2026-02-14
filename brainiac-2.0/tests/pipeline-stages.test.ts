/**
 * Task 8: Pipeline Stages Tests
 * Tests that runPipeline requires an inference config, and validates
 * the query analysis / signal generation helper functions.
 */
import { describe, it, expect } from 'vitest';
import { runPipeline } from '@/lib/engine/simulate';
import type { PipelineEvent } from '@/lib/engine/types';

// Per-test timeout
const T = 15_000;

// ---------------------------------------------------------------------------
// Helper: collect all events from the async generator (SOAR disabled)
// ---------------------------------------------------------------------------
async function collectEvents(query: string, inferenceConfig?: Parameters<typeof runPipeline>[4]): Promise<PipelineEvent[]> {
  const events: PipelineEvent[] = [];
  const soarOff = {
    enabled: false, autoDetect: true,
    thresholds: { minDifficulty: 0.3, maxConfidence: 0.85, minEntropy: 0.2, confidenceFloor: 0.35, entropyCeiling: 0.7, dissonanceCeiling: 0.6, difficultyFloor: 0.5 },
    maxIterations: 3, stonesPerCurriculum: 3,
    rewardWeights: { confidence: 0.35, entropy: 0.25, dissonance: 0.20, health: 0.15, tda: 0.05 },
    minRewardThreshold: 0.05, contradictionDetection: true,
    maxContradictionClaims: 20, apiCostCapTokens: 50000, verbose: false,
  };
  for await (const ev of runPipeline(query, undefined, undefined, undefined, inferenceConfig, soarOff)) {
    events.push(ev);
  }
  return events;
}

// Typed extractors
function errorEvts(events: PipelineEvent[]) {
  return events.filter((e): e is Extract<PipelineEvent, { type: 'error' }> => e.type === 'error');
}

// ═══════════════════════════════════════════════════════════════════════════

describe('Pipeline — no inference config', () => {
  it('yields an error event when no inference config is provided', async () => {
    const events = await collectEvents('What is the effect of aspirin on cardiovascular health?');
    const errors = errorEvts(events);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('No inference configuration provided');
  }, T);

  it('does not yield a complete event without inference config', async () => {
    const events = await collectEvents('Does exercise improve depression?');
    const complete = events.find(e => e.type === 'complete');
    expect(complete).toBeUndefined();
  }, T);
});
