/**
 * Query-aware simulation engine for the 10-stage executive pipeline.
 * Generates dynamic responses based on the actual query content,
 * domain classification, and question-type analysis.
 *
 * Frontend-only — replace with real API calls when connected to the PFC backend.
 */

import * as Haptics from 'expo-haptics';
import { usePFCStore, STAGES } from '../store/usePFCStore';
import type { PipelineStage, SafetyState } from '../store/usePFCStore';
import type { DualMessage, LaymanSummary } from './types';
import { generateReflection } from './reflection';
import { generateArbitration } from './arbitration';
import { generateTruthAssessment } from './truthbot';

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

interface QueryAnalysis {
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
}

function analyzeQuery(query: string): QueryAnalysis {
  const lower = query.toLowerCase();
  const words = query.split(/\s+/);
  const wordCount = words.length;

  // Domain detection
  const domainPatterns: [RegExp, Domain][] = [
    [/\b(drug|treatment|therapy|clinical|patient|dose|symptom|disease|cancer|heart|blood|surgery|aspirin|stroke|medic|pharma|vaccine|diagnosis|prognosis|efficacy|ssri|depression|health)\b/i, 'medical'],
    [/\b(meaning|truth|moral|ethic|consciousness|existence|free.?will|determinism|metaphys|epistem|ontolog|philosophy|virtue|deontol|utilitarian|nihil|absurd)\b/i, 'philosophy'],
    [/\b(quantum|particle|evolution|genome|cell|molecule|gravity|physics|chemistry|biology|neuroscience|climate|ecosystem|species)\b/i, 'science'],
    [/\b(algorithm|software|AI|machine.?learn|neural.?net|blockchain|compute|programming|data.?science|model|training|GPT|LLM|transformer)\b/i, 'technology'],
    [/\b(society|culture|inequality|gender|race|class|politics|democracy|governance|institution|social|community)\b/i, 'social_science'],
    [/\b(market|inflation|GDP|fiscal|monetary|trade|supply|demand|price|wage|economic|capitalism|labor)\b/i, 'economics'],
    [/\b(behavior|cognition|emotion|perception|memory|personality|mental|anxiety|trauma|attachment|motivation|bias|cognitive|sleep)\b/i, 'psychology'],
    [/\b(should|ought|right|wrong|justice|fair|blame|guilt|punish|crime|criminal|prison|morality|law|legal)\b/i, 'ethics'],
  ];

  let domain: Domain = 'general';
  for (const [pattern, d] of domainPatterns) {
    if (pattern.test(query)) { domain = d; break; }
  }

  // Question type
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
    if (pattern.test(query)) { questionType = qt; break; }
  }

  // Entity extraction
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

  const entities = words
    .map((w) => w.replace(/[^a-zA-Z'-]/g, '').toLowerCase())
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8);

  // Core question
  const sentences = query.split(/[.?!]+/).map((s) => s.trim()).filter(Boolean);
  const questionSentence = sentences.find((s) => s.includes('?')) ?? sentences[0] ?? query;
  const coreQuestion = questionSentence.slice(0, 120);

  const complexity = Math.min(1, (wordCount / 40) * 0.5 + (entities.length / 8) * 0.3 + (sentences.length > 2 ? 0.2 : 0));

  const isEmpirical = /\b(study|trial|evidence|data|experiment|rct|cohort|measure|observe|effect|efficacy)\b/i.test(query);
  const isPhilosophical = /\b(truth|meaning|moral|ethic|consciousness|free.?will|determinism|existence|reality|metaphys|why are we|what is the truth)\b/i.test(query);
  const isMetaAnalytical = /\b(meta.?analy|pool|systematic|heterogeneity|across studies)\b/i.test(query);
  const hasSafetyKeywords = /\b(harm|danger|weapon|toxic|exploit|kill|violence|suicide)\b/i.test(query);
  const hasNormativeClaims = /\b(should|ought|right|wrong|blame|guilt|deserve|just|fair|moral)\b/i.test(query);

  const keyTerms = entities.slice(0, 5);

  const negativeWords = /\b(blame|imprison|bad|wrong|harm|suffering|pain|death|guilt|punish|crime|unjust|unfair)\b/i;
  const positiveWords = /\b(good|benefit|improve|help|hope|progress|heal|growth|love|justice)\b/i;
  const valenceNeg = negativeWords.test(query);
  const valencePos = positiveWords.test(query);
  const emotionalValence: QueryAnalysis['emotionalValence'] = valenceNeg && valencePos
    ? 'mixed' : valenceNeg ? 'negative' : valencePos ? 'positive' : 'neutral';

  return {
    domain, questionType, entities, coreQuestion, complexity,
    isEmpirical, isPhilosophical, isMetaAnalytical,
    hasSafetyKeywords, hasNormativeClaims, keyTerms, emotionalValence,
  };
}


// ═════════════════════════════════════════════════════════════════════
// ██ DYNAMIC STAGE DETAILS — query-aware
// ═════════════════════════════════════════════════════════════════════

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateStageDetail(stage: PipelineStage, qa: QueryAnalysis): string {
  const topic = qa.entities.slice(0, 3).join(', ') || 'the query topic';

  switch (stage) {
    case 'triage':
      return qa.isPhilosophical
        ? `complexity score: ${(0.7 + qa.complexity * 0.3).toFixed(2)} — philosophical-conceptual routing, multi-framework analysis`
        : qa.isMetaAnalytical
        ? `complexity score: ${(0.85 + qa.complexity * 0.15).toFixed(2)} — full meta-analytical mode for ${topic}`
        : `complexity score: ${(0.3 + qa.complexity * 0.6).toFixed(2)} — ${qa.complexity > 0.5 ? 'executive pipeline' : 'moderate-depth analysis'} for "${topic}"`;

    case 'memory':
      return qa.isPhilosophical
        ? `cross-referencing ${Math.floor(3 + qa.entities.length * 0.5)} philosophical frameworks for ${topic}`
        : `${Math.floor(2 + qa.complexity * 8)} context fragments retrieved for "${topic}" (similarity > 0.7)`;

    case 'routing':
      if (qa.isPhilosophical) return `philosophical-analytical mode — dialectical + ethical + epistemic engines for: ${qa.coreQuestion.slice(0, 60)}`;
      if (qa.isMetaAnalytical) return `meta-analytical mode — multi-study synthesis with heterogeneity assessment for ${topic}`;
      if (qa.questionType === 'causal') return `causal-inference mode — DAG construction + Bradford Hill scoring for ${topic}`;
      return `executive mode — full reasoning pipeline for: ${qa.coreQuestion.slice(0, 60)}`;

    case 'statistical': {
      if (qa.isPhilosophical) {
        return `framework agreement index: ${(0.3 + Math.random() * 0.5).toFixed(2)}, argument coherence: ${(0.4 + Math.random() * 0.5).toFixed(2)}, ${Math.floor(2 + Math.random() * 4)} positions identified`;
      }
      const d = (0.2 + Math.random() * 1.0).toFixed(2);
      const power = (0.5 + Math.random() * 0.45).toFixed(2);
      return `Cohen's d = ${d} (${parseFloat(d) > 0.8 ? 'large' : parseFloat(d) > 0.5 ? 'medium' : 'small'}), power = ${power}${parseFloat(power) > 0.8 ? ', adequately powered' : ', may be underpowered'}`;
    }

    case 'causal': {
      if (qa.isPhilosophical) {
        return `${Math.floor(2 + Math.random() * 4)} causal/logical chains analyzed — ${qa.hasNormativeClaims ? 'normative-descriptive boundary flagged' : 'conceptual dependencies mapped'}`;
      }
      const hill = (0.4 + Math.random() * 0.5).toFixed(2);
      return `Bradford Hill score: ${hill} — ${parseFloat(hill) > 0.7 ? 'strong' : parseFloat(hill) > 0.5 ? 'moderate' : 'weak'} causal evidence for ${topic}`;
    }

    case 'meta_analysis':
      if (qa.isPhilosophical) {
        return `${Math.floor(3 + Math.random() * 5)} traditions synthesized — cross-framework convergence: ${(0.2 + Math.random() * 0.6).toFixed(2)}`;
      }
      if (qa.isMetaAnalytical) {
        const iSq = Math.floor(Math.random() * 80);
        return `${Math.floor(4 + Math.random() * 12)} studies pooled, I² = ${iSq}% (${iSq < 30 ? 'low' : iSq < 60 ? 'moderate' : 'high'} heterogeneity)`;
      }
      return `${Math.floor(2 + Math.random() * 5)} analytical perspectives integrated for ${topic}`;

    case 'bayesian': {
      if (qa.isPhilosophical) {
        const range = (0.15 + Math.random() * 0.5).toFixed(2);
        return `posterior across ${Math.floor(2 + Math.random() * 4)} priors, range = ${range} — ${parseFloat(range) > 0.3 ? 'position-sensitive' : 'converges across starting positions'}`;
      }
      const bf = (1.5 + Math.random() * 18).toFixed(1);
      return `BF₁₀ = ${bf} (${parseFloat(bf) > 10 ? 'strong' : parseFloat(bf) > 3 ? 'moderate' : 'weak'} evidence for ${topic})`;
    }

    case 'synthesis':
      return qa.isPhilosophical
        ? `synthesizing dialectical analysis across ${qa.entities.length} concepts — building nuanced position`
        : `integrating evidence streams for structured response on ${topic}`;

    case 'adversarial': {
      const challenges = Math.floor(1 + Math.random() * 3);
      return qa.isPhilosophical
        ? `${challenges} counter-argument${challenges > 1 ? 's' : ''} generated — ${qa.hasNormativeClaims ? 'is/ought distinction tested' : 'logical consistency verified'}`
        : `${challenges} weakness${challenges > 1 ? 'es' : ''} identified${Math.random() > 0.6 ? ', no overclaiming' : ', potential overclaiming flagged'}`;
    }

    case 'calibration': {
      const conf = (0.3 + Math.random() * 0.55).toFixed(2);
      const margin = (0.08 + Math.random() * 0.25).toFixed(2);
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
  const segments: string[] = [];

  if (qa.isPhilosophical) {
    const traditions = Math.floor(3 + Math.random() * 4);
    const convergence = (0.2 + Math.random() * 0.5).toFixed(2);

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
    const studies = Math.floor(3 + Math.random() * 15);
    const n = Math.floor(500 + Math.random() * 50000);
    const d = (0.15 + Math.random() * 1.2).toFixed(2);
    const iSq = Math.floor(Math.random() * 75);
    const hillScore = (0.4 + Math.random() * 0.5).toFixed(2);
    const bf = (0.8 + Math.random() * 20).toFixed(1);
    const priorRange = (0.04 + Math.random() * 0.35).toFixed(2);

    segments.push(
      `[DATA] Based on ${studies} ${qa.isMetaAnalytical ? 'pooled studies' : 'available studies'} (combined N ≈ ${n.toLocaleString()}) examining ${topic}, the ${qa.questionType === 'causal' ? 'intervention' : 'relationship'} shows ${parseFloat(d) > 0.8 ? 'a large' : parseFloat(d) > 0.5 ? 'a medium' : parseFloat(d) > 0.2 ? 'a small' : 'a negligible'} effect size (d = ${d}, 95% CI [${(parseFloat(d) - 0.15 - Math.random() * 0.2).toFixed(2)}, ${(parseFloat(d) + 0.15 + Math.random() * 0.2).toFixed(2)}]) with ${iSq < 30 ? 'low' : iSq < 60 ? 'moderate' : 'high'} heterogeneity (I² = ${iSq}%).`,
    );

    segments.push(
      `[DATA] Bradford Hill criteria score ${hillScore}/1.0 for ${topic}: ${parseFloat(hillScore) > 0.7 ? 'temporality, biological gradient, and plausibility scored above 0.7, supporting a causal interpretation' : parseFloat(hillScore) > 0.5 ? 'partial support — some criteria met but temporality or specificity evidence incomplete' : 'weak causal case — multiple criteria unmet'}.`,
    );

    segments.push(
      `[DATA] Bayesian updating yields posterior range = ${priorRange}, BF₁₀ = ${bf}: ${parseFloat(bf) > 10 ? 'strong' : parseFloat(bf) > 3 ? 'moderate' : 'weak'} evidence. ${parseFloat(priorRange) > 0.25 ? 'Conclusion is sensitive to prior specification' : 'Posterior converges across priors, suggesting data-dominated inference'}.`,
    );

    if (qa.domain === 'medical') {
      const nnt = Math.floor(5 + Math.random() * 50);
      segments.push(
        `[DATA] Clinical significance: NNT = ${nnt}, ${nnt < 15 ? 'suggesting meaningful clinical benefit' : nnt < 30 ? 'moderate clinical significance' : 'raising questions about practical value despite statistical significance'} for ${topic}.`,
      );
    }

    const altExplanations = Math.floor(1 + Math.random() * 3);
    segments.push(
      `[MODEL] Adversarial review identified ${altExplanations} alternative explanation${altExplanations > 1 ? 's' : ''}: ${
        qa.questionType === 'causal'
          ? `${altExplanations > 1 ? 'reverse causation and residual confounding' : 'residual confounding'}, ${parseFloat(hillScore) > 0.65 ? 'partially mitigated by study designs' : 'inadequately addressed'}`
          : `including ${Math.random() > 0.5 ? 'selection bias and measurement error' : 'publication bias and heterogeneous populations'}`
      }.`,
    );

    if (iSq > 50 || parseFloat(priorRange) > 0.25) {
      segments.push(
        `[UNCERTAIN] ${iSq > 50 ? 'High heterogeneity suggests the pooled estimate may not represent any single population. ' : ''}${parseFloat(priorRange) > 0.25 ? 'Prior sensitivity indicates current evidence is insufficient to override strong pre-existing beliefs.' : ''}`,
      );
    }

  } else {
    // General / conceptual / evaluative
    const perspectives = Math.floor(2 + Math.random() * 5);
    const coherence = (0.3 + Math.random() * 0.6).toFixed(2);

    segments.push(
      `[DATA] Analysis of ${perspectives} major perspectives on "${qa.coreQuestion.slice(0, 80)}" yields a coherence index of ${coherence}, indicating ${parseFloat(coherence) > 0.7 ? 'substantial agreement' : parseFloat(coherence) > 0.4 ? 'partial convergence with notable dissent' : 'significant disagreement'}.`,
    );

    if (qa.domain === 'psychology') {
      segments.push(
        `[DATA] Psychological evidence from ${Math.floor(2 + Math.random() * 6)} research paradigms addresses ${topic}. ${qa.questionType === 'causal' ? 'Causal mechanisms are proposed but primarily supported by correlational designs' : 'Multiple theoretical accounts exist with varying empirical support'}.`,
      );
    } else if (qa.domain === 'technology') {
      segments.push(
        `[DATA] Technical analysis identifies ${Math.floor(2 + Math.random() * 4)} key dimensions of ${topic}. ${Math.random() > 0.5 ? 'Benchmarks exist but ecological validity is limited' : 'The field is rapidly evolving, limiting shelf-life of current findings'}.`,
      );
    } else if (qa.domain === 'social_science') {
      segments.push(
        `[DATA] Social science literature on ${topic} reveals ${Math.floor(2 + Math.random() * 4)} competing frameworks. Cross-cultural generalizability is ${Math.random() > 0.5 ? 'limited' : 'partially supported'}.`,
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
      `[UNCERTAIN] Confidence is bounded by inability to access real-time data, conduct original research, or capture lived experiential knowledge relevant to ${topic}.`,
    );
  }

  return segments.join(' ');
}


// ═════════════════════════════════════════════════════════════════════
// ██ DYNAMIC LAYMAN SUMMARY — query-specific
// ═════════════════════════════════════════════════════════════════════

function generateLaymanSummary(qa: QueryAnalysis, rawAnalysis: string): LaymanSummary {
  const topic = qa.entities.slice(0, 3).join(' and ') || 'this topic';

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
    };
  }

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
    };
  }

  // General / conceptual
  return {
    whatWasTried: `The system analyzed your question about ${topic} through multiple reasoning frameworks, examining it from ${qa.domain === 'general' ? 'several analytical angles' : `the ${qa.domain} perspective and related fields`}.`,
    whatIsLikelyTrue: `${qa.complexity > 0.6 ? 'This is a complex, multi-faceted question where simple answers would be misleading' : 'There are areas of agreement but also important nuances'}. ${qa.questionType === 'evaluative' ? 'The evaluative dimension means the answer depends partly on values, not just evidence' : `The key finding is that ${topic} involves considerations that resist simple generalization`}.`,
    confidenceExplanation: `Confidence is ${qa.complexity > 0.7 ? 'modest' : 'moderate'} because ${qa.questionType === 'speculative' ? 'speculative questions carry inherent uncertainty' : qa.questionType === 'evaluative' ? 'evaluative questions depend on value frameworks' : 'the question spans domains with different evidence standards'}.`,
    whatCouldChange: `New evidence, different framing, or unconsidered perspectives could shift this analysis. ${qa.hasNormativeClaims ? 'Normative components are particularly sensitive to value framework choice.' : 'Descriptive components could change with new data.'}`,
    whoShouldTrust: `This analysis maps key considerations and arguments about ${topic}. ${qa.complexity > 0.6 ? 'Treat it as a map of the intellectual territory rather than a definitive answer.' : 'It provides a reasonable starting point, but domain experts may add nuance.'}`,
  };
}


// ═════════════════════════════════════════════════════════════════════
// ██ SIGNAL GENERATION — correlated with query properties
// ═════════════════════════════════════════════════════════════════════

function generateSignals(qa: QueryAnalysis) {
  const betti0 = qa.isPhilosophical
    ? Math.floor(2 + qa.entities.length * 0.5)
    : Math.max(1, Math.floor(1 + qa.complexity * 4));
  const betti1 = qa.isPhilosophical
    ? (qa.hasNormativeClaims ? Math.floor(1 + Math.random() * 2) : Math.floor(Math.random() * 2))
    : Math.floor(Math.random() * 3);
  const persistenceEntropy = qa.isPhilosophical
    ? 0.5 + qa.complexity * 1.5 + Math.random() * 0.5
    : 0.1 + qa.complexity * 1.8 + Math.random() * 0.3;
  const maxPersistence = 0.1 + qa.complexity * 0.5 + Math.random() * 0.2;

  const baseConf = qa.isPhilosophical
    ? 0.2 + Math.random() * 0.25
    : qa.isEmpirical
    ? 0.45 + Math.random() * 0.35
    : 0.35 + Math.random() * 0.35;

  const entropy = qa.isPhilosophical
    ? 0.5 + qa.complexity * 0.3 + Math.random() * 0.15
    : qa.isEmpirical
    ? 0.05 + qa.complexity * 0.4 + Math.random() * 0.15
    : 0.15 + qa.complexity * 0.45 + Math.random() * 0.15;

  const dissonance = qa.hasNormativeClaims
    ? 0.3 + Math.random() * 0.4
    : qa.isPhilosophical
    ? 0.2 + Math.random() * 0.4
    : 0.05 + qa.complexity * 0.35 + Math.random() * 0.15;

  const healthScore = Math.max(0.25, 1 - entropy * 0.45 - dissonance * 0.35 - (qa.hasSafetyKeywords ? 0.15 : 0));

  const riskScore = qa.hasSafetyKeywords
    ? 0.4 + Math.random() * 0.35
    : qa.hasNormativeClaims
    ? 0.15 + Math.random() * 0.25
    : 0.02 + qa.complexity * 0.2 + Math.random() * 0.1;

  const safetyState: SafetyState = riskScore >= 0.55 ? 'red' : riskScore >= 0.35 ? 'yellow' : 'green';

  const depth = 2 + qa.complexity * 7 + (qa.isPhilosophical ? 1.5 : 0);
  const temp = qa.isPhilosophical ? 0.7 + Math.random() * 0.25 : 1.0 - qa.complexity * 0.5;

  const conceptPool = qa.isPhilosophical
    ? ['free_will', 'determinism', 'moral_responsibility', 'compatibilism', 'retribution',
       'consequentialism', 'agency', 'desert', 'justice', ...qa.entities]
    : qa.isEmpirical
    ? ['effect_size', 'power', 'confounding', 'heterogeneity', 'causality', 'bias',
       'replication', 'bayesian_prior', ...qa.entities]
    : ['coherence', 'framework', 'evidence', 'inference', ...qa.entities];

  const uniqueConcepts = [...new Set(conceptPool)];
  const concepts = uniqueConcepts.sort(() => Math.random() - 0.5).slice(0, Math.floor(3 + qa.complexity * 4));
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
  const chord = concepts.reduce((p, _, i) => p * (primes[i] || 41), 1);

  const grade = baseConf > 0.7 ? 'A' : baseConf > 0.5 ? 'B' : 'C';
  const mode = qa.isMetaAnalytical ? 'meta-analytical' : qa.isPhilosophical ? 'philosophical-analytical' : qa.isEmpirical ? 'executive' : 'moderate';

  return {
    betti0, betti1, persistenceEntropy, maxPersistence,
    confidence: baseConf,
    entropy: Math.min(entropy, 0.95),
    dissonance: Math.min(dissonance, 0.95),
    healthScore: Math.max(healthScore, 0.2),
    safetyState, riskScore: Math.min(riskScore, 0.9),
    depth, temp,
    concepts, chord, harmony: dissonance,
    grade, mode,
  };
}


// ═════════════════════════════════════════════════════════════════════
// ██ MAIN SIMULATION ENTRY POINT
// ═════════════════════════════════════════════════════════════════════

export function simulateQuery(query: string) {
  const store = usePFCStore.getState();
  store.submitQuery(query);

  // Analyze the actual query
  const qa = analyzeQuery(query);
  const signals = generateSignals(qa);

  const stageDelay = qa.isMetaAnalytical ? 800 : qa.isPhilosophical ? 700 : 500;
  let delay = 300;

  STAGES.forEach((stage, i) => {
    setTimeout(() => {
      const detail = generateStageDetail(stage, qa);

      usePFCStore.getState().advanceStage(stage, {
        status: 'active',
        detail,
        value: 0.3 + Math.random() * 0.7,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const progress = (i + 1) / STAGES.length;
      usePFCStore.getState().updateSignals({
        entropy: signals.entropy * progress,
        dissonance: signals.dissonance * progress,
        healthScore: Math.max(0.2, 1 - (signals.entropy * progress * 0.45 + signals.dissonance * progress * 0.35)),
        safetyState: progress > 0.5 ? signals.safetyState : 'green',
        riskScore: signals.riskScore * progress,
      });

      if (i > 0) {
        usePFCStore.getState().advanceStage(STAGES[i - 1], { status: 'complete' });
      }

      if (i === 4) {
        usePFCStore.getState().updateTDA({
          betti0: signals.betti0,
          betti1: signals.betti1,
          persistenceEntropy: signals.persistenceEntropy,
          maxPersistence: signals.maxPersistence,
        });
        usePFCStore.getState().updateFocus(signals.depth, signals.temp);
        usePFCStore.getState().updateConcepts(signals.concepts, signals.chord, signals.harmony);
      }

      if (stage === 'adversarial' && detail.includes('overclaim')) {
        usePFCStore.getState().incrementSkillGaps();
      }
    }, delay);

    delay += stageDelay + Math.random() * 300;
  });

  // Completion — build query-specific dual message
  setTimeout(() => {
    const stageResults = usePFCStore.getState().pipelineStages;

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
    usePFCStore.getState().completeProcessing(
      dualMessage,
      adjustedConfidence,
      signals.grade,
      signals.mode,
      truthAssessment,
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, delay + 500);
}
