/**
 * Citation Search Engine — Iterative LLM-Driven Citation Gathering
 *
 * Ported from AI-Scientist's `gather_citations()` in `perform_writeup.py`.
 *
 * Given a research text, iteratively identifies claims needing citations,
 * searches Semantic Scholar, and maps the best papers to each claim.
 *
 * Flow per round:
 * 1. LLM reads text and identifies uncited claims
 * 2. For each claim, LLM formulates a Semantic Scholar search query
 * 3. Semantic Scholar returns candidate papers
 * 4. LLM selects the most relevant papers for each claim
 * 5. BibTeX entries are compiled and claims are annotated
 *
 * Supports multiple rounds to catch claims missed in earlier passes.
 */

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { logger } from '@/lib/debug-logger';
import {
  searchPapers,
  generateBibtex,
  extractBibtexKey,
  s2PaperToResearchPaper,
  type S2Paper,
  type SemanticScholarConfig,
} from './semantic-scholar';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface CitationSearchInput {
  text: string;                     // The research text to annotate
  existingBibtex?: string;          // Already-known BibTeX entries (avoid duplicates)
  context?: string;                 // Optional context about the paper topic
}

interface IdentifiedClaim {
  claim: string;                    // The exact claim text
  searchQuery: string;              // Query to search for supporting papers
  location: string;                 // Approximate location in text (e.g. "paragraph 3")
  importance: 'critical' | 'important' | 'nice-to-have';
}

interface CitationMatch {
  claim: string;
  paper: S2Paper;
  bibtexKey: string;
  bibtex: string;
  relevanceScore: number;           // 0-1 how relevant this paper is to the claim
  explanation: string;              // Why this paper supports the claim
}

interface CitationSearchRound {
  roundNumber: number;
  claimsIdentified: IdentifiedClaim[];
  matchesFound: CitationMatch[];
  newPapersFound: number;
}

interface CitationSearchResult {
  rounds: CitationSearchRound[];
  allMatches: CitationMatch[];
  bibtexEntries: string[];          // All unique BibTeX entries
  annotatedText: string;            // Text with \cite{key} annotations
  totalClaimsFound: number;
  totalPapersMatched: number;
  papers: S2Paper[];                // All unique papers found
}

// ═══════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════

const identifyClaimsSchema = z.object({
  claims: z.array(z.object({
    claim: z.string().describe('The exact claim or statement from the text that needs a citation'),
    searchQuery: z.string().describe('A 5-15 word Semantic Scholar search query to find supporting papers'),
    location: z.string().describe('Where this claim appears (e.g., "paragraph 2", "introduction", "results section")'),
    importance: z.enum(['critical', 'important', 'nice-to-have']).describe(
      'How important it is to cite this claim: critical = core argument, important = supports key points, nice-to-have = adds credibility'
    ),
  })).min(0).max(15).describe('Claims in the text that need citations'),
});

const selectPapersSchema = z.object({
  selections: z.array(z.object({
    claimIndex: z.number().describe('Index of the claim this paper supports (0-based)'),
    paperIndex: z.number().describe('Index of the selected paper from the candidates (0-based)'),
    relevanceScore: z.number().min(0).max(1).describe('How relevant this paper is to the claim (0-1)'),
    explanation: z.string().describe('Brief explanation of why this paper supports the claim'),
  })).describe('Selected papers matched to claims'),
});

const annotateCitationsSchema = z.object({
  annotatedText: z.string().describe('The original text with \\cite{key} references inserted at appropriate positions'),
});

// ═══════════════════════════════════════════════════════════════════
// Prompts
// ═══════════════════════════════════════════════════════════════════

function buildClaimIdentificationPrompt(
  text: string,
  context?: string,
  previouslyCited?: string[],
): { system: string; user: string } {
  return {
    system: `You are an expert academic editor specializing in ensuring proper citation coverage in research papers.

Your task is to identify statements, claims, and assertions in the given text that need citations from the published literature. Focus on:
- Factual claims about the state of the field
- References to specific methods, techniques, or algorithms
- Claims about performance, benchmarks, or comparisons
- Theoretical foundations or established results
- Statistical facts or empirical findings

Do NOT flag:
- The paper's own novel contributions or results
- Obvious common knowledge (e.g., "neural networks are used in machine learning")
- Statements that are clearly the author's own analysis or interpretation
- Claims that are already cited

${previouslyCited?.length ? `The following claims are already cited — skip them:\n${previouslyCited.map((c) => `- ${c}`).join('\n')}` : ''}`,

    user: `${context ? `Context: This text is about ${context}\n\n` : ''}Text to analyze:

${text.slice(0, 8000)}

Identify claims that need citations and suggest search queries to find supporting papers.`,
  };
}

function buildPaperSelectionPrompt(
  claims: IdentifiedClaim[],
  candidatePapers: S2Paper[][],
): { system: string; user: string } {
  const claimsWithPapers = claims.map((claim, ci) => {
    const papers = candidatePapers[ci] ?? [];
    const paperList = papers.map((p, pi) => {
      const authors = p.authors.slice(0, 3).map((a) => a.name).join(', ');
      return `  [${pi}] "${p.title}" (${authors}, ${p.year ?? 'n.d.'}) — ${p.citationCount} citations
       Abstract: ${p.abstract?.slice(0, 200) ?? 'No abstract'}`;
    }).join('\n');

    return `Claim [${ci}]: "${claim.claim}" (${claim.importance})
Candidate papers:
${papers.length > 0 ? paperList : '  No papers found'}`;
  }).join('\n\n');

  return {
    system: `You are an expert at matching research claims to supporting literature. For each claim, select the most relevant paper(s) from the candidates. Only select papers that genuinely support or are relevant to the claim.

Rules:
- Only match papers with relevance score >= 0.5
- A paper can support multiple claims
- Not every claim needs to be matched — if no good match exists, skip it
- Prefer higher-cited papers when relevance is similar
- Be precise about why a paper supports a specific claim`,

    user: `Match the following claims to their best supporting papers:

${claimsWithPapers}

Select the best paper(s) for each claim.`,
  };
}

function buildAnnotationPrompt(
  text: string,
  matches: CitationMatch[],
): { system: string; user: string } {
  const matchList = matches.map((m) => {
    return `Claim: "${m.claim}"
Citation key: \\cite{${m.bibtexKey}}
Paper: "${m.paper.title}"`;
  }).join('\n\n');

  return {
    system: `You are an expert academic editor. Insert citation references into the text at the appropriate positions. Use \\cite{key} format.

Rules:
- Place citations at the end of the relevant sentence or clause
- Do not alter the original text except to insert \\cite{} references
- If a sentence already has a citation, you can add additional ones
- Maintain all original formatting and line breaks
- Only insert citations from the provided list — do not invent new ones`,

    user: `Original text:
${text.slice(0, 8000)}

Citations to insert:
${matchList}

Return the text with citations inserted at the correct positions.`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Main Function
// ═══════════════════════════════════════════════════════════════════

/**
 * Search for citations for a research text.
 *
 * Iteratively identifies claims needing citations, searches Semantic Scholar,
 * and matches the best papers to each claim.
 */
export async function searchCitations(
  model: LanguageModel,
  input: CitationSearchInput,
  options?: {
    maxRounds?: number;
    papersPerQuery?: number;
    minRelevanceScore?: number;
    s2Config?: SemanticScholarConfig;
  },
): Promise<CitationSearchResult> {
  const maxRounds = options?.maxRounds ?? 2;
  const papersPerQuery = options?.papersPerQuery ?? 5;
  const minRelevanceScore = options?.minRelevanceScore ?? 0.5;
  const s2Config = options?.s2Config;

  const allRounds: CitationSearchRound[] = [];
  const allMatches: CitationMatch[] = [];
  const allPapers = new Map<string, S2Paper>();
  const citedClaims: string[] = [];

  for (let round = 1; round <= maxRounds; round++) {
    // ── Step 1: Identify claims needing citations ──
    const claimPrompt = buildClaimIdentificationPrompt(
      input.text,
      input.context,
      citedClaims,
    );
    const { object: claimsResult } = await generateObject({
      model,
      schema: identifyClaimsSchema,
      system: claimPrompt.system,
      prompt: claimPrompt.user,
      temperature: 0.3,
    });

    const claims = claimsResult.claims;
    if (claims.length === 0) break; // No more claims to cite

    // ── Step 2: Search Semantic Scholar for each claim ──
    const candidatePapers: S2Paper[][] = await Promise.all(
      claims.map(async (claim) => {
        try {
          const results = await searchPapers(claim.searchQuery, {
            limit: papersPerQuery,
            config: s2Config,
          });
          return results.data;
        } catch (err) {
          logger.warn('citation-search', `Search failed for "${claim.searchQuery}":`, err);
          return [];
        }
      }),
    );

    // ── Step 3: LLM selects best papers per claim ──
    const selectionPrompt = buildPaperSelectionPrompt(claims, candidatePapers);
    const { object: selectionResult } = await generateObject({
      model,
      schema: selectPapersSchema,
      system: selectionPrompt.system,
      prompt: selectionPrompt.user,
      temperature: 0.2,
    });

    // ── Step 4: Build citation matches ──
    const roundMatches: CitationMatch[] = [];
    for (const sel of selectionResult.selections) {
      if (sel.relevanceScore < minRelevanceScore) continue;
      if (sel.claimIndex < 0 || sel.claimIndex >= claims.length) continue;

      const papers = candidatePapers[sel.claimIndex] ?? [];
      if (sel.paperIndex < 0 || sel.paperIndex >= papers.length) continue;

      const paper = papers[sel.paperIndex]!;
      const claim = claims[sel.claimIndex]!;

      // Get or generate BibTeX
      const bibtex = paper.citationStyles?.bibtex
        ? paper.citationStyles.bibtex
        : generateBibtex(paper);
      const bibtexKey = extractBibtexKey(bibtex) ?? `ref${allMatches.length + roundMatches.length}`;

      const match: CitationMatch = {
        claim: claim.claim,
        paper,
        bibtexKey,
        bibtex,
        relevanceScore: sel.relevanceScore,
        explanation: sel.explanation,
      };

      roundMatches.push(match);
      allPapers.set(paper.paperId, paper);
      citedClaims.push(claim.claim);
    }

    allMatches.push(...roundMatches);

    allRounds.push({
      roundNumber: round,
      claimsIdentified: claims,
      matchesFound: roundMatches,
      newPapersFound: roundMatches.length,
    });

    // Stop early if we found very few new matches (diminishing returns)
    if (roundMatches.length === 0 && round > 1) break;
  }

  // ── Step 5: Annotate text with citations ──
  let annotatedText = input.text;
  if (allMatches.length > 0) {
    try {
      const annotationPrompt = buildAnnotationPrompt(input.text, allMatches);
      const { object: annotationResult } = await generateObject({
        model,
        schema: annotateCitationsSchema,
        system: annotationPrompt.system,
        prompt: annotationPrompt.user,
        temperature: 0.1,
      });
      annotatedText = annotationResult.annotatedText;
    } catch (err) {
      logger.warn('citation-search', 'Annotation failed, returning unannotated text:', err);
    }
  }

  // Deduplicate BibTeX entries by key
  const bibtexMap = new Map<string, string>();
  for (const match of allMatches) {
    if (!bibtexMap.has(match.bibtexKey)) {
      bibtexMap.set(match.bibtexKey, match.bibtex);
    }
  }

  return {
    rounds: allRounds,
    allMatches,
    bibtexEntries: Array.from(bibtexMap.values()),
    annotatedText,
    totalClaimsFound: allRounds.reduce((sum, r) => sum + r.claimsIdentified.length, 0),
    totalPapersMatched: allMatches.length,
    papers: Array.from(allPapers.values()),
  };
}

// ═══════════════════════════════════════════════════════════════════
// Utility — Quick citation search for a single claim
// ═══════════════════════════════════════════════════════════════════

/**
 * Search for papers supporting a single claim.
 * Lighter-weight than full searchCitations() — no annotation pass.
 */
export async function findCitationsForClaim(
  model: LanguageModel,
  claim: string,
  options?: {
    limit?: number;
    s2Config?: SemanticScholarConfig;
  },
): Promise<{ papers: S2Paper[]; bibtexEntries: string[] }> {
  const limit = options?.limit ?? 5;

  // LLM generates a search query
  const { object: queryResult } = await generateObject({
    model,
    schema: z.object({
      query: z.string().describe('Semantic Scholar search query to find papers supporting this claim'),
    }),
    system: 'You are a research assistant. Generate a precise Semantic Scholar search query to find papers supporting the given claim.',
    prompt: `Find papers that support or relate to this claim:\n\n"${claim}"`,
    temperature: 0.3,
  });

  try {
    const results = await searchPapers(queryResult.query, {
      limit,
      config: options?.s2Config,
    });

    const bibtexEntries = results.data.map((p) =>
      p.citationStyles?.bibtex ?? generateBibtex(p),
    );

    return { papers: results.data, bibtexEntries };
  } catch {
    return { papers: [], bibtexEntries: [] };
  }
}

/**
 * Convert all citation matches to the app's ResearchPaper format.
 */
function citationMatchesToResearchPapers(
  matches: CitationMatch[],
): import('@/lib/research/types').ResearchPaper[] {
  const seen = new Set<string>();
  return matches
    .filter((m) => {
      if (seen.has(m.paper.paperId)) return false;
      seen.add(m.paper.paperId);
      return true;
    })
    .map((m) => s2PaperToResearchPaper(m.paper));
}
