import type { SynthesisReport, ChatMessage } from './types';

interface SynthesisSignals {
  confidence: number;
  entropy: number;
  dissonance: number;
  healthScore: number;
  safetyState: string;
  riskScore: number;
  tda: { betti0: number; betti1: number; persistenceEntropy: number; maxPersistence: number };
  focusDepth: number;
  temperatureScale: number;
  activeConcepts: string[];
  activeChordProduct: number;
  harmonyKeyDistance: number;
  queriesProcessed: number;
  totalTraces: number;
  skillGapsDetected: number;
  inferenceMode: string;
}

export function generateSynthesisReport(
  messages: ChatMessage[],
  storeSnapshot: SynthesisSignals,
): SynthesisReport {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role === 'user');

  // --- Plain Summary ---
  const plainSummary = generatePlainSummary(userMessages, systemMessages, storeSnapshot);

  // --- Research Summary ---
  const researchSummary = generateResearchSummary(userMessages, systemMessages, storeSnapshot);

  // --- Suggestions ---
  const suggestions = generateSuggestions(systemMessages, storeSnapshot);

  return {
    plainSummary,
    researchSummary,
    suggestions,
    timestamp: Date.now(),
  };
}

function generatePlainSummary(
  userMsgs: ChatMessage[],
  sysMsgs: ChatMessage[],
  snap: Pick<SynthesisSignals, 'confidence' | 'safetyState' | 'queriesProcessed' | 'skillGapsDetected'>,
): string {
  const queryCount = userMsgs.length;
  const confidencePercent = Math.round(snap.confidence * 100);
  const safetyLabel = snap.safetyState === 'green' ? 'within safe parameters'
    : snap.safetyState === 'yellow' ? 'slightly elevated risk detected'
    : 'elevated risk — constrained reasoning applied';

  let summary = `SESSION OVERVIEW\n`;
  summary += `You asked ${queryCount} question${queryCount !== 1 ? 's' : ''} during this session. `;
  summary += `The system processed each through a 10-stage reasoning pipeline.\n\n`;

  summary += `WHAT THE SYSTEM FOUND\n`;
  if (sysMsgs.length > 0) {
    const lastMsg = sysMsgs[sysMsgs.length - 1];
    const layman = lastMsg.dualMessage?.laymanSummary;
    if (layman) {
      summary += `${layman.whatIsLikelyTrue}\n\n`;
    } else {
      summary += `The analysis produced a ${lastMsg.evidenceGrade ?? '?'}-grade result.\n\n`;
    }
  }

  summary += `HOW CONFIDENT\n`;
  summary += `The system's final confidence was ${confidencePercent}%. `;
  summary += `The safety system was ${safetyLabel}. `;
  if (snap.skillGapsDetected > 0) {
    summary += `${snap.skillGapsDetected} instance${snap.skillGapsDetected !== 1 ? 's' : ''} of overclaiming were detected and corrected.`;
  }
  summary += `\n\nThis summary provides a high-level view. For technical details, switch to the Research Summary.`;

  return summary;
}

function generateResearchSummary(
  userMsgs: ChatMessage[],
  sysMsgs: ChatMessage[],
  snap: Pick<SynthesisSignals,
    'confidence' | 'entropy' | 'dissonance' | 'healthScore' |
    'safetyState' | 'riskScore' | 'tda' | 'focusDepth' | 'temperatureScale' |
    'activeConcepts' | 'activeChordProduct' | 'harmonyKeyDistance' |
    'queriesProcessed' | 'totalTraces' | 'skillGapsDetected' | 'inferenceMode'
  >,
): string {
  let r = `META-ANALYTICAL PFC — SESSION SYNTHESIS REPORT\n`;
  r += `Mode: ${snap.inferenceMode.toUpperCase()} | Queries: ${snap.queriesProcessed}\n\n`;

  r += `EXECUTIVE SIGNAL STATE\n`;
  r += `Confidence: ${(snap.confidence * 100).toFixed(1)}% | `;
  r += `Entropy: ${(snap.entropy * 100).toFixed(1)}% | `;
  r += `Dissonance: ${(snap.dissonance * 100).toFixed(1)}% | `;
  r += `Health: ${(snap.healthScore * 100).toFixed(1)}%\n`;
  r += `Safety State: ${snap.safetyState.toUpperCase()} (risk: ${(snap.riskScore * 100).toFixed(1)}%)\n\n`;

  r += `TOPOLOGICAL DATA ANALYSIS\n`;
  r += `β₀ = ${snap.tda.betti0} (connected components) | β₁ = ${snap.tda.betti1} (1-cycles)\n`;
  r += `Persistence Entropy H(persist) = ${snap.tda.persistenceEntropy.toFixed(3)} | `;
  r += `Max Persistence ℓ_max = ${snap.tda.maxPersistence.toFixed(3)}\n`;
  r += snap.tda.betti0 > 5 ? `Interpretation: Fragmented reasoning — multiple disconnected tracks.\n\n`
    : snap.tda.betti0 > 2 ? `Interpretation: Multi-track parallel reasoning active.\n\n`
    : `Interpretation: Focused, well-connected reasoning topology.\n\n`;

  r += `CONTINUED-FRACTION FOCUS CONTROLLER\n`;
  r += `Depth: ${snap.focusDepth.toFixed(1)}/10 | Temperature: ${snap.temperatureScale.toFixed(2)}\n\n`;

  r += `LEIBNIZIAN CONCEPT HARMONICS\n`;
  r += `Active concepts: [${snap.activeConcepts.join(', ')}]\n`;
  r += `Chord product Π = ${snap.activeChordProduct} | `;
  r += `Key distance δ = ${snap.harmonyKeyDistance.toFixed(2)}\n`;
  r += snap.harmonyKeyDistance > 0.6 ? `Harmonic state: Dissonant — significant conceptual tension.\n\n`
    : snap.harmonyKeyDistance > 0.3 ? `Harmonic state: Moderate alignment.\n\n`
    : `Harmonic state: Consonant — concepts well-harmonized.\n\n`;

  r += `CONTEXTUAL ALLOSTASIS ENGINE\n`;
  r += `Safety: ${snap.safetyState.toUpperCase()} | Risk: ${(snap.riskScore * 100).toFixed(1)}% | `;
  r += `Skill gaps detected: ${snap.skillGapsDetected}\n\n`;

  // Include latest arbitration and reflection if available
  const lastSys = sysMsgs[sysMsgs.length - 1];
  if (lastSys?.dualMessage) {
    const dm = lastSys.dualMessage;
    r += `REFLECTION PASS\n`;
    r += dm.reflection.selfCriticalQuestions.map((q) => `• ${q}`).join('\n');
    r += `\nLeast defensible: ${dm.reflection.leastDefensibleClaim}\n`;
    r += `${dm.reflection.precisionVsEvidenceCheck}\n\n`;

    r += `ENGINE ARBITRATION\n`;
    r += `Consensus: ${dm.arbitration.consensus ? 'YES' : 'NO'}\n`;
    r += dm.arbitration.votes.map((v) => `• ${v.engine}: ${v.position} (C=${v.confidence})`).join('\n');
    if (dm.arbitration.disagreements.length > 0) {
      r += `\nDisagreements:\n`;
      r += dm.arbitration.disagreements.map((d) => `  ⚠ ${d}`).join('\n');
    }
    r += `\nResolution: ${dm.arbitration.resolution}\n`;
  }

  return r;
}

function generateSuggestions(
  sysMsgs: ChatMessage[],
  snap: Pick<SynthesisSignals, 'confidence' | 'entropy' | 'dissonance' | 'safetyState' | 'skillGapsDetected' | 'tda'>,
): string[] {
  const suggestions: string[] = [];

  if (snap.confidence < 0.5) {
    suggestions.push(
      'Consider reformulating the query with more specific parameters — the current evidence base yields sub-50% confidence, suggesting the question may be too broad or the literature too sparse.'
    );
  }

  if (snap.entropy > 0.6) {
    suggestions.push(
      'High entropy indicates significant information loss through the pipeline. Consider breaking the query into sub-questions to reduce reasoning divergence.'
    );
  }

  if (snap.dissonance > 0.5) {
    suggestions.push(
      'Elevated dissonance suggests conflicting evidence streams. A targeted systematic review focusing on the specific disagreement point would clarify whether the conflict is methodological or substantive.'
    );
  }

  if (snap.skillGapsDetected > 0) {
    suggestions.push(
      'Overclaiming was detected during adversarial review. The raw output has been calibrated, but the user should verify conclusions against primary sources before citing.'
    );
  }

  if (snap.tda.betti1 > 2) {
    suggestions.push(
      'Topological analysis reveals circular reasoning patterns (β₁ > 2). This suggests the reasoning pipeline may be reinforcing assumptions rather than testing them independently.'
    );
  }

  if (snap.safetyState === 'red') {
    suggestions.push(
      'The query triggered elevated safety protocols. Results are constrained — consider consulting domain experts for sensitive topics.'
    );
  }

  // Always add a meta-suggestion
  suggestions.push(
    'For highest confidence results, provide the most specific, well-scoped research question possible. Include study design preferences (RCT, cohort, etc.) and population parameters when relevant.'
  );

  return suggestions;
}
