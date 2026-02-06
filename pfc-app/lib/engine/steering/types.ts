// ═══════════════════════════════════════════════════════════════════
// ██ ADAPTIVE STEERING ENGINE — Type Definitions
// ══════════════════════════════════════════════════════════════════
//
// Core types for the 3-layer hybrid steering system:
//   Layer 1: Contrastive Vectors (from Activation Steering Final)
//   Layer 2: Bayesian Prior Adaptation (from Adaptive Immune AI)
//   Layer 3: Contextual k-NN Recall (from Immune Memory + Aletheia)
// ═══════════════════════════════════════════════════════════════════

/** Total fixed dimensions in the synthesis key vector */
export const SYNTHESIS_KEY_DIMS = 40;

// ── Synthesis Key: fixed-length encoding of a pipeline run ────────

export interface SynthesisKey {
  /** 40-dimensional normalized vector encoding all signals + query features */
  vector: number[];
  /** Dimension labels in order (for interpretability) */
  dimensions: string[];
  /** Query-level features for contextual matching (separate from signal dims) */
  queryFeatures: QueryFeatureVector;
  /** Unique identifier */
  id: string;
  /** Epoch timestamp */
  timestamp: number;
  /** Associated chat session */
  chatId: string;
}

export interface QueryFeatureVector {
  /** Domain one-hot index (0-8) */
  domain: number;
  /** Question type one-hot index (0-7) */
  questionType: number;
  /** Complexity score 0-1 */
  complexity: number;
  /** Boolean flags as 0/1 */
  isEmpirical: number;
  isPhilosophical: number;
  isMetaAnalytical: number;
  hasSafetyKeywords: number;
  hasNormativeClaims: number;
  /** Normalized word count (wordCount / 100, clamped 0-1) */
  wordCount: number;
  /** Normalized entity count (entityCount / 8, clamped 0-1) */
  entityCount: number;
}

// ── Outcome: what we learn from each analysis ────────────────────

export interface SteeringOutcome {
  /** Links to the synthesis key */
  synthesisKeyId: string;
  /** Auto-derived quality score from truth assessment + signals (0-1) */
  autoQuality: number;
  /** Optional user feedback: -1 (bad), 0 (neutral), 1 (good) */
  userRating: number | null;
  /** Weighted composite: auto + user (range: -1 to 1) */
  compositeScore: number;
  /** Epoch timestamp */
  timestamp: number;
}

// ── Bayesian Prior State ─────────────────────────────────────────

export interface DimensionPrior {
  /** Beta distribution alpha (pseudo-count for "good" observations) */
  alpha: number;
  /** Beta distribution beta (pseudo-count for "bad" observations) */
  beta: number;
  /** Derived: alpha / (alpha + beta) */
  mean: number;
  /** Derived: (alpha * beta) / ((alpha + beta)² × (alpha + beta + 1)) */
  variance: number;
  /** Total observations that updated this prior */
  sampleCount: number;
}

export interface SteeringPriors {
  /** Per-dimension Beta priors keyed by dimension name */
  dimensions: Record<string, DimensionPrior>;
  /** How aggressively the system steers (0-1, adaptive) */
  globalSteeringStrength: number;
  /** Last update timestamp */
  lastUpdated: number;
}

// ── Steering Vector: the computed direction to apply ─────────────

export interface SteeringVector {
  /** 40-dim direction vector (unit-normalized) */
  direction: number[];
  /** Magnitude/strength to apply */
  magnitude: number;
  /** Data confidence (0-1): how much data backs this */
  confidence: number;
  /** Context match (0-1): how well current query matches history */
  contextMatch: number;
  /** Which computation produced this */
  source: 'contrastive' | 'bayesian' | 'contextual' | 'hybrid';
}

// ── Steering Exemplar: a synthesis key with its outcome ──────────

export interface SteeringExemplar {
  /** The encoded pipeline run */
  key: SynthesisKey;
  /** The measured outcome */
  outcome: SteeringOutcome;
  /** Exponential decay weight (1.0 when fresh, decays over time) */
  decayWeight: number;
}

// ── Steering Memory: the persistent store ────────────────────────

export interface SteeringMemory {
  /** All recorded exemplars with outcomes */
  exemplars: SteeringExemplar[];
  /** Accumulated Bayesian priors */
  priors: SteeringPriors;
  /** Cached contrastive vector (recomputed when exemplars change) */
  contrastiveVector: number[] | null;
  /** Per-domain steering vectors */
  domainVectors: Record<string, number[]>;
  /** Counts */
  totalPositive: number;
  totalNegative: number;
  /** Schema version for migrations */
  version: number;
}

// ── Steering Bias: what gets applied to signal generation ────────

export interface SteeringBias {
  /** Per-signal additive adjustments (applied before clamping) */
  confidence: number;
  entropy: number;
  dissonance: number;
  healthScore: number;
  riskScore: number;
  focusDepth: number;
  temperatureScale: number;
  /** TDA adjustments */
  betti0Adjust: number;
  betti1Adjust: number;
  /** Per-concept weight boosts */
  conceptBoosts: Record<string, number>;
  /** Overall dampening factor 0-1 (from exemplar count ramp-up) */
  steeringStrength: number;
  /** Debug: which layers contributed and how much */
  steeringSource: string;
}

// ── Layer weights for hybrid combination ─────────────────────────

export interface LayerWeights {
  /** Contrastive vector weight (default 0.40) */
  contrastive: number;
  /** Bayesian prior weight (default 0.35) */
  bayesian: number;
  /** Contextual k-NN weight (default 0.25) */
  contextual: number;
}

// ── Steering configuration (user-adjustable) ─────────────────────

export interface SteeringConfig {
  /** Master on/off */
  enabled: boolean;
  /** User master dial 0-1 (multiplies final bias) */
  masterStrength: number;
  /** How many exemplars for full steering strength */
  rampUpThreshold: number;
  /** k for nearest-neighbor matching */
  kNeighbors: number;
  /** Positive/negative classification threshold */
  outcomeThreshold: number;
  /** Layer weights */
  weights: LayerWeights;
  /** Exponential decay rate per day */
  decayRate: number;
  /** Max exemplars before pruning */
  maxExemplars: number;
}

// ── Default configuration ────────────────────────────────────────

export const DEFAULT_STEERING_CONFIG: SteeringConfig = {
  enabled: true,
  masterStrength: 1.0,
  rampUpThreshold: 20,
  kNeighbors: 5,
  outcomeThreshold: 0.3,
  weights: {
    contrastive: 0.40,
    bayesian: 0.35,
    contextual: 0.25,
  },
  decayRate: 0.95,
  maxExemplars: 500,
};

// ── Empty/initial states ─────────────────────────────────────────

export function createEmptyPriors(): SteeringPriors {
  return {
    dimensions: {},
    globalSteeringStrength: 0,
    lastUpdated: Date.now(),
  };
}

export function createEmptyMemory(): SteeringMemory {
  return {
    exemplars: [],
    priors: createEmptyPriors(),
    contrastiveVector: null,
    domainVectors: {},
    totalPositive: 0,
    totalNegative: 0,
    version: 1,
  };
}

export function createNeutralBias(): SteeringBias {
  return {
    confidence: 0,
    entropy: 0,
    dissonance: 0,
    healthScore: 0,
    riskScore: 0,
    focusDepth: 0,
    temperatureScale: 0,
    betti0Adjust: 0,
    betti1Adjust: 0,
    conceptBoosts: {},
    steeringStrength: 0,
    steeringSource: 'none',
  };
}
