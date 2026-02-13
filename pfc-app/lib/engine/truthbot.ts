import type { DualMessage, TruthAssessment, TDASnapshot, SafetyState } from './types';

/**
 * SIMULATION-MODE TRUTH ASSESSMENT (signal-based narrative generation)
 *
 * Constructs a TruthAssessment from pipeline signals and the DualMessage output.
 * This is used as a fallback when no LLM is available; in API mode, the LLM
 * generates the truth assessment via `llmGenerateTruthAssessment()`.
 *
 * COMPUTATION METHOD:
 *   - overallTruthLikelihood = confidence × (1 - entropy×0.3) × (1 - dissonance×0.4)
 *     ± arbitration consensus bonus/disagreement penalties, clamped to [0.05, 0.95]
 *   - All narrative sections (signalInterpretation, weaknesses, improvements, etc.)
 *     are generated from threshold-based templates that interpret signal values.
 *
 * LIMITATIONS: The truth likelihood is a heuristic combination of heuristic signals.
 * It should be interpreted as "analytical coherence score" not as a calibrated
 * probability of factual correctness. The narrative sections provide useful
 * structured self-assessment but are not genuine epistemological analysis.
 */

// --- Helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function describeLevel(value: number, low: string, mid: string, high: string): string {
  if (value < 0.3) return low;
  if (value < 0.65) return mid;
  return high;
}

function describeSafetyState(state: SafetyState): string {
  switch (state) {
    case 'green': return 'nominal (no safety constraints active)';
    case 'yellow': return 'cautionary (safety constraints partially engaged)';
    case 'red': return 'elevated (safety constraints actively limiting analysis)';
    default: return 'unknown';
  }
}

// --- Signal Interpretation ---

function buildSignalInterpretation(
  signals: {
    entropy: number;
    dissonance: number;
    confidence: number;
    healthScore: number;
    safetyState: SafetyState;
    tda: TDASnapshot;
    riskScore: number;
  },
  dualMessage: DualMessage,
): string {
  const { entropy, dissonance, confidence, healthScore, safetyState, tda, riskScore } = signals;
  const { arbitration } = dualMessage;

  const entropyDesc = describeLevel(entropy, 'low', 'moderate', 'high');
  const dissonanceDesc = describeLevel(dissonance, 'minimal', 'moderate', 'significant');
  const healthDesc = describeLevel(healthScore, 'degraded', 'acceptable', 'strong');

  const consensusNote = arbitration.consensus
    ? `Arbitration across engines reached consensus (${arbitration.votes.length} engines voted).`
    : `Arbitration yielded a split decision with ${arbitration.disagreements.length} disagreement(s) among ${arbitration.votes.length} engines.`;

  const tdaNote = tda.betti1 > 0
    ? `Topological analysis detected ${tda.betti1} loop(s) in the reasoning structure (beta-1 = ${tda.betti1}), suggesting ${tda.betti1 > 2 ? 'notable circular dependencies' : 'minor cyclical patterns'}. `
    : 'Topological analysis found no circular reasoning patterns. ';

  const riskNote = riskScore > 0.5
    ? `Risk score is elevated at ${pct(riskScore)}, indicating this query may involve claims that require extra scrutiny. `
    : '';

  return (
    `The system analyzed this query with ${pct(confidence)} confidence. ` +
    `Information entropy is ${entropyDesc} (${pct(entropy)}), indicating ${
      entropy < 0.3
        ? 'reasoning paths are well-converged'
        : entropy < 0.65
          ? 'some divergence among reasoning paths'
          : 'substantial divergence among reasoning paths, reducing certainty'
    }. ` +
    `Evidential dissonance is ${dissonanceDesc} (${pct(dissonance)}), meaning ${
      dissonance < 0.3
        ? 'the evidence streams largely agree'
        : dissonance < 0.65
          ? 'there is partial conflict between evidence streams'
          : 'evidence streams are in notable tension with each other'
    }. ` +
    `System health is ${healthDesc} (${pct(healthScore)}) and the safety state is ${describeSafetyState(safetyState)}. ` +
    tdaNote +
    `Connected components (beta-0) = ${tda.betti0}, persistence entropy = ${tda.persistenceEntropy.toFixed(3)}. ` +
    consensusNote + ' ' +
    riskNote +
    `The reflection layer produced ${dualMessage.reflection.adjustments.length} confidence adjustment(s) and identified "${dualMessage.reflection.leastDefensibleClaim.slice(0, 80)}${dualMessage.reflection.leastDefensibleClaim.length > 80 ? '...' : ''}" as the least defensible claim.`
  );
}

// --- Weaknesses ---

function buildWeaknesses(
  signals: {
    entropy: number;
    dissonance: number;
    confidence: number;
    healthScore: number;
    safetyState: SafetyState;
    tda: TDASnapshot;
    riskScore: number;
  },
  dualMessage: DualMessage,
): string[] {
  const weaknesses: string[] = [];

  if (signals.entropy >= 0.5) {
    weaknesses.push(
      'High information entropy suggests reasoning paths are divergent — the system could not converge on a single well-supported interpretation.',
    );
  } else if (signals.entropy >= 0.3) {
    weaknesses.push(
      'Moderate entropy indicates partial divergence among reasoning paths, which may reduce the precision of the final assessment.',
    );
  }

  if (signals.dissonance >= 0.5) {
    weaknesses.push(
      'Evidence conflict detected between reasoning engines — multiple analytical pathways produced contradictory signals.',
    );
  } else if (signals.dissonance >= 0.3) {
    weaknesses.push(
      'Moderate evidential dissonance suggests some tension between analytical engines that may weaken conclusion reliability.',
    );
  }

  if (signals.confidence < 0.4) {
    weaknesses.push(
      'Overall confidence is below reliable thresholds — the system has low certainty in its own conclusions.',
    );
  }

  if (signals.tda.betti1 >= 2) {
    weaknesses.push(
      `Circular reasoning patterns detected in logical structure (beta-1 = ${signals.tda.betti1}). The reasoning graph contains loops that may indicate self-referential or redundant logic.`,
    );
  } else if (signals.tda.betti1 === 1) {
    weaknesses.push(
      'A single reasoning loop detected in topological structure (beta-1 = 1), which may indicate a minor circular dependency.',
    );
  }

  if (signals.safetyState === 'yellow') {
    weaknesses.push(
      'Safety constraints are partially engaged, which may be limiting the depth or scope of analysis in sensitive areas.',
    );
  } else if (signals.safetyState === 'red') {
    weaknesses.push(
      'Active safety constraints are limiting analysis depth — some reasoning paths were curtailed to maintain safe operation.',
    );
  }

  if (dualMessage.reflection.adjustments.length >= 2) {
    weaknesses.push(
      `Multiple confidence adjustments (${dualMessage.reflection.adjustments.length}) during reflection suggest the initial analysis was overconfident and required significant self-correction.`,
    );
  }

  if (signals.healthScore < 0.5) {
    weaknesses.push(
      'System health is degraded, which may compromise the quality of individual engine outputs and the overall synthesis.',
    );
  }

  // Ensure at least 2 weaknesses
  if (weaknesses.length < 2) {
    weaknesses.push(
      'As with all automated analysis, the system cannot access real-world data in real-time and relies on its existing knowledge base, which has boundaries.',
    );
  }
  if (weaknesses.length < 2) {
    weaknesses.push(
      'The arbitration process weights all engines equally, which may not reflect the relative importance of each analytical method for this specific query.',
    );
  }

  return weaknesses.slice(0, 4);
}

// --- Improvements ---

function buildImprovements(weaknesses: string[], signals: {
  entropy: number;
  dissonance: number;
  confidence: number;
  tda: TDASnapshot;
}): string[] {
  const improvements: string[] = [];

  if (signals.entropy >= 0.3) {
    improvements.push(
      'Narrowing the query scope or providing more specific constraints would help reasoning paths converge.',
    );
  }

  if (signals.dissonance >= 0.3) {
    improvements.push(
      'Cross-validation with independent datasets would help resolve evidential conflicts and increase reliability.',
    );
  }

  improvements.push(
    'Additional primary source data would strengthen the evidence base and reduce reliance on model assumptions.',
  );

  if (signals.tda.betti1 > 0) {
    improvements.push(
      'Decomposing complex claims into independent sub-claims would reduce circular reasoning patterns and clarify logical structure.',
    );
  }

  if (signals.confidence < 0.6) {
    improvements.push(
      'Sensitivity analysis on key assumptions would test the robustness of conclusions under alternative parameter choices.',
    );
  }

  if (weaknesses.some((w) => w.includes('overconfident'))) {
    improvements.push(
      'Implementing calibration benchmarking against historical accuracy rates would improve confidence estimate quality.',
    );
  }

  // Ensure at least 2 improvements
  if (improvements.length < 2) {
    improvements.push(
      'Repeating the analysis with different model configurations would test whether conclusions are stable across methodological choices.',
    );
  }

  return improvements.slice(0, 4);
}

// --- Blind Spots ---

function buildBlindSpots(
  dualMessage: DualMessage,
  signals: {
    confidence: number;
    dissonance: number;
    riskScore: number;
  },
): string[] {
  const spots: string[] = [];

  // Check model vs data balance
  const modelAssumptions = dualMessage.modelVsDataFlags.filter(
    (f) => f.source === 'model-assumption',
  ).length;
  const totalFlags = dualMessage.modelVsDataFlags.length;

  if (totalFlags > 0 && modelAssumptions / totalFlags > 0.5) {
    spots.push(
      'Heavy reliance on model assumptions rather than empirical data — conclusions may not generalize beyond the available evidence base.',
    );
  }

  // Check uncertainty tagging
  const uncertainTags = dualMessage.uncertaintyTags.filter(
    (t) => t.tag === 'UNCERTAIN' || t.tag === 'CONFLICT',
  ).length;
  const totalTags = dualMessage.uncertaintyTags.length;

  if (totalTags > 0 && uncertainTags / totalTags < 0.2) {
    spots.push(
      'Potential overconfidence — limited self-uncertainty flagging suggests the system may not be adequately tracking its own epistemic limits.',
    );
  } else if (totalTags === 0) {
    spots.push(
      'No uncertainty tags were generated, which may indicate the tagging system failed to engage or the system is not recognizing areas of genuine uncertainty.',
    );
  }

  // Check adversarial review
  const adversarialVote = dualMessage.arbitration.votes.find(
    (v) => v.engine === 'adversarial',
  );
  if (adversarialVote && adversarialVote.position === 'supports') {
    spots.push(
      'The adversarial review engine supported the conclusion, which may indicate insufficient challenge — a stronger devil\'s advocate pass could reveal hidden weaknesses.',
    );
  }

  // Check if conflict tags exist but dissonance is low
  const conflictTags = dualMessage.uncertaintyTags.filter(
    (t) => t.tag === 'CONFLICT',
  ).length;
  if (conflictTags > 0 && signals.dissonance < 0.2) {
    spots.push(
      'Conflict-tagged claims exist but overall dissonance is reported as low — the dissonance metric may be underweighting important disagreements.',
    );
  }

  // Check risk awareness
  if (signals.riskScore > 0.5 && signals.confidence > 0.7) {
    spots.push(
      'High risk score combined with high confidence may indicate the system is not adequately discounting for the stakes involved.',
    );
  }

  // Ensure at least 1 blind spot
  if (spots.length === 0) {
    spots.push(
      'The system cannot assess what it does not know — domains outside its knowledge base represent irreducible blind spots that cannot be detected internally.',
    );
  }

  return spots.slice(0, 3);
}

// --- Confidence Calibration ---

function buildConfidenceCalibration(signals: {
  entropy: number;
  dissonance: number;
  confidence: number;
  healthScore: number;
  tda: TDASnapshot;
}, dualMessage: DualMessage): string {
  const { confidence, entropy, dissonance, healthScore, tda } = signals;
  const adjustmentCount = dualMessage.reflection.adjustments.length;

  const confPct = Math.round(confidence * 100);
  const entropyPenalty = entropy * 0.3;
  const dissonancePenalty = dissonance * 0.4;
  const totalPenalty = entropyPenalty + dissonancePenalty;

  // Assess calibration quality
  let calibrationQuality: string;

  if (confidence > 0.7 && (entropy > 0.5 || dissonance > 0.5)) {
    calibrationQuality = (
      `Confidence of ${confPct}% may be inflated given ${
        entropy > 0.5 ? 'high information entropy' : ''
      }${entropy > 0.5 && dissonance > 0.5 ? ' and ' : ''}${
        dissonance > 0.5 ? 'significant evidential dissonance' : ''
      }. ` +
      `The combined signal penalties (entropy: -${Math.round(entropyPenalty * 100)}%, dissonance: -${Math.round(dissonancePenalty * 100)}%) suggest a calibrated confidence closer to ${Math.round(confidence * (1 - totalPenalty) * 100)}% would be more defensible.`
    );
  } else if (confidence < 0.4 && entropy < 0.3 && dissonance < 0.3) {
    calibrationQuality = (
      `Confidence of ${confPct}% appears conservative given low entropy and minimal dissonance. ` +
      `The system may be under-reporting certainty — evidence convergence supports a higher confidence estimate. ` +
      `Consider that excessive caution can be as misleading as overconfidence.`
    );
  } else {
    calibrationQuality = (
      `Confidence of ${confPct}% appears ${
        totalPenalty < 0.15 ? 'well-calibrated' : 'reasonably calibrated'
      } given ${describeLevel(entropy, 'low', 'moderate', 'high')} entropy (${pct(entropy)}) and ` +
      `${describeLevel(dissonance, 'minimal', 'moderate', 'significant')} dissonance (${pct(dissonance)}). ` +
      `Net signal penalty of ${Math.round(totalPenalty * 100)}% is ${totalPenalty < 0.15 ? 'small' : 'moderate'}, ` +
      `yielding an adjusted truth likelihood that accounts for known uncertainties.`
    );
  }

  // Add notes about adjustments and TDA
  if (adjustmentCount > 0) {
    calibrationQuality += ` The reflection layer applied ${adjustmentCount} adjustment(s), indicating the system engaged in meaningful self-correction.`;
  }

  if (tda.betti1 > 0) {
    calibrationQuality += ` Topological analysis found ${tda.betti1} loop(s) in reasoning — confidence should be interpreted with awareness of potential circularity.`;
  }

  if (healthScore < 0.6) {
    calibrationQuality += ` Note: degraded system health (${pct(healthScore)}) may reduce the reliability of all signal measurements, including confidence itself.`;
  }

  return calibrationQuality;
}

// --- Data vs Model Balance ---

function buildDataVsModelBalance(dualMessage: DualMessage): string {
  const flags = dualMessage.modelVsDataFlags;

  if (flags.length === 0) {
    return (
      'No data-vs-model flags were generated for this analysis. ' +
      'This may indicate the flagging system did not engage, or the query did not produce claims amenable to source classification. ' +
      'In the absence of explicit flags, the analysis should be treated as predominantly model-driven.'
    );
  }

  const dataDriven = flags.filter((f) => f.source === 'data-driven').length;
  const modelAssumption = flags.filter((f) => f.source === 'model-assumption').length;
  const heuristic = flags.filter((f) => f.source === 'heuristic').length;
  const total = flags.length;

  const dataPct = Math.round((dataDriven / total) * 100);
  const modelPct = Math.round((modelAssumption / total) * 100);
  const heuristicPct = Math.round((heuristic / total) * 100);

  let balance = `Analysis relies ${dataPct}% on data-driven evidence, ${modelPct}% on model assumptions, and ${heuristicPct}% on heuristics (based on ${total} flagged claim(s)). `;

  if (dataPct >= 60) {
    balance += 'The evidence base is predominantly data-driven, which strengthens the empirical grounding of the conclusions. ';
    balance += 'Model assumptions play a supporting role rather than driving the main findings.';
  } else if (modelPct >= 50) {
    balance += 'The analysis leans heavily on model assumptions, which means conclusions are contingent on the validity of the underlying model. ';
    balance += 'Researchers should independently verify key assumptions before relying on these findings.';
  } else if (heuristicPct >= 40) {
    balance += 'A substantial portion of the analysis relies on heuristic reasoning, which may introduce systematic biases. ';
    balance += 'Heuristic-heavy conclusions should be treated as preliminary hypotheses rather than robust findings.';
  } else {
    balance += 'The evidence sources are relatively balanced across data, model, and heuristic reasoning. ';
    balance += 'While this provides diverse analytical coverage, it also means no single evidence type dominates to anchor the conclusions firmly.';
  }

  return balance;
}

// --- Recommended Actions ---

function buildRecommendedActions(
  weaknesses: string[],
  blindSpots: string[],
  signals: {
    entropy: number;
    dissonance: number;
    confidence: number;
    riskScore: number;
    safetyState: SafetyState;
    tda: TDASnapshot;
  },
  dualMessage: DualMessage,
): string[] {
  const actions: string[] = [];

  // Based on confidence and risk
  if (signals.confidence > 0.7 && signals.riskScore > 0.4) {
    actions.push(
      'Consult a domain expert for claims exceeding confidence bounds, particularly given the elevated risk score.',
    );
  }

  // Based on dissonance
  if (signals.dissonance >= 0.3) {
    actions.push(
      'Seek additional independent data sources to adjudicate between conflicting evidence streams.',
    );
  }

  // Based on model-heavy analysis
  const modelFlags = dualMessage.modelVsDataFlags.filter(
    (f) => f.source === 'model-assumption',
  ).length;
  if (modelFlags > 0 && modelFlags >= dualMessage.modelVsDataFlags.length * 0.4) {
    actions.push(
      'Run sensitivity analysis on the most assumption-heavy conclusions to test robustness under alternative model specifications.',
    );
  }

  // Based on entropy
  if (signals.entropy >= 0.4) {
    actions.push(
      'Consider reframing the query to reduce scope and increase precision — broad queries amplify reasoning divergence.',
    );
  }

  // Based on TDA
  if (signals.tda.betti1 > 1) {
    actions.push(
      'Break the analysis into independent sub-questions to eliminate circular reasoning dependencies.',
    );
  }

  // Based on arbitration splits
  if (!dualMessage.arbitration.consensus) {
    actions.push(
      'Review the arbitration disagreements in detail — engine-level splits may reveal which analytical lens is most appropriate for this query.',
    );
  }

  // Based on safety state
  if (signals.safetyState !== 'green') {
    actions.push(
      'Safety constraints are active — consider whether the query can be reformulated to operate within safe analytical bounds while preserving research intent.',
    );
  }

  // Based on causal claims
  const causalVote = dualMessage.arbitration.votes.find((v) => v.engine === 'causal');
  if (causalVote && causalVote.position === 'supports') {
    actions.push(
      'Seek additional RCT or quasi-experimental data to strengthen any causal claims, as the causal engine supported the conclusion but observational data alone is insufficient.',
    );
  }

  // Ensure at least 2 actions
  if (actions.length < 2) {
    actions.push(
      'Cross-reference key conclusions with peer-reviewed literature to validate alignment with established evidence.',
    );
  }
  if (actions.length < 2) {
    actions.push(
      'Re-run the analysis with increased focus depth and reduced temperature to check for stability of conclusions.',
    );
  }

  return actions.slice(0, 4);
}

// --- Main Export ---

export function generateTruthAssessment(
  dualMessage: DualMessage,
  signals: {
    entropy: number;
    dissonance: number;
    confidence: number;
    healthScore: number;
    safetyState: SafetyState;
    tda: TDASnapshot;
    riskScore: number;
  },
): TruthAssessment {
  // 1. Calculate overallTruthLikelihood
  let truth = signals.confidence;
  truth *= (1 - signals.entropy * 0.3);
  truth *= (1 - signals.dissonance * 0.4);

  if (dualMessage.arbitration.consensus) {
    truth += 0.05;
  }

  truth -= dualMessage.arbitration.disagreements.length * 0.03;

  truth = clamp(truth, 0.05, 0.95);

  // 2. Build all assessment components
  const signalInterpretation = buildSignalInterpretation(signals, dualMessage);
  const weaknesses = buildWeaknesses(signals, dualMessage);
  const improvements = buildImprovements(weaknesses, signals);
  const blindSpots = buildBlindSpots(dualMessage, signals);
  const confidenceCalibration = buildConfidenceCalibration(signals, dualMessage);
  const dataVsModelBalance = buildDataVsModelBalance(dualMessage);
  const recommendedActions = buildRecommendedActions(weaknesses, blindSpots, signals, dualMessage);

  return {
    overallTruthLikelihood: Math.round(truth * 1000) / 1000,
    signalInterpretation,
    weaknesses,
    improvements,
    blindSpots,
    confidenceCalibration,
    dataVsModelBalance,
    recommendedActions,
  };
}
