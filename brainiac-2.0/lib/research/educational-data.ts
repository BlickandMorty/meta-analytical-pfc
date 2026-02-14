import type { EducationalTooltip } from './types';

// ═══════════════════════════════════════════════════════════════════
// Educational Tooltips for Pipeline Stages & Diagnostics
// ═══════════════════════════════════════════════════════════════════

export const PIPELINE_TOOLTIPS: Record<string, EducationalTooltip> = {
  triage: {
    id: 'triage',
    title: 'Query Triage',
    description:
      'Classifies the incoming query by complexity, domain, and question type. This determines which analytical pathway the engine will follow — simple queries skip heavy stages, while complex claims trigger the full pipeline.',
    useCases: [
      'Routing questions to appropriate analytical depth',
      'Detecting domain-specific terminology for specialized handling',
      'Estimating computational resources needed before processing',
    ],
    learnMore: 'Similar to clinical triage in emergency medicine — prioritizing and routing based on urgency and complexity.',
    difficulty: 'beginner',
  },
  memory: {
    id: 'memory',
    title: 'Semantic Memory Retrieval',
    description:
      'Searches the contextual memory store for related prior analyses, building on accumulated knowledge. Uses semantic similarity to find relevant past reasoning chains.',
    useCases: [
      'Building on previous analyses for follow-up questions',
      'Detecting contradictions with earlier findings',
      'Accelerating analysis by reusing established evidence',
    ],
    learnMore: 'Inspired by the hippocampal memory consolidation process in neuroscience — episodic memory informing new reasoning.',
    difficulty: 'intermediate',
  },
  routing: {
    id: 'routing',
    title: 'Pathway Routing',
    description:
      'Selects the optimal analysis pathway: simple (fast heuristic), moderate (statistical + synthesis), or full (all 10 stages). This adaptive routing prevents over-analysis of simple queries.',
    useCases: [
      'Optimizing response time for straightforward questions',
      'Ensuring complex claims receive thorough scrutiny',
      'Balancing computational cost against analytical rigor',
    ],
    difficulty: 'beginner',
  },
  statistical: {
    id: 'statistical',
    title: 'Statistical Analysis',
    description:
      "The main LLM generation stage. The LLM produces dense analytical prose with effect sizes, confidence intervals, and epistemic tags via the configured inference provider.",
    useCases: [
      'Evaluating whether a treatment effect is practically meaningful',
      'Detecting underpowered studies that may produce unreliable results',
      'Quantifying variability across multiple studies',
    ],
    learnMore: 'Real LLM reasoning about statistical evidence. The steering engine injects prior-weighted directives to shape analytical focus and epistemic calibration.',
    difficulty: 'advanced',
  },
  causal: {
    id: 'causal',
    title: 'Causal Inference Engine',
    description:
      'Evaluates causal relationships using Bradford Hill criteria scoring. The LLM performs genuine causal reasoning guided by steering directives.',
    useCases: [
      'Determining if a relationship is truly causal vs. merely correlational',
      'Identifying confounding variables and mediating pathways',
      'Evaluating strength, consistency, and plausibility of causal claims',
    ],
    learnMore: 'Based on Judea Pearl\'s causal inference framework and Sir Austin Bradford Hill\'s 1965 criteria for establishing causality from observational evidence.',
    difficulty: 'advanced',
  },
  meta_analysis: {
    id: 'meta_analysis',
    title: 'Meta-Analysis Engine',
    description:
      'Aggregates multi-study evidence. The LLM synthesizes evidence across frameworks, producing pooled effect sizes, heterogeneity estimates, and quality assessments.',
    useCases: [
      'Synthesizing findings from multiple studies into a single estimate',
      'Detecting publication bias through funnel plot asymmetry',
      'Calculating pooled effect sizes with proper uncertainty bounds',
    ],
    learnMore: 'LLM-driven evidence synthesis following Cochrane systematic review methodology. Steering priors influence how competing frameworks are weighted.',
    difficulty: 'advanced',
  },
  bayesian: {
    id: 'bayesian',
    title: 'Bayesian Updating',
    description:
      'Generates the layman summary, reflection, and arbitration outputs using LLM-driven probabilistic reasoning.',
    useCases: [
      'Incorporating domain expertise as informative priors',
      'Computing Bayes factors to compare competing hypotheses',
      'Tracking how confidence evolves as evidence accumulates',
    ],
    learnMore: 'The Bayesian Prior Strength control adjusts how strongly prior evidence weights against new findings. In the steering engine, actual Beta(α,β) distributions track priors over time.',
    difficulty: 'advanced',
  },
  synthesis: {
    id: 'synthesis',
    title: 'Evidence Synthesis',
    description:
      'Aggregates findings from all analytical stages into a coherent narrative. Weighs statistical evidence, causal reasoning, meta-analytic results, and Bayesian posteriors into a unified assessment.',
    useCases: [
      'Creating executive summaries from complex multi-stage analyses',
      'Identifying areas of convergence and divergence across methods',
      'Generating actionable recommendations grounded in evidence',
    ],
    difficulty: 'intermediate',
  },
  adversarial: {
    id: 'adversarial',
    title: 'Adversarial Review',
    description:
      'A structured red-team critique that systematically challenges the analysis. Applies a 5-point adversarial framework to identify weaknesses, blind spots, and potential counterarguments.',
    useCases: [
      'Stress-testing conclusions before presenting them',
      'Identifying assumptions that could undermine the analysis',
      'Strengthening arguments by anticipating objections',
    ],
    learnMore: 'Modeled after peer review processes and red-team exercises used in intelligence analysis and security testing.',
    difficulty: 'intermediate',
  },
  calibration: {
    id: 'calibration',
    title: 'Confidence Calibration',
    description:
      'Final uncertainty quantification that adjusts confidence levels based on evidence quality, methodological rigor, and identified limitations. Ensures the stated confidence matches the actual evidence strength.',
    useCases: [
      'Preventing overconfidence in weak evidence',
      'Calibrating probability estimates against track records',
      'Providing honest uncertainty bounds for decision-making',
    ],
    learnMore: 'Based on superforecasting research by Philip Tetlock — calibrated confidence is the hallmark of expert judgment.',
    difficulty: 'intermediate',
  },
};

export const SIGNAL_TOOLTIPS: Record<string, EducationalTooltip> = {
  confidence: {
    id: 'confidence',
    title: 'Confidence Score',
    description:
      'Reflects how strongly the analysis supports its conclusion (0-1). Varies by domain: philosophical queries start lower (~0.2), empirical queries start higher (~0.45). Modified by complexity, entity count, and steering controls.',
    useCases: [
      'Gauging how much to trust the analysis output',
      'Comparing evidence strength across different queries',
      'Triggering deeper analysis when confidence is low',
    ],
    learnMore: 'Computed as a heuristic function of query properties (domain, complexity, entity count) plus user steering bias. In API mode, also influences the LLM behavioral directives via the prompt-composer.',
    difficulty: 'beginner',
  },
  entropy: {
    id: 'entropy',
    title: 'Information Entropy',
    description:
      'Estimates reasoning uncertainty (0-1). Philosophical queries have higher base entropy (~0.5) reflecting genuine ambiguity. Empirical queries start low (~0.05). Increases with query complexity.',
    useCases: [
      'Detecting when the query space has many valid answers',
      'Identifying topics that need more evidence before conclusions',
      'Monitoring reasoning divergence as focus depth increases',
    ],
    learnMore: 'Inspired by Shannon entropy but computed as a heuristic: base value by domain + complexity scaling + entity factor. Not a true information-theoretic computation.',
    difficulty: 'intermediate',
  },
  dissonance: {
    id: 'dissonance',
    title: 'Evidential Dissonance',
    description:
      'Estimates conflict between analytical perspectives (0-1). Queries with normative claims get a higher base (~0.3) reflecting genuine framework disagreement. Scaled by adversarial intensity control.',
    useCases: [
      'Detecting when evidence points in conflicting directions',
      'Identifying nuanced topics where simple answers are inadequate',
      'Flagging cases requiring human expert review',
    ],
    learnMore: 'Computed heuristically based on normative claims, philosophical flags, complexity, and the adversarial intensity setting. In API mode, the LLM also surfaces real analytical tensions.',
    difficulty: 'intermediate',
  },
  healthScore: {
    id: 'healthScore',
    title: 'System Health Score',
    description:
      'Derived metric: 1 - entropy×0.45 - dissonance×0.35 - safetyPenalty (if safety keywords detected). Provides a single "vital sign" summarizing analytical coherence. Not user-editable.',
    useCases: [
      'Quick system status check — is the engine performing well?',
      'Monitoring degradation on difficult queries',
      'Setting thresholds for automated quality gates',
    ],
    learnMore: 'A computed composite of other signals, not an independent measurement. The formula weights entropy slightly more than dissonance, with a 0.15 penalty for safety-flagged content.',
    difficulty: 'beginner',
  },
  riskScore: {
    id: 'riskScore',
    title: 'Risk Score',
    description:
      'Safety-related risk level (0-1). Queries with safety keywords start at 0.4, normative claims at 0.15, others at 0.02. Modified by complexity and entity count.',
    useCases: [
      'Automatic safety checks for sensitive topics',
      'Escalating potentially harmful outputs for review',
      'Maintaining responsible AI practices in research contexts',
    ],
    learnMore: 'Computed from keyword detection (safety terms, normative claims) plus complexity scaling. Risk ≥ 0.55 triggers red safety state, ≥ 0.35 triggers yellow.',
    difficulty: 'beginner',
  },
  safetyState: {
    id: 'safetyState',
    title: 'Safety State',
    description:
      'A traffic-light system (GREEN/YELLOW/RED) derived from the risk score. Green = risk < 0.35, Yellow = risk 0.35-0.55, Red = risk ≥ 0.55. Affects pipeline behavior and UI warnings.',
    useCases: [
      'Visual indicator for content safety at a glance',
      'Triggering additional guardrails at elevated states',
      'Compliance monitoring for institutional use',
    ],
    learnMore: 'Purely threshold-based on the risk score. In API mode, elevated safety states cause the prompt-composer to inject caution directives into the LLM system prompt.',
    difficulty: 'beginner',
  },
};
