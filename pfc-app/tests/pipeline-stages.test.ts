/**
 * Task 8: Pipeline Stages Tests
 * Tests that every stage of the 10-stage simulation pipeline produces valid output.
 * Verifies SSE event ordering, signal bounds, and edge-case input handling.
 *
 * Note: The simulation pipeline uses real sleep() delays (~4s per run).
 * Each test that calls collectEvents needs a generous timeout.
 */
import { describe, it, expect } from 'vitest';
import { runPipeline } from '@/lib/engine/simulate';
import { STAGES } from '@/lib/constants';
import type { PipelineEvent, StageStatus } from '@/lib/engine/types';

// Per-test timeout (pipeline simulation takes ~4s due to sleep calls)
const T = 15_000;

// ---------------------------------------------------------------------------
// Helper: collect all events from the async generator (SOAR disabled)
// ---------------------------------------------------------------------------
async function collectEvents(query: string): Promise<PipelineEvent[]> {
  const events: PipelineEvent[] = [];
  const soarOff = {
    enabled: false, autoDetect: true,
    thresholds: { minDifficulty: 0.3, maxConfidence: 0.85, minEntropy: 0.2, confidenceFloor: 0.35, entropyCeiling: 0.7, dissonanceCeiling: 0.6, difficultyFloor: 0.5 },
    maxIterations: 3, stonesPerCurriculum: 3,
    rewardWeights: { confidence: 0.35, entropy: 0.25, dissonance: 0.20, health: 0.15, tda: 0.05 },
    minRewardThreshold: 0.05, contradictionDetection: true,
    maxContradictionClaims: 20, apiCostCapTokens: 50000, verbose: false,
  };
  for await (const ev of runPipeline(query, undefined, undefined, undefined, undefined, soarOff)) {
    events.push(ev);
  }
  return events;
}

// Typed extractors
function stageEvts(events: PipelineEvent[]) {
  return events.filter((e): e is Extract<PipelineEvent, { type: 'stage' }> => e.type === 'stage');
}
function signalEvts(events: PipelineEvent[]) {
  return events.filter((e): e is Extract<PipelineEvent, { type: 'signals' }> => e.type === 'signals');
}
function complete(events: PipelineEvent[]) {
  return events.find((e): e is Extract<PipelineEvent, { type: 'complete' }> => e.type === 'complete');
}
function deltas(events: PipelineEvent[]) {
  return events.filter((e): e is Extract<PipelineEvent, { type: 'text-delta' }> => e.type === 'text-delta');
}

// ═══════════════════════════════════════════════════════════════════════════

describe('Pipeline Stages — simulation mode', () => {

  // ── 1. Normal research query ─────────────────────────────────────────
  describe('normal research query', () => {
    let events: PipelineEvent[];

    it('runs the pipeline and emits events', async () => {
      events = await collectEvents('What is the effect of aspirin on cardiovascular health?');
      expect(events.length).toBeGreaterThan(0);
    }, T);

    it('emits stage events for all 10 stages', () => {
      const active = stageEvts(events).filter(e => e.status === 'active').map(e => e.stage);
      for (const s of STAGES) expect(active).toContain(s);
    });

    it('complete event has valid DualMessage', () => {
      const c = complete(events)!;
      expect(c).toBeDefined();
      expect(c.dualMessage.rawAnalysis.length).toBeGreaterThan(50);
      expect(c.dualMessage.laymanSummary.whatIsLikelyTrue.length).toBeGreaterThan(0);
      expect(Array.isArray(c.dualMessage.reflection.selfCriticalQuestions)).toBe(true);
      expect(Array.isArray(c.dualMessage.arbitration.votes)).toBe(true);
      expect(typeof c.dualMessage.arbitration.consensus).toBe('boolean');
    });

    it('complete event has valid TruthAssessment', () => {
      const ta = complete(events)!.truthAssessment;
      expect(ta.overallTruthLikelihood).toBeGreaterThanOrEqual(0);
      expect(ta.overallTruthLikelihood).toBeLessThanOrEqual(1);
      expect(ta.signalInterpretation.length).toBeGreaterThan(0);
      expect(Array.isArray(ta.weaknesses)).toBe(true);
      expect(Array.isArray(ta.improvements)).toBe(true);
      expect(Array.isArray(ta.blindSpots)).toBe(true);
      expect(Array.isArray(ta.recommendedActions)).toBe(true);
    });

    it('text-delta events reconstruct readable text', () => {
      const text = deltas(events).map(d => d.text).join('');
      expect(text.trim().length).toBeGreaterThan(10);
    });

    it('grade and mode are valid', () => {
      const c = complete(events)!;
      expect(['A', 'B', 'C', 'D', 'F']).toContain(c.grade);
      expect(['meta-analytical', 'philosophical-analytical', 'executive', 'moderate']).toContain(c.mode);
    });

    it('marks the pipeline as simulated', () => {
      expect(complete(events)!.simulated).toBe(true);
    });
  });

  // ── 2. Signal bounds ─────────────────────────────────────────────────
  describe('signal bounds (0-1 range)', () => {
    it('medical query signals are in range', async () => {
      const ev = await collectEvents('What is the effect of aspirin on cardiovascular health?');
      const s = complete(ev)!.signals;
      expect(s.confidence).toBeGreaterThanOrEqual(0); expect(s.confidence).toBeLessThanOrEqual(1);
      expect(s.entropy).toBeGreaterThanOrEqual(0);    expect(s.entropy).toBeLessThanOrEqual(1);
      expect(s.dissonance).toBeGreaterThanOrEqual(0);  expect(s.dissonance).toBeLessThanOrEqual(1);
      expect(s.riskScore).toBeGreaterThanOrEqual(0);   expect(s.riskScore).toBeLessThanOrEqual(1);
      expect(s.healthScore).toBeGreaterThanOrEqual(0);  expect(s.healthScore).toBeLessThanOrEqual(1);
    }, T);

    it('philosophical query signals are in range', async () => {
      const ev = await collectEvents('Is determinism compatible with moral responsibility?');
      const s = complete(ev)!.signals;
      expect(s.confidence).toBeGreaterThanOrEqual(0); expect(s.confidence).toBeLessThanOrEqual(1);
      expect(s.entropy).toBeGreaterThanOrEqual(0);    expect(s.entropy).toBeLessThanOrEqual(1);
      expect(s.dissonance).toBeGreaterThanOrEqual(0);  expect(s.dissonance).toBeLessThanOrEqual(1);
      expect(s.riskScore).toBeGreaterThanOrEqual(0);   expect(s.riskScore).toBeLessThanOrEqual(1);
      expect(s.healthScore).toBeGreaterThanOrEqual(0);  expect(s.healthScore).toBeLessThanOrEqual(1);
    }, T);

    it('meta-analytical query signals are in range', async () => {
      const ev = await collectEvents('meta-analysis of screen time effects on children across studies');
      const s = complete(ev)!.signals;
      expect(s.confidence).toBeGreaterThanOrEqual(0); expect(s.confidence).toBeLessThanOrEqual(1);
      expect(s.entropy).toBeGreaterThanOrEqual(0);    expect(s.entropy).toBeLessThanOrEqual(1);
      expect(s.dissonance).toBeGreaterThanOrEqual(0);  expect(s.dissonance).toBeLessThanOrEqual(1);
      expect(s.riskScore).toBeGreaterThanOrEqual(0);   expect(s.riskScore).toBeLessThanOrEqual(1);
      expect(s.healthScore).toBeGreaterThanOrEqual(0);  expect(s.healthScore).toBeLessThanOrEqual(1);
    }, T);

    it('intermediate signal events stay in range', async () => {
      const ev = await collectEvents('What is the effect of aspirin on cardiovascular health?');
      for (const se of signalEvts(ev)) {
        const d = se.data;
        if (d.confidence !== undefined)  { expect(d.confidence).toBeGreaterThanOrEqual(0); expect(d.confidence).toBeLessThanOrEqual(1); }
        if (d.entropy !== undefined)     { expect(d.entropy).toBeGreaterThanOrEqual(0);    expect(d.entropy).toBeLessThanOrEqual(1); }
        if (d.dissonance !== undefined)  { expect(d.dissonance).toBeGreaterThanOrEqual(0); expect(d.dissonance).toBeLessThanOrEqual(1); }
        if (d.riskScore !== undefined)   { expect(d.riskScore).toBeGreaterThanOrEqual(0);  expect(d.riskScore).toBeLessThanOrEqual(1); }
        if (d.healthScore !== undefined) { expect(d.healthScore).toBeGreaterThanOrEqual(0); expect(d.healthScore).toBeLessThanOrEqual(1); }
      }
    }, T);
  });

  // ── 3. SSE event ordering ────────────────────────────────────────────
  describe('SSE event ordering', () => {
    let events: PipelineEvent[];

    it('collects events for ordering checks', async () => {
      events = await collectEvents('Does exercise improve depression outcomes?');
      expect(events.length).toBeGreaterThan(0);
    }, T);

    it('stage events appear before complete', () => {
      const ci = events.findIndex(e => e.type === 'complete');
      const li = events.reduce((m, e, i) => e.type === 'stage' ? i : m, -1);
      expect(ci).toBeGreaterThan(li);
    });

    it('text-delta events appear before complete', () => {
      const ci = events.findIndex(e => e.type === 'complete');
      const li = events.reduce((m, e, i) => e.type === 'text-delta' ? i : m, -1);
      expect(ci).toBeGreaterThan(li);
    });

    it('stages appear in pipeline order', () => {
      const active = stageEvts(events).filter(e => e.status === 'active').map(e => e.stage);
      expect(active[0]).toBe('triage');
      expect(active[active.length - 1]).toBe('calibration');
    });

    it('each stage event has valid detail and value', () => {
      for (const se of stageEvts(events)) {
        expect(typeof se.detail).toBe('string');
        expect(typeof se.value).toBe('number');
        expect(se.value).toBeGreaterThanOrEqual(0);
        expect(se.value).toBeLessThanOrEqual(1);
        expect(['active', 'complete'] as StageStatus[]).toContain(se.status);
      }
    });
  });

  // ── 4. Edge-case inputs ──────────────────────────────────────────────
  describe('edge-case inputs', () => {
    it('handles empty string', async () => {
      const ev = await collectEvents('');
      const c = complete(ev);
      expect(c).toBeDefined();
      expect(c!.dualMessage.rawAnalysis.length).toBeGreaterThan(0);
    }, T);

    it('handles whitespace-only input', async () => {
      const ev = await collectEvents('   \t\n  ');
      expect(complete(ev)).toBeDefined();
    }, T);

    it('handles unicode input', async () => {
      const ev = await collectEvents('Wie beeinflusst Schlaf die kognitive Leistung? \u00e4\u00f6\u00fc\u00df \u4e2d\u6587');
      const c = complete(ev);
      expect(c).toBeDefined();
      expect(c!.confidence).toBeGreaterThan(0);
    }, T);

    it('handles very long input (10K+ chars)', async () => {
      const longQuery = 'What is the relationship between sleep and memory consolidation? '.repeat(160);
      expect(longQuery.length).toBeGreaterThan(10000);
      const ev = await collectEvents(longQuery);
      const c = complete(ev);
      expect(c).toBeDefined();
      expect(c!.signals.confidence).toBeLessThanOrEqual(1);
      expect(c!.signals.entropy).toBeLessThanOrEqual(1);
    }, T);

    it('handles trivial/conversational input', async () => {
      const ev = await collectEvents('hi');
      const c = complete(ev);
      expect(c).toBeDefined();
      expect(c!.dualMessage.laymanSummary.whatIsLikelyTrue.length).toBeGreaterThan(0);
    }, T);
  });

  // ── 5. Domain-specific routing ───────────────────────────────────────
  describe('domain-specific analysis modes', () => {
    it('philosophical query -> philosophical-analytical', async () => {
      const ev = await collectEvents('Is free will compatible with determinism?');
      expect(complete(ev)!.mode).toBe('philosophical-analytical');
    }, T);

    it('empirical medical query -> executive', async () => {
      const ev = await collectEvents('What is the effect size of SSRIs on depression treatment?');
      expect(complete(ev)!.mode).toBe('executive');
    }, T);

    it('meta-analytical query -> meta-analytical', async () => {
      const ev = await collectEvents('meta-analysis of heterogeneity across studies on screen time');
      expect(complete(ev)!.mode).toBe('meta-analytical');
    }, T);
  });
});
