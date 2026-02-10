// ═══════════════════════════════════════════════════════════════════
// ██ SOAR — Grounded Reward Signal
// ═══════════════════════════════════════════════════════════════════
//
// The reward is grounded in MEASURED student progress — not intrinsic
// proxy rewards. From the paper: "grounded rewards outperform
// intrinsic reward schemes used in prior LLM self-play, reliably
// avoiding the instability and diversity collapse modes they
// typically exhibit."
//
// The composite reward combines:
//   +confidence gain (the student got more certain)
//   -entropy change (the student's reasoning became more coherent)
//   -dissonance change (the student resolved more conflicts)
//   +health gain (overall system health improved)
//   -TDA persistence entropy shift (reasoning topology simplified)
// ═══════════════════════════════════════════════════════════════════

import type { SOARReward, RewardWeights } from './types';

/** Baseline signals to compute reward against */
export interface BaselineSignals {
  confidence: number;
  entropy: number;
  dissonance: number;
  healthScore: number;
  persistenceEntropy: number;
}

/**
 * Compute the grounded reward for one SOAR iteration.
 *
 * Positive reward = the student improved on the target problem.
 * Zero/negative reward = the curriculum didn't help (or hurt).
 *
 * The composite is a weighted sum of deltas, where:
 * - Confidence increase = positive reward
 * - Entropy decrease = positive reward
 * - Dissonance decrease = positive reward
 * - Health increase = positive reward
 * - TDA persistence entropy decrease = positive reward (simpler topology)
 */
export function computeReward(
  baseline: BaselineSignals,
  current: {
    confidence: number;
    entropy: number;
    dissonance: number;
    healthScore: number;
    persistenceEntropy: number;
  },
  weights: RewardWeights = {
    confidence: 0.35,
    entropy: 0.25,
    dissonance: 0.20,
    health: 0.15,
    tda: 0.05,
  },
): SOARReward {
  // Compute deltas (positive = improvement direction)
  const deltaConfidence = current.confidence - baseline.confidence;
  const deltaEntropy = baseline.entropy - current.entropy;        // Inverted: lower is better
  const deltaDissonance = baseline.dissonance - current.dissonance; // Inverted: lower is better
  const deltaHealth = current.healthScore - baseline.healthScore;
  const deltaPersistenceEntropy = baseline.persistenceEntropy - current.persistenceEntropy; // Inverted

  // Weighted composite
  const composite =
    weights.confidence * deltaConfidence +
    weights.entropy * deltaEntropy +
    weights.dissonance * deltaDissonance +
    weights.health * deltaHealth +
    weights.tda * deltaPersistenceEntropy;

  return {
    deltaConfidence,
    deltaEntropy: -deltaEntropy, // Report raw delta (negative = entropy went down)
    deltaDissonance: -deltaDissonance, // Report raw delta
    deltaHealth,
    deltaPersistenceEntropy: -deltaPersistenceEntropy,
    composite,
    improved: composite > 0.01, // Threshold for "meaningful improvement"
  };
}

/**
 * Assess the structural quality of a stepping stone.
 *
 * From the paper: structural quality matters more than solution
 * correctness. A well-posed question that exercises the right
 * reasoning pattern is more valuable than a correct answer to
 * a poorly-structured question.
 *
 * Quality factors:
 * 1. Length (too short = vague, too long = overspecified)
 * 2. Question structure (has interrogative form)
 * 3. Specificity (references concrete concepts)
 * 4. Novelty (doesn't just repeat the target query)
 */
export function assessStructuralQuality(
  stoneQuestion: string,
  targetQuery: string,
): number {
  let quality = 0.5; // Base

  // 1. Length check (sweet spot: 15-80 words)
  const wordCount = stoneQuestion.split(/\s+/).length;
  if (wordCount >= 15 && wordCount <= 80) {
    quality += 0.15;
  } else if (wordCount < 8 || wordCount > 120) {
    quality -= 0.15;
  }

  // 2. Interrogative structure
  if (/\?$/.test(stoneQuestion.trim())) quality += 0.1;
  if (/^(what|how|why|when|where|which|can|does|is|are|should|would|could)/i.test(stoneQuestion.trim())) {
    quality += 0.05;
  }

  // 3. Specificity (contains at least one concrete noun/concept)
  const hasSpecificTerms = /[A-Z][a-z]{2,}|[a-z]+(?:tion|ment|ness|ity|ism|ics|ogy|phy)/i.test(stoneQuestion);
  if (hasSpecificTerms) quality += 0.1;

  // 4. Novelty (not just parroting the target)
  const overlap = computeTokenOverlap(stoneQuestion, targetQuery);
  if (overlap < 0.3) {
    quality += 0.1; // Good: substantially different
  } else if (overlap > 0.7) {
    quality -= 0.2; // Bad: too similar to target
  }

  return Math.max(0, Math.min(1, quality));
}

/** Simple Jaccard-like token overlap between two strings */
function computeTokenOverlap(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}
