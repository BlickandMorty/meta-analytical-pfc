// ═══════════════════════════════════════════════════════════════════
// ██ STEERING FEEDBACK — Outcome Quality Computation
// ══════════════════════════════════════════════════════════════════
//
// Computes a quality score for each pipeline run from:
//   1. Auto-quality: derived from truth assessment + signal health
//   2. User rating: optional thumbs up/down (weighted 3× more)
//
// From verification-toolkit/truth_engine: the Generate → Audit → Correct
// loop is mirrored here — the truth assessment IS the audit, and
// steering IS the correction applied to future runs.
// ═══════════════════════════════════════════════════════════════════

import type { SteeringOutcome } from './types';

// ── Truth Assessment interface (matches truthbot.ts output) ──────

export interface TruthAssessmentInput {
  overallTruthLikelihood: number;  // 0-1
  consensus: boolean;
  disagreements: string[];
}

// ── Signal state for quality computation ─────────────────────────

export interface SignalStateInput {
  confidence: number;
  entropy: number;
  dissonance: number;
  healthScore: number;
  riskScore: number;
}

// ── Compute auto-quality score ───────────────────────────────────
//
// Formula:
//   autoQuality = 0.4 × truthLikelihood
//               + 0.3 × healthScore
//               + 0.2 × (consensus ? 1 : 0)
//               + 0.1 × (1 - entropy)
//
// Range: 0.0 to 1.0 (higher = better analysis)

export function computeAutoQuality(
  truthAssessment: TruthAssessmentInput | null,
  signals: SignalStateInput,
): number {
  const truthLikelihood = truthAssessment?.overallTruthLikelihood ?? 0.5;
  const consensus = truthAssessment?.consensus ?? false;
  const disagreements = truthAssessment?.disagreements?.length ?? 0;

  // Core formula
  let quality =
    0.4 * truthLikelihood +
    0.3 * signals.healthScore +
    0.2 * (consensus ? 1 : 0) +
    0.1 * (1 - signals.entropy);

  // Penalty for disagreements (each disagreement reduces quality slightly)
  quality -= disagreements * 0.03;

  // Penalty for high risk
  if (signals.riskScore > 0.5) {
    quality -= (signals.riskScore - 0.5) * 0.2;
  }

  // Penalty for high dissonance
  if (signals.dissonance > 0.5) {
    quality -= (signals.dissonance - 0.5) * 0.15;
  }

  return Math.max(0, Math.min(1, quality));
}

// ── Compute composite score ──────────────────────────────────────
//
// Combines auto-quality with optional user rating:
//   - No user rating: composite = autoQuality mapped to [-1, 1]
//   - With user rating: 30% auto + 70% user (user rating is 3× more valuable)
//
// Maps autoQuality (0-1) to composite (-1 to 1):
//   autoQuality < 0.35 → negative (poor analysis)
//   autoQuality 0.35-0.65 → near zero (neutral)
//   autoQuality > 0.65 → positive (good analysis)

export function computeCompositeScore(
  autoQuality: number,
  userRating: number | null,
): number {
  // Map auto quality from [0,1] to [-1,1] with neutral zone
  const autoMapped = (autoQuality - 0.5) * 2;

  if (userRating !== null) {
    // User rating dominates: 30% auto + 70% user
    return 0.3 * autoMapped + 0.7 * userRating;
  }

  return autoMapped;
}

// ── Create a complete steering outcome ───────────────────────────

export function createSteeringOutcome(
  synthesisKeyId: string,
  truthAssessment: TruthAssessmentInput | null,
  signals: SignalStateInput,
  userRating?: number | null,
): SteeringOutcome {
  const autoQuality = computeAutoQuality(truthAssessment, signals);
  const compositeScore = computeCompositeScore(autoQuality, userRating ?? null);

  return {
    synthesisKeyId,
    autoQuality,
    userRating: userRating ?? null,
    compositeScore,
    timestamp: Date.now(),
  };
}

// ── Update an existing outcome with user rating ──────────────────

export function updateOutcomeWithRating(
  existing: SteeringOutcome,
  userRating: number,
): SteeringOutcome {
  return {
    ...existing,
    userRating,
    compositeScore: computeCompositeScore(existing.autoQuality, userRating),
  };
}
