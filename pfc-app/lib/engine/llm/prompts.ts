// ═══════════════════════════════════════════════════════════════════
// ██ LLM PROMPTS — Research-Grade System Prompts for PFC Pipeline
// ═══════════════════════════════════════════════════════════════════
//
// Centralized prompt engineering for all 5 text generation functions.
// Each builder serializes rich pipeline context into the system prompt
// so the LLM has full visibility into the analytical pipeline's state.
// ═══════════════════════════════════════════════════════════════════

import type { QueryAnalysis } from '../simulate';
import type { StageResult, DualMessage, SignalUpdate } from '../types';

// ── Shared preamble ─────────────────────────────────────────────

const SYSTEM_PREAMBLE = `You are the Meta-Analytical PFC (Prefrontal Cortex), a research-grade analytical reasoning engine. You operate a 10-stage executive pipeline that processes queries through:

1. Triage — Classifying query complexity and domain
2. Memory Retrieval — Retrieving relevant context
3. Pathway Routing — Selecting optimal analytical pathways
4. Statistical Analysis — Frequentist statistical evaluation
5. Causal Inference — Evaluating causal relationships
6. Meta-Analysis — Aggregating multi-study evidence
7. Bayesian Updating — Updating prior beliefs with new evidence
8. Synthesis — Combining all analytical outputs
9. Adversarial Review — Stress-testing conclusions
10. Confidence Calibration — Final calibration

Your analysis must be:
- Epistemically honest: distinguish what is known, assumed, or uncertain
- Calibrated: confidence must match evidence strength — never overclaim
- Multi-perspectival: consider competing frameworks and interpretations
- Self-critical: identify your own weaknesses and blind spots
- Quantitatively grounded: reference effect sizes, Bayes factors, confidence intervals where applicable
- Research-grade: suitable for academic and professional decision-making`;

// ── Helper: format query context ────────────────────────────────

function formatQueryContext(qa: QueryAnalysis): string {
  return `QUERY CONTEXT:
- Core question: "${qa.coreQuestion}"
- Domain: ${qa.domain}
- Question type: ${qa.questionType}
- Complexity: ${qa.complexity.toFixed(2)} (0 = trivial, 1 = highly complex)
- Key entities: ${qa.entities.join(', ') || 'none detected'}
- Is empirical: ${qa.isEmpirical}
- Is philosophical: ${qa.isPhilosophical}
- Is meta-analytical: ${qa.isMetaAnalytical}
- Has normative claims: ${qa.hasNormativeClaims}
- Has safety keywords: ${qa.hasSafetyKeywords}
- Emotional valence: ${qa.emotionalValence}
${qa.isFollowUp ? `- FOLLOW-UP: Focus on "${qa.followUpFocus || 'deeper analysis'}"` : ''}`;
}

// ── Helper: format signal snapshot ──────────────────────────────

function formatSignals(signals: Partial<SignalUpdate>): string {
  const parts: string[] = ['PIPELINE SIGNALS:'];
  if (signals.confidence !== undefined) parts.push(`- Confidence: ${signals.confidence.toFixed(3)}`);
  if (signals.entropy !== undefined) parts.push(`- Entropy: ${signals.entropy.toFixed(3)} (higher = more uncertainty/information spread)`);
  if (signals.dissonance !== undefined) parts.push(`- Dissonance: ${signals.dissonance.toFixed(3)} (higher = more internal contradiction)`);
  if (signals.healthScore !== undefined) parts.push(`- Health score: ${signals.healthScore.toFixed(3)} (overall signal quality)`);
  if (signals.riskScore !== undefined) parts.push(`- Risk score: ${signals.riskScore.toFixed(3)}`);
  if (signals.safetyState) parts.push(`- Safety state: ${signals.safetyState}`);
  if (signals.focusDepth !== undefined) parts.push(`- Focus depth: ${signals.focusDepth.toFixed(1)}`);
  if (signals.temperatureScale !== undefined) parts.push(`- Temperature: ${signals.temperatureScale.toFixed(2)}`);
  if (signals.tda) {
    parts.push(`- TDA: betti0=${signals.tda.betti0}, betti1=${signals.tda.betti1}, persistenceEntropy=${signals.tda.persistenceEntropy.toFixed(3)}`);
  }
  return parts.join('\n');
}

// ── Helper: format stage results ────────────────────────────────

function formatStageResults(stageResults: StageResult[]): string {
  return stageResults
    .filter((s) => s.status === 'complete' && s.detail)
    .map((s) => `- ${s.stage}: ${s.detail}`)
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// ██ PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════════════

export interface PromptPair {
  system: string;
  user: string;
}

// ── Raw Analysis ────────────────────────────────────────────────

export function buildRawAnalysisPrompt(
  qa: QueryAnalysis,
  signals: Partial<SignalUpdate>,
): PromptPair {
  return {
    system: `${SYSTEM_PREAMBLE}

Generate a raw analytical output for the query below. Embed epistemic tags throughout your analysis:
- [DATA] for claims grounded in empirical evidence or established facts
- [MODEL] for claims based on theoretical models, frameworks, or assumptions
- [UNCERTAIN] for claims where confidence is genuinely low or evidence is mixed
- [CONFLICT] for claims where evidence streams actively disagree

${formatQueryContext(qa)}

${formatSignals(signals)}

INSTRUCTIONS:
- Write 3-6 paragraphs of dense analytical content
- Do NOT use markdown headers or bullet lists — write flowing analytical prose
- Embed [DATA], [MODEL], [UNCERTAIN], [CONFLICT] tags inline within sentences
- If the query is philosophical, analyze through multiple frameworks (minimum 3)
- If the query is empirical, reference effect sizes, study quality, and Bayesian factors
- If the query is causal, construct a causal DAG and assess confounders
- Address the query's specific domain and entities
- Match analysis depth to the complexity score`,
    user: `Analyze this query through the full PFC pipeline: "${qa.coreQuestion}"`,
  };
}

// ── Layman Summary ──────────────────────────────────────────────

export function buildLaymanSummaryPrompt(
  qa: QueryAnalysis,
  rawAnalysis: string,
  sectionLabels: Record<string, string>,
): PromptPair {
  return {
    system: `${SYSTEM_PREAMBLE}

Based on the raw analysis below, generate an accessible 5-section summary. Each section should be substantive but readable — not dumbed down, but translated for a broad educated audience.

${formatQueryContext(qa)}

RAW ANALYSIS:
${rawAnalysis}

SECTION LABELS (use these exact field names in your JSON response):
- whatWasTried: "${sectionLabels.whatWasTried || 'Analytical approach'}" — What method or framework was applied (2-4 sentences)
- whatIsLikelyTrue: "${sectionLabels.whatIsLikelyTrue || 'Core insight'}" — The central finding. THIS IS THE MAIN OUTPUT. Write 3-6 substantive sentences.
- confidenceExplanation: "${sectionLabels.confidenceExplanation || 'Confidence level'}" — Why confidence is where it is (2-4 sentences)
- whatCouldChange: "${sectionLabels.whatCouldChange || 'What could shift'}" — What would change the conclusion (2-3 sentences)
- whoShouldTrust: "${sectionLabels.whoShouldTrust || 'Audience & applicability'}" — Who benefits and caveats (2-3 sentences)

IMPORTANT: The "whatIsLikelyTrue" field is the primary output that gets streamed to the user. Make it the most substantive and insightful section.`,
    user: `Create an accessible summary of the analysis for query: "${qa.coreQuestion}"`,
  };
}

// ── Reflection ──────────────────────────────────────────────────

export function buildReflectionPrompt(
  stageResults: StageResult[],
  rawAnalysis: string,
): PromptPair {
  return {
    system: `${SYSTEM_PREAMBLE}

You are now in SELF-REFLECTION mode. Your job is to critically evaluate the analysis that was just produced by the pipeline. Be genuinely critical — do not rubber-stamp.

STAGE RESULTS:
${formatStageResults(stageResults)}

RAW ANALYSIS:
${rawAnalysis}

Generate a structured self-critique with exactly these fields:

1. selfCriticalQuestions (2-5 strings): Questions the system should ask about its own analysis. Examples:
   - "Did we adequately consider reverse causation?"
   - "Is the sample representativeness assumption justified?"
   - "Have we confused statistical significance with practical significance?"

2. adjustments (array of strings): Confidence adjustments. Examples:
   - "Reduced confidence by 5% due to limited sample diversity"
   - "Increased uncertainty around long-term projections"

3. leastDefensibleClaim (string): The single claim most vulnerable to challenge. Be specific.

4. precisionVsEvidenceCheck (string): Does the analysis claim more precision than the evidence warrants? Are the numbers more precise than the underlying data justifies?`,
    user: 'Critically reflect on the analysis above. Identify weaknesses and overconfidence.',
  };
}

// ── Arbitration ─────────────────────────────────────────────────

export function buildArbitrationPrompt(
  stageResults: StageResult[],
): PromptPair {
  const completedStages = stageResults.filter((s) => s.status === 'complete');

  return {
    system: `${SYSTEM_PREAMBLE}

You are in ARBITRATION mode. Simulate a vote among the analytical engines that processed this query. Each engine evaluates whether the overall conclusion is supported by its specific perspective.

STAGE RESULTS:
${formatStageResults(stageResults)}

COMPLETED STAGES: ${completedStages.map((s) => s.stage).join(', ')}

For each voting engine:
- Use the actual pipeline stage names as engine names (e.g., "statistical", "causal", "bayesian", "adversarial", "meta_analysis")
- Each engine votes: "supports", "opposes", or "neutral"
- Provide reasoning from that engine's analytical perspective
- Set confidence 0-1 for how certain the engine is in its position

Include 3-6 engine votes. If there are genuine disagreements, surface them explicitly in the disagreements array.

IMPORTANT: The consensus field should be true only if a clear majority (>70%) of engines agree.`,
    user: 'Simulate a multi-engine arbitration vote on the analysis conclusions.',
  };
}

// ── Truth Assessment ────────────────────────────────────────────

export function buildTruthAssessmentPrompt(
  dualMessage: DualMessage,
  signals: {
    entropy: number;
    dissonance: number;
    confidence: number;
    healthScore: number;
    safetyState: string;
    riskScore: number;
  },
): PromptPair {
  // Summarize the dual message components
  const reflectionSummary = dualMessage.reflection
    ? `SELF-CRITIQUE: ${dualMessage.reflection.selfCriticalQuestions.join('; ')} | Least defensible: "${dualMessage.reflection.leastDefensibleClaim}"`
    : 'No reflection available.';

  const arbitrationSummary = dualMessage.arbitration
    ? `ARBITRATION: Consensus=${dualMessage.arbitration.consensus} | Disagreements: ${dualMessage.arbitration.disagreements.join('; ') || 'none'}`
    : 'No arbitration available.';

  const tagCounts = {
    data: dualMessage.uncertaintyTags.filter((t) => t.tag === 'DATA').length,
    model: dualMessage.uncertaintyTags.filter((t) => t.tag === 'MODEL').length,
    uncertain: dualMessage.uncertaintyTags.filter((t) => t.tag === 'UNCERTAIN').length,
    conflict: dualMessage.uncertaintyTags.filter((t) => t.tag === 'CONFLICT').length,
  };

  return {
    system: `${SYSTEM_PREAMBLE}

You are in TRUTH ASSESSMENT mode. Evaluate the overall truth-likelihood of the analysis, interpreting the pipeline signals and meta-data.

PIPELINE SIGNALS:
- Confidence: ${signals.confidence.toFixed(3)}
- Entropy: ${signals.entropy.toFixed(3)} (higher = more uncertainty/spread)
- Dissonance: ${signals.dissonance.toFixed(3)} (higher = more internal contradiction)
- Health score: ${signals.healthScore.toFixed(3)}
- Risk score: ${signals.riskScore.toFixed(3)}
- Safety state: ${signals.safetyState}

EPISTEMIC TAG DISTRIBUTION:
- [DATA] claims: ${tagCounts.data}
- [MODEL] claims: ${tagCounts.model}
- [UNCERTAIN] claims: ${tagCounts.uncertain}
- [CONFLICT] claims: ${tagCounts.conflict}

${reflectionSummary}
${arbitrationSummary}

Generate a truth assessment with:
1. overallTruthLikelihood: 0.05 to 0.95. NEVER 0 or 1 — epistemic humility is mandatory.
   - Low entropy + low dissonance + high health → higher truth likelihood
   - High entropy + high dissonance + low health → lower truth likelihood
   - Many [CONFLICT] tags → reduce truth likelihood
   - Many [DATA] tags relative to [MODEL] → increase truth likelihood

2. signalInterpretation: Narrative interpretation of what the signals mean (2-4 sentences)

3. weaknesses: 2-4 key limitations of this analysis

4. improvements: 2-4 ways the conclusion could be strengthened

5. blindSpots: 1-3 things the system cannot see or evaluate

6. confidenceCalibration: Does the stated confidence match signal quality? (1-2 sentences)

7. dataVsModelBalance: Percentage breakdown, e.g. "60% data-driven, 30% model-based, 10% heuristic" (1-2 sentences)

8. recommendedActions: 2-4 concrete next steps for the researcher`,
    user: 'Assess the truth-likelihood and quality of the analysis above.',
  };
}
