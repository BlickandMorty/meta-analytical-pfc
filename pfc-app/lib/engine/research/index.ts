/**
 * Research Engine — Barrel Export
 *
 * Unified export for all research tool modules:
 * - Semantic Scholar API client (search, citations, references)
 * - Novelty checker (iterative literature assessment)
 * - Paper review (NeurIPS-style scoring with ensemble support)
 * - Citation search (LLM-driven citation gathering)
 * - Idea generator (reflective refinement with dedup & novelty)
 */

// ── Semantic Scholar ──
export {
  searchPapers,
  getPaperDetails,
  getPaperCitations,
  getPaperReferences,
  extractBibtexKey,
  generateBibtex,
  s2PaperToResearchPaper,
  type S2Paper,
  type S2SearchResult,
  type SemanticScholarConfig,
} from './semantic-scholar';

// ── Novelty Check ──
export {
  checkNovelty,
  type NoveltyCheckInput,
  type NoveltyCheckRound,
  type NoveltyCheckResult,
} from './novelty-check';

// ── Paper Review ──
export {
  reviewPaper,
  ensembleReviewPaper,
  overallScoreToVerdict,
  scoresToGrade,
  type PaperReviewInput,
  type PaperReviewScores,
  type PaperReview,
  type EnsembleReview,
} from './paper-review';

// ── Citation Search ──
export {
  searchCitations,
  findCitationsForClaim,
  citationMatchesToResearchPapers,
  type CitationSearchInput,
  type CitationMatch,
  type CitationSearchRound,
  type CitationSearchResult,
  type IdentifiedClaim,
} from './citation-search';

// ── Idea Generator ──
export {
  generateIdeas,
  generateQuickIdea,
  refineIdea,
  type ResearchIdea,
  type IdeaGenerationInput,
  type IdeaGenerationResult,
  type GeneratedIdea,
  type ReflectionRound,
} from './idea-generator';
