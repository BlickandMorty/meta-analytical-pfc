// ═══════════════════════════════════════════════════════════════════
// ██ OOLONG — Quadratic Contradiction Detection
// ═══════════════════════════════════════════════════════════════════
//
// Inspired by the OOLONG-Pairs benchmark: for n claims, compare every
// pair (O(n²)) to surface contradictions that linear scans miss.
//
// The insight: most reasoning engines process claims sequentially,
// which means contradictions between claim 3 and claim 47 are never
// detected. Quadratic cross-referencing catches these.
//
// In LLM mode, the model scores contradiction likelihood for each
// pair. In simulation mode, heuristic keyword/negation analysis
// provides an approximation.
// ═══════════════════════════════════════════════════════════════════

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type { Contradiction, ContradictionScan } from './types';

// ---------------------------------------------------------------------------
// Claim extraction
// ---------------------------------------------------------------------------

/** Extract discrete claims from a body of text */
export function extractClaims(text: string): string[] {
  // Split into sentences, filter noise
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      // Keep only substantive claims
      if (s.length < 20) return false;
      if (s.length > 500) return false;
      // Skip questions, headers, meta-commentary
      if (/^\?|^#|^\[|^Note:|^See also/i.test(s)) return false;
      // Must contain a verb-like word (rough proxy for being a claim)
      if (!/\b(is|are|was|were|has|have|had|does|do|did|can|could|would|should|will|may|might|shows?|suggests?|indicates?|demonstrates?|reveals?|finds?|found|proves?|implies?|causes?|leads?|results?|increases?|decreases?|affects?|requires?)\b/i.test(s)) return false;
      return true;
    });

  return sentences;
}

// ---------------------------------------------------------------------------
// Heuristic contradiction detection (no LLM)
// ---------------------------------------------------------------------------

/** Negation patterns that flip a claim's polarity */
const NEGATION_PATTERNS = [
  /\bnot\b/i, /\bno\b/i, /\bnever\b/i, /\bnone\b/i, /\bnor\b/i,
  /\bneither\b/i, /\bhardly\b/i, /\brarely\b/i, /\bseldom\b/i,
  /\bwithout\b/i, /\blacks?\b/i, /\bfails?\b/i, /\bdoes not\b/i,
  /\bdo not\b/i, /\bdid not\b/i, /\bcannot\b/i, /\bcan't\b/i,
  /\bwon't\b/i, /\bdon't\b/i, /\bdoesn't\b/i, /\bisn't\b/i,
  /\baren't\b/i, /\bwasn't\b/i, /\bweren't\b/i, /\bhasn't\b/i,
  /\bhaven't\b/i, /\bhadn't\b/i, /\bshouldn't\b/i, /\bwouldn't\b/i,
];

/** Antonym pairs that signal semantic opposition */
const ANTONYM_PAIRS: [RegExp, RegExp][] = [
  [/\bincrease/i, /\bdecrease/i],
  [/\bhigher/i, /\blower/i],
  [/\bmore\b/i, /\bless\b/i],
  [/\bpositive/i, /\bnegative/i],
  [/\bbenefit/i, /\bharm/i],
  [/\bsupport/i, /\bundermine/i],
  [/\bconfirm/i, /\bdeny/i],
  [/\baccept/i, /\breject/i],
  [/\bpresent/i, /\babsent/i],
  [/\bstrong/i, /\bweak/i],
  [/\bsignificant/i, /\binsignificant/i],
  [/\bconsistent/i, /\binconsistent/i],
  [/\breliable/i, /\bunreliable/i],
  [/\bvalid/i, /\binvalid/i],
  [/\bcorrelat/i, /\buncorrelat/i],
  [/\bcausal/i, /\bspurious/i],
];

/** Temporal contradiction patterns */
const TEMPORAL_MARKERS: [RegExp, RegExp][] = [
  [/\bbefore\b/i, /\bafter\b/i],
  [/\bprecede/i, /\bfollow/i],
  [/\binitially\b/i, /\bultimately\b/i],
  [/\bearlier\b/i, /\blater\b/i],
];

/** Extract key content words from a claim for overlap comparison */
function extractContentWords(claim: string): Set<string> {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while',
    'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'what', 'which', 'who', 'whom', 'not', 'no',
  ]);

  return new Set(
    claim.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w))
  );
}

/** Compute topical overlap between two claims (Jaccard) */
function topicOverlap(a: string, b: string): number {
  const wordsA = extractContentWords(a);
  const wordsB = extractContentWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Heuristic contradiction score between two claims.
 * Returns 0-1 where higher = more likely contradictory.
 */
function heuristicContradictionScore(
  claimA: string,
  claimB: string,
): { score: number; type: Contradiction['type'] } {
  let score = 0;
  let type: Contradiction['type'] = 'logical';

  // Must have topical overlap to be contradictory (unrelated claims aren't contradictions)
  const overlap = topicOverlap(claimA, claimB);
  if (overlap < 0.15) return { score: 0, type };

  // Base score from topical similarity (claims about the same thing)
  score += overlap * 0.2;

  // Check negation asymmetry: one claim negates, the other doesn't
  const negA = NEGATION_PATTERNS.filter((p) => p.test(claimA)).length;
  const negB = NEGATION_PATTERNS.filter((p) => p.test(claimB)).length;
  if ((negA > 0) !== (negB > 0)) {
    score += 0.3;
    type = 'logical';
  }

  // Antonym pairs
  for (const [patA, patB] of ANTONYM_PAIRS) {
    if ((patA.test(claimA) && patB.test(claimB)) || (patB.test(claimA) && patA.test(claimB))) {
      score += 0.25;
      type = 'factual';
      break; // One antonym pair is enough
    }
  }

  // Temporal contradiction
  for (const [patA, patB] of TEMPORAL_MARKERS) {
    if ((patA.test(claimA) && patB.test(claimB)) || (patB.test(claimA) && patA.test(claimB))) {
      if (overlap > 0.3) { // Must be about the same event
        score += 0.2;
        type = 'temporal';
        break;
      }
    }
  }

  // Scope contradiction (quantifier mismatch: "all" vs "some"/"few")
  const universalA = /\b(all|every|always|universal|entire|total)\b/i.test(claimA);
  const universalB = /\b(all|every|always|universal|entire|total)\b/i.test(claimB);
  const particularA = /\b(some|few|sometimes|partial|certain|specific)\b/i.test(claimA);
  const particularB = /\b(some|few|sometimes|partial|certain|specific)\b/i.test(claimB);
  if ((universalA && particularB) || (universalB && particularA)) {
    if (overlap > 0.25) {
      score += 0.15;
      type = 'scope';
    }
  }

  // Methodological contradiction (different study types claiming different things)
  const methodA = /\b(observational|experiment|meta-analysis|cohort|RCT|survey|case study)\b/i.test(claimA);
  const methodB = /\b(observational|experiment|meta-analysis|cohort|RCT|survey|case study)\b/i.test(claimB);
  if (methodA && methodB && (negA !== negB || score > 0.3)) {
    type = 'methodological';
  }

  return { score: Math.min(1, score), type };
}

// ---------------------------------------------------------------------------
// LLM-powered contradiction detection
// ---------------------------------------------------------------------------

const contradictionPairSchema = z.object({
  isContradiction: z.boolean().describe('Whether these two claims contradict each other'),
  confidence: z.number().min(0).max(1).describe('Confidence in the contradiction assessment'),
  type: z.enum(['factual', 'logical', 'temporal', 'scope', 'methodological']),
  explanation: z.string().describe('Brief explanation of why they contradict (or do not)'),
});

/**
 * Use an LLM to assess whether two claims contradict each other.
 * Falls back to heuristic if the LLM call fails.
 */
async function llmContradictionCheck(
  model: LanguageModel,
  claimA: string,
  claimB: string,
): Promise<{ score: number; type: Contradiction['type']; explanation: string }> {
  try {
    const result = await generateObject({
      model,
      schema: contradictionPairSchema,
      system: `You are a contradiction detector. Given two claims, assess whether they contradict each other.

Types of contradiction:
- factual: They state opposing facts about the same subject
- logical: One logically negates the other
- temporal: They make incompatible claims about timing/sequence
- scope: They disagree about the extent/generality of a phenomenon
- methodological: They use different methods and reach opposing conclusions

Be precise. Two claims can disagree without contradicting — disagreement on emphasis or framing is NOT contradiction. Only flag genuine logical incompatibility.`,
      prompt: `CLAIM A: "${claimA}"

CLAIM B: "${claimB}"

Do these claims contradict each other?`,
      maxOutputTokens: 200,
      temperature: 0.1,
    });

    const obj = result.object;
    return {
      score: obj.isContradiction ? obj.confidence : 0,
      type: obj.type,
      explanation: obj.explanation,
    };
  } catch {
    const h = heuristicContradictionScore(claimA, claimB);
    return {
      score: h.score,
      type: h.type,
      explanation: h.score > 0.4 ? 'Heuristic: detected opposing patterns in topically related claims' : 'No contradiction detected',
    };
  }
}

// ---------------------------------------------------------------------------
// Main scan function
// ---------------------------------------------------------------------------

let contradictionCounter = 0;

/**
 * Perform O(n²) cross-referencing of all claims to surface contradictions.
 *
 * For n claims, this makes n*(n-1)/2 comparisons. The maxClaims parameter
 * caps n to keep computation bounded (default: 20 → max 190 comparisons).
 *
 * In LLM mode, only pairs that pass the heuristic pre-filter (score > 0.25)
 * are sent to the LLM, drastically reducing API calls.
 */
export async function scanForContradictions(
  model: LanguageModel | null,
  text: string,
  maxClaims: number = 20,
  confidenceThreshold: number = 0.4,
): Promise<ContradictionScan> {
  const startTime = Date.now();

  // Extract claims
  let claims = extractClaims(text);
  if (claims.length > maxClaims) {
    claims = claims.slice(0, maxClaims);
  }

  const totalComparisons = (claims.length * (claims.length - 1)) / 2;
  const contradictions: Contradiction[] = [];

  // O(n²) pairwise comparison
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const claimA = claims[i];
      const claimB = claims[j];

      // Always run heuristic first (fast pre-filter)
      const heuristic = heuristicContradictionScore(claimA, claimB);

      let finalScore = heuristic.score;
      let finalType = heuristic.type;
      let explanation = '';

      if (model && heuristic.score > 0.25) {
        // Only call LLM for plausible contradictions (saves API cost)
        const llmResult = await llmContradictionCheck(model, claimA, claimB);
        finalScore = llmResult.score;
        finalType = llmResult.type;
        explanation = llmResult.explanation;
      } else if (heuristic.score > 0.4) {
        explanation = 'Heuristic: detected opposing patterns in topically related claims';
      }

      if (finalScore >= confidenceThreshold) {
        contradictions.push({
          id: `contra_${++contradictionCounter}`,
          claimA,
          sourceA: `claim_${i}`,
          claimB,
          sourceB: `claim_${j}`,
          contradictionConfidence: finalScore,
          type: finalType,
          explanation: explanation || `${finalType} contradiction detected between claims`,
        });
      }
    }
  }

  // Compute aggregate dissonance from contradictions
  const computedDissonance = contradictions.length > 0
    ? Math.min(1, contradictions.reduce((sum, c) => sum + c.contradictionConfidence, 0) / Math.max(1, claims.length))
    : 0;

  return {
    totalClaims: claims.length,
    totalComparisons,
    contradictions,
    computedDissonance,
    durationMs: Date.now() - startTime,
  };
}
