// ═══════════════════════════════════════════════════════════════════
// ██ SOAR — Main Orchestrator
// ═══════════════════════════════════════════════════════════════════
//
// The SOAR loop:
//   1. Probe: Detect if query is at the edge of learnability
//   2. Teach: Generate a curriculum of stepping-stone problems
//   3. Learn: Student works through curriculum sequentially
//   4. Evaluate: Measure student improvement on the target problem
//   5. Iterate: If reward > threshold and iterations remain, go to 2
//
// The teacher is rewarded by measured student improvement (grounded
// reward), not by problem quality metrics. This prevents the reward
// hacking and diversity collapse seen in intrinsic reward schemes.
// ═══════════════════════════════════════════════════════════════════

import type { LanguageModel } from 'ai';
import type { QueryAnalysis } from '../simulate';
import { probeLearnability } from './detector';
import { generateCurriculum } from './teacher';
import { attemptStone, attemptTarget } from './student';
import { computeReward, assessStructuralQuality } from './reward';
import { scanForContradictions } from './contradiction';
import type {
  SOARSession,
  SOARConfig,
  LearnabilityProbe,
  StoneAttempt,
  FinalAttempt,
  SOARReward,
  Curriculum,
} from './types';
import { DEFAULT_SOAR_CONFIG, getSOARLimitations } from './types';
import type { BaselineSignals } from './reward';
import type { InferenceMode } from '../llm/config';

// ---------------------------------------------------------------------------
// Event callback for streaming UI updates
// ---------------------------------------------------------------------------

type SOAREventType =
  | 'probe-complete'
  | 'teaching-start'
  | 'teaching-complete'
  | 'stone-start'
  | 'stone-complete'
  | 'final-attempt-start'
  | 'final-attempt-complete'
  | 'reward-computed'
  | 'contradiction-scan-start'
  | 'contradiction-scan-complete'
  | 'iteration-complete'
  | 'session-complete'
  | 'session-aborted';

interface SOAREvent {
  type: SOAREventType;
  sessionId: string;
  iteration: number;
  data: Record<string, unknown>;
  timestamp: number;
}

type SOAREventCallback = (event: SOAREvent) => void;

// ---------------------------------------------------------------------------
// Session ID generator
// ---------------------------------------------------------------------------

function generateSessionId(): string {
  return `soar_${crypto.randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Emit helper
// ---------------------------------------------------------------------------

function emit(
  callback: SOAREventCallback | undefined,
  type: SOAREventType,
  sessionId: string,
  iteration: number,
  data: Record<string, unknown> = {},
): void {
  if (callback) {
    callback({ type, sessionId, iteration, data, timestamp: Date.now() });
  }
}

// ---------------------------------------------------------------------------
// SOAR Engine — Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the full SOAR reasoning loop on a hard query.
 *
 * This is the top-level function that orchestrates the entire SOAR process:
 * probe → (teach → learn → evaluate) × N iterations → contradiction scan.
 *
 * @param model - The LLM to use (null = simulation mode)
 * @param query - The hard query to reason about
 * @param qa - Query analysis from triage
 * @param baselineSignals - Signals from initial (pre-SOAR) pipeline run
 * @param inferenceMode - Current inference mode (for limitation enforcement)
 * @param config - SOAR configuration
 * @param onEvent - Optional callback for streaming progress updates
 * @returns Complete SOARSession with all iterations, rewards, and final signals
 */
export async function runSOAR(
  model: LanguageModel | null,
  query: string,
  qa: QueryAnalysis,
  baselineSignals: BaselineSignals,
  inferenceMode: InferenceMode,
  config: SOARConfig = DEFAULT_SOAR_CONFIG,
  onEvent?: SOAREventCallback,
): Promise<SOARSession> {
  const sessionId = generateSessionId();
  const startTime = Date.now();

  // Enforce mode-specific limitations
  const limitations = getSOARLimitations(inferenceMode);
  const maxIterations = Math.min(config.maxIterations, limitations.maxIterations);
  const maxStones = Math.min(config.stonesPerCurriculum, limitations.maxStonesPerCurriculum);

  // ---------------------------------------------------------------------------
  // Step 1: Probe learnability
  // ---------------------------------------------------------------------------
  const probe: LearnabilityProbe = probeLearnability(
    qa,
    { confidence: baselineSignals.confidence, entropy: baselineSignals.entropy, dissonance: baselineSignals.dissonance },
    config.thresholds,
  );

  emit(onEvent, 'probe-complete', sessionId, 0, {
    probe,
    atEdge: probe.atEdge,
    difficulty: probe.estimatedDifficulty,
  });

  // Initialize session
  const session: SOARSession = {
    id: sessionId,
    targetQuery: query,
    probe,
    curricula: [],
    attempts: [],
    finalAttempts: [],
    rewards: [],
    contradictionScan: null,
    baselineSignals,
    finalSignals: null,
    iterationsCompleted: 0,
    maxIterations,
    overallImproved: false,
    totalDurationMs: 0,
    inferenceMode,
    startedAt: startTime,
    completedAt: null,
    status: 'probing',
  };

  // If not at edge and auto-detect is on, skip SOAR
  if (!probe.atEdge && config.autoDetect) {
    session.status = 'complete';
    session.completedAt = Date.now();
    session.totalDurationMs = Date.now() - startTime;
    emit(onEvent, 'session-complete', sessionId, 0, {
      reason: 'Not at edge of learnability',
      probe,
    });
    return session;
  }

  // Use recommended depth if auto-detecting, otherwise config
  const targetIterations = config.autoDetect
    ? Math.min(probe.recommendedDepth, maxIterations)
    : maxIterations;

  // Track running signals for reward computation
  let currentSignals = { ...baselineSignals };
  let previousReward: SOARReward | undefined;

  // ---------------------------------------------------------------------------
  // Step 2-5: SOAR iteration loop
  // ---------------------------------------------------------------------------
  for (let iteration = 0; iteration < targetIterations; iteration++) {
    // ---- 2. Teach: Generate curriculum ----
    session.status = 'teaching';
    emit(onEvent, 'teaching-start', sessionId, iteration, { stonesRequested: maxStones });

    const curriculum: Curriculum = await generateCurriculum(
      model,
      query,
      qa,
      maxStones,
      iteration,
      previousReward,
    );

    // Assess structural quality of each stone
    for (const stone of curriculum.stones) {
      stone.structuralQuality = assessStructuralQuality(stone.question, query);
    }

    session.curricula.push(curriculum);
    emit(onEvent, 'teaching-complete', sessionId, iteration, {
      curriculumId: curriculum.id,
      numStones: curriculum.stones.length,
      rationale: curriculum.teacherRationale,
    });

    // ---- 3. Learn: Student works through stepping stones ----
    session.status = 'learning';
    const iterationAttempts: StoneAttempt[] = [];

    for (const stone of curriculum.stones) {
      emit(onEvent, 'stone-start', sessionId, iteration, {
        stoneId: stone.id,
        skill: stone.targetSkill,
        difficulty: stone.relativeDifficulty,
      });

      const attempt = await attemptStone(model, stone, iterationAttempts, query);
      iterationAttempts.push(attempt);
      session.attempts.push(attempt);

      emit(onEvent, 'stone-complete', sessionId, iteration, {
        stoneId: stone.id,
        confidence: attempt.confidenceAfter,
        entropy: attempt.entropyAfter,
        contributed: attempt.contributedToContext,
      });
    }

    // ---- 4. Evaluate: Student re-attempts the target problem ----
    session.status = 'evaluating';
    emit(onEvent, 'final-attempt-start', sessionId, iteration, {});

    const finalAttempt: FinalAttempt = await attemptTarget(
      model,
      query,
      qa,
      curriculum,
      iterationAttempts,
    );
    session.finalAttempts.push(finalAttempt);

    emit(onEvent, 'final-attempt-complete', sessionId, iteration, {
      confidence: finalAttempt.confidence,
      entropy: finalAttempt.entropy,
      dissonance: finalAttempt.dissonance,
      healthScore: finalAttempt.healthScore,
    });

    // Compute reward: how much did the student improve?
    const newSignals: BaselineSignals = {
      confidence: finalAttempt.confidence,
      entropy: finalAttempt.entropy,
      dissonance: finalAttempt.dissonance,
      healthScore: finalAttempt.healthScore,
      persistenceEntropy: currentSignals.persistenceEntropy * (1 - 0.05 * (iteration + 1)), // TDA slowly improves
    };

    const reward: SOARReward = computeReward(currentSignals, newSignals, config.rewardWeights);
    session.rewards.push(reward);
    previousReward = reward;

    // Mark stones as useful/not based on reward
    for (const stone of curriculum.stones) {
      stone.wasUseful = reward.improved;
    }

    emit(onEvent, 'reward-computed', sessionId, iteration, {
      composite: reward.composite,
      improved: reward.improved,
      deltaConfidence: reward.deltaConfidence,
      deltaEntropy: reward.deltaEntropy,
      deltaDissonance: reward.deltaDissonance,
    });

    // Update running signals for next iteration
    if (reward.improved) {
      currentSignals = newSignals;
    }

    session.iterationsCompleted = iteration + 1;
    emit(onEvent, 'iteration-complete', sessionId, iteration, {
      iterationsCompleted: iteration + 1,
      totalIterations: targetIterations,
      cumulativeReward: session.rewards.reduce((s, r) => s + r.composite, 0),
    });

    // ---- 5. Continue or stop? ----
    // Stop early if reward dropped below threshold (diminishing returns)
    if (!reward.improved && iteration > 0) {
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 6: OOLONG Contradiction scan (on the final analysis)
  // ---------------------------------------------------------------------------
  if (config.contradictionDetection && session.finalAttempts.length > 0) {
    emit(onEvent, 'contradiction-scan-start', sessionId, session.iterationsCompleted, {});

    const lastAttempt = session.finalAttempts[session.finalAttempts.length - 1];
    const scan = await scanForContradictions(
      model,
      lastAttempt.analysis,
      config.maxContradictionClaims,
    );
    session.contradictionScan = scan;

    emit(onEvent, 'contradiction-scan-complete', sessionId, session.iterationsCompleted, {
      totalClaims: scan.totalClaims,
      totalComparisons: scan.totalComparisons,
      contradictionsFound: scan.contradictions.length,
      computedDissonance: scan.computedDissonance,
    });

    // Adjust final dissonance with contradiction-grounded signal
    if (scan.computedDissonance > 0 && session.finalAttempts.length > 0) {
      const last = session.finalAttempts[session.finalAttempts.length - 1];
      // Blend pipeline dissonance with contradiction-measured dissonance
      last.dissonance = last.dissonance * 0.6 + scan.computedDissonance * 0.4;
    }
  }

  // ---------------------------------------------------------------------------
  // Finalize session
  // ---------------------------------------------------------------------------
  const bestFinal = session.finalAttempts.length > 0
    ? session.finalAttempts.reduce((best, a) =>
        a.confidence > best.confidence ? a : best, session.finalAttempts[0])
    : null;

  if (bestFinal) {
    session.finalSignals = {
      confidence: bestFinal.confidence,
      entropy: bestFinal.entropy,
      dissonance: bestFinal.dissonance,
      healthScore: bestFinal.healthScore,
      persistenceEntropy: currentSignals.persistenceEntropy,
    };
  }

  const totalReward = session.rewards.reduce((s, r) => s + r.composite, 0);
  session.overallImproved = totalReward > 0.01;
  session.status = 'complete';
  session.completedAt = Date.now();
  session.totalDurationMs = Date.now() - startTime;

  emit(onEvent, 'session-complete', sessionId, session.iterationsCompleted, {
    overallImproved: session.overallImproved,
    totalReward,
    iterationsCompleted: session.iterationsCompleted,
    finalConfidence: bestFinal?.confidence,
    baselineConfidence: baselineSignals.confidence,
    contradictionsFound: session.contradictionScan?.contradictions.length ?? 0,
  });

  return session;
}

// ---------------------------------------------------------------------------
// Quick SOAR probe (for UI status display)
// ---------------------------------------------------------------------------

/**
 * Quick probe-only function for UI components that want to display
 * whether SOAR would engage for a given query, without running the
 * full loop.
 */
export function quickProbe(
  qa: QueryAnalysis,
  priorSignals?: { confidence: number; entropy: number; dissonance: number },
  config: SOARConfig = DEFAULT_SOAR_CONFIG,
): LearnabilityProbe {
  return probeLearnability(qa, priorSignals, config.thresholds);
}
