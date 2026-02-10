// ═══════════════════════════════════════════════════════════════════
// ██ SOAR — Edge-of-Learnability Detector
// ═══════════════════════════════════════════════════════════════════
//
// Quick probe to determine if a query sits at the model's learnability
// edge. When success rate collapses toward zero, RL has nothing to
// optimize — the gradient landscape becomes flat. This detector
// identifies that condition before committing to a full pipeline run.
// ═══════════════════════════════════════════════════════════════════

import type { QueryAnalysis } from '../simulate';
import type {
  LearnabilityProbe,
  LearnabilityThresholds,
} from './types';

// ---------------------------------------------------------------------------
// Difficulty heuristics
// ---------------------------------------------------------------------------

/** Keywords that correlate with hard-to-reason queries */
const HARD_INDICATORS = [
  'paradox', 'contradiction', 'dilemma', 'impossible', 'unsolvable',
  'undecidable', 'np-hard', 'intractable', 'unprovable', 'incompleteness',
  'infinite regress', 'self-referential', 'emergent', 'consciousness',
  'qualia', 'free will', 'hard problem', 'meta-analysis of meta-analyses',
  'causal inference from observational', 'confounding', 'selection bias',
  'simpson\'s paradox', 'ecological fallacy', 'counterfactual',
  'multi-step reasoning', 'abductive', 'non-monotonic', 'defeasible',
];

/** Question types that tend to be harder */
const HARD_QUESTION_TYPES = new Set([
  'meta_analytical', 'causal', 'speculative',
]);

/** Domains that tend to produce lower confidence */
const HARD_DOMAINS = new Set([
  'philosophy', 'metaphysics', 'ethics', 'consciousness',
  'quantum', 'complex_systems', 'epistemology',
]);

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

/**
 * Perform a lightweight learnability probe on a query analysis.
 * This runs BEFORE the full pipeline to decide if SOAR should engage.
 *
 * The probe estimates difficulty from query features alone (no LLM call),
 * making it near-instant. It checks:
 * 1. Query complexity (from triage)
 * 2. Hard indicator keywords
 * 3. Question type difficulty
 * 4. Domain difficulty
 * 5. Entity count / structural complexity
 * 6. Whether prior runs on similar queries had low confidence
 */
export function probeLearnability(
  qa: QueryAnalysis,
  priorSignals?: { confidence: number; entropy: number; dissonance: number },
  thresholds: LearnabilityThresholds = {
    confidenceFloor: 0.35,
    entropyCeiling: 0.7,
    dissonanceCeiling: 0.6,
    difficultyFloor: 0.5,
  },
): LearnabilityProbe {
  const queryLower = qa.coreQuestion.toLowerCase();

  // 1. Base difficulty from triage complexity
  let difficulty = qa.complexity ?? 0.5;

  // 2. Hard indicator keyword scan
  let hardKeywordCount = 0;
  for (const kw of HARD_INDICATORS) {
    if (queryLower.includes(kw)) hardKeywordCount++;
  }
  difficulty += Math.min(0.2, hardKeywordCount * 0.05);

  // 3. Question type difficulty
  if (HARD_QUESTION_TYPES.has(qa.questionType)) {
    difficulty += 0.1;
  }

  // 4. Domain difficulty
  if (HARD_DOMAINS.has(qa.domain)) {
    difficulty += 0.08;
  }

  // 5. Structural complexity (entity count)
  const entityCount = qa.entities?.length ?? 0;
  if (entityCount > 5) difficulty += 0.05;
  if (entityCount > 10) difficulty += 0.05;

  // 6. Multi-hop reasoning detection (question length as proxy)
  const wordCount = qa.coreQuestion.split(/\s+/).length;
  if (wordCount > 50) difficulty += 0.05;
  if (wordCount > 100) difficulty += 0.05;

  difficulty = Math.min(1, Math.max(0, difficulty));

  // Estimate initial confidence and entropy from difficulty
  // These are rough proxies — the real values come from the pipeline
  const probeConfidence = Math.max(0.05, 0.9 - difficulty * 0.8 + (Math.random() - 0.5) * 0.1);
  const probeEntropy = Math.min(0.95, 0.1 + difficulty * 0.7 + (Math.random() - 0.5) * 0.1);

  // Use prior signals if available (from a previous run on this query)
  const effectiveConfidence = priorSignals?.confidence ?? probeConfidence;
  const effectiveEntropy = priorSignals?.entropy ?? probeEntropy;
  const effectiveDissonance = priorSignals?.dissonance ?? difficulty * 0.5;

  // Edge detection: all conditions must be met
  const belowConfidence = effectiveConfidence < thresholds.confidenceFloor;
  const aboveEntropy = effectiveEntropy > thresholds.entropyCeiling;
  const aboveDissonance = effectiveDissonance > thresholds.dissonanceCeiling;
  const aboveDifficulty = difficulty >= thresholds.difficultyFloor;

  // Need difficulty threshold + at least 2 of the 3 signal conditions
  const signalTriggers = [belowConfidence, aboveEntropy, aboveDissonance].filter(Boolean).length;
  const atEdge = aboveDifficulty && signalTriggers >= 2;

  // Determine recommended iteration depth based on severity
  let recommendedDepth = 0;
  if (atEdge) {
    if (signalTriggers === 3) {
      recommendedDepth = 3; // All three signals triggered — deep SOAR
    } else if (difficulty > 0.8) {
      recommendedDepth = 3; // Very hard problem
    } else {
      recommendedDepth = 2; // Moderate difficulty
    }
  }

  // Build reason string
  let reason: string;
  if (!aboveDifficulty) {
    reason = `Query difficulty (${difficulty.toFixed(2)}) below threshold (${thresholds.difficultyFloor}). Standard pipeline sufficient.`;
  } else if (signalTriggers < 2) {
    reason = `Difficulty is high (${difficulty.toFixed(2)}) but only ${signalTriggers}/3 signal thresholds triggered. SOAR not needed.`;
  } else {
    const triggers: string[] = [];
    if (belowConfidence) triggers.push(`confidence ${effectiveConfidence.toFixed(2)} < ${thresholds.confidenceFloor}`);
    if (aboveEntropy) triggers.push(`entropy ${effectiveEntropy.toFixed(2)} > ${thresholds.entropyCeiling}`);
    if (aboveDissonance) triggers.push(`dissonance ${effectiveDissonance.toFixed(2)} > ${thresholds.dissonanceCeiling}`);
    reason = `At learnability edge: ${triggers.join(', ')}. Difficulty: ${difficulty.toFixed(2)}. SOAR recommended (depth ${recommendedDepth}).`;
  }

  return {
    estimatedDifficulty: difficulty,
    probeConfidence: effectiveConfidence,
    probeEntropy: effectiveEntropy,
    atEdge,
    reason,
    recommendedDepth,
    timestamp: Date.now(),
  };
}
