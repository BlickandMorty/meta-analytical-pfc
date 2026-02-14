import type { StageResult, ReflectionResult } from './types';

/**
 * Template-based self-critique (fallback reflection).
 *
 * Provides deterministic self-critical feedback using pre-written critical
 * questions based on which pipeline stages ran and what keywords appear
 * in the analysis.
 *
 * COMPUTATION METHOD: Template lookup + keyword trigger
 *   - Each stage has 2 pre-written critical questions
 *   - Selection is deterministic: detail.length % questions.length
 *   - Least defensible claim selected by keyword trigger ("pooled", "causal", "BF", etc.)
 *   - Precision check based on "p <" presence
 *
 * LIMITATIONS: This is NOT genuine self-reflection or meta-cognition. It is
 * a curated set of domain-appropriate critiques selected by text pattern matching.
 * The LLM performs genuine self-reflection via `llmGenerateReflection()`.
 */

const CRITICAL_QUESTIONS: Record<string, string[]> = {
  statistical: [
    'If the sample sizes are small, the effect size estimates may be unreliable — are we mistaking noise for signal?',
    'Power analysis suggests some studies may be underpowered — the true effect could be smaller or null.',
  ],
  causal: [
    'Observational designs cannot establish causation — are there unmeasured confounders we are ignoring?',
    'If reverse causation is plausible, the direction of effect may be inverted.',
  ],
  meta_analysis: [
    'Publication bias may inflate the pooled estimate — what if null results are systematically missing?',
    'High I² heterogeneity means the pooled estimate may not represent any single population.',
  ],
  bayesian: [
    'If the posterior is sensitive to prior choice, the evidence may be weaker than it appears.',
    'A high Bayes factor with small N could reflect prior influence rather than data strength.',
  ],
  adversarial: [
    'The adversarial review may have missed domain-specific challenges a specialist would raise.',
    'Overclaiming risk: are we presenting model-generated conclusions as if they were empirically verified?',
  ],
};

export function generateReflection(
  stageResults: StageResult[],
  rawText: string,
): ReflectionResult {
  const questions: string[] = [];

  // Select questions based on stage content rather than randomly
  const analyticalStages = ['statistical', 'causal', 'meta_analysis', 'bayesian', 'adversarial'];
  for (const stage of analyticalStages) {
    const stageData = stageResults.find((s) => s.stage === stage);
    if (stageData && stageData.status !== 'idle' && CRITICAL_QUESTIONS[stage]) {
      // Pick question based on detail content length (deterministic) — first if short detail, second if longer
      const detail = stageData.detail ?? '';
      const idx = detail.length % CRITICAL_QUESTIONS[stage].length;
      questions.push(CRITICAL_QUESTIONS[stage]![idx]!);
    }
  }

  const precisionCheck = rawText.includes('p <')
    ? 'Statistical significance (p < threshold) does not equate to clinical or practical significance — precision of measurement is not precision of truth.'
    : 'Numerical precision in the output (e.g., 3 decimal places) may create false impression of exactness. The underlying data may not support this resolution.';

  const defensibilityChecks = [
    { trigger: 'pooled', claim: 'The pooled effect estimate assumes comparable populations across studies.' },
    { trigger: 'causal', claim: 'Causal language implies interventional evidence that may not exist.' },
    { trigger: 'BF', claim: 'Bayes factor interpretation depends on prior specification choices.' },
    { trigger: 'power', claim: 'Power calculations are based on assumed effect sizes that may not hold.' },
    { trigger: 'robust', claim: 'Claims of robustness have been tested against limited sensitivity analyses.' },
  ];

  const leastDefensible = defensibilityChecks.find((d) => rawText.includes(d.trigger))?.claim
    ?? 'The overall confidence estimate aggregates heterogeneous evidence types with equal weighting.';

  const adjustments: string[] = [];
  if (questions.length > 2) {
    adjustments.push('Confidence adjusted down 8% due to multiple self-critique flags.');
  }
  if (rawText.includes('OVERCLAIM') || rawText.includes('overclaim')) {
    adjustments.push('Conclusion softened: "suggests" rather than "demonstrates".');
  }
  if (rawText.includes('publication bias') || rawText.includes('Egger')) {
    adjustments.push('Publication bias concern noted — recommend interpreting pooled estimate as upper bound.');
  }

  return {
    selfCriticalQuestions: questions.slice(0, 5),
    adjustments,
    leastDefensibleClaim: leastDefensible,
    precisionVsEvidenceCheck: precisionCheck,
  };
}
