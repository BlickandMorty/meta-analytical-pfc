// ═══════════════════════════════════════════════════════════════════
// ██ ADAPTIVE STEERING ENGINE — 3-Layer Hybrid Computation
// ══════════════════════════════════════════════════════════════════
//
// Layer 1: Contrastive Vector (from steering_engine.py)
//   mean(positive_keys) - mean(negative_keys) → steering direction
//
// Layer 2: Bayesian Prior Adaptation (from bayesian.py)
//   Per-dimension Beta(α,β) priors updated on each outcome
//
// Layer 3: Contextual k-NN Recall (from memory.py + entropy.py)
//   Find nearest successful analyses by query features, steer toward centroid
//
// Hybrid combination: w1·contrastive + w2·bayesian + w3·contextual
// Strength ramps from 0 → 1 as exemplars accumulate (cold start safe)
// ═══════════════════════════════════════════════════════════════════

import type {
  SteeringMemory,
  SteeringBias,
  SteeringConfig,
  SteeringPriors,
  DimensionPrior,
  QueryFeatureVector,
  SteeringVector,
} from './types';
import { createNeutralBias, SYNTHESIS_KEY_DIMS } from './types';
import {
  vectorMean,
  vectorSub,
  vectorNormalize,
  vectorAdd,
  vectorScale,
  cosineSimilarity,
  decodeBiasVector,
  DIMENSION_LABELS,
} from './encoder';
import {
  getPositiveExemplars,
  getNegativeExemplars,
} from './memory';

// ═══════════════════════════════════════════════════════════════════
// LAYER 1: CONTRASTIVE VECTOR
// ═══════════════════════════════════════════════════════════════════
//
// Directly from steering_engine.py:
//   vector = torch.stack(pos_acts).mean(0) - torch.stack(neg_acts).mean(0)
//   vector = vector / vector.norm()

function computeContrastiveVector(
  memory: SteeringMemory,
  threshold: number,
): SteeringVector | null {
  const positives = getPositiveExemplars(memory, threshold);
  const negatives = getNegativeExemplars(memory, threshold);

  // Need at least 2 positive and 1 negative for meaningful direction
  if (positives.length < 2 || negatives.length < 1) return null;

  // Weight by decay: recent exemplars matter more
  const posVectors = positives.map(ex =>
    vectorScale(ex.key.vector, ex.decayWeight),
  );
  const negVectors = negatives.map(ex =>
    vectorScale(ex.key.vector, ex.decayWeight),
  );

  const posMean = vectorMean(posVectors);
  const negMean = vectorMean(negVectors);

  // Contrastive direction: where positive differs from negative
  const rawDirection = vectorSub(posMean, negMean);
  const direction = vectorNormalize(rawDirection);

  // Confidence based on how many exemplars and their separation
  const separation = Math.sqrt(
    rawDirection.reduce((sum, v) => sum + v * v, 0),
  );
  const countFactor = Math.min(1, (positives.length + negatives.length) / 10);
  const confidence = Math.min(1, separation * countFactor);

  return {
    direction,
    magnitude: separation,
    confidence,
    contextMatch: 1.0, // Global — not context-specific
    source: 'contrastive',
  };
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 2: BAYESIAN PRIOR ADAPTATION
// ═══════════════════════════════════════════════════════════════════
//
// From bayesian.py: update_belief(prior, P(evidence|H), P(evidence|¬H))
// Implemented as Beta distribution updates per dimension.
//
// For [0,1] bounded dimensions:
//   Positive outcome with value v_i: α += v_i × lr, β += (1-v_i) × lr
//   Negative outcome with value v_i: α += (1-v_i) × lr, β += v_i × lr
//
// Learning rate: 0.5 × 0.99^sampleCount (slows as data accumulates)

function initPrior(): DimensionPrior {
  return {
    alpha: 2.0,
    beta: 2.0,
    mean: 0.5,
    variance: 0.05,  // Beta(2,2) variance
    sampleCount: 0,
  };
}

function updatePrior(
  prior: DimensionPrior,
  value: number,
  isPositive: boolean,
): DimensionPrior {
  const lr = 0.5 * Math.pow(0.99, prior.sampleCount);
  const v = Math.max(0, Math.min(1, value));

  let newAlpha: number;
  let newBeta: number;

  if (isPositive) {
    // Reinforce the observed value for positive outcomes
    newAlpha = prior.alpha + v * lr;
    newBeta = prior.beta + (1 - v) * lr;
  } else {
    // Reinforce the OPPOSITE of observed value for negative outcomes
    newAlpha = prior.alpha + (1 - v) * lr;
    newBeta = prior.beta + v * lr;
  }

  const total = newAlpha + newBeta;
  const mean = newAlpha / total;
  const variance = (newAlpha * newBeta) / (total * total * (total + 1));

  return {
    alpha: newAlpha,
    beta: newBeta,
    mean,
    variance,
    sampleCount: prior.sampleCount + 1,
  };
}

/** Update all priors with a new exemplar observation */
export function updatePriors(
  priors: SteeringPriors,
  vector: number[],
  isPositive: boolean,
): SteeringPriors {
  const updatedDims: Record<string, DimensionPrior> = { ...priors.dimensions };

  // Only update the first 14 continuous dimensions (signals + TDA + focus + harmony + complexity)
  // Skip one-hot and binary dimensions (they don't benefit from Beta priors)
  const continuousDimCount = 14;

  for (let i = 0; i < continuousDimCount; i++) {
    const label = DIMENSION_LABELS[i];
    const existing = updatedDims[label] ?? initPrior();
    updatedDims[label] = updatePrior(existing, vector[i], isPositive);
  }

  return {
    dimensions: updatedDims,
    globalSteeringStrength: priors.globalSteeringStrength,
    lastUpdated: Date.now(),
  };
}

/** Compute Bayesian steering bias from accumulated priors */
function computeBayesianBias(priors: SteeringPriors): SteeringVector | null {
  const direction = new Array(SYNTHESIS_KEY_DIMS).fill(0);
  let totalConfidence = 0;
  let dimCount = 0;

  for (let i = 0; i < 14; i++) {
    const label = DIMENSION_LABELS[i];
    const prior = priors.dimensions[label];
    if (!prior || prior.sampleCount < 2) continue;

    // Bias = how much the prior mean deviates from neutral (0.5)
    const bias = prior.mean - 0.5;

    // Confidence: inversely proportional to variance
    // Beta(2,2) variance = 0.05. As it sharpens, confidence grows.
    const priorConfidence = Math.max(0, 1 - prior.variance * 20);

    direction[i] = bias * priorConfidence;
    totalConfidence += priorConfidence;
    dimCount++;
  }

  if (dimCount === 0) return null;

  const avgConfidence = totalConfidence / dimCount;

  return {
    direction,
    magnitude: 1.0,
    confidence: avgConfidence,
    contextMatch: 1.0,
    source: 'bayesian',
  };
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 3: CONTEXTUAL k-NN RECALL
// ═══════════════════════════════════════════════════════════════════
//
// From memory.py + entropy.py:
//   Find k nearest positive exemplars by query feature similarity
//   Compute centroid of their signal vectors
//   Context bias = (centroid - globalMean) × contextMatchScore

function queryFeatureToVector(qf: QueryFeatureVector): number[] {
  return [
    qf.domain / 8,  // Normalize to ~[0,1]
    qf.questionType / 7,
    qf.complexity,
    qf.isEmpirical,
    qf.isPhilosophical,
    qf.isMetaAnalytical,
    qf.hasSafetyKeywords,
    qf.hasNormativeClaims,
    qf.wordCount,
    qf.entityCount,
  ];
}

function computeContextualBias(
  memory: SteeringMemory,
  queryFeatures: QueryFeatureVector,
  k: number,
  threshold: number,
): SteeringVector | null {
  const positives = getPositiveExemplars(memory, threshold);
  if (positives.length < 2) return null;

  const queryVec = queryFeatureToVector(queryFeatures);

  // Compute similarity of each positive exemplar's query features to current query
  const scored = positives.map(ex => ({
    exemplar: ex,
    similarity: cosineSimilarity(
      queryVec,
      queryFeatureToVector(ex.key.queryFeatures),
    ),
  }));

  // Sort by similarity, take top k
  scored.sort((a, b) => b.similarity - a.similarity);
  const topK = scored.slice(0, k);

  if (topK.length === 0) return null;

  // Compute centroid of top-k signal vectors (weighted by decay × similarity)
  const weightedVectors = topK.map(({ exemplar, similarity }) =>
    vectorScale(exemplar.key.vector, exemplar.decayWeight * similarity),
  );
  const totalWeight = topK.reduce(
    (sum, { exemplar, similarity }) => sum + exemplar.decayWeight * similarity,
    0,
  );

  if (totalWeight < 1e-10) return null;

  const centroid = weightedVectors.reduce(
    (acc, v) => vectorAdd(acc, v),
    new Array(SYNTHESIS_KEY_DIMS).fill(0),
  ).map(v => v / totalWeight);

  // Global mean of ALL exemplars
  const globalMean = vectorMean(memory.exemplars.map(ex => ex.key.vector));

  // Contextual direction = how the best matches differ from the global mean
  const direction = vectorSub(centroid, globalMean);

  // Context match score = average similarity of top k
  const contextMatch = topK.reduce((sum, s) => sum + s.similarity, 0) / topK.length;

  return {
    direction,
    magnitude: 1.0,
    confidence: Math.min(1, topK.length / k),
    contextMatch,
    source: 'contextual',
  };
}

// ═══════════════════════════════════════════════════════════════════
// HYBRID COMBINATION
// ═══════════════════════════════════════════════════════════════════
//
// finalBias = w1·contrastive + w2·bayesian + w3·contextual
// steeringStrength = min(1.0, sqrt(totalExemplars / rampUpThreshold))
// appliedBias = finalBias × steeringStrength × userMasterDial

export function computeSteeringBias(
  memory: SteeringMemory,
  queryFeatures: QueryFeatureVector,
  config: SteeringConfig,
): SteeringBias {
  if (!config.enabled) return createNeutralBias();

  const totalExemplars = memory.exemplars.length;
  if (totalExemplars < 3) return createNeutralBias();

  // Compute steering strength ramp-up
  // sqrt(n/20): 0 at 0 exemplars, 0.5 at 5, 0.71 at 10, 1.0 at 20+
  const rampStrength = Math.min(1.0, Math.sqrt(totalExemplars / config.rampUpThreshold));

  // Layer 1: Contrastive
  const contrastive = computeContrastiveVector(memory, config.outcomeThreshold);

  // Layer 2: Bayesian
  const bayesian = computeBayesianBias(memory.priors);

  // Layer 3: Contextual
  const contextual = computeContextualBias(
    memory, queryFeatures, config.kNeighbors, config.outcomeThreshold,
  );

  // Combine layers
  const combined = new Array(SYNTHESIS_KEY_DIMS).fill(0);
  const sources: string[] = [];

  if (contrastive) {
    const scaled = vectorScale(contrastive.direction, config.weights.contrastive * contrastive.confidence);
    for (let i = 0; i < SYNTHESIS_KEY_DIMS; i++) combined[i] += scaled[i];
    sources.push(`contrastive(${(contrastive.confidence * 100).toFixed(0)}%)`);
  }

  if (bayesian) {
    const scaled = vectorScale(bayesian.direction, config.weights.bayesian * bayesian.confidence);
    for (let i = 0; i < SYNTHESIS_KEY_DIMS; i++) combined[i] += scaled[i];
    sources.push(`bayesian(${(bayesian.confidence * 100).toFixed(0)}%)`);
  }

  if (contextual) {
    const scaled = vectorScale(contextual.direction, config.weights.contextual * contextual.confidence * contextual.contextMatch);
    for (let i = 0; i < SYNTHESIS_KEY_DIMS; i++) combined[i] += scaled[i];
    sources.push(`contextual(${(contextual.contextMatch * 100).toFixed(0)}% match)`);
  }

  // If no layers contributed, return neutral
  if (sources.length === 0) return createNeutralBias();

  // Apply overall strength: ramp × master dial
  const finalStrength = rampStrength * config.masterStrength;
  const finalBias = vectorScale(combined, finalStrength);

  // Decode the 40-dim bias vector into named signal adjustments
  const bias = decodeBiasVector(finalBias, finalStrength, sources.join(' + '));

  // Cap individual biases to prevent extreme swings
  bias.confidence = clampBias(bias.confidence, 0.15);
  bias.entropy = clampBias(bias.entropy, 0.15);
  bias.dissonance = clampBias(bias.dissonance, 0.15);
  bias.healthScore = clampBias(bias.healthScore, 0.1);
  bias.riskScore = clampBias(bias.riskScore, 0.1);
  bias.focusDepth = clampBias(bias.focusDepth, 1.5);
  bias.temperatureScale = clampBias(bias.temperatureScale, 0.2);
  bias.betti0Adjust = clampBias(bias.betti0Adjust, 1.0);
  bias.betti1Adjust = clampBias(bias.betti1Adjust, 1.0);

  return bias;
}

function clampBias(value: number, maxAbs: number): number {
  return Math.max(-maxAbs, Math.min(maxAbs, value));
}

// ═══════════════════════════════════════════════════════════════════
// PCA PROJECTION (for Steering Lab visualization)
// ═══════════════════════════════════════════════════════════════════
//
// Simple 2-component PCA via power iteration.
// Projects the 40-dim synthesis keys to 2D for scatter plot.

interface PCAResult {
  points: Array<{ x: number; y: number; id: string; score: number }>;
  steeringArrow: { dx: number; dy: number } | null;
  varianceExplained: [number, number];
}

export function projectPCA(memory: SteeringMemory): PCAResult | null {
  if (memory.exemplars.length < 3) return null;

  const vectors = memory.exemplars.map(ex => ex.key.vector);
  const mean = vectorMean(vectors);

  // Center the data
  const centered = vectors.map(v => vectorSub(v, mean));

  // Power iteration for top 2 eigenvectors of the covariance matrix
  const pc1 = powerIteration(centered, 50);
  const pc2 = powerIteration(centered, 50, pc1);

  // Project each exemplar
  const points = memory.exemplars.map(ex => {
    const c = vectorSub(ex.key.vector, mean);
    return {
      x: dotProduct(c, pc1),
      y: dotProduct(c, pc2),
      id: ex.key.id,
      score: ex.outcome.compositeScore,
    };
  });

  // Project the contrastive steering direction
  let steeringArrow: { dx: number; dy: number } | null = null;
  if (memory.contrastiveVector) {
    steeringArrow = {
      dx: dotProduct(memory.contrastiveVector, pc1),
      dy: dotProduct(memory.contrastiveVector, pc2),
    };
  }

  // Estimate variance explained (simplified)
  const totalVar = centered.reduce((sum, v) => sum + v.reduce((s, x) => s + x * x, 0), 0);
  const var1 = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const var2 = points.reduce((sum, p) => sum + p.y * p.y, 0);

  return {
    points,
    steeringArrow,
    varianceExplained: [
      totalVar > 0 ? var1 / totalVar : 0,
      totalVar > 0 ? var2 / totalVar : 0,
    ],
  };
}

// Power iteration to find dominant eigenvector
function powerIteration(
  centered: number[][],
  iterations: number,
  deflateBy?: number[],
): number[] {
  const dim = centered[0]?.length ?? SYNTHESIS_KEY_DIMS;

  // Random initial vector
  let v = new Array(dim).fill(0).map(() => Math.random() - 0.5);
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  v = v.map(x => x / norm);

  for (let iter = 0; iter < iterations; iter++) {
    // Multiply by covariance: Σ = (1/n) X^T X
    const newV = new Array(dim).fill(0);
    for (const row of centered) {
      const proj = dotProduct(row, v);
      for (let i = 0; i < dim; i++) newV[i] += row[i] * proj;
    }

    // Deflate if finding second component
    if (deflateBy) {
      const overlap = dotProduct(newV, deflateBy);
      for (let i = 0; i < dim; i++) newV[i] -= overlap * deflateBy[i];
    }

    // Normalize
    norm = Math.sqrt(newV.reduce((s, x) => s + x * x, 0));
    if (norm < 1e-10) break;
    v = newV.map(x => x / norm);
  }

  return v;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * (b[i] ?? 0);
  return sum;
}
