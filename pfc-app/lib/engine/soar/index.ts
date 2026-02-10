// ═══════════════════════════════════════════════════════════════════
// ██ SOAR — Public API
// ═══════════════════════════════════════════════════════════════════

// Main orchestrator
export { runSOAR, quickProbe } from './engine';
export type { SOAREvent, SOAREventType, SOAREventCallback } from './engine';

// Detector
export { probeLearnability } from './detector';

// Teacher
export { generateCurriculum } from './teacher';

// Student
export { attemptStone, attemptTarget } from './student';

// Reward
export { computeReward, assessStructuralQuality } from './reward';

// Contradiction (OOLONG)
export { extractClaims, scanForContradictions } from './contradiction';

// Types
export type {
  LearnabilityProbe,
  LearnabilityThresholds,
  SteppingStone,
  Curriculum,
  StoneAttempt,
  FinalAttempt,
  SOARReward,
  RewardWeights,
  Contradiction,
  ContradictionScan,
  SOARSession,
  SOARConfig,
  SOARLimitations,
} from './types';

export {
  DEFAULT_LEARNABILITY_THRESHOLDS,
  DEFAULT_REWARD_WEIGHTS,
  DEFAULT_SOAR_CONFIG,
  getSOARLimitations,
} from './types';
