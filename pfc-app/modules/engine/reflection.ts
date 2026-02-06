import type { StageResult } from '../store/usePFCStore';
import type { ReflectionResult } from './types';

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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateReflection(
  stageResults: StageResult[],
  rawText: string,
): ReflectionResult {
  const questions: string[] = [];

  // Generate self-critical questions based on active stages
  const analyticalStages = ['statistical', 'causal', 'meta_analysis', 'bayesian', 'adversarial'];
  for (const stage of analyticalStages) {
    const stageData = stageResults.find((s) => s.stage === stage);
    if (stageData && stageData.status !== 'idle' && CRITICAL_QUESTIONS[stage]) {
      questions.push(pick(CRITICAL_QUESTIONS[stage]));
    }
  }

  // Always add the precision-vs-evidence check
  const precisionCheck = rawText.includes('p <')
    ? 'Statistical significance (p < threshold) does not equate to clinical or practical significance — precision of measurement is not precision of truth.'
    : 'Numerical precision in the output (e.g., 3 decimal places) may create false impression of exactness. The underlying data may not support this resolution.';

  // Determine least defensible claim
  const defensibilityChecks = [
    { trigger: 'pooled', claim: 'The pooled effect estimate assumes comparable populations across studies.' },
    { trigger: 'causal', claim: 'Causal language implies interventional evidence that may not exist.' },
    { trigger: 'BF', claim: 'Bayes factor interpretation depends on prior specification choices.' },
    { trigger: 'power', claim: 'Power calculations are based on assumed effect sizes that may not hold.' },
    { trigger: 'robust', claim: 'Claims of robustness have been tested against limited sensitivity analyses.' },
  ];

  const leastDefensible = defensibilityChecks.find((d) => rawText.includes(d.trigger))?.claim
    ?? 'The overall confidence estimate aggregates heterogeneous evidence types with equal weighting.';

  // Generate adjustments
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
