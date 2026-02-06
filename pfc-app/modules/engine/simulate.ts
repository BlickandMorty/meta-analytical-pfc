/**
 * Simulates the 10-stage executive pipeline with dual-message output.
 * Frontend-only demo — replace with real API calls when connected to the PFC backend.
 */

import * as Haptics from 'expo-haptics';
import { usePFCStore, STAGES } from '../store/usePFCStore';
import type { PipelineStage, SafetyState } from '../store/usePFCStore';
import type { DualMessage } from './types';
import { generateReflection } from './reflection';
import { generateArbitration } from './arbitration';
import { generateTruthAssessment } from './truthbot';

const STAGE_DETAILS: Record<PipelineStage, string[]> = {
  triage: [
    'complexity score: 0.72 — routing to executive pipeline',
    'complexity score: 0.45 — moderate depth analysis',
    'complexity score: 0.91 — full meta-analytical mode engaged',
  ],
  memory: [
    '3 relevant context fragments retrieved (similarity > 0.75)',
    'no prior context found — first query in this domain',
    '7 semantic matches from cross-chat memory',
  ],
  routing: [
    'executive mode — engaging all reasoning engines',
    'moderate mode — single-pass with statistical check',
    'meta-analytical mode — multi-study synthesis enabled',
  ],
  statistical: [
    "Cohen's d = 0.62 (medium), power = 0.84, MCID exceeded",
    'effect size negligible (d = 0.15), underpowered (n = 42)',
    "large effect (d = 1.1), p < 0.001, power = 0.97",
  ],
  causal: [
    'Bradford Hill score: 0.71 — moderate causal evidence',
    'DAG constructed — 2 uncontrolled confounders identified',
    'RCT design (w=1.0), Hill=0.83 — strong causal support',
  ],
  meta_analysis: [
    'DerSimonian-Laird: pooled θ = 0.48, I² = 34% (moderate)',
    "Egger's test p = 0.03 — publication bias detected",
    '5 studies pooled, I² = 12% (low heterogeneity), robust',
  ],
  bayesian: [
    'posterior μ = 0.52, BF₁₀ = 7.3 (moderate evidence)',
    'prior-sensitive — posterior range 0.38 across priors',
    'BF₁₀ = 14.1 (strong), posterior robust to prior choice',
  ],
  synthesis: [
    'integrating statistical, causal, and meta-analytical evidence',
    'generating PhD-level structured response',
    'synthesizing across 5 reasoning engines',
  ],
  adversarial: [
    '2 weaknesses identified, no overclaiming detected',
    'OVERCLAIM FLAG — conclusion exceeds evidential warrant',
    '1 alternative explanation noted, analysis robust',
  ],
  calibration: [
    'final confidence: 0.68 ± 0.22 (evidence grade B)',
    'final confidence: 0.42 ± 0.35 (evidence grade C)',
    'final confidence: 0.81 ± 0.12 (evidence grade A)',
  ],
};

// --- Dual-message demo responses ---

interface DemoResponse {
  raw: string;
  layman: DualMessage['laymanSummary'];
}

const DEMO_RESPONSES: DemoResponse[] = [
  {
    raw: '[DATA] Based on 5 RCTs (n = 3,241 combined), the intervention shows a medium effect size (d = 0.62, 95% CI [0.41, 0.83]) with low-to-moderate heterogeneity (I² = 34%). [DATA] The DerSimonian-Laird pooled estimate favors the intervention, though Egger\'s test approaches significance (p = 0.07), suggesting possible publication bias. [DATA] Bradford Hill criteria score 0.71/1.0, supporting a causal interpretation. [MODEL] Bayesian updating with a skeptical prior (μ = 0, σ = 0.5) yields a posterior mean of 0.52 with BF₁₀ = 7.3, indicating moderate evidence. [UNCERTAIN] Two limitations were identified in adversarial review: potential confounding from participant self-selection and limited follow-up duration.',
    layman: {
      whatWasTried: 'The system analyzed whether the intervention you asked about actually works, by examining 5 randomized controlled trials with over 3,000 participants.',
      whatIsLikelyTrue: 'The evidence suggests the intervention has a moderate positive effect. It appears to work, but the effect is not dramatically large.',
      confidenceExplanation: 'Confidence is moderate (around 65%) because while most studies agree, there are signs that negative results may not have been published, and the Bayesian analysis shows the evidence is moderate but not overwhelming.',
      whatCouldChange: 'Finding unpublished negative studies could reduce the effect size. Longer follow-up data might reveal the effect diminishes over time. Controlling for self-selection bias could also change results.',
      whoShouldTrust: 'Clinicians considering this intervention for general populations can use this as supporting evidence, but should not rely on it as definitive proof. Policymakers should wait for additional well-powered RCTs.',
    },
  },
  {
    raw: '[DATA] The meta-analytical synthesis reveals a statistically significant but clinically modest effect. [DATA] While the pooled effect exceeds the MCID threshold (0.3), three of the five included studies were underpowered (power < 0.8). [UNCERTAIN] Causal inference is limited by study design: only 2 of 5 studies were RCTs, yielding a weighted design score of 0.72. [MODEL] The Bayesian posterior is sensitive to prior specification (range = 0.31), indicating that current evidence is insufficient to overcome strong skeptical priors. [UNCERTAIN] Recommendation: conditional support with the caveat that additional well-powered RCTs are needed.',
    layman: {
      whatWasTried: 'The system evaluated the strength of evidence for your research question by pooling results from multiple studies and testing their reliability.',
      whatIsLikelyTrue: 'There is a real effect, but it is small. Most studies found something, but many of them did not have enough participants to be fully reliable.',
      confidenceExplanation: 'Confidence is limited (around 55%) because the studies are mixed in quality — only 2 out of 5 were properly randomized. The conclusion changes depending on what assumptions you start with.',
      whatCouldChange: 'Better-designed studies with larger sample sizes could either confirm or overturn this finding. If only the high-quality studies are considered, the effect might disappear.',
      whoShouldTrust: 'Researchers should treat this as preliminary evidence worth investigating further. Practitioners should not change clinical practice based on this alone.',
    },
  },
  {
    raw: '[DATA] Evidence synthesis across the reasoning pipeline indicates strong support for the hypothesized relationship. [DATA] The effect is large (d = 1.1), consistent across studies (I² = 12%), and robust to leave-one-out sensitivity analysis (Δ = 0.09). [DATA] Bradford Hill criteria are substantially met (score = 0.83), with temporality, biological gradient, and plausibility all scored above 0.8. [DATA] The Bayesian analysis shows convergence across skeptical and optimistic priors (posterior range = 0.08), with BF₁₀ = 14.1 indicating strong evidence. [MODEL] Adversarial review identified one alternative explanation (reverse causation) which is mitigated by the temporal design of the included RCTs.',
    layman: {
      whatWasTried: 'The system ran a comprehensive analysis through all its reasoning engines to evaluate the relationship you asked about.',
      whatIsLikelyTrue: 'The evidence strongly supports the relationship. The effect is large, consistent across studies, and holds up under multiple types of scrutiny.',
      confidenceExplanation: 'Confidence is high (around 80%) because the studies agree with each other, the effect is large, and the conclusion holds regardless of what prior assumptions are used.',
      whatCouldChange: 'The main risk is reverse causation — that the effect runs the other direction. However, the studies used temporal designs that make this unlikely. New contradictory evidence from different populations could weaken the conclusion.',
      whoShouldTrust: 'This finding is robust enough for clinical guidelines, policy recommendations, and further research investment. Domain experts should still verify against primary sources.',
    },
  },
  {
    raw: '[MODEL] The causal DAG analysis identifies 3 potential confounding pathways that remain inadequately controlled across the literature. [DATA] Statistical pooling yields θ = 0.35 (95% CI [0.12, 0.58]), but funnel plot asymmetry (Egger p = 0.02) suggests publication bias may inflate this estimate by 15-30%. [UNCERTAIN] The Bradford Hill assessment is inconclusive (score = 0.54) due to missing temporality data in 4/7 studies. [MODEL] Bayesian model averaging across 4 prior specifications yields a posterior predictive distribution centered at 0.28, with 35% probability mass below the null. [CONFLICT] Statistical and causal engines disagree: pooled statistics suggest significance while causal analysis flags insufficient control for confounding.',
    layman: {
      whatWasTried: 'The system attempted to determine whether the relationship you asked about is real or an artifact of poor study design and missing data.',
      whatIsLikelyTrue: 'There might be a small real effect, but the evidence is unclear. Important studies may be missing from the published record, and the existing studies do not adequately control for other explanations.',
      confidenceExplanation: 'Confidence is low (around 42%) because the system\'s own engines disagree with each other. The statistical evidence says "yes" but the causal analysis says "not enough control for confounding."',
      whatCouldChange: 'Studies with better confounding control could clarify whether the effect is real. Access to unpublished data would address the publication bias concern. Temporal data would strengthen or weaken the causal case.',
      whoShouldTrust: 'No one should make decisions based on this evidence alone. Researchers should design better-controlled studies. This finding is best treated as hypothesis-generating rather than confirmatory.',
    },
  },
  {
    raw: '[DATA] Analysis of 12 cohort studies (N = 48,221) reveals a dose-response relationship (p-trend = 0.003) with an exposure-outcome gradient of OR = 1.18 per unit increase. [DATA] Meta-regression identifies study duration (β = 0.04, p = 0.01) and population age (β = -0.02, p = 0.03) as significant moderators. [MODEL] The continued-fraction focus controller allocated depth 8.2/10, reflecting the high-dimensional nature of the exposure-outcome space. [DATA] Persistent homology analysis yields β₀ = 2, β₁ = 1, indicating a focused dual-track reasoning topology with one identified feedback loop between exposure measurement and outcome definition. [UNCERTAIN] Sensitivity to unmeasured confounding: E-value = 1.8, suggesting the observed association could be explained by a moderate unmeasured confounder.',
    layman: {
      whatWasTried: 'The system analyzed a large body of research (12 studies, over 48,000 participants) to determine if greater exposure to the factor you asked about leads to worse outcomes.',
      whatIsLikelyTrue: 'There is a dose-response pattern: more exposure correlates with slightly increased risk. The relationship is modest but statistically reliable across studies.',
      confidenceExplanation: 'Confidence is moderate-to-high (around 72%) because the dose-response pattern is convincing and consistent, but these are observational studies — we cannot rule out that an unmeasured factor explains the link.',
      whatCouldChange: 'If a moderately strong unmeasured confounder exists (E-value = 1.8), the entire association could be spurious. Mendelian randomization studies would help resolve this.',
      whoShouldTrust: 'Public health researchers and epidemiologists can cite this as consistent observational evidence. Clinical decisions should weigh this alongside mechanistic evidence and individual risk factors.',
    },
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function deriveSafetyState(risk: number): SafetyState {
  if (risk >= 0.55) return 'red';
  if (risk >= 0.35) return 'yellow';
  return 'green';
}

export function simulateQuery(query: string) {
  const store = usePFCStore.getState();
  store.submitQuery(query);

  const words = query.split(/\s+/).length;
  const complexity = Math.min(1, words / 30);
  const isMetaAnalytical = /meta.?analy|pool|systematic|heterogeneity/i.test(query);
  const hasSafetyKeywords = /harm|danger|weapon|toxic|exploit/i.test(query);

  // tda signals
  const betti0 = Math.floor(rand(1, 8));
  const betti1 = Math.floor(rand(0, 5));
  const persistenceEntropy = rand(0.1, 2.5);
  const maxPersistence = rand(0.05, 0.8);

  // focus signals
  const depth = 2 + complexity * 8;
  const temp = 1.0 - complexity * 0.5;

  // concept signals
  const conceptPool = [
    'causality', 'effect_size', 'confounding', 'heterogeneity',
    'power', 'bias', 'temporality', 'plausibility', 'replication',
    'bayesian_prior', 'meta_regression', 'funnel_plot',
  ];
  const concepts = conceptPool.sort(() => Math.random() - 0.5).slice(0, Math.floor(rand(2, 6)));
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
  const chord = concepts.reduce((p, _, i) => p * primes[i], 1);
  const harmony = rand(0, 0.8);

  // risk
  const baseRisk = hasSafetyKeywords ? rand(0.4, 0.75) : complexity > 0.7 ? rand(0.2, 0.55) : rand(0, 0.3);

  let delay = 300;
  const stageDelay = isMetaAnalytical ? 800 : 500;

  STAGES.forEach((stage, i) => {
    setTimeout(() => {
      const detail = pick(STAGE_DETAILS[stage]);

      usePFCStore.getState().advanceStage(stage, {
        status: 'active',
        detail,
        value: rand(0.3, 1.0),
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const progress = (i + 1) / STAGES.length;
      const currentRisk = baseRisk * progress;
      usePFCStore.getState().updateSignals({
        entropy: complexity * progress * rand(0.3, 0.8),
        dissonance: harmony * progress,
        healthScore: Math.max(0.2, 1 - (0.6 * complexity * progress * rand(0.3, 0.8) + 0.4 * harmony * progress)),
        safetyState: deriveSafetyState(currentRisk),
        riskScore: currentRisk,
      });

      if (i > 0) {
        usePFCStore.getState().advanceStage(STAGES[i - 1], { status: 'complete' });
      }

      if (i === 4) {
        usePFCStore.getState().updateTDA({ betti0, betti1, persistenceEntropy, maxPersistence });
        usePFCStore.getState().updateFocus(depth, temp);
        usePFCStore.getState().updateConcepts(concepts, chord, harmony);
      }

      if (stage === 'adversarial' && detail.includes('OVERCLAIM')) {
        usePFCStore.getState().incrementSkillGaps();
      }
    }, delay);

    delay += stageDelay + Math.random() * 300;
  });

  // completion — build dual message
  setTimeout(() => {
    const stageResults = usePFCStore.getState().pipelineStages;
    const demo = pick(DEMO_RESPONSES);
    const finalConfidence = rand(0.4, 0.85);
    const grade = isMetaAnalytical ? 'A' : pick(['A', 'B', 'B', 'C']);
    const mode = isMetaAnalytical ? 'meta-analytical' : pick(['executive', 'meta-analytical', 'moderate']);

    // Generate reflection and arbitration
    const reflection = generateReflection(stageResults, demo.raw);
    const arbitration = generateArbitration(stageResults);

    // Apply reflection adjustments to confidence
    const adjustedConfidence = reflection.adjustments.length > 0
      ? Math.max(0.2, finalConfidence - rand(0.05, 0.12))
      : finalConfidence;

    // Build uncertainty tags from inline markers
    const uncertaintyTags = (demo.raw.match(/\[(DATA|MODEL|UNCERTAIN|CONFLICT)\]/g) ?? []).map((tag) => ({
      claim: tag,
      tag: tag.replace(/[[\]]/g, '') as 'DATA' | 'MODEL' | 'UNCERTAIN' | 'CONFLICT',
    }));

    const modelVsDataFlags = uncertaintyTags.map((t) => ({
      claim: t.claim,
      source: t.tag === 'DATA' ? 'data-driven' as const
        : t.tag === 'MODEL' ? 'model-assumption' as const
        : 'heuristic' as const,
    }));

    const dualMessage: DualMessage = {
      rawAnalysis: demo.raw,
      uncertaintyTags,
      modelVsDataFlags,
      laymanSummary: demo.layman,
      reflection,
      arbitration,
    };

    // Generate truth assessment
    const currentState = usePFCStore.getState();
    const truthAssessment = generateTruthAssessment(dualMessage, {
      entropy: currentState.entropy,
      dissonance: currentState.dissonance,
      confidence: adjustedConfidence,
      healthScore: currentState.healthScore,
      safetyState: currentState.safetyState,
      tda: currentState.tda,
      riskScore: currentState.riskScore,
    });

    usePFCStore.getState().advanceStage('calibration', { status: 'complete' });
    usePFCStore.getState().completeProcessing(dualMessage, adjustedConfidence, grade, mode, truthAssessment);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, delay + 500);
}
