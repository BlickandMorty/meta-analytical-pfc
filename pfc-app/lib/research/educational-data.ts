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
      "Computes effect sizes (Cohen's d), statistical power, minimal clinically important differences (MCID), and heterogeneity metrics. This stage quantifies the strength and reliability of evidence.",
    useCases: [
      'Evaluating whether a treatment effect is practically meaningful',
      'Detecting underpowered studies that may produce unreliable results',
      'Quantifying variability across multiple studies',
    ],
    learnMore: 'Core methodology from evidence-based medicine and the Cochrane Collaboration\'s systematic review standards.',
    difficulty: 'advanced',
  },
  causal: {
    id: 'causal',
    title: 'Causal Inference Engine',
    description:
      'Constructs directed acyclic graphs (DAGs) and applies Bradford Hill criteria to evaluate causal relationships. Distinguishes correlation from causation using structured causal reasoning.',
    useCases: [
      'Determining if a relationship is truly causal vs. merely correlational',
      'Identifying confounding variables and mediating pathways',
      'Evaluating strength, consistency, and plausibility of causal claims',
    ],
    learnMore: 'Based on Judea Pearl\'s causal inference framework and Sir Austin Bradford Hill\'s 1965 criteria for causal assessment.',
    difficulty: 'advanced',
  },
  meta_analysis: {
    id: 'meta_analysis',
    title: 'Meta-Analysis Engine',
    description:
      'Pools evidence across multiple studies using DerSimonian-Laird random-effects modeling. Quantifies between-study heterogeneity (I\u00B2, Q-statistic) to assess evidence consistency.',
    useCases: [
      'Synthesizing findings from multiple studies into a single estimate',
      'Detecting publication bias through funnel plot asymmetry',
      'Calculating pooled effect sizes with proper uncertainty bounds',
    ],
    learnMore: 'The gold standard of evidence synthesis — used by the Cochrane Collaboration, WHO, and regulatory agencies worldwide.',
    difficulty: 'advanced',
  },
  bayesian: {
    id: 'bayesian',
    title: 'Bayesian Updating',
    description:
      'Applies conjugate normal prior-to-posterior updating, computing Bayes factors to quantify how much the evidence should shift our beliefs. Integrates prior knowledge with new data.',
    useCases: [
      'Incorporating domain expertise as informative priors',
      'Computing Bayes factors to compare competing hypotheses',
      'Tracking how confidence evolves as evidence accumulates',
    ],
    learnMore: 'Reverend Thomas Bayes\' theorem (1763) — the mathematical foundation for updating beliefs in light of evidence.',
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
      'A calibrated probability estimate (0-1) reflecting how strongly the evidence supports the conclusion. Higher values indicate stronger, more consistent evidence from multiple analytical stages.',
    useCases: [
      'Gauging how much to trust the analysis output',
      'Comparing evidence strength across different queries',
      'Triggering deeper analysis when confidence is low',
    ],
    difficulty: 'beginner',
  },
  entropy: {
    id: 'entropy',
    title: 'Information Entropy',
    description:
      'Measures the uncertainty or disorder in the reasoning process (0-1). High entropy signals that the evidence is ambiguous, conflicting, or insufficient — the system is "confused" about the answer.',
    useCases: [
      'Detecting when the model is uncertain about its reasoning',
      'Identifying topics that need more evidence before conclusions',
      'Monitoring reasoning stability over time',
    ],
    learnMore: 'From Claude Shannon\'s information theory (1948) — entropy quantifies the average surprise or unpredictability of information.',
    difficulty: 'intermediate',
  },
  dissonance: {
    id: 'dissonance',
    title: 'Cognitive Dissonance',
    description:
      'Measures contradictions between different analytical stages (0-1). High dissonance means the statistical analysis says one thing while causal or Bayesian analysis says another — internal disagreement.',
    useCases: [
      'Detecting when evidence points in conflicting directions',
      'Identifying nuanced topics where simple answers are inadequate',
      'Flagging cases requiring human expert review',
    ],
    difficulty: 'intermediate',
  },
  healthScore: {
    id: 'healthScore',
    title: 'System Health Score',
    description:
      'An aggregate metric (0-1) combining confidence, entropy, dissonance, and risk assessment. Provides a single "vital sign" for the reasoning system\'s overall performance on the current query.',
    useCases: [
      'Quick system status check — is the engine performing well?',
      'Monitoring degradation over extended analysis sessions',
      'Setting thresholds for automated quality gates',
    ],
    difficulty: 'beginner',
  },
  riskScore: {
    id: 'riskScore',
    title: 'Risk Score',
    description:
      'Evaluates potential safety or reliability risks in the analysis (0-1). High risk triggers additional scrutiny and may elevate the safety state to orange or red.',
    useCases: [
      'Automatic safety checks for sensitive topics',
      'Escalating potentially harmful outputs for review',
      'Maintaining responsible AI practices in research contexts',
    ],
    difficulty: 'beginner',
  },
  safetyState: {
    id: 'safetyState',
    title: 'Safety State',
    description:
      'A traffic-light system (GREEN/YELLOW/ORANGE/RED) indicating the overall safety assessment of the current analysis. Transitions are based on risk scores, content flags, and safety keyword detection.',
    useCases: [
      'Visual indicator for content safety at a glance',
      'Triggering additional guardrails at elevated states',
      'Compliance monitoring for institutional use',
    ],
    difficulty: 'beginner',
  },
};
