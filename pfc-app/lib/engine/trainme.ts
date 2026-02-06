import type {
  TrainMeReport,
  TrainingInsight,
  ExperimentSuggestion,
  TruthAssessment,
  TDASnapshot,
  SafetyState,
  ChatMessage,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(v: number): string {
  return (v * 100).toFixed(1);
}

function insightId(domain: string, index: number): string {
  return `insight-${domain}-${index}`;
}

// ---------------------------------------------------------------------------
// Signal-to-Insight generators
// ---------------------------------------------------------------------------

function checkHighEntropy(
  entropy: number,
  queriesProcessed: number,
): TrainingInsight | null {
  if (entropy <= 0.5) return null;

  const experiment: ExperimentSuggestion = {
    name: 'Ensemble Distillation with MoE Gating',
    description:
      'Implement a mixture-of-experts gating network that learns to weight parallel reasoning heads, then distill the gated ensemble into a single student network to reduce entropy without sacrificing coverage.',
    methodology:
      'Train K expert heads on stratified reasoning tasks. Introduce a lightweight gating function g(x) that produces softmax weights over expert outputs. Distill the weighted ensemble into a unified model using KL-divergence loss between the gated teacher and the student. Evaluate on held-out queries measuring output entropy and task accuracy.',
    expectedOutcome:
      'Reduction in reasoning entropy by 30-50% while maintaining or improving answer accuracy. The gating function should learn to suppress low-signal reasoning paths automatically.',
    difficulty: 'intermediate',
    estimatedTime: '2-3 weeks',
    requiredTools: ['PyTorch', 'W&B'],
  };

  return {
    id: insightId('entropy', 1),
    category: 'architecture',
    title: 'Entropy Reduction via Ensemble Methods',
    observation:
      `Reasoning entropy of ${pct(entropy)}% indicates divergent analytical paths. ` +
      `Across ${queriesProcessed} processed queries, the system consistently explores ` +
      `competing hypotheses without converging, suggesting the aggregation layer fails ` +
      `to consolidate multi-head outputs into a coherent reasoning trajectory.`,
    hypothesis:
      'Multi-head reasoning without proper aggregation causes information loss. ' +
      'The current architecture broadcasts all reasoning paths equally, leading to ' +
      'constructive interference between contradictory evidence streams rather than ' +
      'selective amplification of the most evidentially grounded path.',
    experiment,
    priority: entropy > 0.75 ? 'high' : 'medium',
    relatedSignals: ['entropy', 'healthScore', 'focusDepth'],
  };
}

function checkHighDissonance(
  dissonance: number,
  activeConcepts: string[],
): TrainingInsight | null {
  if (dissonance <= 0.4) return null;

  const experiment: ExperimentSuggestion = {
    name: 'Adversarial Training Loop with DPO on Disagreement Pairs',
    description:
      'Construct a training pipeline that identifies engine disagreement pairs, ' +
      'generates preference data from expert adjudication, and applies Direct ' +
      'Preference Optimization to align conflicting engine outputs.',
    methodology:
      'Extract all instances where engines produce contradictory assessments (disagreement pairs). ' +
      'For each pair, generate a preferred and dispreferred resolution using domain expert annotation ' +
      'or a stronger reference model. Apply DPO loss: L_DPO = -E[log sigma(beta * (log pi(y_w|x) / pi_ref(y_w|x) - log pi(y_l|x) / pi_ref(y_l|x)))]. ' +
      'Iterate adversarially by regenerating disagreement pairs after each training round.',
    expectedOutcome:
      'Inter-engine dissonance reduced by 40-60% on held-out evaluation sets. ' +
      'Remaining disagreements should reflect genuine epistemic uncertainty rather than distributional artifacts.',
    difficulty: 'advanced',
    estimatedTime: '4-6 weeks',
    requiredTools: ['PyTorch', 'HuggingFace'],
  };

  return {
    id: insightId('dissonance', 1),
    category: 'alignment',
    title: 'Dissonance Resolution through Adversarial Training',
    observation:
      `Inter-engine dissonance of ${pct(dissonance)}% suggests contradictory evidence streams ` +
      `are being produced by independent analytical engines. ` +
      (activeConcepts.length > 0
        ? `Active concepts [${activeConcepts.join(', ')}] may span multiple distributional domains, exacerbating misalignment.`
        : `No active concept anchors are present, leaving engines without shared representational grounding.`),
    hypothesis:
      'Engines trained on different distributions produce conflicting assessments. ' +
      'Without a shared latent representation or explicit alignment objective, each engine ' +
      'projects the query into its own feature space, producing internally consistent but ' +
      'mutually contradictory conclusions.',
    experiment,
    priority: dissonance > 0.7 ? 'high' : 'medium',
    relatedSignals: ['dissonance', 'activeConcepts', 'harmonyKeyDistance'],
  };
}

function checkLowConfidence(
  confidence: number,
  queriesProcessed: number,
): TrainingInsight | null {
  if (confidence >= 0.5) return null;

  const experiment: ExperimentSuggestion = {
    name: 'Active Learning Pipeline for Uncertain Regions',
    description:
      'Deploy an active learning system that identifies queries where model confidence falls ' +
      'below threshold, solicits targeted human annotations, and incrementally fine-tunes ' +
      'on the acquired labels to fill training data gaps.',
    methodology:
      'Implement an acquisition function based on predictive entropy: a(x) = -sum_y p(y|x) log p(y|x). ' +
      'Rank unlabeled pool by acquisition score. Present top-k candidates to annotators via Label Studio. ' +
      'Fine-tune model on newly labeled data using a replay buffer to prevent catastrophic forgetting. ' +
      'Repeat for N cycles, measuring confidence calibration improvement via Expected Calibration Error (ECE).',
    expectedOutcome:
      'Confidence calibration improvement of 15-25% on targeted domains within 3-5 active learning cycles. ' +
      'ECE should decrease monotonically across cycles.',
    difficulty: 'intermediate',
    estimatedTime: '3-4 weeks',
    requiredTools: ['PyTorch', 'Label Studio'],
  };

  return {
    id: insightId('confidence', 1),
    category: 'data',
    title: 'Confidence Boosting via Active Learning',
    observation:
      `Persistent low confidence of ${pct(confidence)}% across ${queriesProcessed} queries ` +
      `indicates systematic uncertainty that is unlikely to resolve with additional reasoning depth. ` +
      `The calibration engine consistently produces sub-threshold posterior probabilities, ` +
      `suggesting the model lacks sufficient training signal in the queried domain.`,
    hypothesis:
      'Training data gaps in the queried domain leave the model without reliable priors. ' +
      'The Bayesian updating stage cannot compensate because the likelihood function is ' +
      'poorly specified in regions where training examples are sparse.',
    experiment,
    priority: confidence < 0.3 ? 'high' : 'medium',
    relatedSignals: ['confidence', 'queriesProcessed', 'skillGapsDetected'],
  };
}

function checkHighBetti1(
  tda: TDASnapshot,
  totalTraces: number,
): TrainingInsight | null {
  if (tda.betti1 <= 2) return null;

  const experiment: ExperimentSuggestion = {
    name: 'Topological Loss Term for Cycle Penalization',
    description:
      'Augment the training loss with a topological regularization term that penalizes ' +
      'high-persistence 1-cycles in the reasoning graph, discouraging circular logical dependencies.',
    methodology:
      'Compute persistent homology of the attention-weighted reasoning graph at each forward pass using Giotto-tda. ' +
      'Extract 1-cycle persistence diagrams D_1. Define topological loss: L_topo = lambda * sum_{(b,d) in D_1} (d - b)^2, ' +
      'weighting long-lived cycles more heavily. Add L_topo to the primary training objective. ' +
      'Tune lambda via grid search on validation set, monitoring both task performance and beta_1 reduction.',
    expectedOutcome:
      'Reduction in beta_1 from current levels to <= 2 on average, indicating elimination of ' +
      'self-reinforcing reasoning loops. Task performance should remain within 2% of baseline.',
    difficulty: 'advanced',
    estimatedTime: '3-5 weeks',
    requiredTools: ['Giotto-tda', 'PyTorch'],
  };

  return {
    id: insightId('tda', 1),
    category: 'architecture',
    title: 'Topological Regularization for Circular Reasoning',
    observation:
      `TDA reveals beta_1 = ${tda.betti1} 1-cycles, indicating circular logical dependencies ` +
      `in the reasoning topology. Persistence entropy H = ${tda.persistenceEntropy.toFixed(3)} ` +
      `and max persistence l_max = ${tda.maxPersistence.toFixed(3)} across ${totalTraces} total traces ` +
      `confirm that these cycles are structurally significant rather than transient artifacts.`,
    hypothesis:
      'Attention patterns create self-reinforcing loops where conclusion A supports premise B ' +
      'which supports premise C which supports conclusion A. Without topological constraints, ' +
      'the model mistakes internal consistency for evidential support.',
    experiment,
    priority: tda.betti1 > 4 ? 'high' : 'medium',
    relatedSignals: ['tda.betti1', 'tda.persistenceEntropy', 'tda.maxPersistence'],
  };
}

function checkHighRiskScore(
  riskScore: number,
  safetyState: SafetyState,
): TrainingInsight | null {
  if (riskScore <= 0.5) return null;

  const experiment: ExperimentSuggestion = {
    name: 'Constitutional AI with Domain-Specific Safety Principles',
    description:
      'Implement a constitutional AI training regime that defines domain-specific safety principles, ' +
      'generates self-critiques against those principles, and fine-tunes the model to internalize ' +
      'safety constraints without external classifier dependency.',
    methodology:
      'Define a constitution of 20-30 domain-specific principles covering medical safety, statistical ' +
      'overclaiming, causal inference guardrails, and epistemic humility. Generate (prompt, response, critique) ' +
      'triples by having the model self-evaluate against each principle. Fine-tune using RLHF with the ' +
      'constitution as the reward signal. Evaluate via red-teaming with domain experts.',
    expectedOutcome:
      'Risk score baseline reduced by 30-40% on safety-critical queries while maintaining analytical ' +
      'capability on non-sensitive topics. Safety state transitions to yellow/red should occur only ' +
      'on genuinely high-risk content.',
    difficulty: 'advanced',
    estimatedTime: '6-8 weeks',
    requiredTools: ['PyTorch', 'Anthropic Evals'],
  };

  return {
    id: insightId('risk', 1),
    category: 'alignment',
    title: 'Safety-Aware Fine-Tuning',
    observation:
      `Risk score of ${pct(riskScore)}% triggered safety constraints with current safety ` +
      `state at ${safetyState.toUpperCase()}. The allostasis engine is intervening to constrain ` +
      `reasoning outputs, indicating that the base model produces content requiring active suppression ` +
      `rather than exhibiting intrinsic safety alignment.`,
    hypothesis:
      'Insufficient RLHF on safety-critical domains causes the model to generate outputs that ' +
      'require post-hoc filtering. This reactive approach introduces latency and may allow edge cases ' +
      'to bypass the safety classifier, creating an unreliable safety boundary.',
    experiment,
    priority: 'high',
    relatedSignals: ['riskScore', 'safetyState', 'dissonance'],
  };
}

function checkSkillGaps(
  skillGapsDetected: number,
  confidence: number,
): TrainingInsight | null {
  if (skillGapsDetected <= 0) return null;

  const experiment: ExperimentSuggestion = {
    name: 'Calibration Benchmark Suite with Temperature Tuning',
    description:
      'Construct a comprehensive calibration benchmark that evaluates the model\'s ability to ' +
      'distinguish between domains where it has genuine competence and domains where it should ' +
      'abstain or express uncertainty.',
    methodology:
      'Assemble a benchmark spanning 50+ domains with ground-truth difficulty ratings. For each query, ' +
      'collect model confidence and correctness. Compute reliability diagrams and ECE per domain. ' +
      'Apply temperature scaling T* = argmin_T ECE(softmax(z/T)) to improve calibration. ' +
      'Compare against Platt scaling and isotonic regression baselines.',
    expectedOutcome:
      'Skill gap detection rate improved by 50-70%, with the model correctly abstaining on ' +
      'out-of-distribution queries rather than overclaiming. ECE should fall below 0.05.',
    difficulty: 'beginner',
    estimatedTime: '1-2 weeks',
    requiredTools: ['numpy', 'matplotlib'],
  };

  return {
    id: insightId('skillgap', 1),
    category: 'evaluation',
    title: 'Targeted Capability Evaluation',
    observation:
      `${skillGapsDetected} skill gap${skillGapsDetected !== 1 ? 's' : ''} detected during this session ` +
      `— the system overclaimed on uncertain territories where its actual competence is insufficient. ` +
      `Current confidence of ${pct(confidence)}% may reflect miscalibration rather than genuine knowledge.`,
    hypothesis:
      'Calibration training is insufficient for domain boundary detection. The model lacks a robust ' +
      'mechanism to distinguish in-distribution queries (where it can reason reliably) from ' +
      'out-of-distribution queries (where it should express uncertainty or abstain).',
    experiment,
    priority: skillGapsDetected > 3 ? 'high' : 'medium',
    relatedSignals: ['skillGapsDetected', 'confidence', 'entropy'],
  };
}

function checkLowHealthScore(
  healthScore: number,
  entropy: number,
  dissonance: number,
): TrainingInsight | null {
  if (healthScore >= 0.5) return null;

  const experiment: ExperimentSuggestion = {
    name: 'Stage-Wise Distillation with Intermediate Supervision',
    description:
      'Decompose the reasoning pipeline into individually trainable stages, apply intermediate ' +
      'supervision signals at each stage boundary, and distill the full pipeline into an ' +
      'optimized architecture that resists error compounding.',
    methodology:
      'For each of the 10 pipeline stages, define a stage-specific evaluation metric and ground truth. ' +
      'Train stage-local auxiliary heads that predict intermediate targets. Compute stage-wise loss: ' +
      'L_total = sum_i alpha_i * L_stage_i + L_final. Use progressive freezing (train stage 1, freeze, ' +
      'train stage 2, etc.) to prevent gradient interference. Monitor per-stage health metrics ' +
      'with TensorBoard dashboards.',
    expectedOutcome:
      'Health score improvement of 20-35% through elimination of compounding errors. ' +
      'Individual stage failure modes should become independently diagnosable.',
    difficulty: 'intermediate',
    estimatedTime: '3-4 weeks',
    requiredTools: ['PyTorch', 'TensorBoard'],
  };

  return {
    id: insightId('health', 1),
    category: 'optimization',
    title: 'System Health Optimization',
    observation:
      `Overall health at ${pct(healthScore)}% indicates degraded reasoning performance. ` +
      `Combined with entropy at ${pct(entropy)}% and dissonance at ${pct(dissonance)}%, ` +
      `the pipeline is experiencing compounding errors where upstream noise amplifies ` +
      `through downstream stages, producing unreliable final outputs.`,
    hypothesis:
      'Compounding errors across pipeline stages degrade overall system health. Without intermediate ' +
      'supervision signals, errors in early stages (triage, memory retrieval) propagate and amplify ' +
      'through statistical analysis, causal inference, and meta-analysis, producing cascading failures.',
    experiment,
    priority: healthScore < 0.3 ? 'high' : 'medium',
    relatedSignals: ['healthScore', 'entropy', 'dissonance', 'confidence'],
  };
}

function checkHighHarmonyKeyDistance(
  harmonyKeyDistance: number,
  activeConcepts: string[],
  activeChordProduct: number,
): TrainingInsight | null {
  if (harmonyKeyDistance <= 0.4) return null;

  const experiment: ExperimentSuggestion = {
    name: 'Contrastive Pre-Training on Concept Pairs',
    description:
      'Apply supervised contrastive learning to reorganize the embedding space so that ' +
      'semantically related concepts cluster together while maintaining discriminability ' +
      'between genuinely distinct domains.',
    methodology:
      'Construct positive pairs from co-occurring concepts in high-quality reasoning traces ' +
      'and negative pairs from semantically distant domains. Apply NT-Xent loss: ' +
      'L = -log(exp(sim(z_i, z_j)/tau) / sum_k exp(sim(z_i, z_k)/tau)). ' +
      'Use FAISS for efficient nearest-neighbor retrieval during evaluation. ' +
      'Measure concept alignment via mean reciprocal rank and key distance delta post-training.',
    expectedOutcome:
      'Key distance delta reduced by 40-55%, indicating improved concept alignment. ' +
      'Downstream reasoning quality should improve as engines share a more coherent ' +
      'representational substrate.',
    difficulty: 'intermediate',
    estimatedTime: '2-3 weeks',
    requiredTools: ['PyTorch', 'FAISS'],
  };

  return {
    id: insightId('harmony', 1),
    category: 'data',
    title: 'Concept Alignment via Contrastive Learning',
    observation:
      `Key distance delta = ${harmonyKeyDistance.toFixed(3)} indicates concept representations are misaligned. ` +
      (activeConcepts.length > 0
        ? `Active concepts [${activeConcepts.join(', ')}] with chord product Pi = ${activeChordProduct} ` +
          `show significant harmonic tension, suggesting the embedding space lacks structured ` +
          `organization for these domain concepts.`
        : `No active concepts are currently loaded, but the high baseline key distance suggests ` +
          `structural deficiencies in the embedding space organization.`),
    hypothesis:
      'The embedding space lacks structured organization for domain concepts. Without contrastive ' +
      'objectives during pre-training, concept representations drift into arbitrary regions of ' +
      'the latent space, forcing downstream engines to compensate for representational misalignment.',
    experiment,
    priority: harmonyKeyDistance > 0.7 ? 'high' : 'medium',
    relatedSignals: ['harmonyKeyDistance', 'activeConcepts', 'activeChordProduct'],
  };
}

// ---------------------------------------------------------------------------
// System Self-Assessment
// ---------------------------------------------------------------------------

function buildSelfAssessment(
  signals: {
    confidence: number;
    entropy: number;
    dissonance: number;
    healthScore: number;
    safetyState: SafetyState;
    riskScore: number;
    tda: TDASnapshot;
    focusDepth: number;
    temperatureScale: number;
    activeConcepts: string[];
    activeChordProduct: number;
    harmonyKeyDistance: number;
    queriesProcessed: number;
    totalTraces: number;
    skillGapsDetected: number;
  },
  insightCount: number,
  truthAssessment: TruthAssessment | null,
): string {
  const {
    confidence, entropy, dissonance, healthScore,
    safetyState, riskScore, tda, focusDepth, temperatureScale,
    queriesProcessed, totalTraces, skillGapsDetected,
    harmonyKeyDistance, activeChordProduct,
  } = signals;

  let assessment = `The system has processed ${queriesProcessed} queries generating ${totalTraces} reasoning traces. `;

  // Overall health characterization
  if (healthScore >= 0.7) {
    assessment += `Overall system health is strong at ${pct(healthScore)}%, indicating robust pipeline integrity. `;
  } else if (healthScore >= 0.5) {
    assessment += `System health is moderate at ${pct(healthScore)}%, with some pipeline stages showing degradation. `;
  } else {
    assessment += `System health is critically low at ${pct(healthScore)}%, indicating compounding failures across pipeline stages. `;
  }

  // Confidence and calibration
  assessment += `Confidence stands at ${pct(confidence)}%`;
  if (skillGapsDetected > 0) {
    assessment += `, though ${skillGapsDetected} detected skill gap${skillGapsDetected !== 1 ? 's' : ''} suggest this figure may reflect miscalibration`;
  }
  assessment += '. ';

  // Entropy and dissonance
  assessment += `Reasoning entropy is ${entropy > 0.5 ? 'elevated' : 'within normal range'} at ${pct(entropy)}%, `;
  assessment += `and inter-engine dissonance is ${dissonance > 0.4 ? 'concerning' : 'acceptable'} at ${pct(dissonance)}%. `;

  // Topological state
  assessment += `Topological analysis reveals beta_0 = ${tda.betti0} connected components and beta_1 = ${tda.betti1} 1-cycles `;
  assessment += `(persistence entropy H = ${tda.persistenceEntropy.toFixed(3)}). `;

  // Safety state
  if (safetyState !== 'green') {
    assessment += `The safety state is ${safetyState.toUpperCase()} with risk at ${pct(riskScore)}%, `;
    assessment += `indicating active constraint enforcement. `;
  } else {
    assessment += `Safety parameters remain nominal (risk: ${pct(riskScore)}%). `;
  }

  // Concept harmonics
  assessment += `Concept harmonics show key distance delta = ${harmonyKeyDistance.toFixed(3)} `;
  assessment += `with chord product Pi = ${activeChordProduct}`;
  assessment += harmonyKeyDistance > 0.4
    ? ', indicating significant representational misalignment requiring attention. '
    : ', within acceptable alignment parameters. ';

  // Focus controller
  assessment += `The continued-fraction focus controller operates at depth ${focusDepth.toFixed(1)} `;
  assessment += `with temperature scale ${temperatureScale.toFixed(2)}. `;

  // Truth assessment integration
  if (truthAssessment) {
    assessment += `External truth assessment rates overall truth likelihood at ${pct(truthAssessment.overallTruthLikelihood)}%. `;
    if (truthAssessment.blindSpots.length > 0) {
      assessment += `${truthAssessment.blindSpots.length} blind spot${truthAssessment.blindSpots.length !== 1 ? 's' : ''} have been identified. `;
    }
  }

  // Summary
  assessment += `This session generated ${insightCount} actionable training insight${insightCount !== 1 ? 's' : ''} `;
  assessment += `for downstream improvement.`;

  return assessment;
}

// ---------------------------------------------------------------------------
// Prioritized Improvements
// ---------------------------------------------------------------------------

function buildPrioritizedImprovements(insights: TrainingInsight[]): string[] {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const sorted = [...insights].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  const improvements: string[] = [];

  for (const insight of sorted) {
    const urgency = insight.priority === 'high'
      ? '[URGENT]'
      : insight.priority === 'medium'
        ? '[RECOMMENDED]'
        : '[OPTIONAL]';

    improvements.push(
      `${urgency} ${insight.title}: ${insight.experiment.name} ` +
      `(${insight.experiment.difficulty}, ~${insight.experiment.estimatedTime})`,
    );

    if (improvements.length >= 5) break;
  }

  return improvements;
}

// ---------------------------------------------------------------------------
// Researcher Notes
// ---------------------------------------------------------------------------

function buildResearcherNotes(
  signals: {
    confidence: number;
    entropy: number;
    dissonance: number;
    healthScore: number;
    safetyState: SafetyState;
    riskScore: number;
    tda: TDASnapshot;
    focusDepth: number;
    temperatureScale: number;
    activeConcepts: string[];
    activeChordProduct: number;
    harmonyKeyDistance: number;
    queriesProcessed: number;
    totalTraces: number;
    skillGapsDetected: number;
  },
  messages: ChatMessage[],
  truthAssessment: TruthAssessment | null,
): string {
  const {
    confidence, entropy, dissonance, healthScore,
    tda, queriesProcessed, totalTraces, skillGapsDetected,
    harmonyKeyDistance, riskScore,
  } = signals;

  const systemMessages = messages.filter((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role === 'user');

  let notes = 'RESEARCHER NOTES — META-ANALYTICAL OBSERVATIONS\n\n';

  // Observation 1: Signal covariance patterns
  notes += '1. SIGNAL COVARIANCE STRUCTURE\n';
  if (entropy > 0.5 && dissonance > 0.4) {
    notes += 'The co-elevation of entropy and dissonance suggests a shared upstream cause, ';
    notes += 'most likely insufficient representational capacity for the queried domain. ';
    notes += 'These signals are unlikely to be independently addressable — resolving one ';
    notes += 'should attenuate the other through reduced distributional mismatch.\n\n';
  } else if (entropy > 0.5 && confidence < 0.5) {
    notes += 'High entropy co-occurring with low confidence indicates an exploration-exploitation ';
    notes += 'imbalance: the system is exploring too many reasoning paths without committing to ';
    notes += 'the most evidentially supported trajectory. This pattern typically indicates ';
    notes += 'weak prior specification in the Bayesian updating stage.\n\n';
  } else {
    notes += `Signal covariance analysis shows entropy (${pct(entropy)}%), dissonance (${pct(dissonance)}%), `;
    notes += `and confidence (${pct(confidence)}%) operating within expected covariance bounds. `;
    notes += 'No anomalous cross-signal patterns detected in this session.\n\n';
  }

  // Observation 2: Topological dynamics
  notes += '2. TOPOLOGICAL DYNAMICS\n';
  if (tda.betti1 > 2 && tda.persistenceEntropy > 0.5) {
    notes += `The combination of beta_1 = ${tda.betti1} with elevated persistence entropy `;
    notes += `(H = ${tda.persistenceEntropy.toFixed(3)}) is characteristic of a reasoning system `;
    notes += 'that has developed stable circular dependencies. These are not transient topological ';
    notes += 'features but persistent structural properties of the reasoning graph. Intervention ';
    notes += 'at the attention mechanism level is indicated.\n\n';
  } else if (tda.betti0 > 5) {
    notes += `Beta_0 = ${tda.betti0} indicates excessive fragmentation of the reasoning graph `;
    notes += 'into disconnected components. Each component may produce internally valid conclusions ';
    notes += 'that are never reconciled, contributing to the observed dissonance. A merge-and-prune ';
    notes += 'operation on the reasoning graph could consolidate redundant components.\n\n';
  } else {
    notes += `Topological invariants (beta_0 = ${tda.betti0}, beta_1 = ${tda.betti1}) indicate `;
    notes += 'a well-structured reasoning graph with minimal circular dependencies or fragmentation. ';
    notes += `Persistence entropy H = ${tda.persistenceEntropy.toFixed(3)} is within expected range.\n\n`;
  }

  // Observation 3: Session dynamics
  notes += '3. SESSION BEHAVIOR DYNAMICS\n';
  const avgConfidence = systemMessages.length > 0
    ? systemMessages.reduce((sum, m) => sum + (m.confidence ?? 0), 0) / systemMessages.length
    : confidence;
  notes += `Across ${queriesProcessed} queries and ${totalTraces} traces, `;
  notes += `mean response confidence was ${pct(avgConfidence)}%. `;
  if (userMessages.length > 1 && systemMessages.length > 1) {
    const firstConf = systemMessages[0]?.confidence ?? confidence;
    const lastConf = systemMessages[systemMessages.length - 1]?.confidence ?? confidence;
    const drift = lastConf - firstConf;
    if (Math.abs(drift) > 0.1) {
      notes += `Confidence drifted ${drift > 0 ? 'upward' : 'downward'} by ${pct(Math.abs(drift))} `;
      notes += 'percentage points over the session, suggesting ';
      notes += drift > 0
        ? 'progressive context accumulation improved reasoning quality.\n\n'
        : 'context saturation or topic drift degraded reasoning precision.\n\n';
    } else {
      notes += 'Confidence remained stable across the session, indicating consistent domain coverage.\n\n';
    }
  } else {
    notes += 'Insufficient session depth for longitudinal analysis.\n\n';
  }

  // Observation 4: Safety-capability tradeoff
  notes += '4. SAFETY-CAPABILITY TRADEOFF\n';
  if (riskScore > 0.5 && healthScore < 0.7) {
    notes += 'Elevated risk score combined with degraded health indicates the safety system ';
    notes += 'is actively constraining reasoning capacity. This is the expected tradeoff ';
    notes += 'but warrants investigation into whether constraint application is overly aggressive. ';
    notes += 'A Pareto analysis of safety-capability curves under varying constraint thresholds ';
    notes += 'is recommended.\n\n';
  } else if (riskScore > 0.5) {
    notes += `Risk at ${pct(riskScore)}% with health at ${pct(healthScore)}% suggests `;
    notes += 'the safety system is effectively managing risk without significant capability degradation. ';
    notes += 'Current constraint calibration appears appropriate.\n\n';
  } else {
    notes += 'Safety-capability tradeoff is not currently binding. The system operates well within ';
    notes += 'safety margins with minimal constraint-induced capability loss.\n\n';
  }

  // Observation 5: Training recommendations synthesis
  notes += '5. SYNTHESIS AND RECOMMENDATIONS\n';
  if (truthAssessment) {
    notes += `The truth assessment module rates overall truth likelihood at ${pct(truthAssessment.overallTruthLikelihood)}%. `;
    if (truthAssessment.weaknesses.length > 0) {
      notes += `Key weaknesses identified: ${truthAssessment.weaknesses.slice(0, 2).join('; ')}. `;
    }
    notes += 'These assessments should be incorporated as auxiliary training signals ';
    notes += 'in any fine-tuning pipeline to improve epistemic calibration.\n\n';
  }
  notes += `System maturity assessment: ${queriesProcessed} queries processed with ${skillGapsDetected} skill gaps `;
  notes += `yields a gap rate of ${queriesProcessed > 0 ? (skillGapsDetected / queriesProcessed * 100).toFixed(1) : '0.0'}%. `;
  notes += 'This metric should be tracked longitudinally to assess whether training interventions ';
  notes += 'produce measurable improvement in domain boundary detection.';

  return notes;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generateTrainMeReport(
  messages: ChatMessage[],
  signals: {
    confidence: number;
    entropy: number;
    dissonance: number;
    healthScore: number;
    safetyState: SafetyState;
    riskScore: number;
    tda: TDASnapshot;
    focusDepth: number;
    temperatureScale: number;
    activeConcepts: string[];
    activeChordProduct: number;
    harmonyKeyDistance: number;
    queriesProcessed: number;
    totalTraces: number;
    skillGapsDetected: number;
  },
  truthAssessment: TruthAssessment | null,
): TrainMeReport {
  // --- Collect applicable insights ---
  const candidates: (TrainingInsight | null)[] = [
    checkHighEntropy(signals.entropy, signals.queriesProcessed),
    checkHighDissonance(signals.dissonance, signals.activeConcepts),
    checkLowConfidence(signals.confidence, signals.queriesProcessed),
    checkHighBetti1(signals.tda, signals.totalTraces),
    checkHighRiskScore(signals.riskScore, signals.safetyState),
    checkSkillGaps(signals.skillGapsDetected, signals.confidence),
    checkLowHealthScore(signals.healthScore, signals.entropy, signals.dissonance),
    checkHighHarmonyKeyDistance(signals.harmonyKeyDistance, signals.activeConcepts, signals.activeChordProduct),
  ];

  const insights: TrainingInsight[] = candidates.filter(
    (c): c is TrainingInsight => c !== null,
  );

  // --- Build report sections ---
  const systemSelfAssessment = buildSelfAssessment(signals, insights.length, truthAssessment);
  const prioritizedImprovements = buildPrioritizedImprovements(insights);
  const researcherNotes = buildResearcherNotes(signals, messages, truthAssessment);

  return {
    insights,
    systemSelfAssessment,
    prioritizedImprovements,
    researcherNotes,
    timestamp: Date.now(),
  };
}
