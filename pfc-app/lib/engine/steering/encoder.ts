// ═══════════════════════════════════════════════════════════════════
// ██ SYNTHESIS KEY ENCODER
// ══════════════════════════════════════════════════════════════════
//
// Encodes the full output of a pipeline run (signals + query features)
// into a fixed 40-dimensional normalized vector — the "Synthesis Key".
//
// This is the activation steering equivalent of extracting activations
// from a transformer's residual stream at a specific layer.
// ═══════════════════════════════════════════════════════════════════

import { type SynthesisKey, type QueryFeatureVector, SYNTHESIS_KEY_DIMS } from './types';

// ── Domain & question type enumerations (must match simulate.ts) ──

export const DOMAINS = [
  'philosophical', 'medical', 'science', 'technology',
  'social_science', 'economics', 'psychology', 'ethics', 'general',
] as const;

export const QUESTION_TYPES = [
  'causal', 'comparative', 'definitional', 'evaluative',
  'speculative', 'meta_analytical', 'empirical', 'conceptual',
] as const;

// ── Dimension labels for interpretability ────────────────────────

export const DIMENSION_LABELS: string[] = [
  // Core signals (0-5)
  'confidence', 'entropy', 'dissonance', 'healthScore', 'riskScore', 'safetyState',
  // TDA (6-9)
  'betti0', 'betti1', 'persistenceEntropy', 'maxPersistence',
  // Focus (10-11)
  'focusDepth', 'temperatureScale',
  // Concept (12)
  'harmonyKeyDistance',
  // Query complexity (13)
  'complexity',
  // Domain one-hot (14-22)
  ...DOMAINS.map(d => `domain_${d}`),
  // Question type one-hot (23-30)
  ...QUESTION_TYPES.map(t => `qtype_${t}`),
  // Boolean flags (31-35)
  'isEmpirical', 'isPhilosophical', 'isMetaAnalytical', 'hasSafetyKeywords', 'hasNormativeClaims',
  // Concept fingerprint (36-39)
  'conceptFp0', 'conceptFp1', 'conceptFp2', 'conceptFp3',
];

// ── Normalization bounds ─────────────────────────────────────────

const NORM = {
  betti0Max: 8,
  betti1Max: 5,
  persistenceEntropyMax: 3,
  maxPersistenceMax: 1.0,
  focusDepthMax: 10,
  tempMin: 0.4,
  tempRange: 0.8,  // 1.2 - 0.4
} as const;

// ── Safety state to numeric mapping ──────────────────────────────

const SAFETY_NUMERIC: Record<string, number> = {
  green: 0,
  yellow: 0.33,
  orange: 0.66,
  red: 1.0,
};

// ── Concept fingerprint hash ─────────────────────────────────────
// Maps variable-length concept arrays to 4 fixed hash buckets.
// Preserves set membership without ordering.

function hashConcept(concept: string): number {
  let hash = 0;
  for (let i = 0; i < concept.length; i++) {
    const char = concept.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

function conceptFingerprint(concepts: string[]): [number, number, number, number] {
  const buckets = [0, 0, 0, 0];
  for (const c of concepts) {
    const idx = hashConcept(c) % 4;
    buckets[idx] += 1;
  }
  // Normalize: max concepts per bucket is ~7 (total concepts 3-7)
  const maxPerBucket = Math.max(1, ...buckets);
  return buckets.map(b => b / maxPerBucket) as [number, number, number, number];
}

// ── Signal input interface ───────────────────────────────────────
// Matches the output shape of generateSignals() in simulate.ts

export interface SignalSnapshot {
  confidence: number;
  entropy: number;
  dissonance: number;
  healthScore: number;
  riskScore: number;
  safetyState: string;
  tda: {
    betti0: number;
    betti1: number;
    persistenceEntropy: number;
    maxPersistence: number;
  };
  focusDepth: number;
  temperatureScale: number;
  activeConcepts: string[];
  harmonyKeyDistance: number;
}

export interface QueryAnalysisSnapshot {
  complexity: number;
  domain: string;
  questionType: string;
  isEmpirical: boolean;
  isPhilosophical: boolean;
  isMetaAnalytical: boolean;
  hasSafetyKeywords: boolean;
  hasNormativeClaims: boolean;
  wordCount: number;
  entityCount: number;
}

// ── Main encoder function ────────────────────────────────────────

export function encodeSynthesisKey(
  signals: SignalSnapshot,
  queryAnalysis: QueryAnalysisSnapshot,
  chatId: string,
): SynthesisKey {
  const vector: number[] = new Array(SYNTHESIS_KEY_DIMS).fill(0);

  // Core signals (dims 0-5)
  vector[0] = clamp01(signals.confidence);
  vector[1] = clamp01(signals.entropy);
  vector[2] = clamp01(signals.dissonance);
  vector[3] = clamp01(signals.healthScore);
  vector[4] = clamp01(signals.riskScore);
  vector[5] = SAFETY_NUMERIC[signals.safetyState] ?? 0;

  // TDA (dims 6-9)
  vector[6] = clamp01(signals.tda.betti0 / NORM.betti0Max);
  vector[7] = clamp01(signals.tda.betti1 / NORM.betti1Max);
  vector[8] = clamp01(signals.tda.persistenceEntropy / NORM.persistenceEntropyMax);
  vector[9] = clamp01(signals.tda.maxPersistence / NORM.maxPersistenceMax);

  // Focus (dims 10-11)
  vector[10] = clamp01(signals.focusDepth / NORM.focusDepthMax);
  vector[11] = clamp01((signals.temperatureScale - NORM.tempMin) / NORM.tempRange);

  // Concept harmony (dim 12)
  vector[12] = clamp01(signals.harmonyKeyDistance);

  // Complexity (dim 13)
  vector[13] = clamp01(queryAnalysis.complexity);

  // Domain one-hot (dims 14-22)
  const domainIdx = DOMAINS.indexOf(queryAnalysis.domain as typeof DOMAINS[number]);
  if (domainIdx >= 0) vector[14 + domainIdx] = 1;

  // Question type one-hot (dims 23-30)
  const qtypeIdx = QUESTION_TYPES.indexOf(queryAnalysis.questionType as typeof QUESTION_TYPES[number]);
  if (qtypeIdx >= 0) vector[23 + qtypeIdx] = 1;

  // Boolean flags (dims 31-35)
  vector[31] = queryAnalysis.isEmpirical ? 1 : 0;
  vector[32] = queryAnalysis.isPhilosophical ? 1 : 0;
  vector[33] = queryAnalysis.isMetaAnalytical ? 1 : 0;
  vector[34] = queryAnalysis.hasSafetyKeywords ? 1 : 0;
  vector[35] = queryAnalysis.hasNormativeClaims ? 1 : 0;

  // Concept fingerprint (dims 36-39)
  const fp = conceptFingerprint(signals.activeConcepts);
  vector[36] = fp[0];
  vector[37] = fp[1];
  vector[38] = fp[2];
  vector[39] = fp[3];

  // Build query feature vector (for contextual k-NN)
  const queryFeatures: QueryFeatureVector = {
    domain: domainIdx >= 0 ? domainIdx : 8,  // default to 'general'
    questionType: qtypeIdx >= 0 ? qtypeIdx : 7,  // default to 'conceptual'
    complexity: queryAnalysis.complexity,
    isEmpirical: queryAnalysis.isEmpirical ? 1 : 0,
    isPhilosophical: queryAnalysis.isPhilosophical ? 1 : 0,
    isMetaAnalytical: queryAnalysis.isMetaAnalytical ? 1 : 0,
    hasSafetyKeywords: queryAnalysis.hasSafetyKeywords ? 1 : 0,
    hasNormativeClaims: queryAnalysis.hasNormativeClaims ? 1 : 0,
    wordCount: clamp01(queryAnalysis.wordCount / 100),
    entityCount: clamp01(queryAnalysis.entityCount / 8),
  };

  return {
    vector,
    dimensions: DIMENSION_LABELS,
    queryFeatures,
    id: `sk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    chatId,
  };
}

// ── Vector math utilities ────────────────────────────────────────

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** L2 norm of a vector */
export function vectorNorm(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/** Normalize a vector to unit length */
export function vectorNormalize(v: number[]): number[] {
  const norm = vectorNorm(v);
  if (norm < 1e-10) return new Array(v.length).fill(0);
  return v.map(x => x / norm);
}

/** Element-wise addition */
export function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] ?? 0));
}

/** Element-wise subtraction */
export function vectorSub(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - (b[i] ?? 0));
}

/** Scalar multiplication */
export function vectorScale(v: number[], s: number): number[] {
  return v.map(x => x * s);
}

/** Element-wise mean of multiple vectors */
export function vectorMean(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  return sum.map(x => x / vectors.length);
}

/** Cosine similarity between two vectors */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * (b[i] ?? 0);
    normA += a[i] * a[i];
    normB += (b[i] ?? 0) * (b[i] ?? 0);
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom < 1e-10 ? 0 : dot / denom;
}

/** Dot product */
export function vectorDot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * (b[i] ?? 0);
  return sum;
}

// ── Decode bias back to named signals ────────────────────────────
// Maps a 40-dim bias vector back to the SteeringBias interface fields

import type { SteeringBias } from './types';

export function decodeBiasVector(biasVector: number[], strength: number, source: string): SteeringBias {
  return {
    confidence: biasVector[0] ?? 0,
    entropy: biasVector[1] ?? 0,
    dissonance: biasVector[2] ?? 0,
    healthScore: biasVector[3] ?? 0,
    riskScore: biasVector[4] ?? 0,
    // Denormalize focus/temp from [0,1] bias to original scale
    focusDepth: (biasVector[10] ?? 0) * NORM.focusDepthMax,
    temperatureScale: (biasVector[11] ?? 0) * NORM.tempRange,
    betti0Adjust: (biasVector[6] ?? 0) * NORM.betti0Max,
    betti1Adjust: (biasVector[7] ?? 0) * NORM.betti1Max,
    conceptBoosts: {},
    steeringStrength: strength,
    steeringSource: source,
  };
}
