/**
 * Paper Review System — NeurIPS-Style Automated Review
 *
 * Ported from AI-Scientist v1's `perform_review.py`.
 *
 * Provides structured paper review with scoring dimensions:
 * Originality, Quality, Clarity, Significance (1-4),
 * Soundness, Presentation, Contribution (1-4),
 * Overall (1-10), Confidence (1-5).
 *
 * Supports ensemble reviews (multiple reviewers) with meta-review aggregation.
 */

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface PaperReviewInput {
  title: string;
  abstract: string;
  fullText?: string;        // Full paper text (optional but recommended)
  sectionSummaries?: {      // Section-level summaries if full text not available
    introduction?: string;
    methodology?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
  };
}

interface PaperReviewScores {
  originality: number;      // 1-4: low, medium, high, very high
  quality: number;          // 1-4
  clarity: number;          // 1-4
  significance: number;     // 1-4
  soundness: number;        // 1-4: poor, fair, good, excellent
  presentation: number;     // 1-4
  contribution: number;     // 1-4
  overall: number;          // 1-10
  confidence: number;       // 1-5
}

interface PaperReview {
  scores: PaperReviewScores;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  questions: string[];
  limitations: string[];
  ethicalConcerns: boolean;
  decision: 'accept' | 'reject';
  detailedFeedback: string;
}

interface EnsembleReview {
  individualReviews: PaperReview[];
  averagedScores: PaperReviewScores;
  metaReview: string;
  consensusDecision: 'accept' | 'reject';
  agreementLevel: number;   // 0-1, how much reviewers agree
}

// ═══════════════════════════════════════════════════════════════════
// Schema
// ═══════════════════════════════════════════════════════════════════

const paperReviewSchema = z.object({
  summary: z.string().describe('Brief summary of the paper and its contributions (2-3 sentences)'),
  strengths: z.array(z.string()).min(1).max(6).describe('Key strengths of the paper'),
  weaknesses: z.array(z.string()).min(1).max(6).describe('Key weaknesses and areas for improvement'),
  questions: z.array(z.string()).max(5).describe('Questions for the authors'),
  limitations: z.array(z.string()).max(4).describe('Limitations acknowledged or unacknowledged'),
  ethicalConcerns: z.boolean().describe('Whether the paper raises ethical concerns'),
  detailedFeedback: z.string().describe('Detailed feedback paragraph for the authors'),
  scores: z.object({
    originality: z.number().int().min(1).max(4).describe('1=low, 2=medium, 3=high, 4=very high'),
    quality: z.number().int().min(1).max(4).describe('1=low, 2=medium, 3=high, 4=very high'),
    clarity: z.number().int().min(1).max(4).describe('1=low, 2=medium, 3=high, 4=very high'),
    significance: z.number().int().min(1).max(4).describe('1=low, 2=medium, 3=high, 4=very high'),
    soundness: z.number().int().min(1).max(4).describe('1=poor, 2=fair, 3=good, 4=excellent'),
    presentation: z.number().int().min(1).max(4).describe('1=poor, 2=fair, 3=good, 4=excellent'),
    contribution: z.number().int().min(1).max(4).describe('1=poor, 2=fair, 3=good, 4=excellent'),
    overall: z.number().int().min(1).max(10).describe('1=very strong reject, 5=marginally below, 6=marginally above, 8=accept, 10=award quality'),
    confidence: z.number().int().min(1).max(5).describe('1=low confidence, 3=fairly confident, 5=absolutely certain'),
  }),
  decision: z.enum(['accept', 'reject']).describe('Accept or reject recommendation'),
});

const metaReviewSchema = z.object({
  metaReview: z.string().describe('Area Chair synthesis of all reviews, noting agreements and disagreements'),
  consensusDecision: z.enum(['accept', 'reject']).describe('Final consensus decision'),
  keyStrengths: z.array(z.string()).describe('Strengths agreed upon by multiple reviewers'),
  keyWeaknesses: z.array(z.string()).describe('Weaknesses agreed upon by multiple reviewers'),
});

// ═══════════════════════════════════════════════════════════════════
// Prompts
// ═══════════════════════════════════════════════════════════════════

function buildReviewPrompt(input: PaperReviewInput): { system: string; user: string } {
  const paperContent = input.fullText
    ? input.fullText.slice(0, 12000)
    : [
        input.sectionSummaries?.introduction && `Introduction: ${input.sectionSummaries.introduction}`,
        input.sectionSummaries?.methodology && `Methodology: ${input.sectionSummaries.methodology}`,
        input.sectionSummaries?.results && `Results: ${input.sectionSummaries.results}`,
        input.sectionSummaries?.discussion && `Discussion: ${input.sectionSummaries.discussion}`,
        input.sectionSummaries?.conclusion && `Conclusion: ${input.sectionSummaries.conclusion}`,
      ].filter(Boolean).join('\n\n');

  return {
    system: `You are an expert reviewer for a top-tier machine learning conference (NeurIPS/ICML/ICLR). You provide thorough, fair, and constructive reviews following the NeurIPS review guidelines.

Your review should be:
- Thorough: Address all aspects of the paper
- Fair: Acknowledge both strengths and weaknesses
- Constructive: Provide actionable feedback
- Rigorous: Hold high scientific standards
- Honest: Do not inflate scores

Scoring Guidelines:
- Originality (1-4): How novel is the approach? 1=derivative, 4=groundbreaking
- Quality (1-4): Is the work technically sound? 1=fundamentally flawed, 4=excellent
- Clarity (1-4): Is the paper well-written? 1=unreadable, 4=exemplary
- Significance (1-4): How important is this work? 1=negligible impact, 4=transformative
- Soundness (1-4): Are claims well-supported? 1=major holes, 4=rock-solid
- Presentation (1-4): Quality of figures, tables, writing? 1=poor, 4=excellent
- Contribution (1-4): Does this advance the field? 1=minimal, 4=significant
- Overall (1-10): 1-3=reject, 4-5=borderline reject, 6-7=borderline accept, 8-10=accept
- Confidence (1-5): 1=educated guess, 3=fairly confident, 5=absolutely certain

Only recommend "accept" if Overall >= 6.`,

    user: `Please review the following paper:

Title: ${input.title}

Abstract: ${input.abstract}

${paperContent ? `Paper Content:\n${paperContent}` : 'Note: Full paper text not available. Review based on title and abstract only — adjust confidence score accordingly.'}

Provide your complete review with scores, strengths, weaknesses, questions, and a decision.`,
  };
}

function buildMetaReviewPrompt(
  input: PaperReviewInput,
  reviews: PaperReview[],
): { system: string; user: string } {
  const reviewSummaries = reviews.map((r, i) => {
    return `Reviewer ${i + 1} (Overall: ${r.scores.overall}/10, Decision: ${r.decision}):
Summary: ${r.summary}
Strengths: ${r.strengths.join('; ')}
Weaknesses: ${r.weaknesses.join('; ')}
Key feedback: ${r.detailedFeedback.slice(0, 300)}`;
  }).join('\n\n');

  return {
    system: `You are an Area Chair at a top ML conference. Your role is to synthesize multiple reviewer opinions into a meta-review and make a final accept/reject recommendation.

Consider:
- Points of agreement and disagreement between reviewers
- The severity of weaknesses identified
- Whether strengths outweigh weaknesses
- The overall contribution to the field`,

    user: `Paper: "${input.title}"
Abstract: ${input.abstract}

Individual Reviews:
${reviewSummaries}

Please synthesize these reviews into a meta-review with a consensus decision.`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Single Review
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a single paper review.
 */
export async function reviewPaper(
  model: LanguageModel,
  input: PaperReviewInput,
): Promise<PaperReview> {
  const prompt = buildReviewPrompt(input);

  const { object } = await generateObject({
    model,
    schema: paperReviewSchema,
    system: prompt.system,
    prompt: prompt.user,
    temperature: 0.4,
  });

  return {
    scores: object.scores,
    summary: object.summary,
    strengths: object.strengths,
    weaknesses: object.weaknesses,
    questions: object.questions,
    limitations: object.limitations,
    ethicalConcerns: object.ethicalConcerns,
    decision: object.decision,
    detailedFeedback: object.detailedFeedback,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Ensemble Review
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate an ensemble review with multiple reviewers and a meta-review.
 *
 * Uses varying temperatures to get diverse perspectives.
 */
export async function ensembleReviewPaper(
  model: LanguageModel,
  input: PaperReviewInput,
  options?: {
    numReviewers?: number;
  },
): Promise<EnsembleReview> {
  const numReviewers = options?.numReviewers ?? 3;
  const temperatures = [0.3, 0.5, 0.7, 0.6, 0.4].slice(0, numReviewers);

  // Generate individual reviews in parallel
  const reviewPromises = temperatures.map(async (temp) => {
    const prompt = buildReviewPrompt(input);
    const { object } = await generateObject({
      model,
      schema: paperReviewSchema,
      system: prompt.system,
      prompt: prompt.user,
      temperature: temp,
    });
    return {
      scores: object.scores,
      summary: object.summary,
      strengths: object.strengths,
      weaknesses: object.weaknesses,
      questions: object.questions,
      limitations: object.limitations,
      ethicalConcerns: object.ethicalConcerns,
      decision: object.decision,
      detailedFeedback: object.detailedFeedback,
    } as PaperReview;
  });

  const reviews = await Promise.all(reviewPromises);

  // Average scores
  const avgScores: PaperReviewScores = {
    originality: avg(reviews.map((r) => r.scores.originality)),
    quality: avg(reviews.map((r) => r.scores.quality)),
    clarity: avg(reviews.map((r) => r.scores.clarity)),
    significance: avg(reviews.map((r) => r.scores.significance)),
    soundness: avg(reviews.map((r) => r.scores.soundness)),
    presentation: avg(reviews.map((r) => r.scores.presentation)),
    contribution: avg(reviews.map((r) => r.scores.contribution)),
    overall: avg(reviews.map((r) => r.scores.overall)),
    confidence: avg(reviews.map((r) => r.scores.confidence)),
  };

  // Calculate agreement
  const decisions = reviews.map((r) => r.decision);
  const acceptCount = decisions.filter((d) => d === 'accept').length;
  const agreementLevel = Math.max(acceptCount, numReviewers - acceptCount) / numReviewers;

  // Generate meta-review
  const metaPrompt = buildMetaReviewPrompt(input, reviews);
  const { object: metaResult } = await generateObject({
    model,
    schema: metaReviewSchema,
    system: metaPrompt.system,
    prompt: metaPrompt.user,
    temperature: 0.3,
  });

  return {
    individualReviews: reviews,
    averagedScores: avgScores,
    metaReview: metaResult.metaReview,
    consensusDecision: metaResult.consensusDecision,
    agreementLevel,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════════

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/**
 * Map an overall score to a human-readable verdict.
 */
function overallScoreToVerdict(score: number): string {
  if (score >= 8) return 'Strong Accept';
  if (score >= 6) return 'Weak Accept';
  if (score >= 5) return 'Borderline';
  if (score >= 3) return 'Weak Reject';
  return 'Strong Reject';
}

/**
 * Calculate a letter grade from averaged scores.
 */
function scoresToGrade(scores: PaperReviewScores): string {
  const composite = (
    scores.originality * 0.2 +
    scores.quality * 0.2 +
    scores.significance * 0.15 +
    scores.soundness * 0.15 +
    scores.clarity * 0.1 +
    scores.presentation * 0.1 +
    scores.contribution * 0.1
  );
  if (composite >= 3.5) return 'A';
  if (composite >= 3.0) return 'A-';
  if (composite >= 2.5) return 'B+';
  if (composite >= 2.0) return 'B';
  if (composite >= 1.5) return 'C';
  return 'D';
}
