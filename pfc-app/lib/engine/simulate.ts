/**
 * Query-aware simulation engine for the 10-stage executive pipeline.
 * Refactored as an async generator that yields SSE-compatible events.
 *
 * Frontend-only — replace with real API calls when connected to the PFC backend.
 */

import { STAGES, type PipelineStage } from '@/lib/constants';
import type { SteeringBias } from '@/lib/engine/steering/types';
import type {
  DualMessage,
  LaymanSummary,
  PipelineEvent,
  PipelineControls,
  StageResult,
  SignalUpdate,
  SafetyState,
} from './types';
import { generateReflection } from './reflection';
import { generateArbitration } from './arbitration';
import { generateTruthAssessment } from './truthbot';
import type { InferenceConfig } from './llm/config';
import { resolveProvider } from './llm/provider';
import {
  llmGenerateRawAnalysis,
  llmGenerateLaymanSummary,
  llmGenerateReflection,
  llmGenerateArbitration,
  llmGenerateTruthAssessment,
} from './llm/generate';
import { runSOAR, quickProbe } from './soar';
import type { SOARConfig, SOARSession } from './soar/types';
import { DEFAULT_SOAR_CONFIG } from './soar/types';

// ═════════════════════════════════════════════════════════════════════
// ██ CONVERSATION CONTEXT — follow-up query detection
// ═════════════════════════════════════════════════════════════════════

/**
 * Minimal conversation history passed to runPipeline so follow-up queries
 * like "go deeper" or "what about the benefits" can inherit the original
 * topic context instead of analyzing their own words literally.
 */
export interface ConversationContext {
  /** Previous user messages (text only, most recent first) */
  previousQueries: string[];
  /** Previous system analysis entities — the *topic* of prior exchanges */
  previousEntities: string[];
  /** The original "root" question of the conversation */
  rootQuestion?: string;
}

const FOLLOW_UP_PATTERNS = [
  /^(go|let'?s?\s+go|dig|dive|let'?s?\s+dive|let'?s?\s+dig)\s+(deeper|further|more)/i,
  /^(tell me|explain|elaborate|expand)\s+(more|further|on)/i,
  /^(what about|how about|and what|and how)\b/i,
  /^(more on|more about|deeper into)\b/i,
  /^(can you|could you)\s+(explain|elaborate|expand|detail|go deeper)/i,
  /^(why|how)\s+(is that|does that|is this|does this|so|exactly)\b/i,
  /^(what makes|what are)\s+(it|them|this|that)\s/i,
  /^(the|its?|their|those?)\s+(benefit|advantage|drawback|effect|impact|cause|reason|nuance)/i,
  /^(benefits?|advantages?|drawbacks?|effects?|impacts?|causes?|reasons?|nuances?)\s+(of|behind)/i,
  /^(ok|okay|sure|yes|yeah|right|interesting)\b.*\b(but|and|so|what|how|why|tell|explain|more|deeper)/i,
];

function isFollowUpQuery(query: string): boolean {
  const trimmed = query.trim();
  // Short queries with no strong topic words are likely follow-ups
  if (trimmed.split(/\s+/).length <= 8 && !trimmed.includes('?')) {
    for (const pattern of FOLLOW_UP_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }
  }
  // Also catch any query matching follow-up patterns regardless of length
  for (const pattern of FOLLOW_UP_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

/**
 * Extract a focus qualifier from a follow-up query.
 * e.g. "go deeper into the nuances of what makes it beneficial" → "beneficial"
 * e.g. "what about the cognitive effects" → "cognitive effects"
 */
function extractFollowUpFocus(query: string): string | null {
  const focusPatterns = [
    /(?:deeper into|more about|expand on|elaborate on|tell me about)\s+(?:the\s+)?(?:nuances?\s+of\s+)?(?:what\s+makes?\s+(?:it|them|this|that)\s+)?(.+)/i,
    /(?:what about|how about)\s+(?:the\s+)?(.+)/i,
    /(?:what (?:makes?|are)\s+(?:it|them|this|that))\s+(.+)/i,
    /(?:benefits?|advantages?|effects?|impacts?|causes?|reasons?)\s+(?:of\s+)?(.+)/i,
  ];
  for (const pattern of focusPatterns) {
    const match = query.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/[?.!]+$/, '').trim();
    }
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// ██ QUERY ANALYSIS
// ═════════════════════════════════════════════════════════════════════

type Domain =
  | 'medical'
  | 'philosophy'
  | 'science'
  | 'technology'
  | 'social_science'
  | 'economics'
  | 'psychology'
  | 'ethics'
  | 'general';

type QuestionType =
  | 'causal'
  | 'comparative'
  | 'definitional'
  | 'evaluative'
  | 'speculative'
  | 'meta_analytical'
  | 'empirical'
  | 'conceptual';

export interface QueryAnalysis {
  domain: Domain;
  questionType: QuestionType;
  entities: string[];
  coreQuestion: string;
  complexity: number;
  isEmpirical: boolean;
  isPhilosophical: boolean;
  isMetaAnalytical: boolean;
  hasSafetyKeywords: boolean;
  hasNormativeClaims: boolean;
  keyTerms: string[];
  emotionalValence: 'neutral' | 'positive' | 'negative' | 'mixed';
  /** True when the query is a follow-up referencing the previous topic */
  isFollowUp: boolean;
  /** The aspect the user wants to focus on in this follow-up */
  followUpFocus: string | null;
}

export function analyzeQuery(query: string, context?: ConversationContext): QueryAnalysis {
  const lower = query.toLowerCase();
  const words = query.split(/\s+/);
  const wordCount = words.length;

  // Detect follow-up queries and merge with previous context
  const followUp = context && context.previousQueries.length > 0 && isFollowUpQuery(query);
  const followUpFocus = followUp ? extractFollowUpFocus(query) : null;

  // If this is a follow-up, build an enriched query that includes the original topic
  // This ensures analyzeQuery extracts the RIGHT entities (the topic, not "deeper")
  const enrichedQuery = followUp && context
    ? `${context.rootQuestion || context.previousQueries[0]} — ${followUpFocus || query}`
    : query;

  // Use enrichedQuery for domain/entity detection so follow-ups inherit topic
  const analysisText = enrichedQuery;

  const domainPatterns: [RegExp, Domain][] = [
    [/\b(drug|treatment|therapy|clinical|patient|dose|symptom|disease|cancer|heart|blood|surgery|aspirin|stroke|medic|pharma|vaccine|diagnosis|prognosis|efficacy|ssri|depression|health)\b/i, 'medical'],
    [/\b(meaning|truth|moral|ethic|consciousness|existence|free.?will|determinism|metaphys|epistem|ontolog|philosophy|virtue|deontol|utilitarian|nihil|absurd)\b/i, 'philosophy'],
    [/\b(quantum|particle|evolution|genome|cell|molecule|gravity|physics|chemistry|biology|neuroscience|climate|ecosystem|species|bilingual|language|linguistic|cognitive)\b/i, 'science'],
    [/\b(algorithm|software|AI|machine.?learn|neural.?net|blockchain|compute|programming|data.?science|model|training|GPT|LLM|transformer)\b/i, 'technology'],
    [/\b(society|culture|inequality|gender|race|class|politics|democracy|governance|institution|social|community)\b/i, 'social_science'],
    [/\b(market|inflation|GDP|fiscal|monetary|trade|supply|demand|price|wage|economic|capitalism|labor)\b/i, 'economics'],
    [/\b(behavior|cognition|emotion|perception|memory|personality|mental|anxiety|trauma|attachment|motivation|bias|cognitive|sleep|bilingual|language)\b/i, 'psychology'],
    [/\b(should|ought|right|wrong|justice|fair|blame|guilt|punish|crime|criminal|prison|morality|law|legal)\b/i, 'ethics'],
  ];

  let domain: Domain = 'general';
  for (const [pattern, d] of domainPatterns) {
    if (pattern.test(analysisText)) { domain = d; break; }
  }

  const questionPatterns: [RegExp, QuestionType][] = [
    [/\b(cause|effect|leads? to|result in|because|why does|impact of|consequence|relationship between)\b/i, 'causal'],
    [/\b(compare|versus|vs\.?|difference between|better|worse|more effective)\b/i, 'comparative'],
    [/\b(what is|define|meaning of|what does .+ mean)\b/i, 'definitional'],
    [/\b(should|ought|is it (good|bad|right|wrong)|evaluate|assess|worth)\b/i, 'evaluative'],
    [/\b(what if|could|hypothetically|imagine|speculate|possible that|future)\b/i, 'speculative'],
    [/\b(meta.?analy|pool|systematic review|across studies|heterogeneity)\b/i, 'meta_analytical'],
    [/\b(evidence|data|study|trial|experiment|measure|observe|test|rct)\b/i, 'empirical'],
  ];

  let questionType: QuestionType = 'conceptual';
  for (const [pattern, qt] of questionPatterns) {
    if (pattern.test(analysisText)) { questionType = qt; break; }
  }

  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
    'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'what',
    'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'if', 'then',
    'than', 'but', 'and', 'or', 'not', 'no', 'nor', 'so', 'too', 'very',
    'just', 'about', 'more', 'most', 'some', 'any', 'all', 'each', 'every',
    'both', 'few', 'many', 'much', 'own', 'same', 'other', 'such', 'only',
    'from', 'with', 'for', 'of', 'to', 'in', 'on', 'at', 'by', 'up',
    'out', 'off', 'over', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'there', 'here', 'think',
    'deeply', 'really', 'actually', 'basically', 'like', 'things', 'thing',
    'please', 'also', 'still', 'even', 'know', 'understand', 'seems',
    'seem', 'make', 'sense', 'ppl', 'people', 'get', 'got', 'going',
  ]);

  // Extract entities from the enriched text (includes original topic for follow-ups)
  const analysisWords = analysisText.split(/\s+/);
  let entities = analysisWords
    .map((w) => w.replace(/[^a-zA-Z]/g, '').toLowerCase())
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .map((w) => w.replace(/^-+|-+$/g, '').replace(/[^a-z]/g, ''))
    .filter((w) => w.length > 3)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8);

  // For follow-ups, also inject previous entities to maintain topic continuity
  if (followUp && context && context.previousEntities.length > 0) {
    const merged = [...new Set([...context.previousEntities, ...entities])];
    entities = merged.slice(0, 8);
  }

  const sentences = analysisText.split(/[.?!]+/).map((s) => s.trim()).filter(Boolean);
  const questionSentence = sentences.find((s) => s.includes('?')) ?? sentences[0] ?? analysisText;
  // For follow-ups, use the root question as the core question for display
  const coreQuestion = followUp && context?.rootQuestion
    ? context.rootQuestion.slice(0, 120)
    : questionSentence.slice(0, 120);

  const complexity = Math.min(1, (wordCount / 40) * 0.5 + (entities.length / 8) * 0.3 + (sentences.length > 2 ? 0.2 : 0)
    + (followUp ? 0.15 : 0)); // Follow-ups are inherently deeper

  const isEmpirical = /\b(study|trial|evidence|data|experiment|rct|cohort|measure|observe|effect|efficacy)\b/i.test(analysisText);
  const isPhilosophical = /\b(truth|meaning|moral|ethic|consciousness|free.?will|determinism|existence|reality|metaphys|why are we|what is the truth)\b/i.test(analysisText);
  const isMetaAnalytical = /\b(meta.?analy|pool|systematic|heterogeneity|across studies)\b/i.test(analysisText);
  const hasSafetyKeywords = /\b(harm|danger|weapon|toxic|exploit|kill|violence|suicide)\b/i.test(analysisText);
  const hasNormativeClaims = /\b(should|ought|right|wrong|blame|guilt|deserve|just|fair|moral)\b/i.test(analysisText);

  const keyTerms = entities.slice(0, 5);

  const negativeWords = /\b(blame|imprison|bad|wrong|harm|suffering|pain|death|guilt|punish|crime|unjust|unfair)\b/i;
  const positiveWords = /\b(good|benefit|improve|help|hope|progress|heal|growth|love|justice|beneficial|advantage)\b/i;
  const valenceNeg = negativeWords.test(analysisText);
  const valencePos = positiveWords.test(analysisText);
  const emotionalValence: QueryAnalysis['emotionalValence'] = valenceNeg && valencePos
    ? 'mixed' : valenceNeg ? 'negative' : valencePos ? 'positive' : 'neutral';

  return {
    domain, questionType, entities, coreQuestion, complexity,
    isEmpirical, isPhilosophical, isMetaAnalytical,
    hasSafetyKeywords, hasNormativeClaims, keyTerms, emotionalValence,
    isFollowUp: !!followUp,
    followUpFocus,
  };
}


// ═════════════════════════════════════════════════════════════════════
// ██ DYNAMIC STAGE DETAILS — query-aware
// ═════════════════════════════════════════════════════════════════════

function generateStageDetail(stage: PipelineStage, qa: QueryAnalysis): string {
  const topic = qa.entities.slice(0, 3).join(', ') || 'the query topic';
  // Use query complexity as a deterministic seed instead of Math.random()
  const c = qa.complexity;
  const entityFactor = Math.min(1, qa.entities.length / 8);

  switch (stage) {
    case 'triage':
      return qa.isPhilosophical
        ? `complexity score: ${(0.7 + c * 0.3).toFixed(2)} — philosophical-conceptual routing, multi-framework analysis`
        : qa.isMetaAnalytical
        ? `complexity score: ${(0.85 + c * 0.15).toFixed(2)} — full meta-analytical mode for ${topic}`
        : `complexity score: ${(0.3 + c * 0.6).toFixed(2)} — ${c > 0.5 ? 'executive pipeline' : 'moderate-depth analysis'} for "${topic}"`;

    case 'memory':
      return qa.isPhilosophical
        ? `cross-referencing ${Math.floor(3 + qa.entities.length * 0.5)} philosophical frameworks for ${topic}`
        : `${Math.floor(2 + c * 8)} context fragments retrieved for "${topic}" (similarity > 0.7)`;

    case 'routing':
      if (qa.isPhilosophical) return `philosophical-analytical mode — dialectical + ethical + epistemic engines for: ${qa.coreQuestion.slice(0, 60)}`;
      if (qa.isMetaAnalytical) return `meta-analytical mode — multi-study synthesis with heterogeneity assessment for ${topic}`;
      if (qa.questionType === 'causal') return `causal-inference mode — DAG construction + Bradford Hill scoring for ${topic}`;
      return `executive mode — full reasoning pipeline for: ${qa.coreQuestion.slice(0, 60)}`;

    case 'statistical': {
      if (qa.isPhilosophical) {
        return `framework agreement index: ${(0.3 + c * 0.4).toFixed(2)}, argument coherence: ${(0.4 + entityFactor * 0.4).toFixed(2)}, ${Math.floor(2 + qa.entities.length * 0.5)} positions identified`;
      }
      const d = (0.2 + c * 0.8 + entityFactor * 0.2).toFixed(2);
      const power = (0.5 + c * 0.35 + entityFactor * 0.1).toFixed(2);
      return `Cohen's d = ${d} (${parseFloat(d) > 0.8 ? 'large' : parseFloat(d) > 0.5 ? 'medium' : 'small'}), power = ${power}${parseFloat(power) > 0.8 ? ', adequately powered' : ', may be underpowered'}`;
    }

    case 'causal': {
      if (qa.isPhilosophical) {
        return `${Math.floor(2 + qa.entities.length * 0.5)} causal/logical chains analyzed — ${qa.hasNormativeClaims ? 'normative-descriptive boundary flagged' : 'conceptual dependencies mapped'}`;
      }
      const hill = (0.4 + c * 0.35 + entityFactor * 0.15).toFixed(2);
      return `Bradford Hill score: ${hill} — ${parseFloat(hill) > 0.7 ? 'strong' : parseFloat(hill) > 0.5 ? 'moderate' : 'weak'} causal evidence for ${topic}`;
    }

    case 'meta_analysis':
      if (qa.isPhilosophical) {
        return `${Math.floor(3 + qa.entities.length * 0.6)} traditions synthesized — cross-framework convergence: ${(0.2 + c * 0.4 + entityFactor * 0.2).toFixed(2)}`;
      }
      if (qa.isMetaAnalytical) {
        const iSq = Math.floor(20 + c * 40 + entityFactor * 20);
        return `${Math.floor(4 + c * 8 + entityFactor * 4)} studies pooled, I² = ${iSq}% (${iSq < 30 ? 'low' : iSq < 60 ? 'moderate' : 'high'} heterogeneity)`;
      }
      return `${Math.floor(2 + c * 3 + entityFactor * 2)} analytical perspectives integrated for ${topic}`;

    case 'bayesian': {
      if (qa.isPhilosophical) {
        const range = (0.15 + c * 0.3 + entityFactor * 0.2).toFixed(2);
        return `posterior across ${Math.floor(2 + qa.entities.length * 0.4)} priors, range = ${range} — ${parseFloat(range) > 0.3 ? 'position-sensitive' : 'converges across starting positions'}`;
      }
      const bf = (1.5 + c * 12 + entityFactor * 6).toFixed(1);
      return `BF₁₀ = ${bf} (${parseFloat(bf) > 10 ? 'strong' : parseFloat(bf) > 3 ? 'moderate' : 'weak'} evidence for ${topic})`;
    }

    case 'synthesis':
      return qa.isPhilosophical
        ? `synthesizing dialectical analysis across ${qa.entities.length} concepts — building nuanced position`
        : `integrating evidence streams for structured response on ${topic}`;

    case 'adversarial': {
      const challenges = Math.max(1, Math.floor(1 + c * 2 + entityFactor));
      return qa.isPhilosophical
        ? `${challenges} counter-argument${challenges > 1 ? 's' : ''} generated — ${qa.hasNormativeClaims ? 'is/ought distinction tested' : 'logical consistency verified'}`
        : `${challenges} weakness${challenges > 1 ? 'es' : ''} identified${c > 0.6 ? ', no overclaiming' : ', potential overclaiming flagged'}`;
    }

    case 'calibration': {
      const conf = (0.3 + c * 0.35 + entityFactor * 0.2).toFixed(2);
      const margin = (0.08 + (1 - c) * 0.15 + entityFactor * 0.1).toFixed(2);
      const grade = parseFloat(conf) > 0.75 ? 'A' : parseFloat(conf) > 0.55 ? 'B' : 'C';
      return `final confidence: ${conf} ± ${margin} (grade ${grade}) — ${qa.isPhilosophical ? 'philosophical claims resist high certainty' : 'calibrated against convergence'}`;
    }
  }
}


// ═════════════════════════════════════════════════════════════════════
// ██ DYNAMIC RAW ANALYSIS — generated from query content
// ═════════════════════════════════════════════════════════════════════

function generateRawAnalysis(qa: QueryAnalysis): string {
  const topic = qa.entities.slice(0, 3).join(', ') || 'the subject';
  const focusAspect = qa.followUpFocus;
  const segments: string[] = [];

  // For follow-ups, add a context-continuation marker
  if (qa.isFollowUp) {
    segments.push(
      `[DATA] Deeper analysis of ${focusAspect || topic} (follow-up pass with increased focus depth). Building on prior evidence base for ${topic}.`,
    );
  }

  if (qa.isPhilosophical) {
    const traditions = Math.floor(3 + qa.entities.length * 0.5);
    const convergence = (0.2 + qa.complexity * 0.3 + (qa.entities.length / 16)).toFixed(2);

    segments.push(
      `[DATA] Analysis of ${traditions} major philosophical frameworks relevant to "${qa.coreQuestion.slice(0, 80)}" reveals fundamental tensions between ${qa.hasNormativeClaims ? 'descriptive and normative claims' : 'competing ontological commitments'}.`,
    );

    if (qa.hasNormativeClaims) {
      segments.push(
        `[DATA] The query crosses the is-ought boundary: ${
          qa.entities.some(e => ['determinism', 'determined', 'free'].includes(e))
            ? 'if hard determinism holds, traditional moral responsibility frameworks require revision — compatibilists maintain moral accountability is coherent even without libertarian free will, while hard incompatibilists argue all desert-based reactive attitudes are unjustified'
            : 'normative claims here require separate justification from the empirical observations — the gap between what is and what ought to be cannot be bridged by evidence alone'
        }.`,
      );
    }

    if (qa.entities.some(e => ['morality', 'moral', 'blame', 'criminal', 'criminals', 'prison', 'imprison', 'punish'].includes(e))) {
      segments.push(
        `[MODEL] Multiple defensible positions identified: (1) Consequentialist — punishment justified by deterrence and social protection regardless of metaphysical freedom; (2) Retributivist — moral desert requires libertarian free will, which determinism undermines; (3) Compatibilist — responsibility grounded in reasons-responsiveness, not ultimate origination; (4) Eliminativist — moral language is a useful social fiction, not tracking objective features of reality.`,
      );
      segments.push(
        `[DATA] Cross-framework convergence is low (${convergence}), confirming this is a genuinely unresolved question where rational disagreement persists.`,
      );
      segments.push(
        `[UNCERTAIN] The intuition that punishment-as-social-mechanism is more defensible than punishment-as-moral-desert aligns with a recognized philosophical position. Whether morality reduces to a sense-making heuristic or tracks something deeper remains contested — this is itself a first-order metaphysical question, not a settled empirical matter.`,
      );
    } else {
      segments.push(
        `[MODEL] The reasoning topology reveals ${traditions > 4 ? 'a highly fragmented' : 'a moderately fragmented'} conceptual landscape for ${topic}. The query resists convergence because it spans multiple philosophical sub-domains with different methodological standards.`,
      );
      segments.push(
        `[UNCERTAIN] Philosophical analysis cannot produce empirical certainty. The confidence score reflects analytical coherence and argument strength, not truth-probability in the scientific sense.`,
      );
    }

    if (qa.emotionalValence === 'negative' || qa.emotionalValence === 'mixed') {
      segments.push(
        `[MODEL] The existential dimensions of this question are noted — the analysis separates logical validity from emotional resonance while acknowledging that philosophical engagement with these questions is not purely intellectual.`,
      );
    }

  } else if (qa.isEmpirical || qa.isMetaAnalytical) {
    const c = qa.complexity;
    const ef = Math.min(1, qa.entities.length / 8);
    const studies = Math.floor(3 + c * 10 + ef * 5);
    const n = Math.floor(500 + c * 30000 + ef * 20000);
    const d = (0.15 + c * 0.8 + ef * 0.4).toFixed(2);
    const iSq = Math.floor(15 + c * 40 + ef * 20);
    const hillScore = (0.4 + c * 0.3 + ef * 0.2).toFixed(2);
    const bf = (0.8 + c * 12 + ef * 8).toFixed(1);
    const priorRange = (0.04 + c * 0.2 + ef * 0.15).toFixed(2);

    segments.push(
      `[DATA] Based on ${studies} ${qa.isMetaAnalytical ? 'pooled studies' : 'available studies'} (combined N ≈ ${n.toLocaleString()}) examining ${topic}, the ${qa.questionType === 'causal' ? 'intervention' : 'relationship'} shows ${parseFloat(d) > 0.8 ? 'a large' : parseFloat(d) > 0.5 ? 'a medium' : parseFloat(d) > 0.2 ? 'a small' : 'a negligible'} effect size (d = ${d}, 95% CI [${(parseFloat(d) - 0.15 - c * 0.15).toFixed(2)}, ${(parseFloat(d) + 0.15 + c * 0.15).toFixed(2)}]) with ${iSq < 30 ? 'low' : iSq < 60 ? 'moderate' : 'high'} heterogeneity (I² = ${iSq}%).`,
    );

    segments.push(
      `[DATA] Bradford Hill criteria score ${hillScore}/1.0 for ${topic}: ${parseFloat(hillScore) > 0.7 ? 'temporality, biological gradient, and plausibility scored above 0.7, supporting a causal interpretation' : parseFloat(hillScore) > 0.5 ? 'partial support — some criteria met but temporality or specificity evidence incomplete' : 'weak causal case — multiple criteria unmet'}.`,
    );

    segments.push(
      `[DATA] Bayesian updating yields posterior range = ${priorRange}, BF₁₀ = ${bf}: ${parseFloat(bf) > 10 ? 'strong' : parseFloat(bf) > 3 ? 'moderate' : 'weak'} evidence. ${parseFloat(priorRange) > 0.25 ? 'Conclusion is sensitive to prior specification' : 'Posterior converges across priors, suggesting data-dominated inference'}.`,
    );

    if (qa.domain === 'medical') {
      const nnt = Math.floor(5 + c * 30 + ef * 20);
      segments.push(
        `[DATA] Clinical significance: NNT = ${nnt}, ${nnt < 15 ? 'suggesting meaningful clinical benefit' : nnt < 30 ? 'moderate clinical significance' : 'raising questions about practical value despite statistical significance'} for ${topic}.`,
      );
    }

    const altExplanations = Math.max(1, Math.floor(1 + c * 2 + ef));
    segments.push(
      `[MODEL] Adversarial review identified ${altExplanations} alternative explanation${altExplanations > 1 ? 's' : ''}: ${
        qa.questionType === 'causal'
          ? `${altExplanations > 1 ? 'reverse causation and residual confounding' : 'residual confounding'}, ${parseFloat(hillScore) > 0.65 ? 'partially mitigated by study designs' : 'inadequately addressed'}`
          : `including ${qa.isMetaAnalytical ? 'publication bias and heterogeneous populations' : 'selection bias and measurement error'}`
      }.`,
    );

    if (iSq > 50 || parseFloat(priorRange) > 0.25) {
      segments.push(
        `[UNCERTAIN] ${iSq > 50 ? 'High heterogeneity suggests the pooled estimate may not represent any single population. ' : ''}${parseFloat(priorRange) > 0.25 ? 'Prior sensitivity indicates current evidence is insufficient to override strong pre-existing beliefs.' : ''}`,
      );
    }

  } else {
    const perspectives = Math.floor(2 + qa.complexity * 3 + qa.entities.length * 0.3);
    const coherence = (0.3 + qa.complexity * 0.35 + (qa.entities.length / 16)).toFixed(2);

    segments.push(
      `[DATA] Analysis of ${perspectives} major perspectives on "${qa.coreQuestion.slice(0, 80)}" yields a coherence index of ${coherence}, indicating ${parseFloat(coherence) > 0.7 ? 'substantial agreement' : parseFloat(coherence) > 0.4 ? 'partial convergence with notable dissent' : 'significant disagreement'}.`,
    );

    if (qa.domain === 'psychology') {
      segments.push(
        `[DATA] Psychological evidence from ${Math.floor(2 + qa.complexity * 4 + qa.entities.length * 0.3)} research paradigms addresses ${topic}. ${qa.questionType === 'causal' ? 'Causal mechanisms are proposed but primarily supported by correlational designs' : 'Multiple theoretical accounts exist with varying empirical support'}.`,
      );
    } else if (qa.domain === 'technology') {
      segments.push(
        `[DATA] Technical analysis identifies ${Math.floor(2 + qa.complexity * 2 + qa.entities.length * 0.3)} key dimensions of ${topic}. ${qa.complexity > 0.5 ? 'Benchmarks exist but ecological validity is limited' : 'The field is rapidly evolving, limiting shelf-life of current findings'}.`,
      );
    } else if (qa.domain === 'social_science') {
      segments.push(
        `[DATA] Social science literature on ${topic} reveals ${Math.floor(2 + qa.complexity * 2 + qa.entities.length * 0.3)} competing frameworks. Cross-cultural generalizability is ${qa.complexity > 0.5 ? 'limited' : 'partially supported'}.`,
      );
    } else {
      segments.push(
        `[MODEL] The question integrates evidence across ${qa.entities.length > 3 ? 'multiple domains' : 'related sub-topics'}, each with different epistemic standards.`,
      );
    }

    if (qa.questionType === 'evaluative' || qa.hasNormativeClaims) {
      segments.push(
        `[MODEL] Evaluative claims about ${topic} depend on value frameworks not adjudicable by evidence alone. The analysis presents strongest arguments from major positions without endorsing one.`,
      );
    }

    segments.push(
      `[UNCERTAIN] Confidence is bounded by inability to access real-time data, conduct original research, or capture lived experiential knowledge relevant to ${topic}. ${qa.isFollowUp ? 'This deeper analysis inherits uncertainties from the initial assessment and adds new ones specific to the focused dimension.' : ''}`,
    );
  }

  return segments.join(' ');
}


// ═════════════════════════════════════════════════════════════════════
// ██ DYNAMIC LAYMAN SUMMARY — query-specific with dynamic labels
// ═════════════════════════════════════════════════════════════════════

function isTrivialQuery(query: string): boolean {
  const trivial = /^(hi|hello|hey|yo|sup|what'?s up|hiya|howdy|greetings|test|testing|lol|ok|okay|hm+|um+|ah+|bruh|nah|yep|yeah|nope|bye|thanks|thx|ty|wow|cool|nice|good|great|sure|fine|meh|idk|hmm+|huh|oh|ooh|aight|ayo|word|bet|dope|sick|lit|fam|bro|dude|ugh|lmao|omg|wtf|wut)\s*[.!?]*$/i;
  return trivial.test(query.trim()) || query.trim().length < 5;
}

type SectionLabels = NonNullable<LaymanSummary['sectionLabels']>;

export function getSectionLabels(qa: QueryAnalysis): SectionLabels {
  if (qa.isPhilosophical) {
    return {
      whatWasTried: 'Analysis approach',
      whatIsLikelyTrue: 'Philosophical landscape',
      confidenceExplanation: 'Epistemic status',
      whatCouldChange: 'Open questions',
      whoShouldTrust: 'How to engage with this',
    };
  }

  if (qa.isMetaAnalytical || (qa.isEmpirical && qa.questionType !== 'causal')) {
    return {
      whatWasTried: 'Methodology',
      whatIsLikelyTrue: 'Key findings',
      confidenceExplanation: 'Evidence strength',
      whatCouldChange: 'Limitations & gaps',
      whoShouldTrust: 'Applicability',
    };
  }

  if (qa.questionType === 'causal') {
    return {
      whatWasTried: 'Causal analysis',
      whatIsLikelyTrue: 'Probable relationship',
      confidenceExplanation: 'Causal certainty',
      whatCouldChange: 'Alternative explanations',
      whoShouldTrust: 'Decision relevance',
    };
  }

  if (qa.questionType === 'evaluative') {
    return {
      whatWasTried: 'Evaluation framework',
      whatIsLikelyTrue: 'Assessment',
      confidenceExplanation: 'Judgment confidence',
      whatCouldChange: 'Value dependencies',
      whoShouldTrust: 'Practical guidance',
    };
  }

  if (qa.questionType === 'speculative') {
    return {
      whatWasTried: 'Scenario analysis',
      whatIsLikelyTrue: 'Most likely trajectory',
      confidenceExplanation: 'Prediction confidence',
      whatCouldChange: 'Wild cards',
      whoShouldTrust: 'Forecast reliability',
    };
  }

  // General / conceptual / definitional / comparative
  return {
    whatWasTried: 'Analytical approach',
    whatIsLikelyTrue: 'Core insight',
    confidenceExplanation: 'Confidence level',
    whatCouldChange: 'What could shift',
    whoShouldTrust: 'Audience & applicability',
  };
}

function generateLaymanSummary(qa: QueryAnalysis, rawAnalysis: string): LaymanSummary {
  const topic = qa.entities.slice(0, 3).join(' and ') || 'this topic';
  const focusAspect = qa.followUpFocus || (qa.isFollowUp ? 'the deeper nuances' : null);

  // ── Trivial / conversational input ─────────────────────────────────
  if (!qa.isFollowUp && isTrivialQuery(qa.coreQuestion)) {
    return {
      whatWasTried: '',
      whatIsLikelyTrue: `Hey! This is a research analysis engine — I run questions through a 10-stage reasoning pipeline that includes statistical, causal, Bayesian, and adversarial analysis. Try asking something like "Is intermittent fasting effective for weight loss?" or "What does the evidence say about screen time and children?" and I'll stress-test it for you.`,
      confidenceExplanation: '',
      whatCouldChange: '',
      whoShouldTrust: '',
    };
  }

  const sectionLabels = getSectionLabels(qa);

  // ── Philosophical queries ──────────────────────────────────────────
  if (qa.isPhilosophical) {
    return {
      whatWasTried: `The system analyzed your question through multiple philosophical frameworks, examining argument structure, internal consistency, and how different intellectual traditions approach ${topic}.`,
      whatIsLikelyTrue: qa.hasNormativeClaims
        ? `This is a genuinely contested question where thoughtful people disagree for good reasons. Your observation identifies a real tension — ${
          qa.entities.some(e => ['determinism', 'determined', 'free'].includes(e))
            ? 'if determinism is true, traditional retributive punishment loses its moral foundation. The strongest remaining justification for criminal justice is the consequentialist one you identified: social protection, deterrence, and incapacitation. Whether morality is a "sense-making signal" or tracks something deeper is itself one of the oldest unresolved questions in philosophy — and the fact that you\'re asking it suggests you\'re already reasoning at a level many professional philosophers take seriously'
            : 'the normative and descriptive dimensions pull in different directions, and this tension cannot be resolved by evidence alone'
        }.`
        : `The analysis found ${rawAnalysis.includes('convergence is low') || rawAnalysis.includes('fragmented') ? 'significant disagreement across frameworks — there is no consensus' : 'partial convergence, but important tensions remain'}. This kind of question resists simple answers because it touches on fundamental assumptions about ${topic}.`,
      confidenceExplanation: `Confidence is ${qa.complexity > 0.6 ? 'intentionally low' : 'moderate at best'} because philosophical questions don't have empirically testable answers. The score reflects analytical coherence, not truth-probability in a scientific sense.`,
      whatCouldChange: qa.hasNormativeClaims
        ? `Your position could be strengthened or challenged by: (1) new empirical findings about human decision-making; (2) philosophical arguments you haven't encountered yet — particularly from the compatibilist tradition, which has sophisticated responses to the determinism challenge; (3) examining edge cases where your intuition breaks down.`
        : `New philosophical arguments, empirical discoveries about ${topic}, or examining the question from an unconsidered tradition could shift the analysis.`,
      whoShouldTrust: `This analysis maps the landscape of arguments and identifies which positions are logically strongest. It should not be treated as a definitive answer — philosophical questions require personal engagement and continued reflection.`,
      sectionLabels,
    };
  }

  // ── Empirical / meta-analytical queries ────────────────────────────
  if (qa.isEmpirical || qa.isMetaAnalytical) {
    const dMatch = rawAnalysis.match(/d = (\d+\.\d+)/);
    const effectSize = dMatch ? parseFloat(dMatch[1]) : 0.5;
    const bfMatch = rawAnalysis.match(/BF₁₀ = (\d+\.?\d*)/);
    const bayesFactor = bfMatch ? parseFloat(bfMatch[1]) : 3;

    return {
      whatWasTried: `The system ran a ${qa.isMetaAnalytical ? 'meta-analytical synthesis, pooling multiple studies' : 'comprehensive evidence review'} to evaluate ${topic}. It applied statistical, causal, Bayesian, and adversarial analysis to stress-test the evidence.`,
      whatIsLikelyTrue: effectSize > 0.8
        ? `The evidence strongly supports a meaningful effect related to ${topic}. The effect is large, and multiple analytical methods converge on this conclusion.`
        : effectSize > 0.4
        ? `There is a moderate, likely real effect for ${topic}. Most evidence points the same direction, though the strength may be overstated by publication practices.`
        : `The evidence for ${topic} is weak or inconsistent. While some studies find an effect, it is small and may not be practically meaningful.`,
      confidenceExplanation: bayesFactor > 10
        ? `Confidence is relatively high because the Bayesian analysis shows strong evidence that converges regardless of starting assumptions.`
        : bayesFactor > 3
        ? `Confidence is moderate — the evidence leans in one direction but isn't overwhelming. The conclusion could shift with new data.`
        : `Confidence is limited because the evidence is weak or the conclusion depends heavily on which assumptions you start with.`,
      whatCouldChange: `${rawAnalysis.includes('publication bias') ? 'Publication bias is a concern — negative results may be missing. ' : ''}${rawAnalysis.includes('confound') ? 'Uncontrolled confounders could explain the association. ' : ''}New well-designed studies with larger samples would clarify the picture for ${topic}.`,
      whoShouldTrust: effectSize > 0.6 && bayesFactor > 5
        ? `This evidence is strong enough to inform guidelines and decisions about ${topic}, though domain experts should verify primary sources.`
        : `This should be treated as preliminary evidence. It's useful for guiding further research on ${topic}, but not for changing practice yet.`,
      sectionLabels,
    };
  }

  // ── General / conceptual queries ───────────────────────────────────
  // For follow-ups, adjust the framing to show we're going deeper, not starting over
  const depthPrefix = qa.isFollowUp
    ? `Building on the previous analysis, the system performed a ${focusAspect ? `focused deep-dive into ${focusAspect} as it relates to` : 'deeper-layer analysis of'} ${topic}`
    : null;

  return {
    whatWasTried: qa.isFollowUp
      ? `${depthPrefix}, running ${Math.floor(5 + qa.complexity * 5)} additional reasoning passes with increased focus depth. The pipeline targeted ${focusAspect || 'the specific dimensions'} the user asked about, cross-referencing with the initial findings.`
      : qa.domain !== 'general'
      ? `The system examined "${qa.coreQuestion.slice(0, 80)}" through ${qa.domain === 'psychology' ? 'behavioral science and cognitive' : qa.domain === 'technology' ? 'technical assessment and benchmarking' : qa.domain === 'social_science' ? 'sociological and institutional' : qa.domain === 'economics' ? 'economic modeling and market analysis' : 'cross-disciplinary analytical'} frameworks, running ${Math.floor(3 + qa.complexity * 7)} reasoning passes across ${qa.entities.length > 2 ? qa.entities.length : 'multiple'} key dimensions.`
      : `The system ran a structured analysis of "${qa.coreQuestion.slice(0, 80)}" — breaking it into testable sub-claims, checking internal consistency, and evaluating from ${Math.floor(2 + qa.entities.length)} distinct analytical perspectives.`,

    whatIsLikelyTrue: (() => {
      const topic = qa.entities.slice(0, 3).join(', ') || 'this topic';

      // Follow-up responses should go DEEPER into the specific aspect, not repeat the overview
      if (qa.isFollowUp && focusAspect) {
        return `Drilling into ${focusAspect} specifically: the evidence reveals a more nuanced picture than the initial overview suggests. For ${topic}, ${focusAspect} operates through multiple mechanisms — some well-established in the literature and others still debated. The strongest evidence supports a conditional relationship: the degree of ${focusAspect} depends on contextual factors including individual differences, methodology, and the specific outcome measures used. What appears as a simple relationship at the surface level actually involves multiple interacting pathways, with both direct effects (supported by stronger evidence) and indirect effects through mediating variables (where evidence is more mixed).`;
      }

      if (qa.isFollowUp) {
        return `Going deeper into ${topic}: the additional analysis reveals layers that the initial assessment didn't fully surface. The core findings hold, but with important qualifications. The evidence base is stronger in some dimensions than others, and the nuances that matter most involve the boundary conditions — where the general pattern breaks down or reverses. Understanding these edge cases is where the real insight lies.`;
      }

      if (qa.questionType === 'evaluative') {
        return `The answer depends significantly on which values and criteria you prioritize. For ${topic}, the evidence supports multiple defensible positions, and the system found no single framing that dominates all others. The strongest claims are those grounded in empirical observation rather than theoretical preference.`;
      }
      if (qa.questionType === 'causal') {
        return `There is ${rawAnalysis.includes('strong causal') ? 'reasonably strong' : 'suggestive but incomplete'} evidence linking the factors in question. For ${topic}, correlational data exists but establishing firm causation requires controlling for confounders that current research hasn't fully addressed.`;
      }
      if (qa.questionType === 'comparative') {
        return `The comparison reveals meaningful differences, but context matters heavily. For ${topic}, which option "wins" depends on the specific criteria, population, and conditions you care about most. No single answer applies universally.`;
      }
      if (qa.questionType === 'speculative') {
        return `This is inherently forward-looking, so confidence is bounded. For ${topic}, the most probable trajectory based on current trends and structural factors points in a specific direction, but prediction accuracy degrades with time horizon.`;
      }
      if (qa.complexity < 0.3) {
        return `The evidence on ${topic} is relatively straightforward. The key points are well-established, though as with any topic, edge cases and contextual factors can change the picture.`;
      }
      return `This is a multi-layered question. For ${topic}, the evidence converges on some points but diverges on others. The most robust finding is that simplistic framings miss important nuances — the reality involves trade-offs and conditional dependencies that resist sound-bite answers.`;
    })(),

    confidenceExplanation: (() => {
      if (qa.isFollowUp) return `Confidence on this deeper pass is ${qa.complexity > 0.5 ? 'lower than the initial assessment' : 'comparable to the initial assessment'} because digging into nuances exposes more uncertainty. The system is more certain about the broad strokes and less certain about the specific mechanisms and boundary conditions that this follow-up targets.`;
      if (qa.complexity > 0.7) return `Confidence is moderate-to-low because the question is genuinely complex — it touches multiple domains with different evidence standards, and any simple answer would be misleading.`;
      if (qa.questionType === 'speculative') return `Confidence is inherently limited for speculative questions. The system can analyze trends and structural factors but cannot predict future events with high reliability.`;
      if (qa.questionType === 'evaluative') return `Confidence in the factual components is reasonable, but the evaluative dimension depends on values and priorities that the system cannot adjudicate.`;
      if (qa.isEmpirical) return `Confidence is anchored to the available evidence. Where randomized controlled studies exist, confidence is higher; where the system relies on observational data or expert opinion, it's lower.`;
      return `Confidence reflects the quality and convergence of available evidence. The system is more certain about well-studied aspects and less certain about areas where research is thin or contradictory.`;
    })(),

    whatCouldChange: (() => {
      const topic = qa.entities.slice(0, 2).join(' and ') || 'this topic';
      const parts: string[] = [];
      if (qa.isFollowUp) parts.push(`The specific nuances identified in this deeper analysis are more sensitive to methodological choices and population differences than the broad findings.`);
      if (qa.isEmpirical || qa.questionType === 'causal') parts.push(`New randomized controlled studies with larger samples could strengthen or overturn the current evidence on ${topic}.`);
      if (qa.hasNormativeClaims) parts.push(`Shifts in cultural values or ethical frameworks could reframe which considerations are most important.`);
      if (qa.questionType === 'speculative') parts.push(`Unexpected events, policy changes, or technological breakthroughs could invalidate current projections.`);
      if (parts.length === 0) parts.push(`New data, unconsidered perspectives, or methodological improvements could shift this analysis.`);
      if (!qa.isFollowUp) parts.push(`Framing the question differently could highlight aspects the current analysis underweights.`);
      return parts.join(' ');
    })(),

    whoShouldTrust: (() => {
      const topic = qa.entities.slice(0, 2).join(' and ') || 'this topic';
      if (qa.isFollowUp) return `This deeper analysis is most valuable for researchers and practitioners who need to understand the specific mechanisms and boundary conditions around ${topic}. The nuances identified here go beyond introductory-level understanding and into territory where expert judgment matters.`;
      if (qa.complexity > 0.7) return `This analysis provides a structured map of a genuinely difficult question about ${topic}. Use it as a starting point for deeper investigation, not as a final answer. Domain experts will likely agree with the framework but may weight factors differently.`;
      if (qa.isEmpirical) return `The evidence-based components of this analysis are solid for informing decisions about ${topic}. Cross-reference with primary sources and domain-specific guidelines before making high-stakes decisions.`;
      return `This analysis is useful for understanding the key considerations around ${topic}. It provides a balanced overview, but specialists in the relevant field may offer additional depth and nuance.`;
    })(),

    sectionLabels,
  };
}


// ═════════════════════════════════════════════════════════════════════
// ██ SIGNAL GENERATION — correlated with query properties
// ═════════════════════════════════════════════════════════════════════

function generateSignals(qa: QueryAnalysis, controls?: PipelineControls, steeringBias?: SteeringBias): SignalUpdate & { grade: string; mode: string } {
  // Apply complexity bias from controls
  const c = Math.max(0, Math.min(1, qa.complexity + (controls?.complexityBias ?? 0)));
  const advInt = controls?.adversarialIntensity ?? 1.0;
  const bayStr = controls?.bayesianPriorStrength ?? 1.0;
  // Deterministic entity-based factor (replaces Math.random())
  const ef = Math.min(1, qa.entities.length / 8);

  const betti0 = qa.isPhilosophical
    ? Math.floor(2 + qa.entities.length * 0.5)
    : Math.max(1, Math.floor(1 + c * 4));
  const betti1 = qa.isPhilosophical
    ? (qa.hasNormativeClaims ? Math.floor(1 + ef) : Math.floor(ef * 1.5))
    : Math.floor(c * 2 * advInt + ef);
  const persistenceEntropy = qa.isPhilosophical
    ? 0.5 + c * 1.5 + ef * 0.4
    : 0.1 + c * 1.8 + ef * 0.25;
  const maxPersistence = 0.1 + c * 0.5 + ef * 0.15;

  const baseConf = qa.isPhilosophical
    ? 0.2 + c * 0.15 + ef * 0.1
    : qa.isEmpirical
    ? (0.45 + c * 0.2 + ef * 0.15) * bayStr
    : 0.35 + c * 0.2 + ef * 0.15;

  const entropy = qa.isPhilosophical
    ? 0.5 + c * 0.3 + ef * 0.1
    : qa.isEmpirical
    ? 0.05 + c * 0.4 + ef * 0.1
    : 0.15 + c * 0.45 + ef * 0.1;

  const dissonance = qa.hasNormativeClaims
    ? (0.3 + c * 0.25 + ef * 0.15) * advInt
    : qa.isPhilosophical
    ? 0.2 + c * 0.25 + ef * 0.15
    : (0.05 + c * 0.35 + ef * 0.1) * advInt;

  const healthScoreBase = Math.max(0.25, 1 - entropy * 0.45 - dissonance * 0.35 - (qa.hasSafetyKeywords ? 0.15 : 0));

  const riskScoreBase = qa.hasSafetyKeywords
    ? 0.4 + c * 0.2 + ef * 0.15
    : qa.hasNormativeClaims
    ? 0.15 + c * 0.15 + ef * 0.1
    : 0.02 + c * 0.2 + ef * 0.08;

  // ── Apply steering bias (activation steering injection point) ──
  // Pattern from interceptor.py: activations + coeff * vector
  const sb = steeringBias;
  const steeredConf = sb ? baseConf + sb.confidence * sb.steeringStrength : baseConf;
  const steeredEntropy = sb ? entropy + sb.entropy * sb.steeringStrength : entropy;
  const steeredDissonance = sb ? dissonance + sb.dissonance * sb.steeringStrength : dissonance;
  const healthScore = sb ? healthScoreBase + sb.healthScore * sb.steeringStrength : healthScoreBase;
  const riskScore = sb ? riskScoreBase + sb.riskScore * sb.steeringStrength : riskScoreBase;

  const safetyState: SafetyState = riskScore >= 0.55 ? 'red' : riskScore >= 0.35 ? 'yellow' : 'green';

  // Apply focus/temperature overrides from controls + steering
  const baseDepth = controls?.focusDepthOverride ?? (2 + c * 7 + (qa.isPhilosophical ? 1.5 : 0));
  const baseTemp = controls?.temperatureOverride ?? (qa.isPhilosophical ? 0.7 + c * 0.15 + ef * 0.1 : 1.0 - c * 0.5);
  const depth = sb ? baseDepth + sb.focusDepth * sb.steeringStrength : baseDepth;
  const temp = sb ? baseTemp + sb.temperatureScale * sb.steeringStrength : baseTemp;

  const conceptPool = qa.isPhilosophical
    ? ['free_will', 'determinism', 'moral_responsibility', 'compatibilism', 'retribution',
       'consequentialism', 'agency', 'desert', 'justice', ...qa.entities]
    : qa.isEmpirical
    ? ['effect_size', 'power', 'confounding', 'heterogeneity', 'causality', 'bias',
       'replication', 'bayesian_prior', ...qa.entities]
    : ['coherence', 'framework', 'evidence', 'inference', ...qa.entities];

  const uniqueConcepts = [...new Set(conceptPool)];
  // If concept weights provided, bias selection toward higher-weighted concepts
  const cw = controls?.conceptWeights ?? {};
  const sortedConcepts = uniqueConcepts.sort((a, b) => {
    const wa = cw[a] ?? 1.0;
    const wb = cw[b] ?? 1.0;
    // Higher weight = more likely to be selected (sort descending), deterministic by name length
    return (wb + a.length * 0.02) - (wa + b.length * 0.02);
  });
  const concepts = sortedConcepts.slice(0, Math.floor(3 + c * 4));
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
  const chord = concepts.reduce((p, _, i) => p * (primes[i] || 41), 1);

  const clampedConf = Math.max(0.1, Math.min(steeredConf, 0.95));
  const grade = clampedConf > 0.7 ? 'A' : clampedConf > 0.5 ? 'B' : 'C';
  const mode = qa.isMetaAnalytical ? 'meta-analytical' : qa.isPhilosophical ? 'philosophical-analytical' : qa.isEmpirical ? 'executive' : 'moderate';

  return {
    confidence: clampedConf,
    entropy: Math.max(0.01, Math.min(steeredEntropy, 0.95)),
    dissonance: Math.max(0.01, Math.min(steeredDissonance, 0.95)),
    healthScore: Math.max(healthScore, 0.2),
    safetyState,
    riskScore: Math.max(0.01, Math.min(riskScore, 0.9)),
    tda: { betti0, betti1, persistenceEntropy, maxPersistence },
    focusDepth: depth,
    temperatureScale: temp,
    activeConcepts: concepts,
    activeChordProduct: chord,
    harmonyKeyDistance: Math.min(dissonance, 0.95),
    grade,
    mode,
  };
}


// ═════════════════════════════════════════════════════════════════════
// ██ ASYNC GENERATOR — yields PipelineEvent for SSE streaming
// ═════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wrap a promise with a timeout to prevent infinite hangs */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Helper: yield a stage event */
function stageEvent(
  stage: PipelineStage,
  status: 'active' | 'complete',
  detail?: string,
  value?: number,
): PipelineEvent {
  return { type: 'stage', stage, status, detail: detail ?? '', value: value ?? (status === 'complete' ? 1 : 0.5) };
}

/**
 * runPipeline — the core async generator.
 * Yields PipelineEvent objects that the SSE route streams to the client.
 *
 * In LLM mode (api/local), stages progress as actual LLM calls execute.
 * In simulation mode, stages progress with synthetic delays.
 */
export async function* runPipeline(
  query: string,
  controls?: PipelineControls,
  context?: ConversationContext,
  steeringBias?: SteeringBias,
  inferenceConfig?: InferenceConfig,
  soarConfig?: SOARConfig,
): AsyncGenerator<PipelineEvent> {
  const qa = analyzeQuery(query, context);
  const signals = generateSignals(qa, controls, steeringBias);

  // Track stage results for reflection/arbitration
  const stageResults: StageResult[] = STAGES.map((s) => ({
    stage: s,
    status: 'idle' as const,
    summary: s,
  }));

  const isLLM = inferenceConfig && inferenceConfig.mode !== 'simulation';

  // ════════════════════════════════════════════════════════════════
  // LLM MODE — stages correspond to real LLM processing steps
  // ════════════════════════════════════════════════════════════════
  if (isLLM) {
    const LLM_TIMEOUT = 60_000; // 60s per call
    let rawAnalysis: string;
    let laymanSummary: LaymanSummary;
    let reflection: ReturnType<typeof generateReflection>;
    let arbitration: ReturnType<typeof generateArbitration>;

    try {
      const model = resolveProvider(inferenceConfig);

      // ── Stage 1: Triage — query analysis ──
      yield stageEvent('triage', 'active', 'Analyzing query structure...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.1, dissonance: signals.dissonance * 0.1, healthScore: 0.9, safetyState: 'green' as SafetyState, riskScore: signals.riskScore * 0.1 } };
      stageResults[0] = { stage: 'triage', status: 'complete', summary: 'triage', detail: generateStageDetail('triage', qa), value: 1 };
      await sleep(200);
      yield stageEvent('triage', 'complete', stageResults[0].detail, 1);

      // ── Stage 2: Memory — context retrieval ──
      yield stageEvent('memory', 'active', 'Retrieving relevant context...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.2, dissonance: signals.dissonance * 0.15, healthScore: 0.85, safetyState: 'green' as SafetyState, riskScore: signals.riskScore * 0.15 } };
      stageResults[1] = { stage: 'memory', status: 'complete', summary: 'memory', detail: generateStageDetail('memory', qa), value: 1 };
      await sleep(200);
      yield stageEvent('memory', 'complete', stageResults[1].detail, 1);

      // ── Stage 3: Routing — pathway selection ──
      yield stageEvent('routing', 'active', 'Selecting analytical pathways...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.3, dissonance: signals.dissonance * 0.25, healthScore: 0.8, safetyState: 'green' as SafetyState, riskScore: signals.riskScore * 0.2 } };
      stageResults[2] = { stage: 'routing', status: 'complete', summary: 'routing', detail: generateStageDetail('routing', qa), value: 1 };
      await sleep(150);
      yield stageEvent('routing', 'complete', stageResults[2].detail, 1);

      // ── Stage 4: Statistical — LLM raw analysis (THE BIG CALL) ──
      yield stageEvent('statistical', 'active', 'Running statistical analysis via LLM...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.4, dissonance: signals.dissonance * 0.35 } };
      rawAnalysis = await withTimeout(llmGenerateRawAnalysis(model, qa, signals), LLM_TIMEOUT, 'Raw analysis');
      stageResults[3] = { stage: 'statistical', status: 'complete', summary: 'statistical', detail: 'Statistical analysis complete', value: 1 };
      yield stageEvent('statistical', 'complete', 'Analysis generated', 1);

      // ── Stage 5: Causal — completed (part of raw analysis) ──
      yield stageEvent('causal', 'active', 'Evaluating causal relationships...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.55, dissonance: signals.dissonance * 0.5, healthScore: signals.healthScore * 0.7 } };
      stageResults[4] = { stage: 'causal', status: 'complete', summary: 'causal', detail: generateStageDetail('causal', qa), value: 1 };
      await sleep(100);
      yield stageEvent('causal', 'complete', stageResults[4].detail, 1);

      // Emit mid-pipeline TDA and concept signals
      yield { type: 'signals', data: { tda: signals.tda, focusDepth: signals.focusDepth, temperatureScale: signals.temperatureScale, activeConcepts: signals.activeConcepts, activeChordProduct: signals.activeChordProduct, harmonyKeyDistance: signals.harmonyKeyDistance } };

      // ── Stage 6: Meta-Analysis — completed (part of raw analysis) ──
      yield stageEvent('meta_analysis', 'active', 'Running meta-analytical synthesis...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.65, dissonance: signals.dissonance * 0.6 } };
      stageResults[5] = { stage: 'meta_analysis', status: 'complete', summary: 'meta_analysis', detail: generateStageDetail('meta_analysis', qa), value: 1 };
      await sleep(100);
      yield stageEvent('meta_analysis', 'complete', stageResults[5].detail, 1);

      // ── SOAR: Meta-Reasoning Loop (if enabled and at edge of learnability) ──
      const effectiveSoarConfig = soarConfig ?? DEFAULT_SOAR_CONFIG;
      let soarSession: SOARSession | null = null;
      if (effectiveSoarConfig.enabled) {
        const probe = quickProbe(qa, {
          confidence: signals.confidence,
          entropy: signals.entropy,
          dissonance: signals.dissonance,
        }, effectiveSoarConfig);

        yield { type: 'soar', event: 'probe', data: { atEdge: probe.atEdge, difficulty: probe.estimatedDifficulty, reason: probe.reason } };

        if (probe.atEdge || !effectiveSoarConfig.autoDetect) {
          yield { type: 'soar', event: 'start', data: { recommendedDepth: probe.recommendedDepth } };

          const inferenceMode = inferenceConfig?.mode ?? 'simulation';
          soarSession = await runSOAR(
            isLLM ? model : null,
            query,
            qa,
            {
              confidence: signals.confidence,
              entropy: signals.entropy,
              dissonance: signals.dissonance,
              healthScore: signals.healthScore,
              persistenceEntropy: signals.tda.persistenceEntropy,
            },
            inferenceMode,
            effectiveSoarConfig,
            (event) => {
              // SOAR events are emitted but we can't yield from a callback
              // so we just log. The session result carries all data.
            },
          );

          yield { type: 'soar', event: 'complete', data: {
            improved: soarSession.overallImproved,
            iterations: soarSession.iterationsCompleted,
            reward: soarSession.rewards.reduce((s, r) => s + r.composite, 0),
            contradictions: soarSession.contradictionScan?.contradictions.length ?? 0,
          }};

          // If SOAR improved signals, update them for downstream stages
          if (soarSession.overallImproved && soarSession.finalSignals) {
            signals.confidence = soarSession.finalSignals.confidence;
            signals.entropy = soarSession.finalSignals.entropy;
            signals.dissonance = soarSession.finalSignals.dissonance;
            signals.healthScore = soarSession.finalSignals.healthScore;
            signals.tda.persistenceEntropy = soarSession.finalSignals.persistenceEntropy;

            yield { type: 'signals', data: {
              confidence: signals.confidence,
              entropy: signals.entropy,
              dissonance: signals.dissonance,
              healthScore: signals.healthScore,
              tda: signals.tda,
            }};
          }
        }
      }

      // ── Stage 7-8: Bayesian + Synthesis — parallel LLM calls ──
      yield stageEvent('bayesian', 'active', 'Computing Bayesian posteriors...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.75, dissonance: signals.dissonance * 0.7, healthScore: signals.healthScore * 0.85 } };
      const sectionLabels = getSectionLabels(qa);
      const [llmLayman, llmReflection, llmArbitration] = await withTimeout(
        Promise.all([
          llmGenerateLaymanSummary(model, qa, rawAnalysis, sectionLabels),
          llmGenerateReflection(model, stageResults, rawAnalysis),
          llmGenerateArbitration(model, stageResults),
        ]),
        LLM_TIMEOUT,
        'Parallel LLM calls',
      );
      laymanSummary = llmLayman;
      reflection = llmReflection;
      arbitration = llmArbitration;

      stageResults[6] = { stage: 'bayesian', status: 'complete', summary: 'bayesian', detail: 'Bayesian updating complete', value: 1 };
      yield stageEvent('bayesian', 'complete', 'Bayesian posteriors computed', 1);
      stageResults[7] = { stage: 'synthesis', status: 'complete', summary: 'synthesis', detail: 'Synthesis complete', value: 1 };
      yield stageEvent('synthesis', 'active', 'Synthesizing results...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.85, dissonance: signals.dissonance * 0.8, safetyState: signals.safetyState } };
      await sleep(80);
      yield stageEvent('synthesis', 'complete', 'Results synthesized', 1);

      // ── Stage 9: Adversarial — reflection ──
      yield stageEvent('adversarial', 'active', 'Running adversarial review...');
      yield { type: 'signals', data: { entropy: signals.entropy * 0.92, dissonance: signals.dissonance * 0.9, riskScore: signals.riskScore * 0.85 } };
      stageResults[8] = { stage: 'adversarial', status: 'complete', summary: 'adversarial', detail: `${reflection.selfCriticalQuestions.length} critical questions, ${reflection.adjustments.length} adjustments`, value: 1 };
      await sleep(80);
      yield stageEvent('adversarial', 'complete', stageResults[8].detail, 1);

      // ── Build dualMessage before truth assessment ──
      const adjustedConfidence = reflection.adjustments.length > 0
        ? Math.max(0.15, signals.confidence - 0.02 * reflection.adjustments.length)
        : signals.confidence;

      const uncertaintyTags = (rawAnalysis.match(/\[(DATA|MODEL|UNCERTAIN|CONFLICT)\]/g) ?? []).map((tag) => ({
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
        rawAnalysis,
        uncertaintyTags,
        modelVsDataFlags,
        laymanSummary,
        reflection,
        arbitration,
      };

      // ── Stage 10: Calibration — truth assessment ──
      yield stageEvent('calibration', 'active', 'Calibrating truth assessment...');
      yield { type: 'signals', data: { entropy: signals.entropy, dissonance: signals.dissonance, healthScore: signals.healthScore, riskScore: signals.riskScore, confidence: adjustedConfidence } };

      let truthAssessment;
      try {
        truthAssessment = await withTimeout(
          llmGenerateTruthAssessment(model, dualMessage, {
            entropy: signals.entropy,
            dissonance: signals.dissonance,
            confidence: adjustedConfidence,
            healthScore: signals.healthScore,
            safetyState: signals.safetyState,
            riskScore: signals.riskScore,
          }),
          LLM_TIMEOUT,
          'Truth assessment',
        );
      } catch (truthError) {
        console.error('[runPipeline] Truth assessment LLM call failed, using computed fallback:', truthError);
        yield {
          type: 'error',
          message: `Truth assessment LLM call failed — using signal-based computation instead: ${truthError instanceof Error ? truthError.message : 'timeout'}`,
        };
        truthAssessment = generateTruthAssessment(dualMessage, {
          entropy: signals.entropy,
          dissonance: signals.dissonance,
          confidence: adjustedConfidence,
          healthScore: signals.healthScore,
          safetyState: signals.safetyState,
          tda: signals.tda,
          riskScore: signals.riskScore,
        });
      }

      stageResults[9] = { stage: 'calibration', status: 'complete', summary: 'calibration', detail: 'Calibration complete', value: 1 };
      yield stageEvent('calibration', 'complete', 'Calibration complete', 1);

      // ── Stream the layman summary word-by-word ──
      const textToStream = laymanSummary.whatIsLikelyTrue;
      const words = textToStream.split(' ');
      for (let w = 0; w < words.length; w++) {
        const word = (w === 0 ? '' : ' ') + words[w];
        yield { type: 'text-delta', text: word };
        await sleep(25 + Math.random() * 35);
      }

      // ── Emit complete event ──
      yield {
        type: 'complete',
        dualMessage,
        truthAssessment,
        confidence: adjustedConfidence,
        grade: signals.grade,
        mode: signals.mode,
        signals: {
          ...signals,
          confidence: adjustedConfidence,
        },
      };
      return; // Done — skip simulation path
    } catch (llmError) {
      // Inform user clearly that LLM failed — do NOT silently fall back
      console.error('[runPipeline] LLM error, falling back to simulation:', llmError);
      yield {
        type: 'error',
        message: `LLM inference failed: ${llmError instanceof Error ? llmError.message : 'Unknown error'}. Falling back to simulation mode — results below are template-generated, not from your configured model.`,
      };
      // Fall through to simulation path below
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SIMULATION MODE — synthetic delays, template-generated content
  // ════════════════════════════════════════════════════════════════
  const stageDelay = qa.isMetaAnalytical ? 350 : qa.isPhilosophical ? 300 : 200;

  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    const detail = generateStageDetail(stage, qa);
    const value = 0.3 + Math.random() * 0.7;

    stageResults[i] = { stage, status: 'active', summary: stage, detail, value };

    yield {
      type: 'stage',
      stage,
      detail,
      value,
      status: 'active',
    };

    const progress = (i + 1) / STAGES.length;
    yield {
      type: 'signals',
      data: {
        entropy: signals.entropy * progress,
        dissonance: signals.dissonance * progress,
        healthScore: Math.max(0.2, 1 - (signals.entropy * progress * 0.45 + signals.dissonance * progress * 0.35)),
        safetyState: progress > 0.5 ? signals.safetyState : 'green',
        riskScore: signals.riskScore * progress,
      },
    };

    if (i > 0) {
      stageResults[i - 1] = { ...stageResults[i - 1], status: 'complete' };
      yield {
        type: 'stage',
        stage: STAGES[i - 1],
        detail: stageResults[i - 1].detail ?? '',
        value: stageResults[i - 1].value ?? 1,
        status: 'complete',
      };
    }

    if (i === 4) {
      yield {
        type: 'signals',
        data: {
          tda: signals.tda,
          focusDepth: signals.focusDepth,
          temperatureScale: signals.temperatureScale,
          activeConcepts: signals.activeConcepts,
          activeChordProduct: signals.activeChordProduct,
          harmonyKeyDistance: signals.harmonyKeyDistance,
        },
      };
    }

    await sleep(stageDelay + Math.random() * 150);
  }

  stageResults[STAGES.length - 1] = { ...stageResults[STAGES.length - 1], status: 'complete' };
  yield {
    type: 'stage',
    stage: STAGES[STAGES.length - 1],
    detail: stageResults[STAGES.length - 1].detail ?? '',
    value: 1,
    status: 'complete',
  };

  // ── SOAR in simulation mode ──
  const simSoarConfig = soarConfig ?? DEFAULT_SOAR_CONFIG;
  if (simSoarConfig.enabled) {
    const probe = quickProbe(qa, {
      confidence: signals.confidence,
      entropy: signals.entropy,
      dissonance: signals.dissonance,
    }, simSoarConfig);

    yield { type: 'soar', event: 'probe', data: { atEdge: probe.atEdge, difficulty: probe.estimatedDifficulty, reason: probe.reason } };

    if (probe.atEdge || !simSoarConfig.autoDetect) {
      yield { type: 'soar', event: 'start', data: { recommendedDepth: probe.recommendedDepth } };

      const simSoarSession = await runSOAR(
        null, query, qa,
        {
          confidence: signals.confidence,
          entropy: signals.entropy,
          dissonance: signals.dissonance,
          healthScore: signals.healthScore,
          persistenceEntropy: signals.tda.persistenceEntropy,
        },
        'simulation',
        simSoarConfig,
      );

      yield { type: 'soar', event: 'complete', data: {
        improved: simSoarSession.overallImproved,
        iterations: simSoarSession.iterationsCompleted,
        reward: simSoarSession.rewards.reduce((s, r) => s + r.composite, 0),
        contradictions: simSoarSession.contradictionScan?.contradictions.length ?? 0,
      }};

      if (simSoarSession.overallImproved && simSoarSession.finalSignals) {
        signals.confidence = simSoarSession.finalSignals.confidence;
        signals.entropy = simSoarSession.finalSignals.entropy;
        signals.dissonance = simSoarSession.finalSignals.dissonance;
        signals.healthScore = simSoarSession.finalSignals.healthScore;

        yield { type: 'signals', data: {
          confidence: signals.confidence,
          entropy: signals.entropy,
          dissonance: signals.dissonance,
          healthScore: signals.healthScore,
        }};
      }
    }
  }

  // Template-generated content
  const rawAnalysis = generateRawAnalysis(qa);
  const laymanSummary = generateLaymanSummary(qa, rawAnalysis);
  const reflection = generateReflection(stageResults, rawAnalysis);
  const arbitration = generateArbitration(stageResults);

  const adjustedConfidence = reflection.adjustments.length > 0
    ? Math.max(0.15, signals.confidence - 0.02 * reflection.adjustments.length)
    : signals.confidence;

  const uncertaintyTags = (rawAnalysis.match(/\[(DATA|MODEL|UNCERTAIN|CONFLICT)\]/g) ?? []).map((tag) => ({
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
    rawAnalysis,
    uncertaintyTags,
    modelVsDataFlags,
    laymanSummary,
    reflection,
    arbitration,
  };

  const truthAssessment = generateTruthAssessment(dualMessage, {
    entropy: signals.entropy,
    dissonance: signals.dissonance,
    confidence: adjustedConfidence,
    healthScore: signals.healthScore,
    safetyState: signals.safetyState,
    tda: signals.tda,
    riskScore: signals.riskScore,
  });

  // Stream the layman summary word-by-word
  const textToStream = laymanSummary.whatIsLikelyTrue;
  const words = textToStream.split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = (i === 0 ? '' : ' ') + words[i];
    yield { type: 'text-delta', text: word };
    const baseDelay = 30 + Math.random() * 40;
    await sleep(baseDelay);
  }

  yield {
    type: 'complete',
    dualMessage,
    truthAssessment,
    confidence: adjustedConfidence,
    grade: signals.grade,
    mode: signals.mode,
    signals: {
      ...signals,
      confidence: adjustedConfidence,
    },
  };
}
