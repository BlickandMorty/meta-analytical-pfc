/**
 * Research API — Unified Route Handler
 *
 * Dynamic route handling all research tool actions:
 * - search-papers:     Search Semantic Scholar
 * - paper-details:     Get paper by ID/DOI/ArXiv
 * - paper-citations:   Get papers citing a paper
 * - paper-references:  Get papers cited by a paper
 * - check-novelty:     Iterative novelty assessment
 * - review-paper:      NeurIPS-style paper review
 * - ensemble-review:   Multi-reviewer ensemble review
 * - search-citations:  LLM-driven citation gathering
 * - find-citation:     Quick single-claim citation search
 * - generate-ideas:    Research idea generation
 * - quick-idea:        Quick single idea generation
 * - refine-idea:       Refine an existing idea
 *
 * All LLM-dependent endpoints require InferenceConfig in the request body
 * (mode must be 'api' or 'local', not 'simulation').
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/api-middleware';
import { logger } from '@/lib/debug-logger';
import { resolveProvider } from '@/lib/engine/llm/provider';
import type { InferenceConfig } from '@/lib/engine/llm/config';
import { ApiClientError, parseBodyWithLimit } from '@/lib/api-utils';

// Semantic Scholar (no LLM needed)
import {
  searchPapers,
  getPaperDetails,
  getPaperCitations,
  getPaperReferences,
  type SemanticScholarConfig,
} from '@/lib/engine/research/semantic-scholar';

// LLM-dependent tools
import { checkNovelty } from '@/lib/engine/research/novelty-check';
import { reviewPaper, ensembleReviewPaper } from '@/lib/engine/research/paper-review';
import { searchCitations, findCitationsForClaim } from '@/lib/engine/research/citation-search';
import { generateIdeas, generateQuickIdea, refineIdea } from '@/lib/engine/research/idea-generator';
import type { ResearchIdea } from '@/lib/engine/research/idea-generator';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getS2Config(): SemanticScholarConfig {
  return {
    apiKey: process.env.S2_API_KEY || undefined,
    maxRetries: 3,
    retryDelayMs: 1000,
  };
}

/** Clamp a numeric param to a safe range */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Cap string length to prevent oversized LLM prompts */
function capStr(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.slice(0, maxLen);
}

interface ResearchRequestBody {
  inferenceConfig?: InferenceConfig;
  query?: string;
  year?: string;
  fieldsOfStudy?: string;
  limit?: number;
  offset?: number;
  paperId?: string;
  title?: string;
  description?: string;
  hypothesis?: string;
  keywords?: string[];
  maxRounds?: number;
  papersPerRound?: number;
  abstract?: string;
  fullText?: string;
  sectionSummaries?: {
    introduction?: string;
    methodology?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
  };
  numReviewers?: number;
  text?: string;
  existingBibtex?: string;
  context?: string;
  papersPerQuery?: number;
  claim?: string;
  topic?: string;
  constraints?: string;
  seedIdeas?: ResearchIdea[];
  existingIdeas?: string[];
  checkNoveltyEnabled?: boolean;
  deduplicateEnabled?: boolean;
  numIdeas?: number;
  numReflections?: number;
  idea?: ResearchIdea;
  numRounds?: number;
}

function resolveModel(body: ResearchRequestBody) {
  const inferenceConfig = body.inferenceConfig as InferenceConfig | undefined;
  if (!inferenceConfig) {
    throw new ApiClientError('inferenceConfig is required for LLM-dependent research tools', 400);
  }
  if (inferenceConfig.mode === 'simulation') {
    throw new ApiClientError('Research tools require a real LLM — switch to API or Local mode in Settings', 400);
  }
  return resolveProvider(inferenceConfig);
}

// ═══════════════════════════════════════════════════════════════════
// Route Handler
// ═══════════════════════════════════════════════════════════════════

async function _POST(
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) {
  const params = context!.params;
  try {
    const parsedBody = await parseBodyWithLimit<ResearchRequestBody>(request, 5 * 1024 * 1024);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const { action } = await params;
    const body = parsedBody.data;
    const s2Config = getS2Config();

    switch (action) {
      // ─────────────────────────────────────────────────────
      // Semantic Scholar (no LLM)
      // ─────────────────────────────────────────────────────

      case 'search-papers': {
        const { query, year, fieldsOfStudy } = body;
        if (!query || typeof query !== 'string') return errorResponse('Missing required field: query', 400);
        if (query.length > 500) return errorResponse('query too long (max 500 chars)', 400);
        const results = await searchPapers(query, {
          limit: clampInt(body.limit, 1, 100, 10),
          offset: clampInt(body.offset, 0, 10000, 0),
          year,
          fieldsOfStudy,
          config: s2Config,
        });
        return NextResponse.json(results);
      }

      case 'paper-details': {
        const { paperId } = body;
        if (!paperId) return errorResponse('Missing required field: paperId', 400);
        const paper = await getPaperDetails(paperId, s2Config);
        if (!paper) return errorResponse('Paper not found', 404);
        return NextResponse.json(paper);
      }

      case 'paper-citations': {
        const { paperId } = body;
        if (!paperId) return errorResponse('Missing required field: paperId', 400);
        const citations = await getPaperCitations(paperId, { limit: clampInt(body.limit, 1, 100, 10), config: s2Config });
        return NextResponse.json({ data: citations });
      }

      case 'paper-references': {
        const { paperId } = body;
        if (!paperId) return errorResponse('Missing required field: paperId', 400);
        const references = await getPaperReferences(paperId, { limit: clampInt(body.limit, 1, 100, 10), config: s2Config });
        return NextResponse.json({ data: references });
      }

      // ─────────────────────────────────────────────────────
      // Novelty Check (LLM + S2)
      // ─────────────────────────────────────────────────────

      case 'check-novelty': {
        const model = resolveModel(body);
        const title = capStr(body.title, 500);
        const description = capStr(body.description, 5000);
        const hypothesis = capStr(body.hypothesis, 2000);
        const keywords = body.keywords;
        if (!title || !description) {
          return errorResponse('Missing required fields: title, description', 400);
        }
        const result = await checkNovelty(
          model,
          { title, description, hypothesis, keywords },
          {
            maxRounds: clampInt(body.maxRounds, 1, 10, 5),
            papersPerRound: clampInt(body.papersPerRound, 1, 20, 10),
            s2Config,
          },
        );
        return NextResponse.json(result);
      }

      // ─────────────────────────────────────────────────────
      // Paper Review (LLM)
      // ─────────────────────────────────────────────────────

      case 'review-paper': {
        const model = resolveModel(body);
        const title = capStr(body.title, 500);
        const abstract = capStr(body.abstract, 5000);
        const fullText = capStr(body.fullText, 50000);
        const sectionSummaries = body.sectionSummaries;
        if (!title || !abstract) {
          return errorResponse('Missing required fields: title, abstract', 400);
        }
        const review = await reviewPaper(model, { title, abstract, fullText, sectionSummaries });
        return NextResponse.json(review);
      }

      case 'ensemble-review': {
        const model = resolveModel(body);
        const title = capStr(body.title, 500);
        const abstract = capStr(body.abstract, 5000);
        const fullText = capStr(body.fullText, 50000);
        const sectionSummaries = body.sectionSummaries;
        if (!title || !abstract) {
          return errorResponse('Missing required fields: title, abstract', 400);
        }
        const review = await ensembleReviewPaper(
          model,
          { title, abstract, fullText, sectionSummaries },
          { numReviewers: clampInt(body.numReviewers, 1, 7, 3) },
        );
        return NextResponse.json(review);
      }

      // ─────────────────────────────────────────────────────
      // Citation Search (LLM + S2)
      // ─────────────────────────────────────────────────────

      case 'search-citations': {
        const model = resolveModel(body);
        const text = capStr(body.text, 20000);
        const existingBibtex = capStr(body.existingBibtex, 10000);
        const context = capStr(body.context, 5000);
        if (!text) {
          return errorResponse('Missing required field: text', 400);
        }
        const result = await searchCitations(
          model,
          { text, existingBibtex, context },
          {
            maxRounds: clampInt(body.maxRounds, 1, 5, 2),
            papersPerQuery: clampInt(body.papersPerQuery, 1, 20, 5),
            s2Config,
          },
        );
        return NextResponse.json(result);
      }

      case 'find-citation': {
        const model = resolveModel(body);
        const claim = capStr(body.claim, 2000);
        if (!claim) {
          return errorResponse('Missing required field: claim', 400);
        }
        const result = await findCitationsForClaim(model, claim, {
          limit: clampInt(body.limit, 1, 20, 5),
          s2Config,
        });
        return NextResponse.json(result);
      }

      // ─────────────────────────────────────────────────────
      // Idea Generation (LLM, optionally + S2)
      // ─────────────────────────────────────────────────────

      case 'generate-ideas': {
        const model = resolveModel(body);
        const topic = capStr(body.topic, 2000);
        const context = capStr(body.context, 5000);
        const constraints = capStr(body.constraints, 2000);
        const { seedIdeas, existingIdeas, checkNoveltyEnabled, deduplicateEnabled } = body;
        if (!topic) {
          return errorResponse('Missing required field: topic', 400);
        }
        const result = await generateIdeas(
          model,
          { topic, context, constraints, seedIdeas, existingIdeas },
          {
            numIdeas: clampInt(body.numIdeas, 1, 10, 3),
            numReflections: clampInt(body.numReflections, 0, 5, 3),
            checkNoveltyEnabled: checkNoveltyEnabled ?? false,
            deduplicateEnabled: deduplicateEnabled ?? true,
            s2Config,
          },
        );
        return NextResponse.json(result);
      }

      case 'quick-idea': {
        const model = resolveModel(body);
        const topic = capStr(body.topic, 2000);
        const context = capStr(body.context, 5000);
        if (!topic) {
          return errorResponse('Missing required field: topic', 400);
        }
        const idea = await generateQuickIdea(model, topic, context);
        return NextResponse.json(idea);
      }

      case 'refine-idea': {
        const model = resolveModel(body);
        const { idea } = body;
        if (!idea?.name || !idea?.title || !idea?.experiment) {
          return errorResponse('Missing required fields: idea.name, idea.title, idea.experiment', 400);
        }
        const result = await refineIdea(model, idea, clampInt(body.numRounds, 1, 5, 2));
        return NextResponse.json(result);
      }

      // ─────────────────────────────────────────────────────
      default:
        return errorResponse('Unknown research action', 404);
    }
  } catch (error) {
    if (error instanceof ApiClientError) {
      return errorResponse(error.message, error.status);
    }
    logger.error('research/route', 'Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research operation failed' },
      { status: 500 },
    );
  }
}

export const POST = withMiddleware(_POST, { maxRequests: 30, windowMs: 60_000 });
