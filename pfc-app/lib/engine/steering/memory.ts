// ═══════════════════════════════════════════════════════════════════
// ██ STEERING MEMORY — Persistent Exemplar Store with Decay
// ══════════════════════════════════════════════════════════════════
//
// Exponential decay weighted exemplar history:
//   - Decay rate = 0.95 per day
//   - Pruning of low-weight exemplars
//   - localStorage persistence (follows Cortex Archive pattern)
// ═══════════════════════════════════════════════════════════════════

import type {
  SteeringMemory,
  SteeringExemplar,
  SynthesisKey,
  SteeringOutcome,
  SteeringConfig,
} from './types';
import { createEmptyMemory } from './types';

const STORAGE_KEY = 'pfc-steering-memory';
const MS_PER_DAY = 86400000;

// ── Decay computation ────────────────────────────────────────────
// Exponential decay: weight = decay_rate ^ (days_since_creation)

function computeDecayWeight(
  timestamp: number,
  now: number,
  decayRate: number,
): number {
  const daysSince = (now - timestamp) / MS_PER_DAY;
  return Math.pow(decayRate, daysSince);
}

// ── Add exemplar to memory ───────────────────────────────────────

export function addExemplar(
  memory: SteeringMemory,
  key: SynthesisKey,
  outcome: SteeringOutcome,
  config: SteeringConfig,
): SteeringMemory {
  const exemplar: SteeringExemplar = {
    key,
    outcome,
    decayWeight: 1.0,  // Fresh exemplar = full weight
  };

  // Update counts
  const isPositive = outcome.compositeScore > config.outcomeThreshold;
  const isNegative = outcome.compositeScore < -config.outcomeThreshold;

  const updated: SteeringMemory = {
    ...memory,
    exemplars: [...memory.exemplars, exemplar],
    totalPositive: memory.totalPositive + (isPositive ? 1 : 0),
    totalNegative: memory.totalNegative + (isNegative ? 1 : 0),
  };

  // Only refresh decay weights when pruning is needed (O(n) amortized over maxExemplars adds)
  if (updated.exemplars.length > config.maxExemplars) {
    const refreshed = refreshDecayWeights(updated, Date.now(), config.decayRate);
    return pruneExemplars(refreshed, config.maxExemplars);
  }

  return updated;
}

// ── Refresh decay weights ────────────────────────────────────────

export function refreshDecayWeights(
  memory: SteeringMemory,
  now: number,
  decayRate: number,
): SteeringMemory {
  return {
    ...memory,
    exemplars: memory.exemplars.map(ex => ({
      ...ex,
      decayWeight: computeDecayWeight(ex.key.timestamp, now, decayRate),
    })),
  };
}

// ── Prune low-weight exemplars ───────────────────────────────────
// Removes exemplars with the lowest decay weight, keeping maxCount

function pruneExemplars(
  memory: SteeringMemory,
  maxCount: number,
): SteeringMemory {
  if (memory.exemplars.length <= maxCount) return memory;

  const sorted = [...memory.exemplars].sort((a, b) => b.decayWeight - a.decayWeight);
  const kept = sorted.slice(0, maxCount);

  // Recount positive/negative
  let totalPositive = 0;
  let totalNegative = 0;
  for (const ex of kept) {
    if (ex.outcome.compositeScore > 0.3) totalPositive++;
    if (ex.outcome.compositeScore < -0.3) totalNegative++;
  }

  return {
    ...memory,
    exemplars: kept,
    totalPositive,
    totalNegative,
  };
}

// ── Get positive / negative exemplar subsets ─────────────────────

export function getPositiveExemplars(
  memory: SteeringMemory,
  threshold: number,
): SteeringExemplar[] {
  return memory.exemplars.filter(ex => ex.outcome.compositeScore > threshold);
}

export function getNegativeExemplars(
  memory: SteeringMemory,
  threshold: number,
): SteeringExemplar[] {
  return memory.exemplars.filter(ex => ex.outcome.compositeScore < -threshold);
}

// ── Get weighted vectors ─────────────────────────────────────────
// Returns synthesis key vectors weighted by their decay

// ── Update user rating on an existing exemplar ───────────────────

export function updateExemplarRating(
  memory: SteeringMemory,
  synthesisKeyId: string,
  userRating: number,
): SteeringMemory {
  return {
    ...memory,
    exemplars: memory.exemplars.map(ex => {
      if (ex.key.id !== synthesisKeyId) return ex;

      const updatedOutcome: SteeringOutcome = {
        ...ex.outcome,
        userRating,
        // Recompute composite: 30% auto + 70% user when user rates
        compositeScore: 0.3 * ex.outcome.autoQuality + 0.7 * userRating,
      };

      return { ...ex, outcome: updatedOutcome };
    }),
  };
}

// ── localStorage persistence ─────────────────────────────────────

export function saveMemoryToStorage(memory: SteeringMemory): void {
  try {
    const json = JSON.stringify(memory);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    console.warn('[steering/memory] Failed to save:', e);
  }
}

export function loadMemoryFromStorage(): SteeringMemory {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return createEmptyMemory();

    const parsed = JSON.parse(json) as SteeringMemory;

    // Validate version
    if (!parsed.version || parsed.version < 1) {
      return createEmptyMemory();
    }

    return parsed;
  } catch (e) {
    console.warn('[steering/memory] Failed to load:', e);
    return createEmptyMemory();
  }
}

export function clearMemoryFromStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[steering/memory] Failed to clear:', e);
  }
}

// ── Export / Import (for sharing) ────────────────────────────────

export function exportMemory(memory: SteeringMemory): string {
  return JSON.stringify(memory, null, 2);
}

export function importMemory(json: string): SteeringMemory | null {
  try {
    const parsed = JSON.parse(json) as SteeringMemory;
    if (!parsed.version || !Array.isArray(parsed.exemplars)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ── Memory statistics ────────────────────────────────────────────

export interface MemoryStats {
  totalExemplars: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  averageDecayWeight: number;
  oldestTimestamp: number;
  newestTimestamp: number;
  uniqueDomains: string[];
  userRatedCount: number;
}

export function getMemoryStats(memory: SteeringMemory, decayRate = 0.95): MemoryStats {
  if (memory.exemplars.length === 0) {
    return {
      totalExemplars: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      averageDecayWeight: 0,
      oldestTimestamp: 0,
      newestTimestamp: 0,
      uniqueDomains: [],
      userRatedCount: 0,
    };
  }

  const now = Date.now();
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let decaySum = 0;
  let userRatedCount = 0;
  let oldest = Infinity;
  let newest = 0;
  const domains = new Set<string>();

  for (const ex of memory.exemplars) {
    if (ex.outcome.compositeScore > 0.3) positiveCount++;
    else if (ex.outcome.compositeScore < -0.3) negativeCount++;
    else neutralCount++;

    decaySum += computeDecayWeight(ex.key.timestamp, now, decayRate);

    if (ex.outcome.userRating !== null) userRatedCount++;

    const ts = ex.key.timestamp;
    if (ts < oldest) oldest = ts;
    if (ts > newest) newest = ts;

    // Extract domain from query features
    const domIdx = ex.key.queryFeatures.domain;
    const domainNames = [
      'philosophical', 'medical', 'science', 'technology',
      'social_science', 'economics', 'psychology', 'ethics', 'general',
    ];
    if (domIdx >= 0 && domIdx < domainNames.length) {
      domains.add(domainNames[domIdx]!);
    }
  }

  return {
    totalExemplars: memory.exemplars.length,
    positiveCount,
    negativeCount,
    neutralCount,
    averageDecayWeight: decaySum / memory.exemplars.length,
    oldestTimestamp: oldest,
    newestTimestamp: newest,
    uniqueDomains: [...domains],
    userRatedCount,
  };
}
