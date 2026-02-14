/**
 * Semantic Scholar API Client
 *
 * Ported from AI-Scientist's `tools/semantic_scholar.py`.
 * Provides paper search, citation lookup, and BibTeX retrieval
 * via the Semantic Scholar Academic Graph API.
 *
 * Endpoints used:
 *   - Paper Search: GET /graph/v1/paper/search
 *   - Paper Details: GET /graph/v1/paper/{paperId}
 *
 * Rate limits: 100 req/5min without key, 1 req/sec recommended.
 * With S2_API_KEY: higher throughput.
 */

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export interface S2Paper {
  paperId: string;
  title: string;
  authors: { authorId: string | null; name: string }[];
  year: number | null;
  venue: string;
  abstract: string | null;
  citationCount: number;
  url: string;
  citationStyles?: {
    bibtex?: string;
  };
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
  };
  openAccessPdf?: {
    url: string;
  } | null;
  tldr?: {
    text: string;
  } | null;
}

interface S2SearchResult {
  total: number;
  offset: number;
  data: S2Paper[];
}

export interface SemanticScholarConfig {
  apiKey?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const BASE_URL = 'https://api.semanticscholar.org/graph/v1';

const DEFAULT_FIELDS = [
  'title',
  'authors',
  'venue',
  'year',
  'abstract',
  'citationCount',
  'url',
  'citationStyles',
  'externalIds',
  'openAccessPdf',
  'tldr',
].join(',');

// ═══════════════════════════════════════════════════════════════════
// Helper — fetch with exponential backoff
// ═══════════════════════════════════════════════════════════════════

async function fetchWithBackoff(
  url: string,
  headers: Record<string, string>,
  maxRetries: number,
  baseDelayMs: number,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15_000), // 15s hard timeout per attempt
        cache: 'no-store', // avoid ISR/stale caching in route context
      });

      if (res.ok) return res;

      // Rate limited — use longer backoff (S2 public tier: 100 req/5min)
      if (res.status === 429) {
        if (attempt >= maxRetries) {
          throw new Error('Semantic Scholar rate limit exceeded — please wait a moment and try again');
        }
        const delay = Math.max(2000, baseDelayMs * Math.pow(2, attempt + 1));
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Server error — retry
      if (res.status >= 500) {
        if (attempt >= maxRetries) {
          throw new Error(`Semantic Scholar server error: ${res.status}`);
        }
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Client error — don't retry
      throw new Error(`Semantic Scholar API error: ${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error('Semantic Scholar API request failed');
}

// ═══════════════════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════════════════

/**
 * Search for papers by query string.
 * Returns up to `limit` results sorted by relevance (with citation count tiebreak).
 */
export async function searchPapers(
  query: string,
  options?: {
    limit?: number;
    offset?: number;
    year?: string;          // e.g. "2020-2024" or "2023"
    fieldsOfStudy?: string; // e.g. "Computer Science"
    config?: SemanticScholarConfig;
  },
): Promise<S2SearchResult> {
  const limit = options?.limit ?? 10;
  const offset = options?.offset ?? 0;
  const config = options?.config ?? {};
  const maxRetries = config.maxRetries ?? 3;
  const retryDelay = config.retryDelayMs ?? 1000;

  const params = new URLSearchParams({
    query,
    limit: String(limit),
    offset: String(offset),
    fields: DEFAULT_FIELDS,
  });

  if (options?.year) params.set('year', options.year);
  if (options?.fieldsOfStudy) params.set('fieldsOfStudy', options.fieldsOfStudy);

  const headers: Record<string, string> = {};
  if (config.apiKey) headers['x-api-key'] = config.apiKey;

  const res = await fetchWithBackoff(
    `${BASE_URL}/paper/search?${params.toString()}`,
    headers,
    maxRetries,
    retryDelay,
  );

  const data = await res.json();

  return {
    total: data.total ?? 0,
    offset: data.offset ?? 0,
    data: (data.data ?? []).map(normalizePaper),
  };
}

/**
 * Get detailed information about a specific paper by ID.
 * Accepts: Semantic Scholar ID, DOI (prefix with "DOI:"), ArXiv (prefix with "ARXIV:").
 */
export async function getPaperDetails(
  paperId: string,
  config?: SemanticScholarConfig,
): Promise<S2Paper | null> {
  const maxRetries = config?.maxRetries ?? 3;
  const retryDelay = config?.retryDelayMs ?? 1000;

  const headers: Record<string, string> = {};
  if (config?.apiKey) headers['x-api-key'] = config.apiKey;

  try {
    const res = await fetchWithBackoff(
      `${BASE_URL}/paper/${encodeURIComponent(paperId)}?fields=${DEFAULT_FIELDS}`,
      headers,
      maxRetries,
      retryDelay,
    );

    const data = await res.json();
    return normalizePaper(data);
  } catch {
    return null;
  }
}

/**
 * Get citations of a specific paper.
 */
export async function getPaperCitations(
  paperId: string,
  options?: {
    limit?: number;
    config?: SemanticScholarConfig;
  },
): Promise<S2Paper[]> {
  const limit = options?.limit ?? 10;
  const config = options?.config ?? {};
  const maxRetries = config.maxRetries ?? 3;
  const retryDelay = config.retryDelayMs ?? 1000;

  const headers: Record<string, string> = {};
  if (config.apiKey) headers['x-api-key'] = config.apiKey;

  try {
    const res = await fetchWithBackoff(
      `${BASE_URL}/paper/${encodeURIComponent(paperId)}/citations?fields=${DEFAULT_FIELDS}&limit=${limit}`,
      headers,
      maxRetries,
      retryDelay,
    );

    const data = await res.json();
    return (data.data ?? [])
      .map((entry: { citingPaper: S2Paper }) => entry.citingPaper)
      .filter((p: S2Paper) => p?.title)
      .map(normalizePaper);
  } catch {
    return [];
  }
}

/**
 * Get references (papers cited by) a specific paper.
 */
export async function getPaperReferences(
  paperId: string,
  options?: {
    limit?: number;
    config?: SemanticScholarConfig;
  },
): Promise<S2Paper[]> {
  const limit = options?.limit ?? 10;
  const config = options?.config ?? {};
  const maxRetries = config.maxRetries ?? 3;
  const retryDelay = config.retryDelayMs ?? 1000;

  const headers: Record<string, string> = {};
  if (config.apiKey) headers['x-api-key'] = config.apiKey;

  try {
    const res = await fetchWithBackoff(
      `${BASE_URL}/paper/${encodeURIComponent(paperId)}/references?fields=${DEFAULT_FIELDS}&limit=${limit}`,
      headers,
      maxRetries,
      retryDelay,
    );

    const data = await res.json();
    return (data.data ?? [])
      .map((entry: { citedPaper: S2Paper }) => entry.citedPaper)
      .filter((p: S2Paper) => p?.title)
      .map(normalizePaper);
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════════

interface RawS2Author {
  authorId?: string | null;
  name?: string | null;
}

interface RawS2Paper {
  paperId?: string | null;
  title?: string | null;
  authors?: RawS2Author[] | null;
  year?: number | null;
  venue?: string | null;
  abstract?: string | null;
  citationCount?: number | null;
  url?: string | null;
  citationStyles?: S2Paper['citationStyles'];
  externalIds?: S2Paper['externalIds'];
  openAccessPdf?: S2Paper['openAccessPdf'];
  tldr?: S2Paper['tldr'];
}

function normalizePaper(raw: RawS2Paper): S2Paper {
  return {
    paperId: raw.paperId ?? '',
    title: raw.title ?? 'Untitled',
    authors: (raw.authors ?? []).map((a: RawS2Author) => ({
      authorId: a.authorId ?? null,
      name: a.name ?? 'Unknown',
    })),
    year: raw.year ?? null,
    venue: raw.venue ?? '',
    abstract: raw.abstract ?? null,
    citationCount: raw.citationCount ?? 0,
    url: raw.url ?? `https://www.semanticscholar.org/paper/${raw.paperId ?? ''}`,
    citationStyles: raw.citationStyles ?? undefined,
    externalIds: raw.externalIds ?? undefined,
    openAccessPdf: raw.openAccessPdf ?? null,
    tldr: raw.tldr ?? null,
  };
}

/**
 * Extract a clean BibTeX key from a paper's BibTeX string.
 */
export function extractBibtexKey(bibtex: string): string | null {
  const match = bibtex.match(/@\w+\{([^,]+)/);
  return match ? match[1]!.trim() : null;
}

/**
 * Generate a clean BibTeX entry if the API doesn't provide one.
 */
export function generateBibtex(paper: S2Paper): string {
  const firstAuthor = paper.authors[0]?.name.split(' ').pop()?.toLowerCase() ?? 'unknown';
  const year = paper.year ?? 'n.d.';
  const key = `${firstAuthor}${year}`;
  const authors = paper.authors.map((a) => a.name).join(' and ');
  const title = paper.title;
  const venue = paper.venue || 'Unknown Venue';

  return `@article{${key},
  title={${title}},
  author={${authors}},
  journal={${venue}},
  year={${year}},
  url={${paper.url}}
}`;
}

/**
 * Convert an S2Paper to a ResearchPaper for the app's store.
 */
export function s2PaperToResearchPaper(paper: S2Paper): import('@/lib/research/types').ResearchPaper {
  return {
    id: `s2-${paper.paperId}`,
    title: paper.title,
    authors: paper.authors.map((a) => a.name),
    year: paper.year ?? new Date().getFullYear(),
    journal: paper.venue || undefined,
    doi: paper.externalIds?.DOI || undefined,
    url: paper.url,
    abstract: paper.abstract ?? undefined,
    tags: ['semantic-scholar'],
    savedAt: Date.now(),
  };
}
