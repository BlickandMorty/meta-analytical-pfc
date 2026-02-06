// ═══════════════════════════════════════════════════════════════════
// ██ LLM SCHEMAS — Zod Schemas for Structured LLM Output
// ═══════════════════════════════════════════════════════════════════
//
// These schemas match EXACTLY the TypeScript interfaces in lib/engine/types.ts.
// Used with generateObject() to guarantee type-safe structured output from LLMs.
// ═══════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ── LaymanSummary (types.ts:17-30) ──────────────────────────────

export const laymanSummarySchema = z.object({
  whatWasTried: z.string().describe(
    'Brief description of what analytical approach was used to evaluate the query. 2-4 sentences.',
  ),
  whatIsLikelyTrue: z.string().describe(
    'The core finding or insight. This is the main output streamed to the user. 3-6 sentences of substantive analysis.',
  ),
  confidenceExplanation: z.string().describe(
    'Why the confidence level is what it is. Reference specific evidence strengths and weaknesses. 2-4 sentences.',
  ),
  whatCouldChange: z.string().describe(
    'What new evidence, framings, or data could shift the analysis. 2-3 sentences.',
  ),
  whoShouldTrust: z.string().describe(
    'Who this analysis is most useful for and how to critically evaluate it. 2-3 sentences.',
  ),
});

// ── ReflectionResult (types.ts:32-37) ───────────────────────────

export const reflectionResultSchema = z.object({
  selfCriticalQuestions: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe('Critical questions the system should ask about its own analysis'),
  adjustments: z
    .array(z.string())
    .describe('Confidence adjustments applied during self-reflection, e.g. "Reduced confidence by 5% due to limited sample size"'),
  leastDefensibleClaim: z
    .string()
    .describe('The single claim in the analysis that is most vulnerable to challenge'),
  precisionVsEvidenceCheck: z
    .string()
    .describe('Assessment of whether numerical precision exceeds evidential warrant'),
});

// ── EngineVote + ArbitrationResult (types.ts:39-51) ─────────────

export const engineVoteSchema = z.object({
  engine: z.string().describe('The pipeline stage name (e.g. "statistical", "causal", "bayesian")'),
  position: z.enum(['supports', 'opposes', 'neutral']),
  reasoning: z.string().describe('Why this engine takes this position. 1-2 sentences.'),
  confidence: z.number().min(0).max(1),
});

export const arbitrationResultSchema = z.object({
  consensus: z.boolean().describe('Whether the analytical engines reached consensus'),
  votes: z
    .array(engineVoteSchema)
    .min(3)
    .max(6)
    .describe('Votes from different analytical engines'),
  disagreements: z
    .array(z.string())
    .describe('Specific points of disagreement between engines'),
  resolution: z
    .string()
    .describe('How the disagreements were resolved and the final position'),
});

// ── TruthAssessment (types.ts:96-105) ───────────────────────────

export const truthAssessmentSchema = z.object({
  overallTruthLikelihood: z
    .number()
    .min(0.05)
    .max(0.95)
    .describe('Probability that the core claim is true. Never 0 or 1 — epistemic humility.'),
  signalInterpretation: z
    .string()
    .describe('Narrative interpretation of the pipeline signals (entropy, dissonance, health). 2-4 sentences.'),
  weaknesses: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('Key limitations of this analysis'),
  improvements: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('How the conclusion could be strengthened'),
  blindSpots: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe('What the system cannot see or evaluate'),
  confidenceCalibration: z
    .string()
    .describe('Whether the stated confidence matches the signal quality. 1-2 sentences.'),
  dataVsModelBalance: z
    .string()
    .describe('Percentage breakdown of evidence types (e.g. "60% data-driven, 30% model-based, 10% heuristic"). 1-2 sentences.'),
  recommendedActions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('Next steps for the researcher'),
});
