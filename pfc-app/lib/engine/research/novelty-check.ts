/**
 * Novelty Checker — Iterative Literature Novelty Assessment
 *
 * Ported from AI-Scientist v1's `check_idea_novelty()` in `generate_ideas.py`.
 *
 * Given a research idea, iteratively searches Semantic Scholar to determine
 * if similar work already exists. The LLM formulates search queries, reviews
 * results, and decides whether the idea is novel or already published.
 *
 * Max rounds: configurable (default 5). Each round:
 * 1. LLM formulates a search query based on the idea
 * 2. Semantic Scholar returns top papers
 * 3. LLM evaluates novelty against found papers
 * 4. Decision: "novel", "not_novel", or "search_more"
 */

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { logger } from '@/lib/debug-logger';
import { searchPapers, type S2Paper, type SemanticScholarConfig } from './semantic-scholar';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface NoveltyCheckInput {
  title: string;
  description: string;
  hypothesis?: string;
  keywords?: string[];
}

export interface NoveltyCheckRound {
  roundNumber: number;
  searchQuery: string;
  papersFound: {
    title: string;
    authors: string;
    year: number | null;
    citationCount: number;
    abstract: string | null;
    similarity: string;
  }[];
  reasoning: string;
  decision: 'novel' | 'not_novel' | 'search_more';
}

export interface NoveltyCheckResult {
  isNovel: boolean;
  confidence: number;
  rounds: NoveltyCheckRound[];
  summary: string;
  closestPapers: S2Paper[];
  totalPapersReviewed: number;
}

// ═══════════════════════════════════════════════════════════════════
// Schemas for structured LLM output
// ═══════════════════════════════════════════════════════════════════

const searchQuerySchema = z.object({
  query: z.string().describe('Search query to find similar existing work on Semantic Scholar'),
  reasoning: z.string().describe('Why this query would find similar work if it exists'),
});

const noveltyEvaluationSchema = z.object({
  decision: z.enum(['novel', 'not_novel', 'search_more']).describe(
    'novel = idea is sufficiently unique, not_novel = existing work covers this, search_more = need to search with different terms'
  ),
  confidence: z.number().min(0).max(1).describe('Confidence in the decision (0-1)'),
  reasoning: z.string().describe('Detailed reasoning about novelty assessment'),
  paperSimilarities: z.array(z.object({
    paperTitle: z.string(),
    similarity: z.string().describe('How similar this paper is to the proposed idea'),
  })).describe('Similarity assessment for each paper found'),
  nextQuery: z.string().optional().describe('If search_more, the next query to try'),
});

// ═══════════════════════════════════════════════════════════════════
// Prompts
// ═══════════════════════════════════════════════════════════════════

function buildSearchQueryPrompt(idea: NoveltyCheckInput, previousQueries: string[]): {
  system: string;
  user: string;
} {
  return {
    system: `You are a research literature expert. Given a research idea, formulate a precise search query for Semantic Scholar that would find the most similar existing published work.

Your query should:
- Use technical terms from the field
- Include key methodology and application domain terms
- Be specific enough to find closely related work, not just vaguely similar papers
- Avoid repeating previous queries that found nothing relevant

Previous queries tried: ${previousQueries.length > 0 ? previousQueries.join(', ') : 'none'}`,

    user: `Research idea to check for novelty:

Title: ${idea.title}
Description: ${idea.description}
${idea.hypothesis ? `Hypothesis: ${idea.hypothesis}` : ''}
${idea.keywords?.length ? `Keywords: ${idea.keywords.join(', ')}` : ''}

Formulate a search query to find existing work that is similar to this idea.`,
  };
}

function buildNoveltyEvalPrompt(
  idea: NoveltyCheckInput,
  papers: S2Paper[],
  roundNumber: number,
  maxRounds: number,
): { system: string; user: string } {
  const paperSummaries = papers
    .map((p, i) => {
      const authors = p.authors.slice(0, 3).map((a) => a.name).join(', ');
      return `${i + 1}. "${p.title}" (${authors}, ${p.year ?? 'n.d.'}) — ${p.citationCount} citations
   Abstract: ${p.abstract?.slice(0, 300) ?? 'No abstract available'}`;
    })
    .join('\n\n');

  return {
    system: `You are a research novelty evaluator. You must assess whether a proposed research idea is sufficiently novel compared to existing published literature.

Guidelines:
- An idea is "novel" if it presents a meaningfully different approach, application, or combination not found in existing work
- An idea is "not_novel" if existing papers substantially cover the same ground
- Choose "search_more" only if you believe different search terms might reveal more relevant papers
- This is round ${roundNumber} of ${maxRounds}. If this is the last round, you must choose "novel" or "not_novel".
- Be rigorous but fair — incremental improvements and new applications of known methods can still be novel`,

    user: `Research idea being evaluated:

Title: ${idea.title}
Description: ${idea.description}
${idea.hypothesis ? `Hypothesis: ${idea.hypothesis}` : ''}

Papers found in literature search:

${papers.length > 0 ? paperSummaries : 'No papers found matching the search query.'}

Based on these results, assess the novelty of the proposed research idea.`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Main Function
// ═══════════════════════════════════════════════════════════════════

/**
 * Check the novelty of a research idea against published literature.
 *
 * Performs iterative search rounds where an LLM formulates queries,
 * reviews results, and makes a novelty determination.
 */
export async function checkNovelty(
  model: LanguageModel,
  idea: NoveltyCheckInput,
  options?: {
    maxRounds?: number;
    papersPerRound?: number;
    s2Config?: SemanticScholarConfig;
  },
): Promise<NoveltyCheckResult> {
  const maxRounds = options?.maxRounds ?? 5;
  const papersPerRound = options?.papersPerRound ?? 10;
  const s2Config = options?.s2Config;

  const rounds: NoveltyCheckRound[] = [];
  const allPapersFound: S2Paper[] = [];
  const previousQueries: string[] = [];
  let isNovel = true;
  let confidence = 0.5;

  for (let round = 1; round <= maxRounds; round++) {
    // Step 1: Generate search query
    const queryPrompt = buildSearchQueryPrompt(idea, previousQueries);
    const { object: queryResult } = await generateObject({
      model,
      schema: searchQuerySchema,
      system: queryPrompt.system,
      prompt: queryPrompt.user,
      temperature: 0.3,
    });

    const searchQuery = queryResult.query;
    previousQueries.push(searchQuery);

    // Step 2: Search Semantic Scholar
    let papers: S2Paper[] = [];
    try {
      const results = await searchPapers(searchQuery, {
        limit: papersPerRound,
        config: s2Config,
      });
      papers = results.data;
    } catch (err) {
      // Search failed — continue with empty results
      logger.warn('novelty-check', `Search failed for query "${searchQuery}":`, err);
    }

    allPapersFound.push(...papers);

    // Step 3: Evaluate novelty
    const isLastRound = round === maxRounds;
    const evalPrompt = buildNoveltyEvalPrompt(idea, papers, round, maxRounds);
    const { object: evalResult } = await generateObject({
      model,
      schema: noveltyEvaluationSchema,
      system: evalPrompt.system,
      prompt: evalPrompt.user,
      temperature: 0.2,
    });

    // Record round
    const roundResult: NoveltyCheckRound = {
      roundNumber: round,
      searchQuery,
      papersFound: papers.map((p, i) => ({
        title: p.title,
        authors: p.authors.slice(0, 3).map((a) => a.name).join(', '),
        year: p.year,
        citationCount: p.citationCount,
        abstract: p.abstract?.slice(0, 200) ?? null,
        similarity: evalResult.paperSimilarities[i]?.similarity ?? 'Not assessed',
      })),
      reasoning: evalResult.reasoning,
      decision: isLastRound && evalResult.decision === 'search_more'
        ? 'novel' // Force decision on last round
        : evalResult.decision,
    };
    rounds.push(roundResult);

    // Update result
    if (roundResult.decision === 'novel') {
      isNovel = true;
      confidence = evalResult.confidence;
      break;
    } else if (roundResult.decision === 'not_novel') {
      isNovel = false;
      confidence = evalResult.confidence;
      break;
    }
    // else: search_more — continue to next round
  }

  // Deduplicate papers by title
  const seen = new Set<string>();
  const uniquePapers = allPapersFound.filter((p) => {
    const key = p.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by citation count (most cited first) for closest papers
  const closestPapers = uniquePapers
    .sort((a, b) => b.citationCount - a.citationCount)
    .slice(0, 5);

  // Generate summary from rounds
  const lastRound = rounds[rounds.length - 1];
  const summary = isNovel
    ? `The idea "${idea.title}" appears to be novel (confidence: ${Math.round(confidence * 100)}%). After ${rounds.length} search round(s) reviewing ${uniquePapers.length} papers, no existing work was found that substantially covers the same ground. ${lastRound?.reasoning ?? ''}`
    : `The idea "${idea.title}" may not be novel (confidence: ${Math.round(confidence * 100)}%). Existing literature was found that covers similar ground. ${lastRound?.reasoning ?? ''}`;

  return {
    isNovel,
    confidence,
    rounds,
    summary,
    closestPapers,
    totalPapersReviewed: uniquePapers.length,
  };
}
