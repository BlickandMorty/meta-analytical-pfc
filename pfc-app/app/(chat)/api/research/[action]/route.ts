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
import { resolveProvider } from '@/lib/engine/llm/provider';
import type { InferenceConfig } from '@/lib/engine/llm/config';

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

function resolveModel(body: Record<string, unknown>) {
  const inferenceConfig = body.inferenceConfig as InferenceConfig | undefined;
  if (!inferenceConfig) {
    throw new Error('inferenceConfig is required for LLM-dependent research tools');
  }
  if (inferenceConfig.mode === 'simulation') {
    throw new Error('Research tools require a real LLM — switch to API or Local mode in Settings');
  }
  return resolveProvider(inferenceConfig);
}

// ═══════════════════════════════════════════════════════════════════
// Route Handler
// ═══════════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    const body = await request.json();
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
        const { title, description, hypothesis, keywords } = body;
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
        const { title, abstract, fullText, sectionSummaries } = body;
        if (!title || !abstract) {
          return errorResponse('Missing required fields: title, abstract', 400);
        }
        const review = await reviewPaper(model, { title, abstract, fullText, sectionSummaries });
        return NextResponse.json(review);
      }

      case 'ensemble-review': {
        const model = resolveModel(body);
        const { title, abstract, fullText, sectionSummaries } = body;
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
        const { text, existingBibtex, context } = body;
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
        const { claim } = body;
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
        const {
          topic, context, constraints, seedIdeas, existingIdeas,
          checkNoveltyEnabled, deduplicateEnabled,
        } = body;
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
        const { topic, context } = body;
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
        return errorResponse(`Unknown research action: ${action}`, 404);
    }
  } catch (error) {
    console.error('[research/route] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research operation failed' },
      { status: 500 },
    );
  }
}
